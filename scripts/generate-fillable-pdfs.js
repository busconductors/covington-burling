/**
 * Generate fillable PDF forms with AcroForm fields.
 * Supports 4 design variants: a (Classic Underline), b (Modern Clean),
 * c (Bordered Traditional), d (Premium Corporate).
 *
 * Usage:
 *   node scripts/generate-fillable-pdfs.js          # all 4 waiver variants
 *   node scripts/generate-fillable-pdfs.js --final a # finalize variant A for both forms
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const FORMS_DIR = path.join(__dirname, '..', 'public', 'forms');

// ── Color Palette ──────────────────────────────────────────────────────────
const NAVY = rgb(0.039, 0.086, 0.157);       // #0A1628
const GOLD = rgb(0.761, 0.643, 0.310);       // #C2A44F
const MUTED = rgb(0.353, 0.353, 0.431);      // #5A5A6E
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.96, 0.96, 0.96);    // #F5F5F5
const CREAM = rgb(0.98, 0.97, 0.96);         // #FAF8F5
const LIGHT_BLUE = rgb(0.94, 0.96, 1);       // #F0F4FF
const DARK_GRAY = rgb(0.267, 0.267, 0.267);  // #444444
const WATERMARK_GRAY = rgb(0.94, 0.94, 0.94);
const FIELD_GRAY = rgb(0.82, 0.82, 0.82);

// ── Page ───────────────────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;

// ── Shared Clause Text ──────────────────────────────────────────────────────
const waiverClauses = [
  {
    num: '1.', title: 'Acknowledgment of Risk.',
    body: 'The Client acknowledges that all legal matters involve inherent risks and uncertainties. The Client understands that Covington & Burling LLP makes no guarantees regarding specific outcomes and that past results do not guarantee future results. The Client has been advised of the potential risks associated with the matter described above and voluntarily assumes all such risks.',
  },
  {
    num: '2.', title: 'Release.',
    body: 'To the fullest extent permitted by law, the Client hereby releases, waives, and discharges Covington & Burling LLP, its partners, associates, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or related to the matter described above, except for claims arising from gross negligence or willful misconduct on the part of the Firm.',
  },
  {
    num: '3.', title: 'Indemnification.',
    body: 'The Client agrees to indemnify, defend, and hold harmless Covington & Burling LLP, its partners, associates, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with the Client\'s actions or omissions in connection with the matter described above.',
  },
  {
    num: '4.', title: 'Governing Law.',
    body: 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising under this Agreement shall be resolved exclusively in the courts of the District of Columbia.',
  },
  {
    num: '5.', title: 'Entire Agreement.',
    body: 'This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.',
  },
];

const ndaClauses = [
  {
    num: '1.', title: 'Definition of Confidential Information.',
    body: '"Confidential Information" means any and all information, data, documents, and materials, whether oral, written, or in electronic form, disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), that is identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial information, client lists, legal strategies, and proprietary methodologies.',
  },
  {
    num: '2.', title: 'Obligations.',
    body: 'The Receiving Party shall: (a) protect the Disclosing Party\'s Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the purpose of evaluating or engaging in a business relationship between the Parties; (c) limit access to the Confidential Information to those employees and agents who have a need to know and who are bound by confidentiality obligations at least as restrictive as those set forth herein; and (d) not disclose, copy, or distribute the Confidential Information to any third party without the prior written consent of the Disclosing Party.',
  },
  {
    num: '3.', title: 'Exclusions.',
    body: 'Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of this Agreement; (b) was rightfully received from a third party without restriction and without breach of any obligation of confidentiality; (c) was independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information; or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives the Disclosing Party prompt written notice and reasonable assistance to seek a protective order.',
  },
  {
    num: '4.', title: 'Term.',
    body: 'This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality and non-use set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years thereafter. Upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information and certify such return or destruction in writing.',
  },
  {
    num: '5.', title: 'Governing Law.',
    body: 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia, and each Party consents to the personal jurisdiction and venue of such courts.',
  },
];

// ── Utility Functions ──────────────────────────────────────────────────────

async function embedFonts(doc) {
  return {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
    helvetica: await doc.embedFont(StandardFonts.Helvetica),
    helveticaBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

/** Word-wrap and draw text. Returns the new y position. */
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

