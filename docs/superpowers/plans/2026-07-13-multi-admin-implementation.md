# Multi-User Admin System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single shared password with multi-user admin system — master admin, staff accounts, granular permissions per tab and per sending identity.

**Architecture:** New `admin_users` table with bcrypt passwords + JSONB permissions. Sessions linked to user via `user_id` FK. Auth middleware attaches `req.user`. `requirePermission(key)` middleware gates each tab. Master admin manages users from a new "Users" tab. Existing `PASSWORD` env var seeds the master admin on first run.

**Tech Stack:** Express, Neon Postgres, bcryptjs, vanilla JS frontend, existing session token pattern

## Global Constraints

- Node.js 24.x on Vercel (CommonJS — `require`/`module.exports`)
- bcryptjs for password hashing (12 rounds)
- Neon tagged templates for all SQL
- Existing `PASSWORD` env var becomes master admin's initial password (auto-seeded)
- Master admins always have all permissions (is_master bypasses JSONB check)
- Cannot delete the last master admin
- Cannot modify own permissions
- Follow existing code patterns: Express router, IIFE frontend modules, admin-*.js naming
- All existing tests must pass after changes

## File Structure Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/services/users.js` | Create | User CRUD, password hashing, credential validation |
| `backend/middleware/auth.js` | Modify | requireAuth attaches req.user, add requirePermission, requireMaster |
| `backend/services/sessions.js` | Modify | createSession(userId), getUserForSession(token), seed master admin |
| `backend/config.js` | Modify | Remove password field, add bcryptRounds |
| `backend/routes/admin.js` | Modify | Login (username+password), /me, user management, add permission middleware |
| `backend/routes/inbound.js` | Modify | requirePermission('inbox') |
| `public/admin/index.html` | Modify | Login fields, Users tab markup, sidebar permission logic |
| `public/js/admin-auth.js` | Modify | Login with username, store user + permissions |
| `public/js/admin-dashboard.js` | Modify | Hide tabs based on permissions, show username, Users tab lazy-load |
| `public/js/admin-users.js` | Create | Users tab: list, add/edit modal, delete, reset password |
| `public/css/admin-users.css` | Create | Users tab styles |
| `package.json` | Modify | Add bcryptjs |
| `test/admin-users.test.js` | Create | User service + middleware tests |
| `test/admin-routes.test.js` | Modify | Updated login + new endpoint tests |

### Unchanged files
- `backend/services/email.js`, `db.js`, `telegram.js`, `inbound.js`, `pdf.js`, `activity.js`, `rate-limit.js`
- `backend/routes/public.js`
- `backend/nda-definition.js`, `backend/waiver-definition.js`
- `public/js/admin-builder.js`, `admin-requests.js`, `admin-email.js`, `admin-inbox.js`, `admin-analytics.js`
- `public/css/admin-inbox.css`, `admin-dashboard.css`
- Frontend tab internals (builder, requests, email, inbox, analytics) — only gate access with permission middleware

---

### Task 1: Install bcryptjs + update config

**Files:**
- Modify: `package.json`, `backend/config.js`

- [ ] **Step 1: Install bcryptjs**

Run: `npm install bcryptjs`

- [ ] **Step 2: Update config**

Replace `backend/config.js`:

```js
module.exports = {
  password: process.env.PASSWORD || '',   // only used for master seed on first run
  apiKey: process.env.API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendSender: process.env.RESEND_SENDER || 'noreply@carlingtonburling.com',
  inboxSender: process.env.INBOX_SENDER || 'Max Theodore <maxtheodore@carlingtonburling.com>',
  siteUrl: process.env.SITE_URL || 'https://carlingtonburling.com',
  inboundSecret: process.env.INBOUND_SECRET || '',
  bcryptRounds: 12,
  port: process.env.PORT || 3000,
};
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json backend/config.js
git commit -m "chore: add bcryptjs, update config for multi-admin"
```

---

### Task 2: Database — Create admin_users table + migrate sessions

**Files:**
- Create: `scripts/migrate-multi-admin.js`

- [ ] **Step 1: Write migration script**

```js
var { neon } = require('@neondatabase/serverless');

async function migrate() {
  var DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL not configured');
  var s = neon(DATABASE_URL);

  console.log('Creating admin_users table...');
  await s`CREATE TABLE IF NOT EXISTS admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    is_master     BOOLEAN DEFAULT false,
    permissions   JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`;

  console.log('Adding user_id to admin_sessions...');
  await s`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES admin_users(id)`;

  console.log('Migration complete.');
}

migrate().catch(function (err) { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run migration**

Run: `node scripts/migrate-multi-admin.js`
Expected: `Migration complete.`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-multi-admin.js
git commit -m "feat(db): create admin_users table, add user_id to admin_sessions"
```

