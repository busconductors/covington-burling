var express = require('express');
var crypto = require('crypto');
var config = require('../config');
var { getSql } = require('../services/db');
var { storeInboundEmail } = require('../services/inbound');
var email = require('../services/email');
var { requireAuth } = require('../middleware/auth');
var { logActivity } = require('../services/activity');

var router = express.Router();

// ── Mailgun Inbound Webhook (public, no auth) ─────────────────────────
// Mailgun POSTs form-encoded data. We verify the signature, then store.
router.post('/api/inbound/mailgun', function (req, res) {
  var body = req.body || {};

  // Verify Mailgun webhook signature if key is configured
  if (config.mailgunWebhookKey) {
    var token = body.token || '';
    var timestamp = body.timestamp || '';
    var signature = body.signature || '';
    var hash = crypto.createHmac('sha256', config.mailgunWebhookKey)
      .update(timestamp + token)
      .digest('hex');
    if (hash !== signature) {
      console.warn('Inbound webhook: invalid Mailgun signature');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  storeInboundEmail(body)
    .then(function (result) {
      res.json({ received: true, id: result.id });
    })
    .catch(function (err) {
      console.error('Inbound email storage error:', err);
      // Always return 200 to Mailgun — retries won't help a DB error
      res.json({ received: true, error: 'Storage failed (logged)' });
    });
});

// ── Admin Inbox Endpoints ──────────────────────────────────────────────

function toApiEmail(r) {
  return {
    id: r.id,
    fromEmail: r.from_email,
    fromName: r.from_name,
    subject: r.subject,
    bodyHtml: r.body_html,
    bodyPlain: r.body_plain,
    receivedAt: r.received_at,
    createdAt: r.created_at,
    read: r.read,
    attachments: r.attachments,
  };
}

// List inbox emails — paginated, newest first, includes unread count
router.get('/api/admin/inbox', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var limit = parseInt(req.query.limit || '50', 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;
    var offset = parseInt(req.query.offset || '0', 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    Promise.all([
      s`SELECT * FROM inbound_emails ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}`,
      s`SELECT COUNT(*)::int AS count FROM inbound_emails`,
      s`SELECT COUNT(*)::int AS count FROM inbound_emails WHERE read = false`,
    ])
      .then(function (results) {
        res.json({
          emails: results[0].map(toApiEmail),
          total: results[1][0].count,
          unreadCount: results[2][0].count,
        });
      })
      .catch(function (err) {
        console.error('Inbox list error:', err);
        res.status(500).json({ error: 'Failed to load inbox.' });
      });
  } catch (err) {
    console.error('Inbox list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get single email
router.get('/api/admin/inbox/:id', requireAuth, function (req, res) {
  try {
    var s = getSql();
    s`SELECT * FROM inbound_emails WHERE id = ${req.params.id}`
      .then(function (rows) {
        if (rows.length === 0) return res.status(404).json({ error: 'Email not found.' });
        res.json({ email: toApiEmail(rows[0]) });
      })
      .catch(function (err) {
        console.error('Inbox detail error:', err);
        res.status(500).json({ error: 'Failed to load email.' });
      });
  } catch (err) {
    console.error('Inbox detail error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Mark as read
router.post('/api/admin/inbox/:id/read', requireAuth, function (req, res) {
  try {
    var s = getSql();
    s`UPDATE inbound_emails SET read = true WHERE id = ${req.params.id}`
      .then(function () {
        res.json({ success: true });
      })
      .catch(function (err) {
        console.error('Inbox read error:', err);
        res.status(500).json({ error: 'Failed to mark as read.' });
      });
  } catch (err) {
    console.error('Inbox read error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Reply to email via Resend
router.post('/api/admin/inbox/reply', requireAuth, function (req, res) {
  try {
    var body = req.body || {};
    var toEmail = body.toEmail;
    var subject = body.subject;
    var bodyText = body.body;
    var inReplyToId = body.inReplyToId;

    if (!toEmail || !subject || !bodyText) {
      return res.status(400).json({ error: 'Missing required fields: toEmail, subject, body.' });
    }

    if (!email.isConfigured()) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    var replyHtml = '<!DOCTYPE html><html lang="en"><body style="font-family:Georgia,serif;">' +
      bodyText.replace(/\n/g, '<br>') + '</body></html>';

    email.sendComposedEmail(toEmail, subject, replyHtml).then(function () {
      if (inReplyToId) {
        logActivity('inbox-reply', { emailId: inReplyToId, toEmail: toEmail, subject: subject });
      }
      res.json({ message: 'Reply sent to ' + toEmail + '.' });
    }).catch(function (err) {
      console.error('Inbox reply error:', err);
      res.status(500).json({ error: 'Failed to send reply.', detail: err.message });
    });
  } catch (err) {
    console.error('Inbox reply error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete email
router.delete('/api/admin/inbox/:id', requireAuth, function (req, res) {
  try {
    var s = getSql();
    s`DELETE FROM inbound_emails WHERE id = ${req.params.id}`
      .then(function () {
        res.json({ success: true });
      })
      .catch(function (err) {
        console.error('Inbox delete error:', err);
        res.status(500).json({ error: 'Failed to delete email.' });
      });
  } catch (err) {
    console.error('Inbox delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
