module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  port: process.env.PORT || 3000,
};
