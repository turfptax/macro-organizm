/* Macro Organizm shell: saved theme and theme button, skip link, and the load-failure panel.
   Load it in <head>, after the stylesheets and before d3 and the page script, so a saved
   theme is applied before the first paint. Plain script with no dependencies.
   Pages call window.MacroShell.needD3() and window.MacroShell.fatal(); a page script guards
   for the case where this file did not load. */
(function () {
  'use strict';
  if (window.MacroShell) return;

  const KEY = 'mo-theme'; // kept from the first version so saved choices survive
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    // true when the value was stored, false when the browser refused it (blocked storage, full quota)
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { /* storage blocked: the choice lasts for this visit only */ return false; } },
    remove(k) { try { window.localStorage.removeItem(k); return true; } catch (e) { return false; } },
  };

  function effectiveTheme() {
    return root.dataset.theme || (mq && mq.matches ? 'light' : 'dark');
  }
  function syncThemeBtn() {
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    btn.textContent = next === 'light' ? 'Light theme' : 'Dark theme';
    btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  // runs at parse time, before the body paints
  const saved = store.get(KEY);
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  function wire() {
    syncThemeBtn();
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        store.set(KEY, next);
        syncThemeBtn();
      });
    }
    if (mq && mq.addEventListener) mq.addEventListener('change', syncThemeBtn);

    // the app bar wraps at some widths, so anything sticky under it reads its height from --appbar-h
    const bar = document.querySelector('.appbar');
    if (bar) {
      const setBarH = () => root.style.setProperty('--appbar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
      setBarH();
      if (window.ResizeObserver) new ResizeObserver(setBarH).observe(bar);
      else window.addEventListener('resize', setBarH);
    }

    // the skip link moves focus without touching the address, which can hold a page's view state
    const skip = document.querySelector('.skip-link');
    if (skip) {
      skip.addEventListener('click', (e) => {
        const target = document.getElementById((skip.getAttribute('href') || '').slice(1));
        if (!target) return;
        e.preventDefault();
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus();
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  // fatal(detail) or fatal(title, detail): show the #load-error panel and hide #app
  function fatal(title, detail) {
    if (detail === undefined) { detail = title; title = null; }
    let box = document.getElementById('load-error');
    if (!box) {
      box = document.createElement('div');
      box.id = 'load-error';
      box.className = 'load-error';
      box.setAttribute('role', 'alert');
      const h = document.createElement('h2');
      h.id = 'load-error-title';
      const p = document.createElement('p');
      p.id = 'load-error-detail';
      box.appendChild(h);
      box.appendChild(p);
      document.body.insertBefore(box, document.body.firstChild);
    }
    const t = document.getElementById('load-error-title');
    const d = document.getElementById('load-error-detail');
    if (t && title) t.textContent = title;
    if (d) d.textContent = detail;
    box.hidden = false;
    const app = document.getElementById('app');
    if (app) app.hidden = true;
  }

  function needD3() {
    if (window.d3) return true;
    fatal('The chart library did not load',
      'This page draws its charts with d3 7.9.0 from cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js. ' +
      'Check your connection or any content blocker, then reload the page.');
    return false;
  }

  window.MacroShell = { store: store, effectiveTheme: effectiveTheme, fatal: fatal, needD3: needD3 };
})();
