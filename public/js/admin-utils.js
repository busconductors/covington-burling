/**
 * XSS escape utilities shared by all admin modules.
 *
 * Dual-mode: window.AdminUtils in the browser, module.exports in tests —
 * tests import THIS file, so test and production can never drift.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdminUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    escHtml: function (s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    escAttr: function (s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };
});