/** Create a fillable text field with underline styling (no visible border). */
function addUnderlineField(form, page, name, x, y, width, font, size) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    x, y: y - 3, width, height: size + 4,
    borderWidth: 0, borderColor: WHITE, backgroundColor: WHITE,
  });
  // Draw the underline
  page.drawLine({
    start: { x, y: y + 2 }, end: { x: x + width, y: y + 2 },
    thickness: 0.5, color: DARK_GRAY,
  });
  if (font) field.defaultUpdateAppearances(font);
  return field;
}

/** Create a boxed fillable text field. */
function addBoxedField(form, page, name, x, y, width, height, font, size) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    x, y, width, height,
    borderWidth: 0.5, borderColor: FIELD_GRAY,
    backgroundColor: LIGHT_GRAY,
  });
  if (font) field.defaultUpdateAppearances(font);
  return field;
}

/** Create a digital-optimized field: underline + light blue tint for visibility. */
function addDigitalField(form, page, name, x, y, width, font, size) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    x, y: y - 3, width, height: size + 6,
    borderWidth: 0, backgroundColor: LIGHT_BLUE,
  });
  page.drawLine({
    start: { x, y: y + 2 }, end: { x: x + width, y: y + 2 },
    thickness: 0.75, color: DARK_GRAY,
  });
  if (font) field.defaultUpdateAppearances(font);
  return field;
}

function addPageNumber(page, fonts, current, total) {
  page.drawText(`Page ${current} of ${total}`, {
    x: PAGE_W - MARGIN - 80, y: 20,
    size: 8, font: fonts.regular, color: MUTED,
  });
}

// ── Letterhead Variants ────────────────────────────────────────────────────

/** Shared: simple letterhead with gold rule (used by A, B, C with tweaks). */
function letterheadStandard(page, fonts, yStart, alignment) {
  const x = alignment === 'center' ? PAGE_W / 2 : MARGIN;
  const opts = alignment === 'center' ? { x, y: yStart, size: 14, font: fonts.bold, color: NAVY } : { x, y: yStart, size: 14, font: fonts.bold, color: NAVY };
  if (alignment === 'center') {
    page.drawText('Covington & Burling LLP', {
      x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('Covington & Burling LLP', 14) / 2,
      y: yStart, size: 14, font: fonts.bold, color: NAVY,
    });
    page.drawText('850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com', {
      x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com', 8.5) / 2,
      y: yStart - 18, size: 8.5, font: fonts.regular, color: MUTED,
    });
  } else {
    page.drawText('Covington & Burling LLP', { x: MARGIN, y: yStart, size: 14, font: fonts.bold, color: NAVY });
    page.drawText('850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com', {
      x: MARGIN, y: yStart - 18, size: 8.5, font: fonts.regular, color: MUTED,
    });
  }
  page.drawLine({
    start: { x: MARGIN, y: yStart - 28 },
    end: { x: PAGE_W - MARGIN, y: yStart - 28 },
    thickness: 1, color: GOLD,
  });
  return yStart - 28;
}

/** Premium header band (Variant D). */
function letterheadBand(page, fonts, yStart) {
  // Navy band
  page.drawRectangle({
    x: 0, y: yStart - 72, width: PAGE_W, height: 72,
    color: NAVY,
  });
  // Gold accent line at bottom of band
  page.drawLine({
    start: { x: 0, y: yStart - 72 }, end: { x: PAGE_W, y: yStart - 72 },
    thickness: 2, color: GOLD,
  });
  // Firm name in gold/white
  page.drawText('Covington & Burling LLP', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('Covington & Burling LLP', 18) / 2,
    y: yStart - 30, size: 18, font: fonts.bold, color: GOLD,
  });
  // Address below firm name
  page.drawText('850 Tenth Street NW  •  Washington, DC 20001  •  202-662-6000  •  covbur.com', {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('850 Tenth Street NW  •  Washington, DC 20001  •  202-662-6000  •  covbur.com', 8) / 2,
    y: yStart - 52, size: 8, font: fonts.regular, color: WHITE,
  });
  return yStart - 90;
}

/** Continuation page header for premium variant. */
function continuationHeader(page, fonts, yStart) {
  page.drawRectangle({
    x: 0, y: yStart - 24, width: PAGE_W, height: 24,
    color: NAVY,
  });
  page.drawText('Covington & Burling LLP', {
    x: MARGIN, y: yStart - 16, size: 8, font: fonts.bold, color: GOLD,
  });
  return yStart - 36;
}

