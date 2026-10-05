// Atomic order transitions. Requires the Advanced Google Sheets service (Sheets v4).
// All app order/inventory writers share the script lock; column L is an optimistic revision.
function withWorkflowLock_(token, work) {
  if (!validateToken_(token)) return { success: false, error: 'Unauthorized' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: 'System busy. Please retry.' };
  try { return work(); } catch (e) { return { success: false, error: e.message }; }
  finally { lock.releaseLock(); }
}

function cellsRequest_(sheet, row, col, values) {
  return { updateCells: { start: { sheetId: sheet.getSheetId(), rowIndex: row - 1, columnIndex: col - 1 },
    rows: [{ values: values.map(v => ({ userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: String(v == null ? '' : v) } })) }],
    fields: 'userEnteredValue' } };
}
function commitCells_(requests) {
  if (requests.length) Sheets.Spreadsheets.batchUpdate({ requests: requests }, SHEET_ID);
}
function orderState_(orderId) {
  const sheet = getSheet('Orders'), data = sheet.getDataRange().getValues();
  if (data[0][11] !== 'Revision') throw new Error('Setup required: Orders column L must be Revision. See the Sheet layout section of HANDOFF.md.');
  const index = data.findIndex((r, i) => i > 0 && String(r[0]).trim() === String(orderId).trim());
  if (index < 0) return null;
  const row = data[index], status = normalizedStatus_(row[9]);
  return { sheet: sheet, row: row, number: index + 1, status: status, revision: Number(row[11]) || 0 };
}
function normalizedStatus_(status) {
  return !status || status === 'Submitted' || status === 'Fulfilling' ? 'New' : String(status);
}
function requireRevision_(state, revision) {
  if (!Number.isInteger(revision) || revision !== state.revision) throw new Error('Order changed. Reload it before trying again.');
}
function stockRequests_(deltas) {
  const sheet = getSheet('Catalog'), data = sheet.getDataRange().getValues();
  return Object.keys(deltas).map(id => {
    const i = data.findIndex((r, n) => n > 0 && String(r[0]) === id);
    if (i < 0) throw new Error('Catalog item missing: ' + id + '. Restore its catalog record before changing this order.');
    // Orders count packs; Catalog stock (col E) counts singles, so scale by Pack Size (col H).
    return cellsRequest_(sheet, i + 1, 5, [(Number(data[i][4]) || 0) + deltas[id] * (Number(data[i][7]) || 1)]);
  });
}
function transitionOrder_(orderId, action, revision, fulfilled, token) {
  return withWorkflowLock_(token, function() {
    const state = orderState_(orderId);
    if (!state) return action === 'delete' ? { success: true, alreadyDone: true } : { success: false, error: 'Order not found.' };
    requireRevision_(state, revision);
    const allowed = { ready: 'New', reopen: 'Ready', complete: 'Ready', undo: 'Completed' };
    if (action === 'delete' && state.status === 'Completed') throw new Error('Use Undo Pickup before deleting a Completed order.');
    if (action !== 'delete' && state.status !== allowed[action]) throw new Error('This action is not available for a ' + state.status + ' order. Reload the order.');
    const sheet = getSheet('Order Items'), data = sheet.getDataRange().getValues();
    const indices = orderItemRowIndicesForOrder_(data, String(orderId).trim());
    const requests = [], deltas = {};
    let total = Number(state.row[8]) || 0;
    if (action === 'ready') {
      if (!Array.isArray(fulfilled) || fulfilled.length !== indices.length || !indices.length) throw new Error('Reload the order and supply all fulfillment quantities.');
      const seen = new Set(); total = 0;
      indices.forEach(i => {
        const matches = fulfilled.filter(f => String(f.rowId) === String(data[i][0]));
        if (matches.length !== 1 || seen.has(String(data[i][0]))) throw new Error('Duplicate or missing order line.');
        seen.add(String(data[i][0]));
        const qty = Number(matches[0].qtyFulfilled);
        if (!Number.isInteger(qty) || qty < 0 || qty > Number(data[i][5])) throw new Error('Fulfilled quantities must be whole numbers from zero through the ordered quantity.');
        const line = Math.round(qty * Number(data[i][4]) * 100) / 100;
        total = Math.round((total + line) * 100) / 100;
        requests.push(cellsRequest_(sheet, i + 1, 7, [qty, line]));
        const id = String(data[i][2]); deltas[id] = (deltas[id] || 0) - qty;
      });
    } else if (action === 'reopen' || (action === 'delete' && state.status === 'Ready')) {
      indices.forEach(i => { const id = String(data[i][2]); deltas[id] = (deltas[id] || 0) + (Number(data[i][6]) || 0); });
    }
    requests.push.apply(requests, stockRequests_(deltas));
    if (action === 'delete') {
      // Never recycle a deleted order ID: late requests must not target a future order.
      const match = String(orderId).match(/^(NL-\d{4}-)(\d+)$/);
      if (match) {
        const props = PropertiesService.getScriptProperties(), key = 'sequence_' + match[1];
        props.setProperty(key, String(Math.max(Number(props.getProperty(key)) || 0, Number(match[2]))));
      }
      data.map((r, i) => i > 0 && String(r[1]).trim() === String(orderId).trim() ? i : -1).filter(i => i > 0).reverse().forEach(i => {
        requests.push({ deleteDimension: { range: { sheetId: sheet.getSheetId(), dimension: 'ROWS', startIndex: i, endIndex: i + 1 } } });
      });
      requests.push({ deleteDimension: { range: { sheetId: state.sheet.getSheetId(), dimension: 'ROWS', startIndex: state.number - 1, endIndex: state.number } } });
    } else {
      const status = { ready: 'Ready', reopen: 'New', complete: 'Completed', undo: 'Ready' }[action];
      requests.push(cellsRequest_(state.sheet, state.number, 9, [action === 'reopen' ? '' : total, status, action === 'reopen' ? '' : new Date().toISOString(), state.revision + 1]));
    }
    commitCells_(requests); // One atomic batch: no partially deducted inventory on a failed write.
    const result = { success: true, revision: state.revision + 1, fulfilledTotal: total };
    if (action === 'ready') {
      try { sendReadyNotice_(state.row, indices.map(i => ({ name: String(data[i][3]), price: Number(data[i][4]), qty: Number(fulfilled.find(f => String(f.rowId) === String(data[i][0])).qtyFulfilled) })), total, state.revision > 0); }
      catch (e) { result.warning = 'Order is Ready and inventory is saved, but the pickup email failed. Contact the group directly.'; }
    }
    if (action === 'complete') {
      // The group's receipt for its treasurer: what was actually picked up and the total paid.
      try { sendReceiptNotice_(state.row, indices.map(i => ({ name: String(data[i][3]), price: Number(data[i][4]), qty: Number(data[i][6]) || 0 })), total); }
      catch (e) { result.warning = 'Order is Completed, but the receipt email failed. Send the group a receipt another way if they need one.'; }
    }
    return result;
  });
}
function reopenOrder(orderId, token, revision) { return transitionOrder_(orderId, 'reopen', revision, null, token); }

