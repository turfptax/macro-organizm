# Macro Organizm

Interactive pages about money, debt, prices and the institutions around them. Every figure carries a source and an as-of date. The Start page tests common claims about money against the data and says what holds, what does not and where economists disagree; it does not score the system.

The pages are listed in navigation order, which is also reading order. The menu groups the first five under "Money" and the last two under "Power".

| Page | What it shows |
|---|---|
| `index.html` (Start, "Money from first principles") | Seven headline numbers computed from the data files when the page loads, a plain walk through how money is created and repaid, eight claims (six common criticisms and two made in defence of the system) tested one at a time (a verdict from a fixed set, what is right, what is not, the deciding numbers over several windows, where economists disagree, the strongest counterargument and what would change the verdict), ten places where pressure shows up with what each counterpoint leaves out, a panel of where the system has held, and nine ways to run money compared with no winner declared. |
| `money-flow.html` (Money Flow) | The textbook money multiplier as a teaching model, how money is created today (loans create deposits), orders of magnitude, and comparisons of banks, central banks, GDP, money and debt. |
| `monetary-history.html` (Money Over Time) | Money supply ladders (monetary base, M1, M2, M3, M4 where they officially exist) for the US, euro area, UK, Japan and China, plus a long-run history of money, debt and gold since 1257. |
| `debt.html` (Debt, "Debt and Interest") | Government debt as a share of GDP over the long run, debt by sector (households, companies, government), what the interest costs (US dollars, share of GDP, share of revenue), interest rate against nominal growth (r minus g), and household debt service, for the US, UK, Japan, Germany, France, Italy, Canada, China and the euro area. |
| `prices.html` (Prices, "Prices and Purchasing Power") | How fast prices double over four fixed windows and a window of your own, what everyday items, houses and land cost in dollars, an index, hours of work or ounces of gold, house prices against pay and income, and the real return on savings. The US is covered in full; the UK and Canada have consumer prices and housing (and UK earnings). Gaps and proxies are marked. |
| `world-powers.html` (Nations) | A dated, sourced snapshot of selected states, their memberships and their security, hostility, economic and diplomatic ties. |
| `power-structure.html` (Power Structure) | Documented ownership, founding, board, partnership and funding ties among families, banks and institutions, with evidence grades and a "Claims checked" panel. |

## Run locally

The pages are static files with no build step. Open any `.html` file directly, or serve the folder:

```
python -m http.server 3457 --bind 127.0.0.1
```

then visit http://localhost:3457/ (the Start page) or a page by name, for example http://localhost:3457/debt.html.

Start, Debt and Prices load no network resources and need JavaScript, because they compute their figures and draw their charts in the browser from the data files. Money Flow, Money Over Time, Nations and Power Structure load D3 7.9.0 from jsDelivr, so they need a network connection.

## Data

Three generated files, each rebuilt by its own fetcher (Python 3.12, standard library only; run from this folder):

| File | Built by | Used by |
|---|---|---|
| `data/money-supply.js` (`window.MONEY_SUPPLY`) | `python tools/fetch_money_supply.py` | Money Over Time, Money Flow |
| `data/debt.js` (`window.MACRO_DEBT`) | `python tools/fetch_debt.py` | Debt, Start |
| `data/prices.js` (`window.MACRO_PRICES`) | `python tools/fetch_prices.py --contact you@example.org` | Prices, Start |

- Each fetcher caches its downloads (`data/raw/`, `data/raw/debt/`, `data/raw/prices/`), none of which is committed, and `--offline` rebuilds the data file from that cache with the same bytes. A fresh clone has no cache, so run a fetcher without `--offline` first.
- The Prices fetcher needs a contact email in its User-Agent for the BLS files: pass `--contact` or set `MACRO_FETCH_CONTACT`. Without one the BLS series are read from the cache.
- Sources, licences, refresh flags and known series breaks are in `tools/README.md`. Each series in a generated file also carries its own source, URL, retrieval date, as-of date and basis.
- Curated by hand: `data/history.js`, `data/money-flow.js`, `data/world-powers.js`, `data/power-structure.js`, `data/prices-curated.js` (the stamp price history, the Coca-Cola 5 cent span, 1913 anchor prices and land fallback points, each point sourced) and `data/principles.js` (the Start page text: claims, strains, money systems, sources and glossary, with every number a `{{placeholder}}` that `assets/derive.js` computes from the data files at load).

Checks, all run from this folder:

```
node tools/check-data.js          # data/debt.js, prices.js, prices-curated.js, principles.js
node tools/check-graph-data.js    # data/world-powers.js and data/power-structure.js
node tools/check-site.js          # the seven pages: navigation, stamp, local links, page contract
node tools/test-derive.js         # the arithmetic in assets/derive.js
node tools/stamp.js --check       # one cache stamp on every local asset URL
```

After any data file changes, give every page a new cache stamp with `node tools/stamp.js <stamp>` (for example `20261024b`), then run `node tools/check-site.js`.

## Code

Shared code: `assets/macro.css` (design tokens, components and the navigation), `assets/shell.js` (theme, phone menu and load errors), `assets/ui.js` (element builders, tooltip, dialog and table), `assets/derive.js` (the arithmetic behind every computed number; runs in the browser and in Node), and `assets/ts-chart.js` with `assets/ts-chart.css` (the time-series chart used by Start, Debt and Prices; it does not use D3). The graph engine for Nations and Power Structure is `assets/graph-model.js`, `assets/graph.js` and `assets/graph.css`. Each page has its own script and stylesheet in `assets/` (`start`, `debt`, `prices`, `money-flow`, `monetary-history`, `world-powers`, `power-structure`).
