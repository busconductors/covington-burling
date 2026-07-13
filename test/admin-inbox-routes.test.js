// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

const express = nodeRequire('express');
const assert = nodeRequire('assert');

// Set INBOUND_SECRET before any module that requires config is loaded
process.env.INBOUND_SECRET = 'test-secret';

// Mock the db service
const db = nodeRequire('../backend/services/db');
const origGetSql = db.getSql;

function mockSql() {
  return function () {
    return {
      then: function (cb) { return Promise.resolve([]).then(cb); },
      catch: function (cb) { return Promise.resolve([]); }
    };
  };
}

describe('Inbound Routes', function () {
  let app;

  beforeEach(function () {
    // Set up a minimal Express app with inbound routes
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Mock the db for all tests
    db.getSql = function () { return mockSql()(); };

    app.use(nodeRequire('../backend/routes/inbound'));
  });

  afterEach(function () {
    db.getSql = origGetSql;
  });

  describe('GET /api/admin/inbox', function () {
    it('returns 401 without auth', async function () {
      const res = await request(app).get('/api/admin/inbox');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('POST /api/inbound/cloudflare', function () {
    it('accepts Cloudflare Worker JSON and returns 200', async function () {
      db.getSql = function () {
        const s = function () {
          return {
            then: function (cb) { return Promise.resolve([{ id: 'new-123', message_id: '<test-001@mail.example.com>' }]).then(cb); }
          };
        };
        return s;
      };

      const rawEmail = [
        'From: Test <test@example.com>',
        'To: maxtheodore@carlingtonburling.com',
        'Subject: Test inbound',
        'Date: Sat, 11 Jul 2026 20:00:00 +0000',
        'Message-ID: <test-001@mail.example.com>',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Hello',
      ].join('\r\n');

      const res = await request(app)
        .post('/api/inbound/cloudflare')
        .set('Authorization', 'Bearer test-secret')
        .send({
          from: 'Test <test@example.com>',
          to: 'maxtheodore@carlingtonburling.com',
          subject: 'Test inbound',
          messageId: '<test-001@mail.example.com>',
          raw: rawEmail,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
    });

    it('rejects requests without valid secret', async function () {
      const res = await request(app)
        .post('/api/inbound/cloudflare')
        .set('Authorization', 'Bearer wrong-secret')
        .send({ raw: 'test', from: '', subject: '', messageId: '' });

      assert.strictEqual(res.status, 403);
    });
  });
});
