// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

const express = nodeRequire('express');
const assert = nodeRequire('assert');

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

// Mock email service
const email = nodeRequire('../backend/services/email');
const origSendComposed = email.sendComposedEmail;

describe('Inbound Routes', function () {
  let app;

  beforeEach(function () {
    // Set up a minimal Express app with inbound routes
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Override config for tests
    process.env.MAILGUN_WEBHOOK_KEY = 'test-key';

    // Mock the db for all tests
    db.getSql = function () { return mockSql()(); };

    app.use(nodeRequire('../backend/routes/inbound'));
  });

  afterEach(function () {
    db.getSql = origGetSql;
    delete process.env.MAILGUN_WEBHOOK_KEY;
  });

  describe('GET /api/admin/inbox', function () {
    it('returns 401 without auth', async function () {
      const res = await request(app).get('/api/admin/inbox');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('POST /api/inbound/mailgun', function () {
    it('accepts Mailgun webhook form data and returns 200', async function () {
      db.getSql = function () {
        const s = function () {
          return {
            then: function (cb) { return Promise.resolve([]).then(cb); }
          };
        };
        return s;
      };

      const res = await request(app)
        .post('/api/inbound/mailgun')
        .type('form')
        .send({
          'Message-Id': '<test-001@mailgun>',
          from: 'Test User <test@example.com>',
          subject: 'Test inbound',
          'body-html': '<p>Hello</p>',
          'body-plain': 'Hello',
          Received: 'Sat, 11 Jul 2026 20:00:00 +0000',
          attachments: '[]',
          token: 'abc',
          timestamp: '1234567890',
          signature: 'abc',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.received, true);
    });
  });
});
