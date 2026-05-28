/**
 * Generate fillable PDF forms with AcroForm fields.
 * One-off script — run once, commit the output files.
 * Usage: node scripts/generate-fillable-pdfs.js
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const FORMS_DIR = path.join(__dirname, '..', 'public', 'forms');
const NAVY = rgb(0.039, 0.086, 0.157);
const MUTED = rgb(0.353, 0.353, 0.431);
const BLACK = rgb(0, 0, 0);

function firmLetterhead(page, doc, fonts) {
  const { width } = page.getSize();
  page.drawText('Covington & Burling LLP', {
    x: 50, y: page.getHeight() - 60,
    size: 14, font: fonts.bold, color: NAVY,
  });
  page.drawText('850 Tenth Street NW, Washington, DC 20001  |  202-662-6000  |  covbur.com', {
    x: 50, y: page.getHeight() - 78,
    size: 9, font: fonts.regular, color: MUTED,
  });
  page.drawLine({
    start: { x: 50, y: page.getHeight() - 88 },
    end: { x: width - 50, y: page.getHeight() - 88 },
    thickness: 1, color: rgb(0.761, 0.643, 0.310), // gold
  });
}

async function buildWaiverPDF() {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  let page = doc.addPage([612, 792]); // Letter
  let y = page.getHeight() - 110;

  firmLetterhead(page, doc, fonts);

  // Title
  page.drawText('WAIVER AND RELEASE OF LIABILITY', {
    x: 50, y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 30;

  // AcroForm fields
  const form = doc.getForm();

  // Client Name field
  page.drawText('Client Name:', { x: 50, y, size: 11, font: fonts.bold });
  const nameField = form.createTextField('clientName');
  nameField.addToPage(page, { x: 155, y: y - 4, width: 350, height: 20 });
  y -= 28;

  // Date field
  page.drawText('Date:', { x: 50, y, size: 11, font: fonts.bold });
  const dateField = form.createTextField('date');
  dateField.addToPage(page, { x: 155, y: y - 4, width: 200, height: 20 });
  y -= 28;

  // Matter field
  page.drawText('Matter:', { x: 50, y, size: 11, font: fonts.bold });
  const matterField = form.createTextField('matter');
  matterField.addToPage(page, { x: 155, y: y - 4, width: 350, height: 20 });
  y -= 36;

  // Clauses
  const clauses = [
    { num: '1.', title: 'Acknowledgment of Risk.', text: ' The Client acknowledges that all legal matters involve inherent risks and uncertainties. The Client understands that Covington & Burling LLP makes no guarantees regarding specific outcomes and that past results do not guarantee future results. The Client has been advised of the potential risks associated with the matter described above and voluntarily assumes all such risks.' },
    { num: '2.', title: 'Release.', text: ' To the fullest extent permitted by law, the Client hereby releases, waives, and discharges Covington & Burling LLP, its partners, associates, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or related to the matter described above, except for claims arising from gross negligence or willful misconduct on the part of the Firm.' },
    { num: '3.', title: 'Indemnification.', text: ' The Client agrees to indemnify, defend, and hold harmless Covington & Burling LLP, its partners, associates, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with the Client\'s actions or omissions in connection with the matter described above.' },
    { num: '4.', title: 'Governing Law.', text: ' This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising under this Agreement shall be resolved exclusively in the courts of the District of Columbia.' },
    { num: '5.', title: 'Entire Agreement.', text: ' This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.' },
  ];

  for (const clause of clauses) {
    if (y < 220) {
      page = doc.addPage([612, 792]);
      y = page.getHeight() - 60;
    }

    const label = `${clause.num} ${clause.title}`;
    const labelWidth = fonts.bold.widthOfTextAtSize(label, 11);
    page.drawText(label, { x: 50, y, size: 11, font: fonts.bold });
    page.drawText(label, { x: 50, y, size: 11, font: fonts.bold });

    // Wrap body text
    const body = clause.text;
    const words = body.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      const w = fonts.regular.widthOfTextAtSize(test, 10.5);
      if (w < 500 && line !== '') {
        line = test;
      } else {
        if (line) {
          page.drawText(line, { x: 50, y: lineY, size: 10.5, font: fonts.regular, color: BLACK });
          lineY -= 16;
        }
        line = word;
      }
    }
    if (line) {
      page.drawText(line, { x: 50, y: lineY, size: 10.5, font: fonts.regular, color: BLACK });
      lineY -= 16;
    }
    y = lineY - 8;
  }

  // Signature block
  if (y < 180) {
    page = doc.addPage([612, 792]);
    y = page.getHeight() - 60;
  }
  y -= 20;

  page.drawText('Client Signature:', { x: 50, y, size: 11, font: fonts.bold });
  const sigField = form.createTextField('clientSignature');
  sigField.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Print Name:', { x: 50, y, size: 11, font: fonts.bold });
  const printNameField = form.createTextField('clientPrintName');
  printNameField.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Date:', { x: 50, y, size: 11, font: fonts.bold });
  const sigDateField = form.createTextField('clientSigDate');
  sigDateField.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 40;

  // Firm signature block
  page.drawText('For Covington & Burling LLP:', { x: 330, y: y + 78, size: 11, font: fonts.bold });
  const firmSigField = form.createTextField('firmSignature');
  firmSigField.addToPage(page, { x: 330, y: y + 60, width: 230, height: 18 });

  const firmPrintField = form.createTextField('firmPrintName');
  firmPrintField.addToPage(page, { x: 330, y: y + 36, width: 230, height: 18 });
  page.drawText('Print Name:', { x: 330, y: y + 42, size: 11, font: fonts.bold });

  const firmDateField = form.createTextField('firmSigDate');
  firmDateField.addToPage(page, { x: 330, y: y + 12, width: 230, height: 18 });
  page.drawText('Date:', { x: 330, y: y + 18, size: 11, font: fonts.bold });

  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(FORMS_DIR, 'waiver-fillable.pdf'), pdfBytes);
  console.log('Created: public/forms/waiver-fillable.pdf');
}

async function buildNdaPDF() {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  let page = doc.addPage([612, 792]);
  let y = page.getHeight() - 110;

  firmLetterhead(page, doc, fonts);

  // Title
  page.drawText('MUTUAL NON-DISCLOSURE AGREEMENT', {
    x: 50, y, size: 13, font: fonts.bold, color: NAVY,
  });
  y -= 35;

  const form = doc.getForm();

  // Effective Date
  page.drawText('Effective Date:', { x: 50, y, size: 11, font: fonts.bold });
  const effDateField = form.createTextField('effectiveDate');
  effDateField.addToPage(page, { x: 160, y: y - 4, width: 200, height: 20 });
  y -= 32;

  // Client Name
  page.drawText('Client Name:', { x: 50, y, size: 11, font: fonts.bold });
  const clientField = form.createTextField('clientName');
  clientField.addToPage(page, { x: 155, y: y - 4, width: 350, height: 20 });
  y -= 32;

  // Client Address
  page.drawText('Client Address:', { x: 50, y, size: 11, font: fonts.bold });
  const addrField = form.createTextField('clientAddress');
  addrField.addToPage(page, { x: 160, y: y - 4, width: 350, height: 20 });
  y -= 40;

  // Intro paragraph
  const intro = 'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between Covington & Burling LLP, with offices at 850 Tenth Street NW, Washington, DC 20001 (the "Firm"), and the Client identified above (collectively, the "Parties").';
  const introWidth = 500;
  const words = intro.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (fonts.regular.widthOfTextAtSize(test, 10.5) < introWidth && line !== '') {
      line = test;
    } else {
      if (line) { page.drawText(line, { x: 50, y: lineY, size: 10.5, font: fonts.regular }); lineY -= 16; }
      line = word;
    }
  }
  if (line) { page.drawText(line, { x: 50, y: lineY, size: 10.5, font: fonts.regular }); lineY -= 16; }
  y = lineY - 12;

  // Clauses
  const clauses = [
    { num: '1.', title: 'Definition of Confidential Information.', text: ' "Confidential Information" means any and all information, data, documents, and materials, whether oral, written, or in electronic form, disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), that is identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial information, client lists, legal strategies, and proprietary methodologies.' },
    { num: '2.', title: 'Obligations.', text: ' The Receiving Party shall: (a) protect the Disclosing Party\'s Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the purpose of evaluating or engaging in a business relationship between the Parties; (c) limit access to the Confidential Information to those employees and agents who have a need to know and who are bound by confidentiality obligations at least as restrictive as those set forth herein; and (d) not disclose, copy, or distribute the Confidential Information to any third party without the prior written consent of the Disclosing Party.' },
    { num: '3.', title: 'Exclusions.', text: ' Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of this Agreement; (b) was rightfully received from a third party without restriction and without breach of any obligation of confidentiality; (c) was independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information; or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives the Disclosing Party prompt written notice and reasonable assistance to seek a protective order.' },
    { num: '4.', title: 'Term.', text: ' This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality and non-use set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years thereafter. Upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information and certify such return or destruction in writing.' },
    { num: '5.', title: 'Governing Law.', text: ' This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia, and each Party consents to the personal jurisdiction and venue of such courts.' },
  ];

  for (const clause of clauses) {
    if (y < 220) {
      page = doc.addPage([612, 792]);
      y = page.getHeight() - 60;
    }
    const label = `${clause.num} ${clause.title}`;
    page.drawText(label, { x: 50, y, size: 11, font: fonts.bold });

    const wordArr = clause.text.split(' ');
    let l = '';
    let ly = y;
    for (const word of wordArr) {
      const test = l ? l + ' ' + word : word;
      if (fonts.regular.widthOfTextAtSize(test, 10.5) < 500 && l !== '') {
        l = test;
      } else {
        if (l) { page.drawText(l, { x: 50, y: ly, size: 10.5, font: fonts.regular, color: BLACK }); ly -= 16; }
        l = word;
      }
    }
    if (l) { page.drawText(l, { x: 50, y: ly, size: 10.5, font: fonts.regular, color: BLACK }); ly -= 16; }
    y = ly - 8;
  }

  // Signature blocks
  if (y < 200) {
    page = doc.addPage([612, 792]);
    y = page.getHeight() - 60;
  }
  y -= 20;

  // Left: Firm
  page.drawText('For Covington & Burling LLP:', { x: 50, y, size: 11, font: fonts.bold });
  const firmSig = form.createTextField('firmSignature');
  firmSig.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Print Name:', { x: 50, y, size: 11, font: fonts.bold });
  const firmPrint = form.createTextField('firmPrintName');
  firmPrint.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Title:', { x: 50, y, size: 11, font: fonts.bold });
  const firmTitle = form.createTextField('firmTitle');
  firmTitle.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Date:', { x: 50, y, size: 11, font: fonts.bold });
  const firmDate = form.createTextField('firmDate');
  firmDate.addToPage(page, { x: 50, y: y - 18, width: 230, height: 18 });

  // Right: Client
  const rightX = 330;
  y = (y < 200 ? page.getHeight() - 60 : y + 120);

  page.drawText('Client:', { x: rightX, y, size: 11, font: fonts.bold });
  const clientSig = form.createTextField('clientSignature');
  clientSig.addToPage(page, { x: rightX, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Print Name:', { x: rightX, y, size: 11, font: fonts.bold });
  const clientPrint = form.createTextField('clientPrintName');
  clientPrint.addToPage(page, { x: rightX, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Title:', { x: rightX, y, size: 11, font: fonts.bold });
  const clientTitle = form.createTextField('clientTitle');
  clientTitle.addToPage(page, { x: rightX, y: y - 18, width: 230, height: 18 });
  y -= 42;

  page.drawText('Date:', { x: rightX, y, size: 11, font: fonts.bold });
  const clientDate = form.createTextField('clientDate');
  clientDate.addToPage(page, { x: rightX, y: y - 18, width: 230, height: 18 });

  const pdfBytes = await doc.save();
  fs.writeFileSync(path.join(FORMS_DIR, 'nda-fillable.pdf'), pdfBytes);
  console.log('Created: public/forms/nda-fillable.pdf');
}

async function main() {
  fs.mkdirSync(FORMS_DIR, { recursive: true });
  await buildWaiverPDF();
  await buildNdaPDF();
  console.log('Done — fillable PDFs generated in public/forms/');
}

main().catch(err => { console.error(err); process.exit(1); });
