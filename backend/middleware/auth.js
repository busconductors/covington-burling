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
