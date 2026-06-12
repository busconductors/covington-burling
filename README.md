# Carlington & Burling LLP — Website

Professional website for **Carlington & Burling LLP**, a fictional law firm. Static marketing site plus an Express API for form requests, PDF generation, and an admin dashboard.

**Production:** https://carlingtonburling.com (Vercel)

## Architecture

```
User ──► Vercel CDN ──► static HTML/CSS/JS (public/)
                   └──► /api/* ──► Express (api/index.js → backend/)
                                     ├── Neon Postgres   (requests, sessions, rate limits, activity)
                                     ├── Resend          (transactional email)
                                     ├── Telegram bot    (admin notifications)
                                     └── pdfmake (lazy)  (waiver/NDA PDFs)
```

## Project Structure

```
covington-burling/
├── public/                     # Static site (Vercel outputDirectory)
│   ├── index.html / about.html / practice.html / contact.html / waiver-nda.html / 404.html
│   ├── admin/index.html        # Admin dashboard (login, requests, builder, email, analytics)
│   ├── css/                    # styles.css + admin styles
│   └── js/
│       ├── main.js             # Nav, scroll, accordion
│       ├── form-handler.js     # Shared form validation/submit engine
│       ├── contact-form.js     # Contact form config
│       ├── waiver-request.js   # Waiver/NDA request form config
│       ├── email-templates.js  # Branded email shell (dual-mode: browser + Node)
│       ├── admin-utils.js      # XSS escapers (dual-mode: browser + Node)
│       └── admin-*.js          # Admin dashboard modules
├── backend/
│   ├── index.js                # Composition root (Express app)
│   ├── config.js               # Env-derived config
│   ├── routes/                 # public.js (health, PDFs, submit, download), admin.js
│   ├── services/               # db, email, telegram, pdf, sessions, rate-limit, activity
│   └── middleware/auth.js      # Session-token auth
├── api/index.js                # Vercel serverless entry (exports the app)
├── server.js                   # Local dev entry — npm start
├── test/                       # vitest: route matrix, services, a11y, UI modules
├── .github/workflows/test.yml  # CI gate — npm test on push/PR
└── vercel.json                 # Headers (CSP, caching), rewrites
```

## Setup

```bash
npm install
npm start          # local server on :3000
npm test           # vitest suite
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `PASSWORD` | Admin login password |
| `RESEND_API_KEY` / `RESEND_SENDER` | Transactional email |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Admin notifications (optional — skipped when unset) |
| `SITE_URL` | Canonical site URL used in emails/links |
| `SESSION_TTL_HOURS` | Admin session lifetime (default 24) |

Tables (`admin_sessions`, `rate_limit_events`) are created automatically on first use; `form_requests` and `admin_activity` are expected to exist in Neon.

## Deployment

Vercel deploys automatically on push to `main` (CI must be green — `.github/workflows/test.yml`).

```bash
npx vercel          # preview deploy
npx vercel --prod   # production deploy
```

> **Legacy note:** an old Firebase Hosting deployment may still exist at
> `covington-burling-llp.web.app` serving a stale copy of the site. It should be
> decommissioned (`firebase hosting:disable` or delete the project in the
> Firebase console) — Vercel is the only deployment target.

## Security

- Admin auth: password login issues a revocable session token (Neon-backed, 24h TTL); logout revokes server-side
- Rate limiting: Neon-backed sliding window on `/api/admin/login` and `/api/request-forms`
- CSP + security headers via `vercel.json`; CORS pinned to the site origin
- All SQL via parameterized tagged templates; all user text escaped before HTML/Telegram rendering
- Download links: 128-bit random tokens, 7-day expiry

## Accessibility

WCAG 2.1 AA target. Structural rules (labels, roles, landmarks, names) are
enforced per page by `test/a11y.test.js` (axe-core) in CI. Color contrast is
audited manually — see TODOS.md for the Playwright-based contrast check.

## User Checklist

- [x] Domain purchased and live (carlingtonburling.com)
- [x] Contact form wired to backend + Telegram notifications
- [x] Rate limiting / abuse protection on public forms
- [ ] Decommission the stale Firebase deployment (covington-burling-llp.web.app)
- [ ] Rotate the Telegram bot token via BotFather (old token was committed to git history)
- [ ] Replace real-firm details with fictional ones (see TODOS / eng review D19)
- [ ] Review all content with stakeholders
- [ ] Add a privacy policy page
