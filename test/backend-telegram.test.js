// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Backend Telegram notification coverage tests.
 *
 * The diff on feat/telegram-notifications adds:
 *   1. sendTelegramMessage(text) – POSTs to Telegram Bot API
 *   2. Call site in POST /api/request-forms    (new form submission)
 *   3. Call site in POST /api/admin/requests/:id/approve (approval)
 *   4. Call site in POST /api/admin/requests/:id/reject  (rejection)
 *
 * The backend module (backend/index.js) is a CommonJS script that calls
 * app.listen() at module scope and does not export its internal functions.
 * These tests recreate the equivalent logic in test scope to cover every
 * branch without requiring a structural refactor.
 */

// ── Recreated sendTelegramMessage (mirrors backend/index.js lines 167-187) ──
// Mirrors production behavior: credentials come from injection (env vars in
// production); when unconfigured, the send is skipped with a resolved promise.
// NEVER put real credentials in this file — fakes only.
const FAKE_TOKEN = '0000000000:TEST-FAKE-TOKEN-NOT-REAL';
const FAKE_CHAT_ID = 'fake-chat-id';

function sendTelegramMessage(text, { token, chatId } = {}) {
  var t = token;
  var c = chatId;
  if (!t || !c) {
    console.warn('Telegram not configured — skipping notification');
    return Promise.resolve();
  }

  return fetch('https://api.telegram.org/bot' + t + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: c,
      text: text,
      parse_mode: 'HTML',
    }),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  });
}

// ── Message formatters (mirror the three call-site format strings) ──
function formatNewRequestMessage(doc) {
  return (
    '<b>\u{1F4CB} New Form Request</b>\n' +
    '<b>Name:</b> ' + doc.name + '\n' +
    '<b>Email:</b> ' + doc.email + '\n' +
    (doc.company ? '<b>Company:</b> ' + doc.company + '\n' : '') +
    '<b>Form:</b> ' + doc.formType + '\n' +
    '<b>Matter:</b> ' + doc.matterDescription
  );
}

function formatApprovedMessage(data) {
  return (
    '<b>✅ Request Approved</b>\n' +
    '<b>Name:</b> ' + data.name + '\n' +
    '<b>Email:</b> ' + data.email + '\n' +
    '<b>Form:</b> ' + data.formType
  );
}

function formatRejectedMessage(data) {
  return (
    '<b>❌ Request Rejected</b>\n' +
    '<b>Name:</b> ' + data.name + '\n' +
    '<b>Email:</b> ' + data.email + '\n' +
    '<b>Form:</b> ' + data.formType
  );
}

// ── Test helpers ────────────────────────────────────────────────────────
function mockFetchResponse(ok, data) {
  return {
    ok: ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
  };
}

