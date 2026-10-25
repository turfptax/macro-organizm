/* Macro Organizm derive: the arithmetic behind every computed number on Start, Debt and Prices.
   Pure functions, no DOM, no d3. Runs in a browser (window.MacroDerive) and in node (require).
   Nothing here throws on bad input: a function returns null, and resolve() returns { ok: false, error, message }.

   SERIES ("rows")
     [[period, value], ...]   period is "YYYY", "YYYY-MM" or "YYYY-Qn" (an integer year also works).
     A row whose value is null (or a null row) is a gap. Objects { y, v } (data/history.js) are accepted too.
     A period is placed at its START (1971 = 1971.0, 1971-07 = 1971.5), so the span between two annual rows is
     simply the difference of the years. Values are never divided across different years: ratioAligned and
     align pair rows by identical period, or by calendar year when asked.

   PLACEHOLDERS (data/principles.js text)
     {{series.rule.arg.arg|fmt}}      for example {{cpi.doubling.1971}}, {{house.hours.pay.lastfull}}
     series   a series id or an alias (see DEFAULT_ALIASES; ctx.alias adds or overrides). "calc" is the pseudo
              series for rules that take only numbers.
     rule     a name in RULES (knownRules() lists them, ruleInfo(name) says what each does)
     args     rule arguments. A year or period: 1971, 1971-08, 1971-Q2. "latest" is the newest observation,
              "lastfull" is the newest complete calendar year, "lastN" (start of a window only) is N years before
              lastfull, "latest-Ny" (start only) is N years before the newest observation. Both ends of a window use
              the same basis: years are annual averages of the rows, months are single observations. A
              year-to-latest window is refused rather than guessed.
              A year followed by p (2025p) is the average of the months available in that year, so a part year counts.
     fmt      optional output format: n0..n6, p0..p3 (adds %), x0..x2 (adds x), sgn0..sgn3 (signed), usd0..usd2,
              usdbn (input in billions), yrs1, mins1, hrs0, raw. Each rule has a default.
   resolve(placeholder, ctx) -> { ok, text, value, unit, rule, series, period, asOf, source, error, message }
   resolveText(template, ctx, opts) -> { text, items, errors, ok }
   ctx = makeContext({ prices, debt, history, alias }) -> { series(id), meta(id), alias } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MacroDerive = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HOURS_PER_YEAR = 2080; // 40 hours x 52 weeks, an assumption the pages state
  // "Prices roughly double every 17 years": a doubling time within PACE_TOLERANCE years of PACE_YEARS counts as roughly 17.
  // The same tolerance is used on the Start and Prices pages.
  const PACE_YEARS = 17, PACE_TOLERANCE = 1.5;
  // 'about' (within the tolerance), 'faster' (a shorter doubling time), 'slower' (longer, or no doubling at all); null when unknown
  function paceVerdict(dbl, noGrowth) {
    if (dbl == null) return noGrowth ? 'slower' : null;
    if (Math.abs(dbl - PACE_YEARS) <= PACE_TOLERANCE) return 'about';
    return dbl < PACE_YEARS ? 'faster' : 'slower';
  }
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const fin = (x) => typeof x === 'number' && isFinite(x);

  /* ---------- periods ---------- */
  // -> { key, y, m, q, freq: 'A'|'Q'|'M', step (years), t (decimal year at the start of the period) } or null
  function parsePeriod(p) {
    if (typeof p === 'number') {
      if (!Number.isInteger(p) || p < 1000 || p > 9999) return null;
      return { key: String(p), y: p, m: null, q: null, freq: 'A', step: 1, t: p };
    }
    if (typeof p !== 'string') return null;
    let m = /^(\d{4})$/.exec(p);
    if (m) { const y = +m[1]; return { key: p, y, m: null, q: null, freq: 'A', step: 1, t: y }; }
    m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(p);
    if (m) { const y = +m[1], mo = +m[2]; return { key: p, y, m: mo, q: null, freq: 'M', step: 1 / 12, t: y + (mo - 1) / 12 }; }
    m = /^(\d{4})-?[Qq]([1-4])$/.exec(p);
    if (m) { const y = +m[1], q = +m[2]; return { key: m[1] + '-Q' + q, y, m: null, q, freq: 'Q', step: 0.25, t: y + (q - 1) / 4 }; }
    return null;
  }

  function periodKey(freq, y, sub) {
    if (freq === 'A') return String(y);
    if (freq === 'Q') return y + '-Q' + sub;
    return y + '-' + (sub < 10 ? '0' : '') + sub;
  }

  // move a period by n of its own units (months, quarters or years); returns the new key or null
  function shiftPeriod(p, n) {
    const per = typeof p === 'object' && p ? p : parsePeriod(p);
    if (!per || !Number.isInteger(n)) return null;
    if (per.freq === 'A') return String(per.y + n);
    if (per.freq === 'M') {
      const tot = per.y * 12 + (per.m - 1) + n, y = Math.floor(tot / 12);
      return periodKey('M', y, tot - y * 12 + 1);
    }
    const tot = per.y * 4 + (per.q - 1) + n, y = Math.floor(tot / 4);
    return periodKey('Q', y, tot - y * 4 + 1);
  }

  // "2025", "Aug 2026", "2026 Q2"
  function periodLabel(p) {
    const per = typeof p === 'object' && p ? p : parsePeriod(p);
    if (!per) return String(p);
    if (per.freq === 'A') return String(per.y);
    if (per.freq === 'M') return MONTHS[per.m - 1] + ' ' + per.y;
    return per.y + ' Q' + per.q;
  }

  /* ---------- series ---------- */
  const cleanCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  // The period of an object row: p when it names a period, else y. A row flagged p: 1 (or true) or partial is a part-year
  // reading in data/history.js and has no period of its own, so it is left out of every calculation.
  function objectPeriod(r) {
    if (r.p === 1 || r.p === true || r.partial === 1 || r.partial === true) return null;
    return r.p != null ? r.p : r.y;
  }

  // valid points in time order: [{ key, y, m, q, freq, step, t, v }]; gaps are dropped, a repeated period keeps the last value
  function clean(rows) {
    if (!Array.isArray(rows)) return [];
    if (cleanCache && cleanCache.has(rows)) return cleanCache.get(rows);
    const byKey = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r == null) continue;
      let p, v;
      if (Array.isArray(r)) { p = r[0]; v = r[1]; } else if (typeof r === 'object') { p = objectPeriod(r); v = r.v; } else continue;
      if (!fin(v)) continue;
      const per = parsePeriod(p);
      if (!per) continue;
      byKey.set(per.key, Object.assign({ v }, per));
    }
    const out = Array.from(byKey.values()).sort((a, b) => a.t - b.t || a.step - b.step);
    if (cleanCache) cleanCache.set(rows, out);
    return out;
  }

  function mapOf(rows) {
    const m = new Map();
    clean(rows).forEach((pt) => m.set(pt.key, pt.v));
    return m;
  }

  function latest(rows) { const c = clean(rows); return c.length ? c[c.length - 1] : null; }
  function first(rows) { const c = clean(rows); return c.length ? c[0] : null; }
  function at(rows, p) {
    const per = parsePeriod(p);
    if (!per) return null;
    const c = clean(rows);
    for (let i = 0; i < c.length; i++) if (c[i].key === per.key) return c[i].v;
    return null;
  }

  // annual rows from a finer series. how: 'mean' (default), 'last' or 'first'. A year needs all its months or quarters
  // unless opts.partial is true. An annual series passes through unchanged.
  function annual(rows, opts) {
    const o = opts || {}, how = o.how || 'mean';
    const groups = new Map();
    clean(rows).forEach((pt) => {
      if (!groups.has(pt.y)) groups.set(pt.y, []);
      groups.get(pt.y).push(pt);
    });
    const out = [];
    Array.from(groups.keys()).sort((a, b) => a - b).forEach((y) => {
      const pts = groups.get(y), f = pts[0].freq, need = f === 'M' ? 12 : f === 'Q' ? 4 : 1;
      if (pts.length < need && !o.partial) return;
      let v;
      if (how === 'last') v = pts[pts.length - 1].v;
      else if (how === 'first') v = pts[0].v;
      else v = pts.reduce((s, pt) => s + pt.v, 0) / pts.length;
      out.push([String(y), v]);
    });
    return out;
  }

  // newest calendar year with a full set of observations, or null
  function lastFullYear(rows) {
    const a = annual(rows);
    return a.length ? +a[a.length - 1][0] : null;
  }

  // rows with from <= period <= to (years or period keys, inclusive). Gap rows between kept points stay in.
  function windowRows(rows, from, to) {
    if (!Array.isArray(rows)) return [];
    const f = from == null ? null : parsePeriod(from), t = to == null ? null : parsePeriod(to);
    const lo = f ? f.t : -Infinity;
    const hi = t ? (t.freq === 'A' ? t.t + 1 - 1e-9 : t.t + t.step - 1e-9) : Infinity;
    const keep = rows.map((r) => {
      if (r == null) return false;
      const per = parsePeriod(Array.isArray(r) ? r[0] : objectPeriod(r));
      return !!per && per.t >= lo && per.t <= hi;
    });
    const firstKept = keep.indexOf(true), lastKept = keep.lastIndexOf(true);
    return rows.filter((r, i) => keep[i] || (r == null && i > firstKept && i < lastKept && firstKept >= 0));
  }

  // index to `base` (default 100) at the first valid observation on or after `from`.
  // -> { rows: [[period, value|null], ...], base: { key, v } } or null
  function rebase(rows, from, base) {
    const b = base == null ? 100 : base, f = parsePeriod(from);
    if (!f) return null;
    const c = clean(rows), start = c.find((pt) => pt.t >= f.t - 1e-9 && pt.v !== 0);
    if (!start) return null;
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (r == null) return;
      const p = Array.isArray(r) ? r[0] : objectPeriod(r), per = parsePeriod(p);
      if (!per || per.t < start.t - 1e-9) return;
      const v = Array.isArray(r) ? r[1] : r.v;
      out.push([per.key, fin(v) ? (v / start.v) * b : null]);
    });
    return { rows: out, base: { key: start.key, v: start.v } };
  }

  // combine two series where both have a value in the same period (by: 'period', default) or, with by: 'year',
  // where the second series is annual and the first falls in the same calendar year. Never pairs different years.
  // fn(a, b) returns a number or null. -> rows keyed like the first series
  function align(a, b, fn, opts) {
    const by = (opts && opts.by) || 'period', ca = clean(a), out = [];
    let lookup;
    if (by === 'year') {
      const m = new Map();
      clean(b).forEach((pt) => { if (pt.freq === 'A') m.set(String(pt.y), pt.v); });
      lookup = (pt) => m.get(String(pt.y));
    } else {
      const m = mapOf(b);
      lookup = (pt) => m.get(pt.key);
    }
    ca.forEach((pt) => {
      const bv = lookup(pt);
      if (!fin(bv)) return;
      const v = fn(pt.v, bv);
      if (fin(v)) out.push([pt.key, v]);
    });
    return out;
  }
  function ratioAligned(a, b, opts) {
    const scale = opts && opts.scale != null ? opts.scale : 1;
    return align(a, b, (x, y) => (y === 0 ? null : (x / y) * scale), opts);
  }
  function diffAligned(a, b, opts) { return align(a, b, (x, y) => x - y, opts); }

  // the lag, in periods, of one year for a series of this frequency
  function perYear(freq) { return freq === 'M' ? 12 : freq === 'Q' ? 4 : 1; }

  // every row with a valid period, in time order, including explicit gap rows (value null)
  function cleanAll(rows) {
    if (!Array.isArray(rows)) return [];
    const byKey = new Map();
    rows.forEach((r) => {
      if (r == null) return;
      let p, v;
      if (Array.isArray(r)) { p = r[0]; v = r[1]; } else if (typeof r === 'object') { p = objectPeriod(r); v = r.v; } else return;
      const per = parsePeriod(p);
      if (per) byKey.set(per.key, Object.assign({ v: fin(v) ? v : null }, per));
    });
    return Array.from(byKey.values()).sort((a, b) => a.t - b.t || a.step - b.step);
  }

  // Apply f to each row. A row with no result is a hole in the middle of the series (emit a null row) unless it sits
  // within lagYears of the first valid observation, where no result could exist (emit nothing).
  function lagRows(rows, lagYears, f) {
    const c = clean(rows), out = [];
    if (!c.length) return out;
    const t0 = c[0].t;
    cleanAll(rows).forEach((pt) => {
      const v = fin(pt.v) ? f(pt) : null;
      if (fin(v)) out.push([pt.key, v]);
      else if (pt.t >= t0 + lagYears - 1e-9) out.push([pt.key, null]);
    });
    return out;
  }

  // rolling year-on-year change in percent. Compares each point with the same period a year earlier.
  function yoy(rows) {
    const m = mapOf(rows);
    return lagRows(rows, 1, (pt) => {
      const prev = m.get(shiftPeriod(pt, -perYear(pt.freq)));
      return fin(prev) && prev > 0 ? (pt.v / prev - 1) * 100 : null;
    });
  }

  // annualised growth over the trailing `years`, in percent a year
  function rollingCagr(rows, years) {
    if (!Number.isInteger(years) || years < 1) return [];
    const m = mapOf(rows);
    return lagRows(rows, years, (pt) => {
      const prev = m.get(shiftPeriod(pt, -perYear(pt.freq) * years));
      const g = fin(prev) ? cagr(prev, pt.v, years) : null;
      return g == null ? null : g * 100;
    });
  }

  // trailing mean of n consecutive periods; a window with a missing period gives a gap, never a shorter average
  function smooth(rows, n) {
    if (!Number.isInteger(n) || n < 1) return [];
    const m = mapOf(rows), c = clean(rows), step = c.length ? c[0].step : 1;
    return lagRows(rows, (n - 1) * step, (pt) => {
      let s = 0;
      for (let i = 0; i < n; i++) {
        const v = m.get(shiftPeriod(pt, -i));
        if (!fin(v)) return null;
        s += v;
      }
      return s / n;
    });
  }

  // real return of a nominal rate series (percent a year) after CPI inflation, per period of the nominal series.
  // mode 'trailing' (default): inflation over the 12 months to this period. 'forward': over the 12 months after it.
  // An annual nominal series uses annual-average CPI. -> rows of percent
  function realReturnSeries(nominalRows, cpiRows, opts) {
    const mode = (opts && opts.mode) || 'trailing', nom = clean(nominalRows);
    if (!nom.length) return [];
    const annualNom = nom[0].freq === 'A', cpi = annualNom ? annual(cpiRows) : cpiRows, cm = mapOf(cpi), out = [];
    nom.forEach((pt) => {
      const lag = perYear(pt.freq);
      const a = cm.get(mode === 'forward' ? pt.key : shiftPeriod(pt, -lag));
      const b = cm.get(mode === 'forward' ? shiftPeriod(pt, lag) : pt.key);
      if (!fin(a) || !fin(b) || a <= 0) return;
      const r = realReturn(pt.v, (b / a - 1) * 100);
      if (fin(r)) out.push([pt.key, r]);
    });
    return out;
  }

  /* ---------- scalar arithmetic ---------- */
  // growth per year as a fraction, or null when it cannot be defined
  function cagr(v0, v1, years) {
    if (!(v0 > 0) || !(v1 > 0) || !(years > 0)) return null;
    return Math.pow(v1 / v0, 1 / years) - 1;
  }
  // years for a quantity to double, given the ratio over a span of years; null when it did not grow
  function doublingTime(ratio, years) {
    if (!(ratio > 1) || !(years > 0) || !isFinite(ratio)) return null;
    return (years * Math.LN2) / Math.log(ratio);
  }
  // years to double at a steady growth rate (a fraction, 0.039 for 3.9 percent)
  function doublingFromRate(rate) { return rate > 0 ? Math.LN2 / Math.log1p(rate) : null; }
  // the steady growth rate (a fraction) that doubles in `years`
  function rateForDoubling(years) { return years > 0 ? Math.pow(2, 1 / years) - 1 : null; }
  // the rule-of-70 shortcut; ratePct is in percent. Only an approximation.
  function ruleOf70(ratePct) { return ratePct > 0 ? 70 / ratePct : null; }
  // share of its old purchasing power that money keeps: cpi at the start over cpi at the end (a fraction)
  function purchasingPower(cpi0, cpi1) { return cpi0 > 0 && cpi1 > 0 ? cpi0 / cpi1 : null; }
  // the amount at time 1 that buys what `amount` bought at time 0
  function equivalentAmount(amount, cpi0, cpi1) { return cpi0 > 0 && cpi1 > 0 ? (amount * cpi1) / cpi0 : null; }
  function hoursOfWork(price, hourly) { return hourly > 0 && fin(price) ? price / hourly : null; }
  function minutesOfWork(price, hourly) { const h = hoursOfWork(price, hourly); return h == null ? null : h * 60; }
  function workYears(hours, hoursPerYear) { const hy = hoursPerYear > 0 ? hoursPerYear : HOURS_PER_YEAR; return fin(hours) ? hours / hy : null; }
  // exact (Fisher) real return in percent from a nominal rate and an inflation rate, both in percent
  function realReturn(nominalPct, inflationPct) {
    if (!fin(nominalPct) || !fin(inflationPct) || inflationPct <= -100) return null;
    return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
  }
  // interest rate minus nominal growth, in percentage points
  function rMinusG(rPct, gPct) { return fin(rPct) && fin(gPct) ? rPct - gPct : null; }
  // change in the debt ratio over a year, in points of GDP: (r - g) / (1 + g) x debt(t-1) - primary balance
  // (primary balance in points of GDP, a surplus is positive; r and g in percent)
  function debtDynamics(prevDebtPct, rPct, gPct, primaryBalancePct) {
    if (!fin(prevDebtPct) || !fin(rPct) || !fin(gPct) || 100 + gPct <= 0) return null;
    return ((rPct - gPct) / (100 + gPct)) * prevDebtPct - (fin(primaryBalancePct) ? primaryBalancePct : 0);
  }
  // interest paid in year t over debt at the end of year t-1, in percent; both in the same unit (for example dollars)
  function effectiveRate(interest, prevDebt) { return fin(interest) && prevDebt > 0 ? (interest / prevDebt) * 100 : null; }
  // the same rate when both are shares of GDP of their own year: ie(t) / d(t-1) x (1 + g), g the nominal growth in percent
  function effectiveRateFromRatios(ieT, dPrev, nominalGrowthPct) {
    if (!fin(ieT) || !(dPrev > 0) || !fin(nominalGrowthPct)) return null;
    return (ieT / dPrev) * (1 + nominalGrowthPct / 100) * 100;
  }
  function interestToRevenue(interest, revenue) { return fin(interest) && revenue > 0 ? (interest / revenue) * 100 : null; }
  // monthly principal and interest on a fixed-rate loan; ratePct is the yearly nominal rate in percent, down a fraction (0.2)
  function monthlyPayment(price, ratePct, down, years) {
    if (!(price > 0) || !fin(ratePct) || ratePct < 0 || !(years > 0)) return null;
    const loan = price * (1 - (down || 0)), n = years * 12, r = ratePct / 1200;
    if (loan <= 0) return 0;
    return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  }
  function percentChange(v0, v1) { return v0 > 0 && fin(v1) ? (v1 / v0 - 1) * 100 : null; }

  /* ---------- formatting ---------- */
  function commas(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fixed(v, d) {
    let s = Math.abs(v).toFixed(d);
    const neg = v < 0 && +s !== 0;
    const parts = s.split('.');
    s = commas(parts[0]) + (parts[1] ? '.' + parts[1] : '');
    return (neg ? '-' : '') + s;
  }
  // spec: n0..n6, p0..p3, x0..x2, sgn0..sgn3, usd0..usd2, usdbn, yrs1, mins1, hrs0, raw. Output is plain ASCII.
  function format(v, spec) {
    if (typeof v === 'string') return v;
    if (!fin(v)) return 'n/a';
    const m = /^([a-z]+)(\d?)$/.exec(spec || 'n2');
    if (!m) return fixed(v, 2);
    const kind = m[1], d = m[2] === '' ? null : +m[2];
    switch (kind) {
      case 'n': return fixed(v, d == null ? 2 : d);
      case 'p': return fixed(v, d == null ? 1 : d) + '%';
      case 'x': return fixed(v, d == null ? 1 : d) + 'x';
      case 'sgn': { const dd = d == null ? 1 : d, s = fixed(v, dd); return (v > 0 && +Math.abs(v).toFixed(dd) !== 0 ? '+' : '') + s; }
      case 'usd': return (v < 0 ? '-$' : '$') + fixed(Math.abs(v), d == null ? 0 : d);
      case 'usdbn': {
        const a = Math.abs(v), sign = v < 0 ? '-' : '';
        if (a >= 1000) return sign + '$' + fixed(a / 1000, 1) + ' trillion';
        if (a >= 10) return sign + '$' + fixed(a, 0) + ' billion';
        return sign + '$' + fixed(a, 1) + ' billion';
      }
      case 'yrs': return fixed(v, d == null ? 1 : d) + ' years';
      case 'mins': return fixed(v, d == null ? 1 : d) + ' minutes';
      case 'hrs': return fixed(v, d == null ? 0 : d) + ' hours';
      case 'raw': return String(v);
      default: return fixed(v, 2);
    }
  }

  /* ---------- rules ---------- */
  // series tokens used by the shipped data; a page or a data file can add more with ctx.alias
  const DEFAULT_ALIASES = {
    cpi: 'cpi_u', pay: 'pay_prod', house: 'house_new_median_annual', hpi: 'fhfa_hpi', income: 'income_median',
    mortgage: 'mortgage30', tbill: 'tbill3m', eggs: 'price_eggs', bread: 'price_bread', milk: 'price_milk',
    gas: 'price_gasoline', farmland: 'farmland_acre', stamp: 'stamp',
    m2: 'hist:usM2', gdp: 'hist:usGDP', gold: 'hist:goldPrice', fedDebt: 'hist:usDebt',
  };

  function fail(error, message) { return { error, message }; }

  // a window token against one series: { v, key, t, basis: 'year'|'point' } or { error, message }
  function endPoint(rows, tok, role) {
    if (tok === 'latest') {
      const p = latest(rows);
      return p ? { v: p.v, key: p.key, t: p.t, basis: 'point', label: periodLabel(p) } : fail('no-data', 'the series has no data');
    }
    // "latest-10y": the observation 10 years before the newest one (the same month, quarter or year); a start only
    const back = /^latest-(\d{1,3})y$/.exec(tok);
    if (back) {
      if (role !== 'start') return fail('bad-args', tok + ' can only start a window');
      const p = latest(rows);
      if (!p) return fail('no-data', 'the series has no data');
      const key = shiftPeriod(p, -perYear(p.freq) * +back[1]), v = at(rows, key);
      return fin(v) ? { v, key, t: parsePeriod(key).t, basis: 'point', label: periodLabel(key) } : fail('no-data', 'no value for ' + periodLabel(key));
    }
    let y;
    if (tok === 'lastfull') y = lastFullYear(rows);
    else if (/^last\d{1,3}$/.test(tok)) {
      if (role !== 'start') return fail('bad-args', tok + ' can only start a window');
      const e = lastFullYear(rows);
      y = e == null ? null : e - +tok.slice(4);
    } else y = null;
    if (y == null && (tok === 'lastfull' || /^last\d/.test(tok))) return fail('no-data', 'the series has no complete year');
    if (y != null) tok = String(y);
    const part = /^(\d{4})p$/.exec(tok);
    if (part) {
      // the average of the months available in that year; a part year counts (the label says so)
      const whole = annual(rows).some((r) => r[0] === part[1]), hit = annual(rows, { partial: true }).find((r) => r[0] === part[1]);
      if (!hit) return fail('no-data', 'no value in ' + part[1]);
      return { v: hit[1], key: part[1], t: +part[1], basis: 'year', label: part[1] + (whole ? '' : ' (part year)') };
    }
    const per = parsePeriod(tok);
    if (!per) return fail('bad-args', '"' + tok + '" is not a year, a period, latest or lastfull');
    if (per.freq === 'A') {
      const a = annual(rows), hit = a.find((r) => r[0] === per.key);
      if (!hit) return fail('no-data', 'no complete year ' + per.key + ' in the series');
      return { v: hit[1], key: per.key, t: per.t, basis: 'year', label: per.key };
    }
    const v = at(rows, per.key);
    if (!fin(v)) return fail('no-data', 'no value for ' + periodLabel(per));
    return { v, key: per.key, t: per.t, basis: 'point', label: periodLabel(per) };
  }

  // two ends of a window on one series. -> { v0, v1, years, p0, p1, basis } or { error, message }
  function windowValues(rows, startTok, endTok) {
    const a = endPoint(rows, startTok, 'start');
    if (a.error) return a;
    const b = endPoint(rows, endTok || 'lastfull', 'end');
    if (b.error) return b;
    if (a.basis !== b.basis) return fail('mixed-basis', 'a window needs the same basis at both ends: use two years, or two months (YYYY-MM) with latest');
    const years = b.t - a.t;
    if (!(years > 0)) return fail('bad-args', 'the window must end after it starts');
    return { v0: a.v, v1: b.v, years, p0: a.label, p1: b.label, basis: a.basis };
  }

  // one value of a series at a year or period, annual average for a year of finer rows
  function valueAtToken(rows, tok) {
    const e = endPoint(rows, tok, 'end');
    return e.error ? e : { v: e.v, label: e.label, key: e.key, basis: e.basis };
  }

  // two series at the same `when` (year, period, latest or lastfull). Years use annual averages of each, a period
  // needs the same key in both, latest takes the newest key present in both.
  function pairAt(rowsA, rowsB, when) {
    if (when === 'latest') {
      const mb = mapOf(rowsB), ca = clean(rowsA);
      for (let i = ca.length - 1; i >= 0; i--) {
        const bv = mb.get(ca[i].key);
        if (fin(bv)) return { a: ca[i].v, b: bv, label: periodLabel(ca[i]), key: ca[i].key };
      }
      return fail('no-common-period', 'the two series share no period; use lastfull or a year');
    }
    let tok = when;
    if (when === 'lastfull') {
      const ya = lastFullYear(rowsA), yb = lastFullYear(rowsB);
      if (ya == null || yb == null) return fail('no-data', 'a series has no complete year');
      tok = String(Math.min(ya, yb));
    }
    const a = valueAtToken(rowsA, tok), b = valueAtToken(rowsB, tok);
    if (a.error) return a;
    if (b.error) return b;
    return { a: a.v, b: b.v, label: a.label, key: a.key };
  }

  const RULES = {};
  function rule(name, spec) { RULES[name] = spec; }

  function getRows(ctx, sid) {
    const id = ctx.alias && own(ctx.alias, sid) ? ctx.alias[sid] : own(DEFAULT_ALIASES, sid) ? DEFAULT_ALIASES[sid] : sid;
    const rows = ctx.series ? ctx.series(id) : null;
    return { id, rows: Array.isArray(rows) && rows.length ? rows : null };
  }

  // window rules share one body; calc(w) turns the two end values into the result
  function windowRule(name, doc, unit, fmt, calc) {
    rule(name, {
      doc, unit, fmt, args: [1, 2], argDoc: 'start [end]: years, periods, lastN; end defaults to lastfull',
      run(ctx, sid, args) {
        const s = getRows(ctx, sid);
        if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
        const w = windowValues(s.rows, args[0], args[1]);
        if (w.error) return w;
        const value = calc(w);
        if (value == null) return fail('undefined', name + ' is not defined for these values (a start or end value is not positive, or there was no growth)');
        return { value, unit, period: w.p0 + ' to ' + w.p1, ids: [s.id], inputs: [w.v0, w.v1, w.years] };
      },
    });
  }
  windowRule('cagr', 'compound growth per year, in percent', '% a year', 'p2', (w) => { const g = cagr(w.v0, w.v1, w.years); return g == null ? null : g * 100; });
  windowRule('doubling', 'years for the value to double at the window\'s average growth', 'years', 'n1', (w) => doublingTime(w.v1 / w.v0, w.years));
  windowRule('ratio', 'end value divided by start value', 'times', 'x1', (w) => (w.v0 > 0 ? w.v1 / w.v0 : null));
  windowRule('pct', 'percent change from start to end', '%', 'p1', (w) => percentChange(w.v0, w.v1));
  windowRule('power', 'percent of its starting purchasing power that money keeps (use on a price index)', '%', 'p1', (w) => { const p = purchasingPower(w.v0, w.v1); return p == null ? null : p * 100; });
  windowRule('diff', 'end value minus start value, in the series unit', 'unit', 'sgn1', (w) => w.v1 - w.v0);

  rule('latest', {
    doc: 'newest observation', unit: 'unit', fmt: 'n2', args: [0, 0], argDoc: '',
    run(ctx, sid) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const p = latest(s.rows);
      return p ? { value: p.v, period: periodLabel(p), ids: [s.id] } : fail('no-data', 'the series has no data');
    },
  });
  rule('latestperiod', {
    doc: 'label of the newest observation, such as "Aug 2026"', unit: 'text', fmt: 'raw', args: [0, 0], argDoc: '',
    run(ctx, sid) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const p = latest(s.rows);
      return p ? { value: periodLabel(p), period: periodLabel(p), ids: [s.id] } : fail('no-data', 'the series has no data');
    },
  });
  rule('firstperiod', {
    doc: 'label of the first observation', unit: 'text', fmt: 'raw', args: [0, 0], argDoc: '',
    run(ctx, sid) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const p = first(s.rows);
      return p ? { value: periodLabel(p), period: periodLabel(p), ids: [s.id] } : fail('no-data', 'the series has no data');
    },
  });
  rule('value', {
    doc: 'value at a year (annual average) or period', unit: 'unit', fmt: 'n2', args: [1, 1], argDoc: 'year | period | latest | lastfull',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const v = valueAtToken(s.rows, args[0]);
      return v.error ? v : { value: v.v, period: v.label, ids: [s.id] };
    },
  });
  rule('yoy', {
    doc: 'year-on-year change in percent (annual averages for a year, single months for a period)', unit: '%', fmt: 'p1', args: [1, 1], argDoc: 'year | period | latest | lastfull',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      let tok = args[0], rows = s.rows;
      if (tok === 'latest') tok = (latest(rows) || {}).key;
      else if (tok === 'lastfull') tok = String(lastFullYear(rows));
      const per = parsePeriod(tok);
      if (!per) return fail('bad-args', '"' + args[0] + '" is not a year or period');
      if (per.freq === 'A') rows = annual(rows);
      const hit = yoy(rows).find((r) => r[0] === per.key);
      if (!hit || hit[1] == null) return fail('no-data', 'no year-on-year change for ' + periodLabel(per));
      return { value: hit[1], period: periodLabel(per), ids: [s.id] };
    },
  });
  rule('rollcagr', {
    doc: 'annualised growth over the trailing N years, in percent a year', unit: '% a year', fmt: 'p2', args: [1, 2], argDoc: 'years [end]: end defaults to lastfull',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const n = +args[0];
      if (!Number.isInteger(n) || n < 1) return fail('bad-args', 'years must be a whole number');
      const e = endPoint(s.rows, args[1] || 'lastfull', 'end');
      if (e.error) return e;
      const start = shiftPeriod(e.key, -perYear(parsePeriod(e.key).freq) * n);
      const v0 = at(e.basis === 'year' ? annual(s.rows) : s.rows, start);
      const g = fin(v0) ? cagr(v0, e.v, n) : null;
      return g == null ? fail('no-data', 'no value ' + n + ' years before ' + e.label) : { value: g * 100, period: periodLabel(start) + ' to ' + e.label, ids: [s.id] };
    },
  });
  rule('hours', {
    doc: 'hours of work to earn the price (this series) at the hourly pay series, same period', unit: 'hours', fmt: 'n0', args: [2, 2], argDoc: 'pay when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => hoursOfWork(a, b), 'hours'); },
  });
  rule('minutes', {
    doc: 'minutes of work to earn the price (this series) at the hourly pay series, same period', unit: 'minutes', fmt: 'n1', args: [2, 2], argDoc: 'pay when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => minutesOfWork(a, b), 'minutes'); },
  });
  rule('workyears', {
    doc: 'years of full-time work (hours / hours per year) to earn the price', unit: 'years', fmt: 'n1', args: [2, 3], argDoc: 'pay when [hoursPerYear=2080]',
    run(ctx, sid, args) {
      const hy = args[2] != null ? +args[2] : HOURS_PER_YEAR;
      if (!(hy > 0)) return fail('bad-args', 'hours per year must be positive');
      return pairRule(ctx, sid, args, (a, b) => workYears(hoursOfWork(a, b), hy), 'years');
    },
  });
  rule('per', {
    doc: 'this series divided by another in the same period (for example house price over household income)', unit: 'ratio', fmt: 'n2', args: [2, 2], argDoc: 'denominator when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => (b === 0 ? null : a / b), 'ratio'); },
  });
  rule('share', {
    doc: 'this series as a percent of another in the same period (for example M2 over GDP)', unit: '%', fmt: 'p1', args: [2, 2], argDoc: 'denominator when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => (b === 0 ? null : (a / b) * 100), '%'); },
  });
  function pairRule(ctx, sid, args, fn, unit) {
    const a = getRows(ctx, sid), b = getRows(ctx, args[0]);
    if (!a.rows) return fail('no-series', 'no data for "' + sid + '"');
    if (!b.rows) return fail('no-series', 'no data for "' + args[0] + '"');
    const p = pairAt(a.rows, b.rows, args[1]);
    if (p.error) return p;
    const value = fn(p.a, p.b);
    return value == null ? fail('undefined', 'not defined for these values') : { value, unit, period: p.label, ids: [a.id, b.id], inputs: [p.a, p.b] };
  }

  rule('max', {
    doc: 'highest annual value between two years', unit: 'unit', fmt: 'n1', args: [0, 2], argDoc: '[start end]',
    run(ctx, sid, args) { return extreme(ctx, sid, args, 1, false); },
  });
  rule('min', {
    doc: 'lowest annual value between two years', unit: 'unit', fmt: 'n1', args: [0, 2], argDoc: '[start end]',
    run(ctx, sid, args) { return extreme(ctx, sid, args, -1, false); },
  });
  rule('maxyear', {
    doc: 'the year of the highest annual value between two years', unit: 'year', fmt: 'raw', args: [0, 2], argDoc: '[start end]',
    run(ctx, sid, args) { return extreme(ctx, sid, args, 1, true); },
  });
  rule('minyear', {
    doc: 'the year of the lowest annual value between two years', unit: 'year', fmt: 'raw', args: [0, 2], argDoc: '[start end]',
    run(ctx, sid, args) { return extreme(ctx, sid, args, -1, true); },
  });
  function extreme(ctx, sid, args, dir, wantYear) {
    const s = getRows(ctx, sid);
    if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
    const a = annual(s.rows);
    const y0 = args[0] != null ? +args[0] : -Infinity, y1 = args[1] != null && args[1] !== 'lastfull' ? +args[1] : Infinity;
    let best = null;
    a.forEach((r) => {
      const y = +r[0];
      if (y < y0 || y > y1) return;
      if (best == null || (dir > 0 ? r[1] > best[1] : r[1] < best[1])) best = r;
    });
    if (!best) return fail('no-data', 'no complete year in that range');
    return { value: wantYear ? best[0] : best[1], period: best[0], ids: [s.id] };
  }

  /* real return on a nominal rate series (this series, percent a year) after CPI inflation, by calendar year */
  function realByYear(ctx, sid, cpiTok, partial) {
    const s = getRows(ctx, sid), c = getRows(ctx, cpiTok);
    if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
    if (!c.rows) return fail('no-series', 'no data for "' + cpiTok + '"');
    // partial: a part year of prices counts, as it does for the newest year on the Start and Prices pages
    const rows = realReturnSeries(annual(s.rows), partial ? annual(c.rows, { partial: true }) : c.rows);
    return { rows, ids: [s.id, c.id] };
  }
  rule('realreturn', {
    doc: 'real return after inflation in percent: a year uses the annual mean rate and the change in annual-average CPI, a month uses the rate and CPI inflation over the 12 months to it',
    unit: '%', fmt: 'p2', args: [2, 2], argDoc: 'cpi when',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid), c = getRows(ctx, args[0]);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!c.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      let tok = args[1];
      if (tok === 'latest') tok = (latest(s.rows) || {}).key;
      else if (tok === 'lastfull') tok = String(Math.min(lastFullYear(s.rows) || 0, lastFullYear(c.rows) || 0));
      const per = parsePeriod(tok);
      if (!per) return fail('bad-args', '"' + args[1] + '" is not a year or period');
      const rows = per.freq === 'A' ? realReturnSeries(annual(s.rows), c.rows) : realReturnSeries(s.rows, c.rows);
      const hit = rows.find((r) => r[0] === per.key);
      return hit ? { value: hit[1], period: periodLabel(per), ids: [s.id, c.id] } : fail('no-data', 'no real return for ' + periodLabel(per));
    },
  });
  function realRange(ctx, sid, args) {
    const end = /^(\d{4})(p?)$/.exec(String(args[2]));
    const r = realByYear(ctx, sid, args[0], !!(end && end[2]));
    if (r.error) return r;
    const y0 = +args[1], y1 = end ? +end[1] : NaN;
    if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0) return fail('bad-args', 'give a start year and an end year');
    const rows = r.rows.filter((x) => +x[0] >= y0 && +x[0] <= y1);
    if (!rows.length) return fail('no-data', 'no real returns between ' + y0 + ' and ' + y1);
    return { rows, ids: r.ids, period: rows[0][0] + ' to ' + rows[rows.length - 1][0] };
  }
  // the gap between a bill's investment (bond-equivalent) yield and its discount rate, for a 91-day bill, in percentage points
  const BILL_DAYS = 91;
  function billYield(discountPct) {
    const d = discountPct / 100;
    return (100 * 365 * d) / (360 - d * BILL_DAYS);
  }
  rule('yieldgap', {
    doc: 'mean over the years of the investment (bond-equivalent) yield of a 91-day bill minus its published discount rate, in percentage points; the series must be monthly discount rates. Each year needs all twelve months',
    unit: 'points', fmt: 'n2', args: [2, 2], argDoc: 'start end: years, both included',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const y0 = +args[0], y1 = +args[1];
      if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0) return fail('bad-args', 'give a start year and an end year');
      const byYear = new Map();
      clean(s.rows).forEach((pt) => {
        if (pt.freq !== 'M' || pt.y < y0 || pt.y > y1) return;
        const e = byYear.get(pt.y) || { d: 0, g: 0, n: 0 };
        e.d += pt.v; e.g += billYield(pt.v) - pt.v; e.n++;
        byYear.set(pt.y, e);
      });
      const gaps = Array.from(byYear.values()).filter((e) => e.n === 12).map((e) => e.g / 12);
      if (!gaps.length) return fail('no-data', 'no complete year between ' + y0 + ' and ' + y1);
      return { value: gaps.reduce((a, b) => a + b, 0) / gaps.length, period: y0 + ' to ' + y1, ids: [s.id] };
    },
  });

  // doubling time from January of each start year to the newest month, for a monthly series
  function janDoublings(rows, y0, y1) {
    const last = latest(rows), m = mapOf(rows), out = [];
    if (!last || last.freq !== 'M') return null;
    for (let y = y0; y <= y1; y++) {
      const v0 = m.get(y + '-01');
      if (!fin(v0) || !(v0 > 0)) continue;
      const d = doublingTime(last.v / v0, last.t - y);
      out.push({ y, d });
    }
    return out;
  }
  rule('startyears', {
    doc: 'how many January start years between two years have a value, for a monthly series (the count startcount is out of)', unit: 'years', fmt: 'n0', args: [2, 2], argDoc: 'first last',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const y0 = +args[0], y1 = +args[1];
      if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0) return fail('bad-args', 'give a first and a last year');
      const r = janDoublings(s.rows, y0, y1);
      if (!r || !r.length) return fail('no-data', 'no January start years in that range');
      return { value: r.length, period: y0 + ' to ' + y1, ids: [s.id] };
    },
  });
  rule('startfit', {
    doc: 'how many January start years between two years give a doubling time to the newest month within the pace tolerance of 17 years (PACE_YEARS and PACE_TOLERANCE)', unit: 'years', fmt: 'n0', args: [2, 2], argDoc: 'first last',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const y0 = +args[0], y1 = +args[1];
      if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0) return fail('bad-args', 'give a first and a last year');
      const r = janDoublings(s.rows, y0, y1);
      if (!r || !r.length) return fail('no-data', 'no January start years in that range');
      return { value: r.filter((x) => paceVerdict(x.d, true) === 'about').length, period: y0 + ' to ' + y1, ids: [s.id] };
    },
  });
  rule('startcount', {
    doc: 'how many January start years between two years give a doubling time to the newest month between lo and hi years (a series that did not grow counts as never doubling)', unit: 'years', fmt: 'n0', args: [4, 4], argDoc: 'first last lo hi',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const y0 = +args[0], y1 = +args[1], lo = +args[2], hi = +args[3];
      if (!Number.isInteger(y0) || !Number.isInteger(y1) || y1 < y0 || !fin(lo) || !fin(hi) || hi < lo) return fail('bad-args', 'give a first year, a last year, and lo and hi in years');
      const r = janDoublings(s.rows, y0, y1);
      if (!r || !r.length) return fail('no-data', 'no January start years in that range');
      return { value: r.filter((x) => x.d != null && x.d >= lo && x.d <= hi).length, period: y0 + ' to ' + y1, ids: [s.id] };
    },
  });

  rule('realavg', {
    doc: 'mean of the yearly real returns between two years, in percent', unit: '%', fmt: 'p2', args: [3, 3], argDoc: 'cpi start end: end may be 2025p to count a part year of prices',
    run(ctx, sid, args) {
      const r = realRange(ctx, sid, args);
      return r.error ? r : { value: r.rows.reduce((s, x) => s + x[1], 0) / r.rows.length, period: r.period, ids: r.ids };
    },
  });
  rule('realneg', {
    doc: 'number of years with a negative real return between two years', unit: 'years', fmt: 'n0', args: [3, 3], argDoc: 'cpi start end',
    run(ctx, sid, args) {
      const r = realRange(ctx, sid, args);
      return r.error ? r : { value: r.rows.filter((x) => x[1] < 0).length, period: r.period, ids: r.ids };
    },
  });
  rule('realyears', {
    doc: 'number of years with a real return between two years (the count realneg is out of)', unit: 'years', fmt: 'n0', args: [3, 3], argDoc: 'cpi start end',
    run(ctx, sid, args) {
      const r = realRange(ctx, sid, args);
      return r.error ? r : { value: r.rows.length, period: r.period, ids: r.ids };
    },
  });

  /* added for data/principles.js text */
  rule('plus', {
    doc: 'this series plus another in the same period (for example household plus corporate credit, both in percent of GDP)', unit: 'unit', fmt: 'n1', args: [2, 2], argDoc: 'other when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => a + b, 'unit'); },
  });
  rule('plus3', {
    doc: 'this series plus two others in the same period (for example household, company and government credit, all in percent of GDP)', unit: 'unit', fmt: 'n1', args: [3, 3], argDoc: 'other1 other2 when',
    run(ctx, sid, args) {
      const a = getRows(ctx, sid), b = getRows(ctx, args[0]), c = getRows(ctx, args[1]);
      if (!a.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!b.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      if (!c.rows) return fail('no-series', 'no data for "' + args[1] + '"');
      const p = pairAt(a.rows, b.rows, args[2]), q = pairAt(a.rows, c.rows, args[2]);
      if (p.error) return p;
      if (q.error) return q;
      return { value: p.a + p.b + q.b, unit: 'unit', period: p.label, ids: [a.id, b.id, c.id], inputs: [p.a, p.b, q.b] };
    },
  });
  rule('minus', {
    doc: 'this series minus another in the same period (for example federal outlays minus receipts, both in the same unit)', unit: 'unit', fmt: 'n1', args: [2, 2], argDoc: 'other when',
    run(ctx, sid, args) { return pairRule(ctx, sid, args, (a, b) => a - b, 'unit'); },
  });
  rule('inbn', {
    doc: 'value in billions for a series stored in single units (for example US dollars): value / 1e9, for the usdbn format', unit: 'billions', fmt: 'usdbn', args: [1, 1], argDoc: 'year | period | latest | lastfull',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      const v = valueAtToken(s.rows, args[0]);
      return v.error ? v : { value: v.v / 1e9, period: v.label, ids: [s.id] };
    },
  });
  // the end of a window for two series: lastfull is the earlier of their last full years, latest the newest period both have
  function commonEnd(rowsA, rowsB, tok) {
    const t = tok || 'lastfull';
    if (t === 'lastfull') {
      const ya = lastFullYear(rowsA), yb = lastFullYear(rowsB);
      return ya == null || yb == null ? fail('no-data', 'a series has no complete year') : String(Math.min(ya, yb));
    }
    if (t === 'latest') {
      const mb = mapOf(rowsB), ca = clean(rowsA);
      for (let i = ca.length - 1; i >= 0; i--) if (fin(mb.get(ca[i].key))) return ca[i].key;
      return fail('no-common-period', 'the two series share no period; use lastfull or a year');
    }
    return t;
  }
  rule('realchange', {
    doc: 'percent change of this series over a window after removing the change in a price series over the same window',
    unit: '%', fmt: 'sgn1', args: [2, 3], argDoc: 'cpi start [end]: end defaults to the last year both series complete; lastN and latest-Ny count back from that end',
    run(ctx, sid, args) {
      const s = getRows(ctx, sid), c = getRows(ctx, args[0]);
      if (!s.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!c.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      const endTok = commonEnd(s.rows, c.rows, args[2]);
      if (typeof endTok !== 'string') return endTok;
      let startTok = args[1];
      const rel = /^(?:last(\d{1,3})|latest-(\d{1,3})y)$/.exec(startTok), e = parsePeriod(endTok);
      if (rel) {
        if (!e) return fail('bad-args', '"' + endTok + '" is not a year or period');
        if (rel[1] != null && e.freq !== 'A') return fail('bad-args', 'lastN needs a year as the end of the window');
        startTok = e.freq === 'A' ? String(e.y - +(rel[1] != null ? rel[1] : rel[2])) : shiftPeriod(e, -perYear(e.freq) * +rel[2]);
      }
      const a = windowValues(s.rows, startTok, endTok), b = windowValues(c.rows, startTok, endTok);
      if (a.error) return a;
      if (b.error) return b;
      if (!(a.v0 > 0) || !(b.v0 > 0) || !(b.v1 > 0)) return fail('undefined', 'realchange is not defined for these values (a start or end value is not positive)');
      return { value: ((a.v1 / a.v0) / (b.v1 / b.v0) - 1) * 100, period: a.p0 + ' to ' + a.p1, ids: [s.id, c.id], inputs: [a.v0, a.v1, b.v0, b.v1] };
    },
  });

  // natural log of end over start for one series and a window; { l, p0, p1 } or an error
  function logRatio(rows, startTok, endTok) {
    const w = windowValues(rows, startTok, endTok);
    if (w.error) return w;
    if (!(w.v0 > 0) || !(w.v1 > 0)) return fail('undefined', 'a start or end value is not positive');
    return { l: Math.log(w.v1 / w.v0), p0: w.p0, p1: w.p1 };
  }
  rule('logshare', {
    doc: "percent of the growth of this series, on a log scale, that the growth of another series over the same window accounts for: 100 x ln(other ratio) / ln(this ratio)",
    unit: '%', fmt: 'p0', args: [3, 3], argDoc: 'other start end: years, or 2025p for a part year',
    run(ctx, sid, args) {
      const a = getRows(ctx, sid), b = getRows(ctx, args[0]);
      if (!a.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!b.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      const la = logRatio(a.rows, args[1], args[2]), lb = logRatio(b.rows, args[1], args[2]);
      if (la.error) return la;
      if (lb.error) return lb;
      if (!(Math.abs(la.l) > 1e-12)) return fail('undefined', 'this series did not change over the window');
      return { value: (100 * lb.l) / la.l, period: la.p0 + ' to ' + la.p1, ids: [a.id, b.id] };
    },
  });
  rule('logshare2', {
    doc: "percent of the growth of this series, on a log scale, by which the growth of A exceeds the growth of B: 100 x (ln(A ratio) - ln(B ratio)) / ln(this ratio). A may be the series itself",
    unit: '%', fmt: 'p0', args: [4, 4], argDoc: 'A B start end: years, or 2025p for a part year',
    run(ctx, sid, args) {
      const t = getRows(ctx, sid), a = getRows(ctx, args[0]), b = getRows(ctx, args[1]);
      if (!t.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!a.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      if (!b.rows) return fail('no-series', 'no data for "' + args[1] + '"');
      const lt = logRatio(t.rows, args[2], args[3]), la = logRatio(a.rows, args[2], args[3]), lb = logRatio(b.rows, args[2], args[3]);
      if (lt.error) return lt;
      if (la.error) return la;
      if (lb.error) return lb;
      if (!(Math.abs(lt.l) > 1e-12)) return fail('undefined', 'this series did not change over the window');
      return { value: (100 * (la.l - lb.l)) / lt.l, period: lt.p0 + ' to ' + lt.p1, ids: [t.id, a.id, b.id] };
    },
  });
  rule('atrate', {
    doc: 'this series as a percent of a denominator series in a base year, scaled by the rate series in a scenario year over the same rate series in the base year: what the share would be at the other rate, with everything else unchanged',
    unit: '%', fmt: 'p1', args: [4, 4], argDoc: 'denominator rate baseYear scenarioYear',
    run(ctx, sid, args) {
      const a = getRows(ctx, sid), d = getRows(ctx, args[0]), r = getRows(ctx, args[1]);
      if (!a.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!d.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      if (!r.rows) return fail('no-series', 'no data for "' + args[1] + '"');
      const base = pairAt(a.rows, d.rows, args[2]);
      if (base.error) return base;
      const r0 = valueAtToken(r.rows, args[2]), r1 = valueAtToken(r.rows, args[3]);
      if (r0.error) return r0;
      if (r1.error) return r1;
      if (!(base.b !== 0) || !(r0.v > 0)) return fail('undefined', 'not defined for these values');
      return { value: (base.a / base.b) * 100 * (r1.v / r0.v), period: base.label + ' at the ' + r1.label + ' rate', ids: [a.id, d.id, r.id], inputs: [base.a, base.b, r0.v, r1.v] };
    },
  });

  /* debt: this series is interest paid in points of GDP; the arguments are debt (points of GDP) and nominal growth (percent) */
  function effRateAt(ctx, sid, args) {
    const i = getRows(ctx, sid), d = getRows(ctx, args[0]), g = getRows(ctx, args[1]);
    if (!i.rows) return fail('no-series', 'no data for "' + sid + '"');
    if (!d.rows) return fail('no-series', 'no data for "' + args[0] + '"');
    if (!g.rows) return fail('no-series', 'no data for "' + args[1] + '"');
    const im = mapOf(i.rows), dm = mapOf(d.rows), gm = mapOf(g.rows);
    let year;
    if (args[2] === 'latest' || args[2] === 'lastfull') {
      const ys = clean(i.rows).filter((pt) => pt.freq === 'A' && fin(dm.get(String(pt.y - 1))) && fin(gm.get(pt.key))).map((pt) => pt.y);
      year = ys.length ? ys[ys.length - 1] : null;
    } else year = +args[2];
    if (!Number.isInteger(year)) return fail('bad-args', 'give a year, latest or lastfull');
    const r = effectiveRateFromRatios(im.get(String(year)), dm.get(String(year - 1)), gm.get(String(year)));
    if (r == null) return fail('no-data', 'missing interest, prior-year debt or growth for ' + year);
    return { r, g: gm.get(String(year)), year, ids: [i.id, d.id, g.id] };
  }
  rule('effrate', {
    doc: 'effective interest rate in percent: interest(t) / debt(t-1) x (1 + nominal growth), from shares of GDP', unit: '%', fmt: 'p2', args: [3, 3], argDoc: 'debt growth year',
    run(ctx, sid, args) { const e = effRateAt(ctx, sid, args); return e.error ? e : { value: e.r, period: String(e.year), ids: e.ids }; },
  });
  // US federal interest in dollars over the debt held by the public at the end of the year before (a share of GDP of that year)
  rule('effratefy', {
    doc: 'effective interest rate in percent for a fiscal year: net interest in dollars divided by debt held by the public at the end of the year before, which is a share of that year\'s GDP times that GDP in dollars', unit: '%', fmt: 'p2', args: [3, 3], argDoc: 'debtShare gdp year',
    run(ctx, sid, args) {
      const i = getRows(ctx, sid), d = getRows(ctx, args[0]), g = getRows(ctx, args[1]);
      if (!i.rows) return fail('no-series', 'no data for "' + sid + '"');
      if (!d.rows) return fail('no-series', 'no data for "' + args[0] + '"');
      if (!g.rows) return fail('no-series', 'no data for "' + args[1] + '"');
      const y = +args[2];
      if (!Number.isInteger(y)) return fail('bad-args', 'give a year');
      const iv = at(i.rows, String(y)), dv = at(d.rows, String(y - 1)), gv = at(g.rows, String(y - 1));
      const r = fin(iv) && fin(dv) && fin(gv) && dv > 0 && gv > 0 ? effectiveRate(iv, (dv / 100) * gv) : null;
      return r == null ? fail('no-data', 'missing interest, prior-year debt or GDP for ' + y) : { value: r, period: String(y), ids: [i.id, d.id, g.id] };
    },
  });
  rule('rmg', {
    doc: 'effective interest rate minus nominal growth, in percentage points', unit: 'points', fmt: 'sgn2', args: [3, 3], argDoc: 'debt growth year',
    run(ctx, sid, args) { const e = effRateAt(ctx, sid, args); return e.error ? e : { value: rMinusG(e.r, e.g), period: String(e.year), ids: e.ids }; },
  });

  rule('payment', {
    doc: 'monthly principal and interest on this price at a mortgage rate series, in dollars', unit: 'dollars', fmt: 'usd0', args: [4, 4], argDoc: 'rate downPct years when',
    run(ctx, sid, args) {
      const down = +args[1], years = +args[2];
      if (!(down >= 0 && down < 100) || !(years > 0)) return fail('bad-args', 'give the down payment in percent and the term in years');
      return pairRule(ctx, sid, [args[0], args[3]], (price, rate) => monthlyPayment(price, rate, down / 100, years), 'dollars');
    },
  });

  // rules that take only numbers; the series token is the word calc
  rule('rate_for_doubling', {
    doc: 'steady growth in percent a year that doubles in N years', unit: '% a year', fmt: 'p2', args: [1, 1], argDoc: 'years', calc: true,
    run(ctx, sid, args) { const r = rateForDoubling(+args[0]); return r == null ? fail('bad-args', 'years must be positive') : { value: r * 100, ids: [] }; },
  });
  rule('doubling_from_rate', {
    doc: 'years to double at a steady growth rate given in percent a year', unit: 'years', fmt: 'n1', args: [1, 1], argDoc: 'percent', calc: true,
    run(ctx, sid, args) { const r = doublingFromRate(+args[0] / 100); return r == null ? fail('bad-args', 'the rate must be positive') : { value: r, ids: [] }; },
  });
  rule('rule70', {
    doc: 'rule-of-70 shortcut: 70 / percent a year', unit: 'years', fmt: 'n1', args: [1, 1], argDoc: 'percent', calc: true,
    run(ctx, sid, args) { const r = ruleOf70(+args[0]); return r == null ? fail('bad-args', 'the rate must be positive') : { value: r, ids: [] }; },
  });
  rule('hours_per_year', {
    doc: 'the working-hours assumption behind work-years (40 hours x 52 weeks)', unit: 'hours', fmt: 'n0', args: [0, 0], argDoc: '', calc: true,
    run() { return { value: HOURS_PER_YEAR, ids: [] }; },
  });

  function knownRules() { return Object.keys(RULES).sort(); }
  function ruleInfo(name) {
    if (!own(RULES, name)) return null;
    const r = RULES[name];
    return { name, doc: r.doc, unit: r.unit, fmt: r.fmt, minArgs: r.args[0], maxArgs: r.args[1], args: r.argDoc, calc: !!r.calc };
  }

  /* ---------- placeholders ---------- */
  // "{{a.b.c|n1}}" or "a.b.c|n1" -> { body, series, rule, args, fmt } or null
  function parsePlaceholder(ph) {
    if (typeof ph !== 'string') return null;
    let body = ph.trim();
    const m = /^\{\{\s*([\s\S]*?)\s*\}\}$/.exec(body);
    if (m) body = m[1];
    if (!body || /[\s{}]/.test(body.split('|')[0])) return null;
    const bar = body.split('|'), spec = bar.length > 1 ? bar[1] : null;
    if (bar.length > 2) return null;
    const parts = bar[0].split('.');
    if (parts.length < 2 || parts.some((x) => x === '')) return null;
    return { body: bar[0] + (spec ? '|' + spec : ''), series: parts[0], rule: parts[1], args: parts.slice(2), fmt: spec };
  }

  function placeholders(template) {
    const out = [], re = /\{\{([^{}]*)\}\}/g;
    let m;
    while ((m = re.exec(String(template == null ? '' : template)))) out.push(m[1].trim());
    return out;
  }

  // resolve one placeholder against ctx. Never throws.
  function resolve(ph, ctx) {
    const p = parsePlaceholder(ph);
    const base = { ok: false, placeholder: ph, text: 'n/a', value: null };
    if (!p) return Object.assign(base, { error: 'bad-placeholder', message: 'expected series.rule[.arg...][|fmt]' });
    if (!own(RULES, p.rule)) return Object.assign(base, { error: 'unknown-rule', message: 'no rule named "' + p.rule + '"' });
    const r = RULES[p.rule];
    if (!!r.calc !== (p.series === 'calc')) {
      return Object.assign(base, { error: 'bad-args', message: r.calc ? p.rule + ' takes the series word "calc"' : p.rule + ' needs a series, not "calc"' });
    }
    if (p.args.length < r.args[0] || p.args.length > r.args[1]) {
      return Object.assign(base, { error: 'bad-args', message: p.rule + ' takes ' + (r.args[0] === r.args[1] ? r.args[0] : r.args[0] + ' to ' + r.args[1]) + ' argument(s): ' + (r.argDoc || 'none') });
    }
    if (p.fmt != null && !/^(n[0-6]|p[0-3]|x[0-2]|sgn[0-3]|usd[0-2]|usdbn|yrs\d?|mins\d?|hrs\d?|raw)$/.test(p.fmt)) {
      return Object.assign(base, { error: 'bad-format', message: 'unknown format "' + p.fmt + '"' });
    }
    let res;
    try { res = r.run(ctx || {}, p.series, p.args); } catch (e) { res = fail('internal', String(e && e.message || e)); }
    if (res.error) return Object.assign(base, { rule: p.rule, series: p.series, error: res.error, message: res.message });
    const ids = res.ids || [];
    let meta = null;
    if (ctx && ctx.meta && ids.length) meta = ctx.meta(ids[0]);
    return {
      ok: true, placeholder: ph, rule: p.rule, series: ids.length ? ids : [p.series], args: p.args,
      value: res.value, unit: res.unit || r.unit, period: res.period || null, inputs: res.inputs || null,
      text: format(res.value, p.fmt || r.fmt),
      asOf: meta ? meta.asOf || meta.retrieved || null : null,
      source: meta ? meta.source || null : null,
      label: meta ? meta.label || null : null,
    };
  }

  // fill every {{...}} in a template. opts.fallback(body) may return text for a placeholder that did not resolve.
  function resolveText(template, ctx, opts) {
    const fb = opts && opts.fallback, items = [], errors = [];
    const text = String(template == null ? '' : template).replace(/\{\{([^{}]*)\}\}/g, (all, body) => {
      const r = resolve(body, ctx);
      if (r.ok) { items.push(r); return r.text; }
      errors.push({ placeholder: body.trim(), error: r.error, message: r.message });
      const alt = fb ? fb(body.trim(), r) : null;
      return alt != null ? alt : 'n/a';
    });
    return { text, items, errors, ok: !errors.length };
  }

  /* ---------- data context ---------- */
  // Adapts the shipped data globals to the two functions the rules call. g: { prices, debt, history, alias }
  // Series ids: "cpi_u" (MACRO_PRICES.series), "debt:IND:iso2" (MACRO_DEBT.series[IND][iso2]), "hist:usM2" (MONEY_HISTORY.series).
  // With no argument in a browser it reads window.MACRO_PRICES, MACRO_DEBT and MONEY_HISTORY.
  function makeContext(g) {
    let gl = g;
    if (!gl) {
      const w = typeof window !== 'undefined' ? window : {};
      gl = { prices: w.MACRO_PRICES, debt: w.MACRO_DEBT, history: w.MONEY_HISTORY };
    }
    const prices = gl.prices && gl.prices.series, debt = gl.debt, hist = gl.history && gl.history.series;
    function parts(id) { return typeof id === 'string' ? id.split(':') : []; }
    return {
      alias: gl.alias || {},
      series(id) {
        const p = parts(id);
        if (p[0] === 'hist' && p.length === 2) return hist && own(hist, p[1]) ? hist[p[1]].data : null;
        if (p[0] === 'debt' && p.length === 3) return debt && debt.series && own(debt.series, p[1]) && own(debt.series[p[1]], p[2]) ? debt.series[p[1]][p[2]] : null;
        return prices && own(prices, id) ? prices[id].data : null;
      },
      meta(id) {
        const p = parts(id);
        let m = null;
        if (p[0] === 'hist' && p.length === 2) m = hist && own(hist, p[1]) ? hist[p[1]] : null;
        else if (p[0] === 'debt' && p.length === 3) m = debt && debt.indicators && own(debt.indicators, p[1]) ? debt.indicators[p[1]] : null;
        else m = prices && own(prices, id) ? prices[id] : null;
        return m ? { label: m.label, unit: m.unit, source: m.source, url: m.url, retrieved: m.retrieved, asOf: m.asOf || m.vintage } : null;
      },
    };
  }

  return {
    HOURS_PER_YEAR, DEFAULT_ALIASES, PACE_YEARS, PACE_TOLERANCE, paceVerdict, billYield,
    parsePeriod, periodKey, shiftPeriod, periodLabel,
    clean, latest, first, at, annual, lastFullYear, windowRows, rebase, align, ratioAligned, diffAligned,
    yoy, rollingCagr, smooth, realReturnSeries,
    cagr, doublingTime, doublingFromRate, rateForDoubling, ruleOf70, purchasingPower, equivalentAmount,
    hoursOfWork, minutesOfWork, workYears, realReturn, rMinusG, debtDynamics, effectiveRate, effectiveRateFromRatios,
    interestToRevenue, monthlyPayment, percentChange,
    format, knownRules, ruleInfo, parsePlaceholder, placeholders, resolve, resolveText, makeContext,
    // a name the page script may use for the window helper (same as windowRows)
    window: windowRows,
  };
});
