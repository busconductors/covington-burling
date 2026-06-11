const express = require('express');
const cors = require('cors');
const PdfPrinter = require('pdfmake');
const crypto = require('crypto');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { Resend } = require('resend');

// ── Config from environment ──────────────────────────────────────────
const config = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  port: process.env.PORT || 3000,
};

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

// ── Neon Postgres init ───────────────────────────────────────────────
let sql = null;

function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
    sql = neon(process.env.DATABASE_URL);
    console.log('Neon: initialized');
  }
  return sql;
}

// ── PDF setup ────────────────────────────────────────────────────────
const fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);
const waiverDefinition = require('./waiver-definition');
const ndaDefinition = require('./nda-definition');

// ── Resend email ──────────────────────────────────────────────────────
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

// ── Resend rejection email ─────────────────────────────────────────────
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

// ── Telegram notifications ────────────────────────────────────────────
function sendTelegramMessage(text) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  var chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured — skipping notification');
    return Promise.resolve();
  }

  return fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Activity logging ──────────────────────────────────────────────────
function logActivity(action, details) {
  try {
    const s = getSql();
    return s`INSERT INTO admin_activity (action, details) VALUES (${action}, ${JSON.stringify(details)})`.then(function () {});
  } catch (err) {
    console.error('Activity log error:', err);
    return Promise.resolve();
  }
}

// ── Auth middleware ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!config.apiKey || token !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  next(err);
});

// Health check
app.get('/api/health', function (req, res) {
  res.json({ status: 'ok', service: 'covington-burling-api' });
});

// Generate waiver PDF
app.post('/api/generate-waiver', requireAuth, function (req, res) {
  var _a = req.body || {}, clientName = _a.clientName, date = _a.date, matter = _a.matter;
  var doc = waiverDefinition({ clientName: clientName, date: date, matter: matter });
  var pdfDoc = printer.createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="waiver-release-of-liability.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
});

// Generate NDA PDF
app.post('/api/generate-nda', requireAuth, function (req, res) {
  var _a = req.body || {}, clientName = _a.clientName, clientAddress = _a.clientAddress, effectiveDate = _a.effectiveDate;
  var doc = ndaDefinition({ clientName: clientName, clientAddress: clientAddress, effectiveDate: effectiveDate });
  var pdfDoc = printer.createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="mutual-nda.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
});

