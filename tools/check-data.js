#!/usr/bin/env node
/* Lint for the new data files: data/debt.js, data/prices.js, data/prices-curated.js, data/principles.js and, when it
   exists, data/world-money.js. Modelled on tools/check-graph-data.js.
     node tools/check-data.js [file ...] [--root DIR] [--allow-missing] [--no-resolve] [--quiet]
   With no file it checks the shipped set. A missing shipped file is an error unless --allow-missing is given.
   Exit code 0 means no errors; warnings never fail the run.

   Every file: loads in a vm and sets exactly one window.* global; ASCII only; no em dash; no NaN, Infinity,
   undefined or function anywhere in the data; inside its size budget.
   MACRO_DEBT: countries, indicators (label, unit, source, url, retrieved, as-of or vintage), series[indicator][iso2] as
     [year, value] rows with years strictly increasing, no year after the file's generated year or the indicator's lastActual.
   MACRO_PRICES: series[id] with label, unit, freq (M, Q or A), source, url, retrieved, asOf and data rows
     [period, value]; periods match the frequency and increase; a null value is a gap row (it may share the period of the
     observation that follows it); nothing later than the generated date.
   MACRO_PRICES_CURATED: every point (an object with a numeric v or value) names its source.
   PRINCIPLES: claims carry a verdict from the fixed set, every ref resolves in the sources registry, and every
     {{placeholder}} names a known derive rule with the right number of arguments and, when the data files are present,
     resolves against them (see assets/derive.js). Aliases for placeholder series may be given as PRINCIPLES.aliases. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Derive = require('../assets/derive.js');

const PROJECT = path.join(__dirname, '..');
const EM_DASH = String.fromCharCode(0x2014);
const VERDICTS = ['Supported', 'Partly supported', 'True in some windows', 'Not supported', 'Depends on definition'];
// An accounting fact is true by how balance sheets and definitions work. A sentence that carries a judgment, a premise or
// a prescription belongs under "interpretation" with the opposing view named, so these words are not allowed in a fact.
const FACT_BANNED = /\b(not a defect|has to|have to|had to|must|should|theft|stealing|fails?|failed|proved|flaw|silly)\b/i;
const SOURCE_KINDS = ['primary', 'secondary', 'claim', 'dataset'];
const SHIPPED = [
  { rel: 'data/debt.js', global: 'MACRO_DEBT', budget: 400000 },
  { rel: 'data/prices.js', global: 'MACRO_PRICES', budget: 400000 },
  { rel: 'data/prices-curated.js', global: 'MACRO_PRICES_CURATED', budget: 120000 },
  { rel: 'data/principles.js', global: 'PRINCIPLES', budget: 380000 },
  { rel: 'data/world-money.js', global: 'MACRO_WORLD', budget: 100000, optional: true },
];
const DEFAULT_BUDGET = 400000, TOTAL_BUDGET = 1000000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
  const o = { files: [], allowMissing: false, resolve: true, quiet: false, root: PROJECT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.root = path.resolve(argv[++i] || '.');
    else if (a === '--allow-missing') o.allowMissing = true;
    else if (a === '--no-resolve') o.resolve = false;
    else if (a === '--quiet') o.quiet = true;
    else if (a.slice(0, 2) === '--') { console.error('unknown option ' + a); process.exit(2); }
    else o.files.push(a);
  }
  return o;
}

function isDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
const isUrl = (s) => typeof s === 'string' && /^https?:\/\/[^\s]+$/i.test(s);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

function load(file) {
  const text = fs.readFileSync(file, 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(text, ctx, { filename: file, timeout: 10000 });
  const keys = Object.keys(ctx.window);
  if (keys.length !== 1) throw new Error('the file must set exactly one window.* global, but it sets ' + keys.length + (keys.length ? ' (' + keys.join(', ') + ')' : ''));
  return { text, name: keys[0], data: ctx.window[keys[0]], bytes: Buffer.byteLength(text, 'utf8') };
}

// quiet load of a helper file used only to resolve placeholders
function tryLoad(root, rel) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) return null;
  try { return load(f); } catch (e) { return null; }
}

/* ---------- generic checks ---------- */
function checkText(text, err) {
  const em = text.indexOf(EM_DASH);
  if (em >= 0) err('contains an em dash character (line ' + (text.slice(0, em).split('\n').length) + '); use a comma, parentheses or two sentences');
  const m = /[^\x09\x0a\x0d\x20-\x7e]/.exec(text);
  if (m && m.index !== em) {
    const upto = text.slice(0, m.index), line = upto.split('\n').length, col = m.index - upto.lastIndexOf('\n');
    err('is not ASCII only: character code ' + text.charCodeAt(m.index) + ' on line ' + line + ' column ' + col + '; write it as a \\u escape');
  }
}

