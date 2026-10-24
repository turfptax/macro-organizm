# Money supply data pipeline

`fetch_money_supply.py` downloads central bank and public statistics, normalises
them and writes `data/money-supply.js` (`window.MONEY_SUPPLY`), which the
"Money Over Time" page loads with a plain `<script src>` tag. Every raw download
is cached in `data/raw/`, so the file can be rebuilt offline.

Python 3.12, standard library only. No installs.

## Refresh

From the project root (`G:\dev\dg\Macro Organizm`):

```powershell
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_money_supply.py
```

| Flag | Effect |
| --- | --- |
| (none) | Download everything, cache it in `data/raw/`, rebuild `data/money-supply.js`. About 35 seconds. |
| `--offline` | No network. Rebuild from `data/raw/` only. The result matches the file the cache was downloaded for: `retrieved`, `url`, `source` and `notes` come from the manifest, and `generated` is the date of the newest download, so a rebuild in a later month changes nothing. |
| `--only us_m2,ea_m3` | Refresh only these series from the network. All other series are rebuilt from the cache the same way. Exchange rates are always refreshed. |

A series says "cached" in `source` (US) or `notes` only when its download was tried and failed, so the cache
stood in for it. A cache read you asked for (`--offline`, or a series left out of `--only`) adds no wording.

The script prints one line per series (route used, points, first and last
period, latest value in local and USD billions) and a line for every skipped
series with the reason. It exits non-zero only when the US core series
(`us_base`, `us_m1`, `us_m2`) and every other economy all failed; in that case
the output file is left untouched. A bad `--only` id exits with code 2.

Serve the project with `python -m http.server 3457` (launch config
`macro-static`) or open the page from `file://`; the data file is a script
assignment, so both work.

Run the US M2 refresh in full each time. The Fed restated all of H.6 on
28 Jul 2026, so never append new months to an old download.

## Output shape

```js
window.MONEY_SUPPLY = {
  generated, notes[], definitions[],        // definitions: M0, M1, M2, M3, M4, M5, MZM, L, Divisia
  economies: { us|ea|uk|jp|cn: { name, currency, headline, order[] } },
  series: { <id>: { economy, aggregate, label, rank, kind, frequency, unit, source, url, retrieved,
                    notes, breaks[], discontinued, continues,
                    data: [[period, localBn, usdBn, officialYoyPct?], ...] } }
};
```

- `generated` is the date of the newest download in the file.
- Values are billions of local currency; the third column is billions of USD at
  month-end exchange rates (see FX below). Divisia has `unit: "index"` and a null USD column.
- The optional 4th column is the source's own year-on-year growth in percent, present on
  `ea_*` and `cn_*` (null where the source has none). The page prefers it to a ratio of
  levels: the euro-area levels are changing-composition stocks, so a ratio includes
  membership and reclassification steps (Greece in Jan 2001, M1 in mid-2005, M3 in mid-2010,
  Bulgaria in Jan 2026), and China M2 steps up 3.7% in Oct 2011 when the PBoC widened its
  scope. The published rates are flow based or on a comparable basis and do not have the steps.
  For `cn_m1` the rate is left null for the 12 months from the Jan 2024 redefinition (the
  source rate for 2024 is still on the old definition). Series without a 4th column fall back
  to a ratio of levels, which is blank across a `redefinition` or `scope` break.
- Periods are `YYYY-MM` (monthly) or `YYYY` (annual). `frequency` is `M` or `A`
  (`Q` is reserved and not used by any series today).
- Level values are rounded to 6 significant figures (4 gave year-on-year noise of up to 0.14
  points). The official growth column is kept to 3 decimals.
- `kind` is `official`, `historical` or `index`. `rank` orders the ladder:
  0 base/M0/currency, 1 M1, 2 M2, 3 M3, 4 M4/L/Divisia.
- `order` lists the default ladder of each economy (official series only).
  Historical series are found with `kind: "historical"` and `continues`; the
  Divisia index and the IMF/World Bank broad money are found by `economy`.
- A data row with null values is a line break. At each `redefinition` break the
  generator inserts `[period, null, null]` immediately before the first
  post-break observation, carrying that observation's period. Readouts and
  crosshair snapping must skip null rows. Do not compute 12-month growth across
  a redefinition break (the next 12 months are not comparable).
- Historical series are trimmed to end where the series they `continue` starts,
  are never rescaled, and carry an overlap ratio in `notes`.

## Series and sources

