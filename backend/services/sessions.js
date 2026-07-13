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