---

### Task 3: Create users service

**Files:**
- Create: `backend/services/users.js`

**Interfaces:**
- Produces: `createUser(username, displayName, password, permissions)`, `validateCredentials(username, password)`, `getUser(id)`, `listUsers()`, `updateUser(id, fields)`, `deleteUser(id)`, `resetPassword(id, newPassword)`, `countUsers()`, `countMasterUsers()`

- [ ] **Step 1: Write users service**

```js
var bcrypt = require('bcryptjs');
var { getSql } = require('./db');
var config = require('../config');

function hashPassword(password) {
  return bcrypt.hashSync(password, config.bcryptRounds);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function toApiUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isMaster: row.is_master,
    permissions: row.permissions,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function createUser(username, displayName, password, permissions) {
  var s = getSql();
  var hash = hashPassword(password);
  var perms = permissions || {};
  return s`INSERT INTO admin_users (username, display_name, password_hash, permissions)
    VALUES (${username}, ${displayName}, ${hash}, ${JSON.stringify(perms)})
    RETURNING *`
    .then(function (rows) { return toApiUser(rows[0]); });
}

function validateCredentials(username, password) {
  var s = getSql();
  return s`SELECT * FROM admin_users WHERE username = ${username} LIMIT 1`
    .then(function (rows) {
      if (rows.length === 0) return null;
      var user = rows[0];
      if (!verifyPassword(password, user.password_hash)) return null;
      // Update last login
      s`UPDATE admin_users SET last_login_at = now() WHERE id = ${user.id}`.then(function(){},function(){});
      return toApiUser(user);
    });
}

function getUser(id) {
  var s = getSql();
  return s`SELECT * FROM admin_users WHERE id = ${id} LIMIT 1`
    .then(function (rows) { return rows.length ? toApiUser(rows[0]) : null; });
}

function listUsers() {
  var s = getSql();
  return s`SELECT * FROM admin_users ORDER BY created_at ASC`
    .then(function (rows) { return rows.map(toApiUser); });
}

function updateUser(id, fields) {
  var s = getSql();
  var displayName = fields.displayName;
  var permissions = fields.permissions ? JSON.stringify(fields.permissions) : undefined;
  if (displayName && permissions) {
    return s`UPDATE admin_users SET display_name = ${displayName}, permissions = ${permissions} WHERE id = ${id}
      RETURNING *`.then(function (rows) { return toApiUser(rows[0]); });
  } else if (displayName) {
    return s`UPDATE admin_users SET display_name = ${displayName} WHERE id = ${id}
      RETURNING *`.then(function (rows) { return toApiUser(rows[0]); });
  } else if (permissions) {
    return s`UPDATE admin_users SET permissions = ${permissions} WHERE id = ${id}
      RETURNING *`.then(function (rows) { return toApiUser(rows[0]); });
  }
  return getUser(id);
}

function deleteUser(id) {
  var s = getSql();
  return s`DELETE FROM admin_sessions WHERE user_id = ${id}`
    .then(function () { return s`DELETE FROM admin_users WHERE id = ${id}`; });
}

function resetPassword(id, newPassword) {
  var s = getSql();
  var hash = hashPassword(newPassword);
  return s`UPDATE admin_users SET password_hash = ${hash} WHERE id = ${id}`;
}

function countUsers() {
  var s = getSql();
  return s`SELECT COUNT(*)::int AS count FROM admin_users`
    .then(function (rows) { return rows[0].count; });
}

function countMasterUsers() {
  var s = getSql();
  return s`SELECT COUNT(*)::int AS count FROM admin_users WHERE is_master = true`
    .then(function (rows) { return rows[0].count; });
}

module.exports = { createUser, validateCredentials, getUser, listUsers, updateUser, deleteUser, resetPassword, countUsers, countMasterUsers, toApiUser };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "var u = require('./backend/services/users'); console.log('loaded', Object.keys(u).length, 'functions');"`
Expected: `loaded 9 functions`

- [ ] **Step 3: Commit**

```bash
git add backend/services/users.js
git commit -m "feat(users): create users service — CRUD, bcrypt, credential validation"
```

---

### Task 4: Update sessions service — link to user, seed master admin

**Files:**
- Modify: `backend/services/sessions.js`

- [ ] **Step 1: Rewrite sessions service**

