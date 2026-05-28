const express = require('express');
const cors = require('cors');
const path = require('path');
const PdfPrinter = require('pdfmake');

const fonts = {
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic'
  }
};

const printer = new PdfPrinter(fonts);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/latex', express.static(path.join(__dirname, 'latex')));

const waiverDefinition = require('./pdf-templates/waiver-definition');
const ndaDefinition = require('./pdf-templates/nda-definition');

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

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Covington & Burling LLP server running on port ' + PORT);
});
