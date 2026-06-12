// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

/**
 * Characterization route matrix for the real Express app (backend/index.js).
 *
 * Unlike the recreated-logic test files, this suite imports the production
 * app and drives every endpoint over HTTP via supertest, with the external
 * boundaries (Neon, Resend, Telegram) mocked at the package level. It pins
 * CURRENT behavior — including quirks like approvalRate serializing to null
 * when no requests are approved/rejected — so the upcoming structural
 * refactor (routes/services split) can be verified against it.
 *
 * Telegram is intentionally unconfigured (no env vars), exercising the
 * skip-with-warning guard on every notification call site.
 */

// ── Env must be set before the app module loads its config ──────────────
process.env.PASSWORD = 'test-password';
process.env.API_KEY = 'test-api-key';
process.env.RESEND_API_KEY = 'fake-resend-key';
process.env.RESEND_SENDER = 'noreply@example.test';
process.env.SITE_URL = 'https://example.test';
process.env.DATABASE_URL = 'postgres://fake';
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;

// ── Boundary mocks ───────────────────────────────────────────────────────
// backend/index.js is plain CJS that vitest externalizes, so vi.mock cannot
// intercept its require() calls. Instead we pre-seed require.cache for the
// three external packages, then require the app natively — explicit and
// transform-independent.
//
// sqlHandler routes on SQL text; tests override per case. Non-query tagged
// templates (the nested fragments in the approve route) return inert markers.
import { createRequire } from 'module';
const nodeRequire = createRequire(import.meta.url);

let sqlHandler;
const sqlCalls = [];

function sqlMock(strings, ...values) {
  const text = strings.join('$').replace(/\s+/g, ' ').trim();
  if (!/^(SELECT|INSERT|UPDATE|DELETE)/i.test(text)) {
    return { __fragment: text };
  }
  sqlCalls.push({ text, values });
  try {
    const result = sqlHandler(text, values);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  } catch (e) {
    return Promise.reject(e);
  }
}

const resendSend = vi.fn();

function seedCache(specifier, exports) {
  const path = nodeRequire.resolve(specifier);
  nodeRequire.cache[path] = { id: path, filename: path, loaded: true, exports };
}

seedCache('@neondatabase/serverless', { neon: () => sqlMock });
seedCache('resend', {
  Resend: class {
    constructor() {
      this.emails = { send: resendSend };
    }
  },
});
seedCache('pdfmake', class PdfPrinterMock {
  createPdfKitDocument() {
    return {
      pipe(res) { this._res = res; },
      end() { this._res.end(Buffer.from('%PDF-fake')); },
    };
  }
});

let app;
beforeAll(() => {
  app = nodeRequire('../backend/index.js');
});

const AUTH = { Authorization: 'Bearer test-api-key' };

function pendingRow(overrides = {}) {
  return {
    id: 'req-1',
    name: 'Jane Doe',
    email: 'jane@example.test',
    phone: '',
    company: 'Acme',
    form_type: 'waiver',
    matter_description: 'Contract review',
    status: 'pending',
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  sqlCalls.length = 0;
  sqlHandler = (text) => {
    if (/INSERT INTO admin_activity/i.test(text)) return [];
    return [];
  };
  resendSend.mockReset().mockResolvedValue({ id: 'email-1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Health ───────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('200 with service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'covington-burling-api' });
  });
});

// ── PDF generation ───────────────────────────────────────────────────────
describe('POST /api/generate-waiver', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/generate-waiver').send({});
    expect(res.status).toBe(401);
  });

  it('200 streams a PDF with attachment headers', async () => {
    const res = await request(app)
      .post('/api/generate-waiver')
      .set(AUTH)
      .send({ clientName: 'Jane', date: '2026-06-12', matter: 'Test' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('waiver-release-of-liability.pdf');
  });
});

describe('POST /api/generate-nda', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/generate-nda').send({});
    expect(res.status).toBe(401);
  });

  it('200 streams a PDF with attachment headers', async () => {
    const res = await request(app)
      .post('/api/generate-nda')
      .set(AUTH)
      .send({ clientName: 'Jane', clientAddress: 'DC', effectiveDate: '2026-06-12' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('mutual-nda.pdf');
  });
});

