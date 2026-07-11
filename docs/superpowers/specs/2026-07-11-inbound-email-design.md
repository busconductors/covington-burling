# Inbound Email: `maxtheodore@carlingtonburling.com`

**Date:** 2026-07-11
**Status:** Design approved

## Overview

Add two-way email for the firm's lead attorney — send and receive from `maxtheodore@carlingtonburling.com` — integrated into the admin dashboard as a new "Inbox" tab.

**Current state:** Resend handles outbound only (`noreply@...` for automated emails, admin compose for manual sends). No inbound capability.

**Target state:** `maxtheodore@...` is a full inbox. Resend stays as outbound sender (both `noreply@...` for automated and `maxtheodore@...` for composed replies). Mailgun handles inbound delivery via MX records and webhooks into the existing Express + Neon backend.

## Architecture

```
OUTBOUND (Resend)                     INBOUND (Mailgun)
┌──────────────────┐                 ┌──────────────────┐
│  noreply@...     │                 │  MX records →     │
│  (automated)     │                 │  maxtheodore@...  │
│  maxtheodore@... │                 │  webhook POST     │
│  (admin compose) │                 │       │           │
└──────────────────┘                 │       ▼           │
                                     │  /api/inbound/    │
                                     │  mailgun          │
                                     │       │           │
                                     │       ▼           │
                                     │  Neon: inbound_   │
                                     │  emails table     │
                                     │       │           │
                                     │       ▼           │
                                     │  Admin Inbox tab  │
                                     └──────────────────┘
```

No conflicts: Mailgun owns MX (inbound only), Resend owns SPF/DKIM (outbound only).

## 1. DNS (Cloudflare)

Add two MX records:

```
Type   Name   Mail server        Priority
MX     @      mxa.mailgun.org    10
MX     @      mxb.mailgun.org    10
```

Existing Resend SPF/DKIM records stay untouched.

## 2. Resend — `maxtheodore@...` as sender

Resend allows sending from any address on a verified domain. Since `carlingtonburling.com` is already verified, the admin compose/reply flow simply sets `from: 'Max Theodore <maxtheodore@carlingtonburling.com>'` in the Resend API call. No additional Resend configuration needed.

## 3. Mailgun Setup

- Add `carlingtonburling.com` as a receiving domain in Mailgun
- Set inbound route/webhook URL: `https://carlingtonburling.com/api/inbound/mailgun`
- Add `MAILGUN_WEBHOOK_KEY` env var for webhook signature verification
- Free tier: 100 inbound emails/day — sufficient for expected volume

## 4. Database — `inbound_emails` table

```sql
CREATE TABLE inbound_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    TEXT UNIQUE,           -- Mailgun's unique ID (dedup)
  from_email    TEXT NOT NULL,         -- sender's email
  from_name     TEXT,                  -- sender's display name
  subject       TEXT,                  -- email subject
  body_html     TEXT,                  -- HTML body (sanitized for XSS)
  body_plain    TEXT,                  -- plain text fallback
  received_at   TIMESTAMPTZ NOT NULL,  -- when Mailgun received it
  created_at    TIMESTAMPTZ DEFAULT now(),
  read          BOOLEAN DEFAULT false,
  attachments   JSONB DEFAULT '[]'     -- [{name, url, size, content_type}]
);
```

## 5. Backend — New service and endpoints

### `backend/services/inbound.js`
- `storeInboundEmail(payload)` — parse Mailgun webhook payload, sanitize HTML body, store in `inbound_emails`
- Dedup on `message_id` to handle Mailgun retries

### Public endpoint (no auth — Mailgun calls it)
- `POST /api/inbound/mailgun` — verify Mailgun webhook signature, parse payload, store in Neon. Returns 200 to acknowledge receipt.

### Admin endpoints (require session auth via existing `requireAuth` middleware)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/inbox` | GET | List emails (paginated, newest first). Query params: `limit`, `offset`. Response includes `unreadCount`. |
| `/api/admin/inbox/:id` | GET | Single email with full body + attachments |
| `/api/admin/inbox/:id/read` | POST | Mark as read |
| `/api/admin/inbox/reply` | POST | Send a reply via Resend from `maxtheodore@...`. Body: `{inReplyToId, toEmail, toName, subject, body}` |
| `/api/admin/inbox/:id` | DELETE | Delete/archive |

## 6. Frontend — New "Inbox" Admin Tab

A new tab in the admin dashboard, matching the existing design system (navy/gold palette, same typography).

### Layout
Split-pane: email list (left, ~35%) + detail panel (right, ~65%).

### Email List
- Shows: unread indicator, subject, sender name, preview snippet, relative timestamp
- Unread emails highlighted with gold left border
- Click = mark as read + load detail
- Unread count badge on the tab itself

### Detail Panel
- Renders sanitized HTML email body
- Shows sender, date, subject header
- Attachment list with clickable download links
- Inline reply composer:
  - Pre-filled: `from: maxtheodore@carlingtonburling.com`, `to: <original sender>`, `subject: Re: <original subject>`
  - Sends via `POST /api/admin/inbox/reply` (Resend)
  - Success/error feedback

### Polling
- Poll `GET /api/admin/inbox?limit=1` every 30 seconds for new email count
- Update unread badge if count changed

### Files
- `public/js/admin-inbox.js` — list, detail, reply, polling logic
- `public/css/admin-inbox.css` — inbox-specific styles
- `public/admin/index.html` — add Inbox tab to the existing tab bar

## 7. Security

- **Webhook verification:** Mailgun signing key validates authenticity of inbound webhooks (prevent spoofed emails)
- **HTML sanitization:** Inbound email HTML bodies are sanitized before storage and rendering (strip scripts, event handlers, external resources)
- **Attachment serving:** Attachments are stored/served via Mailgun's storage URLs (temporary, expiring). No direct file uploads to the server.
- **XSS prevention:** All user-controlled fields escaped when rendering in the inbox UI (reuse existing `admin-utils.js` escHtml)
- **Auth:** All inbox endpoints require session auth (except the Mailgun webhook endpoint)

## 8. Testing

- `POST /api/inbound/mailgun` — signature verification, dedup, storage
- `GET /api/admin/inbox` — pagination, unread count
- `POST /api/admin/inbox/reply` — sends via Resend, logs activity
- Inbox UI — list rendering, read/unread toggle, reply flow

## 9. Verification

1. Send a test email from an external address to `maxtheodore@carlingtonburling.com`
2. Confirm it appears in the admin inbox within ~5 seconds (Mailgun webhook latency)
3. Open it in the admin dashboard — body renders, attachments are downloadable
4. Send a reply from the admin — confirm it arrives at the external address, from `maxtheodore@carlingtonburling.com`
5. Verify `mxa.mailgun.org` and `mxb.mailgun.org` MX records are live
6. Verify webhook signature validation rejects spoofed requests
