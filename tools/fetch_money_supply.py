#!/usr/bin/env python3
"""Build data/money-supply.js (window.MONEY_SUPPLY) from public sources.

    python tools/fetch_money_supply.py                  download, cache in data/raw, rebuild
    python tools/fetch_money_supply.py --offline        rebuild from data/raw only
    python tools/fetch_money_supply.py --only us_m2,ea_m3

Python 3.12 standard library only. Sources, breaks and the FRED note are in
tools/README.md. Values are billions of local currency; the third column of
each data row is billions of US dollars at month-end exchange rates.
"""
import argparse
import csv
import datetime as dt
import http.client
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "money-supply.js"
TODAY = dt.date.today().isoformat()
UA = "Mozilla/5.0"  # data.nber.org answers 403 to custom agent strings

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={id}"
FRED_API = "https://api.stlouisfed.org/fred/series/observations?series_id={id}&api_key={key}&file_type=json"
DDP_URL = ("https://www.federalreserve.gov/datadownload/Output.aspx?rel=H6&series={pkg}&lastobs=&from=&to="
           "&filetype=csv&label=include&layout=seriescolumn&type=package")
DDP_CHOOSE = "https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H6"
DBN_URL = "https://api.db.nomics.world/v22/series/FED/{ds}/{code}?observations=1"
NBER_URL = "https://data.nber.org/databases/macrohistory/rectdata/14/{id}.dat"
CFS_URL = "https://centerforfinancialstability.org/amfm/Divisia.xlsx"
ECB_URL = "https://data-api.ecb.europa.eu/service/data/{flow}/{key}?format=csvdata"
BOE_URL = ("https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes"
           "&Datefrom=01/Jan/1963&Dateto=now&SeriesCodes={code}&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N")
BOJ_URL = ("https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=csv&lang=en&db={db}"
           "&startDate={start}&endDate={end}&code={code}")
EM_URL = ("https://datacenter-web.eastmoney.com/api/data/v1/get?columns=REPORT_DATE,BASIC_CURRENCY,"
          "BASIC_CURRENCY_SAME,CURRENCY,CURRENCY_SAME,FREE_CASH,FREE_CASH_SAME&pageNumber=1&pageSize=500"
          "&sortColumns=REPORT_DATE&sortTypes=1&source=WEB&client=WEB&reportName=RPT_ECONOMY_CURRENCY_SUPPLY")
WB_URL = "https://api.worldbank.org/v2/country/{c}/indicator/{ind}?format=json&per_page=300"

# Fed Data Download Program packages. The ids are hashes of the series set; if
# they stop working the Choose page is scraped for the labelled link.
DDP_PACKAGES = {
    "monthly": dict(id="798e2796917702a5f8423426ba7e6b42", label=r"^M1, M2 and other Release Data, Monthly",
                    cache="fed_ddp_h6_monthly.csv"),
    "m3": dict(id="919a61e16f2d825937ec1740e6fed1f6", label=r"^H\.6 M3 Discontinued Money Measure",
               cache="fed_ddp_h6_m3_discontinued.csv"),
}

MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


class FetchError(Exception):
    def __init__(self, msg, network=False):
        super().__init__(msg)
        self.network = network


class ParseError(Exception):
    pass


# ---------------------------------------------------------------- raw cache

class Raw:
    """Downloads into data/raw with a manifest of url and retrieval date."""

    def __init__(self, offline):
        self.offline = offline
        self.session = {}
        self.manifest = {}
        self.fell_back = set()  # names whose download failed and were read from the cache instead
        RAW.mkdir(parents=True, exist_ok=True)
        mp = RAW / "manifest.json"
        if mp.exists():
            self.manifest = json.loads(mp.read_text("utf-8"))

    def download(self, name, url, public_url=None, headers=None, timeout=45, attempts=2, check=None):
        """Fetch url into data/raw/name. check(body) must accept the body before it replaces the cache."""
        if self.offline:
            raise FetchError("offline mode")
        if name in self.session:
            return self.session[name]
        shown = public_url or url
        err = None
        for i in range(attempts):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    body = resp.read()
                if not body:
                    raise FetchError("empty response")
                if check:
                    try:
                        check(body)
                    except Exception as e:
                        raise FetchError(f"unusable response from {shown}: {e}")
                tmp = RAW / (name + ".part")
                tmp.write_bytes(body)
                tmp.replace(RAW / name)
                self.manifest[name] = {"url": shown, "retrieved": TODAY, "bytes": len(body)}
                self.session[name] = body
                return body
            except urllib.error.HTTPError as e:
                err = FetchError(f"HTTP {e.code} from {shown}")
                if e.code < 500:
                    break
            except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
                err = FetchError(f"{type(e).__name__}: {getattr(e, 'reason', e)} ({shown})", network=True)
            except FetchError as e:
                err = e
            if i + 1 < attempts:
                time.sleep(1.5)
        raise err

    def cached(self, name):
        p = RAW / name
        if not p.exists():
            return None, None
        info = self.manifest.get(name, {})
        when = info.get("retrieved") or dt.date.fromtimestamp(p.stat().st_mtime).isoformat()
        return p.read_bytes(), when

    def get(self, name, url, online=True, **kw):
        """Download, else use the cached copy. Returns (body, retrieved, fell_back).

        fell_back is True only when a download was tried and failed. A deliberate cache read
        (--offline, or a series left out of --only) is not a fallback: the cache entry is the
        download the manifest records, so provenance text stays as it was.
        """
        if online and not self.offline:
            try:
                return self.download(name, url, **kw), TODAY, False
            except FetchError as e:
                warn(f"{name}: {e}; trying cache")
                self.fell_back.add(name)
        body, when = self.cached(name)
        if body is None:
            raise FetchError(f"{name}: download failed and no cached copy")
        return body, when, name in self.fell_back

    def url_of(self, name, default):
        return self.manifest.get(name, {}).get("url", default)

    def save_manifest(self):
        (RAW / "manifest.json").write_text(json.dumps(self.manifest, indent=1, sort_keys=True) + "\n", "utf-8")


def warn(msg):
    print("warning: " + msg, file=sys.stderr)


# ------------------------------------------------------------------ parsers

def parse_ecb(body):
    out, status = {}, {}
    for r in csv.DictReader(io.StringIO(body.decode("utf-8-sig"))):
        if r.get("OBS_VALUE", "") != "":
            out[r["TIME_PERIOD"]] = float(r["OBS_VALUE"])
            status[r["TIME_PERIOD"]] = r.get("OBS_STATUS", "")
    if not out:
        raise ParseError("no ECB observations")
    return out, status


def parse_boe(body):
    lines = body.decode("utf-8-sig").splitlines()
    if not lines or not lines[0].upper().startswith("DATE"):
        raise ParseError("BoE response is not a DATE,CODE csv")
    out = {}
    for line in lines[1:]:
        parts = line.strip().split(",")
        if len(parts) < 2 or not parts[1].strip():
            continue
        d = parts[0].split()
        out[f"{int(d[2]):04d}-{MONTHS[d[1]]:02d}"] = float(parts[1])
    if not out:
        raise ParseError("no BoE observations")
    return out


def parse_boj(body):
    """Returns {series code: {YYYY-MM: value}}."""
    out, started = {}, False
    for row in csv.reader(io.StringIO(body.decode("utf-8-sig"))):
        if not row:
            continue
        if row[0] == "STATUS" and row[1] != "200":
            raise ParseError("BoJ status " + row[1])
        if row[0] == "SERIES_CODE":
            started = True
            continue
        if not started or len(row) < 8:
            continue
        if row[7] in ("", "null"):
            continue
        p = row[6]
        out.setdefault(row[0], {})[f"{p[:4]}-{p[4:6]}"] = float(row[7])
    if not out:
        raise ParseError("no BoJ observations")
    return out


def parse_nber(body):
    out = {}
    for line in body.decode("ascii", "replace").splitlines():
        p = line.split()
        if len(p) >= 3 and p[0].isdigit() and p[2] != ".":
            out[f"{int(p[0]):04d}-{int(p[1]):02d}"] = float(p[2])
    if not out:
        raise ParseError("no NBER observations")
    return out


