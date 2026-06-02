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
      body: '<p>Dear {name},</p>\n<p>Your request for legal forms has been approved. Please use the secure download link(s) in your original approval email to access your documents.</p>\n<p>If you have any questions, please contact our office at 202-662-6000.</p>\n<p>Sincerely,<br>Covington & Burling LLP</p>',
    },
    'follow-up': {
      subject: 'Follow-Up: Covington & Burling LLP',
      body: '<p>Dear {name},</p>\n<p>I am writing to follow up regarding your recent inquiry. Our team is available to discuss your legal needs at your convenience.</p>\n<p>Please do not hesitate to contact our office at 202-662-6000 to schedule a consultation.</p>\n<p>Sincerely,<br>Covington & Burling LLP</p>',
    },
    'consultation': {
      subject: 'Consultation Confirmation — Covington & Burling LLP',
      body: '<p>Dear {name},</p>\n<p>This message confirms your consultation with Covington & Burling LLP. An attorney from our team will contact you shortly to discuss your matter.</p>\n<p>In preparation, please gather any relevant documents or correspondence related to your legal needs.</p>\n<p>Sincerely,<br>Covington & Burling LLP</p>',
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
      var iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}</style></head><body>' + (bodyInput.value || '<p style="color:#999;font-style:italic;">Email body will appear here...</p>') + '</body></html>');
      iframeDoc.close();
    }
  }

  function schedulePreview() {
    if (previewDebounce) clearTimeout(previewDebounce);
    previewDebounce = setTimeout(updateEmailPreview, 300);
  }

  if (bodyInput) bodyInput.addEventListener('input', schedulePreview);
  if (subjectInput) subjectInput.addEventListener('input', schedulePreview);

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