// ── Public form submission ───────────────────────────────────────────────
describe('POST /api/request-forms', () => {
  const valid = {
    name: 'Jane Doe',
    email: 'jane@example.test',
    formType: 'waiver',
    matterDescription: 'Need a waiver for an event.',
  };

  it('201 on valid submission, returns new id', async () => {
    sqlHandler = (text) => {
      if (/INSERT INTO form_requests/i.test(text)) return [{ id: 'new-1' }];
      return [];
    };
    const res = await request(app).post('/api/request-forms').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('new-1');
  });

  it('400 when required fields are missing', async () => {
    const res = await request(app).post('/api/request-forms').send({ name: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required fields.');
  });

  it('400 on invalid email', async () => {
    const res = await request(app)
      .post('/api/request-forms')
      .send({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email address.');
  });

  it('500 when the DB insert fails', async () => {
    sqlHandler = (text) => {
      if (/INSERT INTO form_requests/i.test(text)) return new Error('db down');
      return [];
    };
    const res = await request(app).post('/api/request-forms').send(valid);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to save request.');
  });

  it('400 on malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/request-forms')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body.');
  });
});

// ── Admin login ──────────────────────────────────────────────────────────
describe('POST /api/admin/login', () => {
  it('200 returns the API token on correct password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ password: 'test-password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('test-api-key');
  });

  it('401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid password.');
  });

  it('401 on empty body', async () => {
    const res = await request(app).post('/api/admin/login').send({});
    expect(res.status).toBe(401);
  });
});

// ── Admin requests list ──────────────────────────────────────────────────
describe('GET /api/admin/requests', () => {
  it('401 without auth', async () => {
    const res = await request(app).get('/api/admin/requests');
    expect(res.status).toBe(401);
  });

  it('401 with wrong token', async () => {
    const res = await request(app)
      .get('/api/admin/requests')
      .set('Authorization', 'Bearer wrong-key');
    expect(res.status).toBe(401);
  });

  it('200 returns rows', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests ORDER BY created_at/i.test(text)) {
        return [pendingRow(), pendingRow({ id: 'req-2', status: 'approved' })];
      }
      return [];
    };
    const res = await request(app).get('/api/admin/requests').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(2);
  });

  it('500 when the DB read fails', async () => {
    sqlHandler = () => new Error('db down');
    const res = await request(app).get('/api/admin/requests').set(AUTH);
    expect(res.status).toBe(500);
  });
});

// ── Approve ──────────────────────────────────────────────────────────────
describe('POST /api/admin/requests/:id/approve', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/admin/requests/req-1/approve').send({});
    expect(res.status).toBe(401);
  });

  it('404 when the request does not exist', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) return [];
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/missing/approve')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(404);
  });

  it('400 when the request is not pending', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) {
        return [pendingRow({ status: 'approved' })];
      }
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/req-1/approve')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request is not in pending status.');
  });

  it('200 approves, sends email, logs activity', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) return [pendingRow()];
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/req-1/approve')
      .set(AUTH)
      .send({ adminMessage: 'Welcome aboard' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('jane@example.test');
    expect(resendSend).toHaveBeenCalledTimes(1);
    const update = sqlCalls.find((c) => /UPDATE form_requests/i.test(c.text));
    expect(update).toBeDefined();
    const activity = sqlCalls.find((c) => /INSERT INTO admin_activity/i.test(c.text));
    expect(activity).toBeDefined();
  });

  it('CHARACTERIZATION: still 200 "approved" even when the email send fails (T8 will change this)', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) return [pendingRow()];
      return [];
    };
    resendSend.mockRejectedValue(new Error('resend down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app)
      .post('/api/admin/requests/req-1/approve')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Email sent');
    errSpy.mockRestore();
  });

  it('500 when the initial SELECT fails', async () => {
    sqlHandler = () => new Error('db down');
    const res = await request(app)
      .post('/api/admin/requests/req-1/approve')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(500);
  });
});

