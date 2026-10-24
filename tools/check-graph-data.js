#!/usr/bin/env node
/* Lint for the two graph data files (data/world-powers.js and data/power-structure.js), using assets/graph-model.js.
   Run it before every data edit is accepted:   node tools/check-graph-data.js [file ...] [--lenient]
   With no file it checks both shipped files. Exit code 0 means no errors; warnings never fail the run.
   --lenient turns the shipped-data rules (grades, sources, dates on every tie, no unused entries) into warnings,
   which suits a work-in-progress file. The structural rules of the data contract always apply. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Model = require('../assets/graph-model.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const lenient = args.indexOf('--lenient') >= 0;
let files = args.filter((a) => a.indexOf('--') !== 0);
if (!files.length) files = [path.join(ROOT, 'data', 'world-powers.js'), path.join(ROOT, 'data', 'power-structure.js')];

const SHIPPED_GRADES = ['documented', 'reported'];
const EM_DASH = String.fromCharCode(0x2014);
let failed = 0;

function load(file) {
  const text = fs.readFileSync(file, 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(text, ctx, { filename: file, timeout: 5000 });
  const keys = Object.keys(ctx.window);
  if (keys.length !== 1) throw new Error('the file must set exactly one window.* global, but it sets ' + keys.length);
  return { text, name: keys[0], data: ctx.window[keys[0]] };
}

function lint(file) {
  const errors = [], warnings = [];
  const strict = (msg) => (lenient ? warnings : errors).push(msg);
  let loaded;
  try { loaded = load(file); } catch (e) { return { errors: ['Could not load: ' + e.message], warnings } };
  const raw = loaded.data;
  if (!raw || typeof raw !== 'object') return { errors: ['The global is not an object'], warnings };

  if (loaded.text.indexOf(EM_DASH) >= 0) {
    const line = loaded.text.slice(0, loaded.text.indexOf(EM_DASH)).split('\n').length;
    strict('the file contains an em dash character (first on line ' + line + '); use a comma, parentheses or two sentences');
  }

  const res = Model.validate(raw, { vocab: raw.vocab, schema: raw.schema, mode: 'builtin' });
  res.errors.forEach((e) => errors.push(e));
  if (res.errors.length) return { errors, warnings, summary: null };
  res.warnings.forEach((w) => (/no links|are not used/.test(w) ? strict(w) : warnings.push(w)));
  const data = res.data;
  const idx = Model.index(data);
  const kind = String(raw.schema || '').split('/')[0];
  const dated = (id) => !!data.sources[id] && !!data.sources[id].date;

  // shipped rules for every tie
  data.edges.forEach((e) => {
    const where = 'edge ' + e.id;
    if (SHIPPED_GRADES.indexOf(e.grade) < 0) strict(where + ' is graded ' + (e.grade || 'unrated') + '; shipped ties are documented or reported');
    if (!e.refs || !e.refs.length) strict(where + ' has no source');
    else if (!e.refs.some((r) => dated(r.id))) strict(where + ' has no source with a date');
    if (e.reviewBy && e.asOf && Model.dateKey(e.reviewBy, true) < Model.dateKey(e.asOf, false)) warnings.push(where + ' has a review date before its as-of date');
    const a = idx.nodeById.get(e.source), b = idx.nodeById.get(e.target);
    [a, b].forEach((n) => {
      if (!e.approx && !n.approx && e.from && n.from && Model.dateKey(e.from, false) < Model.dateKey(n.from, false)) warnings.push(where + ' starts (' + e.from + ') before ' + n.id + ' starts (' + n.from + ')');
      if (!e.approx && !n.approx && e.to && n.to && Model.dateKey(e.to, true) > Model.dateKey(n.to, true)) warnings.push(where + ' ends (' + e.to + ') after ' + n.id + ' ends (' + n.to + ')');
    });
    if (kind === 'world-powers') {
      ['kind', 'state', 'asOf', 'reviewBy'].forEach((f) => { if (!e[f]) strict(where + ' needs ' + f + ' (every Nations tie carries a kind, a state, an as-of date and a review date)'); });
    } else if (!e.from && !e.to && !e.asOf) strict(where + ' has no dates (from, to or asOf)');
    // the Method panel leaves out ties that rest on overlap of people alone
    if (kind === 'power-structure' && /\b(overlap of people|shared personnel|overlapping membership)\b/i.test(e.desc || '')) warnings.push(where + ' describes an overlap of people rather than a documented act; the Method panel leaves such ties out');
  });
  data.nodes.forEach((n) => {
    if (n.grade && SHIPPED_GRADES.indexOf(n.grade) < 0) strict('node ' + n.id + ' is graded ' + n.grade + '; shipped entries are documented or reported');
    if (kind === 'world-powers' && raw.vocab.measure && !n.measure) warnings.push('node ' + n.id + ' has no measure, so it is drawn at the smallest size');
    if (n.measure && !(n.refs || []).length) warnings.push('node ' + n.id + ' has a measure but no source for it');
  });
  // a relation that marks its kinds should mark every kind in use; a group's total cannot be smaller than the members drawn
  data.edges.forEach((e) => {
    const r = raw.vocab.relations[e.type];
    if (r.kindMarks && e.kind && !Object.prototype.hasOwnProperty.call(r.kindMarks, e.kind)) warnings.push('edge ' + e.id + ' has the kind "' + e.kind + '", which vocab.relations.' + e.type + '.kindMarks does not list');
  });
  Object.keys(raw.vocab.memberships || {}).forEach((k) => {
    const total = raw.vocab.memberships[k].total;
    const n = data.nodes.filter((x) => (x.memberships || []).indexOf(k) >= 0).length;
    if (total !== undefined && n > total) errors.push('vocab.memberships.' + k + '.total is ' + total + ' but ' + n + ' entities carry it');
  });
  Object.keys(data.sources).forEach((k) => {
    const s = data.sources[k];
    if (s.kind !== 'claim' && !s.url) warnings.push('source ' + k + ' has no web address');
    if (!s.date) warnings.push('source ' + k + ' has no date');
  });

  // page level content
  if (!raw.claim) strict('the file has no claim line');
  if (kind === 'power-structure') {
    const panels = raw.panels || [];
    const method = panels.find((p) => p.id === 'method'), claims = panels.find((p) => p.id === 'claims');
    if (!method) strict('the file has no "method" panel');
    if (!claims) strict('the file has no "claims" panel');
    else {
      const n = (claims.items || []).length;
      if (n < 6 || n > 10) strict('the claims panel lists ' + n + ' claims; it should list 6 to 10');
      (claims.items || []).forEach((it, i) => { if (!it.refs || !it.refs.length) strict('claims item ' + (i + 1) + ' ("' + it.head.slice(0, 40) + '") has no source'); });
    }
    Object.keys(raw.vocab.relations).forEach((k) => {
      const label = raw.vocab.relations[k].label;
      if (/^(control|arm|policy|heir|interlock|affiliation|affiliated)$/.test(k) || /^(control|executive arm|policy influence|heir|interlocking directorate|interlock|affiliated or cooperating body|affiliated)$/i.test(label)) warnings.push('vocab.relations.' + k + ' ("' + label + '") looks like a generic type the taxonomy no longer uses');
    });
  }
  if (kind === 'world-powers' && !raw.vocab.memberships) warnings.push('vocab.memberships is missing, so the page has no membership chips');

  const grades = Model.gradeCounts(data.edges);
  return { errors, warnings, summary: data.nodes.length + ' entities, ' + data.edges.length + ' ties, ' + Object.keys(data.sources).length + ' sources; edges documented ' + grades.documented + ', reported ' + grades.reported + ', other ' + (grades.alleged + grades.unrated) };
}

files.forEach((file) => {
  const label = path.relative(ROOT, path.resolve(file)) || file;
  if (!fs.existsSync(file)) { console.log('FAIL ' + label + ': file not found'); failed++; return; }
  const r = lint(file);
  console.log((r.errors.length ? 'FAIL ' : 'ok   ') + label + (r.summary ? ' (' + r.summary + ')' : ''));
  const show = (list, tag) => {
    list.slice(0, 40).forEach((m) => console.log('  ' + tag + ' ' + m));
    if (list.length > 40) console.log('  ' + tag + ' and ' + (list.length - 40) + ' more');
  };
  show(r.errors, 'error');
  show(r.warnings, 'warn ');
  if (r.errors.length) failed++;
});
console.log(failed ? '\n' + failed + ' file(s) failed.' : '\nAll files passed.');
process.exit(failed ? 1 : 0);
