#!/usr/bin/env node
/* Tests for assets/derive.js (the arithmetic behind Start, Debt and Prices).
   Run:  node tools/test-derive.js     Exit code 0 when every test passes.
   It also checks that the new front-end and tool files are ASCII only with no em dash. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../assets/derive.js');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const failures = [];

function ok(cond, name, detail) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(name + (detail ? ' (' + detail + ')' : ''));
}
function near(actual, expected, tol, name) {
  const good = typeof actual === 'number' && Math.abs(actual - expected) <= tol;
  ok(good, name, 'got ' + actual + ', expected ' + expected + ' +/- ' + tol);
}
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  ok(a === e, name, 'got ' + a + ', expected ' + e);
}

/* ---------- test vectors from the research ---------- */
near(D.doublingTime(321.9 / 40.5, 54), 18.06, 0.01, 'CPI 40.5 to 321.9 over 54 years doubles in 18.06 years');
near(D.doublingTime(321.9 / 9.9, 112), 22.30, 0.01, 'CPI 9.9 to 321.9 over 112 years doubles in 22.30 years');
near(D.hoursOfWork(393700, 32.53), 12103, 1, 'median new house 393,700 at $32.53 an hour is 12,103 hours');
near(D.minutesOfWork(0.879, 6.57), 8.03, 0.01, 'eggs 0.879 at $6.57 an hour is 8.03 minutes');
near(D.workYears(12103), 5.82, 0.01, '12,103 hours is 5.82 work years of 2,080 hours');
const yearsHouse = D.parsePeriod('2026-08').t - D.parsePeriod('1971-01').t;
near(yearsHouse, 55.5833, 0.001, 'Jan 1971 to Aug 2026 is 55.58 years from period starts');
near(D.doublingTime(393700 / 23900, yearsHouse), 13.76, 0.02, 'new house Jan 1971 to Aug 2026 doubles in about 13.76 years');
near(D.rateForDoubling(17) * 100, 4.16, 0.005, 'doubling in 17 years is 4.16 percent a year');
near(D.doublingFromRate(D.cagr(40.5, 321.9, 54)), 18.06, 0.01, 'doubling from the CAGR matches doubling from the ratio');
near(D.cagr(40.5, 321.9, 54) * 100, 3.913, 0.001, 'CPI 1971 to 2025 grows 3.91 percent a year');
near(D.ruleOf70(3.913), 17.89, 0.01, 'rule of 70 is a shortcut near the exact figure');
near(D.purchasingPower(9.9, 321.9) * 100, 3.075, 0.001, 'a 1913 dollar keeps 3.1 percent of its power');
near(D.equivalentAmount(1, 9.9, 321.9), 32.515, 0.001, 'one 1913 dollar buys what $32.52 buys now');
near(D.monthlyPayment(300000, 6, 0.2, 30), 1438.92, 0.01, 'payment on 240,000 at 6 percent for 30 years');
near(D.monthlyPayment(120000, 0, 0, 10), 1000, 1e-9, 'a zero-rate loan is the loan over the months');
near(D.realReturn(5, 3), 1.9417, 0.0001, 'Fisher real return of 5 percent with 3 percent inflation');
near(D.rMinusG(4.5, 3), 1.5, 1e-12, 'r minus g in points');
near(D.debtDynamics(100, 4, 2, 1), 0.9608, 0.0001, 'debt dynamics (r - g)/(1 + g) x d - pb');
near(D.effectiveRate(100, 2000), 5, 1e-12, 'effective rate from dollars');
near(D.effectiveRateFromRatios(4, 100, 5), 4.2, 1e-9, 'effective rate from shares of GDP uses growth');
near(D.interestToRevenue(3.954, 17.5), 22.594, 0.001, 'interest over revenue');
near(D.percentChange(100, 125), 25, 1e-12, 'percent change');

/* ---------- invalid input never throws and gives null ---------- */
eq([D.cagr(0, 5, 3), D.cagr(5, -1, 3), D.cagr(5, 6, 0), D.cagr(NaN, 6, 2)], [null, null, null, null], 'cagr rejects non-positive input');
eq([D.doublingTime(1, 5), D.doublingTime(0.5, 5), D.doublingTime(2, 0), D.doublingTime(Infinity, 3)], [null, null, null, null], 'doubling time needs growth and a span');
eq([D.hoursOfWork(5, 0), D.minutesOfWork(5, -1), D.workYears(NaN)], [null, null, null], 'hours of work needs a positive wage');
eq([D.realReturn(5, -100), D.realReturn(NaN, 2)], [null, null], 'real return refuses impossible inflation');
eq([D.monthlyPayment(0, 5, 0.2, 30), D.monthlyPayment(100, -1, 0, 30), D.monthlyPayment(100, 5, 0, 0)], [null, null, null], 'payment refuses bad input');
eq([D.rMinusG(null, 1), D.effectiveRate(5, 0), D.debtDynamics(NaN, 1, 1, 0)], [null, null, null], 'debt arithmetic refuses missing input');
ok(D.clean(null).length === 0 && D.clean('x').length === 0 && D.yoy(undefined).length === 0, 'clean and yoy accept non-arrays');
ok(D.resolve(null, {}).ok === false && D.resolve('', null).ok === false, 'resolve accepts junk');

