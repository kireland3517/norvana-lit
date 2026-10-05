// ============================================================
// NORVANA Literature Orders System
// File: Code.gs  (single file - contains ALL server functions)
// Deploy as Web App > Execute as Me > Anyone can access
// ============================================================

const SHEET_ID = '1TFcx55RMampRYUpVhUP3Nzp5hGERJB2F3GnLFvt7A40';

// -- H&I Subcommittee rules --
// Matched by exact group name: renaming that group on the Groups tab means changing HI_GROUP_ too.
// H&I-only categories show only to this group; hidden categories never show to it.
// Its orders are paid from the subcommittee budget (area treasurer transfer), not collected at pickup.
const HI_GROUP_ = 'H&I Subcommittee';
const HI_ONLY_CATEGORIES_ = ['H&I'];
const HI_HIDDEN_CATEGORIES_ = ['Keytags', 'Medallions'];

function isSubcommitteeGroup_(groupName) {
  return String(groupName == null ? '' : groupName).trim() === HI_GROUP_;
}

// -- Routing --
// Single URL serves the unified app (Order Form + Dashboard).
// No ?dashboard=1 parameter needed anymore.

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('App');
  return template.evaluate()
    .setTitle('NORVANA Literature')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, user-scalable=no');
  // No ALLOWALL: other websites cannot frame this app (clickjacking). Direct links and QR codes are unaffected.
}

// -- Shared helpers --

function getSheet(tabName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tabName);
}

// -- Short-lived cache for the public order form (groups, catalog, chair email) --
// Only used by getFormData. Ordering-window checks and order validation always read the sheet.
const FORM_CACHE_KEYS_ = ['nv_form_groups', 'nv_form_catalog', 'nv_form_chair'];
const FORM_CACHE_SECONDS_ = 120;

function cachedFormPart_(key, loader) {
  const cache = CacheService.getScriptCache();
  try {
    const hit = cache.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch (e) { /* cache trouble: fall through to the sheet */ }
  const value = loader();
  try { cache.put(key, JSON.stringify(value), FORM_CACHE_SECONDS_); } catch (e) { /* too large or unavailable: skip caching */ }
  return value;
}

// Call after any change to Groups, Catalog (prices, items, active flag) or the Lit Chair email.
function clearFormCache_() {
  try { CacheService.getScriptCache().removeAll(FORM_CACHE_KEYS_); } catch (e) { /* worst case the cache expires on its own in 2 minutes */ }
}

// -- Order window --

function getCurrentWindow() {
  const data = getSheet('Schedule').getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  let upcoming = null, upcomingDate = '';
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !(row[1] instanceof Date) || !(row[2] instanceof Date)) continue;
    const open = Utilities.formatDate(row[1], tz, 'yyyy-MM-dd');
    const close = Utilities.formatDate(row[2], tz, 'yyyy-MM-dd');
    const window = { meetingMonth: meetingMonthFromOrdersCell_(row[0]),
      openDate: Utilities.formatDate(row[1], tz, 'MMMM d, yyyy'),
      closeDate: Utilities.formatDate(row[2], tz, 'MMMM d, yyyy'), isOpen: today >= open && today <= close };
    if (window.isOpen) return window;
    if (open > today && (!upcoming || open < upcomingDate)) { upcoming = window; upcomingDate = open; }
  }
  return upcoming || { meetingMonth: 'Current', openDate: '', closeDate: '', isOpen: false };
}

function getGroups() {
  const data = getSheet('Groups').getDataRange().getValues();
  return data.slice(1).map(r => r[0]).filter(g => g !== '');
}

// -- Catalog --

function getCatalogForForm() {
  const data    = getSheet('Catalog').getDataRange().getValues();
  const catalog = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || String(row[5]).trim().toUpperCase() !== 'YES') continue;
    catalog.push({
      itemId:   String(row[0]),
      category: String(row[1]),
      name:     String(row[2]),
      price:    Number(row[3]),
      packSize: Number(row[7]) || 1,
    });
  }
  return catalog;
}

function getCatalog_() {
  const data  = getSheet('Catalog').getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || String(row[5]).trim().toUpperCase() !== 'YES') continue;
    items.push({
      itemId:   String(row[0]),
      category: String(row[1]),
      name:     String(row[2]),
      price:    Number(row[3]),
      stock:    Number(row[4]) || 0,
      lowAt:    row[6] !== '' && row[6] !== undefined ? Number(row[6]) : 5,
      packSize: Number(row[7]) || 1,
    });
  }
  return items;
}

function getCatalogMap_() {
  const data = getSheet('Catalog').getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < data.length; i++) {
    map[String(data[i][0])] = { category: String(data[i][1]), name: String(data[i][2]), stock: Number(data[i][4]) || 0, lowAt: data[i][6] !== '' && data[i][6] !== undefined ? Number(data[i][6]) : 5, packSize: Number(data[i][7]) || 1 };
  }
  return map;
}

// -- Form data (single call for order form init) --

function getFormData() {
  try {
    return {
      windowData: getCurrentWindow(),
      groups:     cachedFormPart_('nv_form_groups', getGroups),
      catalog:    cachedFormPart_('nv_form_catalog', getCatalogForForm),
      litChairEmail: cachedFormPart_('nv_form_chair', getLitChairEmail),
      hiRules:    { group: HI_GROUP_, onlyCategories: HI_ONLY_CATEGORIES_, hiddenCategories: HI_HIDDEN_CATEGORIES_ },
    };
  } catch (e) {
    return {
      error:   true,
      message: e && e.message ? e.message : String(e),
    };
  }
}

// -- Dashboard: auto-save fulfillment quantities --

