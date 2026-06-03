// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Backend admin review enhancement coverage tests.
 *
 * The admin review enhancement (design spec 2026-06-02) added:
 *   1. sendRejectionEmail(toEmail, toName, reason) — Brevo rejection email
 *   2. rejectionReason validation in POST /api/admin/requests/:id/reject
 *   3. documentFields override in GET /api/download/:token
 *   4. adminMessage in sendBrevoEmail and approve endpoint
 *   5. Telegram messages include adminMessage (approve) and rejectionReason (reject)
 *
 * The backend module (backend/index.js) calls app.listen() at module scope and
 * does not export its internal functions. These tests recreate the equivalent
 * logic in test scope following the pattern in backend-telegram.test.js.
 */

// ── Recreated sendRejectionEmail (mirrors backend/index.js lines 151-205) ──
function sendRejectionEmail(toEmail, toName, reason, apiKey) {
  var key = apiKey || null;
  if (!key) {
    console.error('BREVO_API_KEY not configured');
    return Promise.reject(new Error('Email service not configured'));
  }

  var html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:40px 0;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #D5D5DE;border-radius:4px;">' +
    '<tr><td style="background-color:#0A1628;padding:32px 40px;text-align:center;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:28px;font-weight:600;color:#FFFFFF;margin:0;letter-spacing:-0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling LLP</p>' +
    '</td></tr>' +
    '<tr><td style="padding:40px;">' +
    '<p style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;color:#0A1628;margin:0 0 20px;font-weight:600;">Your Form Request Has Been Declined</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Dear ' + toName + ',</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:#1F1F2E;line-height:1.6;margin:0 0 12px;">Thank you for your interest in Carlington &amp; Burling LLP. After careful review, we are unable to provide the requested forms at this time.</p>' +
    '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:16px;margin:16px 0;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:13px;color:#991B1B;margin:0;font-weight:600;">Reason:</p>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#1F1F2E;line-height:1.6;margin:4px 0 0;">' + reason.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' +
    '</div>' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#5A5A6E;line-height:1.6;margin:24px 0 0;">If you have any questions, please contact our office at <a href="tel:+12026626000" style="color:#6B1C2E;">202-662-6000</a> or email us at <a href="mailto:info@carlingtonburling.com" style="color:#6B1C2E;">info@carlingtonburling.com</a>.</p>' +
    '</td></tr>' +
    '<tr><td style="background-color:#FAF8F5;padding:24px 40px;border-top:1px solid #D5D5DE;">' +
    '<p style="font-family:Montserrat,Arial,sans-serif;font-size:12px;color:#8A8A9E;margin:0;line-height:1.5;">This message is from Carlington &amp; Burling LLP, 850 Tenth Street NW, Washington, DC 20001. This email and any attachments are confidential and may be protected by attorney-client privilege.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    '</table>' +
    '</body>' +
    '</html>';

  var payload = {
    sender: { name: 'Carlington & Burling LLP', email: 'noreply@carlingtonburling.com' },
    to: [{ email: toEmail, name: toName }],
    subject: 'Your form request has been declined',
    htmlContent: html,
  };

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Recreated sendBrevoEmail (mirrors backend/index.js lines 75-148) ──
function sendBrevoEmail(toEmail, toName, formType, downloadToken, adminMessage, apiKey) {
  var key = apiKey || null;
  if (!key) {
    console.error('BREVO_API_KEY not configured');
    return Promise.reject(new Error('Email service not configured'));
  }

  var formLabel = formType === 'waiver' ? 'Waiver and Release of Liability'
    : formType === 'nda' ? 'Mutual Non-Disclosure Agreement'
    : 'Waiver and Release of Liability + Mutual Non-Disclosure Agreement';

  var adminMsgHtml = '';
  if (adminMessage) {
    adminMsgHtml = '<div style="background:#F0F4F8;border:1px solid #C5D3E8;border-radius:6px;padding:16px;margin:0 0 20px;"><p style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:#0A1628;line-height:1.6;margin:0;font-style:italic;">' + adminMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p></div>';
  }

  var html = '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<p>Test email</p>' +
    (adminMsgHtml ? adminMsgHtml : '') +
    '<p>Dear ' + toName + ',</p>' +
    '<p>' + formLabel + '</p>' +
    '</body></html>';

  var payload = {
    sender: { name: 'Carlington & Burling LLP', email: 'noreply@carlingtonburling.com' },
    to: [{ email: toEmail, name: toName }],
    subject: 'Your Carlington & Burling Legal Forms Are Ready',
    htmlContent: html,
  };

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Recreated rejection reason validation (mirrors backend/index.js lines 444-447) ──
function validateRejectionReason(body) {
  var reason = (body.rejectionReason || '').trim();
  if (!reason) {
    return { valid: false, error: 'Rejection reason is required.', status: 400 };
  }
  return { valid: true, reason: reason };
}

// ── Recreated documentFields resolution (mirrors backend/index.js lines 523-529) ──
function resolveNdaFields(data) {
  return data.documentFields || { clientName: data.name, clientAddress: data.company, effectiveDate: '' };
}

function resolveWaiverFields(data) {
  return data.documentFields || { clientName: data.name, date: '', matter: data.matterDescription };
}

// ── Recreated Telegram message builders for approve/reject ──
function buildApproveTelegram(data, adminMessage) {
  var msg = '<b>✅ Request Approved</b>\n' +
    '<b>Name:</b> ' + data.name + '\n' +
    '<b>Email:</b> ' + data.email + '\n' +
    '<b>Form:</b> ' + data.formType;
  if (adminMessage) msg += '\n<b>Note:</b> ' + adminMessage;
  return msg;
}

function buildRejectTelegram(data, rejectionReason) {
  return '<b>❌ Request Rejected</b>\n' +
    '<b>Name:</b> ' + data.name + '\n' +
    '<b>Email:</b> ' + data.email + '\n' +
    '<b>Form:</b> ' + data.formType + '\n' +
    '<b>Reason:</b> ' + rejectionReason;
}

// ── Recreated approve updateData builder (mirrors backend/index.js lines 397-405) ──
function buildApproveUpdateData(downloadToken, tokenExpiresAt, adminMessage, documentFields) {
  var now = new Date().toISOString();
  var updateData = {
    status: 'approved',
    approvedAt: now,
    approvedBy: 'admin',
    downloadToken: downloadToken,
    tokenExpiresAt: tokenExpiresAt,
  };
  if (adminMessage) updateData.adminMessage = adminMessage;
  if (documentFields) updateData.documentFields = documentFields;
  return updateData;
}

// ── Test helpers ────────────────────────────────────────────────────────
function mockFetchResponse(ok, data) {
  return {
    ok: ok,
    status: ok ? 200 : 400,
    json: function () { return Promise.resolve(data); },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// sendRejectionEmail
// ══════════════════════════════════════════════════════════════════════════
describe('sendRejectionEmail', function () {
  var origFetch;

  beforeEach(function () {
    origFetch = globalThis.fetch;
  });

  afterEach(function () {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  describe('happy path', function () {
    it('POSTs to Brevo API with correct URL and headers', async function () {
      var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'abc' }));
      globalThis.fetch = fetchSpy;

      await sendRejectionEmail('test@example.com', 'Test User', 'Not eligible', 'api-key-123');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
    });

    it('sends correct JSON payload with recipient, subject, and reason', async function () {
      var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'abc' }));
      globalThis.fetch = fetchSpy;

      await sendRejectionEmail('jane@example.com', 'Jane Doe', 'Not eligible for this form', 'api-key-123');

      var options = fetchSpy.mock.calls[0][1];
      expect(options.method).toBe('POST');
      expect(options.headers['api-key']).toBe('api-key-123');
      expect(options.headers['Content-Type']).toBe('application/json');

      var body = JSON.parse(options.body);
      expect(body.sender.name).toBe('Carlington & Burling LLP');
      expect(body.to[0].email).toBe('jane@example.com');
      expect(body.to[0].name).toBe('Jane Doe');
      expect(body.subject).toBe('Your form request has been declined');
    });

    it('includes the reason in the HTML body', async function () {
      var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'abc' }));
      globalThis.fetch = fetchSpy;

      await sendRejectionEmail('test@example.com', 'User', 'Not eligible', 'key');

      var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.htmlContent).toContain('Not eligible');
      expect(body.htmlContent).toContain('Your Form Request Has Been Declined');
      expect(body.htmlContent).toContain('Dear User,');
    });

    it('HTML-escapes angle brackets in the reason', async function () {
      var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'abc' }));
      globalThis.fetch = fetchSpy;

      await sendRejectionEmail('test@example.com', 'User', '<script>alert("xss")</script>', 'key');

      var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.htmlContent).toContain('&lt;script&gt;');
      expect(body.htmlContent).not.toContain('<script>alert');
    });

    it('returns parsed JSON on success', async function () {
      var response = { messageId: 'msg-456' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(true, response));

      var result = await sendRejectionEmail('test@example.com', 'User', 'Reason', 'key');
      expect(result).toEqual(response);
    });
  });

  describe('error path — no API key', function () {
    it('rejects when apiKey is falsy', async function () {
      var consoleSpy = vi.spyOn(console, 'error').mockImplementation(function () {});

      await expect(sendRejectionEmail('test@test.com', 'User', 'Reason', null)).rejects.toThrow('Email service not configured');
      expect(consoleSpy).toHaveBeenCalledWith('BREVO_API_KEY not configured');

      consoleSpy.mockRestore();
    });

    it('rejects when apiKey is empty string', async function () {
      await expect(sendRejectionEmail('test@test.com', 'User', 'Reason', '')).rejects.toThrow('Email service not configured');
    });
  });

  describe('error path — API returns non-ok', function () {
    it('throws the parsed error JSON', async function () {
      var errorBody = { code: 'unauthorized', message: 'Invalid API key' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(false, errorBody));

      await expect(sendRejectionEmail('test@test.com', 'User', 'Reason', 'bad-key')).rejects.toEqual(errorBody);
    });

    it('throws with the full error object', async function () {
      var errorBody = { code: 'invalid_parameter', message: 'Invalid email address' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(false, errorBody));

      try {
        await sendRejectionEmail('bad-email', 'User', 'Reason', 'key');
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e.code).toBe('invalid_parameter');
        expect(e.message).toBe('Invalid email address');
      }
    });
  });

  describe('error path — network/fetch failure', function () {
    it('rejects when fetch throws (network error)', async function () {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(sendRejectionEmail('test@test.com', 'User', 'Reason', 'key')).rejects.toThrow('ECONNREFUSED');
    });

    it('rejects when DNS resolution fails', async function () {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND api.brevo.com'));
      await expect(sendRejectionEmail('test@test.com', 'User', 'Reason', 'key')).rejects.toThrow('ENOTFOUND');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Rejection reason validation
// ══════════════════════════════════════════════════════════════════════════
describe('rejection reason validation', function () {
  it('returns 400 error when rejectionReason is empty string', function () {
    var result = validateRejectionReason({ rejectionReason: '' });
    expect(result.valid).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe('Rejection reason is required.');
  });

  it('returns 400 error when rejectionReason is whitespace only', function () {
    var result = validateRejectionReason({ rejectionReason: '   ' });
    expect(result.valid).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 400 error when rejectionReason is null/undefined', function () {
    var result = validateRejectionReason({});
    expect(result.valid).toBe(false);
    expect(result.status).toBe(400);
  });

  it('guards against null/undefined body (mirrors req.body || {} pattern)', function () {
    // Backend does: var body = req.body || {};  — so body is always an object
    var body = null;
    var safeBody = body || {};
    var result = validateRejectionReason(safeBody);
    expect(result.valid).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns valid with trimmed reason when non-empty', function () {
    var result = validateRejectionReason({ rejectionReason: '  Not eligible for this form  ' });
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('Not eligible for this form');
  });

  it('accepts reason with special characters', function () {
    var result = validateRejectionReason({ rejectionReason: 'Form not applicable — see <policy>' });
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('Form not applicable — see <policy>');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// documentFields resolution (download endpoint)
// ══════════════════════════════════════════════════════════════════════════
describe('documentFields resolution', function () {
  describe('NDA fields', function () {
    it('uses documentFields when present', function () {
      var data = {
        name: 'Jane Doe',
        company: 'Acme Corp',
        documentFields: { clientName: 'Edited Name', clientAddress: 'New Address', effectiveDate: 'June 10, 2026' },
      };
      var fields = resolveNdaFields(data);
      expect(fields.clientName).toBe('Edited Name');
      expect(fields.clientAddress).toBe('New Address');
      expect(fields.effectiveDate).toBe('June 10, 2026');
    });

    it('falls back to raw data when documentFields is null', function () {
      var data = { name: 'Jane Doe', company: 'Acme Corp', documentFields: null };
      var fields = resolveNdaFields(data);
      expect(fields.clientName).toBe('Jane Doe');
      expect(fields.clientAddress).toBe('Acme Corp');
      expect(fields.effectiveDate).toBe('');
    });

    it('falls back to raw data when documentFields is undefined', function () {
      var data = { name: 'John Smith', company: '' };
      var fields = resolveNdaFields(data);
      expect(fields.clientName).toBe('John Smith');
      expect(fields.clientAddress).toBe('');
      expect(fields.effectiveDate).toBe('');
    });
  });

  describe('Waiver fields', function () {
    it('uses documentFields when present', function () {
      var data = {
        name: 'Jane Doe',
        matterDescription: 'Original matter',
        documentFields: { clientName: 'Edited Name', date: 'June 2026', matter: 'Edited matter' },
      };
      var fields = resolveWaiverFields(data);
      expect(fields.clientName).toBe('Edited Name');
      expect(fields.date).toBe('June 2026');
      expect(fields.matter).toBe('Edited matter');
    });

    it('falls back to raw data when documentFields is null', function () {
      var data = { name: 'John Smith', matterDescription: 'Event waiver', documentFields: null };
      var fields = resolveWaiverFields(data);
      expect(fields.clientName).toBe('John Smith');
      expect(fields.date).toBe('');
      expect(fields.matter).toBe('Event waiver');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// sendBrevoEmail adminMessage branch
// ══════════════════════════════════════════════════════════════════════════
describe('sendBrevoEmail adminMessage', function () {
  var origFetch;

  beforeEach(function () {
    origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
  });

  afterEach(function () {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it('includes adminMsgHtml in body when adminMessage is provided', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('test@test.com', 'User', 'nda', 'token123', 'Hello from admin', 'key');

    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Hello from admin');
    expect(body.htmlContent).toContain('background:#F0F4F8');  // admin msg styling
  });

  it('does NOT include adminMsgHtml when adminMessage is null', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('test@test.com', 'User', 'nda', 'token123', null, 'key');

    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).not.toContain('background:#F0F4F8');
  });

  it('does NOT include adminMsgHtml when adminMessage is undefined', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('test@test.com', 'User', 'waiver', 'token456', undefined, 'key');

    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).not.toContain('background:#F0F4F8');
  });

  it('escapes HTML in adminMessage', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('test@test.com', 'User', 'both', 'token', '<b>bold</b>', 'key');

    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(body.htmlContent).not.toContain('<b>bold</b>');
  });

  it('converts newlines to <br> in adminMessage', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('test@test.com', 'User', 'nda', 'token', 'Line 1\nLine 2', 'key');

    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Line 1<br>Line 2');
  });

  it('formats formLabel correctly for each formType', async function () {
    var fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { messageId: 'ok' }));
    globalThis.fetch = fetchSpy;

    await sendBrevoEmail('a@b.com', 'U', 'waiver', 't', null, 'k');
    var body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Waiver and Release of Liability');

    await sendBrevoEmail('a@b.com', 'U', 'nda', 't', null, 'k');
    body = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(body.htmlContent).toContain('Mutual Non-Disclosure Agreement');

    await sendBrevoEmail('a@b.com', 'U', 'both', 't', null, 'k');
    body = JSON.parse(fetchSpy.mock.calls[2][1].body);
    expect(body.htmlContent).toContain('Waiver and Release of Liability + Mutual Non-Disclosure Agreement');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Approve updateData builder
// ══════════════════════════════════════════════════════════════════════════
describe('approve updateData builder', function () {
  it('always includes base fields (status, approvedAt, approvedBy, tokens)', function () {
    var updateData = buildApproveUpdateData('token-abc', '2026-06-09T00:00:00.000Z', null, null);

    expect(updateData.status).toBe('approved');
    expect(updateData.approvedAt).toBeTruthy();
    expect(updateData.approvedBy).toBe('admin');
    expect(updateData.downloadToken).toBe('token-abc');
    expect(updateData.tokenExpiresAt).toBe('2026-06-09T00:00:00.000Z');
  });

  it('includes adminMessage when provided', function () {
    var updateData = buildApproveUpdateData('t', '2026-06-09', 'Custom note', null);
    expect(updateData.adminMessage).toBe('Custom note');
  });

  it('does NOT include adminMessage when null', function () {
    var updateData = buildApproveUpdateData('t', '2026-06-09', null, null);
    expect(updateData.adminMessage).toBeUndefined();
  });

  it('includes documentFields when provided', function () {
    var fields = { clientName: 'Edited', clientAddress: 'Addr', effectiveDate: 'June 2026' };
    var updateData = buildApproveUpdateData('t', '2026-06-09', null, fields);
    expect(updateData.documentFields).toEqual(fields);
  });

  it('does NOT include documentFields when null', function () {
    var updateData = buildApproveUpdateData('t', '2026-06-09', null, null);
    expect(updateData.documentFields).toBeUndefined();
  });

  it('includes both adminMessage and documentFields when both provided', function () {
    var fields = { clientName: 'Name' };
    var updateData = buildApproveUpdateData('t', '2026-06-09', 'Note', fields);
    expect(updateData.adminMessage).toBe('Note');
    expect(updateData.documentFields).toEqual(fields);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Telegram message builders (approve/reject with new fields)
// ══════════════════════════════════════════════════════════════════════════
describe('Telegram approve/reject messages', function () {
  describe('approve message', function () {
    it('includes checkmark and basic fields', function () {
      var data = { name: 'Alice', email: 'alice@test.com', formType: 'nda' };
      var msg = buildApproveTelegram(data, null);

      expect(msg).toContain('✅ Request Approved');
      expect(msg).toContain('<b>Name:</b> Alice');
      expect(msg).toContain('<b>Email:</b> alice@test.com');
      expect(msg).toContain('<b>Form:</b> nda');
    });

    it('appends Note line when adminMessage is present', function () {
      var data = { name: 'Bob', email: 'bob@test.com', formType: 'waiver' };
      var msg = buildApproveTelegram(data, 'Please review carefully');

      expect(msg).toContain('<b>Note:</b> Please review carefully');
    });

    it('does NOT include Note line when adminMessage is null', function () {
      var data = { name: 'Carol', email: 'carol@test.com', formType: 'both' };
      var msg = buildApproveTelegram(data, null);

      expect(msg).not.toContain('<b>Note:</b>');
    });
  });

  describe('reject message', function () {
    it('includes X mark, basic fields, and rejection reason', function () {
      var msg = buildRejectTelegram(
        { name: 'Dan', email: 'dan@test.com', formType: 'waiver' },
        'Not eligible'
      );

      expect(msg).toContain('❌ Request Rejected');
      expect(msg).toContain('<b>Name:</b> Dan');
      expect(msg).toContain('<b>Email:</b> dan@test.com');
      expect(msg).toContain('<b>Form:</b> waiver');
      expect(msg).toContain('<b>Reason:</b> Not eligible');
    });

    it('includes full rejection reason text', function () {
      var msg = buildRejectTelegram(
        { name: 'Eve', email: 'eve@test.com', formType: 'nda' },
        'Form not applicable — see policy #123'
      );

      expect(msg).toContain('<b>Reason:</b> Form not applicable — see policy #123');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Fire-and-forget pattern (rejection email failure doesn't block response)
// ══════════════════════════════════════════════════════════════════════════
describe('rejection email fire-and-forget boundary', function () {
  it('.catch prevents email failure from propagating', async function () {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Brevo API down'));

    var consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(function () {});

    var responseSent = false;
    var result = sendRejectionEmail('test@test.com', 'User', 'Reason', 'key')
      .catch(function (err) {
        console.error(err);
      })
      .then(function () {
        responseSent = true;
      });

    await result;

    expect(responseSent).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