/** Draw double-line page frame (Variant C). */
function drawPageFrame(page) {
  // Outer thin line
  page.drawRectangle({
    x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48,
    borderWidth: 0.5, borderColor: DARK_GRAY, color: undefined,
  });
  // Inner thicker line
  page.drawRectangle({
    x: 28, y: 28, width: PAGE_W - 56, height: PAGE_H - 56,
    borderWidth: 1.5, borderColor: DARK_GRAY, color: undefined,
  });
}

// ── Signature Block Builders ────────────────────────────────────────────────

/** Variant A signature block — simple underlines. */
function sigBlockA(form, page, x, y, fonts, label, fields) {
  page.drawText(label, { x, y, size: 10, font: fonts.bold, color: BLACK });
  let sy = y - 20;
  const fOpts = [];
  for (const f of fields) {
    page.drawText(f.label, { x, y: sy, size: 9, font: fonts.regular, color: MUTED });
    addUnderlineField(form, page, f.name, x, sy - 14, 220, fonts.regular, 10);
    fOpts.push({ label: f.label, name: f.name });
    sy -= 32;
  }
  return sy - 8;
}

/** Variant B signature block — framed area. */
function sigBlockB(form, page, x, y, fonts, label, fields) {
  const blockH = fields.length * 36 + 30;
  // Frame
  page.drawRectangle({
    x: x - 10, y: y - blockH, width: 240, height: blockH,
    borderWidth: 0.5, borderColor: GOLD, color: CREAM,
  });
  page.drawText(label, { x, y: y - 16, size: 10, font: fonts.bold, color: NAVY });
  let sy = y - 38;
  for (const f of fields) {
    page.drawText(f.label, { x, y: sy, size: 8.5, font: fonts.regular, color: MUTED });
    addUnderlineField(form, page, f.name, x, sy - 14, 200, fonts.regular, 10);
    sy -= 36;
  }
  return y - blockH - 12;
}

/** Variant C — traditional side-by-side signatures with [SEAL]. */
function sigBlockC(form, page, x, y, fonts, label, fields) {
  page.drawText(label, { x, y, size: 10, font: fonts.bold, color: BLACK });
  let sy = y - 22;
  for (const f of fields) {
    if (f.label === 'Signature') {
      // Draw the signature underline
      page.drawLine({
        start: { x, y: sy }, end: { x: x + 200, y: sy },
        thickness: 0.5, color: DARK_GRAY,
      });
      page.drawText('[SEAL]', { x: x + 185, y: sy, size: 6, font: fonts.regular, color: MUTED });
      // Create fillable signature field
      addUnderlineField(form, page, f.name, x, sy - 14, 200, fonts.regular, 10);
    } else {
      addUnderlineField(form, page, f.name, x, sy, 200, fonts.regular, 10);
    }
    page.drawText(f.label, { x, y: sy - 10, size: 8, font: fonts.regular, color: MUTED });
    sy -= 38;
  }
  return sy - 8;
}

/** Variant D signature block — premium framed with cream background. */
function sigBlockD(form, page, x, y, fonts, label, fields) {
  const blockH = fields.length * 36 + 24;
  page.drawRectangle({
    x: x - 12, y: y - blockH, width: 260, height: blockH,
    borderWidth: 1, borderColor: GOLD, color: CREAM,
  });
  page.drawText(label, { x, y: y - 16, size: 11, font: fonts.bold, color: NAVY });
  let sy = y - 40;
  for (const f of fields) {
    page.drawText(f.label, { x, y: sy, size: 8.5, font: fonts.regular, color: MUTED });
    page.drawLine({
      start: { x, y: sy - 14 }, end: { x: x + 220, y: sy - 14 },
      thickness: 0.5, color: DARK_GRAY,
    });
    const field = form.createTextField(f.name);
    field.addToPage(page, {
      x, y: sy - 17, width: 220, height: 14,
      borderWidth: 0, backgroundColor: WHITE,
    });
    field.defaultUpdateAppearances(fonts.regular);
    sy -= 36;
  }
  return y - blockH - 12;
}

// ── Clause Rendering ───────────────────────────────────────────────────────

