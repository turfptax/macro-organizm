/* Macro Organizm graph view and controller, shared by Nations and Power Structure.
   Needs, in this order: d3 7.9.0 (optional), assets/graph-model.js, assets/ui.js, then this file.
   A page supplies a data file (see the contract at the top of graph-model.js) and a short boot script:

     MacroGraph.create({
       data: window.WORLD_POWERS,            // built-in data; copied, never changed
       root: document.getElementById('graph-root'),   // an empty element inside #app; this file builds everything in it
       storage: 'mo-graph:world-powers',     // localStorage key for the user's edits
       file: 'world-powers',                 // prefix of exported file names
       words: { entity: 'nation', entities: 'nations', tie: 'relationship', ties: 'relationships', mapTitle: 'Relationship map' },
       panels: [...],                        // optional; defaults to data.panels
       layout: { distance: 70, charge: 200, chargeMax: 420, gravity: 0.04 },   // optional force tuning, see below
       legendOpen: true,                     // optional: whether "Filters and key" starts open (see below)
       d3Script: 'd3-script',                // optional id of the async d3 <script>, so a late load is picked up
       keyNotes: ['...'],                    // optional extra lines for "What the grades and marks mean"
       tall: true,                           // optional: a taller stage on screens wider than a phone, for a crowded map
       yearLabel: 'As of year', yearHint: '...', // optional wording for the year slider
     });

   layout also takes gravityX and gravityY (each defaults to gravity; a smaller gravityY lets the layout spread sideways) and
   aspect: 'stage' or a width / height number. When the settled layout is narrower than that ratio, it is stretched sideways
   only (nodes never move closer), up to 2.5 times, so a wide stage is used. Without aspect the layout is left as it settles.
   legendOpen: true (the default) opens "Filters and key" on arrival, except on phone widths where it starts folded; false folds
   it; 'auto' folds it when the window is shorter than 1000px or the chips take more than a third of the window height.

   The page HTML needs only the app bar (skip link, nav with aria-current, theme button), <div id="app"><div id="graph-root"></div></div>,
   the #load-error panel, <div id="dialog-root"></div>, and the scripts in this order at the end of the body: d3 (cdn.jsdelivr.net/npm/d3@7.9.0,
   with id d3-script), the data file, assets/graph-model.js, assets/ui.js, assets/graph.js, then the boot script above. Styles: macro.css, then graph.css.
   assets/shell.js goes in <head>. opts.claim overrides data.claim; opts.today ('YYYY-MM-DD') exists for tests.
   Methods: select(kind, id), clearSelection(), fit(), setFilters({cats, rels, grades, mems, q, year}), setView('graph'|'table'),
   setEdit(bool), exportData(), importText(text, name, {confirm}), reset(), undo(), state(), positions(), on(name, fn), destroy().
   importText returns true when applied, false when rejected, and 'pending' when the file removes more than it adds and the
   person is being asked first (pass {confirm: false} to skip that question, as a test does).
   Events: ready, select, filter, change, error. They exist for tests; the UI does not depend on them.
   Without d3 the table, detail, search, filters and editing still work and the graph view says why it is missing. */
