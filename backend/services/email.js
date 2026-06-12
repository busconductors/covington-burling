const { Resend } = require('resend');
const config = require('../config');

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
    adminMsgHtml = '<div style="background:#F0F4F8;border:1px solid #C5D3E8;border-radius:6px;padding:16px;margin:0 0 20px;"><p style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:#0A1628;line-height:1.6;margin:0;font-style:italic;">' + adminMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p></div>';
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
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;margin:0;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1919</p>
    <hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Legal Forms Are Ready</p>
    ${adminMsgHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ${toName},</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Your request for the following legal form(s) has been approved:</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#0A1628;font-weight:600;margin:0 0 20px;">${formLabel}</p>
    ${linksHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">These links will expire in 7 days. If you have any questions, please contact our office at <a href="tel:+12026626000" style="color:#B08D57;">202-662-6000</a>.</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:12px 0 0;">After completing your form(s), email them to <a href="mailto:info@carlingtonburling.com" style="color:#B08D57;">info@carlingtonburling.com</a> or deliver to 850 Tenth Street NW, Washington, DC 20001.</p>
  </td></tr>
  <tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Carlington &amp; Burling LLP, 850 Tenth Street NW, Washington, DC 20001. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>
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
    '<p style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;margin:0;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1919</p>' +
    '<hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">' +
    '</td></tr>' +
    '<tr><td style="padding:40px;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Form Request Has Been Declined</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ' + toName + ',</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Thank you for your interest in Carlington &amp; Burling LLP. After careful review, we are unable to provide the requested forms at this time.</p>' +
    '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:16px;margin:16px 0;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:13px;color:#991B1B;margin:0;font-weight:600;">Reason:</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#1F1F2E;line-height:1.6;margin:4px 0 0;">' + reason.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' +
    '</div>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">If you have any questions, please contact our office at <a href="tel:+12026626000" style="color:#B08D57;">202-662-6000</a> or email us at <a href="mailto:info@carlingtonburling.com" style="color:#B08D57;">info@carlingtonburling.com</a>.</p>' +
    '</td></tr>' +
    '<tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Carlington &amp; Burling LLP, 850 Tenth Street NW, Washington, DC 20001. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>' +
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
function emailHeader() {
  return '<td style="padding:36px 40px 0;text-align:center;">'
    + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:24px;font-weight:bold;color:#0A1628;letter-spacing:0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling</div>'
    + '<hr style="border:none;border-top:1px solid #B08D57;margin:14px 80px 10px;">'
    + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1919</div>'
    + '<hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">'
    + '</td></tr>';
}

function emailFooter() {
  return '<td style="background-color:#FAF9F6;padding:26px 40px 30px;border-top:1px solid #E4E0D8;text-align:center;font-family:Arial,Helvetica,sans-serif;">'
    + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;font-weight:bold;color:#0A1628;letter-spacing:0.3px;">Carlington &amp; Burling LLP</div>'
    + '<div style="font-size:12px;color:#5A6577;margin-top:8px;line-height:1.6;">850 Tenth Street NW, Washington, DC 20001<br>'
    + '202&#8209;662&#8209;6000 &nbsp;|&nbsp; <a href="https://carlingtonburling.com" style="color:#B08D57;text-decoration:none;">carlingtonburling.com</a></div>'
    + '<div style="font-size:10px;color:#9AA3B2;margin-top:12px;letter-spacing:0.5px;text-transform:uppercase;">'
    + 'SINCE 1919 &nbsp;&#183;&nbsp; This message is confidential &amp; attorney&#8209;client privileged</div>'
    + '</td>';
}

function buildEmailLayout(headerHtml, bodyHtml) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background-color:#ECECEC;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECECEC;padding:24px 0;">'
    + '<tr><td align="center">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:6px;overflow:hidden;">'
    + '<tr>' + headerHtml + '</tr>'
    + '<tr><td style="padding:34px 40px;font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;line-height:1.7;color:#1A1A1A;">' + bodyHtml + '</td></tr>'
    + '<tr>' + emailFooter() + '</tr>'
    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

function buildEmailHtml(body) {
  var escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  var bodyHtml = escaped
    .split(/\n\n+/)
    .map(function (p) {
      var t = p.trim();
      if (!t) return '';
      return '<p style="margin:0 0 16px;">' + t.replace(/\n/g, '<br>') + '</p>';
    })
    .join('');

  return buildEmailLayout(emailHeader(), bodyHtml);
}

function sendComposedEmail(toEmail, subject, body, attachment) {
  if (!resend) {
    return Promise.reject(new Error('Email service not configured'));
  }
  var emailPayload = {
    from: 'Carlington & Burling LLP <' + config.resendSender + '>',
    to: [toEmail],
    subject: subject,
    html: buildEmailHtml(body),
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
  buildEmailHtml,
  isConfigured,
};
