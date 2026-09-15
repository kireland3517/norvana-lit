// ============================================================
// NORVANA Literature Orders System
// File: Code.gs  (single file — contains ALL server functions)
// Deploy as Web App > Execute as Me > Anyone can access
// ============================================================

const SHEET_ID = '1TFcx55RMampRYUpVhUP3Nzp5hGERJB2F3GnLFvt7A40';

// ── Routing ───────────────────────────────────────────────────
// Single URL serves the unified app (Order Form + Dashboard).
// No ?dashboard=1 parameter needed anymore.

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('App');
  return template.evaluate()
    .setTitle('NORVANA Literature')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Shared helpers ────────────────────────────────────────────

function getSheet(tabName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tabName);
}

// ── Order window ──────────────────────────────────────────────

function getCurrentWindow() {
  const data  = getSheet('Schedule').getDataRange().getValues();
  const tz    = Session.getScriptTimeZone();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let upcoming = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[1] || !row[2]) continue;
    if (!(row[1] instanceof Date) || !(row[2] instanceof Date)) continue;

    const meetingMonth = row[0] instanceof Date
      ? Utilities.formatDate(row[0], tz, 'MMMM yyyy')
      : String(row[0]).trim();
    const open  = new Date(row[1]); open.setHours(0, 0, 0, 0);
    const close = new Date(row[2]); close.setHours(23, 59, 59, 0);

    if (today >= open && today <= close) {
      return {
        meetingMonth: meetingMonth,
        openDate:     Utilities.formatDate(open,  tz, 'MMMM d, yyyy'),
        closeDate:    Utilities.formatDate(close, tz, 'MMMM d, yyyy'),
      };
    }
    if (open > today && !upcoming) {
      upcoming = {
        meetingMonth: meetingMonth,
        openDate:     Utilities.formatDate(open,  tz, 'MMMM d, yyyy'),
        closeDate:    Utilities.formatDate(close, tz, 'MMMM d, yyyy'),
      };
    }
  }
  return upcoming || { meetingMonth: 'Current', openDate: '', closeDate: '' };
}

// ── Groups ────────────────────────────────────────────────────

function getGroups() {
  const data = getSheet('Groups').getDataRange().getValues();
  return data.slice(1).map(r => r[0]).filter(g => g !== '');
}

// ── Catalog ───────────────────────────────────────────────────

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
    });
  }
  return catalog;
}

function getCatalog() {
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
    });
  }
  return items;
}

function getCatalogMap() {
  const data = getSheet('Catalog').getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < data.length; i++) {
    map[String(data[i][0])] = { category: String(data[i][1]), name: String(data[i][2]) };
  }
  return map;
}

// ── Form data (single call for order form init) ───────────────

function getFormData() {
  try {
    return {
      windowData: getCurrentWindow(),
      groups:     getGroups(),
      catalog:    getCatalogForForm(),
    };
  } catch (e) {
    return {
      error:   true,
      message: e && e.message ? e.message : String(e),
    };
  }
}

// ── Submit order ──────────────────────────────────────────────

// ── Dashboard: auto-save fulfillment quantities ──────────────

