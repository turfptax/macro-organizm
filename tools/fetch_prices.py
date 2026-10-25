#!/usr/bin/env python3
"""Fetch prices, pay, housing and land series and write data/prices.js (window.MACRO_PRICES).

    python tools/fetch_prices.py                  download each source, falling back to data/raw/prices/
    python tools/fetch_prices.py --offline        rebuild from the cache only (same bytes as the last build)
    python tools/fetch_prices.py --only cpi_u,house_new_median
                                                  refresh just those series from the network
    python tools/fetch_prices.py --contact me@example.org
                                                  email for the User-Agent that download.bls.gov requires
                                                  (or set MACRO_FETCH_CONTACT); without one the BLS files
                                                  are read from the cache
    python tools/fetch_prices.py --allow-partial  write even if a series of the current file is missing from the build
    python tools/fetch_prices.py --selftest       offline checks of the helpers

Python 3.12 standard library only; shared helpers are in tools/fetchlib.py. Run it as a plain script, not with -I.
Sources, licences and break notes are in tools/README.md and in each series entry of the output.

Rules the output follows
  rows are [period, value]; a null value marks a gap and a run of missing periods is marked once, at its first
  period; nothing is interpolated and nothing is spliced across a change of product, definition or source.
Exit status: 0 all series built; 3 some optional series were skipped (the file is still written);
  1 a core series failed, or the build would drop a series that the current file has, and nothing was written
  (--allow-partial accepts the loss).
"""
import csv
import datetime as dt
import gzip
import hashlib
import io
import math
import re
import struct
import sys
import urllib.error
import urllib.request
import zlib

import fetchlib as fl

OUT = fl.ROOT / "data" / "prices.js"
GENERATOR = "tools/fetch_prices.py"
MAX_BYTES = 400000            # budget shared with tools/check-data.js; stays under data/money-supply.js
CORE = ("cpi_u", "pay_prod", "house_new_median", "price_bread", "price_eggs")

BLS = "https://download.bls.gov/pub/time.series/"
CENSUS_PRICE = "https://www.census.gov/construction/nrs/xls/price_cust.xlsx"
CENSUS_H5 = "https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx"
FHFA_HPI = "https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv"
FHFA_LAND = "https://www.fhfa.gov/document/land-prices_2024_20_june.xlsx"
SHILLER_PAGE = "https://shillerdata.com/"
H15_ID = "d7e27b7b09a3a7feae95b9c61781fcd8"
H15_URL = ("https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=" + H15_ID +
           "&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package")
H15_CHOOSE = "https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H15"
H15_TBILL = "H15/H15/RIFSGFSM03_N.M"
ONS_PAGE = "https://www.ons.gov.uk"
ONS = ONS_PAGE + "/generator?format=csv&uri="
UKHPI = "https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-{ym}.csv"
STATCAN_NHPI = "https://www150.statcan.gc.ca/n1/tbl/csv/18100205-eng.zip"
STATCAN_PAGE = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid={pid}"
STATCAN_WDS = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange"
STATCAN_CPI_VECTOR = 41690973
NASS_LIST = "https://www.nass.usda.gov/datasets/"
NASS_FILE = re.compile(r"qs\.economics_\d{8}\.txt\.gz")
NASS_SHORT = "AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE"
NASS_MAX_AGE_DAYS = 150       # the survey is published once a year, so a young extract is reused

L_BLS = "Public domain (US government work). Cite the U.S. Bureau of Labor Statistics."
L_CENSUS = "US Census Bureau data; no licence statement found, treated as public domain US federal work. Cite the U.S. Census Bureau."
L_FHFA = "US federal agency product; no licence statement found, treated as public domain. Cite the Federal Housing Finance Agency."
L_FED = "Board of Governors publication. Cite the Board of Governors of the Federal Reserve System, H.15."
L_NASS = "US federal agency data; no licence statement found, treated as public domain. Cite USDA NASS, Quick Stats."
L_SHILLER = ("No licence stated by the source. Used as derived annual values with attribution; cite R. J. Shiller, "
             "Irrational Exuberance (data for Figure 3.1). Terms of reuse not confirmed.")
L_OGL = "Open Government Licence v3.0. Contains public sector information licensed under the Open Government Licence v3.0."
L_LR = ("Open Government Licence v3.0. Contains HM Land Registry data (c) Crown copyright and database right, "
        "licensed under the Open Government Licence v3.0.")
L_STATCAN = "Statistics Canada Open Licence."


# ---------------------------------------------------------------- legacy .xls (BIFF8) reader
# Shiller's home price file is a binary .xls. This reads numbers and strings from an OLE2 workbook.

_OLE_SIG = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_FREE = 0xFFFFFFFA


