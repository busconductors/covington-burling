/**
 * pdfmake document definition for Mutual Non-Disclosure Agreement
 * Covington & Burling LLP
 */
const path = require('path');

module.exports = function ndaDefinition({ clientName, clientAddress, effectiveDate } = {}) {
  const name = clientName || '____________________________';
  const addr = clientAddress || '____________________________';
  const effDate = effectiveDate || '____________________________';

  return {
    pageSize: 'LETTER',
    pageMargins: [72, 72, 72, 72],
    content: [
      // Stacked logo lockup
      { image: path.join(__dirname, '..', 'public', 'images', 'brand', 'logo_stacked.png'), width: 158, alignment: 'center', margin: [0, 0, 0, 4] },
      // Contact line — covbur.com in gold
      { text: [
        { text: '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  ', fontSize: 8, color: '#5A5A6E' },
        { text: 'covbur.com', fontSize: 8, color: '#B08D57' }
      ], alignment: 'center', margin: [0, 0, 0, 4] },
      // Light rule divider
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 1, lineColor: '#D9D5CC' }], margin: [0, 4, 0, 8] },

      { text: 'MUTUAL NON-DISCLOSURE AGREEMENT', style: 'title' },
      { text: '', margin: [0, 12, 0, 0] },

      {
        text: [
          { text: 'Effective Date: ', bold: true },
          { text: effDate, decoration: 'underline' }
        ],
        fontSize: 11,
        margin: [0, 6, 0, 0]
      },

      { text: '', margin: [0, 8, 0, 0] },

      {
        text: [
          'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between ',
          { text: 'Covington & Burling LLP', bold: true },
          ', with offices at 850 Tenth Street NW, Washington, DC 20001 (the "Firm"), and ',
          { text: name, bold: true, decoration: 'underline' },
          ', with an address at ',
          { text: addr, decoration: 'underline' },
          ' (the "Client"), collectively referred to as the "Parties."'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 6, 0, 0]
      },

      { text: '', margin: [0, 14, 0, 0] },

      {
        text: [
          { text: '1. Definition of Confidential Information. ', bold: true },
          '"Confidential Information" means any and all information, data, documents, and materials, whether oral, written, or in electronic form, disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), that is identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial information, client lists, legal strategies, and proprietary methodologies.'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 8, 0, 0]
      },
      {
        text: [
          { text: '2. Obligations. ', bold: true },
          'The Receiving Party shall: (a) protect the Disclosing Party\'s Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the purpose of evaluating or engaging in a business relationship between the Parties; (c) limit access to the Confidential Information to those employees and agents who have a need to know and who are bound by confidentiality obligations at least as restrictive as those set forth herein; and (d) not disclose, copy, or distribute the Confidential Information to any third party without the prior written consent of the Disclosing Party.'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 8, 0, 0]
      },
      {
        text: [
          { text: '3. Exclusions. ', bold: true },
          'Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of this Agreement; (b) was rightfully received from a third party without restriction and without breach of any obligation of confidentiality; (c) was independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information; or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives the Disclosing Party prompt written notice and reasonable assistance to seek a protective order.'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 8, 0, 0]
      },
      {
        text: [
          { text: '4. Term. ', bold: true },
          'This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality and non-use set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years thereafter. Upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information and certify such return or destruction in writing.'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 8, 0, 0]
      },
      {
        text: [
          { text: '5. Governing Law. ', bold: true },
          'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia, and each Party consents to the personal jurisdiction and venue of such courts.'
        ],
        fontSize: 11,
        lineHeight: 1.6,
        margin: [0, 8, 0, 0]
      },

      { text: '', margin: [0, 24, 0, 0] },

      {
        columns: [
          {
            width: '45%',
            text: [
              { text: 'Covington & Burling LLP', fontSize: 11, bold: true },
              { text: '\n\n_______________________________', fontSize: 11 },
              { text: '\nAuthorized Signature', fontSize: 10, color: '#5A5A6E' },
              { text: '\n\nPrint Name: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 },
              { text: '\nTitle: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 },
              { text: '\nDate: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 }
            ]
          },
          { width: '10%', text: '' },
          {
            width: '45%',
            text: [
              { text: 'Client', fontSize: 11, bold: true },
              { text: '\n\n_______________________________', fontSize: 11 },
              { text: '\nClient Signature', fontSize: 10, color: '#5A5A6E' },
              { text: '\n\nPrint Name: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 },
              { text: '\nTitle: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 },
              { text: '\nDate: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 }
            ]
          }
        ]
      }
    ],
    styles: {
      firmHeader: { fontSize: 14, bold: true, alignment: 'center', font: 'Times' },
      firmAddress: { fontSize: 10, alignment: 'center', color: '#5A5A6E', margin: [0, 2, 0, 0] },
      title: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 8, 0, 0] }
    },
    footer: function(currentPage, pageCount) {
      return {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 468, y2: 0, lineWidth: 1, lineColor: '#D9D5CC' }] },
          { columns: [
            { text: 'MUTUAL NON-DISCLOSURE AGREEMENT', fontSize: 7, color: '#5A5A6E', width: '*' },
            { text: 'Confidential · Attorney-Client Privileged', fontSize: 7, color: '#5A5A6E', alignment: 'center', width: '*' },
            { text: 'Page ' + currentPage + ' of ' + pageCount, fontSize: 7, color: '#5A5A6E', alignment: 'right', width: '*' }
          ], margin: [0, 4, 0, 0] }
        ],
        margin: [72, 0, 72, 30]
      };
    },
    defaultStyle: { font: 'Times', fontSize: 11, lineHeight: 1.5 }
  };
};
