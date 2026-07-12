# Cloudflare Email Workers — Swap Inbound Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mailgun inbound email with Cloudflare Email Workers — $0, serverless, already on Cloudflare DNS.

**Architecture:** Cloudflare MX routes inbound email to a Worker script. The Worker extracts headers + raw email, POSTs JSON to `POST /api/inbound/cloudflare`. Backend uses `mailparser` to parse raw MIME into structured data (HTML body, text body, attachments). Shared secret between Worker and API replaces Mailgun's HMAC signature.

**Tech Stack:** Cloudflare Workers (JS), Node.js `mailparser` package, Express (unchanged), Neon (unchanged), existing admin inbox UI (unchanged)

## Global Constraints

- Node.js 24.x on Vercel (CommonJS — `require`/`module.exports`)
- Cloudflare Worker uses ES modules (`export default`)
- `INBOUND_SECRET` env var shared between Worker script and Vercel
- `mailparser` must be added as a dependency
- Follow existing code patterns: Neon tagged templates, Express router pattern
- All existing tests must pass after changes
- Admin inbox UI, reply flow, polling — zero changes

## File Structure Map

| File | Action | Responsibility |
|------|--------|---------------|
| `workers/email-worker.js` | Create | Cloudflare Worker — receives email, POSTs JSON to API |
| `backend/services/inbound.js` | Rewrite | Parse raw email via mailparser, sanitize, store |
| `backend/routes/inbound.js` | Modify | Webhook endpoint: JSON body + shared secret auth |
| `backend/config.js` | Modify | `mailgunWebhookKey` → `inboundSecret`, remove `mailgunDomain` |
| `backend/index.js` | Modify | Clean up Mailgun-specific body limits |
| `test/inbound.test.js` | Rewrite | Test new `storeInboundEmail` with mailparser |
| `test/admin-inbox-routes.test.js` | Modify | Test Cloudflare webhook format instead of Mailgun |
| `package.json` | Modify | Add `mailparser` dependency |

### Unchanged files
- `public/admin/index.html` — no changes
- `public/js/admin-inbox.js` — no changes
- `public/css/admin-inbox.css` — no changes
- `public/js/admin-dashboard.js` — no changes
- Admin inbox API endpoints (`GET /api/admin/inbox`, `GET /api/admin/inbox/:id`, `POST /api/admin/inbox/:id/read`, `POST /api/admin/inbox/reply`, `DELETE /api/admin/inbox/:id`) — no changes
- `backend/services/email.js` — no changes
- `backend/services/db.js` — no changes
- Database schema — no changes

---

### Task 1: Install `mailparser` dependency

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install mailparser**

Run: `npm install mailparser`
Expected: Package added to `package.json` and `node_modules/`

- [ ] **Step 2: Verify install**

Run: `node -e "var mp = require('mailparser'); console.log(typeof mp.simpleParser);"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mailparser dependency for Cloudflare Email Worker inbound parsing"
```

---

### Task 2: Update config — remove Mailgun, add inbound secret

**Files:**
- Modify: `backend/config.js`

**Interfaces:**
- Removes: `config.mailgunWebhookKey`, `config.mailgunDomain`
- Adds: `config.inboundSecret`

- [ ] **Step 1: Rewrite config.js**

Read current `backend/config.js`. Replace the Mailgun-specific fields:

```js
module.exports = {
  password: process.env.PASSWORD || '',
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  inboxSender: process.env.INBOX_SENDER || 'Max Theodore <maxtheodore@carlingtonburling.com>',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  inboundSecret: process.env.INBOUND_SECRET || '',
  port: process.env.PORT || 3000,
};
```

- [ ] **Step 2: Verify**

Run: `node -e "var c = require('./backend/config'); console.log(c.inboundSecret === '' ? 'ok' : 'set', typeof c.mailgunWebhookKey === 'undefined' ? 'mailgun-removed' : 'STILL-THERE');"`
Expected: `ok mailgun-removed`

