import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── AdminUtils escHtml / escAttr ────────────────────────────────────
// These implementations mirror window.AdminUtils in public/js/admin-auth.js
// (lines 104-113). They're duplicated here because admin-auth.js is an IIFE
// that requires DOM setup. The parity test below verifies the function bodies
// match the production source code to prevent drift.

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

describe('AdminUtils parity with production admin-auth.js', () => {
  it('local escHtml and escAttr source bodies match production code', () => {
    const authPath = resolve(__dirname, '../public/js/admin-auth.js');
    const authSrc = readFileSync(authPath, 'utf8');

    // escHtml body: String(s).replace(/&/g, ...).replace(/</g, ...).replace(/>/g, ...).replace(/"/g, ...)
    expect(authSrc).toContain(
      "String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')"
    );

    // escAttr body: String(s).replace(/&/g, ...).replace(/"/g, ...).replace(/</g, ...).replace(/>/g, ...)
    expect(authSrc).toContain(
      "String(s).replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')"
    );

    // Verify the guard clause pattern
    expect(authSrc).toContain('if (!s) return \'\'');
  });
});

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

  it('handles non-string inputs via String() coercion', () => {
    // 0 and false are falsy — the guard returns '' for these
    expect(escHtml(0)).toBe('');
    expect(escHtml(false)).toBe('');
    // Non-falsy values coerce via String()
    expect(escHtml(42)).toBe('42');
    expect(escHtml(true)).toBe('true');
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
    expect(escAttr(undefined)).toBe('');
  });

  it('handles non-string inputs via String() coercion', () => {
    expect(escAttr(0)).toBe('');
    expect(escAttr(false)).toBe('');
    expect(escAttr(42)).toBe('42');
    expect(escAttr(true)).toBe('true');
  });
});

// ── Clause library item HTML generation (XSS fix regression test) ──

describe('clause library item HTML', () => {
  it('escapes double quotes in data-* attributes using escAttr', () => {
    const title = 'Test "Clause" Title';
    const body = 'Some body text with "quotes"';
    const html = '<button class="clause-lib-item" data-title="' + escAttr(title) + '" data-body="' + escAttr(body) + '" title="Click to insert"><span class="clause-lib-item__title">' + escHtml(title) + '</span><span class="clause-lib-item__preview">' + escHtml(body.substring(0, 80)) + '&hellip;</span></button>';

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

  describe('body substring boundary', () => {
    it('truncates body at exactly 80 characters', () => {
      const body80 = 'A'.repeat(80);
      const body81 = 'B'.repeat(81);
      const body79 = 'C'.repeat(79);

      expect(escHtml(body80.substring(0, 80))).toBe(body80);
      expect(escHtml(body81.substring(0, 80))).toBe('B'.repeat(80));
      expect(escHtml(body79.substring(0, 80))).toBe(body79);
    });

    it('handles empty string body', () => {
      expect(escHtml(''.substring(0, 80))).toBe('');
    });

    it('handles body with special characters at boundary', () => {
      const body = 'X'.repeat(79) + '<';
      const result = escHtml(body.substring(0, 80));
      expect(result).toContain('&lt;');
      expect(result).not.toContain('<');
    });
  });

  describe('empty search results fallback', () => {
    it('renders fallback message with safe HTML', () => {
      const fallback = 'No clauses match your search.';
      const html = '<div class="clause-lib-empty">' + escHtml(fallback) + '</div>';
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const div = doc.querySelector('.clause-lib-empty');
      expect(div).not.toBeNull();
      expect(div.textContent).toBe(fallback);
    });

    it('escHtml neutralizes XSS in search-like input', () => {
      const malicious = '<img src=x onerror=alert(1)>';
      const safe = escHtml(malicious);
      // The escaped string should not contain raw angle brackets
      expect(safe).not.toContain('<img');
      expect(safe).not.toContain('<script');
      // The content after escaping should be safe for innerHTML
      expect(safe).toContain('&lt;');
      expect(safe).toContain('&gt;');
    });
  });
});

// ── Modal close function (Esc key listener leak fix) ────────────────

describe('modal Esc key listener cleanup', () => {
  let overlay, closeModal, escHandler;

  beforeEach(() => {
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

  it('calls removeEventListener with correct handler on closeModal', () => {
    const remSpy = vi.spyOn(document, 'removeEventListener');
    closeModal();
    expect(remSpy).toHaveBeenCalledWith('keydown', escHandler);
    remSpy.mockRestore();
  });

  it('calls removeEventListener on Esc key press', () => {
    const remSpy = vi.spyOn(document, 'removeEventListener');
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    expect(document.body.contains(overlay)).toBe(false);
    expect(remSpy).toHaveBeenCalledWith('keydown', escHandler);
    remSpy.mockRestore();
  });

  it('double Esc does not throw (listener was removed)', () => {
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    expect(() => document.dispatchEvent(ev)).not.toThrow();
  });
});
