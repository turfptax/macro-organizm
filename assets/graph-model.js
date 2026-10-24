/* Macro Organizm graph model: the pure data layer shared by Nations and Power Structure.
   No DOM, no d3. Runs in a browser (window.MacroGraphModel) and in node (require).
   It never throws on bad input: validate() returns every problem it finds, and an import is all or nothing.

   DATA CONTRACT (a page data file sets window.WORLD_POWERS or window.POWER_STRUCTURE to one object)
   Dates are YYYY, YYYY-MM or YYYY-MM-DD and must be real calendar dates. No "to" means still in effect.
   Unknown fields are errors, so a typo is caught. Text is plain text, never markup: a value that contains an HTML tag
   (a < followed by a letter, / ! or ?) is refused wherever it appears.

   top level
     schema*    "world-powers/1" or "power-structure/1" (storage and export check)
     version*   text, up to 40 characters. Raise it on every content change; a saved browser copy is compared with it.
     asOf*      date, when the whole file was last reviewed
     title      page name
     claim      the claim line shown under the page title (up to 600 characters)
     vocab*     presentation contract fixed by the page; never importable (see below)
     panels     static explanatory panels such as Method and Claims checked (see below); never importable
     sources    { id: source } registry; every citation is written once and referenced by id
     nodes*     [ node ]
     edges*     [ edge ]

   source   title* (300), author (200), publisher (200), date, url (http or https only), retrieved (date),
            kind*: primary (official record, filing, treaty text) | secondary (press, book, think tank) | claim (a party's own
            assertion) | dataset (audited statistic)
   ref      a source id, or { id, loc } where loc (120) says where in the source (page, article, table)

   node     id* (^[a-z0-9][a-z0-9_-]{0,39}$)   name* (120)   label (24, short name drawn on the graph)
            cat* key of vocab.categories       kind key of vocab.kinds       entity key of vocab.entities (colour as that economy)
            region (40)                         memberships [keys of vocab.memberships, up to 24]
            measure { value*, year*, note }    number >= 0 in the unit of vocab.measure.format, with the year it describes
            publicMembership true|false        only for a category with publicFlag: is the membership list public
            from, to, approx                   when it started and ended; approx marks every date on the record as approximate
            notes (1500)   grade   asOf   reviewBy   refs [ref, up to 10]
   edge     source* target* (node ids, not equal)   type* key of vocab.relations (the layer)
            id (optional; derived as source.type.target, plus the start date or a counter when that is not unique)
            kind (60, the sub-type, e.g. "Treaty alliance")   state (120, e.g. "Managed truce to 2027-01-10")
            directed true|false (overrides vocab.relations[type].directed for this one tie)
            from, to, approx, desc (600), grade, asOf, reviewBy (date after which the tie needs a fresh look), refs
   grade    documented (a primary source or dataset in refs) | reported (a reliable secondary source in refs)
            | alleged (a claim that must say who makes it) | unrated (not reviewed; what a user's own edit starts as).
            Shipped data uses documented and reported only.
   Not in the contract: influence, strength, scores of any kind. Size is measured (vocab.size) or the count of ties.

   vocab
     categories* { id: { label*, hue*, shape*, fill: solid|hollow, publicFlag, desc } }   shape plus fill is unique per category
     relations*  { id: { label*, hue*, dash*, directed*, verb, revVerb, mverb, group, desc, kindMarks } }   hue plus dash is unique per relation;
                 a directed relation needs verb ("owns") and revVerb ("is owned by"); mverb is the phrase for an undirected tie
                 ("is allied with"; default "<label> with"); group names the layer a chip belongs to;
                 kindMarks { "<edge kind>": shape | "none" } draws that shape in the middle of ties of that kind (each shape once per relation)
     kinds       { id: { label } }                 node kinds
     entities    { id: { label*, token* } }        token: us uk cn ea jp ru gold global (the shared --cat-* colours)
     memberships { id: { label*, full, total } }   multi-valued node attribute; shown as highlight chips; total is the size of the whole group (the chip then reads "6 of 32")
     measure     { label*, format*, short }        format: usd-bn (billions of US dollars) | usd | count | percent | plain
     size        "degree" (default, count of ties) or "measure"
     grades      { grade: text }                   page wording for what each grade means
     legacy      { cat: {old: new}, relations: {old: new}, kinds: {old: new} }   maps ids in files exported by the first versions
     hue: blue orange aqua yellow magenta green neutral (names of the --c-* tokens)
     shape: circle square diamond triangle hexagon star cross     dash: solid long short dot dashdot

   panels   [ { id*, title*, intro, paras [text], list [text], grades (true shows the grade key), open, items [ item ] } ]
            item { head* (200), verdict (80), text* (900), refs [ref] }

   Limits: 500 nodes, 3000 edges, 500 sources, 2 MB file. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MacroGraphModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HUES = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'neutral'];
  const SHAPES = ['circle', 'square', 'diamond', 'triangle', 'hexagon', 'star', 'cross'];
  const FILLS = ['solid', 'hollow'];
  const DASHES = ['solid', 'long', 'short', 'dot', 'dashdot'];
  const GRADES = ['documented', 'reported', 'alleged', 'unrated'];
  const SOURCE_KINDS = ['primary', 'secondary', 'claim', 'dataset'];
  const ENTITY_TOKENS = ['us', 'uk', 'cn', 'ea', 'jp', 'ru', 'gold', 'global'];
  const MEASURE_FORMATS = ['usd-bn', 'usd', 'count', 'percent', 'plain'];
  const LIMITS = { nodes: 500, edges: 3000, sources: 500, refs: 10, memberships: 24, fileBytes: 2000000 };
  const GRADE_TEXT = {
    documented: 'A primary or official record, an audited statistic or an established scholarly history.',
    reported: 'One reliable secondary source, such as a wire service, a major newspaper or a standard reference.',
    alleged: 'A claim made by a named party and not independently confirmed.',
    unrated: 'Not reviewed yet. This is what your own edits start as.',
  };

  const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
  const EDGE_ID_RE = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
  const DATE_RE = /^(\d{3,4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
  const URL_WEB = /^https?:\/\/[^\s]+$/i;
  // control characters, plus invisible direction and line-break characters that could make a name read differently from how it is
  // stored (U+200C and U+200D stay allowed, since some scripts and emoji need them)
  const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;
  const MARKUP_RE = /<[a-zA-Z\/!?]/;
  const MARKUP_MSG = 'must be plain text, not HTML or script markup';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clip = (s) => String(s).slice(0, 40);
  const keys = (o) => Object.keys(o);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  function describe(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'a list';
    if (typeof v === 'object') return 'an object';
    if (typeof v === 'string') return 'text';
    return 'a ' + typeof v;
  }

  /* ---------- dates, links and display strings ---------- */
  function validDate(s) {
    if (typeof s !== 'string') return false;
    const m = DATE_RE.exec(s);
    if (!m) return false;
    if (m[2] !== undefined && (+m[2] < 1 || +m[2] > 12)) return false;
    if (m[3] !== undefined) {
      const dim = new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
      if (+m[3] < 1 || +m[3] > dim) return false;
    }
    return true;
  }
  // a sortable number: the first day of the period for a start, the last day for an end
  function dateKey(s, end) {
    const m = DATE_RE.exec(s);
    const y = +m[1];
    if (m[3] !== undefined) return y * 10000 + +m[2] * 100 + +m[3];
    if (m[2] !== undefined) return y * 10000 + +m[2] * 100 + (end ? 31 : 1);
    return y * 10000 + (end ? 1231 : 101);
  }
  function safeHref(u) { return typeof u === 'string' && u.length <= 500 && URL_WEB.test(u) ? u : null; }
  function formatDate(s) {
    if (!validDate(s)) return '';
    const m = DATE_RE.exec(s);
    if (m[3] !== undefined) return +m[3] + ' ' + MON[+m[2] - 1] + ' ' + +m[1];
    if (m[2] !== undefined) return MON[+m[2] - 1] + ' ' + +m[1];
    return String(+m[1]);
  }
  // "1870 to 1911", "in 1895", "since 1870", "until 1911"; approx adds "about"
  function formatSpan(r) {
    if (!r.from && !r.to) return '';
    const ap = r.approx ? 'about ' : '';
    // a one-off event has the same start and end: "1895", not "1895 to 1895"
    if (r.from && r.to) return r.from === r.to ? (r.approx ? 'about ' : 'in ') + formatDate(r.from) : ap + formatDate(r.from) + ' to ' + formatDate(r.to);
    if (r.from) return 'since ' + ap + formatDate(r.from);
    return 'until ' + ap + formatDate(r.to);
  }
  const nf0 = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function sig(n) { return n >= 100 ? nf0(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2); }
  function formatValue(v, format) {
    if (typeof v !== 'number' || !isFinite(v)) return '';
    if (format === 'usd-bn') {
      if (v >= 1000) return '$' + sig(v / 1000) + ' trillion';
      if (v >= 1) return '$' + sig(v) + ' billion';
      return '$' + sig(v * 1000) + ' million';
    }
    if (format === 'usd') return '$' + nf0(v);
    if (format === 'percent') return +v.toFixed(1) + '%';
    if (format === 'count') return nf0(v);
    return String(+v.toPrecision(4));
  }

  /* ---------- field specs ---------- */
  const S = (max, req) => ({ t: 's', max, req });
  const D = () => ({ t: 'd' });
  const B = () => ({ t: 'b' });
  const E = (list, req) => ({ t: 'e', list, req });
  const L = (list, max) => ({ t: 'l', list, max });
  const I = (req) => ({ t: 'id', req });
  const EI = () => ({ t: 'eid' });
  const U = () => ({ t: 'u' });
  const R = () => ({ t: 'refs' });
  const MEAS = () => ({ t: 'm' });

  function nodeFields(vocab) {
    const f = {
      id: I(true), name: S(120, true), label: S(24), cat: E(keys(vocab.categories), true), region: S(40),
      from: D(), to: D(), approx: B(), notes: S(1500), grade: E(GRADES), asOf: D(), reviewBy: D(), refs: R(),
    };
    if (vocab.kinds) f.kind = E(keys(vocab.kinds));
    if (vocab.entities) f.entity = E(keys(vocab.entities));
    if (vocab.memberships) f.memberships = L(keys(vocab.memberships), LIMITS.memberships);
    if (vocab.measure) f.measure = MEAS();
    if (keys(vocab.categories).some((k) => vocab.categories[k].publicFlag)) f.publicMembership = B();
    return f;
  }
  function edgeFields(vocab) {
    return {
      id: EI(), source: I(true), target: I(true), type: E(keys(vocab.relations), true), kind: S(60), state: S(120), directed: B(),
      grade: E(GRADES), from: D(), to: D(), approx: B(), asOf: D(), reviewBy: D(), desc: S(600), refs: R(),
    };
  }
  const SOURCE_FIELDS = { title: S(300, true), author: S(200), publisher: S(200), date: D(), url: U(), kind: E(SOURCE_KINDS, true), retrieved: D() };

  // copy only known fields; push a problem for anything else. Returns the clean record or null.
  function checkRecord(rec, fields, path, errs) {
    if (!isObj(rec)) { errs.push(path + ' must be an object, but the file has ' + describe(rec)); return null; }
    const out = {};
    let ok = true;
    keys(rec).forEach((k) => { if (!hasOwn(fields, k)) { errs.push(path + ' has an unknown field "' + clip(k) + '"'); ok = false; } });
    keys(fields).forEach((k) => {
      const f = fields[k], where = path + '.' + k;
      if (!hasOwn(rec, k) || rec[k] === undefined) { if (f.req) { errs.push(where + ' is required'); ok = false; } return; }
      const v = rec[k];
      const bad = (m) => { errs.push(where + ' ' + m); ok = false; };
      if (f.t === 's') {
        if (typeof v !== 'string') return bad('must be text');
        if (CTRL_RE.test(v)) return bad('contains a control or invisible direction character');
        if (MARKUP_RE.test(v)) return bad(MARKUP_MSG);
        if (f.req && !v.trim()) return bad('must not be empty');
        if (v.length > f.max) return bad('is longer than ' + f.max + ' characters');
        out[k] = v;
      } else if (f.t === 'd') {
        if (!validDate(v)) return bad('must be a date as YYYY, YYYY-MM or YYYY-MM-DD');
        out[k] = v;
      } else if (f.t === 'b') {
        if (typeof v !== 'boolean') return bad('must be true or false');
        out[k] = v;
      } else if (f.t === 'e') {
        if (typeof v !== 'string' || f.list.indexOf(v) < 0) return bad('must be one of ' + f.list.join(', '));
        out[k] = v;
      } else if (f.t === 'l') {
        if (!Array.isArray(v)) return bad('must be a list');
        if (v.length > f.max) return bad('has more than ' + f.max + ' entries');
        const seen = [];
        for (let i = 0; i < v.length; i++) {
          if (typeof v[i] !== 'string' || f.list.indexOf(v[i]) < 0) return bad('entry ' + (i + 1) + ' must be one of ' + f.list.join(', '));
          if (seen.indexOf(v[i]) < 0) seen.push(v[i]);
        }
        out[k] = seen;
      } else if (f.t === 'id') {
        if (typeof v !== 'string' || !ID_RE.test(v)) return bad('must be 1 to 40 lowercase letters, digits, underscores or hyphens');
        out[k] = v;
      } else if (f.t === 'eid') {
        if (typeof v !== 'string' || !EDGE_ID_RE.test(v)) return bad('must be 1 to 100 lowercase letters, digits, dots, underscores or hyphens');
        out[k] = v;
      } else if (f.t === 'u') {
        if (safeHref(v) === null) return bad('must be a web address starting with http:// or https://');
        out[k] = v;
      } else if (f.t === 'm') {
        const sub = (name, m) => { errs.push(where + '.' + name + ' ' + m); ok = false; };
        if (!isObj(v)) return bad('must be an object with value and year');
        const extra = keys(v).filter((x) => x !== 'value' && x !== 'year' && x !== 'note');
        if (extra.length) return bad('has an unknown field "' + clip(extra[0]) + '"');
        if (typeof v.value !== 'number' || !isFinite(v.value) || v.value < 0 || v.value > 1e15) return sub('value', 'must be a number from 0 to 1e15');
        if (!validDate(v.year)) return sub('year', 'must be a date as YYYY, YYYY-MM or YYYY-MM-DD');
        if (v.note !== undefined && (typeof v.note !== 'string' || v.note.length > 200 || CTRL_RE.test(v.note))) return sub('note', 'must be text of up to 200 characters');
        if (v.note !== undefined && MARKUP_RE.test(v.note)) return sub('note', MARKUP_MSG);
        out[k] = v.note ? { value: v.value, year: v.year, note: v.note } : { value: v.value, year: v.year };
      } else if (f.t === 'refs') {
        if (!Array.isArray(v)) return bad('must be a list');
        if (v.length > LIMITS.refs) return bad('has more than ' + LIMITS.refs + ' entries');
        const refs = [];
        v.forEach((r, i) => {
          if (typeof r === 'string') r = { id: r };
          if (isObj(r) && typeof r.loc === 'string' && MARKUP_RE.test(r.loc)) { errs.push(where + '[' + i + '].loc ' + MARKUP_MSG); ok = false; return; }
          if (!isObj(r) || typeof r.id !== 'string' || !ID_RE.test(r.id) || (r.loc !== undefined && (typeof r.loc !== 'string' || r.loc.length > 120 || CTRL_RE.test(r.loc))) ||
              keys(r).some((x) => x !== 'id' && x !== 'loc')) { errs.push(where + '[' + i + '] must be a source id or {id, loc}'); ok = false; return; }
          refs.push(r.loc ? { id: r.id, loc: r.loc } : { id: r.id });
        });
        out[k] = refs;
      }
    });
    return ok ? out : null;
  }

  /* ---------- vocabulary (presentation contract of one page) ---------- */
  // Identity must never depend on colour: every category needs its own shape and fill, every relation its own hue and dash.
  function checkVocab(vocab) {
    const errs = [];
    if (!isObj(vocab) || !isObj(vocab.categories) || !isObj(vocab.relations)) return ['vocab needs categories and relations'];
    const seenShape = {}, seenLine = {};
    const needLabel = (c, p) => { if (!isObj(c) || typeof c.label !== 'string' || !c.label || c.label.length > 80) errs.push(p + '.label is required (up to 80 characters)'); };
    if (!keys(vocab.categories).length) errs.push('vocab.categories must not be empty');
    if (!keys(vocab.relations).length) errs.push('vocab.relations must not be empty');
    keys(vocab.categories).forEach((k) => {
      const c = vocab.categories[k], p = 'vocab.categories.' + k;
      if (!ID_RE.test(k)) errs.push(p + ' is not a valid id');
      needLabel(c, p);
      if (!isObj(c)) return;
      if (HUES.indexOf(c.hue) < 0) errs.push(p + '.hue must be one of ' + HUES.join(', '));
      if (SHAPES.indexOf(c.shape) < 0) errs.push(p + '.shape must be one of ' + SHAPES.join(', '));
      if (FILLS.indexOf(c.fill || 'solid') < 0) errs.push(p + '.fill must be solid or hollow');
      const id = c.shape + '/' + (c.fill || 'solid');
      if (seenShape[id]) errs.push(p + ' has the same shape and fill as ' + seenShape[id] + ', so only colour would tell them apart');
      seenShape[id] = k;
    });
    keys(vocab.relations).forEach((k) => {
      const r = vocab.relations[k], p = 'vocab.relations.' + k;
      if (!ID_RE.test(k)) errs.push(p + ' is not a valid id');
      needLabel(r, p);
      if (!isObj(r)) return;
      if (HUES.indexOf(r.hue) < 0) errs.push(p + '.hue must be one of ' + HUES.join(', '));
      if (DASHES.indexOf(r.dash) < 0) errs.push(p + '.dash must be one of ' + DASHES.join(', '));
      if (typeof r.directed !== 'boolean') errs.push(p + '.directed must be true or false');
      if (r.kindMarks !== undefined) {
        if (!isObj(r.kindMarks)) errs.push(p + '.kindMarks must be an object of kind name to mark');
        else {
          const seenMark = {};
          keys(r.kindMarks).forEach((kind) => {
            const v = r.kindMarks[kind];
            if (!kind || kind.length > 60) errs.push(p + '.kindMarks has a kind name that is empty or longer than 60 characters');
            else if (v !== 'none' && SHAPES.indexOf(v) < 0) errs.push(p + '.kindMarks.' + clip(kind) + ' must be none or one of ' + SHAPES.join(', '));
            else if (v !== 'none') {
              if (seenMark[v]) errs.push(p + '.kindMarks.' + clip(kind) + ' has the same mark as ' + seenMark[v] + ', so the marks would not tell the kinds apart');
              seenMark[v] = clip(kind);
            }
          });
        }
      }
      if (r.directed && (typeof r.verb !== 'string' || typeof r.revVerb !== 'string')) errs.push(p + ' is directed, so it needs verb and revVerb');
      const id = r.hue + '/' + r.dash;
      if (seenLine[id]) errs.push(p + ' has the same hue and dash as ' + seenLine[id]);
      seenLine[id] = k;
    });
    ['kinds', 'memberships', 'entities'].forEach((sec) => {
      if (vocab[sec] === undefined) return;
      if (!isObj(vocab[sec])) { errs.push('vocab.' + sec + ' must be an object'); return; }
      keys(vocab[sec]).forEach((k) => {
        const p = 'vocab.' + sec + '.' + k;
        if (!ID_RE.test(k)) errs.push(p + ' is not a valid id');
        needLabel(vocab[sec][k], p);
        if (sec === 'entities' && isObj(vocab[sec][k]) && ENTITY_TOKENS.indexOf(vocab[sec][k].token) < 0) errs.push(p + '.token must be one of ' + ENTITY_TOKENS.join(', '));
        if (sec === 'memberships' && isObj(vocab[sec][k]) && vocab[sec][k].total !== undefined && !(Number.isInteger(vocab[sec][k].total) && vocab[sec][k].total >= 1 && vocab[sec][k].total <= 500)) errs.push(p + '.total must be a whole number from 1 to 500');
      });
    });
    if (vocab.measure !== undefined) {
      const m = vocab.measure;
      if (!isObj(m) || typeof m.label !== 'string' || !m.label) errs.push('vocab.measure.label is required');
      else if (MEASURE_FORMATS.indexOf(m.format) < 0) errs.push('vocab.measure.format must be one of ' + MEASURE_FORMATS.join(', '));
    }
    if (vocab.size !== undefined && vocab.size !== 'degree' && vocab.size !== 'measure') errs.push('vocab.size must be degree or measure');
    if (vocab.size === 'measure' && !vocab.measure) errs.push('vocab.size is measure, so vocab.measure is required');
    if (vocab.grades !== undefined) {
      if (!isObj(vocab.grades)) errs.push('vocab.grades must be an object');
      else keys(vocab.grades).forEach((g) => { if (GRADES.indexOf(g) < 0 || typeof vocab.grades[g] !== 'string') errs.push('vocab.grades.' + clip(g) + ' must be a grade name with text'); });
    }
    if (vocab.legacy !== undefined) {
      if (!isObj(vocab.legacy)) errs.push('vocab.legacy must be an object');
      else {
        const target = { cat: 'categories', relations: 'relations', kinds: 'kinds' };
        keys(vocab.legacy).forEach((sec) => {
          if (!hasOwn(target, sec) || !isObj(vocab.legacy[sec])) { errs.push('vocab.legacy.' + clip(sec) + ' must be cat, relations or kinds, holding an object'); return; }
          keys(vocab.legacy[sec]).forEach((old) => {
            const to = vocab.legacy[sec][old];
            if (!vocab[target[sec]] || typeof to !== 'string' || !hasOwn(vocab[target[sec]], to)) errs.push('vocab.legacy.' + sec + '.' + clip(old) + ' must name a key of vocab.' + target[sec]);
          });
        });
      }
    }
    return errs;
  }

  /* ---------- static panels ---------- */
  function checkPanels(panels, sources) {
    const errs = [];
    if (panels === undefined) return { errors: errs, data: [] };
    if (!Array.isArray(panels)) return { errors: ['panels must be a list'], data: null };
    if (panels.length > 8) errs.push('panels has more than 8 entries');
    const refsF = R();
    const out = [];
    panels.forEach((p, i) => {
      const path = 'panels[' + i + ']';
      const f = { id: I(true), title: S(80, true), intro: S(600), grades: B(), open: B() };
      const o = {};
      if (!isObj(p)) { errs.push(path + ' must be an object'); return; }
      const simple = {};
      keys(p).forEach((k) => { if (k !== 'paras' && k !== 'list' && k !== 'items') simple[k] = p[k]; });
      const c = checkRecord(simple, f, path, errs);
      if (!c) return;
      Object.assign(o, c);
      [['paras', 12, 900], ['list', 20, 300]].forEach((spec) => {
        const v = p[spec[0]];
        if (v === undefined) return;
        if (!Array.isArray(v) || v.length > spec[1] || v.some((t) => typeof t !== 'string' || !t || t.length > spec[2] || CTRL_RE.test(t))) { errs.push(path + '.' + spec[0] + ' must be a list of up to ' + spec[1] + ' texts of up to ' + spec[2] + ' characters'); return; }
        if (v.some((t) => MARKUP_RE.test(t))) { errs.push(path + '.' + spec[0] + ' ' + MARKUP_MSG); return; }
        o[spec[0]] = v.slice();
      });
      if (p.items !== undefined) {
        if (!Array.isArray(p.items) || p.items.length > 30) { errs.push(path + '.items must be a list of up to 30 items'); return; }
        o.items = [];
        p.items.forEach((it, j) => {
          const ip = path + '.items[' + j + ']';
          const ci = checkRecord(it, { head: S(200, true), verdict: S(80), text: S(900, true), refs: refsF }, ip, errs);
          if (!ci) return;
          (ci.refs || []).forEach((x) => { if (sources && !hasOwn(sources, x.id)) errs.push(ip + '.refs names a source that is not in sources: ' + clip(x.id)); });
          o.items.push(ci);
        });
      }
      out.push(o);
    });
    return { errors: errs, data: errs.length ? null : out };
  }

  /* ---------- identifiers ---------- */
  // stable, readable and independent of list order: source.type.target, plus the start date when that is not unique
  function edgeId(e, taken) {
    const base = e.source + '.' + e.type + '.' + e.target;
    let id = base;
    if (taken && taken.has(id) && e.from) id = base + '.' + e.from;
    let n = 2;
    while (taken && taken.has(id)) id = base + '.' + n++;
    return id;
  }
  function slug(name, taken) {
    let s = String(name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36).replace(/-+$/g, '');
    if (!s) s = 'item';
    let id = s, n = 2;
    while (taken && taken.has(id)) id = s.slice(0, 36) + '-' + n++;
    return id;
  }

  /* ---------- the whole data set ---------- */
  // raw: the file; ctx: {vocab, schema, mode: 'import' | 'builtin'}. Returns {errors[], warnings[], data}
  // builtin also accepts and requires version, asOf and vocab; import refuses the presentation sections.
  function validate(raw, ctx) {
    const errs = [], warns = [];
    const vocab = ctx.vocab;
    if (!isObj(raw)) return { errors: ['The file must hold one JSON object with nodes and edges, but it holds ' + describe(raw)], warnings: [], data: null };
    const allowed = ['schema', 'version', 'asOf', 'exportedAt', 'title', 'claim', 'ui', 'vocab', 'panels', 'nodes', 'edges', 'sources', 'base'];
    const builtin = ctx.mode === 'builtin';
    keys(raw).forEach((k) => {
      if (allowed.indexOf(k) < 0) errs.push('Unknown section "' + clip(k) + '"');
      else if (!builtin && (k === 'vocab' || k === 'ui' || k === 'panels' || k === 'claim')) errs.push('"' + k + '" cannot be imported: categories, relation types and page text come from the page');
    });
    if (ctx.schema && raw.schema !== undefined && raw.schema !== ctx.schema) errs.push('schema must be "' + ctx.schema + '"');
    if (builtin) {
      if (typeof raw.version !== 'string' || !raw.version || raw.version.length > 40) errs.push('version is required (text of up to 40 characters)');
      if (!validDate(raw.asOf)) errs.push('asOf is required as a date');
      if (raw.claim !== undefined && (typeof raw.claim !== 'string' || raw.claim.length > 600)) errs.push('claim must be text of up to 600 characters');
      errs.push.apply(errs, checkVocab(vocab));
    }
    if (!Array.isArray(raw.nodes)) errs.push('nodes must be a list');
    if (!Array.isArray(raw.edges)) errs.push('edges must be a list');
    if (raw.sources !== undefined && !isObj(raw.sources)) errs.push('sources must be an object');
    if (errs.length) return { errors: errs, warnings: warns, data: null };
    if (raw.nodes.length > LIMITS.nodes) errs.push('nodes has more than ' + LIMITS.nodes + ' entries');
    if (raw.edges.length > LIMITS.edges) errs.push('edges has more than ' + LIMITS.edges + ' entries');
    if (errs.length) return { errors: errs, warnings: warns, data: null };

    const NF = nodeFields(vocab), EF = edgeFields(vocab);
    const sources = Object.create(null);
    // records that failed their own check are remembered, so the entries that point at them are not also reported as missing
    const badSources = new Set(), badNodes = new Set();
    const srcKeys = raw.sources ? keys(raw.sources) : [];
    if (srcKeys.length > LIMITS.sources) errs.push('sources has more than ' + LIMITS.sources + ' entries');
    srcKeys.forEach((k) => {
      if (!ID_RE.test(k)) { errs.push('sources key "' + clip(k) + '" is not a valid id'); return; }
      const s = checkRecord(raw.sources[k], SOURCE_FIELDS, 'sources.' + k, errs);
      if (s) sources[k] = s; else badSources.add(k);
    });

    const nodes = [], nodeIds = new Set();
    raw.nodes.forEach((rec, i) => {
      const n = checkRecord(rec, NF, 'nodes[' + i + ']', errs);
      if (!n) { if (isObj(rec) && typeof rec.id === 'string' && ID_RE.test(rec.id)) badNodes.add(rec.id); return; }
      if (nodeIds.has(n.id)) { errs.push('nodes[' + i + '].id "' + n.id + '" is used twice'); return; }
      if (n.publicMembership !== undefined && !vocab.categories[n.cat].publicFlag) errs.push('nodes[' + i + '].publicMembership applies only to categories that set publicFlag');
      nodeIds.add(n.id);
      nodes.push(n);
    });

    const explicit = new Set();
    raw.edges.forEach((rec) => { if (isObj(rec) && typeof rec.id === 'string') explicit.add(rec.id); });
    const edges = [], edgeIds = new Set();
    const taken = { has: (x) => edgeIds.has(x) || explicit.has(x) };
    raw.edges.forEach((rec, i) => {
      let e = checkRecord(rec, EF, 'edges[' + i + ']', errs);
      if (!e) return;
      const p = 'edges[' + i + ']';
      if (!nodeIds.has(e.source) && !badNodes.has(e.source)) errs.push(p + '.source names an entity that is not in nodes: ' + clip(e.source));
      if (!nodeIds.has(e.target) && !badNodes.has(e.target)) errs.push(p + '.target names an entity that is not in nodes: ' + clip(e.target));
      if (e.source === e.target) errs.push(p + ' links "' + clip(e.source) + '" to itself');
      if (!e.id) e = Object.assign({ id: edgeId(e, taken) }, e);
      if (edgeIds.has(e.id)) { errs.push(p + '.id "' + e.id + '" is used twice'); return; }
      edgeIds.add(e.id);
      edges.push(e);
    });

    // cross checks that need both lists
    const checkSpan = (r, p) => {
      if (r.from && r.to && dateKey(r.from, false) > dateKey(r.to, true)) errs.push(p + ' ends (' + r.to + ') before it starts (' + r.from + ')');
      if (r.approx && !r.from && !r.to) warns.push(p + ' is marked approx but has no dates');
    };
    const checkRefs = (r, p) => {
      const kinds = [];
      (r.refs || []).forEach((x) => {
        if (!hasOwn(sources, x.id)) { if (!badSources.has(x.id)) errs.push(p + '.refs names a source that is not in sources: ' + clip(x.id)); }
        else kinds.push(sources[x.id].kind);
      });
      const has = (list) => kinds.some((k) => list.indexOf(k) >= 0);
      if (r.grade === 'documented' && !has(['primary', 'dataset'])) errs.push(p + ' is graded documented, which needs a primary or dataset source in refs');
      if (r.grade === 'reported' && !has(['primary', 'dataset', 'secondary'])) errs.push(p + ' is graded reported, which needs a primary, dataset or secondary source in refs');
      if (r.grade === 'alleged' && !kinds.length) warns.push(p + ' is graded alleged but names no source: say who makes the claim');
    };
    nodes.forEach((n, i) => { checkSpan(n, 'nodes[' + i + ']'); checkRefs(n, 'nodes[' + i + ']'); });
    edges.forEach((e, i) => { checkSpan(e, 'edges[' + i + ']'); checkRefs(e, 'edges[' + i + ']'); });

    let panels = [];
    if (builtin) {
      const pc = checkPanels(raw.panels, sources);
      errs.push.apply(errs, pc.errors);
      panels = pc.data || [];
    }

    if (!errs.length) {
      const deg = new Map(nodes.map((n) => [n.id, 0]));
      edges.forEach((e) => { deg.set(e.source, deg.get(e.source) + 1); deg.set(e.target, deg.get(e.target) + 1); });
      const orphans = nodes.filter((n) => deg.get(n.id) === 0).map((n) => n.id);
      if (orphans.length) warns.push(orphans.length + ' entities have no links: ' + orphans.join(', '));
      const used = new Set();
      nodes.concat(edges).forEach((r) => (r.refs || []).forEach((x) => used.add(x.id)));
      panels.forEach((p) => (p.items || []).forEach((it) => (it.refs || []).forEach((x) => used.add(x.id))));
      const unused = keys(sources).filter((k) => !used.has(k));
      if (unused.length) warns.push(unused.length + ' sources are not used: ' + unused.join(', '));
    }
    return { errors: errs, warnings: warns, data: errs.length ? null : { nodes, edges, sources }, panels };
  }

  /* ---------- files exported by the two original pages ---------- */
  // old nodes: {id,name,label,bloc|cat,type,influence,era,notes}; old edges: {id,source,target,type,strength,desc}. No schema key.
  // vocab.legacy maps their category, relation and kind ids to the current ones; influence and strength are dropped.
  // A legacy type that names a current category (the old EU had type "org") decides the category instead of the bloc.
  // Any other top-level key is carried through, so validate() names it instead of the file losing it silently.
  // report (optional) receives {droppedSelfLinks, scores}: the old second page could hold a tie from an entity to itself,
  // and scores counts the influence and strength values that were left out
  function fromLegacy(raw, vocab, report) {
    if (!isObj(raw) || raw.schema !== undefined || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return raw;
    let scores = 0;
    const map = (sec, v) => {
      const m = vocab && vocab.legacy && vocab.legacy[sec];
      return m && typeof v === 'string' && hasOwn(m, v) ? m[v] : v;
    };
    const put = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); };
    const eraDates = (era) => {
      if (typeof era !== 'string' || !era || era === 'n/a') return {};
      const m = /^(\d{3,4})s$/.exec(era);
      return m ? { from: m[1], approx: true } : { from: era };
    };
    const nodes = raw.nodes.map((n) => {
      if (!isObj(n)) return n;
      const o = {};
      keys(n).forEach((k) => {
        if (k === 'influence') { scores++; return; }
        if (k === 'bloc') put(o, 'cat', map('cat', n.bloc));
        else if (k === 'cat') put(o, 'cat', map('cat', n.cat));
        else if (k === 'type') {
          const kv = map('kinds', n.type);
          if (!vocab || (vocab.kinds && hasOwn(vocab.kinds, kv))) put(o, 'kind', kv);
        }
        else if (k === 'era') Object.assign(o, eraDates(n.era));
        else put(o, k, n[k]);
      });
      if (vocab && vocab.categories && hasOwn(n, 'bloc') && typeof n.type === 'string' && hasOwn(vocab.categories, n.type)) put(o, 'cat', n.type);
      return o;
    });
    let dropped = 0;
    const edges = raw.edges.filter((e) => { if (isObj(e) && e.source !== undefined && e.source === e.target) { dropped++; return false; } return true; }).map((e) => {
      if (!isObj(e)) return e;
      const o = {};
      keys(e).forEach((k) => {
        if (k === 'strength') { scores++; return; }
        if (k === 'id') return; // old ids were e0, e1 ... by list position, so new ones are derived
        put(o, k, k === 'type' ? map('relations', e.type) : e[k]);
      });
      return o;
    });
    if (report) { report.droppedSelfLinks = dropped; report.scores = scores; }
    const out = {};
    keys(raw).forEach((k) => { if (k !== 'nodes' && k !== 'edges') put(out, k, raw[k]); });
    put(out, 'nodes', nodes);
    put(out, 'edges', edges);
    return out;
  }

  // what replacing the working data with next would change, by id: {removedNodes, addedNodes, removedEdges, addedEdges}
  function compare(current, next) {
    const count = (a, b) => { const ids = new Set(b.map((r) => r.id)); return a.filter((r) => !ids.has(r.id)).length; };
    return {
      removedNodes: count(current.nodes, next.nodes), addedNodes: count(next.nodes, current.nodes),
      removedEdges: count(current.edges, next.edges), addedEdges: count(next.edges, current.edges),
    };
  }

  /* ---------- queries ---------- */
  function index(data) {
    const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    const edgeById = new Map(data.edges.map((e) => [e.id, e]));
    const edgesOf = new Map(data.nodes.map((n) => [n.id, []]));
    data.edges.forEach((e) => { edgesOf.get(e.source).push(e); edgesOf.get(e.target).push(e); });
    return { nodeById, edgeById, edgesOf };
  }
  // is a record in effect in a year? No dates means always
  function activeIn(r, year) {
    if (r.from && dateKey(r.from, false) > year * 10000 + 1231) return false;
    if (r.to && dateKey(r.to, true) < year * 10000 + 101) return false;
    return true;
  }
  // the earliest and latest year any record mentions, or null when nothing is dated
  function yearSpan(data) {
    let lo = null, hi = null;
    const see = (s) => { if (!s) return; const y = +DATE_RE.exec(s)[1]; if (lo === null || y < lo) lo = y; if (hi === null || y > hi) hi = y; };
    data.nodes.concat(data.edges).forEach((r) => { see(r.from); see(r.to); });
    return lo === null ? null : { min: lo, max: hi };
  }
  function gradeCounts(edges) {
    const c = { documented: 0, reported: 0, alleged: 0, unrated: 0 };
    edges.forEach((e) => { c[e.grade || 'unrated']++; });
    return c;
  }
  function effDirected(e, vocab) { return typeof e.directed === 'boolean' ? e.directed : !!vocab.relations[e.type].directed; }
  // true when a review date has passed (today is a date string such as 2026-10-23)
  function overdue(r, today) { return !!r.reviewBy && dateKey(r.reviewBy, true) < dateKey(today, false); }

  /* ---------- keyboard moves between points ---------- */
  // pts: [{id, x, y}] with y growing downward. navTable returns {table, mode}: table maps each id to {r, l, d, u}
  // (right, left, down, up), each an id or null for "nothing further that way".
  // Each arrow first goes to the nearest point in its direction. A crowded layout can shadow some points so that no
  // arrow lands on them, or split the points into groups the arrows cannot cross. When that happens (mode "rows"),
  // left and right walk along a row of points at about the same height and up and down go to the nearest point in the
  // next row, which lets the arrows reach every point from every other. o.eps is the smallest distance that counts as
  // "further", o.band the height of a row.
  const NAV_DIRS = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] };
  function navNearest(pts, eps) {
    const table = new Map();
    pts.forEach((a) => {
      const m = {};
      keys(NAV_DIRS).forEach((k) => {
        const dx = NAV_DIRS[k][0], dy = NAV_DIRS[k][1];
        let best = null, bs = Infinity, wide = null, ws = Infinity;
        pts.forEach((b) => {
          if (b === a) return;
          const vx = b.x - a.x, vy = b.y - a.y;
          const along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx);
          if (along <= eps) return;
          const score = along + 2 * across;
          if (across <= along * 1.73 && score < bs) { bs = score; best = b.id; }
          if (score < ws) { ws = score; wide = b.id; }
        });
        m[k] = best || wide;
      });
      table.set(a.id, m);
    });
    return table;
  }
  // true when every point can reach every other by following the table
  function navConnected(pts, table) {
    if (pts.length < 2) return true;
    const fwd = new Map(), back = new Map();
    pts.forEach((p) => { fwd.set(p.id, []); back.set(p.id, []); });
    table.forEach((m, id) => keys(m).forEach((k) => { if (m[k]) { fwd.get(id).push(m[k]); back.get(m[k]).push(id); } }));
    const reach = (adj) => {
      const seen = new Set([pts[0].id]), q = [pts[0].id];
      while (q.length) adj.get(q.pop()).forEach((t) => { if (!seen.has(t)) { seen.add(t); q.push(t); } });
      return seen.size;
    };
    return reach(fwd) === pts.length && reach(back) === pts.length;
  }
  function navRows(pts, band) {
    const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const rows = [];
    let cur = null, top = 0;
    pts.slice().sort((a, b) => a.y - b.y || a.x - b.x || byId(a, b)).forEach((p) => {
      if (!cur || p.y - top > band) { cur = []; rows.push(cur); top = p.y; }
      cur.push(p);
    });
    rows.forEach((r) => r.sort((a, b) => a.x - b.x || byId(a, b)));
    const nearestIn = (row, p) => {
      let best = null, bx = Infinity, by = Infinity;
      row.forEach((q) => {
        const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
        if (dx < bx || (dx === bx && dy < by)) { bx = dx; by = dy; best = q.id; }
      });
      return best;
    };
    const table = new Map();
    rows.forEach((row, ri) => row.forEach((p, ci) => {
      table.set(p.id, {
        r: ci + 1 < row.length ? row[ci + 1].id : null,
        l: ci > 0 ? row[ci - 1].id : null,
        d: ri + 1 < rows.length ? nearestIn(rows[ri + 1], p) : null,
        u: ri > 0 ? nearestIn(rows[ri - 1], p) : null,
      });
    }));
    return table;
  }
  function navTable(pts, o) {
    o = o || {};
    const nearest = navNearest(pts, o.eps > 0 ? o.eps : 1e-6);
    if (navConnected(pts, nearest)) return { table: nearest, mode: 'nearest' };
    return { table: navRows(pts, o.band > 0 ? o.band : 30), mode: 'rows' };
  }

  /* ---------- edits ---------- */
  // A pure edit: returns {errors[], data, info}. The whole result is validated again, so an edit can never leave a bad state.
  // op: {type: 'add-node'|'update-node'|'delete-node'|'add-edge'|'update-edge'|'delete-edge', node, edge, id, sources}
  function applyOp(data, op, ctx) {
    const nodes = data.nodes.slice(), edges = data.edges.slice();
    const sources = Object.create(null);
    keys(data.sources).forEach((k) => { sources[k] = data.sources[k]; });
    const info = {};
    const fail = (m) => ({ errors: [m], data: null, info });
    const find = (list, id) => list.findIndex((x) => x.id === id);
    if (op.sources) {
      const ks = keys(op.sources);
      for (let i = 0; i < ks.length; i++) {
        if (!ID_RE.test(ks[i])) return fail('sources key "' + clip(ks[i]) + '" is not a valid id');
        sources[ks[i]] = op.sources[ks[i]];
      }
    }
    if (op.type === 'add-node' || op.type === 'update-node') {
      const rec = Object.assign({}, op.node);
      if (op.type === 'add-node') {
        if (!rec.id) rec.id = slug(rec.name, new Set(nodes.map((n) => n.id)));
        nodes.push(rec);
      } else {
        const i = find(nodes, op.id);
        if (i < 0) return fail('That entity no longer exists');
        rec.id = op.id;
        nodes[i] = rec;
      }
      info.id = rec.id;
    } else if (op.type === 'delete-node') {
      const i = find(nodes, op.id);
      if (i < 0) return fail('That entity no longer exists');
      nodes.splice(i, 1);
      const keep = edges.filter((e) => e.source !== op.id && e.target !== op.id);
      info.removedEdges = edges.length - keep.length;
      edges.length = 0;
      keep.forEach((e) => edges.push(e));
    } else if (op.type === 'add-edge' || op.type === 'update-edge') {
      const rec = Object.assign({}, op.edge);
      const old = op.type === 'update-edge' ? edges.find((e) => e.id === op.id) : null;
      if (op.type === 'update-edge' && !old) return fail('That tie no longer exists');
      const others = new Set(edges.filter((e) => e !== old).map((e) => e.id));
      const same = old && old.source === rec.source && old.target === rec.target && old.type === rec.type && old.from === rec.from;
      rec.id = same ? old.id : edgeId(rec, others);
      if (old) edges[edges.indexOf(old)] = rec; else edges.push(rec);
      info.id = rec.id;
    } else if (op.type === 'delete-edge') {
      const i = find(edges, op.id);
      if (i < 0) return fail('That tie no longer exists');
      edges.splice(i, 1);
    } else return fail('Unknown edit');
    const res = validate({ schema: ctx.schema, nodes, edges, sources }, { vocab: ctx.vocab, schema: ctx.schema, mode: 'import' });
    return { errors: res.errors, data: res.data, info, warnings: res.warnings };
  }

  // "nodes[3].name is required" -> { record: 'nodes', index: 3, field: 'name', text: 'is required' }
  function parseProblem(msg) {
    const m = /^(nodes|edges)\[(\d+)\](?:\.(\w+))?(?:\[\d+\])?\s?(.*)$/.exec(msg);
    if (m) return { record: m[1], index: +m[2], field: m[3] || null, text: m[4].replace(/^\./, '') };
    const s = /^sources\.([a-z0-9_-]+)\.(\w+)\s(.*)$/.exec(msg);
    if (s) return { record: 'sources', id: s[1], field: s[2], text: s[3] };
    return { record: null, field: null, text: msg };
  }

  return {
    HUES, SHAPES, FILLS, DASHES, GRADES, SOURCE_KINDS, ENTITY_TOKENS, MEASURE_FORMATS, GRADE_TEXT, LIMITS,
    validDate, dateKey, safeHref, formatDate, formatSpan, formatValue,
    checkVocab, checkPanels, validate, fromLegacy, compare, applyOp, parseProblem, edgeId, slug,
    index, activeIn, yearSpan, gradeCounts, effDirected, overdue, navTable,
  };
});
