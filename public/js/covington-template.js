/**
 * Covington & Burling LLP — Official Document Template Engine
 * Browser-side pdf-lib template. Generates fillable PDFs in the
 * Bordered Traditional (Variant C) style.
 *
 * Depends on pdf-lib loaded via CDN: window.PDFLib
 *
 * Usage:
 *   const pdfBytes = await CovingtonTemplate.generate({
 *     title: 'DOCUMENT TITLE',
 *     fields: [{ label: 'Name:', name: 'fullName', width: 400 }],
 *     clauses: [{ num: '1.', title: 'Section.', body: 'Text...' }],
 *     signatureBlocks: [{ label: 'Party', fields: [...] }],
 *   });
 *   // pdfBytes is a Uint8Array — call CovingtonTemplate.download(pdfBytes, 'file.pdf')
 */
(function (global) {
  'use strict';

  const { PDFDocument, StandardFonts, rgb } = global.PDFLib || {};

  // ── Constants ──────────────────────────────────────────────────────────
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 50;
  const NAVY = rgb(0.039, 0.086, 0.157);
  const GOLD = rgb(0.761, 0.643, 0.310);
  const MUTED = rgb(0.353, 0.353, 0.431);
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

  function drawPageFrame(page) {
    page.drawRectangle({
      x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48,
      borderWidth: 0.5, borderColor: DARK_GRAY,
    });
    page.drawRectangle({
      x: 28, y: 28, width: PAGE_W - 56, height: PAGE_H - 56,
      borderWidth: 1.5, borderColor: DARK_GRAY,
    });
  }

  function addPageNumber(page, fonts, current, total) {
    page.drawText('Page ' + current + ' of ' + total, {
      x: PAGE_W - MARGIN - 80, y: 20, size: 8,
      font: fonts.regular, color: MUTED,
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

  function drawLetterhead(page, fonts, y) {
    // Centered letterhead
    const name = 'Covington & Burling LLP';
    const addr = '850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com';
    page.drawText(name, {
      x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize(name, 14) / 2,
      y, size: 14, font: fonts.bold, color: NAVY,
    });
    page.drawText(addr, {
      x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize(addr, 8.5) / 2,
      y: y - 18, size: 8.5, font: fonts.regular, color: MUTED,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 28 },
      end: { x: PAGE_W - MARGIN, y: y - 28 },
      thickness: 1, color: GOLD,
    });
    return y - 28;
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

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let totalPages = 1;
    drawPageFrame(page);

    // Letterhead
    let y = PAGE_H - 62;
    y = drawLetterhead(page, fonts, y);
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
        drawPageFrame(page);
        y = PAGE_H - 62;
        // Draw remaining clauses on new page (naive: just restart all)
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
      drawPageFrame(page);
      y = PAGE_H - 62;
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

    addPageNumber(page, fonts, 1, totalPages);

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
  global.CovingtonTemplate = {
    generate: buildBorderedTraditionalPDF,
    download: downloadPDF,
  };
})(typeof window !== 'undefined' ? window : this);
