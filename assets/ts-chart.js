/* Macro Organizm time-series chart: lines, small multiples, columns, sparklines, ranked bars and dumbbells.
   Needs window.MacroUI (assets/ui.js) and assets/ts-chart.css. No d3. Runs in a browser as window.TSChart; the pure helpers
   (ticks, formats, runs) also load in node for tests. Text always goes in through textContent. Colours are CSS values such as
   "var(--c-blue)", so a theme change needs no redraw.

   TSChart.create(host, spec) -> chart
     spec.title            used in the chart's accessible name and the table caption
     spec.series[]         { id, name, short?, color, shape, role, type, rows | pts, panel?, fmt?, unit?, carry?, gapYears?,
                             noLine?, markAll?, endLabel?, domain?, legend?, hidden?, colorPos?, colorNeg? }
         rows / pts        [[period, value], ...] with "YYYY", "YYYY-MM", "YYYY-Qn" or a decimal year; a null value (or a null
                           row) is a gap and breaks the line. Objects { t | p | y, v } also work.
         color             a CSS colour or token, passed by the page (the colour follows the entity, not its rank)
         shape             circle | square | diamond | triangle | star (end marker and legend key)
         role              data (default) | ref (grey reference line such as CPI) | guide (dotted guide) | context (faint, no
                           legend, no readout) | spot (ink line)
         type              line (default) | column (grows from zero; colorPos and colorNeg colour the two signs)
         carry             an annual series stays in the readout across the months of its year
         gapYears          break the line where two points are further apart than this
         noLine, markAll   draw only markers (a dot strip) / a marker at every point
     spec.panels[]         { id, title, y?, endLabels?, height? }; with more than one panel the chart is small multiples. A
                           series names its panel by id. spec.layout 'grid' (default) or 'stack'.
     spec.cols             grid columns: a number (fixed), or a function (width, panelCount) -> number that is asked on every
                           draw, so the count follows the width. Clamped to 1..panelCount when it comes from a function.
     spec.minPanelWidth    px; with no spec.cols, as many columns as fit panels at least this wide (at least one)
     spec.alignX           true | false | 'auto'. Panels in one stack (or, with true, in one grid column) share the widest left
                           and right margin, so the same year sits at the same x in each. 'auto' (default): on for a stack, off
                           for a grid.
     spec.y                { scale: 'linear' | 'log', min, max, zero: true | false | 'auto', fmt, tickFmt, title, clip: [0.01, 0.99],
                             shared: true }   fmt is a function, or a spec: n0..n6, p0..p3, x0..x2, usd0..usd2, sgn0..sgn3.
                           A panel's own y overrides these. Panels of a grid share one y range unless shared is false.
     spec.x                { min, max } in decimal years (the data extent by default)
     spec.refLines[]       { y, label, kind: 'zero' | 'guide', panel?, labelAlign? } horizontal lines. labelAlign 'right' | 'left' |
                           'auto' (default): with auto the label goes at the end, above or below the line, that is clear of the
                           series lines and of other labels, and stays at the right above the line when nothing is in the way.
     spec.between[]        { a, b } series ids; the area between the two lines is shaded at 10% ink
     spec.legend           true | false | 'auto' (2 or more chips)
     spec.legendDedupe     false keeps one chip per series. By default series that look the same (same name, colour, shape and
                           role) share one chip, as does every series with the same series.legendGroup (any string). A shared
                           chip shows, hides and highlights all of its series together; it is off when all of them are hidden.
                           This lets small multiples of the same economies keep legends on and toggles working in every panel.
     spec.endLabels        true | false | 'auto' (up to maxEndLabels series, when they fit; leader lines separate close ones)
     spec.readout          (series, point, info) -> { text, sub, tag } to customise a readout row
     spec.empty            message when there is nothing to draw
     spec.height           stage height in px (panelHeight for small multiples, default 220)
     spec.onCursor(t, rows, allRows), spec.onToggle(hiddenIds), spec.announce(text)
                           rows are the rows of the panel the cursor is in; allRows is an array with one rows array per panel
   chart methods: update(patch), setSeries(list), setRange(x0, x1 | null), setHidden(ids), setHover(ids | null), setCursor(t | null),
     getCursor(), draw(), table(opts) -> { caption, columns, rows, filename }, mountTable(el, opts), csv(opts), downloadCsv(name),
     state(), focus(), destroy(); chart.el is the host.
   update(patch): the patch is merged over the current spec and the chart is rebuilt from the merged spec, so any key may be
     changed alone (update({ cols: 2 }), update({ x: { min: 1980 } })). A key set to null or undefined is cleared, which puts it
     back to its default: update({ height: null }) drops a fixed height (a stacked chart then uses panelHeight per panel).
     update({ series }) replaces the data and keeps the series a viewer hid. Panels are rebuilt when their ids, titles or heights,
     the chart title, the height or panelHeight change; otherwise the existing panels are reused.
   Crosshair: pointer or touch snaps to the nearest period; keys: Left and Right step a period, Shift or PageUp and PageDown step
   a year, Home and End jump, Escape hides. One readout lists every series, sorted by value; a series with a gap shows "no data".
   With more than one panel, a pointer readout lists the panel under the pointer. A keyboard cursor lists every panel (each under
   its title) in the readout and in the live announcement, so the values of all panels are heard.
   Redraw: the chart redraws when its width changes (ResizeObserver) and also when the page becomes visible again, when the chart
   scrolls into view, and, for a chart that could not be measured, a few times in the next seconds (a hidden section, or a pane
   that delivers no resize callbacks). chart.draw() forces it.

   TSChart.sparkline(host, data, opts)   -> { update(data), destroy() }   12 points, grey line, latest point in the accent;
     opts.timeScale spaces [period, value] points by date instead of evenly
   TSChart.rankedBar(host, items, opts)  -> { update(items, opts), destroy() }   ranked or diverging bars (baseline, linear or log)
   TSChart.dumbbell(host, rows, opts)    -> { update(rows, opts), destroy() }    hollow start, filled end, thin connector
     Both lay every row and the axis row on one shared grid (CSS subgrid), so the label, track and value columns have the same
     width in every row and the axis lines up with the bars. A browser without subgrid gets a fixed value column, whose width a
     page can set with --ts-bval-w on the host (default 8.5rem). No page rule is needed.
   Also: PALETTE, SHAPE_PATH, parseX, normPoints, niceTicks, logTicks, xTicks, makeFmt, fmtValue, buildRuns (pure). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.TSChart = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SHAPE_PATH = {
    circle: 'M0,-5.5A5.5,5.5 0 1,0 0,5.5A5.5,5.5 0 1,0 0,-5.5Z',
    diamond: 'M0,-7L6,0L0,7L-6,0Z',
    triangle: 'M0,-6.5L6.5,5L-6.5,5Z',
    square: 'M-5,-5H5V5H-5Z',
    star: 'M0,-7L2,-2.4L7,-2.2L3.1,1L4.4,6L0,3.2L-4.4,6L-3.1,1L-7,-2.2L-2,-2.4Z',
    cross: 'M-2.3,-6.5H2.3V-2.3H6.5V2.3H2.3V6.5H-2.3V2.3H-6.5V-2.3H-2.3Z',
    hexagon: 'M-3,-5.4L3,-5.4L6.2,0L3,5.4L-3,5.4L-6.2,0Z',
    down: 'M-6.5,-5L6.5,-5L0,6.5Z',
    pentagon: 'M0,-6.8L6.5,-2L4,5.6L-4,5.6L-6.5,-2Z',
  };
  const SHAPE_ORDER = ['circle', 'square', 'diamond', 'triangle', 'star', 'cross', 'hexagon', 'down', 'pentagon'];
  // the app's categorical hues in their fixed order; pass explicit colours so a colour follows its entity
  const PALETTE = ['var(--c-blue)', 'var(--c-orange)', 'var(--c-aqua)', 'var(--c-yellow)', 'var(--c-magenta)', 'var(--c-green)'];
  const ROLE_ORDER = { context: 0, data: 1, ref: 2, guide: 3, spot: 4 };
  const EPS = 1e-6;

  const fin = (x) => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const r1 = (x) => Math.round(x * 10) / 10;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function ui() {
    const U = root.MacroUI;
    if (!U || !U.h || !U.sv) throw new Error('TSChart needs assets/ui.js (window.MacroUI) to load first');
    return U;
  }

  /* ---------- periods and points ---------- */
  // x -> { t (decimal year at the start), freq: 'A'|'Q'|'M'|'T', step (years), label } or null
  function parseX(x) {
    if (typeof x === 'number') {
      if (!isFinite(x)) return null;
      return Number.isInteger(x) ? { t: x, freq: 'A', step: 1, label: String(x) } : { t: x, freq: 'T', step: 1 / 12, label: String(Math.floor(x)) };
    }
    if (typeof x !== 'string') return null;
    let m = /^(\d{4})$/.exec(x);
    if (m) return { t: +m[1], freq: 'A', step: 1, label: x };
    m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(x);
    if (m) { const y = +m[1], mo = +m[2]; return { t: y + (mo - 1) / 12, freq: 'M', step: 1 / 12, label: MONTHS[mo - 1] + ' ' + y }; }
    m = /^(\d{4})-?[Qq]([1-4])$/.exec(x);
    if (m) { const y = +m[1], q = +m[2]; return { t: y + (q - 1) / 4, freq: 'Q', step: 0.25, label: y + ' Q' + q }; }
    return null;
  }

  // rows -> sorted [{ t, v | null, freq, step, label }]; a null v is a gap. A repeated observation keeps the last value.
  function normPoints(rows) {
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (r == null) return;
      let x, v;
      if (Array.isArray(r)) { x = r[0]; v = r[1]; } else if (typeof r === 'object') { x = r.p != null ? r.p : r.t != null ? r.t : r.y; v = r.v; } else return;
      const per = parseX(x);
      if (!per) return;
      out.push({ t: per.t, v: fin(v) ? v : null, freq: per.freq, step: per.step, label: per.label });
    });
    out.sort((a, b) => a.t - b.t);
    const res = [];
    out.forEach((p) => {
      const last = res[res.length - 1];
      if (last && last.v != null && p.v != null && Math.abs(last.t - p.t) < EPS) res[res.length - 1] = p;
      else res.push(p);
    });
    return res;
  }

  function lowerBound(pts, t) {
    let lo = 0, hi = pts.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].t < t) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // draw runs: arrays of [x, y, point], broken at null values, at non-positive values on a log axis, and at gaps wider than gapYears
  function buildRuns(pts, i0, i1, X, Y, isLog, gapYears) {
    const runs = [];
    let cur = null, prevT = null;
    for (let i = Math.max(0, i0); i <= Math.min(pts.length - 1, i1); i++) {
      const p = pts[i];
      if (p.v == null || !fin(p.v) || (isLog && p.v <= 0)) { cur = null; prevT = null; continue; }
      if (cur && gapYears != null && p.t - prevT > gapYears + EPS) cur = null;
      if (!cur) { cur = []; runs.push(cur); }
      cur.push([X(p.t), Y(p.v), p]);
      prevT = p.t;
    }
    return runs;
  }

  /* ---------- number formats ---------- */
  function groupDigits(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fixed(v, d) {
    const a = Math.abs(v).toFixed(d), parts = a.split('.');
    return (v < 0 && +a !== 0 ? '-' : '') + groupDigits(parts[0]) + (parts[1] ? '.' + parts[1] : '');
  }
  function parseSpec(spec) {
    const m = /^([a-z]+)(\d?)$/.exec(spec || '');
    return m ? { kind: m[1], d: m[2] === '' ? null : +m[2] } : { kind: 'n', d: null };
  }
  function affixes(kind) { return kind === 'p' ? ['', '%'] : kind === 'x' ? ['', 'x'] : kind === 'usd' ? ['$', ''] : ['', '']; }
  // n0..n6, p0..p3, x0..x2, usd0..usd2, sgn0..sgn3
  function fmtValue(v, spec) {
    if (!fin(v)) return 'n/a';
    const s = parseSpec(spec), af = affixes(s.kind);
    const d = s.d == null ? (s.kind === 'usd' ? 0 : s.kind === 'n' ? 2 : 1) : s.d;
    const a = fixed(Math.abs(v), d), zero = +a.replace(/,/g, '') === 0;
    const sign = v < 0 && !zero ? '-' : s.kind === 'sgn' && v > 0 && !zero ? '+' : '';
    return sign + af[0] + a + af[1];
  }
  // tick labels share one unit (K, M, B, T) and just enough decimals for the tick step
  function tickFormatter(maxAbs, step, pre, suf) {
    let div = 1, u = '';
    if (maxAbs >= 1e12) { div = 1e12; u = 'T'; } else if (maxAbs >= 1e9) { div = 1e9; u = 'B'; } else if (maxAbs >= 1e6) { div = 1e6; u = 'M'; } else if (maxAbs >= 1e4) { div = 1e3; u = 'K'; }
    const s = step / div, dec = s >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(s) - 1e-9));
    return (v) => {
      const a = fixed(Math.abs(v) / div, dec), zero = +a.replace(/,/g, '') === 0;
      return (v < 0 && !zero ? '-' : '') + pre + a + (zero ? '' : u) + suf;
    };
  }
  // -> { value(v), tick(maxAbs, step) -> fn, custom }
  function makeFmt(spec) {
    if (typeof spec === 'function') return { value: spec, tick: () => spec, custom: true };
    const sp = typeof spec === 'string' && spec ? spec : 'n2', af = affixes(parseSpec(sp).kind);
    return { value: (v) => fmtValue(v, sp), tick: (maxAbs, step) => tickFormatter(maxAbs, step, af[0], af[1]), custom: false };
  }

  /* ---------- ticks ---------- */
  function niceStep(raw) {
    const e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
  }
  function niceTicks(lo, hi, count) {
    if (!(hi > lo)) return [lo];
    const step = niceStep((hi - lo) / Math.max(1, count)), out = [];
    for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + step * 1e-9; i++) out.push(+(i * step).toPrecision(12));
    return out;
  }
  function niceDomain(lo, hi, count) {
    const step = niceStep((hi - lo) / Math.max(1, count));
    return [+(Math.floor(lo / step + 1e-9) * step).toPrecision(12), +(Math.ceil(hi / step - 1e-9) * step).toPrecision(12), step];
  }
  // log ticks from the Money Over Time engine: more subdivisions when there is room, fewer when decades are tight
  function logTicks(lo, hi, hpx) {
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
    if (ppd < 18) {
      const every = Math.ceil(18 / ppd);
      out = out.filter((d) => Math.round(Math.log10(d.v)) % every === 0);
    }
    return out;
  }
  // year (or month) ticks, a step from a ladder so about one label per 78px
  function xTicks(x0, x1, pw) {
    const span = x1 - x0, target = Math.max(2, Math.floor(pw / 78));
    const steps = [1 / 12, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
    let step = steps[steps.length - 1];
    for (let i = 0; i < steps.length; i++) if (span / steps[i] <= target) { step = steps[i]; break; }
    const out = [];
    for (let k = Math.ceil(x0 / step - 1e-9), n = 0; n < 400; k++, n++) {
      const t = k * step;
      if (t > x1 + 1e-9) break;
      let label;
      if (step >= 1) label = String(Math.round(t));
      else {
        const y = Math.floor(t + 1e-6), m = Math.round((t - y) * 12) % 12;
        label = m === 0 ? String(y) : MONTHS[m];
      }
      out.push({ t, label });
    }
    return out;
  }

  /* ---------- text measure (end labels need the room before they are drawn) ---------- */
  let measureCtx = null;
  const measureCache = new Map();
  function textWidth(str, bold) {
    const key = (bold ? 'b|' : 'n|') + str;
    if (measureCache.has(key)) return measureCache.get(key);
    let w = str.length * (bold ? 7 : 6.4);
    try {
      if (typeof document !== 'undefined') {
        if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
        measureCtx.font = (bold ? '700 ' : '400 ') + '12px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
        const m = measureCtx.measureText(str).width;
        if (m > 0) w = m;
      }
    } catch (e) { /* keep the estimate */ }
    measureCache.set(key, w);
    return w;
  }

  /* ---------- y domain ---------- */
  // raw domain of the visible points: { lo, hi, log, fixedLo, fixedHi } or null when there is nothing to draw
  function yDomain(list, x0, x1, yc) {
    const log = yc.scale === 'log', vals = [];
    let lo = Infinity, hi = -Infinity;
    list.forEach((s) => {
      if (s.domain === false) return;
      s.pts.forEach((p) => {
        if (p.v == null || p.t < x0 - EPS || p.t > x1 + EPS) return;
        if (log && p.v <= 0) return;
        vals.push(p.v);
        if (p.v < lo) lo = p.v;
        if (p.v > hi) hi = p.v;
      });
    });
    if (!vals.length) return null;
    if (Array.isArray(yc.clip) && vals.length > 40) {
      vals.sort((a, b) => a - b);
      const q = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(p * (vals.length - 1))))];
      lo = q(yc.clip[0]); hi = q(yc.clip[1]);
    }
    const fixedLo = fin(yc.min), fixedHi = fin(yc.max);
    if (log) {
      if (fixedLo) lo = yc.min;
      if (fixedHi) hi = yc.max;
      if (!(lo > 0)) return null;
      if (hi / lo < 1.3) { const c = Math.sqrt(lo * hi); lo = c / 1.6; hi = c * 1.6; }
      const pad = Math.pow(10, 0.04);
      return { lo: fixedLo ? lo : lo / pad, hi: fixedHi ? hi : hi * pad, log: true, fixedLo, fixedHi };
    }
    const hasColumn = list.some((s) => s.type === 'column');
    let zero = yc.zero;
    if (hasColumn) zero = true;
    else if (zero == null || zero === 'auto') zero = lo >= 0 && lo <= hi * 0.6;
    if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (fixedLo) lo = yc.min;
    if (fixedHi) hi = yc.max;
    if (!(hi > lo)) { hi = lo + 1; }
    const span = hi - lo;
    if (!fixedHi) hi += span * 0.06;
    if (!fixedLo && !(zero && lo === 0)) lo -= span * 0.06;
    return { lo, hi, log: false, fixedLo, fixedHi };
  }

  function colPath(x, w, yBase, yVal, rad) {
    const top = Math.min(yBase, yVal), bot = Math.max(yBase, yVal), hgt = bot - top;
    if (hgt < 0.5) return 'M' + r1(x) + ',' + r1(yBase - 0.5) + 'h' + r1(w) + 'v1h' + r1(-w) + 'Z';
    const rr = Math.min(rad, hgt, w / 2), x2 = x + w;
    if (yVal < yBase) return 'M' + r1(x) + ',' + r1(bot) + 'H' + r1(x2) + 'V' + r1(top + rr) + 'Q' + r1(x2) + ',' + r1(top) + ' ' + r1(x2 - rr) + ',' + r1(top) + 'H' + r1(x + rr) + 'Q' + r1(x) + ',' + r1(top) + ' ' + r1(x) + ',' + r1(top + rr) + 'Z';
    return 'M' + r1(x) + ',' + r1(top) + 'H' + r1(x2) + 'V' + r1(bot - rr) + 'Q' + r1(x2) + ',' + r1(bot) + ' ' + r1(x2 - rr) + ',' + r1(bot) + 'H' + r1(x + rr) + 'Q' + r1(x) + ',' + r1(bot) + ' ' + r1(x) + ',' + r1(bot - rr) + 'Z';
  }

  // "1.0" -> "1", "2.50%" -> "2.5%"
  function trimZeros(str) { return str.replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.(?=\D|$)/, ''); }

  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------- reference line labels ---------- */
  // the drawn series of a panel as straight pieces { x1, y1, x2, y2, w, len? } in plot pixels (a dot is a piece of no length)
  function lineObstacles(ps, x0, x1, X, Y, log) {
    const out = [];
    ps.forEach((s) => {
      const w = s.role === 'context' ? 0.25 : 1;
      if (s.type === 'column') {
        if (log) return;
        const yb = Y(0), len = Math.max(1, Math.abs(X(x0 + s.step) - X(x0)) - 2);
        s.pts.forEach((q) => {
          if (q.v == null || q.t < x0 - EPS || q.t > x1 + EPS) return;
          const x = X(q.t + s.step / 2);
          out.push({ x1: x, y1: yb, x2: x, y2: Y(q.v), w, len });
        });
        return;
      }
      const i0 = lowerBound(s.pts, x0 - EPS) - 1, i1 = lowerBound(s.pts, x1 + EPS);
      buildRuns(s.pts, i0, i1, X, Y, log, s.gapYears).forEach((r) => {
        if (s.noLine || s.markAll || r.length === 1) r.forEach((q) => out.push({ x1: q[0], y1: q[1], x2: q[0], y2: q[1], w, len: 8 }));
        if (s.noLine) return;
        for (let k = 1; k < r.length; k++) out.push({ x1: r[k - 1][0], y1: r[k - 1][1], x2: r[k][0], y2: r[k][1], w });
      });
    });
    return out;
  }
  // how much of the piece o lies inside the box (bx0..bx1, by0..by1): its length in x when it crosses the box, else 0
  function pieceInBox(o, bx0, bx1, by0, by1) {
    const xa = Math.min(o.x1, o.x2), xb = Math.max(o.x1, o.x2);
    if (xb < bx0 || xa > bx1) return 0;
    let ya = o.y1, yb = o.y2;
    if (xb - xa > 1e-9) {
      const f = (x) => o.y1 + ((x - o.x1) / (o.x2 - o.x1)) * (o.y2 - o.y1);
      ya = f(Math.max(xa, bx0)); yb = f(Math.min(xb, bx1));
    }
    if (Math.max(ya, yb) < by0 || Math.min(ya, yb) > by1) return 0;
    return (o.len != null ? o.len : Math.max(1, Math.min(xb, bx1) - Math.max(xa, bx0))) * o.w;
  }
  // -> { x, y, anchor } for the label of a reference line at pixel row yy. Candidates in order: the right end above the line (the
  // long-standing place), the left end above, then the same below; labelAlign 'left' or 'right' keeps one end. With 'auto', when
  // every end spot is crossed by a series, spots along the line are tried too, a little less favoured the further they are from
  // an end. The candidate with the least overlap wins and the first of equals, so a label stays where it was unless something is
  // in the way.
  function placeRefLabel(rl, yy, pw, ph, obstacles, placed) {
    const lw = Math.ceil(textWidth(rl.label) * 11 / 12) + 2;
    const fixed = rl.labelAlign === 'left' || rl.labelAlign === 'right';
    const cands = [];
    ['above', 'below'].forEach((v) => (fixed ? [rl.labelAlign] : ['right', 'left']).forEach((side) => cands.push({ v, side, bx0: side === 'right' ? pw - 4 - lw : 4 })));
    if (!fixed) {
      for (let x = 4 + 24; x < pw - 4 - lw - 12; x += 24) ['above', 'below'].forEach((v) => cands.push({ v, side: 'mid', bx0: x }));
    }
    let best = null;
    cands.forEach((c) => {
      const bx0 = c.bx0, bx1 = bx0 + lw;
      const base = c.v === 'above' ? yy - 4 : yy + 13;
      const by0 = base - 9, by1 = base + 3;
      let score = by0 < -2 || by1 > ph + 2 ? 500 : 0;
      obstacles.forEach((o) => { score += pieceInBox(o, bx0 - 3, bx1 + 3, by0 - 2, by1 + 2); });
      placed.forEach((b) => { if (b.bx0 < bx1 && b.bx1 > bx0 && b.by0 < by1 && b.by1 > by0) score += 400; });
      if (c.side === 'mid') score += 0.5 + Math.min(bx0, pw - bx1) * 0.01;
      if (!best || score < best.score) best = { score, bx0, bx1, by0, by1, x: c.side === 'right' ? pw - 4 : bx0, y: base, anchor: c.side === 'right' ? 'end' : 'start' };
    });
    placed.push(best);
    return best;
  }

  /* =====================================================================================
     create: a line chart or small multiples
     ===================================================================================== */
  function create(host, spec0) {
    const U = ui(), h = U.h, sv = U.sv;
    if (!host || !host.appendChild) throw new Error('TSChart.create needs a host element');
    const uid = U.uid ? U.uid('ts') : 'ts-' + Math.random().toString(36).slice(2, 8);

    let spec = {}, series = [], panels = [], hidden = new Set(), hoverIds = null;
    let range = null, cursor = null, geo = [], times = [], destroyed = false, lastW = -1, timer = null, ro = null, io = null, lastRange = [0, 1], lastCols = 1;
    let onWinResize = null, onVisible = null, retryTimer = null, retries = 0;

    host.classList.add('ts-chart');
    const legendEl = h('div', { class: 'legend ts-legend', role: 'group' });
    const wrap = h('div', { class: 'ts-wrap', tabindex: '0', role: 'group' });
    const panelsEl = h('div', { class: 'ts-panels' });
    const readout = h('div', { class: 'tip ts-readout', hidden: true });
    const live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    wrap.appendChild(panelsEl);
    wrap.appendChild(readout);
    host.appendChild(legendEl);
    host.appendChild(wrap);
    host.appendChild(live);

    /* -- model -- */
    function prepare(s, keepHidden) {
      const prevHidden = hidden, prevPanels = panels;
      spec = Object.assign({}, s);
      const pdefs = Array.isArray(s.panels) && s.panels.length ? s.panels : [{ id: 'main' }];
      panels = pdefs.map((p, i) => {
        const np = Object.assign({}, p, { id: p.id != null ? String(p.id) : 'p' + i, index: i });
        // a rebuilt panel keeps the page elements of the old panel with the same id, so drawing never meets an unbuilt stage
        const old = prevPanels.find((q) => q.id === np.id);
        if (old && old.stage) { np.el = old.el; np.stage = old.stage; np.empty = old.empty; np.svg = old.svg; }
        return np;
      });
      series = (Array.isArray(s.series) ? s.series : []).map((d, i) => {
        const pts = normPoints(d.pts || d.rows);
        const valid = pts.filter((p) => p.v != null);
        let pi = 0;
        if (typeof d.panel === 'number') pi = clamp(d.panel, 0, panels.length - 1);
        else if (d.panel != null) { const f = panels.findIndex((p) => p.id === String(d.panel)); pi = f >= 0 ? f : 0; }
        return Object.assign({}, d, {
          id: d.id != null ? String(d.id) : 's' + i,
          name: d.name != null ? String(d.name) : d.id != null ? String(d.id) : 'Series ' + (i + 1),
          color: d.color || PALETTE[i % PALETTE.length],
          shape: SHAPE_PATH[d.shape] ? d.shape : SHAPE_ORDER[i % SHAPE_ORDER.length],
          role: own(ROLE_ORDER, d.role) ? d.role : 'data',
          type: d.type === 'column' ? 'column' : 'line',
          pts, panelIdx: pi, order: i,
          step: valid.length ? valid[0].step : 1,
          first: valid.length ? valid[0].t : null,
          last: valid.length ? valid[valid.length - 1].t : null,
        });
      });
      hidden = new Set(series.filter((d) => d.hidden || (keepHidden && prevHidden.has(d.id))).map((d) => d.id));
    }

    const isVisible = (s) => !hidden.has(s.id) && s.last != null;
    const yconf = (p) => Object.assign({}, spec.y || {}, p.y || {});

    function dataExtent() {
      let a = Infinity, b = -Infinity;
      series.forEach((s) => {
        if (!isVisible(s)) return;
        if (s.first < a) a = s.first;
        if (s.last > b) b = s.last;
        if (s.type === 'column') b = Math.max(b, s.last + s.step);
      });
      if (!isFinite(a)) return [0, 1];
      if (b - a < 1e-9) { a -= 0.5; b += 0.5; }
      return [a, b];
    }
    function currentRange() {
      const de = dataExtent();
      if (range) return range;
      const sx = spec.x || {};
      let a = fin(sx.min) ? sx.min : de[0], b = fin(sx.max) ? sx.max : de[1];
      if (!(b > a)) b = a + 1;
      return [a, b];
    }

    /* -- structure: panel containers -- */
    function structure() {
      U.clear(panelsEl);
      const multi = panels.length > 1;
      const base = fin(spec.height) ? spec.height : multi ? (fin(spec.panelHeight) ? spec.panelHeight : 220) : 300;
      host.style.setProperty('--ts-h', base + 'px');
      host.style.setProperty('--ts-h-sm', Math.min(base, multi ? 200 : 280) + 'px');
      panels.forEach((p) => {
        p.el = h('div', { class: 'ts-panel', 'data-panel': p.id });
        if (multi && p.title) p.el.appendChild(h('div', { class: 'ts-ptitle', text: p.title }));
        p.stage = h('div', { class: 'ts-stage' });
        if (fin(p.height)) { p.stage.style.setProperty('--ts-h', p.height + 'px'); p.stage.style.setProperty('--ts-h-sm', Math.min(p.height, 220) + 'px'); }
        p.empty = h('div', { class: 'ts-empty', hidden: true });
        p.stage.appendChild(p.empty);
        p.el.appendChild(p.stage);
        panelsEl.appendChild(p.el);
      });
      wrap.setAttribute('aria-label', (spec.title ? spec.title + '. ' : '') + 'Chart. Use the left and right arrow keys to move through the data, shift for a year, home and end to jump, escape to close.');
    }

    // what makes up the page structure: if any of it changes the panel containers are rebuilt
    function structureSig() {
      return [spec.title, spec.height, spec.panelHeight, panels.map((p) => [p.id, p.title, p.height].join('|')).join('~')].join('#');
    }

    /* -- legend -- */
    function keyEl(s) {
      const cls = 'key' + (s.role === 'ref' ? ' ts-k-ref' : s.role === 'guide' ? ' ts-k-guide' : '');
      if (s.type === 'column') return null;
      return sv('svg', { class: cls, viewBox: '0 0 24 12', 'aria-hidden': 'true' }, [
        sv('line', { x1: '1', y1: '6', x2: '23', y2: '6' }),
        s.role === 'guide' || s.noMarker ? null : sv('path', { d: SHAPE_PATH[s.shape], transform: 'translate(12 6) scale(.6)', class: s.hollow ? 'hollow' : null }),
      ]);
    }
    // chips: one per legendGroup, and one for series that look the same (unless spec.legendDedupe is false)
    function legendKey(s) {
      if (s.legendGroup != null) return 'g:' + s.legendGroup;
      if (spec.legendDedupe === false) return 'i:' + s.id;
      return 's:' + [s.name, s.color, s.colorPos || '', s.colorNeg || '', s.shape, s.role, s.type].join('|');
    }
    function renderLegend() {
      // a keyboard user who toggles a chip stays on it after the legend is rebuilt
      const act = document.activeElement;
      let keepFocus = act && act !== document.body && legendEl.contains(act) ? act.getAttribute('data-id') : null;
      if (keepFocus != null) { try { if (!act.matches(':focus-visible')) keepFocus = null; } catch (err) { /* assume keyboard */ } }
      U.clear(legendEl);
      const list = series.filter((s) => s.role !== 'context' && s.legend !== false && s.last != null);
      const groups = [], byKey = new Map();
      list.forEach((s) => {
        const k = legendKey(s);
        let g = byKey.get(k);
        if (!g) { g = { lead: s, ids: [] }; byKey.set(k, g); groups.push(g); }
        g.ids.push(s.id);
      });
      const want = spec.legend === false ? false : spec.legend === true ? groups.length > 0 : groups.length >= 2;
      legendEl.hidden = !want;
      if (!want) return;
      legendEl.setAttribute('aria-label', 'Series');
      groups.forEach((g) => {
        const s = g.lead;
        let key = keyEl(s);
        if (!key) {
          key = h('span', { class: 'ts-ksw' });
          const a = h('span', { class: 'swatch' }); a.style.setProperty('--c', s.colorPos || s.color);
          key.appendChild(a);
          if (s.colorNeg) { const b = h('span', { class: 'swatch' }); b.style.setProperty('--c', s.colorNeg); key.appendChild(b); }
        }
        // a legend that toggles has buttons; one that only names the series has plain labels that are not in the tab order
        const toggles = spec.legendToggle !== false;
        const btn = toggles ? h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(g.ids.some((id) => !hidden.has(id))), 'data-id': s.id,
          title: 'Show or hide ' + s.name,
          onclick: () => toggle(g.ids),
          onmouseenter: () => setHover(g.ids), onmouseleave: () => setHover(null),
          onfocus: () => setHover(g.ids), onblur: () => setHover(null),
        }, [key, h('span', { text: s.name })]) : h('span', {
          class: 'chip chip--static', 'data-id': s.id,
          onmouseenter: () => setHover(g.ids), onmouseleave: () => setHover(null),
        }, [key, h('span', { text: s.name })]);
        if (g.ids.length > 1) btn.setAttribute('data-ids', g.ids.join(' '));
        if (key.style && key.tagName && key.tagName.toLowerCase() === 'svg') key.style.setProperty('--c', s.role === 'ref' || s.role === 'guide' ? 'var(--ink-2)' : s.color);
        else btn.style.setProperty('--c', s.color);
        legendEl.appendChild(btn);
        if (keepFocus != null && keepFocus === s.id) { try { btn.focus({ preventScroll: true }); } catch (err) { /* old browser */ } }
      });
    }
    // ids: the series of one chip. If all are hidden they all come back, otherwise they all go.
    function toggle(ids) {
      const list = Array.isArray(ids) ? ids : [ids];
      const allHidden = list.every((id) => hidden.has(id));
      list.forEach((id) => { if (allHidden) hidden.delete(id); else hidden.add(id); });
      renderLegend();
      draw();
      if (spec.onToggle) spec.onToggle(Array.from(hidden));
    }
    function setHover(ids) {
      hoverIds = ids && ids.length ? new Set(ids.map(String)) : null;
      wrap.querySelectorAll('.ts-s').forEach((g) => g.classList.toggle('ts-dim', !!hoverIds && !hoverIds.has(g.getAttribute('data-id'))));
    }

    /* -- drawing -- */
    function planEndLabels(p, ps, Y, ph, x0, x1, Wp, fv, log) {
      if (spec.endLabels === false || p.endLabels === false) return null;
      const multi = panels.length > 1;
      if (multi && p.endLabels !== true) return null;
      if (Wp < (multi ? 400 : 520)) return null;
      const maxN = fin(spec.maxEndLabels) ? spec.maxEndLabels : 4;
      const elig = ps.filter((s) => s.type === 'line' && s.endLabel !== false && (s.endLabel === true || s.role === 'data' || s.role === 'spot') && !s.noLine);
      const items = [];
      elig.forEach((s) => {
        let lastP = null;
        for (let i = s.pts.length - 1; i >= 0; i--) { if (s.pts[i].v != null && s.pts[i].t <= x1 + EPS) { lastP = s.pts[i]; break; } }
        if (!lastP || lastP.t < x1 - (x1 - x0) * 0.04) return;
        if (fin(lastP.v) && !(log && lastP.v <= 0)) items.push({ s, p: lastP, y: Y(lastP.v) });
      });
      if (!items.length || items.length > maxN) return null;
      const maxW = Math.min(0.36 * Wp, 190);
      let widest = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i], f = it.s.fmt ? makeFmt(it.s.fmt).value : fv;
        it.val = f(it.p.v);
        it.name = it.s.short || it.s.name;
        const vw = textWidth(it.val, true);
        let nw = textWidth(it.name + ' ');
        if (nw + vw > maxW) {
          const keep = Math.floor((maxW - vw) / 6.2) - 3;
          if (keep < 4) return null;
          it.name = it.name.slice(0, keep) + '...';
          nw = textWidth(it.name + ' ');
        }
        it.w = nw + vw;
        widest = Math.max(widest, it.w);
      }
      const gap = 16, order = items.slice().sort((a, b) => a.y - b.y);
      if (order.length * gap > ph - 6) return null;
      order.forEach((it, i) => { it.ly = i === 0 ? Math.max(8, it.y) : Math.max(it.y, order[i - 1].ly + gap); });
      const lastIt = order[order.length - 1];
      if (lastIt.ly > ph - 4) {
        lastIt.ly = ph - 4;
        for (let i = order.length - 2; i >= 0; i--) order[i].ly = Math.min(order[i].ly, order[i + 1].ly - gap);
      }
      if (order[0].ly < 6) return null;
      return { items: order, mr: 24 + Math.ceil(widest) };
    }

    // columns of a grid of panels: spec.cols (a number, or a function of width and panel count), else spec.minPanelWidth, else by width
    function columnGap() {
      try { const g = parseFloat(getComputedStyle(panelsEl).columnGap); if (fin(g)) return g; } catch (e) { /* use the stylesheet value */ }
      return 18;
    }
    function gridCols(W) {
      const n = panels.length;
      if (typeof spec.cols === 'function') {
        let c = null;
        try { c = spec.cols(W, n); } catch (e) { c = null; }
        if (fin(c)) return clamp(Math.floor(c), 1, n);
      } else if (fin(spec.cols)) return Math.max(1, Math.floor(spec.cols));
      if (fin(spec.minPanelWidth) && spec.minPanelWidth > 0) {
        const gap = columnGap();
        return clamp(Math.floor((W + gap) / (spec.minPanelWidth + gap)), 1, n);
      }
      return W >= 960 ? Math.min(n, 3) : W >= 560 ? Math.min(n, 2) : 1;
    }

    // A chart that cannot be measured (hidden section, throttled pane that delivers no resize callbacks) asks again a few times.
    function scheduleRetry() {
      if (destroyed || retryTimer || retries >= 20) return;
      retries++;
      retryTimer = setTimeout(() => { retryTimer = null; draw(); }, 300);
    }

    function draw() {
      if (destroyed) return;
      const W = wrap.clientWidth;
      if (!(W > 20)) { scheduleRetry(); return; }
      retries = 0;
      lastW = W;
      const multi = panels.length > 1;
      const layout = spec.layout === 'stack' ? 'stack' : 'grid';
      const cols = layout === 'stack' || !multi ? 1 : gridCols(W);
      lastCols = cols;
      panelsEl.style.setProperty('--ts-cols', String(cols));

      const rg = currentRange(), x0 = rg[0], x1 = rg[1];
      lastRange = rg;
      buildTimes(x0, x1);

      const vis = series.filter(isVisible);
      const byPanel = panels.map((p) => vis.filter((s) => s.panelIdx === p.index));
      const doms = panels.map((p, i) => yDomain(byPanel[i], x0, x1, yconf(p)));
      const shareY = multi && layout === 'grid' && (spec.y || {}).shared !== false && panels.every((p) => yconf(p).scale === yconf(panels[0]).scale);
      if (shareY) {
        const ok = doms.filter(Boolean);
        if (ok.length) {
          const lo = Math.min.apply(null, ok.map((d) => d.lo)), hi = Math.max.apply(null, ok.map((d) => d.hi));
          doms.forEach((d, i) => { if (d) doms[i] = Object.assign({}, d, { lo, hi }); });
        }
      }

      // plan every panel first, so panels that share an x axis can take the widest margins before any is painted
      const plans = panels.map((p, i) => planPanel(p, byPanel[i], doms[i], x0, x1, vis.length));
      const align = multi && (spec.alignX === true || ((spec.alignX == null || spec.alignX === 'auto') && layout === 'stack'));
      if (align) {
        const groups = new Map();
        plans.forEach((pl, i) => {
          if (!pl) return;
          const k = layout === 'stack' ? 0 : i % cols;
          const g = groups.get(k) || { ml: 0, mr: 0 };
          g.ml = Math.max(g.ml, pl.ml); g.mr = Math.max(g.mr, pl.mr);
          groups.set(k, g);
        });
        plans.forEach((pl, i) => {
          if (!pl) return;
          const g = groups.get(layout === 'stack' ? 0 : i % cols);
          pl.ml = g.ml; pl.mr = g.mr;
        });
      }
      geo = panels.map((p, i) => paintPanel(plans[i], x0, x1));
      setHover(hoverIds ? Array.from(hoverIds) : null);
      // keep a visible crosshair through a redraw
      if (cursor) {
        const t = snap(cursor.t);
        if (t == null) cursor = null; else cursor.t = t;
      }
      renderCursor(false);
    }

    // sizes, scales, ticks and margins of one panel; null when there is nothing to paint
    function planPanel(p, ps, dom, x0, x1, nVisible) {
      const stage = p.stage;
      if (p.svg) { p.svg.remove(); p.svg = null; }
      const Wp = stage.clientWidth, Hp = stage.clientHeight;
      if (Wp < 40 || Hp < 60) { p.empty.hidden = true; return null; }
      const yc = yconf(p);
      if (!dom) {
        p.empty.textContent = nVisible === 0 && series.some((s) => s.last != null) ? 'Every series is hidden. Turn one on in the key above.' : (spec.empty || 'No data in this range.');
        p.empty.hidden = false;
        return null;
      }
      p.empty.hidden = true;

      const mt = yc.title ? 20 : 10, mb = 24, ph = Hp - mt - mb;
      if (ph < 30) return null;
      const log = dom.log;
      // y range and ticks
      let lo = dom.lo, hi = dom.hi, tickVals, tickFn;
      const fmt = makeFmt(yc.fmt || 'n1');
      if (log) {
        // a log axis over less than a factor of four reads like a linear one, and decade ticks would leave one or two labels
        tickVals = hi / lo < 4 ? niceTicks(lo, hi, clamp(Math.floor(ph / 46), 2, 8)).filter((v) => v > 0) : logTicks(lo, hi, ph).map((d) => d.v);
        const maxAbs = Math.max(Math.abs(lo), Math.abs(hi));
        if (typeof yc.tickFmt === 'function') tickFn = yc.tickFmt;
        else if (fmt.custom) tickFn = fmt.value;
        else {
          const minT = Math.min.apply(null, tickVals.filter((v) => v > 0).concat([Infinity]));
          const f = fmt.tick(maxAbs, isFinite(minT) ? minT : 1);
          tickFn = (v) => trimZeros(f(v));
        }
      } else {
        const count = clamp(Math.floor(ph / 46), 2, 8);
        const nd = niceDomain(lo, hi, count);
        if (!dom.fixedLo) lo = nd[0];
        if (!dom.fixedHi) hi = nd[1];
        tickVals = niceTicks(lo, hi, count);
        const step = tickVals.length > 1 ? tickVals[1] - tickVals[0] : nd[2];
        tickFn = typeof yc.tickFmt === 'function' ? yc.tickFmt : fmt.custom ? fmt.value : fmt.tick(Math.max(Math.abs(lo), Math.abs(hi)), step);
      }
      const Y = log
        ? (v) => ph - ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * ph
        : (v) => ph - ((v - lo) / (hi - lo)) * ph;
      const tickLabels = tickVals.map((v) => tickFn(v));
      const labW = Math.max.apply(null, tickLabels.map((t) => textWidth(t)).concat([10]));
      const ml = clamp(Math.ceil(labW) + 12, 30, 96);

      const plan = planEndLabels(p, ps, Y, ph, x0, x1, Wp, fmt.value, log);
      const mr = plan ? plan.mr : 14;
      if (Wp - ml - mr < 60) return null;
      return { p, ps, stage, Wp, Hp, yc, mt, ph, log, lo, hi, tickVals, tickLabels, Y, fmt, plan, ml, mr };
    }

    function paintPanel(pl, x0, x1) {
      if (!pl) return null;
      const { p, ps, stage, Wp, Hp, yc, mt, ph, log, lo, hi, tickVals, tickLabels, Y, fmt, plan, ml, mr } = pl;
      const pw = Wp - ml - mr;
      if (pw < 60) return null;
      const X = (t) => ((t - x0) / (x1 - x0)) * pw;

      const svg = sv('svg', { class: 'ts-svg', width: Wp, height: Hp, viewBox: '0 0 ' + Wp + ' ' + Hp, 'aria-hidden': 'true' });
      const g = sv('g', { transform: 'translate(' + ml + ',' + mt + ')' });
      svg.appendChild(g);
      const clipId = uid + '-' + p.index + '-clip';
      svg.appendChild(sv('defs', null, [sv('clipPath', { id: clipId }, [sv('rect', { x: 0, y: -2, width: pw, height: ph + 4 })])]));

      // grid and y labels
      tickVals.forEach((v, i) => {
        const yy = Math.round(Y(v)) + 0.5;
        if (yy < -1 || yy > ph + 1) return;
        g.appendChild(sv('line', { class: 'ts-grid', x1: 0, x2: pw, y1: yy, y2: yy }));
        const tx = sv('text', { x: -8, y: yy, dy: '0.32em', 'text-anchor': 'end' });
        tx.textContent = tickLabels[i];
        g.appendChild(tx);
      });
      if (yc.title) {
        const tt = sv('text', { class: 'ts-ytitle', x: 0, y: -6 });
        tt.textContent = yc.title;
        g.appendChild(tt);
      }
      // zero line (a column chart and any axis that crosses zero)
      if (!log && lo < 0 && hi > 0 && yc.zeroLine !== false) g.appendChild(sv('line', { class: 'ts-zero', x1: 0, x2: pw, y1: Math.round(Y(0)) + 0.5, y2: Math.round(Y(0)) + 0.5 }));
      g.appendChild(sv('line', { class: 'ts-axisline', x1: 0, x2: pw, y1: ph + 0.5, y2: ph + 0.5 }));
      // x ticks
      xTicks(x0, x1, pw).forEach((tk, i, arr) => {
        const xx = X(tk.t);
        g.appendChild(sv('line', { class: 'ts-axisline', x1: xx, x2: xx, y1: ph, y2: ph + 4 }));
        const anchor = xx < 14 ? 'start' : (xx > pw - 14 && i === arr.length - 1 ? 'end' : 'middle');
        const tx = sv('text', { x: xx, y: ph + 18, 'text-anchor': anchor });
        tx.textContent = tk.label;
        g.appendChild(tx);
      });

      // reference lines; a label goes where it covers no series line and no other label
      const labelBoxes = [];
      let obstacles = null;
      (spec.refLines || []).forEach((rl) => {
        if ((rl.panel != null && String(rl.panel) !== p.id) || !fin(rl.y)) return;
        if (rl.y < lo || rl.y > hi || (log && rl.y <= 0)) return;
        const yy = Math.round(Y(rl.y)) + 0.5;
        g.appendChild(sv('line', { class: rl.kind === 'zero' ? 'ts-zero' : 'ts-refline', x1: 0, x2: pw, y1: yy, y2: yy }));
        if (rl.label) {
          if (!obstacles) obstacles = lineObstacles(ps, x0, x1, X, Y, log);
          const at = placeRefLabel(rl, yy, pw, ph, obstacles, labelBoxes);
          const tx = sv('text', { class: 'ts-reflabel', x: at.x, y: at.y, 'text-anchor': at.anchor });
          tx.textContent = rl.label;
          g.appendChild(tx);
        }
      });

      // shaded area between two lines
      const clipped = sv('g', { 'clip-path': 'url(#' + clipId + ')' });
      g.appendChild(clipped);
      (spec.between || []).forEach((bt) => {
        const a = ps.find((s) => s.id === String(bt.a)), b = ps.find((s) => s.id === String(bt.b));
        if (!a || !b) return;
        const mb2 = new Map();
        b.pts.forEach((q) => { if (q.v != null) mb2.set(Math.round(q.t * 1e6), q.v); });
        let run = [];
        const flush = () => {
          if (run.length > 1) {
            const top = run.map((q) => r1(X(q.t)) + ',' + r1(Y(q.a))), bot = run.slice().reverse().map((q) => r1(X(q.t)) + ',' + r1(Y(q.b)));
            clipped.appendChild(sv('path', { class: 'ts-between', d: 'M' + top.join('L') + 'L' + bot.join('L') + 'Z' }));
          }
          run = [];
        };
        a.pts.forEach((q) => {
          const bv = q.v == null ? undefined : mb2.get(Math.round(q.t * 1e6));
          if (q.v == null || bv === undefined || (log && (q.v <= 0 || bv <= 0))) { flush(); return; }
          run.push({ t: q.t, a: q.v, b: bv });
        });
        flush();
      });

      // series, quiet ones first
      const sorted = ps.slice().sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.order - b.order);
      const dots = new Map();
      const marks = sv('g');
      sorted.forEach((s) => {
        const grp = sv('g', { class: 'ts-s', 'data-id': s.id, 'data-role': s.role });
        grp.style.setProperty('--c', s.color);
        const i0 = lowerBound(s.pts, x0 - EPS) - 1, i1 = lowerBound(s.pts, x1 + EPS);
        if (s.type === 'column') {
          const slot = Math.abs(X(x0 + s.step) - X(x0)), w = clamp(slot - 2, 1, 24), yb = Y(0);
          for (let i = Math.max(0, i0 + 1); i <= Math.min(s.pts.length - 1, i1 - 1); i++) {
            const q = s.pts[i];
            if (q.v == null || q.t < x0 - EPS || q.t > x1 + EPS) continue;
            const c = q.v >= 0 ? (s.colorPos || s.color) : (s.colorNeg || s.color);
            const path = sv('path', { class: 'ts-col', d: colPath(X(q.t + s.step / 2) - w / 2, w, yb, Y(q.v), 4) });
            path.style.setProperty('fill', c);
            grp.appendChild(path);
          }
          clipped.appendChild(grp);
          return;
        }
        const runs = buildRuns(s.pts, i0, i1, X, Y, log, s.gapYears);
        if (!s.noLine) {
          const d = runs.filter((r) => r.length > 1).map((r) => 'M' + r.map((q) => r1(q[0]) + ',' + r1(q[1])).join('L')).join('');
          if (d) grp.appendChild(sv('path', { class: 'ts-ln', d }));
          runs.filter((r) => r.length === 1).forEach((r) => grp.appendChild(sv('circle', { class: 'ts-solo', cx: r1(r[0][0]), cy: r1(r[0][1]), r: 3 })));
        }
        clipped.appendChild(grp);
        // markers live outside the clip so an end marker on the right edge is whole
        const mg = sv('g', { class: 'ts-s', 'data-id': s.id, 'data-role': s.role });
        mg.style.setProperty('--c', s.color);
        if (s.markAll || s.noLine) {
          runs.forEach((r) => r.forEach((q) => {
            if (q[0] < -1 || q[0] > pw + 1) return;
            mg.appendChild(sv('path', { class: 'ts-mk' + (s.hollow ? ' hollow' : ''), d: SHAPE_PATH[s.shape], transform: 'translate(' + r1(q[0]) + ' ' + r1(q[1]) + ') scale(.8)' }));
          }));
        } else if (s.endMarker !== false && s.role !== 'context' && s.role !== 'guide') {
          let lastRun = null;
          for (let i = runs.length - 1; i >= 0 && !lastRun; i--) if (runs[i].length) lastRun = runs[i];
          if (lastRun) {
            const q = lastRun[lastRun.length - 1];
            if (q[0] >= -1 && q[0] <= pw + 1) mg.appendChild(sv('path', { class: 'ts-mk' + (s.hollow ? ' hollow' : ''), d: SHAPE_PATH[s.shape], transform: 'translate(' + r1(q[0]) + ' ' + r1(q[1]) + ')' }));
          }
        }
        marks.appendChild(mg);
      });
      g.appendChild(marks);

      // end labels with leaders
      if (plan) {
        plan.items.forEach((it) => {
          const lg = sv('g', { class: 'ts-endlabel ts-s', 'data-id': it.s.id, 'data-role': it.s.role });
          lg.style.setProperty('--c', it.s.color);
          const ex = X(it.p.t) + 8, lx = pw + 14, ly = it.ly, shifted = Math.abs(it.ly - it.y) > 1.5;
          lg.appendChild(sv('path', { class: 'ts-leader', d: shifted ? 'M' + r1(ex) + ',' + r1(it.y) + 'L' + r1(pw + 6) + ',' + r1(it.y) + 'L' + r1(lx - 2) + ',' + r1(ly) : 'M' + r1(ex) + ',' + r1(it.y) + 'L' + r1(lx - 2) + ',' + r1(it.y) }));
          const tx = sv('text', { x: lx + 2, y: ly, dy: '0.32em' });
          tx.appendChild(document.createTextNode(it.name + ' '));
          const tv = sv('tspan', { class: 'ts-ev' });
          tv.textContent = it.val;
          tx.appendChild(tv);
          lg.appendChild(tx);
          g.appendChild(lg);
        });
      }

      // crosshair and dots
      const cur = sv('g', { class: 'ts-cursor', visibility: 'hidden' });
      const vline = sv('line', { class: 'ts-vline', y1: 0, y2: ph });
      cur.appendChild(vline);
      ps.forEach((s) => {
        if (s.type === 'column' || s.role === 'context') return;
        const c = sv('circle', { class: 'ts-cdot', r: 4.5, visibility: 'hidden' });
        c.style.setProperty('--c', s.role === 'ref' ? 'var(--ink-2)' : s.color);
        cur.appendChild(c);
        dots.set(s.id, c);
      });
      g.appendChild(cur);
      const overlay = sv('rect', { class: 'ts-overlay', x: 0, y: 0, width: pw, height: ph });
      g.appendChild(overlay);
      stage.appendChild(svg);
      p.svg = svg;

      const info = { panel: p, stage, svg, ml, mt, pw, ph, X, Y, x0, x1, cur, vline, dots, lo, hi, log, tickVals, endLabels: plan ? plan.items.map((it) => it.s.id) : [], mr };
      const tOf = (e) => {
        const r = overlay.getBoundingClientRect();
        return x0 + ((e.clientX - r.left) / Math.max(1, r.width)) * (x1 - x0);
      };
      const move = (e) => {
        const t = snap(tOf(e));
        if (t == null) return;
        setCursorT(t, p.index, false, e.pointerType || 'mouse');
      };
      overlay.addEventListener('pointermove', move);
      overlay.addEventListener('pointerdown', (e) => { try { wrap.focus({ preventScroll: true }); } catch (err) { /* old browser */ } move(e); });
      overlay.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && cursor && !cursor.kb) hideCursor(); });
      return info;
    }

    /* -- crosshair -- */
    function buildTimes(x0, x1) {
      const set = new Set();
      series.forEach((s) => {
        if (!isVisible(s) || s.role === 'context') return;
        s.pts.forEach((q) => { if (q.v != null && q.t >= x0 - EPS && q.t <= x1 + EPS) set.add(Math.round(q.t * 1e6)); });
      });
      times = Array.from(set).sort((a, b) => a - b).map((k) => k / 1e6);
    }
    function snap(t) {
      if (!times.length) return null;
      let lo = 0, hi = times.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] < t) lo = mid; else hi = mid; }
      return Math.abs(times[lo] - t) <= Math.abs(times[hi] - t) ? times[lo] : times[hi];
    }
    function stepTime(t, dir, big) {
      if (!times.length) return null;
      let i = 0;
      while (i < times.length - 1 && times[i] < t - EPS) i++;
      if (Math.abs(times[i] - t) > EPS && times[i] > t) i = dir > 0 ? i : Math.max(0, i - 1);
      if (!big) return times[clamp(i + dir, 0, times.length - 1)];
      const target = t + dir;
      if (dir > 0) { for (let j = i; j < times.length; j++) if (times[j] >= target - EPS) return times[j]; return times[times.length - 1]; }
      for (let j = i; j >= 0; j--) if (times[j] <= target + EPS) return times[j];
      return times[0];
    }
    function pointAt(s, t) {
      const i = lowerBound(s.pts, t - EPS);
      for (let j = i; j < s.pts.length && s.pts[j].t <= t + EPS; j++) if (s.pts[j].v != null) return { p: s.pts[j], carried: false };
      if (s.carry) {
        for (let j = Math.min(s.pts.length - 1, i); j >= 0; j--) {
          const q = s.pts[j];
          if (q.t > t + EPS || q.v == null) continue;
          return t - q.t < s.step - EPS ? { p: q, carried: true } : null;
        }
      }
      return null;
    }
    function computeRows(t) {
      const out = panels.map(() => []);
      let finest = Infinity;
      series.forEach((s) => { if (isVisible(s) && s.role !== 'context') finest = Math.min(finest, s.step); });
      series.forEach((s) => {
        if (!isVisible(s) || s.role === 'context') return;
        const hit = pointAt(s, t);
        const fmtS = s.fmt ? makeFmt(s.fmt) : makeFmt((yconf(panels[s.panelIdx]) || {}).fmt || 'n1');
        if (hit) {
          const q = hit.p;
          let row = { id: s.id, name: s.name, color: s.role === 'ref' ? 'var(--ink-2)' : s.color, shape: s.shape, role: s.role, type: s.type, v: q.v, text: fmtS.value(q.v), sub: null, tag: hit.carried ? q.label : null, panel: s.panelIdx };
          if (s.type === 'column') row.color = q.v >= 0 ? (s.colorPos || s.color) : (s.colorNeg || s.color);
          if (typeof spec.readout === 'function') {
            const r = spec.readout(s, q, { t, carried: hit.carried, series: s });
            if (r === false) return;
            if (r) { if (r.text != null) row.text = r.text; if (r.sub != null) row.sub = r.sub; if (r.tag != null) row.tag = r.tag; }
          }
          out[s.panelIdx].push(row);
        } else if (s.step <= finest + EPS && t > s.first + EPS && t < s.last - EPS) {
          out[s.panelIdx].push({ id: s.id, name: s.name, color: s.color, shape: s.shape, role: s.role, type: s.type, v: null, text: 'no data', sub: null, tag: null, panel: s.panelIdx });
        }
      });
      out.forEach((rows) => rows.sort((a, b) => (b.v == null ? -Infinity : b.v) - (a.v == null ? -Infinity : a.v)));
      return out;
    }
    function titleAt(t) {
      let best = null;
      series.forEach((s) => {
        if (!isVisible(s) || s.role === 'context') return;
        const hit = pointAt(s, t);
        if (hit && !hit.carried && (!best || s.step < best.step)) best = { step: s.step, label: hit.p.label };
      });
      return best ? best.label : String(Math.round(t * 100) / 100);
    }
    function setCursorT(t, panelIndex, kb, pointerType) {
      cursor = { t, panel: panelIndex || 0, kb: !!kb, pointer: pointerType || null };
      renderCursor(!!kb);
    }
    function hideCursor() {
      cursor = null;
      renderCursor(false);
      if (spec.onCursor) spec.onCursor(null, []);
    }
    function renderCursor(announce) {
      geo.forEach((gi) => { if (gi) gi.cur.setAttribute('visibility', 'hidden'); });
      if (!cursor) { readout.hidden = true; return; }
      const t = cursor.t, all = computeRows(t), pi = clamp(cursor.panel, 0, panels.length - 1);
      const rows = all[pi];
      const anyRows = all.some((r) => r.length);
      if (!anyRows) { readout.hidden = true; return; }
      geo.forEach((gi, i) => {
        if (!gi) return;
        const px = gi.X(t);
        if (px < -1 || px > gi.pw + 1) return;
        gi.cur.setAttribute('visibility', 'visible');
        gi.vline.setAttribute('x1', px); gi.vline.setAttribute('x2', px);
        gi.dots.forEach((c) => c.setAttribute('visibility', 'hidden'));
        all[i].forEach((r) => {
          const c = gi.dots.get(r.id);
          if (!c || r.v == null || (gi.log && r.v <= 0)) return;
          const yy = gi.Y(r.v);
          if (yy < -2 || yy > gi.ph + 2) return;
          c.setAttribute('cx', px); c.setAttribute('cy', yy); c.setAttribute('visibility', 'visible');
        });
      });
      // readout; a keyboard cursor lists every panel (a pointer lists the one under it), so no panel's values go unheard
      U.clear(readout);
      const multi = panels.length > 1;
      const listAll = multi && cursor.kb;
      const shown = listAll ? all.map((r, i) => i).filter((i) => all[i].length) : [pi];
      const cap = listAll ? Math.max(5, Math.floor(14 / Math.max(1, shown.length))) : 14;
      const panelName = (i) => panels[i].title || 'Panel ' + (i + 1);
      if (!listAll && multi && panels[pi].title) readout.appendChild(h('div', { class: 'ts-ro-panel', text: panels[pi].title }));
      readout.appendChild(h('div', { class: 'ts-ro-title', text: titleAt(t) }));
      shown.forEach((i) => {
        let box = readout;
        if (listAll) {
          box = h('div', { class: 'ts-ro-group' });
          box.appendChild(h('div', { class: 'ts-ro-panel', text: panelName(i) }));
          readout.appendChild(box);
        }
        readoutRows(all[i], box, cap);
      });
      readout.hidden = false;
      // place beside the crosshair, flipping at the right edge
      const gi = geo[pi] || geo.find(Boolean);
      if (gi) {
        const wr = wrap.getBoundingClientRect(), sr = gi.stage.getBoundingClientRect();
        const rw = readout.offsetWidth, rh = readout.offsetHeight;
        const sx = sr.left - wr.left + gi.ml + gi.X(t);
        let left = sx + 14;
        if (left + rw > wrapWidth() - 4) left = sx - 14 - rw;
        const top = sr.top - wr.top + gi.mt + 6;
        readout.style.left = Math.max(4, left) + 'px';
        readout.style.top = Math.max(4, Math.min(top, Math.max(4, wr.height - rh - 4))) + 'px';
      }
      const say = (list, n) => list.slice(0, n).map((r) => r.name + ' ' + r.text);
      const msg = listAll
        ? titleAt(t) + '. ' + shown.map((i) => panelName(i) + ': ' + say(all[i], 5).join(', ')).join('. ')
        : titleAt(t) + '. ' + say(rows, 4).join('. ');
      if (announce) {
        live.textContent = msg;
        if (spec.announce) spec.announce(msg);
      }
      if (spec.onCursor) spec.onCursor(t, rows, all);
    }
    // one panel's rows as a list inside parent; more than cap rows end with a note
    function readoutRows(rows, parent, cap) {
      const ul = h('ul', { class: 'ts-ro-rows' });
      rows.slice(0, cap).forEach((r) => {
        const col = r.type === 'column'
          ? sv('svg', { class: 'ts-ro-key', viewBox: '0 0 22 12', 'aria-hidden': 'true' }, [sv('rect', { x: 5, y: 1, width: 12, height: 10, rx: 2 })])
          : sv('svg', { class: 'ts-ro-key' + (r.role === 'ref' ? ' ts-k-ref' : r.role === 'guide' ? ' ts-k-guide' : ''), viewBox: '0 0 22 12', 'aria-hidden': 'true' }, [
            sv('line', { x1: '1', y1: '6', x2: '21', y2: '6' }),
            r.role === 'guide' ? null : sv('path', { d: SHAPE_PATH[r.shape], transform: 'translate(11 6) scale(.6)' }),
          ]);
        col.style.setProperty('--c', r.color);
        const nm = h('span', { class: 'ts-ro-name' }, [r.name]);
        if (r.tag) nm.appendChild(h('span', { class: 'ts-ro-tag', text: r.tag }));
        const li = h('li', { class: r.v == null ? 'ts-ro-na' : null }, [col, nm, h('span', { class: 'ts-ro-val', text: r.text })]);
        if (r.sub) li.appendChild(h('span', { class: 'ts-ro-sub', text: r.sub }));
        ul.appendChild(li);
      });
      parent.appendChild(ul);
      if (rows.length > cap) parent.appendChild(h('div', { class: 'ts-ro-note', text: '+' + (rows.length - cap) + ' more in the table' }));
    }
    function wrapWidth() { return wrap.clientWidth; }

    /* -- keyboard and touch -- */
    wrap.addEventListener('keydown', (e) => {
      if (e.target !== wrap) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].indexOf(k) >= 0) {
        e.preventDefault();
        if (!times.length) return;
        let t;
        if (k === 'Home') t = times[0];
        else if (k === 'End') t = times[times.length - 1];
        else if (!cursor) t = times[times.length - 1];
        else t = stepTime(cursor.t, k === 'ArrowRight' || k === 'PageDown' ? 1 : -1, e.shiftKey || k === 'PageUp' || k === 'PageDown');
        if (t != null) setCursorT(t, cursor ? cursor.panel : 0, true);
      } else if (k === 'Escape' && cursor) { e.preventDefault(); hideCursor(); }
    });
    wrap.addEventListener('focus', () => {
      let kb = true;
      try { kb = wrap.matches(':focus-visible'); } catch (err) { /* assume keyboard */ }
      if (kb && !cursor && times.length) setCursorT(times[times.length - 1], 0, true);
    });
    wrap.addEventListener('blur', () => { if (cursor && cursor.kb) hideCursor(); });
    function outside(e) { if (cursor && !cursor.kb && !wrap.contains(e.target)) hideCursor(); }
    document.addEventListener('pointerdown', outside);

    /* -- table and csv -- */
    function tableModel(opts) {
      const o = opts || {}, rg = o.range || currentRange();
      const list = series.filter((s) => s.last != null && !hidden.has(s.id) && (o.context || s.role !== 'context'));
      const byT = new Map();
      list.forEach((s) => s.pts.forEach((q) => {
        if (q.v == null || q.t < rg[0] - EPS || q.t > rg[1] + EPS) return;
        const k = Math.round(q.t * 1e6);
        let e = byT.get(k);
        if (!e) { e = { t: q.t, step: q.step, label: q.label, vals: {} }; byT.set(k, e); }
        if (q.step < e.step) { e.step = q.step; e.label = q.label; }
        e.vals[s.id] = q.v;
      }));
      const rows = Array.from(byT.values()).sort((a, b) => (o.order === 'asc' ? a.t - b.t : b.t - a.t));
      return { list, rows };
    }
    function table(opts) {
      const m = tableModel(opts);
      const fmts = m.list.map((s) => (s.fmt ? makeFmt(s.fmt) : makeFmt((yconf(panels[s.panelIdx]) || {}).fmt || 'n1')).value);
      return {
        caption: (spec.table && spec.table.caption) || (spec.title ? spec.title + ', by period' : 'Chart data, by period'),
        columns: [{ label: 'Period' }].concat(m.list.map((s) => ({ label: s.name + (s.unit ? ' (' + s.unit + ')' : '') }))),
        rows: m.rows.map((e) => [e.label].concat(m.list.map((s, i) => (own(e.vals, s.id) ? fmts[i](e.vals[s.id]) : null)))),
        filename: (spec.table && spec.table.filename) || 'chart-data.csv',
      };
    }
    function mountTable(el, opts) {
      const t = table(opts);
      el.classList.add('tableview');
      U.table(el, t.caption, t.columns, t.rows);
      return t;
    }
    function csv(opts) {
      const m = tableModel(Object.assign({ order: 'asc' }, opts));
      const lines = [['Period'].concat(m.list.map((s) => s.name + (s.unit ? ' (' + s.unit + ')' : ''))).map(csvCell).join(',')];
      m.rows.forEach((e) => lines.push([e.label].concat(m.list.map((s) => (own(e.vals, s.id) ? +e.vals[s.id].toPrecision(10) : null))).map(csvCell).join(',')));
      return lines.join('\r\n') + '\r\n';
    }
    function downloadCsv(name) {
      const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name || (spec.table && spec.table.filename) || 'chart-data.csv' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* -- public -- */
    function setRange(a, b) {
      if (a == null || b == null) range = null;
      else {
        const pa = parseX(a), pb = parseX(b);
        if (!pa || !pb) return;
        const lo = pa.t, hi = pb.freq === 'A' ? pb.t + 1 : pb.t + pb.step;
        range = hi > lo ? [lo, hi] : null;
      }
      draw();
    }
    // keys that change the panel containers; a key counts when it is present in the patch, whatever its value (null clears it)
    const STRUCT_KEYS = ['series', 'panels', 'height', 'panelHeight', 'title'];
    function update(patch) {
      const before = structureSig();
      prepare(Object.assign({}, spec, patch || {}), true);
      const touched = !!patch && STRUCT_KEYS.some((k) => own(patch, k));
      const intact = panelsEl.children.length === panels.length && panels.every((p) => p.stage && p.el && p.el.parentNode === panelsEl);
      if (touched || !intact || structureSig() !== before) structure();
      renderLegend();
      draw();
    }
    function setHidden(ids) {
      hidden = new Set((ids || []).map(String));
      renderLegend();
      draw();
    }
    function setCursor(t) {
      if (t == null) { hideCursor(); return; }
      const px = parseX(t), tt = px ? px.t : t;
      const s = fin(tt) ? snap(tt) : null;
      if (s != null) setCursorT(s, 0, false);
    }
    function state() {
      return {
        range: lastRange.slice(), visible: series.filter(isVisible).map((s) => s.id), hidden: Array.from(hidden), times: times.length,
        cursor: cursor ? { t: cursor.t, panel: cursor.panel, kb: cursor.kb } : null, width: lastW, cols: lastCols,
        panels: geo.map((gi, i) => gi ? { id: panels[i].id, lo: gi.lo, hi: gi.hi, log: gi.log, ticks: gi.tickVals.slice(), ml: gi.ml, mr: gi.mr, pw: gi.pw, ph: gi.ph, endLabels: gi.endLabels } : { id: panels[i].id, drawn: false }),
      };
    }
    function destroy() {
      destroyed = true;
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      clearTimeout(timer);
      clearTimeout(retryTimer);
      if (onWinResize) window.removeEventListener('resize', onWinResize);
      if (onVisible) { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onVisible); }
      document.removeEventListener('pointerdown', outside);
      U.clear(host);
      host.classList.remove('ts-chart');
    }

    prepare(spec0 || {}, false);
    structure();
    renderLegend();
    draw();
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => {
        const w = wrap.clientWidth;
        if (Math.abs(w - lastW) < 0.5 && w > 0 && geo.some(Boolean)) return;
        clearTimeout(timer);
        timer = setTimeout(draw, 40);
      });
      ro.observe(wrap);
    } else {
      onWinResize = () => { clearTimeout(timer); timer = setTimeout(draw, 60); };
      window.addEventListener('resize', onWinResize);
    }
    // A hidden or throttled tab or pane may not deliver resize callbacks, so also draw when the page becomes visible again and when
    // the chart scrolls into view, if its width has changed or it has not been drawn yet.
    function drawIfStale() {
      if (destroyed) return;
      const w = wrap.clientWidth;
      if (w > 20 && (Math.abs(w - lastW) >= 0.5 || !geo.some(Boolean))) draw();
    }
    onVisible = () => { if (!document.hidden) drawIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((entries) => { if (entries.some((en) => en.isIntersecting)) drawIfStale(); });
      io.observe(wrap);
    }

    return {
      el: host, update, setSeries: (list) => update({ series: list }), setRange, setHidden, setHover, setCursor,
      getCursor: () => (cursor ? cursor.t : null), draw, table, mountTable, csv, downloadCsv, state, destroy,
      focus: () => wrap.focus(),
    };
  }

  /* =====================================================================================
     sparkline: a 12-point grey line with the latest point in the accent
     ===================================================================================== */
  // the plotted points of a sparkline: { v, t } where t is the decimal year of the period, or null when the data carry none
  function sparkPoints(data, n) {
    let items = [];
    (Array.isArray(data) ? data : []).forEach((d) => {
      if (fin(d)) items.push({ v: d, t: null });
      else if (Array.isArray(d) && fin(d[1])) { const px = parseX(d[0]); items.push({ v: d[1], t: px ? px.t : null }); }
      else if (d && typeof d === 'object' && fin(d.v)) items.push({ v: d.v, t: null });
    });
    if (n && items.length > n) {
      const pick = [];
      for (let i = 0; i < n; i++) pick.push(items[Math.round((i * (items.length - 1)) / (n - 1))]);
      items = pick;
    }
    return items;
  }
  function sparkValues(data, n) { return sparkPoints(data, n).map((p) => p.v); }
  function sparkline(host, data, opts) {
    const U = ui(), sv = U.sv;
    const o = Object.assign({ height: 32, points: 12, fmt: 'n1', label: null }, opts);
    let items = sparkPoints(data, o.points), vals = items.map((p) => p.v), ro = null, lastW = -1;
    const onWin = () => { const w = Math.round(host.clientWidth); if (w > 0 && w !== lastW) render(); };
    host.classList.add('ts-spark');
    function render() {
      U.clear(host);
      const W = Math.max(40, Math.round(host.clientWidth || o.width || 120)), H = o.height, pad = 5;
      lastW = W;
      const svg = sv('svg', { class: 'ts-spark-svg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
      const f = makeFmt(o.fmt).value;
      let label = o.label;
      if (!label) label = vals.length ? 'Trend over ' + vals.length + (vals.length === 1 ? ' point' : ' points') + ', from ' + f(vals[0]) + ' to ' + f(vals[vals.length - 1]) : 'No trend data';
      svg.setAttribute('aria-label', label);
      host.appendChild(svg);
      if (vals.length < 2) return;
      const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1;
      // spaced by date when asked and every point has one; otherwise evenly
      const dated = o.timeScale && items.every((p) => p.t != null) && items[items.length - 1].t > items[0].t;
      const t0 = dated ? items[0].t : 0, tSpan = dated ? items[items.length - 1].t - t0 : 1;
      const xOf = (i) => (dated ? pad + ((items[i].t - t0) / tSpan) * (W - 2 * pad) : pad + (i * (W - 2 * pad)) / (vals.length - 1));
      const pts = vals.map((v, i) => [xOf(i), hi === lo ? H / 2 : H - pad - ((v - lo) / span) * (H - 2 * pad)]);
      svg.appendChild(sv('path', { class: 'ts-spark-line', d: 'M' + pts.map((q) => r1(q[0]) + ',' + r1(q[1])).join('L') }));
      const last = pts[pts.length - 1];
      svg.appendChild(sv('circle', { class: 'ts-spark-dot', cx: r1(last[0]), cy: r1(last[1]), r: 3.5 }));
    }
    render();
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(onWin);
      ro.observe(host);
    }
    // a pane that delivers no resize callbacks still redraws when the window changes size
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', onWin);
    return {
      update(d) { items = sparkPoints(d, o.points); vals = items.map((p) => p.v); render(); },
      destroy() { if (ro) ro.disconnect(); if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('resize', onWin); U.clear(host); host.classList.remove('ts-spark'); },
    };
  }

  /* =====================================================================================
     ranked and diverging bars
     ===================================================================================== */
  // value -> 0..1 along the track, for a linear or log scale
  function makeScale(lo, hi, log) {
    if (log) { const a = Math.log(lo), b = Math.log(hi); return (v) => (Math.log(v) - a) / (b - a); }
    return (v) => (v - lo) / (hi - lo);
  }
  // an axis row for the track column; fillAxes() writes its ticks once the width is known. keep is a value that always gets a tick.
  function axisEl(U, lo, hi, log, tickFmt, scale, keep) {
    const h = U.h, span = hi - lo;
    const axis = h('div', { class: 'ts-baxis', 'aria-hidden': 'true' });
    axis._fill = (w0) => {
      U.clear(axis);
      const w = w0 || 300;
      const cand = (n) => {
        let ticks;
        if (log && hi / lo >= 4) {
          const all = logTicks(lo, hi, Math.max(120, w)).map((d) => d.v), every = Math.max(1, Math.ceil(all.length / n));
          ticks = all.filter((v, i) => i % every === 0);
        } else ticks = niceTicks(lo, hi, n);
        if (keep != null && keep >= lo && keep <= hi && ticks.every((v) => Math.abs(v - keep) > 1e-9 * (Math.abs(keep) + 1))) ticks.push(keep);
        return ticks.filter((v) => v >= lo - 1e-9 * span && v <= hi + 1e-9 * span && (!log || v > 0)).sort((x, y) => x - y);
      };
      const label = (v) => trimZeros(tickFmt(v));
      // where a tick label sits: centred on its tick, pushed in at the ends of the track
      const place = (v) => { const lw = textWidth(label(v)); return { lw, x: clamp(clamp(scale(v), 0, 1) * w, lw / 2, Math.max(lw / 2, w - lw / 2)) }; };
      const fits = (ticks) => {
        for (let i = 1; i < ticks.length; i++) {
          const a = place(ticks[i - 1]), b = place(ticks[i]);
          if (b.x - a.x < (a.lw + b.lw) / 2 + 8) return false;
        }
        return true;
      };
      let ticks = cand(2);
      for (let n = 6; n >= 2; n--) { const t = cand(n); if (t.length >= 2 && fits(t)) { ticks = t; break; } }
      ticks.forEach((v) => {
        const sp = h('span', { text: label(v) });
        sp.style.left = r1(place(v).x) + 'px';
        axis.appendChild(sp);
      });
    };
    return h('div', { class: 'ts-baxrow', 'aria-hidden': 'true' }, [h('span'), axis, h('span')]);
  }
  function fillAxes(host) {
    host.querySelectorAll('.ts-baxis').forEach((a) => { if (a._fill) a._fill(a.clientWidth); });
  }

  function rankedBar(host, items0, opts0) {
    const U = ui(), h = U.h;
    let items = Array.isArray(items0) ? items0 : [], o = Object.assign({ sort: 'desc', baseline: 0, scale: 'linear', color: 'var(--accent)', fmt: 'n1', axis: false }, opts0);
    function render() {
      U.clear(host);
      const f = makeFmt(o.fmt).value, base = o.baseline, log = o.scale === 'log';
      let list = items.filter((it) => it && fin(it.value) && (!log || it.value > 0));
      if (o.sort === 'desc') list = list.slice().sort((a, b) => b.value - a.value);
      else if (o.sort === 'asc') list = list.slice().sort((a, b) => a.value - b.value);
      if (fin(o.limit)) list = list.slice(0, o.limit);
      if (!list.length) { host.appendChild(h('p', { class: 'ts-bempty', text: o.empty || 'No data.' })); return; }
      const T = (v) => (log ? Math.log(v / base) : v - base);
      const maxPos = Math.max.apply(null, list.map((it) => Math.max(T(it.value), 0))), maxNeg = Math.max.apply(null, list.map((it) => Math.max(-T(it.value), 0)));
      let lo, hi;
      const tr = (t) => (log ? base * Math.exp(t) : base + t);
      if (maxPos > 0 && maxNeg > 0) { const m = Math.max(maxPos, maxNeg); lo = tr(-m); hi = tr(m); }
      else if (maxNeg > 0) { lo = tr(-maxNeg); hi = base; }
      else { lo = base; hi = tr(maxPos || (log ? 1 : 1)); }
      if (fin(o.min)) lo = o.min;
      if (fin(o.max)) hi = o.max;
      const sc = makeScale(lo, hi, log), pb = clamp(sc(base), 0, 1);
      const ul = h('ul', { class: 'ts-bars', 'aria-label': o.label || null });
      if (o.axis) ul.appendChild(h('li', { 'aria-hidden': 'true' }, [axisEl(U, lo, hi, log, makeFmt(o.axisFmt || o.fmt).tick(Math.max(Math.abs(lo), Math.abs(hi)), (hi - lo) / 5), sc, base)]));
      list.forEach((it) => {
        const p = clamp(sc(it.value), 0, 1), left = Math.min(p, pb), width = Math.abs(p - pb), neg = it.value < base;
        const fill = h('span', { class: 'ts-bfill ' + (neg ? 'ts-neg' : 'ts-pos') });
        fill.style.left = r1(left * 100) + '%';
        fill.style.width = 'max(2px, ' + r1(width * 100) + '%)';
        fill.style.setProperty('--c', it.muted ? 'var(--faint)' : it.color || (neg && o.colorNeg ? o.colorNeg : o.color));
        const track = h('span', { class: 'ts-btrack', 'aria-hidden': 'true' }, [maxNeg > 0 && maxPos > 0 || pb > 0 ? (() => { const b = h('span', { class: 'ts-bbase' }); b.style.left = r1(pb * 100) + '%'; return b; })() : null, fill]);
        const label = h('span', { class: 'ts-blabel', title: it.label }, [it.label || '']);
        if (it.note) label.appendChild(h('small', { text: it.note }));
        const val = h('span', { class: 'ts-bval' }, [it.text != null ? String(it.text) : f(it.value)]);
        if (it.sub) val.appendChild(h('small', { text: it.sub }));
        const cls = 'ts-brow' + (it.strong || (it.color && !it.muted) ? ' ts-strong' : '');
        const row = typeof o.onSelect === 'function'
          ? h('button', { class: cls, type: 'button', 'data-id': it.id, onclick: () => o.onSelect(it.id, it) }, [label, track, val])
          : h('div', { class: cls, 'data-id': it.id }, [label, track, val]);
        ul.appendChild(h('li', null, [row]));
      });
      host.appendChild(ul);
      fillAxes(host);
    }
    let lastW = -1, ro = null;
    render();
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => { const w = Math.round(host.clientWidth); if (w > 0 && w !== lastW) { lastW = w; fillAxes(host); } });
      ro.observe(host);
    }
    return { update(next, nextOpts) { if (next) items = next; if (nextOpts) o = Object.assign(o, nextOpts); render(); }, destroy() { if (ro) ro.disconnect(); U.clear(host); } };
  }

  /* =====================================================================================
     dumbbell: start (hollow) to end (filled) per row
     ===================================================================================== */
  function dumbbell(host, rows0, opts0) {
    const U = ui(), h = U.h;
    let rows = Array.isArray(rows0) ? rows0 : [], o = Object.assign({ sort: 'v1desc', scale: 'linear', color: 'var(--accent)', fmt: 'n1', label0: 'Start', label1: 'Latest', axis: true }, opts0);
    function render() {
      U.clear(host);
      const f = makeFmt(o.fmt).value, log = o.scale === 'log';
      let list = rows.filter((r) => r && fin(r.v0) && fin(r.v1) && (!log || (r.v0 > 0 && r.v1 > 0)));
      if (o.sort === 'v1desc') list = list.slice().sort((a, b) => b.v1 - a.v1);
      else if (o.sort === 'v1asc') list = list.slice().sort((a, b) => a.v1 - b.v1);
      else if (o.sort === 'change') list = list.slice().sort((a, b) => (b.v1 - b.v0) - (a.v1 - a.v0));
      if (fin(o.limit)) list = list.slice(0, o.limit);
      if (!list.length) { host.appendChild(h('p', { class: 'ts-bempty', text: o.empty || 'No data.' })); return; }
      const all = [];
      list.forEach((r) => { all.push(r.v0, r.v1); });
      let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
      if (log) { lo = lo / 1.15; hi = hi * 1.15; }
      else { const span = (hi - lo) || 1; if (lo > 0 && lo < hi * 0.6) lo = 0; else lo = lo - span * 0.05; hi = hi + span * 0.06; const nd = niceDomain(lo, hi, 5); lo = fin(o.min) ? o.min : nd[0]; hi = fin(o.max) ? o.max : nd[1]; }
      if (log) { if (fin(o.min)) lo = o.min; if (fin(o.max)) hi = o.max; }
      const sc = makeScale(lo, hi, log);
      host.appendChild(h('div', { class: 'ts-dkey', 'aria-hidden': 'true' }, [h('span', null, [h('i', { class: 'ts-from' }), o.label0]), h('span', null, [h('i'), o.label1])]));
      const ul = h('ul', { class: 'ts-dumb', 'aria-label': o.title || null });
      if (o.axis) ul.appendChild(h('li', { 'aria-hidden': 'true' }, [axisEl(U, lo, hi, log, makeFmt(o.axisFmt || o.fmt).tick(Math.max(Math.abs(lo), Math.abs(hi)), (hi - lo) / 5), sc)]));
      list.forEach((r) => {
        const a = clamp(sc(r.v0), 0, 1), b = clamp(sc(r.v1), 0, 1);
        const color = r.muted ? 'var(--faint)' : r.color || o.color;
        const bar = h('span', { class: 'ts-dbar' });
        bar.style.left = r1(Math.min(a, b) * 100) + '%';
        bar.style.width = r1(Math.abs(a - b) * 100) + '%';
        const m0 = h('span', { class: 'ts-dmk ts-from' }), m1 = h('span', { class: 'ts-dmk' });
        m0.style.left = r1(a * 100) + '%';
        m1.style.left = r1(b * 100) + '%';
        const track = h('span', { class: 'ts-btrack', 'aria-hidden': 'true' }, [bar, m0, m1]);
        track.style.setProperty('--c', color);
        const label = h('span', { class: 'ts-blabel', title: r.label }, [r.label || '']);
        if (r.note) label.appendChild(h('small', { text: r.note }));
        const txt = r.text != null ? String(r.text) : f(r.v0) + ' to ' + f(r.v1);
        const val = h('span', { class: 'ts-bval' }, [txt]);
        const cls = 'ts-brow' + (r.strong || (r.color && !r.muted) ? ' ts-strong' : '');
        const row = typeof o.onSelect === 'function'
          ? h('button', { class: cls, type: 'button', 'data-id': r.id, onclick: () => o.onSelect(r.id, r) }, [label, track, val])
          : h('div', { class: cls, 'data-id': r.id }, [label, track, val]);
        ul.appendChild(h('li', null, [row]));
      });
      host.appendChild(ul);
      fillAxes(host);
    }
    let lastW = -1, ro = null;
    render();
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => { const w = Math.round(host.clientWidth); if (w > 0 && w !== lastW) { lastW = w; fillAxes(host); } });
      ro.observe(host);
    }
    return { update(next, nextOpts) { if (next) rows = next; if (nextOpts) o = Object.assign(o, nextOpts); render(); }, destroy() { if (ro) ro.disconnect(); U.clear(host); } };
  }

  return {
    version: '1', PALETTE, SHAPE_PATH, SHAPE_ORDER,
    create, sparkline, rankedBar, dumbbell,
    parseX, normPoints, buildRuns, niceTicks, niceDomain, logTicks, xTicks, makeFmt, fmtValue, yDomain, colPath,
  };
});