// Submit a form request
app.post('/api/request-forms', function (req, res) {
  try {
    var data = req.body || {};
    if (!data.name || !data.email || !data.formType || !data.matterDescription) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    var name = data.name.trim();
    var email = data.email.trim().toLowerCase();
    var phone = (data.phone || '').trim();
    var company = (data.company || '').trim();
    var contactMethod = (data.contactMethod || '').trim();
    var formType = data.formType;
    var matterDescription = data.matterDescription.trim();

    var s = getSql();
    s`INSERT INTO form_requests (name, email, phone, company, contact_method, form_type, matter_description)
       VALUES (${name}, ${email}, ${phone}, ${company}, ${contactMethod}, ${formType}, ${matterDescription})
       RETURNING id`
      .then(function (rows) {
        var id = rows[0].id;
        logActivity('form-submitted', {
          requestId: id,
          name: name,
          email: email,
          formType: formType,
        });
        var isContact = formType === 'contact';
        var header = isContact
          ? '<b>\u{1F4AC} New Contact Inquiry — Carlington &amp; Burling</b>'
          : '<b>\u{1F4CB} New Form Request — Carlington &amp; Burling</b>';
        var formLine = isContact
          ? ''
          : '<b>Form:</b> ' + formType + '\n';
        var contactMethodLine = isContact && contactMethod
          ? '<b>Prefers:</b> ' + contactMethod + '\n'
          : '';
        var matterLabel = isContact ? 'Matter' : 'Matter';
        sendTelegramMessage(
          header + '\n' +
          '<b>Name:</b> ' + name + '\n' +
          '<b>Email:</b> ' + email + '\n' +
          (phone ? '<b>Phone:</b> ' + phone + '\n' : '') +
          (company ? '<b>Company:</b> ' + company + '\n' : '') +
          contactMethodLine +
          formLine +
          '<b>' + matterLabel + ':</b>\n' + matterDescription
        ).catch(console.error);
        res.status(201).json({ id: id, message: 'Request submitted successfully.' });
      })
      .catch(function (err) {
        console.error('Database write error:', err);
        res.status(500).json({ error: 'Failed to save request.' });
      });
  } catch (err) {
    console.error('Request error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin login
app.post('/api/admin/login', function (req, res) {
  var password = (req.body || {}).password || '';
  if (!config.password) {
    return res.status(500).json({ error: 'Admin password not configured.' });
  }
  if (password !== config.password) {
    return res.status(401).json({ error: 'Invalid password.' });
  }
  if (!config.apiKey) {
    return res.status(500).json({ error: 'Admin API key not configured.' });
  }
  res.json({ token: config.apiKey });
});

// List all requests
app.get('/api/admin/requests', requireAuth, function (req, res) {
  try {
    var s = getSql();
    s`SELECT * FROM form_requests ORDER BY created_at DESC LIMIT 100`
      .then(function (rows) {
        var requests = rows.map(function (r) { return r; });
        res.json({ requests: requests });
      })
      .catch(function (err) {
        console.error('Database read error:', err);
        res.status(500).json({ error: 'Failed to load requests.' });
      });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Approve request + send email
app.post('/api/admin/requests/:id/approve', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var id = req.params.id;
    var body = req.body || {};
    var adminMessage = body.adminMessage || null;
    var documentFields = body.documentFields || null;
    var downloadToken = crypto.randomBytes(16).toString('hex');
    var tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    s`SELECT * FROM form_requests WHERE id = ${id}`
      .then(function (rows) {
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Request not found.' });
        }

        var data = rows[0];
        if (data.status !== 'pending') {
          return res.status(400).json({ error: 'Request is not in pending status.' });
        }

        var now = new Date().toISOString();
        return s`UPDATE form_requests SET
          status = 'approved',
          approved_at = ${now},
          approved_by = 'admin',
          download_token = ${downloadToken},
          token_expires_at = ${tokenExpiresAt}
          ${adminMessage ? s` , admin_message = ${adminMessage}` : s``}
          ${documentFields ? s` , document_fields = ${JSON.stringify(documentFields)}` : s``}
          WHERE id = ${id}`
          .then(function () {
            sendResendEmail(data.email, data.name, data.form_type, downloadToken, adminMessage).catch(function (err) {
              console.error('Resend email error:', err);
            });

            logActivity('approve', {
              requestId: id,
              name: data.name,
              email: data.email,
              formType: data.form_type,
            });

            var telegramMsg = '<b>✅ Request Approved</b>\n' +
              '<b>Name:</b> ' + data.name + '\n' +
              '<b>Email:</b> ' + data.email + '\n' +
              '<b>Form:</b> ' + data.form_type;
            if (adminMessage) telegramMsg += '\n<b>Note:</b> ' + adminMessage;
            sendTelegramMessage(telegramMsg).catch(console.error);

            res.json({ message: 'Request approved. Email sent to ' + data.email + '.' });
          });
      })
      .catch(function (err) {
        console.error('Approve error:', err);
        res.status(500).json({ error: 'Failed to approve request.' });
      });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Reject request
app.post('/api/admin/requests/:id/reject', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var id = req.params.id;
    var body = req.body || {};
    var rejectionReason = (body.rejectionReason || '').trim();

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    s`SELECT * FROM form_requests WHERE id = ${id}`
      .then(function (rows) {
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Request not found.' });
        }
        var data = rows[0];
        if (data.status !== 'pending') {
          return res.status(400).json({ error: 'Request is not in pending status.' });
        }
        var now = new Date().toISOString();
        return s`UPDATE form_requests SET
          status = 'rejected',
          rejected_at = ${now},
          approved_by = 'admin',
          rejection_reason = ${rejectionReason}
          WHERE id = ${id}`
          .then(function () {
            sendResendRejectionEmail(data.email, data.name, rejectionReason).catch(function (err) {
              console.error('Resend rejection email error:', err);
            });

            logActivity('reject', {
              requestId: id,
              name: data.name,
              email: data.email,
              formType: data.form_type,
              reason: rejectionReason,
            });

            sendTelegramMessage(
              '<b>❌ Request Rejected</b>\n' +
              '<b>Name:</b> ' + data.name + '\n' +
              '<b>Email:</b> ' + data.email + '\n' +
              '<b>Form:</b> ' + data.form_type + '\n' +
              '<b>Reason:</b> ' + rejectionReason
            ).catch(console.error);

            res.json({ message: 'Request rejected. Rejection email sent to ' + data.email + '.' });
          });
      })
      .catch(function (err) {
        console.error('Reject error:', err);
        res.status(500).json({ error: 'Failed to reject request.' });
      });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Secure PDF download (token-based)
app.get('/api/download/:token', function (req, res) {
  try {
    var s = getSql();
    var token = req.params.token;
    var formType = req.query.form || 'waiver';

    s`SELECT * FROM form_requests WHERE download_token = ${token} AND status = 'approved' LIMIT 1`
      .then(function (rows) {
        if (rows.length === 0) {
          return res.status(404).send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><link rel="stylesheet" href="' + config.siteUrl + '/css/styles.css"></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:sans-serif;"><div><h1 style="color:#0A1628;">Link Expired or Invalid</h1><p style="color:#5A5A6E;">This download link is no longer valid. Please submit a new request if you need access to these forms.</p><a href="' + config.siteUrl + '/waiver-nda.html" style="color:#B08D57;">Request Forms</a></div></body></html>');
        }

        var data = rows[0];
        var expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
        if (expiresAt && expiresAt < new Date()) {
          return res.status(410).send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><link rel="stylesheet" href="' + config.siteUrl + '/css/styles.css"></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:sans-serif;"><div><h1 style="color:#0A1628;">Link Expired</h1><p style="color:#5A5A6E;">This download link has expired. Please submit a new request for access.</p><a href="' + config.siteUrl + '/waiver-nda.html" style="color:#B08D57;">Request Forms</a></div></body></html>');
        }

        var doc;
        var filename;
        if (formType === 'nda') {
          var ndaFields = data.document_fields || { clientName: data.name, clientAddress: data.company, effectiveDate: '' };
          doc = ndaDefinition(ndaFields);
          filename = 'mutual-nda.pdf';
        } else {
          var waiverFields = data.document_fields || { clientName: data.name, date: '', matter: data.matter_description };
          doc = waiverDefinition(waiverFields);
          filename = 'waiver-release-of-liability.pdf';
        }

        var pdfDoc = printer.createPdfKitDocument(doc);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
        pdfDoc.pipe(res);
        pdfDoc.end();
      })
      .catch(function (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to generate PDF.' });
      });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────
app.get('/api/admin/analytics', requireAuth, function (req, res) {
  try {
    var s = getSql();
    s`SELECT status, form_type, created_at, approved_at FROM form_requests`
      .then(function (rows) {
        var total = 0;
        var pending = 0;
        var approved = 0;
        var rejected = 0;
        var byFormType = { waiver: 0, nda: 0, both: 0 };
        var monthlySubmissions = {};
        var approvalDurations = [];

        rows.forEach(function (d) {
          total++;

          if (d.status === 'pending') pending++;
          else if (d.status === 'approved') approved++;
          else if (d.status === 'rejected') rejected++;

          var ft = d.form_type;
          if (byFormType[ft] !== undefined) byFormType[ft]++;

          if (d.created_at) {
            var month = (typeof d.created_at === 'string' ? d.created_at : d.created_at.toISOString()).substring(0, 7);
            monthlySubmissions[month] = (monthlySubmissions[month] || 0) + 1;
          }

          if (d.status === 'approved' && d.created_at && d.approved_at) {
            var created = new Date(d.created_at).getTime();
            var approvedAt = new Date(d.approved_at).getTime();
            if (!isNaN(created) && !isNaN(approvedAt)) {
              approvalDurations.push(approvedAt - created);
            }
          }
        });

        // Sort monthly data
        var sortedMonths = Object.keys(monthlySubmissions).sort();
        var monthlyTrend = sortedMonths.map(function (m) {
          return { month: m, count: monthlySubmissions[m] };
        });

        var approvalRate = total > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;
        var avgApprovalHours = approvalDurations.length > 0
          ? Math.round(approvalDurations.reduce(function (a, b) { return a + b; }, 0) / approvalDurations.length / (1000 * 60 * 60))
          : null;

        res.json({
          pipeline: {
            total: total,
            pending: pending,
            approved: approved,
            rejected: rejected,
          },
          approvalRate: approvalRate,
          avgApprovalHours: avgApprovalHours,
          byFormType: byFormType,
          monthlyTrend: monthlyTrend,
        });
      })
      .catch(function (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to load analytics.' });
      });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Email Header ───────────────────────────────────────────────────

function emailHeader() {
  return '<td style="padding:36px 40px 0;text-align:center;">'
    + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:24px;font-weight:bold;color:#0A1628;letter-spacing:0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling</div>'
    + '<hr style="border:none;border-top:1px solid #B08D57;margin:14px 80px 10px;">'
    + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1919</div>'
    + '<hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">'
    + '</td></tr>';
}

// ── Shared Email Footer ──────────────────────────────────────────────

function emailFooter() {
  return '<td style="background-color:#FAF9F6;padding:26px 40px 30px;border-top:1px solid #E4E0D8;text-align:center;font-family:Arial,Helvetica,sans-serif;">'
    + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;font-weight:bold;color:#0A1628;letter-spacing:0.3px;">Carlington &amp; Burling LLP</div>'
    + '<div style="font-size:12px;color:#5A6577;margin-top:8px;line-height:1.6;">850 Tenth Street NW, Washington, DC 20001<br>'
    + '202&#8209;662&#8209;6000 &nbsp;|&nbsp; <a href="https://carlingtonburling.com" style="color:#B08D57;text-decoration:none;">carlingtonburling.com</a></div>'
    + '<div style="font-size:10px;color:#9AA3B2;margin-top:12px;letter-spacing:0.5px;text-transform:uppercase;">'
    + 'SINCE 1919 &nbsp;&#183;&nbsp; This message is confidential &amp; attorney&#8209;client privileged</div>'
    + '</td>';
}

// ── Layout Wrapper ───────────────────────────────────────────────────

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

app.post('/api/admin/send-email', requireAuth, function (req, res) {
  try {
    var _a = req.body || {};
    var toEmail = _a.toEmail;
    var toName = _a.toName || '';
    var subject = _a.subject;
    var body = _a.body;
    var attachment = _a.attachment || null;

    if (!toEmail || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: toEmail, subject, body.' });
    }

    if (!resend) {
      return res.status(500).json({ error: 'Email service not configured.' });
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

    resend.emails.send(emailPayload).then(function () {
      logActivity('send-email', {
        toEmail: toEmail, toName: toName, subject: subject,
        filename: attachment ? attachment.name : null
      });
      res.json({ message: 'Email sent to ' + toEmail + '.' });
    }).catch(function (err) {
      console.error('Send email error:', err);
      res.status(500).json({ error: 'Failed to send email.', detail: err.message });
    });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Admin send email with PDF attachment ───────────────────────────────
app.post('/api/admin/send-email-attachment', requireAuth, function (req, res) {
  try {
    var _a = req.body || {};
    var toEmail = _a.toEmail;
    var toName = _a.toName || '';
    var subject = _a.subject;
    var body = _a.body;
    var attachment = _a.attachment;

    if (!toEmail || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: toEmail, subject, body.' });
    }

    if (!attachment || !attachment.name || !attachment.content) {
      return res.status(400).json({ error: 'Missing attachment with name and base64 content.' });
    }

    if (!resend) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    var emailPayload = {
      from: 'Carlington & Burling LLP <' + config.resendSender + '>',
      to: [toEmail],
      subject: subject,
      html: buildEmailHtml(body),
      attachments: [
        { filename: attachment.name, content: attachment.content },
      ],
    };

    resend.emails.send(emailPayload).then(function () {
      logActivity('send-email-attachment', { toEmail: toEmail, toName: toName, subject: subject, filename: attachment.name });
      res.json({ message: 'Email with attachment sent to ' + toEmail + '.' });
    }).catch(function (err) {
      console.error('Send email attachment error:', err);
      res.status(500).json({ error: 'Failed to send email with attachment.', detail: err.message });
    });
  } catch (err) {
    console.error('Send email attachment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Activity log ──────────────────────────────────────────────────────
app.get('/api/admin/activity', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var limit = parseInt((req.query.limit || '50'), 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;
    s`SELECT * FROM admin_activity ORDER BY timestamp DESC LIMIT ${limit}`
      .then(function (rows) {
        res.json({ activity: rows });
      })
      .catch(function (err) {
        console.error('Activity read error:', err);
        res.status(500).json({ error: 'Failed to load activity log.' });
      });
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Serve index.html for root (Vercel may route / to Express)
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Custom 404 for non-API routes that reach Express
app.use(function (req, res) {
  if (req.path.indexOf('/api/') === 0) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
  }
});

// ── Export for Vercel / listen when run directly ─────────────────────
module.exports = app;

if (require.main === module) {
  app.listen(config.port, function () {
    console.log('Carlington & Burling API listening on port ' + config.port);
  });
}
