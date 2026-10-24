/* Money Over Time: chart engine and page logic.
   Plain JS, d3 v7. Data comes from window.MONEY_SUPPLY (data/money-supply.js)
   and window.MONEY_HISTORY (data/history.js). Colours are CSS variables, so a
   theme change needs no redraw. */
(function () {
  'use strict';

  const d3 = window.d3;
  const MS = window.MONEY_SUPPLY;
  const MH = window.MONEY_HISTORY;

  /* ---------- small helpers ---------- */
  const qs = (s, r) => (r || document).querySelector(s);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    (kids || []).forEach((c) => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function sv(tag, props, kids) {
    const e = document.createElementNS(SVGNS, tag);
    if (props) for (const k of Object.keys(props)) if (props[k] != null) e.setAttribute(k, props[k]);
    (kids || []).forEach((c) => c && e.appendChild(c));
    return e;
  }

  // theme, skip link and the load-failure panel live in assets/shell.js; the fallback only makes a failure visible if that file is missing
  const Shell = window.MacroShell || {
    fatal(title, detail) {
      const app = qs('#app');
      if (app) app.hidden = true;
      document.body.insertBefore(h('div', { class: 'load-error', role: 'alert' }, [h('h2', { text: title }), h('p', { text: detail })]), document.body.firstChild);
    },
    needD3() {
      if (window.d3) return true;
      this.fatal('The chart library did not load', 'Check your connection or any content blocker, then reload the page.');
      return false;
    },
  };
  if (!Shell.needD3()) return;
  if (!MS || !MH) {
    Shell.fatal('The data files did not load',
      'Expected data/money-supply.js and data/history.js next to this page. Check that both files are present and reload.');
    return;
  }

  /* ---------- formatting ---------- */
  function sig(n) {
    let s;
    if (n >= 1000) s = d3.format(',.0f')(n);
    else if (n >= 100) s = n.toFixed(0);
    else if (n >= 10) s = n.toFixed(1);
    else s = n.toFixed(2);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }
  // v is in billions
  function fmtBn(v, sym) {
    if (v == null || !isFinite(v)) return 'n/a';
    sym = sym == null ? '$' : sym;
    const neg = v < 0, a = Math.abs(v);
    let n, u;
    if (a >= 1000) { n = a / 1000; u = 'T'; }
    else if (a >= 1) { n = a; u = 'B'; }
    else if (a >= 0.001) { n = a * 1000; u = 'M'; }
    else if (a >= 0.000001) { n = a * 1e6; u = 'K'; }
    else { n = a * 1e9; u = ''; }
    return (neg ? '-' : '') + sym + sig(n) + u;
  }
  function fmtOz(v) {
    if (v == null || !isFinite(v)) return 'n/a';
    const a = Math.abs(v);
    let n, u;
    if (a >= 1) { n = a; u = 'B'; }
    else if (a >= 0.001) { n = a * 1e3; u = 'M'; }
    else if (a >= 0.000001) { n = a * 1e6; u = 'K'; }
    else { n = a * 1e9; u = ''; }
    return sig(n) + u + ' oz';
  }
  function fmtPct(v) {
    if (v == null || !isFinite(v)) return 'n/a';
    return (v > 0 ? '+' : '') + (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) + '%';
  }
  function fmtPctAxis(v) { return (v > 0 ? '+' : '') + d3.format('~g')(+v.toFixed(6)) + '%'; }
  function fmtIdx(v) {
    if (v == null || !isFinite(v)) return 'n/a';
    return v >= 1000 ? d3.format(',.0f')(v) : v >= 100 ? v.toFixed(0) : v.toFixed(1);
  }
  function fmtPeriod(t, freq) {
    const mi = Math.round(t * 12), y = Math.floor(mi / 12), m = mi - y * 12;
    if (freq === 'A') return String(y);
    if (freq === 'Q') return 'Q' + (Math.floor(m / 3) + 1) + ' ' + y;
    return MONTHS[m] + ' ' + y;
  }
  function yearLabel(t) {
    const y = Math.round(t);
    return y < 0 ? Math.abs(y) + ' BC' : String(y);
  }

  /* ---------- constants ---------- */
  const ECON = {
    us: { name: 'United States', short: 'US', ccy: 'USD', sym: '$', ccyName: 'US dollars', hue: 'blue', cat: 'var(--cat-us)', shape: 'circle' },
    ea: { name: 'Euro area', short: 'Euro area', ccy: 'EUR', sym: '€', ccyName: 'euros', hue: 'magenta', cat: 'var(--cat-ea)', shape: 'square' },
    uk: { name: 'United Kingdom', short: 'UK', ccy: 'GBP', sym: '£', ccyName: 'pounds sterling', hue: 'orange', cat: 'var(--cat-uk)', shape: 'diamond' },
    jp: { name: 'Japan', short: 'Japan', ccy: 'JPY', sym: '¥', ccyName: 'yen', hue: 'green', cat: 'var(--cat-jp)', shape: 'triangle' },
    cn: { name: 'China', short: 'China', ccy: 'CNY', sym: 'CN¥', ccyName: 'yuan', hue: 'aqua', cat: 'var(--cat-cn)', shape: 'star' },
  };
  const ECON_ORDER = ['us', 'ea', 'uk', 'jp', 'cn'];
  const STACK_ORDER = ['cn', 'us', 'ea', 'jp', 'uk']; // bottom to top, largest first

  const SHAPES = {
    circle: d3.symbolCircle, square: d3.symbolSquare, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle,
    star: d3.symbolStar, plus: d3.symbolPlus || d3.symbolCross, times: d3.symbolTimes || d3.symbolWye, wye: d3.symbolWye,
  };
  const SHAPE_SIZE = { circle: 78, square: 70, diamond: 96, triangle: 90, star: 120, plus: 90, times: 90, wye: 90 };
  function symPath(shape, scale) {
    return d3.symbol().type(SHAPES[shape] || d3.symbolCircle).size((SHAPE_SIZE[shape] || 80) * (scale || 1))();
  }

  // Which aggregates each economy publishes: [name, short word, long text, state]
  const COVER = {
    us: [['M0', 'Yes', 'Fed monetary base and currency', 'pub'], ['M1', 'Yes', 'Fed H.6', 'pub'], ['M2', 'Yes', 'Fed H.6', 'pub'],
      ['M3', 'Discontinued 2006', 'The Fed stopped publishing it; last observation Feb 2006', 'disc'], ['M4', 'Private index only', 'Only as the CFS Divisia index', 'priv'], ['M5', 'Not published', 'Not published', 'none']],
    ea: [['M0', 'Currency only', 'Currency in circulation only; no base-money headline', 'part'], ['M1', 'Yes', 'ECB', 'pub'], ['M2', 'Yes', 'ECB', 'pub'],
      ['M3', 'Yes', 'ECB headline broad aggregate', 'pub'], ['M4', 'Not published', 'Not published', 'none'], ['M5', 'Not published', 'Not published', 'none']],
    uk: [['M0', 'Yes', 'Notes and coin, reserves; old M0 ended Apr 2006', 'pub'], ['M1', 'Not published', 'Not a Bank of England headline', 'none'], ['M2', 'Not published', 'No current official UK M2', 'none'],
      ['M3', 'Not published', 'Not published', 'none'], ['M4', 'Yes', 'Bank of England M4 and M4ex', 'pub'], ['M5', 'Not published', 'Not published', 'none']],
    jp: [['M0', 'Yes', 'Bank of Japan monetary base', 'pub'], ['M1', 'Yes', 'Bank of Japan', 'pub'], ['M2', 'Yes', 'Bank of Japan', 'pub'],
      ['M3', 'Yes', 'Bank of Japan headline broad aggregate', 'pub'], ['M4', 'Not published', 'Not published; L is wider than M3 but is not an M-number', 'none'], ['M5', 'Not published', 'Not published', 'none']],
    cn: [['M0', 'Cash only', 'Currency only, no reserves', 'part'], ['M1', 'Yes', 'PBoC (restated Jan 2024)', 'pub'], ['M2', 'Yes', 'PBoC', 'pub'],
      ['M3', 'Not published', 'Not published', 'none'], ['M4', 'Not published', 'Not published', 'none'], ['M5', 'Not published', 'Not published', 'none']],
  };
  // the coverage table has narrow columns, so it uses one short word per state
  const coverWord = (c) => ({ none: 'No', disc: 'Ended', priv: 'Private', part: c[1] === 'Cash only' ? 'Cash' : 'Part' }[c[3]] || c[1]);

  // Long history: static labels and marker shape per measure (hue is the entity)
  const GROUP_ORDER = ['US', 'UK', 'China', 'Russia', 'Global'];
  const GROUP_COLOR = { US: 'var(--cat-us)', UK: 'var(--cat-uk)', China: 'var(--cat-cn)', Russia: 'var(--cat-ru)', Global: 'var(--cat-global)', Gold: 'var(--cat-gold)' };
  const HMETA = {
    usDebt: { short: 'Debt', name: 'US debt', shape: 'circle' },
    usM2: { short: 'M2', name: 'US M2', shape: 'square' },
    usGDP: { short: 'GDP', name: 'US GDP', shape: 'diamond' },
    fedBalance: { short: 'Fed assets', name: 'Fed assets', shape: 'triangle' },
    ukDebt: { short: 'Debt', name: 'UK debt', shape: 'circle' },
    boeBalance: { short: 'BoE assets', name: 'BoE assets', shape: 'triangle' },
    chinaM2: { short: 'M2', name: 'China M2', shape: 'square' },
    chinaGDP: { short: 'GDP', name: 'China GDP', shape: 'diamond' },
    chinaGold: { short: 'Gold reserves', name: 'China gold', shape: 'star' },
    chinaTreasuries: { short: 'US Treasuries', name: 'China US Treasuries', shape: 'times' },
    russiaGDP: { short: 'GDP', name: 'Russia GDP', shape: 'diamond' },
    russiaGold: { short: 'Gold reserves', name: 'Russia gold', shape: 'star' },
    russiaDebt: { short: 'Debt', name: 'Russia debt', shape: 'circle' },
    russianChinaTrade: { short: 'China trade', name: 'Russia-China trade', shape: 'wye' },
    globalDebt: { short: 'Debt', name: 'Global debt', shape: 'circle' },
    derivatives: { short: 'Derivatives', name: 'Derivatives', shape: 'plus' },
    goldPrice: { short: 'Gold price', name: 'Gold price', shape: 'circle' },
  };
  const DEFAULT_SHOWN = ['usDebt', 'usM2', 'fedBalance', 'usGDP', 'globalDebt'];
  const OZ_PER_TONNE = 32150.7;
  const USD_FLOOR = 1e-3; // $1M in billions: below this a log axis stops
  const OZ_FLOOR = 1e-5;

  /* ---------- money supply data preparation ---------- */
  function periodMi(p) {
    const y = +p.slice(0, 4);
    if (p.length === 4) return y * 12 + 11;
    if (p.charAt(5) === 'Q') return y * 12 + (+p.charAt(6) - 1) * 3;
    return y * 12 + (+p.slice(5, 7)) - 1;
  }

  const MONEY = {};
  Object.keys(MS.series).forEach((id) => {
    const def = MS.series[id];
    const pts = def.data.map((r) => {
      const mi = periodMi(r[0]);
      return { mi, t: mi / 12, loc: r[1], usd: r[2], off: r[3] == null ? null : r[3], k: r[0] };
    });
    const byMi = new Map();
    pts.forEach((p) => { if (p.loc != null) byMi.set(p.mi, p); });
    const valid = pts.filter((p) => p.loc != null);
    const breaks = (def.breaks || []).map((b) => { const mi = periodMi(b.t); return Object.assign({}, b, { mi, bt: mi / 12 }); });
    const disc = def.discontinued ? periodMi(def.discontinued) / 12 : null;
    MONEY[id] = { id, def, pts, byMi, valid, first: valid[0], last: valid[valid.length - 1], breaks, disc, yoyMap: null, freq: def.frequency };
  });

  // Breaks across which a ratio of levels is not growth: a new definition or a change of scope
  const YOY_BREAKS = ['redefinition', 'scope'];

  // Year-over-year change in percent. The source's own growth rate (a 4th data column, flow based, so free of
  // membership and reclassification steps) is preferred; otherwise a ratio of levels, undefined across a break.
  function yoyMapOf(S) {
    if (S.yoyMap) return S.yoyMap;
    const redefs = S.breaks.filter((b) => YOY_BREAKS.indexOf(b.kind) >= 0).map((b) => b.mi);
    const m = new Map();
    S.valid.forEach((p) => {
      if (p.off != null && isFinite(p.off)) { m.set(p.mi, p.off); return; }
      const q = S.byMi.get(p.mi - 12);
      if (q && q.loc > 0 && !redefs.some((b) => b > p.mi - 12 && b <= p.mi)) m.set(p.mi, (p.loc / q.loc - 1) * 100);
    });
    S.yoyMap = m;
    return m;
  }

  // Drop leading nulls and collapse runs of nulls so a null row only means "break here"
  function compactNulls(arr) {
    const out = [];
    arr.forEach((p) => {
      if (p.v == null) {
        if (out.length && out[out.length - 1].v != null) out.push(p);
      } else out.push(p);
    });
    while (out.length && out[out.length - 1].v == null) out.pop();
    return out;
  }

  /* ---------- state and URL hash ---------- */
  const ALLOWED = {
    v: ['money', 'history'], e: ['us', 'ea', 'uk', 'jp', 'cn', 'cmp'], m: ['level', 'yoy', 'index'],
    c: ['local', 'usd'], s: ['log', 'linear'], k: ['lines', 'stacked'], l: ['usd', 'gold'],
  };
  const state = {
    view: 'money', econ: 'us', measure: 'level', ccy: 'local', scale: 'log', cmp: 'lines',
    lens: 'usd', goldPanel: true,
    hid: new Set(), shown: null, extras: new Set(),
    tag: '', onlyView: true, table: false,
    x: { money: null, history: null }, ymanual: null,
  };

  function resetState() {
    state.view = 'money'; state.econ = 'us'; state.measure = 'level'; state.ccy = 'local'; state.scale = 'log'; state.cmp = 'lines';
    state.lens = 'usd'; state.goldPanel = true; state.hid = new Set(); state.shown = null; state.extras = new Set();
    state.tag = ''; state.onlyView = true; state.table = false; state.x = { money: null, history: null }; state.ymanual = null;
  }

  function parseHash() {
    resetState();
    let p;
    try { p = new URLSearchParams(window.location.hash.replace(/^#/, '')); } catch (e) { return; }
    const pick = (key, field, list) => { const v = p.get(key); if (v && list.indexOf(v) >= 0) state[field] = v; };
    pick('v', 'view', ALLOWED.v); pick('e', 'econ', ALLOWED.e); pick('m', 'measure', ALLOWED.m);
    pick('c', 'ccy', ALLOWED.c); pick('s', 'scale', ALLOWED.s); pick('k', 'cmp', ALLOWED.k); pick('l', 'lens', ALLOWED.l);
    if (p.get('gp') === '0') state.goldPanel = false;
    // ids are checked as own keys: 'constructor' or '__proto__' must not pass as a series
    if (p.get('hid')) state.hid = new Set(p.get('hid').split(',').filter((id) => hasOwn(MS.series, id)));
    // an empty sh= means every history series is hidden, which is different from no sh at all
    if (p.has('sh')) state.shown = new Set(p.get('sh').split(',').filter((id) => id !== 'goldPrice' && hasOwn(MH.series, id)));
    if (p.get('ex')) state.extras = new Set(p.get('ex').split(',').filter((x) => x === 'div' || x === 'wb'));
    if (p.get('tag') && MH.events.some((e) => e.tag === p.get('tag'))) state.tag = p.get('tag');
    if (p.get('ov') === '0') state.onlyView = false;
    if (p.get('tbl') === '1') state.table = true;
    const x0 = parseFloat(p.get('x0')), x1 = parseFloat(p.get('x1'));
    if (isFinite(x0) && isFinite(x1) && x1 > x0) state.x[state.view] = [x0, x1];
    const y0 = parseFloat(p.get('y0')), y1 = parseFloat(p.get('y1'));
    if (isFinite(y0) && isFinite(y1) && y1 > y0) state.ymanual = [y0, y1]; // checked against the axis scale when it is applied
  }

  let hashTimer = null;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('v', state.view);
      if (state.view === 'money') {
        if (state.econ !== 'us') p.set('e', state.econ);
        if (state.measure !== 'level') p.set('m', state.measure);
        if (state.ccy !== 'local') p.set('c', state.ccy);
        if (state.scale !== 'log') p.set('s', state.scale);
        if (state.econ === 'cmp' && effCmp() !== 'lines') p.set('k', effCmp()); // the effective state, not the remembered choice
        if (state.hid.size) p.set('hid', Array.from(state.hid).join(','));
        if (state.extras.size) p.set('ex', Array.from(state.extras).join(','));
      } else {
        if (state.lens !== 'usd') p.set('l', state.lens);
        if (state.scale !== 'log') p.set('s', state.scale);
        if (!state.goldPanel) p.set('gp', '0');
        if (state.shown) p.set('sh', Array.from(state.shown).join(','));
        if (state.tag) p.set('tag', state.tag);
        if (!state.onlyView) p.set('ov', '0');
      }
      if (state.table) p.set('tbl', '1');
      const xw = state.x[state.view];
      if (xw) { p.set('x0', xw[0].toFixed(2)); p.set('x1', xw[1].toFixed(2)); }
      if (state.ymanual) { p.set('y0', String(+state.ymanual[0].toPrecision(4))); p.set('y1', String(+state.ymanual[1].toPrecision(4))); }
      try { window.history.replaceState(null, '', '#' + p.toString()); } catch (e) { /* file:// or sandboxed */ }
    }, 120);
  }

  /* ---------- chart engine ---------- */
  // The engine draws whatever model it is given. Models come from the two
  // adapters below (money supply and long history). The SVG scaffold is built
  // once; zoom, pan and hover only update attributes in place.
  function createChart(stage, hooks) {
    const FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const mctx = document.createElement('canvas').getContext('2d');
    const textW = (s, bold) => { mctx.font = (bold ? '700 ' : '') + FONT; return mctx.measureText(s).width; };

    const svg = d3.select(stage).append('svg').attr('class', 'chart').attr('role', 'group');
    const svgTitle = svg.append('title');
    const defs = svg.append('defs');
    const clipPlot = defs.append('clipPath').attr('id', 'clip-plot').append('rect');
    const clipGold = defs.append('clipPath').attr('id', 'clip-gold').append('rect');
    const clipOv = defs.append('clipPath').attr('id', 'clip-ov').append('rect');
    const gRoot = svg.append('g');

    const gP = gRoot.append('g').attr('class', 'plot');
    const gBands = gP.append('g').attr('clip-path', 'url(#clip-plot)');
    const gGrid = gP.append('g').attr('class', 'grid');
    const gYT = gP.append('g').attr('class', 'tick');
    const gAreas = gP.append('g').attr('clip-path', 'url(#clip-plot)');
    const gLines = gP.append('g').attr('clip-path', 'url(#clip-plot)');
    const gAnn = gP.append('g').attr('clip-path', 'url(#clip-plot)');
    const gLabels = gP.append('g');
    const gGuide = gP.append('g');
    const gCross = gP.append('g').attr('display', 'none');
    const crossLine = gCross.append('line').attr('class', 'vline');
    const crossDots = gCross.append('g');
    const overlay = gP.append('rect').attr('class', 'overlay');

    const gG = gRoot.append('g').attr('class', 'goldpanel');
    const gGTitle = gG.append('text').attr('class', 'panel-title');
    const gGGrid = gG.append('g').attr('class', 'grid');
    const gGYT = gG.append('g').attr('class', 'tick');
    const gGLines = gG.append('g').attr('clip-path', 'url(#clip-gold)');
    const gGCross = gG.append('g').attr('display', 'none');
    const gCrossLine = gGCross.append('line').attr('class', 'vline');
    const gCrossDot = gGCross.append('g');
    const gGFrame = gG.append('line').attr('class', 'axisline');

    const gAx = gRoot.append('g').attr('class', 'axx tick');
    const gAxLine = gAx.append('line').attr('class', 'axisline');
    const axTitle = gRoot.append('text').attr('class', 'axis-title').attr('text-anchor', 'middle');

    const gLane = gRoot.append('g').attr('class', 'lanes');
    const gEra = gLane.append('g');
    const gEv = gLane.append('g');

    const gOv = gRoot.append('g').attr('class', 'over');
    const gOvArea = gOv.append('g').attr('clip-path', 'url(#clip-ov)');
    const gOvEv = gOv.append('g');
    const gOvFrame = gOv.append('rect').attr('class', 'ov-frame');
    const gOvAx = gOv.append('g').attr('class', 'tick');
    const gBrush = gOv.append('g').attr('class', 'ovbrush').attr('aria-label', 'Overview. Drag to choose the time window.');

    const readout = h('div', { class: 'readout', hidden: true, 'aria-hidden': 'true' });
    const tipEl = h('div', { class: 'tip', hidden: true, role: 'tooltip' });
    stage.appendChild(readout);
    stage.appendChild(tipEl);
    // shown over the plot when nothing can be drawn: every series hidden, or none with data in the window
    const emptyEl = h('div', { class: 'empty-msg', hidden: true, role: 'status' }, [h('p'), h('button', { class: 'btn', type: 'button' })]);
    stage.appendChild(emptyEl);
    let emptyShown = null;
    function showEmpty() {
      if (!emptyKind) { if (emptyShown) { emptyEl.hidden = true; emptyShown = null; } return; }
      emptyEl.style.left = L.ml + 'px'; emptyEl.style.top = L.mt + 'px';
      emptyEl.style.width = L.pw + 'px'; emptyEl.style.height = L.ph + 'px';
      if (emptyShown === emptyKind) return;
      emptyShown = emptyKind;
      const win = emptyKind === 'window';
      emptyEl.firstChild.textContent = win ? 'No data for the selected series in this window.' : 'All series are hidden. Choose a series in the legend.';
      emptyEl.lastChild.textContent = win ? 'Show all dates' : 'Show the default series';
      emptyEl.hidden = false;
    }
    emptyEl.lastChild.addEventListener('click', () => {
      if (!model) return;
      if (emptyShown === 'window') setView(model.xFull[0], model.xFull[1], true);
      else if (hooks.onShowDefaults) hooks.onShowDefaults();
    });

    let model = null;
    const view = { x0: 0, x1: 1, ymanual: null };
    let L = null, X = null, Y = null, YG = null, OX = null, OY = null;
    let hover = null, cross = null, selEv = null, hotEv = null, hotEra = null;
    let queued = false, animId = null, brushing = false, syncing = false, emitTimer = null;
    let annHits = [], placed = [];
    let lastClipped = false, desiredMl = null, measuring = false;

    /* -- scale helpers -- */
    const isLogY = () => model && model.yScale === 'log';
    const makeScale = (log, dom, h2) => (log ? d3.scaleLog() : d3.scaleLinear()).domain(dom).range([h2, 0]);

    function interpAt(s, t, log) {
      const ts = s.ts, pts = s.pts;
      if (!ts.length) return null;
      const i = d3.bisectLeft(ts, t);
      if (i < ts.length && ts[i] === t) {
        for (let j = i; j < ts.length && ts[j] === t; j++) if (pts[j].v != null) return pts[j].v;
        return null;
      }
      if (i === 0 || i === ts.length) return null;
      const a = pts[i - 1], b = pts[i];
      if (a.v == null || b.v == null) return null;
      const f = (t - a.t) / (b.t - a.t);
      if (log && a.v > 0 && b.v > 0) return Math.exp(Math.log(a.v) + f * (Math.log(b.v) - Math.log(a.v)));
      return a.v + f * (b.v - a.v);
    }

    // raw extent of the visible part of the given series
    function extentOf(list, x0, x1, log, floor, wantVals) {
      let lo = Infinity, hi = -Infinity;
      const vals = wantVals ? [] : null;
      const push = (v) => {
        if (v == null || !isFinite(v)) return;
        if (log && v <= floor) return;
        if (vals) vals.push(v);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      };
      list.forEach((s) => {
        const i0 = d3.bisectLeft(s.ts, x0), i1 = d3.bisectRight(s.ts, x1);
        for (let i = i0; i < i1; i++) push(s.pts[i].v);
        push(interpAt(s, x0, log));
        push(interpAt(s, x1, log));
      });
      return { lo, hi, vals };
    }

    // Set by autoDomain: 'hidden' when no series is switched on, 'window' when none has data in the window
    let emptyKind = null, goldEmpty = false;
    function autoDomain() {
      const log = isLogY(), floor = model.floor || 0;
      emptyKind = null;
      if (model.stacked) {
        let mx = 0;
        const tp = model.totalPts;
        const i0 = d3.bisectLeft(model.totalTs, view.x0), i1 = d3.bisectRight(model.totalTs, view.x1);
        for (let i = i0; i < i1; i++) if (tp[i].v > mx) mx = tp[i].v;
        if (!(mx > 0)) emptyKind = model.areas.some((a) => !a.hidden) ? 'window' : 'hidden';
        return [0, (mx || 1) * 1.06];
      }
      const list = model.series.filter((s) => !s.hidden && !s.link && !s.labelOnly && !s.noDomain && s.pts.length);
      const ex = extentOf(list, view.x0, view.x1, log, floor, model.yKind === 'yoy');
      let lo = ex.lo, hi = ex.hi;
      if (ex.vals) {
        if (ex.vals.length < 2) {
          if (!ex.vals.length) emptyKind = list.length ? 'window' : 'hidden';
          return [-1, 1];
        }
        ex.vals.sort(d3.ascending);
        lo = d3.quantile(ex.vals, 0.01);
        hi = d3.quantile(ex.vals, 0.99);
      }
      if (!isFinite(lo) || !isFinite(hi)) {
        emptyKind = list.length ? 'window' : 'hidden';
        return log ? [1, 10] : [0, 1];
      }
      if (log) {
        if (hi / lo < 1.3) { const c = Math.sqrt(lo * hi); lo = c / 1.6; hi = c * 1.6; }
        const pad = Math.pow(10, 0.05);
        return [lo / pad, hi * pad];
      }
      if (model.yKind === 'yoy') {
        lo = Math.min(lo, 0); hi = Math.max(hi, 0);
        const r = (hi - lo) || 1;
        return d3.scaleLinear().domain([lo - r * 0.06, hi + r * 0.06]).nice(6).domain();
      }
      return d3.scaleLinear().domain([Math.min(0, lo), hi * 1.06]).nice(6).domain();
    }

    function goldDomain() {
      const p2 = model.panel2;
      const ex = extentOf(p2.series.filter((s) => !s.hidden), view.x0, view.x1, true, 0.01, false);
      goldEmpty = !isFinite(ex.lo);
      if (goldEmpty) return [1, 10];
      let lo = ex.lo, hi = ex.hi;
      if (hi / lo < 1.3) { const c = Math.sqrt(lo * hi); lo = c / 1.6; hi = c * 1.6; }
      const pad = Math.pow(10, 0.06);
      return [lo / pad, hi * pad];
    }

    const validDomain = (dom, log) => !!dom && isFinite(dom[0]) && isFinite(dom[1]) && dom[0] < dom[1] && (!log || dom[0] > 0);

    // Extent of every series that is switched on, over the whole time range; the limit for manual value zoom
    function fullExtent() {
      const log = isLogY();
      if (model.stacked) return { lo: 0, hi: d3.max(model.totalPts, (p) => p.v) || 1 };
      const list = model.series.filter((s) => !s.hidden && !s.link && !s.labelOnly && !s.noDomain && s.pts.length);
      const ex = extentOf(list, model.xFull[0], model.xFull[1], log, model.floor || 0, false);
      return isFinite(ex.lo) && isFinite(ex.hi) ? ex : null;
    }
    // Keep a manual value domain within 3 decades (log) or 4 spans (linear) of the data
    function clampY(dom) {
      const ex = fullExtent();
      if (!ex) return dom;
      const log = isLogY();
      const f = log ? Math.log10 : (v) => v, g = log ? (v) => Math.pow(10, v) : (v) => v;
      const reach = log ? 3 : (ex.hi - ex.lo || 1) * 4;
      const A = f(ex.lo) - reach, B = f(ex.hi) + reach;
      let a = f(dom[0]), b = f(dom[1]);
      if (b - a >= B - A) { a = A; b = B; }
      else {
        if (a < A) { b += A - a; a = A; }
        if (b > B) { a -= b - B; b = B; }
      }
      return [g(a), g(b)];
    }

    // Hover set restricted to series that are still drawn: a hidden series cannot be the one to highlight
    let hoverNow = null;
    function activeHover() {
      if (!hover || !model) return null;
      const live = new Set();
      model.series.forEach((s) => { if (!s.hidden) live.add(s.id); });
      if (model.areas) model.areas.forEach((a) => { if (!a.hidden) live.add(a.id); });
      if (model.panel2) model.panel2.series.forEach((s) => { if (!s.hidden) live.add(s.id); });
      const ids = Array.from(hover).filter((id) => live.has(id));
      return ids.length ? new Set(ids) : null;
    }

    function logTicks(scale, hpx) {
      const dom = scale.domain(), lo = Math.min(dom[0], dom[1]), hi = Math.max(dom[0], dom[1]);
      // a log axis has no zero or negative end; anything else would loop on NaN or -Infinity
      if (!(lo > 0) || !isFinite(hi) || !(hi > lo)) return [];
      const ppd = hpx / Math.max(Math.log10(hi / lo), 0.05);
      const tries = ppd >= 520 ? [[1, 2, 3, 4, 5, 6, 7, 8, 9]] : ppd >= 260 ? [[1, 2, 3, 5, 7]] : ppd >= 140 ? [[1, 2, 5]] : [[1], [1, 2, 5], [1, 2, 3, 5, 7], [1, 2, 3, 4, 5, 6, 7, 8, 9]];
      let out = [];
      for (let k = 0; k < tries.length; k++) {
        out = [];
        for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
          tries[k].forEach((m) => {
            const v = m * Math.pow(10, e);
            if (v >= lo * 0.99999 && v <= hi * 1.00001) out.push({ v, major: m === 1 });
          });
        }
        if (out.length >= 2) break;
      }
      // a very wide domain would put the decades closer than a label is tall: keep every n-th decade
      if (ppd < 18) {
        const every = Math.ceil(18 / ppd);
        out = out.filter((d) => Math.round(Math.log10(d.v)) % every === 0);
      }
      return out;
    }
    function linTicks(scale, hpx) {
      return scale.ticks(Math.max(2, Math.floor(hpx / 46))).map((v) => ({ v, major: true }));
    }

    function xTickList(x0, x1, pw) {
      const span = x1 - x0, target = Math.max(2, Math.floor(pw / 78));
      const steps = [1 / 12, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
      let step = steps[steps.length - 1];
      for (let i = 0; i < steps.length; i++) if (span / steps[i] <= target) { step = steps[i]; break; }
      const out = [];
      for (let t = Math.ceil(x0 / step - 1e-9) * step; t <= x1 + 1e-9; t += step) {
        let label;
        if (step >= 1) label = yearLabel(t);
        else {
          const m = Math.round((t - Math.floor(t + 1e-6)) * 12) % 12;
          label = m === 0 ? String(Math.floor(t + 1e-6)) : MONTHS[m];
        }
        out.push({ t, label });
      }
      return out;
    }

    function clampX(a, b) {
      const lo = model.xFull[0], hi = model.xFull[1];
      let span = Math.max(b - a, model.minSpan || 1);
      span = Math.min(span, hi - lo);
      if (a < lo) a = lo;
      if (a + span > hi) a = hi - span;
      if (a < lo) a = lo;
      return [a, a + span];
    }

    // Era names get hand-made short forms; a band too narrow for any of them is
    // left unlabelled (hover names it) rather than showing a stub like "Pet…".
    const ERA_SHORT = {
      'Medieval Silver/Gold Coin': ['Medieval coin'], 'Great Debasement': ['Debasement'], 'Restored Coinage': ['Restored coinage', 'Restored'],
      'Newton Gold Fix (£4.25/oz)': ['Newton fix', 'Newton'], 'Bank Restriction (Fiat)': ['Bank restriction', 'Restriction'],
      'Classical Gold Standard': ['Gold standard'], 'Interwar / Gold Exchange': ['Interwar'], 'Petrodollar / Fiat': ['Petrodollar', 'Fiat'],
    };

    /* -- layout -- */
    const labOf = (s) => (typeof s.endLabel === 'function' ? s.endLabel() : s.endLabel);
    function labelWidth(lab, soft) {
      let w = 16 + textW(lab.name);
      if (lab.value) w += 6 + textW(lab.value, true);
      if (noteOf(lab, soft)) w += 6 + textW(lab.note);
      else if (lab.reserve) w += 6 + textW(lab.reserve);
      return w;
    }
    // a soft note is dropped when the label column would otherwise take too much of the chart
    const noteOf = (lab, soft) => (lab.note && (soft || !lab.soft) ? lab.note : '');

    function layout() {
      if (!model) return;
      const W = Math.max(300, stage.clientWidth);
      let H = Math.max(360, stage.clientHeight);
      const small = W < 640;
      const hist = !!model.lanes;
      const showGold = !!(model.panel2 && model.panel2.visible);
      const ml = desiredMl != null ? desiredMl : (small ? 56 : 66);
      let room = 0, labelsOn = false, softNotes = true;
      if (!small) {
        const widest = (soft) => {
          let m = 0;
          model.series.forEach((s) => {
            if (s.hidden || !s.endLabel || s.atEnd || s.link) return;
            m = Math.max(m, labelWidth(labOf(s), soft));
          });
          return m;
        };
        let maxW = widest(true);
        if (maxW + 30 >= W * 0.32) { softNotes = false; maxW = widest(false); }
        if (maxW > 0 && maxW + 30 < W * 0.32) { room = maxW + 26; labelsOn = true; }
      }
      const mr = 14 + room, mt = small ? 24 : 8;
      const ovH = 48, ovAx = 17, ovGap = 10, pad = 4, axisH = 24;
      const eraH = hist ? 22 : 0, laneGap = hist ? 4 : 0, evH = hist ? 3 * 22 + 8 : 0;
      // a shorter gold panel on screens under 960px high keeps the event lanes and the overview strip on the first screen
      const goldH = showGold ? (window.innerHeight < 960 ? 84 : 112) : 0;
      const goldGap = showGold ? 22 : 0;
      const fixed = mt + goldGap + goldH + axisH + eraH + laneGap + evH + ovGap + ovH + ovAx + pad;
      stage.style.minHeight = Math.ceil(fixed + 150) + 'px';
      H = Math.max(H, fixed + 150, stage.clientHeight);
      const ph = H - fixed;
      const axisTop = mt + ph + (showGold ? goldGap + goldH : 0);
      const eraTop = axisTop + axisH;
      const evTop = eraTop + eraH + laneGap;
      const ovTop = axisTop + axisH + (hist ? eraH + laneGap + evH : 0) + ovGap;
      L = { W, H, ml, mr, mt, pw: Math.max(120, W - ml - mr), ph, small, hist, showGold, goldTop: mt + ph + goldGap, goldH, axisTop, eraTop, eraH, evTop, evH, ovTop, ovH, labelsOn, softNotes };

      svg.attr('width', W).attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H);
      gP.attr('transform', 'translate(' + ml + ',' + mt + ')');
      gG.attr('transform', 'translate(' + ml + ',' + L.goldTop + ')').attr('display', showGold ? null : 'none');
      gAx.attr('transform', 'translate(' + ml + ',' + axisTop + ')');
      gLane.attr('transform', 'translate(' + ml + ',' + eraTop + ')').attr('display', hist ? null : 'none');
      gOv.attr('transform', 'translate(' + ml + ',' + ovTop + ')');
      clipPlot.attr('x', 0).attr('y', -2).attr('width', L.pw).attr('height', ph + 4);
      clipGold.attr('x', 0).attr('y', -2).attr('width', L.pw).attr('height', goldH + 4);
      clipOv.attr('x', 0).attr('y', 0).attr('width', L.pw).attr('height', ovH);
      overlay.attr('x', 0).attr('y', 0).attr('width', L.pw).attr('height', ph);
      gAxLine.attr('x1', 0).attr('x2', L.pw).attr('y1', 0).attr('y2', 0);
      gGFrame.attr('x1', 0).attr('x2', L.pw).attr('y1', goldH + 0.5).attr('y2', goldH + 0.5);
      gOvFrame.attr('x', 0.5).attr('y', 0.5).attr('width', L.pw - 1).attr('height', ovH - 1);
      axTitle.attr('transform', small ? 'translate(4,' + (mt - 9) + ')' : 'translate(13,' + (mt + ph / 2) + ') rotate(-90)').attr('text-anchor', small ? 'start' : 'middle');
      OX = d3.scaleLinear().domain(model.xFull).range([0, L.pw]);
      brush.extent([[0, 0], [L.pw, ovH]]);
      gBrush.call(brush);
      buildOverview();
    }

    /* -- overview strip -- */
    const ovLineGen = d3.line();
    function buildOverview() {
      if (!model) return;
      const log = isLogY(), floor = model.floor || 0;
      const list = model.stacked ? [{ id: 'total', pts: model.totalPts, ts: model.totalTs, color: 'var(--ink-2)' }]
        : model.series.filter((s) => !s.hidden && !s.link && !s.labelOnly && !s.ref && (s.opts || s.pts).length);
      const all = [];
      list.forEach((s) => (s.opts || s.pts).forEach((p) => { if (p.v != null && isFinite(p.v) && (!log || p.v > floor)) all.push(p.v); }));
      let lo = d3.min(all), hi = d3.max(all);
      if (model.yKind === 'yoy' && all.length > 5) { all.sort(d3.ascending); lo = d3.quantile(all, 0.01); hi = d3.quantile(all, 0.99); }
      if (!isFinite(lo)) { lo = 1; hi = 10; }
      if (log) { if (hi / lo < 1.3) { lo /= 1.5; hi *= 1.5; } OY = d3.scaleLog().domain([lo, hi]).range([L.ovH - 4, 4]); }
      else { if (lo === hi) { lo -= 1; hi += 1; } OY = d3.scaleLinear().domain([Math.min(lo, 0), hi]).range([L.ovH - 4, 4]); }
      ovLineGen.defined((p) => p.v != null && isFinite(p.v) && (!log || p.v > floor)).x((p) => OX(p.t)).y((p) => OY(p.v));
      // the stacked total is an area down to the baseline; a bare line would be closed by a chord
      const ovAreaGen = d3.area().defined((p) => p.v != null && isFinite(p.v)).x((p) => OX(p.t)).y0(OY(0)).y1((p) => OY(p.v));
      gOvArea.selectAll('path').data(list, (s) => s.id).join('path')
        .attr('class', model.stacked ? 'ov-area' : 'ov-line')
        .style('--c', (s) => s.color)
        .attr('d', (s) => (model.stacked ? ovAreaGen(s.pts) : ovLineGen(s.opts || s.pts)));
      const evs = model.lanes ? model.events : [];
      gOvEv.selectAll('line').data(evs).join('line').attr('class', 'ov-tick')
        .attr('x1', (e) => OX(e.year)).attr('x2', (e) => OX(e.year)).attr('y1', L.ovH - 6).attr('y2', L.ovH - 1);
      const ticks = xTickList(model.xFull[0], model.xFull[1], L.pw);
      gOvAx.selectAll('text').data(ticks, (d) => d.t).join('text')
        .attr('x', (d) => OX(d.t)).attr('y', L.ovH + 13).attr('text-anchor', 'middle').attr('class', 'minor').text((d) => d.label);
    }

    const brush = d3.brushX().on('start brush end', (ev) => {
      if (syncing || !ev.sourceEvent) return;
      if (ev.type === 'start') brushing = true;
      if (ev.type === 'end') brushing = false;
      const sel = ev.selection;
      if (!sel) {
        // a plain click outside the window centres the window on the click; All is the preset or a double-click
        if (ev.type === 'end') {
          const mid = OX.invert(clamp(d3.pointer(ev.sourceEvent, gBrush.node())[0], 0, L.pw)), span = view.x1 - view.x0;
          setView(mid - span / 2, mid + span / 2, true);
        }
        return;
      }
      // pressing in the strip starts a zero-width selection; leave the window alone until the pointer has moved
      if (sel[1] - sel[0] < 1) return;
      const [a, b] = clampX(OX.invert(sel[0]), OX.invert(sel[1]));
      view.x0 = a; view.x1 = b;
      requestDraw();
      emit();
    });
    gBrush.on('dblclick.all', () => { if (model) setView(model.xFull[0], model.xFull[1], true); });
    function syncBrush() {
      if (brushing || !OX) return;
      syncing = true;
      const a = clamp(OX(view.x0), 0, L.pw), b = clamp(OX(view.x1), 0, L.pw);
      gBrush.call(brush.move, [Math.min(a, b), Math.max(a, b)]);
      syncing = false;
    }

    /* -- drawing -- */
    function requestDraw() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(); });
    }

    function draw() {
      if (!model || !L) return;
      if (model.onView) model.onView(view.x0, view.x1);
      X = d3.scaleLinear().domain([view.x0, view.x1]).range([0, L.pw]);
      const log = isLogY();
      const auto = autoDomain(); // also sets emptyKind
      // a manual value domain must suit the scale: a log axis cannot take zero or a negative end
      if (view.ymanual && !validDomain(view.ymanual, log)) { view.ymanual = null; emit(); }
      const dom = view.ymanual && !emptyKind ? view.ymanual : auto;
      Y = makeScale(log, dom, L.ph);
      YG = null;
      if (L.showGold) YG = makeScale(true, goldDomain(), L.goldH);
      hoverNow = activeHover();
      // size the left margin to the widest tick label, then draw again once
      let tw = 0;
      if (!emptyKind) (log ? logTicks(Y, L.ph) : linTicks(Y, L.ph)).forEach((d) => { tw = Math.max(tw, textW(model.yFmt(d.v))); });
      if (YG && !goldEmpty) logTicks(YG, L.goldH).forEach((d) => { tw = Math.max(tw, textW(model.panel2.fmt(d.v))); });
      const want = Math.max(L.small ? 38 : 52, Math.ceil(tw) + (L.small ? 14 : 32));
      if (!measuring && Math.abs(want - L.ml) > 3) {
        desiredMl = want; measuring = true;
        layout(); draw();
        measuring = false;
        return;
      }

      drawAxes(log);
      drawBands();
      drawMain(log);
      drawAnn(log);
      drawLabels();
      drawGoldPanel();
      drawLanes();
      drawGuide();
      syncBrush();
      updateCross();
      svgTitle.text(model.title || 'Chart');
      if (hooks.onDrawn) hooks.onDrawn({ clipped: lastClipped });
    }

    function drawAxes(log) {
      // with nothing to plot the value axis would be invented, so only the time axis is drawn
      const yt = emptyKind ? [] : log ? logTicks(Y, L.ph) : linTicks(Y, L.ph);
      const extra = emptyKind ? [] : (model.refY || []).filter((v) => !yt.some((t) => t.v === v)).map((v) => ({ v, major: true, ref: true }));
      const lines = yt.concat(extra).filter((d) => { const p = Y(d.v); return p >= -0.5 && p <= L.ph + 0.5; });
      const xt = xTickList(view.x0, view.x1, L.pw);
      gGrid.selectAll('line.hy').data(lines, (d) => d.v).join('line')
        .attr('class', (d) => 'hy' + ((model.zeroLine && d.v === 0) || d.ref ? ' zero' : ''))
        .attr('x1', 0).attr('x2', L.pw).attr('y1', (d) => Math.round(Y(d.v)) + 0.5).attr('y2', (d) => Math.round(Y(d.v)) + 0.5);
      gGrid.selectAll('line.vx').data(xt, (d) => d.t).join('line').attr('class', 'vx')
        .attr('x1', (d) => Math.round(X(d.t)) + 0.5).attr('x2', (d) => Math.round(X(d.t)) + 0.5)
        .attr('y1', 0).attr('y2', L.ph);
      gYT.selectAll('text').data(yt.filter((d) => { const p = Y(d.v); return p >= 4 && p <= L.ph - 2; }), (d) => d.v).join('text')
        .attr('x', -8).attr('y', (d) => Y(d.v)).attr('dy', '0.32em').attr('text-anchor', 'end')
        .attr('class', (d) => (d.major ? '' : 'minor')).text((d) => model.yFmt(d.v));
      axTitle.text(emptyKind ? '' : model.yTitle || '');
      showEmpty();
      gAx.selectAll('g.xt').data(xt, (d) => d.t).join((enter) => {
        const g = enter.append('g').attr('class', 'xt');
        g.append('line').attr('y1', 0).attr('y2', 4).attr('class', 'axisline');
        g.append('text').attr('y', 17).attr('text-anchor', 'middle');
        return g;
      }).attr('transform', (d) => 'translate(' + X(d.t) + ',0)').select('text').text((d) => d.label);
    }

    function drawBands() {
      const eras = model.lanes ? model.eras : [];
      gBands.selectAll('rect').data(eras, (e) => e.start).join('rect')
        .attr('class', (e, i) => 'band' + (hotEra === i ? ' hot' : '') + (i % 2 ? '' : ' alt'))
        .attr('x', (e) => X(e.start)).attr('width', (e) => Math.max(0, X(e.end) - X(e.start)))
        .attr('y', 0).attr('height', L.ph)
        .attr('display', (e, i) => (i % 2 === 0 || hotEra === i ? null : 'none'));
    }

    function markersFor(s, xs, ys, pw, ph) {
      const out = [];
      const pts = s.pts, ts = s.ts;
      if (s.markAll) {
        let last = -1e9;
        const i0 = Math.max(0, d3.bisectLeft(ts, X.invert(-10)) - 1), i1 = Math.min(pts.length, d3.bisectRight(ts, X.invert(pw + 10)) + 1);
        for (let i = i0; i < i1; i++) {
          const p = pts[i];
          if (p.v == null || !isFinite(p.v)) continue;
          const px = xs(p.t), py = ys(p.v);
          if (px < -4 || px > pw + 4 || py < -4 || py > ph + 4) continue;
          if (px - last < 13) continue;
          last = px;
          out.push({ x: px, y: py, hollow: !!p.e, key: p.t });
        }
      }
      const lp = s.last;
      if (lp && s.endMarker !== false && lp.t >= view.x0 && lp.t <= view.x1) {
        const yv = s.endV != null ? s.endV : lp.v;
        const px = xs(lp.t), py = ys(yv);
        if (py >= -4 && py <= ph + 4) {
          const hit = out.find((m) => m.key === lp.t);
          if (hit) hit.hollow = hit.hollow || s.disc != null;
          else out.push({ x: px, y: py, hollow: s.disc != null, key: 'end' });
        }
      }
      return out;
    }

    function renderSeries(layer, list, xs, ys, log, pw, ph) {
      const lineGen = d3.line().defined((p) => p.v != null && isFinite(p.v) && (!log || p.v > 0)).x((p) => xs(p.t)).y((p) => ys(p.v));
      const sel = layer.selectAll('g.s').data(list, (s) => s.id).join('g');
      sel.attr('class', (s) => 's' + (s.hist ? ' hist' : '') + (s.ref ? ' ref' : '') + (s.link ? ' link' : '') + (hoverNow && !hoverNow.has(s.id) ? ' dim' : ''))
        .style('--c', (s) => s.color)
        .each(function (s) {
          const g = d3.select(this);
          const runs = s.runs;
          // only the points near the visible window are drawn
          const w0 = Math.max(0, d3.bisectLeft(s.ts, xs.invert(-12)) - 1), w1 = Math.min(s.pts.length, d3.bisectRight(s.ts, xs.invert(pw + 12)) + 1);
          g.selectAll('path.ln').data(runs).join('path')
            .attr('class', (r) => 'ln' + (r.est ? ' est' : ''))
            .attr('d', (r) => {
              const a = Math.max(r.a, w0), b = Math.min(r.b + 1, w1);
              return b - a < 2 ? null : lineGen(a === 0 && b === s.pts.length ? s.pts : s.pts.slice(a, b));
            });
          const mk = s.noMarker ? [] : markersFor(s, xs, ys, pw, ph);
          g.selectAll('path.mk').data(mk, (m) => m.key).join('path')
            .attr('class', (m) => 'mk' + (m.hollow ? ' hollow' : ''))
            .attr('d', symPath(s.shape || 'circle'))
            .attr('transform', (m) => 'translate(' + m.x + ',' + m.y + ')');
        });
      sel.order();
    }

    function drawMain(log) {
      let list = model.series.filter((s) => !s.hidden && !s.noLine);
      if (hoverNow) list = list.filter((s) => !hoverNow.has(s.id)).concat(list.filter((s) => hoverNow.has(s.id)));
      renderSeries(gLines, list, X, Y, log, L.pw, L.ph);
      // stacked areas
      const areaGen = d3.area().defined((p) => p.y1 != null).x((p) => X(p.t)).y0((p) => Y(p.y0)).y1((p) => Y(p.y1));
      const areas = model.stacked ? model.areas.filter((a) => !a.hidden) : [];
      gAreas.selectAll('path.area').data(areas, (a) => a.id).join('path')
        .attr('class', (a) => 'area' + (hoverNow && !hoverNow.has(a.id) ? ' dim' : ''))
        .style('--c', (a) => a.color)
        .attr('d', (a) => areaGen(a.pts));
      // out-of-range check for the YoY note
      lastClipped = false;
      if (model.yKind === 'yoy') {
        const dom = Y.domain(), lo = Math.min(dom[0], dom[1]), hi = Math.max(dom[0], dom[1]);
        model.series.forEach((s) => {
          if (s.hidden || lastClipped) return;
          const i0 = d3.bisectLeft(s.ts, view.x0), i1 = d3.bisectRight(s.ts, view.x1);
          for (let i = i0; i < i1; i++) { const v = s.pts[i].v; if (v != null && (v < lo || v > hi)) { lastClipped = true; break; } }
        });
      }
    }

    function drawAnn(log) {
      annHits = [];
      const items = [];
      (model.stacked ? [] : (model.breaks || [])).forEach((b) => {
        if (b.t < view.x0 || b.t > view.x1) return;
        const ticks = [];
        b.sids.forEach((sid) => {
          const s = model.byId[sid];
          if (!s || s.hidden) return;
          const i = d3.bisectLeft(s.ts, b.t - 1e-9);
          let p = null;
          for (let j = i; j < s.pts.length; j++) if (s.pts[j].v != null) { p = s.pts[j]; break; }
          if (!p) return;
          const px = X(p.t), py = Y(p.v);
          if (isFinite(py) && py >= 14 && py <= L.ph - 6) ticks.push({ px, py });
        });
        if (!ticks.length) return;
        const top = d3.min(ticks, (t) => t.py), px = ticks[0].px;
        let by = top - 22;
        if (by < 12) by = d3.max(ticks, (t) => t.py) + 22;
        by = clamp(by, 12, L.ph - 12);
        items.push({ b, ticks, px, by });
        annHits.push({ x: px, y: by, r: 13, title: 'Break ' + b.n, tag: b.kindLabel, text: b.label, brk: b.n });
      });
      const sel = gAnn.selectAll('g.brk').data(items, (d) => d.b.n).join((enter) => {
        // keyboard users reach each break from here; the pointer path goes through the overlay
        const g = enter.append('g').attr('class', 'brk').attr('tabindex', 0).attr('role', 'button');
        const bd = g.append('g').attr('class', 'brk-badge');
        bd.append('circle').attr('r', 9);
        bd.append('text').attr('dy', '0.34em');
        g.on('focus', (ev, d) => showTip(L.ml + d.px, L.mt + d.by, 'Break ' + d.b.n, d.b.kindLabel, d.b.label))
          .on('blur', () => hideTip())
          .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); hooks.onBreakSelect(d.b.n); } });
        return g;
      });
      sel.attr('aria-label', (d) => 'Break ' + d.b.n + ', ' + d.b.kindLabel + ': ' + d.b.label + '. Press Enter to show it in the panel.');
      sel.each(function (d) {
        d3.select(this).selectAll('line.brk-tick').data(d.ticks).join('line').attr('class', 'brk-tick')
          .attr('x1', (t) => t.px).attr('x2', (t) => t.px).attr('y1', (t) => t.py - 9).attr('y2', (t) => t.py + 9);
      });
      sel.select('.brk-badge').attr('transform', (d) => 'translate(' + d.px + ',' + d.by + ')');
      sel.select('text').text((d) => d.b.n);

      // points that sit below a log axis
      const carets = [];
      if (log) {
        const lo = Math.min.apply(null, Y.domain());
        model.series.forEach((s) => {
          if (s.hidden || s.link || s.labelOnly || s.ref || s.noOffscale) return;
          const i0 = d3.bisectLeft(s.ts, view.x0), i1 = d3.bisectRight(s.ts, view.x1);
          for (let i = i0; i < i1; i++) {
            const p = s.pts[i];
            if (p.v != null && p.v > 0 && p.v < lo) carets.push({ s, p, px: X(p.t) });
          }
        });
      }
      const cs = gAnn.selectAll('g.off').data(carets.slice(0, 6), (d) => d.s.id + d.p.t).join((enter) => {
        const g = enter.append('g').attr('class', 'off');
        g.append('path').attr('class', 'offscale').attr('d', 'M-5,-5 L5,-5 L0,3 Z');
        g.append('text').attr('class', 'halo reflabel').attr('text-anchor', 'middle').attr('y', -10);
        return g;
      });
      cs.attr('transform', (d) => 'translate(' + clamp(d.px, 30, L.pw - 30) + ',' + (L.ph - 8) + ')');
      cs.select('text').text((d) => yearLabel(d.p.t) + ': ' + d.s.fmt(d.p.v));
      carets.slice(0, 6).forEach((d) => annHits.push({ x: clamp(d.px, 30, L.pw - 30), y: L.ph - 8, r: 14, title: yearLabel(d.p.t) + ': ' + d.s.name, tag: 'Below the axis', text: d.s.fmt(d.p.v) + ' is too small for this log axis. The value is in the table view.' }));
    }

    // Screen-space points along every drawn line, about 4px apart, for testing whether a label box sits on a line
    function lineSamples(log) {
      const out = [];
      model.series.forEach((s) => {
        if (s.hidden || s.noLine || s.labelOnly) return;
        const i0 = Math.max(0, d3.bisectLeft(s.ts, X.invert(-20)) - 1), i1 = Math.min(s.pts.length, d3.bisectRight(s.ts, X.invert(L.pw + 20)) + 1);
        let prev = null;
        for (let i = i0; i < i1; i++) {
          const p = s.pts[i];
          if (p.v == null || !isFinite(p.v) || (log && p.v <= 0)) { prev = null; continue; }
          const x = X(p.t), y = Y(p.v);
          if (!isFinite(y)) { prev = null; continue; }
          if (prev) {
            const n = Math.min(60, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 4));
            for (let k = 1; k < n; k++) out.push({ x: prev.x + ((x - prev.x) * k) / n, y: prev.y + ((y - prev.y) * k) / n });
          }
          out.push({ x, y });
          prev = { x, y };
        }
      });
      return out;
    }

    // Labels not in the right-hand column (discontinued series, or an end well inside the plot) go next to the
    // line end, on whichever side and height crosses the fewest lines; a leader joins an offset label to its end.
    // A label that would still sit on lines is dropped: the legend and the hollow end marker name the series.
    const LABEL_MAX_HITS = 6;
    function placeFreeLabels(list, boxes, log) {
      const pts = lineSamples(log);
      const hits = (b) => {
        let n = 0;
        for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p.x >= b.x0 - 1.5 && p.x <= b.x1 + 1.5 && p.y >= b.y0 - 1.5 && p.y <= b.y1 + 1.5) n++; }
        return n;
      };
      const overlaps = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      const dys = [0, -12, 12, -24, 24, -36, 36, -50, 50, -66, 66, -84, 84];
      list.slice().sort((a, b) => a.py - b.py).forEach((d) => {
        const lab = labOf(d.s), w = labelWidth(lab, L.softNotes) - 16, bh = 16;
        let best = null;
        for (let k = 0; k < dys.length && !(best && best.n === 0); k++) {
          [1, -1].forEach((side) => {
            const x0 = side > 0 ? d.px + 11 : d.px - 11 - w, y0 = d.py + dys[k] - bh / 2;
            const b = { x0, x1: x0 + w, y0, y1: y0 + bh };
            if (b.x0 < 2 || b.x1 > L.pw - 2 || b.y0 < 0 || b.y1 > L.ph || overlaps(b)) return;
            const n = hits(b);
            if (!best || n < best.n) best = { b, n, side, dy: dys[k] };
          });
        }
        if (!best || best.n > LABEL_MAX_HITS) { d.dropped = true; return; }
        boxes.push(best.b);
        d.tx = best.side > 0 ? best.b.x0 : best.b.x1;
        d.anchor = best.side > 0 ? 'start' : 'end';
        d.ty = best.b.y0 + bh / 2;
        if (best.dy !== 0 || best.side < 0) {
          d.leader = 'M' + (d.px + best.side * 5) + ',' + d.py + ' L' + (best.side > 0 ? best.b.x0 - 3 : best.b.x1 + 3) + ',' + d.ty;
        }
      });
    }

    function drawLabels() {
      const log = isLogY();
      // labels at the start of earlier-definition series
      const starts = model.series.filter((s) => !s.hidden && s.startLabel && s.first && s.first.t >= view.x0 && s.first.t <= view.x1)
        .map((s) => ({ s, px: X(s.first.t), py: Y(s.first.v) })).filter((d) => isFinite(d.py) && d.py > 14 && d.py < L.ph - 4)
        .sort((a, b) => a.py - b.py);
      starts.forEach((d, i) => {
        const prev = starts[i - 1];
        if (prev && Math.abs(d.px - prev.px) < 140 && d.py - prev.py < 14) d.py = prev.py + 14;
      });
      const items = [];
      model.series.forEach((s) => {
        if (s.hidden || !s.endLabel || s.link) return;
        const lp = s.last;
        if (!lp || lp.t > view.x1 + 1e-9 || lp.t < view.x0) return;
        const yv = s.endV != null ? s.endV : lp.v;
        const px = X(lp.t);
        let py = Y(yv);
        if (!isFinite(py)) return;
        const right = L.labelsOn && !s.atEnd && (L.pw - px) < 60;
        let off = null;
        if (py < -2 || py > L.ph + 2) {
          // an end value past the axis is pinned to the plot edge in the label column, with an arrow toward it
          if (!right) return;
          off = py < 0 ? 'up' : 'down';
          py = off === 'up' ? 4 : L.ph - 4;
        }
        if (!right && !s.atEnd && !L.labelsOn) return;
        items.push({ s, px, py, right, off, ly: py });
      });
      const free = items.filter((i) => !i.right);
      if (free.length) {
        const boxes = starts.map((d) => { const w = textW(d.s.startLabel) * 0.92 + 4; return { x0: d.px + 6, x1: d.px + 6 + w, y0: d.py - 8 - 11, y1: d.py - 8 + 3 }; });
        annHits.forEach((a) => boxes.push({ x0: a.x - a.r, x1: a.x + a.r, y0: a.y - a.r, y1: a.y + a.r }));
        placeFreeLabels(free, boxes, log);
      }
      const rights = items.filter((i) => i.right).sort((a, b) => a.py - b.py);
      const gap = 17; // label boxes are about 16px tall
      let prev = -Infinity;
      rights.forEach((i) => { i.ly = Math.max(i.py, prev + gap); prev = i.ly; });
      let next = Infinity;
      for (let k = rights.length - 1; k >= 0; k--) {
        const i = rights[k];
        if (i.ly > L.ph - 4) i.ly = L.ph - 4;
        if (i.ly > next - gap) i.ly = next - gap;
        next = i.ly;
      }
      prev = 6 - gap;
      rights.forEach((i) => { i.ly = Math.max(i.ly, prev + gap); prev = i.ly; });
      const shown = items.filter((i) => !i.dropped && (!i.right || i.ly <= L.ph));
      const sel = gLabels.selectAll('g.endlabel').data(shown, (d) => d.s.id).join((enter) => {
        const g = enter.append('g').attr('class', 'endlabel');
        g.append('path').attr('class', 'leader');
        g.append('path').attr('class', 'glyph');
        const t = g.append('text').attr('class', 'halo');
        t.append('tspan').attr('class', 'n');
        t.append('tspan').attr('class', 'v').attr('dx', 6);
        t.append('tspan').attr('class', 'nt').attr('dx', 6);
        return g;
      });
      sel.style('--c', (d) => d.s.color);
      sel.each(function (d) {
        const g = d3.select(this), lab = labOf(d.s);
        const tx = d.right ? L.pw + 24 : d.tx, anchor = d.right ? 'start' : d.anchor;
        const ty = d.right ? d.ly : d.ty;
        const note = noteOf(lab, L.softNotes);
        g.select('text').attr('x', tx).attr('y', ty).attr('dy', '0.34em').attr('text-anchor', anchor);
        g.select('.n').text(lab.name);
        g.select('.v').text(lab.value || '').attr('display', lab.value ? null : 'none');
        g.select('.nt').text(note).attr('display', note ? null : 'none');
        const glyph = g.select('.glyph');
        if (d.right) {
          // past the axis: an arrow toward the value instead of the series marker, and a leader from the plot edge
          const arrow = d.off === 'up' ? 'M-5,3.5 L5,3.5 L0,-4 Z' : 'M-5,-3.5 L5,-3.5 L0,4 Z';
          glyph.attr('display', null).attr('d', d.off ? arrow : symPath(d.s.shape || 'circle', 0.8)).attr('transform', 'translate(' + (L.pw + 14) + ',' + d.ly + ')');
          const need = d.off || Math.abs(d.ly - d.py) > 2.5 || d.px < L.pw - 6;
          g.select('.leader').attr('display', need ? null : 'none')
            .attr('d', 'M' + (d.off ? L.pw - 6 : d.px + 6) + ',' + d.py + ' L' + (L.pw + 3) + ',' + d.py + ' L' + (L.pw + 8) + ',' + d.ly);
        } else {
          glyph.attr('display', 'none');
          g.select('.leader').attr('display', d.leader ? null : 'none').attr('d', d.leader || null);
        }
      });
      gLabels.selectAll('text.startlabel').data(starts, (d) => d.s.id).join('text').attr('class', 'halo startlabel reflabel')
        .attr('x', (d) => d.px + 6).attr('y', (d) => d.py - 8).text((d) => d.s.startLabel);
    }

    function drawGoldPanel() {
      if (!L.showGold || !YG) { gG.attr('display', 'none'); return; }
      gG.attr('display', null);
      const p2 = model.panel2;
      gGTitle.attr('x', 0).attr('y', -7).text(L.small ? p2.titleShort : p2.title);
      const yt = goldEmpty ? [] : logTicks(YG, L.goldH).filter((d) => d.major || L.goldH > 100);
      const vis = yt.filter((d) => { const p = YG(d.v); return p >= 4 && p <= L.goldH - 2; });
      gGGrid.selectAll('line.hy').data(vis, (d) => d.v).join('line').attr('class', 'hy')
        .attr('x1', 0).attr('x2', L.pw).attr('y1', (d) => Math.round(YG(d.v)) + 0.5).attr('y2', (d) => Math.round(YG(d.v)) + 0.5);
      const xt = xTickList(view.x0, view.x1, L.pw);
      gGGrid.selectAll('line.vx').data(xt, (d) => d.t).join('line').attr('class', 'vx')
        .attr('x1', (d) => Math.round(X(d.t)) + 0.5).attr('x2', (d) => Math.round(X(d.t)) + 0.5).attr('y1', 0).attr('y2', L.goldH);
      gGYT.selectAll('text').data(vis, (d) => d.v).join('text')
        .attr('x', -8).attr('y', (d) => YG(d.v)).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => p2.fmt(d.v));
      renderSeries(gGLines, p2.series.filter((s) => !s.hidden), X, YG, true, L.pw, L.goldH);
    }

    function fitEra(label, w) {
      const opts = [label].concat(ERA_SHORT[label] || []);
      for (let i = 0; i < opts.length; i++) if (textW(opts[i]) <= w - 10) return opts[i];
      return '';
    }

    function drawLanes() {
      if (!model.lanes) return;
      const eras = model.eras.map((e, i) => ({ e, i, a: clamp(X(e.start), 0, L.pw), b: clamp(X(e.end), 0, L.pw) })).filter((d) => d.b - d.a > 1);
      const es = gEra.selectAll('g.era').data(eras, (d) => d.i).join((enter) => {
        const g = enter.append('g').attr('class', 'era');
        g.append('rect').attr('class', 'era-rect').style('pointer-events', 'all');
        g.append('text').attr('class', 'era-label').attr('y', 15);
        g.on('pointerenter', (ev, d) => {
          hotEra = d.i; requestDraw();
          const r = stage.getBoundingClientRect();
          showTip(ev.clientX - r.left, L.eraTop + 10, d.e.label, 'Era', Math.round(d.e.start) + ' to ' + Math.round(d.e.end), 'above');
        }).on('pointerleave', () => { hotEra = null; hideTip(); requestDraw(); });
        return g;
      });
      es.select('rect').attr('data-kind', (d) => d.e.kind).attr('x', (d) => d.a).attr('y', 0).attr('width', (d) => d.b - d.a).attr('height', L.eraH - 3);
      es.select('text').attr('x', (d) => d.a + 6).text((d) => fitEra(d.e.label, d.b - d.a));

      // events: importance first, then stack into rows without overlap
      const evs = model.events;
      const order = evs.map((e, i) => i).filter((i) => { const x = X(evs[i].year); return x >= -10 && x <= L.pw + 10; })
        .sort((a, b) => evs[a].importance - evs[b].importance || evs[a].year - evs[b].year);
      const rows = [[], [], []];
      placed = [];
      order.forEach((i) => {
        const x = X(evs[i].year);
        for (let r = 0; r < rows.length; r++) {
          if (rows[r].every((px) => Math.abs(px - x) >= 26)) { rows[r].push(x); placed.push({ i, x, y: 14 + r * 22 }); return; }
        }
      });
      const evSel = gEv.selectAll('g.ev').data(placed, (d) => d.i).join((enter) => {
        const g = enter.append('g').attr('class', 'ev').attr('tabindex', 0).attr('role', 'button')
          .attr('transform', 'translate(0,' + (L.evTop - L.eraTop) + ')');
        g.append('circle').attr('class', 'hit').attr('r', 12);
        g.append('circle').attr('class', 'ring').attr('r', 10);
        g.append('circle').attr('class', 'm');
        g.on('pointerenter focus', (ev, d) => { setHotEv(d.i); showEventTip(d.i); })
          .on('pointerleave blur', () => { setHotEv(null); hideTip(); })
          .on('click', (ev, d) => hooks.onEventClick(d.i))
          .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); hooks.onEventClick(d.i); } });
        return g;
      });
      evSel.attr('transform', (d) => 'translate(' + d.x + ',' + (L.evTop - L.eraTop + d.y) + ')')
        .attr('aria-label', (d) => evs[d.i].year + ': ' + evs[d.i].name + '. Press Enter for details.')
        .attr('class', (d) => 'ev' + (evs[d.i].importance === 1 ? ' big' : '') + (selEv === d.i ? ' sel' : '') + (hotEv === d.i ? ' hot' : '') +
          (model.tagFilter && evs[d.i].tag !== model.tagFilter ? ' dimmed' : ''));
      evSel.select('.m').attr('r', (d) => (evs[d.i].importance === 1 ? 7 : 5.5));
      if (hooks.onPlaced) hooks.onPlaced(placed.length, order.length, evs.length);
    }

    function drawGuide() {
      const years = [];
      if (model.lanes) {
        if (hotEv != null) years.push(model.events[hotEv].year);
        else if (selEv != null) years.push(model.events[selEv].year);
      }
      gGuide.selectAll('line').data(years).join('line').attr('class', 'guide')
        .attr('x1', (y) => X(y)).attr('x2', (y) => X(y)).attr('y1', 0).attr('y2', L.ph);
    }

    function setHotEv(i) {
      if (hotEv === i) return;
      hotEv = i;
      hooks.onEventHover(i);
      requestDraw();
    }

    /* -- tooltip and readout -- */
    function place(el, ax, ay, prefer) {
      el.hidden = false;
      const w = el.offsetWidth, hh = el.offsetHeight, W = stage.clientWidth, H = stage.clientHeight;
      let left = ax + 14, top = ay - hh / 2;
      if (prefer === 'below') { left = ax - w / 2; top = ay + 14; }
      if (prefer === 'above') { left = ax - w / 2; top = ay - hh - 14; }
      if (left + w > W - 6) left = ax - 14 - w;
      el.style.left = clamp(left, 6, Math.max(6, W - w - 6)) + 'px';
      el.style.top = clamp(top, 6, Math.max(6, H - hh - 6)) + 'px';
    }
    function showTip(ax, ay, title, tag, text, prefer) {
      tipEl.textContent = '';
      tipEl.appendChild(h('b', { text: title }));
      if (tag) tipEl.appendChild(h('span', { class: 'tip-tag', text: tag }));
      if (text) tipEl.appendChild(h('p', { text }));
      place(tipEl, ax, ay, prefer || 'below');
    }
    function hideTip() { tipEl.hidden = true; }
    function showEventTip(i) {
      const e = model.events[i];
      const d = placed.find((p) => p.i === i);
      if (!d) return;
      showTip(L.ml + d.x, L.evTop + d.y, e.year + ': ' + e.name, e.tag, e.desc, 'above');
    }

    function keySvg(color, shape, dash, hollow) {
      const s = sv('svg', { class: 'ro-key', viewBox: '0 0 22 10', width: 22, height: 10 });
      s.style.setProperty('--c', color);
      s.appendChild(sv('line', { x1: 1, y1: 5, x2: 21, y2: 5, class: dash ? 'dash' : '' }));
      s.appendChild(sv('path', { d: symPath(shape || 'circle', 0.7), transform: 'translate(11,5)', class: hollow ? 'hollow' : '' }));
      return s;
    }

    function updateCross() {
      const hide = () => { gCross.attr('display', 'none'); gGCross.attr('display', 'none'); readout.hidden = true; };
      if (!cross || !model) return hide();
      const t = cross.t, px = X(t);
      if (px < -1 || px > L.pw + 1) return hide();
      const info = model.rowsAt(t);
      if (!info || !info.rows.length) return hide();
      gCross.attr('display', null);
      crossLine.attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', L.ph);
      const dots = info.rows.filter((r) => r.y != null && isFinite(r.y) && (!isLogY() || r.y > 0)).map((r) => ({ r, y: Y(r.y) })).filter((d) => d.y >= 0 && d.y <= L.ph);
      crossDots.selectAll('circle').data(dots, (d) => d.r.id).join('circle').attr('class', 'dot').attr('r', 4.5)
        .style('--c', (d) => d.r.color).attr('cx', px).attr('cy', (d) => d.y);
      if (L.showGold && YG && info.panel2) {
        gGCross.attr('display', null);
        gCrossLine.attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', L.goldH);
        const gd = info.panel2.filter((r) => r.y > 0);
        gCrossDot.selectAll('circle').data(gd, (r) => r.id).join('circle').attr('class', 'dot').attr('r', 4.5)
          .style('--c', (r) => r.color).attr('cx', px).attr('cy', (r) => YG(r.y));
      } else gGCross.attr('display', 'none');

      // readout
      readout.textContent = '';
      readout.appendChild(h('div', { class: 'ro-title', text: info.title }));
      const ul = h('ul', { class: 'ro-rows' });
      const rows = info.rows.slice().sort((a, b) => b.main - a.main);
      const nearRow = cross.py != null && Y ? rows.reduce((best, r) => { const d = Math.abs(Y(r.y) - (cross.py - L.mt)); return d < best.d ? { d, r } : best; }, { d: Infinity, r: null }).r : null;
      const maxRows = 14;
      rows.slice(0, maxRows).forEach((r) => {
        const li = h('li', { class: r === nearRow && cross.mouse ? 'near' : '' });
        li.appendChild(keySvg(r.color, r.shape, r.dash, r.hollow));
        const nm = h('span', { class: 'ro-name', text: r.label });
        if (r.tag) nm.appendChild(h('span', { class: 'ro-tag', text: r.tag }));
        li.appendChild(nm);
        li.appendChild(h('span', { class: 'ro-val', text: r.text }));
        if (r.sub) li.appendChild(h('span', { class: 'ro-sub', text: r.sub }));
        ul.appendChild(li);
      });
      readout.appendChild(ul);
      if (rows.length > maxRows) readout.appendChild(h('div', { class: 'ro-note', text: '+' + (rows.length - maxRows) + ' more in the table view' }));
      if (info.total) readout.appendChild(h('div', { class: 'ro-total' }, [h('span', { text: info.total.label }), h('span', { class: 'num', text: info.total.text })]));
      if (info.panel2 && info.panel2.length) {
        const ul2 = h('ul', { class: 'ro-rows' });
        ul2.style.marginTop = '6px';
        info.panel2.forEach((r) => {
          const li = h('li');
          li.appendChild(keySvg(r.color, r.shape, r.dash, r.hollow));
          const nm = h('span', { class: 'ro-name', text: r.label });
          if (r.tag) nm.appendChild(h('span', { class: 'ro-tag', text: r.tag }));
          li.appendChild(nm);
          li.appendChild(h('span', { class: 'ro-val', text: r.text }));
          ul2.appendChild(li);
        });
        readout.appendChild(ul2);
      }
      if (info.note) readout.appendChild(h('div', { class: 'ro-note', text: info.note }));
      readout.hidden = false;
      const rw = readout.offsetWidth, rh = readout.offsetHeight;
      const sx = L.ml + px;
      let left = sx + 16;
      if (left + rw > L.W - 6) left = sx - 16 - rw;
      let top = (cross.py != null ? cross.py : L.mt + L.ph / 2) - rh / 2;
      readout.style.left = clamp(left, 6, Math.max(6, L.W - rw - 6)) + 'px';
      readout.style.top = clamp(top, 6, Math.max(6, L.H - rh - 6)) + 'px';
      if (cross.announce && hooks.announce) {
        hooks.announce(info.title + '. ' + rows.slice(0, 4).map((r) => r.label + ' ' + r.text).join('. '));
        cross.announce = false;
      }
    }

    /* -- view changes -- */
    function emit() {
      clearTimeout(emitTimer);
      emitTimer = setTimeout(() => hooks.onView({ x0: view.x0, x1: view.x1, ymanual: view.ymanual }), 140);
    }
    function cancelAnim() { if (animId) { cancelAnimationFrame(animId); animId = null; } }
    function setView(a, b, animate) {
      cancelAnim();
      const t = clampX(a, b);
      if (!animate || reduceMotion()) { view.x0 = t[0]; view.x1 = t[1]; requestDraw(); emit(); return; }
      const s0 = view.x0, s1 = view.x1, t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / 380, 0, 1), e = d3.easeCubicInOut(k);
        view.x0 = s0 + (t[0] - s0) * e; view.x1 = s1 + (t[1] - s1) * e;
        draw();
        if (k < 1) animId = requestAnimationFrame(step); else { animId = null; emit(); }
      };
      animId = requestAnimationFrame(step);
    }
    function zoomXAt(k, anchorT) {
      const span = view.x1 - view.x0;
      const f = (anchorT - view.x0) / span;
      const ns = clamp(span / k, model.minSpan || 1, model.xFull[1] - model.xFull[0]);
      const a = anchorT - f * ns;
      const t = clampX(a, a + ns);
      view.x0 = t[0]; view.x1 = t[1];
      requestDraw(); emit();
    }
    function zoomDomain(dom, anchor, k, log) {
      const f = log ? Math.log : (v) => v, g = log ? Math.exp : (v) => v;
      const a = f(Math.min(dom[0], dom[1])), b = f(Math.max(dom[0], dom[1])), c = f(anchor);
      let lo = c + (a - c) / k, hi = c + (b - c) / k;
      if (hi - lo < (log ? 0.05 : 1e-9)) { const m = (lo + hi) / 2; lo = m - (log ? 0.025 : 1e-9); hi = m + (log ? 0.025 : 1e-9); }
      return [g(lo), g(hi)];
    }
    function panDomain(dom, frac, log) {
      const f = log ? Math.log : (v) => v, g = log ? Math.exp : (v) => v;
      const a = f(Math.min(dom[0], dom[1])), b = f(Math.max(dom[0], dom[1])), d = (b - a) * frac;
      return [g(a + d), g(b + d)];
    }
    function fit() { view.ymanual = null; requestDraw(); emit(); }
    function resetView() { cancelAnim(); view.ymanual = null; setView(model.xDefault[0], model.xDefault[1], true); }

    /* -- pointer, wheel, keyboard -- */
    const ptrs = new Map();
    let drag = null, pinch = null, dragMoved = false;
    const ovNode = overlay.node();
    const local = (e) => { const r = ovNode.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    function snapped(mx) { return model.snap(X.invert(clamp(mx, 0, L.pw))); }
    function hoverAt(e) {
      const [mx, my] = local(e);
      const sr = stage.getBoundingClientRect();
      const hit = annHits.find((a) => Math.hypot(a.x - mx, a.y - my) <= a.r);
      if (hit) {
        ovNode.style.cursor = 'pointer';
        showTip(L.ml + hit.x, L.mt + hit.y, hit.title, hit.tag, hit.text);
      } else { ovNode.style.cursor = ''; hideTip(); }
      const t = snapped(mx);
      cross = { t, py: e.clientY - sr.top, mouse: true };
      updateCross();
    }

    ovNode.addEventListener('pointerdown', (e) => {
      if (!model) return;
      // only the primary button pans; a right or ctrl click opens the context menu, which can swallow the pointerup
      if (e.pointerType === 'mouse' && (e.button !== 0 || e.ctrlKey)) return;
      try { ovNode.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        drag = { px: e.clientX, py: e.clientY, x0: view.x0, x1: view.x1, dom: Y.domain().slice(), shift: e.shiftKey, moved: false, type: e.pointerType };
      } else if (ptrs.size === 2) {
        const pts = Array.from(ptrs.values());
        pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, x0: view.x0, x1: view.x1 };
        drag = null;
      }
    });
    ovNode.addEventListener('pointermove', (e) => {
      if (!model) return;
      // the button was released somewhere we did not see it: end the drag instead of panning on hover
      if (e.pointerType === 'mouse' && ptrs.has(e.pointerId) && !(e.buttons & 1)) {
        ptrs.delete(e.pointerId);
        if (!ptrs.size) { drag = null; pinch = null; ovNode.classList.remove('grabbing'); }
      }
      if (ptrs.has(e.pointerId)) {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && ptrs.size >= 2) {
          const pts = Array.from(ptrs.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
          const mid = (pts[0].x + pts[1].x) / 2 - ovNode.getBoundingClientRect().left;
          const k = dist / pinch.d;
          const anchor = pinch.x0 + (clamp(mid, 0, L.pw) / L.pw) * (pinch.x1 - pinch.x0);
          const f = (anchor - pinch.x0) / (pinch.x1 - pinch.x0);
          const ns = clamp((pinch.x1 - pinch.x0) / k, model.minSpan || 1, model.xFull[1] - model.xFull[0]);
          const t = clampX(anchor - f * ns, anchor - f * ns + ns);
          view.x0 = t[0]; view.x1 = t[1];
          requestDraw(); emit();
          return;
        }
        if (drag) {
          const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
          if (!drag.moved && Math.hypot(dx, dy) > 4) {
            drag.moved = true;
            ovNode.classList.add('grabbing');
            cross = null; hideTip(); updateCross();
          }
          if (drag.moved) {
            cancelAnim();
            if (drag.shift) {
              view.ymanual = clampY(panDomain(drag.dom, dy / L.ph, isLogY()));
            } else {
              const span = drag.x1 - drag.x0;
              const t = clampX(drag.x0 - (dx / L.pw) * span, drag.x1 - (dx / L.pw) * span);
              view.x0 = t[0]; view.x1 = t[1];
            }
            requestDraw(); emit();
          }
          return;
        }
      }
      if (e.pointerType === 'mouse' && !drag) hoverAt(e);
    });
    const endPtr = (e) => {
      const wasDrag = drag;
      dragMoved = !!(wasDrag && wasDrag.moved);
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        drag = null;
        ovNode.classList.remove('grabbing');
        if (wasDrag && !wasDrag.moved && e.pointerType !== 'mouse' && e.type === 'pointerup') hoverAt(e);
      }
    };
    ovNode.addEventListener('pointerup', endPtr);
    ovNode.addEventListener('pointercancel', endPtr);
    ovNode.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !ptrs.size) { if (cross && cross.mouse) { cross = null; updateCross(); } hideTip(); }
    });
    ovNode.addEventListener('dblclick', () => { if (model) resetView(); });
    // a click on a numbered break opens its entry in the panel (touch gets the tooltip instead)
    ovNode.addEventListener('click', (e) => {
      if (!model || dragMoved || e.pointerType === 'touch') return;
      const [mx, my] = local(e);
      const hit = annHits.find((a) => a.brk != null && Math.hypot(a.x - mx, a.y - my) <= a.r);
      if (hit) hooks.onBreakSelect(hit.brk);
    });

    stage.addEventListener('wheel', (e) => {
      if (!model || !L) return;
      const r = ovNode.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const limit = (L.hist ? L.evTop + L.evH : L.axisTop + 24) - L.mt;
      if (mx < -L.ml || mx > L.pw + L.mr || my < 0 || my > limit) return;
      let dy = e.deltaY || e.deltaX;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
      if (!dy) return;
      e.preventDefault();
      const k = Math.exp(-dy * 0.002);
      if (e.shiftKey && my >= 0 && my <= L.ph) {
        const anchor = Y.invert(clamp(my, 0, L.ph));
        view.ymanual = clampY(zoomDomain(Y.domain(), anchor, k, isLogY()));
        requestDraw(); emit();
      } else {
        cancelAnim();
        zoomXAt(k, X.invert(clamp(mx, 0, L.pw)));
      }
    }, { passive: false });

    // a tip opened by keyboard focus on an event or break marker can be dismissed with Escape
    stage.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tipEl.hidden) hideTip(); });
    stage.addEventListener('keydown', (e) => {
      if (!model || e.target !== stage) return;
      const key = e.key;
      const mid = (view.x0 + view.x1) / 2;
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
        e.preventDefault();
        let t;
        if (!cross) t = model.snap(clamp(mid, view.x0, view.x1));
        else if (key === 'Home') t = model.firstT;
        else if (key === 'End') t = model.lastT;
        else t = model.step(cross.t, key === 'ArrowRight' ? 1 : -1, e.shiftKey);
        if (t < view.x0 || t > view.x1) {
          const span = view.x1 - view.x0, c = clampX(t - span / 2, t + span / 2);
          view.x0 = c[0]; view.x1 = c[1]; emit();
        }
        cross = { t, py: null, announce: true };
        requestDraw();
      } else if (key === '+' || key === '=') { e.preventDefault(); zoomXAt(1.4, cross ? cross.t : mid); }
      else if (key === '-' || key === '_') { e.preventDefault(); zoomXAt(1 / 1.4, cross ? cross.t : mid); }
      else if (key === '0') { e.preventDefault(); resetView(); }
      else if (key === 'Escape') { cross = null; updateCross(); hideTip(); }
    });
    stage.addEventListener('blur', () => { if (cross && !cross.mouse) { cross = null; updateCross(); } });

    /* -- model intake -- */
    function buildRuns(pts) {
      if (!pts.some((p) => p.e)) return [{ est: false, a: 0, b: pts.length - 1 }];
      const runs = [];
      let cur = null;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.v == null || b.v == null) { cur = null; continue; }
        const est = !!(a.e || b.e);
        if (cur && cur.est === est) cur.b = i;
        else { cur = { est, a: i - 1, b: i }; runs.push(cur); }
      }
      return runs.length ? runs : [{ est: false, a: 0, b: pts.length - 1 }];
    }
    function prepare(s) {
      s.ts = s.pts.map((p) => p.t);
      let first = null, last = null;
      for (let i = 0; i < s.pts.length; i++) if (s.pts[i].v != null) { first = s.pts[i]; break; }
      for (let i = s.pts.length - 1; i >= 0; i--) if (s.pts[i].v != null) { last = s.pts[i]; break; }
      s.first = first; s.last = s.last || last;
      s.runs = buildRuns(s.pts);
    }

    function setModel(m, opts) {
      opts = opts || {};
      model = m;
      model.byId = {};
      model.series.forEach((s) => { prepare(s); model.byId[s.id] = s; });
      if (model.panel2) model.panel2.series.forEach(prepare);
      if (model.stacked) {
        model.areas.forEach((a) => { a.ts = a.pts.map((p) => p.t); });
        model.totalTs = model.totalPts.map((p) => p.t);
      }
      cancelAnim();
      if (opts.x) { view.x0 = opts.x[0]; view.x1 = opts.x[1]; }
      else if (opts.resetX || !isFinite(view.x0) || view.x1 <= view.x0) { view.x0 = model.xDefault[0]; view.x1 = model.xDefault[1]; }
      const c = clampX(view.x0, view.x1);
      view.x0 = c[0]; view.x1 = c[1];
      view.ymanual = opts.ymanual === undefined ? (opts.resetY ? null : view.ymanual) : opts.ymanual;
      // a value domain from a shared link or an earlier scale must fit this axis (no zero or negative end on a log axis)
      if (view.ymanual) view.ymanual = validDomain(view.ymanual, isLogY()) ? clampY(view.ymanual) : null;
      if (cross && !model.rowsAt(cross.t)) cross = null;
      if (cross) cross.t = model.snap(cross.t);
      layout();
      requestDraw();
    }

    const ro = new ResizeObserver(() => { if (model) { layout(); requestDraw(); } });
    ro.observe(stage);

    return {
      setModel, setView, fit, resetView,
      relayout() { layout(); requestDraw(); },
      redraw: requestDraw,
      getView() { return { x0: view.x0, x1: view.x1, ymanual: view.ymanual }; },
      setHover(ids) { hover = ids && ids.length ? new Set(ids) : null; requestDraw(); },
      setSelectedEvent(i) { selEv = i; requestDraw(); },
      setHotEvent(i) { if (hotEv !== i) { hotEv = i; requestDraw(); } },
      panToYear(y) {
        const span = view.x1 - view.x0;
        setView(y - span / 2, y + span / 2, true);
      },
      zoomBy(k) { zoomXAt(k, (view.x0 + view.x1) / 2); },
      showCrossAt(t) { cross = { t: model.snap(t), py: null }; requestDraw(); },
      clearCross() { cross = null; updateCross(); },
      hideTip,
      textW,
    };
  }

  /* ---------- model adapters ---------- */
  const numStr = (v) => {
    if (v == null || !isFinite(v)) return '';
    const a = Math.abs(v);
    return a >= 1000 ? d3.format(',.0f')(v) : a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : String(+v.toPrecision(3));
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const BREAK_KIND = { redefinition: 'Definition change', composition: 'Membership change', scope: 'Coverage change', discontinuation: 'Discontinued' };

  function yoyMapFor(S, usd) {
    const key = usd ? 'yoyUsd' : 'yoyLoc';
    if (S[key]) return S[key];
    if (!usd) { S[key] = yoyMapOf(S); return S[key]; }
    const redefs = S.breaks.filter((b) => YOY_BREAKS.indexOf(b.kind) >= 0).map((b) => b.mi);
    const m = new Map();
    S.valid.forEach((p) => {
      const q = S.byMi.get(p.mi - 12);
      if (p.usd > 0 && q && q.usd > 0 && !redefs.some((b) => b > p.mi - 12 && b <= p.mi)) m.set(p.mi, (p.usd / q.usd - 1) * 100);
    });
    S[key] = m;
    return m;
  }

  // Factor per month that chain-links the segments of a series split at a redefinition break: each earlier
  // segment is scaled so it ends where the next one starts, which removes the step and treats growth in the
  // break month as zero. The latest segment keeps its own values.
  function chainFactors(S) {
    if (S.chain) return S.chain;
    const redefs = S.breaks.filter((b) => b.kind === 'redefinition').map((b) => b.mi);
    const segs = [];
    let cur = null;
    S.pts.forEach((p) => {
      if (p.loc == null) { if (redefs.indexOf(p.mi) >= 0) cur = null; return; }
      if (!cur) { cur = []; segs.push(cur); }
      cur.push(p);
    });
    const f = new Map();
    let k = 1;
    for (let i = segs.length - 1; i >= 0; i--) {
      segs[i].forEach((p) => f.set(p.mi, k));
      if (i > 0) k *= segs[i][0].loc / segs[i - 1][segs[i - 1].length - 1].loc;
    }
    S.chain = f;
    return f;
  }

  // Build the points of one series for the chosen measure
  function moneyPts(S, measure, useUsd) {
    const yoyLoc = yoyMapFor(S, false), yoyShown = yoyMapFor(S, useUsd);
    const chain = measure === 'index' ? chainFactors(S) : null;
    const out = [];
    S.pts.forEach((p) => {
      if (p.loc == null) {
        // a chain-linked index is continuous through a redefinition break, so the line is not split there
        if (chain && S.breaks.some((b) => b.kind === 'redefinition' && b.mi === p.mi)) return;
        out.push({ t: p.t, mi: p.mi, k: p.k, v: null });
        return;
      }
      let v;
      if (measure === 'level') v = useUsd ? p.usd : p.loc;
      else if (measure === 'yoy') v = yoyLoc.has(p.mi) ? yoyLoc.get(p.mi) : null;
      else v = p.loc;
      if (v == null) return;
      const q = { t: p.t, mi: p.mi, k: p.k, v, raw: chain ? p.loc * (chain.get(p.mi) || 1) : p.loc, usd: p.usd, loc: p.loc };
      if (measure === 'level') { q.lvl = v; q.yoy = yoyShown.has(p.mi) ? yoyShown.get(p.mi) : null; }
      else { q.lvl = useUsd && measure !== 'yoy' ? p.usd : p.loc; q.yoy = yoyLoc.has(p.mi) ? yoyLoc.get(p.mi) : null; }
      out.push(q);
    });
    return compactNulls(out);
  }

  // 100 at the first observation at or after x0, or at the series' own first
  // observation when it has none there. Returns the time of that base.
  function rebaseIndex(pts, x0) {
    let base = null, baseT = null;
    for (let i = 0; i < pts.length; i++) if (pts[i].raw != null && pts[i].raw > 0 && pts[i].t >= x0 - 1e-9) { base = pts[i].raw; baseT = pts[i].t; break; }
    if (base == null) for (let i = 0; i < pts.length; i++) if (pts[i].raw > 0) { base = pts[i].raw; baseT = pts[i].t; break; }
    pts.forEach((p) => { p.v = p.raw == null || !base ? null : (p.raw / base) * 100; });
    return baseT;
  }
  // A series that starts well after the window start is indexed at its own start
  const LATE_BASE = 0.3; // years
  const BRIDGE_MAX_GAP = 0.5; // years: the longest gap an earlier-definition series is bridged across
  const INDEX_RULE = '100 at the start of the visible window, or at a series\' own first month if it starts later (its label says when)';
  const INDEX_RULE_TITLE = '100 at the start of the visible window, or at a series\' own first month if it starts later';

  const spreadRamp = (n) => (n <= 1 ? [0] : Array.from({ length: n }, (_, i) => Math.round((i * 4) / (n - 1))));
  const CMP_IDS = { us: 'us_m2', ea: 'ea_m3', uk: 'uk_m4ex', jp: 'jp_m3', cn: 'cn_m2' };

  function moneySpecs(isCmp, measure) {
    const specs = [];
    if (isCmp) {
      ECON_ORDER.forEach((k) => specs.push({ sid: CMP_IDS[k], role: 'main', econ: k, color: ECON[k].cat, shape: ECON[k].shape, name: ECON[k].short + ' ' + MS.series[CMP_IDS[k]].label }));
      return specs;
    }
    const k = state.econ, E = MS.economies[k], hue = ECON[k].hue;
    const ramp = spreadRamp(E.order.length);
    E.order.forEach((sid, i) => specs.push({ sid, role: 'main', econ: k, color: 'var(--ramp-' + hue + '-' + ramp[i] + ')', shape: 'circle', name: MS.series[sid].label }));
    if (measure !== 'index') {
      Object.keys(MS.series).forEach((sid) => {
        const d = MS.series[sid];
        if (d.economy === k && d.kind === 'historical' && d.continues && E.order.indexOf(d.continues) >= 0) {
          const of = specs.find((s) => s.sid === d.continues);
          specs.push({ sid, role: 'hist', of: d.continues, econ: k, color: of.color, shape: 'circle', name: d.label });
        }
      });
    }
    if (k === 'us') {
      if (state.extras.has('div') && measure === 'yoy') specs.push({ sid: 'us_divisia_m4', role: 'extra', econ: k, color: 'var(--ink)', shape: 'square', name: 'Divisia M4 (CFS)' });
      if (state.extras.has('wb') && measure !== 'index') specs.push({ sid: 'us_broad_wb', role: 'extra', econ: k, color: 'var(--ink-2)', shape: 'plus', name: 'IMF/WB broad money' });
    }
    return specs;
  }

  function buildMoney() {
    const isCmp = state.econ === 'cmp', measure = state.measure;
    const useUsd = isCmp ? measure === 'level' : (measure === 'level' && state.ccy === 'usd');
    const stacked = isCmp && state.cmp === 'stacked' && measure === 'level';
    const log = measure !== 'yoy' && !stacked && state.scale === 'log';
    const specs = moneySpecs(isCmp, measure);
    const series = [];
    const breaks = [];

    specs.forEach((sp) => {
      const S = MONEY[sp.sid], def = S.def;
      const E = ECON[def.economy];
      const sym = isCmp || useUsd ? '$' : E.sym;
      const localSym = E.sym;
      if (def.unit === 'index' && measure === 'level') return;
      const pts = moneyPts(S, measure, useUsd && def.unit !== 'index');
      if (!pts.length) return;
      const hiddenByUser = state.hid.has(sp.role === 'hist' ? sp.of : sp.sid);
      const fmt = measure === 'level' ? (v) => fmtBn(v, sym) : measure === 'yoy' ? fmtPct : fmtIdx;
      const s = {
        id: sp.sid, name: sp.name, color: sp.color, shape: sp.shape, role: sp.role, hist: sp.role === 'hist', econ: sp.econ,
        pts, S, def, hidden: hiddenByUser, fmt, sym, localSym, markAll: def.frequency === 'A' && sp.role === 'hist',
        disc: S.disc, noOffscale: true,
      };
      if (measure === 'index') s.raw = true;
      s.byMi = new Map();
      pts.forEach((p) => { if (p.v != null) s.byMi.set(p.mi, p); });
      series.push(s);
    });

    const latest = d3.max(series, (s) => s.pts.length ? s.pts[s.pts.length - 1].t : 0);
    series.forEach((s) => {
      const lp = s.pts[s.pts.length - 1];
      s.atEnd = s.disc != null || (latest - lp.t) > 1.5;
      if (s.hist) {
        s.startLabel = s.disc != null ? null : s.name;
        if (s.disc != null) s.endLabel = { name: s.name, note: 'discontinued ' + Math.floor(s.disc) };
      } else if (s.disc != null) s.endLabel = { name: s.name, note: 'discontinued ' + Math.floor(s.disc) };
      else if (measure === 'index') {
        s.endLabel = () => {
          const lab = { name: s.name, value: s.fmt(s.last.v) };
          if (s.baseT != null && s.baseT - model.indexX0 > LATE_BASE) lab.note = '100 = ' + fmtPeriod(s.baseT, 'M');
          else if (s.S.first.t > model.xFull[0] + LATE_BASE) lab.reserve = '100 = Sep 2026';
          return lab;
        };
      }
      else s.endLabel = { name: s.name, value: s.fmt(lp.v) };
      // a wider definition than M2 is expected to sit above it
      if (s.id === 'us_broad_wb' && measure === 'level') { s.endLabel.note = 'wider than M2'; s.endLabel.soft = true; }
      if (s.disc != null) s.atEnd = true;
    });

    // links between an earlier-definition series and the one it continues (Level only)
    if (measure === 'level') {
      series.filter((s) => s.hist).forEach((hs) => {
        const ms = series.find((s) => s.id === hs.S.def.continues);
        if (!ms) return;
        const a = hs.pts[hs.pts.length - 1], b = ms.pts[0];
        if (!a || !b) return;
        // a bridge across years of no data (Japan, 1999 to 2003) would imply a join that the notes say is a gap
        if (b.t - a.t > BRIDGE_MAX_GAP) return;
        series.push({
          id: 'link_' + hs.id, name: 'link', color: hs.color, link: true, noMarker: true, noDomain: true, noOffscale: true,
          pts: [{ t: a.t, v: a.v, mi: a.mi }, { t: b.t, v: b.v, mi: b.mi }], hidden: hs.hidden || ms.hidden, fmt: hs.fmt,
        });
      });
    }

    // numbered breaks: ticks on the line (discontinuations get a hollow end instead)
    let n = 0;
    const bmap = new Map();
    series.filter((s) => !s.link && s.role !== 'extra').forEach((s) => {
      s.S.breaks.filter((b) => b.kind !== 'discontinuation').forEach((b) => {
        const key = b.kind + '|' + b.t + '|' + b.label;
        let g = bmap.get(key);
        if (!g) {
          n += 1;
          g = { n, sids: [], names: [], t: b.bt, label: b.label, kind: b.kind, kindLabel: BREAK_KIND[b.kind] || 'Break', period: b.t };
          bmap.set(key, g);
          breaks.push(g);
        }
        g.sids.push(s.id);
        g.names.push(s.name);
      });
    });
    breaks.forEach((b) => { b.seriesName = b.names.length > 1 ? b.names.slice(0, -1).join(', ') + ' and ' + b.names[b.names.length - 1] : b.names[0]; });

    const mainSeries = series.filter((s) => !s.link);
    let allMi = Array.from(new Set([].concat.apply([], mainSeries.filter((s) => !s.hidden).map((s) => s.pts.filter((p) => p.v != null).map((p) => p.mi))))).sort(d3.ascending);
    const firstAll = d3.min(specs.map((sp) => MONEY[sp.sid].first.t)), lastAll = latest;
    const mainFirst = d3.min(specs.filter((sp) => sp.role === 'main').map((sp) => MONEY[sp.sid].first.t));
    const dstart = isCmp ? 2000 : mainFirst;

    const E = ECON[state.econ];
    const model = {
      kind: 'money', view: 'money', series, breaks, stacked, measure, useUsd, isCmp,
      yScale: log ? 'log' : 'linear', yKind: measure === 'yoy' ? 'yoy' : measure === 'index' ? 'index' : 'level',
      floor: measure === 'level' ? USD_FLOOR : 1, zeroLine: measure === 'yoy', refY: measure === 'index' ? [100] : [],
      xFull: [firstAll - 0.2, lastAll + 0.35], xDefault: [dstart - 0.04, lastAll + 0.35], minSpan: 1.5,
      title: (isCmp ? 'Five economies compared' : E.name) + ', ' + (measure === 'level' ? 'level' : measure === 'yoy' ? 'year-over-year change' : 'indexed'),
      yFmt: measure === 'level' ? (v) => fmtBn(v, isCmp || useUsd ? '$' : E.sym) : measure === 'yoy' ? fmtPctAxis : (v) => d3.format(',')(v),
      yTitle: stacked ? 'US dollars, stacked, linear scale' :
        measure === 'level' ? cap(isCmp || useUsd ? 'US dollars' : E.ccyName) + ', ' + (log ? 'log' : 'linear') + ' scale' :
          measure === 'yoy' ? 'Change on a year earlier, %' : 'Index, 100 = window or series start, ' + (log ? 'log' : 'linear') + ' scale',
      firstT: allMi.length ? allMi[0] / 12 : 0, lastT: allMi.length ? allMi[allMi.length - 1] / 12 : 0,
    };
    const nearest = (t) => {
      if (!allMi.length) return t;
      const m = t * 12, i = d3.bisectLeft(allMi, m);
      if (i <= 0) return allMi[0] / 12;
      if (i >= allMi.length) return allMi[allMi.length - 1] / 12;
      return (m - allMi[i - 1] < allMi[i] - m ? allMi[i - 1] : allMi[i]) / 12;
    };
    model.snap = nearest;
    model.step = (t, dir, big) => {
      if (!allMi.length) return t;
      const m = Math.round(nearest(t) * 12);
      let i = d3.bisectLeft(allMi, m);
      i = clamp(i + dir * (big ? 12 : 1), 0, allMi.length - 1);
      return allMi[i] / 12;
    };
    if (measure === 'index') {
      model.onView = (x0) => {
        model.indexX0 = x0;
        series.forEach((s) => { if (s.raw && !s.link) s.baseT = rebaseIndex(s.pts, x0); });
      };
      model.onView(model.xDefault[0]);
    }

    if (stacked) {
      buildStack(model, series);
      // the crosshair snaps, and Home and End go, only to months the stack covers (it stops at the earliest latest month)
      if (model.areas.length) allMi = model.areas[0].mis.slice();
      model.firstT = allMi.length ? allMi[0] / 12 : 0;
      model.lastT = allMi.length ? allMi[allMi.length - 1] / 12 : 0;
      // the window opens where every economy shown is present; before that the total is a sliver on a linear axis
      if (model.stackStartT != null) model.xDefault = [Math.max(model.xDefault[0], model.stackStartT - 0.04), model.xDefault[1]];
    }
    model.rowsAt = stacked ? (t) => rowsStacked(model, t) : (t) => rowsMoney(model, t);
    model.table = (x0, x1) => tableMoney(model, x0, x1);
    return model;
  }

  function rowsMoney(model, t) {
    const mi = Math.round(t * 12), rows = [];
    model.series.forEach((s) => {
      if (s.hidden || s.link) return;
      const p = s.byMi.get(mi);
      if (!p || p.v == null) return;
      let sub = '';
      if (model.measure === 'level') sub = p.yoy == null ? '' : fmtPct(p.yoy) + ' y/y';
      else sub = (p.lvl != null ? fmtBn(p.lvl, s.localSym) : '') + (model.measure === 'index' && p.yoy != null ? ', ' + fmtPct(p.yoy) + ' y/y' : '');
      rows.push({ id: s.id, label: s.name, color: s.color, shape: s.shape, dash: s.hist, hollow: false, y: p.v, main: p.v, text: s.fmt(p.v), sub, tag: s.hist ? 'earlier definition' : '' });
    });
    const freqs = new Set(model.series.filter((s) => !s.hidden && !s.link).map((s) => s.def.frequency));
    return { title: fmtPeriod(t, freqs.size === 1 && freqs.has('A') ? 'A' : 'M'), rows, note: model.useUsd && state.econ !== 'us' ? 'Converted at month-end exchange rates.' : '' };
  }

  function tableMoney(model, x0, x1) {
    const inWin = (s) => s.pts.some((p) => p.v != null && p.t >= x0 - 1e-9 && p.t <= x1 + 1e-9);
    const vis = model.series.filter((s) => !s.hidden && !s.link && inWin(s));
    const miSet = new Set();
    vis.forEach((s) => s.pts.forEach((p) => { if (p.v != null && p.t >= x0 - 1e-9 && p.t <= x1 + 1e-9) miSet.add(p.mi); }));
    const mis = Array.from(miSet).sort(d3.ascending);
    const unit = model.measure === 'level' ? (model.useUsd ? 'USD bn' : 'bn ' + ECON[state.econ].ccy) : model.measure === 'yoy' ? '% y/y' : 'index';
    const columns = vis.map((s) => s.name + ' (' + (model.isCmp && model.measure === 'level' ? 'USD bn' : model.measure === 'level' ? (model.useUsd ? 'USD bn' : 'bn ' + ECON[s.econ].ccy) : unit) + ')');
    const rows = mis.map((mi) => ({
      label: Math.floor(mi / 12) + '-' + String((mi % 12) + 1).padStart(2, '0'),
      cells: vis.map((s) => { const p = s.byMi.get(mi); return p && p.v != null ? { v: p.v, text: numStr(p.v) } : { v: null, text: '' }; }),
    }));
    return { caption: 'Values for the visible window, ' + rows.length + ' periods. Annual series are placed in December.', columns, rows, filename: 'money-supply-' + state.econ + '-' + model.measure + '.csv' };
  }

  /* -- stacked comparison -- */
  function buildStack(model, series) {
    const order = STACK_ORDER.map((k) => series.find((s) => s.econ === k)).filter(Boolean);
    const live = order.filter((s) => !s.hidden && s.pts.length);
    const endPool = live.length ? live : order.filter((s) => s.pts.length);
    const endMi = d3.min(endPool, (s) => s.pts[s.pts.length - 1].mi);
    const miSet = new Set();
    order.forEach((s) => s.pts.forEach((p) => { if (p.v != null && p.mi <= endMi) miSet.add(p.mi); }));
    const mis = Array.from(miSet).sort(d3.ascending);
    model.stackEndT = endMi / 12;
    // first month with every economy that is switched on (null when none is)
    model.stackStartT = live.length ? d3.max(live, (s) => s.pts[0].mi) / 12 : null;
    const cum = new Array(mis.length).fill(0);
    model.areas = order.map((s) => {
      const pts = mis.map((mi, i) => {
        const p = s.byMi.get(mi), v = !s.hidden && p ? p.v : 0;
        const y0 = cum[i];
        cum[i] += v;
        return { t: mi / 12, mi, y0, y1: cum[i], v };
      });
      return { id: s.id, color: s.color, pts, mis, hidden: s.hidden, s };
    });
    model.totalPts = mis.map((mi, i) => ({ t: mi / 12, mi, v: cum[i] }));
    series.forEach((s) => { s.noLine = true; s.noMarker = true; s.noDomain = true; });
    // label at the middle of each band at the right edge; the stack stops at the
    // earliest latest month, so each label says which month its value is for
    const stackDate = fmtPeriod(model.stackEndT, 'M');
    model.areas.forEach((a) => {
      if (a.hidden) return;
      const last = a.pts[a.pts.length - 1];
      a.s.endV = (last.y0 + last.y1) / 2;
      a.s.last = { t: last.t, v: last.y1 };
      a.s.endLabel = { name: a.s.name, value: a.s.fmt(last.v), note: stackDate, soft: true };
      a.s.atEnd = false;
    });
    const lt = model.totalPts[model.totalPts.length - 1];
    series.push({
      id: 'cmp_total', name: 'Total', color: 'var(--ink)', labelOnly: true, noLine: true, noMarker: true, noDomain: true, noOffscale: true, pts: [], hidden: false,
      last: { t: lt.t, v: lt.v }, endV: lt.v, endLabel: { name: 'Total', value: fmtBn(lt.v, '$'), note: stackDate, soft: true }, shape: 'square', fmt: (v) => fmtBn(v, '$'), endMarker: false,
    });
  }

  function rowsStacked(model, t) {
    const mi = Math.round(t * 12);
    const rows = [];
    let total = 0;
    model.areas.forEach((a) => {
      if (a.hidden) return;
      const i = d3.bisectLeft(a.mis, mi);
      const p = a.pts[i];
      if (!p || p.mi !== mi || !(p.v > 0)) return;
      total += p.v;
      rows.push({ id: a.id, label: a.s.name, color: a.color, shape: a.s.shape, y: (p.y0 + p.y1) / 2, main: p.v, text: fmtBn(p.v, '$'), sub: '', tag: '' });
    });
    // before 2009 not every economy has data, so the count says how many the total adds up
    const word = rows.length === 5 ? 'Total of the five' : 'Total of ' + rows.length + ' shown';
    return { title: fmtPeriod(t, 'M'), rows, total: rows.length ? { label: word, text: fmtBn(total, '$') } : null, note: 'Definitions differ; not an official global M2.' };
  }

  /* ---------- history adapter ---------- */
  const GOLD_PTS = MH.series.goldPrice.data.slice().sort((a, b) => a.y - b.y);
  function priceAt(y) {
    const d = GOLD_PTS;
    if (y <= d[0].y) return d[0].v;
    if (y >= d[d.length - 1].y) return d[d.length - 1].v;
    let lo = 0, hi = d.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (d[mid].y <= y) lo = mid; else hi = mid; }
    const f = (y - d[lo].y) / (d[hi].y - d[lo].y);
    return Math.exp(Math.log(d[lo].v) + f * (Math.log(d[hi].v) - Math.log(d[lo].v)));
  }

  function histPoint(def, p, gold) {
    let usd, oz;
    if (def.unit === 't') { oz = (p.v * OZ_PER_TONNE) / 1e9; usd = oz * priceAt(p.y); }
    else { usd = p.v; oz = usd / priceAt(p.y); }
    return { t: p.y, v: gold ? oz : usd, usd, oz, raw: p.v, e: !!p.e, p: !!p.p, src: p.src, k: String(p.y) };
  }

  // A null row before the first point of a new definition splits the line at that break, as in the money view
  function splitAtBreaks(pts, breaks) {
    (breaks || []).forEach((b) => {
      const i = pts.findIndex((p) => p.v != null && p.t >= b.y);
      if (i > 0) pts.splice(i, 0, { t: pts[i].t, v: null, usd: null, oz: null, raw: null, e: false, p: false, k: pts[i].k });
    });
    return pts;
  }

  function histValueAt(s, yr) {
    const pts = s.pts;
    if (!pts.length || yr < pts[0].t || yr > pts[pts.length - 1].t) return null;
    let i = d3.bisectLeft(s.ts, yr);
    if (s.ts[i] === yr) {
      // skip the null row that marks a break: the reading belongs to the point after it
      let j = i;
      while (j < pts.length && pts[j].t === yr && pts[j].v == null) j++;
      const p = pts[j];
      if (!p || p.t !== yr) return null;
      return { v: p.v, usd: p.usd, oz: p.oz, raw: p.raw, tag: p.e ? 'estimate' : p.p ? 'latest reading' : '', exact: true, e: p.e };
    }
    const a = pts[i - 1], b = pts[i];
    if (!a || !b || a.v == null || b.v == null) return null; // no value between points across a break
    const f = (yr - a.t) / (b.t - a.t);
    const lerp = (x, y) => (x > 0 && y > 0 ? Math.exp(Math.log(x) + f * (Math.log(y) - Math.log(x))) : x + f * (y - x));
    return { v: lerp(a.v, b.v), usd: lerp(a.usd, b.usd), oz: lerp(a.oz, b.oz), raw: lerp(a.raw, b.raw), tag: 'interpolated', exact: false, e: true };
  }

  function buildHistory() {
    const gold = state.lens === 'gold';
    const shown = state.shown || new Set(DEFAULT_SHOWN);
    const ids = Object.keys(MH.series).filter((id) => id !== 'goldPrice');
    const sym = '$';
    const fmt = gold ? fmtOz : (v) => fmtBn(v, sym);
    const series = ids.map((id) => {
      const def = MH.series[id], meta = HMETA[id];
      const pts = splitAtBreaks(def.data.map((p) => histPoint(def, p, gold)), def.breaks);
      const s = {
        id, name: meta.name, short: meta.short, group: def.group, color: GROUP_COLOR[def.group], shape: meta.shape, pts, def, fmt,
        hidden: !shown.has(id), markAll: true, unit: def.unit, byYear: new Map(pts.filter((p) => p.v != null).map((p) => [p.t, p])),
      };
      return s;
    });
    const latest = d3.max(series, (s) => s.pts[s.pts.length - 1].t);
    series.forEach((s) => {
      const lp = s.pts[s.pts.length - 1];
      s.atEnd = (latest - lp.t) > 1.5;
      s.endLabel = { name: s.name, value: fmt(lp.v) };
    });
    // reference line in the gold lens
    if (gold) {
      const gs = MH.goldSupply.map((p) => ({ t: p.y, v: p.v, e: !!p.e, p: !!p.p, usd: null, oz: p.v, raw: p.v, src: p.src, k: String(p.y) }));
      const lp = gs[gs.length - 1];
      series.push({
        id: 'goldSupply', name: 'World gold stock', short: 'World gold stock', group: 'Gold', color: 'var(--ink-2)', shape: 'circle', pts: gs, ref: true, noMarker: true, noOffscale: true,
        fmt: fmtOz, hidden: false, endLabel: { name: 'World gold stock', value: fmtOz(lp.v) }, def: MH.goldSupplyInfo, byYear: new Map(gs.map((p) => [p.t, p])),
      });
    }
    // gold price panel
    const gdef = MH.series.goldPrice;
    const gpts = gdef.data.map((p) => ({ t: p.y, v: p.v, e: !!p.e, p: !!p.p, src: p.src, k: String(p.y), usd: p.v, oz: 1, raw: p.v }));
    const gprice = { id: 'goldPrice', name: 'Gold price', short: 'Gold price', group: 'Gold', color: GROUP_COLOR.Gold, shape: 'circle', pts: gpts, def: gdef, markAll: true, hidden: !state.goldPanel, fmt: (v) => '$' + d3.format(',.0f')(v), byYear: new Map(gpts.map((p) => [p.t, p])), unit: 'USD/oz' };
    const panel2 = {
      title: 'Gold price, USD per troy ounce, log scale (latest $' + d3.format(',.0f')(gpts[gpts.length - 1].v) + ')',
      titleShort: 'Gold, USD per oz, log scale',
      fmt: (v) => '$' + (v >= 10 ? d3.format(',.0f')(v) : v.toFixed(0)), series: [gprice], visible: !gold && state.goldPanel,
    };

    const breaks = [];
    let n = 0;
    series.forEach((s) => {
      (s.def.breaks || []).forEach((b) => { n += 1; breaks.push({ n, sids: [s.id], t: b.y, label: b.label, kind: 'break', kindLabel: 'Data break', seriesName: s.name, period: String(b.y) }); });
    });
    (gdef.breaks || []).forEach((b) => { n += 1; breaks.push({ n, sids: ['goldPrice'], t: b.y, label: b.label, kind: 'break', kindLabel: 'Data break', seriesName: 'Gold price', period: String(b.y) }); });

    const vis = series.filter((s) => !s.hidden && !s.ref);
    const log = state.scale === 'log';
    const model = {
      kind: 'history', view: 'history', series, breaks, panel2, lanes: true, eras: MH.eras, events: MH.events, tagFilter: state.tag, gold,
      yScale: log ? 'log' : 'linear', yKind: 'level', floor: gold ? OZ_FLOOR : USD_FLOOR, zeroLine: false, refY: [],
      xFull: [1250, 2028], xDefault: [1900, 2028], minSpan: 8,
      title: 'Long history of money, debt and gold' + (gold ? ', priced in gold' : ', in US dollars'),
      yFmt: gold ? fmtOz : (v) => fmtBn(v, sym),
      yTitle: gold ? 'Billions of troy ounces of gold, ' + (log ? 'log' : 'linear') + ' scale' : 'US dollars, ' + (log ? 'log' : 'linear') + ' scale',
      firstT: vis.length ? d3.min(vis, (s) => s.pts[0].t) : 1257, lastT: vis.length ? d3.max(vis, (s) => s.pts[s.pts.length - 1].t) : 2026,
    };
    model.snap = (t) => clamp(Math.round(t), Math.round(model.firstT), Math.round(model.lastT));
    model.step = (t, dir, big) => clamp(Math.round(t) + dir * (big ? 10 : 1), Math.round(model.firstT), Math.round(model.lastT));
    model.rowsAt = (t) => rowsHistory(model, t);
    model.table = (x0, x1) => tableHistory(model, x0, x1);
    return model;
  }

  function rowsHistory(model, t) {
    const yr = Math.round(t), rows = [];
    let interp = false;
    model.series.forEach((s) => {
      if (s.hidden || s.ref) return;
      const r = histValueAt(s, yr);
      if (!r) return;
      if (!r.exact) interp = true;
      let sub = '';
      if (r.exact) {
        if (model.gold) sub = fmtBn(r.usd, '$');
        else if (s.unit === 't') sub = d3.format(',')(r.raw) + ' tonnes at $' + d3.format(',.0f')(priceAt(yr)) + '/oz (' + (yr >= GOLD_PTS[GOLD_PTS.length - 1].y ? 'spot' : 'annual average') + ')';
      }
      rows.push({ id: s.id, label: s.name, color: s.color, shape: s.shape, dash: false, hollow: !!r.e, y: r.v, main: r.v, text: s.fmt(r.v), sub, tag: r.tag });
    });
    const out = { title: yearLabel(yr), rows, note: interp ? 'Values between data points are interpolated on a log scale.' : '' };
    if (model.panel2 && model.panel2.visible) {
      const g = model.panel2.series[0], r = histValueAt(g, yr);
      out.panel2 = r ? [{ id: 'goldPrice', label: 'Gold price (own axis)', color: g.color, shape: 'circle', hollow: !!r.e, y: r.v, text: '$' + d3.format(',.0f')(r.v) + '/oz', tag: r.tag }] : [];
    }
    return out;
  }

  function tableHistory(model, x0, x1) {
    const inWin = (s) => s.pts.some((p) => p.t >= x0 - 1e-9 && p.t <= x1 + 1e-9);
    const vis = model.series.filter((s) => !s.hidden && !s.ref && inWin(s));
    if (model.panel2 && model.panel2.visible && inWin(model.panel2.series[0])) vis.push(model.panel2.series[0]);
    const ySet = new Set();
    vis.forEach((s) => s.pts.forEach((p) => { if (p.t >= x0 - 1e-9 && p.t <= x1 + 1e-9) ySet.add(p.t); }));
    const years = Array.from(ySet).sort(d3.ascending);
    const unitOf = (s) => (s.id === 'goldPrice' ? 'USD/oz' : model.gold ? 'bn oz' : 'USD bn');
    const columns = vis.map((s) => s.name + ' (' + unitOf(s) + ')');
    const rows = years.map((y) => ({
      label: yearLabel(y),
      cells: vis.map((s) => { const p = s.byYear.get(y); return p ? { v: p.v, text: numStr(p.v) + (p.e ? ' e' : ''), est: !!p.e } : { v: null, text: '' }; }),
    }));
    return { caption: 'Values for the visible window, ' + rows.length + ' years. An "e" marks an estimate. Reserves in tonnes are converted at that year\'s average gold price (2026: spot), not the year-end price.', columns, rows, filename: 'money-history-' + state.lens + '.csv' };
  }

  /* ---------- page UI ---------- */
  const stageEl = qs('#stage');
  const legendEl = qs('#legend');
  const tableEl = qs('#tableview');
  const panelEl = qs('#panel');
  const liveEl = qs('#live');
  const tbEl = qs('#toolbar');

  let chart = null, model = null;
  let legendOpenMobile = false;
  let selEvent = null, hotEvent = null, baseNote = '', placedInfo = null, ptab = { money: 'explain', history: 'events' };
  let controls = [], presetBtns = [], helpPop = null, helpBtn = null, tableBtn = null, tbToggle = null, tbSummary = null;

  function keepFocus(container, fn) {
    const a = document.activeElement;
    const key = a && container.contains(a) ? a.getAttribute('data-fk') : null;
    fn();
    if (key) {
      const n = Array.from(container.querySelectorAll('[data-fk]')).find((x) => x.getAttribute('data-fk') === key);
      if (n) n.focus({ preventScroll: true });
    }
  }

  function keyIcon(color, shape, dash, hollow, w) {
    const s = sv('svg', { viewBox: '0 0 24 12', width: w || 24, height: 12, class: 'key', 'aria-hidden': 'true' });
    s.style.setProperty('--c', color);
    s.appendChild(sv('line', { x1: 1, y1: 6, x2: 23, y2: 6, class: dash ? 'dash' : '' }));
    s.appendChild(sv('path', { d: symPath(shape || 'circle', 0.75), transform: 'translate(12,6)', class: hollow ? 'hollow' : '' }));
    return s;
  }

  /* ---------- rebuild and chrome ---------- */
  function rebuild(o) {
    o = o || {};
    model = state.view === 'money' ? buildMoney() : buildHistory();
    liveEl.textContent = ''; // a readout announced for the previous model would be stale
    let x = null, reset = false;
    if (o.reset) reset = true;
    else if (o.x) x = o.x;
    // a window that is still the default follows the new model's default (the stacked comparison opens later)
    else if (state.x[state.view] === null) reset = true;
    else { const v = chart.getView(); x = [v.x0, v.x1]; }
    chart.setModel(model, { x: x || undefined, resetX: reset, ymanual: o.ymanual === undefined ? null : o.ymanual });
    if (reset) state.x[state.view] = null;
    state.ymanual = chart.getView().ymanual; // the chart drops a value domain that does not fit the axis
    renderChrome();
    writeHash();
  }

  function renderChrome() {
    stageEl.dataset.view = state.view;
    syncToolbar();
    renderHead();
    renderLegend();
    renderPanel();
    renderTableState();
    syncPresets();
    sizeStage();
  }

  // The history stage is as tall as the room left under the page chrome (toolbar, heading, legend), so its event
  // lanes and overview strip start on the first screen. The chart itself keeps the minimum its lanes need.
  function sizeStage() {
    if (state.view !== 'history' || window.innerWidth < 900 || stageEl.hidden) { stageEl.style.removeProperty('--stage-h'); return; }
    const key = qs('#keyrow');
    const top = stageEl.getBoundingClientRect().top + window.scrollY;
    const below = (key.hidden ? 0 : key.offsetHeight) + 20; // key row, plus the card's gap and padding
    const want = Math.max(0, Math.floor(window.innerHeight - top - below)) + 'px';
    if (stageEl.style.getPropertyValue('--stage-h') !== want) stageEl.style.setProperty('--stage-h', want);
  }

  /* ---------- toolbar ---------- */
  function segControl(label, options, get, set, opts) {
    opts = opts || {};
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    const btns = options.map((o) => {
      const b = h('button', { type: 'button', 'data-v': o.v, text: o.text, title: o.title || null, 'data-fk': 'seg-' + label + '-' + o.v });
      b.addEventListener('click', () => { if (!b.disabled) set(o.v); });
      seg.appendChild(b);
      return b;
    });
    // when options are unavailable the reason is also shown beside the label, since a title tooltip needs a hover
    const hintEl = h('span', { class: 'tool-hint' });
    const el = h('div', { class: 'tool' }, [h('span', { class: 'tool-label' }, [label, hintEl]), seg]);
    const ctl = {
      el,
      sync() {
        const cur = get();
        btns.forEach((b) => {
          b.setAttribute('aria-pressed', String(cur === b.dataset.v));
          b.disabled = opts.disabled ? !!opts.disabled(b.dataset.v) : false;
          if (opts.titleFor) b.title = opts.titleFor(b.dataset.v) || '';
        });
        const hint = opts.hintFor ? opts.hintFor() : '';
        hintEl.textContent = hint ? ' (' + hint + ')' : '';
        if (opts.visible) el.hidden = !opts.visible();
      },
    };
    controls.push(ctl);
    return el;
  }

  const effCcy = () => (state.econ === 'cmp' && state.measure === 'level' ? 'usd' : state.ccy);
  const effScale = () => (state.measure === 'yoy' || (state.econ === 'cmp' && state.cmp === 'stacked' && state.measure === 'level') ? 'linear' : state.scale);
  const effCmp = () => (state.measure === 'level' ? state.cmp : 'lines');

  function changeEconomy(v) {
    state.econ = v; state.x.money = null; state.ymanual = null; state.hid = new Set();
    rebuild({ reset: true });
  }

  // Phone width collapses the controls into a sheet; crossing the breakpoint in
  // either direction (rotation, window resize) re-decides it.
  const mqPhone = window.matchMedia('(max-width: 639px)');
  function syncPhone() {
    if (!tbToggle) return;
    tbEl.dataset.collapsed = mqPhone.matches ? '1' : '0';
    tbToggle.setAttribute('aria-expanded', String(!mqPhone.matches));
  }
  function onPhoneChange() {
    syncPhone();
    if (chart && model && state.view === 'history') renderLegend();
  }
  if (mqPhone.addEventListener) mqPhone.addEventListener('change', onPhoneChange);
  else if (mqPhone.addListener) mqPhone.addListener(onPhoneChange);

  function buildToolbar() {
    tbToggle = h('button', { class: 'btn tb-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'tb-body' }, [
      (tbSummary = h('span', { class: 'num' })), h('span', { text: 'Controls' }),
    ]);
    tbToggle.addEventListener('click', () => {
      const collapsed = tbEl.dataset.collapsed === '1';
      tbEl.dataset.collapsed = collapsed ? '0' : '1';
      tbToggle.setAttribute('aria-expanded', String(collapsed));
    });
    syncPhone();

    const body = h('div', { class: 'tb-body', id: 'tb-body' });

    const moneyRow = h('div', { class: 'tb-row', id: 'tb-money' });
    moneyRow.appendChild(segControl('Economy', [
      { v: 'us', text: 'US' }, { v: 'ea', text: 'Euro area' }, { v: 'uk', text: 'UK' }, { v: 'jp', text: 'Japan' }, { v: 'cn', text: 'China' }, { v: 'cmp', text: 'Compare' },
    ], () => state.econ, changeEconomy));
    moneyRow.appendChild(segControl('Measure', [
      { v: 'level', text: 'Level' }, { v: 'yoy', text: 'YoY %', title: 'Change on the same month a year earlier' }, { v: 'index', text: 'Indexed', title: INDEX_RULE_TITLE },
    ], () => state.measure, (v) => { state.measure = v; rebuild({}); }));
    moneyRow.appendChild(segControl('Currency', [{ v: 'local', text: 'Local' }, { v: 'usd', text: 'USD' }], effCcy,
      (v) => { state.ccy = v; rebuild({}); },
      {
        disabled: (v) => state.measure !== 'level' || (state.econ === 'cmp'),
        titleFor: (v) => (state.measure !== 'level' ? 'Currency applies to Level only' : state.econ === 'cmp' ? 'Compare uses US dollars' : ''),
        hintFor: () => (state.measure !== 'level' ? 'Level only' : state.econ === 'cmp' ? 'US dollars' : ''),
      }));
    moneyRow.appendChild(segControl('Scale', [{ v: 'log', text: 'Log', title: 'Equal vertical distance means equal percentage change' }, { v: 'linear', text: 'Linear' }], effScale,
      (v) => { state.scale = v; rebuild({}); },
      {
        disabled: () => state.measure === 'yoy' || effCmp() === 'stacked' && state.econ === 'cmp',
        titleFor: () => (state.measure === 'yoy' ? 'Growth rates use a linear axis' : state.econ === 'cmp' && effCmp() === 'stacked' ? 'Stacked areas need a linear axis' : ''),
        hintFor: () => (state.measure === 'yoy' ? 'linear only' : state.econ === 'cmp' && effCmp() === 'stacked' ? 'linear when stacked' : ''),
      }));
    moneyRow.appendChild(segControl('Compare as', [{ v: 'lines', text: 'Lines' }, { v: 'stacked', text: 'Stacked' }], effCmp,
      (v) => { state.cmp = v; rebuild({}); },
      {
        visible: () => state.econ === 'cmp', disabled: (v) => v === 'stacked' && state.measure !== 'level',
        titleFor: (v) => (v === 'stacked' && state.measure !== 'level' ? 'Stacking needs Level' : ''),
        hintFor: () => (state.measure !== 'level' ? 'stacking needs Level' : ''),
      }));

    const histRow = h('div', { class: 'tb-row', id: 'tb-history' });
    histRow.appendChild(segControl('Priced in', [{ v: 'usd', text: 'US dollars' }, { v: 'gold', text: 'Gold ounces', title: 'Divide every series by that year\'s gold price' }], () => state.lens, (v) => { state.lens = v; rebuild({}); }));
    histRow.appendChild(segControl('Scale', [{ v: 'log', text: 'Log' }, { v: 'linear', text: 'Linear' }], () => state.scale, (v) => { state.scale = v; rebuild({}); }));

    const row2 = h('div', { class: 'tb-row secondary' });
    const rangeTool = h('div', { class: 'tool' }, [h('span', { class: 'tool-label', text: 'Range' })]);
    const rangeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Range' });
    rangeTool.appendChild(rangeSeg);
    row2.appendChild(rangeTool);
    controls.push({ el: rangeTool, sync() { buildPresets(rangeSeg); } });

    const actions = h('div', { class: 'tool-actions' });
    actions.appendChild(h('button', { class: 'btn', type: 'button', text: 'Fit', title: 'Refit the value axis to the visible window', onclick: () => { chart.fit(); } }));
    actions.appendChild(h('button', { class: 'btn', type: 'button', text: 'Reset', title: 'Back to the default window', onclick: () => { chart.resetView(); } }));
    tableBtn = h('button', { class: 'btn', type: 'button', text: 'Data table', 'aria-pressed': 'false', onclick: () => { state.table = !state.table; renderTableState(); writeHash(); } });
    actions.appendChild(tableBtn);
    actions.appendChild(h('button', { class: 'btn', type: 'button', text: 'Download CSV', onclick: downloadCsv }));
    helpBtn = h('button', { class: 'btn', type: 'button', text: '?', 'aria-label': 'Help: zoom, pan and keyboard', 'aria-expanded': 'false', 'aria-controls': 'help-pop', onclick: toggleHelp });
    actions.appendChild(helpBtn);
    helpPop = buildHelp();
    row2.appendChild(actions);

    body.appendChild(moneyRow);
    body.appendChild(histRow);
    body.appendChild(row2);
    // a panel over the toolbar's lower edge (see macro.css), so opening it does not move the chart
    body.appendChild(helpPop);
    tbEl.appendChild(tbToggle);
    tbEl.appendChild(body);
  }

  function buildHelp() {
    const dl = h('dl');
    [
      ['Scroll or pinch', 'Zoom time, anchored at the pointer'],
      ['Shift + scroll', 'Zoom the value axis'],
      ['Drag', 'Pan time (Shift + drag pans the value axis)'],
      ['Double-click', 'Reset the view'],
      ['Strip below', 'Drag the highlighted window or its edges'],
      ['Arrow keys', 'Focus the chart, then move the readout (Shift = 12 steps)'],
      ['+ and -', 'Zoom, with the chart focused. 0 resets, Esc hides the readout'],
      ['Legend', 'Click to show or hide, double-click to isolate, hover to highlight'],
    ].forEach((r) => { dl.appendChild(h('div', null, [h('dt', { text: r[0] }), h('dd', { text: r[1] })])); });
    const pop = h('div', { class: 'popover', id: 'help-pop', role: 'region', 'aria-label': 'Chart help', hidden: true }, [
      h('h3', { text: 'Moving around the chart' }), dl,
      h('p', { class: 'chart-note', text: 'The address bar keeps your view, so you can copy it to share.' }),
    ]);
    return pop;
  }
  function toggleHelp() {
    const open = helpPop.hidden;
    helpPop.hidden = !open;
    helpBtn.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', (e) => {
    if (!helpPop.hidden && !helpPop.contains(e.target) && e.target !== helpBtn) { helpPop.hidden = true; helpBtn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpPop && !helpPop.hidden) { helpPop.hidden = true; helpBtn.setAttribute('aria-expanded', 'false'); helpBtn.focus(); }
  });

  function presetsFor() {
    const end = model.xFull[1];
    if (state.view === 'history') {
      return [{ id: 'all', text: 'All', a: model.xFull[0], b: end }, { id: '1694', text: '1694+', a: 1694, b: end }, { id: '1900', text: '1900+', a: 1900, b: end },
        { id: '1971', text: '1971+', a: 1971, b: end }, { id: '2008', text: '2008+', a: 2008, b: end }];
    }
    const last = model.lastT;
    return [{ id: 'all', text: 'All', a: model.xFull[0], b: end }, { id: '1980', text: '1980+', a: 1980, b: end }, { id: '2000', text: '2000+', a: 2000, b: end },
      { id: '2008', text: '2008+', a: 2008, b: end }, { id: '10y', text: '10Y', a: last - 10, b: end }, { id: '5y', text: '5Y', a: last - 5, b: end }];
  }
  function buildPresets(seg) {
    seg.textContent = '';
    if (!model) return;
    presetBtns = presetsFor().map((p) => {
      const b = h('button', { type: 'button', text: p.text, 'data-fk': 'preset-' + p.id, onclick: () => chart.setView(p.a, p.b, true) });
      b.preset = p;
      // the stacked total only has every economy from its start month; a range that opens earlier shows a near-empty stack
      const early = model.stacked && model.stackStartT != null && p.id !== 'all' && p.a < model.stackStartT - 0.1;
      if (early) { b.disabled = true; b.title = 'The stack has every economy shown only from ' + fmtPeriod(model.stackStartT, 'M'); }
      seg.appendChild(b);
      return b;
    });
  }
  // The preset that matches the window is pressed; All matches any window that spans the whole data extent
  function syncPresets() {
    const v = chart.getView();
    let best = null, bestD = Infinity;
    presetBtns.forEach((b) => {
      const p = b.preset;
      const tolA = p.id === 'all' ? 0.3 : 0.1;
      if (Math.abs(v.x0 - p.a) >= tolA || Math.abs(v.x1 - p.b) >= 0.2) return;
      const d = Math.abs(v.x0 - p.a) + Math.abs(v.x1 - p.b);
      if (d < bestD) { best = b; bestD = d; }
    });
    presetBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === best)));
  }

  function syncToolbar() {
    const money = state.view === 'money';
    tbEl.dataset.view = state.view; // the history toolbar is one row, the money toolbar two (see macro.css)
    qs('#tb-money').hidden = !money;
    qs('#tb-history').hidden = money;
    controls.forEach((c) => c.sync());
    syncPresets();
    tableBtn.setAttribute('aria-pressed', String(state.table));
    const pretty = { level: 'Level', yoy: 'YoY %', index: 'Indexed' };
    tbSummary.textContent = money
      ? (state.econ === 'cmp' ? 'Compare' : ECON[state.econ].short) + ', ' + pretty[state.measure] + ', ' + (effScale() === 'log' ? 'log' : 'linear')
      : 'Long history, ' + (state.lens === 'gold' ? 'gold ounces' : 'US dollars') + ', ' + (state.scale === 'log' ? 'log' : 'linear');
  }

  /* ---------- chart head, legend, key ---------- */
  function renderHead() {
    const title = qs('#chart-title'), sub = qs('#chart-sub'), ladder = qs('#ladder'), note = qs('#chart-note'), ladderNote = qs('#ladder-note');
    ladder.textContent = '';
    ladderNote.textContent = '';
    if (state.view === 'history') {
      title.textContent = 'Money, debt and gold since 1257';
      sub.textContent = state.lens === 'gold'
        ? 'Every series divided by that year\'s gold price, so the axis counts ounces of gold. Compare each line with the world\'s above-ground gold stock.'
        : 'Selected series in US dollars on one ' + (state.scale === 'log' ? 'log' : 'linear') + ' axis; gold has its own log panel because it is a price per ounce, not a stock in billions.';
      baseNote = 'Dashed segments and hollow markers are estimates. Numbered ticks are breaks in a series, where the line is split; the series cards in the panel explain each one.';
      note.textContent = baseNote;
      return;
    }
    const m = state.measure, log = effScale() === 'log' ? 'log' : 'linear';
    if (state.econ === 'cmp') {
      title.textContent = 'Five economies compared';
      sub.textContent = state.cmp === 'stacked' && m === 'level'
        ? 'Headline broad money of each economy, stacked in US dollars. Five-economy total, definitions differ; not an official global M2.'
        : 'Headline broad money of each economy: US M2, euro-area M3, UK M4ex, Japan M3, China M2. ' + (m === 'level' ? 'US dollars at month-end exchange rates.' : m === 'yoy' ? 'Local-currency growth over 12 months.' : 'Local currency, ' + INDEX_RULE + '.');
      baseNote = 'Definitions differ across economies, so levels are not like for like. Euro-area USD starts in 1999, Japan M3 in 2003, China M2 in 2008, UK M4ex in 2009.' +
        (model.stacked ? ' The stack ends at ' + fmtPeriod(model.stackEndT, 'M') + ', the latest month with data for every economy shown.' +
          (model.stackStartT != null ? ' The window opens at ' + fmtPeriod(model.stackStartT, 'M') + ', when every economy shown has data; earlier totals add up fewer economies.' : '')
          : model.breaks.length ? ' Numbered ticks mark breaks in a series; the Breaks tab explains each one.' : '');
    } else {
      const E = ECON[state.econ];
      title.textContent = E.name;
      sub.textContent = (m === 'level' ? 'Level in ' + (effCcy() === 'usd' ? 'US dollars' : E.ccyName) + ', ' + log + ' scale. ' : m === 'yoy' ? 'Growth on the same month a year earlier, with the zero line marked. ' : 'Indexed: ' + INDEX_RULE + ', ' + log + ' scale. ') +
        'Lines fade as the measure gets wider: the narrowest aggregate stands out most.';
      const unusual = [];
      COVER[state.econ].forEach((c) => {
        const li = h('li', { 'data-st': c[3], title: c[2] }, [h('b', { text: c[0] }), h('span', { class: 'st', text: c[1] })]);
        ladder.appendChild(li);
        if (c[3] === 'pub') return;
        const last = unusual[unusual.length - 1];
        if (last && last.text === c[2]) last.names.push(c[0]); else unusual.push({ names: [c[0]], text: c[2] });
      });
      // the same explanations as the pill tooltips, as text a keyboard or touch user can read
      ladderNote.textContent = unusual.map((u) => u.names.join(', ') + ': ' + u.text).join('. ') + (unusual.length ? '.' : '');
      const notes = [];
      if (effCcy() === 'usd' && state.econ !== 'us' && m === 'level') notes.push('USD values use month-end exchange rates' + (state.econ === 'ea' ? ', from 1999' : '') + '.');
      if (state.econ === 'ea') notes.push(m === 'yoy'
        ? 'Growth rates are the ECB\'s own, which remove the steps when members join or items are reclassified.'
        : 'Euro-area levels step up when members join or items are reclassified; Greece in 2001 is marked.' + (m === 'level' ? ' Year-on-year growth uses the ECB\'s own rates, which remove those steps.' : ''));
      if (state.econ === 'cn') notes.push(m === 'yoy'
        ? 'Growth rates are the People\'s Bank of China\'s published same-basis rates, which remove the Oct 2011 widening of the M2 scope.'
        : 'M2 steps up 3.7% in Oct 2011 when the People\'s Bank of China widened its scope (marked).');
      if (state.econ === 'us' && state.extras.has('wb') && m === 'level') notes.push('IMF/World Bank broad money is a wider, year-end measure than M2 (and not the old Fed M3), so it sits above M2.');
      if (m === 'index') {
        notes.push('Earlier-definition series are hidden because an index needs one definition.');
        const chained = model.series.some((s) => !s.link && s.S && s.S.breaks.some((b) => b.kind === 'redefinition'));
        if (chained) notes.push('A series with a definition change inside it (US M1 in 2020, China M1 in 2024) is chain-linked: the step is removed, so the index shows growth within each definition.');
      }
      if (model.breaks.length && !model.stacked) notes.push('Numbered ticks mark breaks in a series; the Breaks tab explains each one.');
      baseNote = notes.join(' ');
    }
    note.textContent = baseNote;
  }

  function chipEl(c) {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(c.pressed), 'data-fk': 'chip-' + c.id, title: c.title || null, 'aria-label': c.aria || null },
      [keyIcon(c.color, c.shape, c.dash, false), h('span', { text: c.label })]);
    if (c.disabled) { b.setAttribute('aria-disabled', 'true'); b.addEventListener('click', (e) => e.preventDefault()); }
    else {
      b.addEventListener('click', c.toggle);
      b.addEventListener('dblclick', c.solo);
    }
    b.addEventListener('mouseenter', () => chart.setHover(c.ids));
    b.addEventListener('mouseleave', () => chart.setHover(null));
    b.addEventListener('focus', () => chart.setHover(c.ids));
    b.addEventListener('blur', () => chart.setHover(null));
    return b;
  }

  function renderLegend() {
    keepFocus(legendEl, () => {
      legendEl.textContent = '';
      if (state.view === 'money') legendMoney();
      else legendHistory();
    });
  }

  function legendMoney() {
    const row = h('div', { class: 'legend-row' });
    const mains = model.series.filter((s) => s.role === 'main');
    const allMain = mains.map((s) => s.id);
    mains.forEach((s) => {
      const ids = [s.id].concat(model.series.filter((x) => x.role === 'hist' && x.S.def.continues === s.id).map((x) => x.id));
      row.appendChild(chipEl({
        id: s.id, label: s.name, color: s.color, shape: s.shape, ids, pressed: !state.hid.has(s.id),
        toggle: () => { if (state.hid.has(s.id)) state.hid.delete(s.id); else state.hid.add(s.id); rebuild({}); },
        solo: () => {
          const alone = allMain.every((id) => id === s.id || state.hid.has(id)) && !state.hid.has(s.id);
          state.hid = alone ? new Set() : new Set(allMain.filter((id) => id !== s.id));
          rebuild({});
        },
      }));
    });
    legendEl.appendChild(row);
    if (state.econ === 'us') {
      const ex = h('div', { class: 'legend-row' });
      const mk = (key, label, color, shape, disabled, title) => chipEl({
        // a chip that is unavailable for this measure is not "on", even though the choice is remembered
        id: 'ex-' + key, label, color, shape, ids: [], pressed: state.extras.has(key) && !disabled, disabled, title,
        toggle: () => { if (state.extras.has(key)) state.extras.delete(key); else state.extras.add(key); rebuild({}); }, solo: () => {},
      });
      ex.appendChild(mk('div', 'Divisia M4 (private index, YoY only)', 'var(--ink)', 'square', state.measure !== 'yoy', state.measure !== 'yoy' ? 'Divisia is an index, not dollars, so it appears only in the YoY % view' : 'CFS Divisia M4 index'));
      ex.appendChild(mk('wb', 'IMF/World Bank broad money (annual)', 'var(--ink-2)', 'plus', state.measure === 'index', 'Wider than M2 and not the old Fed M3'));
      legendEl.appendChild(ex);
    }
  }

  function legendHistory() {
    const shownSet = () => state.shown || (state.shown = new Set(DEFAULT_SHOWN));
    const byGroup = {};
    model.series.filter((s) => !s.ref).forEach((s) => { (byGroup[s.group] = byGroup[s.group] || []).push(s); });
    GROUP_ORDER.forEach((g) => {
      const list = byGroup[g];
      if (!list) return;
      const head = h('div', { class: 'lgroup-head' }, [h('i'), h('span', { text: g, id: 'lg-' + g })]);
      head.firstChild.style.setProperty('--c', GROUP_COLOR[g]);
      head.appendChild(h('button', { type: 'button', text: 'All', 'aria-label': g + ': show all', 'data-fk': 'g-all-' + g, onclick: () => { const st = shownSet(); list.forEach((s) => st.add(s.id)); rebuild({}); } }));
      head.appendChild(h('button', { type: 'button', text: 'None', 'aria-label': g + ': hide all', 'data-fk': 'g-none-' + g, onclick: () => { const st = shownSet(); list.forEach((s) => st.delete(s.id)); rebuild({}); } }));
      const chips = h('div', { class: 'lgroup-chips' });
      list.forEach((s) => chips.appendChild(chipEl({
        id: s.id, label: s.short, color: s.color, shape: s.shape, ids: [s.id], pressed: !s.hidden,
        aria: g + ' ' + s.short, // 'Debt' and 'GDP' repeat across groups; the name must say whose
        title: s.def.label + (s.def.unit === 't' ? ' (tonnes, converted to dollars at the annual average gold price)' : ''),
        toggle: () => { const st = shownSet(); if (st.has(s.id)) st.delete(s.id); else st.add(s.id); rebuild({}); },
        solo: () => { const st = shownSet(); const only = st.size === 1 && st.has(s.id); state.shown = only ? new Set(DEFAULT_SHOWN) : new Set([s.id]); rebuild({}); },
      })));
      legendEl.appendChild(h('div', { class: 'lgroup', role: 'group', 'aria-labelledby': 'lg-' + g }, [head, chips]));
    });
    const gold = h('div', { class: 'lgroup', role: 'group', 'aria-labelledby': 'lg-Gold' }, [
      (() => { const hd = h('div', { class: 'lgroup-head' }, [h('i'), h('span', { text: 'Gold', id: 'lg-Gold' })]); hd.firstChild.style.setProperty('--c', GROUP_COLOR.Gold); return hd; })(),
      h('div', { class: 'lgroup-chips' }, [chipEl({
        id: 'goldPrice', label: 'Price, own axis', aria: 'Gold price, own axis', color: GROUP_COLOR.Gold, shape: 'circle', ids: ['goldPrice'], pressed: state.goldPanel && state.lens === 'usd', disabled: state.lens === 'gold',
        title: state.lens === 'gold' ? 'In the gold lens the price is the denominator, so it is not drawn' : 'Show the gold price in its own panel',
        toggle: () => { state.goldPanel = !state.goldPanel; rebuild({}); }, solo: () => {},
      })]),
    ]);
    legendEl.appendChild(gold);
    if (mqPhone.matches) {
      const wrap = h('div', { class: 'legend' });
      Array.from(legendEl.children).forEach((k) => wrap.appendChild(k));
      const total = model.series.filter((x) => !x.ref).length;
      const on = model.series.filter((x) => !x.ref && !x.hidden).length;
      const det = h('details', { class: 'legend-details' }, [h('summary', { text: 'Series: ' + on + ' of ' + total + ' shown' }), wrap]);
      det.open = legendOpenMobile;
      det.addEventListener('toggle', () => { legendOpenMobile = det.open; });
      legendEl.textContent = '';
      legendEl.appendChild(det);
    }
  }

  /* ---------- side panel ---------- */
  function sectionsFor() {
    return state.view === 'money'
      ? [{ id: 'explain', tab: 'M0 to M5', title: 'What are M0 to M5?' }, { id: 'series', tab: 'Series', title: 'Series, sources and notes' },
        { id: 'breaks', tab: 'Breaks', title: 'Breaks and gaps' }, { id: 'data', tab: 'Data notes', title: 'About the data' }]
      : [{ id: 'events', tab: 'Events', title: 'Monetary system events' }, { id: 'series', tab: 'Series', title: 'Series, sources and notes' },
        { id: 'data', tab: 'Conventions', title: 'Conventions' }];
  }

  function renderPanel() {
    const secs = sectionsFor();
    if (!secs.some((s) => s.id === ptab[state.view])) ptab[state.view] = secs[0].id;
    const tabs = qs('#ptabs'), body = qs('#psecs');
    const scrollTop = panelEl.scrollTop;
    // the panel is rebuilt from scratch, so remember which disclosures were open
    const openKeys = new Set(Array.from(body.querySelectorAll('details[open][data-dk]')).map((n) => n.getAttribute('data-dk')));
    keepFocus(panelEl, () => {
      tabs.textContent = '';
      body.textContent = '';
      secs.forEach((s) => {
        const t = h('button', { class: 'ptab', role: 'tab', id: 'ptab-' + s.id, type: 'button', text: s.tab, 'aria-selected': String(ptab[state.view] === s.id), 'aria-controls': 'psec-' + s.id, 'data-fk': 'ptab-' + s.id });
        t.addEventListener('click', () => { ptab[state.view] = s.id; renderPanelTabs(); });
        tabs.appendChild(t);
        const sec = h('section', { class: 'psec' + (ptab[state.view] === s.id ? ' active' : ''), id: 'psec-' + s.id, role: 'tabpanel', 'aria-labelledby': 'ptab-' + s.id, 'data-sec': s.id });
        sec.appendChild(h('h2', { text: s.title }));
        body.appendChild(sec);
        const fill = { explain: panelExplain, series: panelSeries, breaks: panelBreaks, data: state.view === 'money' ? panelDataNotes : panelConventions, events: panelEvents }[s.id];
        fill(sec);
      });
      body.querySelectorAll('details[data-dk]').forEach((n) => { if (openKeys.has(n.getAttribute('data-dk'))) n.open = true; });
    });
    panelEl.scrollTop = scrollTop;
  }
  function renderPanelTabs() {
    qs('#ptabs').querySelectorAll('.ptab').forEach((t) => t.setAttribute('aria-selected', String(t.id === 'ptab-' + ptab[state.view])));
    qs('#psecs').querySelectorAll('.psec').forEach((s) => s.classList.toggle('active', s.id === 'psec-' + ptab[state.view]));
  }
  const mqCompact = window.matchMedia('(max-width: 1099px)');
  function syncCompact() { panelEl.dataset.compact = mqCompact.matches ? '1' : '0'; }
  if (mqCompact.addEventListener) mqCompact.addEventListener('change', syncCompact);
  syncCompact();

  function panelExplain(sec) {
    sec.appendChild(h('p', { class: 'plain' }, [
      h('b', { text: 'M0 or the monetary base, M1 and M2' }), ' are official almost everywhere. ',
      h('b', { text: 'M3' }), ' is official for the euro area and Japan; the Fed stopped publishing US M3 in March 2006 (last observation February 2006). ',
      h('b', { text: 'M4' }), ' is official only in the UK. ',
      h('b', { text: 'M5' }), ' is not an official aggregate at the Fed, the ECB, the Bank of England, the Bank of Japan or the People\'s Bank of China, so it is not charted. ',
      'Where a wider measure does exist it appears under its own name.',
    ]));
    const t = h('table', { class: 'cover' });
    const thead = h('thead'), hr = h('tr', null, [h('th', { text: '', scope: 'col' })]);
    ECON_ORDER.forEach((k) => hr.appendChild(h('th', { scope: 'col', text: ECON[k].short === 'Euro area' ? 'EA' : ECON[k].short === 'Japan' ? 'JP' : ECON[k].short === 'China' ? 'CN' : ECON[k].short })));
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = h('tbody');
    ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].forEach((name, i) => {
      const tr = h('tr', null, [h('th', { scope: 'row', text: name })]);
      ECON_ORDER.forEach((k) => tr.appendChild(h('td', { text: coverWord(COVER[k][i]), title: COVER[k][i][2] })));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    sec.appendChild(t);
    sec.appendChild(h('p', { class: 'chart-note', text: 'Part: euro-area currency in circulation only. Cash: China\'s M0 excludes reserves. Ended: US M3. Private: the CFS Divisia M4 index, not an official figure. Japan also publishes L, which is wider than M3 but is not an M-number.' }));
    // every cell that is not a plain "Yes", spelled out for keyboard and touch users (the cells also carry a tooltip)
    const cellNotes = h('ul', { class: 'cover-notes' });
    ECON_ORDER.forEach((k) => {
      COVER[k].forEach((c) => { if (c[3] !== 'pub') cellNotes.appendChild(h('li', null, [h('b', { text: ECON[k].short + ' ' + c[0] + ': ' }), c[2]])); });
    });
    sec.appendChild(h('details', { class: 'cover-detail', 'data-dk': 'cover-notes' }, [h('summary', { text: 'What the table entries mean' }), cellNotes]));
    const defs = h('div', { class: 'defs' });
    MS.definitions.forEach((d) => {
      const body = h('div', { class: 'dbody' }, [
        h('p', { text: d.definition }),
        h('p', null, [h('b', { text: 'Where it is official: ' }), d.official_where]),
        h('p', null, [h('b', { text: 'Caveats: ' }), d.caveats]),
      ]);
      defs.appendChild(h('details', { 'data-dk': 'def-' + d.name }, [h('summary', null, [d.name, h('small', { text: d.short })]), body]));
    });
    sec.appendChild(h('div', { style: 'margin-top:12px' }, [defs]));
  }

  function srcLine(def, url) {
    const kids = [h('b', { text: 'Source: ' }), def.source || ''];
    if (url && /^https?:/.test(url)) { kids.push(' '); kids.push(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: '(open)' })); }
    return h('div', { class: 'scard-meta' }, kids);
  }

  function seriesCard(opts) {
    const card = h('div', { class: 'scard' });
    const head = h('div', { class: 'scard-head' });
    head.appendChild(keyIcon(opts.color, opts.shape, opts.dash, false));
    head.appendChild(h('span', { class: 'scard-name', text: opts.name }));
    (opts.badges || []).forEach((b) => head.appendChild(h('span', { class: 'badge', text: b })));
    card.appendChild(head);
    if (opts.latest) card.appendChild(h('div', { class: 'scard-latest' }, [opts.latest[0], ' ', h('span', { text: opts.latest[1] })]));
    (opts.meta || []).forEach((m) => card.appendChild(h('div', { class: 'scard-meta' }, [h('b', { text: m[0] + ': ' }), m[1]])));
    if (opts.source) card.appendChild(srcLine(opts.source.def, opts.source.url));
    card.appendChild(h('div', { class: 'scard-meta' }, [h('b', { text: 'Retrieved: ' }), opts.retrieved || 'n/a']));
    if (opts.notes) card.appendChild(h('details', { 'data-dk': 'notes-' + (opts.key || opts.name) }, [h('summary', { text: 'Notes' }), h('div', { class: 'nbody', text: opts.notes })]));
    return card;
  }

  function panelSeries(sec) {
    if (state.view === 'money') {
      const wrap = h('div', { class: 'scards' });
      model.series.filter((s) => !s.link && !s.labelOnly).forEach((s) => {
        const S = s.S, def = S.def, E = ECON[def.economy];
        const badges = [def.kind === 'historical' ? 'earlier definition' : def.kind === 'index' ? 'index' : 'official'];
        if (S.disc != null) badges.push('discontinued ' + Math.floor(S.disc));
        if (s.hidden) badges.push('hidden');
        const lp = S.last;
        const latest = def.unit === 'index'
          ? [fmtIdx(lp.loc), fmtPeriod(lp.t, def.frequency) + ', index (Jan 1967 = 100)']
          : [fmtBn(lp.loc, E.sym), fmtPeriod(lp.t, def.frequency) + (lp.usd != null && def.economy !== 'us' ? ', about ' + fmtBn(lp.usd, '$') : '')];
        wrap.appendChild(seriesCard({
          key: s.id, name: s.name, color: s.color, shape: s.shape, dash: s.hist, badges, latest,
          meta: [['Coverage', fmtPeriod(S.first.t, def.frequency) + ' to ' + fmtPeriod(lp.t, def.frequency) + ', ' + ({ M: 'monthly', Q: 'quarterly', A: 'annual' }[def.frequency])]],
          source: { def, url: def.url }, retrieved: def.retrieved, notes: def.notes,
        }));
      });
      sec.appendChild(wrap);
      return;
    }
    const shown = [], rest = [];
    const all = model.series.filter((s) => !s.ref).concat([model.panel2.series[0]]);
    all.forEach((s) => ((s.hidden && s.id !== 'goldPrice') || (s.id === 'goldPrice' && (!model.panel2.visible)) ? rest : shown).push(s));
    const mk = (s) => {
      const def = s.def, lp = s.pts[s.pts.length - 1];
      const est = s.pts.filter((p) => p.e).length;
      const badges = [def.group, def.unit];
      if (est) badges.push(est + ' estimated');
      // each break keeps the number of its tick on the chart, so a tick (or Enter on it) leads to its entry here
      const mine = model.breaks.filter((b) => b.sids[0] === s.id);
      const brk = mine.length ? h('ol', { class: 'blist inline' }, mine.map((b) => h('li', { 'data-n': String(b.n) }, [h('span', { class: 'bn', text: String(b.n) }),
        h('div', null, [b.period + ': ' + b.label])]))) : null;
      const meta = [['Coverage', yearLabel(s.pts[0].t) + ' to ' + yearLabel(lp.t) + ', ' + s.pts.filter((p) => p.v != null).length + ' points']];
      if (brk) meta.push(['Data break', brk]);
      return seriesCard({
        key: s.id, name: s.name, color: s.color, shape: s.shape, badges,
        latest: [def.unit === 't' ? d3.format(',')(lp.raw) + ' t' : def.unit === 'USD/oz' ? '$' + d3.format(',.0f')(lp.v) + '/oz' : fmtBn(lp.usd, '$'), yearLabel(lp.t) + (lp.p ? ' (latest reading)' : '')],
        meta, source: { def, url: null }, retrieved: def.retrieved, notes: def.notes,
      });
    };
    const wrap = h('div', { class: 'scards' });
    shown.forEach((s) => wrap.appendChild(mk(s)));
    if (!shown.length) wrap.appendChild(h('p', { class: 'empty', text: 'No series are shown. Turn some on in the legend.' }));
    sec.appendChild(wrap);
    if (model.gold) {
      const gi = MH.goldSupplyInfo;
      sec.appendChild(h('div', { class: 'scards', style: 'margin-top:12px' }, [seriesCard({
        key: 'goldSupply', name: gi.label, color: 'var(--ink-2)', shape: 'circle', badges: ['reference line', gi.unit],
        latest: [fmtOz(MH.goldSupply[MH.goldSupply.length - 1].v), yearLabel(MH.goldSupply[MH.goldSupply.length - 1].y)],
        source: { def: { source: gi.source }, url: null }, retrieved: gi.retrieved, notes: gi.notes,
      })]));
    }
    if (rest.length) {
      const det = h('details', { style: 'margin-top:12px', 'data-dk': 'rest' }, [h('summary', { class: 'plain', text: 'Series not shown (' + rest.length + ')' })]);
      const w2 = h('div', { class: 'scards', style: 'margin-top:8px' });
      rest.forEach((s) => w2.appendChild(mk(s)));
      det.appendChild(w2);
      sec.appendChild(det);
    }
  }

  function panelBreaks(sec) {
    const list = h('ol', { class: 'blist' });
    model.breaks.forEach((b) => {
      list.appendChild(h('li', { 'data-n': String(b.n) }, [h('span', { class: 'bn', text: String(b.n) }),
        h('div', null, [h('b', { text: b.seriesName }), ', ' + (b.period.length > 4 ? fmtPeriod(b.t, 'M') : b.period), h('small', { text: b.kindLabel + ': ' + b.label })])]));
    });
    model.series.filter((s) => s.disc != null && !s.link).forEach((s) => {
      const br = s.S.breaks.find((b) => b.kind === 'discontinuation');
      list.appendChild(h('li', null, [h('span', { class: 'bn hollow', text: '○', 'aria-label': 'Ends' }),
        h('div', null, [h('b', { text: s.name }), ', last observation ' + fmtPeriod(s.disc, 'M'), h('small', { text: br ? br.label : 'Series discontinued' })])]));
    });
    if (!list.children.length) sec.appendChild(h('p', { class: 'empty', text: 'No breaks or discontinuations among the series shown.' }));
    else {
      sec.appendChild(h('p', { class: 'chart-note', style: 'margin-bottom:10px', text: state.view === 'money'
        ? 'Numbers match the ticks on the chart. Lines are split at a definition change, never joined across it. A hollow circle is a series that ended.'
        : 'Numbers match the ticks on the chart. The data on either side of a break come from different definitions or sources.' }));
      sec.appendChild(list);
    }
  }

  function panelDataNotes(sec) {
    const ul = h('ul', { class: 'blist', style: 'gap:8px' });
    MS.notes.forEach((n) => ul.appendChild(h('li', { style: 'grid-template-columns:1fr' }, [h('span', { text: n })])));
    sec.appendChild(ul);
    sec.appendChild(h('p', { class: 'chart-note', style: 'margin-top:10px', text: 'Newest download in this data: ' + MS.generated + '. Rebuild with tools/fetch_money_supply.py; see tools/README.md for sources and the FRED note.' }));
  }

  function panelConventions(sec) {
    sec.appendChild(h('p', { class: 'plain', text: MH.conventions }));
    sec.appendChild(h('p', { class: 'plain', text: 'Reserves held in tonnes of gold are converted to dollars as tonnes x 32,150.7 oz x that year\'s gold price. That price is the annual average (the spot price of 20 Oct 2026 for 2026), while the tonnes are a year-end holding, so a year-on-year change in the dollar value mixes the change in tonnes with a difference between the average and the year-end price. In the gold lens every dollar series is divided by that year\'s gold price, so the axis is billions of troy ounces.' }));
    sec.appendChild(h('p', { class: 'plain', text: 'Gold before 1971 is an official or mint price, not a market average. Estimates come from sources that are unverified or from model fits; each point\'s source is in the data file.' }));
  }

  function panelEvents(sec) {
    const tags = Array.from(new Set(MH.events.map((e) => e.tag))).sort();
    const sel = h('select', { id: 'ev-tag', 'aria-label': 'Filter events by tag', 'data-fk': 'ev-tag' }, [h('option', { value: '', text: 'All tags' })].concat(tags.map((t) => h('option', { value: t, text: t }))));
    sel.value = state.tag;
    // the tag only dims markers on the chart and filters the list, so neither the model nor this panel is rebuilt
    sel.addEventListener('change', () => {
      state.tag = sel.value;
      model.tagFilter = state.tag;
      chart.redraw();
      renderEventList();
      writeHash();
    });
    const chk = h('input', { type: 'checkbox', id: 'ev-ov', 'data-fk': 'ev-ov' });
    chk.checked = state.onlyView;
    chk.addEventListener('change', () => { state.onlyView = chk.checked; renderEventList(); writeHash(); });
    sec.appendChild(h('div', { class: 'evtools' }, [
      h('label', null, ['Tag ', sel]),
      h('label', null, [chk, 'Only the visible range']),
    ]));
    sec.appendChild(h('div', { class: 'evcount', id: 'ev-count', 'aria-live': 'polite' }));
    sec.appendChild(h('ul', { class: 'evlist', id: 'ev-list' }));
    renderEventList();
  }

  function renderEventList() {
    const list = qs('#ev-list'), count = qs('#ev-count');
    if (!list || state.view !== 'history') return;
    const v = chart.getView();
    const items = MH.events.map((e, i) => ({ e, i })).filter((d) => (!state.tag || d.e.tag === state.tag) && (!state.onlyView || (d.e.year >= v.x0 && d.e.year <= v.x1)));
    keepFocus(list, () => {
      list.textContent = '';
      items.forEach((d) => {
        const e = d.e;
        const li = h('li', { class: 'evcard' + (selEvent === d.i ? ' sel' : '') + (hotEvent === d.i ? ' hot' : ''), 'data-i': String(d.i) });
        const main = h('button', { class: 'evmain', type: 'button', 'data-fk': 'ev-main-' + d.i, 'aria-label': e.year + ': ' + e.name + '. Pan the chart to this year.' }, [
          h('div', { class: 'evrow' }, [h('span', { class: 'evyear', text: yearLabel(e.year) }), h('span', { class: 'evname', text: e.name }), h('span', { class: 'evtag', text: e.tag })]),
          h('div', { class: 'evdesc', text: e.desc }),
        ]);
        main.addEventListener('click', () => { selectEvent(d.i, true); });
        li.appendChild(main);
        li.appendChild(h('div', { class: 'evfoot' }, [h('button', { class: 'evdetail', type: 'button', text: 'Details', 'data-fk': 'ev-det-' + d.i, 'aria-label': 'Details: ' + e.name, onclick: (ev) => openDialog(d.i, ev.currentTarget) })]));
        li.addEventListener('pointerenter', () => { hotEvent = d.i; chart.setHotEvent(d.i); li.classList.add('hot'); });
        li.addEventListener('pointerleave', () => { hotEvent = null; chart.setHotEvent(null); li.classList.remove('hot'); });
        list.appendChild(li);
      });
    });
    count.textContent = items.length + ' of ' + MH.events.length + ' events' + (state.onlyView ? ' in view' : '') + (state.tag ? ' tagged ' + state.tag : '') +
      (placedInfo && placedInfo.eligible > placedInfo.placed ? '. ' + (placedInfo.eligible - placedInfo.placed) + ' markers are hidden on the chart at this zoom; zoom in to see them.' : '.');
    if (!items.length) list.appendChild(h('li', { class: 'empty', text: 'No events match. Widen the range or clear the tag.' }));
  }

  function selectEvent(i, pan) {
    selEvent = i;
    chart.setSelectedEvent(i);
    if (pan) chart.panToYear(MH.events[i].year);
    document.querySelectorAll('.evcard').forEach((c) => c.classList.toggle('sel', c.getAttribute('data-i') === String(i)));
    const card = document.querySelector('.evcard[data-i="' + i + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  /* ---------- dialog ---------- */
  let dlg = null;
  function openDialog(i, opener) {
    closeDialog(true);
    const e = MH.events[i];
    const rows = [];
    model.series.filter((s) => !s.ref).forEach((s) => {
      const r = histValueAt(s, e.year);
      if (r) rows.push({ s, r });
    });
    rows.sort((a, b) => b.r.v - a.r.v);
    if (!model.gold && model.panel2) {
      const g = model.panel2.series[0], gr = histValueAt(g, e.year);
      if (gr) rows.push({ s: g, r: gr, name: 'Gold price per ounce' });
    }
    const table = h('table', { class: 'dtable' });
    rows.forEach((x) => {
      const dot = h('i'); dot.style.setProperty('--c', x.s.color);
      const sub = x.r.tag ? x.r.tag : '';
      table.appendChild(h('tr', null, [h('td', null, [dot, x.name || x.s.name, sub ? h('small', { text: sub }) : null]), h('td', { text: x.s.fmt(x.r.v) })]));
    });
    const title = h('h2', { id: 'dlg-title', text: yearLabel(e.year) + ': ' + e.name });
    const close = h('button', { class: 'btn dclose', type: 'button', 'aria-label': 'Close dialog', text: '×', onclick: () => closeDialog() });
    const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' }, [
      close, title,
      h('div', { class: 'dsub' }, [h('span', { class: 'badge', text: e.tag }), h('span', { text: 'Importance ' + e.importance + ' of 3 (1 is highest)' })]),
      h('p', { text: e.detail || e.desc }),
      h('h3', { text: 'Data at this time' + (model.gold ? ' (priced in gold)' : '') }),
      rows.length ? table : h('p', { class: 'empty', text: 'No series have data for this year.' }),
      h('p', { class: 'dsrc' }, [h('b', { text: 'Source: ' }), e.source]),
      h('div', { class: 'dactions' }, [
        h('button', { class: 'btn', type: 'button', text: 'Show on chart', onclick: () => { closeDialog(); selectEvent(i, true); } }),
        h('button', { class: 'btn', type: 'button', text: 'Close', onclick: () => closeDialog() }),
      ]),
    ]);
    const scrim = h('div', { class: 'scrim' }, [box]);
    scrim.addEventListener('mousedown', (ev) => { if (ev.target === scrim) closeDialog(); });
    scrim.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); closeDialog(); return; }
      if (ev.key !== 'Tab') return;
      const f = Array.from(box.querySelectorAll('button, a[href], [tabindex="0"]')).filter((n) => !n.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    qs('#dialog-root').appendChild(scrim);
    ['#app', '.appbar'].forEach((sel) => { const n = qs(sel); if (n) n.setAttribute('inert', ''); });
    dlg = { scrim, opener: opener || document.activeElement, i };
    selectEvent(i, false);
    close.focus();
  }
  function closeDialog(silent) {
    if (!dlg) return;
    dlg.scrim.remove();
    ['#app', '.appbar'].forEach((sel) => { const n = qs(sel); if (n) n.removeAttribute('inert'); });
    const op = dlg.opener;
    dlg = null;
    if (!silent) {
      if (op && document.body.contains(op)) op.focus();
      else stageEl.focus();
    }
  }

  /* ---------- table view and CSV ---------- */
  function renderTableState() {
    tableBtn.setAttribute('aria-pressed', String(state.table));
    tableEl.hidden = !state.table;
    stageEl.hidden = state.table;
    qs('#keyrow').hidden = state.table;
    sizeStage();
    if (!state.table) return;
    const v = chart.getView();
    const t = model.table(v.x0, v.x1);
    tableEl.textContent = '';
    const table = h('table');
    table.appendChild(h('caption', { text: t.caption }));
    const hr = h('tr', null, [h('th', { scope: 'col', text: 'Period' })].concat(t.columns.map((c) => h('th', { scope: 'col', text: c }))));
    table.appendChild(h('thead', null, [hr]));
    const tb = h('tbody');
    t.rows.forEach((r) => {
      tb.appendChild(h('tr', null, [h('th', { scope: 'row', text: r.label })].concat(r.cells.map((c) => h('td', { class: (c.v == null ? 'na' : '') + (c.est ? ' est' : ''), text: c.text })))));
    });
    table.appendChild(tb);
    tableEl.appendChild(table);
  }

  function downloadCsv() {
    const v = chart.getView();
    const t = model.table(v.x0, v.x1);
    const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
    const hasEst = t.rows.some((r) => r.cells.some((c) => c.est));
    const lines = [['Period'].concat(t.columns).concat(hasEst ? ['Estimated values'] : []).map(esc).join(',')];
    t.rows.forEach((r) => {
      const cells = r.cells.map((c) => (c.v == null ? '' : String(+c.v.toPrecision(7))));
      const est = hasEst ? [r.cells.map((c, i) => (c.est ? t.columns[i].replace(/ \(.*\)$/, '') : null)).filter(Boolean).join('; ')] : [];
      lines.push([r.label].concat(cells).concat(est).map(esc).join(','));
    });
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: t.filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- view tabs and wiring ---------- */
  function switchView(v) {
    if (v === state.view) return;
    state.view = v;
    state.ymanual = null;
    document.querySelectorAll('.viewtab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === v)));
    selEvent = null; hotEvent = null;
    chart.setSelectedEvent(null);
    rebuild(state.x[v] ? { x: state.x[v] } : { reset: true });
  }

  const hooks = {
    onView(v) {
      const d = model.xDefault;
      const isDefault = Math.abs(v.x0 - d[0]) < 0.02 && Math.abs(v.x1 - d[1]) < 0.02;
      state.x[state.view] = isDefault ? null : [v.x0, v.x1];
      state.ymanual = v.ymanual;
      syncPresets();
      renderEventList();
      if (state.table) renderTableState();
      writeHash();
    },
    onEventClick(i) {
      const a = document.activeElement;
      selectEvent(i, false);
      openDialog(i, a && a.classList && a.classList.contains('ev') ? a : stageEl);
    },
    onBreakSelect(n) {
      // money view lists breaks in their own tab; the history view keeps them, numbered, in the series cards
      ptab[state.view] = state.view === 'money' ? 'breaks' : 'series';
      renderPanelTabs();
      const li = qs('#psecs li[data-n="' + n + '"]');
      if (!li) return;
      const closed = li.closest('details');
      if (closed) closed.open = true;
      if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
      li.classList.add('flash');
      setTimeout(() => li.classList.remove('flash'), 1800);
    },
    onEventHover(i) {
      hotEvent = i;
      document.querySelectorAll('.evcard').forEach((c) => c.classList.toggle('hot', i != null && c.getAttribute('data-i') === String(i)));
    },
    onPlaced(placed, eligible, total) {
      const changed = !placedInfo || placedInfo.placed !== placed || placedInfo.eligible !== eligible;
      placedInfo = { placed, eligible, total };
      if (changed) { const c = qs('#ev-count'); if (c && state.view === 'history') renderEventList(); }
    },
    onDrawn(info) {
      const note = qs('#chart-note');
      const extra = info.clipped ? ' Some growth rates fall outside the axis, which is trimmed to the central 98% of values; Shift + scroll zooms the value axis out.' : '';
      const txt = baseNote + extra;
      if (note.textContent !== txt) note.textContent = txt;
    },
    onShowDefaults() {
      if (state.view === 'money') state.hid = new Set();
      else { state.shown = null; state.goldPanel = true; }
      rebuild({});
    },
    announce(text) { liveEl.textContent = text; },
  };

  // Options for a state read from the address. The value zoom is independent of the time window: a link that
  // carries only y0 and y1 (Shift + scroll on the default window) still restores it.
  function hashOpts() {
    const o = state.x[state.view] ? { x: state.x[state.view] } : { reset: true };
    if (state.ymanual) o.ymanual = state.ymanual;
    return o;
  }

  function init() {
    parseHash();
    chart = createChart(stageEl, hooks);
    buildToolbar();
    document.querySelectorAll('.viewtab').forEach((t) => {
      t.setAttribute('aria-selected', String(t.dataset.view === state.view));
      t.addEventListener('click', () => switchView(t.dataset.view));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const other = qs('.viewtab:not([data-view="' + t.dataset.view + '"])');
        other.focus(); switchView(other.dataset.view);
      });
    });
    stageEl.dataset.view = state.view;
    // the toolbar presets need a model first
    model = state.view === 'money' ? buildMoney() : buildHistory();
    rebuild(hashOpts());
    // the room under the page chrome changes when the legend wraps, the note grows or the window resizes
    window.addEventListener('resize', sizeStage);
    if (window.ResizeObserver) {
      const sizer = new ResizeObserver(sizeStage);
      [qs('.chart-head'), legendEl, tbEl].forEach((n) => { if (n) sizer.observe(n); });
    }
    window.addEventListener('hashchange', () => {
      // a fragment with no key=value pairs (an in-page anchor) is not a view state: keep the view and restore the address
      const hash = window.location.hash;
      if (hash && hash !== '#' && hash.indexOf('=') < 0) { writeHash(); return; }
      parseHash();
      document.querySelectorAll('.viewtab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === state.view)));
      rebuild(hashOpts());
    });
  }

  init();
})();
