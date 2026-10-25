#!/usr/bin/env node
/* Lint for the seven HTML pages: the same navigation, one cache stamp, working local links, and the page contract.
     node tools/check-site.js [--root DIR] [--stamp VALUE] [--pages a.html,b.html] [--allow-missing]
   Exit code 0 means no errors. Checked on every page:
     - the app bar (brand, title slot, navigation, theme button) is identical on all pages except the page title
       and aria-current; the brand links to index.html; the seven links are in reading order with their labels;
       exactly one link has aria-current="page" and it is the page itself
     - every local stylesheet, script and image carries ?v=<stamp>, and all pages carry the same stamp
       (--stamp VALUE also requires that value); the d3 script, if a page loads it, is the pinned 7.9.0 URL with no stamp
       and no other third-party script is loaded
     - every local href and src names a file that exists (query and fragment ignored)
     - a skip link whose target id exists, a noscript fallback, a unique non-empty title, a description, a viewport,
       exactly one h1 (the three new pages use the h1 the brief names), no duplicate ids, no em dash
     - a page that loads ts-chart.js also loads ui.js before it and ts-chart.css */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./stamp.js');

// reading order = navigation order
const PAGES = [
  { file: 'index.html', label: 'Start', h1: 'Money from first principles' },
  { file: 'money-flow.html', label: 'Money Flow' },
  { file: 'monetary-history.html', label: 'Money Over Time' },
  { file: 'debt.html', label: 'Debt', h1: 'Debt and Interest' },
  { file: 'prices.html', label: 'Prices', h1: 'Prices and Purchasing Power' },
  { file: 'world-powers.html', label: 'Nations' },
  { file: 'power-structure.html', label: 'Power Structure' },
];
const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
const EM_DASH = String.fromCharCode(0x2014);

function parseArgs(argv) {
  const o = { root: path.join(__dirname, '..'), stamp: null, pages: null, allowMissing: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.root = path.resolve(argv[++i] || '.');
    else if (a === '--stamp') o.stamp = argv[++i];
    else if (a === '--pages') o.pages = (argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--allow-missing') o.allowMissing = true;
    else { console.error('unknown option ' + a); process.exit(2); }
  }
  return o;
}

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }
function textOf(html) { return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }

// the app bar with the parts that legitimately differ between pages removed
function normalisedHeader(html) {
  const m = /<header\b[^>]*class="[^"]*\bappbar\b[^"]*"[^>]*>[\s\S]*?<\/header>/i.exec(html);
  if (!m) return null;
  return m[0]
    .replace(/\s+aria-current="page"/g, '')
    .replace(/(<h1\b[^>]*class="[^"]*\bpage-title\b[^"]*"[^>]*>)[\s\S]*?(<\/h1>)/i, '$1TITLE$2')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstDifference(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return 'at character ' + i + ': "' + a.slice(Math.max(0, i - 30), i + 50) + '" versus "' + b.slice(Math.max(0, i - 30), i + 50) + '"';
}

// true when a local script of the page names the id (for example h('main', { id: 'main' }) on the graph pages)
function scriptMakesId(root, tg, id) {
  const esc = id.replace(/[^A-Za-z0-9_-]/g, '');
  const re = new RegExp('[\'"]?id[\'"]?\\s*[:=]\\s*[\'"]' + esc + '[\'"]|setAttribute\\(\\s*[\'"]id[\'"]\\s*,\\s*[\'"]' + esc + '[\'"]');
  return tg.some((t) => {
    if (t.name !== 'script' || !t.attrs.src || !S.isLocal(t.attrs.src)) return false;
    const f = path.join(root, S.splitUrl(t.attrs.src).path);
    try { return re.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; }
  });
}

function run(opts) {
  const errors = [], infos = [];
  const err = (page, msg) => errors.push(page + ': ' + msg);
  const wanted = opts.pages ? PAGES.filter((p) => opts.pages.indexOf(p.file) >= 0) : PAGES;
  const present = [];
  wanted.forEach((p) => {
    const f = path.join(opts.root, p.file);
    if (!fs.existsSync(f)) { if (!opts.allowMissing) err(p.file, 'the page does not exist'); return; }
    present.push(Object.assign({ html: fs.readFileSync(f, 'utf8') }, p));
  });
  if (!present.length) { errors.push('no pages to check in ' + opts.root); return { errors, infos }; }

  const expectedHrefs = PAGES.map((p) => p.file), expectedLabels = PAGES.map((p) => p.label);
  const titles = new Map(), stamps = new Map();
  let refHeader = null, refHeaderPage = null;

  present.forEach((p) => {
    const html = p.html, tg = S.tags(html), masked = S.maskHtml(html);

    // document basics
    if (!/^\s*<!doctype html>/i.test(html)) err(p.file, 'no <!doctype html> at the top');
    const htmlTag = tg.find((t) => t.name === 'html');
    if (!htmlTag || !htmlTag.attrs.lang) err(p.file, 'the html element has no lang attribute');
    if (!tg.some((t) => t.name === 'meta' && /^utf-8$/i.test(t.attrs.charset || ''))) err(p.file, 'no <meta charset="utf-8">');
    if (!tg.some((t) => t.name === 'meta' && t.attrs.name === 'viewport')) err(p.file, 'no viewport meta');
    const desc = tg.find((t) => t.name === 'meta' && t.attrs.name === 'description');
    if (!desc || !(desc.attrs.content || '').trim()) err(p.file, 'no meta description');
    const em = html.indexOf(EM_DASH);
    if (em >= 0) err(p.file, 'contains an em dash character (line ' + lineOf(html, em) + ')');

    // title
    const tm = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(masked);
    const title = tm ? textOf(tm[1]) : '';
    if (!title) err(p.file, 'no title');
    else if (titles.has(title)) err(p.file, 'the title "' + title + '" is also used by ' + titles.get(title));
    else titles.set(title, p.file);

    // h1
    const h1s = (masked.match(/<h1\b[\s\S]*?<\/h1>/gi) || []).map(textOf);
    if (h1s.length !== 1) err(p.file, 'expected exactly one h1, found ' + h1s.length);
    else if (p.h1 && h1s[0] !== p.h1) err(p.file, 'the h1 should read "' + p.h1 + '" but reads "' + h1s[0] + '"');

    // ids
    const ids = new Map();
    tg.forEach((t) => {
      if (t.attrs.id != null) ids.set(t.attrs.id, (ids.get(t.attrs.id) || 0) + 1);
    });
    ids.forEach((n, id) => { if (n > 1) err(p.file, 'the id "' + id + '" is used ' + n + ' times'); });

    // skip link and noscript
    const skip = tg.find((t) => t.name === 'a' && /\bskip-link\b/.test(t.attrs.class || ''));
    if (!skip) err(p.file, 'no skip link (a.skip-link)');
    else {
      const target = (skip.attrs.href || '').replace(/^#/, '');
      if (!target) err(p.file, 'the skip link has no target');
      else if (!ids.has(target) && !scriptMakesId(opts.root, tg, target)) err(p.file, 'the skip link points to #' + target + ', which is neither in the page nor created by one of its scripts');
      else if (!ids.has(target)) infos.push(p.file + ': #' + target + ' is created by a script');
    }
    if (!tg.some((t) => t.name === 'noscript')) err(p.file, 'no <noscript> fallback');

    // brand and navigation
    const brand = tg.find((t) => t.name === 'a' && /\bbrand\b/.test(t.attrs.class || ''));
    if (!brand) err(p.file, 'no brand link');
    else if (brand.attrs.href !== 'index.html') err(p.file, 'the brand link goes to ' + brand.attrs.href + ', not index.html');
    const nav = /<nav\b[^>]*class="[^"]*\bappnav\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/i.exec(masked);
    if (!nav) err(p.file, 'no <nav class="appnav">');
    else {
      const links = S.tags(nav[1]).filter((t) => t.name === 'a');
      // labels come from the original text between the anchor tags
      const labels = (nav[1].match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []).map(textOf);
      if (links.length !== PAGES.length) err(p.file, 'the navigation has ' + links.length + ' links, expected ' + PAGES.length);
      else {
        links.forEach((l, i) => {
          if (l.attrs.href !== expectedHrefs[i]) err(p.file, 'navigation link ' + (i + 1) + ' goes to ' + l.attrs.href + ', expected ' + expectedHrefs[i]);
          if (labels[i] !== expectedLabels[i]) err(p.file, 'navigation link ' + (i + 1) + ' reads "' + labels[i] + '", expected "' + expectedLabels[i] + '"');
        });
        const cur = links.filter((l) => l.attrs['aria-current'] != null);
        if (cur.length !== 1) err(p.file, 'expected exactly one aria-current link, found ' + cur.length);
        else if (cur[0].attrs['aria-current'] !== 'page') err(p.file, 'aria-current should be "page"');
        else if (cur[0].attrs.href !== p.file) err(p.file, 'aria-current is on the link to ' + cur[0].attrs.href + ', not on this page');
      }
    }
    const header = normalisedHeader(html);
    if (!header) err(p.file, 'no <header class="appbar">');
    else if (refHeader == null) { refHeader = header; refHeaderPage = p.file; }
    else if (header !== refHeader) err(p.file, 'the app bar differs from ' + refHeaderPage + ' ' + firstDifference(refHeader, header));

    // assets: stamp, existence, third-party scripts
    const refs = S.assetRefs(html);
    refs.forEach((r) => {
      const key = r.stamp == null ? '(none)' : r.stamp;
      if (!stamps.has(key)) stamps.set(key, []);
      stamps.get(key).push(p.file);
      if (r.stamp == null) err(p.file, r.url + ' has no ?v= stamp');
      if (!fs.existsSync(path.join(opts.root, r.path))) err(p.file, r.url + ' does not exist (line ' + lineOf(html, r.start) + ')');
      if (opts.stamp && r.stamp != null && r.stamp !== opts.stamp) err(p.file, r.url + ' carries ' + r.stamp + ', expected ' + opts.stamp);
    });
    tg.filter((t) => t.name === 'script' && t.attrs.src && !S.isLocal(t.attrs.src)).forEach((t) => {
      if (t.attrs.src !== D3_URL) err(p.file, 'loads a third-party script other than the pinned d3: ' + t.attrs.src);
    });
    tg.filter((t) => t.name === 'link' && t.attrs.href && /^https?:/i.test(t.attrs.href) && /stylesheet/i.test(t.attrs.rel || '')).forEach((t) => {
      err(p.file, 'loads a third-party stylesheet: ' + t.attrs.href);
    });
    if (/\bd3(?:\.min)?\.js/i.test(masked) && !tg.some((t) => t.name === 'script' && t.attrs.src === D3_URL)) err(p.file, 'a d3 script is referenced but it is not the pinned ' + D3_URL);

    // local links
    tg.filter((t) => t.name === 'a' && t.attrs.href != null).forEach((t) => {
      const href = t.attrs.href;
      if (!S.isLocal(href)) return;
      const target = S.splitUrl(href).path;
      if (target && !fs.existsSync(path.join(opts.root, target))) err(p.file, 'the link to ' + href + ' goes to a file that does not exist (line ' + lineOf(html, t.start) + ')');
    });

    // ts-chart needs MacroUI first and its stylesheet
    const scripts = tg.filter((t) => t.name === 'script' && t.attrs.src).map((t) => S.splitUrl(t.attrs.src).path);
    const iChart = scripts.indexOf('assets/ts-chart.js');
    if (iChart >= 0) {
      if (scripts.indexOf('assets/ui.js') < 0 || scripts.indexOf('assets/ui.js') > iChart) err(p.file, 'assets/ui.js must load before assets/ts-chart.js');
      if (!tg.some((t) => t.name === 'link' && S.splitUrl(t.attrs.href || '').path === 'assets/ts-chart.css')) err(p.file, 'assets/ts-chart.js is loaded without assets/ts-chart.css');
    }
  });

  // one stamp everywhere
  const keys = Array.from(stamps.keys()).filter((k) => k !== '(none)');
  if (keys.length > 1) {
    errors.push('the pages carry ' + keys.length + ' different stamps: ' + keys.map((k) => k + ' (' + stamps.get(k).length + ' URLs)').join(', '));
  }
  if (keys.length === 1) infos.push('stamp ' + keys[0] + ' on ' + stamps.get(keys[0]).length + ' URLs');
  infos.push(present.length + ' page(s) checked');
  return { errors, infos };
}

module.exports = { PAGES, run };

if (require.main === module) {
  const res = run(parseArgs(process.argv.slice(2)));
  res.errors.forEach((e) => console.log('ERROR ' + e));
  res.infos.forEach((i) => console.log(i));
  if (res.errors.length) { console.log(res.errors.length + ' error(s)'); process.exit(1); }
  console.log('ok');
}