| Series ids | Source | URL pattern | Licence / attribution note |
| --- | --- | --- | --- |
| `us_base`, `us_currency`, `us_m1`, `us_m2`, `us_m3` | Federal Reserve Board, H.6 Money Stock Measures. Same series as FRED BOGMBASE, MBCURRCIR, M1SL, M2SL, M3SL | See "US route" below | US Board of Governors publication; cite "Board of Governors of the Federal Reserve System, H.6". FRED copies: cite FRED, Federal Reserve Bank of St. Louis. |
| `us_m1_hist` | NBER Macrohistory Database ch. 14, files `m14174a` and `m14174c` (Friedman and Schwartz M1) | `https://data.nber.org/databases/macrohistory/rectdata/14/<file>.dat` | NBER marks the data as copyrighted; cite NBER. |
| `us_m2_hist` | NBER `m14175a` and `m14175b` (all-bank broad aggregate). Backup if those fail: `m14144a` and `m14144c` (commercial-bank M2) | same | same |
| `us_divisia_m4` | Center for Financial Stability, Divisia monetary aggregates (Barnett, AMFM), sheet `Broad`, column DM4 | `https://centerforfinancialstability.org/amfm/Divisia.xlsx` | Cite CFS and the AMFM project; terms of reuse not checked. Parsed with `zipfile` and `xml.etree`. |
| `us_broad_wb`, `cn_broad_wb` | World Bank WDI `FM.LBL.BMNY.CN` (broad money, current LCU, year end; underlying IMF IFS) | `https://api.worldbank.org/v2/country/<USA\|CHN>/indicator/FM.LBL.BMNY.CN?format=json&per_page=300` | World Bank Open Data, CC BY 4.0. Cite "World Bank, WDI; IMF". Never labelled M3. |
| `ea_currency`, `ea_m1`, `ea_m2`, `ea_m3` | ECB Data Portal, BSI dataset, items L10, M10, M20, M30, euro area changing composition, working-day and seasonally adjusted. Levels from the stock series; the 4th data column from the annual growth rate of the index of notional stocks (`.I.` and `.A`, from 1981-01), cached as `ecb_bsi_<name>_yoy.csv` | `https://data-api.ecb.europa.eu/service/data/BSI/M.U2.Y.V.<item>.X.1.U2.2300.Z01.E?format=csvdata` (levels), `.../BSI/M.U2.Y.V.<item>.X.I.U2.2300.Z01.A?format=csvdata` (growth) | ECB statistics may be reused with the source acknowledged. |
| `uk_notes_coin`, `uk_reserves`, `uk_m0_old`, `uk_m4`, `uk_m4ex` | Bank of England IADB series LPMAVAA, LPMBL22, LPMVUBN, LPMVUBR (break-adjusted M4), RPMB53Q (M4ex) | `https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes&Datefrom=01/Jan/1963&Dateto=now&SeriesCodes=<code>&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N` | Cite "Source: Bank of England". Check the Bank's copyright terms before redistributing the raw files. Needs a browser-like User-Agent. |
| `jp_base`, `jp_m1`, `jp_m2`, `jp_m3`, `jp_l`, `jp_m1_old`, `jp_m2cd_old` | Bank of Japan Time-Series Data Search API, MD01 (MABS1AN11) and MD02 (MAM1NAM3M1MO, MAM1NAM2M2MO, MAM1NAM3M3MO, MAM1NABLBLMO, MAMS1EN01, MAMS1ENM2C) | `https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=csv&lang=en&db=<db>&startDate=<yyyymm>&endDate=<yyyymm>&code=<code>` | Cite the Bank of Japan and say the data were processed; check the Time-Series Data Search terms. Units are 100 million yen. |
| `cn_m0`, `cn_m1`, `cn_m2` | EastMoney data centre report `RPT_ECONOMY_CURRENCY_SUPPLY` (mirror of PBoC money supply; BASIC_CURRENCY = M2, CURRENCY = M1, FREE_CASH = M0), units 100 million yuan. The 4th data column is the published same-basis growth: `BASIC_CURRENCY_SAME`, `CURRENCY_SAME`, `FREE_CASH_SAME` (0.1 point precision) | `https://datacenter-web.eastmoney.com/api/data/v1/get?...reportName=RPT_ECONOMY_CURRENCY_SUPPLY` | Unofficial commercial mirror with no stated licence; it can change without notice. The audit matched it to the PBoC table for all 11 months of 2025. Prefer pbc.gov.cn for anything published. |
| FX | ECB EXR (`M.USD.EUR.SP00.E`, `M.CNY.EUR.SP00.E`), BoE `XUMLUSS`, BoJ FM08 `FXERM06`, World Bank `PA.NUS.FCRF` (annual average, fallback) | see script constants | As for each provider above. |

