function debugCatalog() {
  const ss   = SpreadsheetApp.openById('1TFcx55RMampRYUpVhUP3Nzp5hGERJB2F3GnLFvt7A40');
  const sheet = ss.getSheetByName('Catalog');
  const data  = sheet.getDataRange().getValues();

  // Check first 3 data rows
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const row = data[i];
    results.push({
      row: i + 1,
      col_a_val:  String(row[0]),
      col_a_type: typeof row[0],
      col_b_val:  String(row[1]),
      col_b_type: typeof row[1],
      col_c_val:  String(row[2]),
      col_c_type: typeof row[2],
      col_d_val:  String(row[3]),
      col_d_type: typeof row[3],
      col_e_val:  String(row[4]),
      col_f_val:  String(row[5]),
      col_f_type: typeof row[5],
      col_f_upper: String(row[5]).trim().toUpperCase(),
      col_f_equals_YES: String(row[5]).trim().toUpperCase() === 'YES',
    });
  }

  Logger.log(JSON.stringify(results, null, 2));

  // Also test getCatalogForForm directly
  try {
    const catalog = getCatalogForForm();
    Logger.log('getCatalogForForm count: ' + catalog.length);
    Logger.log('First item: ' + JSON.stringify(catalog[0]));
  } catch(e) {
    Logger.log('getCatalogForForm ERROR: ' + e.message);
  }

  // Test if JSON.stringify works on the catalog
  try {
    const catalog = getCatalogForForm();
    const str = JSON.stringify(catalog);
    Logger.log('JSON.stringify length: ' + str.length);
    Logger.log('First 200 chars: ' + str.substring(0, 200));
  } catch(e) {
    Logger.log('JSON.stringify ERROR: ' + e.message);
  }

  return results;
}