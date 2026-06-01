/**
 * pdfmake document definition for Waiver and Release of Liability
 * Covington & Burling LLP
 */
module.exports = function waiverDefinition({ clientName, date, matter } = {}) {
  const name = clientName || '____________________________';
  const d = date || '____________________________';
  const m = matter || '____________________________';

  const line = (label, value) => ({
    margin: [0, 8, 0, 0],
    text: [
      { text: label + ': ', bold: true, fontSize: 11 },
      { text: value, fontSize: 11, decoration: 'underline' }
    ]
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [72, 72, 72, 72],
    content: [
      { text: 'Covington & Burling LLP', style: 'firmHeader' },
      { text: '850 Tenth Street NW, Washington, DC 20001', style: 'firmAddress' },
      { text: '', margin: [0, 4, 0, 0] },
      { text: 'WAIVER AND RELEASE OF LIABILITY', style: 'title' },
      { text: '', margin: [0, 12, 0, 0] },

      line('Client Name', name),
      line('Date', d),
      line('Matter', m),

      { text: '', margin: [0, 16, 0, 0] },

      {
        text: [
          { text: '1. Acknowledgment of Risk. ', bold: true },
          'The Client acknowledges that all legal matters involve inherent risks and uncertainties. The Client understands that Covington & Burling LLP makes no guarantees regarding specific outcomes and that past results do not guarantee future results. The Client has been advised of the potential risks associated with the matter described above and voluntarily assumes all such risks.'
        ],
        margin: [0, 8, 0, 0],
        fontSize: 11,
        lineHeight: 1.6
      },
      {
        text: [
          { text: '2. Release. ', bold: true },
          'To the fullest extent permitted by law, the Client hereby releases, waives, and discharges Covington & Burling LLP, its partners, associates, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or related to the matter described above, except for claims arising from gross negligence or willful misconduct on the part of the Firm.'
        ],
        margin: [0, 8, 0, 0],
        fontSize: 11,
        lineHeight: 1.6
      },
      {
        text: [
          { text: '3. Indemnification. ', bold: true },
          'The Client agrees to indemnify, defend, and hold harmless Covington & Burling LLP, its partners, associates, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with the Client\'s actions or omissions in connection with the matter described above.'
        ],
        margin: [0, 8, 0, 0],
        fontSize: 11,
        lineHeight: 1.6
      },
      {
        text: [
          { text: '4. Governing Law. ', bold: true },
          'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising under this Agreement shall be resolved exclusively in the courts of the District of Columbia.'
        ],
        margin: [0, 8, 0, 0],
        fontSize: 11,
        lineHeight: 1.6
      },
      {
        text: [
          { text: '5. Entire Agreement. ', bold: true },
          'This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.'
        ],
        margin: [0, 8, 0, 0],
        fontSize: 11,
        lineHeight: 1.6
      },

      { text: '', margin: [0, 24, 0, 0] },

      {
        columns: [
          {
            width: '45%',
            text: [
              { text: '_______________________________', fontSize: 11 },
              { text: '\nClient Signature', fontSize: 10, color: '#5A5A6E' },
              { text: '\n\nPrint Name: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 },
              { text: '\nDate: ', fontSize: 10, color: '#5A5A6E' },
              { text: '_______________________________', fontSize: 10 }
            ]
          },
          { width: '10%', text: '' },
          {
            width: '45%',
            text: [
              { text: 'For Covington & Burling LLP', fontSize: 11, bold: true },
              { text: '\n\n_______________________________', fontSize: 11 },
              { text: '\nAuthorized Signature', fontSize: 10, color: '#5A5A6E' },
              { text: '\n\nPrint Name: ', fontSize: 10, color: '#5A5A6E' },
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
    defaultStyle: { font: 'Times', fontSize: 11, lineHeight: 1.5 }
  };
};
