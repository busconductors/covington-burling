// @vitest-environment node
import { describe, it, afterEach } from 'vitest';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const assert = nodeRequire('assert');

// Mock db service to avoid hitting real Neon
const db = nodeRequire('../backend/services/db');
const origGetSql = db.getSql;

function mockDb(results) {
  db.getSql = function () {
    const s = function () {
      return {
        then: function (cb) { return Promise.resolve(results).then(cb); }
      };
    };
    return s;
  };
}

function restoreDb() {
  db.getSql = origGetSql;
}

const inbound = nodeRequire('../backend/services/inbound');

describe('storeInboundEmail (Cloudflare)', function () {
  afterEach(function () {
    restoreDb();
  });

  it('parses raw RFC 2822 email and stores it', async function () {
    mockDb([]); // SELECT returns empty (no dedup match)

    const rawEmail = [
      'From: Client Person <client@example.com>',
      'To: maxtheodore@carlingtonburling.com',
      'Subject: Question about NDA',
      'Date: Sat, 11 Jul 2026 20:00:00 +0000',
      'Message-ID: <msg-001@mail.example.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Hello Max, I have a question about the NDA terms.',
    ].join('\r\n');

    const headers = {
      from: 'Client Person <client@example.com>',
      subject: 'Question about NDA',
      messageId: '<msg-001@mail.example.com>',
    };

    mockDb([{ id: 'abc-123', message_id: '<msg-001@mail.example.com>' }]);
    const result = await inbound.storeInboundEmail(rawEmail, headers);
    assert.strictEqual(result.id, 'abc-123');
    restoreDb();
  });

  it('sanitizes HTML in parsed email body', async function () {
    mockDb([]);

    const rawEmail = [
      'From: test@example.com',
      'To: maxtheodore@carlingtonburling.com',
      'Subject: Test',
      'Date: Sat, 11 Jul 2026 20:00:00 +0000',
      'Message-ID: <msg-002@mail.example.com>',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Safe text</p><script>alert("xss")</script><img onerror="alert(1)" src=x>',
    ].join('\r\n');

    const headers = {
      from: 'test@example.com',
      subject: 'Test',
      messageId: '<msg-002@mail.example.com>',
    };

    mockDb([{ id: 'def-456', message_id: '<msg-002@mail.example.com>' }]);
    const result = await inbound.storeInboundEmail(rawEmail, headers);
    assert.strictEqual(result.id, 'def-456');
    restoreDb();
  });
});