/* ---------- periods ---------- */
eq(D.parsePeriod('1971').freq, 'A', 'year period');
eq(D.parsePeriod('1971-08').t, 1971 + 7 / 12, 'month period start');
eq(D.parsePeriod('2026-Q3').t, 2026.5, 'quarter period start');
eq(D.parsePeriod('2026Q3').key, '2026-Q3', 'quarter without a hyphen is normalised');
eq(D.parsePeriod(1999).key, '1999', 'integer year');
eq([D.parsePeriod('1971-13'), D.parsePeriod('71'), D.parsePeriod(1971.5), D.parsePeriod(null), D.parsePeriod('1971-00')], [null, null, null, null, null], 'bad periods');
eq([D.shiftPeriod('2026-01', -1), D.shiftPeriod('2026-12', 1), D.shiftPeriod('2026-Q1', -1), D.shiftPeriod('2026', 3), D.shiftPeriod('2026-03', -15)], ['2025-12', '2027-01', '2025-Q4', '2029', '2024-12'], 'period shifts cross year ends');
eq([D.periodLabel('2026-08'), D.periodLabel('2026'), D.periodLabel('2026-Q2')], ['Aug 2026', '2026', '2026 Q2'], 'period labels');

/* ---------- series helpers ---------- */
const messy = [['2000-01', 1], null, ['2000-02', null], ['2000-03', NaN], ['1999-12', 5], ['2000-01', 2], ['bad', 3], { y: 1990, v: 7 }];
eq(D.clean(messy).map((p) => p.key + '=' + p.v), ['1990=7', '1999-12=5', '2000-01=2'], 'clean sorts, drops gaps and keeps the last repeat');
eq(D.latest(messy).key, '2000-01', 'latest');
eq(D.at(messy, '1999-12'), 5, 'at');
eq(D.at(messy, '2000-02'), null, 'at a gap');

function monthly(year, values) { return values.map((v, i) => [year + '-' + (i < 9 ? '0' : '') + (i + 1), v]); }
const m2024 = monthly(2024, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const m2025 = monthly(2025, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
const m2026 = monthly(2026, [3, 3, 3]);
eq(D.annual(m2024.concat(m2025, m2026)), [['2024', 6.5], ['2025', 2]], 'annual mean needs the full year');
eq(D.annual(m2024.concat(m2026), { partial: true }), [['2024', 6.5], ['2026', 3]], 'annual with partial years');
eq(D.annual(m2024, { how: 'last' }), [['2024', 12]], 'annual last');
eq(D.annual([['2020', 4], ['2021', 5]]), [['2020', 4], ['2021', 5]], 'annual passes annual rows through');
eq(D.lastFullYear(m2024.concat(m2025, m2026)), 2025, 'last full year');
eq(D.windowRows([['1999', 1], ['2000', 2], null, ['2001', 3], ['2002', 4]], 2000, 2001).length, 3, 'window keeps gap rows between kept points');
eq(D.windowRows(m2024, '2024-03', '2024-05').map((r) => r[0]), ['2024-03', '2024-04', '2024-05'], 'window by month');

const rb = D.rebase([['1999', 50], ['2000', 100], ['2001', null], ['2002', 150]], 2000);
eq(rb.rows, [['2000', 100], ['2001', null], ['2002', 150]], 'rebase to 100 keeps gaps');
eq(D.rebase([['2000', 20], ['2001', 40]], '2000', 1).rows, [['2000', 1], ['2001', 2]], 'rebase to 1');
eq(D.rebase([['2000', 0], ['2001', 40]], 2000).base.key, '2001', 'rebase skips a zero base');
ok(D.rebase([['2000', 20]], 2005) === null && D.rebase([['2000', 20]], 'x') === null, 'rebase with no base returns null');

/* ratio of aligned series never pairs different years */
const monthlyA = monthly(2000, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]).concat(monthly(2001, [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]));
const annualB = [['2000', 10]];
eq(D.ratioAligned(monthlyA, annualB), [], 'monthly over annual pairs nothing by period');
const byYear = D.ratioAligned(monthlyA, annualB, { by: 'year', scale: 100 });
eq(byYear.length, 12, 'by year pairs only the months of the matching year');
ok(byYear.every((r) => r[0].indexOf('2000-') === 0), 'by year never leaves the matching year');
eq(byYear[0], ['2000-01', 100], 'by year ratio value');
eq(D.ratioAligned([['2000', 4], ['2001', 6], ['2002', 8]], [['2001', 3], ['2002', 0], ['2003', 1]]), [['2001', 2]], 'aligned ratio skips zero and missing denominators');
eq(D.diffAligned([['2000', 4], ['2001', 6]], [['2001', 1.5]]), [['2001', 4.5]], 'aligned difference');

/* rolling year on year, with a hole in the middle */
const cpiM = monthly(2020, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]).concat(monthly(2021, [110, 110, null, 110, 110, 110, 110, 110, 110, 110, 110, 110]));
const yy = D.yoy(cpiM);
eq(yy.length, 12, 'yoy starts one year in');
near(yy[0][1], 10, 1e-9, 'yoy value');
eq(yy[2], ['2021-03', null], 'yoy keeps a gap where the input has a gap');
const yy2 = D.yoy([['2020-01', 100], ['2021-01', 120], ['2021-03', 130]]);
eq(yy2.map((r) => (r[1] == null ? null : +r[1].toFixed(9))), [20, null], 'yoy emits a gap when the prior year is missing mid-series');
eq(D.yoy([['2000', 100], ['2001', 110], ['2002', 99]]).map((r) => +r[1].toFixed(6)), [10, -10], 'annual yoy');

