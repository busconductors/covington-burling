/**
 * Carlington & Burling LLP — Admin Document Builder Playbook
 * Generates a comprehensive guide PDF in the official Variant C (Bordered
 * Traditional) style. Covers admin access, step-by-step instructions, document
 * types organized by the firm's 7 practice areas, and creation guidelines.
 *
 * Usage:
 *   node scripts/generate-playbook.js
 *
 * Output:
 *   public/forms/carlington-admin-playbook.pdf
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const FORMS_DIR = path.join(__dirname, '..', 'public', 'forms');
const OUT_FILE = path.join(FORMS_DIR, 'carlington-admin-playbook.pdf');

// ── Design Constants ─────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const NAVY = rgb(0.039, 0.086, 0.157);
const GOLD = rgb(0.761, 0.643, 0.310);
const MUTED = rgb(0.353, 0.353, 0.431);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const DARK_GRAY = rgb(0.267, 0.267, 0.267);
const LIGHT_GOLD = rgb(0.95, 0.92, 0.78);
const CREAM_BG = rgb(0.98, 0.97, 0.96);

// ── Utility Functions ────────────────────────────────────────────────────

function embedFonts(doc) {
  return {
    regular: doc.embedStandardFont(StandardFonts.TimesRoman),
    bold: doc.embedStandardFont(StandardFonts.TimesRomanBold),
    italic: doc.embedStandardFont(StandardFonts.TimesRomanItalic),
  };
}

function drawWrapped(page, text, x, y, font, size, color, maxWidth, lineHeight) {
  // Split on both spaces and newlines, preserving newline breaks
  const paragraphs = text.split('\n');
  let lineY = y;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const words = paragraphs[pi].split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) < maxWidth && line !== '') {
        line = test;
      } else {
        if (line) {
          page.drawText(line, { x, y: lineY, size, font, color });
          lineY -= (lineHeight || size * 1.6);
        }
        line = word;
      }
    }
    if (line) {
      page.drawText(line, { x, y: lineY, size, font, color });
      lineY -= (lineHeight || size * 1.6);
    }
    // Extra spacing between paragraphs
    if (pi < paragraphs.length - 1) {
      lineY -= (lineHeight || size * 1.6) * 0.3;
    }
  }
  return lineY;
}

function drawBulletList(page, items, x, y, fonts, size, color, maxWidth) {
  const lh = size * 1.5;
  let cy = y;
  for (const item of items) {
    page.drawText('•', { x, y: cy, size, font: fonts.regular, color });
    cy = drawWrapped(page, item, x + 14, cy, fonts.regular, size, color, maxWidth - 14, lh);
  }
  return cy;
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

function drawLetterhead(page, fonts, y) {
  const name = 'Carlington & Burling LLP';
  const addr = '850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  carlingtonburling.com';
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

function drawSubHeading(page, fonts, text, y) {
  page.drawText(text, {
    x: MARGIN, y, size: 12, font: fonts.bold, color: NAVY,
  });
  return y - 20;
}

function drawSubSubHeading(page, fonts, text, y) {
  page.drawText(text, {
    x: MARGIN + 12, y, size: 10.5, font: fonts.bold, color: DARK_GRAY,
  });
  return y - 16;
}

function drawBullet(page, fonts, text, y, indent, maxWidth) {
  page.drawText('•', { x: indent, y, size: 10, font: fonts.regular, color: BLACK });
  return drawWrapped(page, text, indent + 14, y, fonts.regular, 10, BLACK, maxWidth - 14, 10 * 1.5);
}

function drawNumberedItem(page, fonts, num, text, y, indent, maxWidth) {
  const prefix = num + '. ';
  page.drawText(prefix, { x: indent, y, size: 10, font: fonts.bold, color: NAVY });
  return drawWrapped(page, text, indent + fonts.bold.widthOfTextAtSize(prefix, 10), y, fonts.regular, 10, BLACK, maxWidth, 10 * 1.5);
}

function drawBodyText(page, fonts, text, y) {
  return drawWrapped(page, text, MARGIN + 12, y, fonts.regular, 10, BLACK, PAGE_W - MARGIN * 2 - 24, 10 * 1.6);
}

// ── Cover Page ───────────────────────────────────────────────────────────

function drawCoverPage(doc, fonts) {
  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Double-line frame
  drawPageFrame(page);

  // Heavy outer border
  page.drawRectangle({
    x: 40, y: 40, width: PAGE_W - 80, height: PAGE_H - 80,
    borderWidth: 2.5, borderColor: NAVY,
  });

  // Inner gold border
  page.drawRectangle({
    x: 48, y: 48, width: PAGE_W - 96, height: PAGE_H - 96,
    borderWidth: 1, borderColor: GOLD,
  });

  // Firm name
  let y = PAGE_H / 2 + 80;
  const firm = 'Carlington & Burling LLP';
  page.drawText(firm, {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize(firm, 22) / 2,
    y, size: 22, font: fonts.bold, color: NAVY,
  });
  y -= 40;

  // Gold divider
  page.drawLine({
    start: { x: PAGE_W / 2 - 120, y },
    end: { x: PAGE_W / 2 + 120, y },
    thickness: 2, color: GOLD,
  });
  y -= 36;

  // Title
  const title = 'ADMIN DOCUMENT BUILDER';
  page.drawText(title, {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize(title, 18) / 2,
    y, size: 18, font: fonts.bold, color: NAVY,
  });
  y -= 30;

  const subtitle = 'P L A Y B O O K';
  let spaced = '';
  for (const ch of subtitle) spaced += ch + ' ';
  page.drawText(spaced.trim(), {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize(spaced.trim(), 14) / 2,
    y, size: 14, font: fonts.regular, color: MUTED,
  });
  y -= 36;

  // Thin divider
  page.drawLine({
    start: { x: PAGE_W / 2 - 80, y },
    end: { x: PAGE_W / 2 + 80, y },
    thickness: 0.5, color: GOLD,
  });
  y -= 30;

  // Description
  const desc = 'A comprehensive guide to generating legal documents\nusing the Carlington & Burling official template system.';
  const descLines = desc.split('\n');
  for (const line of descLines) {
    page.drawText(line, {
      x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize(line, 10.5) / 2,
      y, size: 10.5, font: fonts.regular, color: DARK_GRAY,
    });
    y -= 18;
  }

  // Version / date
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  y -= 20;
  page.drawText('Version 1.0  •  ' + today, {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('Version 1.0  •  ' + today, 9) / 2,
    y, size: 9, font: fonts.regular, color: MUTED,
  });

  // Bottom mark
  page.drawText('CONFIDENTIAL', {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize('CONFIDENTIAL', 8) / 2,
    y: 68, size: 8, font: fonts.bold, color: MUTED,
  });

  page.drawText('© ' + new Date().getFullYear() + ' Carlington & Burling LLP. All Rights Reserved.', {
    x: PAGE_W / 2 - fonts.regular.widthOfTextAtSize('© ' + new Date().getFullYear() + ' Carlington & Burling LLP. All Rights Reserved.', 7.5) / 2,
    y: 54, size: 7.5, font: fonts.regular, color: MUTED,
  });

  return page;
}

// ── Table of Contents ────────────────────────────────────────────────────

function drawTOC(doc, fonts) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'TABLE OF CONTENTS', y);
  y -= 10;

  const toc = [
    { num: 'I.', title: 'Introduction & Access', page: 3 },
    { num: 'II.', title: 'Step-by-Step: Generating a Document', page: 4 },
    { num: 'III.', title: 'Document Types by Practice Area', page: 6 },
    { num: 'IV.', title: 'Creation Guidelines & Best Practices', page: 14 },
    { num: 'V.', title: 'Template Customization & Tips', page: 16 },
  ];

  for (const item of toc) {
    const label = item.num + '  ' + item.title;
    page.drawText(label, {
      x: MARGIN + 12, y, size: 11, font: fonts.bold, color: NAVY,
    });
    const dots = '······································';
    const dotW = fonts.regular.widthOfTextAtSize(dots, 10);
    const labelW = fonts.bold.widthOfTextAtSize(label, 11);
    const available = PAGE_W - MARGIN - 80 - MARGIN - 12 - labelW - 10;
    const pageStr = String(item.page);
    const pageW = fonts.regular.widthOfTextAtSize(pageStr, 10);

    page.drawText(dots.substring(0, Math.floor(available / (dotW / dots.length))), {
      x: MARGIN + 12 + labelW + 10, y, size: 10, font: fonts.regular, color: MUTED,
    });
    page.drawText(pageStr, {
      x: PAGE_W - MARGIN - 80 - pageW, y, size: 10, font: fonts.regular, color: MUTED,
    });
    y -= 28;
  }

  addPageNumber(page, fonts, 2, 18);
  return page;
}

// ── Content Sections ─────────────────────────────────────────────────────

function drawSectionI(doc, fonts, startPage) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'INTRODUCTION & ACCESS', y);
  y -= 6;

  y = drawBodyText(page, fonts,
    'This playbook provides step-by-step instructions for using the Carlington & Burling LLP Admin Document Builder. The builder enables authorized firm personnel to generate professional, fillable PDF documents in the official firm template style — Variant C (Bordered Traditional). All generated documents include the firm letterhead, double-line page frame, gold accent rules, and AcroForm fillable fields for client-facing use.',
    y);
  y -= 16;

  y = drawSubHeading(page, fonts, 'Accessing the Admin Builder', y);

  y = drawNumberedItem(page, fonts, '1',
    'Open a web browser and navigate to the admin page at:  [your-domain]/admin/',
    y, MARGIN + 12, PAGE_W - MARGIN * 2 - 24);
  y -= 6;

  y = drawNumberedItem(page, fonts, '2',
    'Enter the access key when prompted. The default access key is:  covbur1919',
    y, MARGIN + 12, PAGE_W - MARGIN * 2 - 24);
  y -= 6;

  y = drawNumberedItem(page, fonts, '3',
    'Upon successful authentication, the admin builder interface will load. Access is maintained for the duration of the browser session via secure session storage.',
    y, MARGIN + 12, PAGE_W - MARGIN * 2 - 24);
  y -= 6;

  y = drawNumberedItem(page, fonts, '4',
    'To change the access key, edit the ADMIN_ACCESS_KEY variable in /admin/index.html and redeploy.',
    y, MARGIN + 12, PAGE_W - MARGIN * 2 - 24);
  y -= 16;

  y = drawSubHeading(page, fonts, 'Interface Overview', y);
  y = drawBodyText(page, fonts,
    'The admin builder has a two-panel layout. The left sidebar (380px) contains all document configuration controls: preset selector, title input, form fields, clauses, and signature blocks. The main area (right) displays a live preview summary and the Generate PDF / Download buttons. A status indicator shows the current state of PDF generation.',
    y);
  y -= 16;

  y = drawSubHeading(page, fonts, 'Security Note', y);
  y = drawBodyText(page, fonts,
    'The admin builder operates entirely in the browser. No document data is transmitted to any server. PDF generation relies on the pdf-lib library loaded via CDN. The access key provides a basic level of protection; for enhanced security, deploy the admin page behind your firm\'s SSO or VPN.',
    y);

  addPageNumber(page, fonts, startPage, 18);
  return doc.addPage([PAGE_W, PAGE_H]);
}

function drawSectionII(doc, fonts, startPage) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'STEP-BY-STEP: GENERATING A DOCUMENT', y);
  y -= 6;

  const steps = [
    {
      title: 'Step 1 — Load a Preset or Start Fresh',
      body: 'Use the "Load Preset" dropdown at the top of the sidebar to select a starting template. Available presets include Waiver and Release, Mutual NDA, and Blank. Selecting a preset populates all fields, clauses, and signature blocks automatically. Choose "Custom" to build a document from scratch.',
    },
    {
      title: 'Step 2 — Configure Document Metadata',
      body: 'Enter the document title (e.g., "ENGAGEMENT LETTER"), the output filename (e.g., "engagement-letter.pdf"), and optionally customize the witness preamble text. The witness preamble appears above the signature blocks and typically reads: "IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above."',
    },
    {
      title: 'Step 3 — Add Form Fields',
      body: 'Form fields create fillable blanks in the generated PDF. Each field has a label (displayed text, e.g., "Client Name:") and a name (internal identifier for the AcroForm field). Click "+ Add Field" to add a new field row. Click the × button to remove a field. Field width defaults to 370px but can be customized for each field.',
    },
    {
      title: 'Step 4 — Compose Clauses',
      body: 'Clauses are the substantive provisions of the document. Each clause has a number (e.g., "1."), a title (e.g., "Governing Law."), and body text. Click "+ Add Clause" to add a new clause. Use the text areas to compose the body text. Clauses are rendered with bold number + title on the first line and indented body text below. If content overflows the first page, a new page is automatically created.',
    },
    {
      title: 'Step 5 — Configure Signature Blocks',
      body: 'The builder supports up to two signature blocks displayed side-by-side. Each block has a label (e.g., "Client" or "For Carlington & Burling LLP") and fields. The "Signature" field type renders as a signature line with the [SEAL] notation. Click "Add Field" within a signature block to add additional lines (e.g., Print Name, Title, Date).',
    },
    {
      title: 'Step 6 — Generate the PDF',
      body: 'Click the "Generate PDF" button in the main toolbar. The browser will instantaneously build the PDF using the pdf-lib library. A green status indicator confirms successful generation. The PDF is then automatically downloaded to your computer with the filename specified in Step 2.',
    },
    {
      title: 'Step 7 — Distribute the Document',
      body: 'Email the generated PDF to the client or upload it to the firm\'s document management system. Clients can open the PDF in Adobe Acrobat, Apple Preview, or any modern PDF viewer to fill in the form fields electronically, or print and complete the document by hand.',
    },
  ];

  for (const step of steps) {
    if (y < 150) {
      addPageNumber(page, fonts, startPage, 18);
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawPageFrame(page);
      y = PAGE_H - 62;
      y = drawLetterhead(page, fonts, y);
      y -= 10;
      y = drawTitle(page, fonts, 'STEP-BY-STEP (CONTINUED)', y);
      y -= 6;
    }

    y = drawSubSubHeading(page, fonts, step.title, y);
    y = drawBodyText(page, fonts, step.body, y);
    y -= 10;
  }

  addPageNumber(page, fonts, startPage, 18);
  return doc.addPage([PAGE_W, PAGE_H]);
}

// ── Practice Area Document Types ─────────────────────────────────────────

const practiceAreas = [
  {
    name: 'Antitrust & Competition',
    desc: 'Carlington\'s antitrust practice handles complex merger reviews, civil and criminal cartel investigations, and competition litigation across jurisdictions worldwide.',
    documents: [
      {
        type: 'Engagement Letter — Antitrust',
        desc: 'Standard engagement letter for antitrust matters. Include scope of representation, fee structure, conflict waiver, and contact information for the lead antitrust partner. Add fields for client name, matter description, and billing arrangement.',
        fields: ['Client Name', 'Date', 'Matter Description', 'Billing Rate', 'Lead Partner'],
        clauses: ['Scope of Representation', 'Fee and Billing Terms', 'Conflict Waiver', 'Termination', 'Governing Law'],
      },
      {
        type: 'Joint Defense Agreement',
        desc: 'For multi-party antitrust investigations. Governs sharing of privileged information among co-defendants. Include common interest doctrine language and provisions for withdrawal from the joint defense group.',
        fields: ['Effective Date', 'Party A', 'Party B', 'Matter/Case No.', 'Lead Counsel for Each Party'],
        clauses: ['Common Interest Privilege', 'Confidentiality of Shared Materials', 'No Waiver of Privilege', 'Withdrawal Procedure', 'Governing Law'],
      },
      {
        type: 'Document Preservation Notice',
        desc: 'Issued to clients upon receipt of a subpoena or CID. Instructs on preservation obligations for electronically stored information and physical documents. Include litigation hold language.',
        fields: ['Date Issued', 'Client Name', 'Matter/Case No.', 'Response Deadline', 'Issuing Authority'],
        clauses: ['Preservation Obligations', 'Scope of ESI to Preserve', 'Consequences of Spoliation', 'Point of Contact', 'Acknowledgment of Receipt'],
      },
    ],
  },
  {
    name: 'Litigation',
    desc: 'Our litigators represent clients in bet-the-company trials, appeals, and arbitrations, with deep experience in complex commercial, securities, and constitutional disputes.',
    documents: [
      {
        type: 'Engagement Letter — Litigation',
        desc: 'Comprehensive litigation engagement letter. Include detailed scope, litigation budget estimate, discovery obligations, and alternative fee arrangements if applicable.',
        fields: ['Client Name', 'Date', 'Case Caption', 'Court/Venue', 'Fee Arrangement', 'Initial Retainer Amount'],
        clauses: ['Scope of Representation', 'Fee and Expense Terms', 'Client Cooperation Obligations', 'Discovery Responsibilities', 'Settlement Authority', 'Withdrawal', 'Governing Law'],
      },
      {
        type: 'Settlement Agreement',
        desc: 'Full settlement and release agreement for resolved litigation. Include mutual releases, payment terms, dismissal with prejudice, confidentiality, and non-disparagement.',
        fields: ['Effective Date', 'Plaintiff', 'Defendant', 'Case No.', 'Settlement Amount', 'Payment Deadline'],
        clauses: ['Recitals', 'Payment Terms', 'Mutual Release', 'Dismissal with Prejudice', 'Confidentiality', 'Non-Disparagement', 'No Admission of Liability', 'Entire Agreement', 'Governing Law'],
      },
      {
        type: 'Protective Order Stipulation',
        desc: 'Joint stipulation for entry of a protective order governing confidential discovery materials. Include tiers of confidentiality, clawback provisions, and procedures for challenging designations.',
        fields: ['Court', 'Case No.', 'Case Caption', 'Date of Stipulation'],
        clauses: ['Definitions', 'Designation of Confidential Material', 'Attorneys\' Eyes Only Tier', 'Use of Protected Material', 'Clawback Procedure', 'Challenging Designations', 'Return or Destruction at Conclusion'],
      },
    ],
  },
  {
    name: 'Intellectual Property',
    desc: 'We protect and enforce IP rights through patent, trademark, copyright, and trade secret litigation, as well as strategic counseling and portfolio management.',
    documents: [
      {
        type: 'IP Engagement Letter',
        desc: 'Engagement letter for IP prosecution or litigation. Specify the IP asset (patent no., trademark reg., etc.), scope of services, and USPTO or court fees.',
        fields: ['Client Name', 'Date', 'IP Asset Description', 'Registration/Patent No.', 'Fee Arrangement'],
        clauses: ['Scope of IP Services', 'USPTO/Court Fees and Expenses', 'Client Cooperation', 'File Retention Policy', 'Termination', 'Governing Law'],
      },
      {
        type: 'Confidentiality & IP Assignment Agreement',
        desc: 'Employee or contractor agreement assigning IP rights to the company. Include invention disclosure procedures, moral rights waiver, and power of attorney for assignment execution.',
        fields: ['Effective Date', 'Employee/Contractor Name', 'Company Name', 'State of Employment'],
        clauses: ['Definitions of IP', 'Assignment of Inventions', 'Disclosure Obligations', 'Moral Rights Waiver', 'Power of Attorney', 'Return of Company Property', 'Survival', 'Governing Law'],
      },
      {
        type: 'Trademark License Agreement',
        desc: 'License agreement for trademark use. Specify quality control provisions, territorial scope, royalty structure, and termination rights.',
        fields: ['Effective Date', 'Licensor', 'Licensee', 'Mark Description', 'Territory', 'Royalty Rate'],
        clauses: ['Grant of License', 'Quality Control Standards', 'Royalty and Reporting', 'Term and Renewal', 'Infringement Enforcement', 'Indemnification', 'Termination', 'Governing Law'],
      },
    ],
  },
  {
    name: 'Corporate',
    desc: 'Our corporate team advises on M&A, capital markets, governance, and complex commercial transactions for Fortune 500 companies and emerging enterprises.',
    documents: [
      {
        type: 'Corporate Engagement Letter',
        desc: 'Engagement letter for corporate transactional matters. Include deal structure overview, fee arrangements (including success fees), and team composition.',
        fields: ['Client Name', 'Date', 'Transaction Description', 'Fee Structure', 'Lead Partner'],
        clauses: ['Scope of Engagement', 'Fee and Expense Terms', 'Team Composition', 'Third-Party Costs', 'Conflicts Waiver', 'Termination', 'Governing Law'],
      },
      {
        type: 'M&A Due Diligence Request List',
        desc: 'Comprehensive due diligence request list for M&A transactions. Categories include corporate organization, financial, tax, IP, employment, litigation, and regulatory.',
        fields: ['Target Company', 'Date Issued', 'Response Deadline', 'Deal Code Name'],
        clauses: ['Corporate Organization & Records', 'Financial & Tax Matters', 'Intellectual Property', 'Employment & Benefits', 'Litigation & Regulatory', 'Material Contracts', 'Environmental', 'Insurance'],
      },
      {
        type: 'Board Resolution',
        desc: 'Formal board resolution approving a corporate action. Include recitals, resolutions, and authorization language.',
        fields: ['Company Name', 'Date of Meeting', 'Resolution Title', 'Board Members Present'],
        clauses: ['Recitals', 'Resolutions', 'Authorization', 'Certification', 'Effective Date'],
      },
    ],
  },
  {
    name: 'White Collar Defense & Investigations',
    desc: 'Carlington defends corporations and individuals in government investigations, enforcement actions, and criminal proceedings, including FCPA, fraud, and sanctions matters.',
    documents: [
      {
        type: 'Engagement Letter — Investigation',
        desc: 'Engagement letter for internal or government-facing investigations. Include scope, Upjohn warning language (for corporate clients), privilege considerations, and interview protocols.',
        fields: ['Client Name', 'Date', 'Investigation Description', 'Government Agency (if any)', 'Fee Arrangement'],
        clauses: ['Scope of Investigation', 'Privilege and Upjohn Warning', 'Interview Protocols', 'Document Collection & Review', 'Reporting Obligations', 'Joint Defense Considerations', 'Fee and Expense Terms', 'Governing Law'],
      },
      {
        type: 'Proffer Agreement',
        desc: 'Agreement governing the terms of a client proffer to government investigators. Include scope of waiver, derivative use restrictions, and impeachment limitations.',
        fields: ['Date', 'Client/Witness Name', 'Government Agency', 'Case/Investigation No.', 'AUSA/Prosecutor Name'],
        clauses: ['Scope of Proffer', 'Waiver of Rights', 'Derivative Use Restrictions', 'Impeachment Exception', 'No Waiver of Attorney-Client Privilege', 'Acknowledgment'],
      },
      {
        type: 'Internal Investigation Report',
        desc: 'Template for internal investigation findings. Cover executive summary, investigative methodology, factual findings, legal analysis, and recommendations.',
        fields: ['Date', 'Subject Matter', 'Prepared By', 'Distribution List', 'Privilege Designation'],
        clauses: ['Executive Summary', 'Investigative Methodology', 'Factual Findings', 'Legal Analysis', 'Recommendations', 'Privilege Log', 'Document Retention'],
      },
    ],
  },
  {
    name: 'Health Care',
    desc: 'We provide regulatory, transactional, and litigation counsel to health care providers, payors, pharmaceutical companies, and medical device manufacturers.',
    documents: [
      {
        type: 'Health Care Engagement Letter',
        desc: 'Engagement letter for health care regulatory, transactional, or litigation matters. Include HIPAA compliance obligations and FDA regulatory scope as applicable.',
        fields: ['Client Name', 'Date', 'Matter Description', 'Regulatory Agency (if any)', 'Fee Arrangement'],
        clauses: ['Scope of Representation', 'HIPAA & Data Privacy', 'FDA Regulatory Scope', 'Fee and Expense Terms', 'Conflict Waiver', 'Termination', 'Governing Law'],
      },
      {
        type: 'Business Associate Agreement (BAA)',
        desc: 'HIPAA-required business associate agreement. Define permitted uses of PHI, breach notification obligations, and subcontractor requirements.',
        fields: ['Effective Date', 'Covered Entity', 'Business Associate', 'Services Description'],
        clauses: ['Definitions', 'Permitted Uses of PHI', 'Business Associate Obligations', 'Breach Notification', 'Subcontractors', 'Term and Termination', 'Governing Law'],
      },
      {
        type: 'Clinical Trial Agreement',
        desc: 'Agreement between sponsor and research institution for clinical trial conduct. Include protocol compliance, IP ownership of trial results, indemnification, and publication rights.',
        fields: ['Effective Date', 'Sponsor', 'Institution', 'Protocol Title/No.', 'Principal Investigator'],
        clauses: ['Protocol Compliance', 'Subject Safety & Informed Consent', 'IP & Data Ownership', 'Publication Rights', 'Indemnification', 'Insurance', 'Confidentiality', 'Term and Termination', 'Governing Law'],
      },
    ],
  },
  {
    name: 'Privacy & Cybersecurity',
    desc: 'Carlington\'s privacy practice guides clients through data protection laws, breach response, regulatory investigations, and compliance programs globally.',
    documents: [
      {
        type: 'Data Processing Agreement (DPA)',
        desc: 'GDPR/CCPA-compliant data processing addendum. Define processing purposes, data categories, security measures, cross-border transfer mechanisms, and sub-processor requirements.',
        fields: ['Effective Date', 'Controller', 'Processor', 'Processing Purpose', 'Data Categories', 'Transfer Mechanism'],
        clauses: ['Definitions', 'Processing Purpose & Duration', 'Data Subject Rights', 'Security Measures', 'Sub-Processors', 'Cross-Border Transfers', 'Breach Notification', 'Audit Rights', 'Governing Law'],
      },
      {
        type: 'Privacy Policy',
        desc: 'External-facing privacy policy for website, app, or service. Cover data collection, use, sharing, data subject rights, and contact information.',
        fields: ['Effective Date', 'Company Name', 'Service Description', 'DPO Contact', 'Jurisdiction(s)'],
        clauses: ['Information We Collect', 'How We Use Information', 'Information Sharing', 'Data Subject Rights', 'Data Security', 'Data Retention', 'Children\'s Privacy', 'International Transfers', 'Contact Information'],
      },
      {
        type: 'Data Breach Response Plan',
        desc: 'Internal incident response plan for data breaches. Define escalation procedures, notification timelines, forensic investigation steps, and regulatory reporting obligations.',
        fields: ['Plan Effective Date', 'Plan Owner', 'Incident Response Team Lead', 'External Counsel', 'Forensics Vendor'],
        clauses: ['Incident Classification', 'Escalation Procedures', 'Containment & Eradication', 'Forensic Investigation', 'Notification Obligations', 'Regulatory Reporting', 'Communications Plan', 'Post-Incident Review'],
      },
    ],
  },
];

function drawSectionIII(doc, fonts, startPage) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'DOCUMENT TYPES BY PRACTICE AREA', y);
  y -= 6;

  y = drawBodyText(page, fonts,
    'The following section catalogs recommended document types for each of the firm\'s seven practice areas. For each document type, we provide the required form fields, recommended clause structure, and creation guidelines. Use these as starting points when building documents in the admin builder.',
    y);
  y -= 14;

  let areaIdx = 0;
  for (const area of practiceAreas) {
    areaIdx++;

    if (y < 180) {
      addPageNumber(page, fonts, startPage + areaIdx - 1, 18);
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawPageFrame(page);
      y = PAGE_H - 62;
      y = drawLetterhead(page, fonts, y);
      y -= 10;
      y = drawTitle(page, fonts, 'DOCUMENT TYPES (CONTINUED)', y);
      y -= 6;
    }

    y = drawSubHeading(page, fonts, areaIdx + '. ' + area.name, y);
    y = drawBodyText(page, fonts, area.desc, y);
    y -= 8;

    for (const docType of area.documents) {
      // Each document type block
      if (y < 140) {
        addPageNumber(page, fonts, startPage + areaIdx, 18);
        page = doc.addPage([PAGE_W, PAGE_H]);
        drawPageFrame(page);
        y = PAGE_H - 62;
        y = drawLetterhead(page, fonts, y);
        y -= 10;
        y = drawTitle(page, fonts, 'DOCUMENT TYPES (CONTINUED)', y);
        y -= 6;
      }

      y = drawSubSubHeading(page, fonts, docType.type, y);
      y = drawBodyText(page, fonts, docType.desc, y);
      y -= 4;

      // Fields
      const fieldLabel = 'Form Fields: ';
      page.drawText(fieldLabel, {
        x: MARGIN + 24, y, size: 9.5, font: fonts.bold, color: DARK_GRAY,
      });
      y = drawBulletList(page, docType.fields, MARGIN + 24, y - 14, fonts, 9, MUTED, PAGE_W - MARGIN * 2 - 48);
      y -= 2;

      // Clauses
      const clauseLabel = 'Clauses: ';
      page.drawText(clauseLabel, {
        x: MARGIN + 24, y, size: 9.5, font: fonts.bold, color: DARK_GRAY,
      });
      y = drawBulletList(page, docType.clauses, MARGIN + 24, y - 14, fonts, 9, MUTED, PAGE_W - MARGIN * 2 - 48);
      y -= 8;
    }

    y -= 10;
  }

  // Fix: compute the page number for the last page of this section dynamically
  addPageNumber(page, fonts, startPage + 7, 18);
  return doc.addPage([PAGE_W, PAGE_H]);
}

function drawSectionIV(doc, fonts, startPage) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'CREATION GUIDELINES & BEST PRACTICES', y);
  y -= 6;

  const guidelines = [
    {
      title: 'Document Title Naming',
      body: 'Use full capitalization for document titles (e.g., "MUTUAL NON-DISCLOSURE AGREEMENT"). Center the title between the gold rules. Keep titles concise — ideally one to two lines at 13pt Times Roman Bold. Avoid abbreviations in formal document titles.',
    },
    {
      title: 'Field Label Standards',
      body: 'Field labels should end with a colon and be descriptive enough for clients to understand (e.g., "Client Name:" not just "Name:"). Group related fields together. Place date fields early in the document for easy reference. Standard widths: 370 for name/address lines, 200 for dates.',
    },
    {
      title: 'Clause Numbering & Structure',
      body: 'Use sequential numbering (1., 2., 3.) for clauses. Each clause should have a short, descriptive title ending with a period (e.g., "Governing Law."). Body text should be in complete, well-formed sentences. Use consistent defined terms throughout (capitalize the first letter of each defined term).',
    },
    {
      title: 'Signature Block Configuration',
      body: 'Always include the [SEAL] notation on signature lines to comply with jurisdictions requiring sealed instruments. Use two signature blocks side-by-side for bilateral agreements. For multi-party agreements, use separate signature pages. Include Print Name and Date fields below each signature line.',
    },
    {
      title: 'Page Overflow Handling',
      body: 'The template engine automatically creates new pages when content exceeds available space. Signature blocks will always start on a fresh page if fewer than 300 points of vertical space remain. Review multi-page documents to ensure clause breaks occur at logical points.',
    },
    {
      title: 'Quality Control Checklist',
      body: 'Before distributing any generated document: (1) Verify all form fields are present and correctly labeled, (2) Confirm clause numbering is sequential, (3) Check that signature blocks match the parties to the agreement, (4) Review for typographical errors in clause body text, (5) Open the PDF in Adobe Acrobat to verify AcroForm field functionality, (6) Confirm the document prints correctly with double-line frame intact.',
    },
    {
      title: 'Version Control',
      body: 'Save preset configurations for frequently used document types. Export as preset to capture your configuration as JSON that can be shared with colleagues. Maintain a changelog of preset modifications. For each generated document, retain the configuration used for reproducibility.',
    },
    {
      title: 'Brand Consistency',
      body: 'All documents use the official Variant C (Bordered Traditional) template with Carlington & Burling letterhead, navy (#0A1628) and gold (#C2A44F) color scheme, Times Roman typography, and double-line page frames. Do not deviate from this template for client-facing documents without approval from the firm\'s Brand & Communications team.',
    },
  ];

  for (let i = 0; i < guidelines.length; i++) {
    if (y < 150) {
      addPageNumber(page, fonts, startPage, 18);
      page = doc.addPage([PAGE_W, PAGE_H]);
      drawPageFrame(page);
      y = PAGE_H - 62;
      y = drawLetterhead(page, fonts, y);
      y -= 10;
      y = drawTitle(page, fonts, 'GUIDELINES (CONTINUED)', y);
      y -= 6;
    }

    y = drawSubSubHeading(page, fonts, (i + 1) + '. ' + guidelines[i].title, y);
    y = drawBodyText(page, fonts, guidelines[i].body, y);
    y -= 10;
  }

  addPageNumber(page, fonts, startPage, 18);
  return doc.addPage([PAGE_W, PAGE_H]);
}

function drawSectionV(doc, fonts, startPage) {
  let page = doc.addPage([PAGE_W, PAGE_H]);
  drawPageFrame(page);

  let y = PAGE_H - 62;
  y = drawLetterhead(page, fonts, y);
  y -= 10;
  y = drawTitle(page, fonts, 'TEMPLATE CUSTOMIZATION & TIPS', y);
  y -= 6;

  y = drawSubHeading(page, fonts, 'Customizing the Template Presets', y);
  y = drawBodyText(page, fonts,
    'Template presets are defined in public/js/template-presets.js. Each preset is a JavaScript object with the following structure: title (string), fields (array of {label, name, width}), intro (string), witnessText (string), clauses (array of {num, title, body}), and signatureBlocks (array of {label, fields}). To add a new preset, edit template-presets.js and add your preset object to the window.CarlingtonPresets object following the existing pattern.',
    y);
  y -= 14;

  y = drawSubHeading(page, fonts, 'Creating the PDF Programmatically', y);
  y = drawBodyText(page, fonts,
    'The browser-side template engine at public/js/carlington-template.js exposes two functions: CarlingtonTemplate.generate(def) which returns a Uint8Array of PDF bytes, and CarlingtonTemplate.download(pdfBytes, filename) which triggers a browser download. You can call these from any page on the site or from browser developer tools for quick document generation.',
    y);
  y -= 14;

  y = drawSubHeading(page, fonts, 'Adding New Document Types', y);
  y = drawBodyText(page, fonts,
    'To create a document type not covered by existing presets: (1) Open the admin builder and select "Custom" from the preset dropdown, (2) Enter the document title and output filename, (3) Add form fields for each blank the client needs to complete, (4) Compose the substantive clauses, (5) Configure signature blocks. Once satisfied, click "Export as Preset" to save the configuration as JSON. You can then add this JSON to template-presets.js as a new named preset.',
    y);
  y -= 14;

  y = drawSubHeading(page, fonts, 'Deployment & Updates', y);
  y = drawBodyText(page, fonts,
    'The admin builder is a static HTML page deployed via Firebase Hosting. To update: (1) Edit the relevant files in public/ (admin/index.html, js/carlington-template.js, js/template-presets.js), (2) Run firebase deploy --only hosting from the project root. All changes take effect immediately upon deployment. No server restarts or Cloud Functions redeployment are required.',
    y);
  y -= 14;

  y = drawSubHeading(page, fonts, 'Testing New Templates', y);
  y = drawBodyText(page, fonts,
    'Always test new or modified templates before distributing to clients: (1) Generate the PDF from the admin builder, (2) Open in Adobe Acrobat and verify all AcroForm fields are fillable, (3) Test in Apple Preview (macOS) as many clients use it, (4) Print the document to verify the double-line frame renders correctly, (5) Have a second reviewer proofread all clause text for accuracy.',
    y);
  y -= 14;

  y = drawSubHeading(page, fonts, 'Technical Reference', y);
  y = drawBodyText(page, fonts,
    'PDF Generation: pdf-lib v1.17.1 via CDN (unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js). Template Engine: public/js/carlington-template.js (278 lines, IIFE pattern). Presets: public/js/template-presets.js. Admin UI: public/admin/index.html. Styles: public/css/admin.css. Server-side generation: scripts/generate-fillable-pdfs.js (Node.js). For support or template requests, contact the firm\'s Knowledge Management team.',
    y);

  // Back cover note
  y -= 40;
  if (y < 120) {
    addPageNumber(page, fonts, startPage, 18);
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawPageFrame(page);
    y = PAGE_H - 62;
    y = drawLetterhead(page, fonts, y);
  }

  page.drawLine({
    start: { x: MARGIN + 60, y },
    end: { x: PAGE_W - MARGIN - 60, y },
    thickness: 1, color: GOLD,
  });
  y -= 22;

  const endNote = 'This playbook is an internal firm resource. For questions about the admin document builder, template requests, or to report issues, please contact the Knowledge Management team. Updated versions of this playbook will be distributed as the template system evolves.';
  y = drawWrapped(page, endNote, MARGIN + 30, y, fonts.italic, 9, MUTED, PAGE_W - MARGIN * 2 - 60, 9 * 1.5);
  y -= 20;

  const endFirm = 'Carlington & Burling LLP';
  page.drawText(endFirm, {
    x: PAGE_W / 2 - fonts.bold.widthOfTextAtSize(endFirm, 10) / 2,
    y, size: 10, font: fonts.bold, color: NAVY,
  });

  addPageNumber(page, fonts, startPage, 18);
  return page;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating Carlington & Burling Admin Playbook PDF...\n');

  const doc = await PDFDocument.create();
  const fonts = embedFonts(doc);

  // Cover page
  console.log('  [1/8] Cover page...');
  drawCoverPage(doc, fonts);

  // TOC
  console.log('  [2/8] Table of Contents...');
  drawTOC(doc, fonts);

  // Section I: Introduction
  console.log('  [3/8] Section I — Introduction & Access...');
  drawSectionI(doc, fonts, 3);

  // Section II: Step-by-Step
  console.log('  [4/8] Section II — Step-by-Step Guide...');
  drawSectionII(doc, fonts, 4);

  // Section III: Document Types
  console.log('  [5/8] Section III — Document Types by Practice Area...');
  drawSectionIII(doc, fonts, 6);

  // Section IV: Guidelines
  console.log('  [6/8] Section IV — Creation Guidelines...');
  drawSectionIV(doc, fonts, 14);

  // Section V: Customization
  console.log('  [7/8] Section V — Template Customization...');
  drawSectionV(doc, fonts, 16);

  // Save
  console.log('  [8/8] Saving PDF...');
  const pdfBytes = await doc.save();

  if (!fs.existsSync(FORMS_DIR)) {
    fs.mkdirSync(FORMS_DIR, { recursive: true });
  }
  fs.writeFileSync(OUT_FILE, pdfBytes);
  console.log('\nPlaybook saved to: ' + OUT_FILE);
  console.log('Size: ' + (pdfBytes.length / 1024).toFixed(1) + ' KB');
}

main().catch(err => {
  console.error('Error generating playbook:', err);
  process.exit(1);
});
