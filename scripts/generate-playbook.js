/**
 * Carlington & Burling LLP — Admin Document Builder Playbook
 *
 * Generates the internal playbook PDF. The design matches the site's
 * editorial visual system: navy + burgundy + gold + cream palette,
 * Cormorant Garamond + Montserrat typography, centered letterhead
 * with gold rules, and editorial numerals — no heavy decorative borders.
 *
 * Usage:
 *   node scripts/generate-playbook.js
 *
 * Output:
 *   public/forms/carlington-admin-playbook.pdf
 */
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'public', 'fonts');
const FORMS_DIR = path.join(ROOT, 'public', 'forms');
const OUT_FILE = path.join(FORMS_DIR, 'carlington-admin-playbook.pdf');

// ── Design Constants ────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;

// Brand palette — matches public/css/styles.css :root tokens
const NAVY      = rgb(0.039, 0.086, 0.157); // #0A1628
const NAVY_SOFT = rgb(0.078, 0.137, 0.251); // #142340
const BURGUNDY  = rgb(0.420, 0.110, 0.180); // #6B1C2E
const GOLD      = rgb(0.690, 0.553, 0.341); // #B08D57
const GOLD_LT   = rgb(0.788, 0.651, 0.420); // #C9A66B
const INK       = rgb(0.122, 0.122, 0.180); // #1F1F2E
const SLATE     = rgb(0.353, 0.353, 0.431); // #5A5A6E
const MUTED     = rgb(0.541, 0.541, 0.557); // #8A8A9E
const RULE      = rgb(0.851, 0.835, 0.800); // #D9D5CC (subtle separator)
const WHITE     = rgb(1, 1, 1);

// Letterhead constants — mirror carlington-template.js
const FIRM = 'Carlington & Burling';
const TAGLINE = 'LLP  ·  ATTORNEYS AT LAW  ·  SINCE 1919';
const CONTACT_PRE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  ';
const CONTACT_DOMAIN = 'carlingtonburling.com';

// ── Font Loading ────────────────────────────────────────────────────────

async function loadFonts(doc) {
  doc.registerFontkit(fontkit);
  var read = function (p) { return fs.readFileSync(path.join(FONTS_DIR, p)); };
  return {
    serif:     await doc.embedFont(read('cormorant-garamond-latin-400-normal.ttf')),
    serifBold: await doc.embedFont(read('cormorant-garamond-latin-600-normal.ttf')),
    sans:      await doc.embedFont(read('montserrat-latin-400-normal.ttf')),
    sansMed:   await doc.embedFont(read('montserrat-latin-500-normal.ttf')),
  };
}

// ── Text helpers ────────────────────────────────────────────────────────

// noLig: identity. The Latin subset fonts don't include U+200C so we can't
// insert ZWNJ — it renders as a visible space. Instead, splitText() chunks
// strings on ligature boundaries and drawTextSafe draws each chunk via a
// separate drawText call, which prevents GSUB substitution.
function noLig(s) { return s; }

// Split a string at positions between 'f' and a following f/i/l (Montserrat
// standard ligatures) or between 'q' and 'u' (Cormorant Garamond discretionary
// ligature). No chunk contains a ligature-eligible pair.
function splitForLig(s) {
  if (typeof s !== 'string') return [s];
  return s.split(/(?<=f)(?=[fil])|(?<=q)(?=u)/g);
}

// Drop-in replacement for page.drawText that avoids broken ligature glyphs
// by drawing each chunk separately. Computes x advance using actual chunk widths.
function safeDrawText(page, text, opts) {
  if (typeof text !== 'string') text = String(text);
  const chunks = splitForLig(text);
  if (chunks.length <= 1) {
    page.drawText(text, opts);
    return;
  }
  let cx = opts.x;
  for (const chunk of chunks) {
    if (!chunk) continue;
    page.drawText(chunk, Object.assign({}, opts, { x: cx }));
    cx += opts.font.widthOfTextAtSize(chunk, opts.size);
  }
}

// Width of a string, computed as sum of chunk widths (which equals the
// natural pre-ligature width since chunks contain no ligature opportunities).
function safeTextWidth(font, text, size) {
  if (typeof text !== 'string') text = String(text);
  const chunks = splitForLig(text);
  let total = 0;
  for (const chunk of chunks) total += font.widthOfTextAtSize(chunk, size);
  return total;
}

function drawWrapped(page, text, x, y, font, size, color, maxWidth, lineHeight) {
  const paragraphs = String(text).split('\n');
  const lh = lineHeight || size * 1.55;
  let lineY = y;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const words = paragraphs[pi].split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (safeTextWidth(font, test, size) < maxWidth && line !== '') {
        line = test;
      } else {
        if (line) {
          safeDrawText(page, line, { x, y: lineY, size, font, color });
          lineY -= lh;
        }
        line = word;
      }
    }
    if (line) {
      safeDrawText(page, line, { x, y: lineY, size, font, color });
      lineY -= lh;
    }
    if (pi < paragraphs.length - 1) lineY -= lh * 0.25;
  }
  return lineY;
}

function drawBullets(page, items, x, y, fonts, size, color, maxWidth) {
  const lh = size * 1.55;
  let cy = y;
  for (const item of items) {
    // Gold middot bullet
    page.drawText('·', { x, y: cy, size: size * 1.4, font: fonts.serifBold, color: GOLD });
    cy = drawWrapped(page, item, x + 12, cy, fonts.sans, size, color, maxWidth - 12, lh);
  }
  return cy;
}

// Wrapper for direct page.drawText that also strips ligatures and recomputes width
function drawSingleLine(page, text, x, y, font, size, color) {
  page.drawText(noLig(text), { x, y, size, font, color });
}
function textWidth(font, text, size) {
  return font.widthOfTextAtSize(noLig(text), size);
}

// ── Letterhead (mirrors carlington-template.js drawHeader) ──────────────

