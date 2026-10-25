/* Macro Organizm Prices page: the doubling-time calculator, everyday items against homes and land in dollars, index,
   hours of work and ounces of gold, the pop coverage strip, house price to pay and income, and the real return on bills.
   Needs data/prices.js, data/prices-curated.js, data/history.js (gold), assets/ui.js, assets/derive.js and assets/ts-chart.js.
   Every number is computed here from those files. Text from data goes in through textContent only (MacroUI.h).
   Sections: 1 helpers and data, 2 measures, 3 windows, 4 conversions, 5 page pieces, 6 sections, 7 start-up. */
(function () {
  'use strict';

  const U = window.MacroUI, TS = window.TSChart, D = window.MacroDerive;
  const P = window.MACRO_PRICES, CUR = window.MACRO_PRICES_CURATED, HIST = window.MONEY_HISTORY;
  const shell = window.MacroShell;

  function bail(detail) {
    if (shell && shell.fatal) { shell.fatal('The Prices page could not load', detail); return; }
    const box = document.getElementById('load-error'), d = document.getElementById('load-error-detail'), app = document.getElementById('app');
    if (d) d.textContent = detail;
    if (box) box.hidden = false;
    if (app) app.hidden = true;
  }
  const missing = [];
  if (!U || !U.h) missing.push('assets/ui.js');
  if (!D) missing.push('assets/derive.js');
  if (!TS) missing.push('assets/ts-chart.js');
  if (!P || !P.series) missing.push('data/prices.js');
  if (missing.length) { bail('These files did not load: ' + missing.join(', ') + '. Check your connection or any content blocker, then reload the page.'); return; }
  // optional files: the page works without them but says what is left out
  const optionalMissing = [];
  if (!window.MACRO_PRICES_CURATED || !window.MACRO_PRICES_CURATED.series) optionalMissing.push('data/prices-curated.js (the first-class stamp and the Coca-Cola nickel)');
  if (!window.MONEY_HISTORY || !window.MONEY_HISTORY.series) optionalMissing.push('data/history.js (the gold price)');

  const h = U.h, clear = U.clear;

  /* =====================================================================================
     1. helpers and data
     ===================================================================================== */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HOURS_PER_YEAR = D.HOURS_PER_YEAR || 2080;
  const RATE_17 = D.rateForDoubling(17) * 100; // percent a year that doubles in 17 years
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const $ = (id) => document.getElementById(id);

  const SER = (id) => (own(P.series, id) ? P.series[id] : null);
  const ROWS = (id) => (SER(id) ? SER(id).data : []);
  const CURS = (id) => (CUR && CUR.series && own(CUR.series, id) ? CUR.series[id] : null);
  const label = (key) => D.periodLabel(key);

  // month index of a cleaned point: months since year 0 at the start of its period
  const mi = (pt) => pt.y * 12 + (pt.m ? pt.m - 1 : pt.q ? (pt.q - 1) * 3 : 0);
  const stepMonths = (freq) => (freq === 'A' ? 12 : freq === 'Q' ? 3 : 1);

  // number text. D.format gives plain ASCII.
  const nf = (v, d) => D.format(v, 'n' + d);
  function fmtTimes(v) { return !fin(v) ? 'n/a' : 'x' + (v >= 100 ? nf(v, 0) : v >= 10 ? nf(v, 1) : nf(v, 2)); }
  function fmtPct(v, d) { return !fin(v) ? 'n/a' : D.format(v, 'p' + (d == null ? 2 : d)); }
  function fmtMoney(v) {
    if (!fin(v)) return 'n/a';
    const a = Math.abs(v);
    const wholeCents = Math.abs(a * 100 - Math.round(a * 100)) < 1e-9;
    return a < 0.1 && !wholeCents ? (v < 0 ? '-$' : '$') + a.toFixed(3) : a < 100 ? D.format(v, 'usd2') : D.format(v, 'usd0');
  }
  function fmtGbp(v) { return !fin(v) ? 'n/a' : 'GBP ' + nf(v, v < 1000 ? 2 : 0); }
  function fmtIdx(v) { return !fin(v) ? 'n/a' : nf(v, v < 100 ? 2 : 1); }
  // hours: minutes below one hour
  function fmtHours(v) {
    if (!fin(v)) return 'n/a';
    if (v < 1) { const m = v * 60; return (m < 10 ? m.toFixed(1) : m.toFixed(0)) + ' min'; }
    if (v < 100) return v.toFixed(1) + ' h';
    return nf(v, 0) + ' h';
  }
  function fmtOz(v) {
    if (!fin(v)) return 'n/a';
    if (v === 0) return '0 oz';
    const a = Math.abs(v);
    if (a < 0.01) return v.toPrecision(2) + ' oz';
    if (a < 1) return v.toFixed(3) + ' oz';
    if (a < 100) return v.toFixed(2) + ' oz';
    return nf(v, 0) + ' oz';
  }
  // compact tick text for a log axis: 0.01, 0.1, 1, 10, 100, 1K, 10K, 1M
  function tickNum(v, prefix, suffix) {
    const a = Math.abs(v), pre = prefix || '', suf = suffix || '';
    let s;
    if (a >= 1e6) s = trim(v / 1e6) + 'M';
    else if (a >= 1e3) s = trim(v / 1e3) + 'K';
    else if (a >= 1) s = trim(v);
    else if (a === 0) s = '0';
    else {
      // below 1 keep two significant figures: toFixed(2) would turn 0.00014 into 0
      const p = +v.toPrecision(2);
      s = Math.abs(p) < 1e-6 ? p.toExponential(0) : String(p);
    }
    return pre + s + suf;
  }
  function trim(x) { return String(+x.toFixed(2)); }

  /* ---------- periods and windows ---------- */
  const latestKey = () => (SER('cpi_u') ? SER('cpi_u').asOf : '2026-09');

  // a cleaned series with month index, plus any cited anchor points ahead of its first observation
  function calcPoints(rows, anchors) {
    const pts = D.clean(rows).map((pt) => Object.assign({ mi: mi(pt) }, pt));
    const extra = [];
    (anchors || []).forEach((a) => {
      const per = D.parsePeriod(a.p);
      if (per && fin(a.v) && (!pts.length || mi(per) < pts[0].mi)) extra.push(Object.assign({ mi: mi(per), v: a.v, anchor: true, note: a.note }, per));
    });
    return extra.concat(pts);
  }

  // Evaluate one window on cleaned points. win: { kind: 'fixed', y, m } | { kind: 'last', n } | { kind: 'custom', sy, sm, ey, em }
  // The start is the first observation at or after the requested month (at most 12 months late). The end is the newest
  // observation, or for a custom window the newest one at or before the requested end month; an end after the newest
  // observation ends at the newest one and the result says so. The Start page uses the same rules.
  function evalWindow(pts, win) {
    if (!pts.length) return { err: 'This series has no data.' };
    const lastPt = pts[pts.length - 1], step = stepMonths(lastPt.freq);
    const align = (m) => m - (((m % step) + step) % step);
    let target, endPt = lastPt, endClamped = false;
    if (win.kind === 'fixed') target = align(win.y * 12 + win.m - 1);
    else if (win.kind === 'last') target = align(lastPt.mi - win.n * 12);
    else {
      target = align(win.sy * 12 + win.sm - 1);
      const te = align(win.ey * 12 + win.em - 1);
      if (te > lastPt.mi) endClamped = true;
      else {
        endPt = null;
        for (let i = pts.length - 1; i >= 0; i--) if (pts[i].mi <= te) { endPt = pts[i]; break; }
        if (!endPt || te - endPt.mi > 12) return { err: 'There is no value at or just before the end month.' };
      }
    }
    let p0 = null;
    for (let i = 0; i < pts.length; i++) if (pts[i].mi >= target) { p0 = pts[i]; break; }
    if (!p0) return { err: 'There is no value at or after the start month.' };
    if (p0.mi - target > 12) return { err: 'No data before ' + label(p0.key) + ' (the series starts there).' };
    const p1 = endPt;
    if (p1.mi <= p0.mi) return { err: 'The end must come after the start.' };
    const years = (p1.mi - p0.mi) / 12, ratio = p1.v / p0.v;
    const cg = D.cagr(p0.v, p1.v, years);
    return {
      ok: true, p0, p1, years, ratio, v0: p0.v, v1: p1.v,
      cagr: cg == null ? null : cg * 100,
      dbl: ratio > 1 ? D.doublingTime(ratio, years) : null,
      half: ratio < 1 && ratio > 0 ? (years * Math.LN2) / Math.log(1 / ratio) : null,
      shifted: p0.mi > target, anchored: !!p0.anchor, endClamped,
    };
  }

  /* ---------- deflators: the country's own price index, averaged to a year or quarter when the series is not monthly ---------- */
  // The UK has two: the CPI, from January 1988, and the RPI, which goes back further but includes owner-occupiers' mortgage
  // interest and a house depreciation cost based on house prices. A window that starts in 1988 or later uses the CPI, so house
  // prices are not deflated by an index that rises with them.
  const DEFL_ID = { US: 'cpi_u', GB: 'uk_rpi', CA: 'ca_cpi' };
  function deflId(country, startPt) { return country === 'GB' && startPt && startPt.t >= 1988 - 1e-9 && SER('uk_cpi') ? 'uk_cpi' : DEFL_ID[country]; }
  const DEFL = {};
  function deflFor(sid) {
    if (DEFL[sid]) return DEFL[sid];
    const m = new Map(), y = new Map();
    D.clean(ROWS(sid)).forEach((pt) => {
      m.set(pt.key, pt.v);
      const e = y.get(pt.y) || { s: 0, n: 0 };
      e.s += pt.v; e.n++;
      y.set(pt.y, e);
    });
    DEFL[sid] = { m, y, id: sid };
    return DEFL[sid];
  }
  function deflAt(sid, pt) {
    const d = deflFor(sid);
    if (pt.freq === 'M') return d.m.has(pt.key) ? d.m.get(pt.key) : null;
    if (pt.freq === 'A') { const e = d.y.get(pt.y); return e && e.n >= 9 ? e.s / e.n : null; }
    if (pt.freq === 'Q') {
      const v = [1, 2, 3].map((i) => d.m.get(pt.y + '-' + pad2((pt.q - 1) * 3 + i)));
      return v.every(fin) ? (v[0] + v[1] + v[2]) / 3 : null;
    }
    return null;
  }

  /* ---------- gold: one price per calendar year from data/history.js ---------- */
  const gold = (function () {
    const g = HIST && HIST.series && HIST.series.goldPrice && HIST.series.goldPrice.data;
    // a point flagged p: 1 is a part-year reading (2026 is one spot price), not an annual average, so that year is left empty
    const pts = Array.isArray(g) ? g.filter((d) => fin(d.y) && fin(d.v) && !d.p).sort((a, b) => a.y - b.y) : [];
    const exact = new Map(pts.map((d) => [d.y, d.v]));
    return {
      ok: pts.length > 0,
      // a year without a point has a price only when the points on both sides are equal (an official price held fixed)
      at(y) {
        if (exact.has(y)) return exact.get(y);
        let lo = null, hi = null;
        for (let i = 0; i < pts.length; i++) { if (pts[i].y < y) lo = pts[i]; else if (pts[i].y > y) { hi = pts[i]; break; } }
        return lo && hi && lo.v === hi.v ? lo.v : null;
      },
      meta: HIST && HIST.series && HIST.series.goldPrice ? HIST.series.goldPrice : null,
    };
  })();

  /* ---------- pay: monthly, and a yearly mean (a part year counts) ---------- */
  const pay = (function () {
    const rows = ROWS('pay_prod'), m = new Map(), y = new Map();
    D.clean(rows).forEach((pt) => m.set(pt.key, pt.v));
    D.annual(rows, { partial: true }).forEach((r) => y.set(r[0], r[1]));
    return {
      ok: m.size > 0,
      at(key) {
        const per = D.parsePeriod(key);
        if (!per) return null;
        if (per.freq === 'M') return m.has(per.key) ? m.get(per.key) : null;
        if (per.freq === 'A') return y.has(per.key) ? y.get(per.key) : null;
        const v = [1, 2, 3].map((i) => m.get(per.y + '-' + pad2((per.q - 1) * 3 + i)));
        return v.every(fin) ? (v[0] + v[1] + v[2]) / 3 : null;
      },
      annual: y,
      first: m.size ? Array.from(m.keys()).sort()[0] : null,
    };
  })();

  /* ---------- the first-class stamp: a monthly series from the cited changes in the rate (the rate in effect on the 15th) ---------- */
  let stampCache;
  function stampRows() {
    if (stampCache !== undefined) return stampCache;
    const s = CURS('stamp');
    stampCache = null;
    if (!s || !Array.isArray(s.data)) return null;
    const ev = s.data.filter((d) => fin(d.v) && /^\d{4}-\d{2}-\d{2}$/.test(d.p)).sort((a, b) => (a.p < b.p ? -1 : 1));
    if (!ev.length) return null;
    const end = D.parsePeriod(latestKey()), rows = [];
    let y = +ev[0].p.slice(0, 4), m = +ev[0].p.slice(5, 7), k = 0;
    while (y < end.y || (y === end.y && m <= end.m)) {
      const ref = y + '-' + pad2(m) + '-15';
      while (k + 1 < ev.length && ev[k + 1].p <= ref) k++;
      if (ev[k].p <= ref) rows.push([y + '-' + pad2(m), ev[k].v / 100]);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    stampCache = rows;
    return rows;
  }

  // cited start points that sit before a series begins (BLS January 1913 table): { seriesId: [{p, v, note}] }
  const ANCHORS = (function () {
    const out = {};
    if (CUR && CUR.series) {
      Object.keys(CUR.series).forEach((k) => {
        const c = CUR.series[k];
        if (c.kind === 'point' && c.compareWith && Array.isArray(c.data) && c.data.length) {
          out[c.compareWith] = c.data.filter((d) => fin(d.v)).map((d) => ({ p: d.p, v: d.v, note: d.note }));
        }
      });
    }
    return out;
  })();

  /* =====================================================================================
     2. measures: one list for the calculator and for the items chart
     ===================================================================================== */
  const ALL_UNITS = ['dollars', 'index', 'hours', 'gold'];
  const MEASURES = [];
  // m(id, country, group, label, short, source, opts). source: a data/prices.js series id, or 'stamp' for the curated stamp rates.
  function m(id, country, group, lab, short, source, o) {
    const x = Object.assign({
      id, country, group, label: lab, short, sid: source === 'stamp' ? null : source, cur: source === 'stamp' ? 'stamp' : null,
      units: ALL_UNITS, calc: true, chart: true, proxy: false, joined: false, priceIndex: false, ref: false, twin: null, money: 'usd',
    }, o || {});
    MEASURES.push(x);
    return x;
  }
  const IDX = ['index'];
  // United States
  m('cpi', 'US', 'prices', 'All consumer prices (CPI-U)', 'CPI-U', 'cpi_u', { units: IDX, priceIndex: true, ref: true });
  m('sodaIdx', 'US', 'prices', 'Soft drinks, price index', 'Soft drinks CPI', 'cpi_carbonated', { units: IDX, twin: 'cola' });
  m('pay', 'US', 'pay', 'Hourly pay, production workers', 'Pay', 'pay_prod', { units: ['dollars', 'index', 'gold'] });
  m('income', 'US', 'pay', 'Median household income, per year', 'Household income', 'income_median', { units: [], chart: false });
  m('cola', 'US', 'items', 'Cola, per 12 oz (proxy)', 'Cola (proxy)', 'price_soda_proxy_12oz', { units: ['dollars', 'hours', 'gold'], proxy: true, joined: true, twin: 'sodaIdx', calc: false });
  m('bread', 'US', 'items', 'Bread, per lb', 'Bread', 'price_bread');
  m('eggs', 'US', 'items', 'Eggs, per dozen', 'Eggs', 'price_eggs');
  m('milk', 'US', 'items', 'Milk, per gallon', 'Milk', 'price_milk');
  m('beef', 'US', 'items', 'Ground beef, per lb', 'Ground beef', 'price_beef_ground');
  m('coffee', 'US', 'items', 'Coffee, per lb', 'Coffee', 'price_coffee');
  m('sugar', 'US', 'items', 'Sugar, per lb', 'Sugar', 'price_sugar');
  m('gas', 'US', 'items', 'Gasoline, per gallon', 'Gasoline', 'price_gasoline');
  m('elec', 'US', 'items', 'Electricity, per kWh', 'Electricity', 'price_electricity');
  if (CURS('stamp')) m('stamp', 'US', 'items', 'First-class stamp', 'Stamp', 'stamp');
  m('house', 'US', 'homes', 'New house, median price', 'New house', 'house_new_median', { annualSid: 'house_new_median_annual' });
  m('hpi', 'US', 'homes', 'House price index (FHFA)', 'FHFA index', 'fhfa_hpi', { units: IDX });
  m('shiller', 'US', 'homes', 'House price index (Shiller, proxy)', 'Shiller index (proxy)', 'house_price_shiller', { units: IDX, proxy: true, calc: false });
  m('farm', 'US', 'homes', 'Farmland, per acre (proxy)', 'Farmland (proxy)', 'farmland_acre', { proxy: true });
  m('resid', 'US', 'homes', 'Residential land, per acre (proxy)', 'Residential land (proxy)', 'land_resid_acre', { units: ['dollars', 'hours', 'gold'], proxy: true, calc: false });
  // United Kingdom
  m('rpi', 'GB', 'prices', 'Retail prices (RPI)', 'RPI', 'uk_rpi', { units: IDX, priceIndex: true, ref: true, money: 'gbp' });
  m('rpiA', 'GB', 'prices', 'Retail prices (RPI), annual from 1800', 'RPI annual', 'uk_rpi_annual', { units: [], chart: false, priceIndex: true, money: 'gbp' });
  m('ukcpi', 'GB', 'prices', 'Consumer prices (CPI, from 1988)', 'CPI', 'uk_cpi', { units: IDX, priceIndex: true, ref: true, twin: 'rpi', money: 'gbp' });
  m('ukpay', 'GB', 'pay', 'Average weekly earnings', 'Earnings', 'uk_earnings_weekly', { units: IDX, money: 'gbp' });
  m('ukhouse', 'GB', 'homes', 'House price, average', 'House price', 'uk_house_price', { units: IDX, money: 'gbp' });
  // Canada
  m('cacpi', 'CA', 'prices', 'Consumer prices (CPI)', 'CPI', 'ca_cpi', { units: IDX, priceIndex: true, ref: true, money: 'cad' });
  m('cahouse', 'CA', 'homes', 'New house prices (NHPI)', 'House (NHPI)', 'ca_nhpi_house', { units: IDX, money: 'cad' });
  m('caland', 'CA', 'homes', 'Land prices (NHPI, proxy)', 'Land (NHPI, proxy)', 'ca_nhpi_land', { units: IDX, proxy: true, money: 'cad' });
  const BY_ID = {};
  MEASURES.forEach((x) => { BY_ID[x.id] = x; });

  const COUNTRIES = [
    { v: 'US', label: 'United States', short: 'US' },
    { v: 'GB', label: 'United Kingdom', short: 'UK' },
    { v: 'CA', label: 'Canada', short: 'Canada' },
  ];
  const GROUPS = { prices: 'Prices overall', pay: 'Pay and income', items: 'Everyday items', homes: 'Homes and land' };
  const GROUP_ORDER = ['items', 'pay', 'prices', 'homes']; // the items picker
  const CALC_ORDER = ['prices', 'pay', 'items', 'homes']; // the calculator's measure list

  // base rows of a measure in its own unit (dollars, pounds or an index). A cited stamp becomes dollars.
  function baseRows(x) {
    if (x.cur === 'stamp') return stampRows() || [];
    return ROWS(x.sid);
  }
  function firstLast(x) {
    const c = D.clean(baseRows(x));
    return c.length ? { first: c[0], last: c[c.length - 1] } : null;
  }
  // how to write a value of the measure in its own unit
  function fmtFor(x) {
    const s = x.sid ? SER(x.sid) : null;
    if (s && /^index/i.test(s.unit)) return fmtIdx;
    if (s && /^GBP/i.test(s.unit)) return fmtGbp;
    return fmtMoney;
  }

  /* =====================================================================================
     3. conversions: dollars, index, hours of work, ounces of gold
     ===================================================================================== */
  const UNITS = {
    dollars: { label: 'Dollars', axis: 'US dollars', fmt: fmtMoney, tick: (v) => tickNum(v, '$') },
    index: { label: 'Index, start = 100', axis: 'index, start of window = 100', fmt: fmtIdx, tick: (v) => tickNum(v) },
    hours: { label: 'Hours of work', axis: 'hours of work at average pay', fmt: fmtHours, tick: (v) => tickNum(v) },
    gold: { label: 'Ounces of gold', axis: 'troy ounces of gold', fmt: fmtOz, tick: (v) => tickNum(v) },
  };

  // apply fn to every value, keep gap rows, and write one gap row for a run of missing results
  function mapRows(rows, fn) {
    const out = [];
    rows.forEach((r) => {
      if (!r) return;
      const v = r[1];
      const o = fin(v) ? fn(r[0], v) : null;
      if (fin(o)) out.push([r[0], o]);
      else if (!out.length || out[out.length - 1][1] != null) out.push([r[0], null]);
    });
    while (out.length && out[0][1] == null) out.shift();
    return out;
  }

  const convCache = new Map();
  function itemRows(x, unit, since) {
    const key = x.id + '|' + unit + '|' + (unit === 'index' ? since : 0);
    if (convCache.has(key)) return convCache.get(key);
    const base = baseRows(x);
    let rows = null;
    if (base && base.length && x.units.indexOf(unit) >= 0) {
      if (unit === 'dollars') rows = base;
      else if (unit === 'index') { const rb = D.rebase(base, since); rows = rb ? rb.rows : null; }
      else if (unit === 'hours' && pay.ok) rows = mapRows(base, (k, v) => { const p = pay.at(k); return p > 0 ? v / p : null; });
      else if (unit === 'gold' && gold.ok) {
        rows = mapRows(base, (k, v) => { const per = D.parsePeriod(k), g = per ? gold.at(per.y) : null; return g > 0 ? v / g : null; });
      }
    }
    convCache.set(key, rows);
    return rows;
  }

  function whyNot(x, unit) {
    if (x.country !== 'US') return unit === 'index' ? '' : 'Needs US pay and US prices. Only the index view is shown for this country.';
    if (x.id === 'pay' && unit === 'hours') return 'Pay is the yardstick for hours of work.';
    if (x.units.length === 1 && x.units[0] === 'index') return 'This is an index with no dollar level, so it only appears in the index view.';
    if (x.id === 'cola' && unit === 'index') return 'The cola proxy joins different products, so it is not turned into an index.';
    if (x.id === 'resid' && unit === 'index') return 'Only 2012 to 2022 exist.';
    return 'Not available in this view.';
  }

  // can the measure be drawn in this unit for a window that starts in `since`? -> { ok, why }
  function availability(x, unit, since) {
    if (x.units.indexOf(unit) < 0) return { ok: false, why: whyNot(x, unit) };
    const fl = firstLast(x);
    if (!fl) return { ok: false, why: 'No data.' };
    if (unit === 'index') {
      if (fl.first.t > since + 1e-9) return { ok: false, why: 'Starts ' + label(fl.first.key) + ', after the start of this window.' };
      if (fl.last.t < since) return { ok: false, why: 'Ends ' + label(fl.last.key) + ', before this window.' };
      const rb = D.rebase(baseRows(x), since);
      const bp = rb ? D.parsePeriod(rb.base.key) : null;
      if (!bp || bp.t - since > 1) return { ok: false, why: 'No value near the start of this window.' };
      return { ok: true };
    }
    const end = fl.last.t + fl.last.step;
    if (end <= since) return { ok: false, why: 'Ends ' + label(fl.last.key) + ', before this window.' };
    if (unit === 'hours') {
      if (!pay.ok) return { ok: false, why: 'The pay series did not load.' };
      if (pay.first && fl.last.key < pay.first) return { ok: false, why: 'Pay starts in ' + label(pay.first) + '.' };
    }
    if (unit === 'gold' && !gold.ok) return { ok: false, why: 'The gold price did not load.' };
    const rows = itemRows(x, unit, since);
    if (!rows || !D.clean(rows).length) return { ok: false, why: 'No overlap with the ' + (unit === 'hours' ? 'pay' : 'gold') + ' series.' };
    return { ok: true };
  }

  /* colour slots: the first free one in the fixed order, avoiding a weak pair with those in use when one is free */
  const SLOTS = [
    { color: 'var(--c-blue)', shape: 'circle', name: 'blue' },
    { color: 'var(--c-orange)', shape: 'square', name: 'orange' },
    { color: 'var(--c-aqua)', shape: 'diamond', name: 'aqua' },
    { color: 'var(--c-yellow)', shape: 'triangle', name: 'yellow' },
    { color: 'var(--c-magenta)', shape: 'star', name: 'magenta' },
  ];
  const WEAK = { '1-3': 1, '1-4': 1, '2-4': 1 }; // orange/yellow, orange/magenta, aqua/magenta fail the all-pairs test
  function pickSlot(used) {
    const free = [];
    for (let i = 0; i < SLOTS.length; i++) if (used.indexOf(i) < 0) free.push(i);
    if (!free.length) return -1;
    for (let k = 0; k < free.length; k++) {
      const c = free[k];
      if (used.every((u) => !WEAK[Math.min(u, c) + '-' + Math.max(u, c)])) return c;
    }
    return free[0];
  }
  const MAX_DRAWN = SLOTS.length;

  /* =====================================================================================
     4. small interface pieces
     ===================================================================================== */
  // a segmented control. update(options, value) keeps the buttons when the option list is unchanged, so focus stays put.
  function segControl(cfg) {
    const seg = h('div', { class: 'seg' + (cfg.wrap ? ' pr-wrap' : ''), role: 'group', 'aria-label': cfg.label });
    const el = h('div', { class: 'tool' }, [h('span', { class: 'tool-label', text: cfg.label }), seg]);
    let sig = '', btns = new Map();
    function build(options) {
      clear(seg);
      btns = new Map();
      options.forEach((o) => {
        const b = h('button', { type: 'button', 'aria-pressed': 'false', text: o.label, onclick: () => { if (!b.disabled) cfg.onChange(o.v); } });
        btns.set(o.v, b);
        seg.appendChild(b);
      });
    }
    function update(options, value) {
      const s = options.map((o) => o.v + ':' + o.label).join('|');
      if (s !== sig) { sig = s; build(options); }
      options.forEach((o) => {
        const b = btns.get(o.v);
        U.setPressed(b, o.v === value);
        b.disabled = !!o.disabled;
        if (o.title) b.setAttribute('title', o.title); else b.removeAttribute('title');
      });
    }
    update(cfg.options, cfg.value);
    return { el, update };
  }

  // a heading with a kind badge and one line of text
  function kindLine(kind, text) {
    return h('p', { class: 'pr-kindline' }, [h('span', { class: 'badge pr-kind', text: kind }), ' ', text]);
  }

  function statusBox() {
    return h('p', { class: 'pr-status', role: 'status', 'aria-live': 'polite' });
  }

  // chart host with the table twin and the csv button. make(spec) creates the chart once.
  function chartBox(cfg) {
    const host = h('div', { class: 'pr-chart' });
    const tableHost = h('div', { class: 'pr-table', hidden: true, tabindex: '0', role: 'region', 'aria-label': cfg.tableLabel || 'Data table' });
    let chart = null, tableOn = false;
    const tbtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', title: 'Show the numbers behind this chart as a table', text: 'Show as table', onclick: () => setTable(!tableOn) });
    const cbtn = h('button', { class: 'btn', type: 'button', text: 'Download CSV', onclick: () => { if (chart) chart.downloadCsv(typeof cfg.csvName === 'function' ? cfg.csvName() : cfg.csvName); } });
    const el = h('div', { class: 'pr-box' }, [host, tableHost, h('div', { class: 'pr-actions' }, [tbtn, cbtn])]);
    function refresh() {
      if (!tableOn || !chart) return;
      clear(tableHost);
      chart.mountTable(tableHost);
    }
    function setTable(on) {
      tableOn = on;
      U.setPressed(tbtn, on);
      host.hidden = on;
      tableHost.hidden = !on;
      if (on) refresh(); else if (chart) chart.draw();
    }
    return {
      el, host,
      make(spec) { chart = TS.create(host, spec); return chart; },
      update(patch) { if (chart) { chart.update(patch); refresh(); } },
      get chart() { return chart; },
      refresh,
    };
  }

  // a definition list of label and value pairs
  function dl(pairs, cls) {
    return h('dl', { class: cls || 'pr-dl' }, pairs.filter(Boolean).map((p) => h('div', null, [h('dt', { text: p[0] }), h('dd', { text: p[1] })])));
  }

  // sources line for a series id: label, source and as-of, with the link
  function sourceLine(ids) {
    const bits = [];
    ids.forEach((id) => {
      const s = SER(id);
      if (!s) return;
      bits.push(h('span', { class: 'pr-srcitem' }, [U.link(s.source.replace(/\.$/, ''), s.url), ' (', s.sourceId, '; as of ' + label(s.asOf) + ')']));
    });
    const out = [];
    bits.forEach((b, i) => { if (i) out.push('; '); out.push(b); });
    return h('p', { class: 'chart-note pr-src' }, ['Source: '].concat(out));
  }

  // the break labels of the series that carry gaps, proxy status or definition changes
  function breakList(ids) {
    const items = [];
    ids.forEach((id) => {
      const s = SER(id);
      if (!s || !(s.breaks && s.breaks.length) && !s.proxy) return;
      const kids = [h('b', { text: s.label + (s.proxy ? ' (proxy)' : '') })];
      const ul = h('ul', { class: 'pr-breaks' });
      (s.breaks || []).forEach((b) => ul.appendChild(h('li', null, [h('span', { class: 'badge', text: b.kind }), ' ' + label(b.t) + ': ' + b.label])));
      if (!(s.breaks || []).length) ul.appendChild(h('li', { text: 'No gaps or definition changes recorded.' }));
      kids.push(ul);
      items.push(h('li', null, kids));
    });
    return items;
  }

  /* =====================================================================================
     5. page state, the address hash and the top of the page
     ===================================================================================== */
  const SINCE = { US: [1913, 1950, 1971, 1980, 1991, 2000, 2016], GB: [1971, 1980, 1991, 2000, 2016], CA: [1981, 1991, 2000, 2016] };
  const DEFAULT_ITEMS = {
    US: { unit: 'hours', since: 1980, scale: 'log', sel: ['cola', 'bread', 'stamp', 'house', 'cpi'] },
    GB: { unit: 'index', since: 2000, scale: 'log', sel: ['ukcpi', 'ukhouse', 'ukpay'] },
    CA: { unit: 'index', since: 1981, scale: 'log', sel: ['cacpi', 'cahouse', 'caland'] },
  };
  const DEFAULT_CALC = { US: 'cpi', GB: 'rpiA', CA: 'cacpi' };
  const cloneItems = (c) => ({ unit: DEFAULT_ITEMS[c].unit, since: DEFAULT_ITEMS[c].since, scale: DEFAULT_ITEMS[c].scale, sel: DEFAULT_ITEMS[c].sel.slice(), slots: {} });

  const state = {
    country: 'US',
    calc: { id: Object.assign({}, DEFAULT_CALC), custom: { sy: 2000, sm: 1, ey: null, em: null } },
    items: { US: cloneItems('US'), GB: cloneItems('GB'), CA: cloneItems('CA') },
    houses: { land: 'acres' },
    savings: { since: 1934 },
  };

  const cur = () => state.items[state.country];
  const countryName = (c) => COUNTRIES.find((x) => x.v === c).label;
  const countryThe = (c) => (c === 'GB' ? 'the ' : '') + countryName(c);

  // address hash: key=value pairs, read once at load and written (debounced) after a change; anything not on the lists is ignored
  function readHash() {
    const out = {};
    try {
      const raw = (window.location.hash || '').replace(/^#/, '');
      if (!raw || raw.indexOf('=') < 0) return out;
      raw.split('&').forEach((pair) => {
        const i = pair.indexOf('=');
        if (i > 0) out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
      });
    } catch (e) { /* a malformed address is ignored */ }
    return out;
  }
  function applyHash() {
    const q = readHash();
    if (!Object.keys(q).length) return;
    if (own(q, 'c') && COUNTRIES.some((x) => x.v === q.c)) state.country = q.c;
    const c = state.country, st = state.items[c];
    if (own(q, 'm') && BY_ID[q.m] && BY_ID[q.m].country === c && BY_ID[q.m].calc) state.calc.id[c] = q.m;
    if (own(q, 'u') && own(UNITS, q.u) && (c === 'US' || q.u === 'index')) st.unit = q.u;
    if (own(q, 's') && SINCE[c].indexOf(+q.s) >= 0) st.since = +q.s;
    if (own(q, 'sc') && (q.sc === 'log' || q.sc === 'linear')) st.scale = q.sc;
    if (own(q, 'i')) {
      const ids = q.i.split(',').filter((id, k, a) => BY_ID[id] && BY_ID[id].country === c && BY_ID[id].chart && a.indexOf(id) === k);
      if (ids.length) st.sel = ids.slice(0, MAX_DRAWN + 1);
    }
    if (own(q, 'lm') && (q.lm === 'acres' || q.lm === 'lot')) state.houses.land = q.lm;
    if (own(q, 'ss') && [1934, 1971, 1991, 2009].indexOf(+q.ss) >= 0) state.savings.since = +q.ss;
  }
  let hashTimer = null;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      try {
        const c = state.country, st = cur();
        const parts = ['c=' + c, 'm=' + state.calc.id[c], 'u=' + st.unit, 's=' + st.since, 'sc=' + st.scale, 'i=' + st.sel.join(','), 'lm=' + state.houses.land, 'ss=' + state.savings.since];
        window.history.replaceState(null, '', '#' + parts.join('&'));
      } catch (e) { /* an address that cannot be written is left alone */ }
    }, 150);
  }

  const sections = []; // { render(), id } in page order
  function renderAll() { sections.forEach((s) => s.render()); }
  function setCountry(c) {
    state.country = c;
    renderAll();
    writeHash();
  }

  /* ---------- as-of line ---------- */
  function asOfText() {
    const list = state.country === 'US'
      ? [['consumer prices', 'cpi_u'], ['pay', 'pay_prod'], ['new-house prices', 'house_new_median'], ['house price index', 'fhfa_hpi'], ['farmland', 'farmland_acre'], ['Treasury bill rate', 'tbill3m']]
      : state.country === 'GB'
        ? [['retail prices', 'uk_rpi'], ['consumer prices', 'uk_cpi'], ['earnings', 'uk_earnings_weekly'], ['house prices', 'uk_house_price']]
        : [['consumer prices', 'ca_cpi'], ['house price index', 'ca_nhpi_house']];
    const bits = list.filter((x) => SER(x[1])).map((x) => x[0] + ' ' + label(SER(x[1]).asOf));
    return 'Data files generated ' + P.generated + '. Newest observation for ' + bits.join(', ') + '. '
      + (state.country === 'US' ? 'The US Bureau of Labor Statistics has no values for October 2025 (a lapse in appropriations); that month is a gap, not an estimate.' : 'Each source is revised from time to time; the retrieval date is in the table at the end.');
  }

  /* ---------- jump chips ---------- */
  function jumpTo(id) {
    const el = $(id);
    if (!el || el.hidden) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    const hd = el.querySelector('h2');
    if (hd) { if (!hd.hasAttribute('tabindex')) hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
  }
  const JUMPS = [['doubling', 'Doubling time'], ['items', 'Items, homes and land'], ['pop', 'A can of pop'], ['houses', 'Homes and land against pay'], ['savings', 'Savings'], ['method', 'Method and sources']];
  function initJump() {
    const nav = $('pr-jump');
    JUMPS.forEach((j) => {
      const a = h('a', { class: 'chip pr-jumpchip', href: '#' + j[0], 'data-sec': j[0], text: j[1] });
      a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(j[0]); });
      nav.appendChild(a);
    });
  }
  function syncJump() {
    JUMPS.forEach((j) => {
      const a = document.querySelector('.pr-jumpchip[data-sec="' + j[0] + '"]'), sec = $(j[0]);
      if (a && sec) a.hidden = sec.hidden;
    });
  }

  /* ---------- the country control ---------- */
  let countrySeg = null;
  function initToolbar() {
    const host = $('pr-toolbar');
    countrySeg = segControl({
      label: 'Country', wrap: true, value: state.country,
      options: COUNTRIES.map((c) => ({ v: c.v, label: c.label })),
      onChange: (v) => setCountry(v),
    });
    const reset = h('button', {
      class: 'btn', type: 'button', text: 'Reset this page',
      onclick: () => {
        state.calc.id = Object.assign({}, DEFAULT_CALC);
        state.calc.custom = { sy: 2000, sm: 1, ey: null, em: null };
        ['US', 'GB', 'CA'].forEach((c) => { state.items[c] = cloneItems(c); });
        state.houses.land = 'acres';
        state.savings.since = 1934;
        renderAll();
        writeHash();
      },
    });
    const hint = h('p', { class: 'pr-hint', id: 'pr-country-hint' });
    host.appendChild(h('div', { class: 'tb-body' }, [h('div', { class: 'tb-row' }, [countrySeg.el, h('div', { class: 'tool-actions' }, [reset])]), hint]));
    sections.push({
      id: 'toolbar',
      render() {
        countrySeg.update(COUNTRIES.map((c) => ({ v: c.v, label: c.label })), state.country);
        hint.textContent = state.country === 'US'
          ? 'The United States has the full set: everyday items, pay, houses, land and savings.'
          : 'For ' + countryThe(state.country) + ' this data set has consumer prices and house prices' + (state.country === 'GB' ? ', and average earnings' : '') + ' only. Items, pop, land and savings are US sections.';
        const asof = $('pr-asof');
        if (asof) asof.textContent = asOfText();
        $('pop').hidden = state.country !== 'US';
        $('savings').hidden = state.country !== 'US';
        syncJump();
      },
    });
  }

  /* =====================================================================================
     6a. the doubling-time calculator
     ===================================================================================== */
  const WINDOWS = [
    { id: 'w1913', title: 'From 1913', sub: 'January 1913, the first month of the US CPI-U record', win: { kind: 'fixed', y: 1913, m: 1 } },
    { id: 'w1971', title: 'From Aug 1971', sub: 'The month the US stopped exchanging dollars for gold', win: { kind: 'fixed', y: 1971, m: 8 } },
    { id: 'w1991', title: 'From Sep 1991', sub: 'A start after the Great Inflation had ended', win: { kind: 'fixed', y: 1991, m: 9 } },
    { id: 'wl10', title: 'Last 10 years', sub: 'The ten years to the newest observation', win: { kind: 'last', n: 10 } },
    { id: 'wl5', title: 'Last 5 years', sub: 'The five years to the newest observation', win: { kind: 'last', n: 5 } },
    { id: 'w2020', title: 'From Feb 2020', sub: 'The month before the 2020 shock', win: { kind: 'fixed', y: 2020, m: 2 } },
  ];

  function calcRows(x) { return baseRows(x); }
  const calcPtsCache = new Map();
  function calcPts(x) {
    if (!calcPtsCache.has(x.id)) calcPtsCache.set(x.id, calcPoints(calcRows(x), x.sid && own(ANCHORS, x.sid) ? ANCHORS[x.sid] : null));
    return calcPtsCache.get(x.id);
  }

  // 'about' means a doubling time within PACE_TOLERANCE years of 17, the same rule as on the Start page
  function paceWord(dbl) {
    const v = D.paceVerdict(dbl);
    if (v == null) return null;
    if (v === 'about') return 'About the 17-year pace (within ' + D.PACE_TOLERANCE + ' years)';
    return v === 'faster' ? 'Faster than the 17-year pace' : 'Slower than the 17-year pace';
  }

  // the numbers of one window as a list of definition pairs and notes, for a measure x
  function windowFacts(x, res) {
    const f = fmtFor(x);
    const rows = [
      ['Growth a year', fmtPct(res.cagr, 2)],
      ['Total change', fmtTimes(res.ratio)],
      ['Values', f(res.v0) + ' to ' + f(res.v1)],
    ];
    if (x.priceIndex) {
      const pp = D.purchasingPower(res.v0, res.v1);
      rows.push(['Buying power kept', pp == null ? 'n/a' : fmtPct(pp * 100, 1)]);
    } else {
      const sid = deflId(x.country, res.p0);
      const d0 = deflAt(sid, res.p0), d1 = deflAt(sid, res.p1);
      const real = fin(d0) && fin(d1) && d0 > 0 && d1 > 0 ? (res.ratio / (d1 / d0) - 1) * 100 : null;
      rows.push(['After consumer prices' + (x.country === 'GB' ? (sid === 'uk_cpi' ? ' (CPI)' : ' (RPI)') : ''), real == null ? 'n/a' : D.format(real, 'sgn1') + '%']);
    }
    return rows;
  }

  function meter(dbl) {
    const max = 40, w = Math.min(dbl, max) / max;
    const fill = h('span', { class: 'pr-meter-fill' });
    fill.style.width = (w * 100).toFixed(1) + '%';
    const tick = h('span', { class: 'pr-meter-tick' });
    tick.style.left = ((17 / max) * 100).toFixed(2) + '%';
    const cap = h('span', { class: 'pr-meter-cap', 'aria-hidden': 'true' }, [h('span', { text: '0' }), h('span', { class: 'pr-meter-17', text: '17' }), h('span', { text: '40+ years' })]);
    return h('div', { class: 'pr-meter', 'aria-hidden': 'true' }, [h('div', { class: 'pr-meter-track' }, [fill, tick]), cap]);
  }

  // result block for one window (not the title)
  function resultBlock(x, res) {
    if (!res || res.err) return h('p', { class: 'pr-noresult', text: res ? res.err : 'No result.' });
    const kids = [];
    const months = Math.round(res.years * 12);
    kids.push(h('p', { class: 'pr-win-span num', text: label(res.p0.key) + ' to ' + label(res.p1.key) + ', ' + (res.years < 1 ? months + (months === 1 ? ' month' : ' months') : nf(res.years, 1) + ' years') }));
    const short = res.years < 1;
    let big, bigSub;
    if (short) {
      // under a year a yearly rate or a doubling time would stretch a few months over decades, so the plain change is shown
      const pc = (res.ratio - 1) * 100;
      big = (pc < 0 ? 'Fell ' : 'Rose ') + fmtPct(Math.abs(pc), Math.abs(pc) < 1 ? 2 : 1);
      bigSub = 'over ' + months + (months === 1 ? ' month' : ' months');
    } else if (res.dbl != null) { big = nf(res.dbl, 1); bigSub = 'years to double'; }
    else if (res.ratio < 1) { const fall = (1 - res.ratio) * 100; big = fall < 1 ? 'Fell slightly' : 'Fell ' + nf(fall, 0) + '%'; bigSub = res.half != null ? 'halves every ' + nf(res.half, 1) + ' years' : ''; }
    else { big = 'No growth'; bigSub = ''; }
    kids.push(h('p', { class: 'pr-win-big' }, [h('span', { class: 'pr-big num', text: big }), ' ', h('span', { class: 'pr-bigsub', text: bigSub })]));
    if (short) kids.push(h('p', { class: 'chart-note', text: 'A window shorter than a year is shown as a plain change. A yearly rate, a doubling time and the 17-year comparison would stretch a few months over decades, so they are not shown.' }));
    if (!short && res.dbl != null) kids.push(meter(res.dbl));
    const word = short ? null : paceWord(res.dbl);
    if (word) kids.push(h('p', { class: 'pr-pace', text: word }));
    const facts = windowFacts(x, res);
    kids.push(dl(short ? facts.filter((r) => r[0] !== 'Growth a year') : facts));
    if (res.endClamped) kids.push(h('p', { class: 'chart-note', text: 'The series ends in ' + label(res.p1.key) + ', so the window ends there.' }));
    if (res.shifted) kids.push(h('p', { class: 'chart-note', text: 'No value in the requested start month, so the first available one is used (' + label(res.p0.key) + ').' }));
    if (res.anchored) kids.push(h('p', { class: 'chart-note', text: 'The start value is a cited January 1913 figure from a BLS table. The product definition is not the same as today\'s series, so treat it as indicative.' }));
    return h('div', { class: 'pr-result' }, kids);
  }

  function initCalc() {
    const host = $('pr-calc');
    const sel = h('select', { class: 'input pr-select', id: 'pr-calc-sel', onchange: () => { state.calc.id[state.country] = sel.value; render(); writeHash(); } });
    const selField = h('div', { class: 'tool pr-selwrap' }, [h('label', { class: 'tool-label', for: 'pr-calc-sel', text: 'Measure' }), sel]);
    const selNote = h('p', { class: 'pr-hint' });
    const wins = h('div', { class: 'pr-wins', role: 'list' });
    const verdict = h('div', { class: 'pr-methodnote pr-verdict' });
    const tableHost = h('div', { class: 'pr-table tableview', tabindex: '0', role: 'region', 'aria-label': 'The windows as a table' });
    const tableDetails = h('details', { class: 'pr-details' }, [h('summary', { text: 'The same figures as a table' }), tableHost]);
    const rollHead = h('h3', { class: 'pr-h3', id: 'pr-roll-h' });
    const rollNote = h('p', { class: 'chart-note', text: 'Each point is the growth a year over the ten years before it. The dotted lines mark the growth that doubles prices in 17 years and the 2 percent a year that many central banks aim for.' });
    const roll = chartBox({ tableLabel: 'Rolling growth as a table', csvName: () => 'prices-rolling-growth-' + state.calc.id[state.country] + '.csv' });
    const src = h('div', { class: 'pr-srcbox' });
    const methodNote = h('div', { class: 'pr-methodnote' }, [
      kindLine('Method', 'Growth a year is (end / start) to the power 1 / years, minus 1. Doubling time is ln 2 / ln(1 + growth). The rule of 70 (70 divided by the percent) is only a shortcut. Each window ends at the newest observation of the series and starts at the month named, or at the first value after it. Monthly series are not seasonally adjusted except pay. A window shorter than a year is shown as a plain change. Roughly 17 years means within ' + D.PACE_TOLERANCE + ' years of 17, the same rule as on the Start page.'),
    ]);

    // the custom window card is built once so its inputs keep focus while the result changes
    const cu = state.calc.custom;
    const mkMonth = (id, withLatest) => {
      const s = h('select', { class: 'input pr-mo', id, 'aria-label': id === 'pr-sm' ? 'Start month' : 'End month' });
      if (withLatest) s.appendChild(h('option', { value: '', text: 'Latest' }));
      MONTHS.forEach((mn, i) => s.appendChild(h('option', { value: String(i + 1), text: mn })));
      return s;
    };
    const sm = mkMonth('pr-sm', false), em = mkMonth('pr-em', true);
    const sy = h('input', { class: 'input pr-yr', id: 'pr-sy', type: 'number', inputmode: 'numeric', step: '1', 'aria-label': 'Start year' });
    const ey = h('input', { class: 'input pr-yr', id: 'pr-ey', type: 'number', inputmode: 'numeric', step: '1', placeholder: 'latest', 'aria-label': 'End year (blank for the latest)' });
    sm.value = String(cu.sm); sy.value = String(cu.sy);
    const customResult = h('div', { class: 'pr-customres', 'aria-live': 'polite' });
    const customCard = h('article', { class: 'pr-win pr-win--custom', role: 'listitem', 'aria-label': 'Your window' }, [
      h('h3', { class: 'pr-win-title', text: 'Your window' }),
      h('p', { class: 'pr-win-sub', text: 'Choose a start and an end. Leave the end blank for the latest value.' }),
      h('div', { class: 'pr-fields' }, [
        h('div', { class: 'pr-fieldrow' }, [h('span', { class: 'pr-fl', text: 'Start' }), sm, sy]),
        h('div', { class: 'pr-fieldrow' }, [h('span', { class: 'pr-fl', text: 'End' }), em, ey]),
      ]),
      customResult,
    ]);
    function readCustom() {
      const yy = parseInt(sy.value, 10);
      cu.sy = isFinite(yy) ? yy : null;
      cu.sm = parseInt(sm.value, 10) || 1;
      const ee = parseInt(ey.value, 10);
      cu.ey = isFinite(ee) ? ee : null;
      cu.em = parseInt(em.value, 10) || null;
      renderCustom();
      renderTable();
    }
    [sm, sy, em, ey].forEach((el) => { el.addEventListener('input', readCustom); el.addEventListener('change', readCustom); });

    let winEls = [];
    // the end is the newest value unless a year is typed; a typed year without a month ends in December
    function customResultFor(x) {
      const pts = calcPts(x);
      if (!pts.length) return { err: 'This series has no data.' };
      if (cu.sy == null) return { err: 'Enter a start year.' };
      const last = pts[pts.length - 1];
      const ey2 = cu.ey != null ? cu.ey : last.y;
      const em2 = cu.ey != null ? (cu.em || 12) : (last.freq === 'M' ? last.m : last.freq === 'Q' ? last.q * 3 : 12);
      return evalWindow(pts, { kind: 'custom', sy: cu.sy, sm: cu.sm, ey: ey2, em: em2 });
    }
    function renderCustom() {
      const x = BY_ID[state.calc.id[state.country]];
      clear(customResult);
      customResult.appendChild(resultBlock(x, customResultFor(x)));
    }
    function winRows(x) {
      const pts = calcPts(x);
      return WINDOWS.map((w) => ({ w, res: evalWindow(pts, w.win) })).concat([{ w: { id: 'wcustom', title: 'Your window' }, res: customResultFor(x) }]);
    }
    function renderTable() {
      const x = BY_ID[state.calc.id[state.country]], f = fmtFor(x);
      const rows = winRows(x).map((r) => {
        if (!r.res || r.res.err) return [r.w.title, r.res ? r.res.err : 'n/a', '', '', '', '', '', ''];
        return [r.w.title, label(r.res.p0.key) + (r.res.anchored ? ' (cited, indicative)' : ''), label(r.res.p1.key), nf(r.res.years, 1), f(r.res.v0) + ' to ' + f(r.res.v1), fmtTimes(r.res.ratio), fmtPct(r.res.cagr, 2), r.res.dbl != null ? nf(r.res.dbl, 1) : 'n/a'];
      });
      U.table(tableHost, x.label + ': the fixed windows and yours', [
        { label: 'Window' }, { label: 'From' }, { label: 'To' }, { label: 'Years' }, { label: 'Values' }, { label: 'Total change' }, { label: 'Growth a year' }, { label: 'Years to double' },
      ], rows);
    }

    function fillSelect() {
      const c = state.country;
      clear(sel);
      const groups = {};
      MEASURES.filter((x) => x.country === c && x.calc).forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x); });
      CALC_ORDER.forEach((g) => {
        if (!groups[g]) return;
        const og = h('optgroup', { label: GROUPS[g] });
        groups[g].forEach((x) => og.appendChild(h('option', { value: x.id, text: x.label })));
        sel.appendChild(og);
      });
      sel.value = state.calc.id[c];
    }

    let rolling = null;
    function render() {
      const c = state.country, x = BY_ID[state.calc.id[c]];
      if (!sel.options.length || sel.getAttribute('data-c') !== c) { fillSelect(); sel.setAttribute('data-c', c); }
      sel.value = x.id;
      const pts = calcPts(x), last = pts.length ? pts[pts.length - 1] : null;
      sm.disabled = !!(last && last.freq === 'A');
      selNote.textContent = last ? 'Source series ' + (x.sid || 'stamp rates (USPS)') + ', ' + (last.freq === 'M' ? 'monthly' : last.freq === 'Q' ? 'quarterly' : 'annual') + ', '
        + label(pts[0].key) + ' to ' + label(last.key) + (x.proxy ? '. A proxy.' : '.') : '';
      // fixed windows
      clear(wins);
      winEls = [];
      const all = winRows(x);
      all.slice(0, WINDOWS.length).forEach((r) => {
        const card = h('article', { class: 'pr-win', role: 'listitem', 'aria-label': r.w.title }, [
          h('h3', { class: 'pr-win-title', text: r.w.title }),
          h('p', { class: 'pr-win-sub', text: r.w.sub }),
          resultBlock(x, r.res),
        ]);
        wins.appendChild(card);
      });
      wins.appendChild(customCard);
      renderCustom();
      // reading of the fixed windows against the 17-year pace
      const fixed = all.slice(0, WINDOWS.length).filter((r) => r.res && r.res.ok && r.res.cagr != null && r.res.years >= 1);
      const kinds = fixed.map((r) => D.paceVerdict(r.res.dbl, r.res.ratio <= 1));
      const about = kinds.filter((k) => k === 'about').length, faster = kinds.filter((k) => k === 'faster').length, slower = kinds.filter((k) => k === 'slower').length;
      verdict.replaceChildren(kindLine('Measured', fixed.length
        ? 'A steady ' + fmtPct(RATE_17, 2) + ' a year doubles a quantity in 17 years. For this series (' + x.label + '), the doubling time was within ' + D.PACE_TOLERANCE + ' years of 17 in ' + about + ' of the ' + fixed.length + ' fixed windows with data, shorter in ' + faster + ' and longer in ' + slower + '. The pace is a property of the window chosen, not a constant.'
        : 'No fixed window has data for this series. Try your own window.'));
      renderTable();
      // rolling growth
      const rows = x.cur === 'stamp' ? stampRows() : calcRows(x);
      const rg = D.rollingCagr(rows, 10);
      rollHead.textContent = 'Growth a year over the previous ten years: ' + x.label;
      const spec = {
        title: 'Growth a year over the previous ten years, ' + x.label,
        series: [{ id: 'roll', name: x.short + ', growth a year over the previous 10 years', short: x.short, color: 'var(--accent)', shape: 'circle', rows: rg, carry: last && last.freq === 'A', unit: '% a year' }],
        y: { scale: 'linear', fmt: (v) => fmtPct(v, 1), tickFmt: (v) => nf(v, 0) + '%', title: '% a year', zero: 'auto' },
        refLines: [{ y: RATE_17, label: fmtPct(RATE_17, 2) + ': doubles in 17 years', kind: 'guide' }, { y: 2, label: '2%: doubles in ' + nf(D.doublingFromRate(0.02), 0) + ' years', kind: 'guide' }],
        height: 280, empty: 'There are not ten years of data for this series.', legend: false,
        table: { caption: 'Growth a year over the previous ten years, ' + x.label, filename: 'prices-rolling-growth.csv' },
      };
      if (!rolling) rolling = roll.make(spec); else roll.update(spec);
      // sources
      clear(src);
      if (x.cur === 'stamp') {
        const s = CURS('stamp'), so = CUR.sources && CUR.sources[s.sourceId] ? CUR.sources[s.sourceId] : null;
        src.appendChild(h('p', { class: 'chart-note pr-src' }, ['Source: ', so ? U.link(so.title + ', ' + so.publisher, so.url) : s.source, '. ', s.notes]));
      } else if (x.sid) src.appendChild(sourceLine([x.sid]));
      const bl = breakList([x.sid]);
      if (bl.length) src.appendChild(h('details', { class: 'pr-details' }, [h('summary', { text: 'Gaps and definition changes in this series' }), h('ul', { class: 'pr-bl' }, bl)]));
    }

    host.appendChild(h('div', { class: 'tb-row pr-calcrow' }, [selField, selNote]));
    host.appendChild(wins);
    host.appendChild(verdict);
    host.appendChild(tableDetails);
    host.appendChild(methodNote);
    host.appendChild(rollHead);
    host.appendChild(roll.el);
    host.appendChild(rollNote);
    host.appendChild(src);
    sections.push({ id: 'doubling', render });
  }

  /* =====================================================================================
     6b. everyday items, homes and land
     ===================================================================================== */
  function trimRows(rows, t0) {
    const out = [];
    rows.forEach((r) => {
      const per = D.parsePeriod(r[0]);
      if (per && per.t >= t0 - 1e-9) out.push(r);
    });
    while (out.length && out[0][1] == null) out.shift();
    return out;
  }
  // one gap row wherever a month, quarter or year is missing between two values
  function fillGaps(rows) {
    const out = [];
    let prev = null;
    rows.forEach((r) => {
      const per = D.parsePeriod(r[0]);
      if (!per) return;
      const mi1 = mi(per), st = stepMonths(per.freq);
      if (prev && r[1] != null && prev.v != null && mi1 - prev.mi > st) {
        out.push([D.shiftPeriod(prev.per, 1), null]);
      }
      out.push(r);
      prev = { mi: mi1, v: r[1], per };
    });
    return out;
  }

  // the short name without its "(proxy)" tag
  const plainShort = (x) => x.short.replace(/\s*\((?:[A-Za-z]+, )?proxy\)/, '');

  function unitNote(unit, S) {
    const ph = pay.first ? label(pay.first) : 'January 1964';
    if (unit === 'hours') return 'Hours of work = price divided by average hourly earnings of production and nonsupervisory workers in the same month; a yearly series uses that year\'s mean pay. A full-time year is taken as ' + nf(HOURS_PER_YEAR, 0) + ' hours (40 hours x 52 weeks), which is an assumption. The pay series starts in ' + ph + ', so these lines cannot start earlier. Pay is an average for a changing mix of jobs, not the pay of a typical worker.';
    if (unit === 'dollars') return 'Dollars as published, each item in its own unit (per lb, per dozen, per gallon, per letter, per house, per acre). Compare how each line changes, not where the lines sit.';
    if (unit === 'index') return 'Every line is 100 in January ' + S + ' (the first value after it for a yearly or quarterly series). A line is drawn only if it has a value for that month, so no line is rebased from a later start. The grey line is consumer prices.';
    return 'Price divided by the price of one troy ounce of gold in the same calendar year, from data/history.js: annual averages from 1971 and official prices before that (there is none for 1969 and 1970, which are left empty). The file has only a single spot reading for 2026, not an annual average, so 2026 is left empty and these lines end in 2025. A price in ounces falls when gold rises faster than the item.';
  }
  function titleFor(unit, S, c) {
    const tail = ', from ' + S;
    if (unit === 'hours') return 'Hours of work to buy each item' + tail;
    if (unit === 'dollars') return 'Price of each item in dollars' + tail;
    if (unit === 'gold') return 'Price of each item in ounces of gold' + tail;
    return (c === 'US' ? 'Each item indexed to 100 in ' : 'Each series indexed to 100 in ') + S;
  }
  function polarityNote(unit) {
    if (unit === 'hours') return 'Left of x1: fewer hours of work than at the start of the window. Right of x1: more.';
    if (unit === 'gold') return 'Left of x1: fewer ounces of gold than at the start of the window. Right of x1: more.';
    return 'Left of x1: lower than at the start of the window. Right of x1: higher.';
  }

  function initItems() {
    const host = $('pr-items'), subEl = $('items-sub');
    const status = statusBox();
    const unitSeg = segControl({ label: 'Unit', wrap: true, value: 'hours', options: [], onChange: (u) => { cur().unit = u; renderItems(); writeHash(); } });
    const sinceSeg = segControl({ label: 'Window starts', wrap: true, value: 1980, options: [], onChange: (y) => { cur().since = y; renderItems(); writeHash(); } });
    const scaleSeg = segControl({ label: 'Scale', value: 'log', options: [], onChange: (v) => { cur().scale = v; renderItems(); writeHash(); } });
    const reset = h('button', { class: 'btn', type: 'button', text: 'Default items', onclick: () => { state.items[state.country] = cloneItems(state.country); renderItems(); writeHash(); status.textContent = 'Back to the default view.'; } });
    const hint = h('p', { class: 'pr-hint' });
    const pickerBody = h('div', { class: 'pr-picker-body' });
    const summary = h('summary', { class: 'pr-picker-sum' });
    const picker = h('details', { class: 'pr-picker' }, [summary, pickerBody]);
    if (!window.matchMedia || window.matchMedia('(min-width: 640px)').matches) picker.open = true;
    const box = chartBox({ tableLabel: 'Items chart as a table', csvName: () => 'prices-items-' + state.country + '-' + cur().unit + '-' + cur().since + '.csv' });
    const skippedEl = h('p', { class: 'chart-note pr-skipped' });
    const panelNoteEl = h('p', { class: 'chart-note' });
    const unitNoteEl = h('div', { class: 'pr-methodnote' });
    const proxyEl = h('p', { class: 'chart-note pr-proxy' });
    const gapsEl = h('div', { class: 'pr-gaps' });
    const barsHead = h('h3', { class: 'pr-h3', text: 'Then and now' });
    const barsSub = h('div', { class: 'pr-methodnote' });
    const barsHost = h('div', { class: 'pr-bars' });
    const barsNote = h('p', { class: 'chart-note' });
    const srcEl = h('div', { class: 'pr-srcbox' });
    let chart = null, ratio = null;

    // the change from the first annual value at or after the window start to the newest annual value, in the unit chosen
    function annualChange(x, unit, S) {
      const a = D.clean(ROWS(x.annualSid));
      const conv = (pt) => {
        if (unit === 'hours') { const p = pay.at(String(pt.y)); return p > 0 ? pt.v / p : null; }
        if (unit === 'gold') { const g = gold.at(pt.y); return g > 0 ? pt.v / g : null; }
        return pt.v;
      };
      const p0 = a.find((pt) => pt.y >= S), p1 = a[a.length - 1];
      if (!p0 || !p1 || p1.y <= p0.y) return null;
      const v0 = conv(p0), v1 = conv(p1);
      return v0 > 0 && v1 > 0 ? { ratio: v1 / v0, y0: p0.y, y1: p1.y } : null;
    }

    // can the measure be drawn now, directly or through its twin? -> { ok, why, via }
    function effective(x, st) {
      const a = availability(x, st.unit, st.since);
      if (a.ok) return { ok: true, via: x };
      if (x.twin && BY_ID[x.twin] && st.sel.indexOf(x.twin) < 0 && BY_ID[x.twin].country === x.country) {
        const t = BY_ID[x.twin], b = availability(t, st.unit, st.since);
        if (b.ok) return { ok: true, via: t, twin: true };
        if (x.units.indexOf(st.unit) < 0) return { ok: false, why: a.why + ' ' + t.short + ' stands in for it here, but: ' + b.why };
      }
      return { ok: false, why: a.why };
    }
    function drawnList(st) {
      const out = [];
      st.sel.forEach((id) => {
        const x = BY_ID[id];
        if (!x || x.country !== state.country) return;
        const e = effective(x, st);
        if (e.ok) out.push({ x: e.via, selId: id, twin: !!e.twin });
      });
      return out;
    }
    // A colour stays with its item while the item is selected, even when this view cannot draw it, so it comes back the same.
    // A slot is taken from an item that is selected but not drawn only when every slot is in use.
    function syncSlots(st, drawn) {
      const live = {};
      drawn.forEach((d) => { if (!d.x.ref) live[d.selId] = true; });
      Object.keys(st.slots).forEach((k) => { if (st.sel.indexOf(k) < 0) delete st.slots[k]; });
      drawn.forEach((d) => {
        if (d.x.ref || own(st.slots, d.selId)) return;
        let slot = pickSlot(Object.keys(st.slots).map((k) => st.slots[k]));
        if (slot < 0) {
          const idle = Object.keys(st.slots).find((k) => !live[k]);
          if (idle) { slot = st.slots[idle]; delete st.slots[idle]; }
        }
        if (slot >= 0) st.slots[d.selId] = slot;
      });
    }
    const colourCount = (st) => drawnList(st).filter((d) => !d.x.ref).length;

    function toggleItem(id) {
      const st = cur(), x = BY_ID[id], i = st.sel.indexOf(id);
      if (i >= 0) {
        st.sel.splice(i, 1);
        delete st.slots[id];
        status.textContent = x.label + ' removed.';
      } else {
        const e = effective(x, st);
        if (!e.ok) { status.textContent = x.label + ' is not available in this view: ' + e.why; return; }
        if (!x.ref && colourCount(st) >= MAX_DRAWN) { status.textContent = 'Up to five items are drawn at a time. Remove one first.'; return; }
        st.sel.push(id);
        status.textContent = x.label + ' added.';
      }
      renderItems();
      writeHash();
    }

    function renderPicker(st, drawn) {
      const active = document.activeElement;
      const keepId = active && active.closest && active.closest('.pr-picker-body') ? active.getAttribute('data-id') : null;
      clear(pickerBody);
      const bySel = {};
      drawn.forEach((d) => { bySel[d.selId] = d; });
      GROUP_ORDER.forEach((g) => {
        const list = MEASURES.filter((x) => x.country === state.country && x.chart && x.group === g);
        if (!list.length) return;
        const chips = list.map((x) => {
          const on = st.sel.indexOf(x.id) >= 0, e = effective(x, st), d = bySel[x.id];
          const kids = [];
          if (d) {
            const sw = h('span', { class: 'swatch', 'aria-hidden': 'true' });
            sw.style.setProperty('--c', d.x.ref ? 'var(--ink-2)' : SLOTS[st.slots[x.id]] ? SLOTS[st.slots[x.id]].color : 'var(--faint)');
            kids.push(sw);
          }
          kids.push(h('span', { text: x.short }));
          const why = e.ok ? '' : e.why;
          const b = h('button', {
            class: 'chip pr-chip', type: 'button', 'data-id': x.id, 'aria-pressed': on ? 'true' : 'false',
            'aria-disabled': e.ok ? null : 'true', title: why ? x.label + ': ' + why : x.label + (d && d.twin ? ' (drawn as ' + d.x.label + ')' : ''),
            onclick: () => toggleItem(x.id),
          }, kids);
          return b;
        });
        pickerBody.appendChild(h('div', { class: 'pr-group' }, [h('div', { class: 'pr-group-title', text: GROUPS[g] }), h('div', { class: 'pr-chips' }, chips)]));
      });
      const n = drawn.filter((d) => !d.x.ref).length;
      summary.textContent = 'Choose items (' + n + ' of ' + MAX_DRAWN + ' drawn)';
      if (keepId) { const again = pickerBody.querySelector('[data-id="' + keepId + '"]'); if (again) again.focus(); }
    }

    function renderItems() {
      const c = state.country, st = cur(), unit = st.unit, S = st.since;
      const uopts = ALL_UNITS.map((u) => ({ v: u, label: UNITS[u].label, disabled: c !== 'US' && u !== 'index', title: c !== 'US' && u !== 'index' ? 'Needs US pay and US prices' : '' }));
      unitSeg.update(uopts, unit);
      sinceSeg.update(SINCE[c].map((y) => ({ v: y, label: String(y) })), S);
      scaleSeg.update([{ v: 'log', label: 'Log' }, { v: 'linear', label: 'Linear' }], st.scale);
      hint.textContent = c === 'US' ? '' : 'Dollars, hours of work and ounces of gold need US prices and US pay, so ' + countryThe(c) + ' is shown as an index.';
      subEl.textContent = (c === 'US' ? 'Everyday items, pay, houses and land' : 'Consumer prices and housing' + (c === 'GB' ? ', and earnings' : '')) + ' in ' + countryThe(c) + '. Choose a unit, a start year and up to five items. A proxy stands in for something not measured directly; gaps are left empty.';

      const drawn = drawnList(st);
      syncSlots(st, drawn);
      const shown = drawn.filter((d) => d.x.ref || own(st.slots, d.selId));
      renderPicker(st, shown);

      // series, coloured ones in slot order, the reference line last
      const infos = [];
      shown.forEach((d) => {
        const rows = itemRows(d.x, unit, S);
        if (!rows) return;
        const trimmed = unit === 'index' ? rows : trimRows(rows, S - 1);
        const cl = D.clean(trimmed);
        if (!cl.length) return;
        const slot = d.x.ref ? null : st.slots[d.selId];
        infos.push({ d, x: d.x, rows: trimmed, cl, slot, freq: cl[0].freq });
      });
      infos.sort((a, b) => (a.x.ref ? 1 : 0) - (b.x.ref ? 1 : 0) || (a.slot == null ? 99 : a.slot) - (b.slot == null ? 99 : b.slot));
      const bases = {}, joinedIds = {};
      infos.forEach((inf) => { if (inf.x.joined) joinedIds[inf.d.selId] = inf.x; });
      // In dollars, hours and ounces of gold the items sit orders of magnitude apart, and one axis would flatten the small
      // ones (never a second scale on one chart). Items within a factor of 100 of each other share a panel; each panel has its
      // own axis. An index starts every line at 100, so it is always one panel.
      const panelOf = {};
      let panels = [{ id: 'main' }];
      if (unit !== 'index') {
        const level = (inf) => {
          const v = inf.cl.filter((pt) => pt.t >= S - 1e-9 && pt.v > 0).map((pt) => pt.v).sort((a, b) => a - b);
          return v.length ? v[Math.floor(v.length / 2)] : 1;
        };
        const groups = [];
        infos.filter((inf) => !inf.x.ref).map((inf) => ({ inf, lv: level(inf) })).sort((a, b) => a.lv - b.lv).forEach((e) => {
          const g = groups[groups.length - 1];
          if (g && e.lv / g[0].lv <= 100) g.push(e); else groups.push([e]);
        });
        if (groups.length > 1) {
          panels = groups.map((g, i) => {
            const names = g.map((e) => plainShort(e.inf.x));
            g.forEach((e) => { panelOf[e.inf.d.selId] = 'p' + i; });
            return { id: 'p' + i, title: names.length > 4 ? names.slice(0, 4).join(', ') + ' and ' + (names.length - 4) + ' more' : names.join(', '), endLabels: true };
          });
        }
      }
      const multi = panels.length > 1;
      const series = infos.map((inf) => {
        const first = inf.cl.find((pt) => pt.t >= S - 1e-9) || inf.cl[0];
        bases[inf.d.selId] = first;
        const slot = inf.slot == null ? null : SLOTS[inf.slot];
        return {
          id: inf.d.selId, name: inf.x.label + (inf.x.proxy && !/proxy/.test(inf.x.label) ? ' (proxy)' : ''), short: inf.x.short,
          color: slot ? slot.color : 'var(--ink-2)', shape: slot ? slot.shape : 'circle', role: inf.x.ref ? 'ref' : 'data',
          rows: inf.rows, carry: inf.freq === 'A', endLabel: true, panel: own(panelOf, inf.d.selId) ? panelOf[inf.d.selId] : panels[0].id,
          unit: unit === 'dollars' ? (inf.x.money === 'usd' ? 'USD' : 'currency') : unit === 'hours' ? 'hours' : unit === 'gold' ? 'oz of gold' : 'index',
        };
      });
      const u = UNITS[unit];
      const spec = {
        title: titleFor(unit, S, c) + ', ' + countryName(c),
        series, panels, layout: 'stack',
        y: { scale: st.scale, fmt: u.fmt, tickFmt: u.tick, title: u.axis, zero: 'auto' },
        x: { min: S },
        readout: (s, pt) => {
          if (unit === 'index') return null;
          const b = bases[s.id];
          if (!b || !(b.v > 0) || joinedIds[s.id]) return null;
          return { sub: fmtTimes(pt.v / b.v) + ' since ' + label(b.key) };
        },
        height: multi ? null : 340, panelHeight: 200, endLabels: 'auto',
        empty: 'Nothing to draw. Choose at least one item that exists for this unit and start year.',
        table: { caption: titleFor(unit, S, c) + ', ' + countryName(c), filename: 'prices-items.csv' },
      };
      if (!chart) chart = box.make(spec); else box.update(spec);
      // nothing selected is dropped silently: say what is not drawn here and why
      const undrawn = st.sel.filter((id) => BY_ID[id] && BY_ID[id].country === c && !(BY_ID[id].ref && unit !== 'index') && !infos.some((inf) => inf.d.selId === id)).map((id) => {
        const x = BY_ID[id], e = effective(x, st);
        const reason = !e.ok ? e.why.replace(/\.$/, '').replace(/^[A-Z](?![A-Z])/, (ch) => ch.toLowerCase()) : shown.some((d) => d.selId === id) ? 'no data in this window' : 'only five items are drawn at a time';
        return x.short + ' (' + reason + ')';
      });
      skippedEl.textContent = undrawn.length ? 'Selected but not drawn in this view: ' + undrawn.join('; ') + '.' : '';
      panelNoteEl.textContent = multi ? 'The lines are in separate panels because their sizes differ by orders of magnitude, and one axis would flatten the small ones. Each panel has its own axis, so compare how a line changes, not where it sits. The readout shows the panel under the cursor; the table lists every line.' : '';

      unitNoteEl.replaceChildren(kindLine('Method', unitNote(unit, S)));
      const proxies = shown.filter((d) => d.x.proxy && infos.some((inf) => inf.d === d));
      proxyEl.replaceChildren();
      if (proxies.length) {
        proxyEl.appendChild(h('span', { class: 'badge pr-kind', text: 'Proxy' }));
        proxyEl.appendChild(document.createTextNode(' ' + proxies.map((d) => plainShort(d.x)).join(', ') + (proxies.length > 1 ? ' are proxies' : ' is a proxy') + ': ' + (proxies.length > 1 ? 'stand-ins' : 'a stand-in') + ' for something that is not measured directly. Gaps are left empty and nothing is filled in between.' + (Object.keys(joinedIds).length ? ' The cola line is three unjoined pieces of different products: read changes inside a piece, not levels across pieces.' : '')));
      } else proxyEl.appendChild(document.createTextNode('Gaps in a source are left empty and nothing is filled in between.'));

      // gaps and definition changes
      const sids = infos.map((inf) => inf.x.sid).filter(Boolean);
      const bl = breakList(sids);
      gapsEl.replaceChildren();
      if (bl.length) gapsEl.appendChild(h('details', { class: 'pr-details' }, [h('summary', { text: 'Gaps, proxies and definition changes in the lines shown (' + bl.length + ' series)' }), h('ul', { class: 'pr-bl' }, bl)]));

      // then and now
      const items = [], others = [];
      const otherUnit = c !== 'US' ? null : unit === 'hours' || unit === 'gold' ? 'dollars' : unit === 'dollars' ? 'hours' : null;
      let usedAnnual = false;
      infos.forEach((inf) => {
        if (inf.x.joined) return;
        const pts = inf.cl.filter((pt) => pt.t >= S - 1e-9);
        if (pts.length < 2 || !(pts[0].v > 0) || !(pts[pts.length - 1].v > 0)) return;
        const p0 = pts[0], p1 = pts[pts.length - 1], r = p1.v / p0.v, late = p0.t - S > 1;
        // a median that is first published for one month and revised later: the same change on annual medians beside it
        const ann = inf.x.annualSid ? annualChange(inf.x, unit, S) : null;
        if (ann) usedAnnual = true;
        const bits = [];
        if (late) bits.push('from ' + label(p0.key));
        if (ann) bits.push('single months, preliminary at the end; annual medians ' + ann.y0 + ' to ' + ann.y1 + ': ' + fmtTimes(ann.ratio));
        items.push({
          id: inf.d.selId, label: inf.x.short, value: r, color: inf.slot == null ? 'var(--ink-2)' : SLOTS[inf.slot].color, muted: late,
          text: fmtTimes(r), sub: u.fmt(p0.v) + ' to ' + u.fmt(p1.v), note: bits.join('; '),
        });
        if (otherUnit && inf.x.units.indexOf(otherUnit) >= 0) {
          const orows = D.clean(itemRows(inf.x, otherUnit, S) || []), a0 = orows.find((pt) => pt.key === p0.key), a1 = orows.find((pt) => pt.key === p1.key);
          if (a0 && a1 && a0.v > 0) others.push(plainShort(inf.x) + ' ' + fmtTimes(a1.v / a0.v));
        }
      });
      barsSub.replaceChildren(kindLine('Measured', 'The value at the newest observation divided by the value at the start of the window, in the unit chosen. A faint bar starts later than the window, so its span is shorter.'));
      const joinedNames = Object.keys(joinedIds).map((k) => plainShort(joinedIds[k]));
      barsNote.textContent = polarityNote(unit) + (usedAnnual ? ' The new house is the median of single months, and the latest month is preliminary and revised; the annual-median change is given beside it, and the housing section below uses annual medians.' : '') + (others.length ? ' The same items and spans in ' + UNITS[otherUnit].label.toLowerCase() + ': ' + others.join(', ') + '.' : '') + (joinedNames.length ? ' ' + joinedNames.join(', ') + (joinedNames.length > 1 ? ' are' : ' is') + ' left out: its pieces are different products, so one start and end value would compare unlike things. The changes inside each piece are in the table under "A can of pop".' : '');
      if (!ratio) ratio = TS.rankedBar(barsHost, items, { baseline: 1, scale: 'log', fmt: 'x2', axis: true, sort: 'desc', label: 'Change from the start of the window to the newest value', empty: 'Nothing to compare.' });
      else ratio.update(items, null);

      // sources
      srcEl.replaceChildren();
      const lines = infos.filter((inf) => inf.x.sid).map((inf) => sourceLine([inf.x.sid]));
      const stampUsed = infos.some((inf) => inf.x.cur === 'stamp');
      if (lines.length || stampUsed) {
        const ul = h('ul', { class: 'pr-bl' });
        infos.forEach((inf) => {
          if (inf.x.cur === 'stamp') {
            const so = CUR && CUR.sources && CUR.sources.usps_rates;
            ul.appendChild(h('li', null, [h('b', { text: inf.x.label + ': ' }), so ? U.link(so.title + ', ' + so.publisher, so.url) : 'USPS', '. Monthly value = the rate in effect on the 15th, carried forward until the next change.']));
          } else if (inf.x.sid) {
            const s = SER(inf.x.sid);
            ul.appendChild(h('li', null, [h('b', { text: inf.x.label + ': ' }), U.link(s.source.replace(/\.$/, ''), s.url), ' (' + s.sourceId + '; as of ' + label(s.asOf) + ')']));
          }
        });
        if (unit === 'gold' || unit === 'hours') {
          if (unit === 'gold' && gold.meta) ul.appendChild(h('li', null, [h('b', { text: 'Gold price: ' }), 'data/history.js, ' + gold.meta.label + '. ' + gold.meta.source + ' (retrieved ' + gold.meta.retrieved + ').']));
          if (unit === 'hours') { const s = SER('pay_prod'); if (s) ul.appendChild(h('li', null, [h('b', { text: 'Pay for the hours: ' }), U.link(s.source, s.url), ' (' + s.sourceId + '; as of ' + label(s.asOf) + ')'])); }
        }
        srcEl.appendChild(h('details', { class: 'pr-details' }, [h('summary', { text: 'Sources of the lines shown' }), ul]));
      }
    }

    host.appendChild(h('div', { class: 'toolbar' }, [h('div', { class: 'tb-body' }, [
      h('div', { class: 'tb-row' }, [unitSeg.el, sinceSeg.el, scaleSeg.el, h('div', { class: 'tool-actions' }, [reset])]),
      hint,
    ])]));
    host.appendChild(picker);
    host.appendChild(status);
    host.appendChild(box.el);
    host.appendChild(skippedEl);
    host.appendChild(panelNoteEl);
    host.appendChild(unitNoteEl);
    host.appendChild(proxyEl);
    host.appendChild(gapsEl);
    host.appendChild(barsHead);
    host.appendChild(barsSub);
    host.appendChild(barsHost);
    host.appendChild(barsNote);
    host.appendChild(srcEl);
    sections.push({ id: 'items', render: renderItems });
  }

  /* =====================================================================================
     6c. a can of pop: what the records cover
     ===================================================================================== */
  // runs of consecutive months with a value: [{ a, b (cleaned points), t0, t1 }]
  function runsOf(rows) {
    const pts = D.clean(rows).map((pt) => Object.assign({ mi: mi(pt) }, pt)), out = [];
    let curRun = null;
    pts.forEach((pt) => {
      if (curRun && pt.mi - curRun.b.mi === stepMonths(pt.freq)) curRun.b = pt;
      else { curRun = { a: pt, b: pt }; out.push(curRun); }
    });
    return out.map((r) => ({ a: r.a, b: r.b, t0: r.a.t, t1: r.b.t + r.b.step }));
  }
  function gapText(runs) {
    const gaps = [];
    for (let i = 0; i + 1 < runs.length; i++) {
      const g0 = D.shiftPeriod(runs[i].b.key, 1), g1 = D.shiftPeriod(runs[i + 1].a.key, -1);
      gaps.push(g0 === g1 ? label(g0) : label(g0) + ' to ' + label(g1));
    }
    return gaps;
  }

  function initPop() {
    const host = $('pr-pop');
    const lastYear = D.parsePeriod(latestKey()).y;
    const X0 = 1880, X1 = lastYear + 1;
    const pos = (t) => (((t - X0) / (X1 - X0)) * 100).toFixed(3) + '%';
    const nick = CURS('coke_nickel');
    const rowsDef = [];
    if (nick && nick.span) rowsDef.push({ kind: 'span', label: 'Coca-Cola, 6.5 oz bottle, a cited fact', from: +nick.span.from, to: +nick.span.to + 1, text: 'About ' + nick.span.from + ' to ' + nick.span.to + ': 5 cents. Sources differ on the end year.' });
    [['price_cola_returnable_16oz', 'BLS cola, returnable bottles, per 16 oz'], ['price_cola_cans_16oz', 'BLS cola, 6-pack of cans, per 16 oz'], ['price_cola_2l', 'BLS cola, 2 liter bottle'],
      ['price_softdrinks_2l', 'BLS all soft drinks, 2 liter'], ['price_softdrinks_12pk_12oz', 'BLS all soft drinks, 12-pack of cans, per 12 oz']]
      .forEach((x) => { if (SER(x[0])) rowsDef.push({ kind: 'bls', sid: x[0], label: x[1] }); });
    if (SER('cpi_carbonated')) rowsDef.push({ kind: 'index', sid: 'cpi_carbonated', label: 'CPI, carbonated drinks (an index, not a price)' });

    const list = h('ul', { class: 'pr-strip', 'aria-label': 'Which years each record covers' });
    rowsDef.forEach((r) => {
      const track = h('span', { class: 'pr-track', 'aria-hidden': 'true' });
      let desc;
      if (r.kind === 'span') {
        const seg = h('span', { class: 'pr-seg pr-seg--cited' });
        seg.style.left = pos(r.from); seg.style.width = (((r.to - r.from) / (X1 - X0)) * 100).toFixed(3) + '%';
        track.appendChild(seg);
        desc = r.text;
      } else {
        const runs = runsOf(ROWS(r.sid));
        runs.forEach((run) => {
          const seg = h('span', { class: 'pr-seg' + (r.kind === 'index' ? ' pr-seg--index' : '') });
          seg.style.left = pos(run.t0); seg.style.width = (((run.t1 - run.t0) / (X1 - X0)) * 100).toFixed(3) + '%';
          track.appendChild(seg);
        });
        const gaps = gapText(runs);
        desc = label(runs[0].a.key) + ' to ' + label(runs[runs.length - 1].b.key) + (gaps.length ? '. Gaps: ' + gaps.join('; ') : '. No gaps');
      }
      list.appendChild(h('li', { class: 'pr-strip-row' }, [
        h('span', { class: 'pr-strip-label', text: r.label }),
        h('span', { class: 'pr-strip-body' }, [track, h('span', { class: 'pr-strip-desc', text: desc })]),
      ]));
    });
    const axisBody = h('span', { class: 'pr-axis-body' });
    [1890, 1920, 1950, 1980, 2010].forEach((y) => { const t = h('span', { text: String(y) }); t.style.left = pos(y); axisBody.appendChild(t); });
    const axis = h('div', { class: 'pr-strip-axis', 'aria-hidden': 'true' }, [h('span'), axisBody]);
    const key = h('p', { class: 'pr-strip-key', 'aria-hidden': 'true' }, [
      h('span', null, [h('i', { class: 'pr-k pr-k--bls' }), 'A dollar price from BLS']),
      h('span', null, [h('i', { class: 'pr-k pr-k--cited' }), 'A cited fact']),
      h('span', null, [h('i', { class: 'pr-k pr-k--index' }), 'An index']),
      h('span', null, [h('i', { class: 'pr-k pr-k--none' }), 'Nothing recorded']),
    ]);
    const firstBls = D.clean(ROWS('price_cola_cans_16oz'))[0];
    const noRecord = nick && nick.span && firstBls
      ? kindLine('Measured', 'This data set has no dollar price for soft drinks between ' + (+nick.span.to + 1) + ' and ' + label(firstBls.key) + ', and the BLS pieces are separated by gaps. Nothing is filled in. The nickel is a reference point and not the base of an index: the bottle size, the brand and the way it was sold differ from the BLS products.')
      : null;

    // within each piece: price per 12 oz at the two ends, against consumer prices over the same months
    const proxy = SER('price_soda_proxy_12oz');
    const pieces = [];
    if (SER('price_cola_returnable_16oz')) pieces.push({ id: 'price_cola_returnable_16oz', factor: 0.75, what: 'Cola in returnable bottles, per 16 oz, times 0.75' });
    if (proxy && proxy.parts) proxy.parts.forEach((p) => pieces.push({ id: p.id, factor: p.factor, what: p.what.charAt(0).toUpperCase() + p.what.slice(1) }));
    const tableHost = h('div', { class: 'pr-table tableview', tabindex: '0', role: 'region', 'aria-label': 'Change inside each BLS piece' });
    const pcRows = [];
    pieces.forEach((pc) => {
      const pts = D.clean(ROWS(pc.id));
      if (pts.length < 2) return;
      const p0 = pts[0], p1 = pts[pts.length - 1], v0 = p0.v * pc.factor, v1 = p1.v * pc.factor;
      const d0 = deflAt('cpi_u', p0), d1 = deflAt('cpi_u', p1);
      pcRows.push([pc.what, label(p0.key) + ' to ' + label(p1.key), fmtMoney(v0), fmtMoney(v1), fmtTimes(v1 / v0), fin(d0) && fin(d1) ? fmtTimes(d1 / d0) : 'n/a']);
    });
    U.table(tableHost, 'Price per 12 oz at the first and last value of each BLS piece, and consumer prices (CPI-U) over the same months', [
      { label: 'Piece', wrap: true }, { label: 'Period' }, { label: 'First value' }, { label: 'Last value' }, { label: 'Change' }, { label: 'CPI-U change' },
    ], pcRows);

    // continuous relative price: the carbonated drinks index over the all-items index (both 1982-84 = 100)
    const rel = fillGaps(D.ratioAligned(ROWS('cpi_carbonated'), ROWS('cpi_u')));
    const relBox = chartBox({ tableLabel: 'Relative price of soft drinks as a table', csvName: 'prices-soft-drinks-relative-price.csv' });
    relBox.make({
      title: 'Soft drink prices relative to all consumer prices',
      series: [{ id: 'rel', name: 'Soft drink price index / all-items index', short: 'Soft drinks', color: 'var(--accent)', shape: 'circle', rows: rel, unit: 'ratio' }],
      y: { scale: 'linear', fmt: (v) => nf(v, 2), tickFmt: (v) => nf(v, 2), title: 'ratio, 1.00 = same as all prices', zero: false },
      refLines: [{ y: 1, label: '1.00: both indexes at their 1982-84 average', kind: 'guide' }],
      height: 260, legend: false, table: { caption: 'Soft drink price index divided by the all-items index', filename: 'prices-soft-drinks-relative-price.csv' },
    });
    const relFacts = h('div', { class: 'pr-facts' });
    const rp = D.clean(rel);
    if (rp.length) {
      const lo = rp.reduce((a, b) => (b.v < a.v ? b : a)), hi = rp.reduce((a, b) => (b.v > a.v ? b : a)), last = rp[rp.length - 1];
      relFacts.replaceChildren(kindLine('Measured', 'The ratio was ' + nf(rp[0].v, 2) + ' in ' + label(rp[0].key) + ', highest at ' + nf(hi.v, 2) + ' in ' + label(hi.key) + ', lowest at ' + nf(lo.v, 2) + ' in ' + label(lo.key) + ' and ' + nf(last.v, 2) + ' in ' + label(last.key)
        + '. A ratio below 1.00 means soft drinks rose less than prices overall since the 1982-84 average, and a rising ratio means they rose faster. The index tracks a changing basket of brands and pack sizes.'));
    }
    const nickNote = nick ? h('p', { class: 'chart-note' }, ['Source for the nickel: ', CUR.sources && CUR.sources.levy_young_2004 ? U.link(CUR.sources.levy_young_2004.title + ', ' + CUR.sources.levy_young_2004.publisher, CUR.sources.levy_young_2004.url) : 'Levy and Young (2004)', '. ', nick.notes]) : null;

    host.appendChild(h('h3', { class: 'pr-h3', text: 'Where there is a record' }));
    host.appendChild(list);
    host.appendChild(axis);
    host.appendChild(key);
    if (noRecord) host.appendChild(noRecord);
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Change inside each piece' }));
    host.appendChild(h('p', { class: 'chart-note', text: 'A level from one piece cannot be compared with a level from another, so change is read inside a piece. The per-12-oz arithmetic is the same as in the proxy used in the items chart.' }));
    host.appendChild(tableHost);
    host.appendChild(h('h3', { class: 'pr-h3', text: 'A continuous record: soft drinks against all prices' }));
    host.appendChild(relFacts);
    host.appendChild(relBox.el);
    if (nickNote) host.appendChild(nickNote);
    host.appendChild(sourceLine(['price_cola_cans_16oz', 'price_cola_2l', 'price_softdrinks_12pk_12oz', 'cpi_carbonated']));
    sections.push({ id: 'pop', render() { relBox.chart && relBox.chart.draw(); } });
  }

  /* =====================================================================================
     6d. homes and land against pay and income
     ===================================================================================== */
  function peakText(rows, fmtv, what) {
    const c = D.clean(rows);
    if (!c.length) return null;
    const hi = c.reduce((a, b) => (b.v > a.v ? b : a)), first = c[0], last = c[c.length - 1];
    const at = (pt) => fmtv(pt.v) + ' in ' + label(pt.key);
    if (hi === last || hi === first) return what + ' ' + at(first) + ' and ' + at(last) + ', ' + (hi === last ? 'its highest' : 'its highest at the start') + '.';
    return what + ' ' + at(first) + ', ' + fmtv(hi.v) + ' at its highest (' + label(hi.key) + ') and ' + at(last) + '.';
  }
  const yrs1 = (v) => nf(v, 1) + ' years';
  const payYear = (function () {
    return D.annual(ROWS('pay_prod'), { partial: true }).map((r) => [r[0], r[1] * HOURS_PER_YEAR]);
  })();

  function initHouses() {
    const host = $('pr-houses'), subEl = $('houses-sub');
    const houseBox = chartBox({ tableLabel: 'House price to income as a table', csvName: () => 'prices-house-to-income-' + state.country + '.csv' });
    const landBox = chartBox({ tableLabel: 'Land as a table', csvName: () => 'prices-land-' + state.houses.land + '.csv' });
    const houseHead = h('h3', { class: 'pr-h3', id: 'pr-house-h' });
    const houseFacts = h('div', { class: 'pr-facts' });
    const houseNote = h('div', { class: 'pr-methodnote' });
    const landWrap = h('div', { class: 'pr-landwrap' });
    const landHead = h('h3', { class: 'pr-h3', text: 'Land' });
    const landFacts = h('div', { class: 'pr-facts' });
    const landNote = h('div', { class: 'pr-methodnote' });
    const caMsg = h('div', { class: 'pr-ca' });
    const srcEl = h('div', { class: 'pr-srcbox' });
    const interp = h('div', { class: 'pr-interp' }, [
      h('p', { class: 'pr-kindline' }, [h('span', { class: 'badge pr-kind', text: 'Interpretation' }), ' ', 'Why house prices rose faster than prices in general is not settled by these charts. Studies point to the price of land and limits on building (Knoll, Schularick and Steger, 2017; Glaeser and Gyourko, 2018), and others stress interest rates and the supply of mortgage credit. The ratios here are measurements of affordability, not tests of any of these explanations.']),
      h('p', { class: 'chart-note' }, [
        'Papers: ', U.link('Knoll, Schularick and Steger, "No Price Like Home: Global House Prices, 1870-2012", American Economic Review 107(2), 2017', 'https://www.dallasfed.org/-/media/documents/institute/wpapers/2014/0208.pdf'),
        '; ', U.link('Glaeser and Gyourko, "The Economic Implications of Housing Supply", Journal of Economic Perspectives 32(1), 2018', 'https://www.nber.org/papers/w23833'), '.',
      ]),
    ]);
    const landSeg = segControl({
      label: 'Measure', wrap: true, value: state.houses.land,
      options: [{ v: 'acres', label: 'Farmland: acres one year of pay buys' }, { v: 'lot', label: 'Residential: years of pay for a quarter-acre lot' }],
      onChange: (v) => { state.houses.land = v; renderLand(); writeHash(); },
    });
    let houseMade = false, landMade = false;

    function renderLand() {
      const mode = state.houses.land;
      landSeg.update([{ v: 'acres', label: 'Farmland: acres one year of pay buys' }, { v: 'lot', label: 'Residential: years of pay for a quarter-acre lot' }], mode);
      let rows, name, fmtv, title, ytitle, notes, facts;
      if (mode === 'acres') {
        rows = D.ratioAligned(payYear, ROWS('farmland_acre'));
        name = 'Acres of farmland one year of production-worker pay buys';
        fmtv = (v) => nf(v, 1) + ' acres'; ytitle = 'acres';
        title = 'Acres of farmland that one year of pay buys';
        facts = peakText(rows, fmtv, 'One year of pay bought');
        notes = 'A year of pay is average hourly earnings of production and nonsupervisory workers times ' + nf(HOURS_PER_YEAR, 0) + ' hours, divided by the average value of an acre of farm real estate in the same year. Farm real estate includes buildings and is mostly rural, so this is a proxy for land and not the price of the land under houses. The 2026 pay figure is the mean of January to September.';
      } else {
        rows = D.ratioAligned(ROWS('land_resid_quarter_acre'), payYear);
        name = 'Years of production-worker pay for a quarter-acre residential lot';
        fmtv = (v) => nf(v, 2) + ' years'; ytitle = 'years of pay';
        title = 'Years of pay for a standardized quarter-acre residential lot';
        facts = peakText(rows, fmtv, 'A quarter-acre residential lot cost');
        notes = 'The FHFA estimate of land value for a standardized quarter-acre single-family lot, divided by a year of pay as above. The only national residential land series found covers 2012 to 2022; it is experimental and subject to revision by FHFA, and it says nothing about earlier years.';
      }
      const spec = {
        title, series: [{ id: 'land', name, short: mode === 'acres' ? 'Farmland' : 'Residential lot', color: 'var(--accent)', shape: 'circle', rows, markAll: mode === 'lot', carry: false, unit: ytitle }],
        y: { scale: 'linear', fmt: fmtv, tickFmt: (v) => nf(v, mode === 'acres' ? 0 : 1), title: ytitle, zero: 'auto' }, height: 260, legend: false,
        table: { caption: title, filename: 'prices-land.csv' },
      };
      if (!landMade) { landBox.make(spec); landMade = true; } else landBox.update(spec);
      landFacts.replaceChildren(kindLine('Measured', facts || 'No data.'));
      landNote.replaceChildren(kindLine('Method', notes));
    }

    function render() {
      const c = state.country;
      landWrap.hidden = c !== 'US';
      caMsg.hidden = c !== 'CA';
      houseBox.el.hidden = c === 'CA';
      houseHead.hidden = c === 'CA';
      houseFacts.hidden = c === 'CA';
      houseNote.hidden = c === 'CA';
      srcEl.replaceChildren();
      if (c === 'US') {
        subEl.textContent = 'How many years of income or pay the median new house costs, and what an acre costs in pay. Each ratio divides two series for the same year.';
        houseHead.textContent = 'Years of income or pay to buy the median new house';
        const hA = ROWS('house_new_median_annual');
        const inc = fillGaps(D.ratioAligned(hA, ROWS('income_median')));
        const wk = fillGaps(D.ratioAligned(hA, payYear));
        const spec = {
          title: 'Years of income or pay to buy the median new house, United States',
          series: [
            { id: 'inc', name: 'Years of median household income', short: 'Household income', color: 'var(--c-blue)', shape: 'circle', rows: inc, unit: 'years' },
            { id: 'wk', name: 'Years of production-worker pay (2,080 hours a year)', short: 'Worker pay', color: 'var(--c-orange)', shape: 'square', rows: wk, unit: 'years' },
          ],
          y: { scale: 'linear', fmt: yrs1, tickFmt: (v) => nf(v, 0), title: 'years', zero: 'auto' }, height: 300,
          table: { caption: 'Median new house price divided by income or pay, by year, United States', filename: 'prices-house-to-income.csv' },
        };
        if (!houseMade) { houseBox.make(spec); houseMade = true; } else houseBox.update(spec);
        // the newest year with both a price and an income, so the ratio can be traced to its two inputs
        const incByKey = new Map(D.clean(ROWS('income_median')).map((p) => [p.key, p.v]));
        let pair = null;
        D.clean(hA).forEach((p) => { if (incByKey.has(p.key)) pair = { key: p.key, house: p.v, income: incByKey.get(p.key) }; });
        houseFacts.replaceChildren(
          kindLine('Measured', pair ? 'In ' + label(pair.key) + ' the median new house sold for ' + fmtMoney(pair.house) + ' and median household income was ' + fmtMoney(pair.income) + ' a year, a ratio of ' + yrs1(pair.house / pair.income) + '.' : ''),
          kindLine('Measured', (peakText(inc, yrs1, 'Against median household income the median new house cost') || '')),
          kindLine('Measured', (peakText(wk, yrs1, 'Against production-worker pay it cost') || '')),
        );
        houseNote.replaceChildren(
          kindLine('Method', 'Annual median sales price of new houses (Census and HUD) divided by median household income from the Census survey (current dollars), and by a year of production-worker pay (' + nf(HOURS_PER_YEAR, 0) + ' hours). Blue and orange mean the two measures here, not countries.'),
          kindLine('Method', 'The median new house is not a constant-quality house: size, location and mix change. The house price index in the items chart avoids that but has no dollar level. Household income is for a whole household and is not a wage.'),
        );
        renderLand();
        srcEl.appendChild(h('details', { class: 'pr-details' }, [h('summary', { text: 'Sources for this section' }), h('ul', { class: 'pr-bl' }, ['house_new_median_annual', 'income_median', 'pay_prod', 'farmland_acre', 'land_resid_quarter_acre'].map((id) => {
          const s = SER(id);
          return h('li', null, [h('b', { text: s.label + ': ' }), U.link(s.source.replace(/\.$/, ''), s.url), ' (' + s.sourceId + '; as of ' + label(s.asOf) + ')']);
        }))]));
      } else if (c === 'GB') {
        subEl.textContent = 'How many years of average earnings the average UK house costs, month by month since 2000.';
        houseHead.textContent = 'Years of average earnings to buy the average UK house';
        const rows = fillGaps(D.ratioAligned(ROWS('uk_house_price'), ROWS('uk_earnings_weekly'), { scale: 1 / 52 }));
        const spec = {
          title: 'Years of average earnings to buy the average house, United Kingdom',
          series: [{ id: 'uk', name: 'Years of average earnings', short: 'Earnings', color: 'var(--c-blue)', shape: 'circle', rows, unit: 'years' }],
          y: { scale: 'linear', fmt: yrs1, tickFmt: (v) => nf(v, 0), title: 'years', zero: 'auto' }, height: 300, legend: false,
          table: { caption: 'UK average house price divided by a year of average weekly earnings', filename: 'prices-uk-house-to-earnings.csv' },
        };
        if (!houseMade) { houseBox.make(spec); houseMade = true; } else houseBox.update(spec);
        houseFacts.replaceChildren(kindLine('Measured', peakText(rows, yrs1, 'The average UK house cost') || ''));
        houseNote.replaceChildren(
          kindLine('Method', 'HM Land Registry average price of all UK properties divided by 52 times average weekly earnings for the whole economy (ONS, total pay excluding arrears, seasonally adjusted), same month. The price is a mean that moves with the mix of properties sold; earnings include part-time work. ONS publishes a different affordability ratio, median price over median full-time earnings, so its numbers differ.'),
        );
        srcEl.appendChild(h('details', { class: 'pr-details' }, [h('summary', { text: 'Sources for this section' }), h('ul', { class: 'pr-bl' }, ['uk_house_price', 'uk_earnings_weekly'].map((id) => {
          const s = SER(id);
          return h('li', null, [h('b', { text: s.label + ': ' }), U.link(s.source.replace(/\.$/, ''), s.url), ' (' + s.sourceId + '; as of ' + label(s.asOf) + ')']);
        }))]));
      } else {
        subEl.textContent = 'Canada has house and land price indexes but no income series in this data set.';
        clear(caMsg);
        caMsg.appendChild(kindLine('Method', 'Statistics Canada\'s New Housing Price Index measures builders\' prices for houses and for land as indexes (December 2016 = 100). An index has no dollar level, so it cannot be divided by an income. This data set has no Canadian income series, so there is no price-to-income chart for Canada. The items chart above compares the house and land indexes with consumer prices.'));
      }
    }

    host.appendChild(caMsg);
    host.appendChild(houseHead);
    host.appendChild(houseBox.el);
    host.appendChild(houseFacts);
    host.appendChild(houseNote);
    landWrap.appendChild(landHead);
    landWrap.appendChild(h('div', { class: 'toolbar' }, [h('div', { class: 'tb-body' }, [h('div', { class: 'tb-row' }, [landSeg.el])])]));
    landWrap.appendChild(landBox.el);
    landWrap.appendChild(landFacts);
    landWrap.appendChild(landNote);
    host.appendChild(landWrap);
    host.appendChild(interp);
    host.appendChild(srcEl);
    sections.push({ id: 'houses', render });
  }

  /* =====================================================================================
     6e. real return on savings
     ===================================================================================== */
  function initSavings() {
    const host = $('pr-savings');
    const nomA = D.annual(ROWS('tbill3m'));
    const lastY = nomA.length ? +nomA[nomA.length - 1][0] : null;
    const cpiA = D.annual(ROWS('cpi_u'), { partial: true }).filter((r) => lastY != null && +r[0] <= lastY);
    const real = lastY != null ? D.realReturnSeries(nomA, cpiA) : [];
    const nomMap = new Map(nomA.map((r) => [r[0], r[1]])), cpiMap = new Map(cpiA.map((r) => [r[0], r[1]]));
    // the same arithmetic after a flat tax on the interest: an illustration, not anyone's tax
    const TAX = 22;
    const realTaxed = lastY != null ? D.realReturnSeries(nomA.map((r) => [r[0], r[1] * (1 - TAX / 100)]), cpiA) : [];
    const taxedNeg = realTaxed.filter((r) => r[1] < 0).length;
    const taxedMean = realTaxed.length ? realTaxed.reduce((s, r) => s + r[1], 0) / realTaxed.length : null;
    // how far the published discount rate sits below the investment yield, a mean over complete years
    const yieldGap = (function () {
      const by = new Map();
      D.clean(ROWS('tbill3m')).forEach((pt) => {
        if (pt.freq !== 'M') return;
        const e = by.get(pt.y) || { g: 0, n: 0 };
        e.g += D.billYield(pt.v) - pt.v; e.n++;
        by.set(pt.y, e);
      });
      const gs = Array.from(by.values()).filter((e) => e.n === 12).map((e) => e.g / 12);
      return gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null;
    })();
    const SINCES = [1934, 1971, 1991, 2009];
    // 100 held from the end of a year: purchasing power at the end, from a series of yearly real returns
    const holdFrom = (rows, since) => rows.reduce((v, r) => (+r[0] > since ? v * (1 + r[1] / 100) : v), 100);

    const barBox = chartBox({ tableLabel: 'Real return on bills as a table', csvName: 'prices-real-return-bills.csv' });
    const cumBox = chartBox({ tableLabel: 'Value of 100 held in bills as a table', csvName: () => 'prices-bills-purchasing-power-' + state.savings.since + '.csv' });
    const neg = real.filter((r) => r[1] < 0).length;
    const mean = real.length ? real.reduce((s, r) => s + r[1], 0) / real.length : null;
    const sinceSeg = segControl({
      label: 'Hold from', value: state.savings.since, wrap: true,
      options: SINCES.map((y) => ({ v: y, label: String(y) })),
      onChange: (y) => { state.savings.since = y; renderCum(); writeHash(); },
    });
    const facts = h('div', { class: 'pr-facts' });
    const cumFacts = h('div', { class: 'pr-facts' });
    const cumHead = h('h3', { class: 'pr-h3', id: 'pr-cum-h' });
    // all four start years at once, so the answer does not hang on the one chosen above
    const allBox = h('div', { class: 'pr-table tableview', tabindex: '0', role: 'region', 'aria-label': 'What 100 held in bills would buy now, from each of the four start years' });
    U.table(allBox, 'What 100 held in 3-month Treasury bills from each start year buys now, in money of that year (before tax, and after an assumed ' + TAX + ' percent tax on the interest)', [
      { label: 'Held from the end of' }, { label: 'Interest compounded' }, { label: 'Consumer prices' }, { label: 'Purchasing power of 100' }, { label: 'After an assumed ' + TAX + '% tax' },
    ], SINCES.map((y) => {
      const c0 = cpiMap.get(String(y)), c1 = cpiMap.get(String(lastY));
      const nomMul = nomA.reduce((m2, r) => (+r[0] > y ? m2 * (1 + r[1] / 100) : m2), 1);
      return [String(y), fmtTimes(nomMul), fin(c0) && fin(c1) ? fmtTimes(c1 / c0) : 'n/a', nf(holdFrom(real, y), 1), nf(holdFrom(realTaxed, y), 1)];
    }));

    barBox.make({
      title: 'Real return on 3-month Treasury bills, by year, United States',
      series: [{ id: 'real', name: 'Real return on 3-month bills', short: 'Real return', color: 'var(--c-blue)', colorPos: 'var(--c-blue)', colorNeg: 'var(--c-orange)', shape: 'square', type: 'column', rows: real, unit: '% a year' }],
      y: { scale: 'linear', fmt: (v) => D.format(v, 'sgn1') + '%', tickFmt: (v) => D.format(v, 'sgn0') + '%', title: '% a year', zero: true }, height: 280, legend: true,
      table: { caption: 'Real return on 3-month Treasury bills, % a year, by year', filename: 'prices-real-return-bills.csv' },
    });

    function renderCum() {
      const since = state.savings.since;
      sinceSeg.update(SINCES.map((y) => ({ v: y, label: String(y) })), since);
      const rows = [[String(since), 100]];
      let v = 100, nom = 1, n = 0;
      real.forEach((r) => {
        const y = +r[0];
        if (y <= since) return;
        v *= 1 + r[1] / 100;
        nom *= 1 + (nomMap.get(r[0]) || 0) / 100;
        n++;
        rows.push([r[0], v]);
      });
      cumHead.textContent = 'What 100 held in bills since ' + since + ' would buy now';
      const spec = {
        title: 'Purchasing power of 100 held in 3-month Treasury bills since ' + since + ', United States',
        series: [{ id: 'cum', name: 'Purchasing power of 100 held in bills', short: 'Bills', color: 'var(--accent)', shape: 'circle', rows, unit: 'purchasing power, start = 100' }],
        y: { scale: 'linear', fmt: (x) => nf(x, 1), tickFmt: (x) => nf(x, 0), title: 'purchasing power, ' + since + ' = 100', zero: false }, height: 260, legend: false,
        refLines: [{ y: 100, label: '100: the same buying power as at the start', kind: 'guide' }],
        table: { caption: 'Purchasing power of 100 held in 3-month Treasury bills, by year', filename: 'prices-bills-purchasing-power.csv' },
      };
      if (!cumBox.chart) cumBox.make(spec); else cumBox.update(spec);
      const c0 = cpiMap.get(String(since)), c1 = cpiMap.get(String(lastY));
      cumFacts.replaceChildren(
        kindLine('Measured', n ? 'Interest compounded at the annual average bill rate: ' + fmtTimes(nom) + '. Consumer prices (annual averages ' + since + ' to ' + lastY + '): ' + (fin(c0) && fin(c1) ? fmtTimes(c1 / c0) : 'n/a') + '. Purchasing power: ' + fmtTimes(v / 100) + ', so 100 became ' + nf(v, 0) + ' in ' + since + ' money.' : 'No years after the start.'),
      );
    }

    let run = 0;
    for (let i = real.length - 1; i >= 0 && real[i][1] > 0; i--) run++;
    const recent = run >= 2 ? ' The last ' + run + ' years in this data (' + real[real.length - run][0] + ' to ' + real[real.length - 1][0] + ') were positive.' : '';
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Year by year' }));
    host.appendChild(barBox.el);
    host.appendChild(h('p', { class: 'pr-key' }, [h('span', { class: 'swatch', style: '--c: var(--c-blue)' }), ' Positive: the interest beat the rise in prices. ', h('span', { class: 'swatch', style: '--c: var(--c-orange)' }), ' Negative: it did not. The colours mean the sign, not a country.']));
    facts.appendChild(kindLine('Measured', real.length ? 'The real return was below zero in ' + neg + ' of the ' + real.length + ' years from ' + real[0][0] + ' to ' + real[real.length - 1][0] + ', and averaged ' + D.format(mean, 'sgn2') + '% a year over them. The latest year, ' + real[real.length - 1][0] + ', was ' + D.format(real[real.length - 1][1], 'sgn2') + '%.' + recent : 'No data.'));
    host.appendChild(facts);
    host.appendChild(h('div', { class: 'toolbar' }, [h('div', { class: 'tb-body' }, [h('div', { class: 'tb-row' }, [sinceSeg.el])])]));
    host.appendChild(cumHead);
    host.appendChild(cumBox.el);
    host.appendChild(cumFacts);
    host.appendChild(allBox);
    host.appendChild(h('div', { class: 'pr-methodnote' }, [
      kindLine('Method', 'Real return = (1 + bill rate) / (1 + inflation) - 1, where the bill rate is the annual average of the monthly 3-month Treasury bill rate (Federal Reserve H.15, discount basis) and inflation is the change in the annual average CPI-U from the year before. The 2025 CPI average uses 11 months because the BLS has no October 2025 value. The compounding figures treat each annual average rate as a return for the year, which is an approximation.'),
      kindLine('Method', 'The published rate is a discount rate, which understates the yield a saver earns' + (yieldGap != null ? ' by about ' + nf(yieldGap, 2) + ' points a year on average over the record, and by more when rates are high' : '') + '. The real returns here use it as published, so they are a little lower than a saver would have earned. All figures are before tax.'),
      kindLine('Measured', realTaxed.length ? 'With an assumed flat ' + TAX + ' percent tax on the interest (an illustration, not anyone\'s tax), the real return would have averaged ' + D.format(taxedMean, 'sgn2') + '% a year and been below zero in ' + taxedNeg + ' of the ' + realTaxed.length + ' years, against ' + D.format(mean, 'sgn2') + '% and ' + neg + ' of ' + real.length + ' before tax. The table above gives the purchasing power of 100 on both bases.' : 'No data.'),
      kindLine('Limits', 'This is one kind of saving, and the best-case safe one. Bank deposits usually pay much less (the FDIC national average savings rate was 0.38 percent in October 2026, against inflation of 3.7 percent), longer bonds, shares and houses are not shown, and a saver is not a borrower\'s counterparty in any simple sense: a loan creates a deposit and a debt together.'),
    ]));
    host.appendChild(h('div', { class: 'pr-interp' }, [
      h('p', { class: 'pr-kindline' }, [h('span', { class: 'badge pr-kind', text: 'Interpretation' }), ' ', 'Whether a negative real return is a transfer from savers to borrowers depends on whether the inflation was expected when the rate was set. Doepke and Schneider (2006) find that in the US inflation moves wealth mainly away from older, bond-holding households and toward younger households with fixed-rate mortgages, and that the government, the largest debtor, gains. These charts measure one asset and cannot say who gained.']),
      h('p', { class: 'chart-note' }, ['Paper: ', U.link('Doepke and Schneider, "Inflation and the Redistribution of Nominal Wealth", Journal of Political Economy 114(6), 2006', 'https://ideas.repec.org/a/ucp/jpolec/v114y2006i6p1069-1097.html'), '.']),
    ]));
    host.appendChild(sourceLine(['tbill3m', 'cpi_u']));
    renderCum();
    sections.push({ id: 'savings', render() { if (barBox.chart) barBox.chart.draw(); renderCum(); } });
  }

  /* =====================================================================================
     6f. method, limits and sources
     ===================================================================================== */
  function initMethod() {
    const host = $('pr-method');
    const defs = [
      ['Window', 'A start month and an end month. The fixed windows end at the newest value of the series and start at the month named, or at the first value after it (never more than twelve months late; otherwise the window is not shown).'],
      ['Growth a year', 'The steady yearly rate that links the start value to the end value: (end / start) to the power 1 / years, minus 1.'],
      ['Doubling time', 'ln 2 / ln(1 + growth). The rule of 70 (70 divided by the percent) is only a shortcut. A series that fell has a halving time instead.'],
      ['Purchasing power', 'The start value of a price index divided by its end value: the share of its buying power that money keeps.'],
      ['After consumer prices', 'Total change divided by the change in the country\'s consumer price index between the same dates (averaged over the year or quarter for a yearly or quarterly series). The US index is CPI-U. The UK index is the CPI for a window that starts in 1988 or later and the RPI for an earlier start, because the CPI begins in 1988. The RPI includes owner-occupiers\' mortgage interest and a house depreciation cost based on house prices, so it rises with house prices and makes them look flatter after inflation; it is used only where the CPI does not reach. Canada uses its CPI.'],
      ['Index', '100 in the first month of the window, then each value divided by that start value.'],
      ['Hours of work', 'Price divided by average hourly earnings of production and nonsupervisory workers in the same month. A full-time year is taken as ' + nf(HOURS_PER_YEAR, 0) + ' hours (40 hours x 52 weeks), which is an assumption.'],
      ['Ounces of gold', 'Price divided by the price of a troy ounce of gold for the calendar year, from data/history.js. That file holds annual averages from 1971 and official prices before. Its 2026 point is one spot price, not an annual average, so 2026 is left empty.'],
      ['Real return', '(1 + rate) / (1 + inflation) - 1, with both as yearly percentages. It is an after-the-fact measure.'],
      ['Years of income or pay', 'House price divided by a year of income or pay for the same year. Never a price in one year divided by income in another.'],
    ];
    const defList = h('dl', { class: 'pr-defs' }, defs.map((d) => h('div', null, [h('dt', { text: d[0] }), h('dd', { text: d[1] })])));

    const limits = [
      'Consumer price indexes measure a changing basket. The CPI treats housing through rents and owners\' equivalent rent, not through the purchase price of houses, so "prices in general" and "house prices" are different baskets by construction.',
      'Pay is an average for production and nonsupervisory workers, a changing mix of jobs. It is not the pay of a typical worker and it excludes managers. Median household income is for whole households and is not a wage.',
      'The median new house is not a constant-quality house: size, location and mix change. The FHFA index is constant quality but has no dollar level, and the Shiller series (to 1974) is built from several sources, so levels before 1953 are less comparable.',
      'The everyday items are staples and energy: bread, eggs, milk, ground beef, coffee, sugar, gasoline, electricity, a first-class stamp and a cola proxy. They are competitive goods, so most show as cheaper in hours of work. Categories where prices rose most, such as medical care, college tuition, childcare and rent, are not in the item set, so this chart does not show them and says nothing about them. The Dollars unit is one click away and the bars name the change in the other unit beside the chosen one.',
      'There is no single national price of land. Farm real estate (USDA, from 1850) includes buildings and is mostly rural. FHFA\'s residential land estimates cover 2012 to 2022 only and are experimental. Canada\'s land index is a builders\' price.',
      'The first-class stamp is a price per letter. The service behind it changed, the two oldest rates are per half ounce, and a change in the rate is dated to the day, so the monthly value uses the rate in effect on the 15th.',
      'No continuous cola price exists. The BLS cola and soft drink series are separate pieces with gaps, and the soft drink proxy leaves them unjoined. The CPI for carbonated drinks is continuous but is an index and covers a changing basket.',
      'The January 1913 starting values for bread, eggs, milk, coffee and sugar are single figures from a BLS table. The products are not defined the same way as today\'s series, so those 1913 windows are indicative.',
      'The BLS has no values for October 2025 because of a lapse in appropriations. Those months are gaps in every BLS series and are never estimated.',
      'US prices before 1913 are not included, because no open source with permitted terms was found. Mortgage rates are not included either, so there is no mortgage payment view.',
      'UK and Canada are limited to consumer prices and housing (and UK earnings). The dollars, hours of work and gold views need US prices and US pay.',
    ];
    const disagree = [
      'Which price index to use (CPI-U, PCE, RPI or CPI in the UK), and how quality change and housing are treated. This page uses the headline index of each country and does not rank them.',
      'What drives house prices relative to prices in general: land and building limits, interest rates, credit supply, demographics and taxes. Most researchers think several interact. The charts here do not test any of them.',
    ];

    // the series table
    const rows = [];
    Object.keys(P.series).forEach((id) => {
      const s = P.series[id], cl = D.clean(s.data);
      if (!cl.length) return;
      rows.push([id, s.label + (s.proxy ? ' (proxy)' : ''), s.unit, label(cl[0].key) + ' to ' + label(cl[cl.length - 1].key), { text: s.sourceId, href: s.url }, s.licence, s.retrieved]);
    });
    const tHost = h('div', { class: 'pr-table tableview', tabindex: '0', role: 'region', 'aria-label': 'Every series used, with source and licence' });
    U.table(tHost, 'Every price series used on this page: coverage, source and licence', [
      { label: 'Id' }, { label: 'Series', wrap: true }, { label: 'Unit' }, { label: 'Covers' }, { label: 'Source id' }, { label: 'Licence', wrap: true }, { label: 'Retrieved' },
    ], rows);

    const curList = h('ul', { class: 'pr-bl' });
    if (CUR && CUR.sources) {
      Object.keys(CUR.sources).forEach((k) => {
        const s = CUR.sources[k];
        curList.appendChild(h('li', null, [U.link(s.title, s.url), ', ' + s.publisher + '. Accessed ' + s.accessed + '. ' + s.licence]));
      });
    }
    if (gold.meta) curList.appendChild(h('li', null, [h('b', { text: 'Gold price: ' }), gold.meta.label + ', from data/history.js (retrieved ' + gold.meta.retrieved + '). ' + gold.meta.source + ' No licence is recorded for this series; it is shown for comparison and its reuse terms are for the owner of that file to confirm.']));
    const caIds = Object.keys(P.series).filter((id) => /Statistics Canada/.test(P.series[id].source || ''));
    if (caIds.length) {
      curList.appendChild(h('li', null, [h('b', { text: 'Statistics Canada: ' }), 'Contains information licensed under the Statistics Canada Open Licence. ' + caIds.map((id) => 'Adapted from ' + P.series[id].source + ', retrieved ' + P.series[id].retrieved).join('; ') + '. This does not constitute an endorsement by Statistics Canada of this product.']));
    }

    host.appendChild(kindLine('Method', 'Every figure on this page is computed in your browser from the data files by assets/derive.js. The Download CSV button under a chart gives the numbers as drawn, and the table twin shows them as text.'));
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Definitions' }));
    host.appendChild(defList);
    host.appendChild(h('h3', { class: 'pr-h3', text: 'What these measures cannot show' }));
    host.appendChild(h('ul', { class: 'pr-bl pr-limits' }, limits.map((t) => h('li', { text: t }))));
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Where economists disagree' }));
    host.appendChild(h('ul', { class: 'pr-bl pr-limits' }, disagree.map((t) => h('li', null, [h('span', { class: 'badge pr-kind', text: 'Interpretation' }), ' ' + t]))));
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Series, sources and licences' }));
    host.appendChild(tHost);
    host.appendChild(h('h3', { class: 'pr-h3', text: 'Cited facts and other files' }));
    host.appendChild(curList);
    host.appendChild(h('p', { class: 'chart-note', text: 'Licences differ by source; each source\'s licence is in the table above and in tools/README.md in the project repository. Values are as published at each retrieval date and are revised by their sources.' }));
    sections.push({ id: 'method', render() {} });
  }

  /* =====================================================================================
     7. start
     ===================================================================================== */
  function init() {
    applyHash();
    initToolbar();
    if (optionalMissing.length && $('pr-toolbar') && $('pr-toolbar').parentNode) {
      $('pr-toolbar').parentNode.insertBefore(h('div', { class: 'notice', role: 'status' }, [h('p', { text: 'These optional data files did not load: ' + optionalMissing.join('; ') + '. The items that need them are left out and the rest of the page works. Check your connection, then reload the page.' })]), $('pr-toolbar'));
    }
    initJump();
    initCalc();
    initItems();
    initPop();
    initHouses();
    initSavings();
    initMethod();
    renderAll();
    const id = (window.location.hash || '').replace(/^#/, '');
    if (id && id.indexOf('=') < 0 && $(id)) window.requestAnimationFrame(() => jumpTo(id));
  }
  try {
    init();
  } catch (e) {
    bail('Something went wrong while drawing the page' + (e && e.message ? ': ' + e.message : '') + '. Reload the page; if it persists, the data files may be out of date.');
    if (window.console && console.error) console.error(e);
  }
})();