const rcGap = D.rollingCagr([['2000', 100], ['2005', 150], ['2010', 200], ['2011', 210], ['2012', 260]], 2);
eq(rcGap.map((r) => r[0] + ':' + (r[1] == null ? 'null' : r[1].toFixed(2))), ['2005:null', '2010:null', '2011:null', '2012:14.02'], 'rolling cagr gives gaps where the earlier year is missing');
const rc = D.rollingCagr([['2000', 100], ['2001', 110], ['2002', 121]], 2);
eq(rc.length, 1, 'rolling cagr drops the start');
near(rc[0][1], 10, 1e-9, 'rolling two-year cagr');
eq(D.rollingCagr([['2000', 1]], 0), [], 'rolling cagr needs a whole number of years');

/* smooth: a missing period gives a gap, never a shorter average */
eq(D.smooth([['2000', 1], ['2001', 2], ['2002', 3], ['2003', 4]], 3), [['2002', 2], ['2003', 3]], 'trailing mean over three years');
eq(D.smooth([['2000', 1], ['2001', 2], ['2003', 4], ['2004', 5], ['2005', 6]], 3), [['2003', null], ['2004', null], ['2005', 5]], 'smooth gives gaps across a missing year');

/* real return series */
const nomA = [['2001', 5], ['2002', 4]], cpiA = [['2000', 100], ['2001', 103], ['2002', 106.09]];
const ra = D.realReturnSeries(nomA, cpiA);
eq(ra.length, 2, 'real return series per nominal period');
near(ra[0][1], D.realReturn(5, 3), 1e-9, 'annual trailing real return');
const rf = D.realReturnSeries(nomA, cpiA, { mode: 'forward' });
eq(rf.map((r) => r[0]), ['2001', '2002'].slice(0, 1), 'forward real return needs next year CPI');
const nomM = [['2001-01', 6]], cpiMo = [['2000-01', 100], ['2001-01', 104]];
near(D.realReturnSeries(nomM, cpiMo)[0][1], D.realReturn(6, 4), 1e-9, 'monthly trailing real return uses the 12 months to the date');
near(D.realReturnSeries([['2000-01', 6]], cpiMo, { mode: 'forward' })[0][1], D.realReturn(6, 4), 1e-9, 'monthly forward real return uses the next 12 months');

/* ---------- formatting ---------- */
eq([D.format(18.0643, 'n1'), D.format(12102.67, 'n0'), D.format(3.913, 'p2'), D.format(16.4728, 'x1'), D.format(-1.5, 'sgn1'), D.format(1.5, 'sgn1'), D.format(0, 'sgn1')], ['18.1', '12,103', '3.91%', '16.5x', '-1.5', '+1.5', '0.0'], 'number formats');
eq([D.format(393700, 'usd0'), D.format(-5.5, 'usd1'), D.format(23342.8, 'usdbn'), D.format(514.2, 'usdbn'), D.format(5.41, 'usdbn')], ['$393,700', '-$5.5', '$23.3 trillion', '$514 billion', '$5.4 billion'], 'dollar formats');
eq([D.format(18.06, 'yrs1'), D.format(8.027, 'mins1'), D.format(12103, 'hrs0'), D.format(NaN, 'n1'), D.format('Aug 2026', 'n1'), D.format(-0.0004, 'n2')], ['18.1 years', '8.0 minutes', '12,103 hours', 'n/a', 'Aug 2026', '0.00'], 'unit formats and edge cases');

