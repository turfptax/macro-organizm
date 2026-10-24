# Macro Organizm

Interactive D3 pages about money and the institutions around it. Every figure carries a source and an as-of date.

| Page | What it shows |
|---|---|
| `monetary-history.html` (Money Over Time) | Money supply ladders (monetary base, M1, M2, M3, M4 where they officially exist) for the US, euro area, UK, Japan and China, plus a long-run history of money, debt and gold since 1257. |
| `money-flow.html` (Money Flow) | The textbook money multiplier as a teaching model, how money is created today (loans create deposits), orders of magnitude, and comparisons of banks, central banks, GDP, money and debt. |
| `world-powers.html` (Nations) | A dated, sourced snapshot of selected states, their memberships and their security, hostility, economic and diplomatic ties. |
| `power-structure.html` (Power Structure) | Documented ownership, founding, board, partnership and funding ties among families, banks and institutions, with evidence grades and a "Claims checked" panel. |

## Run locally

The pages are static files with no build step. Open any `.html` file directly, or serve the folder:

```
python -m http.server 3457 --bind 127.0.0.1
```

then visit http://localhost:3457/monetary-history.html.

## Data

- `data/money-supply.js` is generated. Refresh it with `python tools/fetch_money_supply.py` (Python 3.12, standard library only). It caches downloads in `data/raw/`, which is not committed. Sources, licences and known series breaks are in `tools/README.md`.
- `data/history.js`, `data/money-flow.js`, `data/world-powers.js` and `data/power-structure.js` are curated by hand.
- Check the two graph data files with `node tools/check-graph-data.js`.

Shared code: `assets/macro.css` (design tokens and components), `assets/shell.js` (theme and load errors), and the graph engine in `assets/graph-model.js`, `assets/graph.js`, `assets/ui.js` and `assets/graph.css`.
