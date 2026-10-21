// Distribution trends for the Inventory tab. Calculated from Orders and Order Items on every request;
// nothing is saved, so corrected orders and old months always agree with the order records.
// Requested = every order for the meeting month. Distributed = Completed orders only (Ready means packed, not received).
// Quantities are individual items: an order line's quantity (in packs) times the pack size saved on that line. Dollar values
// stay at the pack price. Lines with no saved pack size count as 1 and are listed in unknownPackLines for the screen to warn about.
const TRENDS_START_MONTH_ = 'October 2026'; // first month of real order tracking; earlier months never count toward averages
const TRENDS_SERIES_MONTHS_ = 6;
const TRENDS_AVERAGE_MONTHS_ = 3;

// Item order inside a category, the same as the order form and Inventory: by the number in the name when it has one (IP #6
// before IP #11), otherwise by item number (keytags run Welcome, 30 Days, 60 Days, 90 Days, 6 Months...; medallions run by years).
function itemSortScore_(name, itemId) {
  const m = String(name).match(/#\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (/Eternity/i.test(name)) return 999999;
  return 100000 + (parseFloat(String(itemId).replace(/\D/g, '')) || 0);
}
function compareItems_(a, b) {
  return String(a.category).localeCompare(String(b.category)) || itemSortScore_(a.name, a.itemId) - itemSortScore_(b.name, b.itemId) || String(a.name).localeCompare(String(b.name));
}

function roundTo_(n, places) { const f = Math.pow(10, places); return Math.round(n * f) / f; }

function trendsMonthRange_(fromYm, toYm) {
  const list = [];
  for (let ym = fromYm; ym <= toYm; ym++) list.push(ym);
  return list;
}

const trendsBlank_ = function() { return { requested: 0, distributed: 0, value: 0 }; };

// Groups the tracked orders by meeting month (the first copy of an order ID wins; months before tracking began are ignored).
function trendsGroup_(orders, startYm) {
  const seen = new Set(), byYm = {};
  let latestYm = startYm;
  orders.forEach(function(o) {
    const id = String(o.orderId).trim(), ym = meetingLabelToYm_(o.meetingMonth);
    if (!id || ym == null || ym < startYm || seen.has(id)) return;
    seen.add(id);
    (byYm[ym] = byYm[ym] || []).push(o);
    if (ym > latestYm) latestYm = ym;
  });
  return { byYm: byYm, latestYm: latestYm };
}

// Adds up every order line of the given months: per item and month, and the totals for each month.
function trendsAggregate_(byYm, lines, catalog, yms) {
  const items = {}, monthTotals = {}, unknownPack = {};
  yms.forEach(function(ym) {
    (byYm[ym] || []).forEach(function(o) {
      const done = o.status === 'Completed';
      orderItemRowIndicesForOrder_(lines, String(o.orderId).trim()).forEach(function(i) {
        const r = lines[i], itemId = String(r[2]);
        if (!itemId) return;
        const pack = linePackSize_(r);
        if (!pack.known) unknownPack[String(r[0]).trim()] = true;
        const packs = Number(r[6]) || 0, requested = (Number(r[5]) || 0) * pack.size, distributed = done ? packs * pack.size : 0;
        const known = catalog[itemId];
        const item = items[itemId] || (items[itemId] = { itemId: itemId, name: known ? known.name : String(r[3]),
          category: known ? known.category : 'Other', months: {} });
        const cell = item.months[ym] || (item.months[ym] = trendsBlank_());
        cell.requested += requested; cell.distributed += distributed;
        cell.value = roundTo_(cell.value + roundTo_((done ? packs : 0) * (Number(r[4]) || 0), 2), 2);
        const total = monthTotals[ym] || (monthTotals[ym] = trendsBlank_());
        total.requested += requested; total.distributed += distributed;
        total.value = roundTo_(total.value + roundTo_((done ? packs : 0) * (Number(r[4]) || 0), 2), 2);
      });
    });
  });
  return { items: items, monthTotals: monthTotals, unknownPack: unknownPack };
}

// The years that can be picked: from the year tracking began through the latest tracked month.
function trendsYears_(startYm, lastYm) {
  const years = [];
  for (let y = Math.floor(lastYm / 12); y >= Math.floor(startYm / 12); y--) years.push(String(y));
  return years;
}

// orders: rows from getOrders(); lines: Order Items values (row 0 = header); catalog: getCatalogMap_().
function trendsReport_(orders, lines, catalog, month, currentMonth) {
  const startYm = meetingLabelToYm_(TRENDS_START_MONTH_);
  const currentYm = meetingLabelToYm_(currentMonth);
  const grouped = trendsGroup_(orders, startYm), byYm = grouped.byYm, latestYm = grouped.latestYm;
  const lastYm = Math.max(latestYm, currentYm != null && currentYm >= startYm ? currentYm : startYm);
  let selYm = meetingLabelToYm_(month);
  if (selYm == null) selYm = currentYm != null && currentYm >= startYm ? currentYm : latestYm;
  if (selYm < startYm) throw new Error('Trends start with ' + TRENDS_START_MONTH_ + '.');

  const seriesYms = trendsMonthRange_(Math.max(startYm, selYm - (TRENDS_SERIES_MONTHS_ - 1)), selYm);
  const avgYms = trendsMonthRange_(Math.max(startYm, selYm - TRENDS_AVERAGE_MONTHS_), selYm - 1);
  const wanted = {};
  seriesYms.concat(avgYms).forEach(function(ym) { wanted[ym] = true; });

  const blank = trendsBlank_;
  const agg = trendsAggregate_(byYm, lines, catalog, Object.keys(wanted).map(Number));
  const items = agg.items, monthTotals = agg.monthTotals, unknownPack = agg.unknownPack;

  const get = function(cells, ym) { return (cells && cells[ym]) || blank(); };
  const average = function(valueOf) {
    if (!avgYms.length) return null;
    return roundTo_(avgYms.reduce(function(sum, ym) { return sum + valueOf(ym); }, 0) / avgYms.length, 1);
  };
  const prevYm = selYm - 1 >= startYm ? selYm - 1 : null;
  const rows = Object.keys(items).map(function(id) {
    const it = items[id], sel = get(it.months, selYm);
    return { itemId: it.itemId, name: it.name, category: it.category,
      requested: sel.requested, distributed: sel.distributed, value: sel.value,
      prev: prevYm == null ? null : get(it.months, prevYm).distributed,
      avg: average(function(ym) { return get(it.months, ym).distributed; }),
      series: seriesYms.map(function(ym) { return get(it.months, ym).distributed; }) };
  }).filter(function(r) { return r.requested || r.distributed || r.prev || r.series.some(Boolean); })
    .sort(compareItems_);

  const sel = get(monthTotals, selYm);
  return {
    period: 'monthly', availableYears: trendsYears_(startYm, Math.max(lastYm, selYm)),
    month: monthLabel_(selYm), startMonth: TRENDS_START_MONTH_, monthToDate: selYm === currentYm,
    avgMonths: avgYms.length, prevMonth: prevYm == null ? '' : monthLabel_(prevYm),
    months: seriesYms.map(monthLabel_),
    availableMonths: trendsMonthRange_(startYm, Math.max(lastYm, selYm)).reverse().map(monthLabel_),
    totals: { requested: sel.requested, distributed: sel.distributed, value: sel.value,
      prev: prevYm == null ? null : get(monthTotals, prevYm).distributed,
      avg: average(function(ym) { return get(monthTotals, ym).distributed; }) },
    series: seriesYms.map(function(ym) { return { month: monthLabel_(ym), requested: get(monthTotals, ym).requested,
      distributed: get(monthTotals, ym).distributed, value: get(monthTotals, ym).value }; }),
    categories: Array.from(new Set(rows.map(function(r) { return r.category; }))),
    unknownPackLines: Object.keys(unknownPack).sort(),
    items: rows };
}

// Annual view: one calendar year, adding up only the months since tracking began. The comparison is the whole previous
// year (when it was tracked) and the average is items per tracked month. The year in progress is "year to date".
function trendsAnnualReport_(orders, lines, catalog, yearText, currentMonth) {
  const startYm = meetingLabelToYm_(TRENDS_START_MONTH_);
  const currentYm = meetingLabelToYm_(currentMonth);
  const grouped = trendsGroup_(orders, startYm), byYm = grouped.byYm;
  const lastYm = Math.max(grouped.latestYm, currentYm != null && currentYm >= startYm ? currentYm : startYm);
  const startYear = Math.floor(startYm / 12), lastYear = Math.floor(lastYm / 12);
  let year = /^\d{4}$/.test(String(yearText == null ? '' : yearText)) ? Number(yearText) : (currentYm != null && currentYm >= startYm ? Math.floor(currentYm / 12) : lastYear);
  if (year < startYear) throw new Error('Trends start with ' + TRENDS_START_MONTH_ + '.');
  if (year > lastYear) year = lastYear;
  const yearYms = trendsMonthRange_(Math.max(startYm, year * 12), Math.min(year * 12 + 11, lastYm));
  const prevEnd = (year - 1) * 12 + 11;
  const prevYms = prevEnd >= startYm ? trendsMonthRange_(Math.max(startYm, (year - 1) * 12), prevEnd) : [];
  const agg = trendsAggregate_(byYm, lines, catalog, yearYms.concat(prevYms));
  const blank = trendsBlank_;
  const sumOf = function(cells, yms) {
    return yms.reduce(function(t, ym) {
      const c = (cells && cells[ym]) || blank();
      return { requested: t.requested + c.requested, distributed: t.distributed + c.distributed, value: roundTo_(t.value + c.value, 2) };
    }, blank());
  };
  const perMonth = function(n) { return yearYms.length ? roundTo_(n / yearYms.length, 1) : null; };
  const rows = Object.keys(agg.items).map(function(id) {
    const it = agg.items[id], sel = sumOf(it.months, yearYms), prev = prevYms.length ? sumOf(it.months, prevYms).distributed : null;
    return { itemId: it.itemId, name: it.name, category: it.category, requested: sel.requested, distributed: sel.distributed, value: sel.value,
      prev: prev, avg: perMonth(sel.distributed),
      series: yearYms.map(function(ym) { return ((it.months[ym]) || blank()).distributed; }) };
  }).filter(function(r) { return r.requested || r.distributed || r.prev || r.series.some(Boolean); })
    .sort(compareItems_);
  const sel = sumOf(agg.monthTotals, yearYms);
  return {
    period: 'annual', year: String(year), availableYears: trendsYears_(startYm, lastYm), startMonth: TRENDS_START_MONTH_,
    yearToDate: year === lastYear && lastYm < year * 12 + 11, monthsCounted: yearYms.length,
    prevYear: prevYms.length ? String(year - 1) : '', months: yearYms.map(monthLabel_),
    totals: { requested: sel.requested, distributed: sel.distributed, value: sel.value,
      prev: prevYms.length ? sumOf(agg.monthTotals, prevYms).distributed : null, avg: perMonth(sel.distributed) },
    series: yearYms.map(function(ym) { const c = agg.monthTotals[ym] || blank(); return { month: monthLabel_(ym), requested: c.requested, distributed: c.distributed, value: c.value }; }),
    categories: Array.from(new Set(rows.map(function(r) { return r.category; }))),
    unknownPackLines: Object.keys(agg.unknownPack).sort(),
    items: rows };
}

// selection is a month ("October 2026") for the monthly view, or a year ("2026") for the annual view.
function getTrendsReport(selection, token, period) {
  return withWorkflowLock_(token, function() {
    const orders = getOrders('', token), lines = getSheet('Order Items').getDataRange().getValues(), catalog = getCatalogMap_();
    return period === 'annual'
      ? trendsAnnualReport_(orders, lines, catalog, selection, getCurrentWindow().meetingMonth)
      : trendsReport_(orders, lines, catalog, selection, getCurrentWindow().meetingMonth);
  });
}