def parse_fred_csv(body, sid):
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
    if not rows or len(rows[0]) != 2 or rows[0][1].strip().upper() != sid:
        raise ParseError(f"not a FRED csv for {sid}")
    out = {r[0][:7]: float(r[1]) for r in rows[1:] if len(r) == 2 and r[1] not in ("", ".")}
    if not out:
        raise ParseError("no FRED observations")
    return out


def parse_fred_api(body):
    j = json.loads(body)
    if "observations" not in j:
        raise ParseError("FRED API error: " + str(j.get("error_message", "unknown")))
    out = {o["date"][:7]: float(o["value"]) for o in j["observations"] if o["value"] not in ("", ".")}
    if not out:
        raise ParseError("no FRED API observations")
    return out


def parse_dbnomics(body):
    j = json.loads(body)
    docs = j.get("series", {}).get("docs", [])
    if not docs:
        raise ParseError("DBnomics returned no series")
    s = docs[0]
    out = {}
    for p, v in zip(s["period"], s["value"]):
        if isinstance(v, (int, float)):
            out[p[:7]] = float(v)
    if not out:
        raise ParseError("no DBnomics observations")
    return out


def parse_ddp(body):
    """Returns {unique id: {YYYY-MM: value in billions}} for every column of a DDP package."""
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
    meta, start = {}, None
    for i, r in enumerate(rows):
        if r and r[0].strip().startswith("Time Period"):
            start = i + 1
            break
        if r:
            meta[r[0].strip().rstrip(":").strip()] = r
    if start is None or "Unique Identifier" not in meta:
        raise ParseError("not a Data Download Program csv")
    ids = meta["Unique Identifier"]
    mult = meta.get("Multiplier", [])
    cols = {}
    for j in range(1, len(ids)):
        try:
            m = float(mult[j])
        except (IndexError, ValueError):
            m = 1e9
        cols[j] = (ids[j].strip(), m / 1e9)
    out = {uid: {} for uid, _ in cols.values()}
    for r in rows[start:]:
        if not r or len(r[0]) < 7:
            continue
        for j, (uid, k) in cols.items():
            if j < len(r) and r[j] not in ("", "ND", "NA"):
                try:
                    out[uid][r[0][:7]] = float(r[j]) * k
                except ValueError:
                    pass
    return out


def parse_wb(body):
    """Returns {iso3: {year: value}} from a World Bank indicator response."""
    j = json.loads(body)
    if len(j) < 2 or not j[1]:
        raise ParseError("World Bank response has no rows")
    if j[0].get("pages", 1) > 1:
        raise ParseError("World Bank response is paged; raise per_page")
    out = {}
    for r in j[1]:
        if r["value"] is not None:
            out.setdefault(r["countryiso3code"], {})[r["date"]] = float(r["value"])
    return out


def parse_eastmoney(body):
    rows = json.loads(body).get("result", {}).get("data") or []
    if not rows:
        raise ParseError("EastMoney returned no rows")
    return {r["REPORT_DATE"][:7]: r for r in rows}


def read_xlsx(body, sheet):
    """Minimal xlsx reader: returns {cell ref: value} for one sheet."""
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    z = zipfile.ZipFile(io.BytesIO(body))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    path = None
    for s in wb.find(ns + "sheets"):
        if s.get("name") == sheet:
            t = rels[s.get(rid)]
            path = t.lstrip("/") if t.startswith("/") else "xl/" + t
    if path is None:
        raise ParseError("sheet not found: " + sheet)
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
            strings.append("".join(t.text or "" for t in si.iter(ns + "t")))
    cells = {}
    for c in ET.fromstring(z.read(path)).iter(ns + "c"):
        v = c.find(ns + "v")
        if v is None or v.text is None:
            continue
        cells[c.get("r")] = strings[int(v.text)] if c.get("t") == "s" else v.text
    return cells


# --------------------------------------------------------------- series specs
# plausible: range for the latest value in billions (or index points), a guard
# against unit changes at the source.

def S(id, economy, aggregate, label, rank, kind, loader, plausible, notes, **kw):
    d = dict(id=id, economy=economy, aggregate=aggregate, label=label, rank=rank, kind=kind, loader=loader,
             plausible=plausible, notes=notes, breaks=[], discontinued=None, continues=None)
    d.update(kw)
    return d


