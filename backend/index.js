const express = require('express');
const cors = require('cors');
const PdfPrinter = require('pdfmake');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ── Config from environment ──────────────────────────────────────────
const config = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSender: process.env.BREVO_SENDER || 'noreply@covbur.com',
  siteUrl: process.env.SITE_URL || 'https://covington-burling-llp.web.app',
  port: process.env.PORT || 3000,
};

// ── Firebase Admin init ──────────────────────────────────────────────
let db = null;
let dbInitError = null;

function getDb() {
  if (!db && !dbInitError) {
    try {
      let cred = null;

      // 1) GOOGLE_APPLICATION_CREDENTIALS_JSON env var (JSON string)
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        console.log('Firebase: using GOOGLE_APPLICATION_CREDENTIALS_JSON env var');
        cred = admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON));
      }
      // 2) Local service-account.json file (bundled with deploy)
      else if (fs.existsSync(path.join(__dirname, 'service-account.json'))) {
        console.log('Firebase: using local service-account.json');
        const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'));
        cred = admin.credential.cert(sa);
      }
      // 3) Application Default Credentials (works on GCP, not Railway)
      else {
        console.log('Firebase: using Application Default Credentials');
      }

      if (cred) {
        admin.initializeApp({ credential: cred });
      } else {
        admin.initializeApp();
      }
      db = admin.firestore();
      console.log('Firebase: initialized successfully');
    } catch (err) {
      dbInitError = err;
      console.error('Firebase init failed:', err.message);
    }
  }
  if (dbInitError) throw new Error('Firestore unavailable: ' + dbInitError.message);
  return db;
}

// ── PDF setup ────────────────────────────────────────────────────────
const fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
};

const printer = new PdfPrinter(fonts);
const waiverDefinition = require('./waiver-definition');
const ndaDefinition = require('./nda-definition');

