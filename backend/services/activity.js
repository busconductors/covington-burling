const { getSql } = require('./db');

function logActivity(action, details) {
  try {
    const s = getSql();
    return s`INSERT INTO admin_activity (action, details) VALUES (${action}, ${JSON.stringify(details)})`.then(function () {});
  } catch (err) {
    console.error('Activity log error:', err);
    return Promise.resolve();
  }
}

module.exports = { logActivity };