SPECS = [
    # United States
    S("us_base", "us", "Monetary base", "Base", 0, "official", "us", (1000, 20000),
      "Currency in circulation plus reserve balances at the Fed. Monthly average of daily levels, not seasonally "
      "adjusted. QE pushed it far above currency after 2008.",
      fred="BOGMBASE", ddp=("monthly", "H6/H6_MBASE/RESMO14A_N.M"), dbn=("H6_H6_MBASE", "RESMO14A_N.M")),
    S("us_currency", "us", "Currency in circulation", "Currency", 0, "official", "us", (500, 6000),
      "Currency in circulation, the currency part of the monetary base. Monthly average, not seasonally adjusted. "
      "Differs from currency held by the public inside M1.",
      fred="MBCURRCIR", ddp=("monthly", "H6/H6_MBASE/RESMOC14A_N.M"), dbn=("H6_H6_MBASE", "RESMOC14A_N.M")),
    S("us_m1", "us", "M1", "M1", 1, "official", "us", (5000, 60000),
      "Seasonally adjusted, monthly average. From May 2020 M1 includes savings deposits (Regulation D change), "
      "so earlier values are not comparable; the Fed did not back-revise. The line is split at the break.",
      fred="M1SL", ddp=("monthly", "H6/H6_M1/M1.M"), dbn=("H6_H6_M1", "M1.M"),
      breaks=[dict(t="2020-05", label="Fed moved savings deposits into M1 (about 3.4x jump)", kind="redefinition")]),
    S("us_m2", "us", "M2", "M2", 2, "official", "us", (10000, 80000),
      "Seasonally adjusted, monthly average. M1 plus small time deposits and retail money funds. The 28 Jul 2026 "
      "H.6 change nets IRA and Keogh balances out separately and restated the full history, so every run "
      "re-downloads the whole series.",
      fred="M2SL", ddp=("monthly", "H6/H6_M2/M2.M"), dbn=("H6_H6_M2", "M2.M")),
    S("us_m3", "us", "M3", "M3", 3, "official", "us", (8000, 14000),
      "Seasonally adjusted. The Fed stopped publishing M3 on 23 Mar 2006 (last release; last observation Feb 2006). "
      "Not the OECD series called M3 for the United States on FRED, which tracks M2.",
      fred="M3SL", ddp=("m3", "H6/H6M3_DISCONTINUED/H0.M3.M"), dbn=("H6_H6M3_DISCONTINUED", "H0.M3.M"),
      discontinued="2006-02",
      breaks=[dict(t="2006-02", label="Fed stopped publishing M3 (last release 23 Mar 2006, data to Feb 2006)",
                   kind="discontinuation")]),
    S("us_m1_hist", "us", "M1", "M1 (NBER)", 1, "historical", "nber", (50, 400),
      "NBER Macrohistory (Friedman and Schwartz): currency plus adjusted demand deposits, seasonally adjusted, "
      "billions of dollars. Files m14174a (1914-06 to 1945-12) and m14174c (1946-01 to 1967-11) are joined "
      "end to end. Shown only before the Fed series starts; never rescaled or spliced.",
      files=["m14174a", "m14174c"], continues="us_m1"),
    S("us_m2_hist", "us", "M2", "M2-like (NBER)", 2, "historical", "nber", (100, 1000),
      "NBER all-bank broad aggregate (currency, demand and time deposits at commercial and mutual savings banks): "
      "files m14175a (1907-05 to 1946-12) and m14175b (1947-01 to 1966-09). Narrower than Fed M2, so this is an "
      "approximate analogue and does not join the modern line without a step. Never rescaled or spliced.",
      files=["m14175a", "m14175b"], backup_files=["m14144a", "m14144c"], continues="us_m2"),
    S("us_divisia_m4", "us", "Divisia M4", "Divisia M4", 4, "index", "divisia", (500, 10000),
      "Center for Financial Stability Divisia M4 including Treasuries, an index with Jan 1967 = 100. Not dollars; "
      "use in growth views only. CFS warns that recent H.6 changes affected how its aggregates are computed."),
    S("us_broad_wb", "us", "IMF broad money", "IMF/WB broad", 3, "official", "wb", (5000, 80000),
      "IMF and World Bank broad money for the United States, year end, current dollars. Wider than Fed M2 and not "
      "the old Fed M3. Do not read it as M3.",
      country="USA", indicator="FM.LBL.BMNY.CN", freq="A"),
    # Euro area
    S("ea_currency", "ea", "Currency in circulation", "Currency", 0, "official", "ecb", (500, 5000),
      "Currency in circulation reported by MFIs, central government and post offices (ECB BSI item L10), working-day "
      "and seasonally adjusted, end of period. Not the Eurosystem monetary base.",
      flow="BSI", key="M.U2.Y.V.L10.X.1.U2.2300.Z01.E", growth_key="M.U2.Y.V.L10.X.I.U2.2300.Z01.A", name="currency"),
    S("ea_m1", "ea", "M1", "M1", 1, "official", "ecb", (3000, 40000),
      "Currency in circulation plus overnight deposits (ECB BSI item M10), euro area changing composition, "
      "working-day and seasonally adjusted, end of period.",
      flow="BSI", key="M.U2.Y.V.M10.X.1.U2.2300.Z01.E", growth_key="M.U2.Y.V.M10.X.I.U2.2300.Z01.A", name="m1"),
    S("ea_m2", "ea", "M2", "M2", 2, "official", "ecb", (5000, 60000),
      "M1 plus deposits with agreed maturity up to 2 years and deposits redeemable at notice up to 3 months "
      "(ECB BSI item M20), working-day and seasonally adjusted, end of period.",
      flow="BSI", key="M.U2.Y.V.M20.X.1.U2.2300.Z01.E", growth_key="M.U2.Y.V.M20.X.I.U2.2300.Z01.A", name="m2"),
    S("ea_m3", "ea", "M3", "M3", 3, "official", "ecb", (5000, 60000),
      "M2 plus repurchase agreements, money market fund shares and debt securities up to 2 years (ECB BSI item "
      "M30), the ECB headline broad aggregate, working-day and seasonally adjusted, end of period.",
      flow="BSI", key="M.U2.Y.V.M30.X.1.U2.2300.Z01.E", growth_key="M.U2.Y.V.M30.X.I.U2.2300.Z01.A", name="m3"),
    # United Kingdom
    S("uk_notes_coin", "uk", "Notes and coin", "Notes and coin", 0, "official", "boe", (20, 400),
      "Notes and coin in circulation (Bank of England series LPMAVAA). Since May 2006 this and the reserve "
      "balances replace the old M0.", code="LPMAVAA", name="notes_coin"),
    S("uk_reserves", "uk", "Reserve balances", "Reserves", 0, "official", "boe", (100, 2000),
      "Reserve balances held by banks at the Bank of England (series LPMBL22), published from May 2006. "
      "Together with notes and coin these are the pieces of a base-money total.", code="LPMBL22", name="reserves"),
    S("uk_m0_old", "uk", "M0 (old)", "M0 (old)", 0, "official", "boe", (10, 200),
      "The former wide monetary base (series LPMVUBN): notes and coin plus banks' operational balances. "
      "Discontinued; last monthly observation Apr 2006.", code="LPMVUBN", name="m0_old",
      discontinued="2006-04",
      breaks=[dict(t="2006-04", label="Bank of England stopped publishing M0 after Apr 2006", kind="discontinuation")]),
    S("uk_m4", "uk", "M4", "M4", 4, "official", "boe", (1000, 10000),
      "Sterling M4 held by the UK private sector, break-adjusted levels (series LPMVUBR), which the Bank "
      "recommends for long comparisons. Monthly from 1982.", code="LPMVUBR", name="m4"),
    S("uk_m4ex", "uk", "M4ex", "M4ex", 4, "official", "boe", (1000, 10000),
      "M4 excluding deposits of intermediate other financial corporations (series RPMB53Q), monthly from Jul "
      "2009. The Bank treats it as sterling broad money.", code="RPMB53Q", name="m4ex"),
    # Japan
    S("jp_base", "jp", "Monetary base", "Base", 0, "official", "boj", (100000, 2000000),
      "Banknotes, coins and current account balances at the Bank of Japan, average amounts outstanding, from 1970.",
      db="MD01", code="MABS1AN11", start="197001", scale=0.1),
    S("jp_m1", "jp", "M1", "M1", 1, "official", "boj", (300000, 3000000),
      "Cash currency plus deposit money, average amounts outstanding. Current definition starts Apr 2003.",
      db="MD02", code="MAM1NAM3M1MO", start="200304", scale=0.1),
    S("jp_m2", "jp", "M2", "M2", 2, "official", "boj", (500000, 3000000),
      "M1 plus quasi-money plus CDs at a narrower set of institutions than M3, average amounts outstanding. "
      "Current definition starts Apr 2003.", db="MD02", code="MAM1NAM2M2MO", start="200304", scale=0.1),
    S("jp_m3", "jp", "M3", "M3", 3, "official", "boj", (1000000, 4000000),
      "M1 plus quasi-money plus CDs across all depository institutions, average amounts outstanding; the Bank of "
      "Japan headline broad aggregate. Current definition starts Apr 2003.",
      db="MD02", code="MAM1NAM3M3MO", start="200304", scale=0.1),
    S("jp_l", "jp", "L", "L", 4, "official", "boj", (1500000, 5000000),
      "Broadly-defined liquidity: M3 plus trusts, bank debentures, commercial paper, government securities and "
      "foreign bonds held by the non-financial sector. Average amounts outstanding, from Apr 2003.",
      db="MD02", code="MAM1NABLBLMO", start="200304", scale=0.1),
    S("jp_m1_old", "jp", "M1", "M1 (old)", 1, "historical", "boj", (50000, 1000000),
      "Old M1, end-of-period amounts, from Jan 1955 to Mar 1999 (excluding foreign banks in Japan, a reference "
      "series). Not seasonally adjusted: the year-end sawtooth is in the data (December is usually 5 to 14% above "
      "November, then January drops 3 to 11%). Discontinued; the current M1 starts Apr 2003 on a different "
      "definition, so there is a gap.",
      db="MD02", code="MAMS1EN01", start="195501", scale=0.1, end="199903", continues="jp_m1",
      discontinued="1999-03",
      breaks=[dict(t="1999-03", label="Old definition ends; new M1/M2/M3/L start Apr 2003 (not comparable)",
                   kind="discontinuation")]),
    S("jp_m2cd_old", "jp", "M2", "M2+CDs (old)", 2, "historical", "boj", (100000, 2000000),
      "Old M2+CDs, end-of-period amounts, from Jan 1955 to Mar 1999 (excluding foreign banks in Japan, a reference "
      "series). Not seasonally adjusted: a smaller year-end sawtooth is in the data (December is usually 2 to 8% "
      "above November, then January drops 1 to 3%). Discontinued; the current M2 starts Apr 2003 on a different "
      "definition, so there is a gap.",
      db="MD02", code="MAMS1ENM2C", start="195501", scale=0.1, end="199903", continues="jp_m2",
      discontinued="1999-03",
      breaks=[dict(t="1999-03", label="Old M2+CDs ends; new M2 starts Apr 2003 (not comparable)",
                   kind="discontinuation")]),
    # China
    S("cn_m0", "cn", "M0", "M0", 0, "official", "eastmoney", (5000, 50000),
      "Currency in circulation (cash only, no reserves), end of month, from 2008. Not seasonally adjusted: cash "
      "swells before the Lunar New Year, so some Decembers-to-Januaries jump sharply (January 2011 was 30% above "
      "December 2010). Year-on-year change is the published same-basis rate (EastMoney FREE_CASH_SAME). Source is "
      "EastMoney's mirror of PBoC data; verify against pbc.gov.cn.", field="FREE_CASH", yoy_field="FREE_CASH_SAME"),
    S("cn_m1", "cn", "M1", "M1", 1, "official", "eastmoney", (50000, 300000),
      "M0 plus corporate demand deposits, end of month. Not seasonally adjusted. From Jan 2024 the PBoC restated "
      "M1 to add personal demand deposits and non-bank payment institutions' customer reserves, but only back to "
      "Jan 2024, so the line is split there. Year-on-year change is the published same-basis rate (EastMoney "
      "CURRENCY_SAME), except for 2024, where that rate is still on the old definition while the levels are "
      "restated, so it is left blank for 12 months from the break. Source is EastMoney's mirror of PBoC data.",
      field="CURRENCY", yoy_field="CURRENCY_SAME",
      breaks=[dict(t="2024-01", label="PBoC restated M1 (household demand deposits and payment balances added), "
                                      "about 1.65x step", kind="redefinition")]),
    S("cn_m2", "cn", "M2", "M2", 2, "official", "eastmoney", (100000, 600000),
      "M1 plus quasi-money (time, savings and other deposits), end of month, from 2008. China publishes no M3. "
      "Not seasonally adjusted. The PBoC widened the scope of M2 in Oct 2011: the level steps up 3.7% in that one "
      "month and a ratio of levels overstates growth by about 4 to 5 points for the next 12 months, so "
      "year-on-year change here is the published same-basis rate (EastMoney BASIC_CURRENCY_SAME, 0.1 point "
      "precision), which also removes smaller differences in 2014 to 2015 and 2017. Source is EastMoney's mirror "
      "of PBoC data.",
      field="BASIC_CURRENCY", yoy_field="BASIC_CURRENCY_SAME",
      breaks=[dict(t="2011-10", label="PBoC widened the scope of M2 (level steps up about 3.7%; published growth "
                                      "is on a comparable basis)", kind="scope")]),
    S("cn_broad_wb", "cn", "M2", "Broad (WB)", 2, "historical", "wb", (50000, 600000),
      "IMF and World Bank broad money for China (PBoC M2 basis), year end, current yuan, 1977 to 2007 before the "
      "monthly series starts. Never rescaled or spliced.",
      country="CHN", indicator="FM.LBL.BMNY.CN", freq="A", continues="cn_m2"),
]
SPEC_BY_ID = {s["id"]: s for s in SPECS}