function autoSaveFulfillment(orderId, fulfilled, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  try {
    const oid = String(orderId).trim();
    const itemsSheet = getSheet('Order Items');
    const itemsData  = itemsSheet.getDataRange().getValues();
    let wroteAny = false;
    for (let k = 0; k < fulfilled.length; k++) {
      const f = fulfilled[k];
      let i = -1;
      if (f.sheetRow != null && f.sheetRow !== '') {
        const r = Number(f.sheetRow);
        if (r >= 2 && r <= itemsData.length) {
          const idx = r - 1;
          if (String(itemsData[idx][1]).trim() === oid &&
              String(itemsData[idx][0]).trim() === String(f.rowId).trim()) {
            i = idx;
          }
        }
      }
      if (i < 0) {
        for (let j = 1; j < itemsData.length; j++) {
          if (String(itemsData[j][0]).trim() !== String(f.rowId).trim()) continue;
          if (String(itemsData[j][1]).trim() !== oid) continue;
          i = j;
          break;
        }
      }
      if (i < 0) continue;
      if (f.qtyFulfilled !== '' && f.qtyFulfilled !== null) {
        const maxQ = Number(itemsData[i][5]);
        const q = Math.max(0, Math.min(maxQ, Number(f.qtyFulfilled) || 0));
        const line = Math.round(q * Number(itemsData[i][4]) * 100) / 100;
        // getRange(r,c,numRows,numCols) — not (r1,c1,r2,c2)
        itemsSheet.getRange(i + 1, 7, 1, 2).setValues([[q, line]]);
        wroteAny = true;
      }
    }
    return { success: true, wroteAny: wroteAny };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function submitOrder(payload) {
  // ─ Validate schedule window ─
  const win = getCurrentWindow();
  if (!win || !win.openDate || !win.closeDate) {
    return { success: false, error: 'The order window is currently closed. Please check back when the next window opens.' };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tz = Session.getScriptTimeZone();
  // Re-check open/close dates from the schedule for the current window
  const schedData = getSheet('Schedule').getDataRange().getValues();
  let windowOpen = false;
  for (let i = 1; i < schedData.length; i++) {
    const row = schedData[i];
    if (!row[0] || !row[1] || !row[2]) continue;
    if (!(row[1] instanceof Date) || !(row[2] instanceof Date)) continue;
    const open  = new Date(row[1]); open.setHours(0, 0, 0, 0);
    const close = new Date(row[2]); close.setHours(23, 59, 59, 0);
    if (today >= open && today <= close) { windowOpen = true; break; }
  }
  if (!windowOpen) {
    return { success: false, error: 'The order window is currently closed.' };
  }

  // ─ Basic validation ─
  if (!payload.groupName || !payload.contactName || !payload.email) {
    return { success: false, error: 'Please fill in all required fields.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!payload.items || payload.items.length === 0) {
    return { success: false, error: 'Please select at least one item.' };
  }

  // ─ Lock to prevent concurrent duplicate IDs ─
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { success: false, error: 'System busy — please try again in a moment.' };
  }

  try {
    const ordersSheet = getSheet('Orders');
    const itemsSheet  = getSheet('Order Items');
    const now         = new Date();

    // ─ Use server-side prices from Catalog (ignore client-sent prices) ─
    const catalogData = getSheet('Catalog').getDataRange().getValues();
    const priceMap = {};
    const nameMap  = {};
    const activeMap = {};
    for (let i = 1; i < catalogData.length; i++) {
      const id = String(catalogData[i][0]);
      priceMap[id]  = Number(catalogData[i][3]);
      nameMap[id]   = String(catalogData[i][2]);
      activeMap[id] = String(catalogData[i][5]).trim().toUpperCase() === 'YES';
    }

    // Filter to only active items with qty > 0, use server prices
    const items = payload.items
      .filter(item => activeMap[item.itemId] && Number(item.qty) > 0)
      .map(item => ({
        itemId: item.itemId,
        name:   nameMap[item.itemId] || item.name,
        price:  priceMap[item.itemId] !== undefined ? priceMap[item.itemId] : 0,
        qty:    Math.min(Math.max(1, Math.floor(Number(item.qty))), 999),
      }));

    if (items.length === 0) {
      return { success: false, error: 'No valid items in order.' };
    }

    // ─ Generate unique order ID (inside lock) ─
    const meetingDate = payload.meetingMonth ? new Date(payload.meetingMonth + ' 1') : now;
    const yy          = String(meetingDate.getFullYear()).slice(2);
    const mm          = String(meetingDate.getMonth() + 1).padStart(2, '0');
    const prefix      = 'NL-' + yy + mm + '-';
    const existing    = ordersSheet.getDataRange().getValues();
    let maxSeq = 0;
    for (let i = 1; i < existing.length; i++) {
      const id = String(existing[i][0]);
      if (id.startsWith(prefix)) {
        const seq = parseInt(id.slice(prefix.length)) || 0;
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    const orderId = prefix + String(maxSeq + 1).padStart(3, '0');

    let estimatedTotal = 0;
    items.forEach(item => { estimatedTotal += item.price * item.qty; });
    estimatedTotal = Math.round(estimatedTotal * 100) / 100;

    ordersSheet.appendRow([
      orderId, now, payload.meetingMonth, payload.groupName,
      payload.contactName, payload.email, payload.phone || '',
      estimatedTotal, '', 'New', ''
    ]);

    items.forEach((item, idx) => {
      itemsSheet.appendRow([
        orderId + '-' + String(idx + 1).padStart(2, '0'),
        orderId, item.itemId, item.name,
        item.price, item.qty, '', '',
      ]);
    });

    // ─ Send emails (order already saved; surface warning if mail fails) ─
    try {
      sendConfirmationToGroup({ ...payload, items: items }, orderId, estimatedTotal);
      sendAlertToLitChair({ ...payload, items: items }, orderId, estimatedTotal);
    } catch(mailErr) {
      return {
        success: true,
        orderId: orderId,
        warning: 'Order saved (ID: ' + orderId + ') but confirmation email could not be sent. Please note your order ID and contact the Lit Chair.',
      };
    }

    return { success: true, orderId: orderId };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Emails ────────────────────────────────────────────────────

function sendConfirmationToGroup(payload, orderId, estimatedTotal) {
  const lines = payload.items.map(i =>
    '  ' + i.name + ' (x' + i.qty + ') — $' + (i.price * i.qty).toFixed(2)).join('\n');
  MailApp.sendEmail({
    to: payload.email,
    subject: 'Literature Order Confirmation — ' + payload.groupName,
    body:
      'Thank you for submitting your literature order for the ' + payload.meetingMonth + ' area meeting.\n\n' +
      'GROUP: ' + payload.groupName + '\n' +
      'CONTACT: ' + payload.contactName + '\n\n' +
      'ITEMS ORDERED:\n' + lines + '\n\n' +
      'ESTIMATED TOTAL: $' + estimatedTotal.toFixed(2) + '\n\n' +
      'All totals are estimates. Final amounts are based on actual inventory at time of fulfillment. ' +
      'You will receive a second email when your order is ready for pickup with the final amount due.\n\n' +
      'Questions? Contact the Lit Chair at ' + getLitChairEmail() + '.\n\n' +
      'NORVANA Literature Committee',
  });
}

function sendAlertToLitChair(payload, orderId, estimatedTotal) {
  const lines = payload.items.map(i =>
    '  ' + i.itemId + '  ' + i.name + ' (x' + i.qty + ') — $' + (i.price * i.qty).toFixed(2)).join('\n');
  MailApp.sendEmail({
    to: getLitChairEmail(),
    subject: 'New Order — ' + payload.groupName,
    body:
      'New literature order submitted.\n\n' +
      'ORDER ID: ' + orderId + '\nMEETING MONTH: ' + payload.meetingMonth + '\n' +
      'GROUP: ' + payload.groupName + '\nCONTACT: ' + payload.contactName + '\n' +
      'EMAIL: ' + payload.email + '\nPHONE: ' + payload.phone + '\n\n' +
      'ITEMS:\n' + lines + '\n\n' +
      'ESTIMATED TOTAL: $' + estimatedTotal.toFixed(2) + '\n\nNORVANA Literature Orders System',
  });
}

// ── Shared: get lit chair email from Config ─────────────────
function getLitChairEmail() {
  const data = getSheet('Config').getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === 'lit chair email') return String(data[i][1]);
  }
  return 'norvanalit12@gmail.com'; // fallback only
}

// ── Dashboard: auth ───────────────────────────────────────────

// ── Session token helpers ────────────────────────────────
const TOKEN_TTL_SECONDS = 28800; // 8 hours

function issueSessionToken_() {
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put('session_' + token, '1', TOKEN_TTL_SECONDS);
  return token;
}

function validateToken_(token) {
  if (!token) return false;
  const cache = CacheService.getScriptCache();
  return cache.get('session_' + token) === '1';
}

function revokeToken_(token) {
  if (!token) return;
  CacheService.getScriptCache().remove('session_' + token);
}

function checkAccessCode(code) {
  const data = getSheet('Config').getDataRange().getValues();
  let storedCode = 'changeme';
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === 'dashboard access code') {
      storedCode = String(data[i][1]); break;
    }
  }
  if (code !== storedCode) return { valid: false };
  const token = issueSessionToken_();
  const w = getCurrentWindow();
  return { valid: true, token: token, meetingMonth: w ? w.meetingMonth : 'Current' };
}

function signOut(token) {
  revokeToken_(token);
  return { success: true };
}

// ── Order Items: column A must be "{orderId}-NN" (submitOrder format). Rows with column B = order
// but a different A (duplicates / paste errors) are dropped once that order has ≥1 valid line.
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

// ── Dashboard: orders ─────────────────────────────────────────

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
  // Show ALL orders regardless of meetingMonth — filtering is for Reports only
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
      itemCount:      itemCounts[String(row[0]).trim()] || 0,
    });
  }
  // Sort newest first
  orders.sort(function(a, b) { return b.orderId.localeCompare(a.orderId); });
  return orders;
}