function autoSaveFulfillment(orderId, fulfilled, token, revision) {
  return withWorkflowLock_(token, function() {
    const state = orderState_(orderId);
    if (!state || state.status !== 'New') throw new Error('Only New orders can be edited.');
    requireRevision_(state, revision);
    const sheet = getSheet('Order Items'), data = sheet.getDataRange().getValues();
    const indices = orderItemRowIndicesForOrder_(data, String(orderId).trim());
    const requests = [], seen = new Set();
    fulfilled.forEach(f => {
      const i = indices.find(i => String(data[i][0]) === String(f.rowId));
      const q = Number(f.qtyFulfilled);
      if (i == null || seen.has(i) || !Number.isInteger(q) || q < 0 || q > Number(data[i][5])) throw new Error('Invalid fulfillment draft.');
      seen.add(i);
      requests.push(cellsRequest_(sheet, i + 1, 7, [q, Math.round(q * Number(data[i][4]) * 100) / 100]));
    });
    requests.push(cellsRequest_(state.sheet, state.number, 12, [state.revision + 1]));
    commitCells_(requests);
    return { success: true, revision: state.revision + 1 };
  });
}

// -- Submit order --

const SUBMIT_MAX_TEXT_ = 100;
const SUBMIT_MAX_PHONE_ = 30;
const SUBMIT_MAX_EMAIL_ = 254;
const SUBMIT_MAX_LINES_ = 100;
const SUBMIT_MAX_QTY_ = 999;
const SUBMIT_PER_EMAIL_HOURLY_ = 5;
const SUBMIT_PER_GROUP_HOURLY_ = 10;

/** Single-line text with control characters removed and length capped. */
function cleanText_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Retry protection: the order form sends one random request ID per order. A repeat of the SAME order
// (lost response, double tap) gets the original result back instead of creating a second order.
function recallSubmission_(requestId, fingerprint) {
  try {
    const hit = CacheService.getScriptCache().get('order_req_' + requestId);
    if (hit === null || hit === undefined) return null;
    const saved = JSON.parse(hit);
    return saved && saved.fingerprint === fingerprint ? saved.result : null;
  } catch (e) { return null; }
}

function rememberSubmission_(requestId, fingerprint, result) {
  try { CacheService.getScriptCache().put('order_req_' + requestId, JSON.stringify({ fingerprint: fingerprint, result: result }), 21600); } catch (e) { /* cache unavailable: retry protection is best-effort */ }
}

// Modest flood limits per email address and per group (counted per hour). Best-effort: a cache outage never blocks real orders.
function submissionCountKey_(kind, value) { return 'sub_' + kind + '_' + String(value).toLowerCase().slice(0, 200); }

function submissionThrottled_(email, groupName) {
  try {
    const cache = CacheService.getScriptCache();
    return Number(cache.get(submissionCountKey_('e', email)) || 0) >= SUBMIT_PER_EMAIL_HOURLY_ ||
           Number(cache.get(submissionCountKey_('g', groupName)) || 0) >= SUBMIT_PER_GROUP_HOURLY_;
  } catch (e) { return false; }
}

function noteSubmission_(email, groupName) {
  try {
    const cache = CacheService.getScriptCache();
    [['e', email], ['g', groupName]].forEach(function(p) {
      const key = submissionCountKey_(p[0], p[1]);
      cache.put(key, String((Number(cache.get(key)) || 0) + 1), 3600);
    });
  } catch (e) { /* best-effort */ }
}

/**
 * Saves one order and its item lines. Text typed by the visitor is written as literal strings through the
 * Sheets API so a value such as =IMPORTRANGE(...) can never become a live formula. If any step fails the
 * rows added so far are removed, so a failed submit never leaves a half-saved order behind.
 */
function saveNewOrder_(orderId, now, meetingMonth, group, contact, email, phone, estimatedTotal, items) {
  const ordersSheet = getSheet('Orders'), itemsSheet = getSheet('Order Items');
  let orderRow = 0, itemRows = 0;
  try {
    ordersSheet.appendRow([orderId, now, meetingMonth, '', '', '', '', estimatedTotal, '', 'New', '', 0]);
    orderRow = ordersSheet.getLastRow();
    items.forEach(function(item, idx) {
      itemsSheet.appendRow([orderId + '-' + String(idx + 1).padStart(2, '0'), orderId, item.itemId, item.name, item.price, item.qty, '', '']);
      itemRows++;
    });
    commitCells_([cellsRequest_(ordersSheet, orderRow, 4, [group, contact, email, phone])]);
  } catch (e) {
    try {
      if (itemRows) itemsSheet.deleteRows(itemsSheet.getLastRow() - itemRows + 1, itemRows);
      if (orderRow) ordersSheet.deleteRow(orderRow);
    } catch (cleanupError) { Logger.log('Order ' + orderId + ' cleanup failed: ' + cleanupError); }
    throw e;
  }
}

