# Inbound Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-way email at `maxtheodore@carlingtonburling.com` — Mailgun inbound → Neon storage → admin inbox tab with reply via Resend.

**Architecture:** Mailgun MX records deliver inbound to a webhook endpoint (`/api/inbound/mailgun`). A new `inbound_emails` Neon table stores sanitized emails. Admin inbox tab (split-pane: list + detail + inline reply) reads/writes via auth'd Express endpoints. Replies send via Resend from `maxtheodore@...`.

**Tech Stack:** Express, Neon Postgres, Resend (outbound), Mailgun (inbound), vanilla JS, existing CSS design system

## Global Constraints

- `MAILGUN_WEBHOOK_KEY` must be configured in production env
- `MAILGUN_DOMAIN` must be configured (Mailgun domain for attachment URLs)
- All inbox endpoints require session auth (except webhook)
- HTML bodies must be sanitized before storage (strip scripts, event handlers)
- Reuse existing `AdminUtils.escHtml`/`escAttr` for XSS prevention
- Follow existing code patterns: dual-mode JS modules for shared code, Neon tagged templates for SQL
- Node.js 24.x on Vercel (no ESM, use `require`/`module.exports`)

---

## File Structure Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/config.js` | Modify | Add `inboxSender`, `mailgunWebhookKey`, `mailgunDomain` |
| `backend/services/inbound.js` | Create | `storeInboundEmail(payload)` — parse, sanitize, store, dedup |
| `backend/routes/inbound.js` | Create | Webhook endpoint + admin inbox CRUD endpoints |
| `backend/index.js` | Modify | Mount inbound routes, 5mb body limit on webhook |
| `public/admin/index.html` | Modify | Add Inbox sidebar link + inbox section markup |
| `public/js/admin-inbox.js` | Create | Inbox UI: list, detail panel, reply composer, polling |
| `public/css/admin-inbox.css` | Create | Inbox-specific styles matching existing design system |
| `public/js/admin-dashboard.js` | Modify | Add inbox section name, lazy-load AdminInbox |
| `test/inbound.test.js` | Create | Webhook signature verif, storage, dedup tests |
| `test/admin-inbox-routes.test.js` | Create | Admin inbox endpoint tests (list, read, reply, delete) |

---

### Task 1: Database — Create `inbound_emails` table

**Files:**
- Create: migration SQL (run directly against Neon)
- No code file — schema-only task

**Interfaces:**
- Produces: `inbound_emails` table with columns: `id` (UUID PK), `message_id` (TEXT UNIQUE), `from_email` (TEXT NOT NULL), `from_name` (TEXT), `subject` (TEXT), `body_html` (TEXT), `body_plain` (TEXT), `received_at` (TIMESTAMPTZ NOT NULL), `created_at` (TIMESTAMPTZ DEFAULT now()), `read` (BOOLEAN DEFAULT false), `attachments` (JSONB DEFAULT '[]')

- [ ] **Step 1: Run CREATE TABLE against Neon**

```sql
CREATE TABLE IF NOT EXISTS inbound_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    TEXT UNIQUE,
  from_email    TEXT NOT NULL,
  from_name     TEXT,
  subject       TEXT,
  body_html     TEXT,
  body_plain    TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  read          BOOLEAN DEFAULT false,
  attachments   JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON inbound_emails (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails (message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_read ON inbound_emails (read);
```

Run: Connect to Neon and execute the SQL above.
Expected: Table and indexes created without error.

- [ ] **Step 2: Verify table exists**

Run: `SELECT count(*) FROM inbound_emails;`
Expected: Returns `0` (empty table, ready for data).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): create inbound_emails table for Mailgun inbound email storage"
```

---

### Task 2: Config — Add inbound email settings

**Files:**
- Modify: `backend/config.js`

**Interfaces:**
- Produces: `config.inboxSender`, `config.mailgunWebhookKey`, `config.mailgunDomain`

- [ ] **Step 1: Add new config fields**

Read `backend/config.js`. Current content:

```js
module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  port: process.env.PORT || 3000,
};
```

Edit to add the three new fields:

```js
module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  inboxSender: process.env.INBOX_SENDER || 'Max Theodore <maxtheodore@carlingtonburling.com>',
  mailgunWebhookKey: process.env.MAILGUN_WEBHOOK_KEY || '',
  mailgunDomain: process.env.MAILGUN_DOMAIN || '',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  port: process.env.PORT || 3000,
};
```

- [ ] **Step 2: Verify config loads**

Run: `node -e "var c = require('./backend/config'); console.log(c.inboxSender, c.mailgunWebhookKey === '' ? 'empty-ok' : 'set', c.mailgunDomain === '' ? 'empty-ok' : 'set');"`
Expected: Prints `Max Theodore <maxtheodore@carlingtonburling.com> empty-ok empty-ok`

- [ ] **Step 3: Commit**

```bash
git add backend/config.js
git commit -m "feat(config): add inboxSender, mailgunWebhookKey, mailgunDomain config fields"
```

---

### Task 3: Write failing tests for inbound service

**Files:**
- Create: `test/inbound.test.js`

**Interfaces:**
- Consumes: `backend/services/inbound.js` — `storeInboundEmail(payload)` — returns `{id, message_id}`
- Tests: Mailgun payload parsing, storage, HTML sanitization, dedup on duplicate `message_id`

- [ ] **Step 1: Write the test file**

```js
var assert = require('assert');
var { describe, it, beforeEach, afterEach } = require('vitest');

