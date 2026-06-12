/**
 * Carlington & Burling LLP — Document Template Presets
 * Loaded by the admin document builder. Each preset defines a complete
 * document: title, fields, clauses, and signature blocks.
 */
window.CarlingtonPresets = {

  waiver: {
    title: 'WAIVER AND RELEASE OF LIABILITY',
    fields: [
      { label: 'Client Name:', name: 'clientName', width: 370 },
      { label: 'Date:', name: 'date', width: 200 },
      { label: 'Matter:', name: 'matter', width: 408 },
    ],
    intro: '',
    witnessText: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.',
    clauses: [
      {
        num: '1.', title: 'Acknowledgment of Risk.',
        body: 'The Client acknowledges that all legal matters involve inherent risks and uncertainties. The Client understands that Carlington & Burling LLP makes no guarantees regarding specific outcomes and that past results do not guarantee future results. The Client has been advised of the potential risks associated with the matter described above and voluntarily assumes all such risks.',
      },
      {
        num: '2.', title: 'Release.',
        body: 'To the fullest extent permitted by law, the Client hereby releases, waives, and discharges Carlington & Burling LLP, its partners, associates, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or related to the matter described above, except for claims arising from gross negligence or willful misconduct on the part of the Firm.',
      },
      {
        num: '3.', title: 'Indemnification.',
        body: 'The Client agrees to indemnify, defend, and hold harmless Carlington & Burling LLP, its partners, associates, employees, and agents from and against any and all third-party claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or in connection with the Client\'s actions or omissions in connection with the matter described above.',
      },
      {
        num: '4.', title: 'Governing Law.',
        body: 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising under this Agreement shall be resolved exclusively in the courts of the District of Columbia.',
      },
      {
        num: '5.', title: 'Entire Agreement.',
        body: 'This document constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written. No modification or amendment to this Agreement shall be effective unless in writing and signed by both parties.',
      },
    ],
    signatureBlocks: [
      {
        label: 'Client',
        fields: [
          { label: 'Signature', name: 'clientSignature' },
          { label: 'Print Name', name: 'clientPrintName' },
          { label: 'Date', name: 'clientSigDate' },
        ],
      },
      {
        label: 'For Carlington & Burling LLP',
        fields: [
          { label: 'Signature', name: 'firmSignature' },
          { label: 'Print Name', name: 'firmPrintName' },
          { label: 'Date', name: 'firmSigDate' },
        ],
      },
    ],
  },

  nda: {
    title: 'MUTUAL NON-DISCLOSURE AGREEMENT',
    fields: [
      { label: 'Effective Date:', name: 'effectiveDate', width: 200 },
      { label: 'Client Name:', name: 'clientName', width: 370 },
      { label: 'Client Address:', name: 'clientAddress', width: 360 },
    ],
    intro: 'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and between Carlington & Burling LLP, with offices at 1450 Meridian Hill Lane NW, Washington, DC 20009 (the "Firm"), and the Client identified above (collectively, the "Parties").',
    witnessText: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.',
    clauses: [
      {
        num: '1.', title: 'Definition of Confidential Information.',
        body: '"Confidential Information" means any and all information, data, documents, and materials, whether oral, written, or in electronic form, disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), that is identified as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, but is not limited to, trade secrets, business plans, financial information, client lists, legal strategies, and proprietary methodologies.',
      },
      {
        num: '2.', title: 'Obligations.',
        body: 'The Receiving Party shall: (a) protect the Disclosing Party\'s Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for the purpose of evaluating or engaging in a business relationship between the Parties; (c) limit access to the Confidential Information to those employees and agents who have a need to know and who are bound by confidentiality obligations at least as restrictive as those set forth herein; and (d) not disclose, copy, or distribute the Confidential Information to any third party without the prior written consent of the Disclosing Party.',
      },
      {
        num: '3.', title: 'Exclusions.',
        body: 'Confidential Information does not include information that the Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of this Agreement; (b) was rightfully received from a third party without restriction and without breach of any obligation of confidentiality; (c) was independently developed by the Receiving Party without use of or reference to the Disclosing Party\'s Confidential Information; or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives the Disclosing Party prompt written notice and reasonable assistance to seek a protective order.',
      },
      {
        num: '4.', title: 'Term.',
        body: 'This Agreement shall remain in effect for a period of two (2) years from the Effective Date. The obligations of confidentiality and non-use set forth herein shall survive the expiration or termination of this Agreement for a period of three (3) years thereafter. Upon the written request of the Disclosing Party, the Receiving Party shall promptly return or destroy all copies of the Confidential Information and certify such return or destruction in writing.',
      },
      {
        num: '5.', title: 'Governing Law.',
        body: 'This Agreement shall be governed by and construed in accordance with the laws of the District of Columbia, without regard to its conflict of laws principles. Any dispute arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in the District of Columbia, and each Party consents to the personal jurisdiction and venue of such courts.',
      },
    ],
    signatureBlocks: [
      {
        label: 'For Carlington & Burling LLP',
        fields: [
          { label: 'Signature', name: 'firmSignature' },
          { label: 'Print Name', name: 'firmPrintName' },
          { label: 'Title', name: 'firmTitle' },
          { label: 'Date', name: 'firmDate' },
        ],
      },
      {
        label: 'Client',
        fields: [
          { label: 'Signature', name: 'clientSignature' },
          { label: 'Print Name', name: 'clientPrintName' },
          { label: 'Title', name: 'clientTitle' },
          { label: 'Date', name: 'clientDate' },
        ],
      },
    ],
  },

  blank: {
    title: 'NEW DOCUMENT',
    fields: [
      { label: 'Date:', name: 'date', width: 200 },
    ],
    intro: '',
    witnessText: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date set forth above.',
    clauses: [
      { num: '1.', title: 'Section Title.', body: 'Enter clause text here.' },
    ],
    signatureBlocks: [
      {
        label: 'Party A',
        fields: [
          { label: 'Signature', name: 'partyASignature' },
          { label: 'Print Name', name: 'partyAPrintName' },
          { label: 'Date', name: 'partyADate' },
        ],
      },
      {
        label: 'For Carlington & Burling LLP',
        fields: [
          { label: 'Signature', name: 'firmSignature' },
          { label: 'Print Name', name: 'firmPrintName' },
          { label: 'Date', name: 'firmDate' },
        ],
      },
    ],
  },

};