function drawClauses(page, fonts, clauses, startY, textWidth, indent) {
  let y = startY;
  for (const clause of clauses) {
    // Page break if needed
    if (y < 200) return { needsPage: true, lastY: y };

    const labelText = `${clause.num} ${clause.title}`;
    page.drawText(labelText, { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
    y -= 18;
    y = drawWrapped(page, clause.body, MARGIN + indent, y, fonts.regular, 10.5, BLACK, textWidth - indent);
    y -= 12;
  }
  return { needsPage: false, lastY: y };
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT A: Classic Underline
// ═══════════════════════════════════════════════════════════════════════════

async function buildWaiverA() {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 50;

  y = letterheadStandard(page, fonts, y, 'left');
  y -= 22;

  // Title
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: MARGIN, y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 30;

  // Form fields — underline style
  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientName', MARGIN, y - 14, 400, fonts.regular, 10);
  y -= 28;

  page.drawText('Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'date', MARGIN, y - 14, 200, fonts.regular, 10);
  y -= 28;

  page.drawText('Matter:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'matter', MARGIN, y - 14, 400, fonts.regular, 10);
  y -= 36;

  // Clauses
  const result = drawClauses(page, fonts, waiverClauses, y, PAGE_W - MARGIN * 2, 0);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    result.lastY = PAGE_H - 50;
    // Continue clauses on new page
    // Re-draw only remaining clauses that didn't fit
    // For simplicity, restart with all clauses on fresh page
    const r2 = drawClauses(page, fonts, waiverClauses.slice(2), PAGE_H - 50, PAGE_W - MARGIN * 2, 0);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 16;
  if (y < 220) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 60; }

  // Signature blocks — side by side
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 230, y }, thickness: 0.5, color: DARK_GRAY });
  page.drawText('Client Signature', { x: MARGIN, y: y - 10, size: 9, font: fonts.regular, color: MUTED });
  addUnderlineField(form, page, 'clientSignature', MARGIN, y - 26, 230, fonts.regular, 10);

  page.drawLine({ start: { x: 332, y }, end: { x: 562, y }, thickness: 0.5, color: DARK_GRAY });
  page.drawText('For Covington & Burling LLP', { x: 332, y: y - 10, size: 9, font: fonts.regular, color: MUTED });
  addUnderlineField(form, page, 'firmSignature', 332, y - 26, 230, fonts.regular, 10);
  y -= 44;

  page.drawText('Print Name:', { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientPrintName', MARGIN + 72, y - 14, 158, fonts.regular, 10);
  y -= 28;

  page.drawText('Date:', { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientSigDate', MARGIN + 38, y - 14, 100, fonts.regular, 10);

  page.drawText('Print Name:', { x: 332, y: y + 28, size: 10, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'firmPrintName', 404, (y + 28) - 14, 158, fonts.regular, 10);

  page.drawText('Date:', { x: 332, y, size: 10, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'firmSigDate', 370, y - 14, 100, fonts.regular, 10);

  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(FORMS_DIR, 'waiver-variant-a.pdf'), pdfBytes);
  console.log('Created: waiver-variant-a.pdf (Classic Underline)');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT B: Modern Clean
// ═══════════════════════════════════════════════════════════════════════════

async function buildWaiverB() {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 50;

  // Letterhead
  page.drawText('Covington & Burling LLP', { x: MARGIN, y, size: 16, font: fonts.bold, color: NAVY });
  y -= 20;
  page.drawText('850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com', {
    x: MARGIN, y, size: 9, font: fonts.helvetica, color: MUTED,
  });
  y -= 9;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 2, color: GOLD,
  });
  y -= 24;

  // Title
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: MARGIN, y, size: 14, font: fonts.bold, color: NAVY,
  });
  y -= 32;

  // Fields — boxed with light gray fill
  page.drawText('Client Name', { x: MARGIN, y, size: 9, font: fonts.helveticaBold, color: MUTED });
  y -= 10;
  addBoxedField(form, page, 'clientName', MARGIN, y - 18, PAGE_W - MARGIN * 2, 22, fonts.regular, 11);
  y -= 36;

  page.drawText('Date', { x: MARGIN, y, size: 9, font: fonts.helveticaBold, color: MUTED });
  y -= 10;
  addBoxedField(form, page, 'date', MARGIN, y - 18, 240, 22, fonts.regular, 11);
  y -= 36;

  page.drawText('Matter', { x: MARGIN, y, size: 9, font: fonts.helveticaBold, color: MUTED });
  y -= 10;
  addBoxedField(form, page, 'matter', MARGIN, y - 18, PAGE_W - MARGIN * 2, 22, fonts.regular, 11);
  y -= 40;

  // Section divider
  page.drawLine({
    start: { x: MARGIN + 20, y }, end: { x: PAGE_W - MARGIN - 20, y },
    thickness: 0.5, color: GOLD,
  });
  y -= 14;

  // Clauses with indent
  const result = drawClauses(page, fonts, waiverClauses, y, PAGE_W - MARGIN * 2 - 16, 16);

  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 50;
    const r2 = drawClauses(page, fonts, waiverClauses.slice(2), y, PAGE_W - MARGIN * 2 - 16, 16);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 14;
  if (y < 260) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 60; }

  // Signature blocks
  y = sigBlockB(form, page, MARGIN, y, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientSigDate', label: 'Date' },
  ]);

  y = sigBlockB(form, page, MARGIN + 270, y + 154, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmSigDate', label: 'Date' },
  ]);

  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(FORMS_DIR, 'waiver-variant-b.pdf'), pdfBytes);
  console.log('Created: waiver-variant-b.pdf (Modern Clean)');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT C: Bordered Traditional
