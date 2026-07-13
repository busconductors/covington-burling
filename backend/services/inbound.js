var db = require('./db');
var { simpleParser } = require('mailparser');

/**
 * Simple HTML sanitizer — strips script tags, event handlers, and
 * javascript: URLs.
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
 * Store an inbound email from a Cloudflare Email Worker.
 * Parses raw RFC 2822 email via mailparser, sanitizes HTML body,
 * deduplicates on message_id.
 *
 * @param {string} rawEmail — raw RFC 2822 email source
 * @param {Object} headers — pre-extracted headers from Worker
 * @param {string} headers.messageId — Message-ID header value
 * @param {string} headers.from — From header value
 * @param {string} headers.subject — Subject header value
 * @returns {Promise<{id: string, message_id: string}>}
 */
function storeInboundEmail(rawEmail, headers) {
  var s = db.getSql();
  var messageId = headers.messageId || '';

  return simpleParser(rawEmail)
    .then(function (parsed) {
      var fromEmail = parsed.from ? parsed.from.value[0].address || '' : '';
      var fromName = parsed.from ? parsed.from.value[0].name || '' : '';
      var subject = (parsed.subject || headers.subject || '').substring(0, 500);
      var bodyHtml = sanitizeHtml(parsed.html || parsed.textAsHtml || '');
      var bodyPlain = (parsed.text || '').substring(0, 50000);
      var receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      var attachments = (parsed.attachments || []).map(function (att) {
        var buf = att.content;
        return {
          name: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          size: buf ? buf.length : 0,
          content: buf ? buf.toString('base64') : null,
        };
      });

      // Dedup on message_id
      return s`SELECT id, message_id FROM inbound_emails WHERE message_id = ${messageId}`
        .then(function (existing) {
          if (existing.length > 0) {
            return { id: existing[0].id, message_id: existing[0].message_id };
          }
          return s`INSERT INTO inbound_emails (message_id, from_email, from_name, subject, body_html, body_plain, received_at, attachments)
            VALUES (${messageId}, ${fromEmail}, ${fromName}, ${subject}, ${bodyHtml}, ${bodyPlain}, ${receivedAt}, ${JSON.stringify(attachments)})
            RETURNING id, message_id`
            .then(function (rows) {
              return rows[0];
            });
        });
    });
}

module.exports = { storeInboundEmail, sanitizeHtml };
