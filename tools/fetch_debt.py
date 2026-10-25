#!/usr/bin/env python3
"""Build data/debt.js (window.MACRO_DEBT): government debt, interest and private credit.

    python tools/fetch_debt.py                      download, cache in data/raw/debt, rebuild
    python tools/fetch_debt.py --offline            rebuild from data/raw/debt only (same bytes as the online run)
    python tools/fetch_debt.py --only d,TC_HH       refresh only these indicators from the network; the rest use the cache
    python tools/fetch_debt.py --allow-partial      write even if a series of the current file is missing from the build

Python 3.12 standard library only (shared helpers in tools/fetchlib.py). Run it as a plain script, not with -I.
Sources, licences and breaks are in tools/README.md; the per-indicator basis, vintage and breaks are in the file.

Stored values are source inputs. Ratios that need two inputs (net interest over receipts, interest over debt,
r minus g) are left to the browser so that it only ever divides numbers from the same year.
"""
import csv
import re
import sys
import urllib.parse

import fetchlib as F

OUT = F.ROOT / "data" / "debt.js"
GENERATOR = "tools/fetch_debt.py"
PIPELINE = "debt"
BUDGET = 400_000            # bytes; stays well under money-supply.js

IMF_API = "https://www.imf.org/external/datamapper/api/v1/"
BIS_TC_URL = "https://data.bis.org/static/bulk/WS_TC_csv_flat.zip"
BIS_DSR_URL = "https://data.bis.org/static/bulk/WS_DSR_csv_flat.zip"
ESTAT_API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
WB_URL = ("https://api.worldbank.org/v2/country/USA;GBR;JPN;DEU;FRA;ITA;CAN;CHN/indicator/NY.GDP.MKTP.CN"
          "?format=json&per_page=1000")
BEA_URL = "https://apps.bea.gov/national/Release/TXT/NipaDataA.txt"
FD_API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/"
OMB_ZIP_URL = "https://www.whitehouse.gov/wp-content/uploads/2026/04/hist_fy2027.zip"
OMB_PAGE_URL = "https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/"

# iso2, name, iso3 (the World Bank code EMU for the euro area), group, source codes
COUNTRIES = [
    ("US", "United States", "USA", "advanced", dict(imf="USA", bis="US", wb="USA", eurostat=None)),
    ("GB", "United Kingdom", "GBR", "advanced", dict(imf="GBR", bis="GB", wb="GBR", eurostat=None)),
    ("JP", "Japan", "JPN", "advanced", dict(imf="JPN", bis="JP", wb="JPN", eurostat=None)),
    ("DE", "Germany", "DEU", "advanced", dict(imf="DEU", bis="DE", wb="DEU", eurostat="DE")),
    ("FR", "France", "FRA", "advanced", dict(imf="FRA", bis="FR", wb="FRA", eurostat="FR")),
    ("IT", "Italy", "ITA", "advanced", dict(imf="ITA", bis="IT", wb="ITA", eurostat="IT")),
    ("CA", "Canada", "CAN", "advanced", dict(imf="CAN", bis="CA", wb="CAN", eurostat=None)),
    ("CN", "China", "CHN", "emerging", dict(imf="CHN", bis="CN", wb="CHN", eurostat=None)),
    ("EA", "Euro area", "EMU", "aggregate", dict(imf="EURO", bis="XM", wb=None, eurostat="EA20")),
]
ISO2_OF = {k: {c[4][k]: c[0] for c in COUNTRIES if c[4][k]} for k in ("imf", "bis", "wb", "eurostat")}

# Years in which a one-year step in revenue is expected from war finance, not from a change of coverage.
WAR_YEARS = set(range(1914, 1921)) | set(range(1939, 1950))
COVERAGE_STEP = 10.0        # percent of GDP

# ---- indicator list: id -> (label, unit, how to build); order here is the order in the file

IMF_SPECS = {
    "d": dict(dataset="FPP", label="Gross public debt, % of GDP (long run)",
              basis="Gross public debt at year end. The IMF uses general government where it has it and central "
                    "government otherwise, and the feed carries no coverage flags, so some series change coverage "
                    "part-way (see breaks). Annual, long run; not equal in level to GGXWDG_NGDP for every country."),
    "ie": dict(dataset="FPP", label="Interest paid on public debt, % of GDP",
               basis="Interest paid on public debt, same coverage as d. Divide by d of the previous year end for an "
                     "implied effective rate."),
    "rev": dict(dataset="FPP", label="Government revenue, % of GDP",
                basis="Government revenue, same coverage as d. Divide ie by it for interest over revenue outside the US."),
    "pb": dict(dataset="FPP", label="Primary balance, % of GDP",
               basis="Revenue minus spending other than interest; a positive number is a surplus. Same coverage as d."),
    "GGXWDG_NGDP": dict(dataset="WEO", label="General government gross debt, % of GDP (WEO, recent actuals)",
                        basis="IMF World Economic Outlook general government gross debt, 1980 or the first year the "
                              "IMF has it, to the last actual year."),
    "GG_DEBT_GDP": dict(dataset="GDD", label="General government debt, % of GDP (Global Debt Database)",
                        basis="IMF Global Debt Database, general government debt, from 1950 where available. Close to d "
                              "after the 1950s; kept as a cross-check."),
    "CG_DEBT_GDP": dict(dataset="GDD", label="Central government debt, % of GDP (Global Debt Database)",
                        basis="IMF Global Debt Database, central government debt only, so smaller than general "
                              "government debt where states, municipalities or social funds borrow (for example Canada, Germany, Japan, US)."),
    "HH_LS": dict(dataset="GDD", label="Household debt, loans and debt securities, % of GDP (IMF)",
                  basis="IMF Global Debt Database. A different compilation from the BIS series TC_HH: do not join the two."),
    "NFC_LS": dict(dataset="GDD", label="Non-financial corporate debt, loans and debt securities, % of GDP (IMF)",
                   basis="IMF Global Debt Database. A different compilation from the BIS series TC_NFC: do not join the two."),
    "PVD_LS": dict(dataset="GDD", label="Private debt, loans and debt securities, % of GDP (IMF)",
                   basis="IMF Global Debt Database, households plus non-financial corporations. Do not join to BIS series."),
}
IMF_UNIT = "% of GDP"

BIS_TC = {   # id -> (BIS borrower code, valuation code, label, basis)
    "TC_HH": ("H", "M", "Household credit, % of GDP (BIS)",
              "BIS total credit to households and non-profit institutions serving households, all lending sectors, "
              "market value, adjusted for breaks, percent of GDP. Value at the end of the fourth quarter; the newest "
              "quarter is under latest."),
    "TC_NFC": ("N", "M", "Non-financial corporate credit, % of GDP (BIS)",
               "BIS total credit to non-financial corporations, all lending sectors, market value, adjusted for "
               "breaks, percent of GDP. Value at the end of the fourth quarter; the newest quarter is under latest."),
    "TC_GG": ("G", "N", "Government credit, % of GDP (BIS)",
              "BIS total credit to general government, all lending sectors, nominal (face) value, adjusted for "
              "breaks, percent of GDP; face value is closer to the usual debt statistic than market value, which "
              "BIS publishes only for the other sectors. Value at the end of the fourth quarter; the newest "
              "quarter is under latest."),
}
BIS_DSR = {
    "DSR_HH": ("H", "Household debt service ratio, % of income (BIS)"),
    "DSR_NFC": ("N", "Non-financial corporate debt service ratio, % of income (BIS)"),
    "DSR_PRIV": ("P", "Private non-financial debt service ratio, % of income (BIS)"),
}

