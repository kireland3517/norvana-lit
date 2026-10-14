// Separate report records preserve finalized snapshots without changing order data.
const CHAIR_HEADERS_ = ['Presentation Month', 'Draft JSON', 'Finalized JSON', 'Revision', 'Email Attempt JSON'];
function chairStore_() {
  const sheet = getSheet('Chair Reports');
  if (!sheet) throw new Error('Create the Chair Reports tab described in HANDOFF.md before saving reports.');
  const data = sheet.getDataRange().getValues();
  if (!CHAIR_HEADERS_.every((h,i) => i === 0 ? ['Presentation Month', 'Reporting Month'].includes(data[0][i]) : data[0][i] === h)) throw new Error('Chair Reports headers do not match the Sheet layout in HANDOFF.md.');
  return { sheet: sheet, data: data };
}
function monthLabel_(ym) {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[((ym % 12) + 12) % 12] + ' ' + Math.floor(ym / 12);
}
function chairFigures_(reportingMonth, token) {
  const ym = meetingLabelToYm_(reportingMonth);
  if (ym == null) throw new Error('Select a reporting month.');
  const month = monthLabel_(ym);
  const completed = getOrders(month, token).filter(o => o.status === 'Completed' && orderMatchesReportMonth_(o.meetingMonth, month));
  const total = list => Math.round(list.reduce((sum,o) => sum + o.fulfilledTotal, 0) * 100) / 100;
  // Subcommittee orders are charged to its budget, so they are reported apart from cash collected.
  return { reportingMonth: month,
    groupsServed: new Set(completed.map(o => o.groupName.trim().toLowerCase())).size,
    moneyCollected: total(completed.filter(o => !isSubcommitteeGroup_(o.groupName))),
    hiCharged: total(completed.filter(o => isSubcommitteeGroup_(o.groupName))) };
}
// Saved JSON owns the association; old column A keys must never shift a saved report.
function chairRowMonth_(row, header) {
  const draft = row[1] ? JSON.parse(row[1]) : null, final = row[2] ? JSON.parse(row[2]) : null;
  const d = draft && meetingLabelToYm_(draft.reportingMonth), f = final && meetingLabelToYm_(final.reportingMonth);
  if (d != null && f != null && d !== f) throw new Error('Chair Report draft and final have conflicting reporting months. Review the saved record.');
  if (f != null) return monthLabel_(f);
  if (d != null) return monthLabel_(d);
  const key = meetingLabelToYm_(row[0]);
  return key == null ? '' : monthLabel_(key - (header === 'Presentation Month' ? 1 : 0));
}
function chairRecord_(reportingMonth) {
  const ym = meetingLabelToYm_(reportingMonth);
  if (ym == null) throw new Error('Select a reporting month.');
  const month = monthLabel_(ym), store = chairStore_();
  const matches = store.data.map((r,n) => n > 0 && chairRowMonth_(r,store.data[0][0]) === month ? n : -1).filter(n => n > 0);
  if (matches.length > 1) throw new Error('Multiple Chair Reports exist for this reporting month. Review the saved records before editing.');
  const i = matches.length ? matches[0] : -1, row = i < 0 ? [] : store.data[i];
  return { sheet: store.sheet, number: i < 0 ? store.data.length + 1 : i + 1, storageKey: i < 0 ? month : row[0],
    draft: row[1] ? JSON.parse(row[1]) : null, finalized: row[2] ? JSON.parse(row[2]) : null,
    revision: Number(row[3]) || 0, email: row[4] ? JSON.parse(row[4]) : null };
}
function getChairReport(reportingMonth, token) {
  return withWorkflowLock_(token, function() {
    const live = chairFigures_(reportingMonth, token);
    const rec = chairRecord_(live.reportingMonth);
    return { success: true, draft: rec.draft || { ...live, moneySpent: 0, other: '' }, live: live,
      finalized: rec.finalized, revision: rec.revision, secretaryEmail: getSettings(token).secretaryEmail,
      email: chairEmailState_(rec.email) };
  });
}
function saveChairDraft(reportingMonth, spending, notes, revision, token) {
  return withWorkflowLock_(token, function() {
    const live = chairFigures_(reportingMonth, token), rec = chairRecord_(live.reportingMonth);
    if (revision !== rec.revision) throw new Error('Report changed. Reload before saving.');
    if (spending === '' || !Number.isFinite(Number(spending)) || Number(spending) < 0) throw new Error('Enter a non-negative spending amount.');
    if (String(notes).length > 10000) throw new Error('Keep notes under 10,000 characters.');
    const draft = { ...live, moneySpent: Math.round(Number(spending) * 100) / 100, other: String(notes || ''), savedAt: new Date().toISOString() };
    commitCells_([cellsRequest_(rec.sheet, rec.number, 1, [rec.storageKey, JSON.stringify(draft), rec.finalized ? JSON.stringify(rec.finalized) : '', rec.revision + 1])]);
    return { success: true };
  });
}
function finalizeChairReport(reportingMonth, revision, replaceFinalized, token) {
  return withWorkflowLock_(token, function() {
    const rec = chairRecord_(reportingMonth);
    if (revision !== rec.revision) throw new Error('Report changed. Reload before finalizing.');
    if (!rec.draft) throw new Error('Save and review the draft first.');
    if (rec.finalized && replaceFinalized !== true) throw new Error('Explicitly update the finalized report.');
    const snapshot = { ...rec.draft, finalizedAt: new Date().toISOString(), version: rec.revision + 1 };
    commitCells_([cellsRequest_(rec.sheet, rec.number, 3, [JSON.stringify(snapshot), rec.revision + 1])]);
    return { success: true };
  });
}
function chairReportText_(report) {
  return 'NORVANA Chair Report\nReporting month: ' + report.reportingMonth +
    '\nFinalized (version ' + report.version + ')\n\nGroups Served: ' + report.groupsServed +
    '\nCollected: $' + report.moneyCollected.toFixed(2) +
    (typeof report.hiCharged === 'number' ? '\nH&I charged to subcommittee budget: $' + report.hiCharged.toFixed(2) : '') +
    '\nSpent: $' + report.moneySpent.toFixed(2) +
    '\nNotes: ' + (report.other || 'None');
}
// Email state is independent of the report revision. Legacy records remain readable.
function chairEmailState_(email) {
  if (!email) return null;
  const status = email.status === 'sent' ? 'accepted' :
    (email.status === 'attempted' || email.status === 'sending' ? 'uncertain' : email.status);
  return { ...email, status: status };
}
function chairEmailMarker_(email) { return email ? JSON.stringify(email) : ''; }
function chairEmailAction_(email) {
  const state = chairEmailState_(email);
  return !state ? 'send' : state.status === 'accepted' ? 'resend' : 'retry';
}
function previewChairEmail(reportingMonth, token) {
  return withWorkflowLock_(token, function() {
    const rec = chairRecord_(reportingMonth);
    if (!rec.finalized) throw new Error('Finalize and review the report first.');
    const recipient = getSettings(token).secretaryEmail;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Set Secretary Email in Settings first.');
    const preview = { reportingMonthContract: true, month: rec.finalized.reportingMonth, version: rec.finalized.version, recipient: recipient,
      subject: demoPrefix_() + 'NORVANA Chair Report - ' + rec.finalized.reportingMonth, body: chairReportText_(rec.finalized), token: token,
      previousAttempt: chairEmailMarker_(rec.email), action: chairEmailAction_(rec.email) };
    const id = Utilities.getUuid();
    CacheService.getScriptCache().put('chair_preview_' + id, JSON.stringify(preview), 600);
    return { success: true, previewId: id, recipient: recipient, subject: preview.subject, body: preview.body,
      action: preview.action, previousEmail: chairEmailState_(rec.email) };
  });
}
function sendChairReport(previewId, token, confirmedAction) {
  return withWorkflowLock_(token, function() {
    const raw = CacheService.getScriptCache().get('chair_preview_' + previewId);
    if (!raw) throw new Error('Preview expired. Review the report again.');
    const preview = JSON.parse(raw);
    if (!preview.reportingMonthContract) throw new Error('Review a fresh email preview.');
    const rec = chairRecord_(preview.month);
    if (preview.token !== token || !rec.finalized || rec.finalized.version !== preview.version || getSettings(token).secretaryEmail !== preview.recipient) throw new Error('Report or recipient changed. Review a fresh preview.');
    // A preview authorizes one attempt against the email state actually reviewed.
    // Different tabs/previews also compete against the same persisted state.
    if (preview.previousAttempt !== chairEmailMarker_(rec.email)) throw new Error('Email status changed or this send was already attempted. Reload and review before an explicit retry or resend.');
    if (confirmedAction !== preview.action) throw new Error('Review the recipient and report, then explicitly confirm ' + preview.action + '.');
    const prior = chairEmailState_(rec.email);
    const attempt = { attemptId: previewId, version: preview.version, recipient: preview.recipient,
      at: new Date().toISOString(), status: 'sending',
      lastAccepted: prior && (prior.status === 'accepted' ? { at: prior.acceptedAt || prior.at, recipient: prior.recipient, version: prior.version } : prior.lastAccepted) || null };
    // Persist the claim before MailApp. Never send if this write fails or its outcome is unknown.
    try { commitCells_([cellsRequest_(rec.sheet, rec.number, 5, [JSON.stringify(attempt)])]); }
    catch (e) { return { success: false, error: 'Could not record the send attempt. This request did not call the email service. Reload and review before Retry Send.' }; }
    let calledMail = false;
    try {
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No daily email quota remains.');
      calledMail = true;
      MailApp.sendEmail({ to: preview.recipient, subject: preview.subject, body: preview.body });
    } catch (e) {
      // MailApp exceptions do not provide a reliable non-delivery guarantee.
      attempt.status = calledMail ? 'uncertain' : 'failed';
      attempt.message = calledMail ? 'Sending failed or could not be confirmed. The email may have sent. Check sent mail before explicitly choosing Retry Send.' :
        'Send failed before contacting the email service. Check email authorization and available quota, then choose Retry Send.';
      try { commitCells_([cellsRequest_(rec.sheet, rec.number, 5, [JSON.stringify(attempt)])]); }
      catch (writeError) { /* The persisted sending claim will be displayed as uncertain. */ }
      return { success: false, error: attempt.message, email: attempt };
    }
    attempt.status = 'accepted'; attempt.acceptedAt = new Date().toISOString();
    attempt.lastAccepted = { at: attempt.acceptedAt, recipient: attempt.recipient, version: attempt.version };
    try { commitCells_([cellsRequest_(rec.sheet, rec.number, 5, [JSON.stringify(attempt)])]); }
    catch (e) { return { success: false, error: 'The email service accepted the message for sending, but saving its status was unconfirmed. Check sent mail before explicitly retrying. Delivery is not confirmed.' }; }
    return { success: true, email: attempt, message: 'Accepted for sending. Delivery is not confirmed.' };
  });
}
