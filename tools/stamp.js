#!/usr/bin/env node
/* Cache stamp for every local asset URL in the site's HTML pages.
   Every local stylesheet, script, image and data file carries ?v=<stamp>, and every page carries the same stamp,
   because the pages share macro.css, shell.js and ui.js and a mixed stamp would serve old shared files to some pages.
   The pinned d3 URL on jsDelivr is never stamped.

     node tools/stamp.js 20261024b            rewrite every local asset URL in *.html to ?v=20261024b
     node tools/stamp.js 20261024b --check    exit 1 if any URL has a different stamp or none (writes nothing)
     node tools/stamp.js --check              exit 1 if the pages do not all carry one and the same stamp
     node tools/stamp.js                      print the stamps in use
   Options: --root DIR (the folder with the pages, default the project root), --quiet.
   The stamp is free text of letters, digits, dot, underscore and hyphen. Two releases on one day use a suffix. */
'use strict';
const fs = require('fs');
const path = require('path');

const STAMP_RE = /^[A-Za-z0-9._-]{1,32}$/;
const ASSET_ATTR = { link: 'href', script: 'src', img: 'src', source: 'src', video: 'src', audio: 'src', iframe: 'src' };

function blank(s) { return s.replace(/[^\n]/g, ' '); }

// the same text with comments and script or style bodies blanked, so tags inside them are not read as markup
function maskHtml(html) {
  let out = html.replace(/<!--[\s\S]*?-->/g, blank);
  out = out.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, tag, body, close) => open + blank(body) + close);
  return out;
}

function parseAttrs(s) {
  const attrs = {}, re = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const k = m[1].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) attrs[k] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : '';
  }
  return attrs;
}

// every start tag: { name, attrs, start, end, raw }
function tags(html) {
  const masked = maskHtml(html), out = [], re = /<([A-Za-z][A-Za-z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m;
  while ((m = re.exec(masked))) out.push({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2]), start: m.index, end: m.index + m[0].length, raw: html.slice(m.index, m.index + m[0].length) });
  return out;
}

function isLocal(url) {
  if (typeof url !== 'string' || !url) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)) return false; // http:, https:, data:, mailto:, javascript:
  if (url.indexOf('//') === 0 || url[0] === '#') return false;
  return true;
}

function splitUrl(url) {
  const h = url.indexOf('#'), hash = h >= 0 ? url.slice(h) : '', rest = h >= 0 ? url.slice(0, h) : url;
  const q = rest.indexOf('?');
  return { path: q >= 0 ? rest.slice(0, q) : rest, query: q >= 0 ? rest.slice(q + 1) : '', hash };
}

function stampOf(url) {
  const m = /(?:^|&)v=([^&]*)/.exec(splitUrl(url).query);
  return m ? m[1] : null;
}

function withStamp(url, stamp) {
  const u = splitUrl(url);
  const parts = u.query ? u.query.split('&').filter((x) => x && x.slice(0, 2) !== 'v=') : [];
  parts.push('v=' + stamp);
  return u.path + '?' + parts.join('&') + u.hash;
}

// local asset references: [{ tag, attr, url, path, stamp, start, end }] where start..end is the attribute value in the text
function assetRefs(html) {
  const refs = [];
  tags(html).forEach((t) => {
    const attr = ASSET_ATTR[t.name];
    if (!attr || !Object.prototype.hasOwnProperty.call(t.attrs, attr)) return;
    const url = t.attrs[attr];
    if (!isLocal(url)) return;
    // find the value inside the raw tag so it can be rewritten in place
    const re = new RegExp('\\b' + attr + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+))', 'i');
    const m = re.exec(t.raw);
    if (!m) return;
    const val = m[1] != null ? m[1] : m[2] != null ? m[2] : m[3];
    const off = m.index + m[0].lastIndexOf(val);
    refs.push({ tag: t.name, attr, url, path: splitUrl(url).path, stamp: stampOf(url), start: t.start + off, end: t.start + off + val.length });
  });
  return refs;
}

function restamp(html, stamp) {
  const refs = assetRefs(html);
  let out = '', pos = 0, changed = 0;
  refs.forEach((r) => {
    const next = withStamp(r.url, stamp);
    out += html.slice(pos, r.start) + next;
    pos = r.end;
    if (next !== r.url) changed++;
  });
  out += html.slice(pos);
  return { html: out, changed, count: refs.length };
}

function listPages(root) {
  return fs.readdirSync(root).filter((f) => /\.html$/i.test(f) && fs.statSync(path.join(root, f)).isFile()).sort();
}

function main(argv) {
  const args = argv.slice();
  let root = path.join(__dirname, '..'), check = false, quiet = false, stamp = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--check') check = true;
    else if (a === '--quiet') quiet = true;
    else if (a === '--root') root = path.resolve(args[++i] || '.');
    else if (a.slice(0, 2) === '--') { console.error('unknown option ' + a); return 2; }
    else if (stamp == null) stamp = a;
    else { console.error('only one stamp value is allowed'); return 2; }
  }
  if (stamp != null && !STAMP_RE.test(stamp)) { console.error('the stamp must be 1 to 32 letters, digits, dot, underscore or hyphen'); return 2; }
  const say = (s) => { if (!quiet) console.log(s); };
  const pages = listPages(root);
  if (!pages.length) { console.error('no .html files in ' + root); return 2; }

  const seen = new Map(); // stamp (or "none") -> count
  let problems = 0, changedFiles = 0;
  pages.forEach((f) => {
    const file = path.join(root, f), html = fs.readFileSync(file, 'utf8'), refs = assetRefs(html);
    refs.forEach((r) => seen.set(r.stamp == null ? '(none)' : r.stamp, (seen.get(r.stamp == null ? '(none)' : r.stamp) || 0) + 1));
    if (stamp == null) return;
    if (check) {
      const bad = refs.filter((r) => r.stamp !== stamp);
      bad.forEach((r) => { problems++; console.log(f + ': ' + r.url + ' should carry ?v=' + stamp); });
      return;
    }
    const res = restamp(html, stamp);
    if (res.html !== html) { fs.writeFileSync(file, res.html); changedFiles++; say(f + ': ' + res.changed + ' of ' + res.count + ' URLs restamped'); }
    else say(f + ': ' + res.count + ' URLs already carry ' + stamp);
  });

  const keys = Array.from(seen.keys());
  if (stamp == null && !check) {
    keys.forEach((k) => say(k + '  (' + seen.get(k) + ' URLs)'));
    return 0;
  }
  if (stamp == null && check) {
    if (keys.length !== 1 || keys[0] === '(none)') {
      keys.forEach((k) => console.log('stamp ' + k + ' on ' + seen.get(k) + ' URLs'));
      console.log('FAIL: the pages must carry one and the same stamp on every local asset URL');
      return 1;
    }
    say('ok: every local asset URL carries ' + keys[0] + ' (' + seen.get(keys[0]) + ' URLs in ' + pages.length + ' pages)');
    return 0;
  }
  if (check) {
    if (problems) { console.log('FAIL: ' + problems + ' URL(s) differ from ' + stamp); return 1; }
    say('ok: every local asset URL carries ' + stamp);
    return 0;
  }
  say('stamped ' + changedFiles + ' of ' + pages.length + ' pages with ' + stamp);
  return 0;
}

module.exports = { maskHtml, parseAttrs, tags, isLocal, splitUrl, stampOf, withStamp, assetRefs, restamp, listPages, STAMP_RE };

if (require.main === module) process.exit(main(process.argv.slice(2)));