EASTMONEY_URL_NAME = "eastmoney_cn_money_supply.json"

ECONOMIES = {
    "us": dict(name="United States", currency="USD", headline="us_m2"),
    "ea": dict(name="Euro area", currency="EUR", headline="ea_m3"),
    "uk": dict(name="United Kingdom", currency="GBP", headline="uk_m4ex"),
    "jp": dict(name="Japan", currency="JPY", headline="jp_m3"),
    "cn": dict(name="China", currency="CNY", headline="cn_m2"),
}
# Series in the default ladder; historical and index series are found by kind.
LADDER = {
    "us": ["us_base", "us_currency", "us_m1", "us_m2", "us_m3"],
    "ea": ["ea_currency", "ea_m1", "ea_m2", "ea_m3"],
    "uk": ["uk_notes_coin", "uk_reserves", "uk_m0_old", "uk_m4", "uk_m4ex"],
    "jp": ["jp_base", "jp_m1", "jp_m2", "jp_m3", "jp_l"],
    "cn": ["cn_m0", "cn_m1", "cn_m2"],
}

EA_BREAKS = [
    dict(t="2001-01", label="Greece joined the euro area; changing-composition level steps up",
         kind="composition"),
]
for _id in ("ea_currency", "ea_m1", "ea_m2", "ea_m3"):
    SPEC_BY_ID[_id]["breaks"] = [dict(b) for b in EA_BREAKS]
    SPEC_BY_ID[_id]["notes"] += (" Levels are for the euro area as composed at each date and include "
                                 "reclassifications, so enlargements and reporting changes add steps; Greece in 2001 "
                                 "is the one marked, others (for example M1 in mid-2005, M3 in mid-2010, Bulgaria in "
                                 "Jan 2026) are in the levels but not marked. Year-on-year change on the page is "
                                 "the ECB's own annual growth rate, which is flow based and removes those steps.")
SPEC_BY_ID["ea_currency"]["notes"] += (" The sharp swings in growth around the 2002 cash changeover (about -32% in "
                                       "Dec 2001, about +43% in Dec 2002) are changeover effects; they are in the "
                                       "ECB's own growth rates too.")

SERIES_SOURCE = {
    "ecb": "European Central Bank, Statistical Data Warehouse, BSI dataset",
    "boe": "Bank of England, Interactive Statistical Database",
    "boj": "Bank of Japan, Time-Series Data Search",
    "eastmoney": "EastMoney data centre (mirror of People's Bank of China money supply)",
    "wb": "World Bank, World Development Indicators FM.LBL.BMNY.CN (IMF International Financial Statistics)",
    "nber": "NBER Macrohistory Database, chapter 14 (Friedman and Schwartz)",
    "divisia": "Center for Financial Stability, Divisia monetary aggregates (AMFM)",
}


# ------------------------------------------------------------------- loaders

def result(data, freq, source, url, retrieved, route, from_cache=False, extra=None, yoy=None):
    """from_cache means a failed download was replaced by the cache; yoy is {period: official growth, %}."""
    return dict(data=data, freq=freq, source=source, url=url, retrieved=retrieved, route=route,
                from_cache=from_cache, extra=extra or [], yoy=yoy or {})


def in_range(spec, data):
    lo, hi = spec["plausible"]
    last = data[max(data)]
    if not lo <= last <= hi:
        raise ParseError(f"latest value {last:g} outside the plausible range {lo} to {hi}; unit change at source?")


class Context:
    def __init__(self, offline, only):
        self.raw = Raw(offline)
        self.offline = offline
        self.only = only
        self.fred_down = False
        self.fred_ok = False
        self.ddp_ids = {}

    def online(self, sid):
        return not self.offline and (self.only is None or sid in self.only)


def ddp_package_id(ctx, key):
    return ctx.ddp_ids.get(key) or DDP_PACKAGES[key]["id"]


def check_ddp(body):
    if not body.lstrip().startswith(b'"Series Description"'):
        raise ParseError("not a Data Download Program csv")


def discover_ddp(ctx, key):
    """Scrape the Choose page for the package link by its label."""
    page = ctx.raw.download("fed_ddp_h6_choose.html", DDP_CHOOSE).decode("utf-8", "replace")
    pat = re.compile(r'value="rel=H6&amp;series=([0-9a-f]{32})[^"]*"[^>]*/><label[^>]*>([^<]*)</label>')
    for m in pat.finditer(page):
        if re.search(DDP_PACKAGES[key]["label"], m.group(2).strip()):
            ctx.ddp_ids[key] = m.group(1)
            return m.group(1)
    raise FetchError("Data Download Program package not found on the Choose page")


def fetch_ddp(ctx, key):
    """Hard-coded package id first; scrape the Choose page if it ever stops working."""
    cache = DDP_PACKAGES[key]["cache"]
    try:
        return ctx.raw.download(cache, DDP_URL.format(pkg=ddp_package_id(ctx, key)), check=check_ddp)
    except FetchError:
        return ctx.raw.download(cache, DDP_URL.format(pkg=discover_ddp(ctx, key)), check=check_ddp)


def scale_guess(spec, data, units_unknown):
    """FRED units are not guaranteed to be billions; accept x1 or x1/1000 if the result is plausible."""
    lo, hi = spec["plausible"]
    last = data[max(data)]
    for k in ((1, 0.001) if units_unknown else (1,)):
        if lo <= last * k <= hi:
            return {p: v * k for p, v in data.items()}
    raise ParseError(f"latest value {last:g} outside the plausible range {lo} to {hi}")