function submitOrder(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};

  // -- Clean and validate everything the visitor typed --
  const contactName = cleanText_(payload.contactName, SUBMIT_MAX_TEXT_);
  const email = String(payload.email == null ? '' : payload.email).trim();
  const phone = cleanText_(payload.phone, SUBMIT_MAX_PHONE_);
  const requestedGroup = cleanText_(payload.groupName, SUBMIT_MAX_TEXT_);
  const requestId = /^[A-Za-z0-9-]{8,64}$/.test(String(payload.requestId || '')) ? String(payload.requestId) : '';
  if (!requestedGroup || !contactName || !email) {
    return { success: false, error: 'Please fill in all required fields.' };
  }
  if (email.length > SUBMIT_MAX_EMAIL_ || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { success: false, error: 'Please select at least one item.' };
  }
  if (payload.items.length > SUBMIT_MAX_LINES_) {
    return { success: false, error: 'This order has too many lines. Please contact the Lit Chair.' };
  }
  const fingerprint = JSON.stringify([requestedGroup, email.toLowerCase(),
    payload.items.map(function(i) { return [i && i.itemId, Number(i && i.qty)]; })]);
  const replay = requestId ? recallSubmission_(requestId, fingerprint) : null;
  if (replay) return replay;

  const win = getCurrentWindow();
  if (!win.isOpen) return { success: false, error: 'The order window is currently closed.' };
  const meetingMonth = win.meetingMonth;

  // -- The group must be one of the groups on the Groups tab (the saved spelling is what gets stored) --
  const groupName = getGroups().map(function(g) { return cleanText_(g, SUBMIT_MAX_TEXT_); })
    .find(function(g) { return g === requestedGroup; });
  if (!groupName) return { success: false, error: 'Please choose your group from the list.' };

  // -- Lock to prevent concurrent duplicate IDs --
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, error: 'System busy - please try again in a moment.' };
  }

  let orderId, items, estimatedTotal;
  try {
    const again = requestId ? recallSubmission_(requestId, fingerprint) : null;
    if (again) return again;
    if (submissionThrottled_(email, groupName)) {
      return { success: false, error: 'Several orders were just submitted from this email or group. Please contact the Lit Chair if you need another.' };
    }
    const now = new Date();

    // -- Use server-side prices from Catalog (ignore anything the browser sent besides item and quantity) --
    const catalog = new Map();
    getSheet('Catalog').getDataRange().getValues().slice(1).forEach(function(row) {
      if (row[0] && String(row[5]).trim().toUpperCase() === 'YES') {
        catalog.set(String(row[0]), { name: String(row[2]), price: Number(row[3]) || 0, category: String(row[1]).trim() });
      }
    });

    // One line per catalog item: repeated lines are added together, then capped per item.
    // Category rules are enforced here too, not only by what the form shows.
    const subcommittee = isSubcommitteeGroup_(groupName);
    const quantities = new Map();
    let notAllowed = false;
    payload.items.forEach(function(item) {
      const id = item && typeof item.itemId === 'string' ? item.itemId : '';
      const qty = Math.floor(Number(item && item.qty));
      if (!catalog.has(id) || !Number.isFinite(qty) || qty < 1) return;
      const category = catalog.get(id).category;
      if (subcommittee ? HI_HIDDEN_CATEGORIES_.indexOf(category) >= 0 : HI_ONLY_CATEGORIES_.indexOf(category) >= 0) { notAllowed = true; return; }
      quantities.set(id, Math.min((quantities.get(id) || 0) + qty, SUBMIT_MAX_QTY_));
    });
    if (notAllowed) {
      return { success: false, error: 'Some items in this order are not available to the selected group. Please reload the form and try again.' };
    }
    items = Array.from(quantities.keys()).map(function(id) {
      return { itemId: id, name: catalog.get(id).name, price: catalog.get(id).price, qty: quantities.get(id) };
    });
    if (items.length === 0) {
      return { success: false, error: 'No valid items in order.' };
    }

    // -- Generate unique order ID (inside lock) --
    const meetingDate = meetingMonth ? new Date(meetingMonth + ' 1') : now;
    const yy          = String(meetingDate.getFullYear()).slice(2);
    const mm          = String(meetingDate.getMonth() + 1).padStart(2, '0');
    const prefix      = 'NL-' + yy + mm + '-';
    const existing    = getSheet('Orders').getDataRange().getValues();
    let maxSeq = 0;
    for (let i = 1; i < existing.length; i++) {
      const id = String(existing[i][0]);
      if (id.startsWith(prefix)) {
        const seq = parseInt(id.slice(prefix.length)) || 0;
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    const props = PropertiesService.getScriptProperties();
    maxSeq = Math.max(maxSeq, Number(props.getProperty('sequence_' + prefix)) || 0);
    props.setProperty('sequence_' + prefix, String(maxSeq + 1));
    orderId = prefix + String(maxSeq + 1).padStart(3, '0');

    estimatedTotal = 0;
    items.forEach(item => { estimatedTotal += item.price * item.qty; });
    estimatedTotal = Math.round(estimatedTotal * 100) / 100;

    saveNewOrder_(orderId, now, meetingMonth, groupName, contactName, email, phone, estimatedTotal, items);
    noteSubmission_(email, groupName);
    if (requestId) rememberSubmission_(requestId, fingerprint, { success: true, orderId: orderId });
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }

  // -- Send emails after the lock is released (order already saved; surface warning if mail fails) --
  const emailPayload = { groupName: groupName, contactName: contactName, email: email, phone: phone, meetingMonth: meetingMonth, items: items };
  try {
    sendConfirmationToGroup_(emailPayload, orderId, estimatedTotal);
    sendAlertToLitChair_(emailPayload, orderId, estimatedTotal);
  } catch(mailErr) {
    return {
      success: true,
      orderId: orderId,
      warning: 'Order saved (ID: ' + orderId + ') but confirmation email could not be sent. Please note your order ID and contact the Lit Chair.',
    };
  }

  return { success: true, orderId: orderId };
}

// -- Emails --

function sendConfirmationToGroup_(payload, orderId, estimatedTotal) {
  const lines = payload.items.map(i =>
    '  ' + i.name + ' (x' + i.qty + ') - $' + (i.price * i.qty).toFixed(2)).join('\n');
  const subcommittee = isSubcommitteeGroup_(payload.groupName);
  sendStyledMail_({
    to: payload.email,
    subject: 'Literature Order Confirmation - ' + payload.groupName,
    eyebrow: payload.meetingMonth + EMAIL_DOT_ + 'Order confirmation',
    headline: ['You asked.', "We're on it."],
    lead: "Your literature order is in. We'll get everything together and let you know when it's ready for pickup.",
    pill: 'Order submitted',
    heading: payload.groupName, subheading: 'Order ' + orderId, statusLabel: 'Order received',
    itemsLabel: 'Requested items',
    items: payload.items.map(i => ({ name: i.name, qty: i.qty, amount: i.price * i.qty })),
    band: subcommittee
      ? { label: 'Estimated total', sub: 'Charged to the H&I budget', amount: estimatedTotal }
      : { label: 'Estimated total', sub: 'Final amount confirmed when ready', amount: estimatedTotal },
    callout: subcommittee
      ? { label: 'Paid by', text: 'This order is charged to the H&I subcommittee budget, so no payment is needed at pickup.' }
      : null,
    notes: ['Totals are estimates and depend on available inventory. The final amount will be confirmed when the order is ready for pickup.'],
    footer: ['Questions? Contact the Lit Chair at ' + getLitChairEmail() + '.', 'NORVANA Literature Committee'],
    body:
      'Thank you for submitting your literature order for the ' + payload.meetingMonth + ' area meeting.\n\n' +
      'GROUP: ' + payload.groupName + '\n' +
      'CONTACT: ' + payload.contactName + '\n\n' +
      'ITEMS ORDERED:\n' + lines + '\n\n' +
      'ESTIMATED TOTAL: $' + estimatedTotal.toFixed(2) + '\n\n' +
      'All totals are estimates. Final amounts are based on actual inventory at time of fulfillment. ' +
      (isSubcommitteeGroup_(payload.groupName)
        ? 'This order is charged to the H&I subcommittee budget, so no payment is needed at pickup. You will receive a second email when your order is ready for pickup.\n\n'
        : 'You will receive a second email when your order is ready for pickup with the final amount due.\n\n') +
      'Questions? Contact the Lit Chair at ' + getLitChairEmail() + '.\n\n' +
      'NORVANA Literature Committee',
  });
}

function sendAlertToLitChair_(payload, orderId, estimatedTotal) {
  const lines = payload.items.map(i =>
    '  ' + i.itemId + '  ' + i.name + ' (x' + i.qty + ') - $' + (i.price * i.qty).toFixed(2)).join('\n');
  sendStyledMail_({
    to: getLitChairEmail(),
    subject: 'New Order - ' + payload.groupName,
    eyebrow: payload.meetingMonth + EMAIL_DOT_ + 'Chair notification',
    headline: ['Someone needs', 'literature.'],
    lead: 'A new literature order just came in. Another group is getting ready to carry the message.',
    pill: 'New order received',
    heading: payload.groupName, subheading: 'Order ' + orderId, statusLabel: 'Needs fulfillment',
    contact: { label: 'Group contact', name: payload.contactName, detail: payload.email + (payload.phone ? EMAIL_DOT_ + payload.phone : '') },
    itemsLabel: 'Requested items',
    items: payload.items.map(i => ({ id: i.itemId, name: i.name, qty: i.qty, amount: i.price * i.qty })),
    band: { label: 'Estimated total', sub: 'Final amount confirmed when ready', amount: estimatedTotal },
    callout: isSubcommitteeGroup_(payload.groupName)
      ? { label: 'Paid by', text: 'H&I subcommittee budget (no payment at pickup).' }
      : null,
    notes: ['Totals are estimates and depend on available inventory. The final amount will be confirmed when the order is ready for pickup.'],
    footer: ['Sent to the Literature Chair.', 'NORVANA Literature Committee'],
    body:
      'New literature order submitted.\n\n' +
      'ORDER ID: ' + orderId + '\nMEETING MONTH: ' + payload.meetingMonth + '\n' +
      'GROUP: ' + payload.groupName + '\nCONTACT: ' + payload.contactName + '\n' +
      'EMAIL: ' + payload.email + '\nPHONE: ' + payload.phone + '\n' +
      (isSubcommitteeGroup_(payload.groupName) ? 'PAID BY: H&I subcommittee budget (no payment at pickup)\n' : '') + '\n' +
      'ITEMS:\n' + lines + '\n\n' +
      'ESTIMATED TOTAL: $' + estimatedTotal.toFixed(2) + '\n\nNORVANA Literature Orders System',
  });
}

// -- Shared: get lit chair email from Config --
function getLitChairEmail() {
  const data = getSheet('Config').getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === 'lit chair email') return String(data[i][1]);
  }
  return 'norvanalit12@gmail.com'; // fallback only
}

