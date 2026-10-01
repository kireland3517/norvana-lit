// ============================================================
// NORVANA — One-time spreadsheet setup for the revision update
// Run from the Apps Script editor. See DEPLOYMENT.md,
// "Required spreadsheet setup".
//
//   checkSetup()  — read-only. Reports what is done and what isn't.
//   runSetup()    — makes the changes. Safe to run more than once:
//                   it never overwrites existing data or clears a tab.
//
// Results appear in the Execution log at the bottom of the editor.
// ============================================================

function checkSetup() {
  setupSheet_(false);
}

function runSetup() {
  setupSheet_(true);
}

function setupSheet_(apply) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const log = [];
  const say = msg => { log.push(msg); Logger.log(msg); };
  say((apply ? 'RUN SETUP' : 'CHECK ONLY (nothing will be changed)') + ' — ' + ss.getName());

  // 1. Orders column L = "Revision"
  const orders = ss.getSheetByName('Orders');
  if (!orders) {
    say('1. Orders: STOP — no Orders tab found.');
  } else {
    const lastRow = Math.max(orders.getLastRow(), 1);
    const colL = orders.getRange(1, 12, lastRow, 1).getValues().map(r => r[0]);
    const otherValues = colL.slice(1).filter(v => v !== '' && v !== null).length;
    if (colL[0] === 'Revision') {
      say('1. Orders: OK — L1 already says Revision.');
    } else if (colL[0] !== '' || otherValues > 0) {
      say('1. Orders: STOP — column L is not empty (L1 = "' + colL[0] + '", ' + otherValues + ' other filled cells). Not touching it; check this by hand.');
    } else if (apply) {
      orders.getRange(1, 12).setValue('Revision');
      say('1. Orders: DONE — set L1 to Revision.');
    } else {
      say('1. Orders: NEEDED — L1 will be set to Revision.');
    }
  }

  // 2. "Chair Reports" tab with exact headers
  const headers = ['Reporting Month', 'Draft JSON', 'Finalized JSON', 'Revision', 'Email Attempt JSON'];
  const chair = ss.getSheetByName('Chair Reports');
  if (chair) {
    const row1 = chair.getRange(1, 1, 1, 5).getValues()[0];
    const ok = ['Reporting Month', 'Presentation Month'].includes(row1[0]) && headers.slice(1).every((h, i) => row1[i + 1] === h);
    say('2. Chair Reports: ' + (ok ? 'OK — tab exists with correct headers.' : 'STOP — tab exists but headers differ (' + row1.join(' | ') + '). Not touching it; check this by hand.'));
  } else if (apply) {
    const sheet = ss.insertSheet('Chair Reports');
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange(1, 1, 1, 5).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    say('2. Chair Reports: DONE — tab created with headers.');
  } else {
    say('2. Chair Reports: NEEDED — tab will be created.');
  }

  // 3. Secretary Email in Config (only reported; set it later in Dashboard Settings)
  const config = ss.getSheetByName('Config');
  if (!config) {
    say('3. Config: STOP — no Config tab found.');
  } else {
    const row = config.getDataRange().getValues().find(r => String(r[0]).trim().toLowerCase() === 'secretary email');
    say('3. Secretary Email: ' + (row && row[1] ? 'OK — set to ' + row[1] + '.' : 'NOT SET — enter it later in Dashboard → Settings. Secretary emails stay off until then.'));
  }

  // 4. Catalog column E must allow negative whole numbers
  const catalog = ss.getSheetByName('Catalog');
  if (!catalog) {
    say('4. Catalog: STOP — no Catalog tab found.');
  } else {
    const lastRow = Math.max(catalog.getLastRow(), 2);
    const range = catalog.getRange(2, 5, lastRow - 1, 1);
    const rules = range.getDataValidations().map(r => r[0]);
    const T = SpreadsheetApp.DataValidationCriteria;
    const blocksNegatives = rule => {
      if (!rule) return false;
      const type = rule.getCriteriaType(), vals = rule.getCriteriaValues();
      return (type === T.NUMBER_GREATER_THAN_OR_EQUAL_TO && vals[0] >= 0) ||
             (type === T.NUMBER_GREATER_THAN && vals[0] >= -1) ||
             (type === T.NUMBER_BETWEEN && Math.min(vals[0], vals[1]) >= 0);
    };
    const bad = rules.filter(blocksNegatives).length;
    const header = catalog.getRange(1, 5).getValue();
    if (!bad) {
      say('4. Catalog column E ("' + header + '"): OK — nothing blocks negative numbers.');
    } else if (apply) {
      rules.forEach((rule, i) => { if (blocksNegatives(rule)) catalog.getRange(i + 2, 5).clearDataValidations(); });
      say('4. Catalog column E ("' + header + '"): DONE — removed the no-negatives rule from ' + bad + ' cells. Values untouched.');
    } else {
      say('4. Catalog column E ("' + header + '"): NEEDED — ' + bad + ' cells block negative numbers; the rule will be removed (values untouched).');
    }
  }

  // 5. Timezones (reported only)
  const sheetTz = ss.getSpreadsheetTimeZone(), scriptTz = Session.getScriptTimeZone();
  const tzOk = sheetTz === 'America/New_York' && scriptTz === 'America/New_York';
  say('5. Timezones: ' + (tzOk ? 'OK' : 'CHECK BY HAND') + ' — spreadsheet ' + sheetTz + ', script ' + scriptTz + '.');

  // 6. Sheets advanced service (must be switched on by hand under Services +)
  say('6. Sheets service: ' + (typeof Sheets !== 'undefined' ? 'OK — enabled.' : 'NOT ENABLED — add it under Services (+) → Google Sheets API.'));

  return log.join('\n');
}