# plausible ranges per indicator (guard against unit changes at the source)
PLAUSIBLE = {
    "d": dict(every=(0, 400), min_points=30),
    "ie": dict(every=(0, 30), min_points=30),
    "rev": dict(every=(0, 70), min_points=30),
    "pb": dict(every=(-60, 30), min_points=30),
    "GGXWDG_NGDP": dict(every=(0, 350), min_points=20, newest_after=2024),
    "GG_DEBT_GDP": dict(every=(0, 350), min_points=25),
    "CG_DEBT_GDP": dict(every=(0, 350), min_points=20),
    "HH_LS": dict(every=(0, 200), min_points=20),
    "NFC_LS": dict(every=(0, 450), min_points=20),
    "PVD_LS": dict(every=(0, 450), min_points=20),
    "TC_HH": dict(every=(0, 200), min_points=15),
    "TC_NFC": dict(every=(0, 450), min_points=15),
    "TC_GG": dict(every=(0, 350), min_points=15),
    "DSR_HH": dict(every=(0, 40), min_points=20, newest_after=2025),
    "DSR_NFC": dict(every=(0, 100), min_points=20, newest_after=2025),
    "DSR_PRIV": dict(every=(0, 60), min_points=20, newest_after=2025),
    "ESTAT_GD": dict(every=(0, 300), min_points=25, newest_after=2025),
    "ESTAT_INT": dict(every=(0, 20), min_points=25, newest_after=2025),
    "NGDP": dict(every=(0.001, 10_000_000), min_points=25, newest_after=2025, max_ratio=3.5),
    "NGDP_GROWTH": dict(every=(-30, 80), min_points=25, newest_after=2025),
    "US_DEBT_TOTAL_USD": dict(every=(1_000, 1e14), last=(3e13, 8e13), min_points=200, newest_after=2025),
    "US_DEBT_GROSS_GDP": dict(every=(0, 300), min_points=80, newest_after=2025),
    "US_DEBT_PUBLIC_GDP": dict(every=(0, 300), min_points=80, newest_after=2025),
    "US_NETINT_BN": dict(every=(0.1, 3000), min_points=80, newest_after=2026),
    "US_RECEIPTS_BN": dict(every=(1, 12_000), min_points=80, newest_after=2026),
    "US_OUTLAYS_BN": dict(every=(1, 15_000), min_points=80, newest_after=2026),
    "US_GDP_FY_BN": dict(every=(50, 60_000), min_points=80, newest_after=2025),
    "US_AVG_RATE": dict(every=(0, 15), min_points=20, newest_after=2025),
}
CORE = ("d", "ie", "rev", "GGXWDG_NGDP", "TC_HH", "TC_NFC", "TC_GG", "NGDP", "NGDP_GROWTH",
        "US_DEBT_TOTAL_USD", "US_NETINT_BN", "US_RECEIPTS_BN", "US_AVG_RATE")

ORDER = (["d", "ie", "rev", "pb", "GGXWDG_NGDP", "GG_DEBT_GDP", "CG_DEBT_GDP", "HH_LS", "NFC_LS", "PVD_LS"]
         + list(BIS_TC) + list(BIS_DSR)
         + ["ESTAT_GD", "ESTAT_INT", "NGDP", "NGDP_GROWTH",
            "US_DEBT_TOTAL_USD", "US_DEBT_GROSS_GDP", "US_DEBT_PUBLIC_GDP", "US_NETINT_BN", "US_RECEIPTS_BN",
            "US_OUTLAYS_BN", "US_GDP_FY_BN", "US_AVG_RATE"])


# ------------------------------------------------------------------ small helpers

def rows_of(d, dp=2):
    """[[year, value], ...] from {year: value}; [year, None] stands at the first missing year of an interior gap."""
    out, prev = [], None
    for y in sorted(d):
        if prev is not None and y - prev > 1:
            out.append([prev + 1, None])
        out.append([y, F.r_dp(d[y], dp)])
        prev = y
    return out


def real_points(rows):
    return [(r[0], r[1]) for r in rows if r[1] is not None]


def span(rows):
    pts = real_points(rows)
    return (pts[0][0], pts[-1][0]) if pts else (None, None)


def newest(*dates):
    dates = [d for d in dates if d]
    return max(dates) if dates else None


def fmt(v, dp=1):
    return f"{v:.{dp}f}"


def quarters_to_annual(q, how):
    """{'1947-Q4': v} -> {1947: v}. how 'last' keeps Q4 only; 'mean' needs all four quarters."""
    by = {}
    for p, v in q.items():
        by.setdefault(int(p[:4]), {})[int(p[-1])] = v
    out = {}
    for y, d in by.items():
        if how == "last" and 4 in d:
            out[y] = d[4]
        elif how == "mean" and len(d) == 4:
            out[y] = sum(d.values()) / 4.0
    return out


class Ctx:
    def __init__(self, raw, only):
        self.raw = raw
        self.only = only
        self.memo = {}
        self.used = set()          # cache names that fed the output
        self.skipped = F.Skipped()
        self.out = {}              # id -> dict(series, latest, meta)

    def online(self, *users):
        return any(F.online_for(self.raw.offline, self.only, u) for u in users)

    def get(self, name, url, parse, users, **kw):
        """Cached, memoised download plus parse. Returns (value, retrieved date)."""
        key = ("parsed", name)
        if key not in self.memo:
            got = self.raw.get_parsed(name, url, parse, online=self.online(*users), **kw)
            self.used.add(name)
            self.memo[key] = (got.value, got.retrieved)
        return self.memo[key]

    def get_raw(self, name, url, users, **kw):
        key = ("raw", name)
        if key not in self.memo:
            got = self.raw.get(name, url, online=self.online(*users), **kw)
            self.used.add(name)
            self.memo[key] = (got.value, got.retrieved)
        return self.memo[key]

    def url(self, name, default):
        return self.raw.url_of(name, default)


# ------------------------------------------------------------------ IMF DataMapper

def parse_imf_meta(body):
    d = F.read_json(body)
    ind = d.get("indicators")
    if not isinstance(ind, dict) or "GGXWDG_NGDP" not in ind:
        raise F.ParseError("indicator list missing")
    out = {}
    for code in IMF_SPECS:
        v = ind.get(code)
        if not v:
            raise F.ParseError(f"IMF DataMapper no longer lists indicator {code}")
        src = F.ascii_fold(v.get("source") or "", errors="replace")
        m = re.search(r"\((?:[A-Za-z]+ )?(\d{4})\)\s*$", src)
        if not m:
            raise F.ParseError(f"cannot read the vintage year of {code} from {src!r}")
        out[code] = dict(source=src, dataset=v.get("dataset"), year=int(m.group(1)))
    return out


def imf_meta(ctx):
    return ctx.get("imf-indicators.json", IMF_API + "indicators", parse_imf_meta, list(IMF_SPECS),
                   ua=F.UA_PYTHON, kind="json")


def parse_imf(body, code):
    d = F.read_json(body)
    try:
        vals = d["values"][code]
    except (KeyError, TypeError):
        raise F.ParseError(f"no values for {code}")
    out = {}
    for iso3, series in vals.items():
        if iso3 not in ISO2_OF["imf"]:
            continue
        out[iso3] = {int(y): float(v) for y, v in series.items() if re.fullmatch(r"\d{4}", y) and v is not None}
    if not out.get("USA") and not out.get("GBR"):
        raise F.ParseError(f"{code}: neither the US nor the UK is present")
    return out


def imf_data(ctx, code):
    """({iso2: {year: value}} cut at the last actual year, vintage text, last actual year, retrieved, removed)."""
    key = ("imf", code)
    if key not in ctx.memo:
        meta, meta_date = imf_meta(ctx)
        info = meta[code]
        raw, when = ctx.get(f"imf-{code}.json", IMF_API + code, lambda b: parse_imf(b, code), [code],
                            ua=F.UA_PYTHON, kind="json")
        last_actual = info["year"] - 1
        out, removed = {}, 0
        for iso3, s in raw.items():
            kept = {y: v for y, v in s.items() if y <= last_actual}
            removed += len(s) - len(kept)
            if kept:
                out[ISO2_OF["imf"][iso3]] = kept
        ctx.memo[key] = dict(data=out, vintage=info["source"], last_actual=last_actual,
                             retrieved=newest(when, meta_date), removed=removed)
    return ctx.memo[key]


def fpp_steps(ctx):
    """Years in which FPP revenue steps by COVERAGE_STEP points or more outside war years: probable coverage changes."""
    if "steps" not in ctx.memo:
        rev = imf_data(ctx, "rev")["data"]
        steps = []
        for iso2, s in rev.items():
            for y in sorted(s):
                if y - 1 in s and y not in WAR_YEARS and abs(s[y] - s[y - 1]) >= COVERAGE_STEP:
                    steps.append((iso2, y, s[y - 1], s[y]))
        ctx.memo["steps"] = steps
    return ctx.memo["steps"]


