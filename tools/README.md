# Tools: data pipelines and checks

Everything here runs from the project root (`G:\dev\dg\Macro Organizm`). The fetchers are Python 3.12 with the standard library only; the checks are Node scripts with no packages. No installs.

| Tool | What it does |
| --- | --- |
| `fetch_money_supply.py` | Builds `data/money-supply.js` (`window.MONEY_SUPPLY`) for Money Over Time and Money Flow. |
| `fetch_debt.py` | Builds `data/debt.js` (`window.MACRO_DEBT`) for Debt and Start. |
| `fetch_prices.py` | Builds `data/prices.js` (`window.MACRO_PRICES`) for Prices and Start. |
| `fetchlib.py` | Shared helpers for the last two: raw cache with manifest and offline mode, xlsx and zip readers, ASCII and em dash guard, plausible-range checks. |
| `check-data.js` | Lints `data/debt.js`, `data/prices.js`, `data/prices-curated.js` and `data/principles.js`. |
| `check-graph-data.js` | Lints `data/world-powers.js` and `data/power-structure.js`. |
| `check-site.js` | Lints the seven pages: same navigation, one cache stamp, local links, page contract. |
| `stamp.js` | Writes or checks the cache stamp (`?v=...`) on every local asset URL. |
| `test-derive.js` | Tests `assets/derive.js`, the arithmetic behind every computed number. |

Contents, in order: money supply (the original pipeline), what the debt and prices fetchers share, debt, prices, the curated data files, sources deliberately not used, the checks, and the order of work after a data change.

## Money supply: fetch_money_supply.py

`fetch_money_supply.py` downloads central bank and public statistics, normalises
them and writes `data/money-supply.js` (`window.MONEY_SUPPLY`), which the
Money Over Time and Money Flow pages load with a plain `<script src>` tag. Every
raw download is cached in `data/raw/`, so the file can be rebuilt offline.

Python 3.12, standard library only. No installs.

### Refresh

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

### Output shape

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

### Series and sources

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

### US route and the FRED note

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

#### FRED_API_KEY

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

### Breaks and discontinuations

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

### Exchange rates

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

### Seasonal adjustment

The ladder mixes adjusted and unadjusted series. US M1, M2 and M3 and the ECB series are
seasonally adjusted. `us_base` and `us_currency` (their notes say so), the old Japanese
`jp_m1_old` and `jp_m2cd_old`, and `cn_m0`, `cn_m1`, `cn_m2` are not. The unadjusted ones show a
year-end sawtooth in the Level view: old Japanese M1 is usually 5 to 14% higher in December than
in November and drops 3 to 11% in January (M2+CDs: 2 to 8% and 1 to 3%), and China M0 jumps before
the Lunar New Year (January 2011 was 30% above December 2010). Year-on-year views compare the same
month and are not affected. Each of these series says so in its `notes`.

### Raw cache

`data/raw/` holds one file per download, named by source and series
(`fred_M2SL.csv`, `fed_ddp_h6_monthly.csv`, `ecb_bsi_m3.csv`, `boe_LPMVUBR.csv`,
`boj_MAM1NAM3M3MO.csv`, `nber_m14174a.dat`, `cfs_divisia.xlsx`,
`eastmoney_cn_money_supply.json`, `wb_FM.LBL.BMNY.CN_CHN.json`, ...) plus
`manifest.json` (url, retrieval date, size). The files are stored byte for byte
as received. The UK Millennium of Macroeconomic Data workbook (27 MB) is not
used and is not cached. The debt and prices fetchers keep separate caches in
`data/raw/debt/` and `data/raw/prices/`, each with its own `manifest.json`; this
script neither reads nor writes them.

### Not built

- Euro-area derived base money (banknotes plus liabilities to credit institutions
  from the ECB ILM dataset): optional, weekly, no official headline.
- IMF quarterly US broad money (`IMF.STA,MFS_MA,10.0.1`, needs the header
  `Accept: application/vnd.sdmx.data+csv`): duplicates the World Bank annual series.
- US Divisia M3, M2 and the other CFS aggregates, MZM, the St. Louis adjusted base.
- Quarterly series (none needed).

### Adding a series

Add an `S(...)` entry to `SPECS` in the script (id, economy, aggregate, label,
rank, kind, loader, plausible latest-value range, note, loader arguments), add
its id to `LADDER` if it belongs on the default ladder, then run the script.
The plausible range is the guard against unit changes at the source; keep it wide.

## Debt and prices fetchers: shared behaviour

`fetch_debt.py` and `fetch_prices.py` are built on `fetchlib.py`. Run them as plain scripts (`python tools\fetch_debt.py`), not with `python -I`, because they import `fetchlib` from this folder.

### Flags

| Flag | Effect |
| --- | --- |
| (none) | Download every source, keep each raw file in the pipeline's cache folder and rebuild the data file. |
| `--offline` | No network. Rebuild from the cache only. The result is byte for byte the file the cache was downloaded for: `retrieved` and `url` come from the manifest, and the file's `generated` date is the date of the newest download it uses, so a rebuild in a later month changes nothing. |
| `--only id,id` | Download only these ids (indicator ids for debt, series ids for prices); every other id is rebuilt from the cache. An unknown id is refused: debt exits with code 2, prices exits with code 1 and a message. In prices, `price_soda_proxy_12oz` also refreshes its three BLS pieces. |
| `--contact EMAIL` | Contact address for the User-Agent of sources that require one (or set `MACRO_FETCH_CONTACT`). Only the BLS files need it, so only prices uses it; debt accepts the flag and ignores it. |
| `--allow-partial` | Write the file even if it would drop a series that the current file has (a country or indicator for Debt, a series id for Prices). |
| `--selftest` | Prices only: offline checks of the parsers. `python tools\fetchlib.py --selftest` does the same for the shared library, with a local test server and no internet. |

