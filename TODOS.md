# TODOS

Deferred work with context. Each item records why it was deferred and what
trigger should cause it to be picked up.

## 1. Content-hashed asset pipeline

- **What:** Replace `?v=N` manual cache-busting with content-hashed filenames + a build step that rewrites HTML references.
- **Why:** Immutable caching; removes the manual version-bump ritual that has already drifted (Firebase copy served v=2 while live was v=5).
- **Pros:** Best-possible cache behavior; no human forgets a bump.
- **Cons:** Introduces the site's first build pipeline for a ~10-page static site. Eng review D23 (2026-06-12) chose `Cache-Control` headers in vercel.json instead, precisely to avoid that.
- **Context:** `vercel-build` is currently just `npm install`; all HTML is hand-edited. Supersedes the Cache-Control approach if done.
- **Trigger:** Real traffic where cache misses measurably matter, or the site gaining a build step for another reason (e.g. templating migration).
- **Depends on:** Nothing.

## 2. Playwright-based color-contrast a11y checks

- **What:** Small Playwright run so axe-core can evaluate computed color contrast and focus order in a real browser.
- **Why:** The jsdom-based axe tests (eng review D16) pin ARIA/labels/landmarks but are structurally blind to contrast; the README's WCAG AA claim includes contrast ratios.
- **Pros:** Catches a color-token tweak that drops below 4.5:1; completes the AA verification story.
- **Cons:** Playwright is a heavyweight dev-dependency (browser binaries, CI minutes) for a small static site; contrast regressions are rare with a token-locked palette.
- **Context:** Design audits (2026-06-01) cover contrast manually so far.
- **Trigger:** Palette changes, or the first manual audit that finds a contrast regression automation would have caught.
- **Depends on:** D16 axe-core jsdom tests landing first (they establish the baseline).

## 3. Per-admin user accounts

- **What:** Replace the single shared admin password with per-admin accounts — hashed passwords, named identity in the audit log (`approved_by` becomes a real person), per-user session management.
- **Why:** With a shared password, a second admin means no accountability (every action logs as 'admin') and no way to off-board one person without locking out everyone.
- **Pros:** Real audit trail for a tool approving legal documents; clean off-boarding. The D5 sessions table (eng review 2026-06-12) already builds half the infrastructure.
- **Cons:** User management UI, password reset flow, migration — week-scale human effort that D5 deliberately avoided for a one-operator tool.
- **Context:** Extend the D5 sessions table and login plumbing; do NOT add a second shared-password user as a shortcut.
- **Trigger:** The first time a second person needs admin access — build this BEFORE granting it.
- **Depends on:** D5 session tokens landing first.
