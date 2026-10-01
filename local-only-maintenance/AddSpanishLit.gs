function addSpanishLit() {
  var sheet = getSheet('Catalog');
  var data = sheet.getDataRange().getValues();

  // ── 1. Rename "Pamphlets" → "IPs" ──
  var renamed = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === 'Pamphlets') {
      sheet.getRange(i + 1, 2).setValue('IPs');
      renamed++;
    }
  }
  Logger.log('Renamed ' + renamed + ' Pamphlets rows to IPs');

  // ── 2. Build set of existing IDs ──
  data = sheet.getDataRange().getValues();
  var existing = {};
  var prices = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    existing[id] = true;
    prices[id] = Number(data[i][3]);
  }

  // Helper: get English price for a Spanish item
  function ep(engId) { return prices[engId] || 0; }

  // ── 3. All items to add ──
  // Format: [itemId, category, name, price, stock, active, lowAt]
  var items = [
    // --- English additions ---
    ['3130', 'IPs', 'IP #30 Mental Health in Recovery', 1.45, 63, 'YES', 1],
    ['9425', 'Special Orders', 'NA Survival Kit', 27.50, 0, 'YES', 1],

    // --- Spanish Lit: Booklets ---
    ['1164S', 'Spanish Lit', 'Los Doce Conceptos de Servicio', ep('1164'), 0, 'YES', 1],
    ['1200S', 'Spanish Lit', 'Guia de Introduccion a NA', ep('1200'), 0, 'YES', 1],
    ['1500S', 'Spanish Lit', 'Librito Blanco', ep('1500'), 0, 'YES', 1],
    ['1601S', 'Spanish Lit', 'Entre Rejas', ep('1601'), 0, 'YES', 1],
    ['1603S', 'Spanish Lit', 'Cuando Estamos Enfermos', ep('1603'), 0, 'YES', 1],
    ['1604S', 'Spanish Lit', 'NA: Un Recurso en su Comunidad', ep('1604'), 0, 'YES', 1],
    ['3118S', 'Spanish Lit', 'Guia del Grupo', ep('3118'), 0, 'YES', 1],

    // --- Spanish Lit: IPs ---
    ['3101S', 'Spanish Lit', 'IP #1 Quien, Que, Como y Por Que', ep('3101'), 0, 'YES', 1],
    ['3102S', 'Spanish Lit', 'IP #2 El Grupo', ep('3102'), 0, 'YES', 1],
    ['3105S', 'Spanish Lit', 'IP #5 Otro Punto de Vista', ep('3105'), 0, 'YES', 1],
    ['3106S', 'Spanish Lit', 'IP #6 Recuperacion y Recaida', ep('3106'), 0, 'YES', 1],
    ['3107S', 'Spanish Lit', 'IP #7 Soy Adicto?', ep('3107'), 0, 'YES', 1],
    ['3108S', 'Spanish Lit', 'IP #8 Solo por Hoy', ep('3108'), 0, 'YES', 1],
    ['3109S', 'Spanish Lit', 'IP #9 Vivir el Programa', ep('3109'), 0, 'YES', 1],
    ['3110S', 'Spanish Lit', 'IP #10 Guia para el Cuarto Paso', ep('3110'), 0, 'YES', 1],
    ['3111S', 'Spanish Lit', 'IP #11 El Padrinazgo', ep('3111'), 0, 'YES', 1],
    ['3112S', 'Spanish Lit', 'IP #12 Triangulo de Autoobsesion', ep('3112'), 0, 'YES', 1],
    ['3113S', 'Spanish Lit', 'IP #13 De Adictos Jovenes', ep('3113'), 0, 'YES', 1],
    ['3114S', 'Spanish Lit', 'IP #14 Experiencia de un Adicto', ep('3114'), 0, 'YES', 1],
    ['3115S', 'Spanish Lit', 'IP #15 Info Publica y el Miembro', ep('3115'), 0, 'YES', 1],
    ['3116S', 'Spanish Lit', 'IP #16 Para el Recien Llegado', ep('3116'), 0, 'YES', 1],
    ['3117S', 'Spanish Lit', 'IP #17 Para Quienes en Tratamiento', ep('3117'), 0, 'YES', 1],
    ['3119S', 'Spanish Lit', 'IP #19 La Autoaceptacion', ep('3119'), 0, 'YES', 1],
    ['3120S', 'Spanish Lit', 'IP #20 Servicio H&I y el Miembro', ep('3120'), 0, 'YES', 1],
    ['3121S', 'Spanish Lit', 'IP #21 Mantenerse Limpio en Aislamiento', ep('3121'), 0, 'YES', 1],
    ['3122S', 'Spanish Lit', 'IP #22 Bienvenido a NA', ep('3122'), 0, 'YES', 1],
    ['3123S', 'Spanish Lit', 'IP #23 Mantenerse Limpio en la Calle', ep('3123'), 0, 'YES', 1],
    ['3124S', 'Spanish Lit', 'IP #24 El Dinero Importa', ep('3124'), 0, 'YES', 1],
    ['3126S', 'Spanish Lit', 'IP #26 Accesibilidad', ep('3126'), 0, 'YES', 1],
    ['3127S', 'Spanish Lit', 'IP #27 Para Padres y Tutores', ep('3127'), 0, 'YES', 1],
    ['3128S', 'Spanish Lit', 'IP #28 Financiacion de Servicios', ep('3128'), 0, 'YES', 1],
    ['3129S', 'Spanish Lit', 'Introduccion a Reuniones de NA', ep('3129'), 0, 'YES', 1],
    ['3130S', 'Spanish Lit', 'IP #30 Salud Mental en Recuperacion', 1.45, 0, 'YES', 1],

    // --- Spanish Lit: Readings & Survival Kit ---
    ['9130S', 'Spanish Lit', 'Lecturas (Set of 7)', ep('9130'), 0, 'YES', 1],
    ['9425S', 'Spanish Lit', 'NA Survival Kit (Spanish)', 27.50, 0, 'YES', 1]
  ];

  // ── 4. Add items (skip duplicates) ──
  var added = 0;
  var skipped = 0;
  for (var i = 0; i < items.length; i++) {
    var row = items[i];
    if (existing[String(row[0])]) {
      Logger.log('SKIP (exists): ' + row[0] + ' ' + row[2]);
      skipped++;
      continue;
    }
    sheet.appendRow(row);
    added++;
    Logger.log('Added: ' + row[0] + ' | ' + row[1] + ' | ' + row[2] + ' | $' + row[3]);
  }

  Logger.log('');
  Logger.log('Done. Added ' + added + ' items, skipped ' + skipped + '.');
  Logger.log('Renamed ' + renamed + ' category rows from Pamphlets to IPs.');
  Logger.log('You can adjust names and prices in the Catalog tab.');
}
