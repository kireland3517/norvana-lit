// 1. Adds Medallion 31–40 Years to the Catalog.
// 2. Fixes Low At threshold for zero-demand items (5 → 1).
// Safe to run multiple times — skips items that already exist.

function fixCatalog() {
  var sheet = getSheet('Catalog');
  var data  = sheet.getDataRange().getValues();

  // Build set of existing item IDs
  var existing = {};
  for (var i = 1; i < data.length; i++) {
    existing[String(data[i][0])] = i;
  }

  // ── 1. Add Medallions 31–40 ──
  var added = 0;
  for (var yr = 31; yr <= 40; yr++) {
    var id = '4' + String(300 + yr);  // 4331, 4332, ... 4340
    if (existing[id]) continue;
    sheet.appendRow([id, 'Medallions', yr + ' Years', 4.37, 0, 'YES', 1]);
    added++;
  }
  Logger.log('Added ' + added + ' new medallion items (31–40 Years).');

  // ── 2. Fix thresholds for zero-demand items ──
  // These had 0 group orders Jan–Aug 2026 but got default threshold of 5.
  var zeroDemand = [
    '1121', '1164', '1601', '1603', '1604', '2111',
    '2202', '2203', '2204', '2205', '2206', '2207', '2306',
    '3110', '3118', '3124', '3124B', '3126',
    '3127', '3128',
    '4300', '4315', '4317', '4319', '4320', '4399'
  ];

  var fixed = 0;
  // Re-read data in case rows were appended above
  data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    if (zeroDemand.indexOf(id) === -1) continue;
    var current = data[i][6];
    if (current === 1 || current === '1') continue;
    sheet.getRange(i + 1, 7).setValue(1);
    fixed++;
  }
  Logger.log('Fixed Low At threshold to 1 for ' + fixed + ' zero-demand items.');

  // Also set Low At = 1 for the new medallions 31–40 (already done in appendRow above)
  Logger.log('Done. You can adjust any threshold in Catalog column G.');
}
