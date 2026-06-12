(function () {
  'use strict';

  if (!document.getElementById('adminRequestsSection')) return;

  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '';
  var requestsData = [];
  var pendingCount = 0;

  var table = document.getElementById('adminTable');
  var tableBody = document.getElementById('adminTableBody');
  var loading = document.getElementById('adminLoading');
  var empty = document.getElementById('adminEmpty');
  var currentEscHandler = null;

  function getToken() {
    return window.AdminAuth ? window.AdminAuth.getToken() : sessionStorage.getItem('admin_token');
  }

  function loadRequests() {
    if (!loading) return;
    loading.classList.remove('hidden');
    if (table) table.classList.add('hidden');
    if (empty) empty.classList.add('hidden');

    fetch(apiBase + '/requests', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) {
        if (r.status === 401) {
          sessionStorage.removeItem('admin_token');
          location.reload();
          throw new Error('Unauthorized');
        }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(function (data) {
        loading.classList.add('hidden');
        requestsData = data.requests || [];
        pendingCount = requestsData.filter(function (r) { return r.status === 'pending'; }).length;
        updatePendingBadge();
        if (requestsData.length === 0) {
          empty.classList.remove('hidden');
          return;
        }
        table.classList.remove('hidden');
        renderTable();
        updateTotalNotice(data.total);
      })
      .catch(function (err) {
        if (err.message !== 'Unauthorized') {
          loading.textContent = 'Failed to load requests. Please try again.';
        }
      });
  }

  function addTd(tr, label, html) {
    var td = document.createElement('td');
    td.setAttribute('data-label', label);
    td.innerHTML = html;
    tr.appendChild(td);
  }

  function renderTable() {
    tableBody.innerHTML = '';
    requestsData.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-clickable', '');
      tr.setAttribute('data-id', r.id);
      var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
      var formLabel = r.formType === 'waiver' ? 'Waiver' : r.formType === 'nda' ? 'NDA' : 'Both';
      var statusClass = 'status-badge--' + r.status;

      addTd(tr, 'Date', date);
      addTd(tr, 'Name', '<strong>' + AdminUtils.escHtml(r.name) + '</strong>' + (r.company ? '<br><span style="color:var(--text-muted);font-size:0.8125rem;">' + AdminUtils.escHtml(r.company) + '</span>' : ''));
      addTd(tr, 'Email', '<a href="mailto:' + AdminUtils.escHtml(r.email) + '">' + AdminUtils.escHtml(r.email) + '</a>' + (r.phone ? '<br><span style="color:var(--text-muted);font-size:0.8125rem;">' + AdminUtils.escHtml(r.phone) + '</span>' : ''));
      addTd(tr, 'Form', '<span class="status-badge status-badge--pending" style="background:#EFECE7;color:var(--text-muted);">' + formLabel + '</span>');
      addTd(tr, 'Status', '<span class="status-badge ' + statusClass + '">' + AdminUtils.escHtml(r.status) + '</span>');
      addTd(tr, 'Actions', actionsHtml(r));

      tableBody.appendChild(tr);
    });
  }

  function actionsHtml(r) {
    if (r.status !== 'pending') {
      var at = r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      var label = '<span style="color:var(--text-muted);font-size:0.8125rem;">' + AdminUtils.escHtml(r.status === 'approved' ? 'Approved' : 'Rejected') + ' ' + at + '</span>';
      if (r.status === 'approved') {
        label += ' <button class="btn--sm btn--approve" data-id="' + AdminUtils.escAttr(r.id) + '" data-action="resend">Resend Email</button>';
      }
      return label;
    }
    return '<button class="btn--sm btn--approve" data-id="' + AdminUtils.escAttr(r.id) + '" data-action="approve">Approve</button>' +
      '<button class="btn--sm btn--reject" data-id="' + AdminUtils.escAttr(r.id) + '" data-action="reject">Reject</button>';
  }

  function resendEmail(id, btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
    fetch(apiBase + '/requests/' + id + '/resend-email', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
    })
      .then(function (resp) { return resp.json().then(function (d) { if (!resp.ok) throw d; return d; }); })
      .then(function (d) {
        btn.textContent = 'Sent ✓';
        setTimeout(function () { btn.disabled = false; btn.textContent = 'Resend Email'; }, 3000);
      })
      .catch(function (err) {
        if (window.AdminAuth) window.AdminAuth.showError(err && err.error ? err.error : 'Failed to re-send email.');
        btn.disabled = false;
        btn.textContent = 'Resend Email';
      });
  }

  // Row click → detail modal
  tableBody.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (btn) return; // don't open modal on button click

    var row = e.target.closest('tr[data-id]');
    if (!row) return;
    var id = row.getAttribute('data-id');
    openDetailModal(id);
  });

  // Approve / reject via delegation
  tableBody.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (!id) return;

    if (btn.dataset.action === 'approve') {
      openApproveModal(id);
    }

    if (btn.dataset.action === 'reject') {
      openRejectModal(id);
    }

    if (btn.dataset.action === 'resend') {
      resendEmail(id, btn);
    }
  });

  // ── Approve Modal ────────────────────────────────────────────────────
  var previewTimer = null;

  function openApproveModal(id) {
    var r = requestsData.find(function (req) { return req.id === id; });
    if (!r) return;

    // Clean up existing modal
    if (currentEscHandler) {
      document.removeEventListener('keydown', currentEscHandler);
      currentEscHandler = null;
    }
    var existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var formLabel = r.formType === 'waiver' ? 'Waiver and Release of Liability'
      : r.formType === 'nda' ? 'Mutual Non-Disclosure Agreement'
      : 'Waiver and NDA (Both)';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Build editable fields by form type
    var fieldsHtml = '';
    if (r.formType === 'nda') {
      fieldsHtml = '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Client Name</label>' +
          '<input class="rev-modal__input" id="revFieldClientName" value="' + AdminUtils.escAttr(r.name) + '">' +
        '</div>' +
        '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Effective Date</label>' +
          '<input class="rev-modal__input" id="revFieldEffectiveDate" placeholder="e.g. June 2, 2026">' +
        '</div>' +
        '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Client Address</label>' +
          '<input class="rev-modal__input" id="revFieldClientAddress" value="' + AdminUtils.escAttr(r.company || '') + '">' +
        '</div>';
    } else {
      fieldsHtml = '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Client Name</label>' +
          '<input class="rev-modal__input" id="revFieldClientName" value="' + AdminUtils.escAttr(r.name) + '">' +
        '</div>' +
        '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Date</label>' +
          '<input class="rev-modal__input" id="revFieldDate" placeholder="e.g. June 2, 2026">' +
        '</div>' +
        '<div class="rev-modal__field-group">' +
          '<label class="rev-modal__label">Matter</label>' +
          '<input class="rev-modal__input" id="revFieldMatter" value="' + AdminUtils.escAttr(r.matterDescription || '') + '">' +
        '</div>';
    }

    overlay.innerHTML = '<div class="modal rev-modal rev-modal--approve">' +
      '<div class="modal__header">' +
        '<h2 class="modal__title">Approve Request — ' + AdminUtils.escHtml(r.name) + ' / ' + AdminUtils.escHtml(formLabel) + '</h2>' +
        '<button class="modal__close">&times;</button>' +
      '</div>' +
      '<div class="modal__body">' +
        '<div class="rev-modal__layout">' +
          '<div class="rev-modal__preview">' +
            '<div class="rev-modal__preview-header">PDF Preview</div>' +
            '<div class="rev-modal__preview-body" id="revPreviewBody">' +
              '<div class="rev-modal__preview-placeholder">' +
                '<p>Enter field values to preview the document</p>' +
              '</div>' +
            '</div>' +
            '<div class="rev-modal__preview-controls" id="revPreviewControls" style="display:none;">' +
              '<button class="admin-preview__ctrl-btn" id="revPrevPage" disabled>&lt; Prev</button>' +
              '<span class="admin-preview__page-info" id="revPageInfo">Page 1 of 1</span>' +
              '<button class="admin-preview__ctrl-btn" id="revNextPage" disabled>Next &gt;</button>' +
            '</div>' +
          '</div>' +
          '<div class="rev-modal__fields">' +
            '<div class="rev-modal__section">' +
              '<div class="modal__field-label">Document Fields</div>' +
              '<div class="rev-modal__fields-list">' + fieldsHtml + '</div>' +
            '</div>' +
            '<div class="rev-modal__section">' +
              '<label class="modal__field-label" for="revCustomMessage">Custom Message</label>' +
              '<textarea class="admin-textarea rev-modal__message" id="revCustomMessage" rows="3" placeholder="Add a personal note to the client (appears above the download links)..."></textarea>' +
              '<span class="rev-modal__hint">Optional. Appears above the auto-generated email with download links.</span>' +
            '</div>' +
            '<div class="rev-modal__section">' +
              '<button class="admin-btn--sm rev-modal__builder-btn" id="revOpenBuilder">Open in Document Builder</button>' +
              '<span class="rev-modal__hint">For deeper edits — clauses, signature blocks, layout</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rev-modal__actions">' +
          '<button class="rev-modal__cancel">Cancel</button>' +
          '<button class="rev-modal__approve-btn" id="revApproveBtn">Approve &amp; Send</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);

    // State variables
    var pdfBlob = null;
    var currentPage = 1;
    var totalPages = 1;
    var isFetching = false;

    function getFields() {
      var fields = { clientName: document.getElementById('revFieldClientName').value };
      if (r.formType === 'nda') {
        fields.effectiveDate = document.getElementById('revFieldEffectiveDate').value;
        fields.clientAddress = document.getElementById('revFieldClientAddress').value;
      } else {
        fields.date = document.getElementById('revFieldDate').value;
        fields.matter = document.getElementById('revFieldMatter').value;
      }
      return fields;
    }

    function renderPage(pageNum) {
      if (!pdfBlob) return;
      var blobUrl = URL.createObjectURL(pdfBlob);
      var loadingTask = pdfjsLib.getDocument(blobUrl);
      loadingTask.promise.then(function (pdf) {
        totalPages = pdf.numPages;
        if (pageNum > totalPages) pageNum = totalPages;
        if (pageNum < 1) pageNum = 1;
        currentPage = pageNum;
        document.getElementById('revPageInfo').textContent = 'Page ' + currentPage + ' of ' + totalPages;
        document.getElementById('revPrevPage').disabled = currentPage <= 1;
        document.getElementById('revNextPage').disabled = currentPage >= totalPages;

        pdf.getPage(pageNum).then(function (page) {
          var previewBody = document.getElementById('revPreviewBody');
          if (!previewBody) return;
          previewBody.innerHTML = '';
          var viewport = page.getViewport({ scale: 1.2 });
          var canvas = document.createElement('canvas');
          canvas.className = 'rev-modal__pdf-canvas';
          var ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          var renderContext = { canvasContext: ctx, viewport: viewport };
          page.render(renderContext);
          previewBody.appendChild(canvas);
        });
      }).catch(function (err) {
        console.error('PDF render error:', err);
        var previewBody = document.getElementById('revPreviewBody');
        if (!previewBody) return;
        previewBody.innerHTML = '<div class="rev-modal__preview-placeholder"><p style="color:var(--error);">Failed to render preview. Check field values.</p></div>';
      });
    }

    function fetchPreview() {
      var fields = getFields();
      var endpoint = r.formType === 'nda' ? '/api/generate-nda' : '/api/generate-waiver';
      isFetching = true;
      var previewBody = document.getElementById('revPreviewBody');
      previewBody.innerHTML = '<div class="rev-modal__preview-placeholder"><p>Generating preview…</p></div>';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify(fields),
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error('Generation failed');
          return resp.blob();
        })
        .then(function (blob) {
          pdfBlob = blob;
          currentPage = 1;
          document.getElementById('revPreviewControls').style.display = 'flex';
          renderPage(1);
        })
        .catch(function (err) {
          console.error('Preview fetch error:', err);
          var pb = document.getElementById('revPreviewBody');
          if (!pb) return;
          pb.innerHTML = '<div class="rev-modal__preview-placeholder"><p style="color:var(--error);">Preview generation failed. Check field values and try again.</p></div>';
        })
        .finally(function () {
          isFetching = false;
        });
    }

    function debouncedPreview() {
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = setTimeout(fetchPreview, 500);
    }

    // Wire up field change listeners
    var fieldInputs = overlay.querySelectorAll('.rev-modal__input');
    fieldInputs.forEach(function (input) {
      input.addEventListener('input', debouncedPreview);
    });

    // Initial preview
    fetchPreview();

    // Page navigation
    document.getElementById('revPrevPage').addEventListener('click', function () {
      if (currentPage > 1) renderPage(currentPage - 1);
    });
    document.getElementById('revNextPage').addEventListener('click', function () {
      if (currentPage < totalPages) renderPage(currentPage + 1);
    });

    // Open in Document Builder
    document.getElementById('revOpenBuilder').addEventListener('click', function () {
      var fields = getFields();
      // Switch to builder section
      var builderSection = document.getElementById('adminBuilderSection');
      if (builderSection) {
        var navLinks = document.querySelectorAll('.admin-sidebar__link');
        navLinks.forEach(function (link) {
          if (link.getAttribute('data-section') === 'adminBuilderSection') link.click();
        });
      }
      // Init builder with fields if available
      if (window.AdminBuilder && window.AdminBuilder.init) {
        var preset = r.formType === 'nda' ? 'nda' : 'waiver';
        setTimeout(function () {
          window.AdminBuilder.init({ preset: preset, fields: fields });
        }, 300);
      }
      closeModal();
    });

    // Approve & Send
    document.getElementById('revApproveBtn').addEventListener('click', function () {
      var btn = this;
      var customMessage = document.getElementById('revCustomMessage').value.trim();
      var fields = getFields();

      var body = {};
      if (customMessage) body.adminMessage = customMessage;
      body.documentFields = fields;

      btn.disabled = true;
      btn.textContent = 'Sending…';

      fetch(apiBase + '/requests/' + id + '/approve', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (resp) { return resp.json().then(function (d) { if (!resp.ok) throw d; return d; }); })
        .then(function () {
          closeModal();
          loadRequests();
        })
        .catch(function (err) {
          if (err && err.emailFailed) {
            // Approval committed but the email didn't go out — surface the
            // honest message and refresh so the Resend Email action appears.
            if (window.AdminAuth) window.AdminAuth.showError(err.error);
            closeModal();
            loadRequests();
            return;
          }
          if (window.AdminAuth) window.AdminAuth.showError('Failed to approve.');
          btn.disabled = false;
          btn.textContent = 'Approve & Send';
        });
    });

    // Close handlers
    function closeModal() {
      if (previewTimer) clearTimeout(previewTimer);
      document.removeEventListener('keydown', escHandler);
      currentEscHandler = null;
      if (overlay.parentNode) document.body.removeChild(overlay);
    }

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.classList.contains('modal__close') || ev.target.closest('.rev-modal__cancel')) {
        closeModal();
      }
    });

    function escHandler(ev) {
      if (ev.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', escHandler);
    currentEscHandler = escHandler;
  }

  // ── Reject Modal ─────────────────────────────────────────────────────
  function openRejectModal(id) {
    var r = requestsData.find(function (req) { return req.id === id; });
    if (!r) return;

    if (currentEscHandler) {
      document.removeEventListener('keydown', currentEscHandler);
      currentEscHandler = null;
    }
    var existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var formLabel = r.formType === 'waiver' ? 'Waiver and Release of Liability'
      : r.formType === 'nda' ? 'Mutual Non-Disclosure Agreement'
      : 'Waiver and NDA (Both)';

    var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = '<div class="modal rev-modal rev-modal--reject">' +
      '<div class="modal__header">' +
        '<h2 class="modal__title">Reject Request — ' + AdminUtils.escHtml(r.name) + ' / ' + AdminUtils.escHtml(formLabel) + '</h2>' +
        '<button class="modal__close">&times;</button>' +
      '</div>' +
      '<div class="modal__body">' +
        '<div class="rev-modal__layout">' +
          '<div class="rev-modal__summary">' +
            '<div class="modal__field-label">Request Summary</div>' +
            '<div class="rev-modal__summary-list">' +
              '<div class="rev-modal__summary-row"><span>Name</span><span>' + AdminUtils.escHtml(r.name) + '</span></div>' +
              '<div class="rev-modal__summary-row"><span>Email</span><span>' + AdminUtils.escHtml(r.email) + '</span></div>' +
              '<div class="rev-modal__summary-row"><span>Form</span><span>' + AdminUtils.escHtml(formLabel) + '</span></div>' +
              '<div class="rev-modal__summary-row"><span>Submitted</span><span>' + date + '</span></div>' +
            '</div>' +
            '<div class="rev-modal__info-banner">An email will be sent to the client with your reason below.</div>' +
          '</div>' +
          '<div class="rev-modal__reason">' +
            '<label class="modal__field-label" for="revRejectReason">Rejection Reason <span style="color:var(--error);">*</span></label>' +
            '<textarea class="admin-textarea rev-modal__reason-input" id="revRejectReason" rows="5" placeholder="Explain why this request is being rejected..."></textarea>' +
            '<span class="rev-modal__hint">Required. Sent to the client via email and stored in your admin records.</span>' +
          '</div>' +
        '</div>' +
        '<div class="rev-modal__actions">' +
          '<button class="rev-modal__cancel">Cancel</button>' +
          '<button class="rev-modal__reject-btn" id="revRejectBtn" disabled>Reject Request</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);

    var reasonInput = document.getElementById('revRejectReason');
    var rejectBtn = document.getElementById('revRejectBtn');

    // Enable/disable reject button based on input
    reasonInput.addEventListener('input', function () {
      rejectBtn.disabled = !reasonInput.value.trim();
    });

    // Reject
    rejectBtn.addEventListener('click', function () {
      var reason = reasonInput.value.trim();
      if (!reason) return;

      rejectBtn.disabled = true;
      rejectBtn.textContent = 'Rejecting…';

      fetch(apiBase + '/requests/' + id + '/reject', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      })
        .then(function (resp) { return resp.json().then(function (d) { if (!resp.ok) throw d; return d; }); })
        .then(function () {
          closeModal();
          loadRequests();
        })
        .catch(function () {
          if (window.AdminAuth) window.AdminAuth.showError('Failed to reject.');
          rejectBtn.disabled = false;
          rejectBtn.textContent = 'Reject Request';
        });
    });

    function closeModal() {
      document.removeEventListener('keydown', escHandler);
      currentEscHandler = null;
      if (overlay.parentNode) document.body.removeChild(overlay);
    }

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.classList.contains('modal__close') || ev.target.closest('.rev-modal__cancel')) {
        closeModal();
      }
    });

    function escHandler(ev) {
      if (ev.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', escHandler);
    currentEscHandler = escHandler;
  }

  // ── Detail Modal ────────────────────────────────────────────────────
  function openDetailModal(id) {
    var r = requestsData.find(function (req) { return req.id === id; });
    if (!r) return;

    // Remove any existing modal first and clean up its listener
    if (currentEscHandler) {
      document.removeEventListener('keydown', currentEscHandler);
      currentEscHandler = null;
    }
    var existing = document.querySelector('.modal-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var formLabel = r.formType === 'waiver' ? 'Waiver and Release of Liability'
      : r.formType === 'nda' ? 'Mutual Non-Disclosure Agreement'
      : 'Waiver and NDA (Both)';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
    var approvedDate = r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-';
    var expiresDate = r.tokenExpiresAt ? new Date(r.tokenExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-';

    overlay.innerHTML = '<div class="modal">' +
      '<div class="modal__header">' +
        '<h2 class="modal__title">Request Detail</h2>' +
        '<button class="modal__close">&times;</button>' +
      '</div>' +
      '<div class="modal__body">' +
        '<div class="modal__field"><div class="modal__field-label">Name</div><div class="modal__field-value">' + AdminUtils.escHtml(r.name) + '</div></div>' +
        '<div class="modal__field"><div class="modal__field-label">Email</div><div class="modal__field-value"><a href="mailto:' + AdminUtils.escHtml(r.email) + '">' + AdminUtils.escHtml(r.email) + '</a></div></div>' +
        (r.phone ? '<div class="modal__field"><div class="modal__field-label">Phone</div><div class="modal__field-value">' + AdminUtils.escHtml(r.phone) + '</div></div>' : '') +
        (r.company ? '<div class="modal__field"><div class="modal__field-label">Company</div><div class="modal__field-value">' + AdminUtils.escHtml(r.company) + '</div></div>' : '') +
        '<div class="modal__field"><div class="modal__field-label">Form Requested</div><div class="modal__field-value">' + formLabel + '</div></div>' +
        '<div class="modal__field"><div class="modal__field-label">Matter Description</div><div class="modal__field-value">' + AdminUtils.escHtml(r.matterDescription || '-') + '</div></div>' +
        '<div class="modal__field"><div class="modal__field-label">Status</div><div class="modal__field-value"><span class="status-badge status-badge--' + r.status + '">' + AdminUtils.escHtml(r.status) + '</span></div></div>' +
        '<div class="modal__field"><div class="modal__field-label">Submitted</div><div class="modal__field-value">' + date + '</div></div>' +
        (r.status !== 'pending' ? '<div class="modal__field"><div class="modal__field-label">Processed</div><div class="modal__field-value">' + approvedDate + (r.approvedBy ? ' by ' + AdminUtils.escHtml(r.approvedBy) : '') + '</div></div>' : '') +
        (r.downloadToken ? '<div class="modal__field"><div class="modal__field-label">Download Token Expires</div><div class="modal__field-value">' + expiresDate + '</div></div>' : '') +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);

    function closeModal() {
      document.removeEventListener('keydown', escHandler);
      currentEscHandler = null;
      if (overlay.parentNode) document.body.removeChild(overlay);
    }

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.classList.contains('modal__close')) {
        closeModal();
      }
    });

    function escHandler(ev) {
      if (ev.key === 'Escape') {
        closeModal();
      }
    }
    document.addEventListener('keydown', escHandler);
    currentEscHandler = escHandler;
  }

  function updateTotalNotice(total) {
    var existing = document.getElementById('requestsTotalNotice');
    if (existing) existing.parentNode.removeChild(existing);
    if (!total || total <= requestsData.length) return;
    var notice = document.createElement('p');
    notice.id = 'requestsTotalNotice';
    notice.style.cssText = 'color:var(--text-muted);font-size:0.8125rem;margin:0.5rem 0 0;';
    notice.textContent = 'Showing ' + requestsData.length + ' of ' + total + ' requests (pending shown first).';
    table.parentNode.insertBefore(notice, table.nextSibling);
  }

  function updatePendingBadge() {
    var badge = document.getElementById('requestsBadge');
    if (!badge) return;
    badge.textContent = pendingCount;
    badge.className = pendingCount > 0 ? 'admin-sidebar__badge' : 'admin-sidebar__badge admin-sidebar__badge--zero';
  }

  // Public API
  window.AdminRequests = {
    load: loadRequests,
    getPendingCount: function () { return pendingCount; }
  };
})();