function sendReadyNotice_(order, items, total, updated) {
  const lines = items.filter(i => i.qty > 0).map(i => '  ' + i.name + ' (x' + i.qty + ') - $' + (i.price * i.qty).toFixed(2));
  // Subcommittee orders are paid by an internal budget transfer, so there is nothing to collect at pickup.
  const payment = isSubcommitteeGroup_(order[3])
    ? '\n\nFINAL AMOUNT CHARGED TO THE H&I SUBCOMMITTEE BUDGET: $' + total.toFixed(2) + '\n\nNo payment is needed at pickup.'
    : '\n\nFINAL AMOUNT DUE AT PICKUP: $' + total.toFixed(2) + '\n\nPlease bring cash/check payment to the Lit Chair table at the area meeting. Exact change appreciated.';
  const subcommittee = isSubcommitteeGroup_(order[3]), month = meetingMonthFromOrdersCell_(order[2]);
  sendStyledMail_({ to: String(order[5]), subject: (updated ? 'Updated Literature Order Ready - ' : 'Your Literature Order is Ready - ') + String(order[3]),
    eyebrow: month + EMAIL_DOT_ + (updated ? 'Updated pickup' : 'Literature pickup'),
    headline: updated ? ['Your order', 'was updated.'] : ['We did the thing.', "It's ready."],
    lead: 'Your literature is packed and ready to go. The message is ready to carry.',
    pill: updated ? 'Updated and ready' : 'Ready for pickup',
    heading: String(order[3]), subheading: 'Order ' + String(order[0]), statusLabel: 'Packed for your group',
    itemsLabel: 'Fulfilled items',
    items: items.filter(i => i.qty > 0).map(i => ({ name: i.name, qty: i.qty, amount: i.price * i.qty })),
    band: subcommittee
      ? { label: 'Charged to H&I budget', sub: 'No payment needed at pickup', amount: total }
      : { label: 'Final amount due at pickup', sub: 'Cash or check', amount: total },
    info: { title: month + ' area meeting', text: 'Your order is at the Lit Chair table.' },
    notes: [subcommittee
      ? 'This order is charged to the H&I subcommittee budget, so no payment is needed at pickup.'
      : 'Please bring cash or check to the Lit Chair table. Exact change is appreciated.'],
    footer: ['Questions? Contact ' + getLitChairEmail() + '.', 'NORVANA Literature Committee'],
    body: 'Your literature order for the ' + meetingMonthFromOrdersCell_(order[2]) + ' area meeting is ready for pickup.\n\nGROUP: ' + String(order[3]) +
      '\n\nITEMS FULFILLED:\n' + (lines.join('\n') || 'No items fulfilled.') + payment +
      '\n\nQuestions? Contact ' + getLitChairEmail() + '\n\nNORVANA Literature Committee' });
}