// -- Dashboard: auth --

// -- Session token helpers --
// Sessions live in CacheService, whose hard maximum is 6 hours (a longer request is silently cut short),
// so the lifetime is set to that maximum explicitly. Every session is stamped with a "session version";
// bumping the version (done when the access code changes) signs every existing session out at once.
const TOKEN_TTL_SECONDS = 21600; // 6 hours (CacheService maximum)
const LOGIN_MAX_FAILURES_ = 10;
const LOGIN_LOCK_SECONDS_ = 900; // 15 minutes
const MIN_ACCESS_CODE_LENGTH_ = 6;
const DEFAULT_ACCESS_CODE_ = 'changeme';

function currentSessionVersion_() {
  return String(PropertiesService.getScriptProperties().getProperty('session_version') || '1');
}

function bumpSessionVersion_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('session_version', String((Number(props.getProperty('session_version')) || 1) + 1));
}

function issueSessionToken_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('session_' + token, currentSessionVersion_(), TOKEN_TTL_SECONDS);
  return token;
}

function validateToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get('session_' + token) === currentSessionVersion_();
}

function revokeToken_(token) {
  if (!token) return;
  CacheService.getScriptCache().remove('session_' + token);
}

/** The configured dashboard code, or '' when it is missing or still the shipped default. */
function configuredAccessCode_() {
  const data = getSheet('Config').getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === 'dashboard access code') {
      const code = String(data[i][1]).trim();
      return code === '' || code.toLowerCase() === DEFAULT_ACCESS_CODE_ ? '' : code;
    }
  }
  return '';
}

/** Compares without stopping at the first difference. */
function sameSecret_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// Wrong guesses are counted for the whole app (visitors are anonymous). After too many, every login attempt,
// right or wrong, is refused for a while. That caps guessing speed; the worst an attacker can do to the
// real user is a short wait.
function loginLockedMinutes_() {
  try {
    const until = Number(CacheService.getScriptCache().get('login_lock'));
    if (until > Date.now()) return Math.max(1, Math.ceil((until - Date.now()) / 60000));
  } catch (e) { /* cache unavailable: treat as not locked */ }
  return 0;
}

function noteLoginFailure_() {
  try {
    const cache = CacheService.getScriptCache();
    const failures = (Number(cache.get('login_fails')) || 0) + 1;
    if (failures >= LOGIN_MAX_FAILURES_) {
      cache.put('login_lock', String(Date.now() + LOGIN_LOCK_SECONDS_ * 1000), LOGIN_LOCK_SECONDS_);
      cache.remove('login_fails');
    } else {
      cache.put('login_fails', String(failures), LOGIN_LOCK_SECONDS_);
    }
  } catch (e) { /* best-effort */ }
}

