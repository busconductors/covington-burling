/**
 * pdfmake document definition — Waiver and Release of Liability
 * Carlington & Burling LLP
 */
module.exports = function waiverDefinition({ clientName, date, matter } = {}) {
  const name = clientName || '____________________________';
  const d = date || '____________________________';
  const m = matter || '____________________________';

  const field = (label, value) => ({
    margin: [0, 14, 0, 0],
    columns: [
      { width: 110, text: [{ text: label, fontSize: 9, font: 'Helvetica', bold: true, color: '#0A1628' }] },
      { width: '*', text: [{ text: value, fontSize: 11, decoration: 'underline', color: '#1A1A1A' }] }
    ]
  });

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
      { text: 'LLP  ·  ATTORNEYS AT LAW  ·  SINCE 1919', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', characterSpacing: 6, alignment: 'center', margin: [0, 0, 0, 0] },

      // ── Contact ──
      {
        text: [
          { text: '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  ', fontSize: 7.5, font: 'Helvetica', color: '#5A5A6E' },
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
      { text: 'WAIVER AND RELEASE OF LIABILITY', style: 'title' },
      { canvas: [{ type: 'line', x1: 94, y1: 0, x2: 374, y2: 0, lineWidth: 0.5, lineColor: '#B08D57' }], margin: [0, 4, 0, 0] },
      { text: '', margin: [0, 22, 0, 0] },

      // ── Fields ──
      field('Client Name', name),
      field('Date', d),
      field('Matter', m),

      { text: '', margin: [0, 22, 0, 0] },

      // ── Intro ──
      { text: 'This Waiver and Release of Liability ("Agreement") is entered into by and between the undersigned client ("Client") and Carlington & Burling LLP, a District of Columbia limited liability partnership ("Firm").', fontSize: 11, lineHeight: 1.7 },

      // ── Clauses ──
      clause('1', 'Acknowledgment of Risk', 'The Client acknowledges that all legal matters involve inherent risks and uncertainties. The Client understands that Carlington & Burling LLP makes no guarantees regarding specific outcomes and that past results do not guarantee future results. The Client has been advised of the potential risks associated with the matter described above and voluntarily assumes all such risks.'),
      clause('2', 'Release', 'To the fullest extent permitted by law, the Client hereby releases, waives, and discharges Carlington & Burling LLP, its partners, associates, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or related to the matter described above, except for claims arising from gross negligence or willful misconduct on the part of the Firm.'),
      clause('3', 'Indemnification', 'The Client agrees to indemnify, defend, and hold harmless Carlington & Burling LLP, its partners, associates, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with the Client\'s actions or omissions in connection with the matter described above.'),
      clause('4', 'Governing Law', 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising under this Agreement shall be resolved exclusively in the courts of the District of Columbia.'),
      clause('5', 'Entire Agreement', 'This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.'),

      { text: '', margin: [0, 32, 0, 0] },

      // ── Witness ──
      { text: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.', fontSize: 10.5, font: 'Times', bold: true, italics: true, color: '#0A1628', margin: [0, 0, 0, 24] },

      // ── Signature Blocks ──
      {
        columns: [
          {
            width: '45%',
            stack: [
              { text: 'Client', fontSize: 10.5, font: 'Times', bold: true, color: '#0A1628', margin: [0, 0, 0, 18] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Signature', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Print Name', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Date', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 0] }
            ]
          },
          { width: '10%', text: '' },
          {
            width: '45%',
            stack: [
              { text: 'For Carlington & Burling LLP', fontSize: 10.5, font: 'Times', bold: true, color: '#0A1628', margin: [0, 0, 0, 18] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Authorized Signature', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
              { text: '_______________________________', fontSize: 11 },
              { text: 'Print Name', fontSize: 8, font: 'Helvetica', color: '#5A5A6E', margin: [0, 2, 0, 16] },
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
            { text: 'WAIVER AND RELEASE OF LIABILITY', fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', width: '*' },
            { text: 'Confidential · Attorney-Client Privileged', fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', alignment: 'center', width: '*' },
            { text: 'Page ' + currentPage + ' of ' + pageCount, fontSize: 7.5, font: 'Helvetica', color: '#8A8A9E', alignment: 'right', width: '*' }
          ], margin: [0, 6, 0, 0] }
        ],
        margin: [72, 0, 72, 30]
      };
    }
  };
};
