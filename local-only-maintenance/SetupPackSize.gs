// One-time setup: adds Catalog column H "Pack Size" and restates Low At for pack items in singles.
// Safe to run more than once. Does not change stock counts.
function setupPackSize() {
  var sheet = getSheet('Catalog');
  var data = sheet.getDataRange().getValues();

  // Second-busiest month Jan-Sep 2026, converted to singles (keytags never below 20).
  var LOW_SINGLES = {
    '1213': 20, '1500': 15, '1604': 5,
    '3101': 10, '3102': 5, '3105': 10, '3106': 15, '3107': 20, '3108': 15, '3109': 15,
    '3111': 15, '3112': 15, '3113': 15, '3114': 10, '3115': 10, '3116': 20, '3117': 20,
    '3119': 20, '3120': 5, '3121': 15, '3122': 10, '3123': 10, '3129': 15,
    '4100': 120, '4101': 75, '4102': 50, '4103': 35, '4104': 25, '4105': 20,
    '4106': 20, '4107': 20, '4108': 30
  };
  // Single-item thresholds that moved after adding September.
  var LOW_OTHER = { '1112': 2, '4301': 6 };

  function packSize(id, category) {
    var base = id.replace(/^SP|S$/g, '');
    if (base === '1213') return 10;
    if (category === 'IPs' || category === 'Keytags') return 5;
    if (base === '1500') return 5;
    if (category === 'Spanish Lit' && (base === '1604' || (/^31\d\d$/.test(base) && base !== '3110' && base !== '3118'))) return 5;
    return 1;
  }

  sheet.getRange(1, 8).setValue('Pack Size');
  var changed = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]).trim();
    if (!id) continue;
    var pack = packSize(id, String(data[i][1]));
    sheet.getRange(i + 1, 8).setValue(pack);
    var low = null;
    if (pack > 1) low = LOW_SINGLES[id] || pack;
    else if (LOW_OTHER[id]) low = LOW_OTHER[id];
    if (low !== null && Number(data[i][6]) !== low) {
      sheet.getRange(i + 1, 7).setValue(low);
      changed.push(id + ' ' + data[i][2] + ': Low At ' + data[i][6] + ' -> ' + low);
    }
  }
  Logger.log('Pack Size filled for ' + (data.length - 1) + ' items.');
  Logger.log(changed.length + ' Low At values changed:\n' + changed.join('\n'));
}