// ═══════════════════════════════════════════════════════════════════════════

async function buildWaiverC(outputName) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62; // inside the frame

  // Centered letterhead
  y = letterheadStandard(page, fonts, y, 'center');
  y -= 24;

  // Title — centered
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('WAIVER AND RELEASE OF LIABILITY', 13) / 2,
    y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 20;

  // Gold separator
  page.drawLine({ start: { x: 120, y }, end: { x: PAGE_W - 120, y }, thickness: 0.5, color: GOLD });
  y -= 22;

  // Form fields — underline style, labeled
  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientName', MARGIN + 90, y - 14, 360, fonts.regular, 10);
  y -= 28;

  page.drawText('Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'date', MARGIN + 38, y - 14, 200, fonts.regular, 10);
  y -= 28;

  page.drawText('Matter:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'matter', MARGIN + 52, y - 14, 398, fonts.regular, 10);
  y -= 34;

  // Clauses with hanging indent
  const result = drawClauses(page, fonts, waiverClauses, y, PAGE_W - MARGIN * 2, 24);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawPageFrame(page);
    y = PAGE_H - 62;
    const r2 = drawClauses(page, fonts, waiverClauses.slice(2), y, PAGE_W - MARGIN * 2, 24);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 14;
  if (y < 280) { page = doc.addPage([PAGE_W, PAGE_H]); drawPageFrame(page); y = PAGE_H - 62; }

  // IN WITNESS WHEREOF
  page.drawText('IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.', {
    x: MARGIN + 8, y, size: 10, font: fonts.bold, color: BLACK,
  });
  y -= 28;

  // Side-by-side signatures
  y = sigBlockC(form, page, MARGIN + 8, y, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientSigDate', label: 'Date' },
  ]);

  sigBlockC(form, page, MARGIN + 310, y + 152, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmSigDate', label: 'Date' },
  ]);

  addPageNumber(page, fonts, 1, 1);

  const pdfBytes = await doc.save();
  const outName = outputName || 'waiver-variant-c.pdf';
  fs.writeFileSync(path.join(FORMS_DIR, outName), pdfBytes);
  console.log('Created: ' + outName + ' (Bordered Traditional)');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT D: Premium Corporate
// ═══════════════════════════════════════════════════════════════════════════

