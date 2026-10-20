// Free State orders: the Literature Chair reviews a three-column order (Item #, Description, Quantity) and
// sends it to the Free State ordering email from the committee account. Every public function checks the
// dashboard session token. Helpers ending in "_" are private.
//
// Sending is guarded like the Chair Report email: a "Sending" record with the full order is written to the
// Free State Order Log tab BEFORE MailApp is called, so a repeat of the same preview can never email twice.
// Order History only ever receives orders whose email was accepted for sending.
const FREE_STATE_GROUP_NAME_ = 'Northern Virginia Area of NA';
const FREE_STATE_FROM_ = 'norvanalit12@gmail.com';
const FREE_STATE_SUBJECT_ = 'NORVANA Literature Order';
const FS_MAX_LINES_ = 200;
const FS_MAX_QTY_ = 9999;
const FS_MAX_TEXT_ = 100;
const FS_PREVIEW_SECONDS_ = 600;
const FS_STALE_SENDING_MS_ = 120000;
const FS_HISTORY_TAB_ = 'Order History';
const FS_LOG_TAB_ = 'Free State Order Log';
const FS_HISTORY_HEADERS_ = ['Order ID', 'Sent At', 'Item #', 'Description', 'Quantity', 'Inventory Type', 'Requested For', 'Status', 'Recipient', 'Bill To', 'Ship To', 'Recorded At'];
const FS_LOG_HEADERS_ = ['Request ID', 'Order ID', 'Status', 'Created', 'Updated', 'Attempt JSON', 'Snapshot JSON'];

// Settings stored in the Config tab. Bill To email is the Lit Chair Email and the group name is fixed.
const FS_FIELDS_ = [
  { key: 'email', config: 'Free State Order Email', label: 'Free State Order Email' },
  { key: 'billLocation', config: 'Free State Bill To Group Location', label: 'Bill To: Group Location' },
  { key: 'billAddress', config: 'Free State Bill To Mailing Address', label: 'Bill To: Mailing Address' },
  { key: 'billCity', config: 'Free State Bill To City', label: 'Bill To: City' },
  { key: 'billState', config: 'Free State Bill To State', label: 'Bill To: State' },
  { key: 'billZip', config: 'Free State Bill To ZIP Code', label: 'Bill To: ZIP Code' },
  { key: 'billContact', config: 'Free State Bill To Contact Person', label: 'Bill To: Contact Person' },
  { key: 'billPhone', config: 'Free State Bill To Phone Number', label: 'Bill To: Phone Number' },
  { key: 'shipName', config: 'Free State Ship To Name', label: 'Ship To: Name' },
  { key: 'shipPhone', config: 'Free State Ship To Phone', label: 'Ship To: Phone' },
  { key: 'shipStreet', config: 'Free State Ship To Street Address', label: 'Ship To: Street Address' },
  { key: 'shipCity', config: 'Free State Ship To City', label: 'Ship To: City' },
  { key: 'shipState', config: 'Free State Ship To State', label: 'Ship To: State' },
  { key: 'shipZip', config: 'Free State Ship To ZIP Code', label: 'Ship To: ZIP Code' }
];
const FS_EMAIL_PATTERN_ = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -- Settings --

function fsConfig_() {
  const rows = getSheet('Config').getDataRange().getValues(), byName = {};
  rows.forEach(function(r) { byName[String(r[0]).trim().toLowerCase()] = String(r[1] == null ? '' : r[1]).trim(); });
  const values = {};
  FS_FIELDS_.forEach(function(f) { values[f.key] = byName[f.config.toLowerCase()] || ''; });
  const chair = byName['lit chair email'];
  return { values: values, litChairEmail: chair === undefined ? 'norvanalit12@gmail.com' : chair };
}

function fsMissing_(cfg) {
  const missing = [];
  FS_FIELDS_.forEach(function(f) {
    const v = cfg.values[f.key];
    if (!v) missing.push(f.label);
    else if (f.key === 'email' && !FS_EMAIL_PATTERN_.test(v)) missing.push(f.label + ' (not a valid email address)');
  });
  if (!FS_EMAIL_PATTERN_.test(cfg.litChairEmail)) missing.push('Lit Chair Email (set it under Access; it is the Bill To email)');
  return missing;
}