function walk(value, visit, pathStr, depth, seen) {
  if (depth > 40) return;
  visit(value, pathStr);
  if (value && typeof value === 'object') {
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, pathStr + '[' + i + ']', depth + 1, seen));
    else Object.keys(value).forEach((k) => walk(value[k], visit, pathStr ? pathStr + '.' + k : k, depth + 1, seen));
  }
}

function checkValues(data, err) {
  let bad = 0;
  walk(data, (v, p) => {
    if (bad >= 8) return;
    const t = typeof v;
    if (t === 'number' && !isFinite(v)) { bad++; err('has a non-finite number at ' + p); }
    else if (t === 'undefined') { bad++; err('has an undefined value at ' + p); }
    else if (t === 'function' || t === 'symbol' || t === 'bigint') { bad++; err('has a ' + t + ' at ' + p); }
  }, '', 0, new Set());
  if (bad >= 8) err('(more value problems not listed)');
}

function checkMeta(m, where, err, warn, opts) {
  if (!isObj(m)) { err(where + ' is not an object'); return; }
  ['label', 'unit', 'source'].forEach((k) => { if (!nonEmpty(m[k])) err(where + ' needs ' + k); });
  if (!isUrl(m.url)) err(where + ' needs url (an http or https address)');
  if (!isDate(m.retrieved)) err(where + ' needs retrieved as YYYY-MM-DD');
  const asOf = m.asOf != null ? m.asOf : m.vintage;
  if (!nonEmpty(asOf == null ? '' : String(asOf))) err(where + ' needs asOf' + (opts && opts.vintageOk ? ' (or vintage)' : ''));
  else if (m.asOf != null && !Derive.parsePeriod(String(m.asOf)) && !isDate(String(m.asOf))) warn(where + ' asOf "' + m.asOf + '" is not YYYY, YYYY-MM, YYYY-Qn or YYYY-MM-DD');
  if (m.breaks != null && !Array.isArray(m.breaks)) err(where + ' breaks must be an array');
}