function drawLetterhead(page, fonts) {
  const centerX = PAGE_W / 2;

  // Firm name — Cormorant Bold, navy with gold ampersand
  const wmSize = 22;
  const cText = 'Carlington ';
  const ampText = '&';
  const bText = ' Burling';
  const fullW = fonts.serifBold.widthOfTextAtSize(cText + ampText + bText, wmSize);
  const textY = PAGE_H - MARGIN + 14;
  let x = centerX - fullW / 2;

  page.drawText(cText, { x, y: textY, size: wmSize, font: fonts.serifBold, color: NAVY });
  x += fonts.serifBold.widthOfTextAtSize(cText, wmSize);
  page.drawText(ampText, { x, y: textY, size: wmSize, font: fonts.serifBold, color: GOLD });
  x += fonts.serifBold.widthOfTextAtSize(ampText, wmSize);
  page.drawText(bText, { x, y: textY, size: wmSize, font: fonts.serifBold, color: NAVY });

  // Full-width gold rule
  const ruleY = textY - 22;
  page.drawLine({ start: { x: 0, y: ruleY }, end: { x: PAGE_W, y: ruleY }, thickness: 1, color: GOLD });

  // Tagline — Montserrat slate
  const tagSize = 8.5;
  const tagW = fonts.sans.widthOfTextAtSize(TAGLINE, tagSize);
  const tagY = ruleY - 16;
  page.drawText(TAGLINE, { x: centerX - tagW / 2, y: tagY, size: tagSize, font: fonts.sans, color: SLATE });

  // Contact line — slate with gold domain
  const contactSize = 7.5;
  const contactFull = CONTACT_PRE + CONTACT_DOMAIN;
  const contactW = fonts.sans.widthOfTextAtSize(contactFull, contactSize);
  const contactY = tagY - 14;
  const preW = fonts.sans.widthOfTextAtSize(CONTACT_PRE, contactSize);
  page.drawText(CONTACT_PRE, { x: centerX - contactW / 2, y: contactY, size: contactSize, font: fonts.sans, color: SLATE });
  page.drawText(CONTACT_DOMAIN, { x: centerX - contactW / 2 + preW, y: contactY, size: contactSize, font: fonts.sansMed, color: GOLD });

  // Subtle separator rule
  const sepY = contactY - 18;
  page.drawLine({ start: { x: 0, y: sepY }, end: { x: PAGE_W, y: sepY }, thickness: 0.5, color: RULE });

  return sepY - 28;
}

// ── Footer (page number, editorial style) ───────────────────────────────

function drawFooter(page, fonts, pageNum, totalPages) {
  // Thin gold rule above footer
  page.drawLine({
    start: { x: MARGIN, y: 48 },
    end: { x: PAGE_W - MARGIN, y: 48 },
    thickness: 0.5, color: GOLD,
  });

  // Page number: "01 · 18" centered in serif gold
  const numStr = String(pageNum).padStart(2, '0') + '  ·  ' + String(totalPages).padStart(2, '0');
  const numSize = 9;
  const numW = fonts.serif.widthOfTextAtSize(numStr, numSize);
  page.drawText(numStr, {
    x: PAGE_W / 2 - numW / 2, y: 30,
    size: numSize, font: fonts.serif, color: GOLD,
  });
}

// ── Section title (eyebrow + serif) ─────────────────────────────────────

function drawSectionTitle(page, fonts, eyebrow, title, y) {
  // Eyebrow — small caps Montserrat in burgundy
  const eyebrowSize = 8.5;
  const ebW = fonts.sansMed.widthOfTextAtSize(eyebrow, eyebrowSize);
  page.drawText(eyebrow, {
    x: PAGE_W / 2 - ebW / 2,
    y, size: eyebrowSize, font: fonts.sansMed, color: BURGUNDY,
  });
  y -= 18;

  // Title — Cormorant Bold navy, large
  const titleSize = 26;
  const titleW = fonts.serifBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: PAGE_W / 2 - titleW / 2,
    y, size: titleSize, font: fonts.serifBold, color: NAVY,
  });
  y -= 14;

  // Short centered gold rule
  page.drawLine({
    start: { x: PAGE_W / 2 - 22, y },
    end: { x: PAGE_W / 2 + 22, y },
    thickness: 1, color: GOLD,
  });
  return y - 28;
}

function drawSubHeading(page, fonts, text, y) {
  safeDrawText(page, text, {
    x: MARGIN, y, size: 14, font: fonts.serifBold, color: NAVY,
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 },
    end: { x: MARGIN + 28, y: y - 5 },
    thickness: 1, color: GOLD,
  });
  return y - 22;
}

function drawSubSubHeading(page, fonts, text, y) {
  safeDrawText(page, text, {
    x: MARGIN, y, size: 11, font: fonts.sansMed, color: NAVY,
  });
  return y - 16;
}

function drawBody(page, fonts, text, y) {
  return drawWrapped(page, text, MARGIN, y, fonts.sans, 10, INK, PAGE_W - MARGIN * 2, 15.5);
}

// Editorial numbered item: "01" gold serif + serif title + sans body
function drawNumberedItem(page, fonts, n, title, body, y) {
  const numStr = String(n).padStart(2, '0');
  const numSize = 22;
  const titleSize = 12;
  const bodySize = 10;

  // Gold serif numeral
  page.drawText(numStr, {
    x: MARGIN, y, size: numSize, font: fonts.serif, color: GOLD,
  });
  const numW = fonts.serif.widthOfTextAtSize(numStr, numSize);
  const textX = MARGIN + numW + 14;
  const textMaxW = PAGE_W - MARGIN - textX;

  // Title
  safeDrawText(page, title, {
    x: textX, y: y + 4,
    size: titleSize, font: fonts.sansMed, color: NAVY,
  });

  // Body
  let by = y - 14;
  by = drawWrapped(page, body, textX, by, fonts.sans, bodySize, SLATE, textMaxW, bodySize * 1.55);
  return by - 8;
}

// ── Cover Page ─────────────────────────────────────────────────────────

