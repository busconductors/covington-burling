import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUEST_ELEMENT_IDS = [
  'adminRequestsSection', 'adminTable', 'adminTableBody',
  'adminLoading', 'adminEmpty',
];

const MOCK_NDA = {
  id: 'req-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  company: 'Acme Corp',
  formType: 'nda',
  matterDescription: 'Confidentiality agreement',
  status: 'pending',
  createdAt: new Date('2026-06-01').toISOString(),
  approvedAt: null,
  approvedBy: null,
  downloadToken: null,
  tokenExpiresAt: null,
};

const MOCK_WAIVER = {
  id: 'req-2',
  name: 'John Smith',
  email: 'john@example.com',
  phone: '555-0200',
  company: '',
  formType: 'waiver',
  matterDescription: 'Event liability waiver',
  status: 'pending',
  createdAt: new Date('2026-06-02').toISOString(),
  approvedAt: null,
  approvedBy: null,
  downloadToken: null,
  tokenExpiresAt: null,
};

function createDOM() {
  for (const id of REQUEST_ELEMENT_IDS) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  document.getElementById('adminLoading').classList.add('hidden');
}

function setGlobals(pdfjsLibOverride) {
  window.AdminAuth = {
    getToken: () => 'test-token',
    isLoggedIn: () => true,
    showError: vi.fn(),
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
  window.pdfjsLib = pdfjsLibOverride || {
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({ width: 600, height: 800 }),
          render: vi.fn(),
        }),
      }),
    }),
  };
}

function loadScript() {
  const src = readFileSync(resolve(__dirname, '..', 'public/js/admin-requests.js'), 'utf8');
  (0, eval)(src);
}

function cleanup() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }
  document.body.innerHTML = '';
  delete window.AdminAuth;
  delete window.AdminRequests;
  delete window.AdminUtils;
  delete window.pdfjsLib;
  vi.restoreAllMocks();
}

describe('Approve Modal', () => {
  afterEach(cleanup);

  describe('NDA requests', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
        blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('renders NDA-specific fields (Client Name, Effective Date, Client Address)', () => {
      const approveBtn = document.querySelector('button[data-action="approve"]');
      expect(approveBtn).not.toBeNull();
      approveBtn.click();

      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.querySelector('#revFieldClientName')).not.toBeNull();
      expect(overlay.querySelector('#revFieldEffectiveDate')).not.toBeNull();
      expect(overlay.querySelector('#revFieldClientAddress')).not.toBeNull();
      expect(overlay.querySelector('#revFieldDate')).toBeNull();
      expect(overlay.querySelector('#revFieldMatter')).toBeNull();
    });

    it('has custom message textarea and Approve & Send button', () => {
      document.querySelector('button[data-action="approve"]').click();
      const overlay = document.querySelector('.modal-overlay');

      expect(overlay.querySelector('#revCustomMessage')).not.toBeNull();
      const btn = overlay.querySelector('#revApproveBtn');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Approve');
    });
  });

  describe('Waiver requests', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_WAIVER] }),
        blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('renders Waiver-specific fields (Client Name, Date, Matter)', () => {
      const approveBtn = document.querySelector('button[data-action="approve"]');
      expect(approveBtn).not.toBeNull();
      approveBtn.click();

      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.querySelector('#revFieldClientName')).not.toBeNull();
      expect(overlay.querySelector('#revFieldDate')).not.toBeNull();
      expect(overlay.querySelector('#revFieldMatter')).not.toBeNull();
      expect(overlay.querySelector('#revFieldEffectiveDate')).toBeNull();
      expect(overlay.querySelector('#revFieldClientAddress')).toBeNull();
    });
  });

  describe('modal lifecycle', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
        blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('Cancel button closes modal', () => {
      document.querySelector('button[data-action="approve"]').click();
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      overlay.querySelector('.rev-modal__cancel').click();
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });

    it('Escape key closes modal', () => {
      document.querySelector('button[data-action="approve"]').click();
      expect(document.querySelector('.modal-overlay')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });

    it('click on overlay closes modal', () => {
      document.querySelector('button[data-action="approve"]').click();
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      overlay.click();
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });
  });

  describe('approve POST payload', () => {
    let postedBody = null;

    beforeEach(async () => {
      postedBody = null;
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockImplementation(function (url, opts) {
        if (url.indexOf('/approve') !== -1 && opts && opts.body) {
          postedBody = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'ok' }) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ requests: [MOCK_NDA] }),
          blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
        });
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('sends documentFields and adminMessage', async () => {
      document.querySelector('button[data-action="approve"]').click();
      const overlay = document.querySelector('.modal-overlay');

      overlay.querySelector('#revFieldClientName').value = 'Edited Name';
      overlay.querySelector('#revFieldEffectiveDate').value = 'June 10, 2026';
      overlay.querySelector('#revFieldClientAddress').value = 'New Address';
      overlay.querySelector('#revCustomMessage').value = 'Hello Jane';
      overlay.querySelector('#revApproveBtn').click();

      await Promise.resolve();
      await Promise.resolve();

      expect(postedBody).not.toBeNull();
      expect(postedBody.adminMessage).toBe('Hello Jane');
      expect(postedBody.documentFields.clientName).toBe('Edited Name');
      expect(postedBody.documentFields.effectiveDate).toBe('June 10, 2026');
      expect(postedBody.documentFields.clientAddress).toBe('New Address');
    });
  });
});

