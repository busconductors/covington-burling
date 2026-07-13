(function () {
  'use strict';

  if (!document.getElementById('adminDashboard')) return;

  var sections = document.querySelectorAll('.admin-section');
  var sidebarLinks = document.querySelectorAll('.admin-sidebar__link');
  var topbarTitle = document.getElementById('topbarTitle');
  var menuToggle = document.getElementById('adminMenuToggle');
  var sidebar = document.getElementById('adminSidebar');
  var overlay = document.getElementById('adminSidebarOverlay');

  var sectionNames = {
    'adminAnalyticsSection': 'Analytics',
    'adminRequestsSection': 'Form Requests',
    'adminBuilderSection': 'Document Builder',
    'adminEmailSection': 'Email',
    'adminInboxSection': 'Inbox',
    'adminUsersSection': 'Users',
  };

  // Permission-to-section mapping
  var sectionPermissions = {
    'adminAnalyticsSection': 'analytics',
    'adminRequestsSection': 'requests',
    'adminBuilderSection': 'builder',
    'adminEmailSection': 'email',
    'adminInboxSection': 'inbox',
  };

  var currentPermissions = {};

  function switchSection(targetId) {
    sections.forEach(function (s) {
      s.classList.toggle('admin-section--active', s.id === targetId);
    });

    sidebarLinks.forEach(function (link) {
      var href = link.getAttribute('data-section');
      link.classList.toggle('admin-sidebar__link--active', href === targetId);
    });

    if (topbarTitle) {
      topbarTitle.textContent = sectionNames[targetId] || '';
    }

    // Stop analytics polling when switching away
    if (targetId !== 'adminAnalyticsSection' && window.AdminAnalytics) {
      window.AdminAnalytics.stop();
    }

    // Stop inbox polling when switching away
    if (targetId !== 'adminInboxSection' && window.AdminInbox) {
      window.AdminInbox.stop();
    }

    // Lazy-load section content on first visit, passing permissions
    if (targetId === 'adminRequestsSection' && window.AdminRequests) {
      window.AdminRequests.load(currentPermissions);
    } else if (targetId === 'adminAnalyticsSection' && window.AdminAnalytics) {
      window.AdminAnalytics.load(currentPermissions);
    } else if (targetId === 'adminEmailSection' && window.AdminEmail) {
      window.AdminEmail.init(currentPermissions);
    } else if (targetId === 'adminBuilderSection' && window.AdminBuilder) {
      window.AdminBuilder.init(currentPermissions);
    } else if (targetId === 'adminInboxSection' && window.AdminInbox) {
      window.AdminInbox.init(currentPermissions);
    }

    // Close mobile sidebar
    if (sidebar) sidebar.classList.remove('admin-sidebar--open');
    if (overlay) overlay.classList.remove('admin-sidebar-overlay--visible');
  }

  // Sidebar click navigation
  sidebarLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var target = this.getAttribute('data-section');
      if (target) switchSection(target);
    });
  });

  // Menu toggle — mobile slide-over + desktop sidebar collapse
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      if (window.innerWidth <= 768) {
        // Mobile: slide-over with overlay
        var isOpen = sidebar.classList.toggle('admin-sidebar--open');
        if (overlay) overlay.classList.toggle('admin-sidebar-overlay--visible', isOpen);
      } else {
        // Desktop: collapse sidebar
        var shell = document.getElementById('adminDashboard');
        if (shell) shell.classList.toggle('admin-shell--sidebar-collapsed');
      }
    });
  }

  // Overlay click closes sidebar
  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('admin-sidebar--open');
      overlay.classList.remove('admin-sidebar-overlay--visible');
    });
  }

  // Apply permission-based tab visibility
  function applyPermissions(user) {
    currentPermissions = (user && user.permissions) ? user.permissions : {};

    // Store globally for tab modules to access
    window._adminPermissions = currentPermissions;

    sidebarLinks.forEach(function (link) {
      var sectionId = link.getAttribute('data-section');
      var permKey = sectionPermissions[sectionId];
      if (permKey) {
        // Hide tab if user doesn't have the required permission
        var allowed = user && (user.isMaster || currentPermissions[permKey]);
        link.classList.toggle('hidden', !allowed);
      }
    });

    // Show Users tab for master admins
    var usersTab = document.getElementById('usersTabLink');
    if (usersTab) {
      usersTab.classList.toggle('hidden', !(user && user.isMaster));
    }

    // Update topbar with display name
    if (user && user.displayName) {
      var topbarUserSpan = document.querySelector('.admin-topbar__user span');
      if (topbarUserSpan) {
        topbarUserSpan.textContent = user.displayName;
        if (user.isMaster) {
          topbarUserSpan.textContent += ' (Master)';
        }
      }
    }
  }

  // Init — fetch user, then default to first visible section
  function init() {
    var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '/api/admin';
    var authToken = window.AdminAuth ? window.AdminAuth.getToken() : null;

    if (authToken) {
      fetch(apiBase + '/me', {
        headers: { 'Authorization': 'Bearer ' + authToken }
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Failed to fetch user');
          return r.json();
        })
        .then(function (user) {
          applyPermissions(user);

          // Default to first visible section
          var firstVisible = null;
          sidebarLinks.forEach(function (link) {
            if (!firstVisible && !link.classList.contains('hidden')) {
              firstVisible = link.getAttribute('data-section');
            }
          });
          switchSection(firstVisible || 'adminAnalyticsSection');
        })
        .catch(function () {
          // Fallback: show all tabs, default to analytics
          switchSection('adminAnalyticsSection');
        });
    } else {
      switchSection('adminAnalyticsSection');
    }
  }

  window.AdminDashboard = {
    init: init,
    switchSection: switchSection
  };
})();