/* ---------- MACRO_DEBT ---------- */
function checkDebt(d, err, warn, info) {
  if (!isObj(d)) return err('the global is not an object');
  if (!isDate(d.generated)) err('needs generated as YYYY-MM-DD');
  if (!Array.isArray(d.notes)) warn('has no notes array');
  if (!isObj(d.countries)) return err('needs countries');
  if (!isObj(d.indicators)) return err('needs indicators');
  if (!isObj(d.series)) return err('needs series');
  Object.keys(d.countries).forEach((iso) => {
    const c = d.countries[iso];
    if (!/^[A-Za-z]{2}$/.test(iso)) err('country key "' + iso + '" is not a two-letter code');
    if (!isObj(c) || !nonEmpty(c.name)) err('country ' + iso + ' needs a name');
    else if (c.iso3 != null && !/^[A-Z]{3}$/.test(c.iso3)) err('country ' + iso + ' iso3 "' + c.iso3 + '" is not three capital letters');
  });
  Object.keys(d.indicators).forEach((id) => checkMeta(d.indicators[id], 'indicator ' + id, err, warn, { vintageOk: true }));
  const genYear = isDate(d.generated) ? +d.generated.slice(0, 4) : Infinity;
  let rows = 0;
  Object.keys(d.series).forEach((id) => {
    if (!own(d.indicators, id)) err('series ' + id + ' has no entry in indicators');
    const byCountry = d.series[id];
    if (!isObj(byCountry)) return err('series ' + id + ' is not an object of countries');
    const lastActual = own(d.indicators, id) && d.indicators[id] ? d.indicators[id].lastActual : null;
    Object.keys(byCountry).forEach((iso) => {
      const where = 'series ' + id + '.' + iso;
      if (!own(d.countries, iso)) err(where + ' names a country that is not in countries');
      const r = byCountry[iso];
      if (!Array.isArray(r) || !r.length) return err(where + ' has no rows');
      const pctUnit = own(d.indicators, id) && d.indicators[id] && /%/.test(String(d.indicators[id].unit || ''));
      let prev = -Infinity, bad = 0, wild = 0;
      r.forEach((row, i) => {
        if (bad >= 3) return;
        if (!Array.isArray(row) || row.length < 2) { bad++; return err(where + ' row ' + i + ' is not [year, value]'); }
        const y = row[0], v = row[1];
        if (!Number.isInteger(y) || y < 1000 || y > 2200) { bad++; return err(where + ' row ' + i + ' year ' + y + ' is not a four-digit integer'); }
        if (y <= prev) { bad++; err(where + ' year ' + y + ' is not after ' + prev + ' (row ' + i + ')'); }
        prev = y;
        if (v !== null && typeof v !== 'number') { bad++; err(where + ' row ' + i + ' value is not a number or null'); }
        if (pctUnit && typeof v === 'number' && Math.abs(v) > 5000 && !wild++) warn(where + ' row ' + i + ' value ' + v + ' is above 5000 for a percent series');
      });
      rows += r.length;
      const lastYear = r[r.length - 1][0];
      if (lastYear > genYear) err(where + ' runs to ' + lastYear + ', after the file was generated (' + genYear + '): forecast years must be cut at the last actual year');
      if (lastActual != null && lastYear > lastActual) err(where + ' runs to ' + lastYear + ', after the indicator\'s lastActual ' + lastActual);
    });
  });
  info('debt: ' + Object.keys(d.countries).length + ' countries, ' + Object.keys(d.indicators).length + ' indicators, ' + rows + ' rows');
}

/* ---------- MACRO_PRICES ---------- */
function checkPrices(d, err, warn, info) {
  if (!isObj(d)) return err('the global is not an object');
  if (!isDate(d.generated)) err('needs generated as YYYY-MM-DD');
  if (!Array.isArray(d.notes)) warn('has no notes array');
  if (!isObj(d.series)) return err('needs series');
  const gen = isDate(d.generated) ? Derive.parsePeriod(d.generated.slice(0, 7)) : null;
  let rows = 0, nulls = 0;
  Object.keys(d.series).forEach((id) => {
    const s = d.series[id], where = 'series ' + id;
    checkMeta(s, where, err, warn, null);
    if (!isObj(s)) return;
    if (['M', 'Q', 'A'].indexOf(s.freq) < 0) err(where + ' freq must be M, Q or A');
    if (!Array.isArray(s.data) || s.data.length < 2) return err(where + ' needs a data array of at least two rows');
    let lastObs = -Infinity, prevT = -Infinity, obs = 0, bad = 0, lastKey = null;
    s.data.forEach((row, i) => {
      if (bad >= 3) return;
      if (!Array.isArray(row) || row.length < 2) { bad++; return err(where + ' row ' + i + ' is not [period, value]'); }
      const per = Derive.parsePeriod(row[0]);
      if (!per || (typeof row[0] !== 'string')) { bad++; return err(where + ' row ' + i + ' period "' + row[0] + '" is not a YYYY, YYYY-MM or YYYY-Qn string'); }
      if (s.freq && per.freq !== s.freq) { bad++; return err(where + ' row ' + i + ' period "' + row[0] + '" does not match freq ' + s.freq); }
      const v = row[1];
      if (v !== null && (typeof v !== 'number' || !isFinite(v))) { bad++; return err(where + ' row ' + i + ' value is not a finite number or null'); }
      if (per.t < prevT - 1e-9) { bad++; return err(where + ' row ' + i + ' period ' + row[0] + ' is out of order'); }
      if (v === null) nulls++;
      else {
        if (per.t <= lastObs + 1e-9) { bad++; return err(where + ' row ' + i + ' period ' + row[0] + ' repeats or goes back (a gap row is [period, null])'); }
        lastObs = per.t; obs++; lastKey = per.key;
        if (gen && per.t > gen.t + gen.step - 1e-9) { bad++; err(where + ' row ' + i + ' period ' + row[0] + ' is after the generated date ' + d.generated); }
      }
      prevT = Math.max(prevT, per.t);
    });
    rows += s.data.length;
    if (obs < 2) err(where + ' has fewer than two observations');
    if (!nonEmpty(s.notes)) warn(where + ' has no notes');
    if (s.asOf != null && lastKey && /^\d{4}(-\d{2}|-Q\d)?$/.test(String(s.asOf))) {
      const a = Derive.parsePeriod(String(s.asOf)), l = Derive.parsePeriod(lastKey);
      if (a && l && l.t > a.t + a.step - 1e-9) warn(where + ' has an observation (' + lastKey + ') newer than its asOf (' + s.asOf + ')');
    }
  });
  info('prices: ' + Object.keys(d.series).length + ' series, ' + rows + ' rows (' + nulls + ' gap rows)');
}

