(function () {
  'use strict';

  if (!document.getElementById('adminAnalyticsSection')) return;

  var refreshInterval = null;

  // Read dynamically so we pick up the token even if auth module hasn't finished init
  function apiBase() {
    return (window.AdminAuth && window.AdminAuth.apiBase) || '';
  }

  function getToken() {
    return (window.AdminAuth && window.AdminAuth.getToken()) || sessionStorage.getItem('admin_token') || '';
  }

  function loadAnalytics() {
    var base = apiBase();
    if (!base) { showLoadError('Analytics', 'API not configured'); return; }

    fetch(base + '/analytics', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) {
        if (r.status === 401) { location.reload(); return; }
        if (!r.ok) return r.json().then(function (e) { throw e; });
        return r.json();
      })
      .then(function (data) {
        renderStatCards(data);
        renderPipelineChart(data);
        renderTrendChart(data);
        updateLastUpdated();
      })
      .catch(function (err) {
        showLoadError('Analytics', (err && err.error) || 'Failed to load');
      });
  }

  function loadActivity() {
    var base = apiBase();
    if (!base) return;

    fetch(base + '/activity', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) {
        if (r.status === 401) { location.reload(); return; }
        if (!r.ok) return r.json().then(function (e) { throw e; });
        return r.json();
      })
      .then(function (data) {
        if (data) renderActivityFeed(data.activity || []);
      })
      .catch(function () {
        var list = document.getElementById('activityFeedList');
        if (list) list.innerHTML = '<div class="activity-item"><div class="activity-item__body"><span style="color:var(--text-muted);">Activity feed unavailable.</span></div></div>';
      });
  }

  function showLoadError(section, msg) {
    var el = document.getElementById('analyticsUpdated');
    if (el) { el.textContent = section + ' error: ' + msg; el.style.color = 'var(--error)'; }
    // Also show in stat cards
    ['statTotal','statPending','statApproved','statRejected'].forEach(function (id) {
      var card = document.getElementById(id);
      if (card && card.textContent === '—') card.textContent = 'Err';
    });
  }

  // ── Stat Cards ──────────────────────────────────────────────────────
  function renderStatCards(data) {
    var p = data.pipeline || {};
    setStatValue('statTotal', p.total || 0);
    setStatValue('statPending', p.pending || 0, 'pending');
    setStatValue('statApproved', p.approved || 0, 'approved');
    setStatValue('statRejected', p.rejected || 0, 'rejected');

    var rateEl = document.getElementById('statApprovalRate');
    if (rateEl) rateEl.textContent = (data.approvalRate || 0) + '%';

    var avgEl = document.getElementById('statAvgTime');
    if (avgEl) avgEl.textContent = data.avgApprovalHours !== null ? data.avgApprovalHours + ' hrs' : 'N/A';
  }

  function setStatValue(id, value, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    if (type) el.className = 'stat-card__value stat-card__value--' + type;
    else el.className = 'stat-card__value';
  }

  // ── Pipeline Funnel ─────────────────────────────────────────────────
  function renderPipelineChart(data) {
    var p = data.pipeline || {};
    var total = p.total || 1;
    var items = [
      { label: 'Total', value: p.total || 0, cls: 'total' },
      { label: 'Pending', value: p.pending || 0, cls: 'pending' },
      { label: 'Approved', value: p.approved || 0, cls: 'approved' },
      { label: 'Rejected', value: p.rejected || 0, cls: 'rejected' },
    ];

    var container = document.getElementById('pipelineChart');
    if (!container) return;

    container.innerHTML = items.map(function (item) {
      var pct = Math.max(Math.round((item.value / total) * 100), item.value > 0 ? 2 : 0);
      return '<div class="pipeline-bar">' +
        '<span class="pipeline-bar__label">' + item.label + '</span>' +
        '<div class="pipeline-bar__track">' +
          '<div class="pipeline-bar__fill pipeline-bar__fill--' + item.cls + '" style="width:' + pct + '%">' + item.value + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var ft = data.byFormType || {};
    var ftEl = document.getElementById('formTypeBreakdown');
    if (ftEl) {
      ftEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.8125rem;">Waiver: <strong>' + (ft.waiver || 0) + '</strong></span>' +
        ' &middot; <span style="color:var(--text-muted);font-size:0.8125rem;">NDA: <strong>' + (ft.nda || 0) + '</strong></span>' +
        ' &middot; <span style="color:var(--text-muted);font-size:0.8125rem;">Both: <strong>' + (ft.both || 0) + '</strong></span>';
    }
  }

  // ── Monthly Trend Bars ──────────────────────────────────────────────
  function renderTrendChart(data) {
    var trend = data.monthlyTrend || [];
    var container = document.getElementById('trendChart');
    if (!container) return;

    if (trend.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;text-align:center;padding:2rem;">No submission data yet.</p>';
      return;
    }

    var maxVal = Math.max.apply(null, trend.map(function (m) { return m.count; })) || 1;

    container.innerHTML = trend.map(function (m) {
      var heightPct = Math.max(Math.round((m.count / maxVal) * 100), 4);
      var monthLabel = formatMonth(m.month);
      return '<div class="trend-bar">' +
        '<span class="trend-bar__value">' + m.count + '</span>' +
        '<div class="trend-bar__fill" style="height:' + heightPct + '%"></div>' +
        '<span class="trend-bar__month">' + monthLabel + '</span>' +
      '</div>';
    }).join('');
  }

  function formatMonth(ym) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var parts = ym.split('-');
    var idx = parseInt(parts[1], 10) - 1;
    return months[idx] || parts[1];
  }

  // ── Activity Feed ───────────────────────────────────────────────────
  function renderActivityFeed(entries) {
    var list = document.getElementById('activityFeedList');
    if (!list) return;

    if (entries.length === 0) {
      list.innerHTML = '<div class="activity-item"><div class="activity-item__body"><span style="color:var(--text-muted);">No activity recorded yet.</span></div></div>';
      return;
    }

    list.innerHTML = entries.map(function (e) {
      var dotClass = e.action === 'approve' ? 'approve'
        : e.action === 'reject' ? 'reject'
        : e.action === 'send-email' ? 'email'
        : 'submitted';
      var actionLabel = e.action === 'form-submitted' ? 'Form submitted'
        : e.action === 'approve' ? 'Request approved'
        : e.action === 'reject' ? 'Request rejected'
        : e.action === 'send-email' ? 'Email sent'
        : e.action;
      var detail = e.details ? (e.details.name || e.details.toEmail || '') : '';
      var time = e.timestamp ? formatRelativeTime(e.timestamp) : '';

      return '<div class="activity-item">' +
        '<div class="activity-item__dot activity-item__dot--' + dotClass + '"></div>' +
        '<div class="activity-item__body">' +
          '<span class="activity-item__action">' + AdminUtils.escHtml(actionLabel) + '</span>' +
          (detail ? '<div class="activity-item__detail">' + AdminUtils.escHtml(detail) + '</div>' : '') +
        '</div>' +
        '<span class="activity-item__time">' + time + '</span>' +
      '</div>';
    }).join('');
  }

  function formatRelativeTime(ts) {
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  function updateLastUpdated() {
    var el = document.getElementById('analyticsUpdated');
    if (!el) return;
    var now = new Date();
    el.textContent = 'Last updated: ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    el.style.color = 'var(--text-muted)';
  }

  // ── Auto-refresh ────────────────────────────────────────────────────
  function startAutoRefresh() {
    loadAnalytics();
    loadActivity();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function () {
      loadAnalytics();
      loadActivity();
    }, 60000);
  }

  function stopAutoRefresh() {
    if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  }

  var refreshBtn = document.getElementById('analyticsRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      loadAnalytics();
      loadActivity();
    });
  }

  window.AdminAnalytics = {
    load: startAutoRefresh,
    stop: stopAutoRefresh,
    refresh: function () { loadAnalytics(); loadActivity(); }
  };
})();