## US route and the FRED note

`fred.stlouisfed.org` is unreliable from this machine. It timed out or reset
during the audit, answered once in a later test, and timed out again after that.
The generator therefore tries these routes in order for each US series and
records the one that worked in `source`:

1. FRED `fredgraph.csv?id=<ID>` (8 second timeout, one attempt; if it fails with a
   network error FRED is skipped for the rest of the run).
2. FRED API (`api.stlouisfed.org`, which does answer) when `FRED_API_KEY` is set.
3. Federal Reserve Data Download Program, H.6 release: the CSV packages
   "M1, M2 and other Release Data, Monthly" (series package `798e2796917702a5f8423426ba7e6b42`:
   M1, M2, currency and monetary base) and "H.6 M3 Discontinued Money Measure"
   (`919a61e16f2d825937ec1740e6fed1f6`). URL:
   `https://www.federalreserve.gov/datadownload/Output.aspx?rel=H6&series=<package>&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package`.
   Columns used: `H6/H6_M1/M1.M`, `H6/H6_M2/M2.M`, `H6/H6_MBASE/RESMO14A_N.M`
   (BOGMBASE), `H6/H6_MBASE/RESMOC14A_N.M` (MBCURRCIR), `H6/H6M3_DISCONTINUED/H0.M3.M`.
   If a package id stops working the script scrapes
   `https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H6` for the link by its label.
   This is the route used on the 2026-10-22 run; it matched FRED value for value.
4. DBnomics mirror of the same Fed data: `https://api.db.nomics.world/v22/series/FED/<dataset>/<series>?observations=1`
   (for example `FED/H6_H6_M2/M2.M`, `FED/H6_H6M3_DISCONTINUED/H0.M3.M`).
5. The newest parseable cached copy in `data/raw/` (`fred_<ID>.csv`, `fred_api_<ID>.json`,
   the DDP package csv, or the DBnomics json).

A route is accepted only if the latest value falls in a plausible range, which
also catches FRED serving millions instead of billions (it is rescaled by 1/1000
when that makes the value plausible). A bad response never replaces a good cache.

To seed the cache by hand (for example from a browser that can reach FRED), save
`https://fred.stlouisfed.org/graph/fredgraph.csv?id=<ID>` as `data/raw/fred_<ID>.csv`
for BOGMBASE, MBCURRCIR, M1SL, M2SL and M3SL, then run with `--offline`.

### FRED_API_KEY

A free key is available at https://fred.stlouisfed.org/docs/api/api_key.html. The
script reads it from the environment only; it is never written to disk (the
manifest stores the URL with `api_key=REDACTED`).

```powershell
$env:FRED_API_KEY = "your-32-character-key"
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_money_supply.py
```

```bash
FRED_API_KEY=your-32-character-key python tools/fetch_money_supply.py
```

## Breaks and discontinuations

| Series | When | Kind | What happened | Encoding |
| --- | --- | --- | --- | --- |
| `us_m1` | 2020-05 | redefinition | Fed moved savings deposits into M1 (Regulation D change). Apr 2020 4,856.4 to May 2020 16,312.5 (3.36x). Not back-revised. | null row; line must split |
| `cn_m1` | 2024-01 | redefinition | PBoC restated M1 (personal demand deposits and payment-institution reserves added), only back to Jan 2024. Dec 2023 680,543 to Jan 2024 1,120,120 (100m yuan, 1.65x). | null row; line must split |
| `us_m3` | ends 2006-02 | discontinuation | Fed stopped publishing M3 (last release 23 Mar 2006, data to Feb 2006). | `discontinued: "2006-02"` |
| `uk_m0_old` | ends 2006-04 | discontinuation | Bank of England stopped M0; notes and coin and reserve balances (from May 2006) replace it. | `discontinued: "2006-04"` |
| `jp_m2cd_old`, `jp_m1_old` | ends 1999-03 | discontinuation | Old M2+CDs and M1 end; the current M1/M2/M3/L start Apr 2003 on new definitions. There is a gap, not a join. | `discontinued: "1999-03"` |
| `ea_*` | 2001-01 | composition | Greece joined; the changing-composition levels step up about 3% (M3 and M1). Other steps from enlargements and reclassifications (M1 mid-2005, M3 mid-2010, Bulgaria in Jan 2026) are in the levels and not marked. Year-on-year growth uses the ECB's own rates (4th data column), which remove all of them. The sharp currency growth around the 2002 cash changeover (about -32% in Dec 2001, +43% in Dec 2002) is real and is in the ECB's own rates. | break entry only, no split |
| `cn_m2` | 2011-10 | scope | PBoC widened the scope of M2: the level steps up 3.7% in one month. Year-on-year growth uses the published same-basis rate (4th data column). | break entry only, no split; the level-ratio fallback is blank for 12 months |
| `us_m2` | 28 Jul 2026 | restatement | H.6 netted IRA and Keogh balances separately and restated all history. No break in the series. | note only |
| `uk_m4` | Jan 2010, Sep 2011 | reporting | Bank-documented reporting breaks; the series used is the break-adjusted level LPMVUBR. | note only |
| `us_m1_hist` | joins 1959-01 | definition | NBER M1 against Fed M1 in Jan 1959: ratio 0.98 | trimmed, not rescaled |
| `us_m2_hist` | joins 1959-01 | definition | NBER all-bank broad aggregate is narrower than Fed M2: ratio 1.18 | trimmed, not rescaled |
| `cn_broad_wb` | joins 2008 | none | World Bank China broad money equals PBoC M2 (ratio 1.00 in Dec 2008) | trimmed |

