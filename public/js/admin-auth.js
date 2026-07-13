(function () {
  'use strict';

  var API_BASE = '/api/admin';
  var token = sessionStorage.getItem('admin_token');

  // Elements
  var loginSection = document.getElementById('adminLogin');
  var dashboard = document.getElementById('adminDashboard');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('login-error');
  var adminError = document.getElementById('adminError');

  function getToken() { return token; }
  function isLoggedIn() { return !!token; }

  function showDashboard() {
    if (loginSection) loginSection.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    if (window.AdminDashboard) window.AdminDashboard.init();
  }

  function showLogin() {
    if (loginSection) loginSection.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
  }

  function showError(msg) {
    if (adminError) {
      adminError.textContent = msg;
      adminError.style.display = 'block';
      setTimeout(function () { adminError.style.display = 'none'; }, 5000);
    }
  }

  // Verify token on page load
  if (token) {
    fetch(API_BASE + '/requests', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      if (r.ok) { showDashboard(); }
      else { sessionStorage.removeItem('admin_token'); token = null; showLogin(); }
    }).catch(function () {
      showDashboard(); // optimistic — show UI, let requests fail gracefully
    });
  }

  // Login handler
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('adminUsername').value.trim();
      var pw = document.getElementById('adminPassword').value;
      if (!username || !pw) return;

      var btn = loginForm.querySelector('button[type="submit"]');
      var origText = btn.textContent;
      btn.textContent = 'Signing in...';
      btn.disabled = true;

      fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: pw })
      })
        .then(function (r) {
          var status = r.status;
          return r.text().then(function (body) {
            var data;
            try { data = JSON.parse(body); } catch (e) {
              throw { error: status === 401 ? 'Invalid password.' : 'Server error (' + status + '). Use production URL only.' };
            }
            if (!r.ok) throw data;
            return data;
          });
        })
        .then(function (data) {
          token = data.token;
          sessionStorage.setItem('admin_token', token);
          var user = data.user || null;
          if (user) {
            sessionStorage.setItem('admin_user', JSON.stringify(user));
          }
          if (loginError) loginError.textContent = '';
          btn.textContent = origText;
          btn.disabled = false;
          setTimeout(showDashboard, 0);
        })
        .catch(function (err) {
          btn.textContent = origText;
          btn.disabled = false;
          if (loginError) {
            loginError.textContent = err && err.error ? err.error : 'Unable to connect.';
            loginError.classList.add('form-error-msg--visible');
          }
        });
    });
  }

  // Logout handler (delegated — shell wires this up)
  document.addEventListener('click', function (e) {
    if (e.target.closest('#adminLogout')) {
      // revoke the session server-side; local cleanup happens regardless
      if (token) {
        fetch(API_BASE + '/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        }).catch(function () {});
      }
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_user');
      delete window._analyticsStarted;
      token = null;
      showLogin();
    }
  });

  function getUser() {
    try {
      var raw = sessionStorage.getItem('admin_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function hasPermission(key) {
    var user = getUser();
    if (!user) return false;
    if (user.isMaster) return true;
    return !!(user.permissions && user.permissions[key]);
  }

  window.AdminAuth = {
    getToken: getToken,
    getUser: getUser,
    hasPermission: hasPermission,
    isLoggedIn: isLoggedIn,
    showError: showError,
    apiBase: API_BASE
  };

  // Shared utilities live in admin-utils.js (loaded before this file).
})();
