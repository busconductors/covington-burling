const express = require('express');
const config = require('../config');
const { getSql } = require('../services/db');
const { sendTelegramMessage } = require('../services/telegram');
const { logActivity } = require('../services/activity');
const { requireAuth } = require('../middleware/auth');
const { streamPdf } = require('../services/pdf');
const waiverDefinition = require('../waiver-definition');
const ndaDefinition = require('../nda-definition');

const router = express.Router();

// Health check
router.get('/api/health', function (req, res) {
  res.json({ status: 'ok', service: 'covington-burling-api' });
});

// Generate waiver PDF
router.post('/api/generate-waiver', requireAuth, function (req, res) {
  var _a = req.body || {}, clientName = _a.clientName, date = _a.date, matter = _a.matter;
  var doc = waiverDefinition({ clientName: clientName, date: date, matter: matter });
  streamPdf(res, doc, 'waiver-release-of-liability.pdf');
});

// Generate NDA PDF
router.post('/api/generate-nda', requireAuth, function (req, res) {
  var _a = req.body || {}, clientName = _a.clientName, clientAddress = _a.clientAddress, effectiveDate = _a.effectiveDate;
  var doc = ndaDefinition({ clientName: clientName, clientAddress: clientAddress, effectiveDate: effectiveDate });
  streamPdf(res, doc, 'mutual-nda.pdf');
});

// Submit a form request
router.post('/api/request-forms', function (req, res) {
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

// Secure PDF download (token-based)
router.get('/api/download/:token', function (req, res) {
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

        streamPdf(res, doc, filename);
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

module.exports = router;