Other known discontinuations that are not charted: St. Louis Fed adjusted
monetary base (after Nov 2019), MZM (after Jan 2021), St. Louis MSI (Dec 2013).
M5 is not an official aggregate at the Fed, ECB, BoE, BoJ or PBoC and is not
charted; the IMF's `MFS_MA` dataset has a generic "Broad Money, M5" slot for
about 130 economies.

## Exchange rates

Stocks are converted at end-of-period (month-end) rates, whatever the series
measures (Fed and BoJ figures are monthly averages of daily levels; ECB, BoE and
PBoC figures are month-end stocks). Annual series use the December rate.

| Currency | Month-end source | From | Fallback |
| --- | --- | --- | --- |
| EUR | ECB reference rate, USD per EUR | 1999-01 | none (USD column is null before 1999) |
| GBP | Bank of England `XUMLUSS` | 1975-01 | World Bank annual average (1960 on) |
| JPY | Bank of Japan Tokyo 17:00 end of month, yen per USD inverted | 1973-01 | World Bank annual average (1960 on); null before 1960 |
| CNY | ECB CNY and USD reference rates crossed | 2000-01 | World Bank annual average (1960 on) |

Where the fallback is used the series `notes` say so. Growth rates should be
computed from the local column; USD levels mix real growth with currency moves.

## Seasonal adjustment

The ladder mixes adjusted and unadjusted series. US M1, M2 and M3 and the ECB series are
seasonally adjusted. `us_base` and `us_currency` (their notes say so), the old Japanese
`jp_m1_old` and `jp_m2cd_old`, and `cn_m0`, `cn_m1`, `cn_m2` are not. The unadjusted ones show a
year-end sawtooth in the Level view: old Japanese M1 is usually 5 to 14% higher in December than
in November and drops 3 to 11% in January (M2+CDs: 2 to 8% and 1 to 3%), and China M0 jumps before
the Lunar New Year (January 2011 was 30% above December 2010). Year-on-year views compare the same
month and are not affected. Each of these series says so in its `notes`.

## Raw cache

`data/raw/` holds one file per download, named by source and series
(`fred_M2SL.csv`, `fed_ddp_h6_monthly.csv`, `ecb_bsi_m3.csv`, `boe_LPMVUBR.csv`,
`boj_MAM1NAM3M3MO.csv`, `nber_m14174a.dat`, `cfs_divisia.xlsx`,
`eastmoney_cn_money_supply.json`, `wb_FM.LBL.BMNY.CN_CHN.json`, ...) plus
`manifest.json` (url, retrieval date, size). The files are stored byte for byte
as received. The UK Millennium of Macroeconomic Data workbook (27 MB) is not
used and is not cached.

## Not built

- Euro-area derived base money (banknotes plus liabilities to credit institutions
  from the ECB ILM dataset): optional, weekly, no official headline.
- IMF quarterly US broad money (`IMF.STA,MFS_MA,10.0.1`, needs the header
  `Accept: application/vnd.sdmx.data+csv`): duplicates the World Bank annual series.
- US Divisia M3, M2 and the other CFS aggregates, MZM, the St. Louis adjusted base.
- Quarterly series (none needed).

## Adding a series

Add an `S(...)` entry to `SPECS` in the script (id, economy, aggregate, label,
rank, kind, loader, plausible latest-value range, note, loader arguments), add
its id to `LADDER` if it belongs on the default ladder, then run the script.
The plausible range is the guard against unit changes at the source; keep it wide.
