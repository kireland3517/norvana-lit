// ============================================================
// NORVANA — Rebuild the ordering-window Schedule from the meeting rule
// Run from the Apps Script editor.
//
// Rule: meetings are the first Thursday of each month, or the second
// Thursday when the first is a holiday (New Year's Day, July 4th;
// Thanksgiving is never a first Thursday). The window for a
// meeting opens the Friday after the previous month's meeting and closes
// on the meeting day itself (both days inclusive).
//   e.g. October 2026: Sep 4 – Oct 1, November 2026: Oct 2 – Nov 5
//
//   previewSchedule()  — read-only. Logs every window it would write.
//   rebuildSchedule()  — replaces all Schedule rows (header kept) with
//                        January 2026 through December 2027.
//
// Individual months (holidays) can still be adjusted in Dashboard Settings.
// ============================================================

const SCHEDULE_FIRST_ = { year: 2026, month: 1 };  // January 2026
const SCHEDULE_LAST_  = { year: 2027, month: 12 }; // December 2027
const CLOSE_OFFSET_DAYS_ = 0; // 0 = close on meeting Thursday, -1 = close the Wednesday before

function previewSchedule() {
  scheduleRows_().forEach(r => Logger.log(r[0] + ':  ' + r[1] + '  →  ' + r[2]));
}

function rebuildSchedule() {
  const tz = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone();
  const sheet = getSheet('Schedule');
  const rows = scheduleRows_().map(r => [r[0], Utilities.parseDate(r[1], tz, 'yyyy-MM-dd'), Utilities.parseDate(r[2], tz, 'yyyy-MM-dd')]);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@');
  sheet.getRange(2, 2, rows.length, 2).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  Logger.log('DONE — wrote ' + rows.length + ' months (' + rows[0][0] + ' to ' + rows[rows.length - 1][0] + ').');
  previewSchedule();
}

// Returns [label, open 'yyyy-MM-dd', close 'yyyy-MM-dd'] for each meeting month.
function scheduleRows_() {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const iso = d => d.toISOString().slice(0, 10);
  const firstThursday = (y, m) => { // m is 1-12; pure UTC date math, no timezone shifts
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCDate(1 + (4 - d.getUTCDay() + 7) % 7);
    return d;
  };
  const meetingDay = (y, m) => {
    const d = firstThursday(y, m), md = iso(d).slice(5);
    return (md === '01-01' || md === '07-04') ? new Date(d.getTime() + 7 * 86400000) : d;
  };
  const rows = [];
  for (let y = SCHEDULE_FIRST_.year, m = SCHEDULE_FIRST_.month; y * 12 + m <= SCHEDULE_LAST_.year * 12 + SCHEDULE_LAST_.month; m === 12 ? (y++, m = 1) : m++) {
    const prev = meetingDay(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
    const open = new Date(prev.getTime() + 86400000);
    const close = new Date(meetingDay(y, m).getTime() + CLOSE_OFFSET_DAYS_ * 86400000);
    rows.push([names[m - 1] + ' ' + y, iso(open), iso(close)]);
  }
  return rows;
}