// ── Brevo email ──────────────────────────────────────────────────────
function sendBrevoEmail(toEmail, toName, formType, downloadToken, adminMessage) {
  const apiKey = config.brevoApiKey;
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured');
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
  <tr><td style="background-color:#0A1628;padding:32px 40px;text-align:center;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#FFFFFF;margin:0;letter-spacing:-0.5px;">Covington <span style="color:#B08D57;">&amp;</span> Burling LLP</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Legal Forms Are Ready</p>
    ${adminMsgHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ${toName},</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Your request for the following legal form(s) has been approved:</p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#0A1628;font-weight:600;margin:0 0 20px;">${formLabel}</p>
    ${linksHtml}
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">These links will expire in 7 days. If you have any questions, please contact our office at <a href="tel:+12026626000" style="color:#6B1C2E;">202-662-6000</a>.</p>
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:12px 0 0;">After completing your form(s), email them to <a href="mailto:info@covbur.com" style="color:#6B1C2E;">info@covbur.com</a> or deliver to 850 Tenth Street NW, Washington, DC 20001.</p>
  </td></tr>
  <tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">
    <p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Covington &amp; Burling LLP, 850 Tenth Street NW, Washington, DC 20001. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const payload = {
    sender: { name: 'Covington & Burling LLP', email: config.brevoSender },
    to: [{ email: toEmail, name: toName }],
    subject: 'Your Covington & Burling Legal Forms Are Ready',
    htmlContent: html,
  };

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Brevo rejection email ─────────────────────────────────────────────
function sendRejectionEmail(toEmail, toName, reason) {
  var apiKey = config.brevoApiKey;
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured');
    return Promise.reject(new Error('Email service not configured'));
  }

  var html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:40px 0;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #D5D5DE;border-radius:4px;">' +
    '<tr><td style="background-color:#0A1628;padding:32px 40px;text-align:center;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:28px;font-weight:600;color:#FFFFFF;margin:0;letter-spacing:-0.5px;">Covington <span style="color:#B08D57;">&amp;</span> Burling LLP</p>' +
    '</td></tr>' +
    '<tr><td style="padding:40px;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Form Request Has Been Declined</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ' + toName + ',</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Thank you for your interest in Covington &amp; Burling LLP. After careful review, we are unable to provide the requested forms at this time.</p>' +
    '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:16px;margin:16px 0;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:13px;color:#991B1B;margin:0;font-weight:600;">Reason:</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#1F1F2E;line-height:1.6;margin:4px 0 0;">' + reason.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' +
    '</div>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">If you have any questions, please contact our office at <a href="tel:+12026626000" style="color:#6B1C2E;">202-662-6000</a> or email us at <a href="mailto:info@covbur.com" style="color:#6B1C2E;">info@covbur.com</a>.</p>' +
    '</td></tr>' +
    '<tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Covington &amp; Burling LLP, 850 Tenth Street NW, Washington, DC 20001. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '</table>' +
    '</body>' +
    '</html>';

  var payload = {
    sender: { name: 'Covington & Burling LLP', email: config.brevoSender },
    to: [{ email: toEmail, name: toName }],
    subject: 'Your form request has been declined',
    htmlContent: html,
  };

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Telegram notifications ────────────────────────────────────────────
function sendTelegramMessage(text) {
  var token = process.env.TELEGRAM_BOT_TOKEN || '8774901284:AAEd4rUxpTUgrGr8ieqy0Fgwfq9Ew9nYZ_U';
  var chatId = process.env.TELEGRAM_CHAT_ID || '7771296485';

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
    const firestore = getDb();
    return firestore.collection('admin-activity').add({
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
    });
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

// Health check
app.get('/', function (req, res) {
  res.json({ status: 'ok', service: 'covington-burling-api' });
});

// Generate waiver PDF
app.post('/api/generate-waiver', function (req, res) {
  var _a = req.body || {}, clientName = _a.clientName, date = _a.date, matter = _a.matter;
  var doc = waiverDefinition({ clientName: clientName, date: date, matter: matter });
  var pdfDoc = printer.createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="waiver-release-of-liability.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
});

// Generate NDA PDF
app.post('/api/generate-nda', function (req, res) {
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

    var firestore = getDb();
    var doc = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: (data.phone || '').trim(),
      company: (data.company || '').trim(),
      formType: data.formType,
      matterDescription: data.matterDescription.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      downloadToken: null,
      tokenExpiresAt: null,
    };

    firestore.collection('form-requests').add(doc).then(function (ref) {
      logActivity('form-submitted', {
        requestId: ref.id,
        name: doc.name,
        email: doc.email,
        formType: doc.formType,
      });
      sendTelegramMessage(
        '<b>\u{1F4CB} New Form Request</b>\n' +
        '<b>Name:</b> ' + doc.name + '\n' +
        '<b>Email:</b> ' + doc.email + '\n' +
        (doc.company ? '<b>Company:</b> ' + doc.company + '\n' : '') +
        '<b>Form:</b> ' + doc.formType + '\n' +
        '<b>Matter:</b> ' + doc.matterDescription
      ).catch(console.error);
      res.status(201).json({ id: ref.id, message: 'Request submitted successfully.' });
    }).catch(function (err) {
      console.error('Firestore write error:', err);
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
    var firestore = getDb();
    firestore.collection('form-requests')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .then(function (snapshot) {
        var requests = [];
        snapshot.forEach(function (doc) {
          var d = doc.data();
          d.id = doc.id;
          requests.push(d);
        });
        res.json({ requests: requests });
      })
      .catch(function (err) {
        console.error('Firestore read error:', err);
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
    var firestore = getDb();
    var id = req.params.id;
    var body = req.body || {};
    var adminMessage = body.adminMessage || null;
    var documentFields = body.documentFields || null;
    var downloadToken = crypto.randomBytes(16).toString('hex');
    var tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    firestore.collection('form-requests').doc(id).get().then(function (doc) {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Request not found.' });
      }

      var data = doc.data();
      if (data.status !== 'pending') {
        return res.status(400).json({ error: 'Request is not in pending status.' });
      }

      var now = new Date().toISOString();
      var updateData = {
        status: 'approved',
        approvedAt: now,
        approvedBy: 'admin',
        downloadToken: downloadToken,
        tokenExpiresAt: tokenExpiresAt,
      };
      if (adminMessage) updateData.adminMessage = adminMessage;
      if (documentFields) updateData.documentFields = documentFields;

      return firestore.collection('form-requests').doc(id).update(updateData).then(function () {
        sendBrevoEmail(data.email, data.name, data.formType, downloadToken, adminMessage).catch(function (err) {
          console.error('Brevo email error:', err);
        });

        logActivity('approve', {
          requestId: id,
          name: data.name,
          email: data.email,
          formType: data.formType,
        });

        var telegramMsg = '<b>✅ Request Approved</b>\n' +
          '<b>Name:</b> ' + data.name + '\n' +
          '<b>Email:</b> ' + data.email + '\n' +
          '<b>Form:</b> ' + data.formType;
        if (adminMessage) telegramMsg += '\n<b>Note:</b> ' + adminMessage;
        sendTelegramMessage(telegramMsg).catch(console.error);

        res.json({ message: 'Request approved. Email sent to ' + data.email + '.' });
      });
    }).catch(function (err) {
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
    var firestore = getDb();
    var id = req.params.id;
    var body = req.body || {};
    var rejectionReason = (body.rejectionReason || '').trim();

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    firestore.collection('form-requests').doc(id).get().then(function (doc) {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Request not found.' });
      }
      var data = doc.data();
      if (data.status !== 'pending') {
        return res.status(400).json({ error: 'Request is not in pending status.' });
      }
      var now = new Date().toISOString();
      return firestore.collection('form-requests').doc(id).update({
        status: 'rejected',
        rejectedAt: now,
        approvedBy: 'admin',
        rejectionReason: rejectionReason,
      }).then(function () {
        sendRejectionEmail(data.email, data.name, rejectionReason).catch(function (err) {
          console.error('Brevo rejection email error:', err);
        });

        logActivity('reject', {
          requestId: id,
          name: data.name,
          email: data.email,
          formType: data.formType,
          reason: rejectionReason,
        });

        sendTelegramMessage(
          '<b>❌ Request Rejected</b>\n' +
          '<b>Name:</b> ' + data.name + '\n' +
          '<b>Email:</b> ' + data.email + '\n' +
          '<b>Form:</b> ' + data.formType + '\n' +
          '<b>Reason:</b> ' + rejectionReason
        ).catch(console.error);

        res.json({ message: 'Request rejected. Rejection email sent to ' + data.email + '.' });
      });
    }).catch(function (err) {
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
    var firestore = getDb();
    var token = req.params.token;
    var formType = req.query.form || 'waiver';

    firestore.collection('form-requests')
      .where('downloadToken', '==', token)
      .where('status', '==', 'approved')
      .limit(1)
      .get()
      .then(function (snapshot) {
        if (snapshot.empty) {
          return res.status(404).send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><link rel="stylesheet" href="' + config.siteUrl + '/css/styles.css"></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:sans-serif;"><div><h1 style="color:#0A1628;">Link Expired or Invalid</h1><p style="color:#5A5A6E;">This download link is no longer valid. Please submit a new request if you need access to these forms.</p><a href="' + config.siteUrl + '/waiver-nda.html" style="color:#B08D57;">Request Forms</a></div></body></html>');
        }

        var data = snapshot.docs[0].data();
        var expiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null;
        if (expiresAt && expiresAt < new Date()) {
          return res.status(410).send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link Expired</title><link rel="stylesheet" href="' + config.siteUrl + '/css/styles.css"></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:sans-serif;"><div><h1 style="color:#0A1628;">Link Expired</h1><p style="color:#5A5A6E;">This download link has expired. Please submit a new request for access.</p><a href="' + config.siteUrl + '/waiver-nda.html" style="color:#B08D57;">Request Forms</a></div></body></html>');
        }

        var doc;
        var filename;
        if (formType === 'nda') {
          var ndaFields = data.documentFields || { clientName: data.name, clientAddress: data.company, effectiveDate: '' };
          doc = ndaDefinition(ndaFields);
          filename = 'mutual-nda.pdf';
        } else {
          var waiverFields = data.documentFields || { clientName: data.name, date: '', matter: data.matterDescription };
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
    var firestore = getDb();
    firestore.collection('form-requests').get()
      .then(function (snapshot) {
        var total = 0;
        var pending = 0;
        var approved = 0;
        var rejected = 0;
        var byFormType = { waiver: 0, nda: 0, both: 0 };
        var monthlySubmissions = {};
        var approvalDurations = [];

        snapshot.forEach(function (doc) {
          var d = doc.data();
          total++;

          if (d.status === 'pending') pending++;
          else if (d.status === 'approved') approved++;
          else if (d.status === 'rejected') rejected++;

          var ft = d.formType;
          if (byFormType[ft] !== undefined) byFormType[ft]++;

          if (d.createdAt) {
            var month = d.createdAt.substring(0, 7);
            monthlySubmissions[month] = (monthlySubmissions[month] || 0) + 1;
          }

          if (d.status === 'approved' && d.createdAt && d.approvedAt) {
            var created = new Date(d.createdAt).getTime();
            var approvedAt = new Date(d.approvedAt).getTime();
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

// ── Admin send email ──────────────────────────────────────────────────
function buildEmailHtml(body) {
  // Escape HTML special chars
  var escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Turn double-newline blocks into <p> paragraphs, single newlines into <br>
  var bodyHtml = escaped
    .split(/\n\n+/)
    .map(function (p) {
      var t = p.trim();
      if (!t) return '';
      return '<p style="margin:0 0 1em;font-family:Georgia,Times,serif;font-size:15px;line-height:1.7;color:#1A1A1A;">'
        + t.replace(/\n/g, '<br>') + '</p>';
    })
    .join('');

  // Inline SVG monogram
  var monogram = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 160 160" style="display:block;margin:0 auto 10px;">'
    + '<g transform="translate(20,20)">'
    + '<circle cx="60" cy="60" r="56" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.6"/>'
    + '<circle cx="60" cy="60" r="50" fill="none" stroke="#B08D57" stroke-width="2" opacity="0.9"/>'
    + '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="Georgia,Times,serif" font-weight="600" font-size="46" letter-spacing="-2" fill="#FFFFFF">C<tspan fill="#B08D57">B</tspan></text>'
    + '</g></svg>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background-color:#F4F2EE;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F4F2EE;padding:24px 0;">'
    + '<tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFFFF;border-radius:4px;overflow:hidden;max-width:600px;">'
    + '<tr><td style="background-color:#0A1628;padding:28px 40px 24px;text-align:center;">'
    + monogram
    + '<div style="font-family:Georgia,Times,serif;font-size:20px;color:#FFFFFF;font-weight:700;letter-spacing:0.04em;">'
    + 'COVINGTON<span style="font-weight:400;"> &amp; </span>BURLING<span style="font-weight:400;color:#B08D57;"> LLP</span>'
    + '</div>'
    + '<div style="width:32px;height:2px;background-color:#B08D57;margin:12px auto 0;"></div>'
    + '</td></tr>'
    + '<tr><td style="padding:36px 40px 20px;">' + bodyHtml + '</td></tr>'
    + '<tr><td style="background-color:#F9F8F6;padding:20px 40px;border-top:1px solid #E8E4DD;text-align:center;">'
    + '<div style="font-family:Georgia,Times,serif;font-size:13px;color:#666;line-height:1.7;">'
    + '<strong style="color:#0A1628;">Covington &amp; Burling LLP</strong><br>'
    + '850 Tenth Street NW, Washington, DC 20001<br>'
    + '202-662-6000 &nbsp;|&nbsp; covington.com'
    + '</div>'
    + '<div style="font-family:Georgia,Times,serif;font-size:11px;color:#A0A0A0;margin-top:6px;">'
    + 'Founded 1919 &nbsp;|&nbsp; This message is confidential.'
    + '</div>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

app.post('/api/admin/send-email', requireAuth, function (req, res) {
  try {
    var _a = req.body || {};
    var toEmail = _a.toEmail;
    var toName = _a.toName || '';
    var subject = _a.subject;
    var body = _a.body;

    if (!toEmail || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: toEmail, subject, body.' });
    }

    var apiKey = config.brevoApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    var payload = {
      sender: { name: 'Covington & Burling LLP', email: config.brevoSender },
      to: [{ email: toEmail, name: toName }],
      subject: subject,
      textContent: body,
      htmlContent: buildEmailHtml(body),
    };

    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json();
    }).then(function () {
      logActivity('send-email', { toEmail: toEmail, toName: toName, subject: subject });
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

    var apiKey = config.brevoApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    var payload = {
      sender: { name: 'Covington & Burling LLP', email: config.brevoSender },
      to: [{ email: toEmail, name: toName }],
      subject: subject,
      textContent: body,
      htmlContent: buildEmailHtml(body),
      attachment: [
        { name: attachment.name, content: attachment.content },
      ],
    };

    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json();
    }).then(function () {
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
    var firestore = getDb();
    firestore.collection('admin-activity')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .then(function (snapshot) {
        var entries = [];
        snapshot.forEach(function (doc) {
          var d = doc.data();
          d.id = doc.id;
          entries.push(d);
        });
        res.json({ activity: entries });
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

// ── Start server ─────────────────────────────────────────────────────
app.listen(config.port, function () {
  console.log('Covington & Burling API listening on port ' + config.port);
});
