// Run this function once to authorize MailApp permissions
function authorizeMailApp() {
  MailApp.sendEmail({
    to: 'norvanalit12@gmail.com',
    subject: 'NORVANA System - Permission Test',
    body: 'This is a test email to authorize the NORVANA Literature Orders System to send emails. You can ignore this message.'
  });
  Logger.log('Email sent successfully - MailApp is authorized');
}