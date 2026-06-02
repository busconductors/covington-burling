import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * admin-requests.js modal and error-state regression tests.
 *
 * The diff refactored openDetailModal to:
 *   1. Extract closeModal() function that removes overlay + Esc listener
 *   2. Store escHandler as a named variable (was inline, couldn't be unregistered)
 *   3. Click handler delegates to closeModal()
 */

const REQUEST_ELEMENT_IDS = [
  'adminRequestsSection', 'adminTable', 'adminTableBody',
  'adminLoading', 'adminEmpty',
];

function createRequestsDOM() {
  for (const id of REQUEST_ELEMENT_IDS) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  document.getElementById('adminLoading').classList.add('hidden');
}

function loadScript(filePath) {
  const src = readFileSync(resolve(__dirname, '..', filePath), 'utf8');
  (0, eval)(src);
}

const MOCK_REQUEST = {
  id: 'req-1',
  name: 'Test User',
  email: 'test@example.com',
  phone: '555-0100',
  company: 'Test Corp',
  formType: 'waiver',
  matterDescription: 'Test matter',
  status: 'pending',
  createdAt: new Date().toISOString(),
  approvedAt: null,
  approvedBy: null,
  downloadToken: null,
  tokenExpiresAt: null,
};

function setupEnvironment() {
  createRequestsDOM();

  window.AdminAuth = {
    getToken: () => 'test-token',
    isLoggedIn: () => true,
    showError: () => {},
    apiBase: 'https://test.example.com/api/admin',
  };

  window.AdminUtils = {
    escHtml: (s) => {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    escAttr: (s) => {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  };
}

describe('admin-requests modal request-not-found guard', () => {
  beforeEach(() => {
    setupEnvironment();
    // No fetch mock, so requestsData stays empty
    loadScript('public/js/admin-requests.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.AdminAuth;
    delete window.AdminRequests;
    delete window.AdminUtils;
    vi.restoreAllMocks();
  });

  it('openDetailModal does not throw when request ID is not found', () => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', 'nonexistent');
    document.getElementById('adminTableBody').appendChild(tr);

    expect(() => tr.click()).not.toThrow();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('admin-requests modal click and keyboard behavior', () => {
  beforeEach(async () => {
    setupEnvironment();

    // Mock fetch to return a single pending request
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ requests: [MOCK_REQUEST] }),
    });

    loadScript('public/js/admin-requests.js');

    // Trigger loadRequests and wait for the fetch to resolve
    window.AdminRequests.load();
    // Flush microtask queue so fetch .then() callbacks execute
    await Promise.resolve();
    // Second tick ensures renderTable has populated the DOM
    await Promise.resolve();
  });

  afterEach(() => {
    // Close any lingering modal via Escape to ensure closeModal()
    // runs and removes the keydown listener before DOM teardown.
    // Otherwise stale listeners fire on future Escape events and try
    // to removeChild an already-detached overlay.
    const existing = document.querySelector('.modal-overlay');
    if (existing) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
    document.body.innerHTML = '';
    delete window.AdminAuth;
    delete window.AdminRequests;
    delete window.AdminUtils;
    vi.restoreAllMocks();
  });

  function openModal() {
    const rows = document.querySelectorAll('tr[data-id]');
    expect(rows.length).toBeGreaterThan(0);
    rows[0].click();
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    return overlay;
  }

  it('click on modal-overlay removes overlay from DOM', () => {
    const overlay = openModal();
    overlay.click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('click on modal-overlay unregisters Esc keydown listener', () => {
    const overlay = openModal();
    const remSpy = vi.spyOn(document, 'removeEventListener');
    overlay.click();
    expect(remSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    remSpy.mockRestore();
  });

  it('click on modal__close button removes overlay from DOM', () => {
    const overlay = openModal();
    const closeBtn = overlay.querySelector('.modal__close');
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('click on modal__close button unregisters Esc keydown listener', () => {
    const overlay = openModal();
    const remSpy = vi.spyOn(document, 'removeEventListener');
    const closeBtn = overlay.querySelector('.modal__close');
    closeBtn.click();
    expect(remSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    remSpy.mockRestore();
  });

  it('click inside modal content does NOT close modal', () => {
    const overlay = openModal();
    const modalBody = overlay.querySelector('.modal__body');
    expect(modalBody).not.toBeNull();
    modalBody.click();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });

  it('non-Escape keydown does NOT close the modal', () => {
    openModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });

  it('Escape key closes modal and unregisters listener', () => {
    openModal();
    const remSpy = vi.spyOn(document, 'removeEventListener');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.modal-overlay')).toBeNull();
    expect(remSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    remSpy.mockRestore();
  });
});