// ── Reject ───────────────────────────────────────────────────────────────
describe('POST /api/admin/requests/:id/reject', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/admin/requests/req-1/reject').send({});
    expect(res.status).toBe(401);
  });

  it('400 when rejectionReason is missing', async () => {
    const res = await request(app)
      .post('/api/admin/requests/req-1/reject')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Rejection reason is required.');
  });

  it('404 when the request does not exist', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) return [];
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/missing/reject')
      .set(AUTH)
      .send({ rejectionReason: 'Out of scope' });
    expect(res.status).toBe(404);
  });

  it('400 when the request is not pending', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) {
        return [pendingRow({ status: 'rejected' })];
      }
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/req-1/reject')
      .set(AUTH)
      .send({ rejectionReason: 'Out of scope' });
    expect(res.status).toBe(400);
  });

  it('200 rejects, sends rejection email, logs activity', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE id/i.test(text)) return [pendingRow()];
      return [];
    };
    const res = await request(app)
      .post('/api/admin/requests/req-1/reject')
      .set(AUTH)
      .send({ rejectionReason: 'Out of scope' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('jane@example.test');
    expect(resendSend).toHaveBeenCalledTimes(1);
    const update = sqlCalls.find((c) => /UPDATE form_requests/i.test(c.text));
    expect(update).toBeDefined();
  });
});

// ── Token download ───────────────────────────────────────────────────────
describe('GET /api/download/:token', () => {
  it('404 page for unknown or non-approved token', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE download_token/i.test(text)) return [];
      return [];
    };
    const res = await request(app).get('/api/download/nope');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Link Expired or Invalid');
  });

  it('410 page when the token has expired', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE download_token/i.test(text)) {
        return [pendingRow({
          status: 'approved',
          token_expires_at: '2020-01-01T00:00:00Z',
        })];
      }
      return [];
    };
    const res = await request(app).get('/api/download/old-token');
    expect(res.status).toBe(410);
    expect(res.text).toContain('Link Expired');
  });

  it('200 serves the waiver PDF by default', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE download_token/i.test(text)) {
        return [pendingRow({
          status: 'approved',
          token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        })];
      }
      return [];
    };
    const res = await request(app).get('/api/download/good-token');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('waiver-release-of-liability.pdf');
  });

  it('200 serves the NDA when form=nda', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM form_requests WHERE download_token/i.test(text)) {
        return [pendingRow({
          status: 'approved',
          token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        })];
      }
      return [];
    };
    const res = await request(app).get('/api/download/good-token?form=nda');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('mutual-nda.pdf');
  });
});

// ── Analytics ────────────────────────────────────────────────────────────
describe('GET /api/admin/analytics', () => {
  it('401 without auth', async () => {
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('200 aggregates pipeline counts, form types, and monthly trend', async () => {
    sqlHandler = (text) => {
      if (/SELECT status, form_type, created_at, approved_at FROM form_requests/i.test(text)) {
        return [
          { status: 'pending', form_type: 'waiver', created_at: '2026-05-01T00:00:00Z', approved_at: null },
          { status: 'approved', form_type: 'nda', created_at: '2026-05-02T00:00:00Z', approved_at: '2026-05-03T00:00:00Z' },
          { status: 'rejected', form_type: 'both', created_at: '2026-06-01T00:00:00Z', approved_at: null },
        ];
      }
      return [];
    };
    const res = await request(app).get('/api/admin/analytics').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.pipeline).toEqual({ total: 3, pending: 1, approved: 1, rejected: 1 });
    expect(res.body.approvalRate).toBe(50);
    expect(res.body.byFormType).toEqual({ waiver: 1, nda: 1, both: 1 });
    expect(res.body.monthlyTrend).toEqual([
      { month: '2026-05', count: 2 },
      { month: '2026-06', count: 1 },
    ]);
    expect(res.body.avgApprovalHours).toBe(24);
  });

  it('CHARACTERIZATION: approvalRate serializes to null when nothing is approved/rejected (NaN bug, T15 fixes)', async () => {
    sqlHandler = (text) => {
      if (/SELECT status, form_type/i.test(text)) {
        return [{ status: 'pending', form_type: 'waiver', created_at: '2026-06-01T00:00:00Z', approved_at: null }];
      }
      return [];
    };
    const res = await request(app).get('/api/admin/analytics').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.approvalRate).toBe(null);
  });

  it('200 with zero rows returns empty aggregates', async () => {
    const res = await request(app).get('/api/admin/analytics').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.pipeline.total).toBe(0);
    expect(res.body.approvalRate).toBe(0);
    expect(res.body.avgApprovalHours).toBe(null);
  });
});