def load_us(ctx, spec, online):
    fid = spec["fred"]
    pkg, uid = spec["ddp"]
    ds, code = spec["dbn"]
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    fred_url = FRED_CSV.format(id=fid)
    api_url = FRED_API.format(id=fid, key=api_key)
    api_public = FRED_API.format(id=fid, key="REDACTED")
    dbn_url = DBN_URL.format(ds=ds, code=code)
    dbn_name = f"dbnomics_fed_{ds}_{code}.json"
    ddp_url = DDP_URL.format(pkg=DDP_PACKAGES[pkg]["id"])

    def p_fred(b):
        return scale_guess(spec, parse_fred_csv(b, fid), True)

    def p_api(b):
        return scale_guess(spec, parse_fred_api(b), True)

    def p_ddp(b):
        cols = parse_ddp(b)
        if not cols.get(uid):
            raise ParseError(f"column {uid} missing from the package")
        return scale_guess(spec, cols[uid], False)

    def p_dbn(b):
        return scale_guess(spec, parse_dbnomics(b), False)

    # label, cache file, url shown, parser, source text
    routes = [
        ("fred", f"fred_{fid}.csv", fred_url, p_fred, f"Federal Reserve H.6 (FRED {fid})"),
        ("fred_api", f"fred_api_{fid}.json", api_public, p_api, f"Federal Reserve H.6 (FRED API {fid})"),
        ("ddp", DDP_PACKAGES[pkg]["cache"], ddp_url, p_ddp,
         f"Federal Reserve H.6, Data Download Program (same series as FRED {fid})"),
        ("dbnomics", dbn_name, dbn_url, p_dbn, f"Federal Reserve H.6 via DBnomics mirror (same series as FRED {fid})"),
    ]
    errors = []
    if online:
        for label, cache, url, parser, source in routes:
            try:
                if label == "fred":
                    if ctx.fred_down:
                        raise FetchError("FRED unreachable earlier in this run")
                    body = ctx.raw.download(cache, url, timeout=8, attempts=1, check=parser)
                elif label == "fred_api":
                    if not api_key:
                        raise FetchError("FRED_API_KEY not set")
                    body = ctx.raw.download(cache, api_url, public_url=api_public, timeout=20, check=parser)
                elif label == "ddp":
                    body = fetch_ddp(ctx, pkg)
                else:
                    body = ctx.raw.download(cache, url, check=parser)
                if label == "fred":
                    ctx.fred_ok = True
                return result(parser(body), "M", source, ctx.raw.url_of(cache, url), TODAY, label)
            except (FetchError, ParseError, ValueError, KeyError) as e:
                if label == "fred" and isinstance(e, FetchError) and e.network:
                    ctx.fred_down = True
                errors.append(f"{label}: {e}")
    # cache: every cached copy that parses; the latest observation wins, then the newest download
    best = None
    for label, cache, url, parser, source in routes:
        body, when = ctx.raw.cached(cache)
        if body is None:
            continue
        try:
            data = parser(body)
        except (ParseError, ValueError, KeyError):
            continue
        key = (max(data), (RAW / cache).stat().st_mtime)
        if best is None or key > best[0]:
            best = (key, data, label, ctx.raw.url_of(cache, url), when, source)
    if best:
        _, data, label, url, when, source = best
        # "cached copy" only when the downloads above were tried and failed
        return result(data, "M", source + (", cached copy" if online else ""), url, when, "cache:" + label, online)
    raise FetchError("no route worked: " + "; ".join(errors) if errors else "no cached copy in data/raw")


def join_nber(ctx, ids, online):
    data, retrieved, cached = {}, TODAY, False
    for fid in ids:
        body, when, c = ctx.raw.get(f"nber_{fid}.dat", NBER_URL.format(id=fid), online, check=parse_nber)
        data.update(parse_nber(body))
        retrieved = min(retrieved, when)
        cached = cached or c
    return data, retrieved, cached


def load_nber(ctx, spec, online):
    used = spec["files"]
    try:
        data, retrieved, cached = join_nber(ctx, used, online)
    except (FetchError, ParseError):
        if "backup_files" not in spec:
            raise
        used = spec["backup_files"]
        data, retrieved, cached = join_nber(ctx, used, online)
    in_range(spec, data)
    extra = []
    if used != spec["files"]:
        extra.append("Built from the commercial-bank M2 files " + " and ".join(used)
                     + " because the all-bank files failed.")
    return result(data, "M", SERIES_SOURCE["nber"] + ", files " + " and ".join(used), NBER_URL.format(id=used[0]),
                  retrieved, "nber", cached, extra)


def load_divisia(ctx, spec, online):
    def conv(b):
        cells = read_xlsx(b, "Broad")
        if not cells.get("B2", "").startswith("Divisia M4 level"):
            raise ParseError("Divisia workbook layout changed (B2 is not the DM4 level)")
        epoch = dt.date(1899, 12, 30)
        data, r = {}, 3
        while f"A{r}" in cells:
            if f"B{r}" in cells:
                d = epoch + dt.timedelta(days=int(float(cells[f"A{r}"])))
                data[d.strftime("%Y-%m")] = float(cells[f"B{r}"])
            r += 1
        in_range(spec, data)
        return data

    body, when, cached = ctx.raw.get("cfs_divisia.xlsx", CFS_URL, online, timeout=90, check=conv)
    return result(conv(body), "M", SERIES_SOURCE["divisia"] + ", Broad sheet, DM4", CFS_URL, when, "cfs", cached)


def load_ecb(ctx, spec, online):
    url = ECB_URL.format(flow=spec["flow"], key=spec["key"])

    def conv(b):
        raw, status = parse_ecb(b)
        data = {p: v / 1000.0 for p, v in raw.items()}  # EUR millions to billions
        in_range(spec, data)
        return data, raw, status

    name = f"ecb_bsi_{spec['name']}.csv"
    body, when, cached = ctx.raw.get(name, url, online, check=conv)
    data, raw, status = conv(body)
    extra = []
    last = max(raw)
    if status.get(last) == "P":
        extra.append(f"Latest observation ({last}) is flagged provisional by the ECB.")
    source = SERIES_SOURCE["ecb"] + " " + spec["key"]
    # The levels are changing-composition stocks, so a ratio of levels includes membership and
    # reclassification steps. The ECB's own annual growth rate is flow based and removes them.
    yoy = {}
    gname = f"ecb_bsi_{spec['name']}_yoy.csv"
    gurl = ECB_URL.format(flow=spec["flow"], key=spec["growth_key"])
    try:
        gbody, gwhen, gcached = ctx.raw.get(gname, gurl, online, check=parse_ecb)
        yoy = {p: round(v, 3) for p, v in parse_ecb(gbody)[0].items()}
        cached = cached or gcached
        when = min(when, gwhen)
        source += "; year-on-year change from the ECB annual growth rate " + spec["growth_key"]
    except (FetchError, ParseError) as e:
        warn(f"{gname}: {e}; year-on-year will be computed from the levels")
        extra.append("The ECB growth rates were not available, so year-on-year change on the page is computed "
                     "from the levels and includes the steps described above.")
    return result(data, "M", source, ctx.raw.url_of(name, url), when, "ecb", cached, extra, yoy)


def load_boe(ctx, spec, online):
    url = BOE_URL.format(code=spec["code"])

    def conv(b):
        data = {p: v / 1000.0 for p, v in parse_boe(b).items()}  # GBP millions to billions
        in_range(spec, data)
        return data

    name = f"boe_{spec['code']}.csv"
    body, when, cached = ctx.raw.get(name, url, online, check=conv)
    return result(conv(body), "M", SERIES_SOURCE["boe"] + " " + spec["code"], ctx.raw.url_of(name, url), when, "boe", cached)


def boj_end():
    return dt.date.today().strftime("%Y%m")


def load_boj(ctx, spec, online):
    url = BOJ_URL.format(db=spec["db"], start=spec["start"], end=spec.get("end", boj_end()), code=spec["code"])

    def conv(b):
        series = parse_boj(b)
        if spec["code"] not in series:
            raise ParseError("series code missing from BoJ response")
        data = {p: v * spec["scale"] for p, v in series[spec["code"]].items()}  # 100 million yen to billions
        in_range(spec, data)
        return data

    # the URL carries the run month as endDate; an offline rebuild must report the URL actually fetched
    name = f"boj_{spec['code']}.csv"
    body, when, cached = ctx.raw.get(name, url, online, check=conv)
    return result(conv(body), "M", SERIES_SOURCE["boj"] + " " + spec["code"], ctx.raw.url_of(name, url), when, "boj", cached)