// Sent when an order is marked Completed (picked up). Lists only what was actually fulfilled.
// A completed order is treated as paid in full, so the total paid is the fulfilled total.
function sendReceiptNotice_(order, items, total) {
  const got = items.filter(i => i.qty > 0);
  if (!got.length) return;
  const subcommittee = isSubcommitteeGroup_(order[3]), month = meetingMonthFromOrdersCell_(order[2]);
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const lines = got.map(i => '  ' + i.name + ' (x' + i.qty + ') - $' + (i.price * i.qty).toFixed(2)).join('\n');
  sendStyledMail_({ to: String(order[5]), subject: 'Literature Receipt - ' + String(order[3]) + ' - ' + String(order[0]),
    eyebrow: month + EMAIL_DOT_ + 'Receipt',
    headline: ['Thank you.', "Here's your receipt."],
    lead: 'Keep this for your group treasurer. It lists what your group picked up' + (subcommittee ? ' and the amount charged to the H&I budget.' : ' and what was paid.'),
    pill: subcommittee ? 'Charged to H&I budget' : 'Paid in full',
    heading: String(order[3]), subheading: 'Order ' + String(order[0]) + EMAIL_DOT_ + 'Picked up ' + date, statusLabel: 'Receipt',
    itemsLabel: 'Items received',
    items: got.map(i => ({ name: i.name, qty: i.qty, amount: i.price * i.qty })),
    band: subcommittee
      ? { label: 'Total charged to H&I budget', sub: 'No payment collected at pickup', amount: total }
      : { label: 'Total paid', sub: 'Paid at pickup', amount: total },
    notes: ['Received from NORVANA Literature Committee for the ' + month + ' area meeting.'],
    footer: ['Questions? Contact ' + getLitChairEmail() + '.', 'NORVANA Literature Committee'],
    body: 'LITERATURE RECEIPT\n\nGROUP: ' + String(order[3]) + '\nORDER: ' + String(order[0]) + '\nPICKED UP: ' + date +
      '\nAREA MEETING: ' + month + '\n\nITEMS RECEIVED:\n' + lines + '\n\n' +
      (subcommittee ? 'TOTAL CHARGED TO THE H&I SUBCOMMITTEE BUDGET: $' : 'TOTAL PAID: $') + total.toFixed(2) +
      '\n\nKeep this receipt for your group treasurer.\n\nQuestions? Contact ' + getLitChairEmail() + '\n\nNORVANA Literature Committee' });
}

function inventoryReport_(meetingMonth, token) {
  if (meetingLabelToYm_(meetingMonth) == null) throw new Error('Select a valid ordering month.');
  const orders = getOrders(meetingMonth, token).filter(o => orderMatchesReportMonth_(o.meetingMonth, meetingMonth));
  const lines = getSheet('Order Items').getDataRange().getValues(), map = {};
  getCatalogAll(token).forEach(c => { map[c.itemId] = { itemId: c.itemId, name: c.name, category: c.category, stock: c.stock, groups: [], qtyOrdered: 0, qtyFulfilled: 0, unfilled: 0, awaiting: 0 }; });
  orders.forEach(o => orderItemRowIndicesForOrder_(lines, o.orderId).forEach(i => {
    const r = lines[i], id = String(r[2]);
    const item = map[id] || (map[id] = { itemId: id, name: String(r[3]), category: 'Other', stock: null, groups: [], qtyOrdered: 0, qtyFulfilled: 0, unfilled: 0, awaiting: 0 });
    const qty = Number(r[5]) || 0, group = o.groupName.trim().toLowerCase();
    if (qty > 0 && item.groups.indexOf(group) < 0) item.groups.push(group);
    item.qtyOrdered += qty;
    if (o.status === 'New') item.awaiting += qty;
    else { const fulfilled = Number(r[6]) || 0; item.qtyFulfilled += fulfilled; item.unfilled += Math.max(0, qty - fulfilled); }
  }));
  return { meetingMonth: meetingMonth, stockAsOf: new Date().toISOString(), items: Object.values(map).map(i => ({ ...i, groups: i.groups.length })).sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)) };
}
function getInventoryReport(meetingMonth, token) { return withWorkflowLock_(token, () => inventoryReport_(meetingMonth, token)); }

