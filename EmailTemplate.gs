// Shared look for the order emails (confirmation, Lit Chair alert, pickup notice, receipt): the app's blue header bar,
// a blue headline section, a white order section, a lime total band and a pale footer.
// Every email still carries its plain-text version; this adds a styled HTML version on top.
// The logo is a small PNG stored right here and attached inline, so nothing is hosted elsewhere and no
// extra Google permission is needed. All helpers end with an underscore so visitors cannot call them.
// (The Secretary report email stays plain on purpose: the reviewed preview must match what is sent.)

const EMAIL_BLUE_ = '#2e3192';
const EMAIL_LIME_ = '#E2EF70';
const EMAIL_LIME_DARK_ = '#c8d455';
const EMAIL_INK_ = '#1a1a3e';
const EMAIL_MUTED_ = '#5d6190';
const EMAIL_LINE_ = '#e4e6f4';
const EMAIL_PALE_ = '#f1f2fa';
const EMAIL_DOT_ = ' ' + String.fromCharCode(183) + ' ';
const EMAIL_FONT_ = "'Trebuchet MS',Arial,Helvetica,sans-serif";
const EMAIL_LOGO_B64_ = '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';

function emailEsc_(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function emailMoney_(n) { return '$' + (Number(n) || 0).toFixed(2); }

// o: { eyebrow, headline: [line, line], lead, pill,
//      heading, subheading, statusLabel, contact: {label, name, detail},
//      itemsLabel, items: [{id, name, qty, amount}],
//      band: {label, sub, amount}, info: {title, text}, callout: {label, text},
//      notes: [text], footer: [text] }
function emailHtml_(o) {
  const F = EMAIL_FONT_;
  const small = extra => 'font:bold 11px ' + F + ';letter-spacing:0.14em;text-transform:uppercase;color:' + EMAIL_BLUE_ + ';' + (extra || '');
  let html = '';

  // Header: the same blue bar as the app (white logo, committee name, small subtitle), then a blue hero with the headline.
  html += '<tr><td bgcolor="' + EMAIL_BLUE_ + '" style="background:' + EMAIL_BLUE_ + ';padding:14px 18px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:12px"><img src="cid:norvanalogo" width="34" height="34" alt="NA" style="display:block;border:0"></td>' +
    '<td><div style="font:bold 17px ' + F + ';color:#ffffff">NORVANA Literature Committee</div>' +
    '<div style="margin-top:2px;font:10px ' + F + ';letter-spacing:0.06em;text-transform:uppercase;color:#a9abd6">Literature Orders</div></td></tr></table></td></tr>' +
    '<tr><td bgcolor="' + EMAIL_BLUE_ + '" style="background:' + EMAIL_BLUE_ + ';padding:30px 28px 34px 28px;border-top:1px solid #4a4fb5;border-bottom:2px dashed ' + EMAIL_LIME_ + '">' +
    '<div style="' + small('color:' + EMAIL_LIME_ + ';') + '">' + emailEsc_(o.eyebrow) + '</div>' +
    '<h1 style="margin:14px 0 16px 0;font:bold 44px/1.02 ' + F + ';letter-spacing:-1.5px;color:#ffffff">' + (o.headline || []).map(emailEsc_).join('<br>') + '</h1>' +
    '<p style="margin:0 0 22px 0;max-width:430px;font:16px/1.55 ' + F + ';color:#e8eaf6">' + emailEsc_(o.lead) + '</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="' + EMAIL_LIME_ + '" style="background:' + EMAIL_LIME_ + ';border-radius:20px;padding:10px 18px;font:bold 13px ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.pill) + '</td></tr></table>' +
    '</td></tr>';

  // Order section (white).
  let body = '';
  body += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font:bold 18px ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.heading) +
    (o.subheading ? '<div style="margin-top:4px;font:14px ' + F + ';color:' + EMAIL_MUTED_ + '">' + emailEsc_(o.subheading) + '</div>' : '') + '</td>' +
    (o.statusLabel ? '<td align="right" valign="top" style="width:130px;' + small('line-height:1.6;color:' + EMAIL_MUTED_ + ';') + '">' + emailEsc_(o.statusLabel) + '</td>' : '') +
    '</tr></table>';

  if (o.contact) {
    body += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0"><tr><td bgcolor="' + EMAIL_PALE_ + '" style="background:' + EMAIL_PALE_ + ';border-radius:14px;padding:16px 18px">' +
      '<div style="' + small() + '">' + emailEsc_(o.contact.label) + '</div>' +
      '<div style="margin-top:6px;font:bold 18px ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.contact.name) + '</div>' +
      '<div style="margin-top:4px;font:14px ' + F + ';color:' + EMAIL_MUTED_ + '">' + emailEsc_(o.contact.detail) + '</div></td></tr></table>';
  }

  if (o.items) {
    const th = (t, align) => '<td align="' + align + '" style="padding:22px 0 10px 0;border-bottom:1px solid ' + EMAIL_LINE_ + ';' + small('color:' + EMAIL_MUTED_ + ';') + '">' + t + '</td>';
    const td = (t, align, extra) => '<td align="' + align + '" style="padding:12px 0;border-bottom:1px solid ' + EMAIL_LINE_ + ';font:14px ' + F + ';color:' + EMAIL_INK_ + ';' + (extra || '') + '">' + t + '</td>';
    body += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>' +
      th(emailEsc_(o.itemsLabel || 'Items'), 'left') + th('Qty', 'right') + th('Amount', 'right') + '</tr>';
    if (!o.items.length) body += '<tr>' + td('No items fulfilled.', 'left', 'color:' + EMAIL_MUTED_ + ';') + td('', 'right') + td('', 'right') + '</tr>';
    o.items.forEach(i => {
      body += '<tr>' + td((i.id ? '<span style="color:' + EMAIL_MUTED_ + ';font-size:12px">' + emailEsc_(i.id) + '</span>&nbsp; ' : '') + emailEsc_(i.name), 'left') +
        td(emailEsc_(i.qty), 'right', 'width:50px;') + td(emailMoney_(i.amount), 'right', 'width:90px;') + '</tr>';
    });
    body += '</table>';
  }

  if (o.callout) {
    body += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0"><tr><td bgcolor="#eeeffe" style="background:#eeeffe;border-left:4px solid ' + EMAIL_BLUE_ + ';padding:12px 14px">' +
      '<div style="' + small('margin-bottom:4px;') + '">' + emailEsc_(o.callout.label) + '</div>' +
      '<div style="font:14px/1.5 ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.callout.text) + '</div></td></tr></table>';
  }
  html += '<tr><td style="padding:26px 28px 24px 28px">' + body + '</td></tr>';

  // Total band: lime with the amount in blue.
  if (o.band) {
    html += '<tr><td bgcolor="' + EMAIL_LIME_ + '" style="background:' + EMAIL_LIME_ + ';padding:22px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="font:bold 15px/1.4 ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.band.label) +
      (o.band.sub ? '<div style="font:13px ' + F + ';color:#4a4d7a">' + emailEsc_(o.band.sub) + '</div>' : '') + '</td>' +
      '<td align="right" style="font:bold 38px ' + F + ';color:' + EMAIL_BLUE_ + '">' + emailMoney_(o.band.amount) + '</td></tr></table></td></tr>';
  }

  // Notes under the band.
  let notes = '';
  if (o.info) notes += '<div style="margin:0 0 12px 0;font:bold 15px ' + F + ';color:' + EMAIL_INK_ + '">' + emailEsc_(o.info.title) +
    '<div style="font:14px ' + F + ';color:' + EMAIL_MUTED_ + '">' + emailEsc_(o.info.text) + '</div></div>';
  (o.notes || []).forEach(t => { notes += '<p style="margin:0 0 8px 0;font:14px/1.6 ' + F + ';color:' + EMAIL_MUTED_ + '">' + emailEsc_(t) + '</p>'; });
  if (notes) html += '<tr><td style="padding:22px 28px 22px 28px">' + notes + '</td></tr>';

  // Footer.
  html += '<tr><td align="center" bgcolor="' + EMAIL_PALE_ + '" style="background:' + EMAIL_PALE_ + ';padding:22px 28px;font:14px/1.6 ' + F + ';color:' + EMAIL_MUTED_ + '">' +
    (o.footer || []).map((t, i) => i ? '<div style="font-size:11px;letter-spacing:0.06em">' + emailEsc_(t) + '</div>' : '<div>' + emailEsc_(t) + '</div>').join('') + '</td></tr>';

  return '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#e9ebf7">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9ebf7"><tr><td align="center" style="padding:20px 10px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border-collapse:separate">' +
    html + '</table></td></tr></table></body></html>';
}

// opts: everything MailApp needs (to, subject, body) plus the template fields above.
function sendStyledMail_(opts) {
  const message = { to: opts.to, subject: demoPrefix_() + opts.subject, body: opts.body };
  try {
    message.htmlBody = emailHtml_(opts);
    message.inlineImages = { norvanalogo: Utilities.newBlob(Utilities.base64Decode(EMAIL_LOGO_B64_), 'image/png', 'norvana-logo.png') };
  } catch (e) {
    // Styling must never stop an email: fall back to the plain-text message alone.
    delete message.htmlBody; delete message.inlineImages;
  }
  MailApp.sendEmail(message);
}
