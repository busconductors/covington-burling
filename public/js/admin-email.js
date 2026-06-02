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

  // Template presets (plain text body content)
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

  // ── Branded HTML Email Template ──────────────────────────────────
  // Wraps plain-text body in a Covington & Burling branded HTML email.
  // Uses inline styles for email client compatibility.
  function buildEmailHtml(body) {
    var escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Turn double-newline blocks into <p> paragraphs, single newlines into <br>
    var bodyHtml = escaped
      .split(/\n\n+/)
      .map(function (p) {
        var t = p.trim();
        if (!t) return '';
        return '<p style="margin:0 0 1em;font-family:Georgia,Times,serif;font-size:15px;line-height:1.7;color:#1A1A1A;">'
          + t.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');

    if (!bodyHtml) {
      bodyHtml = '<p style="margin:0;font-family:Georgia,Times,serif;font-size:15px;line-height:1.7;color:#999;">'
        + 'Email body will appear here&hellip;</p>';
    }

    // Inline SVG monogram for the header — no external deps for email
    var monogram = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 160 160" style="display:block;margin:0 auto 10px;">'
      + '<g transform="translate(20,20)">'
      + '<circle cx="60" cy="60" r="56" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.6"/>'
      + '<circle cx="60" cy="60" r="50" fill="none" stroke="#B08D57" stroke-width="2" opacity="0.9"/>'
      + '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="Georgia,Times,serif" font-weight="600" font-size="46" letter-spacing="-2" fill="#FFFFFF">C<tspan fill="#B08D57">B</tspan></text>'
      + '</g></svg>';

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
      + '<body style="margin:0;padding:0;background-color:#F4F2EE;">'
      + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F4F2EE;padding:24px 0;">'
      + '<tr><td align="center">'
      + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFFFF;border-radius:4px;overflow:hidden;max-width:600px;">'
      // ── Header: navy bar with gold accent and monogram ──
      + '<tr><td style="background-color:#0A1628;padding:28px 40px 24px;text-align:center;">'
      + monogram
      + '<div style="font-family:Georgia,Times,serif;font-size:20px;color:#FFFFFF;font-weight:700;letter-spacing:0.04em;">'
      + 'COVINGTON<span style="font-weight:400;"> &amp; </span>BURLING<span style="font-weight:400;color:#B08D57;"> LLP</span>'
      + '</div>'
      + '<div style="width:32px;height:2px;background-color:#B08D57;margin:12px auto 0;"></div>'
      + '</td></tr>'
      // ── Body ──
      + '<tr><td style="padding:36px 40px 20px;">' + bodyHtml + '</td></tr>'
      // ── Footer ──
      + '<tr><td style="background-color:#F9F8F6;padding:20px 40px;border-top:1px solid #E8E4DD;text-align:center;">'
      + '<div style="font-family:Georgia,Times,serif;font-size:13px;color:#666;line-height:1.7;">'
      + '<strong style="color:#0A1628;">Covington &amp; Burling LLP</strong><br>'
      + '850 Tenth Street NW, Washington, DC 20001<br>'
      + '202-662-6000 &nbsp;|&nbsp; covington.com'
      + '</div>'
      + '<div style="font-family:Georgia,Times,serif;font-size:11px;color:#A0A0A0;margin-top:6px;">'
      + 'Founded 1919 &nbsp;|&nbsp; This message is confidential.'
      + '</div>'
      + '</td></tr>'
      + '</table>'
      + '</td></tr></table>'
      + '</body></html>';
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
    if (previewIframe) {
      previewIframe.srcdoc = buildEmailHtml(bodyInput ? bodyInput.value : '');
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