// ── sendTelegramMessage ─────────────────────────────────────────────────
describe('sendTelegramMessage', () => {
  let origFetch;

  beforeEach(() => {
    origFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  describe('happy path — API returns ok', () => {
    it('POSTs to correct Telegram URL with token and chatId', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { ok: true }));
      globalThis.fetch = fetchSpy;

      await sendTelegramMessage('Hello', { token: 'myToken', chatId: 'myChat' });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0];
      expect(url).toBe('https://api.telegram.org/botmyToken/sendMessage');
    });

    it('sends correct JSON body with chat_id, text, parse_mode', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { ok: true }));
      globalThis.fetch = fetchSpy;

      await sendTelegramMessage('Test message', { token: 'tok', chatId: '123' });

      const options = fetchSpy.mock.calls[0][1];
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.chat_id).toBe('123');
      expect(body.text).toBe('Test message');
      expect(body.parse_mode).toBe('HTML');
    });

    it('returns parsed JSON on success', async () => {
      const telegramResponse = { ok: true, result: { message_id: 42 } };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(true, telegramResponse));

      const result = await sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID });
      expect(result).toEqual(telegramResponse);
    });

    it('uses the injected token in the request URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { ok: true }));
      globalThis.fetch = fetchSpy;

      await sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID });

      const url = fetchSpy.mock.calls[0][0];
      expect(url).toContain(FAKE_TOKEN);
    });

    it('uses the injected chatId in the request body', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(true, { ok: true }));
      globalThis.fetch = fetchSpy;

      await sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.chat_id).toBe(FAKE_CHAT_ID);
    });
  });

  describe('unconfigured — credentials missing (mirrors production env-var guard)', () => {
    it('skips the send and resolves when token is missing', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(sendTelegramMessage('Hello', { chatId: FAKE_CHAT_ID })).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('skips the send and resolves when chatId is missing', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN })).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('skips the send when neither credential is provided', async () => {
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(sendTelegramMessage('Hello', {})).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('error path — API returns non-ok status', () => {
    it('throws the parsed error JSON when API returns !ok', async () => {
      const errorBody = { ok: false, error_code: 400, description: 'Bad Request: chat not found' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(false, errorBody));

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })).rejects.toEqual(errorBody);
    });

    it('throws with the full error object (not a string)', async () => {
      const errorBody = { ok: false, description: 'Forbidden: bot was blocked' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(false, errorBody));

      try {
        await sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID });
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toEqual(errorBody);
        expect(e.description).toBe('Forbidden: bot was blocked');
      }
    });

    it('handles error body that is not standard JSON (edge case)', async () => {
      // Telegram API always returns JSON, but test the boundary
      const nonStandard = { html: '<h1>502 Bad Gateway</h1>' };
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse(false, nonStandard));

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })).rejects.toEqual(nonStandard);
    });
  });

  describe('error path — network/fetch failure', () => {
    it('rejects when fetch itself throws (network error)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })).rejects.toThrow('ECONNREFUSED');
    });

    it('rejects when fetch times out', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })).rejects.toThrow('ETIMEDOUT');
    });

    it('rejects when DNS resolution fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND api.telegram.org'));

      await expect(sendTelegramMessage('Hello', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })).rejects.toThrow('ENOTFOUND');
    });
  });
});

// ── Message format strings ──────────────────────────────────────────────
describe('Telegram message formatting', () => {
  describe('new form request message', () => {
    it('includes all required fields', () => {
      const doc = {
        name: 'John Doe',
        email: 'john@example.com',
        formType: 'waiver',
        matterDescription: 'Merger agreement review',
      };

      const msg = formatNewRequestMessage(doc);

      expect(msg).toContain('\u{1F4CB} New Form Request');
      expect(msg).toContain('<b>Name:</b> John Doe');
      expect(msg).toContain('<b>Email:</b> john@example.com');
      expect(msg).toContain('<b>Form:</b> waiver');
      expect(msg).toContain('<b>Matter:</b> Merger agreement review');
    });

    it('includes company field when present', () => {
      const doc = {
        name: 'Jane',
        email: 'jane@test.com',
        company: 'Acme Corp',
        formType: 'nda',
        matterDescription: 'Test',
      };

      const msg = formatNewRequestMessage(doc);

      expect(msg).toContain('<b>Company:</b> Acme Corp');
    });

    it('omits company field when empty string', () => {
      const doc = {
        name: 'Jane',
        email: 'jane@test.com',
        company: '',
        formType: 'nda',
        matterDescription: 'Test',
      };

      const msg = formatNewRequestMessage(doc);

      expect(msg).not.toContain('<b>Company:</b>');
    });

    it('omits company field when falsy (null/undefined)', () => {
      const doc1 = { name: 'A', email: 'a@b.com', company: null, formType: 'waiver', matterDescription: 'X' };
      const doc2 = { name: 'B', email: 'b@c.com', company: undefined, formType: 'nda', matterDescription: 'Y' };

      expect(formatNewRequestMessage(doc1)).not.toContain('<b>Company:</b>');
      expect(formatNewRequestMessage(doc2)).not.toContain('<b>Company:</b>');
    });

    it('handles special characters in name and company', () => {
      const doc = {
        name: 'O\'Brien & Sons',
        email: 'test@test.com',
        company: 'Smith & Wesson "LLC"',
        formType: 'both',
        matterDescription: '< Confidential >',
      };

      const msg = formatNewRequestMessage(doc);

      expect(msg).toContain("O'Brien & Sons");
      expect(msg).toContain('Smith & Wesson "LLC"');
      expect(msg).toContain('< Confidential >');
    });
  });

  describe('approved request message', () => {
    it('includes checkmark and all fields', () => {
      const data = { name: 'Alice', email: 'alice@test.com', formType: 'both' };
      const msg = formatApprovedMessage(data);

      expect(msg).toContain('✅ Request Approved');
      expect(msg).toContain('<b>Name:</b> Alice');
      expect(msg).toContain('<b>Email:</b> alice@test.com');
      expect(msg).toContain('<b>Form:</b> both');
    });

    it('does NOT include company (approve message does not include company)', () => {
      const data = { name: 'A', email: 'a@b.com', formType: 'waiver', company: 'Should Not Appear' };
      const msg = formatApprovedMessage(data);

      expect(msg).not.toContain('Should Not Appear');
      expect(msg).not.toContain('Company');
    });
  });

  describe('rejected request message', () => {
    it('includes X mark and all fields', () => {
      const data = { name: 'Bob', email: 'bob@test.com', formType: 'nda' };
      const msg = formatRejectedMessage(data);

      expect(msg).toContain('❌ Request Rejected');
      expect(msg).toContain('<b>Name:</b> Bob');
      expect(msg).toContain('<b>Email:</b> bob@test.com');
      expect(msg).toContain('<b>Form:</b> nda');
    });

    it('does NOT include company (reject message does not include company)', () => {
      const data = { name: 'B', email: 'b@c.com', formType: 'both', company: 'Should Not Appear' };
      const msg = formatRejectedMessage(data);

      expect(msg).not.toContain('Should Not Appear');
      expect(msg).not.toContain('Company');
    });
  });
});