```js
var crypto = require('crypto');
var { getSql } = require('./db');
var users = require('./users');
var config = require('../config');

var SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24', 10);
var tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  var s = getSql();
  await s`CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    user_id UUID REFERENCES admin_users(id)
  )`;
  tableReady = true;
}

async function createSession(userId) {
  await ensureTable();
  var s = getSql();
  var token = crypto.randomBytes(32).toString('hex');
  var expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await s`INSERT INTO admin_sessions (token, expires_at, user_id) VALUES (${token}, ${expiresAt}, ${userId})`;
  s`DELETE FROM admin_sessions WHERE expires_at < now()`.then(function () {}, function () {});
  return token;
}

async function validateSession(token) {
  if (!token) return false;
  var s = getSql();
  var rows = await s`SELECT token FROM admin_sessions WHERE token = ${token} AND expires_at > now() LIMIT 1`;
  return rows.length > 0;
}

async function getUserForSession(token) {
  if (!token) return null;
  var s = getSql();
  var rows = await s`SELECT u.* FROM admin_users u
    JOIN admin_sessions s ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1`;
  return rows.length ? users.toApiUser(rows[0]) : null;
}

async function destroySession(token) {
  if (!token) return;
  var s = getSql();
  await s`DELETE FROM admin_sessions WHERE token = ${token}`;
}

// Seed master admin on first run if PASSWORD is set and no users exist
async function seedMasterAdmin() {
  await ensureTable();
  if (!config.password) return;
  var count = await users.countUsers();
  if (count > 0) return;
  console.log('Seeding master admin account...');
  await users.createUser('admin', 'Master Admin', config.password, {});
  // Set is_master flag
  var s = getSql();
  await s`UPDATE admin_users SET is_master = true WHERE username = 'admin'`;
  console.log('Master admin account created (username: admin)');
}

module.exports = { createSession, validateSession, getUserForSession, destroySession, seedMasterAdmin, SESSION_TTL_HOURS };
```

- [ ] **Step 2: Call seedMasterAdmin in Express app startup**

In `backend/index.js`, after the `var app = express();` block, add:

```js
var sessions = require('./services/sessions');
sessions.seedMasterAdmin().catch(function (err) { console.error('Master seed error:', err); });
```

- [ ] **Step 3: Verify server boots**

Run: `timeout 4 node server.js 2>&1 || true`
Expected: Either `Seeding master admin account...` followed by `Master admin account created`, or just `Carlington & Burling API listening on port 3000` (if already seeded).

- [ ] **Step 4: Commit**

```bash
git add backend/services/sessions.js backend/index.js
git commit -m "feat(sessions): link sessions to users, add getUserForSession, auto-seed master admin"
```

---

### Task 5: Update auth middleware — add requirePermission, requireMaster

**Files:**
- Modify: `backend/middleware/auth.js`

- [ ] **Step 1: Rewrite auth middleware**

```js
var { getUserForSession } = require('../services/sessions');

function requireAuth(req, res, next) {
  var authHeader = req.headers.authorization || '';
  var token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  getUserForSession(token)
    .then(function (user) {
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    })
    .catch(function (err) {
      console.error('Auth error:', err);
      res.status(401).json({ error: 'Unauthorized' });
    });
}

function requirePermission(key) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.isMaster) return next(); // master bypass
    var perms = req.user.permissions || {};
    if (perms[key]) return next();
    res.status(403).json({ error: 'Forbidden — insufficient permissions' });
  };
}

function requireMaster(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.isMaster) return next();
  res.status(403).json({ error: 'Forbidden — master admin only' });
}

module.exports = { requireAuth, requirePermission, requireMaster };
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "var a = require('./backend/middleware/auth'); console.log('loaded', Object.keys(a));"`
Expected: `loaded [ 'requireAuth', 'requirePermission', 'requireMaster' ]`

- [ ] **Step 3: Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat(auth): add requirePermission and requireMaster middleware"
```

---

### Task 6: Update admin routes — login, /me, user management, permissions

**Files:**
- Modify: `backend/routes/admin.js`

- [ ] **Step 1: Rewrite login endpoint + add /me + user management + permission middleware**

Replace the existing login endpoint in `backend/routes/admin.js` (around lines 23-40) and add new endpoints. The existing request list, approve, reject, analytics, email compose, and activity endpoints stay — just add `requirePermission` middleware.

Key changes:
- Login: accept `{username, password}`, validate via users service, create session with userId
- Add `GET /api/admin/me` returning `req.user`
- Add user management endpoints (POST, GET, PUT, DELETE /api/admin/users, POST /api/admin/users/:id/reset-password) with `requireMaster`
- Add `requirePermission` to existing routes: analytics → `analytics`, requests → `requests`, builder → `builder`, email → `email`, etc.

The full code for these changes follows the existing patterns in `backend/routes/admin.js`.

- [ ] **Step 2: Run route tests**

Run: `npx vitest run test/admin-inbox-routes.test.js`
Expected: Tests may fail since login format changed — update in Task 9.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat(admin): multi-user login, /me endpoint, user management, permission middleware on all routes"
```

