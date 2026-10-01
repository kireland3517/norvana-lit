// ============================================================
// NORVANA — Settings Migration Script
// Run once from Apps Script editor
// Creates Config and Schedule tabs from existing Settings tab
// ============================================================

function migrateSettings() {
  const ss = SpreadsheetApp.openById('1TFcx55RMampRYUpVhUP3Nzp5hGERJB2F3GnLFvt7A40');

  // ── Create or clear Config tab ──────────────────────────────
  let config = ss.getSheetByName('Config');
  if (!config) config = ss.insertSheet('Config');
  config.clearContents();

  config.getRange('A1:B1').setValues([['Setting', 'Value']]);
  config.getRange('A2:B2').setValues([['Lit Chair Email', 'norvanalit12@gmail.com']]);
  config.getRange('A3:B3').setValues([['Dashboard Access Code', 'changeme']]);

  // Style header
  config.getRange('A1:B1').setFontWeight('bold').setBackground('#2e3192').setFontColor('white');
  config.setColumnWidth(1, 220);
  config.setColumnWidth(2, 280);

  // ── Create or clear Schedule tab ───────────────────────────
  let schedule = ss.getSheetByName('Schedule');
  if (!schedule) schedule = ss.insertSheet('Schedule');
  schedule.clearContents();

  // Header
  schedule.getRange('A1:C1').setValues([['Meeting Month', 'Window Open', 'Window Close']]);
  schedule.getRange('A1:C1').setFontWeight('bold').setBackground('#2e3192').setFontColor('white');

  // Write schedule as plain text month names and real Date objects
  // Window Open = first Friday of previous month
  // Window Close = first Thursday of meeting month
  // April 2026 window: open Mar 6, close Apr 2
  const scheduleData = [
    ['January 2026',   new Date(2025, 11, 5),  new Date(2026, 0, 8)],
    ['February 2026',  new Date(2026, 0, 2),   new Date(2026, 1, 5)],
    ['March 2026',     new Date(2026, 1, 6),   new Date(2026, 2, 5)],
    ['April 2026',     new Date(2026, 2, 6),   new Date(2026, 3, 2)],
    ['May 2026',       new Date(2026, 3, 3),   new Date(2026, 4, 7)],
    ['June 2026',      new Date(2026, 4, 1),   new Date(2026, 5, 4)],
    ['July 2026',      new Date(2026, 5, 5),   new Date(2026, 6, 2)],
    ['August 2026',    new Date(2026, 6, 3),   new Date(2026, 7, 6)],
    ['September 2026', new Date(2026, 7, 7),   new Date(2026, 8, 3)],
    ['October 2026',   new Date(2026, 8, 4),   new Date(2026, 9, 1)],
    ['November 2026',  new Date(2026, 9, 2),   new Date(2026, 10, 5)],
    ['December 2026',  new Date(2026, 10, 6),  new Date(2026, 11, 3)],
  ];

  // Write month names as plain text in column A (force text format to prevent date conversion)
  schedule.getRange('A2:A13').setNumberFormat('@STRING@');
  scheduleData.forEach((row, idx) => {
    schedule.getRange(idx + 2, 1).setValue(row[0]);
    schedule.getRange(idx + 2, 2).setValue(row[1]);
    schedule.getRange(idx + 2, 3).setValue(row[2]);
  });

  // Format B and C columns as dates
  schedule.getRange('B2:C13').setNumberFormat('M/D/YYYY');
  schedule.setColumnWidth(1, 160);
  schedule.setColumnWidth(2, 120);
  schedule.setColumnWidth(3, 120);

  // ── Add note to old Settings tab ───────────────────────────
  const settings = ss.getSheetByName('Settings');
  if (settings) {
    settings.getRange('A1').setNote('Replaced by Config and Schedule tabs. Do not edit.');
  }

  SpreadsheetApp.getUi().alert(
    '✅ Migration complete.\n\n' +
    'Config tab — email and access code.\n' +
    'Schedule tab — order window dates.\n\n' +
    'The old Settings tab has been left in place but is no longer used.\n' +
    'You can delete it once you confirm everything works.'
  );
}