function drawCoverPage(doc, fonts) {
  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Top accent: thick navy band + thin gold underline
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: NAVY });
  page.drawLine({
    start: { x: 0, y: PAGE_H - 11 },
    end: { x: PAGE_W, y: PAGE_H - 11 },
    thickness: 1, color: GOLD,
  });

  // Bottom accent (mirror)
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 6, color: NAVY });
  page.drawLine({
    start: { x: 0, y: 11 },
    end: { x: PAGE_W, y: 11 },
    thickness: 1, color: GOLD,
  });

  const centerX = PAGE_W / 2;

  // Monogram (CB inside double circle, matches site logo)
  const monoY = PAGE_H * 0.66;
  const outerR = 42;
  const innerR = 36;
  page.drawCircle({ x: centerX, y: monoY, size: outerR, borderWidth: 1.2, borderColor: NAVY, color: WHITE });
  page.drawCircle({ x: centerX, y: monoY, size: innerR, borderWidth: 2, borderColor: GOLD, color: WHITE });

  // CB letters — C navy + B gold
  const cbSize = 38;
  const cW = fonts.serifBold.widthOfTextAtSize('C', cbSize);
  const bW = fonts.serifBold.widthOfTextAtSize('B', cbSize);
  const cbTotal = cW + bW;
  const cbBaseY = monoY - cbSize / 3;
  let mx = centerX - cbTotal / 2;
  page.drawText('C', { x: mx, y: cbBaseY, size: cbSize, font: fonts.serifBold, color: NAVY });
  mx += cW;
  page.drawText('B', { x: mx, y: cbBaseY, size: cbSize, font: fonts.serifBold, color: GOLD });

  // Firm name
  let y = monoY - outerR - 40;
  const firmSize = 30;
  const cText = 'Carlington ';
  const ampText = '&';
  const bText = ' Burling LLP';
  const firmFullW = fonts.serifBold.widthOfTextAtSize(cText + ampText + bText, firmSize);
  let fx = centerX - firmFullW / 2;
  page.drawText(cText, { x: fx, y, size: firmSize, font: fonts.serifBold, color: NAVY });
  fx += fonts.serifBold.widthOfTextAtSize(cText, firmSize);
  page.drawText(ampText, { x: fx, y, size: firmSize, font: fonts.serifBold, color: GOLD });
  fx += fonts.serifBold.widthOfTextAtSize(ampText, firmSize);
  page.drawText(bText, { x: fx, y, size: firmSize, font: fonts.serifBold, color: NAVY });
  y -= 18;

  // Gold rule (short, centered)
  page.drawLine({
    start: { x: centerX - 38, y },
    end: { x: centerX + 38, y },
    thickness: 1, color: GOLD,
  });
  y -= 24;

  // Eyebrow
  const eyebrow = 'ADMIN  ·  DOCUMENT  BUILDER';
  const eyebrowSize = 9.5;
  const ebW = fonts.sansMed.widthOfTextAtSize(eyebrow, eyebrowSize);
  page.drawText(eyebrow, { x: centerX - ebW / 2, y, size: eyebrowSize, font: fonts.sansMed, color: BURGUNDY });
  y -= 50;

  // "Playbook" in large Cormorant
  const playbook = 'Playbook';
  const playbookSize = 64;
  const pbW = fonts.serif.widthOfTextAtSize(playbook, playbookSize);
  page.drawText(playbook, { x: centerX - pbW / 2, y, size: playbookSize, font: fonts.serif, color: NAVY });

  // Description (two lines, slate Montserrat)
  y -= 56;
  const desc1 = 'A guide to building official firm documents';
  const desc2 = 'with the Carlington & Burling Document Builder.';
  const descSize = 11;
  const d1W = safeTextWidth(fonts.sans, desc1, descSize);
  safeDrawText(page, desc1, { x: centerX - d1W / 2, y, size: descSize, font: fonts.sans, color: SLATE });
  y -= 17;
  const d2W = safeTextWidth(fonts.sans, desc2, descSize);
  safeDrawText(page, desc2, { x: centerX - d2W / 2, y, size: descSize, font: fonts.sans, color: SLATE });

  // Bottom metadata
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const versionStr = 'Version 2.0  ·  ' + today;
  const versionSize = 9;
  const vW = fonts.sansMed.widthOfTextAtSize(versionStr, versionSize);
  page.drawText(versionStr, { x: centerX - vW / 2, y: 92, size: versionSize, font: fonts.sansMed, color: SLATE });

  // Gold accent line under version
  page.drawLine({
    start: { x: centerX - 18, y: 80 },
    end: { x: centerX + 18, y: 80 },
    thickness: 0.5, color: GOLD,
  });

  // CONFIDENTIAL line in burgundy
  const conf = 'CONFIDENTIAL  ·  INTERNAL USE';
  const confSize = 8;
  const cnW = fonts.sansMed.widthOfTextAtSize(conf, confSize);
  page.drawText(conf, { x: centerX - cnW / 2, y: 66, size: confSize, font: fonts.sansMed, color: BURGUNDY });

  // © line
  const year = new Date().getFullYear();
  const copy = '© ' + year + ' Carlington & Burling LLP. All rights reserved.';
  const copySize = 7.5;
  const cpW = fonts.sans.widthOfTextAtSize(copy, copySize);
  page.drawText(copy, { x: centerX - cpW / 2, y: 50, size: copySize, font: fonts.sans, color: MUTED });
}

// ── Table of Contents ─────────────────────────────────────────────────

function drawTOC(doc, fonts, items, totalPages) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'CONTENTS', 'Table of Contents', y);

  for (const item of items) {
    // Roman numeral in Cormorant gold
    const romanSize = 16;
    page.drawText(item.num, {
      x: MARGIN, y, size: romanSize, font: fonts.serif, color: GOLD,
    });

    // Title in Montserrat 500 navy
    const titleSize = 11.5;
    page.drawText(item.title, {
      x: MARGIN + 44, y: y + 2,
      size: titleSize, font: fonts.sansMed, color: NAVY,
    });

    // Page number right-aligned, Cormorant gold
    const pageStr = String(item.page).padStart(2, '0');
    const pageW = fonts.serif.widthOfTextAtSize(pageStr, romanSize);
    page.drawText(pageStr, {
      x: PAGE_W - MARGIN - pageW, y,
      size: romanSize, font: fonts.serif, color: GOLD,
    });

    // Thin gold dotted-style rule between item and page number
    const titleW = fonts.sansMed.widthOfTextAtSize(item.title, titleSize);
    const ruleStartX = MARGIN + 44 + titleW + 10;
    const ruleEndX = PAGE_W - MARGIN - pageW - 10;
    if (ruleEndX > ruleStartX) {
      page.drawLine({
        start: { x: ruleStartX, y: y + 4 },
        end: { x: ruleEndX, y: y + 4 },
        thickness: 0.5, color: RULE,
      });
    }
    y -= 36;
  }

  drawFooter(page, fonts, 2, totalPages);
  return page;
}