- [ ] **Step 3: Commit**

```bash
git add backend/config.js
git commit -m "refactor(config): replace Mailgun config with generic inboundSecret for Cloudflare"
```

---

### Task 3: Rewrite inbound service — mailparser instead of Mailgun fields

**Files:**
- Rewrite: `backend/services/inbound.js`

**Interfaces:**
- Removes: `parseFromHeader()` (no longer needed — mailparser does it)
- Modifies: `storeInboundEmail(payload)` → `storeInboundEmail(rawEmail, headers)` where `rawEmail` is RFC 2822 string and `headers` is `{from, to, subject, messageId}`
- Keeps: `sanitizeHtml()` (unchanged)

- [ ] **Step 1: Write the new service**

Replace `backend/services/inbound.js` entirely:

```js
var db = require('./db');
var { simpleParser } = require('mailparser');

/**
 * Simple HTML sanitizer — strips script tags, event handlers, and
 * javascript: URLs.
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
 * Store an inbound email from a Cloudflare Email Worker.
 * Parses raw RFC 2822 email via mailparser, sanitizes HTML body,
 * deduplicates on message_id.
 *
 * @param {string} rawEmail — raw RFC 2822 email source
 * @param {Object} headers — pre-extracted headers from Worker
 * @param {string} headers.messageId — Message-ID header value
 * @param {string} headers.from — From header value
 * @param {string} headers.subject — Subject header value
 * @returns {Promise<{id: string, message_id: string}>}
 */
function storeInboundEmail(rawEmail, headers) {
  var s = db.getSql();
  var messageId = headers.messageId || '';

  return simpleParser(rawEmail)
    .then(function (parsed) {
      var fromEmail = parsed.from ? parsed.from.value[0].address || '' : '';
      var fromName = parsed.from ? parsed.from.value[0].name || '' : '';
      var subject = (parsed.subject || headers.subject || '').substring(0, 500);
      var bodyHtml = sanitizeHtml(parsed.html || parsed.textAsHtml || '');
      var bodyPlain = (parsed.text || '').substring(0, 50000);
      var receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      var attachments = (parsed.attachments || []).map(function (att) {
        var buf = att.content;
        return {
          name: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          size: buf ? buf.length : 0,
          content: buf ? buf.toString('base64') : null,
        };
      });

      // Dedup on message_id
      return s`SELECT id, message_id FROM inbound_emails WHERE message_id = ${messageId}`
        .then(function (existing) {
          if (existing.length > 0) {
            return { id: existing[0].id, message_id: existing[0].message_id };
          }
          return s`INSERT INTO inbound_emails (message_id, from_email, from_name, subject, body_html, body_plain, received_at, attachments)
            VALUES (${messageId}, ${fromEmail}, ${fromName}, ${subject}, ${bodyHtml}, ${bodyPlain}, ${receivedAt}, ${JSON.stringify(attachments)})
            RETURNING id, message_id`
            .then(function (rows) {
              return rows[0];
            });
        });
    });
}

module.exports = { storeInboundEmail, sanitizeHtml };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "var inbound = require('./backend/services/inbound'); console.log('loaded', Object.keys(inbound));"`
Expected: `loaded [ 'storeInboundEmail', 'sanitizeHtml' ]`

- [ ] **Step 3: Commit**

```bash
git add backend/services/inbound.js
git commit -m "refactor(inbound): rewrite service to use mailparser for Cloudflare Email Worker raw email parsing"
```

---

### Task 4: Update webhook route — JSON + shared secret

**Files:**
- Modify: `backend/routes/inbound.js` (webhook endpoint only, line 14-40)

**Interfaces:**
- Old: `POST /api/inbound/mailgun` — form-encoded, HMAC signature, Mailgun field names
- New: `POST /api/inbound/cloudflare` — JSON body, shared secret header, raw email + headers

