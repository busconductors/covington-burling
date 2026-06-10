(function () {
  'use strict';

  var API_BASE = 'https://covington-api.onrender.com/api/admin';
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
      var pw = document.getElementById('adminPassword').value;
      if (!pw) return;

      var btn = loginForm.querySelector('button[type="submit"]');
      var origText = btn.textContent;
      btn.textContent = 'Signing in...';
      btn.disabled = true;

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
          sessionStorage.setItem('admin_token', token);
          if (loginError) loginError.textContent = '';
          showDashboard();
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
      sessionStorage.removeItem('admin_token');
      delete window._analyticsStarted;
      token = null;
      showLogin();
    }
  });

  window.AdminAuth = {
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    showError: showError,
    apiBase: API_BASE
  };

  // Shared utilities for all admin modules
  window.AdminUtils = {
    escHtml: function (s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    escAttr: function (s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };
})();