/* ---------- placeholders and rules ---------- */
function steady(y0, y1, lastY, lastM, rate) {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let m = 1; m <= 12; m++) { if (y === lastY && m > lastM) break; out.push([y + '-' + (m < 10 ? '0' : '') + m, 100 * Math.pow(1 + rate, y - y0 + (m - 1) / 12)]); }
  return out;
}
const prices = {
  generated: '2026-10-24',
  series: {
    cpi_m: { label: 'CPI steady', unit: 'index', source: 'x', retrieved: '2026-10-24', asOf: '2026-08', data: steady(2000, 2026, 2026, 8, 0.03) },
    bill_m: { label: 'Bill discount rate', unit: '% a year', source: 'x', retrieved: '2026-10-24', asOf: '2022-12', data: steady(2020, 2022, 2022, 12, 0).map((r) => [r[0], 4]) },
    ni_a: { label: 'Net interest', unit: 'USD bn', source: 'x', retrieved: '2026-10-24', asOf: '2025', data: [['2024', 100], ['2025', 120]] },
    gdp_fy: { label: 'GDP fiscal', unit: 'USD bn', source: 'x', retrieved: '2026-10-24', asOf: '2024', data: [['2023', 1000], ['2024', 1100]] },
    cpi_u: { label: 'CPI-U', unit: 'index 1982-84=100', source: 'BLS', url: 'https://example.invalid/', retrieved: '2026-10-24', asOf: '2026-09',
      data: [['1913', 9.9], ['1971', 40.5], ['1980', 82.4], ['2000', 172.2]].concat(
        monthly(2024, [310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321]),
        monthly(2025, [320, 320, 321, 321, 322, 322, 322, 322, 322, 323, 323, 323]),
        monthly(2026, [330, 331, 332, 333, 334, 335, 336, 337])) },
    pay_prod: { label: 'Pay', unit: 'USD an hour', source: 'BLS', retrieved: '2026-10-24', asOf: '2026-08',
      data: [['1971-01', 3.53], ['2025-12', 31.9], ['2026-08', 32.53]] },
    house_new_median: { label: 'House', unit: 'USD', source: 'Census', retrieved: '2026-10-24', asOf: '2026-08', data: [['1971-01', 23900], ['2025-12', 380000], ['2026-08', 393700]] },
    price_eggs: { label: 'Eggs', unit: 'USD per dozen', source: 'BLS', retrieved: '2026-10-24', asOf: '2026-08', data: [['1980-01', 0.879], ['2026-08', 2.272], ['2026-07', null]] },
    tbill3m: { label: 'T-bill', unit: '% a year', source: 'Fed', retrieved: '2026-10-24', asOf: '2025', data: [['2023', 5], ['2024', 4.5], ['2025', 2]] },
    cpi_a: { label: 'CPI annual', unit: 'index', source: 'x', retrieved: '2026-10-24', data: [['2022', 100], ['2023', 104], ['2024', 106], ['2025', 109.12]] },
    wage_a: { label: 'Wage annual', unit: 'USD an hour', source: 'x', retrieved: '2026-10-24', data: [['2022', 20], ['2023', 21.5], ['2024', 22.5], ['2025', 24]] },
    house_new_median_annual: { label: 'House annual', unit: 'USD', source: 'Census', retrieved: '2026-10-24', asOf: '2025', data: [['2023', 430000], ['2024', 420000], ['2025', 400000]] },
    mortgage30: { label: 'Mortgage', unit: '% a year', source: 'x', retrieved: '2026-10-24', data: [['2026-08', 6]] },
    hpi: { label: 'x', data: [] },
  },
};
const debt = {
  generated: '2026-10-24',
  indicators: { ie: { label: 'Interest', unit: '% GDP', source: 'IMF', retrieved: '2026-10-24', vintage: '2025-10' }, d: { label: 'Debt', unit: '% GDP', source: 'IMF' }, ng: { label: 'Growth', unit: '%', source: 'IMF' }, GG_DEBT_GDP: { label: 'Gov debt', unit: '% GDP', source: 'IMF' }, TOT: { label: 'Total debt', unit: 'US dollars', source: 'Treasury' } },
  series: { ie: { us: [[2022, 2.0], [2023, 3.0], [2024, 4.2]] }, d: { us: [[2021, 100], [2022, 105], [2023, 110], [2024, 115]] }, ng: { us: [[2022, 9.0], [2023, 6.0], [2024, 5.0]] }, GG_DEBT_GDP: { us: [[2000, 55], [2010, 95], [2024, 120]] }, TOT: { us: [[2024, 36500000000000], [2025, 38000000000000]] } },
};
const history = { series: {
  usM2: { label: 'US M2', unit: 'USD bn', source: 'Fed', data: [{ y: 2000, v: 4800 }, { y: 2020, v: 19000 }, { y: 2025, v: 22500 }] },
  usGDP: { label: 'US GDP', unit: 'USD bn', source: 'BEA', data: [{ y: 2000, v: 10000 }, { y: 2020, v: 21100 }, { y: 2025, v: 31000 }] },
} };
const ctx = D.makeContext({ prices, debt, history, alias: { hm: 'house_new_median', cm: 'cpi_m', bm: 'bill_m', ni: 'ni_a', gfy: 'gdp_fy', sav: 'tbill3m', cpiA: 'cpi_a', wageA: 'wage_a', tot: 'debt:TOT:us', ie: 'debt:ie:us', dd: 'debt:d:us', ng: 'debt:ng:us', gd: 'debt:GG_DEBT_GDP:us' } });
const R = (ph) => D.resolve(ph, ctx);