async function buildWaiverD() {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // Navy header band
  y = letterheadBand(page, fonts, y) - 14;

  // Title
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: MARGIN, y, size: 14, font: fonts.bold, color: NAVY,
  });
  y -= 10;
  // Gold underline for title
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 310, y }, thickness: 1.5, color: GOLD });
  y -= 18;

  // Watermark — large rotated text (simulated by drawing across page)
  const wmText = 'CONFIDENTIAL';
  const wmSize = 72;
  const wmW = fonts.bold.widthOfTextAtSize(wmText, wmSize);
  page.drawText(wmText, {
    x: PAGE_W / 2 - wmW / 2,
    y: PAGE_H / 2,
    size: wmSize,
    font: fonts.bold,
    color: WATERMARK_GRAY,
    // pdf-lib doesn't support rotation on drawText directly,
    // so we draw it horizontal but very faint as a background element
  });

  // Form fields — underline with light blue tint
  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  const cnField = form.createTextField('clientName');
  cnField.addToPage(page, {
    x: MARGIN + 88, y: y - 4, width: 400, height: 20,
    borderWidth: 0, backgroundColor: LIGHT_BLUE,
  });
  cnField.defaultUpdateAppearances(fonts.regular);
  page.drawLine({
    start: { x: MARGIN + 88, y: y }, end: { x: MARGIN + 488, y: y },
    thickness: 0.5, color: DARK_GRAY,
  });
  y -= 28;

  page.drawText('Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  const dField = form.createTextField('date');
  dField.addToPage(page, {
    x: MARGIN + 40, y: y - 4, width: 200, height: 20,
    borderWidth: 0, backgroundColor: LIGHT_BLUE,
  });
  dField.defaultUpdateAppearances(fonts.regular);
  page.drawLine({
    start: { x: MARGIN + 40, y: y }, end: { x: MARGIN + 240, y: y },
    thickness: 0.5, color: DARK_GRAY,
  });
  y -= 28;

  page.drawText('Matter:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  const mField = form.createTextField('matter');
  mField.addToPage(page, {
    x: MARGIN + 54, y: y - 4, width: 434, height: 20,
    borderWidth: 0, backgroundColor: LIGHT_BLUE,
  });
  mField.defaultUpdateAppearances(fonts.regular);
  page.drawLine({
    start: { x: MARGIN + 54, y: y }, end: { x: MARGIN + 488, y: y },
    thickness: 0.5, color: DARK_GRAY,
  });
  y -= 38;

  // Gold vertical bar + clauses
  const result = drawClauses(page, fonts, waiverClauses, y, PAGE_W - MARGIN * 2 - 24, 24);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = continuationHeader(page, fonts, PAGE_H);
    const r2 = drawClauses(page, fonts, waiverClauses.slice(2), y, PAGE_W - MARGIN * 2 - 24, 24);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 10;
  if (y < 280) { page = doc.addPage([PAGE_W, PAGE_H]); y = continuationHeader(page, fonts, PAGE_H); }

  // Premium signature blocks
  y = sigBlockD(form, page, MARGIN, y, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientSigDate', label: 'Date' },
  ]);

  sigBlockD(form, page, MARGIN + 272, y + 152, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmSigDate', label: 'Date' },
  ]);

  addPageNumber(page, fonts, 1, 1);

  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(FORMS_DIR, 'waiver-variant-d.pdf'), pdfBytes);
  console.log('Created: waiver-variant-d.pdf (Premium Corporate)');
}

// ═══════════════════════════════════════════════════════════════════════════
// NDA BUILDS (for final selection — same patterns as waiver)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT C NDA: Bordered Traditional
// ═══════════════════════════════════════════════════════════════════════════

async function buildNdaC(outputName) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let totalPages = 1;
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = letterheadStandard(page, fonts, y, 'center');
  y -= 24;

  // Title — centered
  page.drawText('MUTUAL NON-DISCLOSURE AGREEMENT', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('MUTUAL NON-DISCLOSURE AGREEMENT', 13) / 2,
    y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 20;

  // Gold separator
  page.drawLine({ start: { x: 120, y }, end: { x: PAGE_W - 120, y }, thickness: 0.5, color: GOLD });
  y -= 22;

  // Form fields — underline style
  page.drawText('Effective Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'effectiveDate', MARGIN + 100, y - 14, 200, fonts.regular, 10);
  y -= 30;

  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientName', MARGIN + 90, y - 14, 370, fonts.regular, 10);
  y -= 30;

  page.drawText('Client Address:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addUnderlineField(form, page, 'clientAddress', MARGIN + 100, y - 14, 360, fonts.regular, 10);
  y -= 38;

  // Intro paragraph
  const intro = 'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between Covington & Burling LLP, with offices at 850 Tenth Street NW, Washington, DC 20001 (the "Firm"), and the Client identified above (collectively, the "Parties").';
  y = drawWrapped(page, intro, MARGIN, y, fonts.regular, 10.5, BLACK, PAGE_W - MARGIN * 2);
  y -= 12;

  // Clauses with hanging indent
  const result = drawClauses(page, fonts, ndaClauses, y, PAGE_W - MARGIN * 2, 24);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    totalPages++;
    drawPageFrame(page);
    y = PAGE_H - 62;
    const r2 = drawClauses(page, fonts, ndaClauses.slice(2), y, PAGE_W - MARGIN * 2, 24);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 16;
  if (y < 300) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    totalPages++;
    drawPageFrame(page);
    y = PAGE_H - 62;
  }

  // IN WITNESS WHEREOF
  page.drawText('IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.', {
    x: MARGIN + 8, y, size: 10, font: fonts.bold, color: BLACK,
  });
  y -= 30;

  // Side-by-side signature blocks
  y = sigBlockC(form, page, MARGIN + 8, y, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmTitle', label: 'Title' },
    { name: 'firmDate', label: 'Date' },
  ]);

  sigBlockC(form, page, MARGIN + 310, y + 190, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientTitle', label: 'Title' },
    { name: 'clientDate', label: 'Date' },
  ]);

  addPageNumber(page, fonts, 1, totalPages);

  const pdfBytes = await doc.save();
  const outName = outputName || 'nda-fillable.pdf';
  fs.writeFileSync(path.join(FORMS_DIR, outName), pdfBytes);
  console.log('Created: ' + outName + ' (Bordered Traditional)');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT C DIGITAL: Bordered Traditional — Digital Fill Optimized
