module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  inboxSender: process.env.INBOX_SENDER || 'Max Theodore <maxtheodore@carlingtonburling.com>',
  mailgunWebhookKey: process.env.MAILGUN_WEBHOOK_KEY || '',
  mailgunDomain: process.env.MAILGUN_DOMAIN || '',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  port: process.env.PORT || 3000,
};
