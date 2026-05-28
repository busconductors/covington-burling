const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const PdfPrinter = require('pdfmake');

const fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
};

const printer = new PdfPrinter(fonts);
const waiverDefinition = require('./waiver-definition');
const ndaDefinition = require('./nda-definition');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate-waiver', (req, res) => {
  const { clientName, date, matter } = req.body || {};
  const doc = waiverDefinition({ clientName, date, matter });
  const pdfDoc = printer.createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="waiver-release-of-liability.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
});

app.post('/api/generate-nda', (req, res) => {
  const { clientName, clientAddress, effectiveDate } = req.body || {};
  const doc = ndaDefinition({ clientName, clientAddress, effectiveDate });
  const pdfDoc = printer.createPdfKitDocument(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="mutual-nda.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
});

exports.api = onRequest({ cors: true }, app);