// Same layout as Variant C but with light-blue field tints for screen visibility.
// ═══════════════════════════════════════════════════════════════════════════

function sigBlockCDigital(form, page, x, y, fonts, label, fields) {
  page.drawText(label, { x, y, size: 10, font: fonts.bold, color: BLACK });
  let sy = y - 22;
  for (const f of fields) {
    if (f.label === 'Signature') {
      page.drawLine({
        start: { x, y: sy }, end: { x: x + 200, y: sy },
        thickness: 0.75, color: DARK_GRAY,
      });
      page.drawText('[SEAL]', { x: x + 185, y: sy, size: 6, font: fonts.regular, color: MUTED });
      addDigitalField(form, page, f.name, x, sy - 14, 200, fonts.regular, 10);
    } else {
      addDigitalField(form, page, f.name, x, sy, 200, fonts.regular, 10);
    }
    page.drawText(f.label, { x, y: sy - 10, size: 8, font: fonts.regular, color: MUTED });
    sy -= 38;
  }
  return sy - 8;
}

async function buildWaiverDigitalC(outputName) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = letterheadStandard(page, fonts, y, 'center');
  y -= 16;

  // Digital instruction badge
  page.drawRectangle({
    x: PAGE_W / 2 - 110, y: y - 22, width: 220, height: 20,
    borderWidth: 0.5, borderColor: GOLD, color: LIGHT_BLUE,
  });
  page.drawText('Fillable PDF — click any field to type', {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('Fillable PDF — click any field to type', 8.5) / 2,
    y: y - 18, size: 8.5, font: fonts.regular, color: NAVY,
  });
  y -= 38;

  // Title
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('WAIVER AND RELEASE OF LIABILITY', 13) / 2,
    y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 20;
  page.drawLine({ start: { x: 120, y }, end: { x: PAGE_W - 120, y }, thickness: 0.5, color: GOLD });
  y -= 22;

  // Form fields — digital style with light blue tint
  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'clientName', MARGIN + 90, y - 14, 370, fonts.regular, 10);
  y -= 30;

  page.drawText('Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'date', MARGIN + 38, y - 14, 200, fonts.regular, 10);
  y -= 30;

  page.drawText('Matter:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'matter', MARGIN + 52, y - 14, 408, fonts.regular, 10);
  y -= 38;

  const result = drawClauses(page, fonts, waiverClauses, y, PAGE_W - MARGIN * 2, 24);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawPageFrame(page);
    y = PAGE_H - 62;
    const r2 = drawClauses(page, fonts, waiverClauses.slice(2), y, PAGE_W - MARGIN * 2, 24);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 14;
  if (y < 280) { page = doc.addPage([PAGE_W, PAGE_H]); drawPageFrame(page); y = PAGE_H - 62; }

  page.drawText('IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.', {
    x: MARGIN + 8, y, size: 10, font: fonts.bold, color: BLACK,
  });
  y -= 30;

  y = sigBlockCDigital(form, page, MARGIN + 8, y, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientSigDate', label: 'Date' },
  ]);

  sigBlockCDigital(form, page, MARGIN + 310, y + 152, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmSigDate', label: 'Date' },
  ]);

  addPageNumber(page, fonts, 1, 1);

  const pdfBytes = await doc.save();
  const outName = outputName || 'waiver-digital.pdf';
  fs.writeFileSync(path.join(FORMS_DIR, outName), pdfBytes);
  console.log('Created: ' + outName + ' (Digital Fill)');
}

