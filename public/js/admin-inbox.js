(function () {
  'use strict';

  if (!document.getElementById('adminInboxSection')) return;

  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '';

  function getToken() {
    return window.AdminAuth ? window.AdminAuth.getToken() : sessionStorage.getItem('admin_token');
  }

  var state = {
    emails: [],
    selectedId: null,
    offset: 0,
    total: 0,
    unreadCount: 0,
    pollTimer: null,
  };

  var els = {
    list: document.getElementById('inboxList'),
    empty: document.getElementById('inboxEmpty'),
    loadMore: document.getElementById('inboxLoadMore'),
    detailEmpty: document.getElementById('inboxDetailEmpty'),
    detailContent: document.getElementById('inboxDetailContent'),
    emailSubject: document.getElementById('inboxEmailSubject'),
    emailFromName: document.getElementById('inboxEmailFromName'),
    emailFromAddr: document.getElementById('inboxEmailFromAddr'),
    emailDate: document.getElementById('inboxEmailDate'),
    emailBody: document.getElementById('inboxEmailBody'),
    attachments: document.getElementById('inboxAttachments'),
    attachmentsList: document.getElementById('inboxAttachmentsList'),
    replyTo: document.getElementById('inboxReplyTo'),
    replyBody: document.getElementById('inboxReplyBody'),
    replySend: document.getElementById('inboxReplySend'),
    replyStatus: document.getElementById('inboxReplyStatus'),
    deleteBtn: document.getElementById('inboxDeleteBtn'),
    refreshBtn: document.getElementById('inboxRefreshBtn'),
    badge: document.getElementById('inboxBadge'),
  };

  function esc(s) {
    return window.AdminUtils ? window.AdminUtils.escHtml(s) : String(s).replace(/</g, '&lt;');
  }

  function formatTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diffMs = now - d;
    var diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function previewText(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    var text = div.textContent || '';
    return text.substring(0, 100);
  }

  function updateBadge(count) {
    if (els.badge) {
      els.badge.textContent = count;
      els.badge.classList.toggle('admin-sidebar__badge--zero', count === 0);
    }
  }

  function renderList() {
    if (state.emails.length === 0) {
      els.empty.classList.remove('hidden');
      els.loadMore.classList.add('hidden');
      return;
    }
    els.empty.classList.add('hidden');

    var html = '';
    state.emails.forEach(function (e) {
      var isUnread = !e.read;
      var isActive = e.id === state.selectedId;
      html += '<div class="inbox-item' + (isUnread ? ' inbox-item--unread' : '') + (isActive ? ' inbox-item--active' : '') + '" data-id="' + esc(e.id) + '">' +
        '<span class="inbox-item__dot"></span>' +
        '<div class="inbox-item__content">' +
          '<div class="inbox-item__from">' + esc(e.fromName || e.fromEmail) + '</div>' +
          '<div class="inbox-item__subject">' + esc(e.subject || '(No subject)') + '</div>' +
          '<div class="inbox-item__preview">' + esc(previewText(e.bodyHtml || e.bodyPlain)) + '</div>' +
          '<div class="inbox-item__time">' + formatTime(e.receivedAt) + '</div>' +
        '</div>' +
      '</div>';
    });

    els.list.innerHTML = html + (els.list.querySelector('.inbox-empty') ? els.list.querySelector('.inbox-empty').outerHTML : '');

    if (els.list.querySelector('.inbox-empty')) {
      els.list.querySelector('.inbox-empty').classList.add('hidden');
    }

    // Click handlers
    els.list.querySelectorAll('.inbox-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        selectEmail(id);
      });
    });

    // Load more
    var hasMore = state.emails.length < state.total;
    els.loadMore.classList.toggle('hidden', !hasMore);
    updateBadge(state.unreadCount);
  }

  function selectEmail(id) {
    state.selectedId = id;
    renderList();

    // Load full detail
    fetch(apiBase + '/inbox/' + id, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.email) return;
        var e = data.email;
        els.detailEmpty.classList.add('hidden');
        els.detailContent.classList.remove('hidden');
        els.emailSubject.textContent = e.subject || '(No subject)';
        els.emailFromName.textContent = e.fromName || e.fromEmail;
        els.emailFromAddr.textContent = e.fromName ? e.fromEmail : '';
        els.emailDate.textContent = new Date(e.receivedAt).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        els.emailBody.innerHTML = e.bodyHtml || ('<p>' + esc(e.bodyPlain) + '</p>');
        els.replyTo.textContent = e.fromEmail;

        // Attachments
        if (e.attachments && e.attachments.length > 0) {
          els.attachments.classList.remove('hidden');
          els.attachmentsList.innerHTML = e.attachments.map(function (a) {
            return '<a href="' + esc(a.url) + '" class="inbox-attachment-item" target="_blank" rel="noopener">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
              '<span>' + esc(a.name || 'attachment') + '</span>' +
              '<span class="inbox-attachment-size">' + esc(formatSize(a.size)) + '</span>' +
            '</a>';
          }).join('');
        } else {
          els.attachments.classList.add('hidden');
        }

        // Mark as read if unread
        if (!e.read) {
          markAsRead(id);
        }
      })
      .catch(function (err) {
        console.error('Failed to load email detail:', err);
      });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function markAsRead(id) {
    fetch(apiBase + '/inbox/' + id + '/read', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function () {
        var email = state.emails.find(function (e) { return e.id === id; });
        if (email) { email.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
        renderList();
      })
      .catch(function () {});
  }

  function load() {
    fetch(apiBase + '/inbox?limit=50&offset=' + state.offset, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.emails = state.offset === 0 ? (data.emails || []) : state.emails.concat(data.emails || []);
        state.total = data.total || 0;
        state.unreadCount = data.unreadCount || 0;
        renderList();
      })
      .catch(function (err) {
        console.error('Failed to load inbox:', err);
      });
  }

  function pollUnread() {
    fetch(apiBase + '/inbox?limit=1', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.unreadCount !== state.unreadCount) {
          state.unreadCount = data.unreadCount || 0;
          updateBadge(state.unreadCount);
        }
      })
      .catch(function () {});
  }

  function startPolling() {
    state.pollTimer = setInterval(pollUnread, 30000);
  }

  function stop() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function sendReply() {
    var body = els.replyBody.value.trim();
    if (!body) return;

    var toEmail = els.replyTo.textContent;
    var subject = 'Re: ' + (els.emailSubject.textContent || 'Inquiry');

    els.replySend.disabled = true;
    els.replyStatus.textContent = 'Sending...';
    els.replyStatus.className = 'inbox-reply-status';

    fetch(apiBase + '/inbox/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
      },
      body: JSON.stringify({
        toEmail: toEmail,
        subject: subject,
        body: body,
        inReplyToId: state.selectedId,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        els.replyStatus.textContent = '✓ ' + data.message;
        els.replyStatus.className = 'inbox-reply-status inbox-reply-status--success';
        els.replyBody.value = '';
      })
      .catch(function (err) {
        els.replyStatus.textContent = '✗ ' + err.message;
        els.replyStatus.className = 'inbox-reply-status inbox-reply-status--error';
      })
      .finally(function () {
        els.replySend.disabled = false;
      });
  }

  function deleteEmail() {
    if (!state.selectedId) return;
    if (!confirm('Delete this email?')) return;

    fetch(apiBase + '/inbox/' + state.selectedId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    })
      .then(function () {
        state.emails = state.emails.filter(function (e) { return e.id !== state.selectedId; });
        state.total = Math.max(0, state.total - 1);
        state.selectedId = null;
        renderList();
        els.detailEmpty.classList.remove('hidden');
        els.detailContent.classList.add('hidden');
      })
      .catch(function (err) {
        console.error('Delete failed:', err);
      });
  }

  function init() {
    state.offset = 0;
    state.emails = [];
    load();
    startPolling();
  }

  // Event listeners
  if (els.loadMore) {
    els.loadMore.addEventListener('click', function () {
      state.offset = state.emails.length;
      load();
    });
  }

  if (els.replySend) {
    els.replySend.addEventListener('click', sendReply);
  }

  if (els.deleteBtn) {
    els.deleteBtn.addEventListener('click', deleteEmail);
  }

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener('click', function () {
      state.offset = 0;
      state.emails = [];
      load();
    });
  }

  // Exports for dashboard tab switcher
  window.AdminInbox = {
    init: init,
    load: load,
    stop: stop,
  };
})();