// ── Admin send email ─────────────────────────────────────────────────────
describe('POST /api/admin/send-email', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/admin/send-email').send({});
    expect(res.status).toBe(401);
  });

  it('400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/send-email')
      .set(AUTH)
      .send({ toEmail: 'a@b.test' });
    expect(res.status).toBe(400);
  });

  it('200 sends the branded email via Resend', async () => {
    const res = await request(app)
      .post('/api/admin/send-email')
      .set(AUTH)
      .send({ toEmail: 'a@b.test', subject: 'Hi', body: 'Hello there' });
    expect(res.status).toBe(200);
    expect(resendSend).toHaveBeenCalledTimes(1);
    const payload = resendSend.mock.calls[0][0];
    expect(payload.to).toEqual(['a@b.test']);
    expect(payload.html).toContain('Hello there');
  });

  it('200 includes an attachment when provided', async () => {
    const res = await request(app)
      .post('/api/admin/send-email')
      .set(AUTH)
      .send({
        toEmail: 'a@b.test',
        subject: 'Hi',
        body: 'Doc attached',
        attachment: { name: 'doc.pdf', content: 'base64data' },
      });
    expect(res.status).toBe(200);
    const payload = resendSend.mock.calls[0][0];
    expect(payload.attachments).toEqual([{ filename: 'doc.pdf', content: 'base64data' }]);
  });

  it('500 when Resend fails', async () => {
    resendSend.mockRejectedValue(new Error('resend down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app)
      .post('/api/admin/send-email')
      .set(AUTH)
      .send({ toEmail: 'a@b.test', subject: 'Hi', body: 'Hello' });
    expect(res.status).toBe(500);
    errSpy.mockRestore();
  });
});

describe('POST /api/admin/send-email-attachment', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/admin/send-email-attachment').send({});
    expect(res.status).toBe(401);
  });

  it('400 when attachment is missing', async () => {
    const res = await request(app)
      .post('/api/admin/send-email-attachment')
      .set(AUTH)
      .send({ toEmail: 'a@b.test', subject: 'Hi', body: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('attachment');
  });

  it('200 sends with the attachment', async () => {
    const res = await request(app)
      .post('/api/admin/send-email-attachment')
      .set(AUTH)
      .send({
        toEmail: 'a@b.test',
        subject: 'Hi',
        body: 'Doc attached',
        attachment: { name: 'nda.pdf', content: 'base64data' },
      });
    expect(res.status).toBe(200);
    expect(resendSend.mock.calls[0][0].attachments[0].filename).toBe('nda.pdf');
  });
});

// ── Activity log ─────────────────────────────────────────────────────────
describe('GET /api/admin/activity', () => {
  it('401 without auth', async () => {
    const res = await request(app).get('/api/admin/activity');
    expect(res.status).toBe(401);
  });

  it('200 returns activity rows', async () => {
    sqlHandler = (text) => {
      if (/SELECT \* FROM admin_activity/i.test(text)) {
        return [{ action: 'approve', details: '{}', timestamp: '2026-06-12T00:00:00Z' }];
      }
      return [];
    };
    const res = await request(app).get('/api/admin/activity').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.activity).toHaveLength(1);
  });

  it('clamps the limit parameter to at most 200', async () => {
    let receivedLimit;
    sqlHandler = (text, values) => {
      if (/SELECT \* FROM admin_activity/i.test(text)) {
        receivedLimit = values[0];
        return [];
      }
      return [];
    };
    await request(app).get('/api/admin/activity?limit=9999').set(AUTH);
    expect(receivedLimit).toBe(200);
  });
});

