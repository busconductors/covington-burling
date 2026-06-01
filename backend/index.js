const express = require('express');
const cors = require('cors');
const PdfPrinter = require('pdfmake');
const crypto = require('crypto');
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

function getDb() {
  if (!db) {
    // Service account from env var (JSON string) or ADC
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      admin.initializeApp();
    }
    db = admin.firestore();
  }
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
function sendBrevoEmail(toEmail, toName, formType, downloadToken) {
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
app.use(express.json());

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

      return firestore.collection('form-requests').doc(id).update({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        downloadToken: downloadToken,
        tokenExpiresAt: tokenExpiresAt,
      }).then(function () {
        sendBrevoEmail(data.email, data.name, data.formType, downloadToken).catch(function (err) {
          console.error('Brevo email error:', err);
        });

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

    firestore.collection('form-requests').doc(id).get().then(function (doc) {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Request not found.' });
      }
      if (doc.data().status !== 'pending') {
        return res.status(400).json({ error: 'Request is not in pending status.' });
      }
      return firestore.collection('form-requests').doc(id).update({
        status: 'rejected',
        approvedAt: new Date().toISOString(),
      }).then(function () {
        res.json({ message: 'Request rejected.' });
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
          doc = ndaDefinition({ clientName: data.name, clientAddress: data.company, effectiveDate: '' });
          filename = 'mutual-nda.pdf';
        } else {
          doc = waiverDefinition({ clientName: data.name, date: '', matter: data.matterDescription });
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

// ── Start server ─────────────────────────────────────────────────────
app.listen(config.port, function () {
  console.log('Covington & Burling API listening on port ' + config.port);
});