describe('Reject Modal', () => {
  afterEach(cleanup);

  describe('rendering and summary', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('renders request summary and rejection reason textarea', () => {
      const rejectBtn = document.querySelector('button[data-action="reject"]');
      expect(rejectBtn).not.toBeNull();
      rejectBtn.click();

      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.textContent).toContain('Jane Doe');
      expect(overlay.textContent).toContain('jane@example.com');
      expect(overlay.querySelector('#revRejectReason')).not.toBeNull();
    });

    it('Reject button disabled until reason entered, enables on input', () => {
      document.querySelector('button[data-action="reject"]').click();
      const overlay = document.querySelector('.modal-overlay');
      const rejectSend = overlay.querySelector('#revRejectBtn');
      const reasonInput = overlay.querySelector('#revRejectReason');

      expect(rejectSend.disabled).toBe(true);

      reasonInput.value = 'Not eligible';
      reasonInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(rejectSend.disabled).toBe(false);
    });
  });

  describe('reject POST payload', () => {
    let postedBody = null;

    beforeEach(async () => {
      postedBody = null;
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockImplementation(function (url, opts) {
        if (url.indexOf('/reject') !== -1 && opts && opts.body) {
          postedBody = JSON.parse(opts.body);
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ message: 'ok' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ requests: [MOCK_NDA] }) });
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('sends rejectionReason', async () => {
      document.querySelector('button[data-action="reject"]').click();
      const overlay = document.querySelector('.modal-overlay');

      overlay.querySelector('#revRejectReason').value = 'Not eligible for this form';
      overlay.querySelector('#revRejectReason').dispatchEvent(new Event('input', { bubbles: true }));
      overlay.querySelector('#revRejectBtn').click();

      await Promise.resolve();
      await Promise.resolve();

      expect(postedBody).not.toBeNull();
      expect(postedBody.rejectionReason).toBe('Not eligible for this form');
    });
  });

  describe('modal lifecycle', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('Cancel button closes reject modal', () => {
      document.querySelector('button[data-action="reject"]').click();
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).not.toBeNull();
      overlay.querySelector('.rev-modal__cancel').click();
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });

    it('Escape key closes reject modal', () => {
      document.querySelector('button[data-action="reject"]').click();
      expect(document.querySelector('.modal-overlay')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(document.querySelector('.modal-overlay')).toBeNull();
    });

    it('removes previous modal before opening new one', () => {
      // Need blob for approve modal PDF preview
      document.querySelector('button[data-action="approve"]').click();
      expect(document.querySelectorAll('.modal-overlay').length).toBe(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      document.querySelector('button[data-action="reject"]').click();
      expect(document.querySelectorAll('.modal-overlay').length).toBe(1);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockImplementation(function (url, opts) {
        if (url.indexOf('/reject') !== -1 && opts && opts.body) {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'fail' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ requests: [MOCK_NDA] }) });
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('re-enables reject button on API failure', async () => {
      document.querySelector('button[data-action="reject"]').click();
      const overlay = document.querySelector('.modal-overlay');

      overlay.querySelector('#revRejectReason').value = 'Reason';
      overlay.querySelector('#revRejectReason').dispatchEvent(new Event('input', { bubbles: true }));
      overlay.querySelector('#revRejectBtn').click();

      // Nested .then() chain: fetch → outer .then → resp.json().then(inner) → throw → .catch
      // Use setTimeout to reliably flush all pending microtasks
      await new Promise(function (r) { setTimeout(r, 10); });

      expect(overlay.querySelector('#revRejectBtn').disabled).toBe(false);
    });
  });
});

