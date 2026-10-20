// Monthly Summary tab: written by the script from the same calculation as the Trends screen (TrendsReport.gs), so the sheet
// and the app always show the same numbers. Requested = every order for the month, Distributed = Completed orders only,
// value = price saved on each order line, average = up to 3 earlier months since tracking began, zero months included.
// Pick the month in cell B1. The tab refreshes when B1, Orders or Order Items is edited by hand and whenever the app
// submits, packs, completes, reopens or deletes an order. Run setupMonthlySummary() once to build the tab and its edit trigger.
// (Spreadsheet formulas were tried and rejected: they break when Order Items has fewer rows than the formula ranges.)
const MS_SHEET_ = 'Monthly Summary', MS_HEADER_ROW_ = 6, MS_FIRST_ROW_ = 7, MS_COLUMNS_ = 8, MS_ROWS_ = 300, MS_MONTHS_ROWS_ = 40; // hidden column J lists the months in the picker

function monthlySummaryTable_(report, updatedText) {
  const blank = v => v == null ? '' : v, t = report.totals;
  return {
    top: [['Month Filter', report.month, 'Last updated', updatedText],
      ['Compare with', report.prevMonth || 'n/a (before tracking began)', '', ''],
      ['Tracking began', report.startMonth, '', ''],
      ['Status', report.monthToDate ? 'Month to date - orders still waiting for pickup are not counted as distributed yet' : 'Distributed counts picked-up (Completed) orders only', '', '']],
    totals: ['All items', '', t.requested, t.distributed, t.value, blank(t.prev), blank(t.avg), report.avgMonths],
    headers: ['Category', 'Item', 'Requested', 'Distributed (picked up)', 'Actual value', 'Previous month', 'Average of earlier months', 'Months in average'],
    rows: report.items.map(i => [i.category, i.name, i.requested, i.distributed, i.value, blank(i.prev), blank(i.avg), report.avgMonths]) };
}