// ── Telegram notification hardening ──────────────────────────────────────
describe('telegram notifications (env-configured per test)', () => {
  let origFetch;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    process.env.TELEGRAM_BOT_TOKEN = '0000000000:TEST-FAKE-TOKEN-NOT-REAL';
    process.env.TELEGRAM_CHAT_ID = 'fake-chat-id';
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('escapes user-typed HTML characters in the form-submission notification', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    globalThis.fetch = fetchSpy;
    sqlHandler = (text) => {
      if (/INSERT INTO form_requests/i.test(text)) return [{ id: 'new-1' }];
      return [];
    };

    const res = await request(app).post('/api/request-forms').send({
      name: 'Jane <script> & Co',
      email: 'jane@example.test',
      formType: 'waiver',
      matterDescription: 'Needs < review > & fast',
    });
    expect(res.status).toBe(201);

    const telegramCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes('api.telegram.org'));
    expect(telegramCall).toBeDefined();
    const body = JSON.parse(telegramCall[1].body);
    expect(body.text).toContain('Jane &lt;script&gt; &amp; Co');
    expect(body.text).toContain('Needs &lt; review &gt; &amp; fast');
    expect(body.text).not.toContain('<script>');
    // Intended formatting tags survive
    expect(body.text).toContain('<b>Name:</b>');
  });

  it('truncates messages beyond the 4096-char Telegram limit', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    globalThis.fetch = fetchSpy;
    sqlHandler = (text) => {
      if (/INSERT INTO form_requests/i.test(text)) return [{ id: 'new-1' }];
      return [];
    };

    const res = await request(app).post('/api/request-forms').send({
      name: 'Jane',
      email: 'jane@example.test',
      formType: 'waiver',
      matterDescription: 'y'.repeat(8000),
    });
    expect(res.status).toBe(201);

    const telegramCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes('api.telegram.org'));
    const body = JSON.parse(telegramCall[1].body);
    expect(body.text.length).toBeLessThanOrEqual(4096);
    expect(body.text.endsWith('…')).toBe(true);
  });

  it('logs but does not propagate a Telegram API failure (201 still returned)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, description: 'Bad Request: chat not found' }),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sqlHandler = (text) => {
      if (/INSERT INTO form_requests/i.test(text)) return [{ id: 'new-1' }];
      return [];
    };

    const res = await request(app).post('/api/request-forms').send({
      name: 'Jane',
      email: 'jane@example.test',
      formType: 'waiver',
      matterDescription: 'A perfectly fine matter.',
    });
    expect(res.status).toBe(201);

    // allow the fire-and-forget promise chain to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(errSpy).toHaveBeenCalledWith(
      'Telegram notification failed:',
      'Bad Request: chat not found'
    );
    errSpy.mockRestore();
  });
});

// ── Body size limits ─────────────────────────────────────────────────────
describe('body size limits', () => {
  it('413 for oversized bodies on public endpoints (100kb cap)', async () => {
    const res = await request(app)
      .post('/api/request-forms')
      .send({
        name: 'Jane',
        email: 'jane@example.test',
        formType: 'waiver',
        matterDescription: 'x'.repeat(200 * 1024),
      });
    expect(res.status).toBe(413);
  });

  it('accepts a ~1mb attachment on send-email-attachment (5mb cap)', async () => {
    const res = await request(app)
      .post('/api/admin/send-email-attachment')
      .set(AUTH)
      .send({
        toEmail: 'a@b.test',
        subject: 'Hi',
        body: 'Doc attached',
        attachment: { name: 'big.pdf', content: 'x'.repeat(1024 * 1024) },
      });
    expect(res.status).toBe(200);
  });

  it('accepts a ~1mb attachment on send-email too (5mb cap, optional attachment)', async () => {
    const res = await request(app)
      .post('/api/admin/send-email')
      .set(AUTH)
      .send({
        toEmail: 'a@b.test',
        subject: 'Hi',
        body: 'Doc attached',
        attachment: { name: 'big.pdf', content: 'x'.repeat(1024 * 1024) },
      });
    expect(res.status).toBe(200);
  });
});

// ── Fallthrough routes ───────────────────────────────────────────────────
describe('fallthrough', () => {
  it('404 JSON for unknown /api/ paths', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('404 HTML page for unknown non-API paths', async () => {
    const res = await request(app).get('/no-such-page');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
