/* Money Flow: page logic.
   Plain JS. Data comes from window.MONEY_FLOW (data/money-flow.js) and window.MONEY_SUPPLY
   (data/money-supply.js). d3 7.9.0 is used only for the scales of the evidence chart; without it that
   chart says so and its table still works. Colours are CSS variables, so a theme change needs no redraw.
   Data strings reach the page only through textContent, never through innerHTML. */
(function () {
  'use strict';

  const MS = window.MONEY_SUPPLY;
  const MF0 = window.MONEY_FLOW;
  // d3 loads asynchronously: it may be here already, arrive later (the chart is then redrawn) or fail
  let d3 = window.d3 || null;
  let d3Failed = false;

  /* ---------- small helpers ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const qs = (s, r) => (r || document).querySelector(s);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clone = (o) => JSON.parse(JSON.stringify(o));

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
  };
  if (!MS || !MS.series || !MF0) {
    Shell.fatal('The data files did not load',
      'Expected data/money-supply.js and data/money-flow.js next to this page. Check that both files are present and reload.');
    return;
  }

  /* ---------- formatting ---------- */
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

  // three significant figures, trailing zeros kept so a column of values lines up
  function sig(n) {
    if (n >= 1000) return nf0.format(n);
    const r = +n.toPrecision(3);
    if (r >= 1000) return nf0.format(r);
    if (r >= 100) return String(Math.round(r));
    return r >= 10 ? r.toFixed(1) : r.toFixed(2);
  }
  // v is in US dollar billions
  function fmtBn(v) {
    if (v == null || !isFinite(v)) return 'n/a';
    const neg = v < 0, a = Math.abs(v);
    let n, u;
    if (a >= 1000) { n = a / 1000; u = 'T'; }
    else if (a >= 1) { n = a; u = 'B'; }
    else { n = a * 1000; u = 'M'; }
    // three significant figures can round a value up to 1000 of its unit; show it in the next unit up
    if (u !== 'T' && +n.toPrecision(3) >= 1000) { n /= 1000; u = u === 'M' ? 'B' : 'T'; }
    return (neg ? '-' : '') + '$' + sig(n) + u;
  }
  // whole dollars for the textbook model
  function usd(v) {
    const a = Math.abs(v);
    return (v < 0 ? '-$' : '$') + (a >= 10 ? nf0.format(a) : a.toFixed(2));
  }
  const signedUsd = (d) => (d > 0 ? '+' : '-') + '$' + nf0.format(Math.abs(d));
  const fmtPct = (r) => +(r * 100).toFixed(1) + '%';
  const fmtMult = (m) => +m.toFixed(2) + 'x';
  const fmtShare = (f) => { const p = f * 100; return (p < 10 ? p.toFixed(1) : nf0.format(p)) + '%'; };

  function fmtAsOf(s) {
    if (s == null || s === '') return 'n/a';
    s = String(s);
    if (s.indexOf(' to ') > 0) return s.split(' to ').map(fmtAsOf).join(' to ');
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return +m[3] + ' ' + MON[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return MON[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-([QHS]\d)$/i.exec(s);
    if (m) return m[2].toUpperCase() + ' ' + m[1];
    return s;
  }
  // The last day of the period an as-of string covers, as YYYY-MM-DD, so mixed precisions sort in time order
  // ("2026-Q2" ends 2026-06-30, later than "2026-04-15" but earlier than "2026-10-21"). A range uses its end. Unknown text gives null.
  function asOfEnd(s) {
    if (s == null) return null;
    s = String(s).trim();
    const to = s.indexOf(' to ');
    if (to > 0) s = s.slice(to + 4).trim();
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return s;
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return m[1] + '-' + m[2] + '-' + pad(lastDay(+m[1], +m[2]));
    m = /^(\d{4})-Q([1-4])$/i.exec(s);
    if (m) { const mo = +m[2] * 3; return m[1] + '-' + pad(mo) + '-' + pad(lastDay(+m[1], mo)); }
    m = /^(\d{4})-[HS]([12])$/i.exec(s);
    if (m) { const mo = +m[2] * 6; return m[1] + '-' + pad(mo) + '-' + pad(lastDay(+m[1], mo)); }
    m = /^(\d{4})$/.exec(s);
    if (m) return m[1] + '-12-31';
    return null;
  }
  // the calendar year an as-of falls in, or null when it spans two years or is unknown
  function asOfYear(s) {
    if (s == null) return null;
    const ys = String(s).match(/\d{4}/g);
    return ys && ys.every((y) => y === ys[0]) ? ys[0] : null;
  }
  const monthIndex = (p) => { const m = /^(\d{4})-(\d{2})$/.exec(p); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
  const fmtMonth = (mi) => MON[mi % 12] + ' ' + Math.floor(mi / 12);

  // an allowlist, the same shapes the importer accepts: a web address, or a page of this site
  const URL_WEB = /^https?:\/\/[^\s]+$/i;
  const URL_PAGE = /^[A-Za-z0-9_][A-Za-z0-9_.\/-]{0,99}\.html(#[A-Za-z0-9_-]{1,40})?$/;
  function safeHref(u) {
    if (typeof u !== 'string' || u.length > 500) return null;
    return URL_WEB.test(u) || URL_PAGE.test(u) ? u : null;
  }
  // the source name without its bracketed detail; a very long one also loses the note after its first semicolon.
  // It is never cut mid-word, so the full name is always on screen.
  function shortSource(s) {
    s = String(s || '');
    const cut = s.indexOf(' (');
    if (cut > 0) s = s.slice(0, cut);
    const semi = s.indexOf(';');
    return s.length > 100 && semi > 0 ? s.slice(0, semi) : s;
  }
  function link(text, url, cls, title) {
    const href = safeHref(url);
    if (!href) return h('span', { class: cls, text, title });
    const ext = /^https?:\/\//i.test(href);
    return h('a', { class: cls, href, text, title, target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null });
  }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }

  /* ---------- economies and colour ---------- */
  // the five shared entity tokens; every other economy gets the neutral fill
  const ECON = {
    us: { name: 'United States', short: 'US', cat: 'var(--cat-us)', shape: 'circle' },
    ea: { name: 'Euro area', short: 'Euro area', cat: 'var(--cat-ea)', shape: 'square' },
    uk: { name: 'United Kingdom', short: 'UK', cat: 'var(--cat-uk)', shape: 'diamond' },
    jp: { name: 'Japan', short: 'Japan', cat: 'var(--cat-jp)', shape: 'triangle' },
    cn: { name: 'China', short: 'China', cat: 'var(--cat-cn)', shape: 'star' },
  };
  const ECON_ORDER = ['us', 'ea', 'uk', 'jp', 'cn'];
  const OTHER_COLOR = 'var(--faint)';
  const colorOf = (econ) => (hasOwn(ECON, econ) ? ECON[econ].cat : OTHER_COLOR);

  /* ---------- the data and its derived rows ---------- */
  const TYPES = ['notional', 'debt', 'money', 'flow', 'market', 'cb-assets'];
  const TYPE_LABEL = { notional: 'Notional', debt: 'Debt', money: 'Money', flow: 'Flow per year', market: 'Market value', 'cb-assets': 'Central-bank assets' };
  const SCHEMA_ID = 'money-flow/1';

  const pristine = clone(MF0);
  let DATA = clone(pristine);
  // section name -> the file whose import last replaced it, so the status line stays true after several imports
  let customParts = {};
  let statusFlash = '';

  function msSeries(id) { return hasOwn(MS.series, id) ? MS.series[id] : null; }
  // latest row with a USD value (column index 2) and the local value beside it
  function msLatest(id) {
    const s = msSeries(id);
    if (!s || !Array.isArray(s.data)) return null;
    for (let i = s.data.length - 1; i >= 0; i--) {
      const r = s.data[i];
      if (r && r[2] != null && isFinite(r[2])) return { v: r[2], local: r[1], period: r[0], s, id };
    }
    return null;
  }

  function deriveValue(rule) {
    let m = /^ms:sum\(([a-z0-9_,]+)\)$/.exec(rule);
    if (m) {
      const ids = m[1].split(',');
      const parts = ids.map(msLatest);
      if (parts.some((p) => !p)) return null;
      const periods = parts.map((p) => p.period).sort();
      const lo = periods[0], hi = periods[periods.length - 1];
      return { value: parts.reduce((a, p) => a + p.v, 0), asOf: lo === hi ? lo : lo + ' to ' + hi };
    }
    m = /^ms:([a-z0-9_]+)$/.exec(rule);
    if (m) {
      const l = msLatest(m[1]);
      if (!l) return null;
      return { value: l.v, asOf: l.period, source: l.s.source, url: l.s.url };
    }
    return null;
  }

  // magnitudes with the money-supply rows filled in and the central-bank rows read from centralBanks
  function resolveMagnitudes() {
    const cbById = {};
    DATA.centralBanks.forEach((c) => { if (c.id) cbById[c.id] = c; });
    return DATA.magnitudes.map((m) => {
      const r = { id: m.id, label: m.label, type: m.type, value: m.valueBn, asOf: m.asOf, source: m.source, url: m.url, partOf: m.partOf || null, note: m.note || '', derived: false };
      if (m.derive) {
        r.derived = true;
        const d = deriveValue(m.derive);
        if (d) {
          r.value = d.value; r.asOf = d.asOf;
          if (d.source) { r.source = d.source; r.url = d.url; }
        } else r.value = null;
      } else if (m.type === 'cb-assets' && m.id.indexOf('cb-') === 0 && hasOwn(cbById, m.id.slice(3))) {
        const c = cbById[m.id.slice(3)];
        r.value = c.assetsBn; r.asOf = c.asOf; r.source = c.source; r.url = c.url;
      }
      return r;
    });
  }

  // ladder money rows whose economy is charted at a different headline aggregate in Compare > Money supply
  function aggregateDiffs() {
    const head = {};
    DATA.moneyRows.forEach((m) => { if (m.seriesId && !hasOwn(head, m.economy) && msLatest(m.seriesId)) head[m.economy] = m; });
    const out = [];
    DATA.magnitudes.forEach((m) => {
      const d = m.derive && /^ms:([a-z0-9_]+)$/.exec(m.derive);
      const ser = d && msSeries(d[1]);
      if (!ser || !hasOwn(head, ser.economy) || head[ser.economy].seriesId === d[1]) return;
      out.push({ ladder: m.label, headline: head[ser.economy].label });
    });
    return out;
  }
  const joinList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

  const gdpOf = (econ) => DATA.gdp.find((g) => g.economy === econ) || null;
  const gdpOfName = (name) => DATA.gdp.find((g) => g.name === name) || null;

  /* ---------- import validation ---------- */
  const F = {
    s: (max, req) => ({ t: 's', max, req }),
    n: (min, max, req) => ({ t: 'n', min, max, req }),
    u: (req) => ({ t: 'u', req }),
    id: (req) => ({ t: 'id', req }),
    e: (list, req) => ({ t: 'e', list, req }),
  };
  // amounts are US dollar billions: 0.001 is one million dollars, the smallest figure this page can show sensibly
  const MIN_BN = 0.001;
  const MIN_RATIO = 0.001;
  const nullable = (f) => Object.assign({}, f, { nullable: true });
  const SCHEMA = {
    reserveRequirements: { what: 'central banks', f: { cb: F.s(80, 1), ratio: F.n(0, 1, 1), ratioText: F.s(80, 1), since: F.s(24, 1), note: F.s(1500), source: F.s(300, 1), url: F.u() } },
    magnitudes: { what: 'quantities', f: { id: F.id(1), label: F.s(120, 1), valueBn: nullable(F.n(MIN_BN, 1e9)), type: F.e(TYPES, 1), asOf: nullable(F.s(40)), source: F.s(400, 1), url: F.u(), partOf: nullable(F.id()), note: F.s(1500), derive: F.s(200) } },
    centralBanks: { what: 'central banks', f: { id: F.id(), name: F.s(80, 1), economy: F.id(1), assetsBn: F.n(MIN_BN, 1e9, 1), local: F.s(200), asOf: F.s(40, 1), source: F.s(300, 1), url: F.u(), note: F.s(1500) } },
    banks: { what: 'banks', f: { name: F.s(120, 1), country: F.s(60), assetsBn: F.n(MIN_BN, 1e9, 1), asOf: F.s(40, 1), source: F.s(400, 1), url: F.u() } },
    gdp: { what: 'economies', f: { economy: F.id(1), name: F.s(80, 1), gdpBn: F.n(MIN_BN, 1e9, 1), year: F.n(1900, 2100, 1), source: F.s(300, 1), url: F.u() } },
    debt: { what: 'economies', f: { economy: F.id(1), name: F.s(80, 1), debtBn: F.n(MIN_BN, 1e9, 1), basis: F.s(1500), ofGdp: F.s(160), asOf: F.s(40, 1), source: F.s(300, 1), url: F.u() } },
    moneyRows: { what: 'money-supply rows', f: { economy: F.id(1), name: F.s(80, 1), seriesId: nullable(F.s(60)), label: F.s(80, 1), note: F.s(1500), valueBn: F.n(MIN_BN, 1e9), local: F.s(200), asOf: F.s(40), source: F.s(300), url: F.u() } },
  };
  const clip = (k) => String(k).slice(0, 40);
  function describe(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'a list';
    if (typeof v === 'object') return 'an object';
    if (typeof v === 'string') return 'text';
    return 'a ' + typeof v;
  }

  // returns a clean copy that holds only the known fields, or null after adding problems to errs
  function checkRecord(rec, fields, path, errs) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { errs.push(path + ' must be an object, but the file has ' + describe(rec)); return null; }
    const out = {};
    let ok = true;
    Object.keys(rec).forEach((k) => {
      if (!hasOwn(fields, k)) { errs.push(path + ' has an unknown field "' + clip(k) + '"'); ok = false; }
    });
    Object.keys(fields).forEach((k) => {
      const f = fields[k];
      const where = path + '.' + k;
      if (!hasOwn(rec, k) || rec[k] === undefined) {
        if (f.req) { errs.push(where + ' is required'); ok = false; }
        return;
      }
      const v = rec[k];
      if (v === null) {
        if (f.nullable) { out[k] = null; return; }
        errs.push(where + ' must not be null'); ok = false; return;
      }
      if (f.t === 's') {
        if (typeof v !== 'string') { errs.push(where + ' must be text'); ok = false; return; }
        if (f.req && !v.trim()) { errs.push(where + ' must not be empty'); ok = false; return; }
        if (v.length > f.max) { errs.push(where + ' is longer than ' + f.max + ' characters'); ok = false; return; }
        out[k] = v;
      } else if (f.t === 'n') {
        if (typeof v !== 'number' || !isFinite(v)) { errs.push(where + ' must be a finite number'); ok = false; return; }
        if (v < f.min || v > f.max) { errs.push(where + ' must be between ' + f.min + ' and ' + f.max); ok = false; return; }
        out[k] = v;
      } else if (f.t === 'u') {
        // a web address, or a link to another page of this site such as monetary-history.html
        const okUrl = safeHref(v) !== null;
        if (!okUrl) { errs.push(where + ' must be a web address starting with http:// or https://, or a page of this site such as monetary-history.html'); ok = false; return; }
        out[k] = v;
      } else if (f.t === 'id') {
        if (typeof v !== 'string' || !/^[a-z0-9-]{1,40}$/.test(v)) { errs.push(where + ' must be 1 to 40 lowercase letters, digits or hyphens'); ok = false; return; }
        out[k] = v;
      } else if (f.t === 'e') {
        if (typeof v !== 'string' || f.list.indexOf(v) < 0) { errs.push(where + ' must be one of ' + f.list.join(', ')); ok = false; return; }
        out[k] = v;
      }
    });
    return ok ? out : null;
  }

  function crossCheck(c, errs, replaced) {
    // reserve requirements: 0 means none, anything else must be a real ratio
    c.reserveRequirements.forEach((r, i) => {
      if (r.ratio !== 0 && r.ratio < MIN_RATIO) errs.push('reserveRequirements[' + i + '].ratio must be 0 (no requirement) or at least ' + MIN_RATIO + ' (0.1%)');
    });
    // magnitudes
    const ids = {};
    c.magnitudes.forEach((m, i) => {
      const p = 'magnitudes[' + i + ']';
      if (hasOwn(ids, m.id)) errs.push(p + '.id "' + m.id + '" is used twice');
      ids[m.id] = m;
      if (m.derive) {
        if (!/^ms:(sum\([a-z0-9_]+(,[a-z0-9_]+)*\)|[a-z0-9_]+)$/.test(m.derive)) errs.push(p + '.derive is not a known rule (use ms:<series> or ms:sum(<series>,<series>))');
        else (m.derive.match(/[a-z0-9_]+/g) || []).filter((t) => t !== 'ms' && t !== 'sum').forEach((sid) => { if (!msSeries(sid)) errs.push(p + '.derive names a series that is not in the money supply data: ' + sid); });
      } else {
        if (m.valueBn == null) errs.push(p + '.valueBn is required unless derive is set');
        if (!m.asOf) errs.push(p + '.asOf is required unless derive is set');
      }
    });
    c.magnitudes.forEach((m, i) => {
      if (m.partOf && !hasOwn(ids, m.partOf)) errs.push('magnitudes[' + i + '].partOf names an id that is not in the list: ' + clip(m.partOf));
    });
    c.magnitudes.forEach((m, i) => {
      let cur = m, n = 0;
      while (cur && cur.partOf && hasOwn(ids, cur.partOf) && n <= c.magnitudes.length) { cur = ids[cur.partOf]; n++; }
      if (n > c.magnitudes.length) errs.push('magnitudes[' + i + '].partOf runs in a circle');
    });
    // central banks
    const cb = {};
    c.centralBanks.forEach((x, i) => {
      if (x.id) { if (hasOwn(cb, x.id)) errs.push('centralBanks[' + i + '].id "' + x.id + '" is used twice'); cb[x.id] = x; }
    });
    // a cb-assets row repeats the matching centralBanks entry and the page reads the entry, so an edit to the row alone would do nothing
    if (replaced && replaced.indexOf('magnitudes') >= 0) {
      c.magnitudes.forEach((m, i) => {
        if (m.derive || m.type !== 'cb-assets' || m.id.indexOf('cb-') !== 0 || !hasOwn(cb, m.id.slice(3))) return;
        const x = cb[m.id.slice(3)];
        if (m.valueBn !== x.assetsBn || m.asOf !== x.asOf) {
          errs.push('magnitudes[' + i + '] repeats centralBanks "' + x.id + '" but its value or date differs from it, and the page reads centralBanks; change both or edit centralBanks only');
        }
      });
    }
    // money rows
    c.moneyRows.forEach((m, i) => {
      const p = 'moneyRows[' + i + ']';
      if (m.seriesId) {
        const ser = msSeries(m.seriesId);
        if (!ser) errs.push(p + '.seriesId names a series that is not in the money supply data: ' + clip(m.seriesId));
        else if (ser.economy !== m.economy) errs.push(p + '.seriesId belongs to economy "' + clip(ser.economy) + '", not "' + clip(m.economy) + '"');
      } else {
        if (m.valueBn == null) errs.push(p + '.valueBn is required when seriesId is null');
        if (!m.asOf) errs.push(p + '.asOf is required when seriesId is null');
        if (!m.source) errs.push(p + '.source is required when seriesId is null');
      }
    });
  }

  function validateImport(obj) {
    const errs = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { errors: ['The file must hold one JSON object whose keys are Money Flow sections such as banks, gdp or debt, but it holds ' + describe(obj)] };
    }
    const cand = clone(DATA);
    const replaced = [];
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      if (k === 'schema') { if (v !== SCHEMA_ID) errs.push('schema must be "' + SCHEMA_ID + '"'); return; }
      if (k === 'exportedAt') { if (typeof v !== 'string' || v.length > 40) errs.push('exportedAt must be text'); return; }
      if (k === 'asOf') {
        if (typeof v !== 'string' || !v || v.length > 40) errs.push('asOf must be text such as 2026-10-23');
        else { cand.asOf = v; replaced.push('asOf'); }
        return;
      }
      if (!hasOwn(SCHEMA, k)) { errs.push('Unknown section "' + clip(k) + '". Known sections: ' + Object.keys(SCHEMA).join(', ')); return; }
      const sec = SCHEMA[k];
      if (!Array.isArray(v)) { errs.push(k + ' must be a list of ' + sec.what + ', but the file has ' + describe(v)); return; }
      if (!v.length) { errs.push(k + ' must list at least one entry'); return; }
      if (v.length > 250) { errs.push(k + ' has more than 250 entries'); return; }
      const out = [];
      v.forEach((rec, i) => { const r = checkRecord(rec, sec.f, k + '[' + i + ']', errs); if (r) out.push(r); });
      cand[k] = out;
      replaced.push(k);
    });
    if (!errs.length && !replaced.length) errs.push('The file has no sections to import');
    if (!errs.length) crossCheck(cand, errs, replaced);
    return { errors: errs, data: cand, replaced };
  }

  /* ---------- tooltip and dialog ---------- */
  const tipEl = h('div', { class: 'tip mf-tip', id: 'mf-tip', role: 'tooltip', hidden: true });
  document.body.appendChild(tipEl);
  // while a row has keyboard focus the tip belongs to it: tipAnchor is where it sits, tipDesc the focused element it describes
  let tipAnchor = null, tipDesc = null;
  function clearTipLink() {
    if (tipDesc) tipDesc.removeAttribute('aria-describedby');
    tipAnchor = null; tipDesc = null;
  }
  function hideTip() { tipEl.hidden = true; clearTipLink(); }
  function setTip(title, lines) {
    clearTipLink();
    tipEl.textContent = '';
    tipEl.appendChild(h('b', { text: title }));
    (lines || []).forEach((l) => { if (l) tipEl.appendChild(h('p', { text: l })); });
  }
  // x and y are viewport pixels; the tip flips and clamps so it never leaves the screen
  function placeTip(x, y) {
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    let left = x + 14, top = y + 16;
    if (left + r.width > vw - 8) left = x - 14 - r.width;
    if (top + r.height > vh - 8) top = y - 16 - r.height;
    tipEl.style.left = Math.max(8, left) + 'px';
    tipEl.style.top = Math.max(8, top) + 'px';
  }
  function placeTipAt(el, focused) {
    tipAnchor = el;
    if (focused) { tipDesc = focused; focused.setAttribute('aria-describedby', 'mf-tip'); }
    const r = el.getBoundingClientRect();
    placeTip(r.left + Math.min(r.width / 2, 160), r.bottom - 6);
  }
  // scrolling hides a pointer tip; a keyboard tip stays with its row, which a focus scroll has just moved
  function onScrollTip() {
    if (!tipEl.hidden && tipAnchor && tipDesc && document.activeElement === tipDesc) {
      const r = tipAnchor.getBoundingClientRect();
      if (r.bottom > 0 && r.top < document.documentElement.clientHeight) { placeTipAt(tipAnchor, tipDesc); return; }
    }
    hideTip();
  }

  let dlg = null;
  const INERT = ['#app', '.appbar', '.skip-link'];
  // one document-level listener, so Escape and the Tab trap hold even when focus has left the dialog
  function onDialogKey(ev) {
    if (!dlg) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeDialog(); return; }
    if (ev.key !== 'Tab') return;
    const box = dlg.box;
    const f = Array.from(box.querySelectorAll('button, a[href], [tabindex="0"]')).filter((n) => !n.disabled);
    if (!f.length) { ev.preventDefault(); box.focus(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!box.contains(a)) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
    else if (ev.shiftKey && (a === first || a === box)) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onDialogKey, true);
  // spec: { title, tags[], rows[[label, value]], paras[], source: {text, url} }
  function openDialog(spec, opener) {
    closeDialog(true);
    hideTip();
    const close = h('button', { class: 'btn dclose', type: 'button', 'aria-label': 'Close dialog', text: '\u00d7', onclick: () => closeDialog() });
    const table = h('table', { class: 'dtable' });
    (spec.rows || []).forEach((r) => table.appendChild(h('tr', null, [h('td', { text: r[0] }), h('td', { text: r[1] })])));
    const kids = [close, h('h2', { id: 'dlg-title', text: spec.title })];
    if (spec.tags && spec.tags.length) kids.push(h('div', { class: 'dsub' }, spec.tags.map((t) => h('span', { class: 'badge', text: t }))));
    if (spec.rows && spec.rows.length) kids.push(table);
    (spec.paras || []).forEach((p) => kids.push(h('p', { text: p })));
    if (spec.source) kids.push(h('p', { class: 'dsrc' }, [h('b', { text: 'Source: ' }), link(spec.source.text, spec.source.url)]));
    kids.push(h('div', { class: 'dactions' }, [h('button', { class: 'btn', type: 'button', text: 'Close', onclick: () => closeDialog() })]));
    // tabindex -1 lets a click on the dialog text keep focus inside the dialog
    const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title', tabindex: '-1' }, kids);
    const scrim = h('div', { class: 'scrim' }, [box]);
    scrim.addEventListener('mousedown', (ev) => { if (ev.target === scrim) closeDialog(); });
    qs('#dialog-root').appendChild(scrim);
    INERT.forEach((sel) => { const n = qs(sel); if (n) n.setAttribute('inert', ''); });
    dlg = { scrim, box, opener: opener || document.activeElement };
    close.focus();
  }
  function closeDialog(silent) {
    if (!dlg) return;
    dlg.scrim.remove();
    INERT.forEach((sel) => { const n = qs(sel); if (n) n.removeAttribute('inert'); });
    const op = dlg.opener;
    dlg = null;
    if (!silent) {
      if (op && document.body.contains(op)) op.focus();
      else qs('#main').focus();
    }
  }

  /* ---------- table view helper ---------- */
  // cols: [{label, num}], rows: arrays of strings or {text, href} cells; the first cell of a row is its header
  function buildTable(host, caption, cols, rows) {
    host.textContent = '';
    const table = h('table', { class: 'mf-table' });
    table.appendChild(h('caption', null, [caption, h('span', { class: 'mf-scrollcue', 'aria-hidden': 'true', text: 'Scroll sideways for more columns.' })]));
    table.appendChild(h('thead', null, [h('tr', null, cols.map((c) => h('th', { scope: 'col', class: c.wrap ? 'wrap' : null, text: c.label })))]));
    const tb = h('tbody');
    rows.forEach((r) => {
      tb.appendChild(h('tr', null, r.map((cell, i) => {
        const na = cell == null || cell === '' || cell === 'n/a';
        let content;
        if (cell && typeof cell === 'object') content = link(cell.text, cell.href);
        else content = document.createTextNode(cell == null ? 'n/a' : String(cell));
        const tag = i === 0 ? 'th' : 'td';
        const props = i === 0 ? { scope: 'row' } : { class: (na ? 'na ' : '') + (cols[i] && cols[i].wrap ? 'wrap' : '') };
        return h(tag, props, [content]);
      })));
    });
    table.appendChild(tb);
    host.appendChild(table);
  }

  /* ---------- data tools ---------- */
  const statusEl = qs('#data-status');
  const msgEl = qs('#import-msg');
  function renderStatus() {
    const keys = Object.keys(customParts);
    if (keys.length) {
      statusEl.textContent = (statusFlash ? statusFlash + ' ' : '') + 'Custom data: ' + keys.map((k) => k + ' (' + customParts[k] + ')').join(', ') +
        '. An import replaces each section it holds as a whole; Reset data restores the built-in data.';
      return;
    }
    statusEl.textContent = (statusFlash ? statusFlash + ' (as of ' + fmtAsOf(DATA.asOf) + ').' : 'Built-in data as of ' + fmtAsOf(DATA.asOf) + '.') +
      ' Money supply figures are the latest month in the Money Over Time data (generated ' + fmtAsOf(MS.generated) + ').';
  }
  function showMsg(text) { msgEl.textContent = text; msgEl.hidden = false; }
  function clearMsg() { msgEl.textContent = ''; msgEl.hidden = true; statusFlash = ''; renderStatus(); }

  function afterDataChange() {
    closeDialog(true);
    hideTip();
    renderStatus();
    renderPresets();
    renderTextbook();
    renderLadder();
    renderCompare();
  }

  function onReset() {
    clearMsg();
    DATA = clone(pristine);
    customParts = {};
    statusFlash = 'Built-in data restored';
    afterDataChange();
    statusFlash = '';
  }

  function onExport() {
    statusFlash = '';
    renderStatus();
    const payload = Object.assign({ schema: SCHEMA_ID, exportedAt: new Date().toISOString() }, clone(DATA));
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'money-flow-data.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onFile(file) {
    clearMsg();
    if (!file) return;
    const name = file.name.slice(0, 60);
    if (file.size > 2000000) { showMsg('Import rejected: ' + name + ' is larger than 2 MB. Nothing was changed.'); return; }
    let text;
    try { text = await file.text(); } catch (e) { showMsg('Import rejected: ' + name + ' could not be read. Nothing was changed.'); return; }
    let obj;
    try { obj = JSON.parse(text); } catch (e) { showMsg('Import rejected: ' + name + ' is not valid JSON (' + e.message + '). Nothing was changed.'); return; }
    const res = validateImport(obj);
    if (res.errors.length) {
      const more = res.errors.length - 3;
      showMsg('Import rejected: ' + res.errors.slice(0, 3).join('; ') + (more > 0 ? '; and ' + more + ' more' : '') + '. Nothing was changed.');
      return;
    }
    DATA = res.data;
    res.replaced.forEach((k) => { customParts[k] = name; });
    statusFlash = 'Import accepted: ' + res.replaced.join(', ') + ' replaced.';
    afterDataChange();
    statusFlash = '';
  }

  /* ---------- card 1: the textbook multiplier ---------- */
  const SHORT_CB = { 'Federal Reserve': 'Fed', 'European Central Bank': 'ECB', 'Bank of England': 'BoE', 'Bank of Japan': 'BoJ', "People's Bank of China": 'PBoC' };
  const tb = { ratio: 0.1, deposit: 10000, pressed: -1, info: -1 };
  let mode = 'textbook';
  let revealRows = true;

  const ratioEl = qs('#in-ratio'), depEl = qs('#in-dep');

  function presetChipText(rr) {
    const short = SHORT_CB[rr.cb] || rr.cb;
    const plain = /^\d+(\.\d+)?%$/.test(rr.ratioText);
    const val = rr.ratio === 0 ? rr.ratioText : plain ? rr.ratioText : 'about ' + fmtPct(rr.ratio);
    const yr = /^\d{4}/.test(rr.since || '') ? ' since ' + rr.since.slice(0, 4) : '';
    return short + ' ' + val + yr;
  }

  // pressed marks the chip whose ratio the model is using; info marks a 0% chip whose note is open (it never changes the model)
  function renderPresets() {
    const host = qs('#presets');
    host.textContent = '';
    DATA.reserveRequirements.forEach((rr, i) => {
      const zero = rr.ratio === 0;
      const b = h('button', {
        class: 'chip mf-pchip', type: 'button', 'data-i': String(i), text: presetChipText(rr),
        'aria-pressed': zero ? null : 'false', 'aria-expanded': zero ? 'false' : null, 'aria-controls': zero ? 'preset-note' : null,
      });
      b.addEventListener('click', () => onPreset(i));
      host.appendChild(b);
    });
    // a chip is pressed only while the model uses its ratio, which a data reset or import can leave in place
    tb.pressed = DATA.reserveRequirements.findIndex((rr) => rr.ratio !== 0 && rr.ratio === tb.ratio);
    tb.info = -1;
    syncPresets();
  }

  function syncPresets() {
    document.querySelectorAll('.mf-pchip').forEach((b) => {
      const i = +b.dataset.i;
      if (b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', String(tb.info === i));
      else setPressed(b, tb.pressed === i);
    });
    renderPresetNote();
  }

  function renderPresetNote() {
    const note = qs('#preset-note');
    note.textContent = '';
    const i = tb.info >= 0 ? tb.info : tb.pressed;
    const rr = i >= 0 ? DATA.reserveRequirements[i] : null;
    if (!rr) return;
    const none = rr.ratio === 0 && /none/i.test(rr.ratioText);
    // for a central bank with none the note's first sentence repeats "no reserve requirement", so the next one is used
    const first = ((rr.note || '').split('. ')[none ? 1 : 0] || '').replace(/\.$/, '');
    note.appendChild(h('b', { text: rr.cb + ': ' }));
    note.appendChild(document.createTextNode((none ? 'no reserve requirement' : 'reserve requirement ' + rr.ratioText) + (rr.since && rr.since !== 'n/a' ? ', since ' + fmtAsOf(rr.since) : '') + '. '));
    if (rr.ratio === 0) {
      note.appendChild(document.createTextNode('With r = 0 the formula 1 / r has no finite answer. These banks are not limited by reserves, so the multiplier is not what limits lending, and the sliders are left as they are. '));
    } else {
      note.appendChild(document.createTextNode('The model now uses ' + fmtPct(rr.ratio) + '; the slider shows the nearest whole percent. '));
    }
    if (first) note.appendChild(document.createTextNode(first + '. '));
    note.appendChild(link(shortSource(rr.source), rr.url));
  }

  function onPreset(i) {
    const rr = DATA.reserveRequirements[i];
    if (rr.ratio === 0) {
      tb.info = tb.info === i ? -1 : i;
      syncPresets();
      return;
    }
    if (tb.pressed === i) { tb.pressed = -1; syncPresets(); return; }
    tb.pressed = i;
    tb.info = -1;
    tb.ratio = rr.ratio;
    ratioEl.value = String(clamp(Math.round(rr.ratio * 100), +ratioEl.min, +ratioEl.max));
    syncPresets();
    renderTextbook();
  }

  function renderTextbook() {
    const r = tb.ratio, D = tb.deposit;
    const mult = 1 / r, total = D / r, created = D * (1 - r) / r;

    qs('#out-ratio').textContent = fmtPct(r);
    qs('#out-dep').textContent = usd(D);
    ratioEl.setAttribute('aria-valuetext', fmtPct(r) + ' reserve ratio');
    depEl.setAttribute('aria-valuetext', usd(D) + ' first deposit');

    const tiles = qs('#tiles');
    tiles.textContent = '';
    [
      { cls: 'hero', label: 'Multiplier', value: fmtMult(mult), hint: '1 / r' },
      { label: 'Deposits supported', value: usd(total), hint: 'D / r, including the first deposit' },
      { label: 'New deposits created', value: usd(created), hint: 'D x (1 - r) / r, made by lending' },
      { label: 'Reserves held', value: usd(D), hint: 'r x D / r = D, the first deposit' },
    ].forEach((t) => {
      tiles.appendChild(h('div', { class: 'mf-tile' + (t.cls ? ' ' + t.cls : '') }, [
        h('div', { class: 'mf-tile-label', text: t.label }),
        h('div', { class: 'mf-tile-value', text: t.value }),
        h('div', { class: 'mf-tile-hint', text: t.hint }),
      ]));
    });

    qs('#tb-explain').textContent =
      'A bank keeps ' + fmtPct(r) + ' of each deposit as reserve and lends the rest. The loan is spent and ends up as a deposit at another bank, which does the same. ' +
      'The deposits form a series that adds up to ' + usd(total) + ', of which ' + usd(D) + ' is the first deposit and ' + usd(created) + ' is new deposits created by lending.';

    // rounds until 95% of the total is reached, at most 25
    let n = 1;
    while (n < 25 && 1 - Math.pow(1 - r, n) < 0.95) n++;
    const chain = qs('#chain');
    chain.textContent = '';
    const half = Math.ceil(n / 2);
    chain.style.setProperty('--kk', String(half + 1));
    const head = () => h('li', { class: 'mf-chainhead', 'aria-hidden': 'true' }, [
      h('span', { text: 'Round' }), h('span', { text: 'Deposit split' }),
      h('span', { class: 'r', text: 'Deposit' }), h('span', { class: 'r', text: 'Reserve' }), h('span', { class: 'r', text: 'Loan' }),
    ]);
    chain.appendChild(head());
    for (let i = 1; i <= n; i++) {
      if (i === half + 1) chain.appendChild(head());
      const f = Math.pow(1 - r, i - 1);
      const dep = D * f;
      const row = h('li', { class: 'mf-crow' }, [
        h('span', { class: 'mf-cround num' }, [h('span', { class: 'sr-only', text: 'Round ' }), String(i)]),
        h('span', { class: 'mf-cbar', 'aria-hidden': 'true' }, [
          h('span', { class: 'mf-cfill' }, [h('span', { class: 'mf-seg res' }), h('span', { class: 'mf-seg loan' })]),
        ]),
        h('span', { class: 'mf-cnum num' }, [h('span', { class: 'sr-only', text: 'Deposit ' }), usd(dep)]),
        h('span', { class: 'mf-cnum num' }, [h('span', { class: 'sr-only', text: 'Reserve ' }), usd(dep * r)]),
        h('span', { class: 'mf-cnum num' }, [h('span', { class: 'sr-only', text: 'Loan ' }), usd(dep * (1 - r))]),
      ]);
      row.style.setProperty('--f', String(f));
      row.style.setProperty('--r', String(r));
      row.style.setProperty('--l', String(1 - r));
      row.style.setProperty('--i', String(i));
      chain.appendChild(row);
    }
    chain.classList.toggle('reveal', revealRows && !reduceMotion());

    const rest = D * Math.pow(1 - r, n) / r;
    const sum = qs('#chain-sum');
    sum.textContent = '';
    sum.appendChild(h('p', { class: 'plain' }, [
      h('b', { text: 'Rounds ' + (n + 1) + ' onward ' }),
      rest < 0.5 ? 'add less than $1.' : 'add ' + usd(rest) + ' (' + fmtShare(rest / total) + ' of the total).',
    ]));
    sum.appendChild(h('p', { class: 'plain' }, [
      h('b', { text: 'Whole chain: ' }),
      'deposits ' + usd(total) + ', reserves ' + usd(D) + ', loans ' + usd(created) + '. Real banks are also limited by capital, loan demand and leakage into cash, so this is an upper bound.',
    ]));
    revealRows = false;

    scheduleLive('Reserve ratio ' + fmtPct(r) + ', first deposit ' + usd(D) + ': multiplier ' + fmtMult(mult) + ', deposits supported ' + usd(total) + ', new deposits created ' + usd(created) + '.');
  }

  let liveTimer = 0;
  function scheduleLive(text) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { qs('#tb-live').textContent = text; }, 500);
  }

  /* ---------- card 1: how it works today (T-accounts) ---------- */
  const ln = (label, amt, d) => ({ label, amt, d: d || 0 });
  const acct = (title, assets, liabs) => ({ title, assets: assets || [], liabs: liabs || [] });
  const STEPS = [
    {
      title: 'Bank A makes a loan',
      text: 'Bank A approves a $100 loan. It types $100 into the borrower\'s account and records the loan as an asset. No one else\'s savings were lent out, and no reserves have moved yet.',
      accts: [
        acct('Borrower', [ln('Deposit at Bank A', 100, 100)], [ln('Loan from Bank A', 100, 100)]),
        acct('Bank A', [ln('Loan to borrower', 100, 100), ln('Reserves at central bank', 100)], [ln('Deposit of borrower', 100, 100), ln('Capital', 100)]),
        acct('Bank B'),
        acct('Central bank', [ln('Government bonds', 100)], [ln('Reserves of Bank A', 100)]),
      ],
      money: ['+$100', 'A new deposit exists that was not there before.'],
      reserves: ['No change', 'Bank A\'s reserves are untouched until the borrower spends.'],
    },
    {
      title: 'The borrower pays someone at Bank B',
      text: 'The borrower spends the $100 on something sold by a customer of Bank B. Bank A settles by sending $100 of reserves to Bank B. If Bank A were short of reserves it would borrow them, and the central bank supplies them at its policy rate.',
      accts: [
        acct('Borrower', [ln('Deposit at Bank A', 0, -100), ln('Goods or services bought', 100, 100)], [ln('Loan from Bank A', 100)]),
        acct('Bank A', [ln('Loan to borrower', 100), ln('Reserves at central bank', 0, -100)], [ln('Deposit of borrower', 0, -100), ln('Capital', 100)]),
        acct('Bank B', [ln('Reserves at central bank', 100, 100)], [ln('Deposit of the seller', 100, 100)]),
        acct('Central bank', [ln('Government bonds', 100)], [ln('Reserves of Bank A', 0, -100), ln('Reserves of Bank B', 100, 100)]),
      ],
      money: ['No change', 'The deposit moved from Bank A to Bank B; the total did not change.'],
      reserves: ['Moved, total unchanged', '$100 of reserves went from Bank A to Bank B.'],
    },
    {
      title: 'The loan is repaid',
      text: 'Start again from the position after step 1. When the borrower repays the $100 from the account at Bank A, the bank deletes the loan and the deposit together. The money the loan created is gone.',
      accts: [
        acct('Borrower', [ln('Deposit at Bank A', 0, -100)], [ln('Loan from Bank A', 0, -100)]),
        acct('Bank A', [ln('Loan to borrower', 0, -100), ln('Reserves at central bank', 100)], [ln('Deposit of borrower', 0, -100), ln('Capital', 100)]),
        acct('Bank B'),
        acct('Central bank', [ln('Government bonds', 100)], [ln('Reserves of Bank A', 100)]),
      ],
      money: ['-$100', 'The deposit is destroyed with the loan.'],
      reserves: ['No change', 'Repayment from an account at the same bank moves no reserves.'],
    },
    {
      title: 'The central bank buys bonds (QE)',
      text: 'Also from the position after step 1: the central bank buys $100 of bonds from a pension fund that banks at Bank B. It pays with newly created reserves for Bank B, and Bank B credits the fund with a new $100 deposit.',
      accts: [
        acct('Bond seller', [ln('Government bonds', 0, -100), ln('Deposit at Bank B', 100, 100)], [ln('Net worth', 100)]),
        acct('Bank A'),
        acct('Bank B', [ln('Reserves at central bank', 100, 100)], [ln('Deposit of the bond seller', 100, 100)]),
        acct('Central bank', [ln('Government bonds', 200, 100)], [ln('Reserves of Bank A', 100), ln('Reserves of Bank B', 100, 100)]),
      ],
      money: ['+$100', 'The seller swaps a bond for a new deposit.'],
      reserves: ['+$100', 'Total reserves rise from $100 to $200.'],
    },
  ];
  let stepIdx = 0;

  function renderSteps() {
    const list = qs('#steps');
    list.textContent = '';
    STEPS.forEach((s, i) => {
      const b = h('button', { type: 'button', 'data-i': String(i) }, [h('span', { class: 'n', text: String(i + 1) }), h('span', { text: s.title })]);
      b.addEventListener('click', () => goStep(i));
      list.appendChild(h('li', null, [b]));
    });
    renderStep();
  }

  function goStep(i) {
    stepIdx = clamp(i, 0, STEPS.length - 1);
    renderStep();
  }

  function renderStep() {
    const s = STEPS[stepIdx];
    document.querySelectorAll('#steps button').forEach((b) => {
      if (+b.dataset.i === stepIdx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    qs('#step-count').textContent = 'Step ' + (stepIdx + 1) + ' of ' + STEPS.length;
    qs('#step-prev').setAttribute('aria-disabled', String(stepIdx === 0));
    qs('#step-next').setAttribute('aria-disabled', String(stepIdx === STEPS.length - 1));

    const side = (title, lines) => {
      const shown = lines.filter((l) => l.amt !== 0 || l.d !== 0);
      return h('div', { class: 'mf-acct-col' }, [
        h('h5', { text: title }),
        h('ul', null, shown.map((l) => h('li', { class: 'mf-line' + (l.d ? ' chg' : '') }, [
          h('span', { class: 'nm', text: l.label }),
          h('span', { class: 'amt num' }, [
            '$' + nf0.format(l.amt),
            l.d ? h('small', null, [h('span', { class: 'sr-only', text: ' changed by ' }), signedUsd(l.d)]) : null,
          ]),
        ]))),
      ]);
    };
    const accts = h('div', { class: 'mf-accts' }, s.accts.map((a) => {
      const empty = !a.assets.length && !a.liabs.length;
      return h('div', { class: 'mf-acct' + (empty ? ' idle' : '') }, [
        h('h4', { text: a.title }),
        empty ? h('p', { class: 'mf-acct-empty', text: 'Not involved in this step.' })
          : h('div', { class: 'mf-acct-cols' }, [side('Assets', a.assets), side('Liabilities', a.liabs)]),
      ]);
    }));
    const eff = (label, e) => h('div', { class: 'mf-effect' }, [
      h('b', { text: label }), h('div', { class: 'v', text: e[0] }), h('p', { text: e[1] }),
    ]);
    const body = qs('#stepbody');
    body.textContent = '';
    body.appendChild(h('h4', { class: 'mf-step-title', text: 'Step ' + (stepIdx + 1) + ': ' + s.title }));
    body.appendChild(h('p', { class: 'plain', text: s.text }));
    body.appendChild(accts);
    body.appendChild(h('div', { class: 'mf-effects' }, [eff('Broad money (deposits)', s.money), eff('Bank reserves', s.reserves)]));
    qs('#step-live').textContent = 'Step ' + (stepIdx + 1) + ' of ' + STEPS.length + ': ' + s.title + '. ' + s.text + ' Broad money: ' + s.money[0] + '. Reserves: ' + s.reserves[0] + '.';
  }

  /* ---------- card 1: the evidence chart ---------- */
  // shown in the legend and the table in this order; blue sits between orange and green on purpose
  const EV = [
    { key: 'uk', name: 'UK', long: 'UK M4 / (notes and coin + reserve balances)', num: 'uk_m4', den: ['uk_notes_coin', 'uk_reserves'], econ: 'uk', shape: 'diamond' },
    { key: 'us', name: 'US', long: 'US M2 / monetary base', num: 'us_m2', den: ['us_base'], econ: 'us', shape: 'circle' },
    { key: 'jp', name: 'Japan', long: 'Japan M2 / monetary base', num: 'jp_m2', den: ['jp_base'], econ: 'jp', shape: 'triangle' },
  ];
  const SHAPE_PATH = {
    circle: 'M0,-5.5A5.5,5.5 0 1,0 0,5.5A5.5,5.5 0 1,0 0,-5.5Z',
    diamond: 'M0,-7L6,0L0,7L-6,0Z',
    triangle: 'M0,-6.5L6.5,5L-6.5,5Z',
    square: 'M-5,-5H5V5H-5Z',
    star: 'M0,-7L2,-2.4L7,-2.2L3.1,1L4.4,6L0,3.2L-4.4,6L-3.1,1L-7,-2.2L-2,-2.4Z',
  };
  const ev = { scale: 'linear', range: '2000', table: false, series: null, cursor: null };

  function seriesMap(id) {
    const m = new Map();
    const s = msSeries(id);
    if (!s) return m;
    s.data.forEach((r) => { if (r && r[1] != null && isFinite(r[1])) m.set(r[0], r[1]); });
    return m;
  }

  function buildEvSeries() {
    ev.series = EV.map((def) => {
      const num = seriesMap(def.num);
      const dens = def.den.map(seriesMap);
      const pts = [];
      num.forEach((v, p) => {
        const mi = monthIndex(p);
        if (mi == null) return;
        let dsum = 0, ok = true;
        dens.forEach((m) => { if (m.has(p)) dsum += m.get(p); else ok = false; });
        if (ok && dsum > 0) pts.push({ mi, p, v: v / dsum });
      });
      pts.sort((a, b) => a.mi - b.mi);
      const byMi = new Map(pts.map((q) => [q.mi, q.v]));
      return Object.assign({}, def, { pts, byMi });
    }).filter((s) => s.pts.length);
  }

  const fmtRatio = (v) => v.toFixed(1) + 'x';

  function evRange() {
    const all = ev.series;
    const lo = Math.min.apply(null, all.map((s) => s.pts[0].mi));
    const hi = Math.max.apply(null, all.map((s) => s.pts[s.pts.length - 1].mi));
    return [ev.range === 'all' ? lo : Math.max(lo, 2000 * 12), hi];
  }

  function renderEvidence() {
    const stage = qs('#ev-stage');
    const legend = qs('#ev-legend');
    legend.textContent = '';
    if (!ev.series) buildEvSeries();
    const [x0, x1] = evRange();

    ev.series.forEach((s) => {
      const key = sv('svg', { class: 'key', viewBox: '0 0 26 14', 'aria-hidden': 'true' }, [
        sv('line', { x1: '1', y1: '7', x2: '25', y2: '7' }),
        sv('path', { d: SHAPE_PATH[s.shape], transform: 'translate(13 7) scale(.7)' }),
      ]);
      key.style.setProperty('--c', colorOf(s.econ));
      const last = s.pts[s.pts.length - 1];
      legend.appendChild(h('span', { class: 'mf-lg' }, [key, s.long + ': ' + fmtRatio(last.v) + ' (' + fmtMonth(last.mi) + ')']));
    });

    const names = ev.series.map((s) => s.name + ' ' + fmtRatio(s.pts[s.pts.length - 1].v)).join(', ');
    stage.setAttribute('aria-label', 'Chart of broad money divided by base money, latest ' + names + '. Use left and right arrow keys to move the readout, Home and End to jump.');

    const note = qs('#ev-note');
    const starts = ev.series.map((s) => s.name + ' ' + fmtMonth(s.pts[0].mi)).join(', ');
    note.textContent = 'Ratios use local-currency levels, so exchange rates do not enter. US and Japan: broad money (M2) over the monetary base. UK: M4 over notes and coin plus bank reserve balances (the old M0 was a different definition). ' +
      'Each line starts where both parts exist: ' + starts + '. US M2 is seasonally adjusted but the US base is not, so the US line carries some seasonal noise. ' +
      'Definitions differ across economies, so compare the shape of each line, not the levels.';
    const src = qs('#ev-src');
    src.textContent = '';
    src.appendChild(document.createTextNode('Sources: '));
    const part = (id) => {
      const ser = msSeries(id);
      return link(ser ? ser.label + ', ' + shortSource(ser.source) : id, ser ? ser.url : null);
    };
    ev.series.forEach((s, i) => {
      if (i) src.appendChild(document.createTextNode('; '));
      src.appendChild(document.createTextNode(s.name + ': '));
      src.appendChild(part(s.num));
      src.appendChild(document.createTextNode(' divided by '));
      s.den.forEach((id, j) => {
        if (j) src.appendChild(document.createTextNode(' plus '));
        src.appendChild(part(id));
      });
    });
    src.appendChild(document.createTextNode(' (via the Money Over Time data, generated ' + fmtAsOf(MS.generated) + ').'));

    renderEvTable(x0, x1);
    qs('#ev-table').hidden = !ev.table;
    stage.hidden = ev.table;
    legend.hidden = false;
    if (ev.table) return;
    drawEvChart(stage, x0, x1);
  }

  function renderEvTable(x0, x1) {
    const y0 = Math.floor(x0 / 12), y1 = Math.floor(x1 / 12);
    const rows = [];
    for (let y = y1; y >= y0; y--) {
      const cells = ev.series.map((s) => {
        let best = null;
        for (let m = 11; m >= 0; m--) {
          const mi = y * 12 + m;
          if (mi >= x0 && mi <= x1 && s.byMi.has(mi)) { best = { mi, v: s.byMi.get(mi) }; break; }
        }
        return best;
      });
      if (cells.every((c) => !c)) continue;
      rows.push([String(y)].concat(cells.map((c) => (c ? fmtRatio(c.v) + ' (' + MON[c.mi % 12] + ')' : 'n/a'))));
    }
    buildTable(qs('#ev-table'), 'Broad money divided by base money, last month available in each year',
      [{ label: 'Year' }].concat(ev.series.map((s) => ({ label: s.long }))), rows);
  }

  function drawEvChart(stage, x0, x1) {
    stage.textContent = '';
    const W = stage.clientWidth;
    if (!d3) {
      stage.appendChild(h('p', { class: 'empty', text: d3Failed
        ? 'The chart library did not load, so the line chart is not drawn. The table view has the same numbers.'
        : 'Loading the chart library. The table view has the same numbers.' }));
      return;
    }
    if (W < 40) return;
    // the stylesheet sets the stage height (300px, 260px on phones), so the drawing matches the box it sits in
    const H = stage.clientHeight || 300;
    const M = { t: 12, r: 16, b: 26, l: 40 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;

    // y domain from the points inside the visible range
    let ymin = Infinity, ymax = -Infinity;
    ev.series.forEach((s) => s.pts.forEach((q) => { if (q.mi >= x0 && q.mi <= x1) { ymin = Math.min(ymin, q.v); ymax = Math.max(ymax, q.v); } }));
    if (!isFinite(ymin)) return;
    const x = d3.scaleLinear().domain([x0, x1]).range([0, iw]);
    let y, yticks;
    if (ev.scale === 'log') {
      y = d3.scaleLog().domain([ymin * 0.85, ymax * 1.15]).range([ih, 0]);
      yticks = [1, 2, 3, 5, 10, 20, 30, 50, 100].filter((t) => t >= y.domain()[0] && t <= y.domain()[1]);
    } else {
      y = d3.scaleLinear().domain([0, ymax * 1.06]).nice().range([ih, 0]);
      yticks = y.ticks(5);
    }

    const svg = sv('svg', { class: 'mf-chart', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    const g = sv('g', { transform: 'translate(' + M.l + ',' + M.t + ')' });
    svg.appendChild(g);

    yticks.forEach((t) => {
      const yy = Math.round(y(t)) + 0.5;
      g.appendChild(sv('line', { class: 'grid', x1: 0, x2: iw, y1: yy, y2: yy }));
      g.appendChild(sv('text', { class: 'ytick', x: -8, y: yy, dy: '0.32em', 'text-anchor': 'end' })).textContent = t + 'x';
    });
    g.appendChild(sv('line', { class: 'axisline', x1: 0, x2: iw, y1: ih + 0.5, y2: ih + 0.5 }));

    // year ticks, a step that keeps about six of them
    const span = (x1 - x0) / 12;
    const step = [1, 2, 5, 10, 20].find((s) => span / s <= 7) || 20;
    for (let yr = Math.ceil(x0 / 12 / step) * step; yr * 12 <= x1; yr += step) {
      const xx = x(yr * 12);
      g.appendChild(sv('line', { class: 'axisline', x1: xx, x2: xx, y1: ih, y2: ih + 4 }));
      // a label at the origin starts at its tick, so it stays clear of the 0x label to its left
      g.appendChild(sv('text', { x: xx, y: ih + 18, 'text-anchor': xx < 16 ? 'start' : 'middle' })).textContent = String(yr);
    }

    const line = d3.line().x((q) => x(q.mi)).y((q) => y(q.v));
    ev.series.forEach((s) => {
      const pts = s.pts.filter((q) => q.mi >= x0 && q.mi <= x1);
      if (!pts.length) return;
      const grp = sv('g', { class: 'mf-s' });
      grp.style.setProperty('--c', colorOf(s.econ));
      grp.appendChild(sv('path', { class: 'mf-ln', d: line(pts) }));
      const last = pts[pts.length - 1];
      grp.appendChild(sv('path', { class: 'mf-end', d: SHAPE_PATH[s.shape], transform: 'translate(' + x(last.mi) + ' ' + y(last.v) + ')' }));
      g.appendChild(grp);
    });

    // crosshair
    const cur = sv('g', { class: 'mf-cursor', visibility: 'hidden' });
    const vline = sv('line', { class: 'vline', y1: 0, y2: ih });
    cur.appendChild(vline);
    const dots = ev.series.map((s) => {
      const c = sv('circle', { class: 'mf-dot', r: 5 });
      c.style.setProperty('--c', colorOf(s.econ));
      cur.appendChild(c);
      return c;
    });
    g.appendChild(cur);
    const overlay = sv('rect', { class: 'mf-overlay', x: 0, y: 0, width: iw, height: ih });
    g.appendChild(overlay);
    stage.appendChild(svg);

    const readout = h('div', { class: 'tip mf-readout', hidden: true });
    stage.appendChild(readout);

    function show(mi) {
      mi = clamp(Math.round(mi), x0, x1);
      ev.cursor = mi;
      const xx = x(mi);
      vline.setAttribute('x1', xx); vline.setAttribute('x2', xx);
      cur.setAttribute('visibility', 'visible');
      readout.textContent = '';
      readout.appendChild(h('b', { text: fmtMonth(mi) }));
      const rows = [];
      ev.series.forEach((s, i) => {
        const v = s.byMi.get(mi);
        if (v == null) { dots[i].setAttribute('visibility', 'hidden'); return; }
        dots[i].setAttribute('visibility', 'visible');
        dots[i].setAttribute('cx', xx); dots[i].setAttribute('cy', y(v));
        const key = sv('svg', { class: 'key', viewBox: '0 0 22 12', 'aria-hidden': 'true' }, [
          sv('line', { x1: '1', y1: '6', x2: '21', y2: '6' }),
          sv('path', { d: SHAPE_PATH[s.shape], transform: 'translate(11 6) scale(.6)' }),
        ]);
        key.style.setProperty('--c', colorOf(s.econ));
        readout.appendChild(h('div', { class: 'mf-ro' }, [key, h('span', { class: 'nm', text: s.name }), h('span', { class: 'val num', text: fmtRatio(v) })]));
        rows.push(s.name + ' ' + fmtRatio(v));
      });
      if (!rows.length) readout.appendChild(h('div', { class: 'mf-ro', text: 'No data' }));
      readout.hidden = false;
      const rw = readout.offsetWidth;
      let left = M.l + xx + 12;
      if (left + rw > W - 4) left = M.l + xx - 12 - rw;
      readout.style.left = Math.max(4, left) + 'px';
      readout.style.top = M.t + 6 + 'px';
      return rows.join(', ');
    }
    function hide() {
      cur.setAttribute('visibility', 'hidden');
      readout.hidden = true;
      ev.cursor = null;
    }
    overlay.addEventListener('pointermove', (e) => {
      const r = overlay.getBoundingClientRect();
      show(x.invert(((e.clientX - r.left) / r.width) * iw));
    });
    overlay.addEventListener('pointerleave', () => { if (document.activeElement !== stage) hide(); });
    stage.onfocus = () => { if (ev.cursor == null) show(x1); };
    stage.onblur = hide;
    stage.onkeydown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      const cur0 = ev.cursor == null ? x1 : ev.cursor;
      const d = e.shiftKey ? 12 : 1;
      let next = cur0;
      if (e.key === 'ArrowLeft') next = cur0 - d;
      else if (e.key === 'ArrowRight') next = cur0 + d;
      else if (e.key === 'Home') next = x0;
      else next = x1;
      const txt = show(next);
      qs('#ev-live').textContent = fmtMonth(clamp(Math.round(next), x0, x1)) + ': ' + (txt || 'no data');
    };
    // keep a shown readout after a redraw (resize, scale change)
    if (ev.cursor != null && document.activeElement === stage) show(ev.cursor);
  }

  /* ---------- card 2: orders of magnitude ---------- */
  const LGROUPS = ['notional', 'debt', 'money', 'flow', 'market', 'cb-assets'];
  const LAD_MIN_DEC = -3, LAD_MAX_DEC = 5; // axis limits in powers of ten of US dollar trillions
  let ladderRows = [];
  let ladderByid = {};

  function relatives(id) {
    const anc = [], desc = [];
    let cur = ladderByid[id];
    let guard = 0;
    while (cur && cur.partOf && ladderByid[cur.partOf] && guard++ < 20) { cur = ladderByid[cur.partOf]; anc.push(cur.id); }
    const walk = (pid) => {
      ladderRows.forEach((r) => { if (r.partOf === pid && desc.indexOf(r.id) < 0) { desc.push(r.id); walk(r.id); } });
    };
    walk(id);
    return { anc, desc };
  }

  function decadeLabel(k) {
    const v = Math.pow(10, k);
    return (v >= 1 ? nf0.format(v) : String(v)) + 'T';
  }

  function renderLadder() {
    const host = qs('#ladder');
    host.textContent = '';
    const all = resolveMagnitudes();
    const have = all.filter((r) => r.value != null && isFinite(r.value) && r.value > 0);
    const missing = all.length - have.length;
    ladderRows = have;
    ladderByid = {};
    have.forEach((r) => { ladderByid[r.id] = r; });

    const tvals = have.map((r) => r.value / 1000);
    const minDec = Math.max(LAD_MIN_DEC, Math.min(-1, Math.floor(Math.log10(Math.min.apply(null, tvals.concat([1]))))));
    const maxDec = Math.min(LAD_MAX_DEC, Math.max(3, Math.ceil(Math.log10(Math.max.apply(null, tvals.concat([1]))))));
    const pos = (v) => clamp((Math.log10(v / 1000) - minDec) / (maxDec - minDec), 0, 1);
    const decs = maxDec - minDec;
    const offScale = have.filter((r) => { const k = Math.log10(r.value / 1000); return k < minDec - 1e-9 || k > maxDec + 1e-9; }).length;

    const depthOf = (r) => { let d = 0, cur = r; while (cur.partOf && ladderByid[cur.partOf] && d < 3) { cur = ladderByid[cur.partOf]; d++; } return d; };

    const axis = h('div', { class: 'mf-laxis', 'aria-hidden': 'true' }, [h('span', { class: 'lead', text: 'US dollars, log scale' })]);
    const ticks = h('div', { class: 'ticks' });
    for (let k = minDec; k <= maxDec; k++) {
      const t = h('span', { text: decadeLabel(k) });
      t.style.left = ((k - minDec) / decs) * 100 + '%';
      ticks.appendChild(t);
    }
    axis.appendChild(ticks);
    host.appendChild(axis);

    LGROUPS.forEach((type) => {
      const rows = have.filter((r) => r.type === type).sort((a, b) => b.value - a.value);
      if (!rows.length) return;
      host.appendChild(h('h3', { class: 'mf-ghead', text: TYPE_LABEL[type] }));
      const ul = h('ul', { class: 'mf-lrows' });
      rows.forEach((r) => ul.appendChild(ladderRow(r, pos, decs, depthOf(r))));
      host.appendChild(ul);
    });

    const diffs = aggregateDiffs();
    qs('#ladder-note').textContent =
      'Log scale: each gridline is ten times the one before. Nesting: currency < M1 < M2 < M3; US federal debt < public debt < total debt. ' +
      'Money rows are the latest month in the Money Over Time data, in US dollars at that month\'s end rate. Hover or focus a row to see what it sits inside.' +
      (diffs.length ? ' This list uses ' + joinList(diffs.map((d) => d.ladder)) + '; Compare > Money supply charts the headline ' + joinList(diffs.map((d) => d.headline)) + ' for the same economies, so those figures differ.' : '');
    const foot = [];
    if (missing) foot.push(missing + (missing > 1 ? ' rows have' : ' row has') + ' no value and ' + (missing > 1 ? 'are' : 'is') + ' not shown.');
    if (offScale) foot.push(offScale + (offScale > 1 ? ' rows are' : ' row is') + ' beyond the ' + decadeLabel(minDec) + ' to ' + decadeLabel(maxDec) + ' scale and ' + (offScale > 1 ? 'are' : 'is') + ' drawn at its edge; the value is still exact.');
    qs('#ladder-foot').textContent = foot.join(' ');

    buildTable(qs('#ladder-table'), 'Orders of magnitude, US dollar billions. Rows overlap and are not additive.',
      [{ label: 'Quantity' }, { label: 'Type' }, { label: 'Value (USD bn)' }, { label: 'As of' }, { label: 'Part of' }, { label: 'Source', wrap: true }],
      LGROUPS.reduce((acc, type) => acc.concat(have.filter((r) => r.type === type).sort((a, b) => b.value - a.value).map((r) => [
        r.label, TYPE_LABEL[r.type], nf1.format(r.value), fmtAsOf(r.asOf),
        r.partOf && ladderByid[r.partOf] ? ladderByid[r.partOf].label : '',
        { text: shortSource(r.source), href: r.url },
      ])), []));
  }

  function ladderRow(r, pos, decs, depth) {
    const li = h('li', { class: 'mf-lrow', 'data-id': r.id });
    li.style.setProperty('--d', String(depth));
    li.style.setProperty('--dec', String(decs));
    const btn = h('button', { class: 'mf-lbtn', type: 'button', 'aria-haspopup': 'dialog', text: r.label });
    const meta = h('div', { class: 'mf-lmeta' }, [
      h('span', { class: 'badge', text: TYPE_LABEL[r.type] }),
      h('span', { text: 'as of ' + fmtAsOf(r.asOf) }),
      link(shortSource(r.source), r.url, 'mf-lsrc', r.source),
    ]);
    const kids = [btn];
    if (r.partOf && ladderByid[r.partOf]) {
      const par = h('button', { class: 'mf-link', type: 'button', text: 'inside ' + ladderByid[r.partOf].label });
      par.addEventListener('click', () => {
        const target = qs('.mf-lrow[data-id="' + r.partOf + '"] .mf-lbtn');
        if (target) { target.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); target.focus(); }
      });
      kids.push(par);
    }
    kids.push(h('span', { class: 'mf-lval num', text: fmtBn(r.value) }));
    const track = h('div', { class: 'mf-track', 'aria-hidden': 'true' }, [h('span', { class: 'mf-stem' }), h('span', { class: 'mf-dot' })]);
    track.style.setProperty('--p', String(pos(r.value)));
    li.appendChild(h('div', { class: 'mf-ltext' }, [
      h('div', { class: 'mf-lhead' }, kids),
      meta,
    ]));
    li.appendChild(track);

    const enter = (x, y, anchor, focused) => {
      highlight(r.id);
      const rel = relatives(r.id);
      const lines = [fmtBn(r.value) + ', as of ' + fmtAsOf(r.asOf)];
      if (rel.anc.length) lines.push('Inside: ' + rel.anc.map((id) => ladderByid[id].label).join(' < '));
      if (rel.desc.length) {
        const names = rel.desc.slice(0, 4).map((id) => ladderByid[id].label);
        lines.push('Contains: ' + names.join(', ') + (rel.desc.length > 4 ? ' and ' + (rel.desc.length - 4) + ' more' : ''));
      }
      lines.push('Press Enter or click for the note and source.');
      setTip(r.label, lines);
      if (anchor) placeTipAt(anchor, focused); else placeTip(x, y);
    };
    li.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') enter(e.clientX, e.clientY); });
    li.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch' && !tipEl.hidden) placeTip(e.clientX, e.clientY); });
    li.addEventListener('pointerleave', () => { if (!li.contains(document.activeElement)) { highlight(null); hideTip(); } });
    li.addEventListener('focusin', (e) => enter(0, 0, btn, e.target));
    li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) { highlight(null); hideTip(); } });
    btn.addEventListener('click', () => openDialog(ladderDialog(r), btn));
    return li;
  }

  function highlight(id) {
    const host = qs('#ladder');
    if (!id) {
      host.classList.remove('has-focus');
      host.querySelectorAll('.in-chain, .is-focus').forEach((n) => n.classList.remove('in-chain', 'is-focus'));
      return;
    }
    host.querySelectorAll('.in-chain, .is-focus').forEach((n) => n.classList.remove('in-chain', 'is-focus'));
    const rel = relatives(id);
    host.classList.add('has-focus');
    [id].concat(rel.anc, rel.desc).forEach((x) => {
      const row = qs('.mf-lrow[data-id="' + x + '"]', host);
      if (row) row.classList.add('in-chain');
    });
    const me = qs('.mf-lrow[data-id="' + id + '"]', host);
    if (me) me.classList.add('is-focus');
  }

  const sameYear = (a, b) => { const ya = asOfYear(a); return ya != null && ya === asOfYear(b); };
  const fmtMultiple = (m) => (m < 0.01 ? '<0.01x' : +m.toFixed(m >= 10 ? 1 : 2) + 'x');

  function ladderDialog(r) {
    const rows = [
      ['Value', fmtBn(r.value)],
      ['Value (USD billions)', nf1.format(r.value)],
      ['As of', fmtAsOf(r.asOf)],
      ['Type', TYPE_LABEL[r.type]],
    ];
    const rel = relatives(r.id);
    const parent = r.partOf && ladderByid[r.partOf];
    const world = ladderByid['world-gdp'];
    // a ratio of two figures from different years would mix dates, so it is left out; the note keeps any ratio the source states
    const skipped = [];
    if (parent) {
      if (sameYear(r.asOf, parent.asOf)) rows.push(['Share of ' + parent.label, fmtShare(r.value / parent.value)]);
      else skipped.push('the share of ' + parent.label + ' (' + fmtAsOf(parent.asOf) + ')');
    }
    if (world && r.id !== 'world-gdp') {
      if (sameYear(r.asOf, world.asOf)) rows.push(['Multiple of world GDP (' + fmtAsOf(world.asOf) + ')', fmtMultiple(r.value / world.value)]);
      else skipped.push('the multiple of world GDP (' + fmtAsOf(world.asOf) + ')');
    }
    const paras = [];
    if (r.note) paras.push(r.note);
    if (skipped.length) paras.push('Not shown, because the date differs from this row (' + fmtAsOf(r.asOf) + '): ' + skipped.join(' and ') + '.');
    if (rel.anc.length) paras.push('Inside: ' + rel.anc.map((id) => ladderByid[id].label).join(' < ') + '.');
    if (rel.desc.length) paras.push('Contains: ' + rel.desc.map((id) => ladderByid[id].label).join(', ') + '.');
    if (r.derived) paras.push('Read from the Money Over Time data when the page loads, so it moves when that data is updated.');
    paras.push('Rows overlap and are not additive.');
    return { title: r.label, tags: [TYPE_LABEL[r.type]], rows, paras, source: { text: r.source, url: r.url } };
  }

  /* ---------- card 3: compare ---------- */
  const CTABS = [
    { id: 'banks', label: 'Largest banks' },
    { id: 'cbs', label: 'Central banks' },
    { id: 'gdp', label: 'GDP' },
    { id: 'money', label: 'Money supply' },
    { id: 'debt', label: 'Government debt' },
  ];
  const cmp = { tab: 'banks', table: false };

  function moneyEntries() {
    return DATA.moneyRows.map((m) => {
      const e = { m, v: null, period: null, local: null, ser: null, source: m.source || '', url: m.url || null };
      if (m.seriesId) {
        const l = msLatest(m.seriesId);
        if (l) {
          e.v = l.v; e.period = l.period; e.local = l.local; e.ser = l.s;
          e.source = l.s.source; e.url = l.s.url;
        }
      } else if (m.valueBn != null) { e.v = m.valueBn; e.period = m.asOf; }
      return e;
    });
  }

  function localText(e) {
    if (e.ser && e.local != null) {
      const econ = e.ser.economy || e.m.economy;
      const ec = hasOwn(MS.economies || {}, econ) ? MS.economies[econ].currency : '';
      return (ec ? ec + ' ' : '') + nf0.format(e.local) + ' billion';
    }
    return e.m.local || '';
  }

  // one tab's rows, sorted, plus what its table and footnotes need
  function compareData(id) {
    const out = { title: '', sub: '', rows: [], tableCols: [], tableRows: [], notes: [], caption: '' };
    if (id === 'banks') {
      out.title = 'Largest banks by total assets';
      out.sub = 'US dollar billions. Each row shows its own date; ranks near the bottom of the list differ between ranking sites.';
      out.rows = DATA.banks.map((b) => {
        const g = gdpOfName(b.country);
        return { kind: 'bank', name: b.name, sub: (b.country ? b.country + ', ' : '') + fmtAsOf(b.asOf), value: b.assetsBn, econ: g ? g.economy : 'xx', home: g, country: b.country, asOf: b.asOf, source: b.source, url: b.url };
      });
    } else if (id === 'cbs') {
      out.title = 'Central banks by total assets';
      out.sub = 'US dollar billions. Balance-sheet size, not money supply; these assets partly mirror base money and government debt.';
      out.rows = DATA.centralBanks.map((c) => ({ kind: 'cb', name: c.name, sub: 'as of ' + fmtAsOf(c.asOf), value: c.assetsBn, econ: c.economy, home: gdpOf(c.economy), local: c.local, asOf: c.asOf, source: c.source, url: c.url, note: c.note }));
    } else if (id === 'gdp') {
      out.title = 'Gross domestic product';
      out.sub = 'US dollar billions at current prices, one year per row.';
      out.rows = DATA.gdp.filter((g) => g.economy !== 'ea').map((g) => ({ kind: 'gdp', name: g.name, sub: String(g.year), value: g.gdpBn, econ: g.economy, asOf: String(g.year), source: g.source, url: g.url }));
      const ea = gdpOf('ea');
      if (ea) out.notes.push('The euro-area aggregate (' + fmtBn(ea.gdpBn) + ', ' + ea.year + ') overlaps Germany, France and Italy, so it is left out of the ranking.');
    } else if (id === 'money') {
      out.title = 'Money supply';
      out.sub = 'US dollar billions: the latest month in the Money Over Time data at that month\'s end rate, headline aggregate for each economy. India is a curated row.';
      const ent = moneyEntries();
      const seen = {};
      ent.forEach((e) => {
        if (e.v == null || hasOwn(seen, e.m.economy)) return;
        seen[e.m.economy] = 1;
        const g = gdpOf(e.m.economy);
        out.rows.push({ kind: 'money', name: e.m.label, sub: fmtAsOf(e.period), value: e.v, econ: e.m.economy, home: g, local: localText(e), asOf: e.period, source: e.source, url: e.url, note: e.m.note, entry: e, others: ent.filter((o) => o.v != null && o.m.economy === e.m.economy && o !== e) });
      });
      out.notes.push('Definitions differ, so levels are not comparable across economies. Where an economy lists several aggregates, the first (its headline) is charted; the rest are in the table view and in each detail.');
      const diffs = aggregateDiffs();
      if (diffs.length) out.notes.push('The orders-of-magnitude list uses ' + joinList(diffs.map((d) => d.ladder)) + ' for these economies, so its figures for them differ from the headline aggregates here.');
      out.allMoney = ent;
    } else {
      out.title = 'Government debt';
      out.sub = 'US dollar billions. The basis differs by economy (gross or net, general or central government) and is stated in each detail.';
      out.rows = DATA.debt.map((d) => ({ kind: 'debt', name: d.name, sub: 'as of ' + fmtAsOf(d.asOf), value: d.debtBn, econ: d.economy, home: gdpOf(d.economy), basis: d.basis, ofGdp: d.ofGdp, asOf: d.asOf, source: d.source, url: d.url }));
      out.notes.push('Rows are not like for like: check each basis before comparing two economies. Debt to GDP is the ratio each source publishes for its own basis and date; it is not recomputed from these dollar levels, which sit at a different date and exchange rate from GDP.');
    }
    out.rows = out.rows.filter((r) => r.value != null && isFinite(r.value)).sort((a, b) => b.value - a.value);
    const total = out.rows.reduce((a, r) => a + r.value, 0);
    out.rows.forEach((r, i) => { r.rank = i + 1; r.total = total; r.n = out.rows.length; });
    buildCompareTable(id, out);
    return out;
  }

  function buildCompareTable(id, out) {
    const src = (r) => ({ text: shortSource(r.source), href: r.url });
    if (id === 'banks') {
      out.caption = 'Largest banks by total assets, US dollar billions';
      out.tableCols = [{ label: 'Bank' }, { label: 'Rank' }, { label: 'Country' }, { label: 'Assets (USD bn)' }, { label: 'As of' }, { label: 'Source', wrap: true }];
      out.tableRows = out.rows.map((r) => [r.name, String(r.rank), r.country || '', nf1.format(r.value), fmtAsOf(r.asOf), src(r)]);
    } else if (id === 'cbs') {
      out.caption = 'Central banks by total assets, US dollar billions';
      out.tableCols = [{ label: 'Central bank' }, { label: 'Assets (USD bn)' }, { label: 'Local currency', wrap: true }, { label: 'As of' }, { label: 'Source', wrap: true }];
      out.tableRows = out.rows.map((r) => [r.name, nf1.format(r.value), r.local || '', fmtAsOf(r.asOf), src(r)]);
    } else if (id === 'gdp') {
      out.caption = 'Gross domestic product, US dollar billions';
      out.tableCols = [{ label: 'Economy' }, { label: 'Rank' }, { label: 'GDP (USD bn)' }, { label: 'Year' }, { label: 'Source', wrap: true }];
      out.tableRows = out.rows.map((r) => [r.name, String(r.rank), nf1.format(r.value), r.asOf, src(r)]);
    } else if (id === 'money') {
      out.caption = 'Money supply, US dollar billions, all aggregates (the chart shows the headline for each economy)';
      out.tableCols = [{ label: 'Aggregate' }, { label: 'Value (USD bn)' }, { label: 'Local currency', wrap: true }, { label: 'Period' }, { label: 'Money / GDP (USD levels)' }, { label: 'Source', wrap: true }];
      out.tableRows = out.allMoney.map((e) => {
        const g = gdpOf(e.m.economy);
        return [e.m.label, e.v == null ? 'n/a' : nf1.format(e.v), localText(e), e.v == null ? 'n/a' : fmtAsOf(e.period), e.v != null && g ? fmtShare(e.v / g.gdpBn) : 'n/a', { text: shortSource(e.source), href: e.url }];
      });
    } else {
      out.caption = 'Government debt, US dollar billions';
      out.tableCols = [{ label: 'Economy' }, { label: 'Debt (USD bn)' }, { label: 'As of' }, { label: 'Debt / GDP (as published)', wrap: true }, { label: 'Basis', wrap: true }, { label: 'Source', wrap: true }];
      out.tableRows = out.rows.map((r) => [r.name, nf1.format(r.value), fmtAsOf(r.asOf), r.ofGdp || '', r.basis || '', src(r)]);
    }
  }

  // the derived ratios shared by the tooltip and the dialog
  function compareFacts(r) {
    const facts = [];
    facts.push(['Rank', r.rank + ' of ' + r.n]);
    if (r.kind === 'bank') {
      facts.push(['Share of the listed banks', fmtShare(r.value / r.total)]);
      if (r.home) facts.push(['Assets / ' + r.home.name + ' GDP (' + r.home.year + ')', fmtShare(r.value / r.home.gdpBn)]);
    } else if (r.kind === 'cb') {
      if (r.home) facts.push(['Assets / ' + r.home.name + ' GDP (' + r.home.year + ')', fmtShare(r.value / r.home.gdpBn)]);
    } else if (r.kind === 'gdp') {
      const w = ladderByid['world-gdp'] || resolveMagnitudes().find((m) => m.id === 'world-gdp');
      if (w && w.value) facts.push(['Share of world GDP (' + fmtAsOf(w.asOf) + ')', fmtShare(r.value / w.value)]);
    } else if (r.kind === 'money') {
      if (r.home) facts.push(['Money / GDP, USD levels (GDP ' + r.home.year + ')', fmtShare(r.value / r.home.gdpBn)]);
    } else if (r.kind === 'debt') {
      if (r.ofGdp) facts.push(['Debt / GDP, as published', r.ofGdp]);
    }
    return facts;
  }

  function compareDialog(r) {
    const rows = [['Value', fmtBn(r.value)], ['Value (USD billions)', nf1.format(r.value)], ['As of', fmtAsOf(r.asOf)]];
    if (r.local) rows.push(['Local currency', r.local]);
    compareFacts(r).forEach((f) => rows.push(f));
    const paras = [];
    if (r.kind === 'debt' && r.basis) paras.push('Basis: ' + r.basis);
    if (r.note) paras.push(r.note);
    if (r.kind === 'money') {
      if (r.others && r.others.length) paras.push('Other aggregates for this economy: ' + r.others.map((o) => o.m.label + ' ' + fmtBn(o.v)).join(', ') + '.');
      paras.push('The ratio divides a recent money stock converted at the month-end exchange rate by GDP converted at the exchange rate of the GDP year, so currency moves between the two dates change it, by several points for some economies. A same-period local-currency ratio is the safer comparison.');
    }
    const tags = [r.kind === 'bank' ? 'Bank' : r.kind === 'cb' ? 'Central bank' : r.kind === 'gdp' ? 'GDP' : r.kind === 'money' ? 'Money supply' : 'Government debt'];
    if (r.country) tags.push(r.country);
    return { title: r.name, tags, rows, paras, source: { text: r.source, url: r.url } };
  }

  function renderCompareTabs() {
    const seg = qs('#cmp-seg');
    seg.textContent = '';
    CTABS.forEach((t) => {
      const b = h('button', { type: 'button', 'data-tab': t.id, 'aria-pressed': String(t.id === cmp.tab), text: t.label });
      b.addEventListener('click', () => {
        cmp.tab = t.id;
        seg.querySelectorAll('button').forEach((x) => setPressed(x, x.dataset.tab === cmp.tab));
        renderCompare();
        qs('#cmp-live').textContent = t.label + ' shown, ' + (compareCache ? compareCache.rows.length : 0) + ' rows.';
      });
      seg.appendChild(b);
    });
  }

  let compareCache = null;

  function renderCompare() {
    hideTip();
    const data = compareData(cmp.tab);
    compareCache = data;
    qs('#cmp-title').textContent = 'Compare: ' + data.title;
    qs('#cmp-sub').textContent = data.sub;

    // legend: only the colours in use on this tab
    const legend = qs('#cmp-legend');
    legend.textContent = '';
    const used = {};
    data.rows.forEach((r) => { used[hasOwn(ECON, r.econ) ? r.econ : 'other'] = 1; });
    ECON_ORDER.concat(['other']).forEach((k) => {
      if (!used[k]) return;
      const sw = h('span', { class: 'swatch' });
      sw.style.setProperty('--c', k === 'other' ? OTHER_COLOR : ECON[k].cat);
      legend.appendChild(h('span', { class: 'mf-lg' }, [sw, k === 'other' ? 'Other' : ECON[k].short]));
    });

    const ul = qs('#cmp-bars');
    ul.textContent = '';
    const max = data.rows.length ? Math.max.apply(null, data.rows.map((r) => r.value)) : 0;
    data.rows.forEach((r) => {
      const frac = max > 0 ? r.value / max : 0;
      const fill = h('span', { class: 'mf-bfill' });
      const val = h('span', { class: 'mf-bval num', text: fmtBn(r.value) });
      const track = h('span', { class: 'mf-btrack', 'aria-hidden': 'true' }, [fill, val]);
      track.style.setProperty('--f', String(frac));
      track.style.setProperty('--c', colorOf(r.econ));
      const btn = h('button', { class: 'mf-brow', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': r.name + ', ' + r.sub + ': ' + fmtBn(r.value) }, [
        h('span', { class: 'mf-bname' }, [h('span', { class: 'nm', text: r.name }), h('span', { class: 'sub', text: r.sub })]),
        track,
      ]);
      const facts = compareFacts(r).slice(1).map((f) => f[0] + ': ' + f[1]);
      const tipFor = (x, y, anchor) => {
        setTip(r.name, [fmtBn(r.value) + ', as of ' + fmtAsOf(r.asOf)].concat(facts, ['Press Enter or click for the source and notes.']));
        if (anchor) placeTipAt(anchor, anchor); else placeTip(x, y);
      };
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') tipFor(e.clientX, e.clientY); });
      btn.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch' && !tipEl.hidden) placeTip(e.clientX, e.clientY); });
      btn.addEventListener('pointerleave', () => { if (document.activeElement !== btn) hideTip(); });
      btn.addEventListener('focus', () => tipFor(0, 0, btn));
      btn.addEventListener('blur', hideTip);
      btn.addEventListener('click', () => openDialog(compareDialog(r), btn));
      ul.appendChild(h('li', null, [btn]));
    });
    if (!data.rows.length) ul.appendChild(h('li', { class: 'empty', text: 'No rows have a value.' }));

    buildTable(qs('#cmp-table'), data.caption, data.tableCols, data.tableRows);
    qs('#cmp-table').hidden = !cmp.table;
    ul.hidden = cmp.table;
    legend.hidden = cmp.table;

    // notes, dates and sources
    qs('#cmp-notes').textContent = data.notes.join(' ');
    const dated = data.rows.map((r) => ({ key: asOfEnd(r.asOf), label: String(r.asOf) })).filter((d) => d.key);
    dated.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const lo = dated[0], hi = dated[dated.length - 1];
    const unread = data.rows.length - dated.length;
    qs('#cmp-asof').textContent = !dated.length ? '' : (lo.key === hi.key && !unread
      ? 'All rows are as of ' + fmtAsOf(hi.label) + '.'
      : 'Dates differ by row (earliest ' + fmtAsOf(lo.label) + ', latest ' + fmtAsOf(hi.label) + ', by period end); each row shows its own.');
    const src = qs('#cmp-src');
    src.textContent = '';
    const seen = {};
    const uniq = [];
    data.rows.forEach((r) => {
      const t = shortSource(r.source);
      if (!hasOwn(seen, t)) { seen[t] = 1; uniq.push({ t, url: r.url }); }
    });
    if (uniq.length) {
      src.appendChild(document.createTextNode('Source' + (uniq.length > 1 ? 's' : '') + ': '));
      uniq.slice(0, 6).forEach((u, i) => {
        if (i) src.appendChild(document.createTextNode('; '));
        src.appendChild(link(u.t, u.url));
      });
      if (uniq.length > 6) src.appendChild(document.createTextNode('; and ' + (uniq.length - 6) + ' more (see the table)'));
      src.appendChild(document.createTextNode('. Each row\'s own link is in its detail and in the table.'));
    }
  }

  /* ---------- wiring ---------- */
  function setMode(m) {
    mode = m;
    qs('#mode-textbook').hidden = m !== 'textbook';
    qs('#mode-today').hidden = m !== 'today';
    qs('#mode-seg').querySelectorAll('button').forEach((b) => setPressed(b, b.dataset.mode === m));
    qs('#create-sub').textContent = m === 'textbook'
      ? 'A teaching model: one deposit, a reserve ratio and rounds of lending.'
      : 'Banks lend first and the deposits appear with the loans. Step through who holds what.';
    hideTip();
    if (m === 'textbook') { revealRows = true; renderTextbook(); } else renderEvidence();
  }

  // the label names the next click, so these buttons carry no pressed state
  const tableLabel = (btn, on) => { btn.textContent = on ? 'Show as chart' : 'Show as table'; };

  function wireTables() {
    let ladderTable = false;
    [['#ladder-table-btn', '#ladder', '#ladder-table'], ['#cmp-table-btn', '#cmp-bars', '#cmp-table']].forEach((t) => {
      const btn = qs(t[0]);
      btn.addEventListener('click', () => {
        const on = t[0] === '#cmp-table-btn' ? !cmp.table : !ladderTable;
        tableLabel(btn, on);
        if (t[0] === '#cmp-table-btn') { cmp.table = on; qs('#cmp-legend').hidden = on; } else ladderTable = on;
        qs(t[1]).hidden = on;
        qs(t[2]).hidden = !on;
        hideTip();
      });
    });
    qs('#ev-table-btn').addEventListener('click', () => {
      ev.table = !ev.table;
      tableLabel(qs('#ev-table-btn'), ev.table);
      renderEvidence();
    });
  }

  function init() {
    renderStatus();
    renderPresets();
    const takeRatio = () => { tb.ratio = +ratioEl.value / 100; tb.pressed = -1; tb.info = -1; syncPresets(); renderTextbook(); };
    ratioEl.addEventListener('input', takeRatio);
    // after a preset such as 0.8% the thumb shows 1% and a press or arrow key on it fires no input event, so those count as choosing the shown value
    const syncShown = () => { if (Math.abs(+ratioEl.value / 100 - tb.ratio) > 1e-9) takeRatio(); };
    ratioEl.addEventListener('pointerup', syncShown);
    ratioEl.addEventListener('keyup', (e) => { if (/^(Arrow|Page|Home$|End$)/.test(e.key)) syncShown(); });
    depEl.addEventListener('input', () => { tb.deposit = +depEl.value; renderTextbook(); });
    renderTextbook();

    qs('#mode-seg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); }));
    setMode('textbook');

    renderSteps();
    qs('#step-prev').addEventListener('click', () => goStep(stepIdx - 1));
    qs('#step-next').addEventListener('click', () => goStep(stepIdx + 1));
    qs('#stepper').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goStep(stepIdx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(stepIdx - 1); }
    });

    qs('#ev-scale').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      ev.scale = b.dataset.v;
      qs('#ev-scale').querySelectorAll('button').forEach((x) => setPressed(x, x === b));
      renderEvidence();
    }));
    qs('#ev-range').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      ev.range = b.dataset.v;
      qs('#ev-range').querySelectorAll('button').forEach((x) => setPressed(x, x === b));
      renderEvidence();
    }));
    const stage = qs('#ev-stage');
    const d3Tag = qs('#d3-script');
    if (!d3 && d3Tag) {
      d3Tag.addEventListener('load', () => { d3 = window.d3 || null; d3Failed = !d3; if (mode === 'today') renderEvidence(); });
      d3Tag.addEventListener('error', () => { d3Failed = true; if (mode === 'today') renderEvidence(); });
    } else if (!d3) d3Failed = true;
    if (window.ResizeObserver) {
      let lastW = 0;
      new ResizeObserver(() => {
        const w = stage.clientWidth;
        if (w && w !== lastW && mode === 'today' && !ev.table) { lastW = w; renderEvidence(); }
      }).observe(stage);
    }

    renderLadder();
    renderCompareTabs();
    renderCompare();
    wireTables();

    qs('#btn-reset').addEventListener('click', onReset);
    qs('#btn-export').addEventListener('click', onExport);
    const file = qs('#file-import');
    qs('#btn-import').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const f = file.files && file.files[0]; file.value = ''; onFile(f); });

    // keep the compare card in view beside the long ladder, but only while it fits the window
    const cmpCard = qs('#card-compare');
    const syncSticky = () => {
      const wide = window.matchMedia && window.matchMedia('(min-width: 1100px)').matches;
      cmpCard.classList.toggle('mf-sticky', !!wide && cmpCard.offsetHeight + 72 <= window.innerHeight);
    };
    syncSticky();
    window.addEventListener('resize', syncSticky);
    if (window.ResizeObserver) new ResizeObserver(syncSticky).observe(cmpCard);

    // the in-page skip link moves focus without touching the address
    const skip = qs('#skip-ladder');
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      const t = qs('#cmp-title');
      t.setAttribute('tabindex', '-1');
      t.focus();
      t.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
    window.addEventListener('scroll', onScrollTip, { passive: true });
    window.addEventListener('resize', hideTip);
  }

  try {
    init();
  } catch (err) {
    Shell.fatal('Something went wrong while building the page', String(err && err.message ? err.message : err));
    if (window.console) console.error(err);
  }
})();