eq(R('{{cpi.doubling.1913.lastfull}}').text, '22.3', 'doubling CPI 1913 to last full year (annual means)');
ok(R('{{cpi.doubling.1971}}').ok, 'placeholder with default end');
eq(R('cpi.doubling.1971|yrs1').text.slice(-6), ' years', 'placeholder without braces and with a format');
near(R('{{cpi.doubling.1971.2000}}').value, 29 * Math.LN2 / Math.log(172.2 / 40.5), 1e-9, 'doubling over an explicit window');
eq(R('{{cpi.cagr.1971.2000}}').text, '5.12%', 'cagr text');
eq(R('{{cpi.ratio.1913.1971}}').text, '4.1x', 'ratio text');
eq(R('{{cpi.pct.1971.1980}}').text, '103.5%', 'percent change text');
eq(R('{{cpi.power.1913.2000}}').text, '5.7%', 'purchasing power text');
eq(R('{{cpi.diff.1971.1980}}').text, '+41.9', 'difference text');
eq(R('{{cpi.latest}}').text, '337.00', 'latest value');
eq(R('{{cpi.latestperiod}}').text, 'Aug 2026', 'latest period label');
eq(R('{{cpi.firstperiod}}').text, '1913', 'first period label');
eq(R('{{cpi.value.2025}}').text, '321.75', 'annual mean value');
eq(R('{{cpi.value.2025-03}}').text, '321.00', 'month value');
ok(R('{{cpi.yoy.2025}}').ok && R('{{cpi.yoy.latest}}').ok && R('{{cpi.yoy.2025-06}}').ok, 'yoy by year, latest and month');
near(R('{{cpi.yoy.2026-03}}').value, (332 / 321 - 1) * 100, 1e-9, 'monthly yoy compares with the same month a year earlier');
ok(R('{{cpi.rollcagr.1.lastfull}}').ok, 'rolling cagr resolves');
eq(R('{{hm.hours.pay.latest}}').text, '12,103', 'hours of work for the newest period both have');
eq(R('{{hm.hours.pay.2026-08}}').text, '12,103', 'hours at an explicit month');
eq(R('{{sav.minutes.pay.latest}}').error, 'no-common-period', 'minutes with no shared period says so');
eq(R('{{eggs.minutes.pay.latest}}').text, '4.2', 'minutes of work for eggs now');
near(R('{{hm.workyears.pay.2026-08}}').value, 393700 / 32.53 / 2080, 1e-9, 'work years default to 2,080 hours');
near(R('{{hm.workyears.pay.2026-08.1800}}').value, 393700 / 32.53 / 1800, 1e-9, 'work years accept an hours-per-year argument');
near(R('{{m2.share.gdp.2000}}').value, 48, 1e-9, 'M2 over GDP in percent, same year');
near(R('{{m2.share.gdp.lastfull}}').value, 22500 / 31000 * 100, 1e-9, 'share at the last year both have');
eq(R('{{m2.share.gdp.latest}}').text, '72.6%', 'share at latest for annual series');
near(R('{{hm.per.pay.latest}}').value, 393700 / 32.53, 1e-6, 'per rule');
near(R('{{sav.realreturn.cpiA.2024}}').value, D.realReturn(4.5, (106 / 104 - 1) * 100), 1e-9, 'real return for a year');
near(R('{{sav.realavg.cpiA.2023.2025}}').value, [[5, 4], [4.5, (106 / 104 - 1) * 100], [2, (109.12 / 106 - 1) * 100]].map((a) => D.realReturn(a[0], a[1])).reduce((s, x) => s + x, 0) / 3, 1e-9, 'average real return');
eq(R('{{sav.realneg.cpiA.2023.2025}}').value, 1, 'one year with a negative real return');
eq(R('{{sav.realyears.cpiA.2023.2025}}').value, 3, 'years counted for real return');
near(R('{{ie.effrate.dd.ng.2024}}').value, 4.2 / 110 * 1.05 * 100, 1e-9, 'effective rate from shares of GDP');
near(R('{{ie.rmg.dd.ng.2024}}').value, 4.2 / 110 * 1.05 * 100 - 5, 1e-9, 'r minus g');
eq(R('{{ie.effrate.dd.ng.latest}}').period, '2024', 'latest year for effective rate');
eq(R('{{gd.max}}').text, '120.0', 'max of an annual series');
eq(R('{{gd.maxyear.2000.2010}}').text, '2010', 'year of the maximum in a range');
eq(R('{{gd.min}}').text, '55.0', 'min');
eq(R('{{gd.minyear}}').text, '2000', 'year of the minimum');
near(R('{{hm.payment.mortgage.20.30.2026-08}}').value, D.monthlyPayment(393700, 6, 0.2, 30), 1e-9, 'payment rule');
eq(R('{{calc.rate_for_doubling.17}}').text, '4.16%', 'calc rate for doubling');
eq(R('{{calc.doubling_from_rate.4.16}}').ok, false, 'a decimal argument is two arguments and is refused');
eq(R('{{calc.rule70.4}}').text, '17.5', 'rule of 70');
eq(R('{{calc.hours_per_year}}').text, '2,080', 'hours per year');

/* rules added for data/principles.js: plus, inbn, realchange and the latest-Ny start */
near(R('{{ie.plus.dd.2024}}').value, 4.2 + 115, 1e-9, 'plus adds two series in the same year');
near(R('{{dd.minus.ie.2024}}').value, 115 - 4.2, 1e-9, 'minus subtracts the other series in the same year');
eq(R('{{dd.minus.ie.2020}}').error, 'no-data', 'minus with a missing year says so');
eq(R('{{dd.minus.nosuch.2024}}').error, 'no-series', 'minus with an unknown series');
eq(R('{{ie.plus.dd.2024}}').text, '119.2', 'plus text');
eq(R('{{ie.plus.dd.latest}}').period, '2024', 'plus at latest takes the newest shared period');
eq(R('{{ie.plus.dd.2020}}').error, 'no-data', 'plus with a missing year says so');
eq(R('{{tot.inbn.2025}}').text, '$38.0 trillion', 'inbn turns dollars into billions for the usdbn format');
near(R('{{tot.inbn.2024}}').value, 36500, 1e-9, 'inbn value is in billions');
eq(R('{{tot.inbn.2019}}').error, 'no-data', 'inbn with a missing year says so');
near(R('{{wageA.realchange.cpiA.2022.2025}}').value, ((24 / 20) / (109.12 / 100) - 1) * 100, 1e-9, 'realchange deflates a wage by the price series');
near(R('{{wageA.realchange.cpiA.2022}}').value, ((24 / 20) / (109.12 / 100) - 1) * 100, 1e-9, 'realchange ends at the last year both series complete');
near(R('{{wageA.realchange.cpiA.last2}}').value, ((24 / 21.5) / (109.12 / 104) - 1) * 100, 1e-9, 'realchange accepts lastN as a start');
near(R('{{wageA.realchange.cpiA.latest-2y.latest}}').value, ((24 / 21.5) / (109.12 / 104) - 1) * 100, 1e-9, 'realchange accepts latest-Ny as a start');
near(R('{{pay.realchange.cpi.2025-12.2026-08}}').value, ((32.53 / 31.9) / (337 / 323) - 1) * 100, 1e-9, 'realchange between two months');
eq(R('{{pay.realchange.cpi.2025-12.latest}}').period, 'Dec 2025 to Aug 2026', 'realchange to latest uses the newest month both have');
eq(R('{{wageA.realchange.cpiA.2022.2030}}').error, 'no-data', 'realchange outside the data');
eq(R('{{pay.realchange.cpi.last2.latest}}').error, 'bad-args', 'lastN needs a year as the end');
eq(R('{{wageA.realchange.cpiA}}').error, 'bad-args', 'realchange needs a start');
eq(R('{{sav.realchange.cpiA.2023.2025}}').ok, true, 'realchange works on a rate series too, as a plain ratio');
eq(R('{{nosuch.realchange.cpiA.2022}}').error, 'no-series', 'realchange with an unknown series');
eq(R('{{wageA.realchange.nosuch.2022}}').error, 'no-series', 'realchange with an unknown price series');
near(R('{{cpi.doubling.latest-1y.latest}}').value, D.doublingTime(337 / 322, 1), 1e-9, 'latest-Ny starts N years before the newest observation');
eq(R('{{cpi.doubling.latest-1y.latest}}').period, 'Aug 2025 to Aug 2026', 'latest-Ny period text');
eq(R('{{cpi.cagr.2025-01.latest-1y}}').error, 'bad-args', 'latest-Ny cannot end a window');
eq(R('{{cpi.doubling.latest-1y.lastfull}}').error, 'mixed-basis', 'latest-Ny to a year is refused');
eq(R('{{pay.doubling.latest-30y.latest}}').error, 'no-data', 'latest-Ny before the first observation');
eq(R('{{eggs.cagr.latest-1y.latest}}').error, 'no-data', 'latest-Ny where that month has no value');