// ── Section I: Introduction & Access ──────────────────────────────────

function drawSectionI(doc, fonts, pageNum, totalPages) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'SECTION  I', 'Introduction & Access', y);

  y = drawBody(page, fonts,
    'This playbook documents the Carlington & Burling LLP Admin Document Builder. It enables authorized firm personnel to generate professional, fillable PDF documents in the official firm template style — centered Cormorant Garamond letterhead with gold accent rules and AcroForm fillable fields for client-facing use.',
    y);
  y -= 12;

  y = drawSubHeading(page, fonts, 'Accessing the Admin', y);
  y -= 2;
  y = drawNumberedItem(page, fonts, 1, 'Open the admin portal',
    'Navigate to carlingtonburling.com/admin in a modern browser (Chrome, Safari, or Firefox). The login screen loads in the cream brand background.', y);
  y = drawNumberedItem(page, fonts, 2, 'Authenticate',
    'Enter the admin password at the prompt. Default access key: covbur1919. Authentication uses a JWT bearer token stored in sessionStorage for the duration of the browser tab.', y);
  y = drawNumberedItem(page, fonts, 3, 'Land on the dashboard',
    'On success, the dashboard shell loads with Document Builder, Requests, Email Templates, and Analytics tabs. Session persists across page reloads in the same tab. Closing the tab clears the token.', y);
  y = drawNumberedItem(page, fonts, 4, 'Rotate the password',
    'The password is set via the PASSWORD environment variable in Vercel. To rotate: update PASSWORD in the Vercel dashboard under Settings, then Environment Variables, and redeploy.', y);
  y -= 6;

  y = drawSubHeading(page, fonts, 'Interface Overview', y);
  y = drawBody(page, fonts,
    'The Document Builder uses a two-pane layout. The left sidebar (~380px) holds all document configuration: preset selector, title input, form fields, clauses, and signature blocks. The main area shows a live preview summary plus Generate PDF and Download buttons. A status indicator surfaces the current PDF generation state.',
    y);
  y -= 12;

  y = drawSubHeading(page, fonts, 'Security Notes', y);
  y = drawBody(page, fonts,
    'PDF generation runs entirely in the browser. No document body or field data is transmitted to any server. The Express API at /api/admin only handles authentication and request-list metadata. For added defense, deploy the admin route behind your firm SSO or VPN — the current password gate is intended as a single layer, not a complete security model.',
    y);

  drawFooter(page, fonts, pageNum, totalPages);
  return page;
}

// ── Section II: Step-by-Step ──────────────────────────────────────────

function drawSectionII(doc, fonts, startPage, totalPages) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'SECTION  II', 'Generating a Document', y);

  const steps = [
    { title: 'Load a preset or start fresh',
      body: 'Use the Load Preset dropdown at the top of the sidebar to select a starting template (Waiver and Release, Mutual NDA, or Blank). Selecting a preset populates fields, clauses, and signature blocks automatically. Choose Custom to build from scratch.' },
    { title: 'Configure document metadata',
      body: 'Enter the document title (e.g. ENGAGEMENT LETTER), output filename, and optionally customize the witness preamble. The default witness preamble reads: "IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above."' },
    { title: 'Add form fields',
      body: 'Form fields create fillable blanks in the generated PDF. Each has a label (visible text, e.g. "Client Name:") and a name (internal AcroForm identifier). Click + Add Field to add a row, × to remove. Field width defaults to 370 points and is customizable per field.' },
    { title: 'Compose clauses',
      body: 'Clauses are the substantive provisions. Each has a number, title (e.g. "Governing Law."), and body. Click + Add Clause to add. Body text wraps; if a page overflows, a new page is created automatically with the letterhead reprinted.' },
    { title: 'Configure signature blocks',
      body: 'Up to two signature blocks render side-by-side. Each has a label and a list of fields. The Signature type renders as a signature line with the [SEAL] notation. Add Print Name, Title, or Date fields beneath as needed.' },
    { title: 'Generate the PDF',
      body: 'Click Generate PDF in the toolbar. The browser builds the PDF synchronously via pdf-lib. A green status pill confirms success. The PDF downloads automatically with the filename you set in step two.' },
    { title: 'Distribute the document',
      body: 'Email the PDF to the client or upload to your document management system. Clients can fill the AcroForm fields in Acrobat or Preview, or print and complete by hand.' },
  ];

  let n = 1;
  for (const step of steps) {
    if (y < 160) {
      drawFooter(page, fonts, startPage, totalPages);
      startPage++;
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = drawLetterhead(page, fonts);
      y = drawSectionTitle(page, fonts, 'SECTION  II  (CONTINUED)', 'Generating a Document', y);
    }
    y = drawNumberedItem(page, fonts, n, step.title, step.body, y);
    n++;
  }

  drawFooter(page, fonts, startPage, totalPages);
  return startPage + 1;
}

// ── Practice area document types ──────────────────────────────────────

