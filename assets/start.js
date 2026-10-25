/* Start page: seven computed numbers, a walk through how money works, the claims tested, ten strains, nine ways to run money,
   and the method and sources. All text comes from data/principles.js; every number in it is a {{placeholder}} that
   assets/derive.js computes from data/prices.js, data/debt.js and data/history.js when the page loads. Text always goes in
   through textContent. Needs assets/ui.js (MacroUI), assets/derive.js (MacroDerive) and assets/ts-chart.js (TSChart).

   1. setup, helpers and the number registry
   2. reference numbers, labels, tables
   3. the seven numbers
   4. top of the page
   5. the walk through how money works
   6. claims (cards, figures, the date picker)
   7. strains
   8. money systems
   9. method, figures used, glossary, sources
   10. opening by address hash, tips on numbers, start */
(function () {
  'use strict';

  /* =====================================================================================
     1. setup, helpers and the number registry
     ===================================================================================== */
  const U = window.MacroUI, D = window.MacroDerive, TS = window.TSChart, P = window.PRINCIPLES;
  const Shell = window.MacroShell;

  function bail(title, detail) {
    if (Shell && Shell.fatal) { Shell.fatal(title, detail); return; }
    const m = document.getElementById('main');
    if (m) m.textContent = title + '. ' + detail;
  }
  const lacking = [];
  if (!U) lacking.push('assets/ui.js');
  if (!D) lacking.push('assets/derive.js');
  if (!TS) lacking.push('assets/ts-chart.js');
  if (!P) lacking.push('data/principles.js');
  if (lacking.length) { bail('The page could not load', 'These files did not load: ' + lacking.join(', ') + '. Check your connection, then reload the page.'); return; }

  const h = U.h, sv = U.sv, clear = U.clear;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const $ = (id) => document.getElementById(id);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  const PR = window.MACRO_PRICES || null, DB = window.MACRO_DEBT || null, HI = window.MONEY_HISTORY || null;
  const missingData = [];
  if (!PR) missingData.push('data/prices.js');
  if (!DB) missingData.push('data/debt.js');
  if (!HI) missingData.push('data/history.js');
  const ctx = D.makeContext({ prices: PR, debt: DB, history: HI, alias: P.aliases });

  // a short alias or a series id -> the series id the context knows
  function sid(a) {
    if (own(P.aliases, a)) return P.aliases[a];
    if (own(D.DEFAULT_ALIASES, a)) return D.DEFAULT_ALIASES[a];
    return a;
  }
  const rowsOf = (a) => ctx.series(sid(a)) || [];
  const metaOf = (a) => ctx.meta(sid(a)) || {};

  // "2026-09" -> "Sep 2026", "2026-10-22" -> "22 Oct 2026", "2026-Q1" -> "2026 Q1"
  function when(s) {
    if (s == null) return '';
    s = String(s);
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return +m[3] + ' ' + MON[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) return MON[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-?Q([1-4])$/i.exec(s);
    if (m) return m[1] + ' Q' + m[2];
    return s;
  }

  // every figure that is computed on the page, once each, in order of first use
  const figures = new Map();
  const numInfo = new WeakMap();
  function R(body) {
    const key = String(body).replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
    let r = figures.get(key);
    if (!r) { r = D.resolve(key, ctx); figures.set(key, r); }
    return r;
  }
  // a figure that is computed here by the same arithmetic as another page, not by a placeholder rule
  function synth(key, o) {
    const r = Object.assign({ ok: true, rule: 'computed', series: [], period: null, source: null, asOf: null, label: null }, o);
    if (!figures.has(key)) figures.set(key, r);
    return r;
  }
  function numSpan(r, text) {
    const span = h('span', { class: r.ok ? 'st-n' : 'st-n st-na', text: text != null ? text : r.text });
    numInfo.set(span, r);
    return span;
  }

  // text with {{placeholders}} -> nodes appended to parent: plain text and a span for each number
  function rich(text, parent) {
    const s = text == null ? '' : String(text), re = /\{\{([^{}]*)\}\}/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) appendText(parent, s.slice(last, m.index));
      parent.appendChild(numSpan(R(m[1])));
      last = m.index + m[0].length;
    }
    if (last < s.length) appendText(parent, s.slice(last));
    return parent;
  }
  const el = (tag, cls, text) => rich(text, h(tag, { class: cls }));

  // Jargon: the first use of a glossary term on the page is a link to its entry in the glossary (which opens when followed).
  const TERM_LIST = [
    ['primary balance', 'Primary balance', 'i'], ['primary surplus', 'Primary balance', 'i'], ['r minus g', 'r minus g', 'i'], ['effective interest rate', 'Effective interest rate', 'i'],
    ['debt service ratio', 'Debt service ratio', 'i'], ['seigniorage', 'Seigniorage', 'i'], ['fiat money', 'Fiat money', 'i'], ['Cantillon effect', 'Cantillon effect', 'i'],
    ['Fisher effect', 'Fisher effect', 'i'], ['financial repression', 'Financial repression', 'i'], ['monetary financing', 'Monetary financing', 'i'], ['moral hazard', 'Moral hazard', 'i'],
    ['quantitative easing', 'Quantitative easing', 'i'], ['TIPS', 'TIPS', ''], ['sovereign money', 'Sovereign money', 'i'], ['full-reserve', 'Full-reserve banking', 'i'],
    ['gold exchange standard', 'Gold exchange standard', 'i'], ['currency board', 'Currency board', 'i'], ['general government', 'General and central government', 'i'],
    ['inflation targeting', 'Inflation targeting', 'i'], ['doubling time', 'Doubling time', 'i'], ['hyperinflation', 'Hyperinflation', 'i'], ['purchasing power', 'Purchasing power', 'i'],
  ].filter((t) => (P.glossary || []).some((g) => g.term === t[1])).map((t) => ({ re: new RegExp('\\b' + t[0] + '\\b', t[2]), entry: t[1] }));
  const termSeen = new Set();
  let linkTerms = true;
  const glSlug = (t) => 'gl-' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // text -> nodes appended to parent, the first use of each glossary term being a link
  function appendText(parent, str) {
    let rest = String(str);
    while (rest) {
      let best = null;
      if (linkTerms) {
        TERM_LIST.forEach((t) => {
          if (termSeen.has(t.entry)) return;
          const m = t.re.exec(rest);
          if (m && (!best || m.index < best.m.index)) best = { m, t };
        });
      }
      if (!best) { parent.appendChild(document.createTextNode(rest)); return; }
      if (best.m.index > 0) parent.appendChild(document.createTextNode(rest.slice(0, best.m.index)));
      termSeen.add(best.t.entry);
      parent.appendChild(h('a', { class: 'st-term', href: '#' + glSlug(best.t.entry), title: 'Defined in the glossary: ' + best.t.entry, text: best.m[0] }));
      rest = rest.slice(best.m.index + best.m[0].length);
    }
  }
  const plain = (text) => String(text == null ? '' : text).replace(/\{\{([^{}]*)\}\}/g, (a, b) => R(b).text);
  const hasPh = (text) => /\{\{/.test(String(text));

  /* =====================================================================================
     2. reference numbers, labels, tables
     ===================================================================================== */
  // sources are numbered in order of first use on the page; sources never cited in the text follow
  const refNo = new Map();
  const refOrder = [];
  function seeRefs(list) {
    (list || []).forEach((id) => {
      if (own(P.sources, id) && !refNo.has(id)) { refOrder.push(id); refNo.set(id, refOrder.length); }
    });
  }
  (function numberSources() {
    const stm = (s) => { if (s) seeRefs(s.refs); };
    P.walkthrough.steps.forEach((s) => s.blocks.forEach(stm));
    P.claims.forEach((c) => {
      [c.right, c.notRight, c.disagree].forEach((l) => (l || []).forEach(stm));
      (c.objection || []).forEach(stm);
      seeRefs(c.refs);
    });
    P.fragilities.forEach((f) => { stm(f.why); (f.published || []).forEach(stm); stm(f.counterpoint); stm(f.leaves); seeRefs(f.refs); });
    if (P.fragilitiesHeld) (P.fragilitiesHeld.items || []).forEach(stm);
    (P.systems.readings || []).forEach(stm);
    P.systems.items.forEach((it) => { (it.outcomes || []).forEach(stm); seeRefs(it.refs); });
    seeRefs(Object.keys(P.sources));
  })();

  // a source named in the research and never opened for this page
  const unread = (id) => own(P.sources, id) && P.sources[id].checked === 'cited';
  function refLinks(ids) {
    const list = (ids || []).filter((id) => refNo.has(id));
    if (!list.length) return null;
    const wrap = h('span', { class: 'st-refs' });
    list.forEach((id, i) => {
      const n = refNo.get(id), t = P.sources[id].title + (unread(id) ? ' (not re-read)' : '');
      if (i) wrap.appendChild(h('span', { class: 'sr-only', text: ', ' }));
      wrap.appendChild(h('a', { class: 'st-ref' + (unread(id) ? ' st-ref--unread' : ''), href: '#src-' + id, title: t, 'aria-label': 'Source ' + n + ': ' + t, text: String(n) }));
    });
    return wrap;
  }

  function kindBadge(k) {
    const kd = own(P.kinds, k) ? P.kinds[k] : { word: k, gloss: '' };
    return h('span', { class: 'badge st-kind', 'data-kind': k, title: kd.gloss, text: kd.word });
  }
  function basisBadge(b) {
    const bd = own(P.basis, b) ? P.basis[b] : { word: b, gloss: '' };
    return h('span', { class: 'badge st-badge-' + b, 'data-basis': b, title: bd.gloss, text: bd.word });
  }

  // one statement: its kind, whether it is computed here or a published figure, the text, and its sources
  function stmt(s) {
    const tags = [kindBadge(s.kind)];
    if (s.cited) tags.push(basisBadge('cited'));
    else if (hasPh(s.text)) tags.push(basisBadge('computed'));
    if (s.projection) tags.push(h('span', { class: 'badge st-proj', text: 'Projection' }));
    const p = el('p', 'st-stmt-text', s.text);
    const refs = refLinks(s.refs);
    if (refs) { p.appendChild(document.createTextNode(' ')); p.appendChild(refs); }
    return h('li', { class: 'st-stmt' }, [h('div', { class: 'st-tags' }, tags), p]);
  }
  const stmtList = (list, label) => h('ul', { class: 'st-stmts', 'aria-label': label || null }, (list || []).map(stmt));

  function plainList(list, cls) { return h('ul', { class: cls || 'st-list' }, (list || []).map((t) => el('li', null, t))); }

  // internal pages, same-page anchors and web addresses only
  const PAGE_RE = /^(?:[a-z0-9-]+\.html)?(?:#[A-Za-z0-9_=,.&%-]*)?$/;
  function safeLink(label, href) {
    if (typeof href === 'string' && href && PAGE_RE.test(href)) return h('a', { href, text: label });
    const w = U.safeHref(href);
    return w ? h('a', { href: w, text: label, target: '_blank', rel: 'noopener noreferrer' }) : h('span', { text: label });
  }
  function linkRow(links) {
    if (!links || !links.length) return null;
    return h('div', { class: 'st-links' }, links.map((l) => safeLink(l.label, l.href)));
  }

  // cells: a string (may hold placeholders), a node, null, or { node | text, cls, num }
  function fillCell(cell, v) {
    if (v == null || v === '') { cell.textContent = 'n/a'; cell.classList.add('st-dash'); return; }
    if (typeof v === 'object' && v.nodeType) { cell.appendChild(v); return; }
    if (typeof v === 'object') {
      if (v.cls) v.cls.split(' ').forEach((c) => cell.classList.add(c));
      fillCell(cell, v.node || v.text);
      return;
    }
    if (v === '-') {
      cell.classList.add('st-dash');
      cell.appendChild(h('span', { 'aria-hidden': 'true', text: '-' }));
      cell.appendChild(h('span', { class: 'sr-only', text: 'not applicable' }));
      return;
    }
    rich(v, cell);
  }
  // opts: { caption, sub, cols: [{label, num, meta}], rows: [{cells, bench}], stack }
  function table(opts) {
    const stack = !!opts.stack, cols = opts.cols;
    const t = h('table', { class: 'st-table' + (stack ? ' st-stack' : '') });
    if (stack) t.setAttribute('role', 'table');
    if (opts.caption) {
      const cap = h('caption', null, [opts.caption]);
      if (opts.sub) cap.appendChild(h('small', { text: opts.sub }));
      if (stack) cap.setAttribute('role', 'caption');
      t.appendChild(cap);
    }
    const thead = h('thead'), htr = h('tr');
    cols.forEach((c) => {
      const th = h('th', { scope: 'col', class: c.num ? 'st-r' : null, text: c.label });
      if (stack) th.setAttribute('role', 'columnheader');
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    const tbody = h('tbody');
    if (stack) { thead.setAttribute('role', 'rowgroup'); htr.setAttribute('role', 'row'); tbody.setAttribute('role', 'rowgroup'); }
    opts.rows.forEach((r) => {
      const tr = h('tr', { class: r.bench ? 'st-bench' : null });
      if (stack) tr.setAttribute('role', 'row');
      r.cells.forEach((v, i) => {
        const c = cols[i] || {};
        const cell = i === 0 && opts.rowHeader !== false ? h('th', { scope: 'row' }) : h('td', { 'data-label': c.label });
        if (stack) cell.setAttribute('role', i === 0 && opts.rowHeader !== false ? 'rowheader' : 'cell');
        if (c.num && i > 0) cell.classList.add('st-r');
        if (c.nw && i > 0) cell.classList.add('st-nw');
        if (c.meta && i > 0) cell.classList.add('st-meta');
        fillCell(cell, v);
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
    t.appendChild(thead);
    t.appendChild(tbody);
    return h('div', { class: 'st-tablewrap' }, [t]);
  }

  // a verdict: a shape plus a word, in ink
  function verdictShape(name) {
    const meta = own(P.verdicts, name) ? P.verdicts[name] : null, shape = meta ? meta.shape : 'circle-empty';
    const svg = sv('svg', { class: 'st-vshape', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' });
    if (shape === 'circle-filled') svg.appendChild(sv('circle', { cx: 8, cy: 8, r: 6 }));
    else if (shape === 'circle-half') { svg.appendChild(sv('circle', { cx: 8, cy: 8, r: 6, class: 'st-hollow' })); svg.appendChild(sv('path', { d: 'M8 2A6 6 0 0 0 8 14Z' })); }
    else if (shape === 'square-half') { svg.appendChild(sv('rect', { x: 2, y: 2, width: 12, height: 12, class: 'st-hollow' })); svg.appendChild(sv('rect', { x: 2, y: 2, width: 6, height: 12 })); }
    else if (shape === 'diamond') svg.appendChild(sv('path', { d: 'M8 1.5L14.5 8L8 14.5L1.5 8Z' }));
    else svg.appendChild(sv('circle', { cx: 8, cy: 8, r: 6, class: 'st-hollow' }));
    return svg;
  }
  function verdictChip(name) {
    const meta = own(P.verdicts, name) ? P.verdicts[name] : null;
    return h('span', { class: 'st-verdict', 'data-verdict': name, title: meta ? meta.meaning : null }, [verdictShape(name), h('span', { text: name })]);
  }

  // run one section; a failure in it shows a notice there and leaves the rest of the page alone
  function safe(name, host, fn) {
    try { fn(); } catch (e) {
      if (window.console && console.error) console.error(name, e);
      if (host) host.appendChild(h('div', { class: 'notice' }, [h('p', { text: 'The ' + name + ' section could not be drawn (' + (e && e.message ? e.message : 'unknown error') + ').' })]));
    }
  }

  // a chart with its table twin and CSV; made when a card is first opened
  function figureBox(cfg) {
    const host = h('div', { class: 'st-chart' });
    const tableHost = h('div', { class: 'st-chart-table', hidden: true, tabindex: '0', role: 'region', 'aria-label': cfg.tableLabel || 'Data table' });
    let chart = null, tableOn = false;
    const tbtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', title: 'Show the numbers behind this chart as a table', text: 'Show as table', onclick: () => setTable(!tableOn) });
    const cbtn = h('button', { class: 'btn', type: 'button', text: 'Download CSV', onclick: () => { if (chart) chart.downloadCsv(cfg.csv); } });
    function setTable(on) {
      tableOn = on;
      U.setPressed(tbtn, on);
      host.hidden = on;
      tableHost.hidden = !on;
      if (on && chart) { clear(tableHost); chart.mountTable(tableHost); } else if (chart) chart.draw();
    }
    const root = h('div', { class: 'st-fig' }, [h('div', { class: 'st-fig-title', text: cfg.title }), host, tableHost, cfg.key || null, h('div', { class: 'st-actions' }, [tbtn, cbtn]), cfg.note || null]);
    return { el: root, make(spec) { chart = TS.create(host, spec); return chart; }, get chart() { return chart; } };
  }

  // call fn once, the first time a details element is open
  function onFirstOpen(det, fn) {
    let done = false;
    const go = () => {
      if (done || !det.open) return;
      done = true;
      try { fn(); } catch (e) { if (window.console && console.error) console.error(e); }
    };
    det.addEventListener('toggle', go);
    if (det.open) setTimeout(go, 0);
  }

  const wide = () => !!(window.matchMedia && window.matchMedia('(min-width: 900px)').matches);

  /* =====================================================================================
     3. the six numbers
     ===================================================================================== */
  // the last n valid points of a series: [{key, y, v}, ...]
  function lastPoints(rows, n) { return D.clean(rows).slice(-(n || 12)); }
  // "$22.4 trillion" -> ["$22.4", "trillion"]
  function splitUnit(text) {
    const i = text.indexOf(' ');
    return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
  }
  const winLabel = (w) => (/^latest/i.test(w.label) ? w.label : 'From ' + w.label);

  // real return on 3-month Treasury bills, worked out exactly as the Prices page does it
  const TAX_ASSUMED = 22; // percent, a flat rate taken off the interest: an illustration, not anyone's tax
  function savingsData() {
    const nomA = D.annual(rowsOf('tbill'));
    if (!nomA.length) return null;
    const lastY = +nomA[nomA.length - 1][0];
    const cpiA = D.annual(rowsOf('cpi'), { partial: true }).filter((r) => +r[0] <= lastY);
    const real = D.realReturnSeries(nomA, cpiA);
    if (!real.length) return null;
    // the same arithmetic after a flat tax on the interest
    const taxed = D.realReturnSeries(nomA.map((r) => [r[0], r[1] * (1 - TAX_ASSUMED / 100)]), cpiA);
    const mean = (rows) => (rows.length ? rows.reduce((s, r) => s + r[1], 0) / rows.length : null);
    return {
      real, neg: real.filter((r) => r[1] < 0).length, mean: mean(real), first: real[0], last: real[real.length - 1],
      taxed, taxedNeg: taxed.filter((r) => r[1] < 0).length, taxedMean: mean(taxed), meta: metaOf('tbill'), cpiMeta: metaOf('cpi'),
    };
  }

  // a line of text with figures: strings are text, objects are registered figures with their own tip
  function lineOf(parts) {
    const span = h('span');
    parts.forEach((p) => { if (typeof p === 'string') span.appendChild(document.createTextNode(p)); else span.appendChild(numSpan(p)); });
    return span;
  }
  // lowest and highest value of a series of [key, value] rows: { lo, hi } as clean points
  function extremes(rows) {
    const c = D.clean(rows);
    if (!c.length) return null;
    return { lo: c.reduce((a2, b2) => (b2.v < a2.v ? b2 : a2)), hi: c.reduce((a2, b2) => (b2.v > a2.v ? b2 : a2)) };
  }

  function tileSpecs() {
    const out = [];
    const cpiMeta = metaOf('cpi');

    /* 1 hero: how long prices take to double, over every fixed window, none preferred */
    {
      const ds = P.windows.map((w) => ({ w, d: R('cpi.doubling.' + w.start + '.' + w.end + '|n1'), g: R('cpi.cagr.' + w.start + '.' + w.end + '|p2') })).filter((x) => x.d.ok && x.g.ok);
      if (ds.length) {
        const lo = Math.min.apply(null, ds.map((x) => x.d.value)), hi = Math.max.apply(null, ds.map((x) => x.d.value));
        const glo = Math.min.apply(null, ds.map((x) => x.g.value)), ghi = Math.max.apply(null, ds.map((x) => x.g.value));
        const fits = ds.filter((x) => D.paceVerdict(x.d.value) === 'about').length;
        const items = ds.map((x) => ({ id: x.w.id, label: winLabel(x.w), value: x.d.value, text: x.d.text + ' years', color: 'var(--accent)' }));
        items.push({ id: 'claim', label: 'The claim: 17 years', value: 17, text: '17.0 years', color: 'var(--ink-2)' });
        out.push({
          hero: true, label: 'Time for US consumer prices to double',
          big: D.format(lo, 'n1') + ' to ' + D.format(hi, 'n1'), unit: 'years, depending on the start date', period: ds.length + ' start dates, each to ' + R('cpi.latestperiod').text + ', US CPI-U',
          lines: [
            'The average rise was ' + D.format(glo, 'p2') + ' to ' + D.format(ghi, 'p2') + ' a year. A doubling every 17 years would need {{calc.rate_for_doubling.17|p2}} a year.',
            fits + ' of the ' + ds.length + ' windows give a doubling time within ' + D.PACE_TOLERANCE + ' years of 17. No window is preferred: all are shown.',
          ],
          bars: { caption: 'Years to double, by start date, to ' + (R('cpi.latestperiod').text) + '. The answer depends on the window.', items },
          foot: 'US Bureau of Labor Statistics, CPI-U, all items, not seasonally adjusted (' + (cpiMeta.asOf ? 'newest month ' + when(cpiMeta.asOf) : 'newest month n/a') + ').',
          links: [{ label: 'Prices: the doubling-time calculator', href: 'prices.html#doubling' }, { label: 'Claim 3, tested', href: '#claim-3' }],
        });
      }
    }

    /* 2 broad money */
    {
      const m = R('m2.value.lastfull|usdbn'), parts = splitUnit(m.text);
      const share = D.ratioAligned(rowsOf('m2'), rowsOf('gdp'), { by: 'year', scale: 100 });
      const mm = metaOf('m2');
      out.push({
        label: 'Broad money, US M2', big: parts[0], unit: parts[1], period: m.ok ? 'End of ' + m.period : '',
        lines: ['{{m2.share.gdp.lastfull|p1}} of a year of GDP. It was {{m2.share.gdp.2000|p1}} in 2000 and {{m2.share.gdp.2020|p1}} in 2020. The latest month, August 2026, is in the walk-through below.'],
        spark: { rows: share, fmt: 'p1', label: 'US M2 as a share of GDP in selected years', timeScale: true, note: 'selected years, spaced by date' },
        foot: 'Federal Reserve M2 (FRED M2SL) and BEA GDP, from the Money Over Time history file; selected year-end values, retrieved ' + when(mm.retrieved) + '.',
        links: [{ label: 'Money Over Time: M2 and GDP', href: 'monetary-history.html#v=history&sh=usM2,usGDP' }, { label: 'Claim 2, tested', href: '#claim-2' }],
      });
    }

    /* 3 federal debt */
    {
      const lt = DB && DB.latest && DB.latest.US_DEBT_TOTAL_USD && DB.latest.US_DEBT_TOTAL_USD.US;
      const bn = lt && fin(lt[1]) ? lt[1] / 1e9 : null;
      const txt = bn == null ? 'n/a' : D.format(bn / 1000, 'n2');
      const dm = metaOf('usdebt'), wm = metaOf('wus');
      // the range of the IMF series, so the comparison year is not the only reference point
      const wr = rowsOf('wus'), wex = extremes(wr), wnodes = [];
      if (wex && D.clean(wr).length) {
        const lo = synth('wus.min', { text: D.format(wex.lo.v, 'p1'), value: wex.lo.v, period: wex.lo.key, label: 'US general government gross debt, % of GDP, lowest year', source: wm.source, asOf: wm.asOf, rule: 'min over the years in the series' });
        const hi = synth('wus.max', { text: D.format(wex.hi.v, 'p1'), value: wex.hi.v, period: wex.hi.key, label: 'US general government gross debt, % of GDP, highest year', source: wm.source, asOf: wm.asOf, rule: 'max over the years in the series' });
        wnodes.push(lineOf(['Range since ' + D.clean(wr)[0].key + ': ', lo, ' in ' + wex.lo.key + ' to ', hi, ' in ' + wex.hi.key + '.']));
      }
      if (bn != null) synth('us.debt.latest', { text: D.format(bn / 1000, 'usd2') + ' trillion', value: bn * 1e9, period: when(lt[0]), label: 'US total public debt outstanding', source: dm.source, asOf: dm.asOf, rule: 'latest daily value' });
      out.push({
        label: 'US federal debt', big: bn == null ? 'n/a' : '$' + txt, unit: bn == null ? '' : 'trillion', period: lt ? 'Total public debt outstanding on ' + when(lt[0]) : '',
        lines: [
          'The total includes debt that one part of government owes another. Debt held by the public was {{uspublic.value.latest|p1}} of GDP in fiscal {{uspublic.latestperiod}} (OMB).',
          'General government gross debt was {{wus.value.latest|p1}} of GDP in {{wus.latestperiod}}, the IMF latest figure, which may be an estimate, and {{wus.value.2015|p1}} in 2015.',
        ],
        lineNodes: wnodes,
        spark: { rows: rowsOf('wus'), fmt: 'p1', label: 'US general government gross debt as a share of GDP' },
        foot: 'US Treasury, Fiscal Data (Debt to the Penny); OMB Historical Tables; IMF World Economic Outlook, ' + (wm.asOf ? 'latest figure ' + wm.asOf + ' (the IMF feed does not flag estimates)' : 'October 2026') + '.',
        links: [{ label: 'Debt: federal debt in dollars', href: 'debt.html#usdebt' }, { label: 'Debt: debt as a share of GDP', href: 'debt.html#level' }],
      });
    }

    /* 4 private debt, the other side of the ledger: households and companies, and what service costs */
    {
      const priv = D.align(rowsOf('hhus'), rowsOf('nfcus'), (x, y) => x + y);
      const lastKey = priv.length ? priv[priv.length - 1][0] : null;
      out.push({
        label: 'US household and company debt', big: R('hhus.plus.nfcus.2025|p1').ok ? R('hhus.plus.nfcus.2025|p1').text : 'n/a', unit: 'of GDP', period: 'End of 2025, BIS credit to households plus non-financial companies',
        lines: [
          'It was {{hhus.plus.nfcus.2008|p1}} at the end of 2008. Government credit rose from {{ggus.value.2008|p1}} to {{ggus.value.2025|p1}} over the same years, so all three sectors together went from {{hhus.plus3.nfcus.ggus.2008|p1}} to {{hhus.plus3.nfcus.ggus.2025|p1}}.',
          'Household debt service took {{dsrhhus.value.latest|p1}} of income in {{dsrhhus.latestperiod}}, against {{dsrhhus.value.2007|p1}} in 2007 (BIS).',
        ],
        spark: { rows: priv, fmt: 'p1', label: 'US household plus company credit as a share of GDP' + (lastKey ? ', to ' + lastKey : '') },
        foot: 'BIS total credit statistics (households and companies at market value, government at face value) and BIS debt service ratios.',
        links: [{ label: 'Debt: debt by sector', href: 'debt.html#sectors' }, { label: 'Claim 1, tested', href: '#claim-1' }],
      });
    }

    /* 5 interest */
    {
      const v = R('usnetint.value.latest|n1'), share = D.ratioAligned(rowsOf('usnetint'), rowsOf('usrcpt'), { scale: 100 });
      out.push({
        label: 'US federal net interest', big: v.ok ? '$' + v.text : 'n/a', unit: 'billion', period: v.ok ? 'Net interest outlays, fiscal ' + v.period : '',
        lines: [
          '{{usnetint.share.usrcpt.latest|p1}} of federal receipts, against {{usnetint.share.usrcpt.2021|p1}} in fiscal 2021 and {{usnetint.share.usrcpt.1991|p1}} in fiscal 1991.',
          '{{usnetint.share.usgdpfy.2025|p1}} of GDP in fiscal 2025, the same as in fiscal 1991 ({{usnetint.share.usgdpfy.1991|p1}}), but on debt held by the public of {{uspublic.value.2025|p1}} of GDP against {{uspublic.value.1991|p1}} then.',
        ],
        spark: { rows: share, fmt: 'p1', label: 'US net interest as a share of federal receipts, by fiscal year' },
        foot: 'OMB Historical Tables to fiscal 2025, US Treasury Monthly Treasury Statement for fiscal 2026. Fiscal years end on 30 September.',
        links: [{ label: 'Debt: the federal interest bill', href: 'debt.html#usfederal' }],
      });
    }

    /* 6 a house against income */
    {
      const v = R('house_new_median_annual.per.income.lastfull|n1');
      const ratio = D.ratioAligned(rowsOf('house_new_median_annual'), rowsOf('income'));
      const hm = metaOf('house_new_median_annual'), ex = extremes(ratio);
      const nodes = [];
      if (ex) {
        const src = hm.source, asOf = hm.asOf;
        const lo = synth('house.income.min', { text: D.format(ex.lo.v, 'n1'), value: ex.lo.v, period: ex.lo.key, label: 'Median new house over median household income, lowest year', source: src, asOf, rule: 'min over the years with both' });
        const hi = synth('house.income.max', { text: D.format(ex.hi.v, 'n1'), value: ex.hi.v, period: ex.hi.key, label: 'Median new house over median household income, highest year', source: src, asOf, rule: 'max over the years with both' });
        nodes.push(lineOf(['The range since ' + ratio[0][0] + ': ', lo, ' years in ' + ex.lo.key + ' to ', hi, ' years in ' + ex.hi.key + '.']));
      }
      out.push({
        label: 'The median new house against household income', big: v.ok ? v.text : 'n/a', unit: 'years of income', period: v.ok ? v.period + ', price divided by median household income' : '',
        lines: [
          '{{house_new_median_annual.value.lastfull|usd0}} against {{income.value.lastfull|usd0}} a year. It was {{house_new_median_annual.per.income.1971|n1}} years in 1971.',
          'House prices rose {{hpi.realchange.cpi.1987.2024|p1}} after inflation from 1987 to 2024 on the FHFA index (the claim 4 measure).',
        ],
        lineNodes: nodes,
        spark: { rows: ratio, fmt: 'n1', label: 'Years of median household income needed for the median new house' },
        foot: 'US Census Bureau and HUD new-house sales (annual median); Census CPS ASEC median household income; FHFA house price index. Not adjusted for the size or quality of the house' + (hm.asOf ? '; newest year ' + hm.asOf : '') + '.',
        links: [{ label: 'Prices: homes and land against pay and income', href: 'prices.html#houses' }, { label: 'Claim 4, tested', href: '#claim-4' }],
      });
    }

    /* 7 the Treasury-bill saver after inflation, before tax */
    {
      const s = savingsData();
      if (s) {
        const lastTxt = D.format(s.last[1], 'sgn2') + '%', meanTxt = D.format(s.mean, 'sgn2') + '%';
        const src = s.meta.source || 'Federal Reserve H.15, 3-month Treasury bill';
        const key = (k) => 'savings.' + k;
        const span = s.first[0] + ' to ' + s.last[0];
        synth(key('last'), { text: lastTxt, value: s.last[1], period: s.last[0], label: 'Real return on 3-month Treasury bills', source: src, asOf: s.meta.asOf, rule: 'realreturn' });
        synth(key('mean'), { text: meanTxt, value: s.mean, period: span, label: 'Mean yearly real return on 3-month Treasury bills', source: src, asOf: s.meta.asOf, rule: 'realavg' });
        synth(key('neg'), { text: String(s.neg), value: s.neg, period: span, label: 'Years with a negative real return', source: src, asOf: s.meta.asOf, rule: 'realneg' });
        synth(key('taxedMean'), { text: D.format(s.taxedMean, 'sgn2') + '%', value: s.taxedMean, period: span, label: 'Mean yearly real return after an assumed ' + TAX_ASSUMED + ' percent tax on the interest (illustration)', source: src, asOf: s.meta.asOf, rule: 'realavg on the after-tax rate' });
        synth(key('taxedNeg'), { text: String(s.taxedNeg), value: s.taxedNeg, period: span, label: 'Years with a negative real return after an assumed ' + TAX_ASSUMED + ' percent tax (illustration)', source: src, asOf: s.meta.asOf, rule: 'realneg on the after-tax rate' });
        const gap = R('tbill.yieldgap.' + s.first[0] + '.' + s.last[0] + '|n2');
        const line = lineOf(['Below zero in ', figures.get(key('neg')), ' of the ' + s.real.length + ' years from ' + span + '. The latest year, ' + s.last[0] + ', was ', figures.get(key('last')), '.']);
        const fdic = h('span', null, [basisBadge('cited'), ' The FDIC national average savings rate was 0.38 percent on 19 October 2026 against 3.74 percent inflation, about -3.4 percent a year in real terms.']);
        const tax = lineOf(['With an assumed flat ' + TAX_ASSUMED + ' percent tax on the interest (an illustration, not anyone\'s tax) the average would be ', figures.get(key('taxedMean')), ' and ', figures.get(key('taxedNeg')), ' of the ' + s.taxed.length + ' years would be below zero.']);
        const basis = lineOf(['The bill rate is the published discount rate, which understates the yield a saver earns by about ', gap, ' points a year on average.']);
        out.push({
          label: 'Treasury-bill saver after inflation, before tax', big: meanTxt, unit: 'a year on average, ' + span, period: '3-month Treasury bills, after the rise in consumer prices, before tax; the latest year was ' + lastTxt,
          lineNodes: [line, fdic, tax, basis],
          spark: { rows: s.real, fmt: 'sgn1', label: 'Real return on 3-month Treasury bills, by year' },
          foot: 'Federal Reserve H.15 3-month Treasury bill rate (annual mean) and BLS CPI-U (annual average; ' + s.last[0] + ' uses the months BLS published). One kind of saving: bank deposits, longer bonds and shares are not shown.',
          links: [{ label: 'Prices: real return on savings', href: 'prices.html#savings' }, { label: 'Claim 5, tested', href: '#claim-5' }],
        });
      } else {
        out.push({ label: 'Treasury-bill saver after inflation, before tax', big: 'n/a', unit: '', period: '', lines: ['The bill-rate and price series did not load.'], foot: '', links: [{ label: 'Prices: real return on savings', href: 'prices.html#savings' }] });
      }
    }
    return out;
  }

  function buildNumbers() {
    const host = $('numbers'), pending = [];
    host.appendChild(h('h2', { class: 'st-h2', id: 'numbers-h', tabindex: '-1', text: 'Seven numbers to start from' }));
    host.appendChild(h('p', { class: 'st-lede', text: 'Each number is computed in your browser from the data files on this site. It shows its period and source, and links to the page that charts it and to the claim it bears on. They describe where things stand, and some show pressure while others show where things have held; none is a score, and none is labelled good or bad.' }));
    const grid = h('div', { class: 'st-tiles' });
    tileSpecs().forEach((t, i) => {
      const hid = 'tile-' + (i + 1) + '-h';
      const kids = [
        h('h3', { class: 'st-tile-label', id: hid, text: t.label }),
        h('p', { class: 'st-tile-value' }, [h('span', { class: 'st-big', text: t.big }), t.unit ? h('span', { class: 'st-unit', text: t.unit }) : null]),
        t.period ? h('p', { class: 'st-tile-period', text: t.period }) : null,
      ];
      (t.lines || []).forEach((l) => kids.push(el('p', 'st-tile-line', l)));
      (t.lineNodes || []).forEach((n) => kids.push(h('p', { class: 'st-tile-line' }, [n])));
      if (t.bars) {
        const barHost = h('div');
        kids.push(h('div', { class: 'st-tile-bars' }, [h('p', { class: 'st-tile-bars-cap', text: t.bars.caption }), barHost]));
        pending.push(() => TS.rankedBar(barHost, t.bars.items, { sort: 'none', fmt: 'n1', baseline: 0, color: 'var(--accent)', label: t.bars.caption }));
      }
      if (t.spark && t.spark.rows && t.spark.rows.length >= 2) {
        const sp = h('div', { class: 'st-spark' });
        kids.push(sp);
        const pts = lastPoints(t.spark.rows, 12);
        const fmtv = TS.makeFmt(t.spark.fmt).value;
        const label = t.spark.label + ', ' + pts.length + ' points from ' + pts[0].key + ' to ' + pts[pts.length - 1].key + (t.spark.note ? ' (' + t.spark.note + ')' : '') + ': ' + fmtv(pts[0].v) + ' to ' + fmtv(pts[pts.length - 1].v) + '. The dot is the latest.';
        kids.push(h('p', { class: 'st-spark-cap', 'aria-hidden': 'true', text: pts[0].key + ' to ' + pts[pts.length - 1].key + (t.spark.note ? ', ' + t.spark.note : '') }));
        pending.push(() => TS.sparkline(sp, pts.map((p) => [p.key, p.v]), { fmt: t.spark.fmt, points: 12, height: 32, label, timeScale: !!t.spark.timeScale }));
      }
      kids.push(h('p', { class: 'st-tile-foot' }, [h('span', { class: 'badge st-badge-computed', title: P.basis.computed.gloss, text: P.basis.computed.word }), ' ' + t.foot]));
      if (t.links && t.links.length) kids.push(h('div', { class: 'st-tile-links' }, t.links.map((l) => safeLink(l.label, l.href))));
      grid.appendChild(h('article', { class: 'st-tile' + (t.hero ? ' st-tile--hero' : ''), 'data-i': String(i), 'aria-labelledby': hid }, kids));
    });
    host.appendChild(grid);
    pending.forEach((fn) => { try { fn(); } catch (e) { if (window.console && console.error) console.error(e); } });
  }

  /* =====================================================================================
     4. top of the page
     ===================================================================================== */
  function asOfLine() {
    const dates = [PR && PR.generated, DB && DB.generated, P.asOf].filter(Boolean).sort();
    const newest = dates.length ? dates[dates.length - 1] : '';
    const bits = [];
    const cpi = metaOf('cpi'), house = metaOf('house_new_median'), m2 = HI && HI.series && HI.series.usM2;
    if (cpi.asOf) bits.push('consumer prices ' + when(cpi.asOf));
    if (house.asOf) bits.push('new-house prices ' + when(house.asOf));
    const debt = DB && DB.latest && DB.latest.US_DEBT_TOTAL_USD && DB.latest.US_DEBT_TOTAL_USD.US;
    if (debt) bits.push('federal debt ' + when(debt[0]));
    const bis = DB && DB.latest && DB.latest.TC_GG && DB.latest.TC_GG.US;
    if (bis) bits.push('BIS credit ' + when(bis[0]));
    if (m2 && m2.retrieved) bits.push('money and GDP history retrieved ' + when(m2.retrieved));
    return 'Figures are as of ' + when(newest) + ', the date of the newest data file. Newest observations: ' + (bits.length ? bits.join('; ') : 'n/a') + '. Sources and retrieval dates are in the method section.';
  }

  function buildIntro() {
    const host = $('intro');
    host.appendChild(h('p', { class: 'st-kicker', text: P.title }));
    host.appendChild(h('h2', { class: 'st-scope', id: 'intro-h', tabindex: '-1', text: P.scope }));
    P.intro.forEach((t) => host.appendChild(el('p', 'st-lede', t)));
    if (missingData.length) {
      host.appendChild(h('div', { class: 'notice st-warn', role: 'status' }, [h('p', { text: 'These data files did not load: ' + missingData.join(', ') + '. Every figure that needs them shows n/a. Check your connection, then reload the page.' })]));
    }
    const jumps = [['Seven numbers', '#numbers'], ['How money works', '#how']];
    const nav = h('nav', { class: 'st-jump', 'aria-label': 'On this page' });
    jumps.forEach((j) => nav.appendChild(h('a', { class: 'chip', href: j[1], text: j[0] })));
    nav.appendChild(h('span', { class: 'st-jump-sep', 'aria-hidden': 'true' }));
    P.claims.forEach((c) => nav.appendChild(h('a', { class: 'chip', href: '#' + c.id, title: c.claim, text: 'Claim ' + c.n })));
    nav.appendChild(h('span', { class: 'st-jump-sep', 'aria-hidden': 'true' }));
    [['Strains', '#strains'], ['Money systems', '#systems'], ['Method and sources', '#method']].forEach((j) => nav.appendChild(h('a', { class: 'chip', href: j[1], text: j[0] })));
    host.appendChild(nav);
    const labels = [];
    ['fact', 'trend', 'interpretation'].forEach((k) => labels.push(h('li', null, [kindBadge(k), h('span', { text: P.kinds[k].gloss })])));
    ['computed', 'cited'].forEach((k) => labels.push(h('li', null, [basisBadge(k), h('span', { text: P.basis[k].gloss })])));
    labels.push(h('li', null, [h('span', { class: 'badge', text: 'Keyboard and screen reader' }), h('span', null, ['Every computed figure, with its period and source, is listed in the table ', h('a', { href: '#figures-used', text: 'Figures used on this page' }), ' in the method section; a number in the text also shows them on hover or tap.'])]));
    labels.push(h('li', null, [h('span', { class: 'badge', text: 'Dashed source number' }), h('span', { text: 'A source number with a dashed outline was named in the research and not re-read for this page.' })]));
    const legend = h('details', { class: 'st-details st-legend', id: 'labels' }, [h('summary', { text: 'How statements are labelled' }), h('div', { class: 'st-details-body' }, [h('ul', { class: 'st-labels', 'aria-label': 'How statements are labelled' }, labels)])]);
    legend.open = true;
    host.appendChild(legend);
    host.appendChild(h('p', { class: 'st-fine', id: 'st-asof', text: asOfLine() }));
  }

  /* =====================================================================================
     5. the walk through how money works
     ===================================================================================== */
  function diagramLayers(d) {
    return h('figure', { class: 'st-diagram' }, [
      h('figcaption', null, [d.title, d.note ? h('span', { text: d.note }) : null]),
      h('ul', { class: 'st-layers' }, d.layers.map((l) => h('li', null, [
        h('span', { class: 'st-layer-name', text: l.name }),
        h('span', { class: 'st-layer-meta' }, [h('span', { text: 'Issued by: ' + l.issuer }), h('span', { text: 'Held by: ' + l.holder })]),
      ]))),
    ]);
  }
  function tLines(list) {
    if (!list || !list.length) return [h('li', { class: 'st-t-none', text: 'No change' })];
    return list.map((t) => {
      const m = /^([+-])\s*(.*)$/.exec(t);
      return h('li', { 'data-sign': m ? m[1] : null }, [h('span', { text: m ? m[2] : t })]);
    });
  }
  function diagramAccounts(d) {
    return h('figure', { class: 'st-diagram' }, [
      h('figcaption', null, [d.title, h('span', { text: 'Balance sheets before and after. A plus is a new entry, a minus is an entry removed. L and B stand for any amount.' })]),
      h('div', { class: 'st-parties' }, d.parties.map((p) => h('div', { class: 'st-party' }, [
        h('div', { class: 'st-party-name', text: p.name }),
        h('div', { class: 'st-t' }, [
          h('div', { class: 'st-t-col' }, [h('div', { class: 'st-t-head', text: 'Assets' }), h('ul', null, tLines(p.assets))]),
          h('div', { class: 'st-t-col' }, [h('div', { class: 'st-t-head', text: 'Liabilities' }), h('ul', null, tLines(p.liabilities))]),
        ]),
      ]))),
      d.result ? h('p', { class: 'st-result' }, [h('b', { text: 'Result. ' }), d.result]) : null,
    ]);
  }

  function buildHow() {
    const host = $('how'), W = P.walkthrough;
    host.appendChild(h('h2', { class: 'st-h2', id: 'how-h', tabindex: '-1', text: W.title }));
    host.appendChild(el('p', 'st-lede', W.intro));
    const byId = {};
    (W.diagrams || []).forEach((d) => { byId[d.id] = d; });
    const ol = h('ol', { class: 'st-steps' });
    W.steps.forEach((s) => {
      const body = [h('h3', { class: 'st-h3', text: s.title }), stmtList(s.blocks)];
      const ds = (s.diagrams || []).map((id) => byId[id]).filter(Boolean);
      if (ds.length) body.push(h('div', { class: 'st-diagrams' }, ds.map((d) => (d.layers ? diagramLayers(d) : diagramAccounts(d)))));
      ol.appendChild(h('li', { class: 'st-step', id: s.id }, [h('span', { class: 'st-step-n', 'aria-hidden': 'true', text: String(s.n) }), h('div', { class: 'st-step-body' }, body)]));
    });
    host.appendChild(ol);
  }

  /* =====================================================================================
     6. claims
     ===================================================================================== */
  const debtRows = (ind, iso) => (DB && DB.series && DB.series[ind] && DB.series[ind][iso]) || [];

  // figures for the claim cards; each is made the first time its card opens
  function figClaim1() {
    const mk = (id, name, ind, color, shape) => ({ id, name, short: name, rows: debtRows(ind, 'US'), color, shape, unit: '% of GDP', fmt: 'p1' });
    const box = figureBox({
      title: 'US credit by sector, % of GDP, end of year (BIS)', tableLabel: 'US credit by sector as a table', csv: 'start-us-credit-by-sector.csv',
      note: h('p', { class: 'chart-note', text: 'BIS total credit: loans and debt securities owed by each sector to all lenders. Households and companies are at market value, government at face value. Colours here mean the sector, not a country.' }),
    });
    return {
      el: box.el,
      make() {
        box.make({
          title: 'US credit by sector, percent of GDP',
          series: [mk('hh', 'Households', 'TC_HH', 'var(--c-blue)', 'circle'), mk('nfc', 'Companies (non-financial)', 'TC_NFC', 'var(--c-orange)', 'square'), mk('gg', 'Government', 'TC_GG', 'var(--c-aqua)', 'diamond')],
          y: { scale: 'linear', fmt: 'p1', tickFmt: 'p0', zero: true }, height: 270,
          table: { caption: 'US credit by sector, % of GDP, end of year', filename: 'start-us-credit-by-sector.csv' },
        });
      },
    };
  }
  function figClaim2() {
    const rows = D.ratioAligned(rowsOf('m2'), rowsOf('gdp'), { by: 'year', scale: 100 });
    const box = figureBox({
      title: 'US M2 as a share of GDP, selected years', tableLabel: 'US M2 as a share of GDP as a table', csv: 'start-us-m2-share-of-gdp.csv',
      note: h('p', { class: 'chart-note', text: 'Year-end M2 divided by GDP of the same year. The history file holds selected years, not every year; each dot is one of them and the line joins neighbours without implying values in between.' }),
    });
    return {
      el: box.el,
      make() {
        box.make({
          title: 'US M2 as a share of GDP',
          series: [{ id: 'm2gdp', name: 'M2 as a share of GDP', short: 'M2 / GDP', rows, color: 'var(--c-blue)', shape: 'circle', markAll: true, unit: '% of GDP', fmt: 'p1' }],
          y: { scale: 'linear', fmt: 'p1', tickFmt: 'p0', zero: true }, height: 250, legend: false,
          table: { caption: 'US M2 as a share of GDP, selected years', filename: 'start-us-m2-share-of-gdp.csv' },
        });
      },
    };
  }
  function figClaim3() {
    const roll = D.rollingCagr(rowsOf('cpi'), 10);
    const need = D.rateForDoubling(17) * 100;
    const box = figureBox({
      title: 'Average yearly rise in US consumer prices over the previous ten years', tableLabel: 'Ten-year price growth as a table', csv: 'start-cpi-ten-year-growth.csv',
      note: h('p', { class: 'chart-note', text: 'Each point is the compound growth a year over the ten years to that month. The dotted lines mark the growth that doubles prices in 17 years and the 2 percent a year that many central banks aim for.' }),
    });
    return {
      el: box.el,
      make() {
        box.make({
          title: 'Average yearly rise in US consumer prices over the previous ten years',
          series: [{ id: 'roll', name: 'Average rise a year over the previous 10 years', short: 'CPI-U', rows: roll, color: 'var(--c-blue)', shape: 'circle', unit: '% a year', fmt: 'p2' }],
          refLines: [{ y: need, label: 'Doubling in 17 years: ' + D.format(need, 'p2') + ' a year', kind: 'guide' }, { y: 2, label: '2% a year', kind: 'guide' }],
          y: { scale: 'linear', fmt: 'p2', tickFmt: 'p0', zero: true }, height: 270, legend: false,
          table: { caption: 'Average yearly rise in US consumer prices over the previous ten years, by month', filename: 'start-cpi-ten-year-growth.csv' },
        });
      },
    };
  }
  function figClaim4() {
    const cut = (rows) => D.windowRows(rows, 1975, 2024);
    const idx = (rows) => { const r = D.rebase(cut(rows), '1975', 100); return r ? r.rows : []; };
    const hpi = idx(D.annual(rowsOf('hpi'))), house = idx(D.annual(rowsOf('house_new_median_annual'))), cpi = idx(D.annual(rowsOf('cpi')));
    const box = figureBox({
      title: 'House prices and consumer prices, 1975 = 100', tableLabel: 'House prices and consumer prices as a table', csv: 'start-house-prices-and-cpi.csv',
      note: h('p', { class: 'chart-note', text: 'Annual averages on a log scale, so equal vertical distance means equal percentage change. The two house series are separate sources and are never joined. The median new house is not adjusted for size or quality; the FHFA index follows repeat sales of the same houses.' }),
    });
    // the whole record: each house source divided by consumer prices, on its own base of 100 at the start of its own record
    const cpiA = D.annual(rowsOf('cpi'));
    const real = (rows, y0, y1) => { const r = D.rebase(D.windowRows(D.ratioAligned(D.annual(rows), cpiA), y0, y1), String(y0), 100); return r ? r.rows : []; };
    const shRows = real(rowsOf('shiller'), 1913, 1974), fhRows = real(rowsOf('hpi'), 1975, 2024);
    const box2 = figureBox({
      title: 'House prices after inflation, 1913 to 2024, each source on its own base of 100', tableLabel: 'House prices after inflation as a table', csv: 'start-real-house-prices.csv',
      note: h('p', { class: 'chart-note', text: 'Each line is a house price index divided by consumer prices (CPI-U), annual averages, set to 100 at the first year of that source. The Shiller compilation (proxy, several sources, to 1974) and the FHFA index (from 1975) are separate sources with separate bases and are not joined; compare the shape of each, not the levels. Flat means house prices kept pace with consumer prices.' }),
    });
    return {
      el: h('div', { class: 'st-figs' }, [box.el, box2.el]),
      make() {
        box.make({
          title: 'House prices and consumer prices, 1975 = 100',
          series: [
            { id: 'hpi', name: 'House price index (FHFA, all transactions)', short: 'FHFA index', rows: hpi, color: 'var(--c-blue)', shape: 'circle', unit: '1975 = 100', fmt: 'n0' },
            { id: 'house', name: 'Median new house price (Census and HUD)', short: 'New house', rows: house, color: 'var(--c-orange)', shape: 'square', unit: '1975 = 100', fmt: 'n0' },
            { id: 'cpi', name: 'Consumer prices (CPI-U)', short: 'CPI-U', rows: cpi, color: 'var(--ink-2)', shape: 'diamond', role: 'ref', unit: '1975 = 100', fmt: 'n0' },
          ],
          y: { scale: 'log', fmt: 'n0', tickFmt: 'n0' }, height: 270,
          table: { caption: 'House prices and consumer prices, annual averages, 1975 = 100', filename: 'start-house-prices-and-cpi.csv' },
        });
        box2.make({
          title: 'House prices after inflation, each source on its own base of 100',
          series: [
            { id: 'sh', name: 'Shiller compilation after inflation, 1913 = 100 (to 1974)', short: 'Shiller', rows: shRows, color: 'var(--c-orange)', shape: 'square', unit: '1913 = 100', fmt: 'n0' },
            { id: 'fh', name: 'FHFA index after inflation, 1975 = 100 (from 1975)', short: 'FHFA', rows: fhRows, color: 'var(--c-blue)', shape: 'circle', unit: '1975 = 100', fmt: 'n0' },
          ],
          y: { scale: 'linear', fmt: 'n0', tickFmt: 'n0', zero: false }, height: 250,
          table: { caption: 'House prices divided by consumer prices, annual averages, each source set to 100 at its first year', filename: 'start-real-house-prices.csv' },
        });
      },
    };
  }
  function figClaim5() {
    const s = savingsData();
    const box = figureBox({
      title: 'Real return on 3-month Treasury bills, by year', tableLabel: 'Real return on bills as a table', csv: 'start-real-return-bills.csv',
      key: h('p', { class: 'st-key' }, [h('span', { class: 'swatch', style: '--c: var(--c-blue)' }), ' Positive: the interest beat the rise in prices. ', h('span', { class: 'swatch', style: '--c: var(--c-orange)' }), ' Negative: it did not. The colours mean the sign, not a country.']),
      note: h('p', { class: 'chart-note', text: 'Real return = (1 + bill rate) / (1 + inflation) - 1, with the bill rate the annual mean of the monthly 3-month Treasury bill rate and inflation the change in the annual-average CPI-U. One kind of saving: bank deposits, longer bonds, shares and houses are not shown.' }),
    });
    return {
      el: box.el,
      make() {
        if (!s) { box.el.appendChild(h('p', { class: 'empty', text: 'The bill-rate and price series did not load.' })); return; }
        box.make({
          title: 'Real return on 3-month Treasury bills, by year, United States',
          series: [{ id: 'real', name: 'Real return on 3-month bills', short: 'Real return', color: 'var(--c-blue)', colorPos: 'var(--c-blue)', colorNeg: 'var(--c-orange)', shape: 'square', type: 'column', rows: s.real, unit: '% a year' }],
          y: { scale: 'linear', fmt: (v) => D.format(v, 'sgn1') + '%', tickFmt: (v) => D.format(v, 'sgn0') + '%', title: '% a year', zero: true }, height: 260, legend: false,
          table: { caption: 'Real return on 3-month Treasury bills, % a year, by year', filename: 'start-real-return-bills.csv' },
        });
      },
    };
  }
  const CLAIM_FIGS = { 'claim-1': figClaim1, 'claim-2': figClaim2, 'claim-3': figClaim3, 'claim-4': figClaim4, 'claim-5': figClaim5 };

  // the date picker on claim 3: any start and end month, with the same arithmetic as the tables
  function buildPicker(c) {
    const pk = c.picker, series = pk.series || 'cpi', rows = rowsOf(series), last = D.latest(rows), first = D.first(rows);
    if (!last || !first) return null;
    const FMT = { doubling: 'yrs1', cagr: 'p2', power: 'p1' };
    const LAB = { doubling: 'Years for prices to double', cagr: 'Average rise a year', power: 'What a dollar keeps of its buying power' };
    const uid = U.uid('pick');
    const mkMonth = (id, label, withLatest) => {
      const s = h('select', { class: 'input st-pick-mo', id, 'aria-label': label });
      if (withLatest) s.appendChild(h('option', { value: '', text: 'Month' }));
      MON.forEach((m, i) => s.appendChild(h('option', { value: String(i + 1), text: m })));
      return s;
    };
    const sm = mkMonth(uid + '-sm', 'Start month', false), em = mkMonth(uid + '-em', 'End month', true);
    const sy = h('input', { class: 'input st-pick-yr', id: uid + '-sy', type: 'number', inputmode: 'numeric', step: '1', min: String(first.y), max: String(last.y), 'aria-label': 'Start year' });
    const ey = h('input', { class: 'input st-pick-yr', id: uid + '-ey', type: 'number', inputmode: 'numeric', step: '1', min: String(first.y), max: String(last.y), placeholder: 'latest', 'aria-label': 'End year (leave blank for the newest month)' });
    const out = h('div', { class: 'st-pick-out', 'aria-live': 'polite' });

    function setStart(key) { const p = D.parsePeriod(key); if (p) { sy.value = String(p.y); sm.value = String(p.m || 1); } }
    function setWindow(w) {
      let key = w.start;
      if (/^latest-(\d+)y$/.test(key)) key = D.shiftPeriod(last, -12 * +/^latest-(\d+)y$/.exec(key)[1]);
      setStart(key);
      ey.value = ''; em.value = '';
      compute();
    }
    function say(text) { clear(out); out.appendChild(h('p', { class: 'st-pick-msg', text })); }
    // the window rules are the same as on the Prices page: a start month with no value moves to the next month with one (at
    // most a year later), and an end after the newest month ends at the newest month
    const pts = D.clean(rows);
    const gapNames = (rows || []).filter((r) => r && r[1] == null).map((r) => when(r[0]));
    const range = 'The series runs from ' + when(first.key) + ' to ' + when(last.key) + (gapNames.length ? ' and has no value for ' + gapNames.join(', ') : '') + '.';
    const keyOf = (y, m) => y + '-' + pad2(m);
    const atOrAfter = (key) => { const t = D.parsePeriod(key).t; return pts.find((p) => p.t >= t - 1e-9 && p.t - t <= 1 + 1e-9) || null; };
    const atOrBefore = (key) => { const t = D.parsePeriod(key).t; for (let i = pts.length - 1; i >= 0; i--) if (pts[i].t <= t + 1e-9) return pts[i]; return null; };
    function compute() {
      clear(out);
      const yTxt = String(sy.value).trim(), y0 = parseInt(yTxt, 10);
      if (!/^\d{4}$/.test(yTxt) || y0 < first.y || y0 > last.y) { say('Enter the start year as four digits, from ' + first.y + ' to ' + last.y + '. ' + range); return; }
      const wantStart = keyOf(y0, +sm.value || 1), sPt = atOrAfter(wantStart);
      if (!sPt) { say('There is no value in that start month or in the twelve months after it. ' + range); return; }
      let ePt = last, endNote = '';
      const eTxt = String(ey.value).trim();
      if (eTxt !== '') {
        const y1 = parseInt(eTxt, 10);
        if (!/^\d{4}$/.test(eTxt)) { say('Enter the end year as four digits, or leave it blank for the newest month. ' + range); return; }
        const wantEnd = keyOf(y1, +em.value || 12);
        if (D.parsePeriod(wantEnd).t > last.t + 1e-9) endNote = 'The series ends in ' + when(last.key) + ', so the window ends there.';
        else {
          ePt = atOrBefore(wantEnd);
          if (!ePt) { say('There is no value at or before that end month. ' + range); return; }
        }
      }
      if (!(ePt.t > sPt.t + 1e-9)) { say('The end has to come after the start. ' + range); return; }
      const start = sPt.key, end = ePt.key === last.key ? 'latest' : ePt.key;
      const res = {};
      pk.rules.forEach((r) => { res[r] = D.resolve(series + '.' + r + '.' + start + '.' + end + '|' + FMT[r], ctx); });
      const cg = res.cagr;
      if (!cg || !cg.ok) { say('That window cannot be computed: ' + (cg ? cg.message : 'no result') + '. ' + range); return; }
      const years = ePt.t - sPt.t, months = Math.round(years * 12);
      const kids = [];
      if (years < 1) {
        // under a year the plain change is shown; a yearly rate or a doubling time would stretch a few months over decades
        const pc = D.resolve(series + '.pct.' + start + '.' + end + '|p1', ctx);
        kids.push(h('p', { class: 'st-pick-big' }, [pc.ok ? (pc.value < 0 ? 'Fell ' : 'Rose ') + D.format(Math.abs(pc.value), 'p1') : 'n/a', ' ', h('small', { text: 'over ' + months + (months === 1 ? ' month' : ' months') })]));
        kids.push(h('p', { class: 'st-p', text: cg.period + ': a window shorter than a year is shown as a plain change. A yearly rate or a doubling time would stretch a few months over decades, so they are not shown.' }));
      } else {
        const dbl = res.doubling && res.doubling.ok ? res.doubling : null;
        if (dbl) {
          kids.push(h('p', { class: 'st-pick-big' }, [dbl.text.replace(' years', ''), ' ', h('small', { text: 'years to double' })]));
          const v = D.paceVerdict(dbl.value), tol = D.PACE_TOLERANCE;
          const pace = v === 'about' ? 'about the 17-year pace of the claim (within ' + tol + ' years of 17)' : v === 'faster' ? 'faster than the 17-year pace of the claim (by more than ' + tol + ' years)' : 'slower than the 17-year pace of the claim (by more than ' + tol + ' years)';
          kids.push(h('p', { class: 'st-p', text: cg.period + ': ' + pace + '.' }));
        } else {
          kids.push(h('p', { class: 'st-pick-msg', text: cg.period + ': prices did not rise on average, so they never double on this window.' }));
        }
        const dl = h('dl', { class: 'st-pick-dl' });
        pk.rules.forEach((r) => { if (res[r] && res[r].ok && r !== 'doubling') dl.appendChild(h('div', null, [h('dt', { text: LAB[r] || r }), h('dd', { text: res[r].text })])); });
        kids.push(dl);
      }
      if (sPt.key !== wantStart) kids.push(h('p', { class: 'st-fine', text: 'There is no value for ' + when(wantStart) + ', so the window starts at ' + when(sPt.key) + '.' }));
      if (endNote) kids.push(h('p', { class: 'st-fine', text: endNote }));
      kids.forEach((k) => out.appendChild(k));
    }
    [sm, sy, em, ey].forEach((n) => { n.addEventListener('input', compute); n.addEventListener('change', compute); });
    const presets = h('div', { class: 'st-presets', role: 'group', 'aria-label': 'Start from one of the fixed windows' }, P.windows.map((w) => h('button', { class: 'chip', type: 'button', text: winLabel(w), onclick: () => setWindow(w) })));
    setWindow(P.windows.find((w) => w.id === 'w1971') || P.windows[0]);
    return h('div', { class: 'st-picker' }, [
      h('div', { class: 'st-picker-title', text: 'Pick your own dates' }),
      el('p', 'st-fine', pk.note || ''),
      presets,
      h('div', { class: 'st-fields' }, [
        h('div', { class: 'st-fieldrow' }, [h('span', { class: 'st-fl', text: 'Start' }), sm, sy]),
        h('div', { class: 'st-fieldrow' }, [h('span', { class: 'st-fl', text: 'End' }), em, ey]),
      ]),
      h('p', { class: 'st-fine', text: 'Leave the end year blank to end at the newest month (' + when(last.key) + '). A year with no month ends in December.' }),
      out,
    ]);
  }

  // period, source and the date of the data for one computed figure
  function metaText(r) {
    if (!r.ok) return r.message || 'Not available';
    const bits = [];
    if (r.period) bits.push(r.period);
    if (r.source) bits.push(r.source);
    else bits.push('arithmetic on a stated rule, no data series');
    if (r.asOf) bits.push('data as of ' + when(r.asOf));
    return bits.join('; ');
  }

  function numbersTable(c) {
    const rows = c.numbers.map((n) => {
      const r = R(n.ph);
      const label = h('span');
      label.appendChild(document.createTextNode(n.label));
      if (n.note) label.appendChild(h('small', { text: n.note }));
      const meta = metaText(r);
      return { cells: [label, numSpan(r), meta] };
    });
    return table({ caption: 'The deciding numbers', sub: 'Computed here from the data files. Period and source are given for each.', cols: [{ label: 'Number' }, { label: 'Value', num: true }, { label: 'Period, source and date', meta: true }], rows, stack: true });
  }

  function windowTables(c) {
    return (c.windows || []).map((t) => table({
      caption: t.title, sub: t.note,
      cols: [{ label: 'Window' }].concat(t.columns.map((x) => ({ label: x, num: true }))),
      rows: t.rows.map((r) => ({ cells: [r.label].concat(r.cells), bench: !!r.benchmark })),
      stack: true,
    }));
  }

  function sourcesBlock(ids) {
    const list = (ids || []).filter((id) => refNo.has(id));
    if (!list.length) return null;
    const ol = h('ol');
    list.forEach((id) => {
      const s = P.sources[id];
      ol.appendChild(h('li', null, [h('a', { class: 'st-ref', href: '#src-' + id, title: s.title, 'aria-label': 'Source ' + refNo.get(id) + ': ' + s.title, text: String(refNo.get(id)) }), h('span', { text: s.title + (s.publisher ? ' (' + s.publisher + ')' : '') + (unread(id) ? ' (not re-read)' : '') })]));
    });
    return h('details', { class: 'st-srcs-card' }, [h('summary', { text: 'Sources for this card (' + list.length + ')' }), ol]);
  }

  // open every card in a group, or close them; the page opens none by hand on a phone
  function cardTools(container, label) {
    const all = (open) => container.querySelectorAll('details.st-card').forEach((d) => { d.open = open; });
    return h('div', { class: 'st-actions st-cardtools', role: 'group', 'aria-label': label }, [
      h('button', { class: 'btn', type: 'button', text: 'Open all', onclick: () => all(true) }),
      h('button', { class: 'btn', type: 'button', text: 'Close all', onclick: () => all(false) }),
    ]);
  }

  function claimCard(c) {
    const det = h('details', { class: 'st-card st-claim', id: c.id });
    det.appendChild(h('summary', null, [
      h('span', { class: 'st-card-n', 'aria-hidden': 'true', text: String(c.n) }),
      h('span', { class: 'st-card-main' }, [
        h('h3', { class: 'st-card-title', text: c.claim }),
        h('span', { class: 'st-card-meta' }, [verdictChip(c.verdict)]),
        el('span', 'st-card-line', c.verdictLine),
        c.quick ? el('span', 'st-card-quick', c.quick) : null,
      ]),
    ]));
    const body = h('div', { class: 'st-card-body' });

    body.appendChild(h('div', { class: 'st-asked' }, [h('small', { text: 'The claim, as it is often made' }), c.asked]));
    body.appendChild(h('p', { class: 'st-fine' }, ['The labels on each statement (accounting fact, measured trend, interpretation; computed or published) are defined under ', h('a', { href: '#labels', text: 'How statements are labelled' }), ' near the top of the page.']));
    const meaning = own(P.verdicts, c.verdict) ? P.verdicts[c.verdict].meaning : '';
    body.appendChild(h('div', { class: 'st-block st-verdictbox' }, [
      h('h4', { class: 'st-h4', text: 'Verdict' }),
      verdictChip(c.verdict),
      meaning ? h('p', { class: 'st-fine', text: 'What this verdict means: ' + meaning }) : null,
      el('p', 'st-p', c.text),
    ]));
    body.appendChild(h('div', { class: 'st-cols' }, [
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What is right' }), stmtList(c.right, 'What is right')]),
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What is not right, or goes further than the data' }), stmtList(c.notRight, 'What is not right')]),
    ]));

    // the evidence: figure, window tables, picker, deciding numbers
    const ev = h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What the data show' })]);
    let figHandle = null;
    if (own(CLAIM_FIGS, c.id)) {
      figHandle = CLAIM_FIGS[c.id]();
      ev.appendChild(figHandle.el);
    }
    windowTables(c).forEach((t) => ev.appendChild(t));
    if (c.picker) {
      const pk = buildPicker(c);
      if (pk) ev.appendChild(pk);
    }
    ev.appendChild(numbersTable(c));
    body.appendChild(ev);

    body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Where economists still disagree' }), stmtList(c.disagree, 'Disagreements')]));
    body.appendChild(h('div', { class: 'st-block' }, [
      h('h4', { class: 'st-h4', text: 'The strongest objection, from each side' }),
      h('div', { class: 'st-stmts' }, (c.objection || []).map((o) => {
        const p = el('p', 'st-stmt-text', o.text);
        const refs = refLinks(o.refs);
        if (refs) { p.appendChild(document.createTextNode(' ')); p.appendChild(refs); }
        return h('div', { class: 'st-objection' }, [h('b', { text: 'Against: ' + o.against }), p]);
      })),
    ]));
    body.appendChild(h('div', { class: 'st-cols' }, [
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What would change this verdict' }), plainList(c.change)]),
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What this card does not test' }), plainList(c.limits)]),
    ]));
    const lr = linkRow(c.links);
    if (lr) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Open the data' }), lr]));
    const sb = sourcesBlock(c.refs);
    if (sb) body.appendChild(sb);

    det.appendChild(body);
    if (figHandle) onFirstOpen(det, () => figHandle.make());
    return det;
  }

  function buildClaims() {
    const host = $('claims'), CI = P.claimsIntro;
    host.appendChild(h('h2', { class: 'st-h2', id: 'claims-h', tabindex: '-1', text: CI.title }));
    host.appendChild(el('p', 'st-lede', CI.intro));
    host.appendChild(el('p', 'st-lede', CI.order));
    const leg = h('ul', { class: 'st-vlegend', 'aria-label': 'The five verdicts' });
    Object.keys(P.verdicts).forEach((v) => leg.appendChild(h('li', null, [verdictChip(v), h('span', { text: P.verdicts[v].meaning })])));
    host.appendChild(leg);
    const cards = h('div', { class: 'st-cards' });
    P.claims.forEach((c) => cards.appendChild(claimCard(c)));
    host.appendChild(cardTools(cards, 'Open or close every claim card'));
    host.appendChild(cards);
    // desktop opens the first card; a phone opens none
    const first = cards.querySelector('details');
    if (first && wide() && !(window.location.hash || '').length) first.open = true;
  }

  /* =====================================================================================
     7. strains
     ===================================================================================== */
  function readingTable(f) {
    const rows = (f.reading || []).map((n) => {
      const r = R(n.ph);
      const label = h('span');
      label.appendChild(document.createTextNode(n.label));
      if (n.note) label.appendChild(h('small', { text: n.note }));
      const meta = metaText(r);
      return { cells: [label, numSpan(r), meta] };
    });
    return table({ caption: 'Current reading (computed here)', cols: [{ label: 'Measure' }, { label: 'Value', num: true }, { label: 'Period, source and date', meta: true }], rows, stack: true });
  }
  function strainCard(f) {
    const det = h('details', { class: 'st-card st-strain', id: f.id });
    det.appendChild(h('summary', null, [
      h('span', { class: 'st-card-n', 'aria-hidden': 'true', text: String(f.n) }),
      h('span', { class: 'st-card-main' }, [h('h3', { class: 'st-card-title', text: f.name }), el('span', 'st-card-line', f.metric)]),
    ]));
    const body = h('div', { class: 'st-card-body' });
    body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Why it matters' }), stmtList([f.why], 'Why it matters')]));
    if (f.reading && f.reading.length) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'The reading now' }), readingTable(f)]));
    if (f.readingNote) body.appendChild(h('p', { class: 'st-note', text: f.readingNote }));
    if (f.readingTable) {
      const t = f.readingTable;
      body.appendChild(table({
        caption: t.title, sub: t.note, cols: [{ label: 'Economy' }].concat(t.columns.map((x) => ({ label: x, num: true }))),
        rows: t.rows.map((r) => ({ cells: [r.label].concat(r.cells) })),
        stack: true,
      }));
    }
    if (f.published && f.published.length) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Published figures' }), stmtList(f.published, 'Published figures')]));
    body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'The counterpoint' }), h('div', { class: 'st-counter' }, [stmtList([f.counterpoint], 'The counterpoint')])]));
    if (f.leaves) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'What the counterpoint leaves out' }), h('div', { class: 'st-counter st-leaves' }, [stmtList([f.leaves], 'What the counterpoint leaves out')])]));
    const lr = linkRow(f.links);
    if (lr) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Open the data' }), lr]));
    const sb = sourcesBlock(f.refs);
    if (sb) body.appendChild(sb);
    det.appendChild(body);
    return det;
  }
  function buildStrains() {
    const host = $('strains'), FI = P.fragilitiesIntro;
    host.appendChild(h('h2', { class: 'st-h2', id: 'strains-h', tabindex: '-1', text: FI.title }));
    host.appendChild(el('p', 'st-lede', FI.intro));
    host.appendChild(el('p', 'st-fine', FI.note));
    const cards = h('div', { class: 'st-cards' });
    P.fragilities.forEach((f) => cards.appendChild(strainCard(f)));
    host.appendChild(cardTools(cards, 'Open or close every strain card'));
    host.appendChild(cards);
    const held = P.fragilitiesHeld;
    if (held && held.items && held.items.length) {
      host.appendChild(h('div', { class: 'st-block st-held' }, [h('h3', { class: 'st-h3', text: held.title }), el('p', 'st-fine', held.intro), stmtList(held.items, held.title)]));
    }
  }

  /* =====================================================================================
     8. money systems
     ===================================================================================== */
  const MATRIX = [['creates', 'Who creates new money'], ['limit', 'What limits creation'], ['firstRecipient', 'Who receives it first'], ['scale', 'Has it run at national scale'], ['strongestFor', 'Strongest argument for'], ['strongestAgainst', 'Strongest argument against']];

  function systemCard(it) {
    const det = h('details', { class: 'st-card st-sys', id: it.id });
    det.appendChild(h('summary', null, [
      h('span', { class: 'st-card-n', 'aria-hidden': 'true', text: String(P.systems.items.indexOf(it) + 1) }),
      h('span', { class: 'st-card-main' }, [
        h('h3', { class: 'st-card-title', text: it.name }),
        h('span', { class: 'st-card-meta' }, [h('span', { class: 'badge st-status', text: it.status })]),
        h('span', { class: 'st-card-line', text: it.period }),
      ]),
    ]));
    const body = h('div', { class: 'st-card-body' });
    body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Quality of the evidence' }), el('p', 'st-p', it.evidence)]));
    body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'How money is created' }), el('p', 'st-p', it.created)]));
    body.appendChild(h('dl', { class: 'st-matrix' }, MATRIX.filter((m) => it.matrix && it.matrix[m[0]]).map((m) => h('div', null, [h('dt', { text: m[1] }), el('dd', null, it.matrix[m[0]])]))));
    if (it.cases && it.cases.length) body.appendChild(h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Cases' }), plainList(it.cases)]));
    if (it.outcomes && it.outcomes.length) {
      const rows = it.outcomes.map((o) => {
        const val = h('span');
        rich(o.value, val);
        const refs = refLinks(o.refs);
        if (refs) { val.appendChild(document.createTextNode(' ')); val.appendChild(refs); }
        return { cells: [o.label, val, o.period, o.scope, basisBadge(o.basis === 'computed' ? 'computed' : 'cited')] };
      });
      body.appendChild(table({ caption: 'Measured outcomes', sub: 'Each value has its period and scope. Samples differ between rows, so the rows are not strictly comparable.', cols: [{ label: 'Measure' }, { label: 'Value' }, { label: 'Period', nw: true }, { label: 'Scope' }, { label: 'Basis' }], rows, stack: true }));
    }
    body.appendChild(h('div', { class: 'st-pros' }, [
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Strengths' }), plainList(it.strengths, 'st-bullets')]),
      h('div', { class: 'st-block' }, [h('h4', { class: 'st-h4', text: 'Weaknesses' }), plainList(it.weaknesses, 'st-bullets')]),
    ]));
    const sb = sourcesBlock(it.refs);
    if (sb) body.appendChild(sb);
    det.appendChild(body);
    return det;
  }

  function buildSystems() {
    const host = $('systems'), S = P.systems;
    host.appendChild(h('h2', { class: 'st-h2', id: 'systems-h', tabindex: '-1', text: S.title }));
    host.appendChild(el('p', 'st-lede', S.intro));
    host.appendChild(el('p', 'st-fine', S.evidenceNote));
    host.appendChild(h('div', { class: 'st-block' }, [h('h3', { class: 'st-h3', text: 'Readings from the measured outcomes' }), stmtList(S.readings, 'Readings')]));
    host.appendChild(h('details', { class: 'st-details' }, [
      h('summary', null, ['Caveats on the comparison ', h('small', { text: '(' + S.caveats.length + ')' })]),
      h('div', { class: 'st-details-body' }, [plainList(S.caveats)]),
    ]));
    const byId = {};
    S.items.forEach((it) => { byId[it.id] = it; });
    const sc = S.scoreboard;
    host.appendChild(h('div', { class: 'st-score' }, [table({
      caption: sc.title, sub: sc.note,
      cols: [{ label: 'System' }].concat(sc.columns.map((x) => ({ label: x }))),
      rows: sc.rows.map((r) => {
        const it = byId[r.system];
        const name = it ? h('a', { href: '#' + it.id, text: it.name }) : r.system;
        return { cells: [name].concat(r.cells) };
      }),
      stack: true,
    })]));
    host.appendChild(h('h3', { class: 'st-h3', text: 'Each system in turn' }));
    const cards = h('div', { class: 'st-cards' });
    S.items.forEach((it) => cards.appendChild(systemCard(it)));
    host.appendChild(cardTools(cards, 'Open or close every system card'));
    host.appendChild(cards);
  }

  /* =====================================================================================
     9. method, figures used, glossary, sources
     ===================================================================================== */
  function csvCell(v) { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function download(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function figuresDetails() {
    const keys = Array.from(figures.keys());
    const lines = keys.map((k) => {
      const r = figures.get(k);
      return [k, r.ok ? r.text : 'n/a', r.period || '', r.label || (r.series && r.series[0]) || '', r.source || '', r.asOf ? when(r.asOf) : '', r.ok ? '' : (r.message || r.error || '')];
    });
    const rows = lines.map((l) => ({ cells: [h('span', { class: 'st-mono', text: l[0] }), l[1], l[2], l[3], l[4], l[5]] }));
    const failed = lines.filter((l) => l[6]).length;
    const host = h('div', { class: 'st-tablescroll', tabindex: '0', role: 'region', 'aria-label': 'Figures used on this page' }, [table({
      caption: 'Figures computed on this page', sub: 'One row for each distinct figure: the rule that computes it, its value, period, series, source and the date of the data.',
      cols: [{ label: 'Figure (series.rule.arguments|format)' }, { label: 'Value' }, { label: 'Period' }, { label: 'Series' }, { label: 'Source' }, { label: 'Data as of' }],
      rows, rowHeader: false,
    })]);
    const csvBtn = h('button', { class: 'btn', type: 'button', text: 'Download CSV', onclick: () => {
      const head = ['figure', 'value', 'period', 'series', 'source', 'data_as_of', 'problem'];
      download('start-figures-used.csv', [head].concat(lines).map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
    } });
    return h('details', { class: 'st-details', id: 'figures-used' }, [
      h('summary', null, ['Figures used on this page ', h('small', { text: '(' + keys.length + ', ' + (failed ? failed + ' not computed' : 'all computed') + ')' })]),
      h('div', { class: 'st-details-body' }, [h('p', { class: 'st-fine', text: 'Every number marked as computed above is one of these rows. Hover or tap a number in the text to see its period and source; this table gives the same for keyboard and screen-reader users.' }), host, h('div', { class: 'st-actions' }, [csvBtn])]),
    ]);
  }

  function glossaryDetails() {
    const keep = linkTerms;
    linkTerms = false; // an entry never links to another entry
    const node = h('details', { class: 'st-details', id: 'glossary' }, [
      h('summary', null, ['Glossary ', h('small', { text: '(' + P.glossary.length + ' terms)' })]),
      h('div', { class: 'st-details-body' }, [h('dl', { class: 'st-defs' }, P.glossary.map((g) => h('div', { id: glSlug(g.term) }, [h('dt', { text: g.term }), el('dd', null, g.def)])))]),
    ]);
    linkTerms = keep;
    return node;
  }

  const CHECKED = { data: 'Data series pulled', full: 'Full text read', abstract: 'Abstract read', summary: 'Page or search summary', cited: 'Named in the research, not re-read' };
  function sourcesDetails() {
    const ol = h('ol', { class: 'st-sources' });
    const items = refOrder.map((id) => {
      const s = P.sources[id];
      const meta = h('div', { class: 'st-src-meta' }, [
        h('span', { class: 'badge', title: s.kind === 'dataset' ? 'A data series pulled by this site' : s.kind === 'primary' ? 'The original publication' : 'A secondary account', text: s.kind }),
        h('span', { class: 'badge', title: 'How far the research looked at this source', text: CHECKED[s.checked] || s.checked }),
        s.retrieved ? h('span', { text: 'retrieved ' + when(s.retrieved) }) : null,
      ]);
      const li = h('li', { id: 'src-' + id }, [
        h('div', null, [h('span', { class: 'st-src-title', text: s.title }), s.publisher ? ', ' + s.publisher : '']),
        meta,
        s.url ? h('div', { class: 'st-src-url' }, [U.link(s.url, s.url)]) : null,
        s.note ? h('div', { class: 'st-fine', text: s.note }) : null,
      ]);
      li.dataset.find = (s.title + ' ' + (s.publisher || '') + ' ' + s.kind + ' ' + id).toLowerCase();
      ol.appendChild(li);
      return li;
    });
    const count = h('span', { class: 'st-count', 'aria-live': 'polite', text: items.length + ' sources' });
    const input = h('input', { class: 'input', type: 'search', id: 'src-find', placeholder: 'Search the sources', 'aria-label': 'Search the sources by title, publisher or kind', autocomplete: 'off' });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let n = 0;
      items.forEach((li) => { const hit = !q || li.dataset.find.indexOf(q) >= 0; li.hidden = !hit; if (hit) n++; });
      count.textContent = q ? n + ' of ' + items.length + ' sources' : items.length + ' sources';
    });
    const key = h('ul', { class: 'st-list' }, Object.keys(CHECKED).map((k) => h('li', null, [h('b', { text: CHECKED[k] + '. ' }), { data: 'The site pulled the series and computes from it.', full: 'The source was opened and read in full.', abstract: 'Only the abstract or summary page was read.', summary: 'A web page or a search summary of the source was read.', cited: 'Named in the research briefs; not re-read for this page.' }[k]])));
    return h('details', { class: 'st-details', id: 'sources' }, [
      h('summary', null, ['Sources ', h('small', { text: '(' + items.length + ', numbered in order of first use)' })]),
      h('div', { class: 'st-details-body' }, [
        h('p', { class: 'st-fine', text: 'How far the research looked at each source is shown on its line:' }), key,
        h('div', { class: 'st-find' }, [input, count]), ol,
      ]),
    ]);
  }

  function buildMethod() {
    const host = $('method'), M = P.method;
    host.appendChild(h('h2', { class: 'st-h2', id: 'method-h', tabindex: '-1', text: M.title }));
    const box = h('div', { class: 'st-method' });
    M.paragraphs.forEach((t) => box.appendChild(el('p', 'st-p', t)));
    box.appendChild(h('div', { class: 'st-block' }, [h('h3', { class: 'st-h3', text: 'What this page does not claim' }), plainList(M.doesNotClaim)]));
    box.appendChild(h('div', { class: 'st-block' }, [h('h3', { class: 'st-h3', text: 'Notes on the data' }), plainList(M.dataNotes)]));
    box.appendChild(h('div', { class: 'st-block' }, [h('h3', { class: 'st-h3', text: 'Limits of the research' }), plainList(M.researchLimits)]));
    host.appendChild(box);
    host.appendChild(figuresDetails());
    host.appendChild(glossaryDetails());
    host.appendChild(sourcesDetails());
    host.appendChild(h('div', { class: 'st-block' }, [
      h('h3', { class: 'st-h3', text: 'See also' }),
      h('div', { class: 'st-seealso' }, [
        h('a', { href: 'money-flow.html', text: 'Money Flow: how money is created and repaid' }),
        h('a', { href: 'monetary-history.html', text: 'Money Over Time: money supply and 770 years of history' }),
        h('a', { href: 'debt.html', text: 'Debt: who owes what, and what it costs' }),
        h('a', { href: 'prices.html', text: 'Prices: what things cost in hours of work' }),
      ]),
    ]));
  }

  /* =====================================================================================
     10. opening by address hash, tips on numbers, start
     ===================================================================================== */
  // open every closed details around the target, so a link into a card or a source lands on visible text
  function openTarget(id) {
    const target = id ? document.getElementById(id) : null;
    if (!target) return null;
    for (let n = target; n && n !== document.body; n = n.parentElement) {
      if (n.tagName === 'DETAILS' && !n.open) n.open = true;
    }
    return target;
  }
  function onHash() {
    let id = '';
    try { id = decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch (e) { id = ''; }
    if (!id || id.indexOf('=') >= 0) return;
    const t = openTarget(id);
    if (!t) return;
    setTimeout(() => {
      try { t.scrollIntoView({ block: 'start' }); } catch (e) { /* old browser */ }
      const s = t.tagName === 'DETAILS' ? t.querySelector('summary') : null;
      if (s) { try { s.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }, 60);
  }

  // A link to a card on this page opens the card at once, before the browser scrolls. This also covers a link to the address
  // already in the bar (for example a card the reader has since closed), which fires no hashchange.
  function wireJumpLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      let id = '';
      try { id = decodeURIComponent((a.getAttribute('href') || '').replace(/^#/, '')); } catch (err) { id = ''; }
      if (id && id.indexOf('=') < 0) openTarget(id);
    });
  }

  // hover or tap a computed number for its period and source
  function wireTips() {
    const tip = U.tip();
    let shown = null;
    const hide = () => { if (shown) { tip.hide(); shown = null; } };
    function show(span, x, y) {
      const r = numInfo.get(span);
      if (!r) return;
      if (r.ok) {
        const lines = [];
        lines.push('Value: ' + r.text);
        if (r.period) lines.push('Period: ' + r.period);
        if (r.source) lines.push('Source: ' + r.source);
        if (r.asOf) lines.push('Data as of: ' + when(r.asOf));
        tip.set(r.label || 'Computed figure', lines, 'Computed here' + (r.rule ? ' (' + r.rule + ')' : ''));
      } else tip.set('Not available', [r.message || 'This figure could not be computed from the data files.'], 'Computed here');
      tip.place(x, y);
      shown = span;
    }
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const s = e.target.closest ? e.target.closest('.st-n') : null;
      if (s) show(s, e.clientX, e.clientY); else hide();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.pointerType || e.pointerType === 'mouse') return;
      const s = e.target.closest ? e.target.closest('.st-n') : null;
      if (s && s !== shown) show(s, e.clientX, e.clientY); else hide();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
  }

  function start() {
    safe('top of the page', $('intro'), buildIntro);
    safe('six numbers', $('numbers'), buildNumbers);
    safe('walk through', $('how'), buildHow);
    safe('claims', $('claims'), buildClaims);
    safe('strains', $('strains'), buildStrains);
    safe('money systems', $('systems'), buildSystems);
    safe('method', $('method'), buildMethod);
    wireTips();
    wireJumpLinks();
    window.addEventListener('hashchange', onHash);
    // the browser tried to scroll to the address before the sections existed
    if ((window.location.hash || '').length > 1) onHash();
  }
  start();
})();