def load_eastmoney(ctx, spec, online):
    def conv(b):
        rows = parse_eastmoney(b)
        data = {p: r[spec["field"]] / 10.0 for p, r in rows.items() if r.get(spec["field"]) is not None}  # 100m yuan
        in_range(spec, data)
        return data

    body, when, cached = ctx.raw.get(EASTMONEY_URL_NAME, EM_URL, online, check=conv)
    # published same-basis growth, 0.1 point precision; absent in a cache saved before the _SAME columns were requested
    yoy = {}
    if spec.get("yoy_field"):
        yoy = {p: round(float(r[spec["yoy_field"]]), 3) for p, r in parse_eastmoney(body).items()
               if r.get(spec["yoy_field"]) is not None}
    return result(conv(body), "M", SERIES_SOURCE["eastmoney"], ctx.raw.url_of(EASTMONEY_URL_NAME, EM_URL), when,
                  "eastmoney", cached, yoy=yoy)


def load_wb(ctx, spec, online):
    ind, c = spec["indicator"], spec["country"]
    url = WB_URL.format(c=c, ind=ind)

    def conv(b):
        raw = parse_wb(b).get(c)
        if not raw:
            raise ParseError("no World Bank data for " + c)
        data = {y: v / 1e9 for y, v in raw.items()}
        in_range(spec, data)
        return data

    body, when, cached = ctx.raw.get(f"wb_{ind}_{c}.json", url, online, check=conv)
    return result(conv(body), "A", SERIES_SOURCE["wb"], url, when, "worldbank", cached)


LOADERS = {"us": load_us, "nber": load_nber, "divisia": load_divisia, "ecb": load_ecb, "boe": load_boe,
           "boj": load_boj, "eastmoney": load_eastmoney, "wb": load_wb}


# ------------------------------------------------------------------------ FX

class FX:
    """USD per unit of local currency: month-end rates, with World Bank annual averages as fallback."""

    def __init__(self):
        self.eop = {}
        self.annual = {}
        self.desc = {}

    def rate(self, ccy, period):
        if ccy == "USD":
            return 1.0
        p = period + "-12" if len(period) == 4 else period
        r = self.eop.get(ccy, {}).get(p)
        if r is not None:
            return r
        return self.annual.get(ccy, {}).get(period[:4])


def load_fx(ctx):
    fx = FX()
    online = not ctx.offline

    def grab(name, url):
        try:
            return ctx.raw.get(name, url, online)[0]
        except FetchError as e:
            warn(f"FX {name}: {e}")
            return None

    usd_per_eur = None
    body = grab("ecb_fx_usd_eop.csv", ECB_URL.format(flow="EXR", key="M.USD.EUR.SP00.E"))
    if body:
        usd_per_eur = parse_ecb(body)[0]
        fx.eop["EUR"] = dict(usd_per_eur)
        fx.desc["EUR"] = "ECB euro reference rate, USD per EUR, month end, from 1999-01"
    body = grab("boe_XUMLUSS.csv", BOE_URL.format(code="XUMLUSS"))
    if body:
        fx.eop["GBP"] = parse_boe(body)
        fx.desc["GBP"] = "Bank of England USD per GBP, month end, from 1975-01"
    body = grab("boj_fx_FXERM06.csv", BOJ_URL.format(db="FM08", start="197101", end=boj_end(), code="FXERM06"))
    if body:
        fx.eop["JPY"] = {p: 1.0 / v for p, v in parse_boj(body)["FXERM06"].items()}
        fx.desc["JPY"] = "Bank of Japan Tokyo 17:00 spot, yen per USD inverted, month end, from 1973-01"
    body = grab("ecb_fx_cny_eop.csv", ECB_URL.format(flow="EXR", key="M.CNY.EUR.SP00.E"))
    if body and usd_per_eur:
        cny_per_eur = parse_ecb(body)[0]
        fx.eop["CNY"] = {p: usd_per_eur[p] / v for p, v in cny_per_eur.items() if p in usd_per_eur}
        fx.desc["CNY"] = "ECB CNY and USD reference rates crossed, month end, from 2000-01"
    body = grab("wb_PA.NUS.FCRF_all.json", WB_URL.format(c="CHN;JPN;GBR;EMU", ind="PA.NUS.FCRF"))
    if body:
        wb = parse_wb(body)
        for ccy, iso in (("EUR", "EMU"), ("GBP", "GBR"), ("JPY", "JPN"), ("CNY", "CHN")):
            if iso in wb:
                fx.annual[ccy] = {y: 1.0 / v for y, v in wb[iso].items()}
    return fx


def fx_note(fx, ccy, first_period):
    if ccy == "USD":
        return ""
    eop, ann = fx.eop.get(ccy), fx.annual.get(ccy)
    if not eop and not ann:
        return "No exchange rate available, so the USD column is null."
    bits = []
    start = None
    if eop:
        start = min(eop)[:4]
        bits.append("USD column: " + fx.desc[ccy])
    if ann and (start is None or min(ann) < start):
        bits.append(f"before that the World Bank annual average rate is used (from {min(ann)})")
        start = min(ann)
    if start and first_period[:4] < start:
        bits.append(f"USD cells are null before {start}")
    return "; ".join(bits) + "."


# ------------------------------------------------------------ series assembly

def seq(first, last, freq):
    if freq == "A":
        return [f"{y:04d}" for y in range(int(first), int(last) + 1)]
    y, m = int(first[:4]), int(first[5:7])
    end = (int(last[:4]), int(last[5:7]))
    out = []
    while (y, m) <= end:
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def month_add(period, n):
    y, m = int(period[:4]), int(period[5:7]) - 1 + n
    return f"{y + m // 12:04d}-{m % 12 + 1:02d}"


def r6(v):
    """Six significant figures: keeps a ratio of two stored levels within 0.001 points of the exact growth rate."""
    if v is None:
        return None
    x = float(f"{v:.6g}")
    return int(x) if x == int(x) else x


def assemble(spec, res, fx, modern_first=None):
    """Turn a loader result into the output series entry plus a summary dict."""
    ccy = ECONOMIES[spec["economy"]]["currency"]
    freq = res["freq"]
    data = dict(res["data"])
    notes = [spec["notes"]]
    notes.extend(res["extra"])
    # historical series stop where the series they continue starts
    if spec["kind"] == "historical" and modern_first:
        cut = int(modern_first[:4]) if freq == "A" else None
        before = {p: v for p, v in data.items() if (int(p) < cut if freq == "A" else p < modern_first)}
        if before:
            data = before
    if not data:
        raise ParseError("no data left after trimming")
    # Official year-on-year growth (a 4th column) replaces a ratio of levels where the source publishes it.
    # It is dropped for the 12 months from a redefinition break, where the source rate is on the old basis.
    yoy = dict(res.get("yoy") or {})
    if freq != "M":
        yoy = {}
    for b in spec["breaks"]:
        if b["kind"] == "redefinition":
            for n in range(12):
                yoy.pop(month_add(b["t"], n), None)
    width = 4 if yoy else 3
    rows = []
    for p in seq(min(data), max(data), freq):
        v = data.get(p)
        if v is None:
            rows.append([p, None, None])
        elif spec["kind"] == "index":
            rows.append([p, v, None])
        else:
            k = fx.rate(ccy, p)
            rows.append([p, v, v * k if k is not None else None])
        if width == 4:
            rows[-1].append(yoy.get(p) if v is not None else None)
    # a null row at each redefinition break splits the line
    for b in spec["breaks"]:
        if b["kind"] == "redefinition":
            for i, r in enumerate(rows):
                if r[0] == b["t"]:
                    rows.insert(i, [b["t"]] + [None] * (width - 1))
                    break
    if spec["kind"] != "index" and ccy != "USD":
        notes.append(fx_note(fx, ccy, min(data)))
    if res["from_cache"] and "cached" not in res["source"]:
        notes.append(f"Built from the cached download of {res['retrieved']}; the live source was not used.")
    entry = dict(economy=spec["economy"], aggregate=spec["aggregate"], label=spec["label"], rank=spec["rank"],
                 kind=spec["kind"], frequency=freq, unit="index" if spec["kind"] == "index" else "bn",
                 source=res["source"], url=res["url"], retrieved=res["retrieved"], notes=" ".join(n for n in notes if n),
                 breaks=spec["breaks"], discontinued=spec["discontinued"], continues=spec["continues"],
                 data=[[r[0], r6(r[1]), r6(r[2])] + r[3:] for r in rows])
    real = [r for r in rows if r[1] is not None]
    summary = dict(id=spec["id"], route=res["route"], points=len(real), first=real[0][0], last=real[-1][0],
                   last_local=real[-1][1], last_usd=real[-1][2], cached=res["from_cache"])
    return entry, summary


