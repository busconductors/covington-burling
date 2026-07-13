module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  inboxSender: process.env.INBOX_SENDER || 'Max Theodore <maxtheodore@carlingtonburling.com>',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  inboundSecret: process.env.INBOUND_SECRET || '',
  port: process.env.PORT || 3000,
};
