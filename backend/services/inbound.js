var db = require('./db');

/**
 * Simple HTML sanitizer — strips script tags, event handlers, and
 * javascript: URLs. Not a replacement for a full sanitizer like DOMPurify,
 * but sufficient for email bodies rendered in a sandboxed context.
 */
function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<iframe[^>]*>/gi, '&lt;iframe&gt;')
    .replace(/<embed[^>]*>/gi, '&lt;embed&gt;')
    .replace(/<object[^>]*>/gi, '&lt;object&gt;');
}

/**
 * Parse a Mailgun "from" header like "Client Name <client@example.com>"
 * into { name, email }.
 */
function parseFromHeader(from) {
  if (!from) return { name: '', email: '' };
  var match = from.match(/^\s*(.+?)\s*<(.+?)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2] };
  return { name: '', email: from.trim() };
}

/**
 * Store an inbound email from a Mailgun webhook payload.
 * Deduplicates on message_id (Mailgun retries).
 *
 * @param {Object} payload — raw Mailgun webhook form-encoded payload
 * @returns {Promise<{id: string, message_id: string}>}
 */
function storeInboundEmail(payload) {
  var s = db.getSql();
  var messageId = payload['Message-Id'] || payload['message-id'] || '';
  var fromHeader = payload['from'] || '';
  var parsed = parseFromHeader(fromHeader);
  var subject = (payload['subject'] || '').substring(0, 500);
  var bodyHtml = sanitizeHtml(payload['body-html'] || payload['html'] || '');
  var bodyPlain = (payload['body-plain'] || payload['text'] || '').substring(0, 50000);
  var receivedAt = payload['Received'] ? new Date(payload['Received']).toISOString() : new Date().toISOString();

  var attachments;
  try {
    attachments = JSON.parse(payload['attachments'] || '[]');
  } catch (e) {
    attachments = [];
  }

  // Dedup: if message_id already exists, return the existing row
  return s`SELECT id, message_id FROM inbound_emails WHERE message_id = ${messageId}`
    .then(function (existing) {
      if (existing.length > 0) {
        return { id: existing[0].id, message_id: existing[0].message_id };
      }
      return s`INSERT INTO inbound_emails (message_id, from_email, from_name, subject, body_html, body_plain, received_at, attachments)
        VALUES (${messageId}, ${parsed.email}, ${parsed.name}, ${subject}, ${bodyHtml}, ${bodyPlain}, ${receivedAt}, ${JSON.stringify(attachments)})
        RETURNING id, message_id`
        .then(function (rows) {
          return rows[0];
        });
    });
}

module.exports = { storeInboundEmail, sanitizeHtml, parseFromHeader };
