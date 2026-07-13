const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { getSql } = require('../services/db');
const { sendTelegramMessage, escapeTelegram } = require('../services/telegram');
const { logActivity } = require('../services/activity');
const { requireAuth, requirePermission, requireMaster } = require('../middleware/auth');
const users = require('../services/users');
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

// Admin login — validates username + password against user accounts,
// issues a short-lived session token linked to the user.
router.post('/api/admin/login', loginRateLimit, function (req, res) {
  var username = (req.body || {}).username || '';
  var password = (req.body || {}).password || '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  users.validateCredentials(username, password)
    .then(function (user) {
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
      return sessions.createSession(user.id)
        .then(function (token) {
          logActivity('login', { username: user.username, userId: user.id });
          res.json({
            token: token,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              isMaster: user.isMaster,
              permissions: user.permissions,
            },
          });
        });
    })
    .catch(function (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    });
});

// Return the currently authenticated user (attached by requireAuth).
router.get('/api/admin/me', requireAuth, function (req, res) {
  res.json(req.user);
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

// ---- User management (master only) ----

// Create a new admin user
router.post('/api/admin/users', requireAuth, requireMaster, function (req, res) {
  var body = req.body || {};
  var username = (body.username || '').trim();
  var displayName = (body.displayName || '').trim();
  var password = body.password || '';
  var permissions = body.permissions || {};

  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'username, displayName, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  users.createUser(username, displayName, password, permissions)
    .then(function (user) {
      logActivity('create-user', { createdUsername: user.username, createdId: user.id });
      res.status(201).json(user);
    })
    .catch(function (err) {
      console.error('Create user error:', err);
      if (err.message && err.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'Username already exists.' });
      }
      res.status(500).json({ error: 'Failed to create user.' });
    });
});

// List all admin users
router.get('/api/admin/users', requireAuth, requireMaster, function (req, res) {
  users.listUsers()
    .then(function (userList) {
      res.json({ users: userList });
    })
    .catch(function (err) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Failed to list users.' });
    });
});

// Update a user (displayName, permissions)
router.put('/api/admin/users/:id', requireAuth, requireMaster, function (req, res) {
  var id = req.params.id;
  var body = req.body || {};
  var fields = {};
  if (body.displayName !== undefined) fields.displayName = body.displayName;
  if (body.permissions !== undefined) fields.permissions = body.permissions;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided (displayName, permissions).' });
  }

  users.updateUser(id, fields)
    .then(function (user) {
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      logActivity('update-user', { updatedId: id });
      res.json(user);
    })
    .catch(function (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Failed to update user.' });
    });
});

// Delete a user (cannot delete self, cannot delete last master)
router.delete('/api/admin/users/:id', requireAuth, requireMaster, function (req, res) {
  var id = req.params.id;

  if (req.user.id === id) {
    return res.status(403).json({ error: 'Cannot delete your own account.' });
  }

  // Check if this is the last master before deleting
  users.getUser(id)
    .then(function (targetUser) {
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (targetUser.isMaster) {
        return users.countMasterUsers()
          .then(function (masterCount) {
            if (masterCount <= 1) {
              return res.status(403).json({ error: 'Cannot delete the last master admin.' });
            }
            return users.deleteUser(id)
              .then(function () {
                logActivity('delete-user', { deletedId: id, deletedUsername: targetUser.username });
                res.json({ message: 'User deleted.' });
              });
          });
      }

      return users.deleteUser(id)
        .then(function () {
          logActivity('delete-user', { deletedId: id, deletedUsername: targetUser.username });
          res.json({ message: 'User deleted.' });
        });
    })
    .catch(function (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user.' });
    });
});

// Reset a user's password
router.post('/api/admin/users/:id/reset-password', requireAuth, requireMaster, function (req, res) {
  var id = req.params.id;
  var password = (req.body || {}).password || '';

  if (!password) {
    return res.status(400).json({ error: 'New password is required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  users.getUser(id)
    .then(function (targetUser) {
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return users.resetPassword(id, password)
        .then(function () {
          logActivity('reset-password', { resetId: id, resetUsername: targetUser.username });
          res.json({ message: 'Password reset successfully.' });
        });
    })
    .catch(function (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Failed to reset password.' });
    });
});

// ---- Request management ----

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
router.get('/api/admin/requests', requireAuth, requirePermission('requests'), function (req, res) {
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
router.post('/api/admin/requests/:id/approve', requireAuth, requirePermission('requests'), function (req, res) {
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
router.post('/api/admin/requests/:id/resend-email', requireAuth, requirePermission('requests'), function (req, res) {
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
router.post('/api/admin/requests/:id/reject', requireAuth, requirePermission('requests'), function (req, res) {
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
router.get('/api/admin/analytics', requireAuth, requirePermission('analytics'), function (req, res) {
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
router.post('/api/admin/send-email', requireAuth, requirePermission('email'), function (req, res) {
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
router.post('/api/admin/send-email-attachment', requireAuth, requirePermission('email'), function (req, res) {
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
router.get('/api/admin/activity', requireAuth, requirePermission('analytics'), function (req, res) {
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