async function buildNdaDigitalC(outputName) {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const form = doc.getForm();

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let totalPages = 1;
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = letterheadStandard(page, fonts, y, 'center');
  y -= 16;

  // Digital instruction badge
  page.drawRectangle({
    x: PAGE_W / 2 - 110, y: y - 22, width: 220, height: 20,
    borderWidth: 0.5, borderColor: GOLD, color: LIGHT_BLUE,
  });
  page.drawText('Fillable PDF — click any field to type', {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('Fillable PDF — click any field to type', 8.5) / 2,
    y: y - 18, size: 8.5, font: fonts.regular, color: NAVY,
  });
  y -= 38;

  // Title
  page.drawText('MUTUAL NON-DISCLOSURE AGREEMENT', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('MUTUAL NON-DISCLOSURE AGREEMENT', 13) / 2,
    y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 20;
  page.drawLine({ start: { x: 120, y }, end: { x: PAGE_W - 120, y }, thickness: 0.5, color: GOLD });
  y -= 22;

  // Form fields — digital style
  page.drawText('Effective Date:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'effectiveDate', MARGIN + 100, y - 14, 200, fonts.regular, 10);
  y -= 30;

  page.drawText('Client Name:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'clientName', MARGIN + 90, y - 14, 370, fonts.regular, 10);
  y -= 30;

  page.drawText('Client Address:', { x: MARGIN, y, size: 11, font: fonts.bold, color: BLACK });
  addDigitalField(form, page, 'clientAddress', MARGIN + 100, y - 14, 360, fonts.regular, 10);
  y -= 38;

  // Intro paragraph
  const intro = 'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between Covington & Burling LLP, with offices at 850 Tenth Street NW, Washington, DC 20001 (the "Firm"), and the Client identified above (collectively, the "Parties").';
  y = drawWrapped(page, intro, MARGIN, y, fonts.regular, 10.5, BLACK, PAGE_W - MARGIN * 2);
  y -= 12;

  const result = drawClauses(page, fonts, ndaClauses, y, PAGE_W - MARGIN * 2, 24);
  if (result.needsPage) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    totalPages++;
    drawPageFrame(page);
    y = PAGE_H - 62;
    const r2 = drawClauses(page, fonts, ndaClauses.slice(2), y, PAGE_W - MARGIN * 2, 24);
    y = r2.lastY;
  } else {
    y = result.lastY;
  }

  y -= 16;
  if (y < 300) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    totalPages++;
    drawPageFrame(page);
    y = PAGE_H - 62;
  }

  page.drawText('IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.', {
    x: MARGIN + 8, y, size: 10, font: fonts.bold, color: BLACK,
  });
  y -= 30;

  y = sigBlockCDigital(form, page, MARGIN + 8, y, fonts, 'For Covington & Burling LLP', [
    { name: 'firmSignature', label: 'Signature' },
    { name: 'firmPrintName', label: 'Print Name' },
    { name: 'firmTitle', label: 'Title' },
    { name: 'firmDate', label: 'Date' },
  ]);

  sigBlockCDigital(form, page, MARGIN + 310, y + 190, fonts, 'Client', [
    { name: 'clientSignature', label: 'Signature' },
    { name: 'clientPrintName', label: 'Print Name' },
    { name: 'clientTitle', label: 'Title' },
    { name: 'clientDate', label: 'Date' },
  ]);

  addPageNumber(page, fonts, 1, totalPages);

  const pdfBytes = await doc.save();
  const outName = outputName || 'nda-digital.pdf';
  fs.writeFileSync(path.join(FORMS_DIR, outName), pdfBytes);
  console.log('Created: ' + outName + ' (Digital Fill)');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  fs.mkdirSync(FORMS_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const isFinal = args.includes('--final');
  const finalIdx = args.indexOf('--final');
  const variant = args.includes('--variant')
    ? args[args.indexOf('--variant') + 1]
    : (isFinal && args[finalIdx + 1] ? args[finalIdx + 1] : null);

  if (isFinal && variant) {
    // Finalize a specific variant for both forms
    console.log(`Finalizing variant ${variant} for both forms...`);
    // Regenerate the selected variant as the main fillable PDFs
    switch (variant) {
      case 'c':
        await buildWaiverDigitalC('waiver-digital.pdf');
        await buildWaiverC('waiver-print.pdf');
        await buildNdaDigitalC('nda-digital.pdf');
        await buildNdaC('nda-print.pdf');
        break;
      default: console.error('Unknown variant. Use --final c'); process.exit(1);
    }
    console.log('Done — fillable PDFs generated in public/forms/');
    return;
  }

  // Default: generate all 4 waiver variants for review
  console.log('Generating 4 waiver variants for review...\n');
  await buildWaiverA();
  await buildWaiverB();
  await buildWaiverC();
  await buildWaiverD();
  console.log('\nDone — 4 variants in public/forms/');
  console.log('Open them in Preview to compare, then select your preferred variant.');
}

main().catch(err => { console.error(err); process.exit(1); });