The admin inbox endpoints (lines 42-181) remain unchanged.

- [ ] **Step 1: Replace the webhook endpoint**

In `backend/routes/inbound.js`, replace lines 12-40 (the Mailgun webhook block) with:

```js
// ── Cloudflare Inbound Webhook (public, no auth) ──────────────────────
// Cloudflare Email Worker POSTs JSON: { from, to, subject, messageId, raw }
// Authenticated via shared secret in Authorization header.
router.post('/api/inbound/cloudflare', function (req, res) {
  var body = req.body || {};

  // Verify shared secret
  var authHeader = req.headers.authorization || '';
  var expectedBearer = 'Bearer ' + config.inboundSecret;
  if (config.inboundSecret && authHeader !== expectedBearer) {
    console.warn('Inbound webhook: invalid or missing secret');
    return res.status(403).json({ error: 'Forbidden' });
  }

  var raw = body.raw || '';
  if (!raw) {
    return res.status(400).json({ error: 'Missing raw email body' });
  }

  var headers = {
    from: body.from || '',
    subject: body.subject || '',
    messageId: body.messageId || '',
  };

  storeInboundEmail(raw, headers)
    .then(function (result) {
      res.json({ received: true, id: result.id });
    })
    .catch(function (err) {
      console.error('Inbound email storage error:', err);
      res.status(500).json({ error: 'Storage failed' });
    });
});
```

- [ ] **Step 2: Remove unused `crypto` require**

Remove `var crypto = require('crypto');` from line 2 of `backend/routes/inbound.js` (no longer needed — HMAC was Mailgun-specific).

- [ ] **Step 3: Verify module loads**

Run: `node -e "var r = require('./backend/routes/inbound'); console.log('loaded');"`
Expected: `loaded`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/inbound.js
git commit -m "refactor(inbound): replace Mailgun webhook with Cloudflare — JSON body + shared secret auth"
```

---

### Task 5: Clean up Express body limits

**Files:**
- Modify: `backend/index.js`

- [ ] **Step 1: Remove Mailgun-specific body limits**

Read `backend/index.js`. Find the line:

```js
app.use(['/api/admin/send-email', '/api/admin/send-email-attachment', '/api/inbound/mailgun'], express.json({ limit: '5mb' }));
```

Replace with:

```js
app.use(['/api/admin/send-email', '/api/admin/send-email-attachment', '/api/inbound/cloudflare'], express.json({ limit: '5mb' }));
```

Also remove the `express.urlencoded` line if it was only for Mailgun:

```js
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // ← remove this line
```

- [ ] **Step 2: Verify server boots**

Run: `timeout 4 node server.js 2>&1 || true`
Expected: `Carlington & Burling API listening on port 3000`

- [ ] **Step 3: Commit**

```bash
git add backend/index.js
git commit -m "refactor: clean up Express body limits — Cloudflare webhook uses JSON, not form-encoded"
```

---

### Task 6: Create Cloudflare Email Worker script

**Files:**
- Create: `workers/email-worker.js`

**Interfaces:**
- Produces: Cloudflare Worker deployed to `carlingtonburling.com` zone
- Consumes: `INBOUND_SECRET` (set as Cloudflare Worker secret), `INBOUND_WEBHOOK_URL` (default: `https://carlingtonburling.com/api/inbound/cloudflare`)

- [ ] **Step 1: Write the Worker script**