/* ---------- MACRO_PRICES_CURATED ---------- */
function checkCurated(d, err, warn, info, ctx) {
  if (!isObj(d)) return err('the global is not an object');
  const registry = ctx.sourceIds, hasRegistry = registry.size > 0;
  let points = 0, noNote = 0;
  walk(d, (v, p) => {
    if (!isObj(v)) return;
    const val = own(v, 'v') ? v.v : own(v, 'value') ? v.value : undefined;
    if (typeof val !== 'number') return;
    points++;
    const src = v.src != null ? v.src : v.source != null ? v.source : v.sourceId;
    if (!nonEmpty(src == null ? '' : String(src))) err('point at ' + p + ' names no source (src or source)');
    else if (hasRegistry && /^[a-z0-9][a-z0-9_-]*$/i.test(src) && !registry.has(src)) warn('point at ' + p + ' cites source "' + src + '", which is not in the sources registry');
    if (!nonEmpty(v.note == null ? '' : String(v.note))) noNote++;
    const per = v.p != null ? v.p : v.period != null ? v.period : v.y != null ? v.y : v.year;
    if (per != null && !Derive.parsePeriod(typeof per === 'number' ? per : String(per)) && !isDate(String(per))) err('point at ' + p + ' has a period "' + per + '" that is not YYYY, YYYY-MM, YYYY-Qn or YYYY-MM-DD');
  }, '', 0, new Set());
  if (!points) warn('no points found (an object with a numeric v or value)');
  if (noNote) warn(noNote + ' of ' + points + ' points have no note');
  info('curated: ' + points + ' points');
}

/* ---------- PRINCIPLES ---------- */
function collectStrings(data) {
  const out = [];
  walk(data, (v, p) => { if (typeof v === 'string') out.push({ s: v, p }); }, '', 0, new Set());
  return out;
}

