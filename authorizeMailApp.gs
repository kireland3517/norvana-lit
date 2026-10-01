// Run this function once from the Apps Script editor to authorize MailApp permissions.
// It only checks the remaining email quota, which triggers the permission prompt.
// It sends NO email, so it is harmless even though any visitor could call it.
function authorizeMailApp() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log('MailApp is authorized. Emails left today: ' + remaining);
}
