const { getSql } = require('./db');

// Neon-backed sliding-window rate limiting. In-memory counters reset on
// every serverless cold start, which makes them decorative on Vercel —
// the window has to live in the database to actually count.

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const s = getSql();
  await s`CREATE TABLE IF NOT EXISTS rate_limit_events (
    bucket TEXT NOT NULL,
    identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  tableReady = true;
}

async function checkRateLimit(bucket, identifier, maxAttempts, windowMinutes) {
  await ensureTable();
  const s = getSql();
  const rows = await s`SELECT COUNT(*)::int AS count FROM rate_limit_events
    WHERE bucket = ${bucket} AND identifier = ${identifier}
    AND created_at > now() - make_interval(mins => ${windowMinutes})`;
  if (rows[0].count >= maxAttempts) return false;
  await s`INSERT INTO rate_limit_events (bucket, identifier) VALUES (${bucket}, ${identifier})`;
  // opportunistic cleanup; failure is irrelevant
  s`DELETE FROM rate_limit_events WHERE created_at < now() - interval '1 day'`.then(function () {}, function () {});
  return true;
}

// Express middleware factory. Fails open on store errors: if Neon is down,
// the protected operation is about to fail on its own DB call anyway, and
// locking legitimate users out during an outage is the worse trade.
function rateLimitMiddleware(options) {
  return function (req, res, next) {
    var identifier = req.ip || 'unknown';
    checkRateLimit(options.bucket, identifier, options.max, options.windowMinutes)
      .then(function (allowed) {
        if (!allowed) {
          return res.status(429).json({ error: options.message || 'Too many requests. Please try again later.' });
        }
        next();
      })
      .catch(function (err) {
        console.error('Rate limit check failed (allowing request):', err);
        next();
      });
  };
}

module.exports = { rateLimitMiddleware, checkRateLimit };