function checkPrinciples(d, err, warn, info, ctx, opts) {
  if (!isObj(d)) return err('the global is not an object');
  const registry = isObj(d.sources) ? d.sources : null;
  if (!registry) err('needs a sources registry (id -> title, url, kind, retrieved)');
  else {
    Object.keys(registry).forEach((id) => {
      const s = registry[id], where = 'source ' + id;
      if (!isObj(s)) return err(where + ' is not an object');
      if (!nonEmpty(s.title)) err(where + ' needs a title');
      if (s.url != null && !isUrl(s.url)) err(where + ' url must be an http or https address');
      if (s.kind != null && SOURCE_KINDS.indexOf(s.kind) < 0) warn(where + ' kind "' + s.kind + '" is not one of ' + SOURCE_KINDS.join(', '));
      if (s.retrieved != null && !isDate(s.retrieved)) err(where + ' retrieved must be YYYY-MM-DD');
      // a source marked checked: "cited" was named in the research but not opened, so it has no retrieval date to give
      if (s.url && s.retrieved == null && s.checked !== 'cited') warn(where + ' has a url but no retrieved date');
    });
  }
  const ids = registry ? new Set(Object.keys(registry)) : new Set();
  const used = new Set();

  // refs anywhere in the tree (not the registry itself)
  const refOk = (r, where) => {
    const id = typeof r === 'string' ? r : isObj(r) ? r.id : null;
    if (!nonEmpty(id == null ? '' : id)) return err(where + ' has a ref with no id');
    used.add(id);
    if (!ids.has(id)) err(where + ' cites source "' + id + '", which is not in the sources registry');
  };
  walk(d, (v, p) => {
    if (!isObj(v) || v === d.sources) return;
    ['refs', 'ref', 'sources'].forEach((k) => {
      if (!own(v, k) || p === '' && k === 'sources') return;
      const val = v[k];
      if (Array.isArray(val)) val.forEach((r, i) => refOk(r, (p ? p + '.' : '') + k + '[' + i + ']'));
      else if (typeof val === 'string' || isObj(val)) refOk(val, (p ? p + '.' : '') + k);
    });
  }, '', 0, new Set());

  // claims
  const claims = Array.isArray(d.claims) ? d.claims : null;
  if (!claims || !claims.length) err('needs a claims array');
  else {
    const seen = new Set();
    claims.forEach((c, i) => {
      const where = 'claim ' + (c && c.id != null ? c.id : i + 1);
      if (!isObj(c)) return err(where + ' is not an object');
      if (c.id != null) { if (seen.has(c.id)) err(where + ' repeats an id'); seen.add(c.id); }
      if (!nonEmpty(c.claim)) err(where + ' needs the claim text (claim)');
      const verdict = isObj(c.verdict) ? c.verdict.label || c.verdict.word : c.verdict;
      if (VERDICTS.indexOf(verdict) < 0) err(where + ' verdict "' + verdict + '" is not one of: ' + VERDICTS.join(', '));
      if (!nonEmpty(c.text) && !Array.isArray(c.text) && !isObj(c.text)) err(where + ' needs text');
      if (!Array.isArray(c.refs) || !c.refs.length) warn(where + ' has no refs');
      if (!nonEmpty(c.objection == null ? '' : String(c.objection)) && !isObj(c.objection) && !Array.isArray(c.objection)) warn(where + ' has no objection (the strongest counterargument)');
      if (!Object.keys(c).some((k) => /change|would|limits/i.test(k))) warn(where + ' has no limits or "what would change this verdict" field');
    });
  }
  ['fragilities'].forEach((k) => { if (d[k] != null && !Array.isArray(d[k]) && !isObj(d[k])) err(k + ' must be an array or an object'); });
  if (d.aliases != null) {
    if (!isObj(d.aliases)) err('aliases must be an object of short name -> series id');
    else Object.keys(d.aliases).forEach((k) => { if (!nonEmpty(d.aliases[k]) || /[.\s|{}]/.test(k)) err('alias "' + k + '" is not valid (names have no dot, space or brace; values are series ids)'); });
  }

  // placeholders
  const strings = collectStrings(d);
  let count = 0, resolved = 0, unresolved = 0;
  const dctx = ctx.derive;
  strings.forEach((st) => {
    if (st.s.indexOf('{{') < 0 && st.s.indexOf('}}') < 0) return;
    const stripped = st.s.replace(/\{\{[^{}]*\}\}/g, '');
    if (stripped.indexOf('{{') >= 0 || stripped.indexOf('}}') >= 0) err('unbalanced {{ }} at ' + st.p);
    Derive.placeholders(st.s).forEach((body) => {
      count++;
      const p = Derive.parsePlaceholder(body);
      if (!p) return err('bad placeholder {{' + body + '}} at ' + st.p + ': expected series.rule[.arg...][|fmt]');
      const info0 = Derive.ruleInfo(p.rule);
      if (!info0) return err('unknown derive rule "' + p.rule + '" in {{' + body + '}} at ' + st.p + ' (known: ' + Derive.knownRules().join(', ') + ')');
      if (!opts.resolve) return;
      const r = Derive.resolve(body, dctx);
      if (r.ok) { resolved++; return; }
      unresolved++;
      const structural = ['unknown-rule', 'bad-args', 'bad-format', 'bad-placeholder', 'mixed-basis', 'undefined'].indexOf(r.error) >= 0;
      const msg = '{{' + body + '}} at ' + st.p + ' does not resolve: ' + r.message + ' [' + r.error + ']';
      // a series from a data file that is not present cannot be judged yet
      let missingFile = !ctx.dataComplete;
      const q = /no data for "([^"]+)"/.exec(r.message || '');
      if (r.error === 'no-series' && q) {
        const id = q[1], real = own(dctx.alias || {}, id) ? dctx.alias[id] : own(Derive.DEFAULT_ALIASES, id) ? Derive.DEFAULT_ALIASES[id] : id;
        const set = real.indexOf('debt:') === 0 ? 'debt' : real.indexOf('hist:') === 0 ? 'history' : 'prices';
        missingFile = !ctx.helper[set];
      }
      if (structural || !missingFile) err(msg); else warn(msg + ' (the data file it needs was not loaded)');
    });
  });
  if (claims && registry) {
    Object.keys(registry).forEach((id) => { if (!used.has(id)) warn('source ' + id + ' is not cited anywhere'); });
  }
  // statements labelled "fact" may not carry a judgment or a prescription
  walk(d, (v, p) => {
    if (!isObj(v) || v.kind !== 'fact' || typeof v.text !== 'string') return;
    const m = FACT_BANNED.exec(v.text);
    if (m) err('a statement labelled fact at ' + p + ' contains "' + m[0] + '", a judgment or a premise; relabel it as an interpretation or split the accounting from the judgment');
  }, '', 0, new Set());
  info('principles: ' + (claims ? claims.length : 0) + ' claims, ' + ids.size + ' sources, ' + count + ' placeholders (' + resolved + ' resolve, ' + unresolved + ' not)');
}

