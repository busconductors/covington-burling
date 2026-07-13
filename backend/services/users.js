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