### Raw cache

- Each pipeline has its own folder, `data/raw/debt/` and `data/raw/prices/`, with its own `manifest.json` that records the public URL, retrieval date, size in bytes and sha256 of every file. Files are kept byte for byte as received. The one exception is `nass_farmland_extract.csv` (prices), a small extract the fetcher writes itself.
- `data/raw/` is not committed (`.gitignore`), because several sources do not grant redistribution of their raw files. A fresh clone has no cache: run the fetcher without `--offline` first.
- A response replaces its cache file only after it has the expected shape and the series parser accepts it. A block page, a truncated file or a changed layout never overwrites a good copy; the cached copy is used instead and the run says so.
- Two attempts per download, with a pause between them (the server's Retry-After when it sends one). Hosts disagree about the User-Agent: the IMF answers 403 to a `Mozilla/5.0` agent but accepts urllib's own, while the Fed, BLS and others refuse urllib's. The library tries the agent a source prefers and, on a 401, 403 or 406, the other one.
- FRED times out from this machine (see "US route and the FRED note" above), so these two fetchers use primary providers only.

### Guard rails

- Every indicator or series has a plausible-range guard (range of the latest value, range of every value, minimum number of points, newest period not older than a limit, largest jump between neighbours). A unit change or a truncated feed stops that series instead of reaching the file.
- Core series must all build or nothing is written (exit 1). Core debt indicators: `d`, `ie`, `rev`, `GGXWDG_NGDP`, `TC_HH`, `TC_NFC`, `TC_GG`, `NGDP`, `NGDP_GROWTH`, `US_DEBT_TOTAL_USD`, `US_NETINT_BN`, `US_RECEIPTS_BN`, `US_AVG_RATE`. Core price series: `cpi_u`, `pay_prod`, `house_new_median`, `price_bread`, `price_eggs`.
- Any other failure skips that series and the run reports it with the reason. Prices skips the series and still writes the file, exiting with code 3, but only if no series of the current file would be lost (a transient failure with no cache would otherwise delete one silently). Both fetchers refuse to write a file that would lose something the current file has (exit 1) unless `--allow-partial` is given. A download that is less than half the size of its cached file is rejected even when it parses, so a truncated body cannot replace a good cache.
- Exit codes: debt 0, 1 (a core indicator failed, or the build would drop a series), 2 (unknown `--only` id); prices 0, 1 (a core series failed, or unknown `--only` id), 3 (some optional series skipped, file written).

### Output files

- One `window.<NAME>` global per file, ASCII only, no em dash (the writer refuses to write otherwise), a budget of 400,000 bytes (the writer refuses to write above it), and a stable layout so a regenerated file diffs cleanly. The file is written only when its bytes change; otherwise the run says "unchanged".
- Rows are `[period, value]`. A null value marks a gap: there is no observation at that period. A run of missing periods is marked once, at its first period. Nothing is interpolated.
- Nothing is spliced across a change of product, definition or source. The pieces are separate ids, and each series says in `notes` or `basis` why it must not be joined to its neighbour.
- Ratios that need two inputs are not stored (net interest over receipts, interest over debt, r minus g, house price over pay). The browser computes them with `assets/derive.js` from inputs of the same period.
- When a data file changes, the fetcher prints a reminder to bump the cache stamp (`node tools/stamp.js`).

## Debt: fetch_debt.py

Builds `data/debt.js` (`window.MACRO_DEBT`): government debt, interest and revenue, credit to households, companies and government, debt service ratios, nominal GDP and the US federal accounts, for the US, UK, Japan, Germany, France, Italy, Canada, China and the euro area (28 indicators).

```powershell
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_debt.py
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_debt.py --offline
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_debt.py --only d,TC_HH
```

The run prints a table (indicator, economy, points, first and last year, last value), lists every skipped indicator with its reason, prints a few latest values for a person to compare with the published figures (US net interest and its share of receipts, total public debt, the WEO debt ratios, the latest BIS readings), and ends with "wrote" or "unchanged". Flags, cache and guard rails are described above.

### Output shape

```js
window.MACRO_DEBT = {
  generated, notes[],                       // notes: shown to readers on the Debt page
  fileNotes[],                              // how the rows are laid out; for people reading the file
  countries:  { US|GB|JP|DE|FR|IT|CA|CN|EA: { name, iso3, group, codes{} } },
  indicators: { <id>: { label, unit, freq, code, source, url, retrieved, asOf, vintage, basis,
                        lastActual?, breaks[], parts?, latestNote? } },
  series:     { <id>: { <iso2>: [[year, value], ...] } },
  latest:     { <id>: { <iso2>: [period, value] } }
};
```

- Annual rows are `[year, value]`. A row `[year, null]` marks the first missing year after a gap inside a series: break the line there. US series that follow the federal fiscal year (the OMB and Monthly Treasury Statement ones) are keyed by the year in which it ends (30 September).
- Values are source inputs rounded to 2 decimals (the OMB percent-of-GDP series keep OMB's one decimal).
- `latest` holds the newest observation at the source frequency as `[period, value]`: BIS quarters, Treasury months and days.
- `basis` says exactly what the series is and what was done to it; `vintage` names the release (for example the IMF database and month); `lastActual` is the last year that is an actual and not a projection. `parts` lists the sources joined inside one US series.
- The euro area (`EA`) is the aggregate each source publishes, not the sum of the member rows: IMF `EURO`, Eurostat `EA20` (a fixed 20-country aggregate), BIS `XM`.

### Indicators

Spans are those of the 2026-10-24 build.

| Id | Measure | Unit | Source | Span |
| --- | --- | --- | --- | --- |
| `d` | Gross public debt, long run | % of GDP | IMF Public Finances in Modern History | 1800 (UK) to 2024 |
| `ie` | Interest paid on public debt | % of GDP | same | 1800 to 2024 |
| `rev` | Government revenue | % of GDP | same | 1830 to 2024 |
| `pb` | Primary balance | % of GDP | same | 1830 to 2024 |
| `GGXWDG_NGDP` | General government gross debt, recent actuals | % of GDP | IMF World Economic Outlook | 1980 (or the first year the IMF has) to 2025 |
| `GG_DEBT_GDP`, `CG_DEBT_GDP` | General government debt; central government debt | % of GDP | IMF Global Debt Database | 1950 to 2024 |
| `HH_LS`, `NFC_LS`, `PVD_LS` | Household, non-financial corporate and private debt (loans and debt securities) | % of GDP | IMF Global Debt Database | 1950 to 2024 |
| `TC_HH`, `TC_NFC`, `TC_GG` | Credit to households, non-financial corporations and general government | % of GDP | BIS total credit (WS_TC) | 1947 (US) to 2025; newest quarter in `latest` |
| `DSR_HH`, `DSR_NFC`, `DSR_PRIV` | Debt service ratio: households, non-financial corporations, private non-financial sector | % of income | BIS debt service ratios (WS_DSR) | 1999 to 2025; newest quarter in `latest` |
| `ESTAT_GD`, `ESTAT_INT` | Maastricht gross debt; interest payable (Germany, France, Italy, euro area) | % of GDP | Eurostat | 1995 to 2025 |
| `NGDP`, `NGDP_GROWTH` | Nominal GDP in national currency; its year-on-year growth | billions of national currency; % per year | BEA (US), World Bank (others), Eurostat (euro area) | 1929 (US), 1960 (others), 1995 (euro area) to 2025 |
| `US_DEBT_TOTAL_USD` | Total public debt outstanding | US dollars | US Treasury, Fiscal Data | 1790 to 2026; daily figure in `latest` |
| `US_DEBT_GROSS_GDP`, `US_DEBT_PUBLIC_GDP` | Gross federal debt; debt held by the public | % of GDP | OMB Historical Tables 7.1 | FY1940 to FY2025 |
| `US_NETINT_BN`, `US_RECEIPTS_BN`, `US_OUTLAYS_BN` | Federal net interest, receipts, outlays | billions of USD | OMB Tables 3.1 and 1.1; Monthly Treasury Statement for later years | FY1940 to FY2026 |
| `US_GDP_FY_BN` | GDP by federal fiscal year | billions of USD | OMB Table 10.1 | FY1940 to FY2025 |
| `US_AVG_RATE` | Average interest rate on interest-bearing Treasury debt | % per year | US Treasury, Fiscal Data | 2001 to 2025; newest month in `latest` |

### Sources, URLs and licences

| Indicators | Source and URL | Licence and attribution |
| --- | --- | --- |
| `d`, `ie`, `rev`, `pb` (dataset FPP); `GGXWDG_NGDP` (WEO); `GG_DEBT_GDP`, `CG_DEBT_GDP`, `HH_LS`, `NFC_LS`, `PVD_LS` (GDD) | IMF DataMapper API, `https://www.imf.org/external/datamapper/api/v1/<code>`; the vintage text ("Public Finances in Modern History Database (Dec 2025)", "World Economic Outlook (October 2026)", "Global Debt Database (Sep 2025)") comes from `.../api/v1/indicators` | IMF Copyright and Usage, Special Terms for Statistical Data (https://www.imf.org/en/About/copyright-and-terms). Download, copy, create derivative works, publish and distribute with attribution in the form "Source: International Monetary Fund, <database>, <link>"; state material transformations; commercial reuse by request to copyright@imf.org. The transformations here (years after the last actual removed) are stated in each `basis`. The same terms say that automated bulk download needs permission; this fetcher makes about 14 DataMapper API calls per run (one per indicator code), which is ordinary API use, and the site is non-commercial. Anyone running it at scale or reusing it commercially should ask the IMF first. |
| `TC_HH`, `TC_NFC`, `TC_GG` | BIS bulk download, total credit to the non-financial sector, `https://data.bis.org/static/bulk/WS_TC_csv_flat.zip` | BIS terms of permitted use of BIS statistics (https://data.bis.org/help/legal). Use is unrestricted provided the BIS is cited as the source, the use is not misleading or does not imply endorsement, and inclusion in a commercial product causes no additional charge to its users. No warranty. |
| `DSR_HH`, `DSR_NFC`, `DSR_PRIV` | BIS bulk download, debt service ratios, `https://data.bis.org/static/bulk/WS_DSR_csv_flat.zip` | Same BIS terms. |
| `ESTAT_GD`, `ESTAT_INT`; euro-area GDP inside `NGDP` | Eurostat dissemination API, `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/<dataset>`: `gov_10dd_edpt1` (item GD), `gov_10a_main` (item D41PAY), `nama_10_gdp` (item B1GQ, current prices in million euro); sector S13, unit PC_GDP; geo EA20, DE, FR, IT | Eurostat copyright notice (https://ec.europa.eu/eurostat/web/main/help/copyright-notice). Reuse for commercial or non-commercial purposes is authorised with the source acknowledged; modifications must be stated. |
| `NGDP`, `NGDP_GROWTH` for GB, JP, DE, FR, IT, CA, CN | World Bank WDI `NY.GDP.MKTP.CN`, `https://api.worldbank.org/v2/country/USA;GBR;JPN;DEU;FRA;ITA;CAN;CHN/indicator/NY.GDP.MKTP.CN?format=json&per_page=1000` | World Bank datasets default to CC BY 4.0 (https://datacatalog.worldbank.org/public-licenses), attribution required; some WDI series come from third parties under other terms. |
| `NGDP`, `NGDP_GROWTH` for the US | BEA NIPA annual flat file, `https://apps.bea.gov/national/Release/TXT/NipaDataA.txt` (about 12 MB; line `A191RC`, GDP in current dollars, millions). The BEA API needs a key; this file does not. | No licence statement found on a BEA page. US federal government work, treated as public domain by inference. Cite the U.S. Bureau of Economic Analysis. |
| `US_DEBT_TOTAL_USD`, `US_AVG_RATE`, and the Monthly Treasury Statement years of `US_NETINT_BN`, `US_RECEIPTS_BN`, `US_OUTLAYS_BN` | US Treasury, Fiscal Data API, `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/`: `v2/accounting/od/debt_outstanding` (Historical Debt Outstanding), `v2/accounting/od/debt_to_penny` (Debt to the Penny), `v2/accounting/od/avg_interest_rates` (Average Interest Rates on US Treasury Securities), `v1/accounting/mts/mts_table_9` (Monthly Treasury Statement, Table 9) | Fiscal Data API documentation, "License and Authorization" (https://fiscaldata.treasury.gov/api-documentation/): data offered free and without restriction, for commercial or non-commercial use. Cite the U.S. Department of the Treasury, Bureau of the Fiscal Service. |
| `US_DEBT_GROSS_GDP`, `US_DEBT_PUBLIC_GDP`, `US_GDP_FY_BN`, and the OMB years of `US_NETINT_BN`, `US_RECEIPTS_BN`, `US_OUTLAYS_BN` | OMB Historical Tables, FY2027 Budget, one zip: `https://www.whitehouse.gov/wp-content/uploads/2026/04/hist_fy2027.zip` (Tables 1.1, 3.1, 7.1, 10.1: `hist01z1.xlsx`, `hist03z1.xlsx`, `hist07z1.xlsx`, `hist10z1.xlsx`). Page: `https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/` | No licence text on the OMB page. US federal government work, treated as public domain by inference (17 U.S.C. 105). Cite "Office of Management and Budget, Historical Tables, FY2027 Budget". |

### How each source is read

- **IMF.** The DataMapper feed does not flag projections, so the last actual year is taken as the year before the vintage year in the indicator's source text, and later values are removed. For the 2026-10-24 build that is 2024 for `d` and the Global Debt Database series, and 2025 for the WEO series.
- **BIS total credit.** Filter: all lending sectors (`TC_LENDERS=A`), percent of GDP (`UNIT_TYPE=770`), adjusted for breaks (`TC_ADJUST=A`), quarterly. Households and companies are at market value; government is at nominal (face) value, because BIS publishes market value only for the other sectors and face value is closer to the usual debt statistic. The annual value is the fourth quarter; the newest quarter goes to `latest`.
- **BIS debt service ratios.** The annual value is the mean of the four quarters, for complete years only; the newest quarter goes to `latest`. China has only the private non-financial split (`DSR_PRIV`), and the euro area has no row.
- **Eurostat.** Observations carrying flag `b` (break in time series) become break entries of kind `flag`.
- **Nominal GDP.** US from BEA, euro area from Eurostat, the rest from the World Bank, all in billions of the national currency. The World Bank and BEA figures for the US differ by about 0.3 percent in 2024 (different vintages); BEA is used. `NGDP_GROWTH` is computed from consecutive years of the same series, so a rate is never taken across two sources.
- **Treasury.** Historical Debt Outstanding is keyed by the calendar year of the record date, the later record winning in a year with two; the record date by era is listed in the `basis`. The newest daily total from Debt to the Penny goes to `latest`. The average interest rate is the row "Total Interest-bearing Debt"; the annual value is the mean of twelve month-end rates, complete calendar years only.
- **OMB and the Monthly Treasury Statement.** Net interest, receipts and outlays are OMB tables to the last actual fiscal year (FY2025 in the FY2027 Budget file). For later complete fiscal years the fetcher reads Monthly Treasury Statement Table 9 for 30 September, once that date has passed, and records the switch as a break of kind `source`. Net interest is cross-checked against OMB's own percent-of-GDP row, and the build fails if they differ by more than 0.11 points. If the pinned OMB zip cannot be downloaded, the fetcher looks on the OMB page for the newest `hist_fyNNNN.zip` link and tries that.

### Breaks and cautions

| Kind or rule | Where | What it means |
| --- | --- | --- |
| `coverage` | `d`, `ie`, `rev`, `pb` | Inferred, not flagged by the IMF. The feed has no coverage flags, so the lines can change from central to general government part-way. A year in which revenue steps by 10 points of GDP or more, outside the war years 1914-1920 and 1939-1949, is marked as a probable change. In the 2026-10-24 build: US 1960, FR 1978, DE 1913, DE 1970, IT 1968, CA 1961. |
| `flag` | `ESTAT_*` | Eurostat flags a break in the time series at this observation. |
| `source` | `US_NETINT_BN`, `US_RECEIPTS_BN`, `US_OUTLAYS_BN` | The year from which the Monthly Treasury Statement replaces the OMB tables. The two sources can differ slightly in a shared year; the `basis` quotes the difference. |
| Do not join | `d` and `GGXWDG_NGDP` | Public Finances in Modern History and the World Economic Outlook differ in coverage and level for some countries. The `basis` of `GGXWDG_NGDP` lists differences over 2 points in the last common year. |
| Do not join | `TC_*` and `DSR_*` with `HH_LS`, `NFC_LS`, `PVD_LS` | BIS and the IMF Global Debt Database are different compilations (valuation and coverage differ). |
| Do not divide | `US_DEBT_TOTAL_USD` by GDP to reproduce an OMB ratio | OMB gross federal debt is a little lower than the Treasury total. For the share of GDP use OMB's own ratio (`US_DEBT_GROSS_GDP`). |
| Same year only | fiscal-year flows | Divide `US_NETINT_BN` and its kin by `US_GDP_FY_BN` (fiscal year) or by receipts of the same fiscal year, never by calendar-year `NGDP`. |
| Central only | `CG_DEBT_GDP` | Central government debt only, so smaller than general government debt where states, municipalities or social funds borrow. |

### Adding an indicator

Add its definition to the matching table in `fetch_debt.py` (`IMF_SPECS`, `BIS_TC`, `BIS_DSR`, `ESTAT` or a new builder), a range in `PLAUSIBLE`, and its id in `ORDER`, then run the script. Keep the range wide: it is the guard against unit changes at the source.

## Prices: fetch_prices.py

Builds `data/prices.js` (`window.MACRO_PRICES`): US consumer prices since 1913, average prices of everyday goods, pay, house prices, land values and a Treasury bill rate, plus UK and Canadian consumer prices and housing (36 series).

```powershell
$env:MACRO_FETCH_CONTACT = "you@example.org"   # or pass --contact; BLS requires a contact address
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_prices.py
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_prices.py --offline
& "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" tools\fetch_prices.py --only cpi_u,house_new_median
```

An online run takes several minutes: requests to the ONS are spaced 25 seconds apart (its generator answers 429 to quick repeats), and the NASS file is streamed once and cut down to a small extract. Without a contact address the BLS files are read from the cache, with a warning. The run prints a table (series, frequency, points, first and last period, first and last value, retrieved date, "cache" where the cache was used), the skipped series with reasons, and "wrote" or "unchanged". Flags, cache and guard rails are described above.

### Output shape

```js
window.MACRO_PRICES = {
  generated, notes[],
  series: { <id>: { label, unit, freq, country, group, proxy?, source, sourceId, url, licence,
                    retrieved, asOf, notes, breaks[{ t, label, kind }], parts?,
                    data: [[period, value | null], ...] } }
};
```

- `freq` is `M` (`YYYY-MM`), `Q` (`YYYY-Qn`) or `A` (`YYYY`). `group` is `prices`, `pay`, `income`, `items`, `housing`, `land` or `rates`. `country` is `US`, `GB` or `CA`.
- `proxy: true` marks a stand-in for something that is not measured directly (farm real estate for land, the soft drink record assembled from BLS pieces, Shiller's home price compilation, builders' land prices in Canada, FHFA residential land for 2012 to 2022). Label proxies wherever they are drawn.
- `breaks` lists every gap (`gap`), product change (`product`), definition change (`definition`), source change (`source`) and spacing change (`spacing`) in the series. `parts` (the soft drink proxy only) lists the BLS pieces, their spans and the conversion factors.
- Index series carry their own base in `unit`. Compare changes over one window, not levels across series.

### Series, sources, URLs and licences

Every series also carries its licence in its `licence` field. BLS URLs have the form `https://download.bls.gov/pub/time.series/<survey>/<file>`.

| Series ids | Source and URL | Licence and attribution |
| --- | --- | --- |
| `cpi_u` | BLS, CPI-U all items, not seasonally adjusted (`CUUR0000SA0`), file `cu/cu.data.1.AllItems`; from 1913-01 | Public domain (US government work). Cite the U.S. Bureau of Labor Statistics. |
| `cpi_carbonated` | BLS, CPI-U carbonated drinks (`CUUR0000SEFN01`), file `cu/cu.data.11.USFoodBeverage`; from 1978-01 | Same BLS terms. |
| `price_bread`, `price_eggs`, `price_milk`, `price_milk_halfgal`, `price_beef_ground`, `price_coffee`, `price_sugar`, `price_cola_returnable_16oz`, `price_cola_cans_16oz`, `price_cola_2l`, `price_softdrinks_2l`, `price_softdrinks_12pk_12oz`; derived `price_soda_proxy_12oz` | BLS Average Price Data, U.S. city average, file `ap/ap.data.3.Food`. Series ids `APU0000702111` (bread), `APU0000708111` (eggs), `APU0000709112` (milk, gallon), `APU0000709111` (milk, half gallon), `APU0000703112` (ground beef), `APU0000717311` (coffee), `APU0000715211` (sugar), `APU0000717111`, `APU0000717113`, `APU0000717114` (cola pieces), `APU0000FN1101`, `APU0000FN1102` (all soft drinks) | Same BLS terms. |
| `price_gasoline` | BLS Average Price Data `APU000074714`, file `ap/ap.data.2.Gasoline`; from 1976-01 | Same BLS terms. |
| `price_electricity` | BLS Average Price Data `APU000072610`, file `ap/ap.data.1.HouseholdFuels`; from 1978-11 | Same BLS terms. |
| `pay_prod` | BLS Current Employment Statistics, average hourly earnings of production and nonsupervisory employees, total private, seasonally adjusted (`CES0500000008`), file `ce/ce.data.05c.TotalPrivate.ProductionEmployeeHoursAndEarnings`; from 1964-01 | Same BLS terms. |
| `house_new_median`, `house_new_median_annual` | US Census Bureau and HUD, New Residential Sales, Sales Price of New Privately-Owned Houses Sold, `https://www.census.gov/construction/nrs/xls/price_cust.xlsx` (sheets Monthly and Annual); from 1963 | No licence statement found; treated as public domain US federal work. Cite the U.S. Census Bureau. |
| `income_median` | US Census Bureau, Current Population Survey ASEC, Table H-5, median household income, current dollars, `https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx`; from 1967 | Same Census terms. |
| `fhfa_hpi` | Federal Housing Finance Agency, House Price Index, expanded master file, all-transactions, USA, quarterly, `https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv`; from 1975-Q1 | No licence statement found; treated as public domain. Cite the Federal Housing Finance Agency. |
| `land_resid_acre`, `land_resid_quarter_acre`, `land_resid_share` | FHFA, The Price of Residential Land (v4.0, June 2024), panel Nation, `https://www.fhfa.gov/document/land-prices_2024_20_june.xlsx`; 2012 to 2022 only | Same FHFA terms. FHFA labels these experimental estimates, works in progress and subject to change. |
| `house_price_shiller` | Robert J. Shiller, Irrational Exuberance, data for Figure 3.1, nominal home price index (`Fig3-1.xls`). The page `https://shillerdata.com/` is read to find the current file address; if it cannot be read, the last address in the manifest is used. Only 1890 to 1974 is stored. | No licence stated by the source. Used as derived annual values with attribution (cite R. J. Shiller, Irrational Exuberance, data for Figure 3.1). Terms of reuse were not confirmed; the raw workbook is never committed. |
| `farmland_acre` | USDA NASS, Quick Stats, "AG LAND, INCL BUILDINGS - ASSET VALUE, MEASURED IN $ / ACRE", survey, national, annual. The fetcher reads `https://www.nass.usda.gov/datasets/` for the current `qs.economics_YYYYMMDD.txt.gz` (a gzip of about 584 MB), streams it once and keeps only the national farmland rows in `nass_farmland_extract.csv`; the extract is reused for 150 days unless `--only farmland_acre` forces a new stream. | No licence statement found; treated as public domain. Cite USDA NASS, Quick Stats. |
| `tbill3m` | Board of Governors of the Federal Reserve System, Selected Interest Rates (H.15), Data Download Program, monthly averages package, column `H15/H15/RIFSGFSM03_N.M` (the series FRED carries as TB3MS); from 1934-01. If the package id stops working, the fetcher scrapes `https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H15` for the Monthly Averages package. | Board of Governors publication. Cite the Board of Governors of the Federal Reserve System, H.15. |
| `uk_rpi_annual`, `uk_rpi` | ONS, Retail Prices Index: long run series, `CDKO`, dataset MM23, through the ONS generator: `https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/cdko/mm23`; annual from 1800, monthly from 1947-06 | Open Government Licence v3.0. Contains public sector information licensed under the Open Government Licence v3.0. |
| `uk_cpi` | ONS, CPI index 00 all items, 2015 = 100, `D7BT`, dataset MM23, same generator with `uri=/economy/inflationandpriceindices/timeseries/d7bt/mm23`; from 1988-01 | Same OGL terms. |
| `uk_earnings_weekly` | ONS, Average weekly earnings, whole economy, total pay excluding arrears, seasonally adjusted, `KAB9`, dataset EMP, same generator with `uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/emp`; from 2000-01 | Same OGL terms. |
| `uk_house_price` | HM Land Registry, UK House Price Index, average price, United Kingdom, `https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-<YYYY-MM>.csv` (the name carries the release month; the fetcher tries the current month and the five before); from 1968-04 | Open Government Licence v3.0. Contains HM Land Registry data (c) Crown copyright and database right, licensed under the Open Government Licence v3.0. |
| `ca_cpi` | Statistics Canada, Table 18-10-0004-01, Consumer Price Index, all-items, Canada (vector v41690973), through the web data service `https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange`; from 1914-01 | Statistics Canada Open Licence. The licence asks for this notice on derived work: "Adapted from Statistics Canada, <product>, <reference date>. This does not constitute an endorsement by Statistics Canada of this product." The Prices page prints it under Cited facts and other files. |
| `ca_nhpi_house`, `ca_nhpi_land` | Statistics Canada, Table 18-10-0205-01, New housing price index, Canada, `https://www150.statcan.gc.ca/n1/tbl/csv/18100205-eng.zip` (house only `v111955443`, land only `v111955444`); from 1981-01 | Statistics Canada Open Licence, with the same notice of adaptation and no-endorsement statement as for `ca_cpi`. |

Gold price (not fetched here): the Prices page converts to ounces of gold with `goldPrice` from `data/history.js`, annual averages from 1971 and official prices before, entered by hand from World Gold Council and LBMA sources. No licence is recorded for that series in this README or in the file, so it is shown for comparison only and its reuse terms are for the owner of `data/history.js` to confirm. Its 2026 point is a single spot reading flagged `p: 1`, so the Prices page leaves 2026 empty.

### Breaks and cautions

- **October 2025.** BLS collected no data for 2025-10 (the 2025 lapse in appropriations), so every BLS series has a gap there. The gap is kept.
- **Soft drinks.** BLS has only fragments of a dollar price for cola: cans to 1992-02, 2 liter bottles 1995-07 to 2009-05, then all soft drinks from 2018-04, with long gaps between them. `price_soda_proxy_12oz` converts the three pieces to dollars per 12 fl oz by plain arithmetic and leaves them unjoined, with the gaps empty; the product changes at each gap, so read changes inside one piece only. `cpi_carbonated` is the continuous relative price.
- **Milk.** `price_milk_halfgal` (to 1997-12) and `price_milk` (gallon, from 1995-07) overlap and are not spliced.
- **Houses.** `house_price_shiller` stops at 1974 on purpose (his later values are S&P Case-Shiller, which is not redistributed); `fhfa_hpi` starts in 1975 on a different base and the two have no overlap year, so any link between them is an assumption that a page must state. Shiller's early levels come from different sources, and 1953 to 1974 are annual means of values he interpolates within each year. `house_new_median` is a price level for new houses only, not a constant-quality index. `income_median` is a household median and is not comparable with `pay_prod`, which is an average of production and nonsupervisory pay.
- **Land.** `farmland_acre` is a proxy: farmland including buildings, not residential land. It is decennial from 1850 to 1900 and annual from 1910, so the early spacing is not a gap. The FHFA land series are experimental and cover 2012 to 2022 only. `ca_nhpi_land` is a quality-adjusted index of contractors' selling prices for the lot under a new house, not a market price for lots; some values carry Statistics Canada's quality flag E.
- **UK.** `uk_rpi` is the Retail Prices Index, a different measure from `uk_cpi`; do not mix them in one comparison. `uk_house_price` is a derived back series before 1995 that moves in quarterly steps. `uk_earnings_weekly` is a weekly figure for all employees, not comparable with US hourly earnings.
- **Rates.** `tbill3m` is a nominal discount-basis rate; subtract inflation yourself for a real return.
- **Before 1913.** No permitted open source was found for US prices before 1913, so the US CPI starts in 1913. Gold prices are in `data/history.js` and are not repeated here.

### Adding a series

Add an `S(...)` entry to `SERIES` in `fetch_prices.py` (id, source key, picker, label, unit, frequency, country, group, source text, licence, notes and a `check` range), and an entry in `SOURCES` if the file is new (cache name, URL, kind, parser). Run the script, then `node tools/check-data.js`. Keep the `check` ranges wide: they guard against unit changes at the source.

## Curated data files

Not generated. Edit them by hand when a source changes, then run `node tools/check-data.js`.

### data/prices-curated.js (`window.MACRO_PRICES_CURATED`)

Cited points that no free machine-readable series covers. Every point is an object `{ p, v, src, note }` (period or date, value, a key in `sources`, a short plain statement); the file carries `updated`, `notes`, `sources` and `series`. Each series has the same label, unit, source, url, licence, retrieved and asOf fields as `data/prices.js`, plus a `kind`. These are cited points, not a continuous record: do not join points of different series and do not fill the years between them. Where a generated series covers the same ground, the generated series wins.

| Series | Kind | What it holds | Source and licence |
| --- | --- | --- | --- |
| `stamp` | `step` | Every change in the domestic first-class letter rate, 41 points from 1863-07-01 to 2026-07-12, by effective date. The first two points are per half ounce; from 1885-07-01 the rate is for the first ounce. | USPS Postal History, "Rates for Domestic Letters Since 1863", `https://about.usps.com/who/profile/history/domestic-letter-rates-since-1863.htm`. Official USPS publication; facts only, the page layout is not copied. Cite USPS Postal History. |
| `coke_nickel` | `span` | The 5 cent price of a 6.5 oz bottle of Coca-Cola, 1886 to 1959, as two end points of a span (draw it as a span, labelled "about 1886 to 1959"). | Levy and Young, "The Real Thing: Nominal Price Rigidity of the Nickel Coke, 1886-1959", Journal of Money, Credit and Banking 36(4), 2004 (`https://mpra.ub.uni-muenchen.de/1046/`). Journal article; a single cited fact, no dataset licence applies. Cite the paper. |
| `bread_1913`, `eggs_1913`, `milk_1913`, `coffee_1913`, `sugar_1913` | `point` | One January 1913 anchor price each, indicative only (the product definition differs from the modern average price). `compareWith` names the BLS series to compare against. | BLS, Beyond the Numbers vol. 2 (2013), "Average food prices: a snapshot of how much has changed over a century", Table 1. Public domain (US government work). |
| `farmland_acre_points` | `points` | 13 selected points of the NASS farmland series, a fallback for `farmland_acre` when the generated series is missing. Proxy. | USDA NASS Quick Stats (as in the table above). |
| `land_resid_acre_points` | `points` | The two end points (2012 and 2022) of the FHFA residential land series, a fallback for `land_resid_acre`. Partial and experimental. | FHFA, The Price of Residential Land (as in the table above). |

The check requires every point to name a source and to have a valid period or date, and warns when the source is not in `sources` or a point has no note. Each source in `sources` records its title, publisher, URL, access date and licence statement; keep those complete when adding one.

### data/principles.js (`window.PRINCIPLES`)

The text of the Start page: scope, the walk-through, the claims, ten strains and a panel of where the system has held, nine money systems, the method and a glossary, with a registry of sources. The header comment of the file documents the shape. Rules the check enforces:

- Every number in a text is a `{{series.rule.arg.arg|fmt}}` placeholder that `assets/derive.js` resolves from `data/prices.js`, `data/debt.js` and `data/history.js` when the page loads, so the page cannot show a number that its data files do not support. A statement that quotes a published figure carries `cited: true` and no placeholder, and the page labels it as a published figure.
- Every claim carries a verdict from the fixed set (Supported, Partly supported, True in some windows, Not supported, Depends on definition).
- A statement labelled `fact` may not contain a judgment or a premise: the words "not a defect", "has to", "have to", "must", "should", "theft", "fails", "proved" and a few more are errors there (the same check reads the `note('fact', ...)` notes in `assets/debt.js`). Put the accounting in a fact and the judgment in an interpretation that names the opposing view.
- Every `refs` entry resolves in the `sources` registry. A source needs a title; its URL, if given, must be an http or https address; `kind` should be `primary`, `secondary`, `dataset` or `claim`; `retrieved` is a `YYYY-MM-DD` date, and a source with a URL but no `retrieved` date draws a warning. A source that nothing cites also draws a warning.
- Every placeholder names a known rule with the right number of arguments and resolves against the data files; one that does not is an error (it is a warning only when the data file it needs is not present).

### Other curated files

`data/history.js` (long-run money, debt and gold since 1257; also supplies the gold price for "ounces of gold" on Prices), `data/money-flow.js` (Money Flow), `data/world-powers.js` (Nations) and `data/power-structure.js` (Power Structure). Check the last two with `node tools/check-graph-data.js`.

## Sources deliberately not used

Recorded so they are not added by mistake. None of these is in a data file or in `data/raw/`.

| Source | Why not |
| --- | --- |
| Jorda-Schularick-Taylor Macrohistory Database | CC BY-NC-SA 4.0; the non-commercial and share-alike terms do not suit a public site. |
| Nationwide House Price Index (UK, since 1952) | Nationwide owns all rights and grants no reuse licence. |
| Bank of England "A millennium of macroeconomic data" | Bank terms allow personal or internal non-commercial use; redistribution needs permission. (The Bank's IADB series used for UK money supply above are a different download.) |
| Freddie Mac mortgage rates (PMMS) | The page allows use with attribution but forbids altering the content. No mortgage rate series is shipped. |
| S&P Case-Shiller | Not redistributed; this is why `house_price_shiller` stops at 1974 and FHFA takes over. |
| Minneapolis Fed consumer price index, 1800 on | The site disclaimer allows research and informational use only. The US CPI therefore starts in 1913. |
| FRED | Times out from this machine. Primary providers are used instead; FRED mirrors some of them (for example `tbill3m` is TB3MS). |

## Checks

All Node scripts exit with 0 when there is no error and 1 when there is; an unknown option exits with 2. Warnings never fail a run.

| Command | What it checks |
| --- | --- |
| `node tools/check-data.js [file ...] [--root DIR] [--allow-missing] [--no-resolve] [--quiet]` | `data/debt.js`, `data/prices.js`, `data/prices-curated.js`, `data/principles.js` (and `data/world-money.js` if it exists). Every file: loads in a vm and sets exactly one `window.*` global; ASCII only; no em dash; no NaN, Infinity, undefined or function; inside its size budget (400,000 bytes each for debt and prices, 120,000 for the curated prices, 250,000 for principles, 1,000,000 together). `MACRO_DEBT`: countries; indicators with label, unit, source, url, retrieved and as-of or vintage; rows `[year, value]` with years strictly increasing and none after the file's generated year or the indicator's `lastActual`. `MACRO_PRICES`: label, unit, freq, source, url, retrieved, asOf; periods that match the frequency and increase; a null row is a gap; nothing later than the generated date. Curated prices: every point names a source. `PRINCIPLES`: the rules listed above. `--no-resolve` skips resolving placeholders against the data files. |
| `node tools/check-graph-data.js [file ...] [--lenient]` | `data/world-powers.js` and `data/power-structure.js` against the graph data contract in `assets/graph-model.js` (structure, evidence grades, sources, dates). `--lenient` turns the shipped-data rules into warnings. |
| `node tools/check-site.js [--root DIR] [--stamp VALUE] [--pages a.html,b.html] [--allow-missing]` | The seven pages. The app bar is identical on all pages apart from the page title and `aria-current`; the brand links to `index.html`; the seven links are in reading order and exactly one carries `aria-current="page"`, the page itself. Every local stylesheet, script and image carries `?v=<stamp>` and all pages share one stamp; the d3 script, where a page loads it, is the pinned 7.9.0 URL on jsDelivr with no stamp, and no other third-party script is loaded. Every local `href` and `src` names a file that exists. Each page has a skip link whose target exists, a noscript fallback, a unique title, a description, a viewport, one `h1` and no duplicate ids. A page that loads `ts-chart.js` also loads `ui.js` before it and `ts-chart.css`. |
| `node tools/test-derive.js` | Unit tests of `assets/derive.js`: arithmetic against vectors from the research (doubling times, hours of work, real returns), aligned ratios, placeholder parsing and resolution, that every derive rule is documented and has a test sample, and the data-context adapter. It also checks that the new front-end and tool files are ASCII only with no em dash. |
| `node tools/stamp.js [STAMP] [--check] [--root DIR] [--quiet]` | With a stamp, rewrites every local asset URL in `*.html` to `?v=<STAMP>` (letters, digits, dot, underscore, hyphen; use a suffix for a second release on one day). `--check` exits 1 if any URL has a different stamp or none and writes nothing. With no argument it prints the stamps in use. The jsDelivr d3 URL is never stamped. |
| `python tools\fetchlib.py --selftest`, `python tools\fetch_prices.py --selftest` | Offline tests of the shared library and of the prices parsers. |

## After a data change

1. Run the fetcher (or edit the curated file). `--offline` should leave the file unchanged if nothing was downloaded.
2. `node tools/check-data.js` (and `node tools/check-graph-data.js` for the two graph files).
3. If a data file changed, give every page a new stamp with `node tools/stamp.js <stamp>` so browsers do not serve an old file to some pages.
4. `node tools/check-site.js`.
5. Open Start, Debt and Prices and look at the changed figures; they read the data files when the page loads.