// Read-only calls: session check and error capture, no lock.
function fsGuard_(token, work) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  try { return work(); } catch (e) { return { success: false, error: e.message, missing: e.missing }; }
}

function getFreeStateSettings(token) {
  return fsGuard_(token, function() {
    const cfg = fsConfig_();
    return { success: true, values: cfg.values, groupName: FREE_STATE_GROUP_NAME_, litChairEmail: cfg.litChairEmail, missing: fsMissing_(cfg) };
  });
}

function saveFreeStateSettings(values, token) {
  return withWorkflowLock_(token, function() {
    if (!values || typeof values !== 'object') throw new Error('Enter the Free State information and save again.');
    const clean = {};
    FS_FIELDS_.forEach(function(f) {
      clean[f.key] = cleanText_(values[f.key], FS_MAX_TEXT_);
      if (f.key === 'email' && clean.email && !FS_EMAIL_PATTERN_.test(clean.email)) throw new Error('Enter a valid Free State Order Email address.');
    });
    const sheet = getSheet('Config'), data = sheet.getDataRange().getValues();
    const requests = []; let next = data.length + 1;
    FS_FIELDS_.forEach(function(f) {
      const i = data.findIndex(function(r) { return String(r[0]).trim().toLowerCase() === f.config.toLowerCase(); });
      requests.push(i < 0 ? cellsRequest_(sheet, next++, 1, [f.config, clean[f.key]]) : cellsRequest_(sheet, i + 1, 2, [clean[f.key]]));
    });
    commitCells_(requests);
    // Worked out from what was just saved: reading the sheet back in the same run can return stale cells after a Sheets API write.
    return { success: true, missing: fsMissing_({ values: clean, litChairEmail: fsConfig_().litChairEmail }) };
  });
}

// -- Building the order --

function fsCatalog_() {
  const data = getSheet('Catalog').getDataRange().getValues(), map = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    map[String(data[i][0])] = { name: String(data[i][2]), category: String(data[i][1]), active: String(data[i][5]).trim().toUpperCase() === 'YES', inventoryType: inventoryTypeOf_(data[i][1], data[i][8]) };
  }
  return map;
}

// Validates raw lines from the browser and rebuilds everything else (names, addresses, recipient) from the sheet.
function fsBuildSnapshot_(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length > FS_MAX_LINES_) throw new Error('Check the order and try again.');
  const cfg = fsConfig_(), missing = fsMissing_(cfg);
  if (missing.length) {
    const e = new Error('Fill in these Free State settings first: ' + missing.join(', ') + '.');
    e.missing = missing;
    throw e;
  }
  const catalog = fsCatalog_(), seen = {}, lines = [];
  rawLines.forEach(function(l) {
    const itemId = String(l && l.itemId != null ? l.itemId : '').trim();
    if (!itemId) throw new Error('Check the order and try again.');
    if (seen[itemId]) throw new Error('Each product can appear only once in the order.');
    seen[itemId] = true;
    const raw = l.qty;
    if (raw === '' || raw == null) return;
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty < 0 || qty > FS_MAX_QTY_) throw new Error('Quantities must be whole numbers from 0 to ' + FS_MAX_QTY_ + '.');
    const item = catalog[itemId];
    if (!item) throw new Error('A product in this order is no longer in the catalog. Remove it and review again.');
    if (qty === 0) return;
    if (!item.active) throw new Error(item.name + ' is no longer active. Remove it and review again.');
    lines.push({ itemId: itemId, name: item.name, qty: qty, inventoryType: item.inventoryType, requestedFor: cleanText_(l.requestedFor, FS_MAX_TEXT_) });
  });
  if (!lines.length) throw new Error('Enter a quantity for at least one product.');
  const v = cfg.values;
  return {
    recipient: v.email, subject: demoPrefix_() + FREE_STATE_SUBJECT_,
    billTo: [['Group Name', FREE_STATE_GROUP_NAME_], ['Group Location', v.billLocation], ['Mailing Address', v.billAddress], ['City', v.billCity],
      ['State', v.billState], ['ZIP Code', v.billZip], ['Contact Person', v.billContact], ['Phone Number', v.billPhone], ['Email', cfg.litChairEmail]],
    shipTo: [['Name', v.shipName], ['Phone', v.shipPhone], ['Street Address', v.shipStreet], ['City', v.shipCity], ['State', v.shipState], ['ZIP Code', v.shipZip]],
    lines: lines
  };
}