function checkAccessCode(code) {
  const wait = loginLockedMinutes_();
  if (wait) return { valid: false, message: 'Too many incorrect attempts. Please try again in about ' + wait + ' minute' + (wait === 1 ? '' : 's') + '.' };
  const stored = configuredAccessCode_();
  if (!stored) return { valid: false, message: 'Dashboard access is not set up yet. Set a Dashboard Access Code in the Config tab of the spreadsheet.' };
  if (typeof code !== 'string' || !sameSecret_(code.trim(), stored)) {
    noteLoginFailure_();
    return { valid: false };
  }
  try { CacheService.getScriptCache().remove('login_fails'); } catch (e) { /* best-effort */ }
  const token = issueSessionToken_();
  const w = getCurrentWindow();
  return { valid: true, token: token, meetingMonth: w ? w.meetingMonth : 'Current', weakCode: stored.length < MIN_ACCESS_CODE_LENGTH_ };
}

// Lets a refreshed page pick its dashboard session back up without the browser ever holding the access code.
function resumeSession(token) {
  if (!validateToken_(token)) return { valid: false };
  const w = getCurrentWindow();
  return { valid: true, token: token, meetingMonth: w ? w.meetingMonth : 'Current' };
}

function signOut(token) {
  revokeToken_(token);
  return { success: true };
}

// -- Order Items: column A must be "{orderId}-NN" (submitOrder format). Rows with column B = order
// but a different A (duplicates / paste errors) are dropped once that order has >=1 valid line.
function lineIdMatchesOrder_(orderIdTrim, cellA) {
  const rid = String(cellA).trim();
  if (!rid) return false;
  const p = orderIdTrim + '-';
  if (!rid.startsWith(p)) return false;
  const suf = rid.slice(p.length);
  return /^\d{1,4}$/.test(suf);
}

/** @returns {number[]} 0-based row indices into itemsData (row 0 = header) */
function orderItemRowIndicesForOrder_(itemsData, orderIdTrim) {
  const raw = [];
  for (let i = 1; i < itemsData.length; i++) {
    const row = itemsData[i];
    if (String(row[1]).trim() !== orderIdTrim) continue;
    if (row[0] === '' && row[2] === '' && row[3] === '') continue;
    raw.push(i);
  }
  if (raw.length === 0) return [];
  const anyStrict = raw.some(function(idx) {
    return lineIdMatchesOrder_(orderIdTrim, itemsData[idx][0]);
  });
  if (!anyStrict) return raw;
  return raw.filter(function(idx) {
    return lineIdMatchesOrder_(orderIdTrim, itemsData[idx][0]);
  });
}

function buildItemQtyOrderedByOrder_(itemsData) {
  const bids = {};
  for (let i = 1; i < itemsData.length; i++) {
    const bid = String(itemsData[i][1]).trim();
    if (bid) bids[bid] = true;
  }
  const itemCounts = {};
  Object.keys(bids).forEach(function(bid) {
    const idxs = orderItemRowIndicesForOrder_(itemsData, bid);
    let sum = 0;
    idxs.forEach(function(i) {
      sum += Number(itemsData[i][5]);
    });
    itemCounts[bid] = sum;
  });
  return itemCounts;
}

function buildFulfilledQtyByOrder_(itemsData) {
  const bids = {};
  for (let i = 1; i < itemsData.length; i++) {
    const bid = String(itemsData[i][1]).trim();
    if (bid) bids[bid] = true;
  }
  const fulfilledCounts = {};
  Object.keys(bids).forEach(function(bid) {
    const idxs = orderItemRowIndicesForOrder_(itemsData, bid);
    let sum = 0;
    idxs.forEach(function(i) {
      const q = itemsData[i][6] !== '' && itemsData[i][6] != null ? Number(itemsData[i][6]) : 0;
      sum += q;
    });
    fulfilledCounts[bid] = sum;
  });
  return fulfilledCounts;
}

// -- Dashboard: orders --

/** Column C in Orders is often a Sheet Date; normalize to same "MMMM yyyy" as getCurrentWindow(). */
function meetingMonthFromOrdersCell_(cell) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'MMMM yyyy');
  }
  return String(cell || '').trim().replace(/\s+/g, ' ');
}

function getOrders(meetingMonth, token) {
  if (!validateToken_(token)) return { error: 'Unauthorized' };
  const ordersData = getSheet('Orders').getDataRange().getValues();
  const itemsData  = getSheet('Order Items').getDataRange().getValues();
  const itemCounts = buildItemQtyOrderedByOrder_(itemsData);
  const orders = [];
  // Show ALL orders regardless of meetingMonth - filtering is for Reports only
  for (let i = 1; i < ordersData.length; i++) {
    const row = ordersData[i];
    if (!row[0]) continue;
    // Normalise legacy status values
    let status = String(row[9]) || 'New';
    if (status === 'Submitted' || status === 'Fulfilling') status = 'New';
    orders.push({
      orderId:        String(row[0]),
      timestamp:      row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'MMM d') : '',
      meetingMonth:   meetingMonthFromOrdersCell_(row[2]),
      groupName:      String(row[3]),
      contact:        String(row[4]),
      email:          String(row[5]),
      phone:          String(row[6]),
      estimatedTotal: Number(row[7]) || 0,
      fulfilledTotal: Number(row[8]) || 0,
      status:         status,
      revision:       Number(row[11]) || 0,
      itemCount:      itemCounts[String(row[0]).trim()] || 0,
    });
  }
  // Sort newest first
  orders.sort(function(a, b) { return b.orderId.localeCompare(a.orderId); });
  return orders;
}

// -- Dashboard: order items --

function getOrderItems(orderId, token) {
  return withWorkflowLock_(token, () => getOrderItems_(orderId, token));
}

