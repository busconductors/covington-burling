// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

/**
 * Tests for the PRODUCTION email service (backend/services/email.js) with the
 * Resend client mocked via require.cache seeding — replaces the deleted
 * Brevo-era file that tested a hand-copied fork of a backend that no longer
 * existed. Every assertion here runs the real template/link/escape code.
 */
const nodeRequire = createRequire(import.meta.url);

process.env.RESEND_API_KEY = 'fake-resend-key';
process.env.RESEND_SENDER = 'noreply@example.test';
process.env.SITE_URL = 'https://example.test';

const resendSend = vi.fn();

function seedCache(specifier, exports) {
  const path = nodeRequire.resolve(specifier);
  nodeRequire.cache[path] = { id: path, filename: path, loaded: true, exports };
}

seedCache('resend', {
  Resend: class {
    constructor() {
      this.emails = { send: resendSend };
    }
  },
});

const email = nodeRequire('../backend/services/email.js');
const templates = nodeRequire('../public/js/email-templates.js');

beforeEach(() => {
  resendSend.mockReset().mockResolvedValue({ id: 'email-1' });
});

describe('sendResendEmail (approval)', () => {
  it('addresses the recipient and uses the configured sender', async () => {
    await email.sendResendEmail('jane@example.test', 'Jane', 'waiver', 'tok123', null);
    const payload = resendSend.mock.calls[0][0];
    expect(payload.to).toEqual(['jane@example.test']);
    expect(payload.from).toContain('noreply@example.test');
    expect(payload.subject).toContain('Legal Forms Are Ready');
  });

  it('waiver request links only the waiver download', async () => {
    await email.sendResendEmail('a@b.test', 'Jane', 'waiver', 'tok123', null);
    const html = resendSend.mock.calls[0][0].html;
    expect(html).toContain('https://example.test/api/download/tok123?form=waiver');
    expect(html).not.toContain('form=nda');
  });

  it('nda request links only the nda download', async () => {
    await email.sendResendEmail('a@b.test', 'Jane', 'nda', 'tok456', null);
    const html = resendSend.mock.calls[0][0].html;
    expect(html).toContain('https://example.test/api/download/tok456?form=nda');
    expect(html).not.toContain('form=waiver');
  });

  it('"both" request links both downloads', async () => {
    await email.sendResendEmail('a@b.test', 'Jane', 'both', 'tok789', null);
    const html = resendSend.mock.calls[0][0].html;
    expect(html).toContain('form=waiver');
    expect(html).toContain('form=nda');
  });

  it('escapes the admin message and recipient name (full 4-char escape)', async () => {
    await email.sendResendEmail('a@b.test', 'Jane <&> "Q"', 'waiver', 'tok', 'Note with <b>html</b> & "quotes"\nsecond line');
    const html = resendSend.mock.calls[0][0].html;
    expect(html).toContain('Dear Jane &lt;&amp;&gt; &quot;Q&quot;,');
    expect(html).toContain('Note with &lt;b&gt;html&lt;/b&gt; &amp; &quot;quotes&quot;<br>second line');
    expect(html).not.toContain('<b>html</b>');
  });

  it('omits the admin message block when no message is given', async () => {
    await email.sendResendEmail('a@b.test', 'Jane', 'waiver', 'tok', null);
    const html = resendSend.mock.calls[0][0].html;
    expect(html).not.toContain('font-style:italic');
  });
});

describe('sendResendRejectionEmail', () => {
  it('includes the escaped rejection reason', async () => {
    await email.sendResendRejectionEmail('a@b.test', 'Bob', 'Conflict of <interest> & scope');
    const payload = resendSend.mock.calls[0][0];
    expect(payload.subject).toBe('Your form request has been declined');
    expect(payload.html).toContain('Conflict of &lt;interest&gt; &amp; scope');
    expect(payload.html).toContain('Dear Bob,');
  });

  it('propagates Resend failures to the caller', async () => {
    resendSend.mockRejectedValue(new Error('resend down'));
    await expect(email.sendResendRejectionEmail('a@b.test', 'Bob', 'reason')).rejects.toThrow('resend down');
  });
});

describe('sendComposedEmail', () => {
  it('wraps the body in the shared template (byte parity with preview)', async () => {
    await email.sendComposedEmail('a@b.test', 'Subject', 'Hello\n\nWorld & <tag>', null);
    const payload = resendSend.mock.calls[0][0];
    expect(payload.html).toBe(templates.buildEmailHtml('Hello\n\nWorld & <tag>'));
  });

  it('attaches the file when provided', async () => {
    await email.sendComposedEmail('a@b.test', 'S', 'B', { name: 'doc.pdf', content: 'base64' });
    expect(resendSend.mock.calls[0][0].attachments).toEqual([{ filename: 'doc.pdf', content: 'base64' }]);
  });

  it('skips malformed attachments (missing content)', async () => {
    await email.sendComposedEmail('a@b.test', 'S', 'B', { name: 'doc.pdf' });
    expect(resendSend.mock.calls[0][0].attachments).toBeUndefined();
  });
});

describe('shared template module', () => {
  it('uses the canonical domain (covbur.com drift killed)', () => {
    const html = templates.buildEmailHtml('x');
    expect(html).toContain('carlingtonburling.com');
    expect(html).not.toContain('covbur.com');
  });

  it('placeholder renders only when requested (preview mode)', () => {
    expect(templates.buildEmailHtml('', { placeholder: true })).toContain('Email body will appear here');
    expect(templates.buildEmailHtml('')).not.toContain('Email body will appear here');
  });

  it('escapeHtml covers all four characters', () => {
    expect(templates.escapeHtml('&<>"')).toBe('&amp;&lt;&gt;&quot;');
    expect(templates.escapeHtml(null)).toBe('');
    expect(templates.escapeHtml(undefined)).toBe('');
  });
});