// Change detector only (not a security hash): the email content plus the recipient.
function fsFingerprint_(snap) {
  const text = JSON.stringify([snap.recipient, snap.subject, snap.billTo, snap.shipTo, snap.lines.map(function(l) { return [l.itemId, l.name, l.qty]; })]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(16) + '-' + text.length;
}

function fsText_(snap) {
  const pairs = function(rows) { return rows.map(function(r) { return r[0] + ': ' + r[1]; }).join('\n'); };
  return 'NORVANA Literature Order\n\nBILL TO\n' + pairs(snap.billTo) + '\n\nSHIP TO\n' + pairs(snap.shipTo) +
    '\n\nORDER ITEMS\nItem # | Description | Quantity\n' + snap.lines.map(function(l) { return l.itemId + ' | ' + l.name + ' | ' + l.qty; }).join('\n');
}

function fsHtml_(snap) {
  const F = 'Arial,Helvetica,sans-serif', cell = 'padding:7px 10px;font:14px/1.4 ' + F + ';color:#202020;vertical-align:top;';
  const bar = function(title, cols) { return '<tr><td colspan="' + cols + '" style="background:#e6e8eb;font:bold 15px/1.4 ' + F + ';color:#202020;padding:8px 10px">' + emailEsc_(title) + '</td></tr>'; };
  const band = function(i) { return i % 2 ? 'background:#f5f6f7;' : 'background:#ffffff;'; };
  const pairRows = function(rows) { return rows.map(function(r, i) { return '<tr><td width="34%" style="' + cell + band(i) + '">' + emailEsc_(r[0]) + '</td><td style="' + cell + band(i) + '">' + emailEsc_(r[1]) + '</td></tr>'; }).join(''); };
  const itemRows = snap.lines.map(function(l, i) {
    return '<tr><td width="18%" style="' + cell + band(i) + '">' + emailEsc_(l.itemId) + '</td><td style="' + cell + band(i) + '">' + emailEsc_(l.name) + '</td><td width="18%" align="right" style="' + cell + band(i) + 'text-align:right">' + l.qty + '</td></tr>';
  }).join('');
  const table = function(inner) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0">' + inner + '</table>'; };
  return '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body style="margin:0;padding:16px;background:#ffffff">' +
    '<div style="max-width:640px;margin:0 auto">' +
    '<div style="font:bold 18px/1.4 ' + F + ';color:#202020;margin:0 0 12px 0">NORVANA Literature Order</div>' +
    table(bar('Bill To', 2) + pairRows(snap.billTo)) + table(bar('Ship To', 2) + pairRows(snap.shipTo)) +
    table(bar('Order Items', 3) + '<tr><td style="' + cell + 'font-weight:bold">Item #</td><td style="' + cell + 'font-weight:bold">Description</td><td align="right" style="' + cell + 'font-weight:bold;text-align:right">Quantity</td></tr>' + itemRows) +
    '</div></body></html>';
}

// What the browser may see and print: never the internal Requested For notes or inventory types.
function fsPublicOrder_(snap, rec) {
  const sent = rec.attempt && rec.attempt.acceptedAt ? new Date(rec.attempt.acceptedAt) : new Date();
  return { orderId: rec.orderId, sentDate: Utilities.formatDate(sent, Session.getScriptTimeZone(), 'MMMM d, yyyy'),
    billTo: snap.billTo, shipTo: snap.shipTo, lines: snap.lines.map(function(l) { return { itemId: l.itemId, name: l.name, qty: l.qty }; }) };
}

function previewFreeStateOrder(lines, token) {
  return fsGuard_(token, function() {
    const snap = fsBuildSnapshot_(lines), fingerprint = fsFingerprint_(snap), previewId = Utilities.getUuid();
    const stored = snap.lines.map(function(l) { return { itemId: l.itemId, qty: l.qty, requestedFor: l.requestedFor }; });
    CacheService.getScriptCache().put('fs_preview_' + previewId, JSON.stringify({ token: token, lines: stored, fingerprint: fingerprint }), FS_PREVIEW_SECONDS_);
    return { success: true, previewId: previewId, fingerprint: fingerprint, from: FREE_STATE_FROM_, to: snap.recipient, subject: snap.subject,
      html: fsHtml_(snap), text: fsText_(snap), lines: snap.lines.map(function(l) { return { itemId: l.itemId, name: l.name, qty: l.qty }; }) };
  });
}

// -- Logs (the Order History tab and the technical Free State Order Log tab) --

function fsSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (typeof SpreadsheetApp.flush === 'function') SpreadsheetApp.flush(); // the Sheets API writes that follow must see this header
  }
  const data = sheet.getDataRange().getValues();
  if (!headers.every(function(h, i) { return data[0] && data[0][i] === h; })) throw new Error('The ' + name + ' tab headers do not match the Sheet layout in HANDOFF.md.');
  return { sheet: sheet, data: data };
}

