// One-time: renames Spanish item IDs from "3101S" to FSRSC's "SP3101" format.
// Updates Catalog and any Order Items rows. Safe to run more than once.
function renameSpanishIds() {
  var renamed = 0;
  ['Catalog', 'Order Items'].forEach(function(name) {
    var sheet = getSheet(name);
    var col = name === 'Catalog' ? 1 : 3;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var m = String(data[i][col - 1]).trim().match(/^(\d+)S$/);
      if (!m) continue;
      sheet.getRange(i + 1, col).setValue('SP' + m[1]);
      Logger.log(name + ': ' + m[0] + ' -> SP' + m[1]);
      renamed++;
    }
  });
  Logger.log('Done. Renamed ' + renamed + ' IDs.');
}