const practiceAreas = [
  {
    name: 'Antitrust & Competition',
    desc: 'Complex merger reviews, civil and criminal cartel investigations, and competition litigation across jurisdictions worldwide.',
    documents: [
      { type: 'Engagement Letter — Antitrust',
        desc: 'Standard engagement letter for antitrust matters. Includes scope, fee structure, conflict waiver, and lead-partner contact.',
        fields: ['Client Name', 'Date', 'Matter Description', 'Billing Rate', 'Lead Partner'],
        clauses: ['Scope of Representation', 'Fee and Billing Terms', 'Conflict Waiver', 'Termination', 'Governing Law'] },
      { type: 'Joint Defense Agreement',
        desc: 'For multi-party antitrust investigations. Governs sharing of privileged information among co-defendants. Includes common-interest doctrine language and withdrawal provisions.',
        fields: ['Effective Date', 'Party A', 'Party B', 'Matter/Case No.', 'Lead Counsel'],
        clauses: ['Common Interest Privilege', 'Confidentiality of Shared Materials', 'No Waiver of Privilege', 'Withdrawal Procedure', 'Governing Law'] },
      { type: 'Document Preservation Notice',
        desc: 'Issued to clients upon receipt of a subpoena or CID. Instructs on preservation obligations for ESI and physical documents. Includes litigation-hold language.',
        fields: ['Date Issued', 'Client Name', 'Matter/Case No.', 'Response Deadline', 'Issuing Authority'],
        clauses: ['Preservation Obligations', 'Scope of ESI to Preserve', 'Consequences of Spoliation', 'Point of Contact', 'Acknowledgment of Receipt'] },
    ],
  },
  {
    name: 'Litigation',
    desc: 'Bet-the-company trials, appeals, and arbitrations across commercial, securities, and constitutional disputes.',
    documents: [
      { type: 'Engagement Letter — Litigation',
        desc: 'Comprehensive engagement letter including detailed scope, budget estimate, discovery obligations, and alternative fee arrangements.',
        fields: ['Client Name', 'Date', 'Case Caption', 'Court/Venue', 'Fee Arrangement', 'Initial Retainer'],
        clauses: ['Scope of Representation', 'Fee and Expense Terms', 'Client Cooperation', 'Discovery Responsibilities', 'Settlement Authority', 'Withdrawal', 'Governing Law'] },
      { type: 'Settlement Agreement',
        desc: 'Full settlement and release for resolved litigation. Includes mutual releases, payment terms, dismissal with prejudice, confidentiality, and non-disparagement.',
        fields: ['Effective Date', 'Plaintiff', 'Defendant', 'Case No.', 'Settlement Amount', 'Payment Deadline'],
        clauses: ['Recitals', 'Payment Terms', 'Mutual Release', 'Dismissal with Prejudice', 'Confidentiality', 'Non-Disparagement', 'No Admission of Liability', 'Entire Agreement', 'Governing Law'] },
      { type: 'Protective Order Stipulation',
        desc: 'Joint stipulation for a protective order governing confidential discovery. Includes tiers of confidentiality, clawback provisions, and procedures for challenging designations.',
        fields: ['Court', 'Case No.', 'Case Caption', 'Date of Stipulation'],
        clauses: ['Definitions', 'Designation of Confidential Material', 'Attorneys\' Eyes Only Tier', 'Use of Protected Material', 'Clawback Procedure', 'Challenging Designations', 'Return at Conclusion'] },
    ],
  },
  {
    name: 'Intellectual Property',
    desc: 'Patent, trademark, copyright, and trade secret litigation, plus strategic counseling and portfolio management.',
    documents: [
      { type: 'IP Engagement Letter',
        desc: 'For IP prosecution or litigation. Specifies the IP asset (patent no., trademark reg., etc.), scope of services, and USPTO or court fees.',
        fields: ['Client Name', 'Date', 'IP Asset', 'Registration/Patent No.', 'Fee Arrangement'],
        clauses: ['Scope of IP Services', 'USPTO/Court Fees', 'Client Cooperation', 'File Retention', 'Termination', 'Governing Law'] },
      { type: 'Confidentiality & IP Assignment',
        desc: 'Employee or contractor agreement assigning IP to the company. Includes invention disclosure procedures, moral rights waiver, and power of attorney.',
        fields: ['Effective Date', 'Employee/Contractor', 'Company', 'State'],
        clauses: ['Definitions of IP', 'Assignment of Inventions', 'Disclosure Obligations', 'Moral Rights Waiver', 'Power of Attorney', 'Return of Company Property', 'Survival', 'Governing Law'] },
      { type: 'Trademark License Agreement',
        desc: 'License agreement for trademark use. Specifies quality control, territorial scope, royalty structure, and termination rights.',
        fields: ['Effective Date', 'Licensor', 'Licensee', 'Mark', 'Territory', 'Royalty Rate'],
        clauses: ['Grant of License', 'Quality Control Standards', 'Royalty and Reporting', 'Term and Renewal', 'Infringement Enforcement', 'Indemnification', 'Termination', 'Governing Law'] },
    ],
  },
  {
    name: 'Corporate',
    desc: 'M&A, capital markets, governance, and complex commercial transactions for Fortune 500 and emerging enterprises.',
    documents: [
      { type: 'Corporate Engagement Letter',
        desc: 'For transactional matters. Includes deal structure overview, fee arrangements (including success fees), and team composition.',
        fields: ['Client Name', 'Date', 'Transaction', 'Fee Structure', 'Lead Partner'],
        clauses: ['Scope of Engagement', 'Fee and Expense Terms', 'Team Composition', 'Third-Party Costs', 'Conflicts Waiver', 'Termination', 'Governing Law'] },
      { type: 'M&A Due Diligence Request List',
        desc: 'Comprehensive DD request list. Categories: corporate organization, financial, tax, IP, employment, litigation, regulatory.',
        fields: ['Target Company', 'Date Issued', 'Response Deadline', 'Deal Code Name'],
        clauses: ['Corporate Organization & Records', 'Financial & Tax', 'Intellectual Property', 'Employment & Benefits', 'Litigation & Regulatory', 'Material Contracts', 'Environmental', 'Insurance'] },
      { type: 'Board Resolution',
        desc: 'Formal board resolution approving a corporate action. Includes recitals, resolutions, and authorization language.',
        fields: ['Company', 'Date of Meeting', 'Resolution Title', 'Members Present'],
        clauses: ['Recitals', 'Resolutions', 'Authorization', 'Certification', 'Effective Date'] },
    ],
  },
  {
    name: 'White Collar Defense & Investigations',
    desc: 'Government investigations, enforcement actions, and criminal proceedings — FCPA, fraud, and sanctions matters.',
    documents: [
      { type: 'Engagement Letter — Investigation',
        desc: 'For internal or government-facing investigations. Includes scope, Upjohn warning language (corporate clients), privilege, and interview protocols.',
        fields: ['Client Name', 'Date', 'Investigation', 'Agency', 'Fee Arrangement'],
        clauses: ['Scope of Investigation', 'Privilege and Upjohn Warning', 'Interview Protocols', 'Document Collection & Review', 'Reporting Obligations', 'Joint Defense Considerations', 'Fee and Expense Terms', 'Governing Law'] },
      { type: 'Proffer Agreement',
        desc: 'Governs the terms of a client proffer to government investigators. Includes scope of waiver, derivative use restrictions, and impeachment limitations.',
        fields: ['Date', 'Witness Name', 'Agency', 'Case No.', 'AUSA'],
        clauses: ['Scope of Proffer', 'Waiver of Rights', 'Derivative Use Restrictions', 'Impeachment Exception', 'No Waiver of Attorney-Client Privilege', 'Acknowledgment'] },
      { type: 'Internal Investigation Report',
        desc: 'Template for internal investigation findings. Covers executive summary, methodology, factual findings, legal analysis, and recommendations.',
        fields: ['Date', 'Subject Matter', 'Prepared By', 'Distribution', 'Privilege Designation'],
        clauses: ['Executive Summary', 'Methodology', 'Factual Findings', 'Legal Analysis', 'Recommendations', 'Privilege Log', 'Document Retention'] },
    ],
  },
  {
    name: 'Health Care',
    desc: 'Regulatory, transactional, and litigation counsel to providers, payors, pharma, and medical device manufacturers.',
    documents: [
      { type: 'Health Care Engagement Letter',
        desc: 'For health care regulatory, transactional, or litigation matters. Includes HIPAA compliance obligations and FDA regulatory scope.',
        fields: ['Client Name', 'Date', 'Matter', 'Agency', 'Fee Arrangement'],
        clauses: ['Scope of Representation', 'HIPAA & Data Privacy', 'FDA Regulatory Scope', 'Fee and Expense Terms', 'Conflict Waiver', 'Termination', 'Governing Law'] },
      { type: 'Business Associate Agreement (BAA)',
        desc: 'HIPAA-required BAA. Defines permitted PHI uses, breach notification, and subcontractor requirements.',
        fields: ['Effective Date', 'Covered Entity', 'Business Associate', 'Services'],
        clauses: ['Definitions', 'Permitted Uses of PHI', 'Business Associate Obligations', 'Breach Notification', 'Subcontractors', 'Term and Termination', 'Governing Law'] },
      { type: 'Clinical Trial Agreement',
        desc: 'Between sponsor and research institution. Includes protocol compliance, IP ownership, indemnification, and publication rights.',
        fields: ['Effective Date', 'Sponsor', 'Institution', 'Protocol Title/No.', 'Principal Investigator'],
        clauses: ['Protocol Compliance', 'Subject Safety', 'IP & Data Ownership', 'Publication Rights', 'Indemnification', 'Insurance', 'Confidentiality', 'Term and Termination', 'Governing Law'] },
    ],
  },
  {
    name: 'Privacy & Cybersecurity',
    desc: 'Data protection laws, breach response, regulatory investigations, and compliance programs globally.',
    documents: [
      { type: 'Data Processing Agreement (DPA)',
        desc: 'GDPR/CCPA-compliant DPA. Defines processing purposes, data categories, security measures, transfer mechanisms, and sub-processor requirements.',
        fields: ['Effective Date', 'Controller', 'Processor', 'Purpose', 'Data Categories', 'Transfer Mechanism'],
        clauses: ['Definitions', 'Processing Purpose & Duration', 'Data Subject Rights', 'Security Measures', 'Sub-Processors', 'Cross-Border Transfers', 'Breach Notification', 'Audit Rights', 'Governing Law'] },
      { type: 'Privacy Policy',
        desc: 'External-facing policy for website, app, or service. Covers data collection, use, sharing, rights, and contact information.',
        fields: ['Effective Date', 'Company', 'Service', 'DPO Contact', 'Jurisdiction(s)'],
        clauses: ['Information We Collect', 'How We Use Information', 'Information Sharing', 'Data Subject Rights', 'Data Security', 'Data Retention', 'Children\'s Privacy', 'International Transfers', 'Contact Information'] },
      { type: 'Data Breach Response Plan',
        desc: 'Internal incident response plan. Defines escalation, notification timelines, forensics, and regulatory reporting.',
        fields: ['Plan Date', 'Plan Owner', 'IR Lead', 'External Counsel', 'Forensics Vendor'],
        clauses: ['Incident Classification', 'Escalation', 'Containment & Eradication', 'Forensic Investigation', 'Notification Obligations', 'Regulatory Reporting', 'Communications Plan', 'Post-Incident Review'] },
    ],
  },
];

