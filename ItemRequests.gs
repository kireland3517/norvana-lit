// Item requests: an item the Lit Chair does not keep in stock (inactive in the Catalog and Inventory Type "Order on Request",
// for example the literature racks) stays on the order form in its normal category with a Request button instead of a quantity.
// A request is saved to the "Item Requests" tab, the Lit Chair and the group are emailed, and the request stays on the Lit Chair
// tab's Requests list until it is finished: Open (waiting, or ready to notify once the item is Active) -> Notified -> Done.
// Retired items (inactive but NOT Order on Request) are never shown to groups.

const REQ_TAB_ = 'Item Requests';
const REQ_HEADERS_ = ['Request ID', 'Requested At', 'Meeting Month', 'Group', 'Contact', 'Email', 'Phone', 'Item ID', 'Item Name', 'Status', 'Notified At', 'Closed At'];
const REQ_OPEN_ = 'Open', REQ_NOTIFIED_ = 'Notified', REQ_DONE_ = 'Done';
const REQ_STALE_DAYS_ = 30;      // an open request this old is marked in red
const REQ_DONE_SHOW_DAYS_ = 30;  // finished requests stay on the list this long

function reqStore_() { return fsSheet_(REQ_TAB_, REQ_HEADERS_); }

// Catalog items groups can ask for: inactive and Order on Request. Keyed by item ID.
function requestableItems_() {
  const data = getSheet('Catalog').getDataRange().getValues(), map = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || String(row[5]).trim().toUpperCase() === 'YES') continue;
    if (inventoryTypeOf_(row[1], row[8]) !== INVENTORY_ON_REQUEST_) continue;
    map[String(row[0])] = { itemId: String(row[0]), name: String(row[2]), category: String(row[1]).trim(), price: Number(row[3]) || 0 };
  }
  return map;
}

// Checks the items a group asked for on the order form (inactive Order on Request items) against the same category rules as an order.
// Returns { items: [{itemId, name}], error }.
function checkRequestedItems_(itemIds, subcommittee) {
  const known = requestableItems_(), out = [];
  for (let i = 0; i < itemIds.length; i++) {
    const item = known[itemIds[i]];
    if (!item) return { items: [], error: 'An item you asked for is available now or no longer listed. Please reload the form and try again.' };
    if (subcommittee ? HI_HIDDEN_CATEGORIES_.indexOf(item.category) >= 0 : HI_ONLY_CATEGORIES_.indexOf(item.category) >= 0) {
      return { items: [], error: 'Some items in this order are not available to the selected group. Please reload the form and try again.' };
    }
    out.push({ itemId: item.itemId, name: item.name });
  }
  return { items: out, error: '' };
}

// Called inside submitOrder's lock: one row per item. A group that already has an Open request for the item adds nothing.
function saveRequests_(groupName, contactName, email, phone, askedItems, month) {
  const store = reqStore_(), rows = [];
  let n = store.data.length;
  askedItems.forEach(function(item) {
    const dup = store.data.slice(1).some(function(r) { return String(r[3]).toLowerCase() === groupName.toLowerCase() && String(r[7]) === item.itemId && String(r[9]) === REQ_OPEN_; });
    if (dup) return;
    rows.push(['RQ-' + String(n).padStart(4, '0'), new Date().toISOString(), month, groupName, contactName, email, phone, item.itemId, item.name, REQ_OPEN_, '', '']);
    n++;
  });
  if (rows.length) fsAppend_(store.sheet, rows);
}

function reqNames_(r) { return (r.requested || []).join(', '); }

