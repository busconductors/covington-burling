const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { getSql } = require('../services/db');
const { sendTelegramMessage, escapeTelegram } = require('../services/telegram');
const { logActivity } = require('../services/activity');
const { requireAuth } = require('../middleware/auth');
const sessions = require('../services/sessions');
const { rateLimitMiddleware } = require('../services/rate-limit');
const email = require('../services/email');

const loginRateLimit = rateLimitMiddleware({
  bucket: 'admin-login',
  max: 10,
  windowMinutes: 15,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const router = express.Router();

// Admin login — issues a short-lived session token; the static API key
// never leaves the server.
router.post('/api/admin/login', loginRateLimit, function (req, res) {
  var password = (req.body || {}).password || '';
  if (!config.password) {
    return res.status(500).json({ error: 'Admin password not configured.' });
  }
  if (password !== config.password) {
    return res.status(401).json({ error: 'Invalid password.' });
  }
  sessions.createSession()
    .then(function (token) {
      logActivity('login', {});
      res.json({ token: token });
    })
    .catch(function (err) {
      console.error('Session create error:', err);
      res.status(500).json({ error: 'Failed to create session.' });
    });
});

// Admin logout — revokes exactly this session.
router.post('/api/admin/logout', requireAuth, function (req, res) {
  var token = (req.headers.authorization || '').replace('Bearer ', '');
  sessions.destroySession(token)
    .then(function () {
      res.json({ message: 'Logged out.' });
    })
    .catch(function (err) {
      console.error('Session destroy error:', err);
      res.status(500).json({ error: 'Failed to log out.' });
    });
});

// The admin UI consumes camelCase; Neon returns raw snake_case columns.
function toApiRequest(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    contactMethod: r.contact_method,
    formType: r.form_type,
    matterDescription: r.matter_description,
    status: r.status,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
    rejectedAt: r.rejected_at,
    approvedBy: r.approved_by,
    rejectionReason: r.rejection_reason,
    adminMessage: r.admin_message,
    downloadToken: r.download_token,
    tokenExpiresAt: r.token_expires_at,
  };
}

// List requests — pending first so an old pending request can never be
// pushed out of view by newer traffic; paginated with a total count.
router.get('/api/admin/requests', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var limit = parseInt(req.query.limit || '100', 10);
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 200) limit = 200;
    var offset = parseInt(req.query.offset || '0', 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    Promise.all([
      s`SELECT * FROM form_requests
        ORDER BY (status = 'pending') DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      s`SELECT COUNT(*)::int AS count FROM form_requests`,
    ])
      .then(function (results) {
        res.json({
          requests: results[0].map(toApiRequest),
          total: results[1][0].count,
          limit: limit,
          offset: offset,
        });
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
router.post('/api/admin/requests/:id/approve', requireAuth, function (req, res) {
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
        // columns are nullable; one query shape beats conditional fragments
        return s`UPDATE form_requests SET
          status = 'approved',
          approved_at = ${now},
          approved_by = 'admin',
          download_token = ${downloadToken},
          token_expires_at = ${tokenExpiresAt},
          admin_message = ${adminMessage},
          document_fields = ${documentFields ? JSON.stringify(documentFields) : null}
          WHERE id = ${id}`
          .then(function () {
            logActivity('approve', {
              requestId: id,
              name: data.name,
              email: data.email,
              formType: data.form_type,
            });

            var telegramMsg = '<b>✅ Request Approved</b>\n' +
              '<b>Name:</b> ' + escapeTelegram(data.name) + '\n' +
              '<b>Email:</b> ' + escapeTelegram(data.email) + '\n' +
              '<b>Form:</b> ' + escapeTelegram(data.form_type);
            if (adminMessage) telegramMsg += '\n<b>Note:</b> ' + escapeTelegram(adminMessage);
            sendTelegramMessage(telegramMsg).catch(function () {});

            // The approval is committed either way; the response must be
            // honest about whether the client actually got their link.
            return email.sendResendEmail(data.email, data.name, data.form_type, downloadToken, adminMessage)
              .then(function () {
                res.json({ message: 'Request approved. Email sent to ' + data.email + '.' });
              })
              .catch(function (err) {
                console.error('Approval email failed:', err);
                logActivity('approve-email-failed', { requestId: id, email: data.email });
                res.status(502).json({
                  error: 'Request approved, but the email to ' + data.email + ' failed to send. Use "Resend Email" to retry.',
                  approved: true,
                  emailFailed: true,
                });
              });
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

// Resend the approval email (recovery path when the original send failed,
// or the client lost it). Regenerates the token so the new link is fresh.
router.post('/api/admin/requests/:id/resend-email', requireAuth, function (req, res) {
  try {
    var s = getSql();
    var id = req.params.id;
    var downloadToken = crypto.randomBytes(16).toString('hex');
    var tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    s`SELECT * FROM form_requests WHERE id = ${id}`
      .then(function (rows) {
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Request not found.' });
        }
        var data = rows[0];
        if (data.status !== 'approved') {
          return res.status(400).json({ error: 'Request is not approved.' });
        }

        return s`UPDATE form_requests SET
          download_token = ${downloadToken},
          token_expires_at = ${tokenExpiresAt}
          WHERE id = ${id}`
          .then(function () {
            return email.sendResendEmail(data.email, data.name, data.form_type, downloadToken, data.admin_message || null);
          })
          .then(function () {
            logActivity('resend-email', { requestId: id, email: data.email });
            res.json({ message: 'Approval email re-sent to ' + data.email + '.' });
          });
      })
      .catch(function (err) {
        console.error('Resend approval email error:', err);
        res.status(502).json({ error: 'Failed to re-send the approval email.' });
      });
  } catch (err) {
    console.error('Resend approval email error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Reject request
router.post('/api/admin/requests/:id/reject', requireAuth, function (req, res) {
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
            email.sendResendRejectionEmail(data.email, data.name, rejectionReason).catch(function (err) {
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
              '<b>Name:</b> ' + escapeTelegram(data.name) + '\n' +
              '<b>Email:</b> ' + escapeTelegram(data.email) + '\n' +
              '<b>Form:</b> ' + escapeTelegram(data.form_type) + '\n' +
              '<b>Reason:</b> ' + escapeTelegram(rejectionReason)
            ).catch(function () {});

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

// Analytics — aggregated in SQL so the dashboard cost doesn't grow with
// table size. approvalRate is null (not NaN) when nothing has been decided.
router.get('/api/admin/analytics', requireAuth, function (req, res) {
  try {
    var s = getSql();
    Promise.all([
      s`SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE form_type = 'waiver')::int AS waiver_count,
          COUNT(*) FILTER (WHERE form_type = 'nda')::int AS nda_count,
          COUNT(*) FILTER (WHERE form_type = 'both')::int AS both_count,
          AVG(EXTRACT(EPOCH FROM (approved_at - created_at)))
            FILTER (WHERE status = 'approved' AND approved_at IS NOT NULL AND created_at IS NOT NULL) AS avg_approval_seconds
        FROM form_requests`,
      s`SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM form_requests
        WHERE created_at IS NOT NULL
        GROUP BY 1 ORDER BY 1`,
    ])
      .then(function (results) {
        var agg = results[0][0];
        var monthlyTrend = results[1].map(function (m) {
          return { month: m.month, count: m.count };
        });

        var decided = agg.approved + agg.rejected;
        var approvalRate = decided > 0 ? Math.round((agg.approved / decided) * 100) : null;
        var avgApprovalHours = agg.avg_approval_seconds !== null && agg.avg_approval_seconds !== undefined
          ? Math.round(Number(agg.avg_approval_seconds) / 3600)
          : null;

        res.json({
          pipeline: {
            total: agg.total,
            pending: agg.pending,
            approved: agg.approved,
            rejected: agg.rejected,
          },
          approvalRate: approvalRate,
          avgApprovalHours: avgApprovalHours,
          byFormType: { waiver: agg.waiver_count, nda: agg.nda_count, both: agg.both_count },
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

// Send a composed email
router.post('/api/admin/send-email', requireAuth, function (req, res) {
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

    if (!email.isConfigured()) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    email.sendComposedEmail(toEmail, subject, body, attachment).then(function () {
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

// Send email with required PDF attachment
router.post('/api/admin/send-email-attachment', requireAuth, function (req, res) {
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

    if (!email.isConfigured()) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    email.sendComposedEmail(toEmail, subject, body, attachment).then(function () {
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

// Activity log
router.get('/api/admin/activity', requireAuth, function (req, res) {
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

module.exports = router;
