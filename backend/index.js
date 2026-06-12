// Composition root — request flow:
//
//   client ──► express.json ──► routes/public.js  (health, PDFs, form submit, token download)
//                          └──► routes/admin.js   (login + 8 auth'd admin endpoints)
//                          └──► static fallbacks  (/, custom 404)
//
// Services (services/*) own the external boundaries: Neon (db), Resend
// (email), Telegram (telegram), pdfmake (pdf, lazy-loaded).
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
// Vercel terminates TLS in front of Express; trust the forwarded IP so
// rate limiting sees the real client, not the proxy.
app.set('trust proxy', 1);
app.use(cors({ origin: config.siteUrl }));
// Only the email routes carry base64 PDF attachments; everything else —
// including the unauthenticated public forms — gets the small default.
app.use(['/api/admin/send-email', '/api/admin/send-email-attachment'], express.json({ limit: '5mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  next(err);
});

app.use(require('./routes/public'));
app.use(require('./routes/admin'));

// Serve index.html for root (Vercel may route / to Express)
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Custom 404 for non-API routes that reach Express
app.use(function (req, res) {
  if (req.path.indexOf('/api/') === 0) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(config.port, function () {
    console.log('Carlington & Burling API listening on port ' + config.port);
  });
}