// r: { groupName, contactName, email, phone, meetingMonth, requested: [item names] }. One email covers every item in the submission.
function sendRequestConfirmation_(r) {
  const names = reqNames_(r), many = r.requested.length > 1;
  sendStyledMail_({
    to: r.email, subject: 'Item request received - ' + names,
    eyebrow: r.meetingMonth + EMAIL_DOT_ + 'Item request', headline: ['We got', 'your request.'],
    lead: ['The Lit Chair knows your group would like ' + names + '.', (many ? "These aren't" : "It isn't") + ' kept in stock, so ' + (many ? 'they are' : 'it is') + ' ordered when someone asks.'],
    pill: 'Request received', heading: r.groupName, subheading: names, statusLabel: 'Waiting for item',
    callout: { label: 'What happens next', text: "When " + (many ? 'an item arrives' : 'the item arrives') + " you'll get an email, and your group can order it on the order form." },
    footer: ['Questions? Contact the Lit Chair at ' + getLitChairEmail() + '.', 'NORVANA Literature Committee'],
    body: 'We got your request.\n\nGROUP: ' + r.groupName + '\nITEMS: ' + names + '\n\nThese items are not kept in stock, so the Lit Chair orders them when someone asks. ' +
      "When an item arrives you'll get an email, and your group can order it on the order form.\n\nQuestions? Contact the Lit Chair at " + getLitChairEmail() + '.\n\nNORVANA Literature Committee',
  });
}

function sendRequestAlert_(r) {
  const names = reqNames_(r);
  deliverStyledMailToOwnInbox_({
    to: getLitChairEmail(), subject: 'Item request - ' + r.groupName + ' - ' + names,
    eyebrow: r.meetingMonth + EMAIL_DOT_ + 'Chair notification', headline: ['Someone asked', 'for an item.'],
    lead: r.groupName + ' would like ' + names + '.',
    pill: 'Item request', heading: r.groupName, subheading: names, statusLabel: 'Needs ordering',
    contact: { label: 'Group contact', name: r.contactName, detail: r.email + (r.phone ? EMAIL_DOT_ + r.phone : '') },
    callout: { label: 'Next step', text: 'Order from Free State, then mark each item Active in Inventory. The Requests list on the Lit Chair tab lets you notify the groups that asked.' },
    footer: ['Sent to the Literature Chair.', 'NORVANA Literature Committee'],
    body: 'Item request.\n\nGROUP: ' + r.groupName + '\nCONTACT: ' + r.contactName + '\nEMAIL: ' + r.email + '\nPHONE: ' + r.phone + '\nITEMS: ' + names +
      '\n\nOrder from Free State, then mark each item Active in Inventory. The Requests list on the Lit Chair tab lets you notify the groups that asked.\n\nNORVANA Literature Orders System',
  });
}

function sendRequestAvailable_(r) {
  const win = getCurrentWindow();
  sendStyledMail_({
    to: r.email, subject: 'Now available - ' + r.itemName,
    eyebrow: 'Item available', headline: ["It's in.", 'Order it now.'],
    lead: ['The ' + r.itemName + ' you asked about has arrived.', 'You can order it on the group order form.'],
    pill: 'Now available', heading: r.group, subheading: r.itemName, statusLabel: 'Available',
    callout: win.isOpen ? { label: 'Order window', text: 'The window for the ' + win.meetingMonth + ' area meeting is open until ' + win.closeDate + '.' } : null,
    footer: ['Questions? Contact the Lit Chair at ' + getLitChairEmail() + '.', 'NORVANA Literature Committee'],
    body: 'The ' + r.itemName + ' you asked about has arrived. You can order it on the group order form.' +
      (win.isOpen ? '\n\nThe window for the ' + win.meetingMonth + ' area meeting is open until ' + win.closeDate + '.' : '') +
      '\n\nQuestions? Contact the Lit Chair at ' + getLitChairEmail() + '.\n\nNORVANA Literature Committee',
  });
}

// -- Lit Chair tab: the Requests list --

function reqRow_(data, i) {
  const r = data[i];
  return { number: i + 1, requestId: String(r[0]), requestedAt: String(r[1]), month: String(r[2]), group: String(r[3]), contact: String(r[4]), email: String(r[5]),
    phone: String(r[6]), itemId: String(r[7]), itemName: String(r[8]), status: String(r[9]), notifiedAt: String(r[10]), closedAt: String(r[11]) };
}
function reqDaysAgo_(iso, now) { const t = Date.parse(iso); return isNaN(t) ? 0 : Math.floor((now - t) / 86400000); }