// ── Dashboard: order items ────────────────────────────────────

function getOrderItems(orderId, token) {
  if (!validateToken_(token)) return { error: 'Unauthorized', items: [] };
  const oid  = String(orderId).trim();
  const data = getSheet('Order Items').getDataRange().getValues();
  const catMap = getCatalogMap();
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
      category:     catMap[itemId] ? catMap[itemId].category : 'Other',
    });
  }
  return { items: items };
}

// ── Dashboard: fulfill order ──────────────────────────────────

function fulfillOrder(orderId, fulfilled, fulfilledTotal, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { success: false, error: 'System busy — please try again.' };

  try {
    const oid = String(orderId).trim();
    const ordersSheet = getSheet('Orders');
    const itemsSheet  = getSheet('Order Items');

    // ─ Idempotency: check current status before doing anything ─
    const ordersData = ordersSheet.getDataRange().getValues();
    let orderRow = -1, currentStatus = '';
    for (let i = 1; i < ordersData.length; i++) {
      if (String(ordersData[i][0]).trim() === oid) {
        orderRow = i + 1;
        currentStatus = String(ordersData[i][9] || '');
        break;
      }
    }
    if (orderRow < 0) return { success: false, error: 'Order not found.' };
    if (currentStatus === 'Ready' || currentStatus === 'Completed') return { success: true, alreadyDone: true }; // no duplicate email

    // ─ Write item fulfillment quantities ─
    const itemsData = itemsSheet.getDataRange().getValues();
    fulfilled.forEach(f => {
      let i = -1;
      if (f.sheetRow != null && f.sheetRow !== '') {
        const r = Number(f.sheetRow);
        if (r >= 2 && r <= itemsData.length) {
          i = r - 1;
          if (String(itemsData[i][1]).trim() !== oid) return;
          if (String(itemsData[i][0]).trim() !== String(f.rowId).trim()) return;
        }
      }
      if (i < 0) {
        for (let j = 1; j < itemsData.length; j++) {
          if (String(itemsData[j][0]).trim() !== String(f.rowId).trim()) continue;
          if (String(itemsData[j][1]).trim() !== oid) break;
          i = j;
          break;
        }
      }
      if (i < 0) return;
      const maxQty = Number(itemsData[i][5]);
      const qty    = Math.max(0, Math.min(maxQty, Number(f.qtyFulfilled) || 0));
      const price  = Number(itemsData[i][4]);
      itemsSheet.getRange(i + 1, 7).setValue(qty);
      itemsSheet.getRange(i + 1, 8).setValue(Math.round(qty * price * 100) / 100);
      deductInventory(String(itemsData[i][2]), qty);
    });

    // ─ Update order status ─
    ordersSheet.getRange(orderRow, 9).setValue(fulfilledTotal);
    ordersSheet.getRange(orderRow, 10).setValue('Ready');
    ordersSheet.getRange(orderRow, 11).setValue(new Date());

    sendFulfillmentEmail(orderId, fulfilled, fulfilledTotal);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Removes the order row from Orders and every line row in Order Items where column B matches. */
function deleteOrder(orderId, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: 'System busy — try again.' };

  try {
    const oid = String(orderId).trim();
    const ordersSheet = getSheet('Orders');
    const itemsSheet  = getSheet('Order Items');

    const itemsData = itemsSheet.getDataRange().getValues();
    const itemRows1Based = [];
    for (let i = 1; i < itemsData.length; i++) {
      if (String(itemsData[i][1]).trim() === oid) itemRows1Based.push(i + 1);
    }
    itemRows1Based.sort(function(a, b) { return b - a; });
    itemRows1Based.forEach(function(r) {
      itemsSheet.deleteRow(r);
    });

    const ordersData = ordersSheet.getDataRange().getValues();
    let orderRow1Based = -1;
    for (let i = 1; i < ordersData.length; i++) {
      if (String(ordersData[i][0]).trim() === oid) {
        orderRow1Based = i + 1;
        break;
      }
    }
    if (orderRow1Based < 0) {
      return {
        success: true,
        warning: itemRows1Based.length
          ? 'Line items were removed; the order was not found on the Orders tab (it may have been deleted already).'
          : 'Nothing to delete — order not found.',
      };
    }
    ordersSheet.deleteRow(orderRow1Based);
    return { success: true, removedItems: itemRows1Based.length };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function deductInventory(itemId, qty) {
  const catalog = getSheet('Catalog');
  const data    = catalog.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === itemId) {
      catalog.getRange(i + 1, 5).setValue(Math.max(0, (Number(data[i][4]) || 0) - qty));
      break;
    }
  }
}

function sendFulfillmentEmail(orderId, fulfilled, fulfilledTotal) {
  const ordersData = getSheet('Orders').getDataRange().getValues();
  const itemsData  = getSheet('Order Items').getDataRange().getValues();
  let email = '', groupName = '', meetingMonth = '';

  for (let i = 1; i < ordersData.length; i++) {
    if (String(ordersData[i][0]) === orderId) {
      meetingMonth = String(ordersData[i][2]);
      groupName    = String(ordersData[i][3]);
      email        = String(ordersData[i][5]);
      break;
    }
  }
  if (!email) return;

  const oid = String(orderId).trim();
  const lineIdxs = orderItemRowIndicesForOrder_(itemsData, oid);
  const lines = [];
  for (let k = 0; k < lineIdxs.length; k++) {
    const i = lineIdxs[k];
    if (itemsData[i][6] === '' || itemsData[i][6] == null) continue;
    const qty = Number(itemsData[i][6]);
    if (qty > 0) lines.push('  ' + String(itemsData[i][3]) + ' (x' + qty + ') — $' + (qty * Number(itemsData[i][4])).toFixed(2));
  }

  const subjectSuffix = groupName ? groupName : 'Pickup';
  MailApp.sendEmail({
    to: email,
    subject: 'Your Literature Order is Ready — ' + subjectSuffix,
    body:
      'Your literature order for the ' + meetingMonth + ' area meeting is ready for pickup.\n\n' +
      'GROUP: ' + groupName + '\n\n' +
      'ITEMS FULFILLED:\n' + lines.join('\n') + '\n\n' +
      'FINAL AMOUNT DUE AT PICKUP: $' + Number(fulfilledTotal).toFixed(2) + '\n\n' +
      'Please bring your payment to the Lit Chair table at the area meeting. Exact change appreciated.\n\n' +
      'Questions? Contact the Lit Chair at ' + getLitChairEmail() + '\n\nNORVANA Literature Committee',
  });
}

// ── Dashboard: report ─────────────────────────────────────────

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
  // If month labels still don't line up (legacy text, locale, etc.), show all orders rather than a blank report.
  if (orders.length === 0 && allOrders.length > 0) {
    orders = allOrders.slice();
  }

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

function exportReportCSV(meetingMonth, filterStatus, filterGroup, token) {
  if (!validateToken_(token)) return null;
  const data = getMonthlyReport(meetingMonth, token);
  let rows = data.rows;
  if (filterStatus && filterStatus !== 'All') rows = rows.filter(r => r.status === filterStatus);
  if (filterGroup  && filterGroup  !== 'All') rows = rows.filter(r => r.groupName === filterGroup);

  const report = getSheet('Monthly Report');
  report.clearContents();
  report.getRange(1, 1, 1, 6).setValues([[
    'Group Name','Items Ordered','Items Fulfilled','Estimated Total','Fulfilled Total','Status'
  ]]);
  if (rows.length > 0) {
    // Row 1 = header; data rows are 2 through (1 + rows.length)
    report.getRange(2, 1, rows.length, 6).setValues(
      rows.map(r => [r.groupName, r.itemsOrdered, r.itemsFulfilled !== '' ? r.itemsFulfilled : '', r.estimatedTotal, r.fulfilledTotal||'', r.status])
    );
  }
  return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=' + report.getSheetId();
}

// ── Dashboard: inventory ──────────────────────────────────────

function updateStockCounts(updates, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const catalog = getSheet('Catalog');
  const data    = catalog.getDataRange().getValues();
  const map     = {};
  updates.forEach(u => { map[u.itemId] = u.stock; });
  for (let i = 1; i < data.length; i++) {
    if (map.hasOwnProperty(String(data[i][0]))) {
      catalog.getRange(i + 1, 5).setValue(map[String(data[i][0])]);
    }
  }
}

// ── Dashboard: settings ───────────────────────────────────────

function getSettings(token) {
  if (!validateToken_(token)) return { error: 'Unauthorized' };
  const tz         = Session.getScriptTimeZone();
  const configData = getSheet('Config').getDataRange().getValues();
  const schedData  = getSheet('Schedule').getDataRange().getValues();

  let accessCode = 'changeme';
  let email      = 'norvanalit12@gmail.com';

  for (let i = 0; i < configData.length; i++) {
    const key = String(configData[i][0]).toLowerCase();
    if (key === 'dashboard access code') accessCode = String(configData[i][1]);
    if (key === 'lit chair email')        email      = String(configData[i][1]);
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
  return { accessCode: accessCode, email: email, schedule: schedule };
}

function saveGlobalSettings(code, email, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const config = getSheet('Config');
  const data   = config.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0]).toLowerCase();
    if (key === 'dashboard access code') config.getRange(i + 1, 2).setValue(code);
    if (key === 'lit chair email')        config.getRange(i + 1, 2).setValue(email);
  }
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
        const openDate  = new Date(openParts[0],  openParts[1] - 1,  openParts[2]);
        const closeDate = new Date(closeParts[0], closeParts[1] - 1, closeParts[2]);
        sched.getRange(i + 1, 2).setValue(openDate);
        sched.getRange(i + 1, 3).setValue(closeDate);
      }
    }
  }
}