/* ---------- fact notes written in script files ---------- */
// note('fact', '...') in assets/debt.js and the Fact badge in other scripts: the same words are not allowed
function checkScriptFacts(root, errs) {
  ['assets/debt.js'].forEach((rel) => {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8'), re = /note\('fact',\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(text))) {
      const bad = FACT_BANNED.exec(m[1]);
      if (bad) errs.push(rel + ' has an accounting-fact note on line ' + text.slice(0, m.index).split('\n').length + ' that contains "' + bad[0] + '"; relabel it as an interpretation or split it');
    }
  });
}

/* ---------- MACRO_WORLD ---------- */
function checkWorld(d, err, warn, info) {
  if (!isObj(d)) return err('the global is not an object');
  if (!isDate(d.generated)) err('needs generated as YYYY-MM-DD');
  if (!Array.isArray(d.rows) || !d.rows.length) return err('needs a rows array');
  const iso = new Set();
  d.rows.forEach((r, i) => {
    if (!Array.isArray(r) || r.length < 7) return err('row ' + i + ' is not [iso3, name, firstYear, lastYear, moneyGrowthPct, realGrowthPct, inflationPct]');
    if (!/^[A-Z]{3}$/.test(r[0])) err('row ' + i + ' code "' + r[0] + '" is not three capital letters');
    if (iso.has(r[0])) err('row ' + i + ' repeats ' + r[0]);
    iso.add(r[0]);
    if (!nonEmpty(r[1])) err('row ' + i + ' needs a name');
    if (!Number.isInteger(r[2]) || !Number.isInteger(r[3]) || r[3] < r[2]) err('row ' + i + ' years ' + r[2] + ' to ' + r[3] + ' are not an increasing pair of integers');
    for (let k = 4; k < 7; k++) if (typeof r[k] !== 'number' || !isFinite(r[k])) err('row ' + i + ' column ' + k + ' is not a finite number');
  });
  if (d.window == null) warn('has no window (the years the averages cover)');
  info('world: ' + d.rows.length + ' countries');
}

const CHECKERS = { MACRO_DEBT: checkDebt, MACRO_PRICES: checkPrices, MACRO_PRICES_CURATED: checkCurated, PRINCIPLES: checkPrinciples, MACRO_WORLD: checkWorld };

