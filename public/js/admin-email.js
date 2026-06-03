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
  // Email-safe: table-based layout, ALL inline styles, live text (no images).
  // 4 selectable header variants (A/B/C/D), default D.

  function emailHeaderA() {
    return '<td style="background-color:#0A1628;padding:36px 40px 30px;text-align:center;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:26px;font-weight:bold;color:#FFFFFF;letter-spacing:1px;">Covington <span style="color:#B08D57;">&amp;</span> Burling</div>'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:6px;color:#9AA3B2;margin-top:6px;text-transform:uppercase;">L L P</div>'
      + '<div style="width:36px;height:2px;background-color:#B08D57;margin:14px auto 6px;"></div>'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:4px;color:#B08D57;text-transform:uppercase;">Attorneys at Law</div>'
      + '</td>';
  }

  function emailHeaderB() {
    return '<td style="padding:0;">'
      + '<div style="height:3px;background-color:#B08D57;line-height:3px;font-size:0;">&nbsp;</div>'
      + '<div style="background-color:#0A1628;padding:20px 40px;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Covington <span style="color:#B08D57;">&amp;</span> Burling</div>'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:5px;color:#9AA3B2;margin-top:4px;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; Attorneys at Law</div>'
      + '</div>'
      + '</td>';
  }

  function emailHeaderC() {
    return '<td style="background-color:#FAF9F6;padding:28px 40px 24px;">'
      + '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>'
      + '<td style="width:56px;vertical-align:middle;">'
      + '<div style="width:48px;height:48px;border-radius:50%;background-color:#0A1628;text-align:center;line-height:48px;">'
      + '<span style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:22px;font-weight:bold;color:#FFFFFF;">C</span><span style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:22px;font-weight:bold;color:#B08D57;">B</span>'
      + '</div></td>'
      + '<td style="vertical-align:middle;padding-left:14px;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:21px;font-weight:bold;color:#0A1628;letter-spacing:0.3px;">Covington <span style="color:#B08D57;">&amp;</span> Burling</div>'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:5px;color:#5A6577;margin-top:3px;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; Attorneys at Law</div>'
      + '</td></tr></table>'
      + '</td>';
  }

  function emailHeaderD() {
    return '<td style="background-color:#FFFFFF;padding:34px 40px 22px;text-align:center;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:28px;font-weight:bold;color:#0A1628;letter-spacing:1.5px;">COVINGTON <span style="color:#B08D57;">&amp;</span> BURLING</div>'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:7px;color:#5A6577;margin-top:7px;">L L P</div>'
      + '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>'
      + '<td style="width:30px;height:1px;background-color:#B08D57;line-height:1px;font-size:0;">&nbsp;</td>'
      + '<td style="padding:0 10px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:4px;color:#B08D57;text-transform:uppercase;">Attorneys at Law</td>'
      + '<td style="width:30px;height:1px;background-color:#B08D57;line-height:1px;font-size:0;">&nbsp;</td>'
      + '</tr></table>'
      + '</td>'
      + '</tr>'
      + '<tr><td style="background-color:#0A1628;height:3px;line-height:3px;font-size:0;">&nbsp;</td>';
  }

  var EMAIL_HEADERS = { A: emailHeaderA, B: emailHeaderB, C: emailHeaderC, D: emailHeaderD };

  function emailFooter() {
    return '<td style="background-color:#FAF9F6;padding:26px 40px 30px;border-top:1px solid #E4E0D8;text-align:center;font-family:Arial,Helvetica,sans-serif;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;font-weight:bold;color:#0A1628;letter-spacing:0.3px;">Covington &amp; Burling LLP</div>'
      + '<div style="font-size:12px;color:#5A6577;margin-top:8px;line-height:1.6;">850 Tenth Street NW, Washington, DC 20001<br>'
      + '202&#8209;662&#8209;6000 &nbsp;|&nbsp; <a href="https://covbur.com" style="color:#B08D57;text-decoration:none;">covbur.com</a></div>'
      + '<div style="font-size:10px;color:#9AA3B2;margin-top:12px;letter-spacing:0.5px;text-transform:uppercase;">'
      + 'Founded 1919 &nbsp;&#183;&nbsp; This message is confidential &amp; attorney&#8209;client privileged</div>'
      + '</td>';
  }

  function buildEmailLayout(headerHtml, bodyHtml) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + '<body style="margin:0;padding:0;background-color:#ECECEC;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECECEC;padding:24px 0;">'
      + '<tr><td align="center">'
      + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:6px;overflow:hidden;">'
      + '<tr>' + headerHtml + '</tr>'
      + '<tr><td style="padding:34px 40px;font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;line-height:1.7;color:#1A1A1A;">' + bodyHtml + '</td></tr>'
      + '<tr>' + emailFooter() + '</tr>'
      + '</table>'
      + '</td></tr></table>'
      + '</body></html>';
  }

  function buildEmailHtml(body, variant) {
    var escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    var bodyHtml = escaped
      .split(/\n\n+/)
      .map(function (p) {
        var t = p.trim();
        if (!t) return '';
        return '<p style="margin:0 0 16px;">' + t.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');

    if (!bodyHtml) {
      bodyHtml = '<p style="margin:0;font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;line-height:1.7;color:#999;">'
        + 'Email body will appear here&hellip;</p>';
    }

    var v = (variant || 'D').toUpperCase();
    var headerFn = EMAIL_HEADERS[v] || EMAIL_HEADERS.D;
    return buildEmailLayout(headerFn(), bodyHtml);
  }

  // ── Live Email Preview ──────────────────────────────────────────
  var previewIframe = document.getElementById('emailPreviewIframe');
  var previewSubject = document.getElementById('emailPreviewSubject');
  var bodyInput = document.getElementById('emailBody');
  var subjectInput = document.getElementById('emailSubject');
  var variantSelect = document.getElementById('emailVariant');
  var previewDebounce = null;

  function getSelectedVariant() {
    return variantSelect ? variantSelect.value : 'D';
  }

  function updateEmailPreview() {
    if (previewSubject) {
      var subj = subjectInput ? subjectInput.value.trim() : '';
      previewSubject.textContent = subj || '(No subject)';
    }
    if (previewIframe) {
      previewIframe.srcdoc = buildEmailHtml(bodyInput ? bodyInput.value : '', getSelectedVariant());
    }
  }

  function schedulePreview() {
    if (previewDebounce) clearTimeout(previewDebounce);
    previewDebounce = setTimeout(updateEmailPreview, 300);
  }

  if (bodyInput) bodyInput.addEventListener('input', schedulePreview);
  if (subjectInput) subjectInput.addEventListener('input', schedulePreview);
  if (variantSelect) variantSelect.addEventListener('change', updateEmailPreview);

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

  // ── File Attachment ──────────────────────────────────────────────
  var fileInput = document.getElementById('emailAttachment');
  var fileNameEl = document.getElementById('emailAttachmentName');
  var attachmentData = null;

  if (fileInput && fileNameEl) {
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) {
        attachmentData = null;
        fileNameEl.textContent = 'No file chosen';
        return;
      }
      fileNameEl.textContent = file.name;

      var reader = new FileReader();
      reader.onload = function () {
        var base64Content = reader.result.split(',')[1];
        attachmentData = { name: file.name, content: base64Content };
      };
      reader.onerror = function () {
        attachmentData = null;
        fileNameEl.textContent = 'Error reading file';
      };
      reader.readAsDataURL(file);
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

      var payload = { toEmail: toEmail, toName: toName, subject: subject, body: body, variant: getSelectedVariant() };
      if (attachmentData) {
        payload.attachment = attachmentData;
      }

      fetch(apiBase + '/send-email', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () {
          showStatus('Email sent to ' + toEmail + '.', 'success');
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
          if (fileInput) { fileInput.value = ''; }
          if (fileNameEl) { fileNameEl.textContent = 'No file chosen'; }
          attachmentData = null;
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
