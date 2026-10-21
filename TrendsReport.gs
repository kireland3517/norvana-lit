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

// orders: rows from getOrders(); lines: Order Items values (row 0 = header); catalog: getCatalogMap_().
function trendsReport_(orders, lines, catalog, month, currentMonth) {
  const startYm = meetingLabelToYm_(TRENDS_START_MONTH_);
  const currentYm = meetingLabelToYm_(currentMonth);
  const seen = new Set(), byYm = {};
  let latestYm = startYm;
  orders.forEach(function(o) {
    const id = String(o.orderId).trim(), ym = meetingLabelToYm_(o.meetingMonth);
    if (!id || ym == null || ym < startYm || seen.has(id)) return;
    seen.add(id);
    (byYm[ym] = byYm[ym] || []).push(o);
    if (ym > latestYm) latestYm = ym;
  });
  const lastYm = Math.max(latestYm, currentYm != null && currentYm >= startYm ? currentYm : startYm);
  let selYm = meetingLabelToYm_(month);
  if (selYm == null) selYm = currentYm != null && currentYm >= startYm ? currentYm : latestYm;
  if (selYm < startYm) throw new Error('Trends start with ' + TRENDS_START_MONTH_ + '.');

  const seriesYms = trendsMonthRange_(Math.max(startYm, selYm - (TRENDS_SERIES_MONTHS_ - 1)), selYm);
  const avgYms = trendsMonthRange_(Math.max(startYm, selYm - TRENDS_AVERAGE_MONTHS_), selYm - 1);
  const wanted = {};
  seriesYms.concat(avgYms).forEach(function(ym) { wanted[ym] = true; });

  const items = {};
  const blank = function() { return { requested: 0, distributed: 0, value: 0 }; };
  const monthTotals = {}, unknownPack = {};
  Object.keys(wanted).forEach(function(ym) {
    const completed = [];
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
        const cell = item.months[ym] || (item.months[ym] = blank());
        cell.requested += requested; cell.distributed += distributed;
        cell.value = roundTo_(cell.value + roundTo_((done ? packs : 0) * (Number(r[4]) || 0), 2), 2);
        const total = monthTotals[ym] || (monthTotals[ym] = blank());
        total.requested += requested; total.distributed += distributed;
        total.value = roundTo_(total.value + roundTo_((done ? packs : 0) * (Number(r[4]) || 0), 2), 2);
      });
    });
  });

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

function getTrendsReport(month, token) {
  return withWorkflowLock_(token, function() {
    return trendsReport_(getOrders('', token), getSheet('Order Items').getDataRange().getValues(),
      getCatalogMap_(), month, getCurrentWindow().meetingMonth);
  });
}