/* the house alias is the annual median; sgn never puts a plus sign on a value that rounds to zero */
eq(D.DEFAULT_ALIASES.house, 'house_new_median_annual', 'the default house alias is the published annual median');
eq(R('{{house.value.2025}}').text, '400,000.00', 'house reads the annual series');
eq([D.format(0.04, 'sgn1'), D.format(0.004, 'sgn2'), D.format(-0.04, 'sgn1'), D.format(0.06, 'sgn1'), D.format(1234.5, 'sgn1')], ['0.0', '0.00', '0.0', '+0.1', '+1,234.5'], 'sgn drops the plus sign when the shown value is zero');

/* a year followed by p is the average of the months available in that year */
near(R('{{cpi.ratio.2024.2025p}}').value, 321.75 / 315.5, 1e-9, 'a full year with p is the same annual average');
near(R('{{cpi.ratio.2024.2026p}}').value, (D.annual(prices.series.cpi_u.data, { partial: true }).find((r) => r[0] === '2026')[1]) / 315.5, 1e-9, 'a part year with p averages the months available');
eq(R('{{cpi.pct.2024.2026p}}').period, '2024 to 2026 (part year)', 'the period text says a part year was used');
eq(R('{{cpi.ratio.2024.2026}}').error, 'no-data', 'without p a part year is refused');
eq(R('{{cpi.ratio.2024.2031p}}').error, 'no-data', 'p on a year with no data');

/* plus3, logshare, logshare2 and atrate */
near(R('{{ie.plus3.dd.ng.2024}}').value, 4.2 + 115 + 5, 1e-9, 'plus3 adds three series in the same year');
eq(R('{{ie.plus3.dd.ng.2020}}').error, 'no-data', 'plus3 with a missing year says so');
eq(R('{{ie.plus3.dd.nosuch.2024}}').error, 'no-series', 'plus3 with an unknown series');
near(R('{{m2.logshare.gdp.2000.2025}}').value, 100 * Math.log(31000 / 10000) / Math.log(22500 / 4800), 1e-9, 'logshare is the share of log growth');
near(R('{{m2.logshare2.m2.gdp.2000.2025}}').value, 100 * (Math.log(22500 / 4800) - Math.log(31000 / 10000)) / Math.log(22500 / 4800), 1e-9, 'logshare2 is the growth of A beyond B');
near(R('{{m2.logshare.gdp.2000.2025}}').value + R('{{m2.logshare2.m2.gdp.2000.2025}}').value, 100, 1e-9, 'the share matched and the share beyond add to 100');
eq(R('{{m2.logshare.nosuch.2000.2025}}').error, 'no-series', 'logshare with an unknown series');
eq(R('{{m2.logshare.gdp.2025.2000}}').error, 'bad-args', 'logshare needs a window that runs forward');
near(R('{{ie.atrate.dd.ng.2024.2023}}').value, (4.2 / 115) * 100 * (6 / 5), 1e-9, 'atrate scales the share by the rate in the scenario year over the base year');
eq(R('{{ie.atrate.dd.ng.2024.2030}}').error, 'no-data', 'atrate with a missing scenario year');