function drawSectionIII(doc, fonts, startPage, totalPages) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'SECTION  III', 'Document Types by Practice Area', y);

  y = drawBody(page, fonts,
    'The seven core practice areas each have a recommended set of document types. For every type below, you will find required form fields and a suggested clause structure. Use these as starting points when building documents in the admin builder.',
    y);
  y -= 14;

  let n = 1;
  for (const area of practiceAreas) {
    if (y < 260) {
      drawFooter(page, fonts, startPage, totalPages);
      startPage++;
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = drawLetterhead(page, fonts);
      y = drawSectionTitle(page, fonts, 'SECTION  III  (CONTINUED)', 'Document Types by Practice Area', y);
    }

    // Practice area heading: editorial gold numeral + serif title
    const numStr = String(n).padStart(2, '0');
    const numSize = 24;
    page.drawText(numStr, { x: MARGIN, y, size: numSize, font: fonts.serif, color: GOLD });
    const numW = fonts.serif.widthOfTextAtSize(numStr, numSize);

    safeDrawText(page, area.name, {
      x: MARGIN + numW + 14,
      y: y + 6,
      size: 16, font: fonts.serifBold, color: NAVY,
    });
    // thin gold underline under name
    const nameW = safeTextWidth(fonts.serifBold, area.name, 16);
    page.drawLine({
      start: { x: MARGIN + numW + 14, y: y + 2 },
      end: { x: MARGIN + numW + 14 + nameW, y: y + 2 },
      thickness: 0.5, color: GOLD,
    });
    y -= 18;
    y = drawWrapped(page, area.desc, MARGIN + numW + 14, y, fonts.sans, 9.5, SLATE, PAGE_W - MARGIN * 2 - numW - 14, 13.5);
    y -= 10;

    for (const docType of area.documents) {
      if (y < 300) {
        drawFooter(page, fonts, startPage, totalPages);
        startPage++;
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = drawLetterhead(page, fonts);
        y = drawSectionTitle(page, fonts, 'SECTION  III  (CONTINUED)', 'Document Types by Practice Area', y);
      }

      y = drawSubSubHeading(page, fonts, docType.type, y);
      y = drawWrapped(page, docType.desc, MARGIN, y, fonts.sans, 9.5, INK, PAGE_W - MARGIN * 2, 14);
      y -= 6;

      // Fields label
      page.drawText('Form Fields', {
        x: MARGIN + 12, y, size: 8.5, font: fonts.sansMed, color: BURGUNDY,
      });
      y -= 12;
      y = drawBullets(page, docType.fields, MARGIN + 12, y, fonts, 9, SLATE, PAGE_W - MARGIN * 2 - 24);
      y -= 4;

      // Clauses label
      page.drawText('Clauses', {
        x: MARGIN + 12, y, size: 8.5, font: fonts.sansMed, color: BURGUNDY,
      });
      y -= 12;
      y = drawBullets(page, docType.clauses, MARGIN + 12, y, fonts, 9, SLATE, PAGE_W - MARGIN * 2 - 24);
      y -= 12;
    }

    n++;
    y -= 8;
  }

  drawFooter(page, fonts, startPage, totalPages);
  return startPage + 1;
}