function getOrderItems_(orderId, token) {
  if (!validateToken_(token)) return { error: 'Unauthorized', items: [] };
  const oid  = String(orderId).trim();
  const data = getSheet('Order Items').getDataRange().getValues();
  const catMap = getCatalogMap_();
  const items  = [];
  const idxs   = orderItemRowIndicesForOrder_(data, oid);
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k];
    const row = data[i];
    const itemId = String(row[2]);
    items.push({
      sheetRow:     i + 1,
      rowId:        String(row[0]).trim(),
      orderId:      oid,
      itemId:       itemId,
      name:         String(row[3]),
      price:        Number(row[4]),
      qtyOrdered:   Number(row[5]),
      qtyFulfilled: row[6] !== '' && row[6] != null ? Number(row[6]) : '',
      lineTotal:    row[7] !== '' && row[7] != null ? Number(row[7]) : '',
      stock:        catMap[itemId] ? catMap[itemId].stock : null,
      packSize:     catMap[itemId] ? catMap[itemId].packSize : 1,
      category:     catMap[itemId] ? catMap[itemId].category : 'Other',
    });
  }
  const state = orderState_(oid);
  if (!state) return { error: 'Order not found.', items: [] };
  return { items: items, revision: state.revision, status: state.status };
}

// -- Dashboard: fulfill order --

function fulfillOrder(orderId, fulfilled, fulfilledTotal, token, revision) {
  return transitionOrder_(orderId, 'ready', revision, fulfilled, token);
}

function deleteOrder(orderId, token, revision) {
  return transitionOrder_(orderId, 'delete', revision, null, token);
}

// Inventory adjustments are private and atomic in OrderWorkflow.gs.


// sendFulfillmentEmail removed: it was public and unused (Ready emails go through sendReadyNotice_ in OrderWorkflow.gs).

// -- Dashboard: report --

/** Trim + collapse spaces so sheet vs Schedule labels still match. */
function normalizeMeetingMonthLabel_(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

/**
 * Parse "March 2026" / "Mar 2026" style labels to a comparable bucket (year*12+month).
 * @returns {number|null}
 */
function meetingLabelToYm_(s) {
  const n = normalizeMeetingMonthLabel_(s);
  const m = n.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (!m) return null;
  const d = new Date(m[1] + ' 1, ' + m[2]);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() * 12 + d.getMonth();
}

/** Dashboard window is not tied to a specific month (no active Schedule row, etc.). */
function reportMonthIsOpenOrUnknown_(reportMonth) {
  const r = normalizeMeetingMonthLabel_(reportMonth);
  return !r || r.toLowerCase() === 'current';
}

/** Whether an order's stored meeting month belongs on this report. */
function orderMatchesReportMonth_(orderMonth, reportMonth) {
  const o = normalizeMeetingMonthLabel_(orderMonth);
  const r = normalizeMeetingMonthLabel_(reportMonth);
  if (!o) return false;
  if (o === r) return true;
  if (o.toLowerCase() === r.toLowerCase()) return true;
  const yo = meetingLabelToYm_(o);
  const yr = meetingLabelToYm_(r);
  return yo != null && yr != null && yo === yr;
}

function getMonthlyReport(meetingMonth, token) {
  if (!validateToken_(token)) return { error: 'Unauthorized', rows: [] };
  const allOrders = getOrders(meetingMonth, token);
  if (!Array.isArray(allOrders)) {
    return { meetingMonth: meetingMonth, rows: [] };
  }
  // Strict === failed when (a) dashboard month is "Current" but orders store "March 2026",
  // (b) extra spaces / case drift, or (c) "Mar" vs "March" for the same calendar month.
  const showAll = reportMonthIsOpenOrUnknown_(meetingMonth);
  let orders = showAll
    ? allOrders.slice()
    : allOrders.filter(o => orderMatchesReportMonth_(o.meetingMonth, meetingMonth));
  // A selected month with no orders must stay empty.

  const itemsData = getSheet('Order Items').getDataRange().getValues();
  const fulfilledCounts = buildFulfilledQtyByOrder_(itemsData);

  return {
    meetingMonth: meetingMonth,
    rows: orders.map(o => ({
      groupName:      o.groupName,
      orderId:        o.orderId,
      itemsOrdered:   o.itemCount,
      itemsFulfilled: (o.status === 'Ready' || o.status === 'Completed') ? (fulfilledCounts[String(o.orderId).trim()] || 0) : '',
      estimatedTotal: o.estimatedTotal,
      fulfilledTotal: o.fulfilledTotal,
      status:         o.status,
    })),
  };
}

// exportReportCSV removed: it was public, rewrote a shared sheet, and the dashboard builds CSV files in the browser instead.

// -- Dashboard: inventory --

function updateStockCounts(updates, token) {
  return withWorkflowLock_(token, function() {
    const sheet = getSheet('Catalog'), data = sheet.getDataRange().getValues();
    const seen = new Set();
    const requests = updates.map(u => {
      const i = data.findIndex((r, n) => n > 0 && String(r[0]) === String(u.itemId));
      if (i < 0 || seen.has(u.itemId) || u.stock === '' || !Number.isInteger(Number(u.stock))) throw new Error('Enter a whole-number Current Stock Count for each item.');
      seen.add(u.itemId);
      return cellsRequest_(sheet, i + 1, 5, [Number(u.stock)]);
    });
    commitCells_(requests);
    return { success: true };
  });
}

function getSettings(token) {
  if (!validateToken_(token)) return { error: 'Unauthorized' };
  const tz         = Session.getScriptTimeZone();
  const configData = getSheet('Config').getDataRange().getValues();
  const schedData  = getSheet('Schedule').getDataRange().getValues();

  let email      = 'norvanalit12@gmail.com';
  let secretaryEmail = '';

  for (let i = 0; i < configData.length; i++) {
    const key = String(configData[i][0]).toLowerCase();
    if (key === 'lit chair email')        email      = String(configData[i][1]);
    if (key === 'secretary email') secretaryEmail = String(configData[i][1]);
  }

  const schedule = [];
  for (let i = 1; i < schedData.length; i++) {
    const row = schedData[i];
    if (!row[0]) continue;
    let openVal  = row[1];
    let closeVal = row[2];
    // Accept both Date objects and date strings
    if (openVal  && !(openVal  instanceof Date)) openVal  = new Date(openVal);
    if (closeVal && !(closeVal instanceof Date)) closeVal = new Date(closeVal);
    const openStr  = (openVal  instanceof Date && !isNaN(openVal))  ? Utilities.formatDate(openVal,  tz, 'yyyy-MM-dd') : '';
    const closeStr = (closeVal instanceof Date && !isNaN(closeVal)) ? Utilities.formatDate(closeVal, tz, 'yyyy-MM-dd') : '';
    schedule.push({
      month: String(row[0]).trim(),
      open:  openStr,
      close: closeStr,
    });
  }
  return { codeIsSet: configuredAccessCode_() !== '', email: email, secretaryEmail: secretaryEmail, schedule: schedule };
}

function saveGlobalSettings(code, email, token, secretaryEmail) {
  return withWorkflowLock_(token, function() {
    code = String(code == null ? '' : code).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (secretaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secretaryEmail))) throw new Error('Enter valid settings and email addresses.');
    if (code && (code.length < MIN_ACCESS_CODE_LENGTH_ || code.toLowerCase() === DEFAULT_ACCESS_CODE_)) throw new Error('Choose an access code of at least ' + MIN_ACCESS_CODE_LENGTH_ + ' characters.');
    const sheet = getSheet('Config'), data = sheet.getDataRange().getValues();
    const values = { 'lit chair email': email, 'secretary email': secretaryEmail || '' };
    if (code) values['dashboard access code'] = code;
    const requests = []; let next = data.length + 1;
    Object.keys(values).forEach(key => {
      const i = data.findIndex(r => String(r[0]).trim().toLowerCase() === key);
      const label = key === 'secretary email' ? 'Secretary Email' : key === 'dashboard access code' ? 'Dashboard Access Code' : key;
      requests.push(i < 0 ? cellsRequest_(sheet, next++, 1, [label, values[key]]) : cellsRequest_(sheet, i + 1, 2, [values[key]]));
    });
    commitCells_(requests);
    clearFormCache_();
    const result = { success: true };
    if (code) {
      // A new code ends every existing dashboard session, including one an intruder may hold.
      // The person who just saved stays signed in through a fresh session.
      bumpSessionVersion_();
      result.newToken = issueSessionToken_();
    }
    return result;
  });
}

