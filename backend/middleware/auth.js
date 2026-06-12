const { validateSession } = require('../services/sessions');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  validateSession(token)
    .then(function (valid) {
      if (!valid) return res.status(401).json({ error: 'Unauthorized' });
      next();
    })
    .catch(function (err) {
      // fail closed: an auth-store outage must not grant access
      console.error('Session validation error:', err);
      res.status(401).json({ error: 'Unauthorized' });
    });
}

module.exports = { requireAuth };