def build_imf(ctx, sid):
    spec = IMF_SPECS[sid]
    info = imf_data(ctx, sid)
    series = {iso2: rows_of(s) for iso2, s in info["data"].items()}
    basis = spec["basis"]
    breaks = []
    if spec["dataset"] == "FPP":
        try:
            steps = fpp_steps(ctx)
        except (F.FetchError, F.ParseError):
            steps = []
        for iso2, y, a, b in steps:
            if iso2 in series and any(r[0] == y and r[1] is not None for r in series[iso2]):
                breaks.append(dict(country=iso2, year=y, kind="coverage",
                                   note=f"Probable change of coverage, inferred from revenue stepping from {fmt(a)}% to "
                                        f"{fmt(b)}% of GDP; not flagged by the IMF."))
    if sid == "GGXWDG_NGDP":
        try:
            fpp = imf_data(ctx, "d")["data"]
            gaps = []
            for iso2 in series:
                common = sorted(set(info["data"].get(iso2, {})) & set(fpp.get(iso2, {})))
                if common:
                    y = common[-1]
                    diff = info["data"][iso2][y] - fpp[iso2][y]
                    if abs(diff) > 2.0:
                        gaps.append(f"{iso2} {fmt(info['data'][iso2][y])} here against {fmt(fpp[iso2][y])} in d "
                                    f"({y}, {diff:+.1f} points)")
            if gaps:
                basis += " Level differences from d of more than 2 points in the last common year: " + "; ".join(gaps) + \
                         ". Do not join the two lines."
            else:
                basis += " Within 2 points of d in the last common year for every country, but keep the lines separate."
        except (F.FetchError, F.ParseError, KeyError):
            pass
    basis += (f" The feed does not flag projections, so values after {info['last_actual']} (the year before the "
              f"vintage year) are removed" + (f" ({info['removed']} values dropped)." if info["removed"] else "."))
    meta = dict(code=sid, source=f"IMF DataMapper, {info['vintage']}", url=ctx.url(f"imf-{sid}.json", IMF_API + sid),
                retrieved=info["retrieved"], vintage=info["vintage"], basis=basis, lastActual=info["last_actual"],
                breaks=breaks)
    return dict(series=series, latest={}, meta=meta)


# ------------------------------------------------------------------ BIS

def bis_check(need):
    def check(body):
        members = [m for m in F.zip_members(body) if m.lower().endswith(".csv")]
        if len(members) != 1:
            raise F.ParseError(f"expected one csv in the BIS zip, found {members}")
        head = next(F.iter_zip_csv(body, members[0], code_headers=True), None)
        if head is None or not set(need) <= set(head):
            raise F.ParseError(f"BIS csv columns changed; need {need}")
    return check


def bis_tc_data(ctx):
    """{(iso2, borrower): {'1947-Q4': value}} for the borrower/valuation pairs in BIS_TC."""
    if "bis_tc" not in ctx.memo:
        users = list(BIS_TC)
        _, when = ctx.get_raw("bis-total-credit.zip", BIS_TC_URL, users, kind="zip",
                              check=bis_check(("BORROWERS_CTY", "TC_BORROWERS", "TC_LENDERS", "VALUATION",
                                               "UNIT_TYPE", "TC_ADJUST", "TIME_PERIOD", "OBS_VALUE")))
        want = {(b, v) for b, v, _, _ in BIS_TC.values()}
        out = {}
        for r in F.iter_zip_csv(ctx.raw.path("bis-total-credit.zip"), code_headers=True):
            if r["FREQ"][:1] != "Q" or not r["OBS_VALUE"]:
                continue
            iso2 = ISO2_OF["bis"].get(F.code_of(r["BORROWERS_CTY"]))
            if (iso2 is None or F.code_of(r["TC_LENDERS"]) != "A" or F.code_of(r["UNIT_TYPE"]) != "770"
                    or F.code_of(r["TC_ADJUST"]) != "A"):
                continue
            pair = (F.code_of(r["TC_BORROWERS"]), F.code_of(r["VALUATION"]))
            if pair in want:
                out.setdefault((iso2, pair), {})[r["TIME_PERIOD"]] = F.to_float(r["OBS_VALUE"])
        if not out:
            raise F.ParseError("BIS total credit: nothing matched the selection")
        ctx.memo["bis_tc"] = (out, when)
    return ctx.memo["bis_tc"]


def bis_dsr_data(ctx):
    if "bis_dsr" not in ctx.memo:
        users = list(BIS_DSR)
        _, when = ctx.get_raw("bis-debt-service-ratios.zip", BIS_DSR_URL, users, kind="zip",
                              check=bis_check(("BORROWERS_CTY", "DSR_BORROWERS", "TIME_PERIOD", "OBS_VALUE")))
        out = {}
        for r in F.iter_zip_csv(ctx.raw.path("bis-debt-service-ratios.zip"), code_headers=True):
            if r["FREQ"][:1] != "Q" or not r["OBS_VALUE"]:
                continue
            iso2 = ISO2_OF["bis"].get(F.code_of(r["BORROWERS_CTY"]))
            if iso2 is not None:
                out.setdefault((iso2, F.code_of(r["DSR_BORROWERS"])), {})[r["TIME_PERIOD"]] = F.to_float(r["OBS_VALUE"])
        if not out:
            raise F.ParseError("BIS debt service ratios: nothing matched the selection")
        ctx.memo["bis_dsr"] = (out, when)
    return ctx.memo["bis_dsr"]


def quarterly_result(sid, picked, how, label_basis, name, url_default, when):
    series, latest = {}, {}
    for iso2, q in picked.items():
        a = quarters_to_annual(q, how)
        if a:
            series[iso2] = rows_of(a)
        last = max(q)
        latest[iso2] = [last, F.r_dp(q[last], 2)]
    asof = max(v[0] for v in latest.values()) if latest else None
    meta = dict(code=sid, source="Bank for International Settlements, " + name, url=url_default, retrieved=when,
                vintage=f"BIS bulk download retrieved {when}", basis=label_basis, breaks=[], asOf=asof)
    return dict(series=series, latest=latest, meta=meta)


def build_bis_tc(ctx, sid):
    borrower, val, _, basis = BIS_TC[sid]
    data, when = bis_tc_data(ctx)
    picked = {iso2: q for (iso2, pair), q in data.items() if pair == (borrower, val)}
    return quarterly_result(sid, picked, "last", basis, "total credit statistics (WS_TC)",
                            ctx.url("bis-total-credit.zip", BIS_TC_URL), when)


def build_bis_dsr(ctx, sid):
    borrower, _ = BIS_DSR[sid]
    data, when = bis_dsr_data(ctx)
    picked = {iso2: q for (iso2, b), q in data.items() if b == borrower}
    basis = ("BIS debt service ratio: scheduled interest and principal payments of the sector as a percent of its "
             "income. Annual value is the mean of the four quarters (complete years only); the newest quarter is under "
             "latest.")
    if borrower == "P":
        basis += " The private non-financial sector is the only split BIS has for China, and it has no euro-area row."
    return quarterly_result(sid, picked, "mean", basis, "debt service ratios (WS_DSR)",
                            ctx.url("bis-debt-service-ratios.zip", BIS_DSR_URL), when)


# ------------------------------------------------------------------ Eurostat

