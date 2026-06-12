(function (global) {
  'use strict';
  var PDFDocument = global.PDFLib.PDFDocument;
  var rgb = global.PDFLib.rgb;

  // ── Constants ──────────────────────────────────────────────────────────
  var PAGE_W = 612;
  var PAGE_H = 792;
  var MARGIN = 72;
  var HEADER_HEIGHT = 150;
  var HEADER_START_Y = PAGE_H - MARGIN;
  var MIN_Y_BEFORE_BREAK = 120;

  // Brand palette
  var NAVY       = rgb(0.039, 0.086, 0.157);   // #0A1628
  var GOLD       = rgb(0.690, 0.553, 0.341);   // #B08D57
  var LIGHT_GOLD = rgb(0.788, 0.651, 0.420);   // #C9A66B
  var INK        = rgb(0.102, 0.102, 0.102);   // #1A1A1A
  var RULE       = rgb(0.851, 0.835, 0.800);   // #D9D5CC
  var WHITE      = rgb(1, 1, 1);
  var DARK_RULE  = rgb(0.267, 0.267, 0.267);
  var MUTED      = rgb(0.541, 0.541, 0.557);   // #8A8A9E
  var SLATE      = rgb(0.353, 0.353, 0.431);   // #5A5A6E
  var SUBTLE     = rgb(0.604, 0.620, 0.698);   // #9AA3B2
  var HEADER_TEXT = rgb(0.627, 0.635, 0.706);  // #A0A0B4

  var CONTACT_LINE = '1450 Meridian Hill Lane NW, Washington, DC 20009  ·  202-555-0142  ·  carlingtonburling.com';
  var TAGLINE = 'LLP  ·  ATTORNEYS AT LAW  ·  SINCE 1927';

  var FONT_PATHS = [
    { key: 'serif',     url: '/fonts/cormorant-garamond-latin-400-normal.ttf' },
    { key: 'serifBold', url: '/fonts/cormorant-garamond-latin-600-normal.ttf' },
    { key: 'sans',      url: '/fonts/montserrat-latin-400-normal.ttf' },
    { key: 'sansMed',   url: '/fonts/montserrat-latin-500-normal.ttf' },
  ];

  // ── Font Cache ────────────────────────────────────────────────────────
  var _fontBufs = null;
  var _fontPromise = null;

  function loadFontBufs() {
    if (_fontBufs) return Promise.resolve(_fontBufs);
    if (_fontPromise) return _fontPromise;
    _fontPromise = Promise.all(FONT_PATHS.map(function (p) {
      return fetch(p.url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer().then(function (buf) {
          return { key: p.key, buf: buf };
        });
      });
    })).then(function (results) {
      _fontBufs = {};
      for (var i = 0; i < results.length; i++) _fontBufs[results[i].key] = results[i].buf;
      return _fontBufs;
    }).catch(function (e) { _fontPromise = null; throw e; });
    return _fontPromise;
  }

  // ── Utility Functions ──────────────────────────────────────────────────

  function drawWrapped(page, text, x, y, font, size, color, maxWidth) {
    var words = text.split(' ');
    var line = '';
    var currentY = y;
    var lineHeight = size * 1.7;

    for (var i = 0; i < words.length; i++) {
      var testLine = line.length === 0 ? words[i] : line + ' ' + words[i];
      var testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxWidth && line.length > 0) {
        page.drawText(line, { x: x, y: currentY, font: font, size: size, color: color });
        line = words[i];
        currentY -= lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) {
      page.drawText(line, { x: x, y: currentY, font: font, size: size, color: color });
      currentY -= lineHeight;
    }
    return currentY;
  }

  function lineCount(text, font, size, maxWidth) {
    var words = text.split(' ');
    var line = '';
    var count = 0;
    for (var i = 0; i < words.length; i++) {
      var testLine = line.length === 0 ? words[i] : line + ' ' + words[i];
      if (font.widthOfTextAtSize(testLine, size) > maxWidth && line.length > 0) {
        count++;
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) count++;
    return count;
  }

  function estimateClauseHeight(body, font, size, maxWidth) {
    return 18 + lineCount(body, font, size, maxWidth) * (size * 1.7) + 18;
  }

  function addUnderlineField(form, page, name, x, y, width, font) {
    var field = form.createTextField(name);
    field.addToPage(page, {
      x: x, y: y - 3, width: width, height: 14,
      borderWidth: 0, borderColor: WHITE, backgroundColor: WHITE,
    });
    page.drawLine({
      start: { x: x, y: y + 2 }, end: { x: x + width, y: y + 2 },
      thickness: 0.5, color: DARK_RULE,
    });
    if (font) field.defaultUpdateAppearances(font);
    return field;
  }

  // ── Header (Variant E — centered, text-only, no navy band) ─────────────

  function drawHeader(page, fonts, y) {
    var centerX = PAGE_W / 2;

    // Firm name: "Carlington & Burling" (centered, gold ampersand)
    var wmSize = 26;
    var cText = 'Carlington ';
    var ampText = '&';
    var bText = ' Burling';
    var fullW = fonts.serifBold.widthOfTextAtSize(cText + ampText + bText, wmSize);

    var textY = y - 40;
    var x = centerX - fullW / 2;

    page.drawText(cText, { x: x, y: textY, size: wmSize, font: fonts.serifBold, color: NAVY });
    var x2 = x + fonts.serifBold.widthOfTextAtSize(cText, wmSize);
    page.drawText(ampText, { x: x2, y: textY, size: wmSize, font: fonts.serifBold, color: GOLD });
    var x3 = x2 + fonts.serifBold.widthOfTextAtSize(ampText, wmSize);
    page.drawText(bText, { x: x3, y: textY, size: wmSize, font: fonts.serifBold, color: NAVY });

    // Gold rule (full page width, 1px)
    var ruleY = textY - 28;
    page.drawLine({ start: { x: 0, y: ruleY }, end: { x: PAGE_W, y: ruleY }, thickness: 1, color: GOLD });

    // Tagline: LLP · ATTORNEYS AT LAW · SINCE 1927
    var tagSize = 9;
    var tagW = fonts.sans.widthOfTextAtSize(TAGLINE, tagSize);
    var tagY = ruleY - 18;
    page.drawText(TAGLINE, { x: centerX - tagW / 2, y: tagY, size: tagSize, font: fonts.sans, color: SLATE });

    // Contact line (single line, centered)
    var contactSize = 8;
    var contactW = fonts.sans.widthOfTextAtSize(CONTACT_LINE, contactSize);
    var contactY = tagY - 20;
    // Draw muted portion, then gold domain
    var contactPre = '1450 Meridian Hill Lane NW, Washington, DC 20009  ·  202-555-0142  ·  ';
    var contactDomain = 'carlingtonburling.com';
    var preW = fonts.sans.widthOfTextAtSize(contactPre, contactSize);
    page.drawText(contactPre, { x: centerX - contactW / 2, y: contactY, size: contactSize, font: fonts.sans, color: SLATE });
    page.drawText(contactDomain, { x: centerX - contactW / 2 + preW, y: contactY, size: contactSize, font: fonts.sansMed, color: GOLD });

    // Header-body separator (thin light rule)
    var sepY = contactY - 24;
    page.drawLine({ start: { x: 0, y: sepY }, end: { x: PAGE_W, y: sepY }, thickness: 1, color: RULE });

    return sepY - 24;
  }

  // ── Body Rendering ────────────────────────────────────────────────────

  function drawTitle(page, fonts, title, y) {
    var tw = fonts.serifBold.widthOfTextAtSize(title, 15);
    page.drawText(title, { x: (PAGE_W - tw) / 2, y: y, size: 15, font: fonts.serifBold, color: NAVY });
    y -= 22;
    // Gold rule underline
    var ruleW = 280;
    page.drawLine({
      start: { x: (PAGE_W - ruleW) / 2, y: y + 2 }, end: { x: (PAGE_W + ruleW) / 2, y: y + 2 },
      thickness: 0.5, color: GOLD,
    });
    return y - 24;
  }

  function drawFields(page, fonts, form, fields, y, fillable) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      page.drawText(f.label, { x: MARGIN, y: y, size: 9, font: fonts.sansMed, color: NAVY });
      var labelW = fonts.sansMed.widthOfTextAtSize(f.label, 9);
      var fieldX = MARGIN + labelW + 12;
      var fieldW = f.width || 370;
      if (fillable && form) {
        addUnderlineField(form, page, f.name, fieldX, y - 14, fieldW, fonts.sans);
      } else {
        // Visual underline only (print mode)
        page.drawLine({ start: { x: fieldX, y: y - 17 }, end: { x: fieldX + fieldW, y: y - 17 }, thickness: 0.5, color: DARK_RULE });
      }
      y -= 30;
    }
    return y;
  }

  function drawIntro(page, fonts, text, y) {
    return drawWrapped(page, text, MARGIN, y, fonts.serif, 11.5, INK, PAGE_W - MARGIN * 2) - 20;
  }

  function drawClauses(page, fonts, clauses, y) {
    var remaining = [];
    var indent = 28;
    var maxWidth = PAGE_W - MARGIN * 2 - indent;
    for (var i = 0; i < clauses.length; i++) {
      var clause = clauses[i];
      var needed = estimateClauseHeight(clause.body, fonts.serif, 11, maxWidth);
      if (y - needed < MIN_Y_BEFORE_BREAK) {
        for (var j = i; j < clauses.length; j++) remaining.push(clauses[j]);
        break;
      }
      // Clause header: "1. Title."
      page.drawText(clause.num + '. ' + clause.title + '.', { x: MARGIN, y: y, size: 11, font: fonts.serifBold, color: INK });
      y -= 20;
      // Clause body: indented
      y = drawWrapped(page, clause.body, MARGIN + indent, y, fonts.serif, 11, INK, maxWidth);
      y -= 18; // gap between clauses
    }
    return { y: y, remaining: remaining };
  }

  function drawWitness(page, fonts, text, y) {
    page.drawText(text, { x: MARGIN, y: y, size: 10.5, font: fonts.serifBold, color: NAVY });
    return y - 32;
  }

  function drawSignatureBlocks(form, page, fonts, blocks, y, fillable) {
    if (blocks.length >= 2) {
      var origY = y;
      y = drawOneSigBlock(form, page, fonts, blocks[0], MARGIN, y, fillable);
      drawOneSigBlock(form, page, fonts, blocks[1], MARGIN + 310, origY, fillable);
      return y;
    }
    if (blocks.length === 1) return drawOneSigBlock(form, page, fonts, blocks[0], MARGIN, y, fillable);
    return y;
  }

  function drawOneSigBlock(form, page, fonts, block, x, y, fillable) {
    var labelSize = 10.5;
    page.drawText(block.label, { x: x, y: y, size: labelSize, font: fonts.serifBold, color: NAVY });
    var sy = y - 24;
    for (var i = 0; i < block.fields.length; i++) {
      var f = block.fields[i];
      if (f.label === 'Signature' || f.label === 'Authorized Signature') {
        // Draw signature line
        page.drawLine({ start: { x: x, y: sy }, end: { x: x + 220, y: sy }, thickness: 0.5, color: DARK_RULE });
        if (fillable && form) {
          addUnderlineField(form, page, f.name, x, sy - 14, 220, fonts.sans);
        }
        page.drawText(f.label, { x: x, y: sy - 14, size: 8, font: fonts.sans, color: MUTED });
      } else {
        if (fillable && form) {
          addUnderlineField(form, page, f.name, x, sy, 220, fonts.sans);
        } else {
          // Visual underline only (print mode)
          page.drawLine({ start: { x: x, y: sy - 1 }, end: { x: x + 220, y: sy - 1 }, thickness: 0.5, color: DARK_RULE });
        }
        page.drawText(f.label, { x: x, y: sy - 12, size: 8, font: fonts.sans, color: MUTED });
      }
      sy -= 38;
    }
    return sy;
  }

  // ── Footer ────────────────────────────────────────────────────────────

  function drawFooter(page, fonts, docTitle, currentPage, totalPages) {
    page.drawLine({
      start: { x: MARGIN, y: 44 }, end: { x: PAGE_W - MARGIN, y: 44 },
      thickness: 0.75, color: RULE,
    });

    page.drawText(docTitle, { x: MARGIN, y: 30, size: 7.5, font: fonts.sans, color: MUTED });

    var centerText = 'Confidential · Attorney-Client Privileged';
    var cw = fonts.sans.widthOfTextAtSize(centerText, 7.5);
    page.drawText(centerText, { x: (PAGE_W - cw) / 2, y: 30, size: 7.5, font: fonts.sans, color: MUTED });

    var rightText = 'Page ' + currentPage + ' of ' + totalPages;
    var rw = fonts.sans.widthOfTextAtSize(rightText, 7.5);
    page.drawText(rightText, { x: PAGE_W - MARGIN - rw, y: 30, size: 7.5, font: fonts.sans, color: MUTED });
  }

  // ── Orchestrator ──────────────────────────────────────────────────────

  function normalizeDef(def) {
    return {
      title:           def.title || '',
      fields:          def.fields || [],
      intro:           def.intro || '',
      clauses:         def.clauses || [],
      witnessText:     def.witnessText || 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.',
      signatureBlocks: def.signatureBlocks || [],
    };
  }

  async function buildPDF(def, opts) {
    if (!global.PDFLib) throw new Error('pdf-lib not loaded.');
    if (!global.fontkit) throw new Error('fontkit not loaded. Include @pdf-lib/fontkit script before this one.');

    opts = opts || {};
    var fillable = opts.fillable !== false; // default true

    var d = normalizeDef(def);
    var doc = await PDFDocument.create();
    doc.registerFontkit(global.fontkit);

    var fontBufs = await loadFontBufs();

    var fonts = {
      serif:     await doc.embedFont(fontBufs.serif),
      serifBold: await doc.embedFont(fontBufs.serifBold),
      sans:      await doc.embedFont(fontBufs.sans),
      sansMed:   await doc.embedFont(fontBufs.sansMed),
    };

    var form = fillable ? doc.getForm() : null;
    var page = doc.addPage([PAGE_W, PAGE_H]);
    var y = HEADER_START_Y;

    // First-page header
    y = drawHeader(page, fonts, y);
    y -= 24;

    // Title
    if (d.title) {
      y = drawTitle(page, fonts, d.title, y);
    }

    // Form fields
    if (d.fields.length > 0) {
      y = drawFields(page, fonts, form, d.fields, y, fillable);
      y -= 4;
    }

    // Intro
    if (d.intro) y = drawIntro(page, fonts, d.intro, y);

    // Clauses
    var pending = d.clauses.slice();
    while (pending.length > 0) {
      var result = drawClauses(page, fonts, pending, y);
      y = result.y;
      pending = result.remaining;
      if (pending.length > 0) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = drawHeader(page, fonts, HEADER_START_Y);
      }
    }

    // Signature blocks
    if (d.signatureBlocks.length > 0) {
      var maxFields = 0;
      for (var si = 0; si < d.signatureBlocks.length; si++) {
        if (d.signatureBlocks[si].fields.length > maxFields) maxFields = d.signatureBlocks[si].fields.length;
      }
      if (y - (60 + maxFields * 38) < MIN_Y_BEFORE_BREAK) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = drawHeader(page, fonts, HEADER_START_Y);
      }
      y -= 10;
      y = drawWitness(page, fonts, d.witnessText, y);
      y = drawSignatureBlocks(form, page, fonts, d.signatureBlocks, y, fillable);
    }

    // Footer on every page
    var pages = doc.getPages();
    for (var pi = 0; pi < pages.length; pi++) {
      drawFooter(pages[pi], fonts, d.title, pi + 1, pages.length);
    }

    return await doc.save();
  }

  // ── Public API ────────────────────────────────────────────────────────

  function downloadPDF(pdfBytes, filename) {
    var blob = new Blob([pdfBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Export ────────────────────────────────────────────────────────────

  global.CarlingtonTemplate = {
    generate: buildPDF,
    download: downloadPDF,
  };
})(typeof window !== 'undefined' ? window : this);
