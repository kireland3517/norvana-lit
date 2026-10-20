// Chair Reports tab, made readable: columns F to N show what was actually sent to the Secretary (drafts are not shown).
// The app's storage columns A to E (the JSON text) are left exactly as they are and hidden. Nothing here is read back by the app.
// Run setupChairReportView() once; after that the view refreshes whenever a report is sent or a new report row is created.
const CHAIR_VIEW_HEADERS_ = ['Orders recap', 'Groups served', 'Collected', 'H&I charged', 'Spent', 'Notes', 'Version', 'Sent on', 'Sent to'];
const CHAIR_VIEW_FIRST_COLUMN_ = 6;

function chairViewRow_(storedRow) {
  let sent = null;
  try { sent = storedRow[2] ? JSON.parse(storedRow[2]) : null; } catch (e) { sent = null; }
  if (!sent || !sent.sentAt) return null;
  return [String(sent.ordersMonth || ''), Number(sent.groupsServed) || 0, Number(sent.moneyCollected) || 0,
    typeof sent.hiCharged === 'number' ? sent.hiCharged : '', Number(sent.moneySpent) || 0, String(sent.other || ''),
    Number(sent.version) || 1, Utilities.formatDate(new Date(sent.sentAt), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a'), String(sent.recipient || '')];
}

function refreshChairReportView_() {
  const sheet = getSheet('Chair Reports');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const width = CHAIR_VIEW_HEADERS_.length, shown = data.slice(1).map(chairViewRow_);
  sheet.getRange(1, CHAIR_VIEW_FIRST_COLUMN_, 1, width).setValues([CHAIR_VIEW_HEADERS_]);
  sheet.getRange(2, CHAIR_VIEW_FIRST_COLUMN_, shown.length, width).setValues(shown.map(r => r || new Array(width).fill('')));
  shown.forEach((r, i) => { if (r) sheet.showRows(i + 2); else sheet.hideRows(i + 2); });
}

// Never lets the readable view block saving or sending a report.
function refreshChairReportViewSafe_() {
  try { refreshChairReportView_(); } catch (e) { /* the raw columns still hold the report */ }
}

function setupChairReportView() {
  requireEditor_();
  const sheet = getSheet('Chair Reports'), last = Math.max(sheet.getMaxRows(), 2), width = CHAIR_VIEW_HEADERS_.length;
  refreshChairReportView_();
  sheet.getRange(1, CHAIR_VIEW_FIRST_COLUMN_, 1, width).setFontWeight('bold').setBackground('#2e3192').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sheet.getRange(1, 1).setFontWeight('bold').setBackground('#2e3192').setFontColor('#ffffff');
  sheet.getRange(2, 8, last - 1, 3).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  sheet.getRange(2, 7, last - 1, 1).setNumberFormat('0').setHorizontalAlignment('right');
  sheet.getRange(2, 12, last - 1, 1).setNumberFormat('0').setHorizontalAlignment('right');
  sheet.getRange(2, 11, last - 1, 1).setWrap(true).setVerticalAlignment('top');
  [[1, 130], [6, 120], [7, 100], [8, 100], [9, 100], [10, 100], [11, 260], [12, 70], [13, 150], [14, 200]].forEach(c => sheet.setColumnWidth(c[0], c[1]));
  sheet.setFrozenRows(1);
  sheet.hideColumns(2, 4);
  return 'Chair Reports view built. The JSON columns B to E are hidden, not removed.';
}
