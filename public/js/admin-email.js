(function () {
  'use strict';

  if (!document.getElementById('adminEmailSection')) return;

  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '';

  function getToken() {
    return window.AdminAuth ? window.AdminAuth.getToken() : sessionStorage.getItem('admin_token');
  }

  var form = document.getElementById('emailForm');
  var statusEl = document.getElementById('emailStatus');
  var recipientSelect = document.getElementById('emailRecipient');

  // Template presets
  var templates = {
    'approved-forms': {
      subject: 'Your Covington & Burling Legal Forms Are Ready',
      body: 'Dear {name},\n\nYour request for legal forms has been approved. Please use the secure download link(s) in your original approval email to access your documents.\n\nIf you have any questions, please contact our office at 202-662-6000.\n\nSincerely,\nCovington & Burling LLP',
    },
    'follow-up': {
      subject: 'Follow-Up: Covington & Burling LLP',
      body: 'Dear {name},\n\nI am writing to follow up regarding your recent inquiry. Our team is available to discuss your legal needs at your convenience.\n\nPlease do not hesitate to contact our office at 202-662-6000 to schedule a consultation.\n\nSincerely,\nCovington & Burling LLP',
    },
    'consultation': {
      subject: 'Consultation Confirmation — Covington & Burling LLP',
      body: 'Dear {name},\n\nThis message confirms your consultation with Covington & Burling LLP. An attorney from our team will contact you shortly to discuss your matter.\n\nIn preparation, please gather any relevant documents or correspondence related to your legal needs.\n\nSincerely,\nCovington & Burling LLP',
    },
  };

  // Load approved recipients for autofill
  function loadRecipients() {
    if (!recipientSelect) return;

    fetch(apiBase + '/requests', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var requests = data.requests || [];
        var approved = requests.filter(function (r) { return r.status === 'approved'; });

        recipientSelect.innerHTML = '<option value="">Select a recipient...</option>' +
          approved.map(function (r) {
            return '<option value="' + AdminUtils.escAttr(r.email) + '" data-name="' + AdminUtils.escAttr(r.name) + '">' +
              AdminUtils.escHtml(r.name) + ' (' + AdminUtils.escHtml(r.email) + ')' +
            '</option>';
          }).join('');
      })
      .catch(function () { /* recipient list is optional */ });
  }

  // Autofill name when recipient selected
  if (recipientSelect) {
    recipientSelect.addEventListener('change', function () {
      var opt = this.options[this.selectedIndex];
      var name = opt.getAttribute('data-name') || '';
      var nameInput = document.getElementById('emailToName');
      if (nameInput) nameInput.value = name;
    });
  }

  // Template preset buttons
  var presetContainer = document.getElementById('emailTemplates');
  if (presetContainer) {
    presetContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !btn.dataset.template) return;
      var tmpl = templates[btn.dataset.template];
      if (!tmpl) return;

      var nameInput = document.getElementById('emailToName');
      var name = nameInput ? nameInput.value : '';
      var subjectInput = document.getElementById('emailSubject');
      var bodyInput = document.getElementById('emailBody');

      if (subjectInput) subjectInput.value = tmpl.subject;
      if (bodyInput) bodyInput.value = tmpl.body.replace(/\{name\}/g, name || 'Client');
    });
  }

  // ── Live Email Preview ──────────────────────────────────────────
  var previewIframe = document.getElementById('emailPreviewIframe');
  var previewSubject = document.getElementById('emailPreviewSubject');
  var bodyInput = document.getElementById('emailBody');
  var subjectInput = document.getElementById('emailSubject');
  var previewDebounce = null;

  function updateEmailPreview() {
    if (previewSubject) {
      var subj = subjectInput ? subjectInput.value.trim() : '';
      previewSubject.textContent = subj || '(No subject)';
    }
    if (previewIframe && bodyInput) {
      var body = bodyInput.value || 'Email body will appear here...';
      var escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      previewIframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.7;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;white-space:pre-wrap;word-wrap:break-word}</style></head><body>' + escaped + '</body></html>';
    }
  }

  function schedulePreview() {
    if (previewDebounce) clearTimeout(previewDebounce);
    previewDebounce = setTimeout(updateEmailPreview, 300);
  }

  if (bodyInput) bodyInput.addEventListener('input', schedulePreview);
  if (subjectInput) subjectInput.addEventListener('input', schedulePreview);

  // Set a default template so preview is visible on load
  if (bodyInput && !bodyInput.value) {
    bodyInput.value = 'Dear Client,\n\nThank you for contacting Covington & Burling LLP. We are pleased to assist you with your legal needs.\n\nPlease do not hesitate to reach out if you have any questions.\n\nSincerely,\nCovington & Burling LLP';
    if (subjectInput && !subjectInput.value) {
      subjectInput.value = 'Covington & Burling LLP';
    }
  }

  // Initial preview
  updateEmailPreview();

  // Update preview when template is selected
  if (presetContainer) {
    presetContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !btn.dataset.template) return;
      // Wait for the template to be applied, then update preview
      setTimeout(updateEmailPreview, 50);
    });
  }

  // ── Send ─────────────────────────────────────────────────────────
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var toEmail = document.getElementById('emailToEmail').value.trim();
      var toName = document.getElementById('emailToName').value.trim();
      var subject = document.getElementById('emailSubject').value.trim();
      var body = document.getElementById('emailBody').value.trim();

      if (!toEmail || !subject || !body) {
        showStatus('Please fill in all required fields.', 'error');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      var origText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
      hideStatus();

      fetch(apiBase + '/send-email', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: toEmail, toName: toName, subject: subject, body: body })
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () {
          showStatus('Email sent to ' + toEmail + '.', 'success');
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
        })
        .catch(function (err) {
          showStatus('Failed to send: ' + (err.error || err.message || 'Unknown error'), 'error');
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
        });
    });
  }

  function showStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
    statusEl.style.background = type === 'success' ? 'var(--approved-bg)' : 'var(--rejected-bg)';
    statusEl.style.color = type === 'success' ? 'var(--success)' : 'var(--error)';
  }

  function hideStatus() {
    if (statusEl) statusEl.style.display = 'none';
  }

  window.AdminEmail = {
    init: loadRecipients
  };
})();
