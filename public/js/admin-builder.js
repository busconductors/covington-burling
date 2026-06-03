(function () {
  'use strict';

  if (!document.getElementById('adminBuilder')) return;

  var builder = document.getElementById('adminBuilder');
  var apiBase = window.AdminAuth ? window.AdminAuth.apiBase : '';

  function getToken() {
    return window.AdminAuth ? window.AdminAuth.getToken() : sessionStorage.getItem('admin_token');
  }

  // ── Document State ──────────────────────────────────────────────────
  var docState = {
    title: 'NEW DOCUMENT',
    fields: [{ label: 'Date:', name: 'date', width: 200 }],
    intro: '',
    witnessText: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.',
    clauses: [{ num: '1.', title: 'Section Title.', body: 'Enter clause text here.' }],
    signatureBlocks: [
      { label: 'Party A', fields: [
        { label: 'Signature', name: 'partyASig' },
        { label: 'Print Name', name: 'partyAPrintName' },
        { label: 'Date', name: 'partyADate' },
      ]},
      { label: 'For Carlington & Burling LLP', fields: [
        { label: 'Signature', name: 'firmSignature' },
        { label: 'Print Name', name: 'firmPrintName' },
        { label: 'Date', name: 'firmDate' },
      ]},
    ],
  };

  // ── Load Preset ─────────────────────────────────────────────────────
  function loadPreset(name) {
    var preset;
    if (name === 'waiver' || name === 'nda' || name === 'blank') {
      preset = window.CarlingtonPresets[name];
    }
    if (!preset) return;
    docState = JSON.parse(JSON.stringify(preset));
    var dt = document.getElementById('docTitle');
    var it = document.getElementById('introText');
    var wt = document.getElementById('witnessText');
    var on = document.getElementById('outputName');
    if (dt) dt.value = docState.title;
    if (it) it.value = docState.intro || '';
    if (wt) wt.value = docState.witnessText || '';
    if (on) on.value = (name === 'waiver' ? 'waiver-form.pdf' : name === 'nda' ? 'nda-form.pdf' : 'document.pdf');
    renderAll();
    updatePreview();
  }

  document.getElementById('presetSelect').addEventListener('change', function () {
    if (this.value === 'custom') return;
    loadPreset(this.value);
    this.value = 'custom';
  });

  // ── Render ──────────────────────────────────────────────────────────
  function renderAll() {
    renderFields();
    renderClauses();
    renderSigBlocks();
    syncState();
  }

  // Only syncs title, intro, and witnessText from DOM. Fields and clauses are
  // synced directly via event delegation in renderAll/updatePreview — calling
  // syncState() alone will NOT restore fields/clauses state from the preview DOM.
  function syncState() {
    var t = document.getElementById('docTitle');
    var i = document.getElementById('introText');
    var w = document.getElementById('witnessText');
    if (t) docState.title = t.value;
    if (i) docState.intro = i.value;
    if (w) docState.witnessText = w.value;
  }

  function renderFields() {
    var container = document.getElementById('fieldsList');
    if (!container) return;
    container.innerHTML = docState.fields.map(function (f, i) {
      return '<div class="admin-editable-item">' +
        '<input class="admin-input--sm" value="' + AdminUtils.escHtml(f.label) + '" placeholder="Label" data-type="field" data-idx="' + i + '" data-prop="label">' +
        '<input class="admin-input--sm" value="' + AdminUtils.escHtml(f.name) + '" placeholder="name" data-type="field" data-idx="' + i + '" data-prop="name">' +
        '<input class="admin-input--xs" value="' + (f.width || 370) + '" placeholder="width" data-type="field" data-idx="' + i + '" data-prop="width" type="number">' +
        '<button class="admin-btn--del" data-type="field" data-idx="' + i + '" data-action="remove" title="Remove">&times;</button>' +
      '</div>';
    }).join('');
  }

  function renderClauses() {
    var container = document.getElementById('clausesList');
    if (!container) return;
    container.innerHTML = docState.clauses.map(function (c, i) {
      return '<div class="admin-editable-item admin-editable-item--clause">' +
        '<div class="admin-clause-header">' +
          '<input class="admin-input--xs" value="' + AdminUtils.escHtml(c.num) + '" placeholder="#" data-type="clause" data-idx="' + i + '" data-prop="num">' +
          '<input class="admin-input--sm" style="flex:1" value="' + AdminUtils.escHtml(c.title) + '" placeholder="Title" data-type="clause" data-idx="' + i + '" data-prop="title">' +
          '<button class="admin-btn--del" data-type="clause" data-idx="' + i + '" data-action="remove" title="Remove">&times;</button>' +
        '</div>' +
        '<textarea class="admin-textarea--sm" placeholder="Clause body text..." data-type="clause" data-idx="' + i + '" data-prop="body">' + AdminUtils.escHtml(c.body) + '</textarea>' +
      '</div>';
    }).join('');
  }

  function renderSigBlocks() {
    var container = document.getElementById('sigBlocksList');
    if (!container) return;
    container.innerHTML = docState.signatureBlocks.map(function (block, bi) {
      return '<div class="admin-sig-block">' +
        '<div class="admin-section-header">' +
          '<input class="admin-input--sm" value="' + AdminUtils.escHtml(block.label) + '" placeholder="Block label" data-type="sigBlock" data-idx="' + bi + '" data-prop="label">' +
          (bi >= 2 ? '<button class="admin-btn--del" data-type="sigBlock" data-idx="' + bi + '" data-action="remove" title="Remove">&times;</button>' : '') +
        '</div>' +
        block.fields.map(function (f, fi) {
          return '<div class="admin-editable-item" style="padding-left:0.5rem;">' +
            '<input class="admin-input--sm" value="' + AdminUtils.escHtml(f.label) + '" placeholder="Label" data-type="sigField" data-bi="' + bi + '" data-fi="' + fi + '" data-prop="label">' +
            '<input class="admin-input--sm" value="' + AdminUtils.escHtml(f.name) + '" placeholder="name" data-type="sigField" data-bi="' + bi + '" data-fi="' + fi + '" data-prop="name">' +
            '<button class="admin-btn--del" data-type="sigField" data-bi="' + bi + '" data-fi="' + fi + '" data-action="remove" title="Remove">&times;</button>' +
          '</div>';
        }).join('') +
        '<button class="admin-btn--sm" style="margin-top:0.5rem;" data-type="sigField" data-bi="' + bi + '" data-action="add">+ Add Field</button>' +
      '</div>';
    }).join('') +
    (docState.signatureBlocks.length < 2
      ? '<button class="admin-btn--sm" style="margin-top:0.75rem;" id="addSigBlockBtn">+ Add Signature Block</button>'
      : '');
  }

  // ── Event Delegation ────────────────────────────────────────────────
  document.getElementById('fieldsList').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var idx = parseInt(btn.dataset.idx);
    if (btn.dataset.action === 'remove' && confirm('Remove this field?')) {
      docState.fields.splice(idx, 1);
      syncState(); renderAll(); updatePreview();
    }
  });

  document.getElementById('clausesList').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var idx = parseInt(btn.dataset.idx);
    if (btn.dataset.action === 'remove' && confirm('Remove this clause?')) {
      docState.clauses.splice(idx, 1);
      syncState(); renderAll(); updatePreview();
    }
  });

  document.getElementById('sigBlocksList').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'add') {
      var bi = parseInt(btn.dataset.bi);
      docState.signatureBlocks[bi].fields.push({ label: 'New Field', name: 'newField' + Date.now() });
      syncState(); renderAll(); updatePreview();
    } else if (btn.dataset.action === 'remove' && confirm('Remove this?')) {
      if (btn.dataset.type === 'sigField') {
        docState.signatureBlocks[parseInt(btn.dataset.bi)].fields.splice(parseInt(btn.dataset.fi), 1);
      } else if (btn.dataset.type === 'sigBlock') {
        docState.signatureBlocks.splice(parseInt(btn.dataset.idx), 1);
      }
      syncState(); renderAll(); updatePreview();
    }
  });

  // ── Input changes ───────────────────────────────────────────────────
  builder.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset.type) return;
    syncStateFromInput(el);
    updatePreview();
  });

  function syncStateFromInput(el) {
    var t = el.dataset.type;
    var val = el.type === 'number' ? parseInt(el.value) || 200 : el.value;
    if (t === 'field') {
      docState.fields[parseInt(el.dataset.idx)][el.dataset.prop] = val;
    } else if (t === 'clause') {
      docState.clauses[parseInt(el.dataset.idx)][el.dataset.prop] = val;
    } else if (t === 'sigBlock') {
      docState.signatureBlocks[parseInt(el.dataset.idx)][el.dataset.prop] = val;
    } else if (t === 'sigField') {
      docState.signatureBlocks[parseInt(el.dataset.bi)].fields[parseInt(el.dataset.fi)][el.dataset.prop] = val;
    }
  }

  // ── Add Buttons ─────────────────────────────────────────────────────
  document.getElementById('addFieldBtn').addEventListener('click', function () {
    docState.fields.push({ label: 'New Field:', name: 'newField' + Date.now(), width: 370 });
    renderAll(); updatePreview();
  });

  document.getElementById('addClauseBtn').addEventListener('click', function () {
    var next = docState.clauses.length + 1;
    docState.clauses.push({ num: next + '.', title: 'New Section.', body: 'Enter clause body text.' });
    renderAll(); updatePreview();
  });

  document.getElementById('sigBlocksList').addEventListener('click', function (e) {
    if (e.target.id === 'addSigBlockBtn') {
      docState.signatureBlocks.push({ label: 'New Party', fields: [{ label: 'Signature', name: 'sig' + Date.now() }] });
      renderAll(); updatePreview();
    }
  });

  // ── Preview Summary ─────────────────────────────────────────────────
  function updatePreview() {
    syncState();
    var st = document.getElementById('sumTitle');
    var sf = document.getElementById('sumFields');
    var sc = document.getElementById('sumClauses');
    var ss = document.getElementById('sumSigs');
    if (st) st.textContent = docState.title;
    if (sf) sf.textContent = docState.fields.length;
    if (sc) sc.textContent = docState.clauses.length;
    if (ss) ss.textContent = docState.signatureBlocks.length;
    scheduleAutoSave();
    schedulePreviewRefresh();
  }

  // ── Live PDF Preview ────────────────────────────────────────────────
  var previewTimer = null;
  var previewBlobUrl = null;
  var previewPdfDoc = null;
  var previewPageCount = 0;
  var previewCurrentPage = 1;
  var previewZoom = 1.0;
  var previewBaseScale = 1.0;

  var ZOOM_FACTORS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  var zoomStepIdx = 2;

  function ensurePdfJs() {
    return typeof pdfjsLib !== 'undefined';
  }

  function schedulePreviewRefresh() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 600);
  }

  function refreshPreview() {
    syncState();
    if (!ensurePdfJs()) return;

    var containerW = document.getElementById('previewBody').clientWidth - 48;
    if (containerW < 100) return;

    var placeholder = document.getElementById('previewPlaceholder');
    var badge = document.getElementById('previewBadge');

    try {
      window.CarlingtonTemplate.generate({
        title: docState.title,
        fields: docState.fields,
        intro: docState.intro || undefined,
        witnessText: docState.witnessText,
        clauses: docState.clauses,
        signatureBlocks: docState.signatureBlocks,
      }).then(function (pdfBytes) {
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));

        var loadingTask = pdfjsLib.getDocument({ url: previewBlobUrl, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true });
        return loadingTask.promise;
      }).then(function (doc) {
        previewPdfDoc = doc;
        previewPageCount = doc.numPages;
        previewCurrentPage = 1;

        return doc.getPage(1).then(function (firstPage) {
          var pageW = firstPage.getViewport({ scale: 1 }).width;
          var containerW = document.getElementById('previewBody').clientWidth - 48;
          previewBaseScale = containerW / pageW;

          document.getElementById('sumPages').textContent = previewPageCount;
          badge.textContent = 'Live — ' + previewPageCount + ' pages';
          placeholder.style.display = 'none';

          return renderAllPages().then(function () {
            updatePreviewControls();
          });
        });
      }).catch(function (err) {
        badge.textContent = 'Preview unavailable';
      });
    } catch (err) {
    }
  }

  function renderAllPages() {
    if (!previewPdfDoc) return Promise.resolve();
    var container = document.getElementById('previewPages');
    container.innerHTML = '';

    var scale = previewBaseScale * previewZoom;
    var promises = [];

    for (var i = 1; i <= previewPdfDoc.numPages; i++) {
      (function (pageNum) {
        var pageWrapper = document.createElement('div');
        pageWrapper.className = 'admin-preview__page-wrapper';
        pageWrapper.dataset.page = pageNum;

        var canvas = document.createElement('canvas');
        canvas.className = 'admin-preview__page-canvas';
        pageWrapper.appendChild(canvas);

        var pageLabel = document.createElement('div');
        pageLabel.className = 'admin-preview__page-label';
        pageLabel.textContent = 'Page ' + pageNum;
        pageWrapper.appendChild(pageLabel);

        container.appendChild(pageWrapper);

        promises.push(
          previewPdfDoc.getPage(pageNum).then(function (page) {
            var viewport = page.getViewport({ scale: scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
          })
        );
      })(i);
    }

    return Promise.all(promises);
  }

  function updatePreviewControls() {
    document.getElementById('pageInfo').textContent = previewPageCount
      ? previewCurrentPage + ' / ' + previewPageCount
      : '—';

    var displayZoom = Math.round(previewBaseScale * previewZoom * 100);
    document.getElementById('zoomLabel').textContent = displayZoom + '%';

    document.getElementById('zoomOutBtn').disabled = zoomStepIdx <= 0;
    document.getElementById('zoomInBtn').disabled = zoomStepIdx >= ZOOM_FACTORS.length - 1;
    document.getElementById('prevPageBtn').disabled = previewCurrentPage <= 1;
    document.getElementById('nextPageBtn').disabled = previewCurrentPage >= previewPageCount;
  }

  function scrollToPage(num) {
    var pageEl = document.querySelector('.admin-preview__page-wrapper[data-page="' + num + '"]');
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Zoom / Page controls ────────────────────────────────────────────
  document.getElementById('zoomInBtn').addEventListener('click', function () {
    if (zoomStepIdx < ZOOM_FACTORS.length - 1) {
      zoomStepIdx++;
      previewZoom = ZOOM_FACTORS[zoomStepIdx];
      if (previewPdfDoc) renderAllPages();
      updatePreviewControls();
    }
  });

  document.getElementById('zoomOutBtn').addEventListener('click', function () {
    if (zoomStepIdx > 0) {
      zoomStepIdx--;
      previewZoom = ZOOM_FACTORS[zoomStepIdx];
      if (previewPdfDoc) renderAllPages();
      updatePreviewControls();
    }
  });

  document.getElementById('prevPageBtn').addEventListener('click', function () {
    if (previewCurrentPage > 1) {
      previewCurrentPage--;
      scrollToPage(previewCurrentPage);
      updatePreviewControls();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', function () {
    if (previewCurrentPage < previewPageCount) {
      previewCurrentPage++;
      scrollToPage(previewCurrentPage);
      updatePreviewControls();
    }
  });

  document.getElementById('previewBody').addEventListener('scroll', function () {
    if (!previewPdfDoc) return;
    var pages = this.querySelectorAll('.admin-preview__page-wrapper');
    var bodyRect = this.getBoundingClientRect();
    var closestPage = 1;
    var closestDist = Infinity;

    pages.forEach(function (wrapper) {
      var rect = wrapper.getBoundingClientRect();
      var dist = Math.abs(rect.top - bodyRect.top - 20);
      if (dist < closestDist) { closestDist = dist; closestPage = parseInt(wrapper.dataset.page); }
    });

    if (closestPage !== previewCurrentPage) {
      previewCurrentPage = closestPage;
      updatePreviewControls();
    }
  });

  var resizeDebounce = null;
  window.addEventListener('resize', function () {
    if (!previewPdfDoc) return;
    if (resizeDebounce) clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(function () {
      previewPdfDoc.getPage(1).then(function (firstPage) {
        var pageW = firstPage.getViewport({ scale: 1 }).width;
        var containerW = document.getElementById('previewBody').clientWidth - 48;
        previewBaseScale = containerW / pageW;
        renderAllPages();
        updatePreviewControls();
      });
    }, 300);
  });

  // ── Generate PDF ────────────────────────────────────────────────────
  document.getElementById('generateBtn').addEventListener('click', function () {
    syncState();
    var status = document.getElementById('generationStatus');
    status.textContent = 'Generating...';
    status.className = 'admin-status admin-status--loading';

    try {
      window.CarlingtonTemplate.generate({
        title: docState.title,
        fields: docState.fields,
        intro: docState.intro || undefined,
        witnessText: docState.witnessText,
        clauses: docState.clauses,
        signatureBlocks: docState.signatureBlocks,
      }).then(function (pdfBytes) {
        var filename = document.getElementById('outputName').value || 'document.pdf';
        window.CarlingtonTemplate.download(pdfBytes, filename);
        status.textContent = 'PDF downloaded successfully.';
        status.className = 'admin-status admin-status--success';
      }).catch(function (err) {
        status.textContent = 'Error: ' + err.message;
        status.className = 'admin-status admin-status--error';
      });
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className = 'admin-status admin-status--error';
    }
  });

  // ── Export as Preset ────────────────────────────────────────────────
  document.getElementById('exportJsonBtn').addEventListener('click', function () {
    syncState();
    var preset = {
      title: docState.title,
      fields: docState.fields,
      intro: docState.intro || '',
      witnessText: docState.witnessText,
      clauses: docState.clauses,
      signatureBlocks: docState.signatureBlocks,
    };
    var blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (document.getElementById('outputName').value || 'document').replace('.pdf', '.preset.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Generate & Send ─────────────────────────────────────────────────
  var sendModalOverlay = document.getElementById('sendModalOverlay');
  var sendStatus = document.getElementById('sendStatus');

  function openSendModal() {
    syncState();
    loadSendRecipients();
    sendModalOverlay.style.display = 'flex';
    document.getElementById('sendAttachName').textContent = document.getElementById('outputName').value || 'document.pdf';
    document.getElementById('sendSubject').value = docState.title + ' — Carlington & Burling LLP';
    hideSendStatus();
  }

  function closeSendModal() {
    sendModalOverlay.style.display = 'none';
  }

  function showSendStatus(msg, type) {
    if (!sendStatus) return;
    sendStatus.textContent = msg;
    sendStatus.className = 'send-modal__status send-modal__status--' + type;
    sendStatus.style.display = 'block';
  }

  function hideSendStatus() {
    if (sendStatus) {
      sendStatus.className = 'send-modal__status';
      sendStatus.style.display = 'none';
    }
  }

  function loadSendRecipients() {
    var select = document.getElementById('sendRecipient');
    if (!select) return;
    select.innerHTML = '<option value="">Select a recipient...</option>';
    fetch(apiBase + '/requests', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        var requests = data.requests || [];
        var approved = requests.filter(function (r) { return r.status === 'approved'; });
        approved.forEach(function (r) {
          var opt = document.createElement('option');
          opt.value = r.email;
          opt.setAttribute('data-name', r.name);
          opt.textContent = r.name + ' (' + r.email + ')';
          select.appendChild(opt);
        });
      }).catch(function () {});
  }

  var sendRecipient = document.getElementById('sendRecipient');
  if (sendRecipient) {
    sendRecipient.addEventListener('change', function () {
      var opt = this.options[this.selectedIndex];
      var name = opt.getAttribute('data-name') || '';
      document.getElementById('sendToName').value = name;
    });
  }

  document.getElementById('generateSendBtn').addEventListener('click', openSendModal);
  document.getElementById('sendModalClose').addEventListener('click', closeSendModal);
  document.getElementById('sendModalCancel').addEventListener('click', closeSendModal);
  sendModalOverlay.addEventListener('click', function (e) {
    if (e.target === sendModalOverlay) closeSendModal();
  });

  document.getElementById('sendModalSubmit').addEventListener('click', function () {
    var toEmail = document.getElementById('sendToEmail').value.trim();
    var toName = document.getElementById('sendToName').value.trim();
    var subject = document.getElementById('sendSubject').value.trim();
    var message = document.getElementById('sendMessage').value.trim();
    var filename = document.getElementById('outputName').value || 'document.pdf';

    if (!toEmail || !subject) {
      showSendStatus('Please fill in the recipient email and subject.', 'error');
      return;
    }

    showSendStatus('Generating PDF...', 'loading');

    try {
      window.CarlingtonTemplate.generate({
        title: docState.title,
        fields: docState.fields,
        intro: docState.intro || undefined,
        witnessText: docState.witnessText,
        clauses: docState.clauses,
        signatureBlocks: docState.signatureBlocks,
      }).then(function (pdfBytes) {
        var binary = '';
        var bytesArr = new Uint8Array(pdfBytes);
        for (var i = 0; i < bytesArr.length; i++) {
          binary += String.fromCharCode(bytesArr[i]);
        }
        var pdfBase64 = btoa(binary);

        showSendStatus('Sending email...', 'loading');

        return fetch(apiBase + '/send-email-attachment', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + getToken(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toEmail: toEmail,
            toName: toName,
            subject: subject,
            body: message,
            attachment: { name: filename, content: pdfBase64 },
          }),
        }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw d; return d; }); });
      }).then(function () {
        showSendStatus('Email sent to ' + toEmail + ' with PDF attached.', 'success');
        setTimeout(closeSendModal, 2000);
      }).catch(function (err) {
        showSendStatus('Failed: ' + (err.error || err.message || 'Unknown error'), 'error');
      });
    } catch (err) {
      showSendStatus('Error: ' + err.message, 'error');
    }
  });

  // ── Auto-Save ───────────────────────────────────────────────────────
  var DRAFT_KEY = 'covington-admin-draft';
  var DRAFT_TS_KEY = 'covington-admin-draft-ts';
  var autoSaveTimer = null;

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveDraft, 800);
  }

  function saveDraft() {
    syncState();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(docState));
      localStorage.setItem(DRAFT_TS_KEY, Date.now().toString());
    } catch (e) { /* quota exceeded */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var ts = parseInt(localStorage.getItem(DRAFT_TS_KEY) || '0');
      return { data: JSON.parse(raw), ts: ts };
    } catch (e) { return null; }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_TS_KEY);
  }

  function restoreDraft(draft) {
    docState = draft.data;
    document.getElementById('docTitle').value = docState.title || '';
    document.getElementById('introText').value = docState.intro || '';
    document.getElementById('witnessText').value = docState.witnessText || '';
    document.getElementById('outputName').value = 'document.pdf';
    document.getElementById('presetSelect').value = 'custom';
    renderAll();
    updatePreview();
  }

  // ── Clause Library ──────────────────────────────────────────────────
  var boilerplateClauses = [
    { cat: 'General', num: '', title: 'Governing Law.', body: 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia.' },
    { cat: 'General', num: '', title: 'Entire Agreement.', body: 'This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.' },
    { cat: 'General', num: '', title: 'Severability.', body: 'If any provision of this Agreement is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it enforceable, or if modification is not possible, severed from this Agreement. The remaining provisions shall continue in full force and effect.' },
    { cat: 'General', num: '', title: 'Amendments.', body: 'No amendment, modification, or supplement to this Agreement shall be effective unless in writing and signed by an authorized representative of each party. No course of dealing, course of performance, or failure to enforce any provision shall constitute a waiver or amendment.' },
    { cat: 'General', num: '', title: 'Notices.', body: 'All notices, requests, demands, and other communications required or permitted under this Agreement shall be in writing and shall be deemed delivered: (a) upon personal delivery, (b) three business days after deposit with a nationally recognized overnight courier, or (c) upon confirmation of receipt when sent by email to the addresses set forth above.' },
    { cat: 'General', num: '', title: 'Assignment.', body: 'Neither party may assign or transfer this Agreement, or any of its rights or obligations hereunder, without the prior written consent of the other party. Any attempted assignment in violation of this provision shall be null and void. This Agreement shall be binding upon and inure to the benefit of the parties and their permitted successors and assigns.' },
    { cat: 'General', num: '', title: 'Waiver.', body: 'No waiver of any provision of this Agreement shall be effective unless in writing and signed by the waiving party. The failure of either party to enforce any right or provision of this Agreement shall not constitute a waiver of such right or provision or of any other right or provision. A waiver of any breach shall not constitute a waiver of any subsequent breach.' },
    { cat: 'General', num: '', title: 'Counterparts.', body: 'This Agreement may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument. Electronic signatures and scanned copies shall have the same force and effect as original signatures.' },
    { cat: 'General', num: '', title: 'Force Majeure.', body: 'Neither party shall be liable for any failure or delay in performance under this Agreement to the extent such failure or delay is caused by circumstances beyond its reasonable control, including acts of God, war, terrorism, civil disturbance, fire, flood, earthquake, epidemic, governmental action, or failure of utilities or communication systems.' },
    { cat: 'Litigation', num: '', title: 'Arbitration.', body: 'Any dispute, controversy, or claim arising out of or relating to this Agreement, or the breach, termination, or validity thereof, shall be finally resolved by binding arbitration administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules. The arbitration shall be conducted in Washington, District of Columbia, before a single arbitrator. Judgment on the award may be entered in any court having jurisdiction.' },
    { cat: 'Litigation', num: '', title: 'Jury Trial Waiver.', body: 'Each party hereby knowingly, voluntarily, and irrevocably waives any right to trial by jury in any action, proceeding, or counterclaim arising out of or relating to this Agreement. This waiver is a material inducement for the parties to enter into this Agreement.' },
    { cat: 'Litigation', num: '', title: 'Venue and Jurisdiction.', body: 'The parties agree that any legal action or proceeding arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia. Each party irrevocably submits to the personal jurisdiction of such courts and waives any objection based on improper venue or forum non conveniens.' },
    { cat: 'Corporate', num: '', title: 'Representations and Warranties.', body: 'Each party represents and warrants that: (a) it is duly organized and validly existing under the laws of its jurisdiction of formation; (b) it has the full power and authority to enter into and perform its obligations under this Agreement; (c) the execution and delivery of this Agreement has been duly authorized; and (d) this Agreement constitutes a legal, valid, and binding obligation enforceable against it in accordance with its terms.' },
    { cat: 'Corporate', num: '', title: 'Indemnification.', body: 'Each party (the "Indemnifying Party") agrees to indemnify, defend, and hold harmless the other party and its affiliates, officers, directors, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with: (a) the Indemnifying Party\'s breach of any representation, warranty, or covenant set forth in this Agreement; or (b) the Indemnifying Party\'s gross negligence or willful misconduct.' },
    { cat: 'Corporate', num: '', title: 'Limitation of Liability.', body: 'Except for liability arising from a party\'s gross negligence, willful misconduct, fraud, or breach of confidentiality obligations, neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages, including lost profits or loss of business, arising out of or relating to this Agreement, regardless of the theory of liability and even if advised of the possibility of such damages.' },
    { cat: 'Intellectual Property', num: '', title: 'IP Ownership.', body: 'All right, title, and interest in and to any intellectual property created, developed, or reduced to practice in the course of performing services under this Agreement shall be and remain the sole and exclusive property of the Client. The Firm hereby assigns to the Client all of its right, title, and interest in and to such intellectual property and agrees to execute all documents and take all actions reasonably necessary to perfect the Client\'s ownership rights.' },
    { cat: 'Intellectual Property', num: '', title: 'Confidentiality.', body: 'Each party agrees to maintain the confidentiality of all non-public information disclosed by the other party in connection with this Agreement, using at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care. The receiving party shall not disclose such confidential information to any third party without the prior written consent of the disclosing party, except as required by law.' },
    { cat: 'White Collar', num: '', title: 'Cooperation Obligations.', body: 'The Client agrees to cooperate fully with the Firm in connection with the representation, including by: (a) providing complete and accurate information; (b) making employees and documents available as reasonably requested; (c) responding promptly to Firm communications; and (d) preserving all potentially relevant documents and data. The Client acknowledges that failure to cooperate may compromise the Firm\'s ability to provide effective representation.' },
    { cat: 'White Collar', num: '', title: 'Document Preservation.', body: 'The Client acknowledges that it has been advised of its obligation to preserve all documents, communications, and electronically stored information that may be relevant to this matter. The Client agrees to immediately implement a comprehensive litigation hold and to suspend any routine document destruction policies. The Firm will provide guidance on the scope and implementation of the preservation hold.' },
    { cat: 'Health Care', num: '', title: 'HIPAA Compliance.', body: 'The parties acknowledge that certain information exchanged in connection with this Agreement may constitute Protected Health Information ("PHI") under the Health Insurance Portability and Accountability Act of 1996 ("HIPAA"). To the extent the Firm is a Business Associate of the Client, the parties shall enter into a separate Business Associate Agreement and the Firm shall implement appropriate administrative, physical, and technical safeguards to protect such PHI.' },
    { cat: 'Health Care', num: '', title: 'FDA Regulatory Compliance.', body: 'All activities conducted under this Agreement shall comply with applicable requirements of the U.S. Food and Drug Administration, including current Good Manufacturing Practice regulations, adverse event reporting requirements, and labeling and promotional standards. Each party represents that it maintains adequate compliance programs and has not been subject to any FDA enforcement action that would materially affect its ability to perform hereunder.' },
    { cat: 'Privacy', num: '', title: 'Data Protection and Security.', body: 'Each party shall implement and maintain appropriate technical and organizational measures to protect personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage. Such measures shall be commensurate with the sensitivity of the data and the risks to data subjects. Each party shall promptly notify the other of any actual or suspected data breach affecting the other party\'s data.' },
    { cat: 'Privacy', num: '', title: 'Breach Notification.', body: 'In the event of a security breach involving personal data subject to this Agreement, the affected party shall notify the other party without undue delay and in any event within 48 hours of discovery. The notification shall describe the nature of the breach, the categories and approximate number of data subjects affected, the likely consequences, and the measures taken or proposed to address the breach and mitigate its effects.' },
  ];

  var clauseLib = {
    visible: false,
    searchTerm: '',

    renderCategories: function () {
      var container = document.getElementById('clauseLibCategories');
      var search = this.searchTerm.toLowerCase();
      var grouped = {};

      boilerplateClauses.forEach(function (clause) {
        if (search) {
          var haystack = (clause.cat + ' ' + clause.title + ' ' + clause.body).toLowerCase();
          if (haystack.indexOf(search) === -1) return;
        }
        if (!grouped[clause.cat]) grouped[clause.cat] = [];
        grouped[clause.cat].push(clause);
      });

      var html = '';
      Object.keys(grouped).forEach(function (cat) {
        html += '<div class="clause-lib-cat">';
        html += '<div class="clause-lib-cat__title">' + AdminUtils.escHtml(cat) + '</div>';
        grouped[cat].forEach(function (clause) {
          html += '<button class="clause-lib-item" data-title="' + AdminUtils.escAttr(clause.title) + '" data-body="' + AdminUtils.escAttr(clause.body) + '" title="Click to insert"><span class="clause-lib-item__title">' + AdminUtils.escHtml(clause.title) + '</span><span class="clause-lib-item__preview">' + AdminUtils.escHtml(clause.body.substring(0, 80)) + '&hellip;</span></button>';
        });
        html += '</div>';
      });

      container.innerHTML = html || '<p style="font-size:0.8125rem;color:var(--text-muted);padding:0.5rem;">No clauses match your search.</p>';

      container.querySelectorAll('.clause-lib-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var next = docState.clauses.length + 1;
          docState.clauses.push({ num: next + '.', title: this.dataset.title, body: this.dataset.body });
          renderAll();
          updatePreview();
          document.getElementById('clausesList').scrollIntoView({ behavior: 'smooth' });
        });
      });
    },
  };

  document.getElementById('toggleClauseLib').addEventListener('click', function () {
    clauseLib.visible = !clauseLib.visible;
    var lib = document.getElementById('clauseLibrary');
    lib.style.display = clauseLib.visible ? 'block' : 'none';
    this.textContent = clauseLib.visible ? 'Hide' : 'Show';
    if (clauseLib.visible) clauseLib.renderCategories();
  });

  document.getElementById('clauseLibSearch').addEventListener('input', function () {
    clauseLib.searchTerm = this.value;
    clauseLib.renderCategories();
  });

  // ── Init ────────────────────────────────────────────────────────────
  function initBuilder() {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    loadPreset('blank');
    document.getElementById('presetSelect').value = 'blank';

    var saved = loadDraft();
    if (saved) {
      var age = Math.round((Date.now() - saved.ts) / 60000);
      var ageStr = age < 1 ? 'just now' : age < 60 ? age + ' min ago' : Math.round(age / 60) + ' hours ago';
      if (confirm('You have an unsaved draft from ' + ageStr + '. Restore it?')) {
        restoreDraft(saved);
      } else {
        clearDraft();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBuilder);
  } else {
    initBuilder();
  }

  // Expose for dashboard shell and tests
  window.AdminBuilder = {
    init: function () {
      updatePreview();
    },
    generatePdfBytes: function () {
      syncState();
      return window.CarlingtonTemplate.generate({
        title: docState.title,
        fields: docState.fields,
        intro: docState.intro || undefined,
        witnessText: docState.witnessText,
        clauses: docState.clauses,
        signatureBlocks: docState.signatureBlocks,
      });
    },
  };
})();