/* yieldgap, startyears, startcount, effratefy, a part-year real return, the pace and the part-year flag */
near(R('{{bm.yieldgap.2020.2021}}').value, D.billYield(4) - 4, 1e-9, 'yieldgap is the investment yield minus the discount rate');
near(D.billYield(4), 4.0971, 0.001, 'a 4 percent discount rate on a 91-day bill is a 4.10 percent investment yield');
ok(R('{{bm.yieldgap.2020.2021}}').value > 0, 'the investment yield is above the discount rate');
eq(R('{{bm.yieldgap.2020.2030}}').ok, true, 'yieldgap uses the complete years in range');
eq(R('{{bm.yieldgap.2030.2031}}').error, 'no-data', 'yieldgap with no complete year');
eq(R('{{bm.yieldgap.2021.2020}}').error, 'bad-args', 'yieldgap needs a window that runs forward');
eq(R('{{cm.startyears.2000.2020}}').value, 21, 'startyears counts January start years');
eq(R('{{cm.startcount.2000.2020.23.24}}').value, 21, 'a steady 3 percent a year doubles in 23.4 years from every January');
eq(R('{{cm.startcount.2000.2020.0.20}}').value, 0, 'startcount outside the range is zero');
eq(R('{{cm.startfit.2000.2020}}').value, 0, 'a doubling every 23.4 years is not within 1.5 years of 17');
eq(R('{{cm.startfit.2030.2031}}').error, 'no-data', 'startfit with no start years');
eq(R('{{cm.startyears.1990.1995}}').error, 'no-data', 'startyears with no data');
eq(R('{{cpi.startyears.2000.2020}}').error, 'no-data', 'startyears on a series that is not monthly through the latest month');
near(R('{{ni.effratefy.dd.gfy.2025}}').value, 120 / (1.15 * 1100) * 100, 1e-9, 'effratefy divides by the debt share times last year\'s GDP');
eq(R('{{ni.effratefy.dd.gfy.2030}}').error, 'no-data', 'effratefy with a missing year');
near(R('{{sav.realavg.cpiA.2023.2025p}}').value, R('{{sav.realavg.cpiA.2023.2025}}').value, 1e-12, 'a p after the end year is harmless when the year is complete');
eq(R('{{sav.realavg.cpiA.2023.2030p}}').ok, true, 'realavg uses the years it has');
eq([D.paceVerdict(17.2), D.paceVerdict(15.6), D.paceVerdict(15.4), D.paceVerdict(18.4), D.paceVerdict(18.6), D.paceVerdict(null, true), D.paceVerdict(null, false)], ['about', 'about', 'faster', 'about', 'slower', 'slower', null], 'the 17-year pace has one tolerance');
eq(D.clean([{ y: 2025, v: 5 }, { y: 2026, v: 6, p: 1 }]).map((p) => p.key), ['2025'], 'a row flagged p: 1 is a part year and is left out');
eq(D.clean([{ p: '2024-05', v: 5 }, { p: 2025, v: 6 }]).map((p) => p.key), ['2024-05', '2025'], 'an object row can name its period in p');
eq(D.windowRows([{ y: 2025, v: 5 }, { y: 2026, v: 6, p: 1 }], 2020, 2030).length, 1, 'windowRows leaves out a part-year row');
eq(D.rebase([{ y: 2024, v: 5 }, { y: 2025, v: 10 }, { y: 2026, v: 15, p: 1 }], '2024', 100).rows.length, 2, 'rebase leaves out a part-year row');

/* errors carry a code and never throw */
eq(R('{{cpi.nosuchrule.1}}').error, 'unknown-rule', 'unknown rule');
eq(R('{{cpi.doubling}}').error, 'bad-args', 'missing argument');
eq(R('{{cpi.doubling.1971.2000.1}}').error, 'bad-args', 'too many arguments');
eq(R('{{nosuch.doubling.1971}}').error, 'no-series', 'unknown series');
eq(R('{{cpi.doubling.1971.latest}}').error, 'mixed-basis', 'year to latest is refused');
eq(R('{{cpi.doubling.1971-01.latest}}').error, 'no-data', 'a month with no value is no-data');
eq(R('{{cpi.doubling.2000.1971}}').error, 'bad-args', 'a window must run forward');
eq(R('{{cpi.doubling.2030.2031}}').error, 'no-data', 'years outside the data');
eq(R('{{cpiA.doubling.last2.last1}}').error, 'bad-args', 'lastN cannot end a window');
eq(R('{{cpi.doubling.abc}}').error, 'bad-args', 'junk argument');
eq(R('{{cpi.latest|zz}}').error, 'bad-format', 'unknown format');
eq(R('{{calc.latest}}').error, 'bad-args', 'calc used with a series rule');
eq(R('{{cpi.rate_for_doubling.17}}').error, 'bad-args', 'series used with a calc rule');
eq(R('{{only}}').error, 'bad-placeholder', 'too few parts');
eq(R('{{a..b}}').error, 'bad-placeholder', 'empty part');
eq(R('{{a b.c}}').error, 'bad-placeholder', 'space in a placeholder');
eq(D.resolve('{{cpi.latest}}', {}).error, 'no-series', 'empty context');
ok(D.resolve('{{cpi.latest}}').ok === false, 'no context at all');
eq(D.resolve('{{cpi.latest}}', { series() { throw new Error('boom'); } }).error, 'internal', 'a throwing context is caught');
near(R('{{cpiA.doubling.last2}}').value, D.doublingTime(109.12 / 104, 2), 1e-9, 'lastN starts N years before the last full year');
eq(R('{{cpiA.doubling.last2}}').period, '2023 to 2025', 'lastN period text');
eq(R('{{cpi.doubling.last10}}').error, 'no-data', 'lastN with no such year is no-data');

/* provenance travels with a result */
const r1 = R('{{cpi.doubling.1971}}');
eq([r1.series, r1.period, r1.asOf, r1.source], [['cpi_u'], '1971 to 2025', '2026-09', 'BLS'], 'result carries series, period, as-of and source');
const r2 = R('{{ie.effrate.dd.ng.2024}}');
eq([r2.series, r2.asOf], [['debt:ie:us', 'debt:d:us', 'debt:ng:us'], '2025-10'], 'debt result carries ids and the vintage as as-of');