/* ---------- driver ---------- */
function main(argv) {
  const opts = parseArgs(argv);
  const targets = [];
  if (opts.files.length) {
    opts.files.forEach((f) => {
      const abs = path.resolve(f), rel = path.relative(opts.root, abs).replace(/\\/g, '/');
      const shipped = SHIPPED.find((s) => s.rel === rel);
      targets.push({ abs, rel: shipped ? rel : f, budget: shipped ? shipped.budget : DEFAULT_BUDGET, required: true });
    });
  } else {
    SHIPPED.forEach((s) => targets.push({ abs: path.join(opts.root, s.rel), rel: s.rel, budget: s.budget, required: !s.optional && !opts.allowMissing, optional: s.optional }));
  }

  // helper data for placeholder resolution
  const helper = {};
  ['debt', 'prices'].forEach((k) => { const l = tryLoad(opts.root, 'data/' + k + '.js'); if (l) helper[k] = l.data; });
  const hist = tryLoad(opts.root, 'data/history.js'); if (hist) helper.history = hist.data;

  let errors = 0, warnings = 0, total = 0;
  const loaded = [];
  targets.forEach((t) => {
    const errs = [], warns = [], infos = [];
    const err = (m) => errs.push(m), warn = (m) => warns.push(m), info = (m) => infos.push(m);
    if (!fs.existsSync(t.abs)) {
      if (t.required) err('file does not exist');
      else infos.push('not present (skipped)');
    } else {
      let l;
      try { l = load(t.abs); } catch (e) { err('could not load: ' + e.message); }
      if (l) {
        loaded.push({ t, l });
        total += l.bytes;
        checkText(l.text, err);
        if (l.bytes > t.budget) err('is ' + l.bytes + ' bytes, over its budget of ' + t.budget);
        else if (l.bytes > t.budget * 0.8) warn('is ' + l.bytes + ' bytes, above 80% of its budget of ' + t.budget);
        checkValues(l.data, err);
      }
    }
    t.out = { errs, warns, infos };
  });

  // a second pass for checks that read other files
  const sourceIds = new Set();
  loaded.forEach(({ l }) => { if (l.name === 'PRINCIPLES' && isObj(l.data) && isObj(l.data.sources)) Object.keys(l.data.sources).forEach((k) => sourceIds.add(k)); });
  loaded.forEach(({ l }) => { if (isObj(l.data) && isObj(l.data.sources) && l.name !== 'PRINCIPLES') Object.keys(l.data.sources).forEach((k) => sourceIds.add(k)); });
  const principles = loaded.find((x) => x.l.name === 'PRINCIPLES');
  const alias = principles && isObj(principles.l.data) && isObj(principles.l.data.aliases) ? principles.l.data.aliases : {};
  const dctx = Derive.makeContext({ prices: helper.prices, debt: helper.debt, history: helper.history, alias });
  const ctx = { sourceIds, derive: dctx, helper, dataComplete: !!(helper.prices && helper.debt && helper.history) };

  loaded.forEach(({ t, l }) => {
    const { errs, warns, infos } = t.out;
    if (l.name === 'MACRO_DEBT') checkScriptFacts(opts.root, errs);
    const chk = CHECKERS[l.name];
    if (!chk) warns.push('global ' + l.name + ' has no specific rules; only the generic checks ran');
    else {
      try { chk(l.data, (m) => errs.push(m), (m) => warns.push(m), (m) => infos.push(m), ctx, opts); }
      catch (e) { errs.push('the checker failed: ' + (e && e.stack || e)); }
    }
  });

  targets.forEach((t) => {
    const { errs, warns, infos } = t.out;
    errors += errs.length; warnings += warns.length;
    if (opts.quiet && !errs.length) return;
    console.log(t.rel + ': ' + errs.length + ' error(s), ' + warns.length + ' warning(s)' + (infos.length ? ' | ' + infos.join('; ') : ''));
    errs.forEach((m) => console.log('  ERROR ' + m));
    warns.forEach((m) => console.log('  warn  ' + m));
  });
  if (!opts.files.length && total > TOTAL_BUDGET) { errors++; console.log('ERROR the files total ' + total + ' bytes, over the combined budget of ' + TOTAL_BUDGET); }
  console.log(errors ? errors + ' error(s), ' + warnings + ' warning(s)' : 'ok (' + warnings + ' warning(s))');
  return errors ? 1 : 0;
}

module.exports = { VERDICTS, checkDebt, checkPrices, checkPrinciples, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