function fsCell_(v) { return { userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: String(v == null ? '' : v) } }; }
function fsAppend_(sheet, rows) {
  commitCells_([{ appendCells: { sheetId: sheet.getSheetId(), rows: rows.map(function(r) { return { values: r.map(fsCell_) }; }), fields: 'userEnteredValue' } }]);
}

function fsLogRow_(row, data) {
  return { number: row, requestId: String(data[row - 1][0]), orderId: String(data[row - 1][1]), status: String(data[row - 1][2]),
    created: String(data[row - 1][3]), updated: String(data[row - 1][4]),
    attempt: data[row - 1][5] ? JSON.parse(data[row - 1][5]) : {}, snapshot: JSON.parse(data[row - 1][6]) };
}
function fsFindLog_(store, requestId) {
  if (!requestId) return null;
  for (let i = 1; i < store.data.length; i++) if (String(store.data[i][0]) === requestId) return fsLogRow_(i + 1, store.data);
  return null;
}
// A "Sending" record belongs to a send still in progress only while that request holds the script lock. A caller that holds
// the lock (locked = true) knows any "Sending" record is left over from a request that ended, so it is uncertain.
function fsStatus_(rec, locked) {
  if (rec.status === 'Sending' && (locked || Date.now() - Date.parse(rec.updated) > FS_STALE_SENDING_MS_)) return 'Uncertain';
  return rec.status;
}
// An order whose email may have gone out, or whose history is incomplete, blocks any new send until it is settled.
function fsPending_(store, locked) {
  for (let i = 1; i < store.data.length; i++) {
    const rec = fsLogRow_(i + 1, store.data), s = fsStatus_(rec, locked);
    if (s === 'Sending' || s === 'Uncertain' || s === 'Accepted') return rec;
  }
  return null;
}
function fsSetLog_(rec, status, attemptExtra) {
  const log = fsSheet_(FS_LOG_TAB_, FS_LOG_HEADERS_);
  rec.status = status; rec.updated = new Date().toISOString();
  rec.attempt = Object.assign({}, rec.attempt, attemptExtra || {});
  commitCells_([cellsRequest_(log.sheet, rec.number, 3, [rec.status, rec.created, rec.updated, JSON.stringify(rec.attempt)])]);
}
function fsNextOrderId_(store) {
  const year = new Date().getFullYear(), props = PropertiesService.getScriptProperties(), key = 'fs_sequence_' + year;
  let highest = Number(props.getProperty(key)) || 0;
  store.data.forEach(function(r, i) {
    const m = i > 0 && String(r[1]).match(/^FS-(\d{4})-(\d+)$/);
    if (m && Number(m[1]) === year) highest = Math.max(highest, Number(m[2]));
  });
  return { id: 'FS-' + year + '-' + String(highest + 1).padStart(3, '0'), key: key, number: highest + 1 };
}
function fsPairsText_(rows) { return rows.map(function(r) { return r[0] + ': ' + r[1]; }).join('\n'); }

