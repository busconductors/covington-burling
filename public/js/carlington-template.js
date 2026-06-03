(function (global) {
  'use strict';
  var PDFDocument = global.PDFLib.PDFDocument;
  var StandardFonts = global.PDFLib.StandardFonts;
  var rgb = global.PDFLib.rgb;

  // ── Constants ──────────────────────────────────────────────────────────
  var PAGE_W = 612;
  var PAGE_H = 792;
  var MARGIN = 50;
  var HEADER_START_Y = PAGE_H - 62;
  var MIN_Y_BEFORE_BREAK = 120;
  var NAVY = rgb(0.039, 0.086, 0.157);
  var BRAND_GOLD = rgb(0.690, 0.553, 0.341);
  var LIGHT_GOLD = rgb(0.788, 0.651, 0.420);
  var TITLE_GOLD = rgb(0.761, 0.643, 0.310);
  var SLATE = rgb(0.353, 0.341, 0.467);
  var MUTED = rgb(0.353, 0.353, 0.431);
  var LIGHT_RULE = rgb(0.851, 0.835, 0.800);
  var BLACK = rgb(0, 0, 0);
  var WHITE = rgb(1, 1, 1);
  var DARK_GRAY = rgb(0.267, 0.267, 0.267);
  var CONTACT_LINE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  carlingtonburling.com';
  var TAGLINE_YEAR = '1919';
  var LOGO_PATHS = [
    { key: 'stacked',  url: '/images/brand/logo_stacked.png?v=2' },
    { key: 'reversed', url: '/images/brand/logo_reversed.png' },
    { key: 'primary',  url: '/images/brand/logo_primary.png' },
    { key: 'monogram', url: '/images/brand/logo_monogram.png' },
  ];

  // ── Utility Functions ──────────────────────────────────────────────────

  function embedFonts(doc) {
    return {
      regular: doc.embedStandardFont(StandardFonts.TimesRoman),
      bold:    doc.embedStandardFont(StandardFonts.TimesRomanBold),
    };
  }

  function drawWrapped(page, text, x, y, font, size, color, maxWidth) {
    var words = text.split(' ');
    var line = '';
    var currentY = y;
    var lineHeight = size * 1.6;

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
      var testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxWidth && line.length > 0) {
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
    var lines = lineCount(clause.body, font, size, maxWidth);
    return 18 + lines * (size * 1.6) + 12;
  }

  function addUnderlineField(form, page, name, x, y, width, font) {
    var field = form.createTextField(name);
    field.addToPage(page, {
      x: x, y: y - 3, width: width, height: 14,
      borderWidth: 0, borderColor: WHITE, backgroundColor: WHITE,
    });
    page.drawLine({
      start: { x: x, y: y + 2 },
      end:   { x: x + width, y: y + 2 },
      thickness: 0.5,
      color: DARK_GRAY,
    });
    if (font) field.defaultUpdateAppearances(font);
    return field;
  }

  // ── Logo Loading ───────────────────────────────────────────────────────

  async function preloadLogos(doc) {
    var logos = {};

    if (typeof Promise.allSettled === 'function') {
      var results = await Promise.allSettled(LOGO_PATHS.map(function (p) {
        return fetch(p.url).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        });
      }));

      for (var i = 0; i < LOGO_PATHS.length; i++) {
        if (results[i].status === 'fulfilled') {
          try { logos[LOGO_PATHS[i].key] = await doc.embedPng(results[i].value); } catch (_) {}
        }
      }
    } else {
      for (var i = 0; i < LOGO_PATHS.length; i++) {
        try {
          var r = await fetch(LOGO_PATHS[i].url);
          if (r.ok) logos[LOGO_PATHS[i].key] = await doc.embedPng(await r.arrayBuffer());
        } catch (_) {}
      }
    }

    return logos;
  }

  // ── Header Variants ──────────────────────────────────────────────────
  // Each: function(page, fonts, logos, y, isFirstPage) → newY

  function drawHeaderA(page, fonts, logos, y, isFirstPage) {
    var logo = logos.stacked;
    var logoH = isFirstPage ? 118 : 78;
    if (logo) {
      var logoW = logo.width * (logoH / logo.height);
      page.drawImage(logo, { x: (PAGE_W - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
      y -= logoH + 6;
    }

    if (isFirstPage) {
      var pre = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  ';
      var domain = 'carlingtonburling.com';
      var full = pre + domain;
      var tw = fonts.regular.widthOfTextAtSize(full, 8);
      var sx = (PAGE_W - tw) / 2;
      page.drawText(pre, { x: sx, y: y, size: 8, font: fonts.regular, color: MUTED });
      page.drawText(domain, {
        x: sx + fonts.regular.widthOfTextAtSize(pre, 8),
        y: y, size: 8, font: fonts.regular, color: BRAND_GOLD,
      });
      y -= 16;
    } else {
      y -= 6;
    }

    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 1, color: LIGHT_RULE,
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
      var logoY = y - bandH + (bandH - logoH) / 2;
      page.drawImage(logo, { x: MARGIN, y: logoY, width: logoW, height: logoH });
    }

    if (isFirstPage) {
      var domainText = 'carlingtonburling.com';
      var dw = fonts.regular.widthOfTextAtSize(domainText, 9);
      page.drawText(domainText, { x: PAGE_W - MARGIN - dw, y: y - 16, size: 9, font: fonts.regular, color: LIGHT_GOLD });

      var cw = fonts.regular.widthOfTextAtSize(CONTACT_LINE, 7);
      page.drawText(CONTACT_LINE, { x: PAGE_W - MARGIN - cw, y: y - 30, size: 7, font: fonts.regular, color: WHITE });
    }

    y -= bandH;
    page.drawRectangle({ x: 0, y: y - 3, width: PAGE_W, height: 3, color: BRAND_GOLD });
    y -= 3;
    return y - 4;
  }

  function drawHeaderC(page, fonts, logos, y, isFirstPage) {
    var logo = logos.primary;
    var logoH = isFirstPage ? 42 : 28;

    if (logo) {
      var logoW = logo.width * (logoH / logo.height);
      page.drawImage(logo, { x: MARGIN, y: y - logoH, width: logoW, height: logoH });
    }

    if (isFirstPage) {
      var domainText = 'carlingtonburling.com';
      var dw = fonts.regular.widthOfTextAtSize(domainText, 9);
      page.drawText(domainText, { x: PAGE_W - MARGIN - dw, y: y - 20, size: 9, font: fonts.regular, color: BRAND_GOLD });

      var cw = fonts.regular.widthOfTextAtSize(CONTACT_LINE, 7);
      page.drawText(CONTACT_LINE, { x: PAGE_W - MARGIN - cw, y: y - 34, size: 7, font: fonts.regular, color: MUTED });
    }

    y -= logoH + 6;

    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 1, color: LIGHT_RULE,
    });
    return y - 8;
  }

  function drawHeaderD(page, fonts, logos, y, isFirstPage) {
    var logo = logos.monogram;
    var monoH = isFirstPage ? 56 : 36;

    if (logo) {
      var monoW = logo.width * (monoH / logo.height);
      page.drawImage(logo, { x: (PAGE_W - monoW) / 2, y: y - monoH, width: monoW, height: monoH });
      y -= monoH + 10;
    }

    var wordmark = 'Carlington & Burling LLP';
    var wmSize = isFirstPage ? 18 : 13;
    var wmW = fonts.bold.widthOfTextAtSize(wordmark, wmSize);
    page.drawText(wordmark, { x: (PAGE_W - wmW) / 2, y: y, size: wmSize, font: fonts.bold, color: NAVY });
    y -= wmSize * 1.8;

    if (isFirstPage) {
      var tagline = 'ATTORNEYS AT LAW · SINCE ' + TAGLINE_YEAR;
      var tlSize = 8;
      var tlW = fonts.regular.widthOfTextAtSize(tagline, tlSize);
      var ruleW = 36;
      var totalW = ruleW + 10 + tlW + 10 + ruleW;
      var startX = (PAGE_W - totalW) / 2;

      page.drawLine({
        start: { x: startX, y: y - 3 }, end: { x: startX + ruleW, y: y - 3 },
        thickness: 0.5, color: BRAND_GOLD,
      });
      page.drawText(tagline, {
        x: startX + ruleW + 10, y: y - 6, size: tlSize, font: fonts.regular, color: BRAND_GOLD,
      });
      page.drawLine({
        start: { x: startX + ruleW + 10 + tlW + 10, y: y - 3 },
        end: { x: totalW + startX, y: y - 3 },
        thickness: 0.5, color: BRAND_GOLD,
      });
      y -= 20;

      var cw = fonts.regular.widthOfTextAtSize(CONTACT_LINE, 7);
      page.drawText(CONTACT_LINE, { x: (PAGE_W - cw) / 2, y: y, size: 7, font: fonts.regular, color: MUTED });
      y -= 14;
    } else {
      y -= 6;
    }

    page.drawLine({
      start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y },
      thickness: 1, color: LIGHT_RULE,
    });
    return y - 8;
  }

  var HEADER_FNS = { a: drawHeaderA, b: drawHeaderB, c: drawHeaderC, d: drawHeaderD };

  function drawHeader(page, fonts, logos, variant, y, isFirstPage) {
    var fn = HEADER_FNS[variant] || drawHeaderA;
    return fn(page, fonts, logos, y, isFirstPage);
  }

  // ── Body Rendering ────────────────────────────────────────────────────

  function drawTitle(page, fonts, title, y) {
    var tw = fonts.bold.widthOfTextAtSize(title, 13);
    page.drawText(title, { x: (PAGE_W - tw) / 2, y: y, size: 13, font: fonts.bold, color: NAVY });
    y -= 20;
    page.drawLine({
      start: { x: 120, y: y }, end: { x: PAGE_W - 120, y: y },
      thickness: 0.5, color: TITLE_GOLD,
    });
    return y - 22;
  }

  function drawFields(page, fonts, form, fields, y) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      page.drawText(f.label, { x: MARGIN, y: y, size: 11, font: fonts.bold, color: BLACK });
      var labelW = fonts.bold.widthOfTextAtSize(f.label, 11);
      addUnderlineField(form, page, f.name, MARGIN + labelW + 4, y - 14, f.width || 370, fonts.regular);
      y -= 30;
    }
    return y;
  }

  function drawIntro(page, fonts, text, y) {
    y = drawWrapped(page, text, MARGIN, y, fonts.regular, 10.5, BLACK, PAGE_W - MARGIN * 2);
    return y - 12;
  }

  function drawClauses(page, fonts, clauses, y) {
    var remaining = [];
    var maxWidth = PAGE_W - MARGIN * 2 - 24;
    for (var i = 0; i < clauses.length; i++) {
      var clause = clauses[i];
      var needed = estimateClauseHeight(clause, fonts.regular, 10.5, maxWidth);
      if (y - needed < MIN_Y_BEFORE_BREAK) {
        for (var j = i; j < clauses.length; j++) remaining.push(clauses[j]);
        break;
      }
      page.drawText(clause.num + ' ' + clause.title, { x: MARGIN, y: y, size: 11, font: fonts.bold, color: BLACK });
      y -= 18;
      y = drawWrapped(page, clause.body, MARGIN + 24, y, fonts.regular, 10.5, BLACK, maxWidth);
      y -= 12;
    }
    return { y: y, remaining: remaining };
  }

  function drawWitness(page, fonts, text, y) {
    page.drawText(text, { x: MARGIN + 8, y: y, size: 10, font: fonts.bold, color: BLACK });
    return y - 30;
  }

  function drawSignatureBlocks(form, page, fonts, blocks, y) {
    if (blocks.length >= 2) {
      var origY = y;
      y = drawOneSigBlock(form, page, fonts, blocks[0], MARGIN + 8, y);
      drawOneSigBlock(form, page, fonts, blocks[1], MARGIN + 310, origY);
      return y;
    }
    if (blocks.length === 1) {
      return drawOneSigBlock(form, page, fonts, blocks[0], MARGIN + 8, y);
    }
    return y;
  }

  function drawOneSigBlock(form, page, fonts, block, x, y) {
    page.drawText(block.label, { x: x, y: y, size: 10, font: fonts.bold, color: BLACK });
    var sy = y - 22;
    for (var i = 0; i < block.fields.length; i++) {
      var f = block.fields[i];
      if (f.label === 'Signature') {
        page.drawLine({
          start: { x: x, y: sy }, end: { x: x + 200, y: sy },
          thickness: 0.5, color: DARK_GRAY,
        });
        page.drawText('[SEAL]', { x: x + 185, y: sy, size: 6, font: fonts.regular, color: MUTED });
        addUnderlineField(form, page, f.name, x, sy - 14, 200, fonts.regular);
      } else {
        addUnderlineField(form, page, f.name, x, sy, 200, fonts.regular);
        page.drawText(f.label, { x: x, y: sy - 10, size: 8, font: fonts.regular, color: MUTED });
      }
      sy -= 38;
    }
    return sy - 8;
  }

  // ── Footer ────────────────────────────────────────────────────────────

  function drawFooter(page, fonts, docTitle, currentPage, totalPages) {
    page.drawLine({
      start: { x: MARGIN, y: 44 }, end: { x: PAGE_W - MARGIN, y: 44 },
      thickness: 1, color: LIGHT_RULE,
    });

    page.drawText(docTitle, { x: MARGIN, y: 30, size: 7, font: fonts.regular, color: MUTED });

    var centerText = 'Confidential · Attorney-Client Privileged';
    var cw = fonts.regular.widthOfTextAtSize(centerText, 7);
    page.drawText(centerText, { x: (PAGE_W - cw) / 2, y: 30, size: 7, font: fonts.regular, color: MUTED });

    var rightText = 'Page ' + currentPage + ' of ' + totalPages;
    var rw = fonts.regular.widthOfTextAtSize(rightText, 7);
    page.drawText(rightText, { x: PAGE_W - MARGIN - rw, y: 30, size: 7, font: fonts.regular, color: MUTED });
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
    if (!global.PDFLib) throw new Error('pdf-lib not loaded. Include pdf-lib script before this one.');

    var d = normalizeDef(def);
    var doc = await PDFDocument.create();
    var fonts = embedFonts(doc);
    var logos = await preloadLogos(doc);
    var form = doc.getForm();

    var page = doc.addPage([PAGE_W, PAGE_H]);
    var totalPages = 1;
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

    // Intro paragraph
    if (d.intro) {
      y = drawIntro(page, fonts, d.intro, y);
    }

    // Clauses with proper pagination
    var pending = d.clauses.slice();
    while (pending.length > 0) {
      var result = drawClauses(page, fonts, pending, y);
      y = result.y;
      pending = result.remaining;
      if (pending.length > 0) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        totalPages++;
        y = drawHeader(page, fonts, logos, d.headerVariant, HEADER_START_Y, false);
      }
    }

    // Signature blocks
    if (d.signatureBlocks.length > 0) {
      var maxFields = 0;
      for (var si = 0; si < d.signatureBlocks.length; si++) {
        if (d.signatureBlocks[si].fields.length > maxFields)
          maxFields = d.signatureBlocks[si].fields.length;
      }
      var estimatedSigH = 60 + maxFields * 38;
      if (y - estimatedSigH < MIN_Y_BEFORE_BREAK) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        totalPages++;
        y = drawHeader(page, fonts, logos, d.headerVariant, HEADER_START_Y, false);
      }
      y -= 10;
      y = drawWitness(page, fonts, d.witnessText, y);
      y = drawSignatureBlocks(form, page, fonts, d.signatureBlocks, y);
    }

    // Footer on every page
    var pages = doc.getPages();
    for (var i = 0; i < pages.length; i++) {
      drawFooter(pages[i], fonts, d.title, i + 1, pages.length);
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
