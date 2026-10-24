/* Macro Organizm UI helpers: element builders, safe links, dialog, tooltip and table.
   Plain script that sets window.MacroUI. Text always goes in through textContent, never innerHTML, and event
   handlers are functions, never attribute strings. Money Flow keeps its own copies of these helpers. */
(function () {
  'use strict';
  if (window.MacroUI) return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const URL_WEB = /^https?:\/\/[^\s]+$/i;
  const PROP_ATTRS = { value: 1, checked: 1, selected: 1, disabled: 1, hidden: 1, indeterminate: 1 };
  let counter = 0;
  const uid = (prefix) => (prefix || 'ui') + '-' + (++counter);

  function append(e, kids) {
    if (kids == null || kids === false) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach((c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) append(e, c);
      else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
  }

  // h('button', {class, text, onclick, 'aria-pressed': 'false'}, [children])
  function h(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'for') e.htmlFor = v;
        else if (PROP_ATTRS[k]) e[k] = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    append(e, kids);
    return e;
  }

  function sv(tag, props, kids) {
    const e = document.createElementNS(SVGNS, tag);
    if (props) Object.keys(props).forEach((k) => { if (props[k] != null && props[k] !== false) e.setAttribute(k, props[k]); });
    append(e, kids);
    return e;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function setPressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }

  // a web address only: http or https, no spaces, not absurdly long
  function safeHref(u) { return typeof u === 'string' && u.length <= 500 && URL_WEB.test(u) ? u : null; }
  function link(text, url, cls, title) {
    const href = safeHref(url);
    if (!href) return h('span', { class: cls, text, title });
    return h('a', { class: cls, href, text, title, target: '_blank', rel: 'noopener noreferrer' });
  }

  /* ---------- tooltip ---------- */
  // One fixed-position tip. While a control has keyboard focus the tip belongs to it and is linked with aria-describedby.
  function tip(opts) {
    const id = (opts && opts.id) || uid('tip');
    const el = h('div', { class: 'tip tip--fixed', id, role: 'tooltip', hidden: true });
    document.body.appendChild(el);
    let anchor = null, desc = null;
    function unlink() {
      if (desc) desc.removeAttribute('aria-describedby');
      anchor = null; desc = null;
    }
    const api = {
      el,
      get shown() { return !el.hidden; },
      hide() { el.hidden = true; unlink(); },
      // title in bold, then one paragraph per non-empty line; tag is a small line under the title
      set(title, lines, tag) {
        unlink();
        clear(el);
        el.appendChild(h('b', { text: title }));
        if (tag) el.appendChild(h('span', { class: 'tip-tag', text: tag }));
        (lines || []).forEach((l) => { if (l) el.appendChild(h('p', { text: l })); });
      },
      // x and y are viewport pixels; the tip flips and clamps so it never leaves the screen
      place(x, y) {
        el.hidden = false;
        const r = el.getBoundingClientRect();
        const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        let left = x + 14, top = y + 16;
        if (left + r.width > vw - 8) left = x - 14 - r.width;
        if (top + r.height > vh - 8) top = y - 16 - r.height;
        el.style.left = Math.max(8, left) + 'px';
        el.style.top = Math.max(8, top) + 'px';
      },
      // anchor to an element; focused is the control that has keyboard focus and gets aria-describedby
      placeFor(target, focused) {
        anchor = target;
        if (focused) { desc = focused; focused.setAttribute('aria-describedby', id); }
        const r = target.getBoundingClientRect();
        api.place(r.left + Math.min(r.width / 2, 160), r.bottom - 6);
      },
      // a scroll hides a pointer tip; a keyboard tip stays with its control
      onScroll() {
        if (!el.hidden && anchor && desc && document.activeElement === desc) {
          const r = anchor.getBoundingClientRect();
          if (r.bottom > 0 && r.top < document.documentElement.clientHeight) { api.placeFor(anchor, desc); return; }
        }
        api.hide();
      },
    };
    return api;
  }

  /* ---------- dialog ---------- */
  let dlg = null;
  const INERT = ['#app', '.appbar', '.skip-link'];
  const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex="0"]';

  function focusables(box) {
    return Array.from(box.querySelectorAll(FOCUSABLE)).filter((n) => !n.disabled && n.getClientRects().length > 0 && n.getAttribute('tabindex') !== '-1');
  }
  // one document-level listener, so Escape and the Tab trap hold even when focus has left the dialog
  function onKey(ev) {
    if (!dlg) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (dlg.ask) dropAsk(true); else requestClose(); return; }
    if (ev.key !== 'Tab') return;
    const box = dlg.box, f = focusables(box);
    if (!f.length) { ev.preventDefault(); box.focus(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!box.contains(a)) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); }
    else if (ev.shiftKey && (a === first || a === box)) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);

  function root() {
    let r = document.getElementById('dialog-root');
    if (!r) { r = h('div', { id: 'dialog-root' }); document.body.appendChild(r); }
    return r;
  }

  // spec: { title, sub, tags[], body (node or list), actions[{label, kind: 'primary'|'danger'|'', onClick, keepOpen}],
  //         strict (a click outside does not close), wide, opener, onClose, focus (node to focus first), alert,
  //         isDirty (function: true while the dialog holds input that closing would lose; Escape and the x button then ask first) }
  // Returns { close, box }.
  function dialog(spec) {
    closeDialog(true);
    const titleId = uid('dlg-title');
    const closeBtn = h('button', { class: 'btn dclose', type: 'button', 'aria-label': 'Close dialog', text: '\u00d7', onclick: () => requestClose() });
    const kids = [closeBtn, h('h2', { id: titleId, text: spec.title })];
    if (spec.sub) kids.push(h('p', { class: 'dsub', text: spec.sub }));
    if (spec.tags && spec.tags.length) kids.push(h('div', { class: 'dsub' }, spec.tags.map((t) => h('span', { class: 'badge', text: t }))));
    if (spec.body) (Array.isArray(spec.body) ? spec.body : [spec.body]).forEach((n) => { if (n) kids.push(n); });
    let actionBtns = [];
    if (spec.actions && spec.actions.length) {
      actionBtns = spec.actions.map((a) => h('button', {
        class: 'btn' + (a.kind ? ' btn-' + a.kind : ''), type: 'button', text: a.label,
        onclick: () => { if (!a.keepOpen) closeDialog(); if (a.onClick) a.onClick(); },
      }));
      kids.push(h('div', { class: 'dactions' }, actionBtns));
    }
    // tabindex -1 lets a click on the dialog text keep focus inside the dialog
    const box = h('div', {
      class: 'dialog' + (spec.wide ? ' dialog--wide' : ''), role: spec.alert ? 'alertdialog' : 'dialog',
      'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1',
    }, kids);
    const scrim = h('div', { class: 'scrim' }, [box]);
    if (!spec.strict) scrim.addEventListener('mousedown', (ev) => { if (ev.target === scrim) closeDialog(); });
    root().appendChild(scrim);
    INERT.forEach((sel) => { const n = document.querySelector(sel); if (n) n.setAttribute('inert', ''); });
    dlg = { scrim, box, opener: spec.opener || document.activeElement, onClose: spec.onClose, isDirty: spec.isDirty, ask: null };
    const first = spec.focus || (spec.focusAction != null && actionBtns[spec.focusAction]) || closeBtn;
    first.focus();
    return { close: () => closeDialog(), box };
  }

  // Escape and the x button close at once, unless the dialog holds typed input; then the person is asked first.
  // Escape on the question keeps the dialog open.
  function requestClose() {
    if (!dlg) return;
    if (!dlg.isDirty || !dlg.isDirty()) { closeDialog(); return; }
    if (dlg.ask) { dlg.ask.keep.focus(); return; }
    const keep = h('button', { class: 'btn btn-primary', type: 'button', text: 'Keep editing', onclick: () => dropAsk(true) });
    const drop = h('button', { class: 'btn btn-danger', type: 'button', text: 'Discard changes', onclick: () => closeDialog() });
    const bar = h('div', { class: 'notice', role: 'alert' }, [h('p', { text: 'What you typed is not saved. Discard it?' }), keep, drop]);
    dlg.box.appendChild(bar);
    dlg.ask = { bar, keep, back: document.activeElement };
    bar.scrollIntoView({ block: 'nearest' });
    keep.focus();
  }
  function dropAsk(refocus) {
    if (!dlg || !dlg.ask) return;
    const a = dlg.ask;
    dlg.ask = null;
    a.bar.remove();
    if (refocus && a.back && dlg.box.contains(a.back)) a.back.focus();
  }

  function closeDialog(silent) {
    if (!dlg) return;
    const d = dlg;
    dlg = null;
    d.scrim.remove();
    INERT.forEach((sel) => { const n = document.querySelector(sel); if (n) n.removeAttribute('inert'); });
    if (d.onClose) d.onClose();
    if (!silent) {
      if (d.opener && document.body.contains(d.opener)) d.opener.focus();
      else { const m = document.getElementById('main'); if (m) m.focus(); }
    }
  }

  // a yes or no question; confirm({title, text, confirmLabel, cancelLabel, danger, onConfirm, opener})
  function confirm(spec) {
    return dialog({
      title: spec.title, alert: true, opener: spec.opener,
      body: [h('p', { text: spec.text })],
      actions: [
        { label: spec.confirmLabel || 'OK', kind: spec.danger ? 'danger' : 'primary', onClick: spec.onConfirm },
        { label: spec.cancelLabel || 'Cancel', onClick: spec.onCancel },
      ],
      focusAction: 1,
    });
  }

  /* ---------- table ---------- */
  // cols: [{label, wrap}]; rows: arrays of cells. A cell is text, a number, null (shown as n/a), {text, href}
  // for a link, or {node} for any element. The first cell of a row is its row header.
  function table(host, caption, cols, rows) {
    clear(host);
    const t = h('table', { class: 'datatable' });
    t.appendChild(h('caption', null, [caption]));
    t.appendChild(h('thead', null, [h('tr', null, cols.map((c) => h('th', { scope: 'col', class: c.wrap ? 'wrap' : null, text: c.label })))]));
    const tb = h('tbody');
    rows.forEach((r) => {
      tb.appendChild(h('tr', null, r.map((cell, i) => {
        const na = cell == null || cell === '';
        let content;
        if (cell && typeof cell === 'object' && cell.node) content = cell.node;
        else if (cell && typeof cell === 'object') content = link(cell.text, cell.href);
        else content = document.createTextNode(na ? 'n/a' : String(cell));
        if (i === 0) return h('th', { scope: 'row', class: cols[0] && cols[0].wrap ? 'wrap' : null }, [content]);
        return h('td', { class: (na ? 'na ' : '') + (cols[i] && cols[i].wrap ? 'wrap' : '') }, [content]);
      })));
    });
    t.appendChild(tb);
    host.appendChild(t);
    return t;
  }

  window.MacroUI = { h, sv, clear, setPressed, safeHref, link, tip, dialog, closeDialog, requestClose, confirm, table, uid, focusables };
})();
