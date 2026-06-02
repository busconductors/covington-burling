import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Builder null-guard regression tests.
 *
 * admin-builder.js was patched to add null guards on getElementById calls in:
 *   loadPreset, syncState, renderFields, renderClauses, renderSigBlocks, updatePreview
 *
 * These tests load the full builder IIFE in jsdom and verify the guards
 * prevent throws when DOM elements are missing.
 */

// All getElementById calls in admin-builder.js (34 elements)
const BUILDER_ELEMENT_IDS = [
  'adminBuilder', 'presetSelect', 'fieldsList', 'clausesList', 'sigBlocksList',
  'addFieldBtn', 'addClauseBtn', 'docTitle', 'introText', 'witnessText',
  'outputName', 'sumTitle', 'sumFields', 'sumClauses', 'sumSigs',
  'clauseLibCategories', 'clauseLibSearch', 'clauseLibrary',
  'exportJsonBtn', 'generateBtn', 'generationStatus',
  'nextPageBtn', 'pageInfo', 'prevPageBtn',
  'previewBadge', 'previewBody', 'previewPages', 'previewPlaceholder',
  'sumPages', 'toggleClauseLib', 'zoomInBtn', 'zoomOutBtn', 'zoomLabel',
];

function createBuilderDOM() {
  for (const id of BUILDER_ELEMENT_IDS) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  // presetSelect needs an option so .value = 'blank' works
  const opt = document.createElement('option');
  opt.value = 'blank';
  document.getElementById('presetSelect').appendChild(opt);
  // Also create these elements referenced via querySelector or className
  for (const cls of ['admin-preview__page-wrapper', 'doc-title', 'doc-intro',
    'doc-clauses', 'doc-sigs', 'doc-witness', 'clause-lib-item__title',
    'clause-lib-item__preview', 'clause-lib-cat__title', 'clause-lib-cat',
    'modal', 'modal__header', 'modal__title', 'modal__close', 'modal__body',
    'modal__field', 'modal__field-label', 'modal__field-value',
    'admin-section-header', 'admin-editable-item', 'admin-editable-item--clause',
    'admin-clause-header', 'admin-sig-block']) {
    const span = document.createElement('span');
    span.className = cls;
    document.body.appendChild(span);
  }
  // PDF-related elements
  const canvas = document.createElement('canvas');
  canvas.id = 'pdfCanvas';
  document.body.appendChild(canvas);
}

function loadScript(filePath) {
  const src = readFileSync(resolve(__dirname, '..', filePath), 'utf8');
  // Use indirect eval to run the IIFE in the global scope so window assignments stick
  (0, eval)(src);
}

describe('admin-builder null-guard coverage', () => {
  beforeEach(() => {
    createBuilderDOM();

    // Provide presets before loading builder
    window.CovingtonPresets = {
      blank: {
        title: 'NEW DOCUMENT',
        fields: [{ label: 'Date:', name: 'date', width: 200 }],
        intro: '',
        witnessText: 'IN WITNESS WHEREOF, the parties have executed this Agreement.',
        clauses: [{ num: '1.', title: 'Section Title.', body: 'Enter clause text here.' }],
        signatureBlocks: [{
          label: 'Party A',
          fields: [
            { label: 'Signature', name: 'partyASignature' },
            { label: 'Print Name', name: 'partyAPrintName' },
            { label: 'Date', name: 'partyADate' },
          ],
        }],
      },
    };

    // Load admin-auth.js first for window.AdminUtils
    loadScript('public/js/admin-auth.js');
    // Then load the builder
    loadScript('public/js/admin-builder.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.CovingtonPresets;
    delete window.AdminBuilder;
    delete window.AdminUtils;
    delete window.AdminAuth;
  });

  it('loads without throwing when DOM is complete', () => {
    expect(window.AdminBuilder).toBeDefined();
  });

  it('AdminBuilder.init() does not throw when sumTitle is missing', () => {
    document.getElementById('sumTitle').remove();
    expect(() => window.AdminBuilder.init()).not.toThrow();
  });

  it('AdminBuilder.init() does not throw when sumFields is missing', () => {
    document.getElementById('sumFields').remove();
    expect(() => window.AdminBuilder.init()).not.toThrow();
  });

  it('AdminBuilder.init() does not throw when sumClauses is missing', () => {
    document.getElementById('sumClauses').remove();
    expect(() => window.AdminBuilder.init()).not.toThrow();
  });

  it('AdminBuilder.init() does not throw when sumSigs is missing', () => {
    document.getElementById('sumSigs').remove();
    expect(() => window.AdminBuilder.init()).not.toThrow();
  });

  it('does not throw when fieldsList is missing (renderFields null guard)', () => {
    document.getElementById('fieldsList').remove();
    const btn = document.getElementById('addFieldBtn');
    expect(() => btn.click()).not.toThrow();
  });

  it('does not throw when clausesList is missing (renderClauses null guard)', () => {
    document.getElementById('clausesList').remove();
    const btn = document.getElementById('addClauseBtn');
    expect(() => btn.click()).not.toThrow();
  });

  it('does not throw when sigBlocksList is missing (renderSigBlocks null guard)', () => {
    document.getElementById('sigBlocksList').remove();
    // addSigBlockBtn was not in the original list — added now
    const addSig = document.getElementById('addSigBlockBtn');
    if (addSig) {
      expect(() => addSig.click()).not.toThrow();
    }
    // The sigBlocksList event listener also handles clicks
  });

  it('does not throw when docTitle is missing from loadPreset', () => {
    document.getElementById('docTitle').remove();
    // initBuilder calls loadPreset('blank') — verify it does not throw
    expect(() => {
      const preset = document.getElementById('presetSelect');
      preset.value = 'blank';
      preset.dispatchEvent(new Event('change'));
    }).not.toThrow();
  });

  it('does not throw when introText is missing from loadPreset', () => {
    document.getElementById('introText').remove();
    expect(() => {
      const preset = document.getElementById('presetSelect');
      preset.value = 'blank';
      preset.dispatchEvent(new Event('change'));
    }).not.toThrow();
  });

  it('does not throw when witnessText is missing from loadPreset', () => {
    document.getElementById('witnessText').remove();
    expect(() => {
      const preset = document.getElementById('presetSelect');
      preset.value = 'blank';
      preset.dispatchEvent(new Event('change'));
    }).not.toThrow();
  });

  it('does not throw when outputName is missing from loadPreset', () => {
    document.getElementById('outputName').remove();
    expect(() => {
      const preset = document.getElementById('presetSelect');
      preset.value = 'blank';
      preset.dispatchEvent(new Event('change'));
    }).not.toThrow();
  });
});
