const { Resend } = require('resend');
const config = require('../config');
// Single source of truth for the branded shell — the same file the admin
// preview executes in the browser. See public/js/email-templates.js.
const templates = require('../../public/js/email-templates.js');

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

// ── Approval email ────────────────────────────────────────────────────
function sendResendEmail(toEmail, toName, formType, downloadToken, adminMessage) {
  if (!resend) {
    console.error('RESEND_API_KEY not configured');
    return Promise.reject(new Error('Email service not configured'));
  }

  const formLabel = formType === 'waiver' ? 'Waiver and Release of Liability'
    : formType === 'nda' ? 'Mutual Non-Disclosure Agreement'
    : 'Waiver and Release of Liability + Mutual Non-Disclosure Agreement';

  const baseUrl = config.siteUrl;
  const waiverLink = formType === 'waiver' || formType === 'both'
    ? `${baseUrl}/api/download/${downloadToken}?form=waiver` : null;
  const ndaLink = formType === 'nda' || formType === 'both'
    ? `${baseUrl}/api/download/${downloadToken}?form=nda` : null;

  let linksHtml = '';
  if (waiverLink) linksHtml += `<p><a href="${waiverLink}" style="color:#B08D57;font-weight:600;">Download Waiver and Release of Liability</a></p>`;
  if (ndaLink) linksHtml += `<p><a href="${ndaLink}" style="color:#B08D57;font-weight:600;">Download Mutual Non-Disclosure Agreement</a></p>`;

  var adminMsgHtml = '';
  if (adminMessage) {
    adminMsgHtml = '<div style="background:#F0F4F8;border:1px solid #C5D3E8;border-radius:6px;padding:16px;margin:0 0 20px;"><p style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:#0A1628;line-height:1.6;margin:0;font-style:italic;">' + templates.escapeHtml(adminMessage).replace(/\n/g, '<br>') + '</p></div>';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #D5D5DE;border-radius:4px;">
  <tr><td style="padding:36px 40px 0;text-align:center;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#0A1628;margin:0;letter-spacing:0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling</p>
    <hr style="border:none;border-top:1px solid #B08D57;margin:14px 80px 10px;">
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;margin:0;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1927</p>
    <hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Legal Forms Are Ready</p>
    ${adminMsgHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ${templates.escapeHtml(toName)},</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Your request for the following legal form(s) has been approved:</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#0A1628;font-weight:600;margin:0 0 20px;">${formLabel}</p>
    ${linksHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">These links will expire in 7 days. If you have any questions, please contact our office at <a href="tel:+12025550142" style="color:#B08D57;">202-555-0142</a>.</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:12px 0 0;">After completing your form(s), email them to <a href="mailto:info@carlingtonburling.com" style="color:#B08D57;">info@carlingtonburling.com</a> or deliver to 1450 Meridian Hill Lane NW, Washington, DC 20009.</p>
  </td></tr>
  <tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Carlington &amp; Burling LLP, 1450 Meridian Hill Lane NW, Washington, DC 20009. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return resend.emails.send({
    from: 'Carlington & Burling LLP <' + config.resendSender + '>',
    to: [toEmail],
    subject: 'Your Carlington & Burling Legal Forms Are Ready',
    html: html,
  });
}

// ── Rejection email ───────────────────────────────────────────────────
function sendResendRejectionEmail(toEmail, toName, reason) {
  if (!resend) {
    console.error('RESEND_API_KEY not configured');
    return Promise.reject(new Error('Email service not configured'));
  }

  var html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:40px 0;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #D5D5DE;border-radius:4px;">' +
    '<tr><td style="padding:36px 40px 0;text-align:center;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:24px;font-weight:600;color:#0A1628;margin:0;letter-spacing:0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling</p>' +
    '<hr style="border:none;border-top:1px solid #B08D57;margin:14px 80px 10px;">' +
    '<p style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;margin:0;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1927</p>' +
    '<hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">' +
    '</td></tr>' +
    '<tr><td style="padding:40px;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Form Request Has Been Declined</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ' + templates.escapeHtml(toName) + ',</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Thank you for your interest in Carlington &amp; Burling LLP. After careful review, we are unable to provide the requested forms at this time.</p>' +
    '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:16px;margin:16px 0;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:13px;color:#991B1B;margin:0;font-weight:600;">Reason:</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#1F1F2E;line-height:1.6;margin:4px 0 0;">' + templates.escapeHtml(reason) + '</p>' +
    '</div>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">If you have any questions, please contact our office at <a href="tel:+12025550142" style="color:#B08D57;">202-555-0142</a> or email us at <a href="mailto:info@carlingtonburling.com" style="color:#B08D57;">info@carlingtonburling.com</a>.</p>' +
    '</td></tr>' +
    '<tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Carlington &amp; Burling LLP, 1450 Meridian Hill Lane NW, Washington, DC 20009. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '</table>' +
    '</body>' +
    '</html>';

  return resend.emails.send({
    from: 'Carlington & Burling LLP <' + config.resendSender + '>',
    to: [toEmail],
    subject: 'Your form request has been declined',
    html: html,
  });
}

// ── Composer email (admin send-email) ─────────────────────────────────
// The branded shell lives in the shared dual-mode module so the admin
// preview is identical to the sent email by construction.
function sendComposedEmail(toEmail, subject, body, attachment) {
  if (!resend) {
    return Promise.reject(new Error('Email service not configured'));
  }
  var emailPayload = {
    from: 'Carlington & Burling LLP <' + config.resendSender + '>',
    to: [toEmail],
    subject: subject,
    html: templates.buildEmailHtml(body),
  };
  if (attachment && attachment.name && attachment.content) {
    emailPayload.attachments = [{ filename: attachment.name, content: attachment.content }];
  }
  return resend.emails.send(emailPayload);
}

function isConfigured() {
  return !!resend;
}

module.exports = {
  sendResendEmail,
  sendResendRejectionEmail,
  sendComposedEmail,
  isConfigured,
};