// ── Dashboard: catalog management ───────────────────────────

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
  catalog.appendRow([newId, item.category, item.name, Number(item.price), 0, 'YES']);
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
}

// ── Dashboard: groups management ──────────────────────────────

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
}

// ── Dashboard: schedule — add month ───────────────────────────

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

// ── Dashboard: available months ──────────────────────────────

function getAvailableMonths(token) {
  if (!validateToken_(token)) return { error: 'Unauthorized' };
  const data = getSheet('Orders').getDataRange().getValues();
  const seen = {};
  const months = [];
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

// ── Dashboard: item summary report ────────────────────────────

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
      matchingOrderIds[String(row[0]).trim()] = true;
    }
  }

  const itemsData = getSheet('Order Items').getDataRange().getValues();
  const catMap = getCatalogMap();
  const itemMap = {};

  for (let i = 1; i < itemsData.length; i++) {
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
    const qFul  = row[6] !== '' && row[6] != null ? Number(row[6]) : 0;
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

// ── Dashboard: annual summary ──────────────────────────────────

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

// ── Dashboard: complete / uncomplete order ────────────────────

function completeOrder(orderId, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, error: 'System busy — please try again.' };
  try {
    const oid = String(orderId).trim();
    const sheet = getSheet('Orders');
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() !== oid) continue;
      sheet.getRange(i + 1, 10).setValue('Completed');
      sheet.getRange(i + 1, 11).setValue(new Date());
      return { success: true };
    }
    return { success: false, error: 'Order not found.' };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function uncompleteOrder(orderId, token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, error: 'System busy — please try again.' };
  try {
    const oid = String(orderId).trim();
    const sheet = getSheet('Orders');
    const data  = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() !== oid) continue;
      sheet.getRange(i + 1, 10).setValue('Ready');
      sheet.getRange(i + 1, 11).setValue('');
      return { success: true };
    }
    return { success: false, error: 'Order not found.' };
  } catch(e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Debug helpers ─────────────────────────────────────────────

function debugSchedule() {
  const w = getCurrentWindow();
  Logger.log('Current window: ' + JSON.stringify(w));
  return w;
}
