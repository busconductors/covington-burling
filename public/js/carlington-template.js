/**
 * Carlington & Burling LLP — Official Document Template Engine
 * Browser-side pdf-lib template. Generates fillable PDFs in the
 * Bordered Traditional (Variant C) style.
 *
 * Depends on pdf-lib loaded via CDN: window.PDFLib
 *
 * Usage:
 *   const pdfBytes = await CarlingtonTemplate.generate({
 *     title: 'DOCUMENT TITLE',
 *     fields: [{ label: 'Name:', name: 'fullName', width: 400 }],
 *     clauses: [{ num: '1.', title: 'Section.', body: 'Text...' }],
 *     signatureBlocks: [{ label: 'Party', fields: [...] }],
 *   });
 *   // pdfBytes is a Uint8Array — call CarlingtonTemplate.download(pdfBytes, 'file.pdf')
 */
(function (global) {
  'use strict';

  const { PDFDocument, StandardFonts, rgb } = global.PDFLib || {};

  // ── Constants ──────────────────────────────────────────────────────────
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 50;
  const NAVY = rgb(0.039, 0.086, 0.157);
  const BRAND_GOLD = rgb(0.690, 0.553, 0.341);   // #B08D57 — header accent
  const GOLD = rgb(0.761, 0.643, 0.310);          // title rule
  const MUTED = rgb(0.353, 0.353, 0.431);
  const LIGHT_RULE = rgb(0.851, 0.835, 0.800);    // #D9D5CC — header divider
  const BLACK = rgb(0, 0, 0);
  const WHITE = rgb(1, 1, 1);
  const DARK_GRAY = rgb(0.267, 0.267, 0.267);

  // ── Utility Functions ──────────────────────────────────────────────────

  // Synchronous in pdf-lib (both browser and Node)
  function embedFonts(doc) {
    return {
      regular: doc.embedStandardFont(StandardFonts.TimesRoman),
      bold: doc.embedStandardFont(StandardFonts.TimesRomanBold),
    };
  }

  function drawWrapped(page, text, x, y, font, size, color, maxWidth) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) < maxWidth && line !== '') {
        line = test;
      } else {
        if (line) {
          page.drawText(line, { x, y: lineY, size, font, color });
          lineY -= size * 1.6;
        }
        line = word;
      }
    }
    if (line) {
      page.drawText(line, { x, y: lineY, size, font, color });
      lineY -= size * 1.6;
    }
    return lineY;
  }

  function drawFooter(page, fonts, docName, currentPage, totalPages) {
    const lineY = 44;
    const textY = 30;

    page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_W - MARGIN, y: lineY },
      thickness: 1, color: LIGHT_RULE,
    });

    page.drawText(docName, {
      x: MARGIN, y: textY, size: 7, font: fonts.regular, color: MUTED,
    });

    const centerText = 'Confidential · Attorney-Client Privileged';
    const cw = fonts.regular.widthOfTextAtSize(centerText, 7);
    page.drawText(centerText, {
      x: (PAGE_W - cw) / 2, y: textY, size: 7, font: fonts.regular, color: MUTED,
    });

    const pageText = 'Page ' + currentPage + ' of ' + totalPages;
    const pw = fonts.regular.widthOfTextAtSize(pageText, 7);
    page.drawText(pageText, {
      x: PAGE_W - MARGIN - pw, y: textY, size: 7, font: fonts.regular, color: MUTED,
    });
  }

  function addUnderlineField(form, page, name, x, y, width, font) {
    const field = form.createTextField(name);
    field.addToPage(page, {
      x, y: y - 3, width, height: 14,
      borderWidth: 0, borderColor: WHITE, backgroundColor: WHITE,
    });
    page.drawLine({
      start: { x, y: y + 2 }, end: { x: x + width, y: y + 2 },
      thickness: 0.5, color: DARK_GRAY,
    });
    if (font) field.defaultUpdateAppearances(font);
    return field;
  }

  async function embedStackedLogo(doc) {
    try {
      const resp = await fetch('/images/brand/logo_stacked.png?v=2');
      if (!resp.ok) return null;
      return doc.embedPng(await resp.arrayBuffer());
    } catch (_) { return null; }
  }

  function drawHeader(page, fonts, logo, y, logoH, includeContact) {
    if (logo) {
      const logoW = logo.width * (logoH / logo.height);
      const logoX = (PAGE_W - logoW) / 2;
      page.drawImage(logo, {
        x: logoX, y: y - logoH, width: logoW, height: logoH,
      });
      y -= logoH + 6;
    }

    if (includeContact) {
      const pre = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  ';
      const domain = 'carlingtonburling.com';
      const full = pre + domain;
      const tw = fonts.regular.widthOfTextAtSize(full, 8);
      const sx = (PAGE_W - tw) / 2;
      page.drawText(pre, { x: sx, y, size: 8, font: fonts.regular, color: MUTED });
      page.drawText(domain, {
        x: sx + fonts.regular.widthOfTextAtSize(pre, 8),
        y, size: 8, font: fonts.regular, color: BRAND_GOLD,
      });
      y -= 16;
    } else {
      y -= 6; // smaller gap when no contact line
    }

    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
      thickness: 1, color: LIGHT_RULE,
    });
    return y - 8;
  }

  function drawTitle(page, fonts, title, y) {
    page.drawText(title, {
      x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize(title, 13) / 2,
      y, size: 13, font: fonts.bold, color: NAVY,
    });
    y -= 20;
    page.drawLine({
      start: { x: 120, y }, end: { x: PAGE_W - 120, y },
      thickness: 0.5, color: GOLD,
    });
    return y - 22;
  }

  function drawFields(page, fonts, form, fields, y) {
    for (const f of fields) {
      page.drawText(f.label, { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
      const labelW = fonts.bold.widthOfTextAtSize(f.label, 11);
      addUnderlineField(form, page, f.name, MARGIN + labelW + 4, y - 14, f.width || 370, fonts.regular);
      y -= 30;
    }
    return y;
  }

  function drawClausesFn(page, fonts, clauses, y) {
    for (const clause of clauses) {
      if (y < 200) return { needsPage: true, lastY: y };

      const label = clause.num + ' ' + clause.title;
      page.drawText(label, { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
      y -= 18;
      y = drawWrapped(page, clause.body, MARGIN + 24, y, fonts.regular, 10.5, BLACK, PAGE_W - MARGIN * 2 - 24);
      y -= 12;
    }
    return { needsPage: false, lastY: y };
  }

  function drawSigBlock(form, page, x, y, fonts, label, fields) {
    page.drawText(label, { x, y, size: 10, font: fonts.bold, color: BLACK });
    let sy = y - 22;
    for (const f of fields) {
      if (f.label === 'Signature') {
        page.drawLine({
          start: { x, y: sy }, end: { x: x + 200, y: sy },
          thickness: 0.5, color: DARK_GRAY,
        });
        page.drawText('[SEAL]', { x: x + 185, y: sy, size: 6, font: fonts.regular, color: MUTED });
        addUnderlineField(form, page, f.name, x, sy - 14, 200, fonts.regular);
      } else {
        addUnderlineField(form, page, f.name, x, sy, 200, fonts.regular);
      }
      page.drawText(f.label, { x, y: sy - 10, size: 8, font: fonts.regular, color: MUTED });
      sy -= 38;
    }
    return sy - 8;
  }

  // ── Main Builder ──────────────────────────────────────────────────────

  async function buildBorderedTraditionalPDF(def) {
    if (!global.PDFLib) throw new Error('pdf-lib not loaded. Include pdf-lib script before this one.');

    const doc = await PDFDocument.create();
    const fonts = {
      regular: doc.embedStandardFont(StandardFonts.TimesRoman),
      bold: doc.embedStandardFont(StandardFonts.TimesRomanBold),
    };
    const form = doc.getForm();
    const logo = await embedStackedLogo(doc);

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let totalPages = 1;

    // Page-1 header with full (118px) logo + contact line
    let y = PAGE_H - 62;
    y = drawHeader(page, fonts, logo, y, 118, true);
    y -= 24;

    // Title
    y = drawTitle(page, fonts, def.title, y);

    // Form fields
    if (def.fields && def.fields.length > 0) {
      y = drawFields(page, fonts, form, def.fields, y);
      y -= 4;
    }

    // Intro paragraph
    if (def.intro) {
      y = drawWrapped(page, def.intro, MARGIN, y, fonts.regular, 10.5, BLACK, PAGE_W - MARGIN * 2);
      y -= 12;
    }

    // Clauses
    if (def.clauses && def.clauses.length > 0) {
      const result = drawClausesFn(page, fonts, def.clauses, y);
      if (result.needsPage) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        totalPages++;
        y = drawHeader(page, fonts, logo, PAGE_H - 62, 78, false); // continuation header
        const r2 = drawClausesFn(page, fonts, def.clauses.slice(2), y);
        y = r2.lastY;
      } else {
        y = result.lastY;
      }
    }

    y -= 10;
    if (y < 300 && def.signatureBlocks && def.signatureBlocks.length > 0) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      totalPages++;
      y = drawHeader(page, fonts, logo, PAGE_H - 62, 78, false); // continuation header
    }

    // IN WITNESS WHEREOF
    if (def.signatureBlocks && def.signatureBlocks.length > 0) {
      const witnessText = def.witnessText || 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.';
      page.drawText(witnessText, {
        x: MARGIN + 8, y, size: 10, font: fonts.bold, color: BLACK,
      });
      y -= 30;

      // Draw signature blocks side by side (up to 2)
      if (def.signatureBlocks.length >= 2) {
        const block0extra = def.signatureBlocks[0].fields.length * 38 + 22;
        y = drawSigBlock(form, page, MARGIN + 8, y, fonts,
          def.signatureBlocks[0].label, def.signatureBlocks[0].fields);
        drawSigBlock(form, page, MARGIN + 310, y + block0extra, fonts,
          def.signatureBlocks[1].label, def.signatureBlocks[1].fields);
      } else if (def.signatureBlocks.length === 1) {
        drawSigBlock(form, page, MARGIN + 8, y, fonts,
          def.signatureBlocks[0].label, def.signatureBlocks[0].fields);
      }
    }

    // Add footer to every page
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      drawFooter(pages[i], fonts, def.title, i + 1, totalPages);
    }

    return await doc.save();
  }

  /** Trigger a browser download of the PDF bytes. */
  function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Exports ───────────────────────────────────────────────────────────
  global.CarlingtonTemplate = {
    generate: buildBorderedTraditionalPDF,
    download: downloadPDF,
  };
})(typeof window !== 'undefined' ? window : this);
