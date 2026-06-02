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
      return '<span style="color:var(--text-muted);font-size:0.8125rem;">' + AdminUtils.escHtml(r.status === 'approved' ? 'Approved' : 'Rejected') + ' ' + at + '</span>';
    }
    return '<button class="btn--sm btn--approve" data-id="' + AdminUtils.escAttr(r.id) + '" data-action="approve">Approve</button>' +
      '<button class="btn--sm btn--reject" data-id="' + AdminUtils.escAttr(r.id) + '" data-action="reject">Reject</button>';
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
      if (!confirm('Approve this request? An email will be sent to the client with download links.')) return;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      fetch(apiBase + '/requests/' + id + '/approve', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () { loadRequests(); })
        .catch(function () { if (window.AdminAuth) window.AdminAuth.showError('Failed to approve.'); btn.disabled = false; btn.textContent = 'Approve'; });
    }

    if (btn.dataset.action === 'reject') {
      if (!confirm('Reject this request?')) return;
      btn.disabled = true;
      btn.textContent = 'Rejecting…';
      fetch(apiBase + '/requests/' + id + '/reject', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () { loadRequests(); })
        .catch(function () { if (window.AdminAuth) window.AdminAuth.showError('Failed to reject.'); btn.disabled = false; btn.textContent = 'Reject'; });
    }
  });

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