// ── Section IV: Guidelines ────────────────────────────────────────────

function drawSectionIV(doc, fonts, startPage, totalPages) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'SECTION  IV', 'Creation Guidelines', y);

  const guidelines = [
    { title: 'Document title naming',
      body: 'Use full capitalization for document titles (e.g. MUTUAL NON-DISCLOSURE AGREEMENT). Keep titles concise — one or two lines at the default 18pt Cormorant Bold. Avoid abbreviations in formal document titles.' },
    { title: 'Field label standards',
      body: 'End labels with a colon and make them descriptive enough for clients to understand ("Client Name:" not just "Name:"). Group related fields. Place date fields early. Standard widths: 370 for name/address lines, 200 for dates.' },
    { title: 'Clause numbering and structure',
      body: 'Use sequential numbering (1., 2., 3.) for clauses. Each clause has a short descriptive title ending with a period ("Governing Law."). Body text in complete sentences. Capitalize defined terms consistently throughout.' },
    { title: 'Signature block configuration',
      body: 'Always include the [SEAL] notation on signature lines to comply with jurisdictions requiring sealed instruments. Two signature blocks side-by-side for bilateral agreements. For multi-party agreements, use separate signature pages. Include Print Name and Date fields below each signature line.' },
    { title: 'Page overflow handling',
      body: 'The template engine creates new pages automatically when content exceeds available space. Signature blocks always start on a fresh page if fewer than 300 points of vertical space remain. Review multi-page documents to ensure clause breaks land at logical points.' },
    { title: 'Quality control checklist',
      body: 'Before distributing: (1) verify all form fields are present and labeled, (2) confirm clause numbering is sequential, (3) check signature blocks match the parties, (4) review clause body text for typos, (5) open the PDF in Acrobat to verify AcroForm field functionality, (6) confirm the document prints with the gold rule and letterhead intact.' },
    { title: 'Version control',
      body: 'Save frequently used document types as presets. Use Export as Preset to capture your configuration as JSON for sharing with colleagues. Maintain a changelog of preset modifications. For each generated document, retain the configuration JSON for reproducibility.' },
    { title: 'Brand consistency',
      body: 'All documents share the same editorial system: navy #0A1628, burgundy #6B1C2E, gold #B08D57 on cream #FAF8F5. Cormorant Garamond for serif/display, Montserrat for sans. Do not deviate from these tokens for client-facing documents without approval from Brand & Communications.' },
  ];

  let n = 1;
  for (const g of guidelines) {
    if (y < 140) {
      drawFooter(page, fonts, startPage, totalPages);
      startPage++;
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = drawLetterhead(page, fonts);
      y = drawSectionTitle(page, fonts, 'SECTION  IV  (CONTINUED)', 'Creation Guidelines', y);
    }
    y = drawNumberedItem(page, fonts, n, g.title, g.body, y);
    n++;
  }

  drawFooter(page, fonts, startPage, totalPages);
  return startPage + 1;
}

// ── Section V: Customization ──────────────────────────────────────────

