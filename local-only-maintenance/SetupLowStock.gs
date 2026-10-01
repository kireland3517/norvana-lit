// Sets up the "Low At" column (G) on the Catalog tab and populates
// per-item low-stock thresholds based on 8 months of order-form data.
// Safe to run multiple times — skips items that already have a value.

function setupLowStockThresholds() {
  var sheet = getSheet('Catalog');
  var data  = sheet.getDataRange().getValues();

  // Ensure header
  if (String(data[0][6]).trim() !== 'Low At') {
    sheet.getRange(1, 7).setValue('Low At');
    Logger.log('Added "Low At" header to column G.');
  }

  // Per-item thresholds from Jan–Aug 2026 order-form analysis.
  // Value = 2nd-busiest month's demand (robust to one outlier).
  var thresholds = {
    '1101': 6,   // Basic Text
    '1110': 2,   // Spiritual Principle A Day
    '1112': 1,   // Just For Today
    '1130': 1,   // Sponsorship
    '1140': 7,   // It Works How and Why
    '1150': 6,   // Living Clean
    '1200': 18,  // Intro Guide To NA
    '1201': 1,   // Guiding Principles
    '1213': 2,   // Phone Books (10pk)
    '1400': 6,   // Step Working Guide
    '1500': 3,   // NA White Book (5pk)
    '2110': 1,   // Treasurers Workbook
    '3101': 2,   // IP #1
    '3102': 1,   // IP #2
    '3105': 2,   // IP #5
    '3106': 3,   // IP #6
    '3107': 4,   // IP #7
    '3108': 3,   // IP #8
    '3109': 3,   // IP #9
    '3111': 3,   // IP #11
    '3112': 3,   // IP #12
    '3113': 3,   // IP #13
    '3114': 2,   // IP #14
    '3115': 2,   // IP #15
    '3116': 4,   // IP #16
    '3117': 4,   // IP #17
    '3119': 4,   // IP #19
    '3120': 1,   // IP #20
    '3121': 3,   // IP #21
    '3122': 1,   // IP #22
    '3123': 2,   // IP #23
    '3129': 3,   // Intro to NA Meetings
    '4100': 24,  // Keytag Welcome
    '4101': 15,  // Keytag 30 Days
    '4102': 10,  // Keytag 60 Days
    '4103': 7,   // Keytag 90 Days
    '4104': 5,   // Keytag 6 Months
    '4105': 4,   // Keytag 9 Months
    '4106': 3,   // Keytag 1 Year
    '4107': 1,   // Keytag 18 Months
    '4108': 6,   // Keytag Multiple Years
    '4301': 4,   // Medallion 1 Yr
    '4302': 2,   // Medallion 2 Yr
    '4303': 2,   // Medallion 3 Yr
    '4304': 1,   // Medallion 4 Yr
    '4305': 1,   // Medallion 5 Yr
    '4306': 1,   // Medallion 6 Yr
    '4307': 1,   // Medallion 7 Yr
    '4308': 1,   // Medallion 8 Yr
    '4309': 1,   // Medallion 9 Yr
    '4310': 1,   // Medallion 10 Yr
    '4311': 1,   // Medallion 11 Yr
    '4312': 1,   // Medallion 12 Yr
    '4313': 1,   // Medallion 13 Yr
    '4314': 1,   // Medallion 14 Yr
    '4316': 1,   // Medallion 16 Yr
    '4318': 1,   // Medallion 18 Yr
    '4321': 1,   // Medallion 21 Yr
    '4322': 1,   // Medallion 22 Yr
    '4323': 1,   // Medallion 23 Yr
    '4324': 1,   // Medallion 24 Yr
    '4325': 2,   // Medallion 25 Yr
    '4326': 1,   // Medallion 26 Yr
    '4327': 1,   // Medallion 27 Yr
    '4328': 1,   // Medallion 28 Yr
    '4329': 1,   // Medallion 29 Yr
    '4330': 1,   // Medallion 30 Yr
    '9130': 3,   // Readings (Set of 7)
  };

  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    if (!id) continue;
    var existing = data[i][6];
    if (existing !== '' && existing !== undefined && existing !== null) continue;
    var val = thresholds[id] !== undefined ? thresholds[id] : 5;
    sheet.getRange(i + 1, 7).setValue(val);
    updated++;
  }

  Logger.log('Done — set Low At for ' + updated + ' items. Items with existing values were skipped.');
  Logger.log('You can edit any threshold directly in the Catalog tab, column G.');
}