// Reporting reads share the mutation lock so order totals and line quantities agree.
function getStockReport(token) {
  return withWorkflowLock_(token, () => ({ stockAsOf: new Date().toISOString(),
    items: getCatalogAll(token).map(i => ({ itemId: i.itemId, category: i.category, name: i.name, stock: i.stock }))
      .sort((a,b) => a.name.localeCompare(b.name)) }));
}
function getOrdersReport(period, selection, group, token) {
  return withWorkflowLock_(token, function() {
    const annual = period === 'annual', ym = meetingLabelToYm_(selection);
    if ((!annual && (period !== 'monthly' || ym == null)) || (annual && !/^\d{4}$/.test(String(selection)))) throw new Error('Select a valid period.');
    const year = annual ? Number(selection) : Math.floor(ym / 12);
    const all = getOrders('', token), seen = new Set();
    const inPeriod = all.filter(o => {
      const key = String(o.orderId).trim(), month = meetingLabelToYm_(o.meetingMonth);
      if (month == null || (annual ? Math.floor(month / 12) !== year : month !== ym) || seen.has(key)) return false;
      seen.add(key); return true;
    });
    const groupKey = name => String(name || '').trim().toLowerCase();
    const groupNames = new Map();
    inPeriod.forEach(o => groupNames.set(groupKey(o.groupName), o.groupName.trim()));
    const groups = Array.from(groupNames.values()).sort((a,b) => a.localeCompare(b));
    const selected = inPeriod.filter(o => !group || groupKey(o.groupName) === groupKey(group));
    const lines = getSheet('Order Items').getDataRange().getValues();
    const catalog = getCatalogMap_(), itemMap = new Map(), groupMap = new Map();
    const empty = () => ({ orderCount: 0, requested: 0, fulfilled: 0, estimated: 0, collected: 0, charged: 0, pending: 0 });
    const totals = empty(), months = Array.from({length:12}, (_,i) => ({ month: monthLabel_(year * 12 + i), ...empty() }));
    const add = (target, row) => {
      ['orderCount','requested','fulfilled'].forEach(k => target[k] += row[k]);
      ['estimated','collected','charged','pending'].forEach(k => target[k] = Math.round((target[k] + row[k]) * 100) / 100);
    };
    const orders = selected.map(o => {
      const result = { orderId: o.orderId, groupName: groupNames.get(groupKey(o.groupName)), status: o.status,
        orderCount: 1, requested: 0, fulfilled: 0, estimated: o.estimatedTotal,
        // Subcommittee orders are charged to a budget, not collected as cash at pickup.
        collected: o.status === 'Completed' && !isSubcommitteeGroup_(o.groupName) ? o.fulfilledTotal : 0,
        charged: o.status === 'Completed' && isSubcommitteeGroup_(o.groupName) ? o.fulfilledTotal : 0,
        pending: o.status === 'Completed' ? 0 : o.status === 'Ready' ? o.fulfilledTotal : o.estimatedTotal,
        amount: o.status === 'New' ? o.estimatedTotal : o.fulfilledTotal };
      const seenLines = new Set();
      orderItemRowIndicesForOrder_(lines, String(o.orderId).trim()).forEach(i => {
        const r = lines[i], lineId = String(r[0]).trim();
        if (seenLines.has(lineId)) return;
        seenLines.add(lineId);
        const id = String(r[2]), requested = Number(r[5]) || 0;
        const fulfilled = o.status === 'Ready' || o.status === 'Completed' ? Number(r[6]) || 0 : 0;
        const item = itemMap.get(id) || { itemId: id, name: catalog[id] ? catalog[id].name : String(r[3]), requested: 0, fulfilled: 0, estimated: 0, fulfilledValue: 0 };
        item.requested += requested; item.fulfilled += fulfilled;
        item.estimated = Math.round((item.estimated + Math.round(requested * Number(r[4]) * 100) / 100) * 100) / 100;
        item.fulfilledValue = Math.round((item.fulfilledValue + Math.round(fulfilled * Number(r[4]) * 100) / 100) * 100) / 100;
        itemMap.set(id,item); result.requested += requested; result.fulfilled += fulfilled;
      });
      const key = groupKey(o.groupName), summary = groupMap.get(key) || { groupName: result.groupName, ...empty() };
      add(summary,result); groupMap.set(key,summary); add(totals,result);
      add(months[meetingLabelToYm_(o.meetingMonth) % 12],result);
      return result;
    });
    return { period: period, selection: annual ? String(year) : monthLabel_(ym), group: group || '', groups: groups,
      totals: totals, orders: orders, byGroup: Array.from(groupMap.values()).sort((a,b) => a.groupName.localeCompare(b.groupName)),
      items: Array.from(itemMap.values()).sort((a,b) => a.name.localeCompare(b.name)), months: annual ? months : [] };
  });
}
