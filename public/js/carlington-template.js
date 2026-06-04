(function (global) {
  'use strict';
  var PDFDocument = global.PDFLib.PDFDocument;
  var rgb = global.PDFLib.rgb;

  // ── Constants ──────────────────────────────────────────────────────────
  var PAGE_W = 612;
  var PAGE_H = 792;
  var MARGIN = 50;
  var HEADER_START_Y = PAGE_H - 62;
  var MIN_Y_BEFORE_BREAK = 120;

  // Brand palette (from Carlington & Burling Brand Style Guide)
  var NAVY        = rgb(0.039, 0.086, 0.157);   // #0A1628
  var SLATE       = rgb(0.078, 0.137, 0.251);   // #142340 Midnight Slate
  var GOLD        = rgb(0.690, 0.553, 0.341);   // #B08D57 Heritage Gold
  var LIGHT_GOLD  = rgb(0.788, 0.651, 0.420);   // #C9A66B
  var IVORY       = rgb(0.980, 0.976, 0.965);   // #FAF9F6
  var INK         = rgb(0.102, 0.102, 0.102);   // #1A1A1A
  var RULE        = rgb(0.851, 0.835, 0.800);   // #D9D5CC light rule
  var WHITE       = rgb(1, 1, 1);
  var DARK_RULE   = rgb(0.267, 0.267, 0.267);
  var MUTED       = rgb(0.400, 0.400, 0.420);

  var CONTACT_LINE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  carlingtonburling.com';
  var TAGLINE_YEAR = '1919';

  var LOGO_PATHS = [
    { key: 'stacked',  url: '/images/brand/logo_stacked.png?v=2' },
    { key: 'reversed', url: '/images/brand/logo_reversed.png' },
    { key: 'primary',  url: '/images/brand/logo_primary.png' },
    { key: 'monogram', url: '/images/brand/logo_monogram.png' },
  ];

  var FONT_PATHS = [
    { key: 'serif',     url: '/fonts/cormorant-garamond-latin-400-normal.woff' },
    { key: 'serifBold', url: '/fonts/cormorant-garamond-latin-600-normal.woff' },
    { key: 'sans',      url: '/fonts/montserrat-latin-400-normal.woff' },
    { key: 'sansMed',   url: '/fonts/montserrat-latin-500-normal.woff' },
  ];

  // ── Font & Logo Caches ─────────────────────────────────────────────────
  var _fontBufs = null;
  var _fontPromise = null;

  function loadFontBufs() {
    if (_fontBufs) return Promise.resolve(_fontBufs);
    if (_fontPromise) return _fontPromise;
    _fontPromise = Promise.all(FONT_PATHS.map(function (p) {
      return fetch(p.url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer().then(function (buf) { return { key: p.key, buf: buf }; });
      });
    })).then(function (results) {
      _fontBufs = {};
      for (var i = 0; i < results.length; i++) _fontBufs[results[i].key] = results[i].buf;
      return _fontBufs;
    }).catch(function (e) { _fontPromise = null; throw e; });
    return _fontPromise;
  }

  var _pngBufs = null;
  var _pngPromise = null;
  function loadPngBufs() {
    if (_pngBufs) return Promise.resolve(_pngBufs);
    if (_pngPromise) return _pngPromise;
    _pngPromise = Promise.all(LOGO_PATHS.map(function (p) {
      return fetch(p.url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer().then(function (buf) { return { key: p.key, buf: buf }; });
      }).catch(function () { return null; });
    })).then(function (results) {
      _pngBufs = {};
      for (var i = 0; i < results.length; i++) {
        if (results[i]) _pngBufs[results[i].key] = results[i].buf;
      }
      return _pngBufs;
    }).catch(function (e) { _pngPromise = null; throw e; });
    return _pngPromise;
  }
  function loadLogos(doc) {
    return loadPngBufs().then(function (pngs) {
      var keys = Object.keys(pngs);
      var jobs = keys.map(function (k) {
        return doc.embedPng(pngs[k]).then(function (img) { return { key: k, img: img }; }).catch(function () { return null; });
      });
      return Promise.all(jobs).then(function (results) {
        var logos = {};
        for (var i = 0; i < results.length; i++) {
          if (results[i]) logos[results[i].key] = results[i].img;
        }
        return logos;
      });
    });
  }

  // ── Utility Functions ──────────────────────────────────────────────────

  function drawWrapped(page, text, x, y, font, size, color, maxWidth) {
    var words = text.split(' ');
    var line = '';
    var currentY = y;
    var lineHeight = size * 1.55;

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

  function estimateClauseHeight(clause, font, size, maxWidth) {
    return 18 + lineCount(clause.body, font, size, maxWidth) * (size * 1.55) + 12;
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

  // ── Header Variants ──────────────────────────────────────────────────

  function drawHeaderA(page, fonts, logos, y, isFirstPage) {
    var logo = logos.stacked;
    var logoH = isFirstPage ? 110 : 72;
    if (logo) {
      var logoW = logo.width * (logoH / logo.height);
      page.drawImage(logo, { x: (PAGE_W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
      y -= logoH + 6;
    }
    if (isFirstPage) {
      var tw = fonts.sans.widthOfTextAtSize(CONTACT_LINE, 7.5);
      page.drawText(CONTACT_LINE, { x: (PAGE_W - tw) / 2, y: y, size: 7.5, font: fonts.sans, color: MUTED });
      y -= 14;
    } else {
      y -= 6;
    }
    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 0.75, color: RULE,
    });
    return y - 8;
  }

  function drawHeaderB(page, fonts, logos, y, isFirstPage) {
    var logo = logos.reversed || logos.primary;
    var bandH = isFirstPage ? 62 : 44;
    page.drawRectangle({ x: 0, y: y - bandH, width: PAGE_W, height: bandH, color: NAVY });

    if (logo) {
      var logoH = isFirstPage ? 28 : 20;
      var logoW = logo.width * (logoH / logo.height);
      page.drawImage(logo, { x: MARGIN, y: y - bandH + (bandH - logoH) / 2, width: logoW, height: logoH });
    }

    if (isFirstPage) {
      var domainText = 'carlingtonburling.com';
      var dw = fonts.sans.widthOfTextAtSize(domainText, 8.5);
      page.drawText(domainText, { x: PAGE_W - MARGIN - dw, y: y - 16, size: 8.5, font: fonts.sans, color: LIGHT_GOLD });
      var cw = fonts.sans.widthOfTextAtSize(CONTACT_LINE, 6.5);
      page.drawText(CONTACT_LINE, { x: PAGE_W - MARGIN - cw, y: y - 30, size: 6.5, font: fonts.sans, color: WHITE });
    }

    y -= bandH;
    page.drawRectangle({ x: 0, y: y - 3, width: PAGE_W, height: 3, color: GOLD });
    return y - 8;
  }

  function drawHeaderC(page, fonts, logos, y, isFirstPage) {
    var logo = logos.primary;
    var logoH = isFirstPage ? 40 : 26;
    if (logo) {
      var logoW = logo.width * (logoH / logo.height);
      page.drawImage(logo, { x: MARGIN, y: y - logoH, width: logoW, height: logoH });
    }

    if (isFirstPage) {
      var domainText = 'carlingtonburling.com';
      var dw = fonts.sans.widthOfTextAtSize(domainText, 8.5);
      page.drawText(domainText, { x: PAGE_W - MARGIN - dw, y: y - 18, size: 8.5, font: fonts.sans, color: GOLD });
      var cw = fonts.sans.widthOfTextAtSize(CONTACT_LINE, 6.5);
      page.drawText(CONTACT_LINE, { x: PAGE_W - MARGIN - cw, y: y - 32, size: 6.5, font: fonts.sans, color: MUTED });
    }

    y -= logoH + 6;
    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 0.75, color: RULE,
    });
    return y - 8;
  }

  function drawHeaderD(page, fonts, logos, y, isFirstPage) {
    var mono = logos.monogram;
    var monoH = isFirstPage ? 56 : 36;

    if (mono) {
      var monoW = mono.width * (monoH / mono.height);
      page.drawImage(mono, { x: (PAGE_W - monoW) / 2, y: y - monoH, width: monoW, height: monoH });
      y -= monoH + 8;
    }

    var wordmark = 'Carlington & Burling';
    var wmSize = isFirstPage ? 18 : 13;
    var wmW = fonts.serifBold.widthOfTextAtSize(wordmark, wmSize);
    var ampersandW = fonts.serifBold.widthOfTextAtSize(' & ', wmSize);
    var preW = fonts.serifBold.widthOfTextAtSize('Carlington', wmSize);
    var postW = fonts.serifBold.widthOfTextAtSize('Burling', wmSize);
    var startX = (PAGE_W - wmW) / 2;

    page.drawText('Carlington', { x: startX, y: y, size: wmSize, font: fonts.serifBold, color: NAVY });
    page.drawText('&', {
      x: startX + preW + fonts.serifBold.widthOfTextAtSize(' ', wmSize),
      y: y, size: wmSize, font: fonts.serifBold, color: GOLD,
    });
    page.drawText('Burling', {
      x: startX + preW + ampersandW + fonts.serifBold.widthOfTextAtSize(' ', wmSize),
      y: y, size: wmSize, font: fonts.serifBold, color: NAVY,
    });

    var llpText = 'LLP';
    var llpW = fonts.sans.widthOfTextAtSize(llpText, 10);
    page.drawText(llpText, { x: (PAGE_W - llpW) / 2, y: y - wmSize * 1.2, size: 10, font: fonts.sans, color: NAVY });

    y -= wmSize * 1.8 + 10;

    if (isFirstPage) {
      var tagline = 'ATTORNEYS AT LAW · SINCE ' + TAGLINE_YEAR;
      var tlSize = 7.5;
      var tlW = fonts.sans.widthOfTextAtSize(tagline, tlSize);
      var ruleW = 32;
      var totalW = ruleW + 8 + tlW + 8 + ruleW;
      var sx = (PAGE_W - totalW) / 2;

      page.drawLine({ start: { x: sx, y: y - 3 }, end: { x: sx + ruleW, y: y - 3 }, thickness: 0.5, color: GOLD });
      page.drawText(tagline, { x: sx + ruleW + 8, y: y - 5, size: tlSize, font: fonts.sans, color: GOLD });
      page.drawLine({ start: { x: sx + ruleW + 8 + tlW + 8, y: y - 3 }, end: { x: totalW + sx, y: y - 3 }, thickness: 0.5, color: GOLD });
      y -= 18;

      var cw = fonts.sans.widthOfTextAtSize(CONTACT_LINE, 6.5);
      page.drawText(CONTACT_LINE, { x: (PAGE_W - cw) / 2, y: y, size: 6.5, font: fonts.sans, color: MUTED });
      y -= 12;
    } else {
      y -= 6;
    }

    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 0.75, color: RULE,
    });
    return y - 8;
  }

  var HEADER_FNS = { a: drawHeaderA, b: drawHeaderB, c: drawHeaderC, d: drawHeaderD };

  function drawHeader(page, fonts, logos, variant, y, isFirstPage) {
    return (HEADER_FNS[variant] || drawHeaderA)(page, fonts, logos, y, isFirstPage);
  }

  // ── Body Rendering ────────────────────────────────────────────────────

  function drawTitle(page, fonts, title, y) {
    var tw = fonts.serifBold.widthOfTextAtSize(title, 13);
    page.drawText(title, { x: (PAGE_W - tw) / 2, y: y, size: 13, font: fonts.serifBold, color: NAVY });
    y -= 20;
    page.drawLine({
      start: { x: 130, y: y }, end: { x: PAGE_W - 130, y: y },
      thickness: 0.5, color: GOLD,
    });
    return y - 22;
  }

  function drawFields(page, fonts, form, fields, y) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      page.drawText(f.label, { x: MARGIN, y: y, size: 10.5, font: fonts.sansMed, color: INK });
      var labelW = fonts.sansMed.widthOfTextAtSize(f.label, 10.5);
      addUnderlineField(form, page, f.name, MARGIN + labelW + 4, y - 14, f.width || 370, fonts.sans);
      y -= 30;
    }
    return y;
  }

  function drawIntro(page, fonts, text, y) {
    return drawWrapped(page, text, MARGIN, y, fonts.serif, 10.5, INK, PAGE_W - MARGIN * 2) - 12;
  }

  function drawClauses(page, fonts, clauses, y) {
    var remaining = [];
    var maxWidth = PAGE_W - MARGIN * 2 - 24;
    for (var i = 0; i < clauses.length; i++) {
      var clause = clauses[i];
      var needed = estimateClauseHeight(clause, fonts.serif, 10, maxWidth);
      if (y - needed < MIN_Y_BEFORE_BREAK) {
        for (var j = i; j < clauses.length; j++) remaining.push(clauses[j]);
        break;
      }
      page.drawText(clause.num + ' ' + clause.title, { x: MARGIN, y: y, size: 11, font: fonts.serifBold, color: INK });
      y -= 18;
      y = drawWrapped(page, clause.body, MARGIN + 24, y, fonts.serif, 10, INK, maxWidth);
      y -= 12;
    }
    return { y: y, remaining: remaining };
  }

  function drawWitness(page, fonts, text, y) {
    page.drawText(text, { x: MARGIN + 8, y: y, size: 9.5, font: fonts.serifBold, color: INK });
    return y - 30;
  }

  function drawSignatureBlocks(form, page, fonts, blocks, y) {
    if (blocks.length >= 2) {
      var origY = y;
      y = drawOneSigBlock(form, page, fonts, blocks[0], MARGIN + 8, y);
      drawOneSigBlock(form, page, fonts, blocks[1], MARGIN + 310, origY);
      return y;
    }
    if (blocks.length === 1) return drawOneSigBlock(form, page, fonts, blocks[0], MARGIN + 8, y);
    return y;
  }

  function drawOneSigBlock(form, page, fonts, block, x, y) {
    page.drawText(block.label, { x: x, y: y, size: 9.5, font: fonts.serifBold, color: INK });
    var sy = y - 22;
    for (var i = 0; i < block.fields.length; i++) {
      var f = block.fields[i];
      if (f.label === 'Signature') {
        page.drawLine({ start: { x: x, y: sy }, end: { x: x + 200, y: sy }, thickness: 0.5, color: DARK_RULE });
        page.drawText('[SEAL]', { x: x + 185, y: sy, size: 6, font: fonts.sans, color: MUTED });
        addUnderlineField(form, page, f.name, x, sy - 14, 200, fonts.sans);
      } else {
        addUnderlineField(form, page, f.name, x, sy, 200, fonts.sans);
        page.drawText(f.label, { x: x, y: sy - 10, size: 7.5, font: fonts.sans, color: MUTED });
      }
      sy -= 38;
    }
    return sy - 8;
  }

  // ── Footer ────────────────────────────────────────────────────────────

  function drawFooter(page, fonts, docTitle, currentPage, totalPages) {
    page.drawLine({
      start: { x: MARGIN, y: 44 }, end: { x: PAGE_W - MARGIN, y: 44 },
      thickness: 0.75, color: RULE,
    });

    page.drawText(docTitle, { x: MARGIN, y: 30, size: 6.5, font: fonts.sans, color: MUTED });

    var centerText = 'Confidential · Attorney-Client Privileged';
    var cw = fonts.sans.widthOfTextAtSize(centerText, 6.5);
    page.drawText(centerText, { x: (PAGE_W - cw) / 2, y: 30, size: 6.5, font: fonts.sans, color: MUTED });

    var rightText = 'Page ' + currentPage + ' of ' + totalPages;
    var rw = fonts.sans.widthOfTextAtSize(rightText, 6.5);
    page.drawText(rightText, { x: PAGE_W - MARGIN - rw, y: 30, size: 6.5, font: fonts.sans, color: MUTED });
  }

  // ── Orchestrator ──────────────────────────────────────────────────────

  function normalizeDef(def) {
    var validVariants = { a: 1, b: 1, c: 1, d: 1 };
    return {
      title:           def.title || '',
      headerVariant:   validVariants[def.headerVariant] ? def.headerVariant : 'a',
      fields:          def.fields || [],
      intro:           def.intro || '',
      clauses:         def.clauses || [],
      witnessText:     def.witnessText || 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.',
      signatureBlocks: def.signatureBlocks || [],
    };
  }

  async function buildPDF(def) {
    if (!global.PDFLib) throw new Error('pdf-lib not loaded.');
    if (!global.fontkit) throw new Error('fontkit not loaded. Include @pdf-lib/fontkit script before this one.');

    var d = normalizeDef(def);
    var doc = await PDFDocument.create();
    doc.registerFontkit(global.fontkit);

    // Load fonts & logos in parallel
    var [fontBufs, logos] = await Promise.all([loadFontBufs(), loadLogos(doc)]);

    // Embed fonts
    var fonts = {
      serif:     await doc.embedFont(fontBufs.serif),
      serifBold: await doc.embedFont(fontBufs.serifBold),
      sans:      await doc.embedFont(fontBufs.sans),
      sansMed:   await doc.embedFont(fontBufs.sansMed),
    };

    var form = doc.getForm();
    var page = doc.addPage([PAGE_W, PAGE_H]);
    var y = HEADER_START_Y;

    // First-page header
    y = drawHeader(page, fonts, logos, d.headerVariant, y, true);
    y -= 24;

    // Title
    y = drawTitle(page, fonts, d.title, y);

    // Form fields
    if (d.fields.length > 0) {
      y = drawFields(page, fonts, form, d.fields, y);
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
        y = drawHeader(page, fonts, logos, d.headerVariant, HEADER_START_Y, false);
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
        y = drawHeader(page, fonts, logos, d.headerVariant, HEADER_START_Y, false);
      }
      y -= 10;
      y = drawWitness(page, fonts, d.witnessText, y);
      y = drawSignatureBlocks(form, page, fonts, d.signatureBlocks, y);
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