(function () {
  'use strict';

  const Model = window.MacroGraphModel;
  const UI = window.MacroUI;
  const Shell = window.MacroShell || null;

  /* ---------- small helpers ---------- */
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '\u2026' : s);
  const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const article = (word) => (/^[aeiou]/i.test(word) ? 'an ' : 'a ');
  // closes a sentence with a full stop unless it already ends in one (a name such as "J.P. Morgan & Co." does)
  const sentence = (s) => (/[.!?]$/.test(s) ? s : s + '.');

  /* ---------- shapes ---------- */
  // path for a shape of nominal radius r around the origin; the factors keep their areas about equal
  const EXTENT = { circle: 1, square: 1.25, diamond: 1.2, triangle: 1.2, hexagon: 1.05, star: 1.3, cross: 1.4 };
  function shapePath(shape, r) {
    const f = (n) => +n.toFixed(2);
    if (shape === 'square') { const a = r * 0.88; return 'M' + f(-a) + ',' + f(-a) + 'H' + f(a) + 'V' + f(a) + 'H' + f(-a) + 'Z'; }
    if (shape === 'diamond') { const a = r * 1.2; return 'M0,' + f(-a) + 'L' + f(a) + ',0L0,' + f(a) + 'L' + f(-a) + ',0Z'; }
    if (shape === 'triangle') { const a = r * 1.2; return 'M0,' + f(-a) + 'L' + f(a * 0.866) + ',' + f(a * 0.5) + 'L' + f(-a * 0.866) + ',' + f(a * 0.5) + 'Z'; }
    if (shape === 'hexagon') {
      const a = r * 1.05, c = a * 0.5, s = a * 0.866;
      return 'M' + f(a) + ',0L' + f(c) + ',' + f(s) + 'L' + f(-c) + ',' + f(s) + 'L' + f(-a) + ',0L' + f(-c) + ',' + f(-s) + 'L' + f(c) + ',' + f(-s) + 'Z';
    }
    if (shape === 'star') {
      const o = r * 1.3, i = r * 0.55;
      let d = '';
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? i : o;
        d += (k ? 'L' : 'M') + f(Math.cos(ang) * rad) + ',' + f(Math.sin(ang) * rad);
      }
      return d + 'Z';
    }
    if (shape === 'cross') {
      const a = r * 1.15, t = r * 0.42;
      return 'M' + f(-t) + ',' + f(-a) + 'H' + f(t) + 'V' + f(-t) + 'H' + f(a) + 'V' + f(t) + 'H' + f(t) + 'V' + f(a) + 'H' + f(-t) + 'V' + f(t) + 'H' + f(-a) + 'V' + f(-t) + 'H' + f(-t) + 'Z';
    }
    return 'M' + f(r) + ',0A' + f(r) + ',' + f(r) + ' 0 1 1 ' + f(-r) + ',0A' + f(r) + ',' + f(r) + ' 0 1 1 ' + f(r) + ',0Z';
  }

  /* ---------- the controller ---------- */
  function create(opts) {
    try {
      return build(opts);
    } catch (err) {
      if (Shell) Shell.fatal('Something went wrong while building the page', String(err && err.message ? err.message : err));
      if (window.console) console.error(err);
      return null;
    }
  }

  function build(opts) {
    if (!Model || !UI) throw new Error('assets/graph-model.js and assets/ui.js must load before assets/graph.js.');
    if (!opts || !opts.root || !opts.data) throw new Error('The page did not give the graph a data object and a root element.');
    const { h, sv, clear, setPressed, link } = UI;
    const root = opts.root;
    const raw = opts.data;
    const vocab = raw.vocab || {};
    const store = Shell && Shell.store ? Shell.store : { get() { return null; }, set() { return false; }, remove() { return false; } };
    const KEY = opts.storage || ('mo-graph:' + raw.schema);
    const UIKEY = KEY + ':ui';
    const FILE = opts.file || 'graph';
    const L = Object.assign({ distance: 70, charge: 190, chargeMax: 420, gravity: 0.04 }, opts.layout || {});
    const WORDS = Object.assign({
      entity: 'entity', entities: 'entities', tie: 'tie', ties: 'ties', mapTitle: 'Relationship map',
      typeHead: 'Type', membersHead: 'Highlight members of', out: 'Ties from', in: 'Ties to', mutual: 'Ties with',
    }, opts.words || {});
    const today = opts.today || todayStr();
    const GRADE_TEXT = Object.assign({}, Model.GRADE_TEXT, vocab.grades || {});
    const GRADE_LABEL = { documented: 'Documented', reported: 'Reported', alleged: 'Alleged', unrated: 'Unrated' };

    const built = Model.validate(raw, { vocab: raw.vocab, schema: raw.schema, mode: 'builtin' });
    if (built.errors.length) throw new Error('The built-in data has ' + built.errors.length + ' problem(s). First: ' + built.errors[0]);
    const panelSrc = opts.panels || raw.panels;
    const pc = Model.checkPanels(panelSrc, built.data.sources);
    if (pc.errors.length) throw new Error('The page panels are not valid: ' + pc.errors[0]);
    const panels = pc.data || [];

    const BASE = built.data; // validated built-in data; never changed
    const BASE_VERSION = raw.version;
    const baseNodeJson = new Map(BASE.nodes.map((n) => [n.id, canon(n)]));
    const baseEdgeJson = new Map(BASE.edges.map((e) => [e.id, canon(e)]));
    const baseCanon = canon({ nodes: BASE.nodes, edges: BASE.edges, sources: BASE.sources });
    const ctxModel = { vocab, schema: raw.schema };

    let data = clone(BASE);
    data.sources = Object.assign(Object.create(null), data.sources);
    let savedBase = BASE_VERSION; // the built-in version the working copy was made from
    const undoStack = [];
    let idx = Model.index(data);
    let deg = new Map(), maxDeg = 1, maxMeasure = 1;
    let yoursNodes = new Set(), yoursEdges = new Set();
    let edited = false;

    let d3 = window.d3 || null;
    const listeners = {};
    const emit = (name, arg) => { (listeners[name] || []).forEach((fn) => { try { fn(arg); } catch (e) { if (window.console) console.error(e); } }); };

    /* ---------- state ---------- */
    const catKeys = Object.keys(vocab.categories);
    const relKeys = Object.keys(vocab.relations);
    const memKeys = vocab.memberships ? Object.keys(vocab.memberships) : [];
    const st = {
      sel: null, hover: null, hoverEdge: null, active: null, stageFocus: false,
      q: '', view: 'graph', edit: false, year: null,
      cats: new Set(catKeys), rels: new Set(relKeys), grades: new Set(Model.GRADES), mems: new Set(),
    };
    let vis = { nodes: new Set(), edges: new Set() };
    let matches = null; // Set of node ids matching the search, or null
    let statusFlash = '';

    /* ---------- vocabulary lookups ---------- */
    const cat = (id) => vocab.categories[id];
    const rel = (id) => vocab.relations[id];
    const hueVar = (hue) => 'var(--c-' + hue + ')';
    function nodeColor(n) {
      if (n.entity && vocab.entities && vocab.entities[n.entity]) return 'var(--cat-' + vocab.entities[n.entity].token + ')';
      return hueVar(cat(n.cat).hue);
    }
    const isDirected = (e) => Model.effDirected(e, vocab);
    function relPhrase(e, fromId) {
      // the tie as seen from fromId, e.g. "owns" or "is owned by" or "Alliance with"
      const r = rel(e.type);
      if (!isDirected(e)) return r.mverb || (r.label + ' with');
      return fromId === e.source ? (r.verb || r.label) : (r.revVerb || r.label);
    }
    function edgeTitle(e) {
      const a = idx.nodeById.get(e.source), b = idx.nodeById.get(e.target);
      return a.name + ' ' + relPhrase(e, e.source) + ' ' + b.name;
    }
    // the shape drawn on the middle of a tie of this kind, or null for a plain line (vocab.relations[type].kindMarks)
    function kindShape(e) {
      const r = rel(e.type);
      if (!r.kindMarks || !e.kind || !hasOwn(r.kindMarks, e.kind)) return null;
      return r.kindMarks[e.kind] === 'none' ? null : r.kindMarks[e.kind];
    }
    const isYours = (kind, rec) => (kind === 'node' ? yoursNodes : yoursEdges).has(rec.id);
    const unsourced = (rec) => !rec.refs || !rec.refs.length;

    function derive() {
      idx = Model.index(data);
      deg = new Map();
      data.nodes.forEach((n) => deg.set(n.id, idx.edgesOf.get(n.id).length));
      maxDeg = Math.max(1, ...Array.from(deg.values()));
      maxMeasure = 1;
      data.nodes.forEach((n) => { if (n.measure && n.measure.value > maxMeasure) maxMeasure = n.measure.value; });
      yoursNodes = new Set(); yoursEdges = new Set();
      data.nodes.forEach((n) => { if (baseNodeJson.get(n.id) !== canon(n)) yoursNodes.add(n.id); });
      data.edges.forEach((e) => { if (baseEdgeJson.get(e.id) !== canon(e)) yoursEdges.add(e.id); });
      edited = canon({ nodes: data.nodes, edges: data.edges, sources: data.sources }) !== baseCanon;
    }
    function radiusOf(n) {
      if (vocab.size === 'measure') {
        const v = n.measure ? n.measure.value : 0;
        return 7 + 19 * Math.sqrt(v / maxMeasure);
      }
      return 6 + 15 * Math.sqrt((deg.get(n.id) || 0) / maxDeg);
    }
    const measureText = (n) => (n.measure ? vocab.measure.label + ': ' + Model.formatValue(n.measure.value, vocab.measure.format) + ' (' + Model.formatDate(n.measure.year) + ')' + (n.measure.note ? '. ' + n.measure.note : '') : '');

    /* ---------- the DOM skeleton ---------- */
    clear(root);
    root.classList.toggle('gr-tall', !!opts.tall);
    const els = {};
    const ids = { hint: UI.uid('gr-hint'), search: UI.uid('gr-search'), searchHint: UI.uid('gr-searchhint'), year: UI.uid('gr-year') };

    const claimText = opts.claim || raw.claim || '';
    els.claim = h('p', { class: 'gr-claim', hidden: !claimText, text: claimText });
    els.notices = h('div', { class: 'gr-notices' });
    els.search = h('input', { class: 'input gr-search', id: ids.search, type: 'search', autocomplete: 'off', spellcheck: 'false', placeholder: 'Name or short name', 'aria-describedby': ids.searchHint, maxlength: '120' });
    els.searchHint = h('span', { class: 'tool-hint gr-searchhint', id: ids.searchHint, 'aria-live': 'polite' });
    els.yearIn = h('input', { type: 'range', id: ids.year, step: '1', min: '0', max: '1', value: '1' });
    els.yearOut = h('output', { class: 'num gr-yearout', for: ids.year });
    els.yearAll = h('button', { class: 'btn', type: 'button', text: 'Show all years' });
    els.yearTool = h('div', { class: 'tool gr-yeartool', hidden: true }, [
      h('label', { class: 'tool-label', for: ids.year }, [(opts.yearLabel || 'As of year') + ' ', h('span', { class: 'tool-hint', text: opts.yearHint || 'undated entries always show; a tie needs both ends in the year' })]),
      h('div', { class: 'gr-yearrow' }, [els.yearIn, els.yearOut, els.yearAll]),
    ]);
    els.viewBtn = h('button', { class: 'btn', type: 'button', text: 'Show as table' });
    els.fitBtn = h('button', { class: 'btn gr-fitbtn', type: 'button', text: 'Fit', title: 'Fit all visible ' + WORDS.entities + ' in the view' });
    els.resetViewBtn = h('button', { class: 'btn', type: 'button', text: 'Reset view', title: 'Clear the search, highlights, filters and the year, and lay the graph out again' });
    els.editBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', text: 'Edit mode', title: 'Turn editing on or off' });
    els.exportBtn = h('button', { class: 'btn', type: 'button', text: 'Export JSON' });
    els.addNodeBtn = h('button', { class: 'btn', type: 'button', text: 'Add ' + WORDS.entity });
    els.addEdgeBtn = h('button', { class: 'btn', type: 'button', text: 'Add ' + WORDS.tie });
    els.undoBtn = h('button', { class: 'btn', type: 'button', text: 'Undo', disabled: true });
    els.importBtn = h('button', { class: 'btn', type: 'button', text: 'Import JSON', title: 'The file replaces all ' + WORDS.entities + ' and ' + WORDS.ties + '. Nothing changes unless the whole file is valid.' });
    els.resetBtn = h('button', { class: 'btn', type: 'button', text: 'Reset data', title: 'Restore the built-in data and drop your edits' });
    els.file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a JSON file to import' });
    els.editRow = h('div', { class: 'tb-row secondary gr-editrow', hidden: true, role: 'group', 'aria-label': 'Editing tools' }, [
      h('div', { class: 'tool-actions gr-left' }, [els.addNodeBtn, els.addEdgeBtn, els.undoBtn, els.importBtn, els.resetBtn, els.file]),
    ]);
    els.status = h('p', { class: 'status', 'aria-live': 'polite' });
    els.msg = h('div', { class: 'notice', role: 'alert', hidden: true, tabindex: '-1' });
    els.live = h('div', { class: 'sr-only', 'aria-live': 'polite' });

    // on a phone the year, the buttons and the status line fold behind one Tools button, so the map is near the top
    els.toolsBtn = h('button', { class: 'btn tb-toggle gr-toolsbtn', type: 'button', 'aria-expanded': 'true' }, [h('span', { text: 'Tools' }), h('span', { class: 'tool-hint', text: 'view, year, export, edit' })]);
    els.toolbar = h('div', { class: 'toolbar gr-toolbar', role: 'group', 'aria-label': 'Graph tools', 'data-collapsed': '0' }, [
      h('div', { class: 'tb-row' }, [
        h('div', { class: 'tool gr-findtool' }, [h('label', { class: 'tool-label', for: ids.search }, ['Find ', els.searchHint]), els.search]),
        els.toolsBtn,
        els.yearTool,
        h('div', { class: 'tool-actions gr-actions' }, [els.viewBtn, els.fitBtn, els.resetViewBtn, els.exportBtn, els.editBtn]),
      ]),
      els.editRow,
      h('div', { class: 'tb-row secondary gr-statusrow' }, [els.status]),
      els.msg,
    ]);

    els.cardTitle = h('h2', { class: 'chart-title', text: WORDS.mapTitle });
    els.legendBody = h('div', { class: 'legend gr-legend' });
    els.legend = h('details', { class: 'legend-details gr-filters', open: true }, [h('summary', { text: 'Filters and key' }), els.legendBody]);

    els.svg = sv('svg', { class: 'gr-svg', 'aria-hidden': 'true', focusable: 'false' });
    els.vp = sv('g', { class: 'gr-vp' });
    els.gEdges = sv('g', { class: 'gr-edges' });
    els.gNodes = sv('g', { class: 'gr-nodes' });
    els.gEdgeLabels = sv('g', { class: 'gr-elabels' });
    els.labelLayer = sv('g', { class: 'gr-labels' });
    els.vp.appendChild(els.gEdges); els.vp.appendChild(els.gEdgeLabels); els.vp.appendChild(els.gNodes);
    els.svg.appendChild(els.vp); els.svg.appendChild(els.labelLayer);
    els.stage = h('div', {
      class: 'gr-stage', tabindex: '0', role: 'group', 'aria-describedby': ids.hint,
      'aria-label': 'Relationship graph. Arrow keys move between ' + WORDS.entities + ', Enter selects, Escape clears.',
    }, [els.svg]);
    els.zoomIn = h('button', { class: 'btn', type: 'button', text: '+', 'aria-label': 'Zoom in' });
    els.zoomOut = h('button', { class: 'btn', type: 'button', text: '\u2212', 'aria-label': 'Zoom out' });
    els.zoomFit = h('button', { class: 'btn', type: 'button', text: 'Fit', 'aria-label': 'Fit the graph in the view' });
    els.zoomCtl = h('div', { class: 'gr-zoomctl', role: 'group', 'aria-label': 'Zoom' }, [els.zoomIn, els.zoomOut, els.zoomFit]);
    els.empty = h('div', { class: 'empty-msg', hidden: true }, [
      h('p', { text: 'Nothing matches these filters.' }),
      h('button', { class: 'btn', type: 'button', text: 'Show everything' }),
    ]);
    els.emptyBtn = els.empty.querySelector('button');
    els.noD3 = h('div', { class: 'notice gr-nod3', hidden: true }, [h('p', { text: 'The graph library (d3 7.9.0 from cdn.jsdelivr.net) did not load, so the graph cannot be drawn. The table, search, details and editing still work. Check your connection or any content blocker and reload the page.' })]);
    els.stageWrap = h('div', { class: 'gr-stagewrap' }, [els.stage, els.zoomCtl, els.empty]);
    els.hint = h('p', { class: 'chart-note gr-hint', id: ids.hint, text: 'Keyboard: focus the graph, then the arrow keys move between ' + WORDS.entities + ', Enter selects, Escape clears, plus and minus zoom, 0 fits, slash searches. Drag to pan; Ctrl and scroll or a pinch zooms.' });
    els.nodesTableHost = h('div', { class: 'tableview gr-tableview', tabindex: '0', role: 'region', 'aria-label': cap(WORDS.entities) + ' table' });
    els.edgesTableHost = h('div', { class: 'tableview gr-tableview', tabindex: '0', role: 'region', 'aria-label': cap(WORDS.ties) + ' table' });
    els.tables = h('div', { class: 'gr-tables', hidden: true }, [els.nodesTableHost, els.edgesTableHost]);

    els.card = h('section', { class: 'card chartcard gr-card', 'aria-labelledby': 'gr-card-title' }, [
      h('div', { class: 'chart-head' }, [els.cardTitle]),
      els.legend, els.noD3, els.stageWrap, els.hint, els.tables, els.live,
    ]);
    els.cardTitle.id = 'gr-card-title';

    els.main = h('main', { id: 'main', class: 'main gr-main', tabindex: '-1' }, [els.claim, els.notices, els.toolbar, els.card]);
    els.detail = h('aside', { class: 'card gr-detail', 'aria-label': 'Details' });
    els.panels = h('div', { class: 'gr-panels' });
    els.shell = h('div', { class: 'shell gr-shell' }, [els.main, els.detail, els.panels]);
    root.appendChild(els.shell);

    const tip = UI.tip({ id: UI.uid('gr-tip') });
    const say = (text) => { els.live.textContent = ''; setTimeout(() => { els.live.textContent = text; }, 30); };

    /* ---------- notices ---------- */
    const noticeEls = new Map();
    // key identifies a notice so a repeat replaces it; actions: [{label, onClick}]
    function notify(key, text, actions, o) {
      dismissNotice(key);
      const kids = [h('p', { text })];
      (actions || []).forEach((a) => kids.push(h('button', { class: 'btn', type: 'button', text: a.label, onclick: () => { if (!a.keep) dismissNotice(key); a.onClick(); } })));
      kids.push(h('button', { class: 'btn', type: 'button', text: 'Dismiss', onclick: () => dismissNotice(key) }));
      const el = h('div', { class: 'notice' + (o && o.info ? ' notice--info' : ''), role: o && o.info ? 'status' : 'alert' }, kids);
      noticeEls.set(key, el);
      els.notices.appendChild(el);
    }
    function dismissNotice(key) {
      const el = noticeEls.get(key);
      if (el) { el.remove(); noticeEls.delete(key); }
    }
    function showMsg(text) {
      els.msg.textContent = '';
      els.msg.appendChild(h('p', { text }));
      els.msg.hidden = false;
      emit('error', { message: text });
    }
    function clearMsg() { els.msg.textContent = ''; els.msg.hidden = true; }

    /* ---------- visibility and search ---------- */
    function gradeShown(g) { return st.grades.has(g || 'unrated'); }
    // Ties come first: a tie shows when its layer, its grade and the year allow it and both ends pass the type and year filters.
    // An entity shows when its own grade is on, or when a shown tie touches it, so pressing Reported off keeps every documented tie.
    function computeVisible() {
      const nodes = new Set(), edges = new Set();
      const yr = st.year;
      const open = new Set(); // entities that pass the type and year filters
      data.nodes.forEach((n) => {
        if (!st.cats.has(n.cat)) return;
        if (yr !== null && !Model.activeIn(n, yr)) return;
        open.add(n.id);
      });
      const touched = new Set();
      data.edges.forEach((e) => {
        if (!st.rels.has(e.type) || !gradeShown(e.grade)) return;
        if (yr !== null && !Model.activeIn(e, yr)) return;
        if (!open.has(e.source) || !open.has(e.target)) return;
        edges.add(e.id);
        touched.add(e.source); touched.add(e.target);
      });
      data.nodes.forEach((n) => {
        if (!open.has(n.id)) return;
        if (!n.grade || n.grade === 'unrated' || st.grades.has(n.grade) || touched.has(n.id)) nodes.add(n.id);
      });
      vis = { nodes, edges };
      computeMatches();
    }
    function computeMatches() {
      const q = norm(st.q.trim());
      if (!q) { matches = null; return; }
      matches = new Set();
      data.nodes.forEach((n) => {
        if (!vis.nodes.has(n.id)) return;
        if (norm(n.name).indexOf(q) >= 0 || (n.label && norm(n.label).indexOf(q) >= 0) || norm(n.id).indexOf(q) >= 0 || (n.region && norm(n.region).indexOf(q) >= 0)) matches.add(n.id);
      });
    }
    function memberSet() {
      if (!st.mems.size) return null;
      const s = new Set();
      data.nodes.forEach((n) => { if ((n.memberships || []).some((m) => st.mems.has(m))) s.add(n.id); });
      return s;
    }
    // the set of node ids that stay bright when nothing is focused: search and membership together
    function filterSet() {
      const mem = memberSet();
      if (matches && mem) { const s = new Set(); matches.forEach((id) => { if (mem.has(id)) s.add(id); }); return s; }
      return matches || mem;
    }
    function bestMatch() {
      if (!matches || !matches.size) return null;
      const q = norm(st.q.trim());
      let best = null, bestScore = -1;
      matches.forEach((id) => {
        const n = idx.nodeById.get(id);
        let score = radiusOf(n);
        if (norm(n.name) === q || (n.label && norm(n.label) === q)) score += 1000;
        else if (norm(n.name).indexOf(q) === 0) score += 100;
        if (score > bestScore) { bestScore = score; best = id; }
      });
      return best;
    }

    /* ---------- the graph view (needs d3) ---------- */
    let sim = null, zoom = null, svgSel = null, resizeObs = null;
    let simNodes = [], simLinks = [];
    const nodeObj = new Map(), nodeEl = new Map(), edgeEl = new Map(), linkOf = new Map();
    const pos = new Map(); // id -> {x, y, fixed} remembered across rebuilds
    let tr = { k: 1, x: 0, y: 0 };
    let userMoved = false;
    let size = { w: 0, h: 0 };
    let labelPlace = new Map();
    const textWidth = (() => {
      const cache = new Map();
      let ctx = null;
      return (s) => {
        if (cache.has(s)) return cache.get(s);
        if (!ctx) { ctx = document.createElement('canvas').getContext('2d'); }
        let w = s.length * 6.4;
        if (ctx) { ctx.font = '12px ' + (getComputedStyle(els.stage).fontFamily || 'sans-serif'); w = ctx.measureText(s).width; }
        cache.set(s, w);
        return w;
      };
    })();

    function stageSize() { return { w: els.stage.clientWidth, h: els.stage.clientHeight }; }

    function seedPosition(n, i) {
      const prev = pos.get(n.id);
      if (prev) return { x: prev.x, y: prev.y, fx: prev.fixed ? prev.x : null, fy: prev.fixed ? prev.y : null };
      const near = (idx.edgesOf.get(n.id) || []).map((e) => pos.get(e.source === n.id ? e.target : e.source)).filter(Boolean);
      if (near.length) {
        const cx = near.reduce((s, p) => s + p.x, 0) / near.length, cy = near.reduce((s, p) => s + p.y, 0) / near.length;
        return { x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40, fx: null, fy: null };
      }
      const a = i * 2.399963, rad = 26 * Math.sqrt(i + 1);
      return { x: Math.cos(a) * rad, y: Math.sin(a) * rad, fx: null, fy: null };
    }

    function buildGraph(mode) {
      // mode: 'fresh' forgets positions; otherwise positions are kept and only new items are placed
      if (!d3) return;
      if (mode === 'fresh') pos.clear();
      else simNodes.forEach((sn) => pos.set(sn.id, { x: sn.x, y: sn.y, fixed: sn.fx != null }));
      clear(els.gEdges); clear(els.gNodes); clear(els.gEdgeLabels); clear(els.labelLayer);
      nodeObj.clear(); nodeEl.clear(); edgeEl.clear(); linkOf.clear(); labelPlace = new Map();
      simNodes = data.nodes.map((n, i) => {
        const sp = seedPosition(n, i);
        const rr = radiusOf(n);
        const sn = { id: n.id, x: sp.x, y: sp.y, fx: sp.fx, fy: sp.fy, r: rr, ext: rr * EXTENT[cat(n.cat).shape] };
        nodeObj.set(n.id, sn);
        return sn;
      });
      // parallel ties between one pair are drawn apart: index within the pair and the pair's size
      const pairs = new Map();
      data.edges.forEach((e) => { const k = e.source < e.target ? e.source + '|' + e.target : e.target + '|' + e.source; if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(e.id); });
      simLinks = data.edges.map((e) => {
        const k = e.source < e.target ? e.source + '|' + e.target : e.target + '|' + e.source;
        const grp = pairs.get(k);
        const l = { source: nodeObj.get(e.source), target: nodeObj.get(e.target), e, slot: grp.indexOf(e.id), count: grp.length, flip: e.source > e.target };
        linkOf.set(e.id, l);
        return l;
      });

      data.edges.forEach((e) => {
        const r = rel(e.type);
        const g = sv('g', { class: 'gr-edge' });
        g.style.setProperty('--c', hueVar(r.hue));
        const hit = sv('path', { class: 'gr-ehit' });
        const line = sv('path', { class: 'gr-line gr-d-' + r.dash });
        g.appendChild(hit); g.appendChild(line);
        let arrow = null, q = null, kmark = null;
        if (isDirected(e)) { arrow = sv('path', { class: 'gr-arrow' }); g.appendChild(arrow); }
        // a dashed ring in the middle of the tie marks the person's own edits, as the dashed ring does on an entity
        const ymark = sv('circle', { class: 'gr-ymark', r: 9 });
        g.appendChild(ymark);
        const ks = kindShape(e);
        if (ks) { kmark = sv('path', { class: 'gr-kmark', d: shapePath(ks, 4.5) }); g.appendChild(kmark); }
        if (e.grade === 'alleged') { q = sv('text', { class: 'gr-q', 'text-anchor': 'middle' }); q.textContent = '?'; g.appendChild(q); }
        const lab = sv('text', { class: 'gr-elabel gr-off', 'text-anchor': 'middle' });
        lab.textContent = e.kind || r.label;
        g.addEventListener('click', (ev) => { ev.stopPropagation(); select('edge', e.id, { reveal: true }); });
        g.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'touch') return; st.hoverEdge = e.id; applyHighlight(); showEdgeTip(e, ev); });
        g.addEventListener('pointermove', (ev) => { if (st.hoverEdge === e.id && ev.pointerType !== 'touch') tip.place(ev.clientX, ev.clientY); });
        g.addEventListener('pointerleave', () => { if (st.hoverEdge === e.id) { st.hoverEdge = null; tip.hide(); applyHighlight(); } });
        els.gEdges.appendChild(g);
        els.gEdgeLabels.appendChild(lab);
        edgeEl.set(e.id, { g, hit, line, arrow, q, lab, kmark, ymark, cand: false });
      });

      data.nodes.forEach((n) => {
        const sn = nodeObj.get(n.id), c = cat(n.cat);
        const g = sv('g', { class: 'gr-node' });
        g.style.setProperty('--c', nodeColor(n));
        const yours = sv('circle', { class: 'gr-yours', r: sn.ext + 8 });
        const ring = sv('circle', { class: 'gr-ring', r: sn.ext + 5 });
        const mark = sv('circle', { class: 'gr-mark', r: sn.ext + 5 });
        const shape = sv('path', { class: 'gr-shape' + (c.fill === 'hollow' ? ' hollow' : ''), d: shapePath(c.shape, sn.r) });
        const hit = sv('circle', { class: 'gr-hit', r: Math.max(sn.ext, 6) });
        [yours, ring, mark, shape, hit].forEach((x) => g.appendChild(x));
        g.addEventListener('click', (ev) => { ev.stopPropagation(); select('node', n.id, { reveal: true }); });
        g.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'touch') return; st.hover = n.id; applyHighlight(); showNodeTip(n, ev); });
        g.addEventListener('pointermove', (ev) => { if (st.hover === n.id && ev.pointerType !== 'touch') tip.place(ev.clientX, ev.clientY); });
        g.addEventListener('pointerleave', () => { if (st.hover === n.id) { st.hover = null; tip.hide(); applyHighlight(); } });
        els.gNodes.appendChild(g);
        d3.select(g).datum(sn).call(getDrag());
        const label = sv('text', { class: 'gr-label gr-off' });
        label.textContent = n.label || n.name;
        els.labelLayer.appendChild(label);
        nodeEl.set(n.id, { g, ring, mark, yours, shape, hit, label });
      });
    }

    let dragB = null;
    function getDrag() {
      if (!dragB) {
        // a press without movement is a click: the node is not pinned and the layout is not stirred. The pin and the
        // restart begin once the pointer has moved past the click distance.
        const gesture = new Map();
        dragB = d3.drag()
          .clickDistance(4)
          .on('start', (ev, d) => { gesture.set(d.id, { x: d.x, y: d.y, moved: false }); tip.hide(); })
          .on('drag', (ev, d) => {
            const g = gesture.get(d.id);
            if (!g) return;
            if (!g.moved) {
              if (Math.hypot(ev.x - g.x, ev.y - g.y) * tr.k <= 4) return;
              g.moved = true;
              if (sim && ev.active <= 1) sim.alphaTarget(0.25).restart(); // on a drag event, active counts this gesture too
            }
            d.fx = ev.x; d.fy = ev.y; d.x = ev.x; d.y = ev.y; drawAll();
          })
          .on('end', (ev, d) => {
            const g = gesture.get(d.id);
            gesture.delete(d.id);
            if (!g || !g.moved) return;
            if (sim && !ev.active) sim.alphaTarget(0);
            pos.set(d.id, { x: d.x, y: d.y, fixed: true });
          });
      }
      return dragB;
    }

    let aniso = 1; // how much harder the layout is pulled toward the horizontal axis than the vertical one (see widenLayout)
    const gravityOf = (axis) => (L['gravity' + axis] !== undefined ? L['gravity' + axis] : L.gravity);
    function makeSim() {
      if (!d3) return;
      if (sim) sim.stop();
      sim = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simLinks).distance((l) => L.distance + l.source.r + l.target.r))
        .force('charge', d3.forceManyBody().strength((d) => -(L.charge + d.r * 5)).distanceMax(L.chargeMax))
        .force('x', d3.forceX(0).strength(gravityOf('X') / aniso))
        .force('y', d3.forceY(0).strength(gravityOf('Y') * aniso))
        .force('collide', d3.forceCollide().radius((d) => d.ext + 5))
        .on('tick', drawAll)
        .stop();
    }
    // run the layout to rest before anything is painted, so nothing jumps
    function settle(alpha) {
      if (!sim) return;
      sim.alpha(alpha);
      const n = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
      for (let i = 0; i < n; i++) sim.tick();
      sim.stop();
      simNodes.forEach((sn) => pos.set(sn.id, { x: sn.x, y: sn.y, fixed: sn.fx != null }));
    }

    // layout.aspect: a layout that settled narrower than the target ratio is settled again with more pull toward the horizontal
    // axis (so it spreads sideways and the fit can draw it larger), then any gap left is closed by stretching x only,
    // which never brings two nodes closer
    function layoutBox() {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      simNodes.forEach((sn) => { x0 = Math.min(x0, sn.x - sn.ext); x1 = Math.max(x1, sn.x + sn.ext); y0 = Math.min(y0, sn.y - sn.ext); y1 = Math.max(y1, sn.y + sn.ext); });
      return { x0, x1, y0, y1, ratio: Math.max(x1 - x0, 1) / Math.max(y1 - y0, 1) };
    }
    function widenLayout() {
      if (!L.aspect || !simNodes.length || !sim) return;
      const s = stageSize();
      const target = L.aspect === 'stage' ? (s.w && s.h ? s.w / s.h : 0) : +L.aspect;
      if (!(target > 0)) return;
      let box = layoutBox();
      if (box.ratio >= target * 0.9) return;
      aniso = clamp(Math.sqrt(target / box.ratio), 1, 2.5);
      sim.force('x').strength(gravityOf('X') / aniso);
      sim.force('y').strength(gravityOf('Y') * aniso);
      settle(0.7);
      box = layoutBox();
      if (box.ratio >= target * 0.95) return;
      const f = Math.min(2.5, target / box.ratio), cx = (box.x0 + box.x1) / 2;
      simNodes.forEach((sn) => {
        sn.x = cx + (sn.x - cx) * f;
        if (sn.fx != null) sn.fx = sn.x;
        pos.set(sn.id, { x: sn.x, y: sn.y, fixed: sn.fx != null });
      });
    }

    function edgeGeometry(l) {
      const s = l.source, t = l.target, k = tr.k;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      let nx = -dy / dist, ny = dx / dist;
      if (l.flip) { nx = -nx; ny = -ny; }
      const bend = l.count > 1 ? (l.slot - (l.count - 1) / 2) * 44 : 0;
      const cx = (s.x + t.x) / 2 + nx * bend, cy = (s.y + t.y) / 2 + ny * bend;
      const directed = isDirected(l.e);
      // start on the source outline, end on the target outline (and short of the arrow tip)
      let ux = cx - s.x, uy = cy - s.y, ul = Math.hypot(ux, uy) || 1;
      const sx = s.x + (ux / ul) * (s.ext + 2), sy = s.y + (uy / ul) * (s.ext + 2);
      let vx = cx - t.x, vy = cy - t.y, vl = Math.hypot(vx, vy) || 1;
      const gap = 2 / k;
      const tipx = t.x + (vx / vl) * (t.ext + gap), tipy = t.y + (vy / vl) * (t.ext + gap);
      let ex = tipx, ey = tipy, arrowD = '';
      if (directed) {
        const aL = 11 / k, aW = 5 / k;
        const dirx = -vx / vl, diry = -vy / vl; // unit vector pointing into the target
        ex = tipx - dirx * (aL - 1 / k); ey = tipy - diry * (aL - 1 / k);
        const bx = tipx - dirx * aL, by = tipy - diry * aL;
        arrowD = 'M' + tipx.toFixed(2) + ',' + tipy.toFixed(2) + 'L' + (bx - diry * aW).toFixed(2) + ',' + (by + dirx * aW).toFixed(2) + 'L' + (bx + diry * aW).toFixed(2) + ',' + (by - dirx * aW).toFixed(2) + 'Z';
      }
      const d = l.count > 1 || Math.abs(bend) > 0
        ? 'M' + sx.toFixed(2) + ',' + sy.toFixed(2) + 'Q' + cx.toFixed(2) + ',' + cy.toFixed(2) + ' ' + ex.toFixed(2) + ',' + ey.toFixed(2)
        : 'M' + sx.toFixed(2) + ',' + sy.toFixed(2) + 'L' + ex.toFixed(2) + ',' + ey.toFixed(2);
      return { d, arrowD, mx: (sx + 2 * cx + ex) / 4, my: (sy + 2 * cy + ey) / 4 };
    }

    function drawEdges() {
      const k = tr.k;
      simLinks.forEach((l) => {
        const el = edgeEl.get(l.e.id);
        if (!el || el.g.classList.contains('gr-off')) return;
        const g = edgeGeometry(l);
        el.hit.setAttribute('d', g.d);
        el.line.setAttribute('d', g.d);
        if (el.arrow) el.arrow.setAttribute('d', g.arrowD);
        const mt = 'translate(' + g.mx.toFixed(2) + ',' + g.my.toFixed(2) + ') scale(' + (1 / k).toFixed(4) + ')';
        el.ymark.setAttribute('transform', mt);
        if (el.kmark) el.kmark.setAttribute('transform', mt);
        if (el.q) { el.q.setAttribute('x', g.mx.toFixed(2)); el.q.setAttribute('y', (g.my + 4 / k).toFixed(2)); el.q.style.fontSize = (13 / k).toFixed(2) + 'px'; }
        el.mid = g;
      });
    }
    function drawNodes() {
      simNodes.forEach((sn) => {
        const el = nodeEl.get(sn.id);
        if (el) el.g.setAttribute('transform', 'translate(' + sn.x.toFixed(1) + ',' + sn.y.toFixed(1) + ')');
      });
    }
    function drawAll() { drawNodes(); drawEdges(); placeLabels(); }

    // Tie names are placed after the entity names, in screen space, and a name that would sit on another label or on an
    // entity is left out. The selected tie and the tie under the pointer always keep theirs. rects (which grows as names
    // are placed) and discs are the screen-space boxes of the entity names already settled and of the entities in focus.
    function placeEdgeLabels(rects, discs) {
      const k = tr.k;
      const list = [];
      edgeEl.forEach((el, id) => { if (el.cand && el.mid) list.push({ id, el }); else el.lab.classList.add('gr-off'); });
      const lead = (c) => ((st.sel && st.sel.kind === 'edge' && st.sel.id === c.id) || st.hoverEdge === c.id ? 0 : 1);
      list.sort((a, b) => lead(a) - lead(b) || (idx.edgeById.get(a.id).grade === 'documented' ? 0 : 1) - (idx.edgeById.get(b.id).grade === 'documented' ? 0 : 1));
      list.forEach((c) => {
        const el = c.el, w = textWidth(el.lab.textContent) * 11 / 12 + 8;
        const cx = tr.x + k * el.mid.mx, cy = tr.y + k * el.mid.my;
        // above the middle of the line, then below it, then to either side
        const spots = [[0, -5], [0, 15], [w / 2 + 6, 4], [-(w / 2 + 6), 4]].map((o) => ({ dx: o[0], dy: o[1], rc: { x: cx + o[0] - w / 2, y: cy + o[1] - 12, w, h: 16 } }));
        const pick = spots.find((sp) => !rectHits(sp.rc, rects, discs, null)) || (lead(c) === 0 ? spots[0] : null);
        el.lab.classList.toggle('gr-off', !pick);
        if (!pick) return;
        rects.push(pick.rc);
        el.lab.setAttribute('x', (el.mid.mx + pick.dx / k).toFixed(2));
        el.lab.setAttribute('y', (el.mid.my + pick.dy / k).toFixed(2));
        el.lab.style.fontSize = (11 / k).toFixed(2) + 'px';
        el.lab.style.strokeWidth = (3 / k).toFixed(2) + 'px';
      });
    }
    // does a screen-space box overlap one of the placed boxes or touch an entity (other than selfId)?
    function rectHits(rc, placed, discs, selfId) {
      return placed.some((p) => rc.x < p.x + p.w && rc.x + rc.w > p.x && rc.y < p.y + p.h && rc.y + rc.h > p.y) ||
        discs.some((d) => {
          if (d.id === selfId) return false;
          const nx = Math.max(rc.x, Math.min(d.x, rc.x + rc.w)), ny = Math.max(rc.y, Math.min(d.y, rc.y + rc.h));
          return (nx - d.x) * (nx - d.x) + (ny - d.y) * (ny - d.y) < d.r * d.r;
        });
    }

    /* ---------- labels ---------- */
    function focusInfo() {
      // what the pointer, the keyboard or the selection is looking at: {nodes: Set, edges: Set, center: id|null}
      let center = null, edgeId = null;
      if (st.hover) center = st.hover;
      else if (st.hoverEdge) edgeId = st.hoverEdge;
      else if (st.stageFocus && st.active) center = st.active;
      else if (st.sel) { if (st.sel.kind === 'node') { if (vis.nodes.has(st.sel.id)) center = st.sel.id; } else if (vis.edges.has(st.sel.id)) edgeId = st.sel.id; }
      if (center && idx.nodeById.has(center)) {
        const nodes = new Set([center]), edges = new Set();
        (idx.edgesOf.get(center) || []).forEach((e) => { if (vis.edges.has(e.id)) { edges.add(e.id); nodes.add(e.source); nodes.add(e.target); } });
        return { nodes, edges, center };
      }
      if (edgeId && idx.edgeById.has(edgeId)) {
        const e = idx.edgeById.get(edgeId);
        return { nodes: new Set([e.source, e.target]), edges: new Set([e.id]), center: null };
      }
      return null;
    }

    function placeLabels() {
      if (!d3 || st.view !== 'graph' || !size.w) return;
      const k = tr.k, W = size.w, H = size.h;
      const focus = focusInfo();
      const fset = filterSet();
      const forced = new Set();
      // the entity under the pointer, the keyboard or the selection always keeps its name, even where it overlaps another;
      // the rest of the focus gets the first pick of room and drops its name when there is none
      const must = new Set();
      if (focus && focus.center) must.add(focus.center);
      if (st.sel && st.sel.kind === 'node') must.add(st.sel.id);
      if (st.active && st.stageFocus) must.add(st.active);
      const bm = bestMatch();
      if (bm) must.add(bm);
      if (focus) {
        if (focus.center) forced.add(focus.center);
        const nb = Array.from(focus.nodes).sort((a, b) => radiusOf(idx.nodeById.get(b)) - radiusOf(idx.nodeById.get(a))).slice(0, 24);
        nb.forEach((id) => forced.add(id));
      }
      if (st.sel && st.sel.kind === 'node') forced.add(st.sel.id);
      if (st.active && st.stageFocus) forced.add(st.active);
      if (matches) Array.from(matches).slice(0, 12).forEach((id) => forced.add(id));
      const order = data.nodes.filter((n) => vis.nodes.has(n.id)).map((n) => {
        const pri = forced.has(n.id) ? 2 : (fset && fset.has(n.id) ? 1 : 0);
        return { n, pri, r: radiusOf(n) };
      }).sort((a, b) => b.pri - a.pri || b.r - a.r);
      const placed = [];
      // node shapes in screen space: a label avoids the other nodes as well as the other labels
      const discs = [];
      order.forEach((o) => { const sn = nodeObj.get(o.n.id); discs.push({ id: o.n.id, x: tr.x + k * sn.x, y: tr.y + k * sn.y, r: sn.ext * k + 1 }); });
      const hits = (rc, selfId) => rectHits(rc, placed, discs, selfId);
      const shown = new Set();
      const placeOne = (o) => {
        const n = o.n, sn = nodeObj.get(n.id), el = nodeEl.get(n.id);
        const text = n.label || n.name;
        const cx = tr.x + k * sn.x, cy = tr.y + k * sn.y, rr = sn.ext * k + 5;
        if (cx < -60 || cx > W + 60 || cy < -30 || cy > H + 30) return;
        // the box is a little taller than a 12px line of text (the font's ascent and descent reach about 16px), so two labels
        // placed one above the other never touch
        const w = textWidth(text) + 6, hgt = 17;
        const cands = [
          { side: 'r', anchor: 'start', x: cx + rr + 4, y: cy + 4, rc: { x: cx + rr + 3, y: cy - 9, w, h: hgt } },
          { side: 'l', anchor: 'end', x: cx - rr - 4, y: cy + 4, rc: { x: cx - rr - 3 - w, y: cy - 9, w, h: hgt } },
          { side: 'b', anchor: 'middle', x: cx, y: cy + rr + 14, rc: { x: cx - w / 2, y: cy + rr + 1, w, h: hgt } },
          { side: 't', anchor: 'middle', x: cx, y: cy - rr - 5, rc: { x: cx - w / 2, y: cy - rr - 18, w, h: hgt } },
        ];
        // a label stays inside the stage: one above or below its node slides sideways, one beside it flips to the other side
        const inside = cands.filter((c) => {
          const m = 3;
          if (c.rc.y < m || c.rc.y + c.rc.h > H - m || c.rc.w > W - 2 * m) return false;
          let dx = 0;
          if (c.rc.x < m) dx = m - c.rc.x;
          else if (c.rc.x + c.rc.w > W - m) dx = W - m - (c.rc.x + c.rc.w);
          if (!dx) return true;
          if (c.anchor !== 'middle') return false;
          c.x += dx; c.rc.x += dx;
          return true;
        });
        let pick = inside.find((c) => !hits(c.rc, n.id));
        if (!pick && must.has(n.id)) pick = inside[0] || cands[0];
        if (!pick) return;
        placed.push(pick.rc);
        shown.add(n.id);
        el.label.setAttribute('x', pick.x.toFixed(1));
        el.label.setAttribute('y', pick.y.toFixed(1));
        el.label.setAttribute('text-anchor', pick.anchor);
      };
      // the names of what is focused come first, then the names of the focused ties, then the other entities take what room is left
      order.filter((o) => o.pri === 2).forEach(placeOne);
      // entities outside the focus are dimmed, so a tie name may cross them; it may not cover the ones in focus
      placeEdgeLabels(placed, focus ? discs.filter((d) => focus.nodes.has(d.id)) : []);
      order.filter((o) => o.pri !== 2).forEach(placeOne);
      nodeEl.forEach((el, id) => { el.label.classList.toggle('gr-off', !shown.has(id)); });
    }

    /* ---------- highlight, visibility ---------- */
    function applyVisibility() {
      if (!d3) return;
      nodeEl.forEach((el, id) => el.g.classList.toggle('gr-off', !vis.nodes.has(id)));
      edgeEl.forEach((el, id) => el.g.classList.toggle('gr-off', !vis.edges.has(id)));
      els.empty.hidden = vis.nodes.size > 0;
      drawEdges();
    }

    function applyHighlight() {
      if (!d3) return;
      const focus = focusInfo();
      const fset = focus ? null : filterSet();
      const mem = memberSet();
      nodeEl.forEach((el, id) => {
        const dim = focus ? !focus.nodes.has(id) : (fset ? !fset.has(id) : false);
        el.g.classList.toggle('is-dim', dim);
        el.label.classList.toggle('is-dim', dim);
        el.g.classList.toggle('is-sel', !!st.sel && st.sel.kind === 'node' && st.sel.id === id);
        el.g.classList.toggle('is-active', st.stageFocus && st.active === id);
        el.g.classList.toggle('is-match', !!matches && matches.has(id));
        el.g.classList.toggle('is-member', !!mem && mem.has(id));
        el.g.classList.toggle('is-yours', yoursNodes.has(id));
        el.label.classList.toggle('is-bold', (!!st.sel && st.sel.kind === 'node' && st.sel.id === id) || (!!matches && matches.has(id)));
      });
      edgeEl.forEach((el, id) => {
        const inFocus = focus ? focus.edges.has(id) : false;
        let dim = false;
        if (focus) dim = !inFocus;
        else if (fset) { const e = idx.edgeById.get(id); dim = !(fset.has(e.source) && fset.has(e.target)); }
        el.g.classList.toggle('is-dim', dim);
        el.g.classList.toggle('is-hl', inFocus);
        el.g.classList.toggle('is-sel', !!st.sel && st.sel.kind === 'edge' && st.sel.id === id);
        el.g.classList.toggle('is-yours', yoursEdges.has(id));
        el.cand = inFocus && focus.edges.size <= 14 && vis.edges.has(id);
      });
      placeLabels();
    }

    /* ---------- zoom, fit, size ---------- */
    function onZoom(ev) {
      tr = { k: ev.transform.k, x: ev.transform.x, y: ev.transform.y };
      if (ev.sourceEvent) userMoved = true;
      els.vp.setAttribute('transform', 'translate(' + tr.x.toFixed(2) + ',' + tr.y.toFixed(2) + ') scale(' + tr.k.toFixed(4) + ')');
      drawEdges();
      placeLabels();
    }
    function setTransform(t) {
      if (!zoom) return;
      svgSel.call(zoom.transform, t);
    }
    function fit() {
      userMoved = false;
      if (!d3 || !zoom) return;
      size = stageSize();
      if (!size.w || !size.h) return;
      const list = simNodes.filter((sn) => vis.nodes.has(sn.id));
      if (!list.length) { setTransform(d3.zoomIdentity.translate(size.w / 2, size.h / 2)); return; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      list.forEach((sn) => { x0 = Math.min(x0, sn.x - sn.ext); x1 = Math.max(x1, sn.x + sn.ext); y0 = Math.min(y0, sn.y - sn.ext); y1 = Math.max(y1, sn.y + sn.ext); });
      const padX = Math.min(70, size.w * 0.1), padY = 28;
      const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);
      const k = clamp(Math.min((size.w - 2 * padX) / bw, (size.h - 2 * padY) / bh), 0.12, 2);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      setTransform(d3.zoomIdentity.translate(size.w / 2 - k * cx, size.h / 2 - k * cy).scale(k));
      userMoved = false;
    }
    function zoomBy(f) {
      if (!d3 || !zoom) return;
      svgSel.call(zoom.scaleBy, f);
      userMoved = true;
    }
    function screenOf(id) { const sn = nodeObj.get(id); return { x: tr.x + tr.k * sn.x, y: tr.y + tr.k * sn.y }; }
    function ensureVisibleNode(id) {
      if (!d3 || !zoom || !nodeObj.has(id) || st.view !== 'graph' || !vis.nodes.has(id)) return;
      const p = screenOf(id);
      if (p.x < 30 || p.x > size.w - 30 || p.y < 30 || p.y > size.h - 30) {
        const sn = nodeObj.get(id);
        svgSel.call(zoom.translateTo, sn.x, sn.y);
        userMoved = true;
      }
    }

    function initGraph() {
      if (!d3) return;
      zoom = d3.zoom().scaleExtent([0.1, 8])
        .filter((ev) => {
          if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
          if (ev.type === 'dblclick') return false;
          return !ev.button;
        })
        .on('zoom', onZoom);
      svgSel = d3.select(els.svg);
      svgSel.call(zoom).on('dblclick.zoom', null);
      els.svg.addEventListener('click', (ev) => { if (ev.target === els.svg || ev.target.closest('.gr-vp') === null) clearSelection(); });
      if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(() => {
          const s = stageSize();
          if (!s.w || !s.h || (s.w === size.w && s.h === size.h)) return;
          size = s;
          if (!userMoved && st.view === 'graph') fit(); else placeLabels();
        });
        resizeObs.observe(els.stage);
      }
      rebuildGraph('fresh');
    }
    function rebuildGraph(mode) {
      if (!d3) return;
      buildGraph(mode);
      if (mode === 'fresh') aniso = 1;
      makeSim();
      // when only part of the data changed, the nodes that were already placed stay where they are
      const frozen = [];
      if (mode !== 'fresh') simNodes.forEach((sn) => { if (pos.has(sn.id) && sn.fx == null) { sn.fx = sn.x; sn.fy = sn.y; frozen.push(sn); } });
      settle(mode === 'fresh' ? 1 : 0.35);
      frozen.forEach((sn) => { sn.fx = null; sn.fy = null; });
      if (mode === 'fresh') widenLayout();
      drawNodes();
      applyVisibility();
      applyHighlight();
      if (!userMoved || mode === 'fresh') fit(); else drawAll();
    }

    /* ---------- tooltips ---------- */
    function showNodeTip(n, ev) {
      const c = cat(n.cat);
      const lines = [];
      const k = (idx.edgesOf.get(n.id) || []).filter((e) => vis.edges.has(e.id)).length;
      lines.push(plural(k, WORDS.tie, WORDS.ties) + ' shown');
      if (n.measure) lines.push(measureText(n));
      if (n.grade) lines.push('Evidence: ' + GRADE_LABEL[n.grade]);
      if (yoursNodes.has(n.id)) lines.push(unsourced(n) ? 'Your edit, unsourced' : 'Your edit');
      lines.push('Select for details.');
      tip.set(n.name, lines, c.label + (n.kind && vocab.kinds ? ', ' + vocab.kinds[n.kind].label : ''));
      tip.place(ev.clientX, ev.clientY);
    }
    function showEdgeTip(e, ev) {
      const r = rel(e.type);
      const lines = [r.label + (e.kind ? ': ' + e.kind : '')];
      if (e.state) lines.push(e.state);
      const span = spanText(e);
      if (span) lines.push(cap(span));
      lines.push('Evidence: ' + GRADE_LABEL[e.grade || 'unrated']);
      if (yoursEdges.has(e.id)) lines.push(unsourced(e) ? 'Your edit, unsourced' : 'Your edit');
      tip.set(edgeTitle(e), lines);
      tip.place(ev.clientX, ev.clientY);
    }

    /* ---------- selection ---------- */
    const narrow = () => !!(window.matchMedia && window.matchMedia('(max-width: 1099px)').matches);
    function select(kind, id, o) {
      o = o || {};
      if (kind === 'node' ? !idx.nodeById.has(id) : !idx.edgeById.has(id)) return false;
      // a press inside the details (a tie row, Go to) rebuilds the details, so focus goes to the new heading
      const fromDetail = els.detail.contains(document.activeElement);
      st.sel = { kind, id };
      if (kind === 'node') st.active = id;
      tip.hide();
      renderDetail();
      els.detail.scrollTop = 0;
      applyHighlight();
      if (kind === 'node' && o.pan !== false) ensureVisibleNode(id);
      if (fromDetail) focusDetailTitle();
      if (o.reveal && narrow()) revealDetail(!!o.focusDetail);
      else if (!narrow() && !fromDetail) {
        // the details are in the side panel; without this a keyboard or screen reader user hears nothing after Enter
        const t = els.detail.querySelector('.gr-dtitle');
        if (t) say(sentence(t.textContent + ' selected. The details are in the panel on the right'));
      }
      emit('select', { kind, id });
      return true;
    }
    function focusDetailTitle() {
      const t = els.detail.querySelector('.gr-dtitle');
      if (t) t.focus({ preventScroll: true });
    }
    // Under 1100px the details sit below the graph. Bring them into view unless they already are; focus stays where it was
    // (the graph, the search box or a table) unless asked to move to the heading, and the change is announced either way.
    // Every detail view has a "Back to the graph" button, so the way back is one press.
    function barHeight() {
      const bar = document.querySelector('.appbar');
      if (!bar) return 0;
      const pos = window.getComputedStyle(bar).position;
      return pos === 'sticky' || pos === 'fixed' ? bar.getBoundingClientRect().height : 0;
    }
    // smooth unless the person prefers reduced motion. Some browsers and background windows never start a smooth scroll,
    // so when nothing has moved shortly after, the jump is made at once.
    function bringIntoView(el) {
      const smooth = !reduceMotion(), y0 = window.scrollY;
      el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      if (smooth) setTimeout(() => { if (window.scrollY === y0 && Math.abs(el.getBoundingClientRect().top - barHeight() - 8) > 24) el.scrollIntoView({ block: 'start', behavior: 'auto' }); }, 600);
    }
    function revealDetail(focusHeading) {
      const top = els.detail.getBoundingClientRect().top;
      if (top < barHeight() || top > window.innerHeight - 140) bringIntoView(els.detail);
      const t = els.detail.querySelector('.gr-dtitle');
      if (focusHeading && t) t.focus({ preventScroll: true });
      else if (t) say(sentence(t.textContent + ' selected. The details are below the ' + (st.view === 'table' ? 'tables' : 'graph') + '. Use "' + backLabel() + '" to return'));
    }
    function backToView() {
      if (st.view === 'table') { bringIntoView(els.tables); els.nodesTableHost.focus({ preventScroll: true }); }
      else { bringIntoView(els.stageWrap); els.stage.focus({ preventScroll: true }); }
    }
    const backLabel = () => (st.view === 'table' ? 'Back to the table' : 'Back to the graph');
    const backButton = () => h('button', { class: 'btn gr-back', type: 'button', text: backLabel(), onclick: backToView });
    function clearSelection() {
      if (!st.sel) return;
      st.sel = null;
      renderDetail();
      applyHighlight();
      emit('select', null);
    }

    /* ---------- keyboard on the stage ---------- */
    function firstActive() {
      if (st.sel && st.sel.kind === 'node' && vis.nodes.has(st.sel.id)) return st.sel.id;
      let best = null, bs = -1;
      data.nodes.forEach((n) => { if (vis.nodes.has(n.id) && (deg.get(n.id) || 0) + radiusOf(n) / 100 > bs) { bs = (deg.get(n.id) || 0) + radiusOf(n) / 100; best = n.id; } });
      return best;
    }
    // Where each arrow goes from each shown entity. It depends only on which entities are shown and where they sit, so it is
    // kept until one of those changes. Model.navTable sees to it that the arrows can reach every shown entity from every other.
    let navCache = null, navMode = null;
    function navFor() {
      const pts = [];
      data.nodes.forEach((n) => { if (vis.nodes.has(n.id) && nodeObj.has(n.id)) { const sn = nodeObj.get(n.id); pts.push({ id: n.id, x: sn.x, y: sn.y, ext: sn.ext }); } });
      const key = pts.map((p) => p.id + ':' + Math.round(p.x) + ':' + Math.round(p.y)).join('|');
      if (navCache && navCache.key === key) return navCache.table;
      const exts = pts.map((p) => p.ext).sort((a, b) => a - b);
      const med = exts.length ? exts[exts.length >> 1] : 10;
      const res = Model.navTable(pts, { eps: 1, band: Math.max(20, 2.4 * med) });
      navCache = { key, table: res.table };
      navMode = res.mode;
      return res.table;
    }
    function moveActive(dir) {
      if (!d3) return;
      if (!st.active || !vis.nodes.has(st.active)) st.active = firstActive();
      if (!st.active) return;
      const here = navFor().get(st.active);
      const next = here ? here[dir] : null;
      if (!next) { say('No ' + WORDS.entity + ' further that way.'); return; }
      st.active = next;
      ensureVisibleNode(next);
      applyHighlight();
      announceActive();
      showActiveTip();
    }
    function showActiveTip() {
      const n = idx.nodeById.get(st.active);
      if (!n || !st.stageFocus || !d3 || st.view !== 'graph') return;
      const r = els.stage.getBoundingClientRect(), p = screenOf(n.id);
      showNodeTip(n, { clientX: r.left + p.x, clientY: r.top + p.y });
    }
    function announceActive() {
      const n = idx.nodeById.get(st.active);
      if (!n) return;
      const k = (idx.edgesOf.get(n.id) || []).filter((e) => vis.edges.has(e.id)).length;
      say(n.name + ', ' + cat(n.cat).label + ', ' + plural(k, WORDS.tie, WORDS.ties) + '. Press Enter to select.');
    }
    function onStageKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key;
      if (!st.stageFocus && ev.target === els.stage) { st.stageFocus = true; applyHighlight(); }
      if (k === 'ArrowRight') { ev.preventDefault(); moveActive('r'); }
      else if (k === 'ArrowLeft') { ev.preventDefault(); moveActive('l'); }
      else if (k === 'ArrowDown') { ev.preventDefault(); moveActive('d'); }
      else if (k === 'ArrowUp') { ev.preventDefault(); moveActive('u'); }
      else if (k === 'Enter' || k === ' ') {
        ev.preventDefault();
        if (st.active && vis.nodes.has(st.active)) { tip.hide(); select('node', st.active, { reveal: true, focusDetail: narrow(), pan: false }); }
      } else if (k === 'Escape') {
        if (tip.shown) tip.hide();
        else clearSelection();
      } else if (k === '+' || k === '=') { ev.preventDefault(); zoomBy(1.3); }
      else if (k === '-' || k === '_') { ev.preventDefault(); zoomBy(1 / 1.3); }
      else if (k === '0') { ev.preventDefault(); fit(); }
      else if (k === '/') { ev.preventDefault(); els.search.focus(); }
      else if ((k === 'e' || k === 'E') && st.edit && st.sel) { ev.preventDefault(); editSelection(); }
    }

    /* ---------- legend and filters ---------- */
    const chipRefs = { cats: new Map(), rels: new Map(), grades: new Map(), mems: new Map() };
    function keySvg(kind, rec, shape) {
      if (kind === 'kind') {
        const s = sv('svg', { class: 'key gr-kindsvg', viewBox: '0 0 36 14', 'aria-hidden': 'true', focusable: 'false' });
        s.style.setProperty('--c', hueVar(rec.hue));
        s.appendChild(sv('line', { x1: 1, x2: 35, y1: 7, y2: 7, class: 'gr-d-' + rec.dash }));
        if (shape && shape !== 'none') s.appendChild(sv('path', { d: shapePath(shape, 4.5), transform: 'translate(18,7)' }));
        return s;
      }
      if (kind === 'cat') {
        const s = sv('svg', { class: 'key', viewBox: '-12 -8 24 16', 'aria-hidden': 'true', focusable: 'false' });
        s.style.setProperty('--c', hueVar(rec.hue));
        s.appendChild(sv('path', { class: rec.fill === 'hollow' ? 'hollow' : '', d: shapePath(rec.shape, 5.5) }));
        return s;
      }
      const s = sv('svg', { class: 'key', viewBox: '0 0 24 12', 'aria-hidden': 'true', focusable: 'false' });
      s.style.setProperty('--c', hueVar(rec.hue));
      s.appendChild(sv('line', { x1: 1, x2: 23, y1: 6, y2: 6, class: 'gr-d-' + rec.dash }));
      return s;
    }
    function chip(group, id, label, keyEl, count) {
      const kids = [];
      if (keyEl) kids.push(keyEl);
      kids.push(label);
      if (count !== undefined) kids.push(h('span', { class: 'gr-n num', text: String(count) }));
      const b = h('button', { class: 'chip' + (group === 'mems' ? ' gr-memchip' : ''), type: 'button', 'aria-pressed': 'true', 'aria-label': count !== undefined ? label + ', ' + count : null }, kids);
      b.addEventListener('click', () => toggleChip(group, id));
      chipRefs[group].set(id, b);
      return b;
    }
    function lgroup(title, chips, allNone, noteText) {
      const headId = UI.uid('gr-lg');
      const head = [h('span', { id: headId, text: title })];
      if (allNone) {
        head.push(h('button', { type: 'button', text: 'All', 'aria-label': 'Show all: ' + title, onclick: () => allNone(true) }));
        head.push(h('button', { type: 'button', text: 'None', 'aria-label': 'Hide all: ' + title, onclick: () => allNone(false) }));
      }
      const kids = [h('div', { class: 'lgroup-head' }, head), h('div', { class: 'lgroup-chips', role: 'group', 'aria-labelledby': headId }, chips)];
      if (noteText) kids.push(h('p', { class: 'chart-note gr-gradekey', text: noteText }));
      return h('div', { class: 'lgroup' }, kids);
    }
    function renderLegend() {
      Object.keys(chipRefs).forEach((k) => chipRefs[k].clear());
      clear(els.legendBody);
      const catCount = {}, relCount = {}, memCount = {}, gradeCount = { documented: 0, reported: 0, alleged: 0, unrated: 0 };
      data.nodes.forEach((n) => { catCount[n.cat] = (catCount[n.cat] || 0) + 1; (n.memberships || []).forEach((m) => { memCount[m] = (memCount[m] || 0) + 1; }); });
      data.edges.forEach((e) => { relCount[e.type] = (relCount[e.type] || 0) + 1; gradeCount[e.grade || 'unrated']++; });
      const setAll = (group, keys) => (on) => { keys.forEach((k) => (on ? st[group].add(k) : st[group].delete(k))); filtersChanged(); };
      els.legendBody.appendChild(lgroup(WORDS.typeHead, catKeys.map((k) => chip('cats', k, cat(k).label, keySvg('cat', cat(k)), catCount[k] || 0)), setAll('cats', catKeys)));
      const groups = [];
      relKeys.forEach((k) => { const g = rel(k).group || cap(WORDS.ties); let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, keys: [] }; groups.push(grp); } grp.keys.push(k); });
      groups.forEach((grp) => {
        els.legendBody.appendChild(lgroup(grp.name, grp.keys.map((k) => chip('rels', k, rel(k).label, keySvg('rel', rel(k)), relCount[k] || 0)), setAll('rels', grp.keys)));
      });
      if (memKeys.length) {
        // "6 of 32" says how many of the group's members are on the map; a bare number is the count on the map alone
        const chips = memKeys.map((k) => { const m = vocab.memberships[k], n = memCount[k] || 0; return chip('mems', k, m.label, null, m.total ? n + ' of ' + m.total : n); });
        chips.forEach((b, i) => {
          const m = vocab.memberships[memKeys[i]], n = memCount[memKeys[i]] || 0;
          if (m.full) b.title = m.full + (m.total ? '. ' + n + ' of its ' + m.total + ' members are on this map.' : '');
        });
        const g = lgroup(WORDS.membersHead, chips, null);
        const head = g.querySelector('.lgroup-head');
        head.appendChild(h('button', { type: 'button', text: 'Clear', 'aria-label': 'Clear the highlighted groups', onclick: () => { st.mems.clear(); filtersChanged(); } }));
        els.legendBody.appendChild(g);
      }
      const gradeList = Model.GRADES.filter((g) => g === 'documented' || g === 'reported' || gradeCount[g] > 0);
      els.legendBody.appendChild(lgroup('Evidence', gradeList.map((g) => chip('grades', g, GRADE_LABEL[g], null, gradeCount[g])), setAll('grades', Model.GRADES),
        gradeList.filter((g) => g === 'documented' || g === 'reported').map((g) => GRADE_LABEL[g] + ': ' + GRADE_TEXT[g].split(/\.\s/)[0].replace(/\.$/, '') + '.').join(' ')));
      const kindRows = [];
      relKeys.forEach((k) => {
        const r = rel(k);
        if (!r.kindMarks) return;
        Object.keys(r.kindMarks).forEach((kind) => kindRows.push({ r, kind, shape: r.kindMarks[kind] }));
      });
      if (kindRows.length) {
        els.legendBody.appendChild(h('div', { class: 'lgroup gr-kindkey' }, [
          h('div', { class: 'lgroup-head' }, [h('span', { text: 'Kind of ' + WORDS.tie + ' (the mark in the middle of the line)' })]),
          h('ul', { class: 'gr-kindlist' }, kindRows.map((x) => h('li', { class: 'gr-kindrow' }, [keySvg('kind', x.r, x.shape), x.r.label + ': ' + x.kind + (x.shape === 'none' ? ' (plain line)' : '')]))),
        ]));
      }
      const marks = [];
      if (memKeys.length) marks.push('Pressing a group lights up its members and dims the rest.');
      marks.push('Size: ' + (vocab.size === 'measure' ? vocab.measure.label + ', area follows the value.' : 'the number of ' + WORDS.ties + ', area follows the count.'));
      marks.push('Arrowheads show direction where a ' + WORDS.tie + ' has one. A dashed ring marks your own edits, on an ' + WORDS.entity + ' or in the middle of a ' + WORDS.tie + '. A ? marks an alleged ' + WORDS.tie + '.');
      (opts.keyNotes || []).forEach((t) => marks.push(t));
      els.legendBody.appendChild(h('details', { class: 'gr-keydetails' }, [
        h('summary', { text: 'What the grades and marks mean' }),
        h('div', { class: 'gr-keybody' }, [
          h('dl', { class: 'gr-gradedl' }, gradeList.map((g) => h('div', null, [h('dt', null, [gradeBadge(g)]), h('dd', { class: 'plain', text: GRADE_TEXT[g] })]))),
          h('ul', { class: 'gr-plist' }, marks.map((t) => h('li', { class: 'plain', text: t }))),
        ]),
      ]));
      syncChips();
    }
    function syncChips() {
      ['cats', 'rels', 'grades', 'mems'].forEach((g) => chipRefs[g].forEach((b, k) => setPressed(b, st[g].has(k))));
    }
    function toggleChip(group, id) {
      if (st[group].has(id)) st[group].delete(id); else st[group].add(id);
      filtersChanged();
    }
    function filtersChanged() {
      syncChips();
      computeVisible();
      applyVisibility();
      applyHighlight();
      if (!userMoved) fit();
      renderStatus();
      renderSearchHint();
      clearTimeout(tablesTimer);
      if (st.view === 'table') renderTables();
      refreshDetailHidden();
      emit('filter', filterState());
    }
    function filterState() {
      return { cats: Array.from(st.cats), rels: Array.from(st.rels), grades: Array.from(st.grades), mems: Array.from(st.mems), q: st.q, year: st.year };
    }

    /* ---------- year slider ---------- */
    let span = null;
    function renderYearTool() {
      span = Model.yearSpan(data);
      els.yearTool.hidden = !span;
      if (!span) { st.year = null; return; }
      const thisYear = +today.slice(0, 4);
      const max = Math.max(span.max, thisYear);
      els.yearIn.min = String(span.min);
      els.yearIn.max = String(max);
      els.yearIn.value = String(st.year === null ? max : clamp(st.year, span.min, max));
      syncYearOut();
    }
    function syncYearOut() {
      const txt = st.year === null ? 'All years' : 'As of ' + st.year;
      els.yearOut.textContent = txt;
      els.yearIn.setAttribute('aria-valuetext', txt);
      els.yearAll.disabled = st.year === null;
    }
    function setYear(y) {
      st.year = y;
      if (span) els.yearIn.value = String(y === null ? els.yearIn.max : y);
      syncYearOut();
      filtersChanged();
    }

    /* ---------- status line ---------- */
    function renderStatus() {
      const nv = vis.nodes.size, ev = vis.edges.size;
      let t = (statusFlash ? statusFlash + ' ' : '') + 'Showing ' + nv + ' of ' + data.nodes.length + ' ' + WORDS.entities + ' and ' + ev + ' of ' + data.edges.length + ' ' + WORDS.ties + '.';
      if (st.year !== null) t += ' As of ' + st.year + '.';
      t += edited ? ' Your edits are saved in this browser.' : ' Built-in data, reviewed ' + Model.formatDate(raw.asOf) + '.';
      els.status.textContent = t;
      els.undoBtn.disabled = !undoStack.length;
    }
    function flash(text, withUndo) {
      statusFlash = text;
      renderStatus();
      statusFlash = '';
      say(text + (withUndo ? ' Undo is available.' : ''));
    }

    /* ---------- detail panel ---------- */
    function gradeBadge(g) {
      return h('span', { class: 'badge gr-grade gr-grade-' + (g || 'unrated'), title: GRADE_TEXT[g || 'unrated'], text: GRADE_LABEL[g || 'unrated'] });
    }
    function badgesFor(kind, rec) {
      const out = [];
      if (kind === 'node') {
        const c = cat(rec.cat);
        out.push(h('span', { class: 'badge gr-catbadge' }, [keySvg('cat', c), c.label]));
        if (rec.kind && vocab.kinds) out.push(h('span', { class: 'badge', text: vocab.kinds[rec.kind].label }));
        if (rec.region) out.push(h('span', { class: 'badge', text: rec.region }));
        if (typeof rec.publicMembership === 'boolean') out.push(h('span', { class: 'badge', text: rec.publicMembership ? 'Membership list public' : 'Membership list not public' }));
      } else {
        const r = rel(rec.type);
        out.push(h('span', { class: 'badge gr-catbadge' }, [keySvg('rel', r), r.label]));
        if (rec.kind) out.push(h('span', { class: 'badge', text: rec.kind }));
      }
      if (rec.grade || kind === 'edge') out.push(gradeBadge(rec.grade));
      if (isYours(kind, rec)) out.push(h('span', { class: 'badge gr-yoursbadge', text: unsourced(rec) ? 'Your edit, unsourced' : 'Your edit' }));
      if (Model.overdue(rec, today)) out.push(h('span', { class: 'badge gr-overdue', text: 'Review date passed (' + Model.formatDate(rec.reviewBy) + ')' }));
      return h('div', { class: 'gr-badges' }, out);
    }
    // registry: the sources to look ids up in; the working data by default, the built-in set for the static panels
    function sourceItems(refs, compact, registry) {
      const reg = registry || data.sources;
      return (refs || []).map((r) => {
        const s = reg[r.id];
        if (!s) return null;
        const meta = [s.publisher, s.date ? Model.formatDate(s.date) : null].filter(Boolean).join(', ');
        const title = compact ? trunc(s.title, 56) : s.title;
        const a = link(title, s.url, 'gr-srclink', s.title);
        if (compact) return h('span', { class: 'gr-srcitem' }, [a]);
        return h('li', { class: 'gr-srcitem' }, [a, meta ? h('span', { class: 'gr-srcmeta', text: ' ' + meta }) : null, ' ', h('span', { class: 'badge', text: s.kind }), r.loc ? h('span', { class: 'gr-srcmeta', text: ' (' + r.loc + ')' }) : null]);
      }).filter(Boolean);
    }
    function joinWith(items, sep) {
      const out = [];
      items.forEach((it, i) => { if (i) out.push(sep); out.push(it); });
      return out;
    }
    function sourceBlock(rec) {
      const items = sourceItems(rec.refs, false);
      if (!items.length) return h('p', { class: 'empty gr-nosrc', text: 'No source recorded.' });
      return h('div', null, [h('h3', { class: 'gr-h3', text: 'Sources' }), h('ul', { class: 'gr-sources' }, items)]);
    }
    // the date span for a one-line summary, or '' when the state text already carries the same years
    function spanText(e) {
      const span = Model.formatSpan(e);
      if (!span) return '';
      if (e.state) {
        const years = [e.from, e.to].filter(Boolean).map((d) => /^\d+/.exec(d)[0]);
        if (years.length && years.every((y) => e.state.indexOf(y) >= 0)) return '';
      }
      return span;
    }
    function datesBlock(rec) {
      const lines = [];
      const span = Model.formatSpan(rec);
      if (span) lines.push(cap(span));
      if (rec.asOf) lines.push('As of ' + Model.formatDate(rec.asOf));
      if (rec.reviewBy) lines.push('Review by ' + Model.formatDate(rec.reviewBy));
      return lines.length ? h('p', { class: 'gr-dates plain', text: lines.join('. ') + '.' }) : null;
    }

    function tieRow(e, fromId, otherId) {
      const other = idx.nodeById.get(otherId);
      const shown = vis.edges.has(e.id);
      const meta = [];
      if (e.kind) meta.push(e.kind);
      if (e.state) meta.push(e.state);
      const span = spanText(e);
      if (span) meta.push(cap(span));
      const kids = [
        h('div', { class: 'gr-tierow' }, [
          h('button', { class: 'gr-tiebtn', type: 'button', 'aria-label': sentence(relPhrase(e, fromId) + ' ' + other.name) + ' Go to ' + other.name, onclick: () => select('node', otherId, { reveal: false }) }, [
            h('span', { class: 'gr-phrase', text: relPhrase(e, fromId) + ' ' }), h('b', { text: other.name }),
          ]),
          h('button', { class: 'btn gr-tiedetail', type: 'button', text: 'Details', 'aria-label': 'Details of ' + edgeTitle(e), onclick: () => select('edge', e.id, { reveal: false }) }),
        ]),
        h('div', { class: 'gr-tiemeta' }, [
          gradeBadge(e.grade),
          meta.length ? h('span', { text: meta.map(sentence).join(' ') }) : null,
          isYours('edge', e) ? h('span', { class: 'badge gr-yoursbadge', text: unsourced(e) ? 'Your edit, unsourced' : 'Your edit' }) : null,
          !shown ? h('span', { class: 'badge', text: 'Hidden by filters' }) : null,
          sourceItems(e.refs, true).length ? h('span', { class: 'gr-tiesrc' }, [h('b', { text: 'Sources: ' })].concat(joinWith(sourceItems(e.refs, true), '; '))) : null,
        ]),
      ];
      return h('li', { class: 'gr-tie' }, kids);
    }
    function tieSection(title, list, fromId) {
      if (!list.length) return null;
      const byType = new Map();
      relKeys.forEach((k) => byType.set(k, []));
      list.forEach((x) => byType.get(x.e.type).push(x));
      const groups = [];
      byType.forEach((arr, k) => {
        if (!arr.length) return;
        arr.sort((a, b) => a.other.name.localeCompare(b.other.name));
        groups.push(h('div', { class: 'gr-tiegroup' }, [
          h('h4', { class: 'gr-h4' }, [keySvg('rel', rel(k)), rel(k).label]),
          h('ul', { class: 'gr-ties' }, arr.map((x) => tieRow(x.e, fromId, x.other.id))),
        ]));
      });
      return h('section', { class: 'gr-tiesec' }, [h('h3', { class: 'gr-h3' }, [title, h('span', { class: 'gr-count num', text: ' (' + list.length + ')' })])].concat(groups));
    }

    function renderDetail() {
      clear(els.detail);
      const sel = st.sel;
      if (!sel) {
        const counts = Model.gradeCounts(data.edges);
        els.detail.appendChild(h('h2', { class: 'card-title gr-dhead', text: 'Details' }));
        els.detail.appendChild(h('p', { class: 'plain', text: 'Select ' + article(WORDS.entity) + WORDS.entity + ' or ' + article(WORDS.tie) + WORDS.tie + ' to see its dates, evidence grade and sources.' }));
        els.detail.appendChild(h('p', { class: 'plain gr-evsum', text: 'Evidence across all ' + WORDS.ties + ': ' + counts.documented + ' documented, ' + counts.reported + ' reported' + (counts.alleged ? ', ' + counts.alleged + ' alleged' : '') + (counts.unrated ? ', ' + counts.unrated + ' unrated' : '') + '.' }));
        return;
      }
      if (sel.kind === 'node') renderNodeDetail(idx.nodeById.get(sel.id));
      else renderEdgeDetail(idx.edgeById.get(sel.id));
      if (!els.detail.querySelector('.gr-hiddennote') && selectionHidden()) putHiddenNote();
    }
    function putHiddenNote() {
      const t = els.detail.querySelector('.gr-dtitle');
      els.detail.insertBefore(hiddenNote(), t ? t.nextSibling : null);
    }
    function hiddenNote() {
      return h('p', { class: 'notice notice--info gr-hiddennote' }, ['This is hidden by the current filters. ', h('button', { class: 'btn', type: 'button', text: 'Show everything', onclick: showEverything })]);
    }
    function refreshDetailHidden() {
      const old = els.detail.querySelector('.gr-hiddennote');
      if (old) old.remove();
      if (selectionHidden()) putHiddenNote();
    }
    // the selected entity or tie is not drawn because of the filters or the year
    function selectionHidden() {
      if (!st.sel) return false;
      return st.sel.kind === 'node' ? !vis.nodes.has(st.sel.id) : !vis.edges.has(st.sel.id);
    }

    function editButtons(kind, rec) {
      if (!st.edit) return null;
      return h('div', { class: 'gr-editbtns' }, [
        h('button', { class: 'btn', type: 'button', text: 'Edit', onclick: (ev) => (kind === 'node' ? openNodeForm(rec, ev.currentTarget) : openEdgeForm(rec, null, ev.currentTarget)) }),
        h('button', { class: 'btn btn-danger', type: 'button', text: 'Delete', onclick: (ev) => confirmDelete(kind, rec, ev.currentTarget) }),
      ]);
    }
    function renderNodeDetail(n) {
      const list = idx.edgesOf.get(n.id) || [];
      const outs = [], ins = [], muts = [];
      list.forEach((e) => {
        const otherId = e.source === n.id ? e.target : e.source;
        const x = { e, other: idx.nodeById.get(otherId) };
        if (!isDirected(e)) muts.push(x);
        else if (e.source === n.id) outs.push(x);
        else ins.push(x);
      });
      const kids = [
        backButton(),
        h('h2', { class: 'gr-dtitle', tabindex: '-1', text: n.name }),
        badgesFor('node', n),
        datesBlock(n),
        n.measure ? h('p', { class: 'plain gr-measure', text: measureText(n) + '.' }) : null,
        n.memberships && n.memberships.length ? h('p', { class: 'plain gr-members' }, [h('b', { text: 'Memberships: ' }), n.memberships.map((m) => vocab.memberships[m].label).join(', ') + '.']) : null,
        n.notes ? h('p', { class: 'plain gr-notes', text: n.notes }) : null,
        sourceBlock(n),
        tieSection(WORDS.out, outs, n.id),
        tieSection(WORDS.in, ins, n.id),
        tieSection(WORDS.mutual, muts, n.id),
        !list.length ? h('p', { class: 'empty', text: 'No ' + WORDS.ties + ' recorded for this ' + WORDS.entity + '.' }) : null,
        editButtons('node', n),
        h('div', { class: 'gr-dactions' }, [h('button', { class: 'btn', type: 'button', text: 'Clear selection', onclick: clearSelection })]),
      ];
      kids.forEach((k) => { if (k) els.detail.appendChild(k); });
    }
    function renderEdgeDetail(e) {
      const a = idx.nodeById.get(e.source), b = idx.nodeById.get(e.target);
      const r = rel(e.type);
      const kids = [
        backButton(),
        h('h2', { class: 'gr-dtitle', tabindex: '-1', text: edgeTitle(e) }),
        badgesFor('edge', e),
        e.state ? h('p', { class: 'plain gr-state' }, [h('b', { text: 'State: ' }), e.state]) : null,
        datesBlock(e),
        e.desc ? h('p', { class: 'plain', text: e.desc }) : null,
        h('p', { class: 'plain gr-dir', text: isDirected(e) ? sentence('Direction: from ' + a.name + ' to ' + b.name) : 'Mutual: no direction.' }),
        h('p', { class: 'plain gr-gradetext', text: GRADE_LABEL[e.grade || 'unrated'] + ': ' + GRADE_TEXT[e.grade || 'unrated'] }),
        sourceBlock(e),
        h('div', { class: 'gr-dactions' }, [
          h('button', { class: 'btn', type: 'button', text: 'Go to ' + a.name, onclick: () => select('node', a.id, { reveal: false }) }),
          h('button', { class: 'btn', type: 'button', text: 'Go to ' + b.name, onclick: () => select('node', b.id, { reveal: false }) }),
          h('button', { class: 'btn', type: 'button', text: 'Clear selection', onclick: clearSelection }),
        ]),
        editButtons('edge', e),
      ];
      kids.forEach((k) => { if (k) els.detail.appendChild(k); });
    }
    // Escape in the details clears the selection and hands focus back to the graph (or the table) in one press.
    // quietFocus keeps the returning focus from raising the node tip again, which would cost a second press.
    let quietFocus = false;
    els.detail.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      ev.preventDefault();
      if (st.view === 'table') els.nodesTableHost.focus();
      else { quietFocus = true; els.stage.focus(); quietFocus = false; }
      if (st.sel) { clearSelection(); say('Selection cleared.'); }
    });

    /* ---------- table twin ---------- */
    function rowButton(text, onClick, label) {
      return { node: h('button', { class: 'gr-rowbtn', type: 'button', text, 'aria-label': label, onclick: onClick }) };
    }
    function srcCell(refs) {
      const items = sourceItems(refs, true);
      if (!items.length) return null;
      return { node: h('span', null, joinWith(items, '; ')) };
    }
    // Find marks matches (dimming the rest in the graph) and never hides anything, so every view counts the same rows as shown.
    // The Find text is reported in the table captions and the Find hint, not as a filter, so the status line stays true.
    function findText() { return 'Find "' + trunc(st.q.trim(), 30) + '"'; }
    function tableFilterNote() {
      const bits = [];
      if (st.year !== null) bits.push('as of ' + st.year);
      if (st.cats.size < catKeys.length) bits.push(plural(catKeys.length - st.cats.size, 'type', 'types') + ' hidden');
      if (st.rels.size < relKeys.length) bits.push(plural(relKeys.length - st.rels.size, 'relation layer', 'relation layers') + ' hidden');
      if (st.grades.size < Model.GRADES.length) bits.push('evidence filter on');
      return bits.length ? ' Filters: ' + bits.join(', ') + '.' : ' No filters.';
    }
    function renderTables() {
      const q = !!matches;
      // rows that match Find come first and carry a Find match cell; the rest keep their order
      const front = (arr, isMatch) => (q ? arr.filter(isMatch).concat(arr.filter((x) => !isMatch(x))) : arr);
      const nodeMatch = (n) => matches.has(n.id);
      const edgeMatch = (e) => matches.has(e.source) || matches.has(e.target);
      const nrows = front(data.nodes.filter((n) => vis.nodes.has(n.id)), nodeMatch);
      const hasFlag = catKeys.some((k) => cat(k).publicFlag);
      const ncols = [{ label: 'Name' }, { label: 'Id' }, { label: 'Short name' }, { label: 'Type' }];
      if (vocab.kinds) ncols.push({ label: 'Kind' });
      if (vocab.entities) ncols.push({ label: 'Colour as' });
      ncols.push({ label: 'Region' });
      if (memKeys.length) ncols.push({ label: 'Memberships', wrap: true });
      if (vocab.measure) ncols.push({ label: vocab.measure.label, wrap: true });
      if (hasFlag) ncols.push({ label: 'Membership list public' });
      ncols.push({ label: 'Starts' }, { label: 'Ends' }, { label: cap(WORDS.ties) + ' shown' }, { label: 'Evidence' }, { label: 'As of' }, { label: 'Review by' }, { label: 'Your edit' }, { label: 'Notes', wrap: true }, { label: 'Sources', wrap: true });
      if (q) ncols.splice(1, 0, { label: 'Find match' });
      const nodeNote = q ? ' ' + findText() + (matches.size ? ' matches ' + plural(matches.size, WORDS.entity, WORDS.entities) + ', listed first.' : ' matches no ' + WORDS.entities + '.') : '';
      UI.table(els.nodesTableHost, cap(WORDS.entities) + ': ' + nrows.length + ' of ' + data.nodes.length + ' shown.' + tableFilterNote() + nodeNote, ncols, nrows.map((n) => {
        const k = (idx.edgesOf.get(n.id) || []).filter((e) => vis.edges.has(e.id)).length;
        const row = [rowButton(n.name, () => select('node', n.id, { reveal: true, focusDetail: true }), 'Select ' + n.name), n.id, n.label || null, cat(n.cat).label];
        if (vocab.kinds) row.push(n.kind ? vocab.kinds[n.kind].label : null);
        if (vocab.entities) row.push(n.entity ? vocab.entities[n.entity].label : null);
        row.push(n.region || null);
        if (memKeys.length) row.push((n.memberships || []).map((m) => vocab.memberships[m].label).join(', ') || null);
        if (vocab.measure) row.push(n.measure ? Model.formatValue(n.measure.value, vocab.measure.format) + ' (' + Model.formatDate(n.measure.year) + ')' + (n.measure.note ? '. ' + n.measure.note : '') : null);
        if (hasFlag) row.push(typeof n.publicMembership === 'boolean' ? (n.publicMembership ? 'Yes' : 'No') : null);
        row.push(n.from ? Model.formatDate(n.from) + (n.approx ? ' (approx.)' : '') : null, n.to ? Model.formatDate(n.to) + (n.approx ? ' (approx.)' : '') : null, k, n.grade ? GRADE_LABEL[n.grade] : null,
          n.asOf ? Model.formatDate(n.asOf) : null, n.reviewBy ? Model.formatDate(n.reviewBy) + (Model.overdue(n, today) ? ' (passed)' : '') : null,
          yoursNodes.has(n.id) ? (unsourced(n) ? 'Yes, unsourced' : 'Yes') : 'No', n.notes || null, srcCell(n.refs));
        if (q) row.splice(1, 0, nodeMatch(n) ? 'Yes' : 'No');
        return row;
      }));
      const erows = front(data.edges.filter((e) => vis.edges.has(e.id)), edgeMatch);
      const ecols = [{ label: 'From' }, { label: 'Tie' }, { label: 'To' }, { label: 'Layer' }, { label: 'Kind' }, { label: 'State', wrap: true }, { label: 'Direction' }, { label: 'Starts' }, { label: 'Ends' }, { label: 'As of' }, { label: 'Review by' }, { label: 'Evidence' }, { label: 'Your edit' }, { label: 'Description', wrap: true }, { label: 'Sources', wrap: true }, { label: 'Id' }];
      if (q) ecols.splice(1, 0, { label: 'Involves a Find match' });
      const edgeNote = q ? ' ' + (matches.size ? plural(erows.filter(edgeMatch).length, WORDS.tie + ' involves', WORDS.ties + ' involve') + ' ' + article(WORDS.entity) + WORDS.entity + ' that matches ' + findText() + ', listed first.' : findText() + ' matches no ' + WORDS.entities + '.') : '';
      UI.table(els.edgesTableHost, cap(WORDS.ties) + ': ' + erows.length + ' of ' + data.edges.length + ' shown.' + tableFilterNote() + edgeNote, ecols, erows.map((e) => {
        const a = idx.nodeById.get(e.source), b = idx.nodeById.get(e.target);
        const row = [
          rowButton(a.name, () => select('node', a.id, { reveal: true, focusDetail: true }), 'Select ' + a.name),
          { node: h('button', { class: 'gr-rowbtn', type: 'button', text: relPhrase(e, e.source), 'aria-label': 'Select the tie: ' + edgeTitle(e), onclick: () => select('edge', e.id, { reveal: true, focusDetail: true }) }) },
          { node: h('button', { class: 'gr-rowbtn', type: 'button', text: b.name, 'aria-label': 'Select ' + b.name, onclick: () => select('node', b.id, { reveal: true, focusDetail: true }) }) },
          rel(e.type).label, e.kind || null, e.state || null, isDirected(e) ? 'From first to second' : 'Mutual',
          e.from ? Model.formatDate(e.from) + (e.approx ? ' (approx.)' : '') : null, e.to ? Model.formatDate(e.to) + (e.approx ? ' (approx.)' : '') : null,
          e.asOf ? Model.formatDate(e.asOf) : null, e.reviewBy ? Model.formatDate(e.reviewBy) + (Model.overdue(e, today) ? ' (passed)' : '') : null,
          GRADE_LABEL[e.grade || 'unrated'], yoursEdges.has(e.id) ? (unsourced(e) ? 'Yes, unsourced' : 'Yes') : 'No', e.desc || null, srcCell(e.refs), e.id,
        ];
        if (q) row.splice(1, 0, edgeMatch(e) ? 'Yes' : 'No');
        return row;
      }));
    }

    function setView(v) {
      if (v === 'graph' && !d3) v = 'table';
      st.view = v;
      els.stageWrap.hidden = v !== 'graph';
      els.hint.hidden = v !== 'graph';
      els.tables.hidden = v !== 'table';
      els.viewBtn.textContent = v === 'table' ? 'Show as graph' : 'Show as table';
      els.fitBtn.hidden = v !== 'graph';
      els.viewBtn.disabled = !d3 && v === 'table';
      els.detail.querySelectorAll('.gr-back').forEach((b) => { b.textContent = backLabel(); });
      tip.hide();
      if (v === 'table') renderTables();
      else if (d3) {
        size = stageSize();
        if (!userMoved) fit();
        placeLabels();
      }
    }

    /* ---------- static panels ---------- */
    function renderPanels() {
      clear(els.panels);
      panels.forEach((p) => {
        const kids = [h('summary', { class: 'gr-psummary' }, [h('h2', { class: 'gr-ptitle', text: p.title })])];
        const body = [];
        if (p.intro) body.push(h('p', { class: 'plain', text: p.intro }));
        (p.paras || []).forEach((t) => body.push(h('p', { class: 'plain', text: t })));
        if (p.list && p.list.length) body.push(h('ul', { class: 'gr-plist' }, p.list.map((t) => h('li', { class: 'plain', text: t }))));
        if (p.grades) {
          body.push(h('h3', { class: 'gr-h3', text: 'Evidence grades' }));
          body.push(h('dl', { class: 'gr-gradedl' }, Model.GRADES.filter((g) => g === 'documented' || g === 'reported').map((g) => h('div', null, [h('dt', null, [gradeBadge(g)]), h('dd', { class: 'plain', text: GRADE_TEXT[g] })]))));
        }
        if (p.items && p.items.length) {
          body.push(h('ol', { class: 'gr-claims' }, p.items.map((it) => h('li', { class: 'gr-claim-item' }, [
            h('h3', { class: 'gr-claimhead', text: it.head }),
            it.verdict ? h('span', { class: 'badge gr-verdict', text: it.verdict }) : null,
            h('p', { class: 'plain', text: it.text }),
            it.refs && it.refs.length ? h('p', { class: 'gr-claimsrc' }, [h('b', { text: 'Sources: ' })].concat(joinWith(sourceItems(it.refs, true, BASE.sources), '; '))) : null,
          ]))));
        }
        kids.push(h('div', { class: 'gr-pbody' }, body));
        els.panels.appendChild(h('details', { class: 'card gr-panel', open: !!p.open, id: 'gr-panel-' + p.id }, kids));
      });
    }

    /* ---------- editing: forms ---------- */
    function mkField(label, control, o) {
      o = o || {};
      if (!control.id) control.id = UI.uid('gr-f');
      const hintEl = o.hint ? h('p', { class: 'field-hint', id: control.id + '-hint', text: o.hint }) : null;
      const err = h('p', { class: 'field-error', id: control.id + '-err', hidden: true });
      const wrap = h('div', { class: 'field' + (o.cls ? ' ' + o.cls : '') }, [h('label', { class: 'field-label', for: control.id }, [label + (o.req ? ' (required)' : '')]), control, hintEl, err]);
      wrap._ctl = control; wrap._err = err; wrap._hint = hintEl; wrap._label = label;
      return wrap;
    }
    function setErr(wrap, msg) {
      const c = wrap._ctl;
      if (msg) {
        wrap._err.textContent = 'Error: ' + msg;
        wrap._err.hidden = false;
        c.setAttribute('aria-invalid', 'true');
        c.setAttribute('aria-describedby', (wrap._hint ? wrap._hint.id + ' ' : '') + wrap._err.id);
      } else {
        wrap._err.hidden = true;
        c.removeAttribute('aria-invalid');
        if (wrap._hint) c.setAttribute('aria-describedby', wrap._hint.id); else c.removeAttribute('aria-describedby');
      }
    }
    const inp = (o) => h('input', Object.assign({ class: 'input', type: 'text', autocomplete: 'off' }, o));
    function sel(optionsList, value, o) {
      const s = h('select', Object.assign({ class: 'input' }, o || {}));
      optionsList.forEach((x) => s.appendChild(h('option', { value: x.value, text: x.text })));
      s.value = value;
      return s;
    }
    function checkRow(label, checked, o) {
      const id = UI.uid('gr-c');
      const c = h('input', Object.assign({ type: 'checkbox', id, checked: !!checked }, o || {}));
      return { c, el: h('div', { class: 'gr-check' }, [c, h('label', { for: id, text: label })]) };
    }
    const DATE_HINT = 'A year, a month or a day: 1913, 1913-12 or 1913-12-23.';
    // everything typed in a form, as one string, to tell later whether anything changed
    const formState = (form, srcs) => Array.from(form.elements).map((c) => (c.type === 'checkbox' ? (c.checked ? '1' : '0') : c.value)).join('|') + '#' + JSON.stringify(srcs.refs());

    // onChange runs after the person adds or removes a source, so a grade error that was about the sources can be cleared
    function sourcesField(initial, onChange) {
      const changed = () => { if (onChange) onChange(); };
      const refs = (initial || []).map((r) => ({ id: r.id, loc: r.loc || '' }));
      const added = Object.create(null);
      const registry = () => Object.assign(Object.create(null), data.sources, added);
      const listEl = h('ul', { class: 'gr-srcedit' });
      const pick = h('select', { class: 'input', 'aria-label': 'Choose a source already in the data' });
      function renderList() {
        clear(listEl);
        if (!refs.length) listEl.appendChild(h('li', { class: 'field-hint', text: 'No sources yet. Without one, the record is marked as your edit, unsourced.' }));
        const reg = registry();
        refs.forEach((r, i) => {
          const s = reg[r.id];
          const title = s ? s.title : r.id;
          const loc = inp({ value: r.loc, maxlength: '120', placeholder: 'Where in the source (optional)', 'aria-label': 'Where in ' + trunc(title, 50) });
          loc.addEventListener('input', () => { r.loc = loc.value; });
          listEl.appendChild(h('li', { class: 'gr-srcrow' }, [
            h('span', { class: 'gr-srctitle', text: trunc(title, 90) }), loc,
            h('button', { class: 'btn', type: 'button', text: 'Remove', 'aria-label': 'Remove source ' + trunc(title, 50), onclick: () => { refs.splice(i, 1); renderList(); changed(); } }),
          ]));
        });
      }
      function renderPick() {
        clear(pick);
        pick.appendChild(h('option', { value: '', text: 'Choose a source already in the data' }));
        const reg = registry();
        Object.keys(reg).sort((a, b) => reg[a].title.localeCompare(reg[b].title)).forEach((id) => pick.appendChild(h('option', { value: id, text: trunc(reg[id].title, 90) })));
      }
      const addExisting = h('button', { class: 'btn', type: 'button', text: 'Add this source', onclick: () => {
        if (!pick.value || refs.some((r) => r.id === pick.value) || refs.length >= Model.LIMITS.refs) return;
        refs.push({ id: pick.value, loc: '' });
        pick.value = '';
        renderList();
        changed();
      } });
      const nTitle = inp({ maxlength: '300' }), nKind = sel(Model.SOURCE_KINDS.map((k) => ({ value: k, text: cap(k) })), 'secondary'), nUrl = inp({ type: 'url', placeholder: 'https://', maxlength: '500', inputmode: 'url' }), nPub = inp({ maxlength: '200' }), nDate = inp({ maxlength: '10', placeholder: 'YYYY-MM-DD' });
      const nErr = h('p', { class: 'field-error', hidden: true, role: 'alert' });
      const nTitleF = mkField('Title', nTitle, { req: true }), nKindF = mkField('Kind', nKind, { hint: 'Primary: official record or filing. Secondary: press, book or study. Dataset: audited statistic. Claim: a party\'s own assertion.' });
      const nUrlF = mkField('Web address', nUrl), nPubF = mkField('Publisher', nPub), nDateF = mkField('Date', nDate);
      const addNew = h('button', { class: 'btn', type: 'button', text: 'Add new source', onclick: () => {
        [nTitleF, nUrlF, nDateF].forEach((f) => setErr(f, ''));
        let bad = false;
        const src = { title: nTitle.value.trim(), kind: nKind.value };
        if (!src.title) { setErr(nTitleF, 'Enter a title'); bad = true; }
        if (nUrl.value.trim()) { if (!Model.safeHref(nUrl.value.trim())) { setErr(nUrlF, 'Use a web address starting with http:// or https://'); bad = true; } else src.url = nUrl.value.trim(); }
        if (nDate.value.trim()) { if (!Model.validDate(nDate.value.trim())) { setErr(nDateF, 'Use YYYY, YYYY-MM or YYYY-MM-DD'); bad = true; } else src.date = nDate.value.trim(); }
        if (nPub.value.trim()) src.publisher = nPub.value.trim();
        if (bad) return;
        if (refs.length >= Model.LIMITS.refs) { nErr.textContent = 'Error: up to ' + Model.LIMITS.refs + ' sources per record.'; nErr.hidden = false; return; }
        nErr.hidden = true;
        const taken = new Set(Object.keys(registry()));
        const id = Model.slug(src.title, taken);
        added[id] = src;
        refs.push({ id, loc: '' });
        [nTitle, nUrl, nPub, nDate].forEach((x) => { x.value = ''; });
        renderPick(); renderList();
        changed();
      } });
      renderList(); renderPick();
      const el = h('fieldset', { class: 'gr-fieldset gr-srcfield' }, [
        h('legend', { class: 'field-label', text: 'Sources' }),
        listEl,
        h('div', { class: 'gr-srcadd' }, [pick, addExisting]),
        h('details', { class: 'gr-newsrc' }, [h('summary', { text: 'Add a new source' }), h('div', { class: 'gr-newsrcbody' }, [nTitleF, nKindF, nUrlF, nPubF, nDateF, nErr, addNew])]),
      ]);
      return {
        el,
        refs: () => refs.map((r) => (r.loc.trim() ? { id: r.id, loc: r.loc.trim() } : { id: r.id })),
        sources: () => { const out = Object.create(null); refs.forEach((r) => { if (added[r.id]) out[r.id] = added[r.id]; }); return out; },
      };
    }

    const GRADE_OPTIONS = Model.GRADES.map((g) => ({ value: g, text: GRADE_LABEL[g] }));
    const GRADE_HINT = 'Documented needs a primary or dataset source; reported needs a source of any kind. Unrated is for your own unreviewed edits: without a source the record is marked "Your edit, unsourced".';

    // opens the form for a node; rec is null for a new one
    function openNodeForm(rec, opener) {
      const isNew = !rec;
      rec = rec || { cat: catKeys[0] };
      const F = {};
      F.name = mkField('Name', inp({ value: rec.name || '', maxlength: '120' }), { req: true });
      F.label = mkField('Short name', inp({ value: rec.label || '', maxlength: '24' }), { hint: 'Up to 24 characters, drawn on the graph.' });
      F.cat = mkField('Type', sel(catKeys.map((k) => ({ value: k, text: cat(k).label })), rec.cat || catKeys[0]), { req: true });
      if (vocab.kinds) F.kind = mkField('Kind', sel([{ value: '', text: '(none)' }].concat(Object.keys(vocab.kinds).map((k) => ({ value: k, text: vocab.kinds[k].label }))), rec.kind || ''));
      if (vocab.entities) F.entity = mkField('Colour as', sel([{ value: '', text: 'Use the type colour' }].concat(Object.keys(vocab.entities).map((k) => ({ value: k, text: vocab.entities[k].label }))), rec.entity || ''), { hint: 'The shared colour of that economy across the site.' });
      const dl = h('datalist', { id: UI.uid('gr-regions') }, Array.from(new Set(data.nodes.map((n) => n.region).filter(Boolean))).sort().map((r) => h('option', { value: r })));
      F.region = mkField('Region', inp({ value: rec.region || '', maxlength: '40', list: dl.id }));
      let memChecks = [], memFs = null;
      if (memKeys.length) {
        memChecks = memKeys.map((k) => ({ k, row: checkRow(vocab.memberships[k].label, (rec.memberships || []).indexOf(k) >= 0) }));
        memFs = h('fieldset', { class: 'gr-fieldset' }, [h('legend', { class: 'field-label', text: 'Memberships' }), h('div', { class: 'gr-checks' }, memChecks.map((m) => m.row.el))]);
      }
      let mValue = null, mYear = null, mNote = null;
      if (vocab.measure) {
        const unit = vocab.measure.format === 'usd-bn' ? 'US dollars, in billions, e.g. 29185' : vocab.measure.format === 'percent' ? 'a percentage, e.g. 12.5' : 'a number';
        F.mValue = mkField(vocab.measure.label, mValue = inp({ value: rec.measure ? String(rec.measure.value) : '', inputmode: 'decimal' }), { hint: 'Enter ' + unit + '.' });
        F.mYear = mkField('Year it describes', mYear = inp({ value: rec.measure ? rec.measure.year : '', maxlength: '10' }), { hint: DATE_HINT });
        F.mNote = mkField('Note on the figure', mNote = inp({ value: rec.measure && rec.measure.note ? rec.measure.note : '', maxlength: '200' }));
      }
      const hasFlag = catKeys.some((k) => cat(k).publicFlag);
      const flagRow = checkRow('The membership list is public', rec.publicMembership === true);
      const flagWrap = hasFlag ? h('div', { class: 'field' }, [flagRow.el]) : null;
      F.from = mkField('Starts', inp({ value: rec.from || '', maxlength: '10', placeholder: 'YYYY' }), { hint: DATE_HINT });
      F.to = mkField('Ends', inp({ value: rec.to || '', maxlength: '10', placeholder: 'YYYY' }), { hint: 'Leave empty if it still exists.' });
      const approx = checkRow('Dates are approximate', rec.approx === true);
      F.notes = mkField('Notes', h('textarea', { class: 'input', maxlength: '1500', rows: '4', value: rec.notes || '' }), { cls: 'gr-wide' });
      F.grade = mkField('Evidence grade', sel(GRADE_OPTIONS, rec.grade || 'unrated'), { hint: GRADE_HINT });
      F.grade._ctl.addEventListener('change', () => setErr(F.grade, ''));
      F.asOf = mkField('As of', inp({ value: rec.asOf || '', maxlength: '10' }), { hint: DATE_HINT });
      F.reviewBy = mkField('Review by', inp({ value: rec.reviewBy || '', maxlength: '10' }), { hint: DATE_HINT });
      const srcs = sourcesField(rec.refs, () => setErr(F.grade, ''));
      const syncFlag = () => { const c = cat(F.cat._ctl.value); if (flagWrap) flagWrap.hidden = !(c && c.publicFlag); };
      F.cat._ctl.addEventListener('change', syncFlag);
      syncFlag();
      const general = h('p', { class: 'field-error', role: 'alert', hidden: true });
      const parts = [general, F.name, F.label, F.cat, F.kind, F.entity, F.region, dl, memFs, F.mValue, F.mYear, F.mNote, flagWrap, F.from, F.to, h('div', { class: 'field' }, [approx.el]), F.notes, F.grade, F.asOf, F.reviewBy, srcs.el];
      const form = h('form', { class: 'gr-form', novalidate: true }, parts.filter(Boolean).concat([h('div', { class: 'dactions' }, [
        h('button', { class: 'btn btn-primary', type: 'submit', text: isNew ? 'Add ' + WORDS.entity : 'Save changes' }),
        h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => UI.closeDialog() }),
      ])]));
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        Object.keys(F).forEach((k) => setErr(F[k], ''));
        general.hidden = true;
        const out = { name: F.name._ctl.value.trim(), cat: F.cat._ctl.value };
        const errs = [];
        if (!out.name) errs.push([F.name, 'Enter a name']);
        const put = (k, v) => { if (v !== '' && v !== undefined) out[k] = v; };
        put('label', F.label._ctl.value.trim());
        if (F.kind) put('kind', F.kind._ctl.value);
        if (F.entity) put('entity', F.entity._ctl.value);
        put('region', F.region._ctl.value.trim());
        if (memChecks.length) { const m = memChecks.filter((x) => x.row.c.checked).map((x) => x.k); if (m.length) out.memberships = m; }
        if (vocab.measure) {
          const txt = mValue.value.trim().replace(/,/g, '');
          if (txt || mYear.value.trim()) {
            const num = Number(txt);
            if (!txt || !isFinite(num) || num < 0) errs.push([F.mValue, 'Enter a number of zero or more']);
            else if (!Model.validDate(mYear.value.trim())) errs.push([F.mYear, 'Enter the year the figure describes (YYYY)']);
            else { out.measure = { value: num, year: mYear.value.trim() }; if (mNote.value.trim()) out.measure.note = mNote.value.trim(); }
          }
        }
        const c = cat(out.cat);
        if (c && c.publicFlag) out.publicMembership = flagRow.c.checked;
        ['from', 'to', 'asOf', 'reviewBy'].forEach((k) => {
          const v = F[k]._ctl.value.trim();
          if (v) { if (!Model.validDate(v)) errs.push([F[k], 'Use YYYY, YYYY-MM or YYYY-MM-DD']); else out[k] = v; }
        });
        if (approx.c.checked) out.approx = true;
        put('notes', F.notes._ctl.value.trim());
        if (F.grade._ctl.value !== 'unrated') out.grade = F.grade._ctl.value;
        const refs = srcs.refs();
        if (refs.length) out.refs = refs;
        if (errs.length) { errs.forEach((x) => setErr(x[0], x[1])); errs[0][0]._ctl.focus(); return; }
        const index = isNew ? data.nodes.length : data.nodes.findIndex((n) => n.id === rec.id);
        const res = Model.applyOp(data, isNew ? { type: 'add-node', node: out, sources: srcs.sources() } : { type: 'update-node', id: rec.id, node: out, sources: srcs.sources() }, ctxModel);
        if (res.errors.length) { showFormErrors(res.errors, 'nodes', index, F, general); return; }
        const fromDetail = !!(opener && els.detail.contains(opener)); // before the save rebuilds the details
        UI.closeDialog();
        const changed = commit(res.data, sentence((isNew ? 'Added ' : 'Saved ') + out.name), { type: isNew ? 'add-node' : 'update-node', ids: [res.info.id] });
        select('node', res.info.id, { reveal: false });
        // the Edit button in the details was rebuilt by the save, so focus would otherwise fall to the page
        if (changed && fromDetail) focusDetailTitle();
      });
      const initial = formState(form, srcs);
      UI.dialog({ title: isNew ? 'Add ' + WORDS.entity : 'Edit ' + rec.name, body: form, wide: true, strict: true, focus: F.name._ctl, opener, isDirty: () => formState(form, srcs) !== initial });
    }

    // the data contract names choices by id, but the form shows their labels, so an error about a choice lists the labels
    function labelledChoices(record, key, text) {
      const m = /^((?:entry \d+ )?must be one of )(.*)$/.exec(text);
      if (!m || !key) return text;
      const sets = record === 'nodes'
        ? { cat: vocab.categories, kind: vocab.kinds, entity: vocab.entities, memberships: vocab.memberships, grade: GRADE_LABEL }
        : { type: vocab.relations, grade: GRADE_LABEL };
      const src = hasOwn(sets, key) ? sets[key] : null;
      if (!src) return text;
      const name = (id) => (hasOwn(src, id) ? (typeof src[id] === 'string' ? src[id] : src[id].label) : id);
      return m[1] + m[2].split(', ').map(name).join(', ');
    }

    function showFormErrors(errors, record, index, F, general) {
      const generalMsgs = [];
      let focused = false;
      const fieldFor = { source: 'from', target: 'to' };
      errors.forEach((m) => {
        const p = Model.parseProblem(m);
        let key = p.field, text = p.text, full = null;
        if (p.record === record) text = labelledChoices(record, key, text);
        if (p.record === record && p.index === index) {
          if (!key && /graded/.test(p.text)) { key = 'grade'; full = 'This grade ' + p.text.replace(/^is graded \w+, which /, '').replace(/ in refs$/, '') + '. Add one under Sources or pick another grade.'; }
          if (!key && /before it starts/.test(p.text) && F.to) { key = 'to'; text = 'must not be before the start date'; }
          if (record === 'nodes' && key === 'measure') key = /year/.test(p.text) ? 'mYear' : 'mValue';
          if (record === 'edges' && fieldFor[key] && F[fieldFor[key] + 'Entity']) key = fieldFor[key] + 'Entity';
          if (key === 'refs') key = null;
          if (key && F[key]) {
            setErr(F[key], full || (F[key]._label + ' ' + text));
            if (!focused) { F[key]._ctl.focus(); focused = true; }
            return;
          }
        }
        generalMsgs.push(text !== p.text && p.field ? cap(p.field) + ' ' + text : p.text);
      });
      if (generalMsgs.length) {
        general.textContent = 'Error: ' + generalMsgs.slice(0, 3).join('; ') + (generalMsgs.length > 3 ? '; and ' + (generalMsgs.length - 3) + ' more' : '') + '.';
        general.hidden = false;
        if (!focused) general.scrollIntoView({ block: 'nearest' });
      }
    }

    function openEdgeForm(rec, preset, opener) {
      const isNew = !rec;
      rec = rec || Object.assign({ type: relKeys[0] }, preset || {});
      const F = {};
      const listId = UI.uid('gr-names');
      const names = h('datalist', { id: listId }, data.nodes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((n) => h('option', { value: n.name })));
      const nameOf = (id) => (id && idx.nodeById.has(id) ? idx.nodeById.get(id).name : '');
      F.fromEntity = mkField('From', inp({ value: nameOf(rec.source), list: listId, maxlength: '120' }), { req: true, hint: 'Type a name and pick from the list. For a directed ' + WORDS.tie + ' this is the actor.' });
      F.toEntity = mkField('To', inp({ value: nameOf(rec.target), list: listId, maxlength: '120' }), { req: true });
      const groups = [];
      relKeys.forEach((k) => { const g = rel(k).group || cap(WORDS.ties); let gr = groups.find((x) => x.name === g); if (!gr) { gr = { name: g, keys: [] }; groups.push(gr); } gr.keys.push(k); });
      const typeSel = h('select', { class: 'input' });
      groups.forEach((gr) => typeSel.appendChild(h('optgroup', { label: gr.name }, gr.keys.map((k) => h('option', { value: k, text: rel(k).label })))));
      typeSel.value = rec.type;
      F.type = mkField('Type', typeSel, { req: true });
      const kdl = h('datalist', { id: UI.uid('gr-kinds') });
      const fillKinds = () => { clear(kdl); Array.from(new Set(data.edges.filter((e) => e.type === typeSel.value && e.kind).map((e) => e.kind))).sort().forEach((k) => kdl.appendChild(h('option', { value: k }))); };
      typeSel.addEventListener('change', fillKinds); fillKinds();
      F.kind = mkField('Kind', inp({ value: rec.kind || '', maxlength: '60', list: kdl.id }), { hint: 'The sub-type, for example "Treaty alliance".' });
      F.state = mkField('State', inp({ value: rec.state || '', maxlength: '120' }), { hint: 'Where it stands now, for example "In force" or "Ceasefire since 2025".' });
      F.directed = mkField('Direction', sel([{ value: '', text: 'Use the default for this type' }, { value: 'yes', text: 'From the first to the second' }, { value: 'no', text: 'Mutual, no direction' }], typeof rec.directed === 'boolean' ? (rec.directed ? 'yes' : 'no') : ''));
      F.from = mkField('Starts', inp({ value: rec.from || '', maxlength: '10', placeholder: 'YYYY' }), { hint: DATE_HINT });
      F.to = mkField('Ends', inp({ value: rec.to || '', maxlength: '10', placeholder: 'YYYY' }), { hint: 'Leave empty if it is still in effect.' });
      const approx = checkRow('Dates are approximate', rec.approx === true);
      F.desc = mkField('Description', h('textarea', { class: 'input', maxlength: '600', rows: '3', value: rec.desc || '' }), { cls: 'gr-wide' });
      F.grade = mkField('Evidence grade', sel(GRADE_OPTIONS, rec.grade || 'unrated'), { hint: GRADE_HINT });
      F.grade._ctl.addEventListener('change', () => setErr(F.grade, ''));
      F.asOf = mkField('As of', inp({ value: rec.asOf || '', maxlength: '10' }), { hint: DATE_HINT });
      F.reviewBy = mkField('Review by', inp({ value: rec.reviewBy || '', maxlength: '10' }), { hint: DATE_HINT });
      const srcs = sourcesField(rec.refs, () => setErr(F.grade, ''));
      const general = h('p', { class: 'field-error', role: 'alert', hidden: true });
      const form = h('form', { class: 'gr-form', novalidate: true }, [general, F.fromEntity, F.toEntity, names, kdl, F.type, F.kind, F.state, F.directed, F.from, F.to, h('div', { class: 'field' }, [approx.el]), F.desc, F.grade, F.asOf, F.reviewBy, srcs.el,
        h('div', { class: 'dactions' }, [
          h('button', { class: 'btn btn-primary', type: 'submit', text: isNew ? 'Add ' + WORDS.tie : 'Save changes' }),
          h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => UI.closeDialog() }),
        ])]);
      function resolve(text) {
        const t = text.trim().toLowerCase();
        const hit = data.nodes.filter((n) => n.name.toLowerCase() === t);
        return hit.length === 1 ? hit[0] : hit.length > 1 ? 'many' : null;
      }
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        Object.keys(F).forEach((k) => setErr(F[k], ''));
        general.hidden = true;
        const errs = [];
        const a = resolve(F.fromEntity._ctl.value), b = resolve(F.toEntity._ctl.value);
        if (a === null) errs.push([F.fromEntity, 'No ' + WORDS.entity + ' is named exactly that. Pick a name from the list']);
        else if (a === 'many') errs.push([F.fromEntity, 'More than one ' + WORDS.entity + ' has that name']);
        if (b === null) errs.push([F.toEntity, 'No ' + WORDS.entity + ' is named exactly that. Pick a name from the list']);
        else if (b === 'many') errs.push([F.toEntity, 'More than one ' + WORDS.entity + ' has that name']);
        if (a && b && a !== 'many' && b !== 'many' && a.id === b.id) errs.push([F.toEntity, 'A ' + WORDS.tie + ' needs two different ' + WORDS.entities]);
        const out = { source: a && a !== 'many' ? a.id : '', target: b && b !== 'many' ? b.id : '', type: typeSel.value };
        const put = (k, v) => { if (v !== '') out[k] = v; };
        put('kind', F.kind._ctl.value.trim()); put('state', F.state._ctl.value.trim());
        if (F.directed._ctl.value) out.directed = F.directed._ctl.value === 'yes';
        ['from', 'to', 'asOf', 'reviewBy'].forEach((k) => {
          const v = F[k]._ctl.value.trim();
          if (v) { if (!Model.validDate(v)) errs.push([F[k], 'Use YYYY, YYYY-MM or YYYY-MM-DD']); else out[k] = v; }
        });
        if (approx.c.checked) out.approx = true;
        put('desc', F.desc._ctl.value.trim());
        if (F.grade._ctl.value !== 'unrated') out.grade = F.grade._ctl.value;
        const refs = srcs.refs();
        if (refs.length) out.refs = refs;
        if (errs.length) { errs.forEach((x) => setErr(x[0], x[1])); errs[0][0]._ctl.focus(); return; }
        const index = isNew ? data.edges.length : data.edges.findIndex((e) => e.id === rec.id);
        const res = Model.applyOp(data, isNew ? { type: 'add-edge', edge: out, sources: srcs.sources() } : { type: 'update-edge', id: rec.id, edge: out, sources: srcs.sources() }, ctxModel);
        if (res.errors.length) { showFormErrors(res.errors, 'edges', index, F, general); return; }
        const fromDetail = !!(opener && els.detail.contains(opener));
        UI.closeDialog();
        const changed = commit(res.data, sentence((isNew ? 'Added the ' + WORDS.tie + ': ' : 'Saved the ' + WORDS.tie + ': ') + a.name + ' and ' + b.name), { type: isNew ? 'add-edge' : 'update-edge', ids: [res.info.id] });
        select('edge', res.info.id, { reveal: false });
        if (changed && fromDetail) focusDetailTitle();
      });
      const initial = formState(form, srcs);
      UI.dialog({ title: isNew ? 'Add ' + WORDS.tie : 'Edit ' + WORDS.tie, body: form, wide: true, strict: true, focus: F.fromEntity._ctl, opener, isDirty: () => formState(form, srcs) !== initial });
    }

    function editSelection() {
      if (!st.sel) return;
      if (st.sel.kind === 'node') openNodeForm(idx.nodeById.get(st.sel.id), els.stage);
      else openEdgeForm(idx.edgeById.get(st.sel.id), null, els.stage);
    }

    function confirmDelete(kind, rec, opener) {
      let text, label;
      if (kind === 'node') {
        const k = (idx.edgesOf.get(rec.id) || []).length;
        label = rec.name;
        text = sentence('This removes ' + rec.name + (k ? ' and also ' + plural(k, WORDS.tie, WORDS.ties) + ' that ' + (k === 1 ? 'touches' : 'touch') + ' it' : '')) + ' You can undo it right after.';
      } else {
        label = edgeTitle(rec);
        text = sentence('This removes the ' + WORDS.tie + ': ' + label) + ' You can undo it right after.';
      }
      UI.confirm({
        title: 'Delete ' + trunc(label, 60) + '?', text, confirmLabel: 'Delete', danger: true, opener,
        onConfirm: () => {
          const res = Model.applyOp(data, kind === 'node' ? { type: 'delete-node', id: rec.id } : { type: 'delete-edge', id: rec.id }, ctxModel);
          if (res.errors.length) { showMsg('Could not delete: ' + res.errors[0]); return; }
          st.sel = null;
          commit(res.data, sentence('Deleted ' + trunc(label, 60) + (res.info.removedEdges ? ' and ' + plural(res.info.removedEdges, WORDS.tie, WORDS.ties) : '')), { type: kind === 'node' ? 'delete-node' : 'delete-edge', ids: [rec.id] });
          // the Delete button was in the rebuilt details; in table view the graph stage is hidden, so focus goes to the table
          (st.view === 'table' ? els.nodesTableHost : els.stage).focus();
        },
      });
    }

    /* ---------- commit, undo, persistence ---------- */
    const contentOf = (d) => canon({ nodes: d.nodes, edges: d.edges, sources: d.sources });
    // returns false, and changes nothing, when the new data is the same as the current data
    function commit(newData, message, change) {
      if (contentOf(newData) === contentOf(data)) { flash('No changes to save.', false); return false; }
      undoStack.push({ data, savedBase });
      if (undoStack.length > 10) undoStack.shift();
      data = newData;
      dismissNotice('other-tab');
      afterDataChange();
      persistSoon();
      flash(message, true);
      emit('change', change || { type: 'replace' });
      return true;
    }
    function afterDataChange() {
      derive();
      if (st.sel && !(st.sel.kind === 'node' ? idx.nodeById.has(st.sel.id) : idx.edgeById.has(st.sel.id))) st.sel = null;
      if (st.active && !idx.nodeById.has(st.active)) st.active = null;
      st.hover = null; st.hoverEdge = null; tip.hide();
      renderLegend();
      renderYearTool();
      computeVisible();
      if (d3) rebuildGraph('keep');
      renderStatus();
      renderDetail();
      if (st.view === 'table') renderTables();
    }
    // an undo brings back the built-in version the data was made from as well, so the "updated data" notice stays true
    function undo() {
      if (!undoStack.length) return false;
      const prev = undoStack.pop();
      data = prev.data;
      savedBase = prev.savedBase;
      afterDataChange();
      noteOlder();
      persistSoon();
      flash('Undid the last change.', false);
      emit('change', { type: 'undo' });
      return true;
    }

    // one cap for what is written and what is read back, so a copy that was saved can always be loaded again
    const SAVE_MAX = Model.LIMITS.fileBytes * 1.5;
    let persistTimer = null;
    let lastSaved = null; // the text this tab last read from or wrote to KEY
    let staleText = null; // a saved copy that could not be used and has not been replaced yet
    function persistSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persistNow, 250); }
    // the next write or removal replaces an unusable saved copy; say so, and keep the download button working
    function parkStale() {
      if (staleText === null) return;
      const text = staleText;
      staleText = null;
      notify('invalid', 'Your earlier saved copy could not be used and has now been replaced by your newer changes. Download it now if you want to keep it.', [
        { label: 'Download the saved copy', keep: true, onClick: () => download(FILE + '-saved-copy.json', text) },
      ]);
    }
    function persistNow() {
      clearTimeout(persistTimer);
      persistTimer = null;
      const same = contentOf(data) === baseCanon;
      if (same) { parkStale(); store.remove(KEY); lastSaved = null; savedBase = BASE_VERSION; dismissNotice('older'); dismissNotice('storage-fail'); return; }
      const payload = JSON.stringify({ v: 1, schema: raw.schema, base: savedBase, savedAt: new Date().toISOString(), data: { nodes: data.nodes, edges: data.edges, sources: data.sources } });
      if (payload.length > SAVE_MAX) { notify('storage-fail', 'Your changes are too large to keep in this browser. They last until you leave this page. Use Export JSON to keep them.'); return; }
      parkStale();
      if (store.set(KEY, payload)) { lastSaved = payload; dismissNotice('storage-fail'); }
      else notify('storage-fail', 'This browser would not save your changes (storage is blocked or full). They last until you leave this page. Use Export JSON to keep them.');
    }

    function readSaved() {
      let text = null;
      try { text = window.localStorage.getItem(KEY); } catch (e) { return null; }
      if (text === null) return null;
      lastSaved = text;
      const bad = (why) => ({ error: why, text });
      if (text.length > SAVE_MAX) return bad('it is too large');
      let obj;
      try { obj = JSON.parse(text); } catch (e) { return bad('it is not valid JSON'); }
      if (!obj || typeof obj !== 'object' || obj.v !== 1 || obj.schema !== raw.schema || typeof obj.base !== 'string' || !obj.data) return bad('it is from a different version of this page');
      const res = Model.validate(obj.data, { vocab, schema: raw.schema, mode: 'import' });
      if (res.errors.length) return bad(res.errors[0]);
      return { data: res.data, base: obj.base };
    }
    function download(name, text) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function exportObject() {
      return { schema: raw.schema, base: savedBase, exportedAt: new Date().toISOString(), nodes: clone(data.nodes), edges: clone(data.edges), sources: clone(data.sources) };
    }
    function exportData() { return exportObject(); }
    function onExport() { download(FILE + '-' + todayStr() + '.json', JSON.stringify(exportObject(), null, 2) + '\n'); flash('Exported ' + data.nodes.length + ' ' + WORDS.entities + ' and ' + data.edges.length + ' ' + WORDS.ties + '.', false); }

    const countsOf = (nodes, edges) => plural(nodes, WORDS.entity, WORDS.entities) + ' and ' + plural(edges, WORDS.tie, WORDS.ties);
    // text: the file; name: shown in messages; o.confirm === false skips the question for an import that removes more than it adds.
    // Returns true when the import was applied, false when it was rejected, and 'pending' when the person is being asked first.
    function importText(text, name, o) {
      o = o || {};
      clearMsg();
      const nm = String(name || 'the file').slice(0, 60);
      if (typeof text !== 'string') { showMsg('Import rejected: ' + nm + ' could not be read. Nothing was changed.'); return false; }
      if (text.length > Model.LIMITS.fileBytes) { showMsg('Import rejected: ' + nm + ' is larger than 2 MB. Nothing was changed.'); return false; }
      let obj;
      try { obj = JSON.parse(text); } catch (e) { showMsg('Import rejected: ' + nm + ' is not valid JSON (' + e.message + '). Nothing was changed.'); return false; }
      const legacy = {};
      obj = Model.fromLegacy(obj, vocab, legacy);
      const res = Model.validate(obj, { vocab, schema: raw.schema, mode: 'import' });
      if (res.errors.length) {
        const more = res.errors.length - 3;
        showMsg('Import rejected: ' + res.errors.slice(0, 3).join('; ') + (more > 0 ? '; and ' + more + ' more' : '') + '. Nothing was changed.');
        els.msg.focus();
        return false;
      }
      const next = { nodes: res.data.nodes, edges: res.data.edges, sources: Object.assign(Object.create(null), res.data.sources) };
      const extra = (legacy.droppedSelfLinks ? ' Dropped ' + plural(legacy.droppedSelfLinks, 'tie from an entity to itself', 'ties from an entity to itself') + '.' : '') +
        (legacy.scores ? ' Left out ' + plural(legacy.scores, 'influence or strength score', 'influence and strength scores') + ', which this page no longer uses.' : '');
      const apply = () => {
        st.sel = null;
        commit(next, 'Imported ' + countsOf(next.nodes.length, next.edges.length) + ' from ' + nm + '.' + extra, { type: 'import' });
      };
      // a file that removes more than it adds (an empty one replaces everything) is checked with the person first
      const diff = Model.compare(data, next);
      if (o.confirm !== false && diff.removedNodes + diff.removedEdges > diff.addedNodes + diff.addedEdges) {
        UI.confirm({
          title: 'Replace your data with this file?',
          text: sentence('The file ' + (name ? nm + ' ' : '') + 'holds ' + countsOf(next.nodes.length, next.edges.length) + '. Importing it replaces your current ' + countsOf(data.nodes.length, data.edges.length) +
            ': it removes ' + countsOf(diff.removedNodes, diff.removedEdges) + ' and adds ' + countsOf(diff.addedNodes, diff.addedEdges)) + extra + ' You can undo it right after.',
          confirmLabel: 'Replace data', danger: true, opener: els.importBtn, onConfirm: apply,
        });
        return 'pending';
      }
      apply();
      return true;
    }
    async function onFile(file) {
      clearMsg();
      if (!file) return;
      if (file.size > Model.LIMITS.fileBytes) { showMsg('Import rejected: ' + file.name.slice(0, 60) + ' is larger than 2 MB. Nothing was changed.'); return; }
      let text;
      try { text = await file.text(); } catch (e) { showMsg('Import rejected: ' + file.name.slice(0, 60) + ' could not be read. Nothing was changed.'); return; }
      importText(text, file.name);
    }
    function resetData(silent) {
      const next = clone(BASE);
      next.sources = Object.assign(Object.create(null), next.sources);
      st.sel = null;
      if (contentOf(next) === contentOf(data)) { flash('Already showing the built-in data.', false); renderDetail(); applyHighlight(); }
      else commit(next, 'Restored the built-in data.', { type: 'reset' });
      clearTimeout(persistTimer);
      persistTimer = null;
      parkStale();
      store.remove(KEY);
      lastSaved = null;
      savedBase = BASE_VERSION;
      dismissNotice('older'); dismissNotice('storage-fail');
      clearMsg();
    }
    function onReset(opener) {
      UI.confirm({
        title: 'Reset to the built-in data?', text: 'This drops all your edits in this browser and restores the built-in ' + WORDS.entities + ' and ' + WORDS.ties + '. You can undo it right after.',
        confirmLabel: 'Reset data', danger: true, opener, onConfirm: () => resetData(),
      });
    }

    function applySaved() {
      const saved = readSaved();
      if (!saved) return;
      if (saved.error) {
        staleText = saved.text;
        notify('invalid', 'Your saved edits could not be used because ' + saved.error + '. The built-in data is shown.', [
          { label: 'Download the saved copy', keep: true, onClick: () => download(FILE + '-saved-copy.json', saved.text) },
          // only the unusable copy goes; if newer edits have been saved over it since, they stay
          { label: 'Discard it', onClick: () => { if (staleText !== null && store.get(KEY) === saved.text) { store.remove(KEY); lastSaved = null; } staleText = null; } },
        ]);
        return;
      }
      data = { nodes: saved.data.nodes, edges: saved.data.edges, sources: Object.assign(Object.create(null), saved.data.sources) };
      savedBase = saved.base;
      noteOlder();
    }
    // the built-in data moved on after the working copy was made from an older version
    function noteOlder() {
      if (savedBase === BASE_VERSION || contentOf(data) === baseCanon) { dismissNotice('older'); return; }
      notify('older', 'The built-in data was updated (version ' + BASE_VERSION + ') after you saved your edits (version ' + savedBase + '). You are still seeing your saved copy.', [
        { label: 'Load the updated data (your edits will be kept as a backup export)', onClick: () => {
          download(FILE + '-backup-' + todayStr() + '.json', JSON.stringify(exportObject(), null, 2) + '\n');
          resetData();
        } },
      ], { info: true });
    }

    /* ---------- wiring ---------- */
    function showEverything() {
      st.cats = new Set(catKeys); st.rels = new Set(relKeys); st.grades = new Set(Model.GRADES); st.mems = new Set(); st.year = null;
      st.q = ''; els.search.value = '';
      if (span) els.yearIn.value = els.yearIn.max;
      syncYearOut();
      onSearchChange();
      filtersChanged();
    }
    // the Find hint follows the matches, so it is refreshed whenever they can have changed: typing and any filter
    function renderSearchHint() {
      const n = matches ? matches.size : 0;
      if (matches) {
        const best = bestMatch();
        els.searchHint.textContent = n ? plural(n, 'match', 'matches') + '. ' + sentence('Enter selects ' + idx.nodeById.get(best).name) : 'No matches.';
      } else els.searchHint.textContent = '';
    }
    // both tables are rebuilt in full, so typing waits for a short pause before redrawing them
    let tablesTimer = null;
    function renderTablesSoon() {
      clearTimeout(tablesTimer);
      tablesTimer = setTimeout(() => { tablesTimer = null; if (st.view === 'table') renderTables(); }, 200);
    }
    function onSearchChange() {
      st.q = els.search.value;
      computeMatches();
      renderSearchHint();
      applyHighlight();
      renderStatus();
      if (st.view === 'table') renderTablesSoon();
    }
    function resetView() {
      showEverything();
      st.sel = null; st.active = null;
      renderDetail();
      if (d3) { userMoved = false; rebuildGraph('fresh'); }
      flash('View reset.', false);
    }
    function setEdit(on) {
      st.edit = !!on;
      setPressed(els.editBtn, st.edit);
      els.editRow.hidden = !st.edit;
      root.classList.toggle('is-editing', st.edit);
      store.set(UIKEY, JSON.stringify({ edit: st.edit }));
      renderDetail();
    }

    els.search.addEventListener('input', onSearchChange);
    els.search.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const best = bestMatch();
        if (best) { select('node', best, { reveal: true }); }
      } else if (ev.key === 'Escape' && els.search.value) { ev.preventDefault(); els.search.value = ''; onSearchChange(); }
    });
    els.yearIn.addEventListener('input', () => setYear(+els.yearIn.value));
    els.yearAll.addEventListener('click', () => setYear(null));
    els.viewBtn.addEventListener('click', () => setView(st.view === 'graph' ? 'table' : 'graph'));
    els.fitBtn.addEventListener('click', () => fit());
    els.zoomFit.addEventListener('click', () => fit());
    els.zoomIn.addEventListener('click', () => zoomBy(1.4));
    els.zoomOut.addEventListener('click', () => zoomBy(1 / 1.4));
    els.resetViewBtn.addEventListener('click', resetView);
    els.exportBtn.addEventListener('click', onExport);
    els.editBtn.addEventListener('click', () => setEdit(!st.edit));
    els.addNodeBtn.addEventListener('click', (ev) => openNodeForm(null, ev.currentTarget));
    els.addEdgeBtn.addEventListener('click', (ev) => openEdgeForm(null, st.sel && st.sel.kind === 'node' ? { source: st.sel.id } : null, ev.currentTarget));
    els.undoBtn.addEventListener('click', undo);
    els.importBtn.addEventListener('click', () => els.file.click());
    els.file.addEventListener('change', () => { const f = els.file.files && els.file.files[0]; els.file.value = ''; onFile(f); });
    els.resetBtn.addEventListener('click', (ev) => onReset(ev.currentTarget));
    els.emptyBtn.addEventListener('click', showEverything);
    els.stage.addEventListener('keydown', onStageKey);
    els.stage.addEventListener('focus', () => {
      // a click focuses the stage too, but the ring and the announcement are for keyboard use
      st.stageFocus = els.stage.matches(':focus-visible');
      if (!st.active || !vis.nodes.has(st.active)) st.active = firstActive();
      applyHighlight();
      if (st.stageFocus && st.active && !quietFocus) { announceActive(); showActiveTip(); }
    });
    els.stage.addEventListener('blur', () => { st.stageFocus = false; tip.hide(); applyHighlight(); });
    window.addEventListener('scroll', tip.onScroll, { passive: true });
    window.addEventListener('resize', () => tip.hide());
    // another tab wrote something other than what this tab last read or wrote; a write that matches is not news
    const onStorage = (ev) => {
      if (ev.key !== KEY || ev.storageArea !== window.localStorage) return;
      if (ev.newValue === lastSaved) { dismissNotice('other-tab'); return; }
      notify('other-tab', 'Your edits were changed in another tab.', [{ label: 'Reload them here', onClick: () => { undoStack.length = 0; data = clone(BASE); data.sources = Object.assign(Object.create(null), data.sources); savedBase = BASE_VERSION; staleText = null; lastSaved = null; dismissNotice('invalid'); applySaved(); st.sel = null; afterDataChange(); } }], { info: true });
    };
    window.addEventListener('storage', onStorage);
    // an edit made just before the page closes is still saved
    const flushSave = () => { if (persistTimer) persistNow(); };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
    const legendMq = window.matchMedia ? window.matchMedia('(max-width: 639px)') : null;
    function syncTools() {
      const folded = !!(legendMq && legendMq.matches);
      els.toolbar.dataset.collapsed = folded ? '1' : '0';
      els.toolsBtn.setAttribute('aria-expanded', String(!folded));
    }
    els.toolsBtn.addEventListener('click', () => {
      const folded = els.toolbar.dataset.collapsed === '1';
      els.toolbar.dataset.collapsed = folded ? '0' : '1';
      els.toolsBtn.setAttribute('aria-expanded', String(folded));
    });
    if (legendMq) { if (legendMq.addEventListener) legendMq.addEventListener('change', syncTools); else if (legendMq.addListener) legendMq.addListener(syncTools); }
    syncTools();
    function setLegendStart() {
      const want = opts.legendOpen;
      if (want === false) els.legend.open = false;
      else if (want === 'auto') { if (window.innerHeight < 1000 || els.legendBody.offsetHeight > window.innerHeight / 3) els.legend.open = false; }
      else if (want !== true && legendMq && legendMq.matches) els.legend.open = false;
    }

    /* ---------- start ---------- */
    applySaved();
    derive();
    renderLegend();
    setLegendStart();
    renderYearTool();
    computeVisible();
    renderPanels();
    renderStatus();
    renderDetail();
    let prefs = null;
    try { prefs = JSON.parse(store.get(UIKEY) || 'null'); } catch (e) { prefs = null; }

    function startGraph() {
      els.noD3.hidden = true;
      initGraph();
      setView(st.view === 'table' ? 'table' : 'graph');
    }
    if (d3) startGraph();
    else {
      st.view = 'table';
      els.noD3.hidden = false;
      els.stage.hidden = true; els.zoomCtl.hidden = true;
      setView('table');
      els.viewBtn.disabled = true;
      const tag = opts.d3Script ? document.getElementById(opts.d3Script) : null;
      if (tag) {
        tag.addEventListener('load', () => {
          if (!window.d3) return;
          d3 = window.d3;
          els.stage.hidden = false; els.zoomCtl.hidden = false; els.viewBtn.disabled = false;
          startGraph(); setView('graph');
        });
      }
    }
    if (prefs && prefs.edit) setEdit(true);

    const api = {
      select, clearSelection, fit, undo, importText, exportData, setView, setEdit, reset: () => resetData(),
      setFilters(p) {
        p = p || {};
        ['cats', 'rels', 'grades', 'mems'].forEach((k) => { if (p[k]) st[k] = new Set(p[k]); });
        if (hasOwn(p, 'q')) { els.search.value = p.q; onSearchChange(); }
        if (hasOwn(p, 'year')) { setYear(p.year); return; }
        filtersChanged();
      },
      state() {
        return {
          sel: st.sel, view: st.view, edit: st.edit, year: st.year, q: st.q, hasD3: !!d3, active: st.active,
          counts: { nodes: data.nodes.length, edges: data.edges.length, shownNodes: vis.nodes.size, shownEdges: vis.edges.size },
          filters: filterState(), canUndo: undoStack.length > 0, yours: { nodes: Array.from(yoursNodes), edges: Array.from(yoursEdges) },
          transform: { k: tr.k, x: tr.x, y: tr.y }, size, version: BASE_VERSION, savedBase, navMode,
        };
      },
      positions() { const o = {}; simNodes.forEach((sn) => { o[sn.id] = { x: sn.x, y: sn.y, r: sn.r }; }); return o; },
      data() { return data; },
      on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
      destroy() {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('pagehide', flushSave);
        if (sim) sim.stop();
        if (resizeObs) resizeObs.disconnect();
        clearTimeout(persistTimer);
        clearTimeout(tablesTimer);
        tip.el.remove();
        clear(root);
      },
    };
    emit('ready', null);
    return api;
  }

  window.MacroGraph = { create, shapePath };
})();
