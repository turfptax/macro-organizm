/* Debt and Interest page script.
   Needs data/debt.js (window.MACRO_DEBT), assets/ui.js (MacroUI), assets/derive.js (MacroDerive) and assets/ts-chart.js (TSChart).
   Every chart reads the one data file; ratios that need two inputs (interest over revenue, the implied interest rate, r minus g)
   are computed here from inputs of the same year, never from a stock and a flow of different years. Text from the data goes in
   through textContent. The address keeps the controls as ?key=value so a view can be shared; a #section anchor is left alone. */
(function () {
  'use strict';

  const U = window.MacroUI, TS = window.TSChart, D = window.MacroDerive, DATA = window.MACRO_DEBT, Shell = window.MacroShell;
  if (!U || !TS || !D || !DATA || !DATA.series || !DATA.countries || !DATA.indicators) {
    if (Shell && Shell.fatal) {
      Shell.fatal('The page could not load', 'A script or data file on this page did not load. Reload the page, and check that nothing is blocking files from this site.');
    }
    return;
  }
  const h = U.h;

  /* ---------- economies and colours ---------- */
  // data order (the file's order), chip and legend order (validated in the page head comment), and the three that can be
  // added one at a time in ink
  const ALL = ['US', 'GB', 'JP', 'DE', 'FR', 'IT', 'CA', 'CN', 'EA'];
  const ORDER = ['GB', 'US', 'JP', 'IT', 'CA', 'CN'];
  const SPOTS = ['DE', 'FR', 'EA'];
  const INK = 'var(--ink)', FAINT = 'var(--faint)';
  const STYLE = {
    GB: { color: 'var(--c-orange)', shape: 'square', short: 'UK' },
    US: { color: 'var(--c-blue)', shape: 'circle', short: 'US' },
    JP: { color: 'var(--c-green)', shape: 'diamond', short: 'Japan' },
    IT: { color: 'var(--c-magenta)', shape: 'triangle', short: 'Italy' },
    CA: { color: 'var(--c-yellow)', shape: 'star', short: 'Canada' },
    CN: { color: 'var(--c-aqua)', shape: 'cross', short: 'China' },
    DE: { color: INK, shape: 'hexagon', short: 'Germany' },
    FR: { color: INK, shape: 'down', short: 'France' },
    EA: { color: INK, shape: 'pentagon', short: 'Euro area' },
  };

  const SER = DATA.series, IND = DATA.indicators, CTY = DATA.countries, LAT = DATA.latest || {};
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // the data file says which year is the last one and which vintage it is; the text below is built from that, not typed in
  const lastAct = (id) => (hasOwn(IND, id) ? String(IND[id].lastActual != null ? IND[id].lastActual : IND[id].asOf) : 'n/a');
  const vintageOf = (id) => (hasOwn(IND, id) ? String(IND[id].vintage || '') : '');
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const cname = (iso) => (hasOwn(CTY, iso) ? CTY[iso].name : iso);
  const sname = (iso) => (hasOwn(STYLE, iso) ? STYLE[iso].short : iso);

  /* ---------- state and address ---------- */
  const DEFAULTS = { sel: ['GB', 'US', 'JP', 'IT', 'CA'], spot: '', range: 'all', smooth: '0', ctx: '0', focus: 'US', ls: 'long', im: 'gdp', ds: 'HH', ub: 'omb', cs: 'GG', cy: '2000' };
  const OPTIONS = {
    spot: ['', 'DE', 'FR', 'EA'], range: ['all', '1950', '1980', '2000'], smooth: ['0', '5'], ctx: ['0', '1'], focus: ALL,
    ls: ['long', 'weo', 'estat'], im: ['gdp', 'rev', 'rate'], ds: ['HH', 'NFC', 'PRIV'], ub: ['omb', 'imf'], cs: ['GG', 'HH', 'NFC'], cy: ['2000', '2007', '2015'],
  };
  const PARAM = { spot: 's', range: 'r', smooth: 'sm', ctx: 'x', focus: 'f', ls: 'ls', im: 'im', ds: 'ds', ub: 'ub', cs: 'cs', cy: 'cy' };
  const state = { sel: new Set(DEFAULTS.sel) };
  Object.keys(OPTIONS).forEach((k) => { state[k] = DEFAULTS[k]; });

  function readUrl() {
    let p;
    try { p = new URLSearchParams(window.location.search); } catch (e) { return; }
    if (p.has('c')) {
      state.sel = new Set(p.get('c').split(',').filter((x) => ORDER.indexOf(x) >= 0));
    }
    Object.keys(OPTIONS).forEach((k) => {
      const v = p.get(PARAM[k]);
      if (v != null && OPTIONS[k].indexOf(v) >= 0) state[k] = v;
    });
    if (!state.sel.size && !state.spot) state.sel = new Set(DEFAULTS.sel);
  }
  function writeUrl() {
    const p = new URLSearchParams();
    const chosen = ORDER.filter((i) => state.sel.has(i)).join(',');
    if (chosen !== ORDER.filter((i) => DEFAULTS.sel.indexOf(i) >= 0).join(',')) p.set('c', chosen);
    Object.keys(OPTIONS).forEach((k) => { if (state[k] !== DEFAULTS[k]) p.set(PARAM[k], state[k]); });
    const q = p.toString().replace(/%2C/gi, ',');
    try { window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash); } catch (e) { /* file:// or sandboxed */ }
  }

  /* ---------- data helpers ---------- */
  function rowsOf(ind, iso) { return hasOwn(SER, ind) && hasOwn(SER[ind], iso) ? SER[ind][iso] : null; }
  function mapOf(ind, iso) {
    const m = new Map();
    (rowsOf(ind, iso) || []).forEach((r) => { if (r && fin(r[1])) m.set(+r[0], r[1]); });
    return m;
  }
  function countValid(rows) { let n = 0; (rows || []).forEach((r) => { if (r && fin(r[1])) n++; }); return n; }
  function lastValid(rows) {
    if (!rows) return null;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i] && fin(rows[i][1])) return rows[i];
    return null;
  }
  function firstValid(rows) {
    if (!rows) return null;
    for (let i = 0; i < rows.length; i++) if (rows[i] && fin(rows[i][1])) return rows[i];
    return null;
  }
  // a map of year -> value becomes rows; a null row marks the first missing year of an interior gap, so the line breaks there
  function mapToRows(m) {
    const ys = Array.from(m.keys()).sort((a, b) => a - b), out = [];
    ys.forEach((y, i) => {
      if (i > 0 && y - ys[i - 1] > 1) out.push([ys[i - 1] + 1, null]);
      out.push([y, m.get(y)]);
    });
    return out;
  }
  function buildMap(y0, y1, f) {
    const m = new Map();
    for (let y = y0; y <= y1; y++) {
      const v = f(y);
      if (fin(v)) m.set(y, v);
    }
    return m;
  }
  function smoothRows(rows, n) { return D.smooth(rows, n).map((r) => [+r[0], r[1]]); }
  function lastN(rows, n) { return (rows || []).filter((r) => r && fin(r[1])).slice(-n); }

  /* ---------- formatting ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pct = (v, d) => D.format(v, 'p' + (d == null ? 1 : d));
  const num = (v, d) => D.format(v, 'n' + (d == null ? 1 : d));
  const sgn = (v, d) => D.format(v, 'sgn' + (d == null ? 1 : d));
  const bn = (v) => '$' + num(v, 1) + ' billion';
  function qLabel(p) { return String(p).replace('-Q', ' Q'); }
  function dateLabel(s) {
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return +m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) return MONTHS[+m[2] - 1] + ' ' + m[1];
    return String(s);
  }
  // a tick label with its own unit, for an axis that spans millions to trillions
  function usdTick(v) {
    const unit = v >= 1e12 ? [1e12, 'T'] : v >= 1e9 ? [1e9, 'B'] : v >= 1e6 ? [1e6, 'M'] : v >= 1e3 ? [1e3, 'K'] : [1, ''];
    return '$' + String(+(v / unit[0]).toPrecision(3)) + unit[1];
  }
  const usdText = (v) => (v < 1e6 ? '$' + num(v / 1e3, 1) + ' thousand' : v >= 1e12 ? '$' + num(v / 1e12, 2) + ' trillion' : v >= 1e9 ? '$' + num(v / 1e9, 1) + ' billion' : '$' + num(v / 1e6, 1) + ' million');
  function list(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /* ---------- selection ---------- */
  function econList() {
    const out = ORDER.filter((i) => state.sel.has(i)).map((i) => ({ iso: i, spot: false }));
    if (state.spot) out.push({ iso: state.spot, spot: true });
    return out;
  }
  const isChosen = (iso) => econList().some((e) => e.iso === iso);
  function styleOf(e) {
    const s = STYLE[e.iso];
    return e.spot ? { color: INK, shape: s.shape, role: 'spot' } : { color: s.color, shape: s.shape, role: 'data' };
  }
  const rangeStart = () => (state.range === 'all' ? null : +state.range);
  // the left edge of a chart: the range start when some series reaches back past it, else the data's own start
  function xConf(series) {
    const rs = rangeStart();
    if (rs == null) return {};
    let first = Infinity;
    series.forEach((s) => {
      if (s.role === 'context') return;
      const f = firstValid(s.rows);
      if (f && +f[0] < first) first = +f[0];
    });
    return first < rs ? { min: rs } : {};
  }

  // one line per chosen economy (plus faint lines for the rest on request). getRows(iso) -> rows or null.
  function lineSeries(getRows, o) {
    const out = [], missing = [], useSmooth = o.smooth && state.smooth !== '0';
    const prep = (rows) => (useSmooth ? smoothRows(rows, +state.smooth) : rows);
    econList().forEach((e) => {
      const raw = getRows(e.iso);
      if (!raw || !countValid(raw)) { missing.push(e.iso); return; }
      out.push(Object.assign({
        id: e.iso + (o.suffix || ''), iso: e.iso, name: cname(e.iso), short: sname(e.iso), rows: prep(raw), fmt: o.fmt, unit: o.unit, panel: o.panel, legend: o.legend,
      }, styleOf(e)));
    });
    if (state.ctx === '1') {
      ALL.forEach((iso) => {
        if (isChosen(iso)) return;
        const raw = getRows(iso);
        if (!raw || !countValid(raw)) return;
        out.push({ id: 'ctx-' + iso + (o.suffix || ''), iso, name: cname(iso), rows: prep(raw), role: 'context', color: FAINT, shape: 'circle', legend: false, domain: false, fmt: o.fmt, unit: o.unit, panel: o.panel });
      });
    }
    return { series: out, missing };
  }

  /* ---------- r minus g ---------- */
  // Everything for one economy and basis, keyed by year: r, g, r minus g, the debt ratio, the primary balance.
  const rmgCache = {};
  function rmgBundle(iso, basis) {
    const key = iso + '|' + basis;
    if (!rmgCache[key]) rmgCache[key] = basis === 'omb' && iso === 'US' ? rmgFederal() : rmgImf(iso);
    return rmgCache[key];
  }
  function rmgImf(iso) {
    const ea = iso === 'EA';
    const dInd = ea ? 'ESTAT_GD' : 'd', iInd = ea ? 'ESTAT_INT' : 'ie';
    const dm = mapOf(dInd, iso), im = mapOf(iInd, iso), gm = mapOf('NGDP_GROWTH', iso), pm = ea ? new Map() : mapOf('pb', iso);
    const r = new Map(), g = new Map(), gap = new Map();
    const ys = Array.from(im.keys());
    if (ys.length) {
      for (let y = Math.min.apply(null, ys); y <= Math.max.apply(null, ys); y++) {
        const rv = D.effectiveRateFromRatios(im.get(y), dm.get(y - 1), gm.get(y));
        if (rv != null) { r.set(y, rv); g.set(y, gm.get(y)); gap.set(y, D.rMinusG(rv, gm.get(y))); }
      }
    }
    return {
      kind: 'imf', iso, r, g, gap, d: dm, pb: pm,
      debtName: ea ? 'Gross debt (Maastricht)' : 'Gross public debt',
      basis: ea
        ? 'Euro area (Eurostat EA20): interest payable and Maastricht gross debt, both as shares of GDP, with nominal GDP growth of the same area; calendar years. No primary balance is published for the aggregate.'
        : 'General government where the IMF has it, central government otherwise (IMF Public Finances in Modern History): interest paid, gross debt and primary balance as shares of GDP, with nominal GDP growth from BEA, the World Bank or Eurostat; calendar years.',
      inds: ea ? ['ESTAT_INT', 'ESTAT_GD', 'NGDP_GROWTH'] : ['ie', 'd', 'pb', 'NGDP_GROWTH'],
    };
  }
  function rmgFederal() {
    const gdp = mapOf('US_GDP_FY_BN', 'US'), pub = mapOf('US_DEBT_PUBLIC_GDP', 'US'), ni = mapOf('US_NETINT_BN', 'US');
    const rc = mapOf('US_RECEIPTS_BN', 'US'), ou = mapOf('US_OUTLAYS_BN', 'US');
    const r = new Map(), g = new Map(), gap = new Map(), pb = new Map();
    const ys = Array.from(gdp.keys());
    for (let y = Math.min.apply(null, ys) + 1; y <= Math.max.apply(null, ys); y++) {
      if (!(gdp.has(y) && gdp.has(y - 1) && pub.has(y - 1) && ni.has(y) && rc.has(y) && ou.has(y))) continue;
      const gv = (gdp.get(y) / gdp.get(y - 1) - 1) * 100;
      const rv = D.effectiveRate(ni.get(y), (pub.get(y - 1) / 100) * gdp.get(y - 1));
      if (rv == null) continue;
      r.set(y, rv); g.set(y, gv); gap.set(y, D.rMinusG(rv, gv));
      pb.set(y, ((rc.get(y) - (ou.get(y) - ni.get(y))) / gdp.get(y)) * 100);
    }
    return {
      kind: 'omb', iso: 'US', r, g, gap, d: pub, pb,
      debtName: 'Federal debt held by the public',
      basis: 'US federal budget, fiscal years that end on 30 September: net interest outlays divided by debt held by the public at the end of the previous fiscal year (both in dollars), nominal growth of fiscal-year GDP, and the primary balance from receipts, outlays and net interest (OMB Historical Tables; Treasury Monthly Treasury Statement).',
      inds: ['US_NETINT_BN', 'US_DEBT_PUBLIC_GDP', 'US_GDP_FY_BN', 'US_RECEIPTS_BN', 'US_OUTLAYS_BN'],
    };
  }
  const rmgBasisFor = (iso) => (iso === 'US' ? state.ub : 'imf');

  /* ---------- small DOM helpers ---------- */
  // a few terms link to their definition in the notes at the end of the page
  const JARGON = [['primary balance', '#def-primary-balance'], ['r minus g', '#def-r-minus-g'], ['general government', '#def-central-general']];
  function J(text) {
    let rest = String(text);
    const out = [];
    while (rest) {
      let best = null;
      JARGON.forEach((j) => { const i = rest.toLowerCase().indexOf(j[0]); if (i >= 0 && (!best || i < best.i)) best = { i, j }; });
      if (!best) { out.push(rest); break; }
      if (best.i > 0) out.push(rest.slice(0, best.i));
      out.push(h('a', { href: best.j[1], title: 'Defined in the notes at the end of the page', text: rest.slice(best.i, best.i + best.j[0].length) }));
      rest = rest.slice(best.i + best.j[0].length);
    }
    return out;
  }
  const KIND = { fact: 'Accounting fact', trend: 'Measured trend', view: 'Interpretation' };
  function note(kind, body) {
    return h('div', { class: 'dp-note' }, [h('span', { class: 'badge', text: KIND[kind] }), h('div', null, body)]);
  }
  function views(one, other) {
    return h('div', { class: 'dp-views' }, [
      h('span', null, [h('b', { text: 'One view: ' }), one]),
      h('span', null, [h('b', { text: 'Another view: ' }), other]),
    ]);
  }
  // one source paragraph per series; a series built from several providers lists each of them
  function sources(ids) {
    const out = [], seen = new Set();
    ids.forEach((id) => {
      if (seen.has(id) || !hasOwn(IND, id)) return;
      seen.add(id);
      const ind = IND[id], parts = Array.isArray(ind.parts) ? ind.parts : [];
      const kids = ['Source: '];
      if (parts.length) {
        parts.forEach((p, i) => {
          if (i) kids.push('; ');
          kids.push(U.link(p.source, p.url));
        });
      } else kids.push(U.link(ind.source, ind.url));
      const vint = ind.vintage && ind.source.indexOf(ind.vintage) < 0 && !/retrieved/i.test(ind.vintage) ? '; ' + ind.vintage : '';
      kids.push(' (series ' + id + (ind.code && ind.code !== id ? ', code ' + ind.code : '') + vint + '; retrieved ' + ind.retrieved + '; latest observation ' + ind.asOf + ').');
      out.push(h('p', { class: 'chart-note' }, kids));
    });
    return out;
  }
  function downloadText(name, text, type) {
    const blob = new Blob([text], { type: (type || 'text/csv') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csvText(cols, rows) {
    const cell = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.map((c) => cell(c.label)).join(',')].concat(rows.map((r) => r.map(cell).join(','))).join('\r\n') + '\r\n';
  }

  const syncers = [];
  function segControl(label, options, get, set, extra) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    const btns = options.map((o) => {
      const b = h('button', { type: 'button', text: o.text, title: o.title || null, 'data-v': o.v });
      b.addEventListener('click', () => set(o.v));
      seg.appendChild(b);
      return b;
    });
    const hint = h('span', { class: 'tool-hint' });
    const el = h('div', { class: 'tool' }, [h('span', { class: 'tool-label' }, [label, hint]), seg]);
    const ctl = {
      el,
      sync() {
        const cur = get();
        btns.forEach((b) => b.setAttribute('aria-pressed', String(cur === b.dataset.v)));
        if (extra && extra.hint) hint.textContent = extra.hint() ? ' (' + extra.hint() + ')' : '';
        if (extra && extra.visible) el.hidden = !extra.visible();
      },
    };
    syncers.push(ctl);
    return ctl;
  }

  /* ---------- chart cards ---------- */
  function cardShell(id, title) {
    const root = h('section', { class: 'card chartcard dp-card', id, 'aria-labelledby': id + '-title' });
    const heading = h('h2', { class: 'chart-title', id: id + '-title', text: title });
    const sub = h('p', { class: 'chart-sub' });
    const ctl = h('div', { class: 'dp-ctl' });
    const host = h('div', { class: 'dp-chart' });
    const miss = h('p', { class: 'chart-note dp-miss', hidden: true });
    const tbl = h('div', { class: 'tableview', id: id + '-table', hidden: true, tabindex: '0', role: 'region', 'aria-label': title + ', as a table' });
    const extra = h('div', { class: 'dp-extra' });
    const notes = h('div', { class: 'dp-notes' });
    const src = h('div', { class: 'dp-srcs' });
    root.appendChild(h('div', { class: 'chart-head' }, [heading, sub]));
    [ctl, host, miss, tbl, extra, notes, src].forEach((n) => root.appendChild(n));
    return { id, root, heading, sub, ctl, host, miss, tbl, extra, notes, src, chart: null, tableOn: false, syncTable() {} };
  }
  // the Table and CSV buttons; opts.table(host) fills the table, opts.csv() downloads
  function toolButtons(sh, opts) {
    const tb = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', 'aria-controls': sh.tbl.id, title: 'Show the numbers behind this chart as a table', text: 'Show as table' });
    const cb = h('button', { class: 'btn', type: 'button', title: 'Download the numbers in the chart as a CSV file', text: 'Download CSV' });
    tb.addEventListener('click', () => { sh.tableOn = !sh.tableOn; sh.syncTable(); });
    cb.addEventListener('click', () => opts.csv());
    sh.syncTable = () => {
      tb.setAttribute('aria-pressed', String(!!sh.tableOn));
      sh.tbl.hidden = !sh.tableOn;
      if (sh.tableOn) opts.table(sh.tbl);
    };
    sh.ctl.appendChild(h('div', { class: 'dp-actions' }, [tb, cb]));
  }
  // draw or redraw the card's chart
  function putChart(sh, spec) {
    if (!sh.chart) sh.chart = TS.create(sh.host, spec); else sh.chart.update(spec);
    sh.syncTable();
  }
  function tsTools(sh, filename) {
    toolButtons(sh, {
      table: (host) => { if (sh.chart) sh.chart.mountTable(host); },
      csv: () => { if (sh.chart) sh.chart.downloadCsv(filename); },
    });
  }
  // small-multiples charts use two columns when the card is wide enough; a change of width redraws the whole card
  const colsFor = (w) => (w >= 700 ? 2 : 1);
  function watchCols(sh, redraw) {
    if (typeof ResizeObserver !== 'function') return;
    new ResizeObserver(() => {
      if (sh.chart && sh.host.clientWidth > 0 && colsFor(sh.host.clientWidth) !== sh.cols) redraw();
    }).observe(sh.host);
  }
  function missingText(sh, missing, why) {
    if (!missing.length) { sh.miss.hidden = true; sh.miss.textContent = ''; return; }
    sh.miss.hidden = false;
    sh.miss.textContent = 'No data on this measure for ' + list(missing.map(cname)) + (why ? ': ' + why : '.');
  }
  function tableBox(caption, cols, rows) {
    const box = h('div', { class: 'tableview', tabindex: '0', role: 'region', 'aria-label': caption });
    U.table(box, caption, cols, rows);
    return box;
  }

  /* ---------- 1. government debt ---------- */
  const LEVEL = {
    long: { ind: 'd', name: 'IMF historical series', sub: 'Gross public debt at year end, from the IMF ' + vintageOf('d') + '. Annual and long run, to ' + lastAct('d') + ', the last year the IMF counts as actual; the newest year may still be an estimate. A break in a line is a run of years the source has no value for.' },
    weo: { ind: 'GGXWDG_NGDP', name: 'IMF outlook database', sub: 'General government gross debt, IMF ' + vintageOf('GGXWDG_NGDP') + ', from 1980 or the first year the IMF has it to ' + lastAct('GGXWDG_NGDP') + '. Forecast years are removed, not drawn. The IMF feed does not flag estimates, so the newest year may be one.' },
    estat: { ind: 'ESTAT_GD', name: 'Eurostat, Maastricht', sub: 'General government consolidated gross debt at nominal value (the Maastricht definition), Eurostat, year end, 1995 to the last actual year. Published here for Germany, France, Italy and the euro area only.' },
  };
  function buildLevel() {
    const sh = cardShell('level', 'Government debt, % of GDP');
    const seg = segControl('Measure', [
      { v: 'long', text: 'Long run (IMF historical)', title: 'IMF Public Finances in Modern History, to ' + lastAct('d') },
      { v: 'weo', text: 'Recent (IMF outlook)', title: 'IMF World Economic Outlook, 1980 to ' + lastAct('GGXWDG_NGDP') },
      { v: 'estat', text: 'Maastricht (Eurostat)', title: 'Eurostat, 1995 to ' + lastAct('ESTAT_GD') + ', Germany, France, Italy and the euro area' },
    ], () => state.ls, (v) => { state.ls = v; changed(); });
    sh.ctl.appendChild(seg.el);
    tsTools(sh, 'debt-government-debt.csv');
    const breaks = {};
    (IND.d.breaks || []).forEach((b) => { breaks[b.country + '|' + b.year] = b; });

    function update() {
      const cfg = LEVEL[state.ls];
      sh.sub.textContent = cfg.sub;
      const r = lineSeries((iso) => rowsOf(cfg.ind, iso), { fmt: 'p1', unit: '% of GDP' });
      const why = state.ls === 'long' ? 'the IMF historical series has no euro-area row; try the outlook or Eurostat measure.' : state.ls === 'estat' ? 'Eurostat is published here for Germany, France, Italy and the euro area only.' : '';
      missingText(sh, r.missing, why);
      putChart(sh, {
        title: 'Government debt, % of GDP (' + cfg.name + ')', series: r.series, y: { fmt: 'p0', zero: true }, x: xConf(r.series), height: 340,
        empty: 'No data on this measure for the economies chosen.',
        readout: (s, p) => (state.ls === 'long' && breaks[s.iso + '|' + Math.round(p.t)] ? { sub: 'Probable change of coverage from this year (inferred, not flagged by the IMF)' } : null),
        table: { caption: 'Government debt, % of GDP (' + cfg.name + '), by year', filename: 'debt-government-debt.csv' },
      });

      // notes
      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Gross debt is everything the government owes, including amounts owed to other parts of government; net debt, which subtracts the financial assets it holds, is not shown. A ratio to GDP sets a stock (debt at year end) against a flow (a year of output).'));
      sh.notes.appendChild(note('fact', 'The measures below are separate compilations and are not joined into one line. The IMF historical series uses general government where it has it and central government otherwise, the IMF outlook database and Eurostat use general government on their own definitions, and BIS counts credit at face value. They can differ by tens of points for the same year.'));
      const shown = r.series.filter((s) => s.role !== 'context').map((s) => { const l = lastValid(s.rows); return l ? cname(s.iso) + ' ' + pct(l[1], 1) + ' (' + l[0] + ')' : null; }).filter(Boolean);
      if (shown.length) sh.notes.appendChild(note('trend', 'Latest value on this measure: ' + shown.join('; ') + '.'));
      if (state.ls === 'long') {
        const bl = (IND.d.breaks || []).filter((b) => isChosen(b.country));
        if (bl.length) {
          sh.notes.appendChild(note('trend', 'Probable changes of coverage in the IMF historical series for the economies chosen, inferred from steps in revenue and not flagged by the IMF: ' +
            bl.map((b) => cname(b.country) + ' from ' + b.year).join('; ') + '. The readout marks the first year on the new basis.'));
        }
      }
      sh.notes.appendChild(note('view', views(
        'High debt is a vulnerability: it raises the interest bill, limits room to respond to a shock, and a crisis in one sector often ends with its debts on the public balance sheet. The IMF Fiscal Monitor of April 2026 projects global public debt near 100 percent of GDP by 2029 (a projection, as cited on the Start page).',
        'Debts are also assets, there is no agreed threshold (the widely quoted 90 percent result did not survive correction: growth above 90 percent debt was 2.2 percent a year, not the -0.1 percent first reported, though still below the lower-debt bands; Herndon, Ash and Pollin, 2014), and demand for safe assets has let some governments carry high debt at low rates for decades, Japan for one. The chart cannot tell these readings apart.')));

      // the same economy, four published measures
      U.clear(sh.extra);
      const cell = (ind, iso) => { const l = lastValid(rowsOf(ind, iso)); return l ? pct(l[1], 1) + ' (' + l[0] + ')' : null; };
      const bis = (iso) => { const l = LAT.TC_GG && LAT.TC_GG[iso]; return l ? pct(l[1], 1) + ' (' + qLabel(l[0]) + ')' : null; };
      const rows = econList().map((e) => [cname(e.iso), cell('d', e.iso), cell('GGXWDG_NGDP', e.iso), bis(e.iso), cell('ESTAT_GD', e.iso)]);
      sh.extra.appendChild(tableBox('Latest reading of four published measures of government debt, % of GDP (not the same thing; see the first note)',
        [{ label: 'Economy' }, { label: 'IMF historical' }, { label: 'IMF outlook database' }, { label: 'BIS, face value' }, { label: 'Eurostat, Maastricht' }], rows));
      U.clear(sh.src);
      sources(['d', 'GGXWDG_NGDP', 'TC_GG', 'ESTAT_GD']).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 2. debt by sector ---------- */
  const SECTORS = [
    { id: 'tot', title: 'Total, sum of the three', ind: null },
    { id: 'gg', title: 'Government', ind: 'TC_GG' },
    { id: 'hh', title: 'Households', ind: 'TC_HH' },
    { id: 'nfc', title: 'Companies', ind: 'TC_NFC' },
  ];
  function sectorRows(iso, id) {
    const sec = SECTORS.find((s) => s.id === id);
    if (sec.ind) return rowsOf(sec.ind, iso);
    const a = mapOf('TC_GG', iso), b = mapOf('TC_HH', iso), c = mapOf('TC_NFC', iso);
    if (!a.size || !b.size || !c.size) return null;
    const m = new Map();
    Array.from(a.keys()).forEach((y) => { if (b.has(y) && c.has(y)) m.set(y, a.get(y) + b.get(y) + c.get(y)); });
    return m.size ? mapToRows(m) : null;
  }
  function niceMax(m) {
    if (!(m > 0)) return 100;
    return TS.niceDomain(0, m * 1.03, 5)[1];
  }
  function buildSectors() {
    const sh = cardShell('sectors', 'Who owes: government, households and companies, % of GDP');
    sh.sub.textContent = 'BIS total credit to the non-financial sector from all lenders, loans and debt securities, value at the end of the fourth quarter of each year. The three sector panels share one scale; the total has its own.';
    tsTools(sh, 'debt-by-sector.csv');
    watchCols(sh, () => update());

    function update() {
      sh.cols = colsFor(sh.host.clientWidth || 800);
      const all = [];
      SECTORS.forEach((sec, pi) => {
        const r = lineSeries((iso) => sectorRows(iso, sec.id), { fmt: 'p1', unit: sec.title, suffix: '|' + sec.id, panel: sec.id, legend: pi === 0 });
        r.series.forEach((s) => all.push(s));
      });
      const rs = rangeStart();
      const maxOf = (ids) => {
        let m = 0;
        all.forEach((s) => {
          if (s.role === 'context' || ids.indexOf(s.panel) < 0) return;
          s.rows.forEach((r) => { if (fin(r[1]) && (rs == null || +r[0] >= rs) && r[1] > m) m = r[1]; });
        });
        return m;
      };
      const maxTot = niceMax(maxOf(['tot'])), maxSec = niceMax(maxOf(['gg', 'hh', 'nfc']));
      const panels = SECTORS.map((sec) => ({ id: sec.id, title: sec.title, y: { min: 0, max: sec.id === 'tot' ? maxTot : maxSec, fmt: 'p0' }, endLabels: sec.id === 'tot' }));
      putChart(sh, {
        title: 'Debt by sector, % of GDP', series: all, panels, layout: 'grid', cols: sh.cols, panelHeight: 230,
        y: { fmt: 'p0', shared: false }, x: xConf(all), legendToggle: false, empty: 'No data for the economies chosen.',
        table: { caption: 'Debt by sector, % of GDP, by year (fourth-quarter values)', filename: 'debt-by-sector.csv' },
      });

      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Every borrower\'s debt is a lender\'s asset, and the lender can be a household, a bank, a pension fund or a foreign investor. These panels show the borrower side only.'));
      sh.notes.appendChild(note('fact', 'Households and companies are at market value and government at face value, so the total is an approximation. Credit means loans and debt securities; debts of banks and other financial firms, and promises such as pensions, are outside it. The total starts in the first year all three sectors exist.'));
      sh.notes.appendChild(note('view', views(
        'Fast credit growth has been the best-documented warning of financial crises and deeper recessions across 14 countries since 1870 (Schularick and Taylor, 2012), and private debt can become public debt when a crisis is paid for by the state.',
        'Not every boom ends badly, leverage has fallen in some places since 2008, and the link may owe more to capital flows and guarantees than to credit as such (Bordo and others, 2001). The panels show levels, not which reading fits.')));

      // the newest quarter
      U.clear(sh.extra);
      const q = (ind, iso) => (LAT[ind] && LAT[ind][iso]) || null;
      const cellq = (x) => (x ? pct(x[1], 1) : null);
      let period = '';
      const rows = econList().map((e) => {
        const g = q('TC_GG', e.iso), hh = q('TC_HH', e.iso), nf = q('TC_NFC', e.iso);
        if (g) period = g[0];
        const tot = g && hh && nf && g[0] === hh[0] && hh[0] === nf[0] ? g[1] + hh[1] + nf[1] : null;
        return [cname(e.iso), cellq(hh), cellq(nf), cellq(g), tot == null ? null : pct(tot, 1)];
      });
      sh.extra.appendChild(tableBox('Newest quarter' + (period ? ' (' + qLabel(period) + ')' : '') + ', % of GDP',
        [{ label: 'Economy' }, { label: 'Households' }, { label: 'Companies' }, { label: 'Government' }, { label: 'Total' }], rows));
      U.clear(sh.src);
      sources(['TC_GG', 'TC_HH', 'TC_NFC']).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 3. what the interest costs ---------- */
  const INTEREST = {
    gdp: {
      fmt: 'p1', unit: '% of GDP', head: 'interest paid, % of GDP', title: 'Interest paid on government debt, % of GDP',
      sub: 'Interest paid by government in a year as a share of that year\'s GDP: IMF Public Finances in Modern History (general government where the IMF has it), to ' + lastAct('ie') + '; the euro area from Eurostat, to ' + lastAct('ESTAT_INT') + '.',
    },
    rev: {
      fmt: 'p1', unit: '% of revenue', head: 'interest paid, % of government revenue', title: 'Interest paid, % of government revenue',
      sub: 'Interest paid divided by government revenue of the same year, both from the IMF series as shares of GDP, so the ratio uses inputs of one year and one coverage. The euro area has no revenue series here.',
    },
    rate: {
      fmt: 'p2', unit: '% a year', head: 'the implied interest rate', title: 'Implied interest rate on government debt, % a year',
      sub: 'Interest paid in a year divided by gross debt at the end of the year before, restated to the same year\'s GDP: r = interest(t) / debt(t-1) x (1 + g). It needs nominal GDP growth, which the sources have from 1961 (euro area from 1996).',
    },
  };
  function interestRows(iso, measure) {
    const ea = iso === 'EA', iInd = ea ? 'ESTAT_INT' : 'ie';
    const ie = rowsOf(iInd, iso);
    if (!ie) return null;
    if (measure === 'gdp') return ie;
    const im = mapOf(iInd, iso), ys = Array.from(im.keys());
    if (!ys.length) return null;
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (measure === 'rev') {
      const rv = mapOf('rev', iso);
      if (!rv.size) return null;
      return mapToRows(buildMap(y0, y1, (y) => (im.has(y) && rv.has(y) ? D.interestToRevenue(im.get(y), rv.get(y)) : null)));
    }
    const dm = mapOf(ea ? 'ESTAT_GD' : 'd', iso), gm = mapOf('NGDP_GROWTH', iso);
    if (!dm.size || !gm.size) return null;
    return mapToRows(buildMap(y0, y1, (y) => D.effectiveRateFromRatios(im.get(y), dm.get(y - 1), gm.get(y))));
  }
  function buildInterest() {
    const sh = cardShell('interest', 'What the interest costs');
    const seg = segControl('Measure', [
      { v: 'gdp', text: '% of GDP' }, { v: 'rev', text: '% of revenue' }, { v: 'rate', text: 'Implied rate' },
    ], () => state.im, (v) => { state.im = v; changed(); });
    sh.ctl.appendChild(seg.el);
    tsTools(sh, 'debt-interest-cost.csv');

    function update() {
      const cfg = INTEREST[state.im];
      sh.heading.textContent = 'What the interest costs: ' + cfg.head;
      sh.sub.textContent = cfg.sub;
      const r = lineSeries((iso) => interestRows(iso, state.im), { fmt: cfg.fmt, unit: cfg.unit, smooth: true });
      missingText(sh, r.missing, state.im === 'rev' ? 'the euro area has no revenue series here.' : '');
      const sm = state.smooth !== '0' ? ', ' + state.smooth + '-year average' : '';
      putChart(sh, {
        title: cfg.title + sm, series: r.series, y: { fmt: 'p0', zero: true }, x: xConf(r.series), height: 340, empty: 'No data on this measure for the economies chosen.',
        table: { caption: cfg.title + sm + ', by year', filename: 'debt-interest-' + state.im + '.csv' },
      });

      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Interest paid is the cost of past borrowing: the debt times the rates at which it was borrowed. Rates feed through with a lag, because old low-rate debt is replaced as it matures. The interest goes to whoever holds the debt (households, pension funds, banks, other governments, foreign investors).'));
      sh.notes.appendChild(note('fact', 'Revenue and GDP are different denominators. Against GDP the bill is set beside the whole economy; against revenue it is set beside what the government collects. The implied rate is an average across all the debt, not the rate on new borrowing.'));
      const cut = state.smooth !== '0' ? ' Lines are ' + state.smooth + '-year trailing averages; a year with a missing neighbour is left blank.' : '';
      const bl = (IND.ie.breaks || []).filter((b) => isChosen(b.country));
      if (bl.length && state.im !== 'rate') {
        sh.notes.appendChild(note('trend', 'Probable changes of coverage in the IMF series, inferred and not flagged: ' + bl.map((b) => cname(b.country) + ' from ' + b.year).join('; ') + '. Interest and revenue change basis together, so the ratio between them stays on one coverage within each period.' + cut));
      } else if (cut) sh.notes.appendChild(note('trend', cut.trim()));
      sh.notes.appendChild(note('view', views(
        'A large interest bill crowds out other spending or adds to borrowing, and it rises as old debt is refinanced at higher rates. The Congressional Budget Office projects US net interest rising from 3.3 percent of GDP in 2026 to 4.6 percent in 2036 (a projection, as summarised by House Budget Committee staff).',
        J('Interest is a transfer to bondholders and not resources destroyed, although the part paid to foreign holders leaves the domestic economy. The burden is set mostly by the rate regime, which can fall again (and can rise), and a high debt has been carried at low rates for decades in Japan. What decides whether debt grows relative to the economy is r minus g and the primary balance (the section on r minus g below), not the interest bill alone.'))));
      U.clear(sh.src);
      const ids = state.im === 'gdp' ? ['ie', 'ESTAT_INT'] : state.im === 'rev' ? ['ie', 'rev'] : ['ie', 'd', 'NGDP_GROWTH', 'ESTAT_INT', 'ESTAT_GD'];
      sources(ids).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 3b. United States: the federal interest bill ---------- */
  function usFedSeries() {
    const gdp = mapOf('US_GDP_FY_BN', 'US'), ni = mapOf('US_NETINT_BN', 'US'), rc = mapOf('US_RECEIPTS_BN', 'US');
    const ys = Array.from(ni.keys());
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return {
      usd: mapToRows(ni),
      gdp: mapToRows(buildMap(y0, y1, (y) => (ni.has(y) && gdp.has(y) ? (ni.get(y) / gdp.get(y)) * 100 : null))),
      rec: mapToRows(buildMap(y0, y1, (y) => (ni.has(y) && rc.has(y) ? D.interestToRevenue(ni.get(y), rc.get(y)) : null))),
      rate: rowsOf('US_AVG_RATE', 'US') || [],
      maps: { gdp, ni, rc, rate: mapOf('US_AVG_RATE', 'US') },
    };
  }
  function buildUsFed() {
    const sh = cardShell('usfederal', 'United States: the federal interest bill');
    sh.sub.textContent = 'Net interest outlays by fiscal year (ends 30 September, keyed by the year it ends): OMB Historical Tables to fiscal 2025, Treasury Monthly Treasury Statement for fiscal 2026. Always the United States, whichever economies are chosen above.';
    tsTools(sh, 'debt-us-federal-interest.csv');
    watchCols(sh, () => update());
    const srcBreak = (IND.US_NETINT_BN.breaks || [])[0];

    function update() {
      sh.cols = colsFor(sh.host.clientWidth || 800);
      const S = usFedSeries();
      const mk = (id, name, unit, rows, fmt) => ({ id, name, short: 'US', rows, color: STYLE.US.color, shape: 'circle', role: 'data', panel: id, unit, fmt, legend: false });
      const series = [
        mk('usd', 'Net interest', '$ billions', S.usd, (v) => bn(v)),
        mk('gdp', 'Net interest', '% of GDP', S.gdp, 'p2'),
        mk('rec', 'Net interest', '% of receipts', S.rec, 'p1'),
        mk('rate', 'Average rate on Treasury debt (calendar-year mean)', '% a year', S.rate, 'p2'),
      ];
      const panels = [
        { id: 'usd', title: 'Net interest outlays, $ billions', y: { fmt: 'usd0', zero: true } },
        { id: 'gdp', title: 'Net interest, % of GDP', y: { fmt: 'p0', zero: true } },
        { id: 'rec', title: 'Net interest, % of federal receipts', y: { fmt: 'p0', zero: true } },
        { id: 'rate', title: 'Average interest rate on Treasury debt, % a year (calendar-year mean)', y: { fmt: 'p0', zero: true } },
      ];
      putChart(sh, {
        title: 'United States federal interest', series, panels, layout: 'grid', cols: sh.cols, panelHeight: 210,
        y: { shared: false, fmt: 'p0' }, x: xConf(series), legend: false,
        readout: (s, p) => (srcBreak && s.id !== 'rate' && s.id !== 'gdp' && Math.round(p.t) === srcBreak.year ? { sub: 'Monthly Treasury Statement; earlier years from OMB' } : null),
        table: { caption: 'United States federal interest, by fiscal year', filename: 'debt-us-federal-interest.csv' },
      });

      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Net interest is the interest the Treasury pays on its securities less the interest it receives; gross interest, which also counts what one part of government pays another, is larger. Fiscal-year dollars are divided only by fiscal-year GDP and receipts. GDP for fiscal 2026 is not yet published in the OMB table, so the GDP panel ends a year earlier.'));
      const lastFy = lastValid(S.usd), lastRc = lastValid(S.rec), lastRate = LAT.US_AVG_RATE && LAT.US_AVG_RATE.US;
      const bits = [];
      if (lastFy) bits.push('Fiscal ' + lastFy[0] + ': net interest ' + bn(lastFy[1]) + (lastRc && +lastRc[0] === +lastFy[0] ? ', ' + pct(lastRc[1], 1) + ' of receipts' : '') + '.');
      const gdpLast = lastValid(S.gdp);
      let peak = null;
      S.gdp.forEach((r) => { if (r && fin(r[1]) && +r[0] <= 2000 && (!peak || r[1] > peak[1])) peak = r; });
      if (gdpLast && peak) bits.push('As a share of GDP it was ' + pct(gdpLast[1], 2) + ' in fiscal ' + gdpLast[0] + ' and had peaked at ' + pct(peak[1], 2) + ' in fiscal ' + peak[0] + ' (the highest year up to 2000).');
      if (lastRate) bits.push('The average rate on interest-bearing Treasury debt was ' + num(lastRate[1], 3) + '% in ' + dateLabel(lastRate[0]) + '. It is a calendar-year mean, so the table shows it beside the fiscal year that ends in the same calendar year, and it is not available before 2001.');
      if (bits.length) sh.notes.appendChild(note('trend', bits.join(' ') + ' The table lists every fifth fiscal year back from the latest.'));
      // the burden then and now: the same share of GDP on more debt at a lower rate, and what a return to older rates would mean
      const B = rmgBundle('US', 'omb'), pubM = mapOf('US_DEBT_PUBLIC_GDP', 'US');
      const recM = new Map(S.rec.filter((r) => r && fin(r[1])).map((r) => [+r[0], r[1]]));
      const yNow = gdpLast ? +gdpLast[0] : null, yThen = peak ? +peak[0] : null;
      const sens = (yy) => (gdpLast && S.maps.rate.has(yy) && S.maps.rate.has(yNow) ? (gdpLast[1] * S.maps.rate.get(yy)) / S.maps.rate.get(yNow) : null);
      const then = yThen != null && fin(pubM.get(yThen)) && fin(B.r.get(yThen)) && fin(pubM.get(yNow)) && fin(B.r.get(yNow))
        ? ' That earlier bill rested on debt held by the public of ' + pct(pubM.get(yThen), 1) + ' of GDP at an effective rate of ' + pct(B.r.get(yThen), 2) + ', against ' + pct(pubM.get(yNow), 1) + ' at ' + pct(B.r.get(yNow), 2) + ' in fiscal ' + yNow + '.' : '';
      const rise = sens(2007) != null ? ' The rate regime can rise as well as fall: at the 2007 average Treasury rate the same debt would cost about ' + pct(sens(2007), 1) + ' of GDP.' : '';
      const recNow = lastFy && recM.has(+lastFy[0]) ? recM.get(+lastFy[0]) : null;
      sh.notes.appendChild(note('view', views(
        'Interest has become a first-order budget item: it now takes a much larger share of federal receipts than a few years ago' + (recNow != null && recM.has(2021) ? ' (' + pct(recNow, 1) + ' in fiscal ' + lastFy[0] + ' against ' + pct(recM.get(2021), 1) + ' in fiscal 2021' + (recM.has(1991) ? ' and ' + pct(recM.get(1991), 1) + ' in fiscal 1991' : '') + ')' : '') + ', and a growing part of new borrowing goes to pay past borrowing.',
        J('Interest is paid to bondholders and is not resources destroyed (the part paid abroad leaves the domestic economy). As a share of GDP the panel shows an earlier peak of similar size, so the rate regime, not the debt alone, drives it.' + then + rise + ' The test of sustainability is r minus g with the primary balance (below).'))));

      // every fifth fiscal year back from the latest
      U.clear(sh.extra);
      const last = lastFy ? +lastFy[0] : null, rows = [];
      if (last != null) {
        for (let y = last; y >= last - 35 && S.maps.ni.has(y); y -= 5) {
          const n = S.maps.ni.get(y), g = S.maps.gdp.get(y), rc = S.maps.rc.get(y), rt = S.maps.rate.get(y);
          rows.push(['Fiscal ' + y, bn(n), g ? pct((n / g) * 100, 2) : null, rc ? pct(D.interestToRevenue(n, rc), 1) : null, rt != null ? pct(rt, 2) : null]);
        }
      }
      sh.extra.appendChild(tableBox('Net interest in every fifth fiscal year back from the latest',
        [{ label: 'Fiscal year' }, { label: 'Net interest' }, { label: '% of GDP' }, { label: '% of receipts' }, { label: 'Average rate on Treasury debt' }], rows));
      U.clear(sh.src);
      sources(['US_NETINT_BN', 'US_GDP_FY_BN', 'US_RECEIPTS_BN', 'US_AVG_RATE']).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 3c. United States: debt in dollars ---------- */
  function buildUsDebt() {
    const sh = cardShell('usdebt', 'United States: federal debt in dollars since 1790');
    sh.sub.textContent = 'Total public debt outstanding in current US dollars, Treasury, one record per year, on a log scale so equal vertical distance means equal percentage growth. Dollars are not adjusted for prices or for the size of the economy.';
    tsTools(sh, 'debt-us-federal-debt-dollars.csv');
    const ind = IND.US_DEBT_TOTAL_USD;

    function update() {
      const rows = rowsOf('US_DEBT_TOTAL_USD', 'US') || [];
      const series = [{ id: 'usd', name: 'Total public debt outstanding (one record a year)', short: 'Annual record', rows, color: STYLE.US.color, shape: 'circle', role: 'data', unit: 'US dollars', fmt: usdText }];
      // the newest daily reading (Debt to the Penny) is shown as its own marker, so the figure on the Start page is on this chart
      const lt = LAT.US_DEBT_TOTAL_USD && LAT.US_DEBT_TOTAL_USD.US;
      const pennyOk = lt && fin(lt[1]) && /^\d{4}-\d{2}-\d{2}$/.test(String(lt[0]));
      if (pennyOk) series.push({ id: 'penny', name: 'Debt to the Penny, ' + dateLabel(lt[0]), short: 'Latest daily', rows: [[String(lt[0]).slice(0, 7), lt[1]]], color: STYLE.US.color, shape: 'diamond', role: 'data', endLabel: true, unit: 'US dollars', fmt: usdText });
      putChart(sh, {
        title: 'United States total public debt, US dollars (log scale)', series, y: { scale: 'log', fmt: 'usd0', tickFmt: usdTick }, x: xConf(series), height: 300, legend: false,
        table: { caption: 'United States total public debt outstanding, US dollars, by year', filename: 'debt-us-federal-debt-dollars.csv' },
      });
      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Total public debt includes debt the government holds in its own accounts (trust funds, for example); the part held by the public is the figure usually set against GDP, and OMB\'s gross federal debt in the Budget tables is a little lower than Treasury\'s total. Record dates by year: 1 January to 1842, 1 July to 1920, late June to 1976, late September since.'));
      const hi = lastValid(rows);
      let lo = null;
      rows.forEach((r) => { if (r && fin(r[1]) && (!lo || r[1] < lo[1])) lo = r; });
      if (hi && lo) sh.notes.appendChild(note('trend', 'On this series the lowest value is ' + usdText(lo[1]) + ' in ' + lo[0] + ' (the federal debt was almost fully repaid in the 1830s, so the dip is real) and the latest annual record is ' + usdText(hi[1]) + ' in ' + hi[0] + '.'));
      if (pennyOk) sh.notes.appendChild(note('trend', 'The newest daily reading is ' + usdText(lt[1]) + ' on ' + dateLabel(lt[0]) + ' (Debt to the Penny), the figure shown on the Start page; the annual record above is the late-September figure for the year, so the two differ by the borrowing in between.' + (ind.latestNote ? ' ' + ind.latestNote : '')));
      else if (ind.latestNote) sh.notes.appendChild(note('trend', ind.latestNote));
      const pubM = mapOf('US_DEBT_PUBLIC_GDP', 'US'), pubYs = Array.from(pubM.keys()).sort((a, b) => a - b), pubNow = pubYs.length ? pubYs[pubYs.length - 1] : null;
      sh.notes.appendChild(note('view', views(
        'A dollar total that grows almost every year mostly reflects a growing economy and a falling value of the dollar, so it says little by itself. Which ratio or adjustment to use is a choice; the percent-of-GDP charts above and the r minus g section below are the usual ones.',
        pubNow != null && pubM.has(2007) ? J('A debt that has grown faster than the economy is a warning in its own right: debt held by the public went from ' + pct(pubM.get(2007), 1) + ' of GDP in 2007 to ' + pct(pubM.get(pubNow), 1) + ' in ' + pubNow + ' (OMB), so growth and inflation do not account for all of the rise.') : 'A debt that has grown faster than the economy is a warning in its own right, and the percent-of-GDP charts above show whether it has.')));
      U.clear(sh.src);
      sources(['US_DEBT_TOTAL_USD']).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 4. interest rate versus growth ---------- */
  function buildRmg() {
    const sh = cardShell('rmg', 'Interest rate versus growth (r minus g)');
    // US basis choice, shown only for the United States
    const seg = segControl('Basis', [
      { v: 'omb', text: 'Federal budget (fiscal years)', title: 'Net interest over debt held by the public, OMB and Treasury' },
      { v: 'imf', text: 'General government (IMF)', title: 'Interest paid over gross debt, IMF Public Finances in Modern History' },
    ], () => state.ub, (v) => { state.ub = v; changed(); }, { visible: () => state.focus === 'US' });
    sh.ctl.appendChild(seg.el);
    tsTools(sh, 'debt-r-minus-g.csv');

    const explain = h('div', { class: 'dp-rg-explain' });
    const chartCell = h('div', { class: 'dp-rg-chart' });
    const detail = h('div', { class: 'dp-rg-detail' });
    const grid = h('div', { class: 'dp-rg' }, [explain, chartCell, detail]);
    sh.root.insertBefore(grid, sh.extra);
    [sh.host, sh.miss, sh.tbl].forEach((n) => chartCell.appendChild(n));

    explain.appendChild(h('p', { class: 'dp-sentence' }, [
      h('span', { class: 'badge', text: 'Accounting fact' }),
      J('When the interest rate a government pays (r) is below the growth of nominal GDP (g), its debt shrinks relative to the economy as long as it does not spend more than it collects before interest (the primary balance), and when r is above g the ratio rises unless it runs a surplus before interest.'),
    ]));
    const sw = (c) => { const s = h('span', { class: 'swatch' }); s.style.setProperty('--c', c); return s; };
    explain.appendChild(h('div', { class: 'dp-keys' }, [
      h('span', null, [sw('var(--c-orange)'), 'Orange columns: r above g. On this channel the debt ratio rises.']),
      h('span', null, [sw('var(--c-blue)'), 'Blue columns: r below g. On this channel the debt ratio falls.']),
      h('span', null, ['The blue and orange columns show the sign here; they do not stand for economies. The upper lines are r (in the economy\'s colour) and g (grey).']),
    ]));

    const formula = h('div', { class: 'dp-formula' });
    const decadesHost = h('div', { class: 'dp-decades' });
    detail.appendChild(formula);
    detail.appendChild(h('div', null, [h('div', { class: 'dp-cap', text: 'Average r minus g by decade, percentage points (orange: r above g)' }), decadesHost]));
    let bars = null, curBundle = null;

    function renderFormula(year) {
      const B = curBundle;
      U.clear(formula);
      if (!B || !B.gap.size) return;
      const ys = Array.from(B.gap.keys()).sort((a, b) => a - b);
      const y = B.gap.has(year) ? year : ys[ys.length - 1];
      const dprev = B.d.get(y - 1), d = B.d.get(y), r = B.r.get(y), g = B.g.get(y), pb = B.pb.get(y);
      const res = D.debtDynamics(dprev, r, g, pb != null ? pb : null);
      const act = fin(d) && fin(dprev) ? d - dprev : null;
      const row = (label, val, cls) => h('tr', { class: cls || null }, [h('th', { scope: 'row', text: label }), h('td', { text: val })]);
      formula.appendChild(h('div', { class: 'dp-cap', text: 'The identity for ' + (B.kind === 'omb' ? 'fiscal ' : '') + y + (state.smooth !== '0' ? ' (annual values, not smoothed)' : '') }));
      formula.appendChild(h('code', { text: 'change in debt ratio = (r - g) / (1 + g) x d(t-1) - primary balance' }));
      const tb = h('table', null, [h('tbody', null, [
        row(B.debtName + ' at the end of the year before, d(t-1)', fin(dprev) ? pct(dprev, 1) + ' of GDP' : 'n/a'),
        row('Interest rate r', fin(r) ? pct(r, 2) : 'n/a'),
        row('Nominal GDP growth g', fin(g) ? pct(g, 2) : 'n/a'),
        row('Primary balance (surplus is positive)', pb != null ? sgn(pb, 2) + '% of GDP' : 'not published'),
        row(pb != null ? 'Identity gives' : 'Identity gives, before any primary balance', res != null ? sgn(res, 2) + ' points' : 'n/a', 'dp-res'),
        row('Actual change in the series', act != null ? sgn(act, 2) + ' points' : 'n/a'),
      ])]);
      formula.appendChild(tb);
      formula.appendChild(h('p', { class: 'dp-small', text: 'The two results can differ: debt also changes through other financing, valuation and rounding, and the inputs come from different tables.' }));
    }

    function update() {
      const iso = state.focus, basis = rmgBasisFor(iso), B = rmgBundle(iso, basis);
      curBundle = B;
      sh.heading.textContent = 'Interest rate versus growth (r minus g): ' + cname(iso);
      sh.sub.textContent = B.basis;
      const spot = SPOTS.indexOf(iso) >= 0;
      const color = spot ? INK : STYLE[iso].color, shape = STYLE[iso].shape;
      const useSmooth = state.smooth !== '0', suffix = useSmooth ? ', ' + state.smooth + '-year average' : '';
      const prep = (m) => { const rows = mapToRows(m); return useSmooth ? smoothRows(rows, +state.smooth) : rows; };
      const series = B.gap.size ? [
        { id: 'r', name: 'Interest rate (r)' + suffix, short: 'r', rows: prep(B.r), color, shape, role: spot ? 'spot' : 'data', panel: 'rate', unit: '% a year', fmt: 'p2' },
        { id: 'g', name: 'Nominal GDP growth (g)' + suffix, short: 'g', rows: prep(B.g), color: 'var(--ink-2)', shape: 'square', role: 'ref', panel: 'rate', unit: '% a year', fmt: 'p2' },
        { id: 'gap', name: 'r minus g' + suffix, rows: prep(B.gap), type: 'column', color: 'var(--c-orange)', colorPos: 'var(--c-orange)', colorNeg: 'var(--c-blue)', panel: 'gap', unit: 'percentage points', fmt: 'sgn2' },
      ] : [];
      sh.miss.hidden = !!B.gap.size;
      if (!B.gap.size) sh.miss.textContent = 'No data to compute r minus g for ' + cname(iso) + '.';
      putChart(sh, {
        title: 'Interest rate versus growth, ' + cname(iso), series, layout: 'stack',
        panels: [
          { id: 'rate', title: 'Interest rate r and nominal GDP growth g, % a year', y: { fmt: 'p0' }, height: 320 },
          { id: 'gap', title: 'r minus g, percentage points', y: { fmt: 'sgn0' }, height: 220 },
        ],
        y: { fmt: 'p0' }, x: xConf(series), between: [{ a: 'r', b: 'g' }], empty: 'No data to compute r minus g for this economy.',
        onCursor: (t) => renderFormula(t == null ? null : Math.round(t)),
        table: { caption: 'Interest rate, nominal growth and r minus g, ' + cname(iso) + ', by year', filename: 'debt-r-minus-g-' + iso.toLowerCase() + '.csv' },
      });
      if (!sh.chart.getCursor()) renderFormula(null);

      // decade averages
      const dec = new Map();
      B.gap.forEach((v, y) => { const k = Math.floor(y / 10) * 10; if (!dec.has(k)) dec.set(k, []); dec.get(k).push(v); });
      const items = Array.from(dec.keys()).sort((a, b) => a - b).map((k) => {
        const vs = dec.get(k), avg = vs.reduce((s, v) => s + v, 0) / vs.length;
        return { id: String(k), label: k + 's', value: avg, text: sgn(avg, 1), note: vs.length < 10 ? vs.length + ' yrs' : null };
      });
      const opts = { sort: 'none', baseline: 0, color: 'var(--c-orange)', colorNeg: 'var(--c-blue)', fmt: 'sgn1', axis: false, empty: 'No data.' };
      if (bars) bars.update(items, opts); else bars = TS.rankedBar(decadesHost, items, opts);

      // notes
      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Here r is the implied rate and g is the growth of nominal GDP in the same year (definitions in the notes at the end of the page). ' + B.basis));
      const ys = Array.from(B.gap.keys()).sort((a, b) => a - b);
      if (ys.length) {
        const below = ys.filter((y) => B.gap.get(y) < 0).length;
        sh.notes.appendChild(note('trend', 'In ' + below + ' of the ' + ys.length + ' years from ' + ys[0] + ' to ' + ys[ys.length - 1] + ', r was below g for ' + cname(iso) + ' on this basis. The bars give the average by decade; partial decades are marked with the number of years.'));
      }
      if (ys.length) {
        let lowY = ys[0];
        ys.forEach((y) => { if (B.gap.get(y) < B.gap.get(lowY)) lowY = y; });
        if (B.gap.get(lowY) < -12) sh.notes.appendChild(note('trend', 'The most negative gap is ' + sgn(B.gap.get(lowY), 1) + ' points in ' + lowY + ', when wartime growth and prices pushed g far above r. Such years set the scale of the lower panel; the Range control rescales it.'));
      }
      sh.notes.appendChild(note('view', views(
        J('When safe interest rates stay below growth, rolling debt over costs little, and that has been the historical norm (Blanchard, 2019), so r minus g is the right test of sustainability.'),
        J('The gap is volatile and uncertain; a negative gap has often come from inflation or from rates held down by policy (financial repression after 1945; Reinhart and Sbrancia, 2015); the rate that matters for new borrowing is the market rate, not the average rate on old debt; and a large deficit before interest can outweigh a favourable gap.'))));
      U.clear(sh.src);
      sources(B.inds).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 5. debt service ---------- */
  const DSR = {
    HH: { ind: 'DSR_HH', name: 'Households' },
    NFC: { ind: 'DSR_NFC', name: 'Non-financial companies' },
    PRIV: { ind: 'DSR_PRIV', name: 'Private non-financial sector' },
  };
  function buildDsr() {
    const sh = cardShell('service', 'Debt service: payments as a share of income');
    const seg = segControl('Sector', [
      { v: 'HH', text: 'Households' }, { v: 'NFC', text: 'Companies' }, { v: 'PRIV', text: 'Private non-financial' },
    ], () => state.ds, (v) => { state.ds = v; changed(); });
    sh.ctl.appendChild(seg.el);
    tsTools(sh, 'debt-service-ratio.csv');

    function update() {
      const cfg = DSR[state.ds];
      sh.sub.textContent = 'BIS debt service ratio: scheduled interest and principal payments of the sector as a share of its income. The annual value is the mean of the four quarters; the newest quarter is in the table below.';
      const r = lineSeries((iso) => rowsOf(cfg.ind, iso), { fmt: 'p1', unit: '% of income' });
      missingText(sh, r.missing, state.ds === 'PRIV' ? 'BIS publishes no euro-area row.' : 'BIS publishes no euro-area row, and China only as the private non-financial sector.');
      putChart(sh, {
        title: 'Debt service ratio, ' + cfg.name + ', % of income', series: r.series, y: { fmt: 'p0', zero: true }, x: xConf(r.series), height: 320, empty: 'No data for the economies chosen on this sector.',
        table: { caption: 'Debt service ratio, ' + cfg.name + ', % of income, by year (mean of four quarters)', filename: 'debt-service-' + state.ds.toLowerCase() + '.csv' },
      });
      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'A debt service ratio measures the payment, not the debt: a large debt at a low rate or a long term can have a low ratio, and a small debt on short, dear terms a high one. BIS builds the ratios from sector debt, average interest rates and remaining maturities, so they are estimates and not payment records.'));
      const lt = LAT[cfg.ind] || {};
      const bits = r.series.filter((s) => s.role !== 'context' && lt[s.iso]).map((s) => cname(s.iso) + ' ' + pct(lt[s.iso][1], 1));
      const per = r.series.map((s) => lt[s.iso] && lt[s.iso][0]).filter(Boolean)[0];
      if (bits.length) sh.notes.appendChild(note('trend', 'Newest quarter' + (per ? ' (' + qLabel(per) + ')' : '') + ', % of income: ' + bits.join('; ') + '.'));
      sh.notes.appendChild(note('view', views(
        'A rising ratio shows budgets tightening, and BIS research has used it as an early-warning sign for banking crises.',
        'A level is not a verdict: households on fixed-rate loans are shielded when rates rise, income can also rise, and the ratio is modelled rather than observed.')));
      U.clear(sh.extra);
      const rows = econList().map((e) => { const x = lt[e.iso]; return [cname(e.iso), x ? pct(x[1], 1) : null, x ? qLabel(x[0]) : null]; });
      sh.extra.appendChild(tableBox(cfg.name + ': newest quarter, % of income', [{ label: 'Economy' }, { label: 'Debt service ratio' }, { label: 'Quarter' }], rows));
      U.clear(sh.src);
      sources([cfg.ind]).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- 6. the nine economies compared ---------- */
  const SECT_NAME = { GG: 'Government', HH: 'Households', NFC: 'Companies' };
  const SECT_IND = { GG: 'TC_GG', HH: 'TC_HH', NFC: 'TC_NFC' };
  function buildCompare() {
    const sh = cardShell('compare', 'Where each economy stands, now and earlier');
    const segS = segControl('Sector', [{ v: 'GG', text: 'Government' }, { v: 'HH', text: 'Households' }, { v: 'NFC', text: 'Companies' }], () => state.cs, (v) => { state.cs = v; changed(); });
    const segY = segControl('Compared with', [{ v: '2000', text: 'Q4 2000' }, { v: '2007', text: 'Q4 2007' }, { v: '2015', text: 'Q4 2015' }], () => state.cy, (v) => { state.cy = v; changed(); });
    sh.ctl.appendChild(segS.el);
    sh.ctl.appendChild(segY.el);
    let bell = null, lastRows = [], lastCols = [], lastCsv = [], csvCols = [];
    toolButtons(sh, {
      table: (host) => U.table(host, sh.tableCaption || 'Credit by economy', lastCols, lastRows.map((r) => r.slice())),
      csv: () => downloadText('debt-compare-' + state.cs.toLowerCase() + '.csv', csvText(csvCols, lastCsv)),
    });
    sh.host.classList.add('dp-bells');

    function openCountry(iso) {
      const last = lastValid(rowsOf('TC_HH', 'US')), yEnd = last ? +last[0] : 2025, years = [2000, 2007, 2015, yEnd];
      const credit = [['Households', 'TC_HH'], ['Companies', 'TC_NFC'], ['Government', 'TC_GG']];
      const service = [['Households', 'DSR_HH'], ['Companies', 'DSR_NFC'], ['Private non-financial', 'DSR_PRIV']];
      const rows = [];
      const add = (label, ind) => {
        const m = mapOf(ind, iso), l = LAT[ind] && LAT[ind][iso];
        if (!m.size && !l) return;
        rows.push([label].concat(years.map((y) => (m.has(y) ? pct(m.get(y), 1) : null)), [l ? pct(l[1], 1) + ' (' + qLabel(l[0]) + ')' : null]));
      };
      credit.forEach((c) => add(c[0] + ', credit, % of GDP', c[1]));
      service.forEach((c) => add(c[0] + ', debt service, % of income', c[1]));
      const body = h('div', { class: 'dp-dlg' });
      const box = h('div', { class: 'tableview', tabindex: '0', role: 'region', 'aria-label': cname(iso) + ' credit and debt service table' });
      U.table(box, cname(iso) + ': BIS credit (fourth-quarter values) and debt service ratios (annual means)',
        [{ label: 'Measure', wrap: true }].concat(years.map((y) => ({ label: String(y) })), [{ label: 'Newest quarter' }]), rows);
      body.appendChild(box);
      U.dialog({
        title: cname(iso), sub: iso === 'EA' ? 'Euro area (BIS aggregate XM)' : 'Bank for International Settlements series', wide: true,
        body: [body, h('p', { class: 'dsrc', text: 'Source: Bank for International Settlements, total credit statistics (WS_TC) and debt service ratios (WS_DSR), retrieved ' + IND.TC_HH.retrieved + '. Credit counts loans and debt securities from all lenders; see the notes at the end of the page.' })],
      });
    }

    function update() {
      const ind = SECT_IND[state.cs], y0 = +state.cy;
      sh.heading.textContent = 'Where each economy stands, now and earlier: ' + SECT_NAME[state.cs].toLowerCase() + ' debt';
      sh.sub.textContent = 'Credit to ' + SECT_NAME[state.cs].toLowerCase() + ' as a share of GDP, BIS, nine economies. The open marker is the fourth quarter of ' + y0 + ', the filled marker is the newest quarter. Chosen economies are in colour, the rest in grey; choose a row for the detail.';
      const rows = [], skipped = [];
      let per = '';
      ALL.forEach((iso) => {
        const m = mapOf(ind, iso), l = LAT[ind] && LAT[ind][iso];
        if (!l || !m.has(y0)) { skipped.push(iso); return; }
        per = per || l[0];
        const chosen = isChosen(iso), spot = chosen && econList().find((e) => e.iso === iso).spot;
        rows.push({
          id: iso, label: cname(iso), v0: m.get(y0), v1: l[1], text: pct(m.get(y0), 1) + ' to ' + pct(l[1], 1),
          color: chosen ? (spot ? INK : STYLE[iso].color) : null, muted: !chosen, note: iso === 'EA' ? 'aggregate' : null,
        });
      });
      const o = { fmt: 'p0', label0: 'Q4 ' + y0, label1: qLabel(per || '2026-Q1'), title: 'Credit to ' + SECT_NAME[state.cs].toLowerCase() + ', % of GDP', onSelect: (id) => openCountry(id), empty: 'No data for this sector and date.' };
      if (bell) bell.update(rows, o); else bell = TS.dumbbell(sh.host, rows, o);
      missingText(sh, skipped, 'no value for the fourth quarter of ' + y0 + ' (the BIS series starts later).');

      sh.tableCaption = 'Credit to ' + SECT_NAME[state.cs].toLowerCase() + ', % of GDP: Q4 ' + y0 + ' and the newest quarter';
      lastCols = [{ label: 'Economy' }, { label: 'Q4 ' + y0 }, { label: qLabel(per || '2026-Q1') }, { label: 'Change, points' }];
      const sorted = rows.slice().sort((a, b) => b.v1 - a.v1);
      lastRows = sorted.map((r) => [r.label, pct(r.v0, 1), pct(r.v1, 1), sgn(r.v1 - r.v0, 1)]);
      csvCols = [{ label: 'Economy' }, { label: 'Q4 ' + y0 + ' (% of GDP)' }, { label: qLabel(per || '2026-Q1') + ' (% of GDP)' }, { label: 'Change (percentage points)' }];
      lastCsv = sorted.map((r) => [r.label, +r.v0.toFixed(2), +r.v1.toFixed(2), +(r.v1 - r.v0).toFixed(2)]);
      sh.syncTable();

      U.clear(sh.notes);
      sh.notes.appendChild(note('fact', 'Each row compares the same BIS series at two dates. The earlier value is the fourth-quarter figure of the year chosen; the later one is the newest quarter, which can differ from a year-end for seasonal and timing reasons.'));
      sh.notes.appendChild(note('view', views(
        'A higher ratio is not in itself better or worse. It reflects how much of an economy\'s financing runs through debt rather than equity, deposits or retained profit, and institutions differ: for example, loans between companies of one group are counted in some countries\' company debt and not in others.',
        'A fast rise is a warning in the credit-boom research: credit growth has predicted financial crises across 14 advanced economies since 1870 (Schularick and Taylor, 2012), so the change since the earlier date matters more than the level, and a large rise in a short time is the pattern that research flags.')));
      U.clear(sh.src);
      sources([ind]).forEach((n) => sh.src.appendChild(n));
    }
    return { root: sh.root, update };
  }

  /* ---------- summary tiles ---------- */
  let sparks = [];
  function tileFor(iso) {
    const nm = cname(iso), tiles = [];
    const tenAgo = (m, y) => (m.has(y - 10) ? m.get(y - 10) : null);
    const delta = (v, old, y, unit, d) => (old == null ? null : sgn(v - old, d) + ' ' + unit + ' since ' + (y - 10));

    // 1 government debt, IMF outlook database
    const w = rowsOf('GGXWDG_NGDP', iso), wl = lastValid(w);
    tiles.push({
      label: 'Government debt, % of GDP', href: '#level', fmt: 'p1', foot: 'IMF ' + vintageOf('GGXWDG_NGDP') + '; latest figure ' + (wl ? wl[0] : 'n/a') + ', which may be an estimate (the IMF feed does not flag estimates).',
      value: wl ? pct(wl[1], 1) : 'n/a', delta: wl ? delta(wl[1], tenAgo(mapOf('GGXWDG_NGDP', iso), +wl[0]), +wl[0], 'points', 1) : null,
      sub: wl ? 'General government gross debt, ' + wl[0] : 'No data.', rows: lastN(w, 12),
    });

    // 2 and 3 household and company credit, BIS
    [['TC_HH', 'Household debt, % of GDP', 'Households'], ['TC_NFC', 'Company debt, % of GDP', 'Non-financial companies']].forEach((x) => {
      const rows = rowsOf(x[0], iso), lt = LAT[x[0]] && LAT[x[0]][iso], m = mapOf(x[0], iso), lastY = lastValid(rows);
      const old = lt && lastY ? m.get(+lastY[0] - 10) : null;
      tiles.push({
        label: x[1], href: '#sectors', fmt: 'p1', foot: 'BIS total credit' + (lt ? ', ' + qLabel(lt[0]) : '') + '; all lenders, market value.',
        value: lt ? pct(lt[1], 1) : 'n/a', delta: lt && old != null ? sgn(lt[1] - old, 1) + ' points since Q4 ' + (+lastY[0] - 10) : null,
        sub: x[2] + ', loans and debt securities', rows: lastN(rows, 12),
      });
    });

    // 4 interest
    const iInd = iso === 'EA' ? 'ESTAT_INT' : 'ie', ir = rowsOf(iInd, iso), il = lastValid(ir);
    const sub4 = [];
    if (il && iso !== 'EA') {
      const rv = mapOf('rev', iso).get(+il[0]);
      if (rv) sub4.push(pct(D.interestToRevenue(il[1], rv), 1) + ' of government revenue (IMF basis), ' + il[0]);
    }
    if (iso === 'US') {
      const ni = mapOf('US_NETINT_BN', 'US'), rc = mapOf('US_RECEIPTS_BN', 'US'), yEnd = Math.max.apply(null, Array.from(ni.keys()));
      if (rc.has(yEnd)) sub4.push('Federal net interest, fiscal ' + yEnd + ': ' + bn(ni.get(yEnd)) + ', ' + pct(D.interestToRevenue(ni.get(yEnd), rc.get(yEnd)), 1) + ' of receipts');
    }
    tiles.push({
      label: 'Interest paid by government, % of GDP', href: '#interest', fmt: 'p1',
      foot: iso === 'EA' ? 'Eurostat, interest payable, ' + (il ? il[0] : 'n/a') + '.' : 'IMF Public Finances in Modern History; US federal line from Treasury.',
      value: il ? pct(il[1], 2) : 'n/a', delta: il ? delta(il[1], tenAgo(mapOf(iInd, iso), +il[0]), +il[0], 'points', 2) : null,
      sub: sub4.join('. ') || (il ? 'Interest paid, ' + il[0] : 'No data.'), rows: lastN(ir, 12),
    });

    // 5 r minus g
    const B = rmgBundle(iso, rmgBasisFor(iso)), ys = Array.from(B.gap.keys()).sort((a, b) => a - b).slice(-5);
    if (ys.length === 5 && ys[4] - ys[0] === 4) {
      const avg = ys.reduce((s, y) => s + B.gap.get(y), 0) / 5;
      tiles.push({
        label: 'Interest rate minus growth, 5-year average', href: '#rmg', fmt: 'n1', foot: (B.kind === 'omb' ? 'US federal budget basis' : 'Implied rate less nominal GDP growth') + ', ' + ys[0] + ' to ' + ys[4] + '.',
        value: sgn(avg, 1), unit: 'points',
        sub: avg < 0 ? 'On average r was below g: debt tended to fall relative to GDP before counting the budget balance excluding interest (the primary balance).' : 'On average r was above g: debt tended to rise relative to GDP unless there was a surplus before interest.',
        rows: Array.from(B.gap.keys()).sort((a, b) => a - b).slice(-12).map((y) => [y, B.gap.get(y)]),
      });
      if (iso === 'US' && B.kind === 'omb') {
        // the same gap on the IMF general-government basis, which the Start page uses
        const alt = rmgBundle('US', 'imf'), altYs = Array.from(alt.gap.keys()).sort((a, b) => a - b), altY = altYs.length ? altYs[altYs.length - 1] : null;
        if (altY != null) tiles[tiles.length - 1].foot += ' On the IMF general-government basis (used on the Start page) the gap was ' + sgn(alt.gap.get(altY), 1) + ' points in ' + altY + '.';
      }
    } else {
      tiles.push({ label: 'Interest rate minus growth, 5-year average', href: '#rmg', value: 'n/a', sub: 'Not enough consecutive years of data.', foot: 'Needs interest, debt and nominal growth.', rows: [] });
    }

    // 6 debt service
    const dInd = iso === 'CN' ? 'DSR_PRIV' : 'DSR_HH';
    if (iso === 'EA') {
      tiles.push({ label: 'Household debt service, % of income', href: '#service', value: 'n/a', sub: 'BIS publishes no debt service ratio for the euro area.', foot: 'BIS debt service ratios.', rows: [] });
    } else {
      const dr = rowsOf(dInd, iso), dl = LAT[dInd] && LAT[dInd][iso], dm = mapOf(dInd, iso), dlast = lastValid(dr);
      tiles.push({
        label: (iso === 'CN' ? 'Private debt service' : 'Household debt service') + ', % of income', href: '#service', fmt: 'p1',
        foot: 'BIS debt service ratios' + (dl ? ', ' + qLabel(dl[0]) : '') + '; annual means in the chart.',
        value: dl ? pct(dl[1], 1) : 'n/a', delta: dl && dlast && dm.has(+dlast[0] - 10) ? sgn(dl[1] - dm.get(+dlast[0] - 10), 1) + ' points since ' + (+dlast[0] - 10) : null,
        sub: iso === 'CN' ? 'BIS has China only for the private non-financial sector' : 'Interest and principal payments over income', rows: lastN(dr, 12),
      });
    }
    return { name: nm, tiles };
  }
  function renderKpis() {
    const host = document.getElementById('dp-kpis'), iso = state.focus;
    if (!host) return;
    sparks.forEach((s) => s.destroy());
    sparks = [];
    U.clear(host);
    const data = tileFor(iso);
    document.getElementById('glance-title').textContent = 'At a glance: ' + data.name;
    data.tiles.forEach((t) => {
      const spark = h('div', { class: 'dp-tile-spark' });
      const el = h('article', { class: 'dp-tile', 'aria-label': t.label }, [
        h('div', { class: 'dp-tile-label', text: t.label }),
        h('div', { class: 'dp-tile-value' }, [t.value, t.unit ? h('small', { text: ' ' + t.unit }) : null]),
        t.delta ? h('div', { class: 'dp-tile-delta', text: t.delta }) : null,
        t.sub ? h('div', { class: 'dp-tile-sub', text: t.sub }) : null,
        spark,
        h('div', { class: 'dp-tile-foot' }, [t.foot + ' ', t.href ? h('a', { href: t.href, text: 'See the chart' }) : null]),
      ]);
      host.appendChild(el);
      if (t.rows && t.rows.length >= 2) sparks.push(TS.sparkline(spark, t.rows, { fmt: t.fmt || 'n1', points: 12, height: 32 }));
    });
    const nt = document.getElementById('dp-kpi-note');
    if (nt) nt.textContent = 'Focus economy: ' + data.name + ', set in the controls. Each tile shows the newest value, the change from ten years earlier on the same series, and the last 12 yearly values (the dot is the latest). Ten years earlier is the same number of years back for every economy, not a chosen date.';
  }

  /* ---------- controls ---------- */
  let tbEl = null, tbToggle = null, tbSummary = null, chipEls = {}, focusSel = null, ctxBtn = null;
  function toggleEcon(iso) {
    if (state.sel.has(iso)) {
      if (state.sel.size + (state.spot ? 1 : 0) <= 1) return;
      state.sel.delete(iso);
    } else state.sel.add(iso);
    changed();
  }
  function buildToolbar() {
    tbEl = document.getElementById('dp-tools');
    tbToggle = h('button', { class: 'btn tb-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dp-tb-body' }, [(tbSummary = h('span', { class: 'dp-sum' })), h('span', { text: 'Controls' })]);
    tbToggle.addEventListener('click', () => {
      const collapsed = tbEl.dataset.collapsed === '1';
      tbEl.dataset.collapsed = collapsed ? '0' : '1';
      tbToggle.setAttribute('aria-expanded', String(collapsed));
    });
    const mq = window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
    const syncPhone = () => {
      const on = !!(mq && mq.matches);
      tbEl.dataset.collapsed = on ? '1' : '0';
      tbToggle.setAttribute('aria-expanded', String(!on));
    };
    syncPhone();
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', syncPhone); else if (mq.addListener) mq.addListener(syncPhone); }

    const body = h('div', { class: 'tb-body', id: 'dp-tb-body' });

    // economies
    const chips = h('div', { class: 'dp-chips', role: 'group', 'aria-label': 'Economies' });
    ORDER.forEach((iso) => {
      const st = STYLE[iso];
      const key = U.sv('svg', { class: 'key', viewBox: '0 0 24 12', 'aria-hidden': 'true' }, [
        U.sv('line', { x1: 1, y1: 6, x2: 23, y2: 6 }),
        U.sv('path', { d: TS.SHAPE_PATH[st.shape], transform: 'translate(12 6) scale(.6)' }),
      ]);
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', title: 'Show or hide ' + cname(iso) }, [key, h('span', { text: cname(iso) })]);
      b.style.setProperty('--c', st.color);
      b.addEventListener('click', () => toggleEcon(iso));
      chipEls[iso] = b;
      chips.appendChild(b);
    });
    const econTool = h('div', { class: 'tool' }, [h('span', { class: 'tool-label', text: 'Economies' }), chips]);
    const spotSeg = segControl('Add one more economy, drawn in black', [
      { v: '', text: 'None' }, { v: 'DE', text: 'Germany' }, { v: 'FR', text: 'France' }, { v: 'EA', text: 'Euro area' },
    ], () => state.spot, (v) => { state.spot = v; if (!state.sel.size && !v) state.sel = new Set(DEFAULTS.sel); changed(); });
    ctxBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', title: 'Draw the economies not chosen as faint grey lines for comparison', text: 'Show the other economies in grey' });
    ctxBtn.addEventListener('click', () => { state.ctx = state.ctx === '1' ? '0' : '1'; changed(); });
    body.appendChild(h('div', { class: 'tb-row' }, [econTool, spotSeg.el, h('div', { class: 'tool' }, [h('span', { class: 'tool-label', text: 'Others' }), ctxBtn])]));

    // range, smoothing, focus
    const rangeSeg = segControl('Range', [
      { v: '1950', text: 'From 1950' }, { v: '1980', text: 'From 1980' }, { v: '2000', text: 'From 2000' }, { v: 'all', text: 'All years' },
    ], () => state.range, (v) => { state.range = v; changed(); });
    const smoothSeg = segControl('Smoothing', [{ v: '0', text: 'None' }, { v: '5', text: '5-year average' }], () => state.smooth, (v) => { state.smooth = v; changed(); }, { hint: () => 'interest and r minus g charts' });
    focusSel = h('select', { class: 'input', id: 'dp-focus', 'aria-label': 'Focus economy' }, ALL.map((iso) => h('option', { value: iso, text: cname(iso) })));
    focusSel.addEventListener('change', () => {
      // a value that is not an option (script only) leaves the focus as it was
      if (ALL.indexOf(focusSel.value) >= 0) state.focus = focusSel.value;
      changed();
    });
    const focusTool = h('div', { class: 'tool' }, [h('label', { class: 'tool-label', for: 'dp-focus', text: 'Economy for the summary tiles and the interest-versus-growth chart' }), focusSel]);
    body.appendChild(h('div', { class: 'tb-row' }, [rangeSeg.el, smoothSeg.el, focusTool]));

    tbEl.appendChild(tbToggle);
    tbEl.appendChild(body);
  }
  function syncToolbar() {
    ORDER.forEach((iso) => chipEls[iso].setAttribute('aria-pressed', String(state.sel.has(iso))));
    ctxBtn.setAttribute('aria-pressed', String(state.ctx === '1'));
    focusSel.value = state.focus;
    const n = econList().length;
    tbSummary.textContent = n + (n === 1 ? ' economy, ' : ' economies, ') + (state.range === 'all' ? 'all years' : 'from ' + state.range) + '. ';
  }

  /* ---------- notes section ---------- */
  function buildNotes() {
    // coverage changes and source switches, grouped by what they say
    const ul = document.getElementById('dp-breaks');
    if (ul) {
      const groups = new Map();
      Object.keys(IND).forEach((id) => {
        (IND[id].breaks || []).forEach((b) => {
          const k = b.country + '|' + b.year + '|' + b.kind + '|' + b.note;
          if (!groups.has(k)) groups.set(k, { b, ids: [] });
          groups.get(k).ids.push(id);
        });
      });
      groups.forEach((g) => {
        ul.appendChild(h('li', null, [h('b', { text: cname(g.b.country) + ', from ' + g.b.year + ' (' + g.b.kind + '). ' }), g.b.note + ' Series: ' + g.ids.join(', ') + '.']));
      });
    }
    const dn = document.getElementById('dp-datanotes');
    if (dn) (DATA.notes || []).forEach((t) => dn.appendChild(h('li', { text: t })));
    // every series used, with its source and dates
    const box = document.getElementById('dp-series-table');
    if (box) {
      const rows = Object.keys(IND).map((id) => {
        const ind = IND[id];
        return [{ node: h('span', null, [h('b', { text: id }), ' ', ind.label]) }, ind.unit, { text: ind.source, href: ind.url }, ind.retrieved, ind.asOf, ind.vintage, ind.basis];
      });
      U.table(box, 'Series used on this page, with source, retrieval date and latest observation',
        [{ label: 'Series', wrap: true }, { label: 'Unit' }, { label: 'Source', wrap: true }, { label: 'Retrieved' }, { label: 'Latest observation' }, { label: 'Vintage', wrap: true }, { label: 'Basis', wrap: true }], rows);
    }
    const asof = document.getElementById('dp-asof');
    if (asof) {
      const bit = (label, id, fmt) => (hasOwn(IND, id) ? label + ' ' + (fmt ? fmt(IND[id].asOf) : IND[id].asOf) : null);
      const parts = [bit('IMF historical series', 'd'), bit('IMF outlook database', 'GGXWDG_NGDP'), bit('BIS credit and debt service', 'TC_HH', qLabel), bit('Eurostat', 'ESTAT_GD'), bit('US Treasury debt', 'US_DEBT_TOTAL_USD', dateLabel)].filter(Boolean);
      asof.textContent = 'Data file generated ' + DATA.generated + ' from the sources listed at the end of the page. Latest observations: ' + parts.join('; ') + '.';
    }
  }

  /* ---------- orchestration ---------- */
  const cards = [];
  function renderAll() {
    syncers.forEach((s) => s.sync());
    syncToolbar();
    renderKpis();
    cards.forEach((c) => c.update());
  }
  function changed() {
    renderAll();
    writeUrl();
  }

  function init() {
    readUrl();
    buildToolbar();
    const host = document.getElementById('dp-cards');
    [buildLevel(), buildSectors(), buildInterest(), buildUsFed(), buildUsDebt(), buildRmg(), buildDsr(), buildCompare()].forEach((c) => {
      cards.push(c);
      host.appendChild(c.root);
    });
    buildNotes();
    renderAll();
    // the browser tried to scroll to a #section before the cards existed
    const id = (window.location.hash || '').replace(/^#/, '');
    if (id) {
      const target = document.getElementById(id);
      if (target) { try { target.scrollIntoView(); } catch (e) { /* old browser */ } }
    }
  }
  init();
})();
