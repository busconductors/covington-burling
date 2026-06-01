(function () {
  'use strict';

  var API_BASE = '/api/admin';
  var token = localStorage.getItem('admin_token');

  // Elements
  var loginSection = document.getElementById('adminLogin');
  var dashboard = document.getElementById('adminDashboard');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('login-error');
  var adminTable = document.getElementById('adminTable');
  var adminTableBody = document.getElementById('adminTableBody');
  var adminLoading = document.getElementById('adminLoading');
  var adminEmpty = document.getElementById('adminEmpty');
  var logoutBtn = document.getElementById('adminLogout');

  function showDashboard() {
    loginSection.style.display = 'none';
    dashboard.style.display = '';
    loadRequests();
  }

  function showLogin() {
    loginSection.style.display = '';
    dashboard.style.display = 'none';
  }

  // Already logged in?
  if (token) {
    // Verify token is valid by trying to load
    showDashboard();
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = document.getElementById('adminPassword').value;
      if (!pw) return;

      fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (err) { throw err; });
          return r.json();
        })
        .then(function (data) {
          token = data.token;
          localStorage.setItem('admin_token', token);
          showDashboard();
        })
        .catch(function (err) {
          if (loginError) {
            loginError.textContent = err && err.error ? err.error : 'Unable to connect. The admin service may not be deployed yet.';
            loginError.classList.add('form-error-msg--visible');
          }
        });
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('admin_token');
      token = null;
      showLogin();
    });
  }

  // Load requests
  function loadRequests() {
    if (!adminLoading) return;
    adminLoading.style.display = '';
    adminTable.style.display = 'none';
    adminEmpty.style.display = 'none';

    fetch(API_BASE + '/requests', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(function (r) {
        if (r.status === 401) {
          localStorage.removeItem('admin_token');
          token = null;
          showLogin();
          throw new Error('Unauthorized');
        }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(function (data) {
        adminLoading.style.display = 'none';
        var requests = data.requests || [];
        if (requests.length === 0) {
          adminEmpty.style.display = '';
          return;
        }
        adminTable.style.display = '';
        renderTable(requests);
      })
      .catch(function (err) {
        if (err.message !== 'Unauthorized') {
          adminLoading.textContent = 'Failed to load requests. Please try again.';
        }
      });
  }

  function addTd(tr, label, html) {
    var td = document.createElement('td');
    td.setAttribute('data-label', label);
    td.innerHTML = html;
    tr.appendChild(td);
  }

  function renderTable(requests) {
    adminTableBody.innerHTML = '';
    requests.forEach(function (r) {
      var tr = document.createElement('tr');
      var date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
      var formLabel = r.formType === 'waiver' ? 'Waiver' : r.formType === 'nda' ? 'NDA' : 'Both';
      var statusClass = 'status-badge--' + r.status;

      addTd(tr, 'Date', date);
      addTd(tr, 'Name', '<strong>' + esc(r.name) + '</strong>' + (r.company ? '<br><span class="text-muted" style="font-size:0.8125rem;">' + esc(r.company) + '</span>' : ''));
      addTd(tr, 'Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' + (r.phone ? '<br><span class="text-muted" style="font-size:0.8125rem;">' + esc(r.phone) + '</span>' : ''));
      addTd(tr, 'Form', '<span class="status-badge status-badge--form">' + formLabel + '</span>');
      addTd(tr, 'Status', '<span class="status-badge ' + statusClass + '">' + r.status + '</span>');
      addTd(tr, 'Actions', actionsHtml(r));

      adminTableBody.appendChild(tr);
    });
  }

  function actionsHtml(r) {
    if (r.status !== 'pending') {
      var detail = r.approvedBy ? ' by ' + esc(r.approvedBy) : '';
      var at = r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return '<span class="text-muted" style="font-size:0.8125rem;">' + esc(r.status === 'approved' ? 'Approved' : 'Rejected') + ' ' + at + '</span>';
    }
    return '<div class="admin-actions">' +
      '<button class="btn btn--primary btn--sm admin-approve-btn" data-id="' + esc(r.id) + '" style="width:auto;padding:0.375rem 0.75rem;font-size:0.8125rem;">Approve</button>' +
      '<button class="btn btn--outline-dark btn--sm admin-reject-btn" data-id="' + esc(r.id) + '" style="width:auto;padding:0.375rem 0.75rem;font-size:0.8125rem;">Reject</button>' +
      '</div>';
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Delegate click events for approve/reject
  adminTableBody.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('admin-approve-btn')) {
      if (!confirm('Approve this request? An email will be sent to the client with download links.')) return;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      fetch(API_BASE + '/requests/' + id + '/approve', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () { loadRequests(); })
        .catch(function () { alert('Failed to approve. Please try again.'); btn.disabled = false; btn.textContent = 'Approve'; });
    }

    if (btn.classList.contains('admin-reject-btn')) {
      if (!confirm('Reject this request?')) return;
      btn.disabled = true;
      btn.textContent = 'Rejecting...';
      fetch(API_BASE + '/requests/' + id + '/reject', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); })
        .then(function () { loadRequests(); })
        .catch(function () { alert('Failed to reject. Please try again.'); btn.disabled = false; btn.textContent = 'Reject'; });
    }
  });
})();