def overlap_note(hist, modern, freq):
    """Ratio of the modern series to the historical one at the first modern period."""
    m0 = min(modern)
    if freq == "A":
        y = m0[:4]
        a, b = hist.get(y), modern.get(y + "-12")
        label = f"Dec {y}"
    else:
        a, b = hist.get(m0), modern.get(m0)
        label = m0
    if a and b:
        return f"Overlap check at {label}: modern series {b:.1f}, this series {a:.1f}, ratio modern/this {b / a:.2f}."
    return ""


# ------------------------------------------------------------ static content

DEFINITIONS = [
    dict(name="M0 / monetary base", short="Central bank money: cash plus bank reserves.",
         definition="What the central bank has issued: currency in circulation plus the reserves banks hold with "
                    "it. 'M0' is the UK and China label, 'monetary base' the US and Japan label. No single "
                    "international definition exists.",
         official_where="US: Fed monetary base (currency plus reserve balances), from 1959; the St. Louis Fed "
                        "adjusted base stopped after Nov 2019. Japan: BoJ monetary base, from 1970. China: PBoC "
                        "M0, which is currency only. UK: the Bank of England's M0 ended in Apr 2006; notes and "
                        "coin and reserve balances are now published separately. Euro area: no official "
                        "base-money headline, so currency in circulation is shown.",
         caveats="Not comparable across countries: China's M0 is cash only, the old UK M0 counted only "
                 "operational balances, and the Fed, BoJ and ECB bases include all reserves. QE and interest on "
                 "reserves lifted post-2008 bases far above currency (US, Aug 2026: base $5.41T against currency "
                 "$2.48T). The Fed has no series called M0."),
    dict(name="M1", short="Narrow money: cash plus on-demand deposits.",
         definition="Currency held by the public plus deposits that can be spent on demand. US: currency, demand "
                    "deposits and other liquid deposits (savings deposits included since May 2020). Euro area: "
                    "currency plus overnight deposits. Japan: cash currency plus deposit money. China: M0 plus "
                    "corporate demand deposits and, since the 2025 revision, personal demand deposits and "
                    "non-bank payment balances.",
         official_where="Official at the Fed (H.6), ECB, BoJ and PBoC. Not a headline at the Bank of England.",
         caveats="Two large breaks. US: the Fed moved savings deposits into M1 in May 2020, a 3.4x jump (Apr "
                 "2020 $4.86T, May 2020 $16.31T) that was not back-revised. China: the PBoC restated M1 only "
                 "back to Jan 2024, a 1.65x step (Dec 2023 68.1T yuan, Jan 2024 112.0T yuan). Lines are split at "
                 "both."),
    dict(name="M2", short="M1 plus short-term savings-type deposits.",
         definition="M1 plus small savings-type holdings. US: M1 plus small time deposits and retail money market "
                    "funds. Euro area: M1 plus deposits up to 2 years and deposits redeemable at notice up to 3 "
                    "months. Japan: M1 plus quasi-money plus CDs, at a narrower set of institutions than M3. "
                    "China: M1 plus quasi-money (time, savings and other deposits).",
         official_where="Official at the Fed, ECB, BoJ and PBoC. No current official UK M2.",
         caveats="US: a 28 Jul 2026 H.6 change nets IRA and Keogh balances out of small time deposits and retail "
                 "money funds and restated history, so re-pull the whole series. Japan: the current M1, M2, M3 "
                 "and L start in Apr 2003 and are not comparable with the old M2+CDs. China: coverage has been "
                 "widened several times, for example in Oct 2011 (a 3.7% one-month step in the level) and a 2018 "
                 "change in money-market-fund treatment."),
    dict(name="M3", short="Broad money: M2 plus large and market-traded holdings.",
         definition="Euro area: M2 plus repurchase agreements, money market fund shares and debt securities up to "
                    "2 years (the ECB headline). Japan: M1 plus quasi-money plus CDs across all depository "
                    "institutions (the BoJ headline broad measure). US: M2 plus large time deposits, "
                    "institutional money funds, term repos and term Eurodollars.",
         official_where="Official now at the ECB and the BoJ. The Fed stopped publishing US M3 on 23 Mar 2006 "
                        "(last observation Feb 2006). Not published in China or the UK (the UK broad measure is "
                        "M4).",
         caveats="The FRED/OECD series 'M3 for the United States' is not M3: it tracks Fed M2 to within about "
                 "0.5%. IMF and World Bank 'broad money' for the US is wider than M2 but is not the old Fed M3; "
                 "it is shown separately and never labelled M3."),
    dict(name="M4", short="UK broad money; no equivalent elsewhere.",
         definition="UK: sterling notes and coin held by the UK private sector plus its sterling deposits at UK "
                    "banks and building societies, plus certain short-term MFI paper. M4ex excludes deposits of "
                    "intermediate other financial corporations.",
         official_where="Official only at the Bank of England (M4, and M4ex monthly from Jul 2009, which the Bank "
                        "treats as sterling broad money). The Fed, ECB, BoJ and PBoC publish no M4. In the US, "
                        "'M4' exists only as the CFS Divisia M4 (a private index) and as a Friedman-Schwartz "
                        "historical aggregate.",
         caveats="M4 is a UK concept, not 'one step wider than M3'. Use the break-adjusted level for long "
                 "comparisons. The Bank documents breaks in Jan 2010 (securitisation reporting) and Sep 2011 "
                 "(inter-MFI allocation)."),
    dict(name="M5", short="Not an official aggregate.",
         definition="No standard definition.",
         official_where="None. The Fed, ECB, Bank of England, BoJ and PBoC do not publish an M5. The only 'M5' "
                        "found is a classification label in the IMF's MFS_MA dataset ('Broad Money, M5', about "
                        "130 economies), which looks like a slot for each country's widest broad-money measure, "
                        "not a distinct national M5.",
         caveats="Not charted here. Where a wider measure exists it is shown under its own name (Japan L, UK M4, "
                 "IMF and World Bank broad money)."),
    dict(name="MZM (money zero maturity)", short="M2 minus small time deposits plus institutional money funds.",
         definition="M2 minus small-denomination time deposits plus institutional money market funds: balances "
                    "that can be spent at par on demand.",
         official_where="Computed by the St. Louis Fed, not the Fed Board. Discontinued after Jan 2021 when the "
                        "Board dropped institutional money funds from H.6.",
         caveats="Dead since 2021, and the 2020 savings-deposit reclassification had already blurred its "
                 "meaning. Not charted."),
    dict(name="L (Japan, broadly-defined liquidity)", short="Japan's widest aggregate: M3 plus other liquid assets.",
         definition="M3 plus pecuniary trusts, investment trusts, bank debentures, financial-institution "
                    "commercial paper, government securities and foreign bonds held by the non-financial sector.",
         official_where="Bank of Japan, monthly, on the current definition from Apr 2003.",
         caveats="Wider than any M-number (Sep 2026: L 2,344T yen against M3 1,638T yen). Do not share an axis "
                 "with M2 without labelling it."),
    dict(name="Divisia monetary indices", short="Index numbers that weight each deposit type by its interest cost.",
         definition="Aggregates (Barnett) that weight each component by its user cost, the interest-rate spread "
                    "to a benchmark, instead of adding balances one for one.",
         official_where="Official at the Bank of England and Poland's NBP. In the US they are private: the Center "
                        "for Financial Stability publishes Divisia M1, M2, MZM, M3 and M4 (index, Jan 1967 = "
                        "100). The St. Louis Fed MSI series stopped in Dec 2013.",
         caveats="Indices, not dollars: they cannot be stacked with M2 in a dollar chart, so they appear in "
                 "growth views only. CFS warns that recent H.6 changes affected how its aggregates are "
                 "computed."),
]