def ole_streams(data):
    """Streams of an OLE2 compound file as {name: bytes}."""
    if data[:8] != _OLE_SIG:
        raise fl.ParseError("not an OLE2 (.xls) file")
    ssz = 1 << struct.unpack_from("<H", data, 30)[0]
    msz = 1 << struct.unpack_from("<H", data, 32)[0]
    nfat, dir0, _, cutoff, mfat0, nmfat, difat0, ndifat = struct.unpack_from("<IIIIIIII", data, 44)

    def sector(i):
        return data[(i + 1) * ssz:(i + 2) * ssz]

    difat = list(struct.unpack_from("<109I", data, 76))
    s = difat0
    for _ in range(ndifat):
        vals = struct.unpack("<%dI" % (ssz // 4), sector(s))
        difat.extend(vals[:-1])
        s = vals[-1]
    fat = []
    for i in difat:
        if i < _FREE:
            fat.extend(struct.unpack("<%dI" % (ssz // 4), sector(i)))
        if len(fat) >= nfat * (ssz // 4):
            break

    def chain(start, table):
        out, seen, s = [], set(), start
        while s < _FREE:
            if s in seen or s >= len(table):
                raise fl.ParseError("broken sector chain in .xls file")
            seen.add(s)
            out.append(s)
            s = table[s]
        return out

    def read_chain(start):
        return b"".join(sector(s) for s in chain(start, fat))

    dirdata = read_chain(dir0)
    entries = []
    for off in range(0, len(dirdata) - 127, 128):
        e = dirdata[off:off + 128]
        nlen = struct.unpack_from("<H", e, 64)[0]
        entries.append((e[:max(0, nlen - 2)].decode("utf-16-le", "replace"), e[66],
                        struct.unpack_from("<I", e, 116)[0], struct.unpack_from("<Q", e, 120)[0]))
    root = next((e for e in entries if e[1] == 5), None)
    if root is None:
        raise fl.ParseError("no root entry in .xls file")
    mini = read_chain(root[2]) if root[2] < _FREE else b""
    mfat = []
    if nmfat and mfat0 < _FREE:
        md = read_chain(mfat0)
        mfat = list(struct.unpack("<%dI" % (len(md) // 4), md))
    streams = {}
    for name, typ, start, size in entries:
        if typ != 2:
            continue
        if size < cutoff:
            raw = b"".join(mini[i * msz:(i + 1) * msz] for i in chain(start, mfat))
        else:
            raw = read_chain(start)
        streams[name] = raw[:size]
    return streams


def _biff_records(buf):
    pos = 0
    while pos + 4 <= len(buf):
        rid, ln = struct.unpack_from("<HH", buf, pos)
        yield rid, buf[pos + 4:pos + 4 + ln]
        pos += 4 + ln


def _rk(rk):
    if rk & 2:
        v = rk >> 2
        v = float(v - 0x40000000 if v & 0x20000000 else v)
    else:
        v = struct.unpack("<d", struct.pack("<Q", (rk & 0xFFFFFFFC) << 32))[0]
    return v / 100.0 if rk & 1 else v


def _sst(segs):
    """Shared strings. segs is the SST record body followed by its CONTINUE bodies."""
    seg, pos = 0, 8

    def take(n):
        nonlocal seg, pos
        out = b""
        while n:
            if pos >= len(segs[seg]):
                seg, pos = seg + 1, 0
                if seg >= len(segs):
                    raise fl.ParseError("shared string table ended early")
            k = min(n, len(segs[seg]) - pos)
            out += segs[seg][pos:pos + k]
            pos += k
            n -= k
        return out

    out = []
    for _ in range(struct.unpack_from("<I", segs[0], 4)[0]):
        cch = struct.unpack("<H", take(2))[0]
        flags = take(1)[0]
        runs = struct.unpack("<H", take(2))[0] if flags & 8 else 0
        ext = struct.unpack("<I", take(4))[0] if flags & 4 else 0
        wide, left, parts = flags & 1, cch, []
        while left:
            if pos >= len(segs[seg]):
                seg, pos = seg + 1, 0
                wide = take(1)[0] & 1          # a continued string repeats its width flag
                continue
            n = min(left, (len(segs[seg]) - pos) // (2 if wide else 1))
            if n == 0:
                seg, pos = seg + 1, 0
                wide = take(1)[0] & 1
                continue
            parts.append(take(n * (2 if wide else 1)).decode("utf-16-le" if wide else "latin-1"))
            left -= n
        take(4 * runs + ext)
        out.append("".join(parts))
    return out


def read_xls(data):
    """{sheet name: {(row, col): number or str}} with zero-based row and col."""
    streams = ole_streams(data)
    wb = streams.get("Workbook") or streams.get("Book")
    if wb is None:
        raise fl.ParseError("no Workbook stream in .xls file")
    sheets, segs, last = [], None, None
    for rid, body in _biff_records(wb):
        if rid == 0x0085:                       # BOUNDSHEET
            cch, fl8 = body[6], body[7]
            nm = body[8:8 + cch * (2 if fl8 & 1 else 1)].decode("utf-16-le" if fl8 & 1 else "latin-1")
            sheets.append((nm, struct.unpack_from("<I", body, 0)[0]))
        elif rid == 0x00FC:                     # SST
            segs, last = [body], "sst"
            continue
        elif rid == 0x003C and last == "sst":   # CONTINUE
            segs.append(body)
            continue
        last = None
    strings = _sst(segs) if segs else []
    out = {}
    for name, off in sheets:
        cells, pending = {}, None
        for rid, body in _biff_records(wb[off:]):
            if rid == 0x00FD:                   # LABELSST
                r, c, _, i = struct.unpack_from("<HHHI", body, 0)
                cells[(r, c)] = strings[i]
            elif rid == 0x0203:                 # NUMBER
                r, c, _ = struct.unpack_from("<HHH", body, 0)
                cells[(r, c)] = struct.unpack_from("<d", body, 6)[0]
            elif rid == 0x027E:                 # RK
                r, c, _, rk = struct.unpack_from("<HHHI", body, 0)
                cells[(r, c)] = _rk(rk)
            elif rid == 0x00BD:                 # MULRK
                r, c0 = struct.unpack_from("<HH", body, 0)
                for k in range((len(body) - 6) // 6):
                    cells[(r, c0 + k)] = _rk(struct.unpack_from("<I", body, 6 + 6 * k)[0])
            elif rid == 0x0006:                 # FORMULA, cached result
                r, c, _ = struct.unpack_from("<HHH", body, 0)
                res = body[6:14]
                if res[6:8] == b"\xff\xff":
                    pending = (r, c) if res[0] == 0 else None
                else:
                    cells[(r, c)] = struct.unpack("<d", res)[0]
            elif rid == 0x0207 and pending:     # STRING (result of the formula before it)
                cch, fl8 = struct.unpack_from("<HB", body, 0)
                cells[pending] = body[3:3 + cch * (2 if fl8 & 1 else 1)].decode("utf-16-le" if fl8 & 1 else "latin-1")
                pending = None
            elif rid == 0x000A:                 # EOF
                break
        out[name] = cells
    return out


# ------------------------------------------------------------------------------ parsers

def want_float(x):
    """Number or None for a not-available token; anything else raises."""
    return fl.to_float(x)


def parse_bls(wanted):
    """BLS flat file (tab separated) -> {series id: {period: value or None}} for the wanted ids."""
    def parse(body):
        out = {w: {} for w in wanted}
        for r in fl.read_dicts(body, "\t"):
            sid = r["series_id"]
            if sid in out and re.fullmatch(r"M(0[1-9]|1[0-2])", r["period"]):     # M13 is the annual average
                out[sid][f"{r['year']}-{r['period'][1:]}"] = want_float(r["value"])
        absent = [w for w, v in out.items() if not v]
        if absent:
            raise fl.ParseError("series not in the file: " + ", ".join(absent))
        return out
    return parse


def _serial_month(serial):
    d = fl.xl_date(serial)
    if d.day != 1:
        raise fl.ParseError(f"monthly row is not dated the 1st: {d}")
    return f"{d.year:04d}-{d.month:02d}"


def parse_census_price(body):
    book = fl.XlsxBook(body)
    monthly, annual = {}, {}
    for row in book.sheet("Monthly").rows():
        if isinstance(row[0], float) and row[0] > 10000:
            monthly[_serial_month(row[0])] = want_float(row[1])
    for row in book.sheet("Annual").rows():
        if isinstance(row[0], float) and 1900 < row[0] < 2200:
            annual[str(int(row[0]))] = want_float(row[1])
    if len(monthly) < 700 or len(annual) < 60:
        raise fl.ParseError(f"Census price table is short: {len(monthly)} months, {len(annual)} years")
    return {"monthly": monthly, "annual": annual}


def parse_census_h5(body):
    rows = fl.XlsxBook(body).sheet().rows()
    start = next((i for i, r in enumerate(rows) if r[0] == "All Races"), None)
    if start is None:
        raise fl.ParseError("no 'All Races' block in Table H-5")
    median, repeated = {}, []
    for r in rows[start + 1:]:
        a, year = r[0], None
        if isinstance(a, float):
            year = int(a)
        elif isinstance(a, str):
            m = re.fullmatch(r"(\d{4})(?:\s*\(\d+\))*", a.strip())
            year = int(m.group(1)) if m else None
        if year is None:
            if median:
                break                          # next block (White Alone ...)
            continue
        if str(year) in median:
            repeated.append(year)              # the table lists some years twice; the first listing is kept
        else:
            median[str(year)] = want_float(r[2])
    if len(median) < 55 or "1967" not in median:
        raise fl.ParseError("Table H-5 has too few years")
    return {"median": median, "repeated": sorted(set(repeated))}


def parse_fhfa_hpi(body):
    rd = csv.reader(io.StringIO(fl.decode_text(body), newline=""))
    head = next(rd)
    ix = {h: i for i, h in enumerate(head)}
    need = ("hpi_type", "hpi_flavor", "frequency", "place_id", "yr", "period", "index_nsa")
    if any(n not in ix for n in need):
        raise fl.ParseError("FHFA hpi_master.csv columns changed: " + ",".join(head))
    out = {}
    for row in rd:
        if (len(row) == len(head) and row[ix["hpi_type"]] == "traditional" and row[ix["hpi_flavor"]] == "all-transactions"
                and row[ix["frequency"]] == "quarterly" and row[ix["place_id"]] == "USA"):
            out[f"{int(row[ix['yr']]):04d}-Q{int(row[ix['period']])}"] = want_float(row[ix["index_nsa"]])
    if len(out) < 200:
        raise fl.ParseError(f"FHFA US all-transactions index has only {len(out)} quarters")
    return out


def parse_fhfa_land(body):
    rows = fl.XlsxBook(body).sheet("Panel Nation").rows()
    h = next((i for i, r in enumerate(rows) if r[0] == "Year"), None)
    if h is None:
        raise fl.ParseError("no header row in FHFA land Panel Nation")
    heads = [" ".join(str(c or "").lower().split()) for c in rows[h]]

    def col(part):
        hits = [i for i, t in enumerate(heads) if part in t]
        if len(hits) != 1:
            raise fl.ParseError(f"FHFA land column {part!r} matched {len(hits)} of {heads}")
        return hits[0]

    ci = {"acre": col("per acre"), "quarter": col("1/4 acre"), "share": col("land share")}
    out = {k: {} for k in ci}
    for r in rows[h + 1:]:
        if isinstance(r[0], float):
            for k, c in ci.items():
                out[k][str(int(r[0]))] = want_float(r[c])
    if len(out["acre"]) < 10:
        raise fl.ParseError("FHFA land panel has too few years")
    return out


def parse_shiller(body):
    cells = read_xls(body)["Data"]
    nrows = max(r for r, _ in cells) + 1
    col = None
    for c in sorted({c for _, c in cells}):
        head = " ".join(str(cells[(r, c)]) for r in range(2, 7) if (r, c) in cells)
        if head.startswith("Nominal Home Price Index"):
            col = c
    if col is None:
        raise fl.ParseError("Shiller nominal home price column not found")
    dcol, scol = col - 1, col + 1
    months, sources = {}, []
    for r in range(7, nrows):
        d, v, s = cells.get((r, dcol)), cells.get((r, col)), cells.get((r, scol))
        if not isinstance(d, float) or not isinstance(v, float):
            continue
        y = int(math.floor(d))
        m = int(math.floor((d - y) * 12 + 0.001)) + 1
        months.setdefault(y, {})[m] = v
        if not sources or sources[-1][0] != s:
            sources.append([s, y, y])
        else:
            sources[-1][2] = y
    annual = {}
    for y, mm in months.items():
        if len(mm) == 1 or len(mm) == 12:       # annual rows, or twelve interpolated months averaged
            annual[str(y)] = sum(mm.values()) / len(mm)
    if "1913" not in annual or abs(annual["1913"] - 4.37) > 0.01:
        raise fl.ParseError("Shiller index layout changed (1913 should be about 4.37)")
    return {"annual": annual, "sources": sources}


def parse_h15(body):
    rows = fl.read_rows(body)
    u = next((i for i, r in enumerate(rows) if r and r[0].startswith("Unique Identifier")), None)
    if u is None or H15_TBILL not in rows[u]:
        raise fl.ParseError("H.15 monthly file does not contain " + H15_TBILL)
    c = rows[u].index(H15_TBILL)
    out = {}
    for r in rows[u + 1:]:
        if r and re.fullmatch(r"\d{4}-\d{2}", r[0].strip()):
            v = r[c].strip() if c < len(r) else ""
            out[r[0].strip()] = None if v in ("", "ND", "NC", "NA") else float(v)
    return out


def parse_ons(cdid):
    """ONS generator csv -> {"A": {...}, "Q": {...}, "M": {...}} keyed by normalised period."""
    def parse(body):
        rows = list(csv.reader(io.StringIO(fl.decode_text(body), newline="")))
        if not any(r[:2] == ["CDID", cdid] for r in rows):
            raise fl.ParseError("ONS file is not series " + cdid)
        out = {"A": {}, "Q": {}, "M": {}}
        for r in rows:
            if len(r) >= 2 and re.match(r"\d{4}( |$)", r[0].strip()):
                p = fl.norm_period(r[0])
                out[fl.period_freq(p)][p] = want_float(r[1])
        if not out["A"] and not out["M"]:
            raise fl.ParseError("no observations for ONS series " + cdid)
        return out
    return parse


def parse_ukhpi(body):
    rows = list(csv.reader(io.StringIO(fl.decode_text(body), newline="")))
    head = rows[0]
    if head[:4] != ["Date", "Region_Name", "Area_Code", "Average_Price"]:
        raise fl.ParseError("UK HPI average price columns changed: " + ",".join(head))
    out = {fl.norm_period(r[0]): want_float(r[3]) for r in rows[1:] if len(r) >= 4 and r[2] == "K02000001"}
    if len(out) < 600:
        raise fl.ParseError(f"UK average price has only {len(out)} months")
    return out


def parse_statcan_nhpi(body):
    names = {"Total (house and land)": "total", "House only": "house", "Land only": "land"}
    out = {v: {} for v in names.values()}
    flags = {v: set() for v in names.values()}
    for r in fl.read_dicts(fl.zip_read(body, "18100205.csv")):
        k = names.get(r["New housing price indexes"])
        if r["GEO"] == "Canada" and k:
            p = fl.norm_period(r["REF_DATE"])
            out[k][p] = want_float(r["VALUE"])
            if r["STATUS"]:
                flags[k].add(r["STATUS"])
    if any(len(v) < 500 for v in out.values()):
        raise fl.ParseError("StatCan NHPI for Canada is short")
    return {"series": out, "flags": {k: sorted(v) for k, v in flags.items()}}


def parse_statcan_cpi(body):
    j = fl.read_json(body)
    if not isinstance(j, list) or not j or j[0].get("status") != "SUCCESS":
        raise fl.ParseError("StatCan WDS did not return SUCCESS")
    out = {}
    for pt in j[0]["object"]["vectorDataPoint"]:
        out[fl.norm_period(pt["refPer"][:7])] = want_float(pt["value"])
    if len(out) < 1300:
        raise fl.ParseError(f"StatCan CPI has only {len(out)} months")
    return out


def parse_nass_extract(body):
    out = {}
    for r in fl.read_dicts(body):
        out[r["year"]] = want_float(r["value"])
    if len(out) < 100:
        raise fl.ParseError(f"NASS farmland extract has only {len(out)} years")
    return out


# --------------------------------------------------------------------------------- sources

SOURCES = {
    # min_fraction rejects a download much smaller than the cached file, so a truncated body that still parses cannot replace it
    "bls_cu": dict(name="bls_cu.data.1.AllItems", url=BLS + "cu/cu.data.1.AllItems", kind="text", ua=fl.UA_CONTACT,
                   parse=parse_bls(["CUUR0000SA0"]), min_fraction=0.5),
    "bls_cu_food": dict(name="bls_cu.data.11.USFoodBeverage", url=BLS + "cu/cu.data.11.USFoodBeverage", kind="text",
                        ua=fl.UA_CONTACT, parse=parse_bls(["CUUR0000SEFN01"]), min_fraction=0.5),
    "bls_ap_food": dict(name="bls_ap.data.3.Food", url=BLS + "ap/ap.data.3.Food", kind="text", ua=fl.UA_CONTACT, min_fraction=0.5,
                        parse=parse_bls(["APU0000702111", "APU0000708111", "APU0000709112", "APU0000709111",
                                         "APU0000703112", "APU0000717311", "APU0000715211", "APU0000717111",
                                         "APU0000717113", "APU0000717114", "APU0000FN1101", "APU0000FN1102"])),
    "bls_ap_gas": dict(name="bls_ap.data.2.Gasoline", url=BLS + "ap/ap.data.2.Gasoline", kind="text", ua=fl.UA_CONTACT,
                       parse=parse_bls(["APU000074714"]), min_fraction=0.5),
    "bls_ap_fuel": dict(name="bls_ap.data.1.HouseholdFuels", url=BLS + "ap/ap.data.1.HouseholdFuels", kind="text",
                        ua=fl.UA_CONTACT, parse=parse_bls(["APU000072610"]), min_fraction=0.5),
    "bls_ce": dict(name="bls_ce.data.05c.TotalPrivate.ProductionEmployeeHoursAndEarnings",
                   url=BLS + "ce/ce.data.05c.TotalPrivate.ProductionEmployeeHoursAndEarnings", kind="text",
                   ua=fl.UA_CONTACT, parse=parse_bls(["CES0500000008"]), min_fraction=0.5),
    "census_price": dict(name="census_price_cust.xlsx", url=CENSUS_PRICE, kind="xlsx", parse=parse_census_price),
    "census_h5": dict(name="census_h05.xlsx", url=CENSUS_H5, kind="xlsx", parse=parse_census_h5),
    "fhfa_hpi": dict(name="fhfa_hpi_master.csv", url=FHFA_HPI, kind="csv", parse=parse_fhfa_hpi, timeout=90,
                     min_fraction=0.5),
    "fhfa_land": dict(name="fhfa_land_prices.xlsx", url=FHFA_LAND, kind="xlsx", parse=parse_fhfa_land, timeout=90,
                      min_fraction=0.5),
    "shiller": dict(name="shiller_fig3-1.xls", url=None, parse=parse_shiller, loader="shiller"),
    "h15": dict(name="fed_h15_monthly.csv", url=H15_URL, kind="csv", parse=parse_h15, loader="h15", min_fraction=0.5),
    "ons_cdko": dict(name="ons_cdko.csv", url=ONS + "/economy/inflationandpriceindices/timeseries/cdko/mm23", kind="csv",
                     parse=parse_ons("CDKO"), min_fraction=0.5),
    "ons_d7bt": dict(name="ons_d7bt.csv", url=ONS + "/economy/inflationandpriceindices/timeseries/d7bt/mm23", kind="csv",
                     parse=parse_ons("D7BT"), min_fraction=0.5),
    "ons_kab9": dict(name="ons_kab9.csv", url=ONS + "/employmentandlabourmarket/peopleinwork/earningsandworkinghours/"
                     "timeseries/kab9/emp", kind="csv", parse=parse_ons("KAB9"), min_fraction=0.5),
    "ukhpi": dict(name="ukhpi_average_prices.csv", url=None, parse=parse_ukhpi, loader="ukhpi"),
    "statcan_nhpi": dict(name="statcan_18100205.zip", url=STATCAN_NHPI, kind="zip", parse=parse_statcan_nhpi),
    "statcan_cpi": dict(name="statcan_cpi_v41690973.json", url=None, kind="json", parse=parse_statcan_cpi,
                        loader="statcan_cpi"),
    "nass": dict(name="nass_farmland_extract.csv", url=None, parse=parse_nass_extract, loader="nass"),
}


class Ctx:
    """Run state: the raw cache, which sources are online this run, and what each source returned."""

    def __init__(self, raw, offline, only):
        self.raw, self.offline, self.only = raw, offline, only
        self.results, self.info = {}, {}

    def online(self, key):
        if self.offline:
            return False
        if self.only is None:
            return True
        return any(SERIES_BY_ID[s]["src"] == key for s in self.only)

    def load(self, key):
        """(parsed value, retrieved date) for a source; raises what the loader raised, once per run."""
        if key not in self.results:
            try:
                self.results[key] = LOADERS.get(SOURCES[key].get("loader", "default"), load_default)(self, key)
            except Exception as e:
                self.results[key] = e
        r = self.results[key]
        if isinstance(r, Exception):
            raise r
        return r

    def record(self, key, got, url=None):
        src = SOURCES[key]
        self.info[key] = dict(url=self.raw.url_of(src["name"], url or src["url"]), retrieved=got.retrieved,
                              cached=bool(got.fell_back or not self.online(key)))


def load_default(ctx, key, url=None):
    src = SOURCES[key]
    kw = {k: src[k] for k in ("kind", "ua", "timeout", "min_fraction") if k in src}
    got = ctx.raw.get_parsed(src["name"], url or src["url"], src["parse"], online=ctx.online(key), **kw)
    ctx.record(key, got, url)
    return got


def load_shiller(ctx, key):
    src, raw = SOURCES[key], ctx.raw
    url = None
    if ctx.online(key):
        try:
            page = raw.download("shiller_home.html", SHILLER_PAGE, kind="html").decode("utf-8", "replace")
            m = re.search(r'href="((?:https:)?//img1\.wsimg\.com/[^"]*Fig3-1[^"]*\.xls[^"]*)"', page)
            if m:
                url = m.group(1).replace("&amp;", "&")
                url = "https:" + url if url.startswith("//") else url
        except fl.FetchError as e:
            fl.warn(f"shiller: could not read the download page ({e}); using the last known file address")
    url = url or raw.url_of(src["name"], None)
    if url is None and ctx.online(key):
        raise fl.FetchError("shiller: no file address found and none in the manifest")
    return load_default(ctx, key, url or "https://shillerdata.com/")


def load_h15(ctx, key):
    src, raw = SOURCES[key], ctx.raw
    if ctx.online(key) and not _try(raw, src, H15_URL):
        try:
            return _h15_scrape(ctx, key)
        except fl.FetchError as e:
            fl.warn(f"{src['name']}: {e}")
    return load_default(ctx, key)


def _try(raw, src, url):
    """True when a download of url passes the parser (the body is then cached)."""
    try:
        raw.download(src["name"], url, kind=src.get("kind"), check=src["parse"], attempts=2, min_fraction=src.get("min_fraction"))
        return True
    except fl.FetchError as e:
        fl.warn(f"{src['name']}: {e}")
        return False


def _h15_scrape(ctx, key):
    src, raw = SOURCES[key], ctx.raw
    page = raw.download("fed_h15_choose.html", H15_CHOOSE, kind="html").decode("utf-8", "replace")
    m = re.search(r'value="(rel=H15&amp;series=[0-9a-f]+&amp;[^"]*type=package)"[^>]*/><label[^>]*>Monthly Averages', page)
    if not m:
        raise fl.FetchError("H.15 Choose page has no Monthly Averages package")
    url = "https://www.federalreserve.gov/datadownload/Output.aspx?" + m.group(1).replace("&amp;", "&")
    url = re.sub(r"lastobs=\d*", "lastobs=", url)
    return load_default(ctx, key, url)


def load_ukhpi(ctx, key):
    src, raw = SOURCES[key], ctx.raw
    if ctx.online(key):
        d = dt.date.fromisoformat(raw.today)
        for back in range(6):                       # the file name carries the release month
            y, m = divmod(d.year * 12 + d.month - 1 - back, 12)
            url = UKHPI.format(ym=f"{y:04d}-{m + 1:02d}")
            try:
                raw.download(src["name"], url, kind="csv", check=src["parse"], attempts=1, min_fraction=0.5, timeout=90)
            except fl.FetchError as e:
                if e.status != 404:
                    fl.warn(f"{src['name']}: {e}")
                continue
            return load_default_cached(ctx, key, url)
    return load_default(ctx, key, UKHPI.format(ym="latest"))


def load_default_cached(ctx, key, url):
    """Parse the body just downloaded by a custom loader and record it."""
    body, when = ctx.raw.cached(SOURCES[key]["name"])
    got = fl.Got(SOURCES[key]["parse"](body), when, False)
    ctx.record(key, got, url)
    return got


def load_statcan_cpi(ctx, key):
    src = SOURCES[key]
    end = f"{dt.date.fromisoformat(ctx.raw.today).year + 1}-12-01"
    url = fl.build_url(STATCAN_WDS, {"vectorIds": f'"{STATCAN_CPI_VECTOR}"', "startRefPeriod": "1914-01-01",
                                      "endReferencePeriod": end})
    return load_default(ctx, key, url)


def load_nass(ctx, key):
    """Farm real estate value per acre. The source is a 584 MB gzip, so only a small extract is cached and
    the file is streamed again only when the cache is missing, old, or --only farmland_acre asks for it."""
    src, raw = SOURCES[key], ctx.raw
    name = src["name"]
    body, when = raw.cached(name)
    forced = ctx.only is not None and "farmland_acre" in ctx.only
    young = body is not None and when and (dt.date.fromisoformat(raw.today) - dt.date.fromisoformat(when)).days <= NASS_MAX_AGE_DAYS
    fell = False
    if not ctx.offline and (forced or not young) and ctx.online(key):
        try:
            _stream_nass(raw, name)
        except fl.FetchError as e:
            fl.warn(f"{name}: {e}; trying cache")
            raw.fell_back.add(name)
            fell = True
    body, when = raw.cached(name)
    if body is None:
        raise fl.FetchError(f"{name}: no extract and the download failed" if not ctx.offline else f"{name}: no cached copy")
    got = fl.Got(parse_nass_extract(body), when, fell)
    ctx.record(key, got)
    return got


def _stream_nass(raw, name):
    page = raw.download("nass_datasets.html", NASS_LIST, kind="html").decode("utf-8", "replace")
    m = NASS_FILE.search(page)
    if not m:
        raise fl.FetchError("NASS datasets page lists no qs.economics file")
    url = NASS_LIST + m.group(0)
    print(f"streaming {url} (large; keeping only the national farmland rows) ...", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": fl.user_agent(fl.UA_BROWSER)})
    found = {}
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = io.TextIOWrapper(gzip.GzipFile(fileobj=resp), encoding="utf-8", errors="replace", newline="")
            head = text.readline().rstrip("\r\n").split("\t")
            ix = {h: i for i, h in enumerate(head)}
            need = ("SOURCE_DESC", "SHORT_DESC", "AGG_LEVEL_DESC", "FREQ_DESC", "REFERENCE_PERIOD_DESC", "YEAR", "VALUE")
            if any(n not in ix for n in need):
                raise fl.FetchError("NASS Quick Stats columns changed")
            for line in text:
                if NASS_SHORT not in line:
                    continue
                f = line.rstrip("\r\n").split("\t")
                if (len(f) == len(head) and f[ix["SHORT_DESC"]] == NASS_SHORT and f[ix["SOURCE_DESC"]] == "SURVEY"
                        and f[ix["AGG_LEVEL_DESC"]] == "NATIONAL" and f[ix["FREQ_DESC"]] == "ANNUAL"
                        and f[ix["REFERENCE_PERIOD_DESC"]] == "YEAR"):
                    v = fl.to_float(f[ix["VALUE"]])
                    if v is not None:
                        if f[ix["YEAR"]] in found and found[f[ix["YEAR"]]] != v:
                            raise fl.FetchError("NASS has two different values for year " + f[ix["YEAR"]])
                        found[f[ix["YEAR"]]] = v
    except (urllib.error.URLError, OSError, EOFError, zlib.error) as e:
        raise fl.FetchError(f"{type(e).__name__}: {e} (while streaming {url})", network=True)
    if len(found) < 100:
        raise fl.FetchError(f"NASS stream gave only {len(found)} national farmland years")
    data = ("year,value\n" + "".join(f"{y},{fl.r_dp(v, 2)}\n" for y, v in sorted(found.items()))).encode("ascii")
    raw.dir.mkdir(parents=True, exist_ok=True)
    tmp = raw.dir / (name + ".part")
    tmp.write_bytes(data)
    tmp.replace(raw.path(name))
    raw.manifest[name] = {"url": url, "retrieved": raw.today, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


LOADERS = {"default": load_default, "shiller": load_shiller, "h15": load_h15, "ukhpi": load_ukhpi,
           "statcan_cpi": load_statcan_cpi, "nass": load_nass}


# ------------------------------------------------------------------------------ series

def S(sid, src, pick, label, unit, freq, country, group, **kw):
    d = dict(id=sid, src=src, pick=pick, label=label, unit=unit, freq=freq, country=country, group=group)
    d.update(kw)
    return d


def bls_pick(series_id):
    return lambda data: data[series_id]


BLS_ITEM = "BLS Average Price Data (series {}), U.S. city average"
GAP_NOTE = " BLS has no value for 2025-10 (data unavailable because of the 2025 lapse in appropriations); the gap is kept."

SERIES = [
    S("cpi_u", "bls_cu", bls_pick("CUUR0000SA0"),
      "Consumer Price Index for All Urban Consumers (CPI-U), all items, U.S. city average", "index, 1982-84 = 100", "M",
      "US", "prices", source="U.S. Bureau of Labor Statistics, CPI-U all items, not seasonally adjusted", sid_src="CUUR0000SA0",
      licence=L_BLS, dp=3,
      notes="Not seasonally adjusted; starts when the series begins, in 1913. Annual averages (BLS period M13) are not stored; "
            "compute them from the months." + GAP_NOTE,
      check=dict(first=(9, 10), last=(250, 600), every=(9, 600), max_ratio=1.12, min_points=1300, newest_after="2026-01")),
    S("cpi_carbonated", "bls_cu_food", bls_pick("CUUR0000SEFN01"),
      "CPI-U, carbonated drinks, U.S. city average", "index, 1982-84 = 100", "M", "US", "prices",
      source="U.S. Bureau of Labor Statistics, CPI-U carbonated drinks, not seasonally adjusted", sid_src="CUUR0000SEFN01",
      licence=L_BLS, dp=3,
      notes="A price index, not a dollar price. It gives a continuous relative price for soft drinks while the dollar "
            "series (price_cola_*, price_softdrinks_*) are broken by gaps and product changes." + GAP_NOTE,
      check=dict(first=(30, 120), last=(150, 600), every=(30, 600), max_ratio=1.25, min_points=550, newest_after="2026-01")),
    S("pay_prod", "bls_ce", bls_pick("CES0500000008"),
      "Average hourly earnings of production and nonsupervisory employees, total private", "USD per hour", "M", "US",
      "pay", source="U.S. Bureau of Labor Statistics, Current Employment Statistics (national), seasonally adjusted",
      sid_src="CES0500000008", licence=L_BLS, dp=2,
      notes="Seasonally adjusted, as published. An average, not a median, for a changing mix of jobs; it excludes "
            "supervisors and managers. Starts 1964-01. The latest month is preliminary.",
      check=dict(first=(1, 5), last=(20, 80), every=(1, 80), max_ratio=1.05, min_points=700, newest_after="2026-01")),
    S("price_bread", "bls_ap_food", bls_pick("APU0000702111"), "White pan bread, per lb", "USD per lb", "M", "US", "items",
      source=BLS_ITEM.format("APU0000702111"), sid_src="APU0000702111", licence=L_BLS, dp=3,
      notes="Bread, white, pan, per pound (453.6 g). Starts 1980-01." + GAP_NOTE,
      check=dict(first=(0.2, 1.0), last=(1, 4), every=(0.2, 5), max_ratio=1.3, min_points=500, newest_after="2026-01")),
    S("price_eggs", "bls_ap_food", bls_pick("APU0000708111"), "Eggs, grade A large, per dozen", "USD per dozen", "M", "US",
      "items", source=BLS_ITEM.format("APU0000708111"), sid_src="APU0000708111", licence=L_BLS, dp=3,
      notes="Eggs, grade A, large, per dozen. Starts 1980-01. Egg prices are volatile; the series spikes in early 2025."
            + GAP_NOTE,
      check=dict(first=(0.4, 1.5), last=(1, 8), every=(0.4, 8), max_ratio=1.7, min_points=500, newest_after="2026-01")),
    S("price_milk", "bls_ap_food", bls_pick("APU0000709112"), "Whole milk, fresh, per gallon", "USD per gallon", "M", "US",
      "items", source=BLS_ITEM.format("APU0000709112"), sid_src="APU0000709112", licence=L_BLS, dp=3,
      notes="Milk, fresh, whole, fortified, per gallon (3.8 L). Starts 1995-07. The older half-gallon series "
            "(price_milk_halfgal) overlaps from 1995-07 to 1997-12; the two are not spliced." + GAP_NOTE,
      check=dict(first=(1.5, 4), last=(2, 8), every=(1.5, 8), max_ratio=1.2, min_points=300, newest_after="2026-01")),
    S("price_milk_halfgal", "bls_ap_food", bls_pick("APU0000709111"), "Whole milk, fresh, per half gallon",
      "USD per half gallon", "M", "US", "items", source=BLS_ITEM.format("APU0000709111"), sid_src="APU0000709111",
      licence=L_BLS, dp=3,
      notes="Milk, fresh, whole, fortified, per half gallon (1.9 L). Covers 1980-01 to 1997-12 only; BLS publishes the "
            "per-gallon series (price_milk) from 1995-07. Not spliced.",
      check=dict(first=(0.5, 2), last=(0.8, 3), every=(0.5, 3), max_ratio=1.2, min_points=200)),
    S("price_beef_ground", "bls_ap_food", bls_pick("APU0000703112"), "Ground beef, 100% beef, per lb", "USD per lb", "M",
      "US", "items", source=BLS_ITEM.format("APU0000703112"), sid_src="APU0000703112", licence=L_BLS, dp=3,
      notes="Ground beef, 100% beef, per pound (453.6 g). Starts 1984-01." + GAP_NOTE,
      check=dict(first=(0.8, 2.5), last=(3, 12), every=(0.8, 12), max_ratio=1.25, min_points=450, newest_after="2026-01")),
    S("price_coffee", "bls_ap_food", bls_pick("APU0000717311"), "Coffee, 100% ground roast, per lb", "USD per lb", "M", "US",
      "items", source=BLS_ITEM.format("APU0000717311"), sid_src="APU0000717311", licence=L_BLS, dp=3,
      notes="Coffee, 100%, ground roast, all sizes, per pound (453.6 g). Starts 1980-01." + GAP_NOTE,
      check=dict(first=(2, 5), last=(3, 15), every=(1.5, 15), max_ratio=1.4, min_points=450, newest_after="2026-01")),
    S("price_sugar", "bls_ap_food", bls_pick("APU0000715211"), "Sugar, white, per lb", "USD per lb", "M", "US", "items",
      source=BLS_ITEM.format("APU0000715211"), sid_src="APU0000715211", licence=L_BLS, dp=3,
      notes="Sugar, white, all sizes, per pound (453.6 g). Starts 1980-01." + GAP_NOTE,
      check=dict(first=(0.1, 0.6), last=(0.4, 2), every=(0.1, 2), max_ratio=1.25, min_points=500, newest_after="2026-01")),
    S("price_gasoline", "bls_ap_gas", bls_pick("APU000074714"), "Gasoline, unleaded regular, per gallon", "USD per gallon",
      "M", "US", "items", source=BLS_ITEM.format("APU000074714"), sid_src="APU000074714", licence=L_BLS, dp=3,
      notes="Gasoline, unleaded regular, per gallon (3.785 L), all areas, taxes included. Starts 1976-01.",
      check=dict(first=(0.3, 1.2), last=(1.5, 8), every=(0.3, 8), max_ratio=1.6, min_points=550, newest_after="2026-01")),
    S("price_electricity", "bls_ap_fuel", bls_pick("APU000072610"), "Electricity, per kWh", "USD per kWh", "M", "US", "items",
      source=BLS_ITEM.format("APU000072610"), sid_src="APU000072610", licence=L_BLS, dp=3,
      notes="Electricity per kilowatt hour. Starts 1978-11." + GAP_NOTE,
      check=dict(first=(0.02, 0.1), last=(0.05, 0.5), every=(0.02, 0.5), max_ratio=1.2, min_points=500, newest_after="2026-01")),
    S("price_cola_returnable_16oz", "bls_ap_food", bls_pick("APU0000717111"),
      "Cola, non-diet, return bottles, 6 or 8 pack, per 16 oz", "USD per 16 fl oz", "M", "US", "items",
      source=BLS_ITEM.format("APU0000717111"), sid_src="APU0000717111", licence=L_BLS, dp=3,
      notes="Fragment of the BLS cola record: 1980-01 to 1986-07 only. A different pack from every other soft drink "
            "series here; do not join it to them.",
      check=dict(first=(0.1, 0.5), last=(0.1, 0.5), every=(0.1, 0.5), max_ratio=1.3, min_points=60)),
    S("price_cola_cans_16oz", "bls_ap_food", bls_pick("APU0000717113"), "Cola, non-diet, cans, 6 pack, per 16 oz",
      "USD per 16 fl oz", "M", "US", "items", source=BLS_ITEM.format("APU0000717113"), sid_src="APU0000717113",
      licence=L_BLS, dp=3,
      notes="Fragment of the BLS cola record: 72 oz 6-packs of cans, priced per 16 oz, 1980-01 to 1992-02. BLS publishes "
            "no dollar price for non-diet cola in cans after this, and the piece has gaps of its own (listed in breaks).",
      check=dict(first=(0.1, 0.8), last=(0.1, 0.8), every=(0.1, 0.8), max_ratio=1.3, min_points=100)),
    S("price_cola_2l", "bls_ap_food", bls_pick("APU0000717114"), "Cola, non-diet, 2 liter bottle, per 2 liters",
      "USD per 2 liters (67.6 fl oz)", "M", "US", "items", source=BLS_ITEM.format("APU0000717114"),
      sid_src="APU0000717114", licence=L_BLS, dp=3,
      notes="Fragment of the BLS cola record: non-diet cola, per 2 liters (67.6 oz), 1995-07 to 2009-05.",
      check=dict(first=(0.5, 2), last=(0.5, 2), every=(0.5, 2), max_ratio=1.3, min_points=150)),
    S("price_softdrinks_2l", "bls_ap_food", bls_pick("APU0000FN1101"), "All soft drinks, per 2 liters",
      "USD per 2 liters (67.6 fl oz)", "M", "US", "items", source=BLS_ITEM.format("APU0000FN1101"), sid_src="APU0000FN1101",
      licence=L_BLS, dp=3,
      notes="All soft drinks (not only cola), per 2 liters (67.6 oz), from 2018-04." + GAP_NOTE,
      check=dict(first=(0.8, 3), last=(1, 4), every=(0.8, 4), max_ratio=1.3, min_points=90)),
    S("price_softdrinks_12pk_12oz", "bls_ap_food", bls_pick("APU0000FN1102"), "All soft drinks, 12-pack of cans, per 12 oz",
      "USD per 12 fl oz", "M", "US", "items", source=BLS_ITEM.format("APU0000FN1102"), sid_src="APU0000FN1102",
      licence=L_BLS, dp=3,
      notes="All soft drinks, 12-packs of 12 oz cans, priced per 12 oz (354.9 ml), from 2018-04." + GAP_NOTE,
      check=dict(first=(0.15, 0.8), last=(0.2, 1), every=(0.15, 1), max_ratio=1.3, min_points=90)),
    S("price_soda_proxy_12oz", None, None, "Soft drink proxy, dollars per 12 fl oz (three BLS pieces, gaps kept)",
      "USD per 12 fl oz", "M", "US", "items", proxy=True,
      source="Derived from BLS Average Price Data series APU0000717113, APU0000717114 and APU0000FN1102",
      sid_src="APU0000717113 + APU0000717114 + APU0000FN1102", licence=L_BLS, dp=4,
      parts=[("price_cola_cans_16oz", 0.75, "cola in cans", "cola in 6-packs of cans, per 16 oz, times 0.75"),
             ("price_cola_2l", 12 / 67.6, "cola in 2 liter bottles", "non-diet cola, per 2 liters (67.6 oz), times 12/67.6"),
             ("price_softdrinks_12pk_12oz", 1.0, "soft drinks in 12-packs of cans",
              "all soft drinks, 12-packs of 12 oz cans, per 12 oz, as published")],
      notes="A proxy, not a BLS series. Three BLS pieces converted to dollars per 12 fl oz by plain arithmetic and left "
            "unjoined: there is no BLS dollar price for 1992-03 to 1995-06 or 2009-06 to 2018-03, so those gaps are "
            "empty, and the cans piece has shorter gaps of its own (all listed in breaks). The product changes at each long gap (cans, then 2 liter bottles, then 12-packs of cans), so a level "
            "from one piece is not comparable with a level from another; read changes inside one piece only. "
            "Not a stand-in for inflation: use cpi_carbonated for a continuous relative price.",
      check=dict(first=(0.1, 0.6), last=(0.15, 1), every=(0.1, 1), min_points=300)),
    S("house_new_median", "census_price", lambda d: d["monthly"],
      "Median sales price of new houses sold, United States, monthly", "USD", "M", "US", "housing",
      source="U.S. Census Bureau and HUD, New Residential Sales, Sales Price of New Privately-Owned Houses Sold",
      sid_src="price_cust.xlsx, sheet Monthly", licence=L_CENSUS, dp=0,
      notes="Monthly figures as published (FRED republishes the series as MSPNHSUS, listed there as not seasonally adjusted). New "
            "houses only, and the price includes the land. A price level, not a constant-quality index: the size, "
            "location and mix of houses sold change over time. Recent months are revised.",
      check=dict(first=(10000, 30000), last=(200000, 700000), every=(10000, 700000), max_ratio=1.3, min_points=700,
                 newest_after="2026-01")),
    S("house_new_median_annual", "census_price", lambda d: d["annual"],
      "Median sales price of new houses sold, United States, annual", "USD", "A", "US", "housing",
      source="U.S. Census Bureau and HUD, New Residential Sales, Sales Price of New Privately-Owned Houses Sold",
      sid_src="price_cust.xlsx, sheet Annual", licence=L_CENSUS, dp=0,
      notes="Census's own annual median, which is not the average of the twelve monthly medians (for 2025 they differ by "
            "about 3,000 dollars). Use this one against annual household "
            "income so both figures are for the same year. Same caveats as house_new_median.",
      check=dict(first=(10000, 30000), last=(250000, 700000), every=(10000, 700000), max_ratio=1.3, min_points=60,
                 newest_after="2025")),
    S("income_median", "census_h5", lambda d: d["median"], "Median household income, United States, current dollars",
      "USD per year", "A", "US", "income",
      source="U.S. Census Bureau, Current Population Survey Annual Social and Economic Supplement, Table H-5 (All Races)",
      sid_src="h05.xlsx, median income, current dollars", licence=L_CENSUS, dp=0,
      notes="Income year, households as of March of the following year. Whole-household median, so it is not a wage "
            "and not comparable with pay_prod. Ratios against house_new_median_annual mix a new-house median with an "
            "all-household median, so read them as a rough affordability measure.",
      breaks_from="h5", check=dict(first=(5000, 10000), last=(70000, 150000), every=(5000, 150000), max_ratio=1.2,
                                   min_points=55, newest_after="2024")),
    S("fhfa_hpi", "fhfa_hpi", lambda d: d, "FHFA House Price Index, United States, all-transactions, quarterly",
      "index, 1980 Q1 = 100", "Q", "US", "housing",
      source="Federal Housing Finance Agency, House Price Index (expanded master file), all-transactions, USA",
      sid_src="hpi_master.csv: traditional, all-transactions, quarterly, USA, index_nsa", licence=L_FHFA, dp=2,
      notes="Nominal, not seasonally adjusted. A weighted repeat-sales index built from purchase prices and appraisals "
            "on the same houses, so the mix of houses sold does not move it the way it moves the Census median. "
            "Starts 1975 Q1. The all-transactions index includes appraisals from refinancings; the purchase-only index "
            "(monthly, 1991 on) is not stored.",
      check=dict(first=(30, 100), last=(300, 1500), every=(30, 1500), max_ratio=1.12, min_points=200, newest_after="2026-Q1")),
    S("house_price_shiller", "shiller", lambda d: {y: v for y, v in d["annual"].items() if int(y) <= 1974},
      "Shiller US home price index, annual, 1890 to 1974", "index (Case-Shiller national scale, Jan 2000 = 100)", "A", "US",
      "housing", proxy=True, source="Robert J. Shiller, Irrational Exuberance, data for Figure 3.1 (nominal home price index)",
      sid_src="Fig3-1.xls, sheet Data, Nominal Home Price Index", page=SHILLER_PAGE, licence=L_SHILLER, dp=3,
      notes="Derived annual values. 1890 to 1952 are Shiller's annual figures; 1953 to 1974 are annual means of his "
            "monthly values, which are interpolated within each year. Stops at 1974 on purpose: his later values are "
            "S&P Case-Shiller, which is not redistributed here. The pieces come from different sources (see breaks), "
            "so levels before 1953 are less comparable. fhfa_hpi starts in 1975 with a different base and there is no "
            "overlap year, so any link between them is an assumption that the page must state.",
      breaks_from="shiller", check=dict(first=(2, 6), last=(15, 40), every=(2, 40), max_ratio=1.4, min_points=80)),
    S("farmland_acre", "nass", lambda d: d, "Farm real estate value per acre, United States", "USD per acre", "A", "US",
      "land", proxy=True, fill=False, source="USDA National Agricultural Statistics Service, Quick Stats, survey, national",
      sid_src="AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE", licence=L_NASS, dp=0,
      notes="A proxy for land value: average value per acre of farmland including farm buildings, not residential "
            "land and not building lots. Survey estimates. Decennial from 1850 to 1900 and annual from 1910, so the "
            "early spacing is not a gap. Refreshed from NASS at most once every 150 days because the source file "
            "is very large.",
      breaks=[dict(t="1910", label="Before 1910 the survey values are decennial (every 10 years)", kind="spacing")],
      check=dict(first=(5, 50), last=(3000, 10000), every=(5, 10000), max_ratio=2.6, min_points=100, newest_after="2025")),
    S("land_resid_acre", "fhfa_land", lambda d: d["acre"], "Residential land value per acre, United States (FHFA)", "USD per acre",
      "A", "US", "land", proxy=True, source="Federal Housing Finance Agency, The Price of Residential Land (v4.0, June 2024), national",
      sid_src="land-prices_2024_20_june.xlsx, Panel Nation, all single-family parcels, per acre as-is", licence=L_FHFA, dp=0,
      notes="Partial: 2012 to 2022 only. Estimated value of land under single-family parcels, per acre, as the parcels "
            "are (not standardized). FHFA labels these experimental estimates, works in progress and subject to change "
            "(Davis, Larson, Oliner and Shui).",
      check=dict(first=(100000, 900000), last=(300000, 2000000), every=(100000, 2000000), max_ratio=1.5, min_points=8,
                 newest_after="2020")),
    S("land_resid_quarter_acre", "fhfa_land", lambda d: d["quarter"],
      "Residential land value, standardized quarter-acre lot, United States (FHFA)", "USD per quarter-acre lot", "A", "US",
      "land", proxy=True, source="Federal Housing Finance Agency, The Price of Residential Land (v4.0, June 2024), national",
      sid_src="land-prices_2024_20_june.xlsx, Panel Nation, land value of a standardized quarter-acre lot", licence=L_FHFA, dp=0,
      notes="Partial: 2012 to 2022 only. Value of land for a standardized quarter-acre lot, which removes differences in "
            "lot size between places. Experimental, subject to change.",
      check=dict(first=(30000, 300000), last=(80000, 600000), every=(30000, 600000), max_ratio=1.5, min_points=8,
                 newest_after="2020")),
    S("land_resid_share", "fhfa_land", lambda d: d["share"], "Land share of single-family property value, United States (FHFA)",
      "share of property value (0 to 1)", "A", "US", "land", proxy=True,
      source="Federal Housing Finance Agency, The Price of Residential Land (v4.0, June 2024), national",
      sid_src="land-prices_2024_20_june.xlsx, Panel Nation, land share of property value", licence=L_FHFA, dp=3,
      notes="Partial: 2012 to 2022 only. Land as a share of the value of single-family property. Experimental, subject "
            "to change.",
      check=dict(first=(0.1, 0.7), last=(0.1, 0.7), every=(0.1, 0.7), max_ratio=1.3, min_points=8, newest_after="2020")),
    S("tbill3m", "h15", lambda d: d, "3-month Treasury bill, secondary market rate (discount basis), monthly average",
      "percent per year", "M", "US", "rates",
      source="Board of Governors of the Federal Reserve System, Selected Interest Rates (H.15), Data Download Program",
      page="https://www.federalreserve.gov/releases/h15/", sid_src=H15_TBILL, licence=L_FED, dp=2,
      notes="Monthly average of daily rates; the same series FRED carries as TB3MS. Discount basis, so slightly below the "
            "bond-equivalent yield. A nominal rate: subtract inflation yourself for a real return. Starts 1934-01.",
      check=dict(first=(0, 2), last=(0, 15), every=(0, 20), max_step=6, min_points=1000, newest_after="2026-01")),
    S("uk_rpi_annual", "ons_cdko", lambda d: d["A"], "UK Retail Prices Index, long run, annual", "index, Jan 1974 = 100", "A",
      "GB", "prices", source="Office for National Statistics, Retail Prices Index: Long run series (CDKO, dataset MM23)",
      page=ONS_PAGE + "/economy/inflationandpriceindices/timeseries/cdko/mm23", sid_src="CDKO", licence=L_OGL, dp=1,
      notes="The ONS long-run price index, 1800 onward. It is the RPI, a different measure from the CPI, so do not mix "
            "the two in one comparison. The earliest decades are historical reconstructions and are approximate.",
      check=dict(first=(5, 30), last=(1000, 3000), every=(5, 3000), max_ratio=2.0, min_points=220, newest_after="2025")),
    S("uk_rpi", "ons_cdko", lambda d: d["M"], "UK Retail Prices Index, long run, monthly", "index, Jan 1974 = 100", "M", "GB",
      "prices", source="Office for National Statistics, Retail Prices Index: Long run series (CDKO, dataset MM23)",
      page=ONS_PAGE + "/economy/inflationandpriceindices/timeseries/cdko/mm23", sid_src="CDKO", licence=L_OGL, dp=1,
      notes="Monthly values of the same RPI series. The first monthly observation is 1947-06. RPI is not the CPI.",
      check=dict(first=(20, 40), last=(1000, 3000), every=(20, 3000), max_ratio=1.1, min_points=900, newest_after="2026-01")),
    S("uk_cpi", "ons_d7bt", lambda d: d["M"], "UK Consumer Prices Index, all items", "index, 2015 = 100", "M", "GB", "prices",
      source="Office for National Statistics, CPI INDEX 00: ALL ITEMS 2015=100 (D7BT, dataset MM23)", sid_src="D7BT",
      page=ONS_PAGE + "/economy/inflationandpriceindices/timeseries/d7bt/mm23",
      licence=L_OGL, dp=1,
      notes="The UK CPI, available from 1988-01 only. Use uk_rpi for anything earlier, and do not mix the two measures.",
      check=dict(first=(30, 70), last=(120, 200), every=(30, 200), max_ratio=1.05, min_points=400, newest_after="2026-01")),
    S("uk_earnings_weekly", "ons_kab9", lambda d: d["M"],
      "UK average weekly earnings, whole economy, total pay excluding arrears, seasonally adjusted", "GBP per week", "M", "GB",
      "pay", source="Office for National Statistics, Average weekly earnings (KAB9, dataset EMP)", sid_src="KAB9",
      page=ONS_PAGE + "/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/emp",
      licence=L_OGL, dp=0,
      notes="Whole-economy level in pounds per week, seasonally adjusted, total pay excluding arrears. Starts 2000-01. "
            "A weekly figure for all employees, not an hourly rate, so it is not comparable with US hourly earnings.",
      check=dict(first=(200, 450), last=(500, 1500), every=(200, 1500), max_ratio=1.15, min_points=300, newest_after="2026-01")),
    S("uk_house_price", "ukhpi", lambda d: d, "UK average house price, United Kingdom", "GBP", "M", "GB", "housing",
      source="HM Land Registry, UK House Price Index, average price (with ONS, Registers of Scotland and LPS Northern Ireland)",
      sid_src="Average-prices csv, Region_Name United Kingdom, Average_Price", licence=L_LR, dp=0,
      notes="Average price of all properties, not seasonally adjusted. Before 1995 the series is a derived back series "
            "(built from the historic path of the ONS House Price Index) that moves in steps of three months. Starts "
            "1968-04. A mean, so it moves with the mix of properties sold.",
      breaks=[dict(t="1995-01", label="Before 1995 the series is a derived back series that moves in quarterly steps",
                   kind="definition")],
      check=dict(first=(2000, 5000), last=(150000, 600000), every=(2000, 600000), max_ratio=1.2, min_points=600,
                 newest_after="2026-01")),
    S("ca_cpi", "statcan_cpi", lambda d: d, "Canada Consumer Price Index, all items", "index, 2002 = 100", "M", "CA", "prices",
      source="Statistics Canada, Table 18-10-0004-01 Consumer Price Index, monthly, Canada, all-items (vector v41690973)",
      page=STATCAN_PAGE.format(pid="1810000401"), sid_src="v41690973", licence=L_STATCAN, dp=1,
      notes="Starts 1914-01. Not seasonally adjusted.",
      check=dict(first=(4, 10), last=(120, 250), every=(4, 250), max_ratio=1.1, min_points=1300, newest_after="2026-01")),
    S("ca_nhpi_house", "statcan_nhpi", lambda d: d["series"]["house"], "Canada New Housing Price Index, house only",
      "index, Dec 2016 = 100", "M", "CA", "housing",
      source="Statistics Canada, Table 18-10-0205-01 New housing price index, Canada", sid_src="v111955443",
      page=STATCAN_PAGE.format(pid="1810020501"),
      licence=L_STATCAN, dp=1,
      notes="The structure only, from 1981-01: a quality-adjusted index of contractors' selling prices for new houses, "
            "not a market price index for existing homes. The total (house and land) index is not stored.",
      check=dict(first=(20, 80), last=(80, 200), every=(20, 200), max_ratio=1.1, min_points=500, newest_after="2026-01")),
    S("ca_nhpi_land", "statcan_nhpi", lambda d: d["series"]["land"], "Canada New Housing Price Index, land only",
      "index, Dec 2016 = 100", "M", "CA", "land", proxy=True,
      source="Statistics Canada, Table 18-10-0205-01 New housing price index, Canada", sid_src="v111955444",
      page=STATCAN_PAGE.format(pid="1810020501"),
      licence=L_STATCAN, dp=1,
      notes="The land component of the builders' index, from 1981-01: the contractors' selling price of the lot under a new "
            "house, as an index. A proxy for land value, not a market price for lots; some values carry Statistics "
            "Canada's quality flag E (use with caution).",
      check=dict(first=(20, 80), last=(80, 200), every=(20, 200), max_ratio=1.15, min_points=500, newest_after="2026-01")),
]
SERIES_BY_ID = {s["id"]: s for s in SERIES}
if len(SERIES_BY_ID) != len(SERIES):
    raise SystemExit("duplicate series id in SERIES")

NOTES = [
    "Rows are [period, value]. Periods are YYYY-MM (freq M), YYYY-Qn (freq Q) or YYYY (freq A). A row with a null value "
    "marks a gap: there is no observation at that period, and a run of missing periods is marked once, at its first "
    "period. Break the line at a gap and skip it in readouts. Nothing is interpolated. Every gap is also listed in "
    "the series' breaks.",
    "Series are never spliced. Where a product, a definition or a source changes, the pieces are separate series "
    "(price_milk and price_milk_halfgal, the price_cola_* and price_softdrinks_* fragments, house_price_shiller and "
    "fhfa_hpi) or the change is listed in the series breaks. Never divide values from different periods or "
    "different bases as if they were the same measure.",
    "Values are as published at each series' retrieved date and are revised by their sources. BLS collected no data "
    "for October 2025 (the 2025 lapse in appropriations), so the BLS series have a gap at 2025-10.",
    "Index series carry their own base in unit. Compare changes over the same window, not levels across series.",
    "Proxy series (proxy true) stand in for something that is not measured directly: farm real estate value for land, "
    "the soft drink record assembled from BLS pieces, Shiller's home price compilation, builders' land prices in "
    "Canada, and FHFA residential land for 2012 to 2022 only. Label them as proxies wherever they are drawn.",
    "pay_prod is an average of production and nonsupervisory pay, not a median wage. income_median is a household "
    "median from a survey, annual, and house_new_median is a median of new houses sold, whose mix changes; ratios "
    "between them are rough affordability measures.",
    "Pre-1913 US prices are not included: no permitted open source was found, so the US CPI starts in 1913. "
    "Freddie Mac mortgage rates, Jorda-Schularick-Taylor, Nationwide, the Bank of England millennium sheet and S&P "
    "Case-Shiller are deliberately not used (licence terms). Gold prices are in data/history.js and not repeated here.",
    "Licences differ by source and are given in each series' licence field and in tools/README.md.",
]


# --------------------------------------------------------------------------------- build

def rows_from_obs(obs, freq, fill=True):
    """[[period, value], ...] in order, with one null row at the start of each run of missing periods."""
    if not obs:
        raise fl.ParseError("no observations")
    bad = {fl.period_freq(p) for p in obs} - {freq}
    if bad:
        raise fl.ParseError(f"periods of frequency {sorted(bad)} in a {freq} series")
    have = sorted(p for p, v in obs.items() if v is not None)
    if not have:
        raise fl.ParseError("only gaps")
    rows = []
    seq = fl.period_seq(have[0], have[-1]) if fill else have
    for p in seq:
        v = obs.get(p)
        if v is not None:
            rows.append([p, v])
        elif not rows or rows[-1][1] is not None:
            rows.append([p, None])
    return rows


def gap_breaks(rows):
    out = []
    for i, r in enumerate(rows):
        if r[1] is None and i + 1 < len(rows):
            end = fl.period_add(rows[i + 1][0], -1)
            span = r[0] if end == r[0] else f"{r[0]} to {end}"
            out.append(dict(t=r[0], label=f"No observation for {span}", kind="gap"))
    return out


def build_soda(spec, built):
    obs = {}
    pieces = []
    for sid, factor, short, note in spec["parts"]:
        if sid not in built:
            raise fl.ParseError("piece missing: " + sid)
        part = {r[0]: r[1] for r in built[sid]["data"]}
        keys = [p for p, v in part.items() if v is not None]
        for p, v in part.items():
            if p in obs:
                raise fl.ParseError("soft drink pieces overlap at " + p)
            obs[p] = None if v is None else round(v * factor, 4)
        pieces.append((sid, min(keys), max(keys), factor, short, note))
    breaks = []
    for a, b in zip(pieces, pieces[1:]):
        breaks.append(dict(t=b[1], label=f"Product changes: {a[4]} before, {b[4]} after", kind="product"))
    return obs, pieces, breaks


def assemble(spec, obs, retrieved, url, extra_breaks=(), extra_fields=None):
    rows = rows_from_obs(obs, spec["freq"], spec.get("fill", True))
    dp = spec.get("dp", 4)
    rows = [[p, fl.r_dp(v, dp)] for p, v in rows]
    stats = fl.check_plausible(spec["id"], rows, **spec["check"])
    breaks = sorted(gap_breaks(rows) + list(spec.get("breaks", [])) + list(extra_breaks), key=lambda b: (b["t"], b["kind"]))
    entry = dict(label=spec["label"], unit=spec["unit"], freq=spec["freq"], country=spec["country"], group=spec["group"])
    if spec.get("proxy"):
        entry["proxy"] = True
    entry.update(source=spec["source"], sourceId=spec["sid_src"], url=url, licence=spec["licence"], retrieved=retrieved,
                 asOf=stats["last"][0], notes=spec["notes"], breaks=breaks)
    entry.update(extra_fields or {})
    entry["data"] = rows
    return entry, stats


def h5_breaks(parsed):
    return [dict(t=str(y), label="Census lists this year twice, with different footnotes; the first-listed value is used",
                 kind="definition") for y in parsed["repeated"]]


def shiller_breaks(parsed):
    out = []
    for i, (s, y0, y1) in enumerate(parsed["sources"]):
        if y0 <= 1974:                             # later years are S&P Case-Shiller and are not used
            out.append(dict(t=str(y0), label=(f"Source: {s}" if i == 0 else f"Source changes to {s}"), kind="source"))
    return out


def run(args):
    raw = fl.Raw("prices", offline=args.offline, contact=args.contact)
    raw.throttle["www.ons.gov.uk"] = 25            # the ONS generator answers 429 to quick repeats
    only = None
    if args.only:
        ids = {x.strip() for x in args.only.split(",") if x.strip()}
        bad = ids - set(SERIES_BY_ID)
        if bad:
            sys.exit("unknown series id: " + ", ".join(sorted(bad)))
        only = ids | ({"price_cola_cans_16oz", "price_cola_2l", "price_softdrinks_12pk_12oz"} if "price_soda_proxy_12oz" in ids else set())
    ctx = Ctx(raw, args.offline, only)
    skipped = fl.Skipped()
    built, stats = {}, {}
    for spec in SERIES:
        sid = spec["id"]
        if spec["src"] is None:
            continue
        with skipped.guard(sid):
            got = ctx.load(spec["src"])
            extra = {"shiller": shiller_breaks, "h5": h5_breaks}.get(spec.get("breaks_from"), lambda _: ())(got.value)
            obs = spec["pick"](got.value)
            url = spec.get("page") or ctx.info[spec["src"]]["url"]
            built[sid], stats[sid] = assemble(spec, obs, got.retrieved, url, extra)
    for spec in SERIES:                             # derived series come last
        if spec["src"] is None:
            sid = spec["id"]
            with skipped.guard(sid):
                obs, pieces, brk = build_soda(spec, built)
                parts = [dict(id=i, first=a, last=b, factor=fl.r_dp(f, 6), what=n) for i, a, b, f, s, n in pieces]
                retrieved = max(built[i]["retrieved"] for i, *_ in pieces)
                url = "https://download.bls.gov/pub/time.series/ap/ap.data.3.Food"
                built[sid], stats[sid] = assemble(spec, obs, retrieved, url, brk, dict(parts=parts))
    # keep the declared order of SERIES in the output
    series = {spec["id"]: built[spec["id"]] for spec in SERIES if spec["id"] in built}
    raw.save_manifest()
    report(series, stats, ctx, skipped)
    core_missing = [c for c in CORE if c not in series]
    if core_missing:
        print("error: core series failed (" + ", ".join(core_missing) + "); output not written", file=sys.stderr)
        return 1
    lost = lost_series(series)
    if lost and not args.allow_partial:
        print("error: the build would drop series the current file has, output not written (use --allow-partial to "
              "accept): " + ", ".join(lost[:12]) + (" ..." if len(lost) > 12 else ""), file=sys.stderr)
        return 1
    generated = max(s["retrieved"] for s in series.values())
    obj = dict(generated=generated, notes=NOTES, series=series)
    res = fl.write_js(OUT, "MACRO_PRICES", obj, generator=GENERATOR, generated=generated, max_bytes=MAX_BYTES,
                      levels=2, chunk=8)
    print(f"{'wrote' if res['changed'] else 'unchanged'} {OUT} ({res['bytes'] / 1024:.1f} KB, {len(series)} series)")
    fl.remind_stamp(res["changed"])
    return 3 if skipped else 0


def lost_series(series):
    """Series ids in the current data/prices.js that the new build would drop."""
    if not OUT.exists():
        return []
    try:
        _, old = fl.read_js_global(OUT)
    except (fl.ParseError, ValueError):
        return []
    return [sid for sid in old.get("series", {}) if sid not in series]


def report(series, stats, ctx, skipped):
    rows = []
    for sid, s in series.items():
        st = stats[sid]
        src = SERIES_BY_ID[sid]["src"]
        cached = ctx.info.get(src, {}).get("cached") if src else False
        rows.append((sid, s["freq"], st["n"], st["first"][0], st["last"][0], f"{st['first'][1]:g}", f"{st['last'][1]:g}",
                     s["retrieved"] + (" cache" if cached else "")))
    print()
    fl.print_table(("series", "f", "pts", "first", "last", "first value", "last value", "retrieved"), rows, left=2)
    skipped.report()
    caches = sorted(k for k, v in ctx.info.items() if v["cached"])
    if caches:
        print("read from the cache this run: " + ", ".join(caches))
    if ctx.raw.fell_back:
        print("downloads that failed (cache used): " + ", ".join(sorted(ctx.raw.fell_back)))


# ---------------------------------------------------------------------------- self-test

def selftest():
    import unittest

    class T(unittest.TestCase):
        def test_rows_gaps(self):
            obs = {"2020-01": 1.0, "2020-02": None, "2020-03": None, "2020-05": 5.0, "2020-06": 6.0}
            self.assertEqual(rows_from_obs(obs, "M"), [["2020-01", 1.0], ["2020-02", None], ["2020-05", 5.0], ["2020-06", 6.0]])
            self.assertEqual(gap_breaks(rows_from_obs(obs, "M"))[0]["label"], "No observation for 2020-02 to 2020-04")
            self.assertEqual(rows_from_obs({"1850": 1.0, "1860": 2.0}, "A", fill=False), [["1850", 1.0], ["1860", 2.0]])
            with self.assertRaises(fl.ParseError):
                rows_from_obs({"2020": 1.0}, "M")

        def test_bls(self):
            body = (b"series_id        \tyear\tperiod\t       value\tfootnote_codes\r\n"
                    b"CUUR0000SA0      \t1913\tM01\t         9.8\t\r\n"
                    b"CUUR0000SA0      \t1913\tM13\t         9.9\t\r\n"
                    b"CUUR0000SA0      \t2025\tM10\t           -\tX\r\n"
                    b"OTHER            \t2025\tM10\t           1\t\r\n")
            self.assertEqual(parse_bls(["CUUR0000SA0"])(body), {"CUUR0000SA0": {"1913-01": 9.8, "2025-10": None}})
            with self.assertRaises(fl.ParseError):
                parse_bls(["NOPE"])(body)

        def test_rk(self):
            self.assertEqual(_rk((100 << 2) | 2), 100.0)
            self.assertEqual(_rk((12345 << 2) | 3), 123.45)
            self.assertEqual(_rk(((-5) & 0x3FFFFFFF) << 2 | 2), -5.0)

        def test_ole_refuses_other_files(self):
            with self.assertRaises(fl.ParseError):
                ole_streams(b"PK\x03\x04")

        def test_ons(self):
            body = b'"Title","x"\n"CDID","ABCD"\n"1800","13.5"\n"2000 Q1","5"\n"1947 JUN","28.9"\n'
            self.assertEqual(parse_ons("ABCD")(body), {"A": {"1800": 13.5}, "Q": {"2000-Q1": 5.0}, "M": {"1947-06": 28.9}})

    res = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(T))
    print("fetch_prices selftest: " + ("ok" if res.wasSuccessful() else "FAILED") + f" ({res.testsRun} tests)")
    return 0 if res.wasSuccessful() else 1


def main(argv=None):
    ap = fl.make_parser(__doc__)
    ap.add_argument("--selftest", action="store_true", help="run the offline checks of the helpers and exit")
    ap.add_argument("--allow-partial", action="store_true",
                    help="write the file even if it would drop a series that the current file has")
    args = ap.parse_args(argv)
    if args.selftest:
        return selftest()
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
