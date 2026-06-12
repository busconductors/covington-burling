const fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

// pdfmake (and its font machinery) is the heaviest dependency in the
// backend; loading it lazily keeps non-PDF endpoints' cold starts cheap.
let printer = null;

function getPrinter() {
  if (!printer) {
    const PdfPrinter = require('pdfmake');
    printer = new PdfPrinter(fonts);
  }
  return printer;
}

function streamPdf(res, doc, filename) {
  const pdfDoc = getPrinter().createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  pdfDoc.pipe(res);
  pdfDoc.end();
}

module.exports = { streamPdf };