NOTES = [
    "Values are billions of local currency. The third value in each row is billions of US dollars, converted at "
    "end-of-period (month-end) exchange rates; null where no usable rate exists. Euro-area USD starts in 1999-01, "
    "the first ECB reference rate.",
    "Definitions and coverage differ by economy, so levels are not comparable across economies. Stock types also "
    "differ: Fed and BoJ figures are monthly averages of daily levels, ECB, BoE and PBoC figures are end-of-period.",
    "M5 is not an official aggregate at the Fed, ECB, BoE, BoJ or PBoC. M4 is official only in the UK. M3 is "
    "official for the euro area and Japan; US M3 ends in Feb 2006 (the Fed stopped publishing it in Mar 2006).",
    "A row with null values is a line break. It is inserted just before the first observation after a redefinition "
    "break and carries that observation's period; skip null rows in readouts and do not compute 12-month growth "
    "across a redefinition break.",
    "Series with kind 'historical' are kept apart from the modern series they continue. Values are never rescaled "
    "or spliced; each series note gives the ratio at the junction where there is an overlap.",
    "China figures come from EastMoney's mirror of PBoC data (unofficial; verify against pbc.gov.cn). The latest "
    "ECB observation is provisional. US M2 was restated in the 28 Jul 2026 H.6 release, so each run re-downloads "
    "the full history.",
    "Divisia M4 is an index (Jan 1967 = 100) with no dollar values. Level values are rounded to 6 significant "
    "figures.",
    "Euro-area and China rows carry a 4th value: the source's own year-on-year growth in percent (ECB annual growth "
    "rate; PBoC same-basis rate via EastMoney). The page prefers it to a ratio of levels, because the levels contain "
    "membership, reclassification and scope steps that the published rate removes.",
    "Seasonal adjustment differs by source. US M1, M2 and M3 and the ECB series are seasonally adjusted. The old "
    "Japanese M1 and M2+CDs and the Chinese series are not, so their levels show year-end and Lunar New Year "
    "swings. Year-on-year views are not affected.",
]


# ---------------------------------------------------------------- output

def js_str(s):
    return json.dumps(s, ensure_ascii=True)


def dumps(o):
    return json.dumps(o, ensure_ascii=True, separators=(",", ":"))


def row_text(r):
    return "[" + ",".join(["\"" + r[0] + "\""] + ["null" if x is None else str(x) for x in r[1:]]) + "]"


def render(out):
    L = ["// Generated by tools/fetch_money_supply.py on %s. Do not edit by hand." % out["generated"],
         "window.MONEY_SUPPLY = {",
         "\"generated\":%s," % js_str(out["generated"]),
         "\"notes\":["]
    L.append(",\n".join("  " + js_str(n) for n in out["notes"]))
    L.append("],")
    L.append("\"definitions\":[")
    L.append(",\n".join("  " + dumps(d) for d in out["definitions"]))
    L.append("],")
    L.append("\"economies\":{")
    L.append(",\n".join("  %s:%s" % (js_str(k), dumps(v)) for k, v in out["economies"].items()))
    L.append("},")
    L.append("\"series\":{")
    blocks = []
    for sid, s in out["series"].items():
        head = {k: v for k, v in s.items() if k != "data"}
        head_txt = dumps(head)[:-1]  # drop closing brace, data follows
        rows = [row_text(r) for r in s["data"]]
        lines = [",".join(rows[i:i + 8]) for i in range(0, len(rows), 8)]
        blocks.append("%s:%s,\"data\":[\n%s\n]}" % (js_str(sid), head_txt, ",\n".join(lines)))
    L.append(",\n".join(blocks))
    L.append("}")
    L.append("};")
    text = "\n".join(L) + "\n"
    if chr(0x2014) in text:
        raise SystemExit("internal error: em dash in output")
    return text


# ------------------------------------------------------------------ main

def summary_table(rows, skipped):
    head = ("series", "route", "pts", "first", "last", "last local bn", "last usd bn")
    table = [head]
    for s in rows:
        table.append((s["id"], s["route"] + (" (cache)" if s["cached"] else ""), str(s["points"]), s["first"],
                      s["last"], "%.1f" % s["last_local"], "-" if s["last_usd"] is None else "%.1f" % s["last_usd"]))
    widths = [max(len(r[i]) for r in table) for i in range(len(head))]
    for i, r in enumerate(table):
        print("  ".join(c.ljust(w) if j < 5 else c.rjust(w) for j, (c, w) in enumerate(zip(r, widths))))
        if i == 0:
            print("  ".join("-" * w for w in widths))
    for sid, why in skipped.items():
        print(f"SKIPPED {sid}: {why}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="use data/raw cache only, no network")
    ap.add_argument("--only", help="comma separated series ids to refresh from the network; others use the cache")
    args = ap.parse_args()
    only = None
    if args.only:
        only = {x.strip() for x in args.only.split(",") if x.strip()}
        bad = only - set(SPEC_BY_ID)
        if bad:
            ap.error("unknown series id: " + ", ".join(sorted(bad)))
    ctx = Context(args.offline, only)
    fx = load_fx(ctx)

    loaded, skipped = {}, {}
    for spec in SPECS:
        sid = spec["id"]
        try:
            loaded[sid] = LOADERS[spec["loader"]](ctx, spec, ctx.online(sid))
        except Exception as e:  # one failed series must not stop the rest
            skipped[sid] = f"{type(e).__name__}: {e}"

    series, summaries = {}, []
    for spec in SPECS:
        sid = spec["id"]
        if sid not in loaded:
            continue
        res = loaded[sid]
        modern_first = None
        if spec["continues"]:
            if spec["continues"] in loaded:
                modern = loaded[spec["continues"]]["data"]
                modern_first = min(modern)
                note = overlap_note(res["data"], modern, res["freq"])
                if note:
                    res["extra"].append(note)
            else:
                skipped[sid] = f"modern series {spec['continues']} failed, so nothing to continue"
                continue
        try:
            entry, summ = assemble(spec, res, fx, modern_first)
        except Exception as e:
            skipped[sid] = f"{type(e).__name__}: {e}"
            continue
        summ["cached"] = summ["cached"] or not ctx.online(sid)  # the table shows every cache read, whatever the reason
        series[sid] = entry
        summaries.append(summ)

    economies = {}
    for key, e in ECONOMIES.items():
        order = [i for i in LADDER[key] if i in series]
        if not order:
            continue
        headline = e["headline"] if e["headline"] in series else order[-1]
        economies[key] = dict(name=e["name"], currency=e["currency"], headline=headline, order=order)

    ctx.raw.save_manifest()
    print()
    summary_table(summaries, skipped)
    print()
    routes = sorted({s["route"] for s in summaries if s["id"].startswith("us_")})
    fred = "unreachable" if ctx.fred_down else "reachable" if ctx.fred_ok else "not tried"
    print("US routes used:", ", ".join(routes) or "none", "| FRED:", fred)

    us_core = [i for i in ("us_base", "us_m1", "us_m2") if i in series]
    others = [k for k in economies if k != "us"]
    if not us_core and not others:
        print("error: US core series and every other economy failed; output not written", file=sys.stderr)
        return 1
    # date of the newest download in the file, so an offline rebuild reproduces the file it was built from
    generated = max(s["retrieved"] for s in series.values())
    out = dict(generated=generated, notes=NOTES, definitions=DEFINITIONS, economies=economies, series=series)
    OUT.write_text(render(out), encoding="utf-8", newline="\n")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(series)} series)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
