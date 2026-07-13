(function () {
  'use strict';

  if (!document.getElementById('adminUsersSection')) return;

  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '/api/admin';
  var esc = window.AdminUtils ? window.AdminUtils.escHtml : function (s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  // DOM refs
  var usersList = document.getElementById('adminUsersList');
  var usersLoading = document.getElementById('usersLoading');
  var usersEmpty = document.getElementById('usersEmpty');
  var addUserBtn = document.getElementById('addUserBtn');

  // Modal refs (created inline or referenced)
  var modalOverlay;
  var modalCard;
  var modalTitle;
  var modalBody;
  var modalFooter;
  var modalError;

  // Current editing state
  var currentUserId = null;
  var currentMode = null; // 'add', 'edit', 'delete', 'reset-password'

  function getAuthHeaders() {
    var token = window.AdminAuth ? window.AdminAuth.getToken() : null;
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? 'Bearer ' + token : ''
    };
  }

  function showError(msg) {
    if (modalError) {
      modalError.textContent = msg;
      modalError.classList.add('users-form-error--visible');
    }
  }

  function clearError() {
    if (modalError) {
      modalError.textContent = '';
      modalError.classList.remove('users-form-error--visible');
    }
  }

  // ── Modal helpers ──────────────────────────────────────────────────

  function buildModal() {
    // Create modal overlay if not already in DOM
    if (document.getElementById('usersModalOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'usersModalOverlay';
    overlay.style.display = 'none';
    overlay.innerHTML =
      '<div class="users-modal" id="usersModal" role="dialog" aria-modal="true" aria-label="User management">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title" id="usersModalTitle">Add User</h2>' +
          '<button class="modal__close" id="usersModalClose" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal__body" id="usersModalBody"></div>' +
        '<div class="users-modal-footer" id="usersModalFooter"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    modalOverlay = overlay;
    modalCard = document.getElementById('usersModal');
    modalTitle = document.getElementById('usersModalTitle');

    // Close button
    document.getElementById('usersModalClose').addEventListener('click', closeModal);
    // Click outside to close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  function openModal(mode) {
    buildModal();
    currentMode = mode;
    currentUserId = null;
    clearError();

    if (mode === 'add') {
      modalTitle.textContent = 'Add User';
      renderAddForm();
    } else if (mode === 'delete') {
      modalTitle.textContent = 'Delete User';
      renderDeleteConfirm();
    } else if (mode === 'reset-password') {
      modalTitle.textContent = 'Reset Password';
      renderResetPasswordForm();
    } else if (mode === 'edit') {
      modalTitle.textContent = 'Edit Permissions';
      renderEditForm();
    }

    modalOverlay.style.display = 'flex';
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none';
    }
    currentMode = null;
    currentUserId = null;
  }

  function setModalBody(html) {
    var body = document.getElementById('usersModalBody');
    if (body) body.innerHTML = html;
  }

  function setModalFooter(html) {
    var footer = document.getElementById('usersModalFooter');
    if (footer) footer.innerHTML = html;
  }

  // ── Form rendering ─────────────────────────────────────────────────

  function renderPermissionCheckboxes(permissions) {
    var perms = permissions || {};
    var items = [
      { key: 'analytics', label: 'Analytics' },
      { key: 'requests', label: 'Form Requests' },
      { key: 'builder', label: 'Document Builder' },
      { key: 'email', label: 'Email' },
      { key: 'inbox', label: 'Inbox' },
      { key: 'manage_users', label: 'Manage Users' }
    ];

    var sendItems = [
      { key: 'send_noreply', label: 'noreply@carlingtonburling.com' },
      { key: 'send_maxtheodore', label: 'maxtheodore@carlingtonburling.com' }
    ];

    var html = '<div class="users-permissions">';
    html += '<div class="users-permissions__title">Permissions</div>';
    html += '<div class="users-permissions__grid">';

    items.forEach(function (item) {
      var checked = perms[item.key] ? ' checked' : '';
      html +=
        '<div class="users-permission-item">' +
          '<input type="checkbox" id="perm-' + item.key + '" value="' + item.key + '"' + checked + '>' +
          '<label for="perm-' + item.key + '">' + esc(item.label) + '</label>' +
        '</div>';
    });

    html += '<div class="users-permissions__section-label">Send As</div>';

    sendItems.forEach(function (item) {
      var checked = perms[item.key] ? ' checked' : '';
      html +=
        '<div class="users-permission-item">' +
          '<input type="checkbox" id="perm-' + item.key + '" value="' + item.key + '"' + checked + '>' +
          '<label for="perm-' + item.key + '">' + esc(item.label) + '</label>' +
        '</div>';
    });

    html += '</div></div>';
    return html;
  }

  function getFormPermissions() {
    var perms = {};
    var checkboxes = document.querySelectorAll('#usersModalBody input[type="checkbox"]');
    checkboxes.forEach(function (cb) {
      perms[cb.value] = cb.checked;
    });
    return perms;
  }

  // ── Add User Form ──────────────────────────────────────────────────

  function renderAddForm() {
    var permsHtml = renderPermissionCheckboxes({
      analytics: true,
      requests: true,
      builder: true,
      email: true,
      inbox: true,
      send_noreply: true,
      send_maxtheodore: true
    });

    setModalBody(
      '<div class="users-form-error" id="usersFormError"></div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="addUsername">Username</label>' +
        '<input type="text" id="addUsername" class="users-form-input" placeholder="e.g. jsmith" autocomplete="off">' +
      '</div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="addDisplayName">Display Name</label>' +
        '<input type="text" id="addDisplayName" class="users-form-input" placeholder="e.g. Jane Smith">' +
      '</div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="addPassword">Password</label>' +
        '<input type="password" id="addPassword" class="users-form-input" placeholder="Minimum 6 characters" autocomplete="new-password">' +
      '</div>' +
      permsHtml
    );

    setModalFooter(
      '<button type="button" class="users-btn-cancel" id="usersCancelBtn">Cancel</button>' +
      '<button type="button" class="users-btn-save" id="usersSaveBtn">Create User</button>'
    );

    modalError = document.getElementById('usersFormError');

    document.getElementById('usersCancelBtn').addEventListener('click', closeModal);
    document.getElementById('usersSaveBtn').addEventListener('click', handleCreateUser);
  }

  function handleCreateUser() {
    clearError();
    var username = document.getElementById('addUsername').value.trim();
    var displayName = document.getElementById('addDisplayName').value.trim();
    var password = document.getElementById('addPassword').value;
    var permissions = getFormPermissions();

    if (!username) { showError('Username is required.'); return; }
    if (!displayName) { showError('Display name is required.'); return; }
    if (!password || password.length < 6) { showError('Password must be at least 6 characters.'); return; }

    var saveBtn = document.getElementById('usersSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Creating...';

    fetch(apiBase + '/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: username,
        displayName: displayName,
        password: password,
        permissions: permissions
      })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw data;
          return data;
        });
      })
      .then(function () {
        closeModal();
        loadUsers();
      })
      .catch(function (err) {
        showError(err && err.error ? err.error : 'Failed to create user.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create User';
      });
  }

  // ── Edit Permissions Form ──────────────────────────────────────────

  function openEditModal(user) {
    buildModal();
    currentMode = 'edit';
    currentUserId = user.id;
    clearError();
    modalTitle.textContent = 'Edit Permissions — ' + esc(user.displayName);

    var permsHtml = renderPermissionCheckboxes(user.permissions);

    setModalBody(
      '<div class="users-form-error" id="usersFormError"></div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="editDisplayName">Display Name</label>' +
        '<input type="text" id="editDisplayName" class="users-form-input" value="' + esc(user.displayName || '') + '">' +
      '</div>' +
      permsHtml
    );

    setModalFooter(
      '<button type="button" class="users-btn-cancel" id="usersCancelBtn">Cancel</button>' +
      '<button type="button" class="users-btn-save" id="usersSaveBtn">Save Changes</button>'
    );

    modalError = document.getElementById('usersFormError');

    document.getElementById('usersCancelBtn').addEventListener('click', closeModal);
    document.getElementById('usersSaveBtn').addEventListener('click', handleUpdateUser);

    modalOverlay.style.display = 'flex';
  }

  function handleUpdateUser() {
    clearError();
    var displayName = document.getElementById('editDisplayName').value.trim();
    var permissions = getFormPermissions();

    if (!displayName) { showError('Display name is required.'); return; }

    var saveBtn = document.getElementById('usersSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    fetch(apiBase + '/users/' + currentUserId, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        displayName: displayName,
        permissions: permissions
      })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw data;
          return data;
        });
      })
      .then(function () {
        closeModal();
        loadUsers();
      })
      .catch(function (err) {
        showError(err && err.error ? err.error : 'Failed to update user.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      });
  }

  // ── Reset Password Form ────────────────────────────────────────────

  function openResetPasswordModal(user) {
    buildModal();
    currentMode = 'reset-password';
    currentUserId = user.id;
    clearError();
    modalTitle.textContent = 'Reset Password — ' + esc(user.displayName);

    setModalBody(
      '<div class="users-form-error" id="usersFormError"></div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="resetUsername">Username</label>' +
        '<input type="text" id="resetUsername" class="users-form-input" value="' + esc(user.username) + '" disabled>' +
      '</div>' +
      '<div class="users-form-group">' +
        '<label class="users-form-label" for="resetPassword">New Password</label>' +
        '<input type="password" id="resetPassword" class="users-form-input" placeholder="Minimum 6 characters" autocomplete="new-password">' +
      '</div>'
    );

    setModalFooter(
      '<button type="button" class="users-btn-cancel" id="usersCancelBtn">Cancel</button>' +
      '<button type="button" class="users-btn-save" id="usersSaveBtn">Reset Password</button>'
    );

    modalError = document.getElementById('usersFormError');

    document.getElementById('usersCancelBtn').addEventListener('click', closeModal);
    document.getElementById('usersSaveBtn').addEventListener('click', handleResetPassword);

    modalOverlay.style.display = 'flex';
  }

  function handleResetPassword() {
    clearError();
    var password = document.getElementById('resetPassword').value;

    if (!password || password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    var saveBtn = document.getElementById('usersSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Resetting...';

    fetch(apiBase + '/users/' + currentUserId + '/reset-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password: password })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw data;
          return data;
        });
      })
      .then(function () {
        closeModal();
      })
      .catch(function (err) {
        showError(err && err.error ? err.error : 'Failed to reset password.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Reset Password';
      });
  }

  // ── Delete Confirmation ────────────────────────────────────────────

  function openDeleteModal(user) {
    buildModal();
    currentMode = 'delete';
    currentUserId = user.id;
    clearError();
    modalTitle.textContent = 'Delete User';

    setModalBody(
      '<div class="users-form-error" id="usersFormError"></div>' +
      '<div class="users-delete-warning">' +
        '<strong>Are you sure you want to delete this user?</strong>' +
        'This will permanently remove <em>' + esc(user.displayName) + '</em> (' + esc(user.username) + '). ' +
        'This action cannot be undone.' +
      '</div>'
    );

    setModalFooter(
      '<button type="button" class="users-btn-cancel" id="usersCancelBtn">Cancel</button>' +
      '<button type="button" class="users-btn-delete-confirm" id="usersDeleteBtn">Delete User</button>'
    );

    modalError = document.getElementById('usersFormError');

    document.getElementById('usersCancelBtn').addEventListener('click', closeModal);
    document.getElementById('usersDeleteBtn').addEventListener('click', handleDeleteUser);

    modalOverlay.style.display = 'flex';
  }

  function handleDeleteUser() {
    clearError();
    var deleteBtn = document.getElementById('usersDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    fetch(apiBase + '/users/' + currentUserId, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw data;
          return data;
        });
      })
      .then(function () {
        closeModal();
        loadUsers();
      })
      .catch(function (err) {
        showError(err && err.error ? err.error : 'Failed to delete user.');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete User';
      });
  }

  // ── Load and Render ────────────────────────────────────────────────

  function loadUsers() {
    if (usersLoading) usersLoading.style.display = 'block';
    if (usersEmpty) usersEmpty.classList.add('hidden');
    if (usersList) usersList.innerHTML = '';

    fetch(apiBase + '/users', {
      headers: getAuthHeaders()
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load users');
        return r.json();
      })
      .then(function (data) {
        if (usersLoading) usersLoading.style.display = 'none';
        var userList = data.users || [];
        if (userList.length === 0) {
          if (usersEmpty) usersEmpty.classList.remove('hidden');
          return;
        }
        renderList(userList);
      })
      .catch(function (err) {
        if (usersLoading) usersLoading.style.display = 'none';
        console.error('Load users error:', err);
      });
  }

  function renderList(users) {
    if (!usersList) return;
    usersList.innerHTML = '';

    var currentUser = window.AdminAuth ? window.AdminAuth.getUser() : null;
    var currentUserId = currentUser ? currentUser.id : null;

    users.forEach(function (user) {
      var isSelf = currentUserId === user.id;
      var lastLoginText = 'Never';
      if (user.lastLoginAt) {
        try {
          var d = new Date(user.lastLoginAt);
          lastLoginText = d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) + ' ' + d.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
          });
        } catch (e) {
          lastLoginText = user.lastLoginAt;
        }
      }

      var card = document.createElement('div');
      card.className = 'user-card';

      var badgeHtml = user.isMaster
        ? '<span class="user-badge user-badge--master">Master</span>'
        : '<span class="user-badge user-badge--staff">Staff</span>';

      // Count active permissions for display
      var permCount = 0;
      if (user.permissions) {
        Object.keys(user.permissions).forEach(function (k) {
          if (user.permissions[k]) permCount++;
        });
      }

      card.innerHTML =
        '<div class="user-card__info">' +
          '<h3 class="user-card__name">' + esc(user.displayName) + '</h3>' +
          '<div class="user-card__username">@' + esc(user.username) + '</div>' +
          '<div class="user-card__meta">' +
            badgeHtml +
            '<span>' + permCount + ' permission' + (permCount !== 1 ? 's' : '') + '</span>' +
            '<span class="user-card__last-login">Last login: ' + esc(lastLoginText) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="user-card__actions">' +
          '<button class="user-action-btn" title="Edit permissions" data-action="edit" data-id="' + esc(user.id) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button class="user-action-btn" title="Reset password" data-action="reset-password" data-id="' + esc(user.id) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' +
          '</button>' +
          '<button class="user-action-btn user-action-btn--danger" title="' + (isSelf ? 'Cannot delete yourself' : 'Delete user') + '" data-action="delete" data-id="' + esc(user.id) + '"' + (isSelf ? ' disabled style="opacity:0.35;cursor:not-allowed;"' : '') + '>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
          '</button>' +
        '</div>';

      // Store user data for action handlers
      card.querySelector('[data-action="edit"]').addEventListener('click', function () {
        openEditModal(user);
      });

      card.querySelector('[data-action="reset-password"]').addEventListener('click', function () {
        openResetPasswordModal(user);
      });

      if (!isSelf) {
        card.querySelector('[data-action="delete"]').addEventListener('click', function () {
          openDeleteModal(user);
        });
      }

      usersList.appendChild(card);
    });
  }

  // ── Init ───────────────────────────────────────────────────────────

  function init() {
    buildModal();
    loadUsers();

    if (addUserBtn) {
      addUserBtn.addEventListener('click', function () {
        openModal('add');
      });
    }
  }

  window.AdminUsers = { init: init };
})();
