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
  };

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

    // Lazy-load section content on first visit
    if (targetId === 'adminRequestsSection' && window.AdminRequests) {
      window.AdminRequests.load();
    } else if (targetId === 'adminAnalyticsSection' && window.AdminAnalytics) {
      window.AdminAnalytics.load();
    } else if (targetId === 'adminEmailSection' && window.AdminEmail) {
      window.AdminEmail.init();
    } else if (targetId === 'adminBuilderSection' && window.AdminBuilder) {
      window.AdminBuilder.init();
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

  // Mobile menu toggle
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      var isOpen = sidebar.classList.toggle('admin-sidebar--open');
      if (overlay) overlay.classList.toggle('admin-sidebar-overlay--visible', isOpen);
    });
  }

  // Overlay click closes sidebar
  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('admin-sidebar--open');
      overlay.classList.remove('admin-sidebar-overlay--visible');
    });
  }

  // Init — default to analytics
  function init() {
    switchSection('adminAnalyticsSection');
  }

  window.AdminDashboard = {
    init: init,
    switchSection: switchSection
  };
})();