function saveSchedule(schedule, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const sched = getSheet('Schedule');
  const data  = sched.getDataRange().getValues();
  const tz    = Session.getScriptTimeZone();
  const map   = {};
  schedule.forEach(r => { map[r.month] = r; });
  for (let i = 1; i < data.length; i++) {
    const month = String(data[i][0]).trim();
    if (map[month]) {
      // Parse yyyy-MM-dd as local date in script timezone to avoid UTC offset shifting
      const openParts  = map[month].open.split('-').map(Number);
      const closeParts = map[month].close.split('-').map(Number);
      if (openParts.length === 3 && closeParts.length === 3) {
        const openDate  = Utilities.parseDate(map[month].open, tz, 'yyyy-MM-dd');
        const closeDate = Utilities.parseDate(map[month].close, tz, 'yyyy-MM-dd');
        sched.getRange(i + 1, 2).setValue(openDate);
        sched.getRange(i + 1, 3).setValue(closeDate);
      }
    }
  }
}

// -- Dashboard: catalog management --

function getCatalogAll(token) {
  if (!validateToken_(token)) return [];
  const data  = getSheet('Catalog').getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    items.push({
      itemId:   String(row[0]),
      category: String(row[1]),
      name:     String(row[2]),
      price:    Number(row[3]),
      stock:    Number(row[4]) || 0,
      active:   String(row[5]).trim().toUpperCase() === 'YES',
      lowAt:    row[6] !== '' && row[6] !== undefined ? Number(row[6]) : 5,
      packSize: Number(row[7]) || 1,
      rowIndex: i + 1,
    });
  }
  return items;
}

function updateCatalogPrices(updates, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  // updates: [{itemId, price}]
  const catalog = getSheet('Catalog');
  const data    = catalog.getDataRange().getValues();
  const map     = {};
  updates.forEach(u => { map[u.itemId] = u; });
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    if (map[id] !== undefined) {
      catalog.getRange(i + 1, 4).setValue(Number(map[id].price));
    }
  }
  SpreadsheetApp.flush();
  clearFormCache_();
}

function addCatalogItem(item, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  // item: {category, name, price}
  const catalog = getSheet('Catalog');
  const data    = catalog.getDataRange().getValues();
  // Generate next item ID: find max numeric suffix per category prefix
  const prefix  = (item.category || 'GEN').substring(0, 3).toUpperCase();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]);
    if (id.startsWith(prefix)) {
      const n = parseInt(id.replace(prefix, '')) || 0;
      if (n > maxNum) maxNum = n;
    }
  }
  const newId = prefix + String(maxNum + 1).padStart(3, '0');
  catalog.appendRow([newId, item.category, item.name, Number(item.price), 0, 'YES', 5]);
  SpreadsheetApp.flush();
  clearFormCache_();
  return newId;
}

function toggleCatalogItem(itemId, active, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const catalog = getSheet('Catalog');
  const data    = catalog.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === itemId) {
      catalog.getRange(i + 1, 6).setValue(active ? 'YES' : 'NO');
      break;
    }
  }
  SpreadsheetApp.flush();
  clearFormCache_();
}

// -- Dashboard: groups management --

function getGroupsFull(token) {
  if (!validateToken_(token)) return [];
  const data = getSheet('Groups').getDataRange().getValues();
  return data.slice(1).map(r => String(r[0])).filter(g => g !== '');
}

function saveGroups(groups, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const sheet = getSheet('Groups');
  const header = sheet.getRange(1, 1, 1, 1).getValues();
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 1).setValues(header);
  if (groups.length > 0) {
    sheet.getRange(2, 1, groups.length, 1).setValues(groups.map(g => [g]));
  }
  SpreadsheetApp.flush();
  clearFormCache_();
}

// -- Dashboard: schedule - add month --