// We'll mock db.js to avoid hitting real Neon
var db = require('../backend/services/db');
var origGetSql = db.getSql;
var mockRows = [];
var mockQueries = [];

db.getSql = function () {
  var s = function (strings) {
    var vals = Array.prototype.slice.call(arguments, 1);
    var query = { text: strings.join('?'), values: vals };
    mockQueries.push(query);
    return {
      then: function (cb) {
        var result = mockRows.length ? mockRows : [];
        return Promise.resolve(result).then(cb);
      }
    };
  };
  return s;
};

var inbound = require('../backend/services/inbound');

describe('storeInboundEmail', function () {
  beforeEach(function () {
    mockQueries = [];
    mockRows = [];
  });

  afterEach(function () {
    db.getSql = origGetSql;
  });

  it('stores a valid Mailgun payload and returns id', async function () {
    mockRows = [{ id: 'abc-123', message_id: 'msg-001' }];

    var payload = {
      'Message-Id': '<msg-001@mailgun>',
      from: 'Client Name <client@example.com>',
      subject: 'Question about NDA',
      'body-html': '<p>Hello Max, I have a question about the NDA terms.</p>',
      'body-plain': 'Hello Max, I have a question about the NDA terms.',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    var result = await inbound.storeInboundEmail(payload);
    assert.strictEqual(result.id, 'abc-123');
    assert.strictEqual(mockQueries.length, 1);
  });

  it('strips script tags from HTML body', async function () {
    mockRows = [{ id: 'abc-456', message_id: 'msg-002' }];

    var payload = {
      'Message-Id': '<msg-002@mailgun>',
      from: 'attacker@evil.com',
      subject: 'Hello',
      'body-html': '<p>Safe text</p><script>alert("xss")</script><img onerror="alert(1)" src=x>',
      'body-plain': 'Safe text',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    await inbound.storeInboundEmail(payload);
    var query = mockQueries[0];
    var htmlStored = query.values[3]; // body_html is 4th param (0-indexed: 3)
    assert.ok(!htmlStored.includes('<script'));
    assert.ok(!htmlStored.includes('onerror'));
    assert.ok(htmlStored.includes('Safe text'));
  });

  it('returns existing row on duplicate message_id', async function () {
    // First call — no existing row
    mockRows = [];
    // Second call — mock the SELECT returning existing row
    var callCount = 0;
    var origS = db.getSql;
    db.getSql = function () {
      callCount++;
      var s = function () {
        var vals = Array.prototype.slice.call(arguments, 1);
        return {
          then: function (cb) {
            if (callCount === 1) return Promise.resolve([]).then(cb); // SELECT returns empty
            return Promise.resolve([{ id: 'existing-id', message_id: 'msg-003' }]).then(cb); // SELECT returns existing
          }
        };
      };
      return s;
    };

    var payload = {
      'Message-Id': '<msg-003@mailgun>',
      from: 'test@example.com',
      subject: 'Test',
      'body-html': '<p>Test</p>',
      'body-plain': 'Test',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    var result = await inbound.storeInboundEmail(payload);
    assert.strictEqual(result.id, 'existing-id');
    db.getSql = origS;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/inbound.test.js`
Expected: FAIL — `Cannot find module '../backend/services/inbound'`

- [ ] **Step 3: Commit**

```bash
git add test/inbound.test.js
git commit -m "test(inbound): add failing tests for storeInboundEmail — parse, sanitize, dedup"
```

---

### Task 4: Implement inbound email service

**Files:**
- Create: `backend/services/inbound.js`

**Interfaces:**
- Produces: `storeInboundEmail(payload)` → `Promise<{id, message_id}>`
- Consumes: `backend/services/db.js` → `getSql()`

- [ ] **Step 1: Write the service**

```js
var { getSql } = require('./db');

/**
 * Simple HTML sanitizer — strips script tags, event handlers, and
 * javascript: URLs. Not a replacement for a full sanitizer like DOMPurify,
 * but sufficient for email bodies rendered in a sandboxed context.
 */
function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<iframe[^>]*>/gi, '&lt;iframe&gt;')
    .replace(/<embed[^>]*>/gi, '&lt;embed&gt;')
    .replace(/<object[^>]*>/gi, '&lt;object&gt;');
}

/**
 * Parse a Mailgun "from" header like "Client Name <client@example.com>"
 * into { name, email }.
 */
function parseFromHeader(from) {
  if (!from) return { name: '', email: '' };
  var match = from.match(/^\s*(.+?)\s*<(.+?)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2] };
  return { name: '', email: from.trim() };
}

/**
 * Store an inbound email from a Mailgun webhook payload.
 * Deduplicates on message_id (Mailgun retries).
 *
 * @param {Object} payload — raw Mailgun webhook form-encoded payload
 * @returns {Promise<{id: string, message_id: string}>}
 */
function storeInboundEmail(payload) {
  var s = getSql();
  var messageId = payload['Message-Id'] || payload['message-id'] || '';
  var fromHeader = payload['from'] || '';
  var parsed = parseFromHeader(fromHeader);
  var subject = (payload['subject'] || '').substring(0, 500);
  var bodyHtml = sanitizeHtml(payload['body-html'] || payload['html'] || '');
  var bodyPlain = (payload['body-plain'] || payload['text'] || '').substring(0, 50000);
  var receivedAt = payload['Received'] ? new Date(payload['Received']).toISOString() : new Date().toISOString();

  var attachments;
  try {
    attachments = JSON.parse(payload['attachments'] || '[]');
  } catch (e) {
    attachments = [];
  }

  // Dedup: if message_id already exists, return the existing row
  return s`SELECT id, message_id FROM inbound_emails WHERE message_id = ${messageId}`
    .then(function (existing) {
      if (existing.length > 0) {
        return { id: existing[0].id, message_id: existing[0].message_id };
      }
      return s`INSERT INTO inbound_emails (message_id, from_email, from_name, subject, body_html, body_plain, received_at, attachments)
        VALUES (${messageId}, ${parsed.email}, ${parsed.name}, ${subject}, ${bodyHtml}, ${bodyPlain}, ${receivedAt}, ${JSON.stringify(attachments)})
        RETURNING id, message_id`
        .then(function (rows) {
          return rows[0];
        });
    });
}

module.exports = { storeInboundEmail, sanitizeHtml, parseFromHeader };
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/inbound.test.js`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/services/inbound.js
git commit -m "feat(inbound): implement storeInboundEmail — parse, sanitize, dedup Mailgun payloads"
```

---

### Task 5: Write failing tests for inbound routes

**Files:**
- Create: `test/admin-inbox-routes.test.js`

**Interfaces:**
- Consumes: `backend/routes/inbound.js` — Express router with webhook + admin inbox endpoints
- Tests: Webhook signature verification, GET inbox (pagination, unread count), GET single, POST read, POST reply, DELETE

- [ ] **Step 1: Write route test file**

```js
var assert = require('assert');
var { describe, it, beforeEach, afterEach } = require('vitest');
var express = require('express');
var request = require('supertest');

// Mock the db service
var db = require('../backend/services/db');
var origGetSql = db.getSql;
var mockResults = {};

function mockSql(results) {
  return function () {
    var vals = Array.prototype.slice.call(arguments, 1);
    var sqlText = arguments[0]; // tagged template first arg is array of strings
    var queryKey = typeof sqlText === 'string' ? sqlText : (Array.isArray(sqlText) ? sqlText.join('...') : 'unknown');
    return {
      then: function (cb) { return Promise.resolve(results).then(cb); },
      catch: function (cb) { return Promise.resolve(results); }
    };
  };
}

// Mock email service
var email = require('../backend/services/email');
var origSendComposed = email.sendComposedEmail;

describe('Inbound Routes', function () {
  var app;
  var validSignature = { token: 'abc', timestamp: '1234567890', signature: 'abc' };

  beforeEach(function () {
    // Set up a minimal Express app with inbound routes
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Override config for tests
    process.env.MAILGUN_WEBHOOK_KEY = 'test-key';

    // Mock the db for all tests
    db.getSql = function () { return mockSql([]); };

    app.use(require('../backend/routes/inbound'));
  });

  afterEach(function () {
    db.getSql = origGetSql;
    delete process.env.MAILGUN_WEBHOOK_KEY;
  });

  describe('GET /api/admin/inbox', function () {
    it('returns 401 without auth', async function () {
      var res = await request(app).get('/api/admin/inbox');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('POST /api/inbound/mailgun', function () {
    it('accepts Mailgun webhook form data and returns 200', async function () {
      db.getSql = function () {
        var s = function () {
          return {
            then: function (cb) { return Promise.resolve([]).then(cb); }
          };
        };
        return s;
      };

      var res = await request(app)
        .post('/api/inbound/mailgun')
        .type('form')
        .send({
          'Message-Id': '<test-001@mailgun>',
          from: 'Test User <test@example.com>',
          subject: 'Test inbound',
          'body-html': '<p>Hello</p>',
          'body-plain': 'Hello',
          Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
          attachments: '[]',
          token: 'abc',
          timestamp: '1234567890',
          signature: 'abc',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run test/admin-inbox-routes.test.js`
Expected: FAIL — `Cannot find module '../backend/routes/inbound'`

- [ ] **Step 3: Commit**

```bash
git add test/admin-inbox-routes.test.js
git commit -m "test(inbound): add failing route tests for webhook + admin inbox endpoints"
```

---

### Task 6: Implement inbound routes (webhook + admin endpoints)

**Files:**
- Create: `backend/routes/inbound.js`

**Interfaces:**
- Produces: Express router with endpoints:
  - `POST /api/inbound/mailgun` (public, Mailgun webhook) → `{received: true}`
  - `GET /api/admin/inbox` (auth'd, query: `limit`, `offset`) → `{emails: [...], total: int, unreadCount: int}`
  - `GET /api/admin/inbox/:id` (auth'd) → `{email: {...}}`
  - `POST /api/admin/inbox/:id/read` (auth'd) → `{success: true}`
  - `POST /api/admin/inbox/reply` (auth'd, body: `{inReplyToId, toEmail, toName, subject, body}`) → `{message: '...'}`
  - `DELETE /api/admin/inbox/:id` (auth'd) → `{success: true}`
- Consumes: `backend/services/inbound.js`, `backend/services/email.js`, `backend/middleware/auth.js`, `backend/config.js`

- [ ] **Step 1: Write the route file**

```js
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
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run test/admin-inbox-routes.test.js`
Expected: Tests that don't need real DB/auth pass (the 200 on webhook test should pass). The auth tests will pass once the requireAuth middleware runs. Tests should improve from ModuleNotFound error.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/inbound.js
git commit -m "feat(inbound): add webhook + admin inbox endpoints — list, detail, read, reply, delete"
```

---

### Task 7: Mount inbound routes in Express app

**Files:**
- Modify: `backend/index.js`

**Interfaces:**
- Consumes: `backend/routes/inbound.js` (Express router from Task 6)

- [ ] **Step 1: Add inbound route mounting**

Read `backend/index.js`. After the line `app.use(require('./routes/admin'));`, add:

```js
app.use(require('./routes/inbound'));
```

Also add the webhook endpoint to the 5mb body limit whitelist (Mailgun sends multipart payloads with attachments). Change the line:

```js
app.use(['/api/admin/send-email', '/api/admin/send-email-attachment'], express.json({ limit: '5mb' }));
```

to:

```js
app.use(['/api/admin/send-email', '/api/admin/send-email-attachment', '/api/inbound/mailgun'], express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // Mailgun sends form-encoded
```

- [ ] **Step 2: Verify app still starts**

Run: `timeout 5 node server.js 2>&1 || true`
Expected: `Carlington & Burling API listening on port 3000`

- [ ] **Step 3: Commit**

```bash
git add backend/index.js
git commit -m "feat(inbound): mount inbound routes in Express app"
```

---

### Task 8: Run full test suite

**Files:**
- Touch: none (verification only)

**Interfaces:**
- Verifies all existing tests still pass alongside new tests

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing 180 + new inbound tests). Any failures indicate regression.

- [ ] **Step 2: If tests fail, fix regressions**

The main risk is the mock in `test/inbound.test.js` overriding `db.getSql` leaking into other tests. If so, move the mock setup/teardown inside the describe block with proper cleanup in afterEach.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "test: fix test isolation — mock db.getSql correctly in inbound tests"
```

---

### Task 9: Add Inbox tab to admin dashboard HTML

**Files:**
- Modify: `public/admin/index.html`

- [ ] **Step 1: Add Inbox sidebar nav button**

After the Email sidebar button (line 89-92), add:

```html
<button class="admin-sidebar__link" data-section="adminInboxSection">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-1l-2-3H8L6 7H5a2 2 0 00-2 2z"/><path d="M18 22H6a2 2 0 01-2-2V9"/></svg>
  Inbox
  <span class="admin-sidebar__badge admin-sidebar__badge--zero" id="inboxBadge">0</span>
</button>
```

- [ ] **Step 2: Add Inbox section markup**

After the Email section closing `</section>` (line 484, `<!-- ── Email Section ──`), add:

```html
<!-- ── Inbox Section ──────────────────────────────────────────── -->
<section class="admin-section" id="adminInboxSection">
  <div class="inbox-container">
    <!-- Left: Email list -->
    <div class="inbox-list-panel">
      <div class="inbox-list-header">
        <h2 class="inbox-list-title">Inbox</h2>
        <button class="inbox-refresh-btn" id="inboxRefreshBtn" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>
      <div class="inbox-list" id="inboxList">
        <div class="inbox-empty" id="inboxEmpty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M22 12h-6l-2 3H10l-2-3H2"/><path d="M5.45 5.12L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.88A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.12z"/></svg>
          <p>No emails yet.</p>
        </div>
      </div>
      <div class="inbox-list-footer">
        <button class="inbox-load-more hidden" id="inboxLoadMore">Load more</button>
      </div>
    </div>

    <!-- Right: Detail panel -->
    <div class="inbox-detail-panel" id="inboxDetailPanel">
      <div class="inbox-detail-empty" id="inboxDetailEmpty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <p>Select an email to view</p>
      </div>
      <div class="inbox-detail-content hidden" id="inboxDetailContent">
        <!-- Header -->
        <div class="inbox-email-header">
          <h3 class="inbox-email-subject" id="inboxEmailSubject"></h3>
          <div class="inbox-email-meta">
            <div class="inbox-email-from">
              <span class="inbox-email-from-name" id="inboxEmailFromName"></span>
              <span class="inbox-email-from-addr" id="inboxEmailFromAddr"></span>
            </div>
            <span class="inbox-email-date" id="inboxEmailDate"></span>
          </div>
          <div class="inbox-email-actions">
            <button class="inbox-action-btn" id="inboxDeleteBtn" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="inbox-email-body" id="inboxEmailBody"></div>

        <!-- Attachments -->
        <div class="inbox-attachments hidden" id="inboxAttachments">
          <h4 class="inbox-attachments-title">Attachments</h4>
          <div class="inbox-attachments-list" id="inboxAttachmentsList"></div>
        </div>

        <!-- Reply composer -->
        <div class="inbox-reply">
          <h4 class="inbox-reply-title">Reply</h4>
          <div class="inbox-reply-meta">
            <span class="inbox-reply-label">From:</span>
            <span class="inbox-reply-value" id="inboxReplyFrom">Max Theodore &lt;maxtheodore@carlingtonburling.com&gt;</span>
          </div>
          <div class="inbox-reply-meta">
            <span class="inbox-reply-label">To:</span>
            <span class="inbox-reply-value" id="inboxReplyTo"></span>
          </div>
          <textarea class="inbox-reply-textarea" id="inboxReplyBody" rows="5" placeholder="Type your reply..."></textarea>
          <div class="inbox-reply-actions">
            <button class="btn btn--primary" id="inboxReplySend">Send Reply</button>
            <span class="inbox-reply-status" id="inboxReplyStatus"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Add inbox CSS + JS includes**

In the `<head>`, after the existing stylesheets, add:

```html
<link rel="stylesheet" href="/css/admin-inbox.css?v=1">
```

Before `</body>`, after the existing admin scripts, add:

```html
<script src="/js/admin-inbox.js?v=1" defer></script>
```

- [ ] **Step 4: Commit**

```bash
git add public/admin/index.html
git commit -m "feat(inbox): add Inbox tab markup and assets to admin dashboard"
```

---

### Task 10: Create inbox CSS

**Files:**
- Create: `public/css/admin-inbox.css`

- [ ] **Step 1: Write inbox CSS**

```css
/* ── Inbox Container ─────────────────────────────────────────────────── */
.inbox-container {
  display: flex;
  height: calc(100vh - 120px);
  background: var(--color-white, #fff);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e5ea);
}

/* ── Left Panel: Email List ──────────────────────────────────────────── */
.inbox-list-panel {
  width: 35%;
  min-width: 300px;
  border-right: 1px solid var(--color-border, #e5e5ea);
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.inbox-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e5ea);
  background: #fff;
}

.inbox-list-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  margin: 0;
}

.inbox-refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e5e5ea);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: var(--color-text-light, #8a8a9a);
  transition: color 0.2s, border-color 0.2s;
}
.inbox-refresh-btn:hover {
  color: var(--color-gold, #B08D57);
  border-color: var(--color-gold, #B08D57);
}

.inbox-list {
  flex: 1;
  overflow-y: auto;
}

/* ── Email List Item ─────────────────────────────────────────────────── */
.inbox-item {
  display: flex;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border, #e5e5ea);
  cursor: pointer;
  transition: background 0.15s;
  background: #fff;
  gap: 12px;
}

.inbox-item:hover { background: #f8f6f2; }

.inbox-item--unread {
  border-left: 3px solid var(--color-gold, #B08D57);
  padding-left: 17px;
}

.inbox-item--active {
  background: #f0ede5;
}

.inbox-item__content {
  flex: 1;
  min-width: 0;
}

.inbox-item__from {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inbox-item__subject {
  font-size: 13px;
  color: var(--color-navy, #0A1628);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inbox-item--unread .inbox-item__subject {
  font-weight: 600;
}

.inbox-item__preview {
  font-size: 12px;
  color: var(--color-text-light, #8a8a9a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inbox-item__time {
  font-size: 11px;
  color: var(--color-text-light, #8a8a9a);
  white-space: nowrap;
  margin-top: 6px;
}

.inbox-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-gold, #B08D57);
  flex-shrink: 0;
  margin-top: 6px;
  display: none;
}

.inbox-item--unread .inbox-item__dot { display: block; }

/* ── Empty State ─────────────────────────────────────────────────────── */
.inbox-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-light, #8a8a9a);
  text-align: center;
}

.inbox-empty p {
  margin-top: 12px;
  font-size: 14px;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.inbox-list-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--color-border, #e5e5ea);
  background: #fff;
  text-align: center;
}

.inbox-load-more {
  background: none;
  border: 1px solid var(--color-border, #e5e5ea);
  padding: 8px 24px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-navy, #0A1628);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.inbox-load-more:hover {
  border-color: var(--color-gold, #B08D57);
  color: var(--color-gold, #B08D57);
}

/* ── Right Panel: Detail ─────────────────────────────────────────────── */
.inbox-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.inbox-detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light, #8a8a9a);
  gap: 12px;
}

.inbox-detail-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Email Header ────────────────────────────────────────────────────── */
.inbox-email-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border, #e5e5ea);
  background: #fff;
}

.inbox-email-subject {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  margin: 0 0 10px;
}

.inbox-email-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.inbox-email-from-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  display: block;
}

.inbox-email-from-addr {
  font-size: 12px;
  color: var(--color-text-light, #8a8a9a);
}

.inbox-email-date {
  font-size: 12px;
  color: var(--color-text-light, #8a8a9a);
  white-space: nowrap;
}

.inbox-email-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.inbox-action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e5e5ea);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  color: var(--color-text-light, #8a8a9a);
  transition: color 0.2s, border-color 0.2s;
}
.inbox-action-btn:hover {
  color: #dc3545;
  border-color: #dc3545;
}

/* ── Email Body ──────────────────────────────────────────────────────── */
.inbox-email-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 15px;
  line-height: 1.7;
  color: #1a1a2e;
}

.inbox-email-body img { max-width: 100%; height: auto; }

/* ── Attachments ─────────────────────────────────────────────────────── */
.inbox-attachments {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border, #e5e5ea);
  background: #fafafa;
}

.inbox-attachments-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-light, #8a8a9a);
  margin: 0 0 10px;
}

.inbox-attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inbox-attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5ea);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-navy, #0A1628);
  text-decoration: none;
  transition: border-color 0.2s;
}
.inbox-attachment-item:hover {
  border-color: var(--color-gold, #B08D57);
}

.inbox-attachment-size {
  font-size: 11px;
  color: var(--color-text-light, #8a8a9a);
}

/* ── Reply Composer ──────────────────────────────────────────────────── */
.inbox-reply {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border, #e5e5ea);
  background: #fff;
}

.inbox-reply-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  margin: 0 0 10px;
}

.inbox-reply-meta {
  font-size: 13px;
  color: var(--color-text-light, #8a8a9a);
  margin-bottom: 4px;
}

.inbox-reply-label {
  font-weight: 600;
  color: var(--color-navy, #0A1628);
  display: inline-block;
  width: 40px;
}

.inbox-reply-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border, #e5e5ea);
  border-radius: 6px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  margin-top: 10px;
  min-height: 100px;
}
.inbox-reply-textarea:focus {
  outline: none;
  border-color: var(--color-gold, #B08D57);
  box-shadow: 0 0 0 3px rgba(176,141,87,0.15);
}

.inbox-reply-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.inbox-reply-status {
  font-size: 13px;
}

.inbox-reply-status--success { color: #2d7d46; }
.inbox-reply-status--error { color: #dc3545; }

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .inbox-container {
    flex-direction: column;
    height: auto;
  }
  .inbox-list-panel {
    width: 100%;
    min-width: unset;
    max-height: 50vh;
  }
  .inbox-detail-panel {
    min-height: 50vh;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/admin-inbox.css
git commit -m "feat(inbox): add inbox CSS — split-pane layout, email list, detail, reply"
```

---

### Task 11: Create inbox JavaScript module

**Files:**
- Create: `public/js/admin-inbox.js`

**Interfaces:**
- Produces: `window.AdminInbox` with `{ init(), load(), stop() }` methods
- Consumes: `window.AdminAuth.getToken()`, `window.AdminUtils.escHtml()`, inbox API endpoints

- [ ] **Step 1: Write the inbox JS module**

```js
(function () {
  'use strict';

  if (!document.getElementById('adminInboxSection')) return;

  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '';

  function getToken() {
    return window.AdminAuth ? window.AdminAuth.getToken() : sessionStorage.getItem('admin_token');
  }

  var state = {
    emails: [],
    selectedId: null,
    offset: 0,
    total: 0,
    unreadCount: 0,
    pollTimer: null,
  };

  var els = {
    list: document.getElementById('inboxList'),
    empty: document.getElementById('inboxEmpty'),
    loadMore: document.getElementById('inboxLoadMore'),
    detailEmpty: document.getElementById('inboxDetailEmpty'),
    detailContent: document.getElementById('inboxDetailContent'),
    emailSubject: document.getElementById('inboxEmailSubject'),
    emailFromName: document.getElementById('inboxEmailFromName'),
    emailFromAddr: document.getElementById('inboxEmailFromAddr'),
    emailDate: document.getElementById('inboxEmailDate'),
    emailBody: document.getElementById('inboxEmailBody'),
    attachments: document.getElementById('inboxAttachments'),
    attachmentsList: document.getElementById('inboxAttachmentsList'),
    replyTo: document.getElementById('inboxReplyTo'),
    replyBody: document.getElementById('inboxReplyBody'),
    replySend: document.getElementById('inboxReplySend'),
    replyStatus: document.getElementById('inboxReplyStatus'),
    deleteBtn: document.getElementById('inboxDeleteBtn'),
    refreshBtn: document.getElementById('inboxRefreshBtn'),
    badge: document.getElementById('inboxBadge'),
  };

  function esc(s) {
    return window.AdminUtils ? window.AdminUtils.escHtml(s) : String(s).replace(/</g, '&lt;');
  }

  function formatTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diffMs = now - d;
    var diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function previewText(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    var text = div.textContent || '';
    return text.substring(0, 100);
  }

  function updateBadge(count) {
    if (els.badge) {
      els.badge.textContent = count;
      els.badge.classList.toggle('admin-sidebar__badge--zero', count === 0);
    }
  }

  function renderList() {
    if (state.emails.length === 0) {
      els.empty.classList.remove('hidden');
      els.loadMore.classList.add('hidden');
      return;
    }
    els.empty.classList.add('hidden');

    var html = '';
    state.emails.forEach(function (e) {
      var isUnread = !e.read;
      var isActive = e.id === state.selectedId;
      html += '<div class="inbox-item' + (isUnread ? ' inbox-item--unread' : '') + (isActive ? ' inbox-item--active' : '') + '" data-id="' + esc(e.id) + '">' +
        '<span class="inbox-item__dot"></span>' +
        '<div class="inbox-item__content">' +
          '<div class="inbox-item__from">' + esc(e.fromName || e.fromEmail) + '</div>' +
          '<div class="inbox-item__subject">' + esc(e.subject || '(No subject)') + '</div>' +
          '<div class="inbox-item__preview">' + esc(previewText(e.bodyHtml || e.bodyPlain)) + '</div>' +
          '<div class="inbox-item__time">' + formatTime(e.receivedAt) + '</div>' +
        '</div>' +
      '</div>';
    });

    els.list.innerHTML = html + (els.list.querySelector('.inbox-empty') ? els.list.querySelector('.inbox-empty').outerHTML : '');

    if (els.list.querySelector('.inbox-empty')) {
      els.list.querySelector('.inbox-empty').classList.add('hidden');
    }

    // Click handlers
    els.list.querySelectorAll('.inbox-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        selectEmail(id);
      });
    });

    // Load more
    var hasMore = state.emails.length < state.total;
    els.loadMore.classList.toggle('hidden', !hasMore);
    updateBadge(state.unreadCount);
  }

  function selectEmail(id) {
    state.selectedId = id;
    renderList();

    // Load full detail
    fetch(apiBase + '/inbox/' + id, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.email) return;
        var e = data.email;
        els.detailEmpty.classList.add('hidden');
        els.detailContent.classList.remove('hidden');
        els.emailSubject.textContent = e.subject || '(No subject)';
        els.emailFromName.textContent = e.fromName || e.fromEmail;
        els.emailFromAddr.textContent = e.fromName ? e.fromEmail : '';
        els.emailDate.textContent = new Date(e.receivedAt).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        els.emailBody.innerHTML = e.bodyHtml || ('<p>' + esc(e.bodyPlain) + '</p>');
        els.replyTo.textContent = e.fromEmail;

        // Attachments
        if (e.attachments && e.attachments.length > 0) {
          els.attachments.classList.remove('hidden');
          els.attachmentsList.innerHTML = e.attachments.map(function (a) {
            return '<a href="' + esc(a.url) + '" class="inbox-attachment-item" target="_blank" rel="noopener">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
              '<span>' + esc(a.name || 'attachment') + '</span>' +
              '<span class="inbox-attachment-size">' + esc(formatSize(a.size)) + '</span>' +
            '</a>';
          }).join('');
        } else {
          els.attachments.classList.add('hidden');
        }

        // Mark as read if unread
        if (!e.read) {
          markAsRead(id);
        }
      })
      .catch(function (err) {
        console.error('Failed to load email detail:', err);
      });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function markAsRead(id) {
    fetch(apiBase + '/inbox/' + id + '/read', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function () {
        var email = state.emails.find(function (e) { return e.id === id; });
        if (email) { email.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
        renderList();
      })
      .catch(function () {});
  }

  function load() {
    fetch(apiBase + '/inbox?limit=50&offset=' + state.offset, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.emails = state.offset === 0 ? (data.emails || []) : state.emails.concat(data.emails || []);
        state.total = data.total || 0;
        state.unreadCount = data.unreadCount || 0;
        renderList();
      })
      .catch(function (err) {
        console.error('Failed to load inbox:', err);
      });
  }

  function pollUnread() {
    fetch(apiBase + '/inbox?limit=1', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.unreadCount !== state.unreadCount) {
          state.unreadCount = data.unreadCount || 0;
          updateBadge(state.unreadCount);
        }
      })
      .catch(function () {});
  }

  function startPolling() {
    state.pollTimer = setInterval(pollUnread, 30000);
  }

  function stop() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function sendReply() {
    var body = els.replyBody.value.trim();
    if (!body) return;

    var toEmail = els.replyTo.textContent;
    var subject = 'Re: ' + (els.emailSubject.textContent || 'Inquiry');

    els.replySend.disabled = true;
    els.replyStatus.textContent = 'Sending...';
    els.replyStatus.className = 'inbox-reply-status';

    fetch(apiBase + '/inbox/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
      },
      body: JSON.stringify({
        toEmail: toEmail,
        subject: subject,
        body: body,
        inReplyToId: state.selectedId,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        els.replyStatus.textContent = '✓ ' + data.message;
        els.replyStatus.className = 'inbox-reply-status inbox-reply-status--success';
        els.replyBody.value = '';
      })
      .catch(function (err) {
        els.replyStatus.textContent = '✗ ' + err.message;
        els.replyStatus.className = 'inbox-reply-status inbox-reply-status--error';
      })
      .finally(function () {
        els.replySend.disabled = false;
      });
  }

  function deleteEmail() {
    if (!state.selectedId) return;
    if (!confirm('Delete this email?')) return;

    fetch(apiBase + '/inbox/' + state.selectedId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    })
      .then(function () {
        state.emails = state.emails.filter(function (e) { return e.id !== state.selectedId; });
        state.total = Math.max(0, state.total - 1);
        state.selectedId = null;
        renderList();
        els.detailEmpty.classList.remove('hidden');
        els.detailContent.classList.add('hidden');
      })
      .catch(function (err) {
        console.error('Delete failed:', err);
      });
  }

  function init() {
    state.offset = 0;
    state.emails = [];
    load();
    startPolling();
  }

  // Event listeners
  if (els.loadMore) {
    els.loadMore.addEventListener('click', function () {
      state.offset = state.emails.length;
      load();
    });
  }

  if (els.replySend) {
    els.replySend.addEventListener('click', sendReply);
  }

  if (els.deleteBtn) {
    els.deleteBtn.addEventListener('click', deleteEmail);
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener('click', function () {
      state.offset = 0;
      state.emails = [];
      load();
    });
  }

  // Exports for dashboard tab switcher
  window.AdminInbox = {
    init: init,
    load: load,
    stop: stop,
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add public/js/admin-inbox.js
git commit -m "feat(inbox): add inbox JS — list, detail panel, reply composer, polling"
```

---

### Task 12: Wire Inbox into admin dashboard tab switcher

**Files:**
- Modify: `public/js/admin-dashboard.js`

- [ ] **Step 1: Add inbox section name and lazy-load**

In `public/js/admin-dashboard.js`, add `'adminInboxSection': 'Inbox'` to the `sectionNames` object. And add the lazy-load case in `switchSection`:

```js
// In sectionNames (around line 13-18), add:
var sectionNames = {
  'adminAnalyticsSection': 'Analytics',
  'adminRequestsSection': 'Form Requests',
  'adminBuilderSection': 'Document Builder',
  'adminEmailSection': 'Email',
  'adminInboxSection': 'Inbox',
};

// In switchSection (around line 40-48), add the Inbox case:
if (targetId === 'adminInboxSection' && window.AdminInbox) {
  window.AdminInbox.init();
}

// Also stop inbox polling when switching away (around line 35):
if (targetId !== 'adminInboxSection' && window.AdminInbox) {
  window.AdminInbox.stop();
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/admin-dashboard.js
git commit -m "feat(inbox): wire Inbox tab into admin dashboard navigation"
```

---

### Task 13: End-to-end verification

**Files:**
- Touch: none (manual testing)

- [ ] **Step 1: Start dev server and verify pages load**

Run: `npm start`
Open `http://localhost:3000` — home page loads.
Open `http://localhost:3000/admin` — admin dashboard loads with Inbox tab visible in sidebar.

- [ ] **Step 2: Test webhook endpoint locally**

Run:
```bash
curl -X POST http://localhost:3000/api/inbound/mailgun \
  -F "Message-Id=<test-local@mailgun>" \
  -F "from=Test User <test@example.com>" \
  -F "subject=Test inbound email" \
  -F "body-html=<p>Hello from Mailgun test</p>" \
  -F "body-plain=Hello from Mailgun test" \
  -F "Received=Sat, 11 Jul 2026 20:00:00 +0000" \
  -F "attachments=[]"
```

Expected: `{"received": true, "id": "..."}`

- [ ] **Step 3: Verify email appears in inbox**

Open admin in browser, login, click Inbox tab. The test email should appear in the list. Click it — detail panel shows body.

- [ ] **Step 4: Test reply flow**

Click reply, type a message, click Send Reply. Verify no error.

- [ ] **Step 5: Test polling**

Keep admin inbox open for 30+ seconds. If another test email arrives, the badge should update.

- [ ] **Step 6: Run full test suite again**

Run: `npx vitest run`
Expected: All tests pass (no regressions from dashboard.js changes).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: final testing + any remaining tweaks for inbox feature"
```

---

### Task 14: Deploy to Vercel + Mailgun DNS setup

**Files:**
- Touch: none (external configuration)

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

Vercel auto-deploys on push to main.

- [ ] **Step 2: Configure env vars on Vercel**

Add to Vercel project settings:
- `MAILGUN_WEBHOOK_KEY` — Mailgun webhook signing key
- `MAILGUN_DOMAIN` — e.g. `sandboxXXXXXXXXXX.mailgun.org` (or custom domain if verified)
- `INBOX_SENDER` — `Max Theodore <maxtheodore@carlingtonburling.com>`

- [ ] **Step 3: Set up Mailgun receiving domain**

1. Create Mailgun account (free tier)
2. Add `carlingtonburling.com` as a receiving domain
3. Configure webhook URL: `https://carlingtonburling.com/api/inbound/mailgun`
4. Get webhook signing key → paste into Vercel `MAILGUN_WEBHOOK_KEY`

- [ ] **Step 4: Add MX records to Cloudflare**

```
Type   Name   Mail server        Priority
MX     @      mxa.mailgun.org    10
MX     @      mxb.mailgun.org    10
```

- [ ] **Step 5: Verify MX records**

Run: `dig MX carlingtonburling.com`
Expected: Shows `mxa.mailgun.org` and `mxb.mailgun.org`

- [ ] **Step 6: Send test inbound email**

Send an email from any external address to `maxtheodore@carlingtonburling.com`. Check admin inbox — should appear within ~5 seconds.

- [ ] **Step 7: Commit final notes**

```bash
git add -A
git commit -m "docs: add Mailgun DNS setup notes to README"
```