// Writes one history row per product in a single request, and never twice for the same Order ID.
function fsWriteHistory_(rec) {
  const history = fsSheet_(FS_HISTORY_TAB_, FS_HISTORY_HEADERS_);
  if (history.data.some(function(r, i) { return i > 0 && String(r[0]) === rec.orderId; })) return;
  const tz = Session.getScriptTimeZone(), snap = rec.snapshot;
  const sent = Utilities.formatDate(rec.attempt.acceptedAt ? new Date(rec.attempt.acceptedAt) : new Date(), tz, 'yyyy-MM-dd HH:mm');
  const recorded = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  fsAppend_(history.sheet, snap.lines.map(function(l) {
    return [rec.orderId, sent, l.itemId, l.name, l.qty, l.inventoryType, l.requestedFor, 'Sent', snap.recipient, fsPairsText_(snap.billTo), fsPairsText_(snap.shipTo), recorded];
  }));
}

function fsAttention_(rec, locked) {
  const state = fsStatus_(rec, locked);
  const base = { success: false, requestId: rec.requestId, orderId: rec.orderId };
  if (state === 'Accepted') return Object.assign(base, { state: 'accepted', error: 'The email to Free State was already sent, but this order is not recorded in Order History yet. Do not send it again. Choose Record order.' });
  if (state === 'Uncertain') return Object.assign(base, { state: 'uncertain', error: 'It is not certain whether this order was emailed to Free State. Check the Sent folder of norvanalit12@gmail.com in Gmail before choosing what to do.' });
  if (state === 'Failed') return Object.assign(base, { state: 'failed', error: 'The email was not sent. You can try again.' });
  return Object.assign(base, { state: 'sending', error: 'This order is already being sent. Wait a moment, then reload the page.' });
}

function fsRecord_(rec) {
  try {
    fsWriteHistory_(rec);
    fsSetLog_(rec, 'Recorded');
  } catch (e) {
    return Object.assign(fsAttention_(rec, true), { state: 'accepted', error: 'The email to Free State was sent, but saving it to Order History failed. Do not send it again. Open Free State Order and choose Record order.' });
  }
  return { success: true, order: fsPublicOrder_(rec.snapshot, rec) };
}

// The only place MailApp is called. The record must already say "Sending".
function fsDeliver_(rec) {
  let called = false;
  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No daily email quota remains.');
    called = true;
    MailApp.sendEmail({ to: rec.snapshot.recipient, subject: rec.snapshot.subject, body: fsText_(rec.snapshot), htmlBody: fsHtml_(rec.snapshot) });
  } catch (e) {
    try { fsSetLog_(rec, called ? 'Uncertain' : 'Failed', { message: e.message }); } catch (writeError) { /* a stale "Sending" record is shown as uncertain */ }
    return called ? fsAttention_(Object.assign({}, rec, { status: 'Uncertain' }), true) :
      { success: false, state: 'failed', requestId: rec.requestId, orderId: rec.orderId, error: 'The email was not sent (' + e.message + '). Nothing went to Free State. You can try again.' };
  }
  try { fsSetLog_(rec, 'Accepted', { acceptedAt: new Date().toISOString() }); }
  catch (e) { rec.attempt.acceptedAt = new Date().toISOString(); }
  return fsRecord_(rec);
}

// -- Send, state and recovery --

