// @vitest-environment node
import assert from 'node:assert';
import { beforeAll } from 'vitest';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

// We'll mock db.js to avoid hitting real Neon
const db = nodeRequire('../backend/services/db');
const origGetSql = db.getSql;
const mockRows = [];
const mockQueries = [];

db.getSql = function () {
  const s = function (strings) {
    const vals = Array.prototype.slice.call(arguments, 1);
    const query = { text: strings.join('?'), values: vals };
    mockQueries.push(query);
    return {
      then: function (cb) {
        const result = mockRows.length ? mockRows : [];
        return Promise.resolve(result).then(cb);
      }
    };
  };
  return s;
};

const inbound = nodeRequire('../backend/services/inbound');

describe('storeInboundEmail', function () {
  beforeEach(function () {
    mockQueries.length = 0;
    mockRows.length = 0;
  });

  afterAll(function () {
    db.getSql = origGetSql;
  });

  it('stores a valid Mailgun payload and returns id', async function () {
    mockRows.push({ id: 'abc-123', message_id: 'msg-001' });

    const payload = {
      'Message-Id': '<msg-001@mailgun>',
      from: 'Client Name <client@example.com>',
      subject: 'Question about NDA',
      'body-html': '<p>Hello Max, I have a question about the NDA terms.</p>',
      'body-plain': 'Hello Max, I have a question about the NDA terms.',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    const result = await inbound.storeInboundEmail(payload);
    assert.strictEqual(result.id, 'abc-123');
    assert.strictEqual(mockQueries.length, 1);
  });

  it('strips script tags from HTML body', async function () {
    mockRows.push({ id: 'abc-456', message_id: 'msg-002' });

    const payload = {
      'Message-Id': '<msg-002@mailgun>',
      from: 'attacker@evil.com',
      subject: 'Hello',
      'body-html': '<p>Safe text</p><script>alert("xss")</script><img onerror="alert(1)" src=x>',
      'body-plain': 'Safe text',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    await inbound.storeInboundEmail(payload);
    const query = mockQueries[0];
    const htmlStored = query.values[3]; // body_html is 4th param (0-indexed: 3)
    assert.ok(!htmlStored.includes('<script'));
    assert.ok(!htmlStored.includes('onerror'));
    assert.ok(htmlStored.includes('Safe text'));
  });

  it('returns existing row on duplicate message_id', async function () {
    // First call — no existing row
    mockRows.length = 0;
    // Second call — mock the SELECT returning existing row
    let callCount = 0;
    const origS = db.getSql;
    db.getSql = function () {
      callCount++;
      const s = function () {
        const vals = Array.prototype.slice.call(arguments, 1);
        return {
          then: function (cb) {
            if (callCount === 1) return Promise.resolve([]).then(cb); // SELECT returns empty
            return Promise.resolve([{ id: 'existing-id', message_id: 'msg-003' }]).then(cb); // SELECT returns existing
          }
        };
      };
      return s;
    };

    const payload = {
      'Message-Id': '<msg-003@mailgun>',
      from: 'test@example.com',
      subject: 'Test',
      'body-html': '<p>Test</p>',
      'body-plain': 'Test',
      Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
      attachments: '[]',
    };

    const result = await inbound.storeInboundEmail(payload);
    assert.strictEqual(result.id, 'existing-id');
    db.getSql = origS;
  });
});