```js
/**
 * Cloudflare Email Worker — receives inbound email for
 * maxtheodore@carlingtonburling.com and forwards it as JSON
 * to the Express inbox API.
 *
 * Deploy: npx wrangler deploy workers/email-worker.js
 *   --name carlington-inbound
 *   --var INBOUND_WEBHOOK_URL:https://carlingtonburling.com/api/inbound/cloudflare
 *   --secret INBOUND_SECRET
 *
 * MX records (set in Cloudflare DNS):
 *   route1.mx.cloudflare.net  priority 10
 *   route2.mx.cloudflare.net  priority 20
 *   route3.mx.cloudflare.net  priority 30
 */

export default {
  async email(message, env) {
    var raw = await new Response(message.raw).text();

    var payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject') || '',
      messageId: message.headers.get('message-id') || '',
      raw: raw,
    };

    await fetch(env.INBOUND_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.INBOUND_SECRET,
      },
      body: JSON.stringify(payload),
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add workers/email-worker.js
git commit -m "feat(worker): add Cloudflare Email Worker for inbound email forwarding"
```

---

### Task 7: Update tests for new inbound service

**Files:**
- Rewrite: `test/inbound.test.js`
- Modify: `test/admin-inbox-routes.test.js`

- [ ] **Step 1: Rewrite `test/inbound.test.js`**

Replace with tests using mailparser (which parses real raw email strings, no mock needed):

```js
var assert = require('assert');
var { describe, it } = require('vitest');
var inbound = require('../backend/services/inbound');

// Mock db.getSql to avoid hitting real Neon
var db = require('../backend/services/db');
var origGetSql = db.getSql;

function mockDb(results) {
  db.getSql = function () {
    var s = function () {
      return {
        then: function (cb) { return Promise.resolve(results).then(cb); }
      };
    };
    return s;
  };
}

function restoreDb() {
  db.getSql = origGetSql;
}

describe('storeInboundEmail (Cloudflare)', function () {
  it('parses raw RFC 2822 email and stores it', async function () {
    mockDb([]); // SELECT returns empty (no dedup match)

    var rawEmail = [
      'From: Client Person <client@example.com>',
      'To: maxtheodore@carlingtonburling.com',
      'Subject: Question about NDA',
      'Date: Sat, 11 Jul 2026 20:00:00 +0000',
      'Message-ID: <msg-001@mail.example.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Hello Max, I have a question about the NDA terms.',
    ].join('\r\n');

    var headers = {
      from: 'Client Person <client@example.com>',
      subject: 'Question about NDA',
      messageId: '<msg-001@mail.example.com>',
    };

    mockDb([{ id: 'abc-123', message_id: '<msg-001@mail.example.com>' }]);
    var result = await inbound.storeInboundEmail(rawEmail, headers);
    assert.strictEqual(result.id, 'abc-123');
    restoreDb();
  });

  it('sanitizes HTML in parsed email body', async function () {
    mockDb([]);

    var rawEmail = [
      'From: test@example.com',
      'To: maxtheodore@carlingtonburling.com',
      'Subject: Test',
      'Date: Sat, 11 Jul 2026 20:00:00 +0000',
      'Message-ID: <msg-002@mail.example.com>',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Safe text</p><script>alert("xss")</script><img onerror="alert(1)" src=x>',
    ].join('\r\n');

    var headers = {
      from: 'test@example.com',
      subject: 'Test',
      messageId: '<msg-002@mail.example.com>',
    };

    mockDb([{ id: 'def-456', message_id: '<msg-002@mail.example.com>' }]);
    var result = await inbound.storeInboundEmail(rawEmail, headers);
    assert.strictEqual(result.id, 'def-456');
    restoreDb();
  });
});
```

- [ ] **Step 2: Run inbound tests**

Run: `npx vitest run test/inbound.test.js`
Expected: Tests pass using mailparser to parse the raw email fixtures.

- [ ] **Step 3: Update `test/admin-inbox-routes.test.js`**

Change the webhook test to use JSON + Bearer token instead of form-encoded + Mailgun fields:

```js
describe('POST /api/inbound/cloudflare', function () {
  it('accepts Cloudflare Worker JSON and returns 200', async function () {
    process.env.INBOUND_SECRET = 'test-secret';

    db.getSql = function () {
      var s = function () {
        return { then: function (cb) { return Promise.resolve([]).then(cb); } };
      };
      return s;
    };

    var rawEmail = [
      'From: Test <test@example.com>',
      'To: maxtheodore@carlingtonburling.com',
      'Subject: Test inbound',
      'Date: Sat, 11 Jul 2026 20:00:00 +0000',
      'Message-ID: <test-001@mail.example.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Hello',
    ].join('\r\n');

    var res = await request(app)
      .post('/api/inbound/cloudflare')
      .set('Authorization', 'Bearer test-secret')
      .send({
        from: 'Test <test@example.com>',
        to: 'maxtheodore@carlingtonburling.com',
        subject: 'Test inbound',
        messageId: '<test-001@mail.example.com>',
        raw: rawEmail,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.received, true);
    delete process.env.INBOUND_SECRET;
  });

  it('rejects requests without valid secret', async function () {
    process.env.INBOUND_SECRET = 'test-secret';

    var res = await request(app)
      .post('/api/inbound/cloudflare')
      .set('Authorization', 'Bearer wrong-secret')
      .send({ raw: 'test', from: '', subject: '', messageId: '' });

    assert.strictEqual(res.status, 403);
    delete process.env.INBOUND_SECRET;
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add test/inbound.test.js test/admin-inbox-routes.test.js
git commit -m "test(inbound): update tests for Cloudflare Email Worker — raw email parsing + shared secret auth"
```

---

### Task 8: Run full test suite + verify

**Files:**
- Touch: none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (185+ tests, no regressions). The new inbound tests pass. The existing admin inbox tests pass.

- [ ] **Step 2: Verify server boots**

Run: `timeout 4 node server.js 2>&1 || true`
Expected: `Carlington & Burling API listening on port 3000`

- [ ] **Step 3: Test webhook endpoint locally**

Run:
```bash
curl -X POST http://localhost:3000/api/inbound/cloudflare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-secret" \
  -d '{
    "from": "Test <test@example.com>",
    "to": "maxtheodore@carlingtonburling.com",
    "subject": "Test from Cloudflare",
    "messageId": "<local-test@example.com>",
    "raw": "From: Test <test@example.com>\r\nTo: maxtheodore@carlingtonburling.com\r\nSubject: Test from Cloudflare\r\nDate: Sat, 11 Jul 2026 20:00:00 +0000\r\nMessage-ID: <local-test@example.com>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from Cloudflare Worker test"
  }'
```

Expected: `{"received": true, "id": "..."}`

- [ ] **Step 4: Verify old Mailgun endpoint is gone**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/inbound/mailgun
```

Expected: `404`

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A && git commit -m "chore: final verification — all tests pass, webhook accepts Cloudflare format"
```

---

### Task 9: Deploy + User Setup

**Files:**
- Touch: none (external configuration)

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

Vercel auto-deploys.

- [ ] **Step 2: Update Vercel env vars**

Remove:
- `MAILGUN_WEBHOOK_KEY`
- `MAILGUN_DOMAIN`

Add:
- `INBOUND_SECRET` — generate a random 32-character string: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`

- [ ] **Step 3: Deploy Cloudflare Worker**

Run:
```bash
npx wrangler deploy workers/email-worker.js \
  --name carlington-inbound \
  --var INBOUND_WEBHOOK_URL:https://carlingtonburling.com/api/inbound/cloudflare
```

Then set the secret:
```bash
npx wrangler secret put INBOUND_SECRET
```

- [ ] **Step 4: Enable Email Routing in Cloudflare**

1. Go to Cloudflare Dashboard → `carlingtonburling.com` → **Email** → **Email Routing**
2. Enable Email Routing (adds MX records automatically if domain is on Cloudflare)
3. Go to **Workers Routes** → bind the `carlington-inbound` Worker to `maxtheodore@carlingtonburling.com`

- [ ] **Step 5: Verify end-to-end**

Send a test email from an external address to `maxtheodore@carlingtonburling.com`. Check admin inbox — should appear within seconds.