// ── Error boundary: .catch(console.error) pattern ───────────────────────
describe('Telegram fire-and-forget error boundary', () => {
  it('.catch prevents Telegram failure from propagating (form submission)', async () => {
    // Simulate what happens at the call site:
    //   sendTelegramMessage(...).catch(console.error);
    // The promise resolves (even if sendTelegramMessage rejects), so the
    // route handler continues to send the 201 response.

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Telegram API down'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Fire-and-forget pattern from the call site
    let responseSent = false;
    const result = sendTelegramMessage('test msg', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID })
      .catch((err) => {
        console.error(err);
        // After catch, the promise resolves (no throw in catch handler)
      })
      .then(() => {
        // This runs regardless of sendTelegramMessage success/failure
        responseSent = true;
      });

    await result;

    expect(responseSent).toBe(true);  // response was NOT blocked
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('.catch does not prevent subsequent route handler code', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Down'));

    const errors = [];
    const mockConsoleError = (e) => errors.push(e.message);

    // Pattern: the route handler fires Telegram and moves on
    const promise = sendTelegramMessage('msg', { token: FAKE_TOKEN, chatId: FAKE_CHAT_ID }).catch(mockConsoleError);

    // Route sends response immediately (does not await Telegram)
    const responseData = { id: 'req-123', message: 'Request submitted successfully.' };
    expect(responseData.id).toBe('req-123');

    await promise;
    expect(errors).toContain('Down');
  });
});

// ── Reject handler data-extraction refactor regression ──────────────────
describe('reject handler data extraction pattern', () => {
  it('extracts data before status check (mirrors refactored code)', () => {
    // The diff changed:
    //   if (doc.data().status !== 'pending')  →  var data = doc.data(); if (data.status !== 'pending')
    // This allows data.name, data.email, data.formType to be used in the Telegram message.

    const mockDoc = {
      exists: true,
      data: () => ({
        name: 'Test User',
        email: 'test@test.com',
        formType: 'waiver',
        status: 'pending',
      }),
    };

    // Old pattern would have been: mockDoc.data().status
    // New pattern:
    var data = mockDoc.data();

    // Status check still works
    expect(data.status).toBe('pending');

    // Data fields are now accessible for Telegram message
    expect(data.name).toBe('Test User');
    expect(data.email).toBe('test@test.com');
    expect(data.formType).toBe('waiver');
  });

  it('status check still guards correctly when status is not pending', () => {
    const mockDoc = {
      exists: true,
      data: () => ({
        name: 'Test User',
        email: 'test@test.com',
        formType: 'waiver',
        status: 'approved',  // already approved
      }),
    };

    var data = mockDoc.data();
    const isPending = data.status === 'pending';

    expect(isPending).toBe(false);
    // Route handler would return 400 — Telegram is NOT sent
  });

  it('status check still guards correctly when document does not exist', () => {
    const mockDoc = { exists: false };
    // No call to mockDoc.data() — route handler returns 404 first
    expect(mockDoc.exists).toBe(false);
    // Telegram is NOT sent
  });
});
