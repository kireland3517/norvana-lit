// ============================================================
// NORVANA — Clear test order history before going live
// Run from the Apps Script editor. Make a spreadsheet backup first.
//
//   checkOrderHistory()  — read-only. Counts what would be cleared.
//   clearOrderHistory()  — deletes every order row (headers kept) from
//                          Orders, Order Items, Chair Reports and
//                          Monthly Report, and restarts order numbers at 001.
//
// Catalog, Groups, Config and Schedule are never touched.
// Results appear in the Execution log at the bottom of the editor.
// ============================================================

const CLEAR_TABS_ = ['Orders', 'Order Items', 'Chair Reports', 'Monthly Report'];

function checkOrderHistory() {
  clearOrders_(false);
}

function clearOrderHistory() {
  clearOrders_(true);
}

function clearOrders_(apply) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const say = msg => Logger.log(msg);
  say((apply ? 'CLEARING' : 'CHECK ONLY (nothing will be changed)') + ' — ' + ss.getName());

  // Orders that reached Ready/Completed took stock out of Catalog; clearing them does not put it back.
  const orders = ss.getSheetByName('Orders');
  if (orders && orders.getLastRow() > 1) {
    const statuses = orders.getRange(2, 10, orders.getLastRow() - 1, 1).getValues().map(r => r[0]);
    const packed = statuses.filter(s => s === 'Ready' || s === 'Completed').length;
    if (packed) say('NOTE: ' + packed + ' order(s) are Ready/Completed and took stock from Catalog. Re-count stock in Dashboard → Inventory afterwards.');
  }

  CLEAR_TABS_.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { say(name + ': tab not found — skipped.'); return; }
    const rows = Math.max(sheet.getLastRow() - 1, 0);
    if (!rows) { say(name + ': already empty.'); return; }
    if (apply) {
      sheet.getRange(2, 1, rows, sheet.getMaxColumns()).clearContent();
      say(name + ': DONE — cleared ' + rows + ' row(s). Header kept.');
    } else {
      say(name + ': ' + rows + ' row(s) would be cleared.');
    }
  });

  // Order numbers (NL-YYMM-###) are also remembered in script properties.
  const props = PropertiesService.getScriptProperties();
  const counters = Object.keys(props.getProperties()).filter(k => k.startsWith('sequence_'));
  if (!counters.length) {
    say('Order numbers: nothing to reset.');
  } else if (apply) {
    counters.forEach(k => props.deleteProperty(k));
    say('Order numbers: DONE — reset ' + counters.length + ' counter(s). Next order in each month starts at 001.');
  } else {
    say('Order numbers: ' + counters.length + ' counter(s) would be reset to start at 001.');
  }
}