function refreshMonthlySummary_() {
  const sheet = getSheet(MS_SHEET_);
  if (!sheet) return;
  const selected = String(sheet.getRange('B1').getDisplayValue()).trim();
  const clear = () => {
    const rows = Math.max(1, sheet.getMaxRows() - MS_FIRST_ROW_ + 1);
    sheet.getRange(MS_FIRST_ROW_, 1, rows, MS_COLUMNS_).clearContent();
  };
  let report;
  try {
    report = trendsReport_(readOrders_(), getSheet('Order Items').getDataRange().getValues(), getCatalogMap_(), selected, getCurrentWindow().meetingMonth);
  } catch (e) {
    clear();
    sheet.getRange('B4').setValue(e.message);
    return;
  }
  const table = monthlySummaryTable_(report, Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a'));
  // Plain text first, or Sheets turns "October 2026" into a date and the picker stops matching.
  sheet.getRange(1, 2, 4, 1).setNumberFormat('@');
  sheet.getRange(2, 10, MS_MONTHS_ROWS_, 1).setNumberFormat('@');
  sheet.getRange(1, 1).setValue(table.top[0][0]);
  sheet.getRange(2, 1, 3, 2).setValues(table.top.slice(1).map(r => [r[0], r[1]]));
  sheet.getRange(2, 10, MS_MONTHS_ROWS_, 1).clearContent();
  sheet.getRange(2, 10, report.availableMonths.length, 1).setValues(report.availableMonths.map(m => [m]));
  sheet.getRange(1, 3, 1, 2).setValues([[table.top[0][2], table.top[0][3]]]);
  sheet.getRange(5, 1, 1, MS_COLUMNS_).setValues([table.totals]);
  clear();
  if (table.rows.length) sheet.getRange(MS_FIRST_ROW_, 1, table.rows.length, MS_COLUMNS_).setValues(table.rows);
  else sheet.getRange(MS_FIRST_ROW_, 1).setValue('No orders for this month yet');
}

// Never lets a summary problem block an order.
function refreshMonthlySummarySafe_() {
  try { refreshMonthlySummary_(); } catch (e) { /* the app's Trends screen still has the numbers */ }
}

// Installable edit trigger: hand edits to Orders or Order Items, or a new month in B1.
function handleSummaryEdit(e) {
  try {
    const range = e && e.range, name = range && range.getSheet().getName();
    if (name === MS_SHEET_ ? range.getRow() === 1 && range.getColumn() === 2 : name === 'Orders' || name === 'Order Items') refreshMonthlySummary_();
  } catch (err) { /* ignore */ }
}

// Public functions can be called by anyone holding the app link, so the setup tools only run from the Apps Script editor.
function requireEditor_() {
  if (!Session.getActiveUser().getEmail()) throw new Error('Run this from the Apps Script editor.');
}

function formatMonthlySummary_(sheet) {
  const light = '#eeeffe', navy = '#2e3192', muted = '#7a7ea8', highlight = '#fff4b3', last = MS_FIRST_ROW_ + MS_ROWS_ - 1;
  sheet.getRange('A1').setValue('Month Filter').setFontWeight('bold').setVerticalAlignment('bottom');
  const oldFilter = sheet.getFilter();
  if (oldFilter) oldFilter.remove(); // the old tab had a filter on its table; the new layout does not
  const picker = sheet.getRange('B1');
  if (picker.getBackground() === highlight) { // undo an earlier boxed look; the dropdown itself is left alone
    picker.setBackground(null).setFontSize(10).setFontWeight('normal').setVerticalAlignment('bottom').setBorder(false, false, false, false, false, false);
    sheet.setRowHeight(1, 21);
  }
  picker.setNumberFormat('@').setHorizontalAlignment('left');
  sheet.getRange('C1').setFontColor(muted).setHorizontalAlignment('right');
  sheet.getRange('D1').setFontColor(muted);
  sheet.getRange('A2:A4').setFontColor(muted).setFontSize(10);
  sheet.getRange('B2:B4').setFontColor('#4a4e7a').setFontSize(10).setHorizontalAlignment('left');
  sheet.getRange(5, 1, 1, MS_COLUMNS_).setFontWeight('bold').setBackground(light);
  sheet.getRange(MS_HEADER_ROW_, 1, 1, MS_COLUMNS_).setFontWeight('bold').setBackground(navy).setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sheet.getRange(MS_HEADER_ROW_, 3, 1, 6).setHorizontalAlignment('right');
  sheet.getRange(5, 3, last - 4, 6).setHorizontalAlignment('right');
  sheet.getRange(5, 3, last - 4, 2).setNumberFormat('#,##0');
  sheet.getRange(5, 5, last - 4, 1).setNumberFormat('$#,##0.00');
  sheet.getRange(5, 6, last - 4, 1).setNumberFormat('#,##0');
  sheet.getRange(5, 7, last - 4, 1).setNumberFormat('0.0');
  sheet.getRange(5, 8, last - 4, 1).setNumberFormat('0');
  sheet.setColumnWidth(1, 130); sheet.setColumnWidth(2, 330);
  for (let c = 3; c <= MS_COLUMNS_; c++) sheet.setColumnWidth(c, 110);
  sheet.setFrozenRows(MS_HEADER_ROW_);
  sheet.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenTextContains('Month to date').setBackground(highlight).setRanges([sheet.getRange('B4')]).build()]);
  // The month dropdown reads its months from hidden column J. An older rule (or none) is replaced once; a matching rule is left alone,
  // so a Display style chosen in Data > Data validation survives later runs.
  const rule = picker.getDataValidation();
  const current = rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && rule.getCriteriaValues()[0].getA1Notation() === 'J2:J' + (MS_MONTHS_ROWS_ + 1);
  if (!current)
    picker.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(sheet.getRange(2, 10, MS_MONTHS_ROWS_, 1), true).setAllowInvalid(false).setHelpText('Click the arrow and choose a month.').build());
  sheet.hideColumns(10);
}

// Run this from the editor to reapply the look without rebuilding the tab.
function formatMonthlySummary() {
  requireEditor_();
  const sheet = getSheet(MS_SHEET_);
  formatMonthlySummary_(sheet);
  refreshMonthlySummary_();
  return 'Monthly Summary formatting refreshed.';
}

function setupMonthlySummary() {
  requireEditor_();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(MS_SHEET_), month = TRENDS_START_MONTH_;
  if (sheet) {
    const keep = String(sheet.getRange('B1').getDisplayValue()).trim();
    if (meetingLabelToYm_(keep) != null) month = keep;
    // Everything except B1 is rebuilt, so the month dropdown keeps the look it already has.
    const rows = sheet.getMaxRows(), cols = sheet.getMaxColumns();
    sheet.getRange(1, 1, 1, 1).clear();
    sheet.getRange(2, 1, rows - 1, 2).clear();
    sheet.getRange(1, 3, rows, cols - 2).clear();
  } else {
    sheet = ss.insertSheet(MS_SHEET_);
    sheet.getRange('B1').setNumberFormat('@').setValue(month);
  }
  sheet.getRange(MS_HEADER_ROW_, 1, 1, MS_COLUMNS_).setValues([['Category', 'Item', 'Requested', 'Distributed (picked up)', 'Actual value', 'Previous month', 'Average of earlier months', 'Months in average']]);
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'handleSummaryEdit'))
    ScriptApp.newTrigger('handleSummaryEdit').forSpreadsheet(SHEET_ID).onEdit().create();
  refreshMonthlySummary_();
  formatMonthlySummary_(sheet);
  return 'Monthly Summary rebuilt for ' + month + '.';
}