def parse_estat(body, unit, na_item, sector):
    """JSON-stat 2.0 -> ({geo: {year: value}}, {(geo, year): flag}, update date)."""
    d = F.read_json(body)
    try:
        ids, size, dim = d["id"], d["size"], d["dimension"]
        cats = {}
        for k in ids:
            idx = dim[k]["category"]["index"]
            cats[k] = sorted(idx, key=idx.get) if isinstance(idx, dict) else list(idx)
        values, status = d["value"], d.get("status") or {}
    except (KeyError, TypeError):
        raise F.ParseError("not a JSON-stat dataset")
    for k, want in (("unit", unit), ("na_item", na_item), ("sector", sector)):
        if want is not None and k in cats and cats[k] != [want]:
            raise F.ParseError(f"Eurostat {k} is {cats[k]}, expected {want}")
    strides, s = [], 1
    for n in reversed(size):
        strides.insert(0, s)
        s *= n

    def decode(flat):
        pos = {}
        for k, st, n in zip(ids, strides, size):
            pos[k] = (int(flat) // st) % n
        return cats["geo"][pos["geo"]], cats["time"][pos["time"]]

    out, flags = {}, {}
    for flat, v in (values.items() if isinstance(values, dict) else enumerate(values)):
        if v is None:
            continue
        geo, t = decode(flat)
        if not re.fullmatch(r"\d{4}", t):
            raise F.ParseError(f"unexpected Eurostat period {t}")
        out.setdefault(geo, {})[int(t)] = float(v)
    for flat, f in status.items():
        geo, t = decode(flat)
        flags[(geo, int(t))] = f
    if not out:
        raise F.ParseError("Eurostat response holds no values")
    return out, flags, str(d.get("updated", ""))[:10]


def estat_url(dataset, geos, **params):
    pairs = [("format", "JSON"), ("lang", "EN")] + [("geo", g) for g in geos] + list(params.items())
    return F.build_url(ESTAT_API + dataset, pairs)


EST_GEOS = ["EA20", "DE", "FR", "IT"]
ESTAT = {
    "ESTAT_GD": dict(name="estat-gov_10dd_edpt1-gd.json", dataset="gov_10dd_edpt1", unit="PC_GDP", na_item="GD",
                     sector="S13", label="Government gross debt, % of GDP (Eurostat, Maastricht)", scale=1,
                     basis="Eurostat general government consolidated gross debt (Maastricht definition, nominal "
                           "value), percent of GDP, year end, 1995 onward. The euro area is the fixed 20-country "
                           "aggregate EA20."),
    "ESTAT_INT": dict(name="estat-gov_10a_main-d41pay.json", dataset="gov_10a_main", unit="PC_GDP", na_item="D41PAY",
                      sector="S13", label="Government interest paid, % of GDP (Eurostat)", scale=1,
                      basis="Eurostat general government interest payable (ESA item D41PAY), percent of GDP, 1995 "
                            "onward. The euro area is the fixed 20-country aggregate EA20."),
}


def estat_data(ctx, key):
    if ("estat", key) not in ctx.memo:
        if key == "GDP":
            spec = dict(name="estat-nama_10_gdp-b1gq.json", dataset="nama_10_gdp", unit="CP_MEUR", na_item="B1GQ",
                        sector=None)
            url = estat_url(spec["dataset"], ["EA20"], unit=spec["unit"], na_item=spec["na_item"])
            users = ["NGDP", "NGDP_GROWTH"]
        else:
            spec = ESTAT[key]
            url = estat_url(spec["dataset"], EST_GEOS, unit=spec["unit"], sector=spec["sector"],
                            na_item=spec["na_item"])
            users = [key]
        (data, flags, updated), when = ctx.get(spec["name"], url,
                                               lambda b: parse_estat(b, spec["unit"], spec["na_item"], spec["sector"]),
                                               users, kind="json")
        ctx.memo[("estat", key)] = dict(data=data, flags=flags, updated=updated, retrieved=when,
                                        url=ctx.url(spec["name"], url))
    return ctx.memo[("estat", key)]


def build_estat(ctx, sid):
    spec = ESTAT[sid]
    info = estat_data(ctx, sid)
    series, breaks = {}, []
    for geo, s in info["data"].items():
        iso2 = ISO2_OF["eurostat"].get(geo)
        if iso2:
            series[iso2] = rows_of(s)
    for (geo, y), f in sorted(info["flags"].items()):
        iso2 = ISO2_OF["eurostat"].get(geo)
        if iso2 and "b" in f and iso2 in series and y in info["data"][geo]:
            breaks.append(dict(country=iso2, year=y, kind="flag",
                               note="Eurostat flags a break in the time series at this observation (flag b)."))
    meta = dict(code=sid, source="Eurostat, " + spec["dataset"], url=info["url"], retrieved=info["retrieved"],
                vintage=f"Eurostat dataset updated {info['updated']}" if info["updated"] else "Eurostat",
                basis=spec["basis"], breaks=breaks)
    return dict(series=series, latest={}, meta=meta)


# ------------------------------------------------------------------ nominal GDP

def parse_wb(body):
    d = F.read_json(body)
    if not (isinstance(d, list) and len(d) == 2 and isinstance(d[1], list)):
        raise F.ParseError("World Bank response is not [meta, rows]")
    meta, rows = d
    if meta.get("pages", 1) != 1 or meta.get("total", len(rows)) != len(rows):
        raise F.ParseError("World Bank response is paged; raise per_page")
    out = {}
    for r in rows:
        if r.get("value") is not None and re.fullmatch(r"\d{4}", str(r.get("date"))):
            out.setdefault(r["countryiso3code"], {})[int(r["date"])] = float(r["value"])
    if "USA" not in out:
        raise F.ParseError("World Bank GDP: no US rows")
    return out, str(meta.get("lastupdated", ""))


def parse_bea(body):
    out = {}
    for line in F.decode_text(body).splitlines():
        if line.startswith("A191RC,"):
            _, p, v = next(csv.reader([line]))
            out[int(p)] = F.to_float(v)
    if len(out) < 90 or 2000 not in out:
        raise F.ParseError("BEA NIPA file: A191RC (GDP, current dollars) not found or too short")
    return out


def gdp_inputs(ctx):
    if "gdp_in" not in ctx.memo:
        users = ["NGDP", "NGDP_GROWTH"]
        (wb, wb_updated), wb_when = ctx.get("wb-ny-gdp-mktp-cn.json", WB_URL, parse_wb, users, kind="json")
        bea, bea_when = ctx.get("bea-nipa-annual.txt", BEA_URL, parse_bea, users, kind="text", timeout=120)
        ctx.memo["gdp_in"] = dict(wb=wb, wb_updated=wb_updated, wb_when=wb_when, bea=bea, bea_when=bea_when)
    return ctx.memo["gdp_in"]


def ngdp_series(ctx):
    """{iso2: {year: billions of national currency}}."""
    if "ngdp" not in ctx.memo:
        g = gdp_inputs(ctx)
        out = {}
        for iso3, s in g["wb"].items():
            iso2 = ISO2_OF["wb"].get(iso3)
            if iso2 and iso2 != "US":
                out[iso2] = {y: v / 1e9 for y, v in s.items()}
        out["US"] = {y: v / 1e3 for y, v in g["bea"].items()}      # BEA is in millions of dollars
        ea = estat_data(ctx, "GDP")["data"].get("EA20")
        if ea:
            out["EA"] = {y: v / 1e3 for y, v in ea.items()}         # millions of euro
        ctx.memo["ngdp"] = out
    return ctx.memo["ngdp"]


def build_ngdp(ctx, sid):
    g = gdp_inputs(ctx)
    ea = estat_data(ctx, "GDP")
    levels = ngdp_series(ctx)
    parts = [
        dict(countries=["US"], source="BEA NIPA, gross domestic product, current dollars (A191RC)",
             url=ctx.url("bea-nipa-annual.txt", BEA_URL), retrieved=g["bea_when"], vintage="BEA annual NIPA file"),
        dict(countries=["GB", "JP", "DE", "FR", "IT", "CA", "CN"],
             source="World Bank WDI, GDP at current prices in local currency (NY.GDP.MKTP.CN)",
             url=ctx.url("wb-ny-gdp-mktp-cn.json", WB_URL), retrieved=g["wb_when"],
             vintage=f"World Bank WDI last updated {g['wb_updated']}"),
        dict(countries=["EA"], source="Eurostat nama_10_gdp, GDP at market prices, euro area EA20 (B1GQ)",
             url=ea["url"], retrieved=ea["retrieved"], vintage=f"Eurostat dataset updated {ea['updated']}"),
    ]
    retrieved = newest(*[p["retrieved"] for p in parts])
    unit = "billions of national currency"
    if sid == "NGDP":
        series = {iso2: rows_of(s, 2) for iso2, s in levels.items()}
        basis = ("Nominal GDP for the calendar year in billions of the national currency (US dollars, pounds, yen, "
                 "euros, Canadian dollars, yuan). Euro-area members are in euros for all years, converted at the fixed "
                 "rates. Two sources overlap for the US: BEA is used; the World Bank figure differs by about 0.3 percent "
                 "in 2024 (different vintage).")
    else:
        series = {}
        for iso2, s in levels.items():
            gr = {y: (v / s[y - 1] - 1.0) * 100.0 for y, v in s.items() if y - 1 in s and s[y - 1] > 0}
            if gr:
                series[iso2] = rows_of(gr, 2)
        basis = ("Year-on-year growth of NGDP in percent, computed from consecutive years of the same series "
                 "(sources as listed under NGDP.parts). Pair it with an effective interest rate of the same year for "
                 "r minus g.")
        unit = "% per year"
    meta = dict(code=sid, source="; ".join(p["source"] for p in parts), url=parts[0]["url"], retrieved=retrieved,
                vintage="; ".join(p["vintage"] for p in parts), basis=basis, breaks=[], unit=unit)
    if sid == "NGDP":
        meta["parts"] = parts
    return dict(series=series, latest={}, meta=meta)


# ------------------------------------------------------------------ US Treasury (Fiscal Data)

def fd_url(path, **params):
    return F.build_url(FD_API + path, list(params.items()))


def parse_hdo(body):
    rows = F.read_dicts(body)
    out, last = {}, ""
    for r in rows:
        d = r["record_date"]
        if d <= last:
            raise F.ParseError("Historical Debt Outstanding is not in date order")
        last = d
        out[int(d[:4])] = (d, F.to_float(r["debt_outstanding_amt"]))      # later date in a year wins
    if len(rows) < 200 or len(rows) >= 1000 or min(out) != 1790:
        raise F.ParseError(f"Historical Debt Outstanding: {len(rows)} rows, first year {min(out) if out else None}")
    return out


def parse_penny(body):
    d = F.read_json(body)
    rows = d.get("data") or []
    if not rows:
        raise F.ParseError("Debt to the Penny: no rows")
    r = rows[0]
    keep = {}
    for k in ("tot_pub_debt_out_amt", "debt_held_public_amt", "intragov_hold_amt"):
        keep[k] = F.to_float(r.get(k))
    if keep["tot_pub_debt_out_amt"] is None:
        raise F.ParseError("Debt to the Penny: no total")
    return dict(date=r["record_date"], **keep)


def parse_rates(body):
    rows = F.read_dicts(body)
    out = {}
    for r in rows:
        if r["security_desc"] == "Total Interest-bearing Debt":
            v = F.to_float(r["avg_interest_rate_amt"])
            if v is not None:
                out[r["record_date"][:7]] = v
    if len(rows) >= 2000 or len(out) < 200:
        raise F.ParseError(f"average interest rates: {len(rows)} rows, {len(out)} monthly totals")
    return out


def parse_mts9(body, fy):
    d = F.read_json(body)
    rows = sorted(d.get("data") or [], key=lambda r: int(r["src_line_nbr"]))
    if not rows:
        raise F.ParseError(f"MTS table 9: no rows for fiscal year {fy}")
    section, totals, prior, net, net_prior = None, {}, {}, None, None
    for r in rows:
        desc = r["classification_desc"].strip()
        cur = F.to_float(r["current_fytd_rcpt_outly_amt"])
        pri = F.to_float(r["prior_fytd_rcpt_outly_amt"])
        if desc == "Receipts":
            section = "receipts"
        elif desc == "Net Outlays":
            section = "outlays"
        elif desc == "Total" and section:
            totals[section], prior[section] = cur / 1e9, pri / 1e9
        elif desc == "Net Interest":
            net, net_prior = cur / 1e9, pri / 1e9
    if net is None or len(totals) != 2:
        raise F.ParseError("MTS table 9: Net Interest or the two totals are missing")
    return dict(netint=net, receipts=totals["receipts"], outlays=totals["outlays"], date=rows[0]["record_date"],
                prior=dict(netint=net_prior, receipts=prior["receipts"], outlays=prior["outlays"]))


def treasury_debt(ctx):
    if "hdo" not in ctx.memo:
        users = ["US_DEBT_TOTAL_USD"]
        url = fd_url("v2/accounting/od/debt_outstanding", **{"page[size]": 1000, "sort": "record_date", "format": "csv"})
        hdo, when = ctx.get("treasury-debt-outstanding.csv", url, parse_hdo, users, kind="csv")
        purl = fd_url("v2/accounting/od/debt_to_penny", **{"page[size]": 5, "sort": "-record_date", "format": "json"})
        pen, pwhen = ctx.get("treasury-debt-to-the-penny.json", purl, parse_penny, users, kind="json")
        ctx.memo["hdo"] = dict(hdo=hdo, pen=pen, when=newest(when, pwhen), hwhen=when, pwhen=pwhen,
                               url=ctx.url("treasury-debt-outstanding.csv", url),
                               purl=ctx.url("treasury-debt-to-the-penny.json", purl))
    return ctx.memo["hdo"]


def build_us_debt_total(ctx, sid):
    t = treasury_debt(ctx)
    hdo, pen = t["hdo"], t["pen"]
    series = {"US": rows_of({y: v for y, (_, v) in hdo.items()}, 0)}
    # observation date by era, read from the data
    runs = []
    for y in sorted(hdo):
        md = hdo[y][0][5:]
        era = "1 January" if md == "01-01" else "1 July" if md == "07-01" else \
            "late June" if md.startswith("06") else "late September"
        if runs and runs[-1][2] == era:
            runs[-1][1] = y
        else:
            runs.append([y, y, era])
    eras = ", ".join(f"{a}-{b} {e}" if a != b else f"{a} {e}" for a, b, e in runs)
    cmp_note = ""
    try:
        omb = omb_data(ctx)
        fy = omb["last_fy"]
        if fy in hdo and fy in omb["data"]["debt_gross_usd"]:
            cmp_note = (f" OMB gross federal debt in the Budget tables is a little lower (FY{fy}: "
                        f"{omb['data']['debt_gross_usd'][fy]:,.1f}bn against Treasury {hdo[fy][1] / 1e9:,.1f}bn), so do not "
                        "divide these dollars by the OMB percent-of-GDP series.")
    except (F.FetchError, F.ParseError):
        pass
    basis = ("Total public debt outstanding in whole US dollars, Treasury Historical Debt Outstanding, keyed by "
             "the calendar year of the record date. Record date by era: " + eras + ". Where a year has two records "
             "the later one is kept. Includes debt held by federal accounts." + cmp_note +
             " The newest daily figure is under latest.")
    latest = {"US": [t["pen"]["date"], F.r_dp(pen["tot_pub_debt_out_amt"], 0)]}
    meta = dict(code="debt_outstanding", source="US Treasury, Fiscal Data: Historical Debt Outstanding; Debt to the Penny",
                url=t["url"], retrieved=t["when"], vintage=f"Treasury Fiscal Data retrieved {t['when']}", basis=basis,
                breaks=[], asOf=pen["date"],
                parts=[dict(source="US Treasury, Fiscal Data: Historical Debt Outstanding", url=t["url"],
                            retrieved=t["hwhen"], years=f"{min(hdo)}-{max(hdo)}"),
                       dict(source="US Treasury, Fiscal Data: Debt to the Penny", url=t["purl"],
                            retrieved=t["pwhen"], years="latest")],
                latestNote=(f"Debt to the Penny on {pen['date']}: total {pen['tot_pub_debt_out_amt'] / 1e9:,.1f}bn, "
                            f"held by the public {pen['debt_held_public_amt'] / 1e9:,.1f}bn, intragovernmental "
                            f"{pen['intragov_hold_amt'] / 1e9:,.1f}bn."))
    return dict(series=series, latest=latest, meta=meta)


def build_us_avg_rate(ctx, sid):
    url = fd_url("v2/accounting/od/avg_interest_rates",
                 **{"filter": "security_desc:eq:Total Interest-bearing Debt", "page[size]": 2000,
                    "sort": "record_date", "format": "csv"})
    rates, when = ctx.get("treasury-avg-interest-rates.csv", url, parse_rates, [sid], kind="csv")
    by = {}
    for p, v in rates.items():
        by.setdefault(int(p[:4]), []).append(v)
    annual = {y: sum(v) / 12.0 for y, v in by.items() if len(v) == 12}
    last = max(rates)
    meta = dict(code="avg_interest_rates", source="US Treasury, Fiscal Data: Average Interest Rates on US Treasury Securities",
                url=ctx.url("treasury-avg-interest-rates.csv", url), retrieved=when,
                vintage=f"Treasury Fiscal Data retrieved {when}",
                basis=("Average interest rate on total interest-bearing Treasury debt (marketable and non-marketable), "
                       "percent per year, from January 2001. Annual value is the mean of the twelve month-end rates "
                       "(complete calendar years only); the newest month is under latest. The rate on marketable "
                       "securities alone is a little lower."), breaks=[], asOf=last)
    return dict(series={"US": rows_of(annual, 2)}, latest={"US": [last, F.r_dp(rates[last], 3)]}, meta=meta)


# ------------------------------------------------------------------ OMB Historical Tables

def num(x):
    return float(x) if isinstance(x, float) else None


def year_rows(rows, first=1940):
    """(row, year) for rows whose first cell is a plain four-digit year."""
    for r in rows:
        if isinstance(r[0], str) and re.fullmatch(r"\d{4}", r[0].strip()) and int(r[0]) >= first:
            yield r, int(r[0])


def parse_omb(body):
    def book(member):
        return F.read_xlsx(F.zip_read(body, member)).rows()

    out = {}
    # Table 1.1 receipts and outlays, millions of dollars
    rows = book("hist01z1.xlsx")
    if "1.1" not in str(rows[0][0]) or "Receipts" not in str(rows[3][1]) or "Outlays" not in str(rows[3][2]):
        raise F.ParseError("OMB Table 1.1 layout changed")
    out["receipts"] = {y: num(r[1]) / 1e3 for r, y in year_rows(rows) if num(r[1]) is not None}
    out["outlays"] = {y: num(r[2]) / 1e3 for r, y in year_rows(rows) if num(r[2]) is not None}
    # Table 3.1 net interest, millions of dollars and percent of GDP
    rows = book("hist03z1.xlsx")
    if "3.1" not in str(rows[0][0]):
        raise F.ParseError("OMB Table 3.1 layout changed")
    cols = {int(c): i for i, c in enumerate(rows[1]) if isinstance(c, str) and re.fullmatch(r"\d{4}", c.strip())}
    sec = None
    for r in rows[2:]:
        lab = str(r[0] or "")
        if lab.startswith("In millions of dollars"):
            sec = "usd"
        elif lab.startswith("As percentages of outlays"):
            sec = "pct_outlays"
        elif lab.startswith("As percentages of GDP"):
            sec = "pct_gdp"
        elif lab.strip() == "Net interest" and sec in ("usd", "pct_gdp") and sec not in out:
            vals = {y: num(r[i]) for y, i in cols.items() if y >= 1940 and num(r[i]) is not None}
            out[sec] = {y: v / 1e3 for y, v in vals.items()} if sec == "usd" else vals
    out["netint"] = out.pop("usd", None)
    out["netint_pct_gdp"] = out.pop("pct_gdp", None)
    if not out["netint"] or not out["netint_pct_gdp"]:
        raise F.ParseError("OMB Table 3.1: Net interest rows not found")
    # Table 7.1 federal debt, percent of GDP
    rows = book("hist07z1.xlsx")
    hdr = next((r for r in rows[:6] if sum(1 for c in r if isinstance(c, str) and c.strip().startswith("Gross")) == 2), None)
    if hdr is None:
        raise F.ParseError("OMB Table 7.1 layout changed")
    gross = [i for i, c in enumerate(hdr) if isinstance(c, str) and c.strip().startswith("Gross")]
    pub = [i for i, c in enumerate(hdr) if isinstance(c, str) and c.strip().startswith("Equals")]
    if len(pub) != 2:
        raise F.ParseError("OMB Table 7.1: held-by-public columns not found")
    out["debt_gross_usd"] = {y: num(r[gross[0]]) / 1e3 for r, y in year_rows(rows) if num(r[gross[0]]) is not None}
    out["debt_gross_pct"] = {y: num(r[gross[1]]) for r, y in year_rows(rows) if num(r[gross[1]]) is not None}
    out["debt_public_pct"] = {y: num(r[pub[1]]) for r, y in year_rows(rows) if num(r[pub[1]]) is not None}
    # Table 10.1 GDP by fiscal year, billions of dollars
    rows = book("hist10z1.xlsx")
    if "billions" not in str(rows[2][1]).lower():
        raise F.ParseError("OMB Table 10.1 layout changed")
    out["gdp"] = {y: num(r[1]) for r, y in year_rows(rows) if num(r[1]) is not None}
    for k, v in out.items():
        if not v or min(v) != 1940:
            raise F.ParseError(f"OMB {k}: expected data from FY1940, got {min(v) if v else None}")
    return out


def omb_discover(page_text):
    links = re.findall(r'href="([^"]*hist_fy(\d{4})\.zip)"', page_text)
    return max(links, key=lambda x: int(x[1]))[0] if links else None


def omb_data(ctx):
    if "omb" not in ctx.memo:
        users = ["US_DEBT_GROSS_GDP", "US_DEBT_PUBLIC_GDP", "US_NETINT_BN", "US_RECEIPTS_BN", "US_OUTLAYS_BN",
                 "US_GDP_FY_BN"]
        name = "omb-historical-tables.zip"
        raw = ctx.raw
        online = ctx.online(*users)
        url, got, err = OMB_ZIP_URL, None, None
        try:
            got = raw.get_parsed(name, url, parse_omb, online=online, kind="zip", timeout=90)
        except F.FetchError as e:
            err = e
        if online and (got is None or got.fell_back):
            # the file name moves each budget year: look for the newest zip link on the OMB page
            try:
                page = raw.download("omb-historical-tables-page.html", OMB_PAGE_URL, kind="html")
                link = omb_discover(page.decode("utf-8", "replace"))
            except F.FetchError:
                link = None
            if link and urllib.parse.urljoin(OMB_PAGE_URL, link) != OMB_ZIP_URL:
                url = urllib.parse.urljoin(OMB_PAGE_URL, link)
                raw.fell_back.discard(name)
                got = raw.get_parsed(name, url, parse_omb, online=True, kind="zip", timeout=90)
        if got is None:
            raise err
        ctx.used.add(name)
        data = got.value
        ctx.memo["omb"] = dict(data=data, when=got.retrieved, last_fy=max(data["receipts"]),
                               url=raw.url_of(name, url))
    return ctx.memo["omb"]


def mts_years(ctx, omb):
    """Complete fiscal years after the last OMB actual year, from the Monthly Treasury Statement (Table 9, 30 September)."""
    if "mts" not in ctx.memo:
        users = ["US_NETINT_BN", "US_RECEIPTS_BN", "US_OUTLAYS_BN"]
        found = {}
        for fy in range(omb["last_fy"] + 1, omb["last_fy"] + 4):
            if not ctx.raw.offline and F.TODAY < f"{fy}-10-01":
                break
            name = f"treasury-mts9-{fy}-09.json"
            url = fd_url("v1/accounting/mts/mts_table_9", **{"filter": f"record_date:eq:{fy}-09-30", "page[size]": 100})
            try:
                value, when = ctx.get(name, url, lambda b, fy=fy: parse_mts9(b, fy), users, kind="json")
            except (F.FetchError, F.ParseError):
                ctx.raw.fell_back.discard(name)
                break
            found[fy] = (value, when, ctx.url(name, url))
        ctx.memo["mts"] = found
    return ctx.memo["mts"]


def omb_series(ctx, sid):
    """(OMB-only {year: value}, MTS {fy: value} or {}, meta pieces) for the flow series that continue into the MTS."""
    omb = omb_data(ctx)
    d = omb["data"]
    key = dict(US_NETINT_BN="netint", US_RECEIPTS_BN="receipts", US_OUTLAYS_BN="outlays")[sid]
    base = dict(d[key])
    mts = mts_years(ctx, omb)
    ext = {fy: v[0][key] for fy, v in mts.items()}
    return omb, base, ext, mts


def build_us_flow(ctx, sid):
    omb, base, ext, mts = omb_series(ctx, sid)
    label = dict(US_NETINT_BN="net interest outlays", US_RECEIPTS_BN="receipts", US_OUTLAYS_BN="outlays")[sid]
    full = dict(base)
    full.update(ext)
    breaks, retrieved = [], omb["when"]
    tab = "Table 3.1" if sid == "US_NETINT_BN" else "Table 1.1"
    parts = [dict(source=f"OMB Historical Tables (FY2027 Budget), {tab}", url=omb["url"], retrieved=omb["when"],
                  years=f"1940-{omb['last_fy']}")]
    for fy in sorted(ext):
        breaks.append(dict(country="US", year=fy, kind="source",
                           note=f"FY{fy} comes from the Monthly Treasury Statement (30 September {fy}, fiscal year to "
                                "date); earlier years come from the OMB Historical Tables."))
        retrieved = newest(retrieved, mts[fy][1])
        parts.append(dict(source="US Treasury, Monthly Treasury Statement, Table 9 (fiscal year to date at 30 September)",
                          url=mts[fy][2], retrieved=mts[fy][1], years=str(fy)))
    cmp_note = ""
    if mts:
        fy0 = min(mts)
        if fy0 - 1 in base:
            key = dict(US_NETINT_BN="netint", US_RECEIPTS_BN="receipts", US_OUTLAYS_BN="outlays")[sid]
            cmp_note = (f" The two sources can differ slightly in a shared year (FY{fy0 - 1}: OMB "
                        f"{base[fy0 - 1]:,.1f}bn, the MTS prior-year column {mts[fy0][0]['prior'][key]:,.1f}bn).")
    basis = (f"Federal {label} by fiscal year (ends 30 September), billions of US dollars, keyed by the year the "
             f"fiscal year ends. OMB Historical Tables ({'Table 3.1' if sid == 'US_NETINT_BN' else 'Table 1.1'}) from "
             f"FY1940 to FY{omb['last_fy']}; the Monthly Treasury Statement (Table 9, fiscal year to date at 30 "
             "September) for later complete years." + cmp_note + " Divide by a series of the same fiscal year only.")
    if sid == "US_NETINT_BN":
        # cross-check against OMB's own percent of GDP row
        gdp = omb["data"]["gdp"]
        pct = omb["data"]["netint_pct_gdp"]
        for y, v in pct.items():
            if y in gdp and y in base:
                calc = base[y] / gdp[y] * 100.0
                if abs(calc - v) > 0.11:
                    raise F.ParseError(f"net interest {y}: {calc:.2f}% of GDP computed against OMB {v}%")
    meta = dict(code="omb_mts", source="OMB Historical Tables (FY2027 Budget); US Treasury Monthly Treasury Statement",
                url=omb["url"], retrieved=retrieved,
                vintage=f"OMB Historical Tables, actuals to FY{omb['last_fy']}; MTS to FY{max(full)}", basis=basis,
                breaks=breaks, parts=parts)
    return dict(series={"US": rows_of(full, 2)}, latest={}, meta=meta)


def build_us_omb(ctx, sid):
    omb = omb_data(ctx)
    key = dict(US_DEBT_GROSS_GDP="debt_gross_pct", US_DEBT_PUBLIC_GDP="debt_public_pct", US_GDP_FY_BN="gdp")[sid]
    basis = dict(
        US_DEBT_GROSS_GDP="Gross federal debt at the end of the fiscal year as a percent of that fiscal year's GDP, "
                          "OMB Historical Tables, Table 7.1, FY1940 to the last actual year. OMB's own ratio, one decimal.",
        US_DEBT_PUBLIC_GDP="Federal debt held by the public at the end of the fiscal year as a percent of that fiscal "
                           "year's GDP, OMB Historical Tables, Table 7.1, FY1940 to the last actual year. OMB's own "
                           "ratio, one decimal.",
        US_GDP_FY_BN="Gross domestic product for the federal fiscal year (October to September), billions of US "
                      "dollars, OMB Historical Tables, Table 10.1, FY1940 to the last actual year. Use it to scale "
                      "fiscal-year flows such as US_NETINT_BN; the calendar-year GDP is NGDP.")[sid]
    meta = dict(code=key, source="OMB Historical Tables (FY2027 Budget), " +
                dict(US_DEBT_GROSS_GDP="Table 7.1", US_DEBT_PUBLIC_GDP="Table 7.1", US_GDP_FY_BN="Table 10.1")[sid],
                url=omb["url"], retrieved=omb["when"], vintage=f"OMB Historical Tables, actuals to FY{omb['last_fy']}",
                basis=basis, breaks=[])
    return dict(series={"US": rows_of(omb["data"][key], 1 if key != "gdp" else 2)}, latest={}, meta=meta)


# ------------------------------------------------------------------ assemble

LABELS = {
    "NGDP": "Nominal GDP, billions of national currency (calendar year)",
    "NGDP_GROWTH": "Nominal GDP growth, % per year",
    "US_DEBT_TOTAL_USD": "US total public debt outstanding, US dollars (Treasury)",
    "US_DEBT_GROSS_GDP": "US gross federal debt, % of GDP (OMB, fiscal year)",
    "US_DEBT_PUBLIC_GDP": "US federal debt held by the public, % of GDP (OMB, fiscal year)",
    "US_NETINT_BN": "US net interest outlays, billions of USD (fiscal year)",
    "US_RECEIPTS_BN": "US federal receipts, billions of USD (fiscal year)",
    "US_OUTLAYS_BN": "US federal outlays, billions of USD (fiscal year)",
    "US_GDP_FY_BN": "US GDP by fiscal year, billions of USD (OMB)",
    "US_AVG_RATE": "US average interest rate on interest-bearing Treasury debt, % per year",
}
UNITS = {
    "NGDP": "billions of national currency", "NGDP_GROWTH": "% per year",
    "US_DEBT_TOTAL_USD": "US dollars", "US_DEBT_GROSS_GDP": "% of GDP", "US_DEBT_PUBLIC_GDP": "% of GDP",
    "US_NETINT_BN": "billions of USD", "US_RECEIPTS_BN": "billions of USD", "US_OUTLAYS_BN": "billions of USD",
    "US_GDP_FY_BN": "billions of USD", "US_AVG_RATE": "% per year",
    "DSR_HH": "% of income", "DSR_NFC": "% of income", "DSR_PRIV": "% of income",
}


def builder_for(sid):
    if sid in IMF_SPECS:
        return build_imf
    if sid in BIS_TC:
        return build_bis_tc
    if sid in BIS_DSR:
        return build_bis_dsr
    if sid in ESTAT:
        return build_estat
    if sid in ("NGDP", "NGDP_GROWTH"):
        return build_ngdp
    return {"US_DEBT_TOTAL_USD": build_us_debt_total, "US_AVG_RATE": build_us_avg_rate,
            "US_NETINT_BN": build_us_flow, "US_RECEIPTS_BN": build_us_flow, "US_OUTLAYS_BN": build_us_flow,
            "US_DEBT_GROSS_GDP": build_us_omb, "US_DEBT_PUBLIC_GDP": build_us_omb, "US_GDP_FY_BN": build_us_omb}[sid]


def label_of(sid):
    if sid in IMF_SPECS:
        return IMF_SPECS[sid]["label"]
    if sid in BIS_TC:
        return BIS_TC[sid][2]
    if sid in BIS_DSR:
        return BIS_DSR[sid][1]
    if sid in ESTAT:
        return ESTAT[sid]["label"]
    return LABELS[sid]


def unit_of(sid, meta):
    return meta.get("unit") or UNITS.get(sid, IMF_UNIT)


def finish(sid, res):
    """Plausibility checks and the final indicator record."""
    meta = res["meta"]
    plaus = PLAUSIBLE.get(sid, {})
    for iso2, rows in res["series"].items():
        try:
            F.check_plausible(f"{sid}/{iso2}", rows, **plaus)
        except F.ParseError as e:
            # a short series is allowed for the countries that do not have the data (China, euro area)
            if "observations, expected at least" in str(e) and iso2 in ("CN", "EA"):
                continue
            raise
    if not res["series"]:
        raise F.ParseError("no countries")
    last = max(span(r)[1] for r in res["series"].values())
    rec = dict(label=label_of(sid), unit=unit_of(sid, meta), freq="A", code=meta["code"], source=meta["source"],
               url=meta["url"], retrieved=meta["retrieved"], asOf=str(meta.get("asOf") or last),
               vintage=meta["vintage"], basis=meta["basis"])
    if "lastActual" in meta:
        rec["lastActual"] = meta["lastActual"]
    rec["breaks"] = meta["breaks"]
    for k in ("parts", "latestNote"):
        if k in meta:
            rec[k] = meta[k]
    return rec


def assemble(ctx, ids):
    for sid in ids:
        with ctx.skipped.guard(sid):
            if sid == "NGDP_GROWTH" and "NGDP" in ctx.skipped:
                raise F.ParseError("NGDP failed")
            res = builder_for(sid)(ctx, sid)
            rec = finish(sid, res)
            ctx.out[sid] = dict(series=res["series"], latest=res["latest"], meta=rec)


def make_output(ctx, generated):
    countries = {}
    present = {c for o in ctx.out.values() for c in o["series"]}
    for iso2, name, iso3, group, codes in COUNTRIES:
        if iso2 in present:
            countries[iso2] = dict(name=name, iso3=iso3, group=group,
                                   codes={k: v for k, v in codes.items() if v})
    indicators = {sid: ctx.out[sid]["meta"] for sid in ORDER if sid in ctx.out}
    series = {sid: {c: ctx.out[sid]["series"][c] for c, *_ in COUNTRIES if c in ctx.out[sid]["series"]}
              for sid in ORDER if sid in ctx.out}
    latest = {sid: {c: ctx.out[sid]["latest"][c] for c, *_ in COUNTRIES if c in ctx.out[sid]["latest"]}
              for sid in ORDER if sid in ctx.out and ctx.out[sid]["latest"]}
    cut_names = {"d": "IMF historical series", "GGXWDG_NGDP": "IMF outlook database",
                 "GG_DEBT_GDP": "IMF Global Debt Database government debt", "HH_LS": "IMF Global Debt Database household debt"}
    cut = [f"{cut_names[sid]} {ctx.out[sid]['meta']['lastActual']}" for sid in ("d", "GGXWDG_NGDP", "GG_DEBT_GDP", "HH_LS")
           if sid in ctx.out and "lastActual" in ctx.out[sid]["meta"]]
    # notes are shown to readers on the Debt page; fileNotes describe the file layout and are for people reading the data
    notes = [
        "Values are source inputs rounded to 2 decimals (OMB percent-of-GDP series keep OMB's one decimal). Ratios that "
        "need two inputs (net interest over receipts, interest over debt, r minus g) are computed in the browser from "
        "inputs of the same year; a stock is never divided by the GDP of another year.",
        "IMF values after the last actual year are removed. The IMF feed does not flag projections, so the "
        "last actual year is taken as the year before the vintage year. Last actual years: " + ", ".join(cut) + ".",
        "The IMF historical series (Public Finances in Modern History) and the IMF outlook database (World Economic "
        "Outlook) are separate compilations and are not joined; nor are the BIS credit and debt service series joined to "
        "the IMF Global Debt Database series: coverage and valuation differ. The basis of each series, in the series "
        "table, says how.",
        "The Public Finances in Modern History feed carries no coverage flags. Breaks of kind coverage are inferred "
        "from one-year steps of 10 points of GDP or more in revenue outside the war years 1914-1920 and 1939-1949 and "
        "are labelled as inference.",
        "The euro area is the aggregate each source publishes, not the sum of the member countries shown here: the IMF "
        "euro area, Eurostat EA20 (a fixed 20 members) and the BIS euro area.",
    ]
    file_notes = [
        "Annual rows are [year, value]. A row [year, null] marks the first missing year after a gap inside a series: "
        "break the line there. US_* series that follow the federal fiscal year are keyed by the year in which it ends "
        "(30 September).",
        "latest holds the newest observation at the source frequency as [period, value]: BIS quarters, Treasury "
        "months and days.",
    ]
    return dict(generated=generated, notes=notes, fileNotes=file_notes, countries=countries, indicators=indicators,
                series=series, latest=latest)


def verify(obj):
    """Light check of what was just built."""
    for sid, per in obj["series"].items():
        for c, rows in per.items():
            ys = [r[0] for r in rows]
            if any(a >= b for a, b in zip(ys, ys[1:])) or any(not isinstance(y, int) for y in ys):
                raise F.ParseError(f"{sid}/{c}: years are not strictly increasing integers")
            if rows[-1][1] is None or rows[0][1] is None:
                raise F.ParseError(f"{sid}/{c}: a gap marker at the end of the series")
    for sid, rec in obj["indicators"].items():
        for k in ("label", "unit", "source", "url", "retrieved", "asOf", "vintage", "basis"):
            if not rec.get(k):
                raise F.ParseError(f"{sid}: {k} is empty")


# ------------------------------------------------------------------ report

def report(ctx):
    rows = []
    for sid in ORDER:
        if sid not in ctx.out:
            continue
        o = ctx.out[sid]
        for iso2 in [c[0] for c in COUNTRIES if c[0] in o["series"]]:
            r = o["series"][iso2]
            a, b = span(r)
            pts = real_points(r)
            rows.append((sid, iso2, f"{len(pts)}", f"{a}", f"{b}", f"{pts[-1][1]:g}"))
    F.print_table(("id", "ctry", "pts", "first", "last", "last value"), rows, left=2)
    ctx.skipped.report()


def sanity(ctx):
    """Print the latest values the brief quotes, for the overseer to compare."""
    print()
    print("sanity checks against the research brief")

    def last(sid, iso2):
        s = ctx.out.get(sid, {}).get("series", {}).get(iso2)
        pts = real_points(s) if s else []
        return pts[-1] if pts else None

    ni, rc, ol = last("US_NETINT_BN", "US"), last("US_RECEIPTS_BN", "US"), last("US_OUTLAYS_BN", "US")
    if ni and rc and ol and ni[0] == rc[0] == ol[0]:
        print(f"  US FY{ni[0]} net interest {ni[1]:,.1f}bn = {ni[1] / rc[1] * 100:.1f}% of receipts "
              f"({rc[1]:,.1f}bn) = {ni[1] / ol[1] * 100:.1f}% of outlays ({ol[1]:,.1f}bn)")
    lat = ctx.out.get("US_DEBT_TOTAL_USD", {}).get("latest", {}).get("US")
    if lat:
        print(f"  US total public debt {lat[1] / 1e9:,.1f}bn on {lat[0]} ({ctx.out['US_DEBT_TOTAL_USD']['meta'].get('latestNote', '')})")
    for sid in ("GGXWDG_NGDP",):
        if sid in ctx.out:
            vals = {c: last(sid, c) for c in ("US", "GB", "JP", "DE", "FR", "IT", "CA", "CN", "EA")}
            print("  WEO gross government debt, % of GDP, latest actual: " +
                  ", ".join(f"{c} {v[1]:g} ({v[0]})" for c, v in vals.items() if v))
    for sid in ("TC_HH", "TC_NFC", "TC_GG", "DSR_HH"):
        lat = ctx.out.get(sid, {}).get("latest", {}).get("US")
        if lat:
            print(f"  BIS {sid} US latest {lat[1]:g} ({lat[0]})")
    lat = ctx.out.get("US_AVG_RATE", {}).get("latest", {}).get("US")
    if lat:
        print(f"  US average interest rate on interest-bearing debt {lat[1]:g}% ({lat[0]})")
    steps = ctx.memo.get("steps")
    if steps:
        print("  coverage steps inferred from revenue: " + "; ".join(f"{c} {y} ({a:.1f} to {b:.1f})" for c, y, a, b in steps))


def lost_series(obj):
    """Series in the current data/debt.js that the new build would drop (country by indicator)."""
    if not OUT.exists():
        return []
    try:
        _, old = F.read_js_global(OUT)
    except (F.ParseError, ValueError):
        return []
    return [f"{sid}/{c}" for sid, per in old.get("series", {}).items() for c in per
            if c not in obj["series"].get(sid, {})]


def main():
    ap = F.make_parser(__doc__)
    ap.add_argument("--allow-partial", action="store_true",
                    help="write the file even if it would drop a series that the current file has")
    args = ap.parse_args()
    only = F.parse_only(ap, args, ORDER)
    raw = F.Raw(PIPELINE, offline=args.offline, contact=args.contact)
    ctx = Ctx(raw, only)
    assemble(ctx, ORDER)
    raw.save_manifest()   # the cache files are replaced by now: record them even if a later step raises
    report(ctx)
    sanity(ctx)

    core_missing = [s for s in CORE if s not in ctx.out]
    if core_missing:
        print("error: core indicators failed, output not written: " + ", ".join(core_missing), file=sys.stderr)
        return 1
    generated = raw.newest_retrieved(sorted(ctx.used)) or F.TODAY
    obj = make_output(ctx, generated)
    verify(obj)
    lost = lost_series(obj)
    if lost and not args.allow_partial:
        print("error: the build would drop series the current file has, output not written (use --allow-partial "
              "to accept): " + ", ".join(lost[:12]) + (" ..." if len(lost) > 12 else ""), file=sys.stderr)
        return 1
    res = F.write_js(OUT, "MACRO_DEBT", obj, generator=GENERATOR, generated=generated, max_bytes=BUDGET)
    print()
    print(f"{'wrote' if res['changed'] else 'unchanged'} {OUT} ({res['bytes'] // 1024} KB, "
          f"{len(obj['indicators'])} indicators, {len(raw.fell_back)} read from cache after a failed download)")
    F.remind_stamp(res["changed"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
