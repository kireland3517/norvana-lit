// Run this function once from the Apps Script editor to authorize MailApp permissions.
// It only checks the remaining email quota, which triggers the permission prompt.
// It sends NO email, so it is harmless even though any visitor could call it.
function authorizeMailApp() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp is authorized. Emails left today: ' + remaining);
}

// Run once from the Apps Script editor to check the Lit Chair inbox delivery. It asks for the Gmail permission,
// puts one small test message in this account's inbox (not Sent), and shows the error if that is not possible.
// It sends no email.
function testChairInboxInsert() {
  const me = Session.getEffectiveUser().getEmail();
  Logger.log('Script runs as: ' + me);
  Logger.log('Lit Chair email in Config: ' + getLitChairEmail());
  const mime = ['From: ' + me, 'To: ' + me, 'Subject: Inbox insert test', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', 'If you see this in the Inbox and not in Sent, inserting works.'].join('\r\n');
  Gmail.Users.Messages.insert({ raw: Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8), labelIds: ['INBOX', 'UNREAD'] }, 'me');
  Logger.log('Inserted. Check the Inbox.');
}