// Requests grouped by item. state: waiting (item still inactive), ready (item is Active, groups not told yet), done (nobody left open).
function getItemRequests(token) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  try {
    const store = reqStore_(), catalog = getSheet('Catalog').getDataRange().getValues(), active = {}, now = Date.now(), items = {}, order = [];
    for (let i = 1; i < catalog.length; i++) active[String(catalog[i][0])] = String(catalog[i][5]).trim().toUpperCase() === 'YES';
    for (let i = 1; i < store.data.length; i++) {
      const r = reqRow_(store.data, i);
      if (!r.requestId) continue;
      if (r.status === REQ_DONE_ && reqDaysAgo_(r.closedAt, now) > REQ_DONE_SHOW_DAYS_) continue;
      if (r.status === REQ_NOTIFIED_ && reqDaysAgo_(r.notifiedAt, now) > REQ_DONE_SHOW_DAYS_ * 3) continue;
      if (!items[r.itemId]) { items[r.itemId] = { itemId: r.itemId, name: r.itemName, active: !!active[r.itemId], requests: [] }; order.push(r.itemId); }
      items[r.itemId].requests.push({ requestId: r.requestId, group: r.group, contact: r.contact, requestedAt: r.requestedAt, status: r.status,
        notifiedAt: r.notifiedAt, closedAt: r.closedAt, stale: r.status === REQ_OPEN_ && reqDaysAgo_(r.requestedAt, now) > REQ_STALE_DAYS_ });
    }
    const list = order.map(function(id) {
      const it = items[id], open = it.requests.filter(function(q) { return q.status === REQ_OPEN_; });
      it.openCount = open.length;
      it.state = open.length ? (it.active ? 'ready' : 'waiting') : 'done';
      return it;
    });
    const rank = { ready: 0, waiting: 1, done: 2 };
    list.sort(function(a, b) { return rank[a.state] - rank[b.state]; });
    return { success: true, items: list, openCount: list.filter(function(i) { return i.state !== 'done'; }).length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Emails every group with an Open request for this item (the item must be Active) and marks those requests Notified.
function notifyItemRequesters(itemId, token) {
  return withWorkflowLock_(token, function() {
    itemId = String(itemId == null ? '' : itemId).trim();
    const catalog = getSheet('Catalog').getDataRange().getValues();
    const row = catalog.find(function(r, i) { return i > 0 && String(r[0]) === itemId; });
    if (!row) throw new Error('That item is not in the Catalog.');
    if (String(row[5]).trim().toUpperCase() !== 'YES') throw new Error('Mark the item Active in Inventory first, then tell the groups.');
    const store = reqStore_(), requests = [], sentTo = [], failed = [], when = new Date().toISOString();
    for (let i = 1; i < store.data.length; i++) {
      const r = reqRow_(store.data, i);
      if (r.itemId !== itemId || r.status !== REQ_OPEN_) continue;
      try { sendRequestAvailable_(r); }
      catch (e) { failed.push(r.group); continue; }
      requests.push(cellsRequest_(store.sheet, r.number, 10, [REQ_NOTIFIED_, when]));
      sentTo.push(r.group);
    }
    commitCells_(requests);
    return { success: true, sent: sentTo.length, failed: failed.length, groups: sentTo };
  });
}

// Called while submitOrder holds the lock: ordering an item closes that group's Open or Notified request for it.
function closeRequestsForOrder_(groupName, items) {
  try {
    const ids = {};
    items.forEach(function(i) { ids[String(i.itemId)] = true; });
    const store = reqStore_(), requests = [], when = new Date().toISOString();
    for (let i = 1; i < store.data.length; i++) {
      const r = reqRow_(store.data, i);
      if (r.group.toLowerCase() !== String(groupName).toLowerCase() || !ids[r.itemId] || (r.status !== REQ_OPEN_ && r.status !== REQ_NOTIFIED_)) continue;
      requests.push(cellsRequest_(store.sheet, r.number, 10, [REQ_DONE_, r.notifiedAt, when]));
    }
    commitCells_(requests);
  } catch (e) { Logger.log('Could not close item requests: ' + e); }
}
