/**
 * pdfmake document definition — Mutual Non-Disclosure Agreement
 * Carlington & Burling LLP
 */
module.exports = function ndaDefinition({ clientName, clientAddress, effectiveDate } = {}) {
  const name = clientName || '____________________________';
  const addr = clientAddress || '____________________________';
  const effDate = effectiveDate || '____________________________';

  const clause = (num, title, body) => ({
    margin: [0, 18, 0, 0],
    stack: [
      { text: [{ text: num + '. ' + title + '. ', bold: true }, { text: body }], fontSize: 11, lineHeight: 1.7 }
    ]
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [72, 72, 72, 72],

    content: [
      // ── Variant E header (centered, text-only, no navy band) ──
      {
        text: [
          { text: 'Carlington ', font: 'Times', bold: true, color: '#0A1628' },
          { text: '&', font: 'Times', bold: true, color: '#B08D57' },
          { text: ' Burling', font: 'Times', bold: true, color: '#0A1628' }
        ],
        fontSize: 24,
        characterSpacing: 2,
        alignment: 'center',
        margin: [0, 0, 0, 0]
      },

      // ── Gold rule ──
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 1, lineColor: '#B08D57' }], margin: [0, 18, 0, 14] },

      // ── Tagline ──
      { text: 'LLP  ·  ATTORNEYS AT LAW  ·  SINCE 1927', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', characterSpacing: 6, alignment: 'center', margin: [0, 0, 0, 0] },

      // ── Contact ──
      {
        text: [
          { text: '1450 Meridian Hill Lane NW, Washington, DC 20009  ·  202-555-0142  ·  ', fontSize: 7.5, font: 'Helvetica', color: '#5A5A6E' },
          { text: 'covbur.com', fontSize: 7.5, font: 'Helvetica', bold: true, color: '#B08D57' }
        ],
        alignment: 'center',
        margin: [0, 16, 0, 0]
      },

      // ── Header-body separator ──
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 1, lineColor: '#D9D5CC' }], margin: [0, 22, 0, 0] },

      // ── Spacer before title ──
      { text: '', margin: [0, 28, 0, 0] },

      // ── Title ──
      { text: 'MUTUAL NON-DISCLOSURE AGREEMENT', style: 'title' },
      { canvas: [{ type: 'line', x1: 94, y1: 0, x2: 374, y2: 0, lineWidth: 0.5, lineColor: '#B08D57' }], margin: [0, 4, 0, 0] },
      { text: '', margin: [0, 22, 0, 0] },

      // ── Effective Date ──
      {
        margin: [0, 8, 0, 0],
        columns: [
          { width: 110, text: [{ text: 'Effective Date', fontSize: 9, font: 'Helvetica', bold: true, color: '#0A1628' }] },
          { width: '*', text: [{ text: effDate, fontSize: 11, decoration: 'underline', color: '#1A1A1A' }] }
        ]
      },

      { text: '', margin: [0, 20, 0, 0] },

      // ── Recitals ──
      {
        text: [
          'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between ',
          { text: 'Carlington & Burling LLP', bold: true },
          ', with offices at 1450 Meridian Hill Lane NW, Washington, DC 20009 (the "Firm"), and ',
          { text: name, bold: true, decoration: 'underline' },
          ', with an address at ',
          { text: addr, decoration: 'underline' },
          ' (the "Client"), collectively referred to as the "Parties."'
        ],
        fontSize: 11,
        lineHeight: 1.7
      },

      { text: '', margin: [0, 6, 0, 0] },

      // ── Clauses ──
      clause('1', 'Definition of Confidential Information', '"Confidential Information" means any and all information, data, documents, and materials, whether oral, written, or in electronic form, disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), that is identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial information, client lists, legal strategies, and proprietary methodologies.'),
      clause('2', 'Obligations', 'The Receiving Party shall: (a) protect the Disclosing Party\'s Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the purpose of evaluating or engaging in a business relationship between the Parties; (c) limit access to the Confidential Information to those employees and agents who have a need to know and who are bound by confidentiality obligations at least as restrictive as those set forth herein; and (d) not disclose, copy, or distribute the Confidential Information to any third party without the prior written consent of the Disclosing Party.'),
      clause('3', 'Exclusions', 'Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of this Agreement; (b) was rightfully received from a third party without restriction and without breach of any obligation of confidentiality; (c) was independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information; or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives the Disclosing Party prompt written notice and reasonable assistance to seek a protective order.'),
      clause('4', 'Term', 'This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality and non-use set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years thereafter. Upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information and certify such return or destruction in writing.'),
      clause('5', 'Governing Law', 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia, and each Party consents to the personal jurisdiction and venue of such courts.'),

      { text: '', margin: [0, 32, 0, 0] },

      // ── Witness ──
      { text: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date set forth above.', fontSize: 10.5, font: 'Times', bold: true, italics: true, color: '#0A1628', margin: [0, 0, 0, 24] },

      // ── Signature Blocks ──
      {
        columns: [
          {
            width: '45%',
            stack: [
              { text: 'For Carlington & Burling LLP', fontSize: 10.5, font: 'Times', bold: true, color: '#0A1628', margin: [0, 0, 0, 18] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Authorized Signature', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Print Name', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Title', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Date', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 0] }
            ]
          },
          { width: '10%', text: '' },
          {
            width: '45%',
            stack: [
              { text: 'Client', fontSize: 10.5, font: 'Times', bold: true, color: '#0A1628', margin: [0, 0, 0, 18] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Signature', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Print Name', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Title', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Date', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 0] }
            ]
          }
        ]
      }
    ],

    styles: {
      title: { fontSize: 15, bold: true, alignment: 'center', font: 'Times', color: '#0A1628', characterSpacing: 2, margin: [0, 0, 0, 0] }
    },

    defaultStyle: { font: 'Times', fontSize: 11, lineHeight: 1.5, color: '#1A1A1A' },

    footer: function(currentPage, pageCount) {
      return {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 0.75, lineColor: '#D9D5CC' }] },
          { columns: [
            { text: 'MUTUAL NON-DISCLOSURE AGREEMENT', fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', width: '*' },
            { text: 'Confidential · Attorney-Client Privileged', fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', alignment: 'center', width: '*' },
            { text: 'Page ' + currentPage + ' of ' + pageCount, fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', alignment: 'right', width: '*' }
          ], margin: [0, 6, 0, 0] }
        ],
        margin: [72, 0, 72, 30]
      };
    }
  };
};