function addScheduleMonth(monthLabel, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  // monthLabel: e.g. "January 2027"
  const sched = getSheet('Schedule');
  const data  = sched.getDataRange().getValues();
  // Check not already present
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === monthLabel.trim().toLowerCase()) {
      return { success: false, error: 'Month already exists' };
    }
  }
  sched.appendRow([monthLabel, '', '']);
  return { success: true };
}

// -- Dashboard: available months --

function getAvailableMonths(token) {
  if (!validateToken_(token)) return { error: 'Unauthorized' };
  const data = getSheet('Orders').getDataRange().getValues();
  const seen = {};
  const months = [];
  getSheet('Schedule').getDataRange().getValues().slice(1).forEach(row => {
    const label = meetingMonthFromOrdersCell_(row[0]);
    if (meetingLabelToYm_(label) != null && !seen[label]) { seen[label] = true; months.push(label); }
  });
  const chair = getSheet('Chair Reports');
  if (chair) {
    const records = chair.getDataRange().getValues();
    records.slice(1).forEach(row => {
      const label = chairRowMonth_(row, records[0][0]);
      if (meetingLabelToYm_(label) != null && !seen[label]) { seen[label] = true; months.push(label); }
    });
  }
  for (let i = 1; i < data.length; i++) {
    const cell = data[i][2];
    if (!cell) continue;
    const label = meetingMonthFromOrdersCell_(cell);
    if (!label || seen[label]) continue;
    seen[label] = true;
    months.push(label);
  }
  // Sort newest first using year*12+month numeric key
  months.sort(function(a, b) {
    const ya = meetingLabelToYm_(a), yb = meetingLabelToYm_(b);
    if (ya == null && yb == null) return 0;
    if (ya == null) return 1;
    if (yb == null) return -1;
    return yb - ya;
  });
  return months;
}

// -- Dashboard: item summary report --

function getItemSummaryReport(meetingMonth, token) {
  if (!validateToken_(token)) return { error: 'Unauthorized', items: [] };
  const showAll = reportMonthIsOpenOrUnknown_(meetingMonth);

  // Get matching order IDs
  const ordersData = getSheet('Orders').getDataRange().getValues();
  const matchingOrderIds = {};
  for (let i = 1; i < ordersData.length; i++) {
    const row = ordersData[i];
    if (!row[0]) continue;
    const orderMonth = meetingMonthFromOrdersCell_(row[2]);
    if (showAll || orderMatchesReportMonth_(orderMonth, meetingMonth)) {
      matchingOrderIds[String(row[0]).trim()] = normalizedStatus_(row[9]);
    }
  }

  const itemsData = getSheet('Order Items').getDataRange().getValues();
  const catMap = getCatalogMap_();
  const itemMap = {};
  const validRows = new Set();
  Object.keys(matchingOrderIds).forEach(id => orderItemRowIndicesForOrder_(itemsData, id).forEach(i => validRows.add(i)));

  for (let i = 1; i < itemsData.length; i++) {
    if (!validRows.has(i)) continue;
    const row = itemsData[i];
    const orderId = String(row[1]).trim();
    if (!matchingOrderIds[orderId]) continue;
    const itemId = String(row[2]);
    if (!itemId) continue;
    if (!itemMap[itemId]) {
      const cat = catMap[itemId] || {};
      itemMap[itemId] = {
        itemId:         itemId,
        name:           cat.name || String(row[3]),
        category:       cat.category || 'Other',
        price:          0,
        qtyOrdered:     0,
        qtyFulfilled:   0,
        estimatedValue: 0,
        totalValue:     0,
      };
    }
    const entry = itemMap[itemId];
    const qOrd  = Number(row[5]) || 0;
    const qFul = matchingOrderIds[orderId] === 'New' ? 0 : (Number(row[6]) || 0);
    const price  = Number(row[4]) || 0;
    if (price > 0) entry.price = price;
    entry.qtyOrdered    += qOrd;
    entry.qtyFulfilled  += qFul;
    entry.estimatedValue += Math.round(qOrd * price * 100) / 100;
    entry.totalValue    += Math.round(qFul * price * 100) / 100;
  }

  const items = Object.keys(itemMap).map(function(id) { return itemMap[id]; });
  items.sort(function(a, b) {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
  return { meetingMonth: meetingMonth, items: items };
}

// -- Dashboard: annual summary --

function getAnnualSummary(token) {
  if (!validateToken_(token)) return { error: 'Unauthorized', months: [] };
  const ordersData = getSheet('Orders').getDataRange().getValues();

  const monthMap = {};
  for (let i = 1; i < ordersData.length; i++) {
    const row = ordersData[i];
    if (!row[0]) continue;
    const label = meetingMonthFromOrdersCell_(row[2]);
    if (!label) continue;
    if (!monthMap[label]) {
      monthMap[label] = { meetingMonth: label, ym: meetingLabelToYm_(label), orderCount: 0, estimatedTotal: 0, fulfilledTotal: 0 };
    }
    let status = String(row[9] || '');
    if (status === 'Submitted' || status === 'Fulfilling') status = 'New';
    monthMap[label].orderCount++;
    monthMap[label].estimatedTotal += Number(row[7]) || 0;
    if (status === 'Completed') monthMap[label].fulfilledTotal += Number(row[8]) || 0;
  }

  const months = Object.keys(monthMap).map(function(k) { return monthMap[k]; });
  months.sort(function(a, b) {
    if (a.ym == null && b.ym == null) return 0;
    if (a.ym == null) return 1;
    if (b.ym == null) return -1;
    return b.ym - a.ym;
  });
  months.forEach(function(m) { delete m.ym; });
  return { months: months };
}

// -- Dashboard: complete / uncomplete order --

function completeOrder(orderId, token, revision) {
  return transitionOrder_(orderId, 'complete', revision, null, token);
}

function uncompleteOrder(orderId, token, revision) {
  return transitionOrder_(orderId, 'undo', revision, null, token);
}

function debugSchedule_() {
  const w = getCurrentWindow();
  Logger.log('Current window: ' + JSON.stringify(w));
  return w;
}