/* text with several placeholders */
const t = D.resolveText('Prices double every {{cpi.doubling.1971}} years; {{nope.latest}} and {{calc.rate_for_doubling.17}}.', ctx);
eq(t.text, 'Prices double every 18.1 years; n/a and 4.16%.', 'resolveText fills what it can');
eq(t.errors.map((e) => e.error), ['no-series'], 'resolveText lists errors');
eq(t.items.length, 2, 'resolveText lists the resolved items');
eq(D.resolveText('x {{nope.latest}}', ctx, { fallback: (b) => 'static(' + b + ')' }).text, 'x static(nope.latest)', 'fallback text');
eq(D.placeholders('a {{x.y}} b {{ p.q.1|n1 }}'), ['x.y', 'p.q.1|n1'], 'placeholders lists bodies');
eq(D.resolveText(null, ctx).text, '', 'resolveText of null');

/* every rule has documentation, a valid default format and at least one passing sample */
const samples = {
  cagr: 'cpi.cagr.1971', doubling: 'cpi.doubling.1971', ratio: 'cpi.ratio.1971', pct: 'cpi.pct.1971', power: 'cpi.power.1971', diff: 'cpi.diff.1971',
  latest: 'cpi.latest', latestperiod: 'cpi.latestperiod', firstperiod: 'cpi.firstperiod', value: 'cpi.value.2025', yoy: 'cpi.yoy.2025', rollcagr: 'cpi.rollcagr.1',
  hours: 'hm.hours.pay.latest', minutes: 'hm.minutes.pay.latest', workyears: 'hm.workyears.pay.latest', per: 'hm.per.pay.latest', share: 'm2.share.gdp.2000',
  max: 'gd.max', min: 'gd.min', maxyear: 'gd.maxyear', minyear: 'gd.minyear',
  realreturn: 'sav.realreturn.cpiA.2024', realavg: 'sav.realavg.cpiA.2023.2025', realneg: 'sav.realneg.cpiA.2023.2025', realyears: 'sav.realyears.cpiA.2023.2025',
  effrate: 'ie.effrate.dd.ng.2024', rmg: 'ie.rmg.dd.ng.2024', payment: 'hm.payment.mortgage.20.30.2026-08',
  rate_for_doubling: 'calc.rate_for_doubling.17', doubling_from_rate: 'calc.doubling_from_rate.4', rule70: 'calc.rule70.4', hours_per_year: 'calc.hours_per_year',
  plus: 'ie.plus.dd.2024', plus3: 'ie.plus3.dd.ng.2024', yieldgap: 'bm.yieldgap.2020.2021', startyears: 'cm.startyears.2000.2020', startfit: 'cm.startfit.2000.2020', startcount: 'cm.startcount.2000.2020.20.30', effratefy: 'ni.effratefy.dd.gfy.2025', logshare: 'm2.logshare.gdp.2000.2025', logshare2: 'm2.logshare2.m2.gdp.2000.2025', atrate: 'ie.atrate.dd.ng.2024.2023', minus: 'dd.minus.ie.2024', inbn: 'tot.inbn.2025', realchange: 'wageA.realchange.cpiA.2022',
};
D.knownRules().forEach((name) => {
  const info = D.ruleInfo(name);
  ok(info && info.doc && info.unit && info.fmt, 'rule ' + name + ' is documented');
  ok(samples[name] != null, 'rule ' + name + ' has a test sample');
  if (samples[name]) ok(R(samples[name]).ok, 'rule ' + name + ' sample resolves', JSON.stringify(R(samples[name])));
  ok(D.format(1, info.fmt) !== 'n/a', 'rule ' + name + ' default format is valid');
});
Object.keys(samples).forEach((n) => ok(D.knownRules().indexOf(n) >= 0, 'sample ' + n + ' names a real rule'));
eq(D.ruleInfo('nope'), null, 'ruleInfo of an unknown rule');
ok(D.ruleInfo('hours').minArgs === 2 && D.ruleInfo('calc') === null, 'ruleInfo argument counts');

/* ---------- context adapter ---------- */
eq(ctx.series('cpi_u') === prices.series.cpi_u.data, true, 'context finds a price series');
eq(ctx.series('debt:ie:us') === debt.series.ie.us, true, 'context finds a debt series');
eq(Array.isArray(ctx.series('hist:usM2')) && ctx.series('hist:usM2')[0].y === 2000, true, 'context finds a history series');
eq([ctx.series('nope'), ctx.series('debt:ie:zz'), ctx.series('hist:nope'), ctx.series('constructor'), ctx.series('debt:__proto__:us')], [null, null, null, null, null], 'context returns null for unknown ids and prototype names');
eq(ctx.meta('debt:ie:us').asOf, '2025-10', 'debt meta uses the vintage as as-of');
eq(ctx.meta('cpi_u').source, 'BLS', 'price meta');
eq(D.makeContext({}).series('cpi_u'), null, 'context with no data');

/* ---------- source files stay plain ASCII with no em dash ---------- */
const plain = ['assets/derive.js', 'assets/ts-chart.js', 'assets/ts-chart.css', 'tools/test-derive.js', 'tools/check-data.js', 'tools/check-site.js', 'tools/stamp.js'];
plain.forEach((rel) => {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { ok(false, rel + ' exists'); return; }
  const txt = fs.readFileSync(f, 'utf8');
  let bad = -1;
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    if (c > 126 || (c < 32 && c !== 10 && c !== 13 && c !== 9)) { bad = i; break; }
  }
  ok(bad < 0, rel + ' is ASCII only', bad >= 0 ? 'char code ' + txt.charCodeAt(bad) + ' on line ' + (txt.slice(0, bad).split('\n').length) : '');
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) {
  failures.forEach((f) => console.log('  FAIL: ' + f));
  process.exit(1);
}