function sendFreeStateOrder(previewId, token) {
  return withWorkflowLock_(token, function() {
    previewId = String(previewId || '');
    const store = fsSheet_(FS_LOG_TAB_, FS_LOG_HEADERS_), existing = fsFindLog_(store, previewId);
    if (existing) {
      if (existing.status === 'Recorded') return { success: true, alreadySent: true, order: fsPublicOrder_(existing.snapshot, existing) };
      return fsAttention_(existing, true);
    }
    const raw = CacheService.getScriptCache().get('fs_preview_' + previewId);
    const preview = raw ? JSON.parse(raw) : null;
    if (!preview || preview.token !== token) return { success: false, expired: true, error: 'The preview expired. Review the order again.' };
    const snap = fsBuildSnapshot_(preview.lines);
    if (fsFingerprint_(snap) !== preview.fingerprint) return { success: false, changed: true, error: 'The Free State information or the catalog changed since this preview. Review the order again.' };
    const blocker = fsPending_(store, true);
    if (blocker) return Object.assign(fsAttention_(blocker, true), { blocked: true, error: 'An earlier Free State order needs attention before another can be sent.' });
    if (MailApp.getRemainingDailyQuota() < 1) return { success: false, error: 'No email quota remains today. Try again tomorrow.' };
    const next = fsNextOrderId_(store), now = new Date().toISOString();
    const snapshot = JSON.stringify(snap);
    if (snapshot.length > 45000) throw new Error('This order is too large to send. Remove some products.');
    // The claim is written (and must succeed) before anything is emailed.
    try { fsAppend_(store.sheet, [[previewId, next.id, 'Sending', now, now, JSON.stringify({ attempts: 1 }), snapshot]]); }
    catch (e) { return { success: false, error: 'Could not record the send attempt, so nothing was emailed. Try again.' }; }
    PropertiesService.getScriptProperties().setProperty(next.key, String(next.number));
    // Built from what was just written, not read back: a read right after a Sheets API write can be stale.
    return fsDeliver_({ number: store.data.length + 1, requestId: previewId, orderId: next.id, status: 'Sending', created: now, updated: now, attempt: { attempts: 1 }, snapshot: snap });
  });
}

function getFreeStateOrderState(token) {
  return fsGuard_(token, function() {
    const store = fsSheet_(FS_LOG_TAB_, FS_LOG_HEADERS_), rec = fsPending_(store);
    if (!rec) return { success: true, pending: null };
    const info = fsAttention_(rec);
    return { success: true, pending: { requestId: rec.requestId, orderId: rec.orderId, state: info.state, message: info.error,
      lines: rec.snapshot.lines.map(function(l) { return { itemId: l.itemId, name: l.name, qty: l.qty }; }) } };
  });
}

// decision "record": the email is known (or confirmed by the chair) to have been sent, so only write history.
// decision "retry": only when the email is known not to have gone out, or the chair checked Sent and it is not there.
function resolveFreeStateOrder(requestId, decision, token) {
  return withWorkflowLock_(token, function() {
    const store = fsSheet_(FS_LOG_TAB_, FS_LOG_HEADERS_), rec = fsFindLog_(store, String(requestId || ''));
    if (!rec) throw new Error('That order was not found. Reload and try again.');
    const state = fsStatus_(rec, true);
    if (rec.status === 'Recorded') return { success: true, alreadySent: true, order: fsPublicOrder_(rec.snapshot, rec) };
    if (decision === 'record' && (state === 'Accepted' || state === 'Uncertain')) {
      if (state === 'Uncertain') fsSetLog_(rec, 'Accepted', { confirmedByChair: true, acceptedAt: rec.attempt.acceptedAt || rec.updated });
      return fsRecord_(rec);
    }
    if (decision === 'retry' && (state === 'Uncertain' || state === 'Failed')) {
      fsSetLog_(rec, 'Sending', { attempts: (Number(rec.attempt.attempts) || 1) + 1, retriedAfter: state });
      return fsDeliver_(rec);
    }
    throw new Error('That choice is not available for this order. Reload and review its status.');
  });
}
