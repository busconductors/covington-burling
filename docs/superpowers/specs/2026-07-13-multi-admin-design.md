# Multi-User Admin System with Role-Based Permissions

**Date:** 2026-07-13
**Status:** Design approved

## Overview

Replace the single shared password admin system with a multi-user system supporting a master admin, staff accounts with granular permissions, and role templates. Integrates with existing Neon-backed session tokens.

**Current state:** One shared password (`PASSWORD` env var), anonymous sessions in `admin_sessions` table.

**Target state:** Individual admin accounts with username + password login, bcrypt-hashed passwords, per-user permissions stored as JSONB, master admin can create/manage users.

## 1. Database

### New table: `admin_users`

```sql
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_master     BOOLEAN DEFAULT false,
  permissions   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
```

### Migration: `admin_sessions`

```sql
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES admin_users(id);
```

### Seed: Master admin

On app startup, if `admin_users` is empty and `PASSWORD` env var is set, auto-create the master admin:
- username: `admin`
- display_name: `Master Admin`
- password: `PASSWORD` env var value
- is_master: `true`

### Permission keys

```json
{
  "analytics": true,
  "requests": true,
  "builder": true,
  "email": true,
  "inbox": true,
  "send_noreply": true,
  "send_maxtheodore": true,
  "manage_users": true
}
```

Master admins always have all permissions (`is_master = true` overrides the JSONB field).

## 2. Backend

### Dependencies
- `bcryptjs` (or `bcrypt`) for password hashing

### Config
- Remove `config.password` — no longer a single shared password
- Add `config.bcryptRounds = 12`

### New service: `backend/services/users.js`
- `createUser(username, displayName, password, permissions)` → creates user with bcrypt hash
- `validateCredentials(username, password)` → validates password, returns user object
- `getUser(id)` → returns user
- `listUsers()` → returns all users
- `updateUser(id, fields)` → update display name, permissions
- `deleteUser(id)` → delete user (cannot delete self, cannot delete last master)
- `resetPassword(id, newPassword)` → rehash + update

### Modified service: `backend/services/sessions.js`
- `createSession(userId)` → creates session linked to user
- `getUserForSession(token)` → returns user for a valid session (null if expired/invalid)
- Existing `validateSession` kept for backward compat, marked deprecated

### Modified middleware: `backend/middleware/auth.js`
- `requireAuth` → validates session + attaches `req.user` to request
- `requirePermission(key)` → new middleware, checks `req.user.permissions[key]` or `req.user.is_master`
- `requireMaster` → new middleware, checks `req.user.is_master`

### Login endpoint (modified)
- `POST /api/admin/login` — accepts `{username, password}` instead of `{password}`
- Returns: `{token, user: {id, username, displayName, isMaster, permissions}}`

### New endpoint: `GET /api/admin/me`
- Returns current user's info + permissions
- Used by frontend to show/hide tabs and check permissions

### New user management endpoints (master only)

| Endpoint | Purpose |
|---|---|
| `POST /api/admin/users` | Create user (body: username, displayName, password, permissions) |
| `GET /api/admin/users` | List all users |
| `PUT /api/admin/users/:id` | Update user (displayName, permissions) |
| `DELETE /api/admin/users/:id` | Delete user |
| `POST /api/admin/users/:id/reset-password` | Reset password |

### Permission checks on existing endpoints
Add `requirePermission(key)` middleware to each admin route:
- Analytics: `requirePermission('analytics')`
- Form Requests: `requirePermission('requests')`
- Document Builder: `requirePermission('builder')`
- Email Send: `requirePermission('email')` + check `send_noreply`/`send_maxtheodore` for from address
- Inbox: `requirePermission('inbox')` + check `send_maxtheodore` for reply from address

## 3. Frontend

### Login page (modified)
- Two fields: Username + Password (was just password)
- Same navy/gold design, same login card

### Dashboard sidebar (modified)
- Tabs hidden based on user permissions
- New "Users" tab visible only to master admins

### Top bar (modified)
- Shows "Logged in as [displayName]" instead of "Admin"
- Master badge for master admin

### New "Users" tab (master only)
- List of all admin users with last login time
- Add User button → modal with username, display name, password, permission checkboxes
- Edit Permissions button → modal with same checkboxes
- Reset Password button → modal with new password field
- Delete button → confirmation dialog

### Permission checkboxes in Add/Edit modal
```
☑ Analytics      ☑ Form Requests
☑ Document Builder  ☑ Email
☑ Inbox
Send As:
☑ noreply@carlingtonburling.com
☑ maxtheodore@carlingtonburling.com
```

### From address enforcement
Email tab: "From" dropdown shows only addresses the user has permission for.
Inbox tab: Reply "From" is fixed to maxtheodore@ if user has that permission.

## 4. Security

- Passwords hashed with bcrypt (12 rounds)
- Session tokens unchanged (128-bit random hex, 24h TTL)
- Cannot delete the last master admin
- Cannot modify your own permissions (master can't accidentally lock themselves out)
- Login rate limiting extended to per-username (existing window + global)
- Master admins can reset any user's password but cannot view existing passwords

## 5. Testing

- User creation + password validation
- Permission middleware (allowed, denied, master bypass)
- Login flow (valid, invalid password, unknown user)
- Master admin guard (non-master cannot create/list/delete users)
- Cannot delete last master admin
- Session linked to user

## 6. Verification

1. Log in as master admin (auto-created from `PASSWORD` env var)
2. Create a staff user with Email + Inbox permissions only
3. Log out, log in as staff — only Email and Inbox tabs visible
4. Staff cannot access Analytics, Requests, or Builder (returns 403)
5. Staff can compose emails and view inbox
6. Remove inbox permission from staff — Inbox tab disappears
7. Reset staff password, log in with new password
8. Delete staff account — staff can no longer log in
