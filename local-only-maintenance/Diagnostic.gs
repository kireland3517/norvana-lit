// ============================================================
// NORVANA Diagnostic — paste into Code.gs and run
// ============================================================

function runDiagnostic() {
  const ss = SpreadsheetApp.openById('1TFcx55RMampRYUpVhUP3Nzp5hGERJB2F3GnLFvt7A40');
  const results = {};

  // Check which tabs exist
  const tabs = ss.getSheets().map(s => s.getName());
  results.tabs = tabs;

  // Check Schedule tab
  const schedule = ss.getSheetByName('Schedule');
  if (schedule) {
    const data = schedule.getDataRange().getValues();
    results.schedule_rows = data.length;
    results.schedule_row1 = data[0] ? String(data[0][0]) + ' | ' + String(data[0][1]) + ' | ' + String(data[0][2]) : 'empty';
    results.schedule_row2 = data[1] ? String(data[1][0]) + ' | ' + String(data[1][1]) + ' | ' + (data[1][1] instanceof Date ? 'IS DATE' : 'NOT DATE') : 'empty';
  } else {
    results.schedule = 'TAB NOT FOUND';
  }

  // Check Config tab
  const config = ss.getSheetByName('Config');
  if (config) {
    const data = config.getDataRange().getValues();
    results.config_rows = data.length;
    results.config_row2 = data[1] ? String(data[1][0]) + ' | ' + String(data[1][1]) : 'empty';
  } else {
    results.config = 'TAB NOT FOUND';
  }

  // Check Catalog tab
  const catalog = ss.getSheetByName('Catalog');
  if (catalog) {
    const data = catalog.getDataRange().getValues();
    results.catalog_rows = data.length;
    results.catalog_row2 = data[1] ? String(data[1][0]) + ' | ' + String(data[1][1]) + ' | ' + String(data[1][2]) + ' | active=' + String(data[1][5]) : 'empty';
    // Count active items
    let active = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim().toUpperCase() === 'YES') active++;
    }
    results.catalog_active_count = active;
  } else {
    results.catalog = 'TAB NOT FOUND';
  }

  // Check Groups tab
  const groups = ss.getSheetByName('Groups');
  if (groups) {
    const data = groups.getDataRange().getValues();
    results.groups_rows = data.length;
    results.groups_row2 = data[1] ? String(data[1][0]) : 'empty';
  } else {
    results.groups = 'TAB NOT FOUND';
  }

  // Try getCurrentWindow
  try {
    const w = getCurrentWindow();
    results.current_window = JSON.stringify(w);
  } catch(e) {
    results.current_window_error = e.message;
  }

  // Try getCatalogForForm
  try {
    const c = getCatalogForForm();
    results.catalog_for_form_count = c.length;
    results.catalog_first_item = c[0] ? JSON.stringify(c[0]) : 'none';
  } catch(e) {
    results.catalog_for_form_error = e.message;
  }

  // Try getGroups
  try {
    const g = getGroups();
    results.groups_count = g.length;
    results.groups_first = g[0] || 'none';
  } catch(e) {
    results.groups_error = e.message;
  }

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}