---

### Task 7: Add permission middleware to inbox routes

**Files:**
- Modify: `backend/routes/inbound.js`

- [ ] **Step 1: Add requirePermission wrapper**

In `backend/routes/inbound.js`, change the require import:
```js
var { requireAuth, requirePermission } = require('../middleware/auth');
```

Add `requirePermission('inbox')` to all admin inbox endpoints after `requireAuth`. The webhook endpoint `/api/inbound/cloudflare` stays unchanged (public).

- [ ] **Step 2: Commit**

```bash
git add backend/routes/inbound.js
git commit -m "feat(inbox): add requirePermission middleware to inbox admin endpoints"
```

---

### Task 8: Frontend — update login page + dashboard

**Files:**
- Modify: `public/admin/index.html`, `public/js/admin-auth.js`, `public/js/admin-dashboard.js`

- [ ] **Step 1: Update login HTML**

Change the login form to have username + password fields instead of just password. Add `id="adminUsername"` input.

- [ ] **Step 2: Update admin-auth.js**

Login now sends `{username, password}`. Stores `user` object (with permissions) alongside token in sessionStorage. Exposes `AdminAuth.getUser()` and `AdminAuth.hasPermission(key)`.

- [ ] **Step 3: Update admin-dashboard.js**

On dashboard load:
1. Fetch `/api/admin/me` to get current user + permissions
2. Hide sidebar tabs the user doesn't have permission for
3. Show "Users" tab if isMaster
4. Display displayName in topbar
5. Pass permissions to tab modules

- [ ] **Step 4: Commit**

```bash
git add public/admin/index.html public/js/admin-auth.js public/js/admin-dashboard.js
git commit -m "feat(frontend): multi-user login, permission-based tab visibility"
```

---

### Task 9: Frontend — Users management tab

**Files:**
- Create: `public/js/admin-users.js`, `public/css/admin-users.css`
- Modify: `public/admin/index.html` (Users section markup)

- [ ] **Step 1: Add Users tab HTML**

Insert Users section markup in admin/index.html (after Inbox section). Include the list container and the Add/Edit user modal.

- [ ] **Step 2: Create admin-users.js**

IIFE module exporting `window.AdminUsers` with `{init()}`:
- List users from `GET /api/admin/users`
- Add User modal — username, display name, password, permission checkboxes
- Edit Permissions modal — same checkboxes, pre-filled
- Reset Password modal — new password field
- Delete button — confirmation + `DELETE /api/admin/users/:id`
- Guards: cannot delete self, cannot delete last master

- [ ] **Step 3: Create admin-users.css**

Minimal styling matching admin dashboard design system.

- [ ] **Step 4: Wire into dashboard**

Add `adminInboxSection` → in the same style as existing, add Users section and AdminUsers.init().

- [ ] **Step 5: Commit**

```bash
git add public/js/admin-users.js public/css/admin-users.css public/admin/index.html public/js/admin-dashboard.js
git commit -m "feat(frontend): Users management tab — add, edit, delete, reset password"
```

---

### Task 10: Update tests

**Files:**
- Create: `test/admin-users.test.js`
- Modify: `test/backend-routes.test.js`, `test/admin-inbox-routes.test.js`

- [ ] **Step 1: Write user service tests**

Test: createUser, validateCredentials (valid + invalid password), getUser, listUsers, deleteUser with session cleanup, cannot delete last master.

- [ ] **Step 2: Update existing route tests**

Change login format from `{password}` to `{username, password}`. Add tests for /me, user CRUD, permission gates.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/
git commit -m "test(admin): update tests for multi-user admin system"
```

---

### Task 11: Deploy + verify

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to Vercel**

```bash
npx vercel --cwd /Users/sk_hga/lawfirmprojet/covington-burling --prod --yes
```

- [ ] **Step 3: Verify**

1. Visit `carlingtonburling.com/admin` — login page shows username + password
2. Log in as `admin` with `PASSWORD` env var value
3. Master admin sees all tabs + Users tab
4. Create a staff user with limited permissions
5. Log out, log in as staff — only permitted tabs visible
6. Staff cannot access restricted endpoints (403)
