import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import axe from 'axe-core';

/**
 * Structural WCAG checks per static page via axe-core in jsdom.
 *
 * jsdom can't compute color contrast or layout, so those rules are disabled —
 * this pins the regression class that actually bit this project (the admin
 * page shipping with 1 ARIA attribute vs 16-30 on public pages): labels,
 * roles, landmarks, alt text, link names.
 */

const PAGES = [
  'public/index.html',
  'public/about.html',
  'public/practice.html',
  'public/contact.html',
  'public/waiver-nda.html',
  'public/404.html',
  'public/admin/index.html',
];

// Rules that need real layout/paint and false-positive in jsdom.
const DISABLED_RULES = {
  'color-contrast': { enabled: false },
  'scrollable-region-focusable': { enabled: false },
};

function loadPage(relPath) {
  const html = readFileSync(resolve(__dirname, '..', relPath), 'utf8');
  document.open();
  document.write(html);
  document.close();
}

describe.each(PAGES)('a11y: %s', (page) => {
  it('has no structural WCAG A/AA violations (axe-core)', async () => {
    loadPage(page);

    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: DISABLED_RULES,
      // jsdom has no real frame messaging; the email-preview iframe is
      // covered by the email-template tests instead
      iframes: false,
    });

    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));

    expect(summary).toEqual([]);
  }, 30000);
});