describe('Email Preview', () => {
  afterEach(cleanup);

  describe('approve modal email preview', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
        blob: () => Promise.resolve(new Blob(['%PDF'], { type: 'application/pdf' })),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('shows Email Preview tab alongside Document PDF tab', () => {
      document.querySelector('button[data-action="approve"]').click();
      const tabs = document.querySelectorAll('.rev-modal__preview-tab');
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent).toContain('Document PDF');
      expect(tabs[1].textContent).toContain('Email Preview');
    });

    it('Document PDF tab is active by default, Email Preview iframe hidden', () => {
      document.querySelector('button[data-action="approve"]').click();
      const pdfTab = document.querySelector('.rev-modal__preview-tab[data-tab="pdf"]');
      const emailTab = document.querySelector('.rev-modal__preview-tab[data-tab="email"]');
      expect(pdfTab.classList.contains('rev-modal__preview-tab--active')).toBe(true);
      expect(emailTab.classList.contains('rev-modal__preview-tab--active')).toBe(false);
      expect(document.getElementById('revEmailPreview').style.display).toBe('none');
    });

    it('clicking Email Preview tab shows iframe with approval email HTML', async () => {
      document.querySelector('button[data-action="approve"]').click();

      // Type a custom message
      const msgEl = document.getElementById('revCustomMessage');
      msgEl.value = 'Hello Jane, your forms are ready.';
      msgEl.dispatchEvent(new Event('input', { bubbles: true }));

      // Click Email Preview tab
      const emailTab = document.querySelector('.rev-modal__preview-tab[data-tab="email"]');
      emailTab.click();

      // Wait for srcdoc to be set (sync in our code)
      await Promise.resolve();

      const emailPreview = document.getElementById('revEmailPreview');
      expect(emailPreview.style.display).not.toBe('none');

      const iframe = document.getElementById('revEmailIframe');
      expect(iframe).not.toBeNull();
      expect(iframe.srcdoc).toContain('Your Legal Forms Are Ready');
      expect(iframe.srcdoc).toContain('Hello Jane, your forms are ready.');
      expect(iframe.srcdoc).toContain('Covington');
      expect(iframe.srcdoc).toContain('Jane Doe');
    });

    it('toggling back to PDF tab hides email preview and shows PDF controls', () => {
      document.querySelector('button[data-action="approve"]').click();

      // Switch to email
      document.querySelector('.rev-modal__preview-tab[data-tab="email"]').click();
      expect(document.getElementById('revEmailPreview').style.display).not.toBe('none');

      // Switch back to PDF
      document.querySelector('.rev-modal__preview-tab[data-tab="pdf"]').click();
      expect(document.getElementById('revEmailPreview').style.display).toBe('none');
      expect(document.getElementById('revPreviewBody').style.display).not.toBe('none');
    });
  });

  describe('reject modal email preview', () => {
    beforeEach(async () => {
      createDOM();
      setGlobals();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requests: [MOCK_NDA] }),
      });
      loadScript();
      window.AdminRequests.load();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('shows Email Preview toggle button', () => {
      document.querySelector('button[data-action="reject"]').click();
      const toggleBtn = document.querySelector('.rev-modal__email-toggle-btn');
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.textContent).toContain('Email Preview');
    });

    it('email preview is collapsed by default', () => {
      document.querySelector('button[data-action="reject"]').click();
      expect(document.getElementById('revEmailPreview').style.display).toBe('none');
    });

    it('clicking toggle expands email preview with rejection email HTML', async () => {
      document.querySelector('button[data-action="reject"]').click();

      // Type a reason
      const reasonEl = document.getElementById('revRejectReason');
      reasonEl.value = 'Not eligible for this form type.';
      reasonEl.dispatchEvent(new Event('input', { bubbles: true }));

      // Click toggle to expand
      document.querySelector('.rev-modal__email-toggle-btn').click();

      await Promise.resolve();

      const emailPreview = document.getElementById('revEmailPreview');
      expect(emailPreview.style.display).not.toBe('none');

      const iframe = document.getElementById('revEmailIframe');
      expect(iframe).not.toBeNull();
      expect(iframe.srcdoc).toContain('Your Form Request Has Been Declined');
      expect(iframe.srcdoc).toContain('Not eligible for this form type.');
      expect(iframe.srcdoc).toContain('Jane Doe');
    });

    it('collapsing email preview hides iframe', () => {
      document.querySelector('button[data-action="reject"]').click();

      const btn = document.querySelector('.rev-modal__email-toggle-btn');
      btn.click(); // expand
      expect(document.getElementById('revEmailPreview').style.display).not.toBe('none');

      btn.click(); // collapse
      expect(document.getElementById('revEmailPreview').style.display).toBe('none');
    });
  });
});
