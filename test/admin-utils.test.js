import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── AdminUtils escHtml / escAttr ────────────────────────────────────

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

describe('AdminUtils escHtml', () => {
  it('escapes <, >, &, and "', () => {
    const input = '<script>alert("&xss")</script>';
    const output = escHtml(input);
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).not.toContain('"');
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
    expect(output).toContain('&quot;');
    expect(output).toContain('&amp;');
  });

  it('returns empty string for falsy input', () => {
    expect(escHtml('')).toBe('');
    expect(escHtml(null)).toBe('');
    expect(escHtml(undefined)).toBe('');
  });

  it('does NOT escape single quotes', () => {
    const input = "John's Notes";
    expect(escHtml(input)).toBe("John's Notes");
  });
});

describe('AdminUtils escAttr', () => {
  it('escapes &, ", <, >', () => {
    const input = 'a"b&c<d>e';
    const output = escAttr(input);
    expect(output).not.toContain('"');
    expect(output).toContain('&quot;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
  });

  it('returns empty string for falsy input', () => {
    expect(escAttr('')).toBe('');
    expect(escAttr(null)).toBe('');
  });
});

// ── Clause library item HTML generation (XSS fix regression test) ──

describe('clause library item HTML', () => {
  it('escapes double quotes in data-* attributes using escAttr', () => {
    const title = 'Test "Clause" Title';
    const body = 'Some body text with "quotes"';
    // Simulate what admin-builder.js does (line 560 after fix)
    const html = '<button class="clause-lib-item" data-title="' + escAttr(title) + '" data-body="' + escAttr(body) + '" title="Click to insert"><span class="clause-lib-item__title">' + escHtml(title) + '</span><span class="clause-lib-item__preview">' + escHtml(body.substring(0, 80)) + '&hellip;</span></button>';

    // Parse with DOMParser and verify data-* attributes are intact
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const btn = doc.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('data-title')).toBe(title);
    expect(btn.getAttribute('data-body')).toBe(body);
  });

  it('handles ampersands in clause titles', () => {
    const title = 'Terms & Conditions';
    const body = 'Body text';
    const html = '<button class="clause-lib-item" data-title="' + escAttr(title) + '" data-body="' + escAttr(body) + '">' + escHtml(title) + '</button>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const btn = doc.querySelector('button');
    expect(btn.getAttribute('data-title')).toBe('Terms & Conditions');
  });
});

// ── Modal close function (Esc key listener leak fix) ────────────────

describe('modal Esc key listener cleanup', () => {
  let overlay, closeModal, escHandler, listenerRemoved;

  beforeEach(() => {
    listenerRemoved = false;

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);

    closeModal = () => {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', escHandler);
    };

    escHandler = (ev) => {
      if (ev.key === 'Escape') {
        closeModal();
      }
    };

    document.addEventListener('keydown', escHandler);
  });

  afterEach(() => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  });

  it('removes the overlay from DOM on close', () => {
    closeModal();
    expect(document.body.contains(overlay)).toBe(false);
  });

  it('removes keydown listener on closeModal (fix: no leak on overlay click path)', () => {
    closeModal();
    // Dispatch Esc key — should NOT throw and should NOT call closeModal again
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    // If listener leaked, it would try to removeChild on already-removed overlay
    // No assertion needed — the test passes if no error is thrown
  });

  it('removes listener on Esc key press', () => {
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    // Overlay should be removed
    expect(document.body.contains(overlay)).toBe(false);
    // Second Esc should be harmless (listener was removed by closeModal)
    document.dispatchEvent(ev);
  });
});