function drawSectionV(doc, fonts, startPage, totalPages) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = drawLetterhead(page, fonts);
  y = drawSectionTitle(page, fonts, 'SECTION  V', 'Template Customization & Tips', y);

  const topics = [
    { title: 'Customizing the template presets',
      body: 'Presets live in public/js/template-presets.js. Each is a JavaScript object with: title (string), fields (array of {label, name, width}), intro (string), witnessText (string), clauses (array of {num, title, body}), and signatureBlocks (array of {label, fields}). To add a new preset, edit template-presets.js and add your object to window.CarlingtonPresets following the existing pattern.' },
    { title: 'Generating PDFs programmatically',
      body: 'public/js/carlington-template.js exposes CarlingtonTemplate.generate(def), returning a Uint8Array of PDF bytes, and CarlingtonTemplate.download(bytes, filename) to trigger a browser download. You can call these from any page or from devtools for quick generation.' },
    { title: 'Adding new document types',
      body: 'For a type not covered by existing presets: (1) open the admin builder, (2) choose Custom from the preset dropdown, (3) enter title and filename, (4) add form fields, (5) compose clauses, (6) configure signature blocks. Click Export as Preset to save the configuration as JSON. Then add it to template-presets.js as a named preset.' },
    { title: 'Deployment',
      body: 'The admin builder is a static site deployed via Vercel. To ship a change: edit the relevant files under public/ (admin/index.html, js/carlington-template.js, js/template-presets.js, css/*), then run vercel --prod from the project root, or push to main if your branch is connected to auto-deploy. All changes propagate to the edge within ~60 seconds.' },
    { title: 'Testing new templates',
      body: 'Always test new or modified templates: (1) generate from the admin builder, (2) open in Acrobat to verify AcroForm fields are fillable, (3) test in Apple Preview on macOS (most attorney laptops), (4) print to verify the gold rule and letterhead render correctly, (5) have a second reviewer proofread clause text.' },
    { title: 'Technical reference',
      body: 'PDF generation: pdf-lib v1.17.1 + @pdf-lib/fontkit v1.1.1, loaded via CDN in the admin shell. Template engine: public/js/carlington-template.js. Presets: public/js/template-presets.js. Admin UI: public/admin/index.html. Brand fonts: Cormorant Garamond 400/600 + Montserrat 400/500, served as .ttf from public/fonts/. Brand palette: navy #0A1628, burgundy #6B1C2E, gold #B08D57, cream #FAF8F5. For template requests or issues, contact Knowledge Management.' },
  ];

  let n = 1;
  for (const t of topics) {
    if (y < 150) {
      drawFooter(page, fonts, startPage, totalPages);
      startPage++;
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = drawLetterhead(page, fonts);
      y = drawSectionTitle(page, fonts, 'SECTION  V  (CONTINUED)', 'Template Customization & Tips', y);
    }
    y = drawNumberedItem(page, fonts, n, t.title, t.body, y);
    n++;
  }

  // Closing rule + sign-off
  y -= 18;
  if (y < 100) {
    drawFooter(page, fonts, startPage, totalPages);
    startPage++;
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = drawLetterhead(page, fonts);
    y -= 40;
  }

  page.drawLine({
    start: { x: PAGE_W / 2 - 30, y },
    end: { x: PAGE_W / 2 + 30, y },
    thickness: 1, color: GOLD,
  });
  y -= 24;

  const endNote = 'This playbook is an internal firm resource. For questions about the admin builder, template requests, or to report issues, contact Knowledge Management. Updated editions will be distributed as the template system evolves.';
  y = drawWrapped(page, endNote, MARGIN + 30, y, fonts.serif, 10, SLATE, PAGE_W - MARGIN * 2 - 60, 14);
  y -= 24;

  // Firm sign-off
  const signSize = 14;
  const signW = fonts.serifBold.widthOfTextAtSize(FIRM, signSize);
  page.drawText(FIRM, {
    x: PAGE_W / 2 - signW / 2, y,
    size: signSize, font: fonts.serifBold, color: NAVY,
  });

  drawFooter(page, fonts, startPage, totalPages);
  return startPage + 1;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating Carlington & Burling Admin Playbook (v2.0)...\n');

  // First pass: build content, count pages
  let doc = await PDFDocument.create();
  let fonts = await loadFonts(doc);

  console.log('  [1/7] Cover page...');
  drawCoverPage(doc, fonts);

  // Placeholder TOC — we'll regenerate with correct page numbers after content
  const tocItems = [
    { num: 'I',   title: 'Introduction & Access',                  page: 3 },
    { num: 'II',  title: 'Step-by-Step: Generating a Document',    page: 4 },
    { num: 'III', title: 'Document Types by Practice Area',        page: 6 },
    { num: 'IV',  title: 'Creation Guidelines & Best Practices',   page: 14 },
    { num: 'V',   title: 'Template Customization & Tips',          page: 17 },
  ];

  console.log('  [2/7] Table of contents...');
  // Use placeholder totalPages — we'll regenerate in pass 2
  drawTOC(doc, fonts, tocItems, 20);

  console.log('  [3/7] Section I — Introduction & Access...');
  drawSectionI(doc, fonts, 3, 20);

  console.log('  [4/7] Section II — Step-by-Step Guide...');
  const sec2End = drawSectionII(doc, fonts, 4, 20);

  console.log('  [5/7] Section III — Document Types...');
  const sec3End = drawSectionIII(doc, fonts, sec2End, 20);

  console.log('  [6/7] Section IV — Guidelines...');
  const sec4End = drawSectionIV(doc, fonts, sec3End, 20);

  console.log('  [7/7] Section V — Customization...');
  const sec5End = drawSectionV(doc, fonts, sec4End, 20);

  const realTotal = doc.getPageCount();
  console.log('\n  Total pages: ' + realTotal);
  console.log('  Section starts → I:3, II:4, III:' + sec2End + ', IV:' + sec3End + ', V:' + sec4End);

  // Pass 2: rebuild with correct TOC page numbers + footer totals
  console.log('\n  Rebuilding with final page numbers...');
  doc = await PDFDocument.create();
  fonts = await loadFonts(doc);

  // Use the discovered offsets for TOC
  const tocItemsFinal = [
    { num: 'I',   title: 'Introduction & Access',                  page: 3 },
    { num: 'II',  title: 'Step-by-Step: Generating a Document',    page: 4 },
    { num: 'III', title: 'Document Types by Practice Area',        page: sec2End },
    { num: 'IV',  title: 'Creation Guidelines & Best Practices',   page: sec3End },
    { num: 'V',   title: 'Template Customization & Tips',          page: sec4End },
  ];

  drawCoverPage(doc, fonts);
  drawTOC(doc, fonts, tocItemsFinal, realTotal);
  drawSectionI(doc, fonts, 3, realTotal);
  drawSectionII(doc, fonts, 4, realTotal);
  drawSectionIII(doc, fonts, sec2End, realTotal);
  drawSectionIV(doc, fonts, sec3End, realTotal);
  drawSectionV(doc, fonts, sec4End, realTotal);

  const pdfBytes = await doc.save();
  if (!fs.existsSync(FORMS_DIR)) fs.mkdirSync(FORMS_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, pdfBytes);

  console.log('\nSaved: ' + OUT_FILE);
  console.log('Size:  ' + (pdfBytes.length / 1024).toFixed(1) + ' KB');
  console.log('Pages: ' + doc.getPageCount());
}

main().catch(function (err) {
  console.error('Error generating playbook:', err);
  process.exit(1);
});
