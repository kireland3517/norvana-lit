// Run this to see all items in the Catalog tab — check for missing items or wrong categories.
function diagnoseCatalog() {
  var data = getSheet('Catalog').getDataRange().getValues();
  var cats = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    var cat = String(data[i][1]);
    var name = String(data[i][2]);
    var active = String(data[i][5]).trim().toUpperCase();
    if (!id) continue;
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(id + '  ' + name + (active !== 'YES' ? '  [INACTIVE]' : ''));
  }
  var total = 0;
  Object.keys(cats).sort().forEach(function(cat) {
    Logger.log('');
    Logger.log('=== ' + cat + ' (' + cats[cat].length + ' items) ===');
    cats[cat].forEach(function(line) { Logger.log('  ' + line); });
    total += cats[cat].length;
  });
  Logger.log('');
  Logger.log('TOTAL: ' + total + ' items across ' + Object.keys(cats).length + ' categories');
}
