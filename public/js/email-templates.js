/**
 * Carlington & Burling — branded email template (single source of truth).
 *
 * Dual-mode module: loaded via <script> in the admin preview (window.EmailTemplates)
 * and via require() in backend/services/email.js. The admin's live preview and
 * the actually-sent email run THIS SAME code — they cannot drift.
 *
 * Keep this file dependency-free, pure string-building. Adding a require()
 * or DOM access here breaks one of the two runtimes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EmailTemplates = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emailHeader() {
    return '<td style="padding:36px 40px 0;text-align:center;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:24px;font-weight:bold;color:#0A1628;letter-spacing:0.5px;">Carlington <span style="color:#B08D57;">&amp;</span> Burling</div>'
      + '<hr style="border:none;border-top:1px solid #B08D57;margin:14px 80px 10px;">'
      + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;letter-spacing:4px;color:#5A5A6E;text-transform:uppercase;">LLP &nbsp;&#183;&nbsp; ATTORNEYS AT LAW &nbsp;&#183;&nbsp; SINCE 1919</div>'
      + '<hr style="border:none;border-top:1px solid #D9D5CC;margin:18px 0 0;">'
      + '</td></tr>';
  }

  function emailFooter() {
    return '<td style="background-color:#FAF9F6;padding:26px 40px 30px;border-top:1px solid #E4E0D8;text-align:center;font-family:Arial,Helvetica,sans-serif;">'
      + '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;font-weight:bold;color:#0A1628;letter-spacing:0.3px;">Carlington &amp; Burling LLP</div>'
      + '<div style="font-size:12px;color:#5A6577;margin-top:8px;line-height:1.6;">850 Tenth Street NW, Washington, DC 20001<br>'
      + '202&#8209;662&#8209;6000 &nbsp;|&nbsp; <a href="https://carlingtonburling.com" style="color:#B08D57;text-decoration:none;">carlingtonburling.com</a></div>'
      + '<div style="font-size:10px;color:#9AA3B2;margin-top:12px;letter-spacing:0.5px;text-transform:uppercase;">'
      + 'SINCE 1919 &nbsp;&#183;&nbsp; This message is confidential &amp; attorney&#8209;client privileged</div>'
      + '</td>';
  }

  function buildEmailLayout(headerHtml, bodyHtml) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + '<body style="margin:0;padding:0;background-color:#ECECEC;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ECECEC;padding:24px 0;">'
      + '<tr><td align="center">'
      + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:6px;overflow:hidden;">'
      + '<tr>' + headerHtml + '</tr>'
      + '<tr><td style="padding:34px 40px;font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;line-height:1.7;color:#1A1A1A;">' + bodyHtml + '</td></tr>'
      + '<tr>' + emailFooter() + '</tr>'
      + '</table>'
      + '</td></tr></table>'
      + '</body></html>';
  }

  function buildEmailHtml(body, options) {
    var opts = options || {};
    var bodyHtml = escapeHtml(body)
      .split(/\n\n+/)
      .map(function (p) {
        var t = p.trim();
        if (!t) return '';
        return '<p style="margin:0 0 16px;">' + t.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');

    if (!bodyHtml && opts.placeholder) {
      bodyHtml = '<p style="margin:0;font-family:Georgia,\'Times New Roman\',Times,serif;font-size:15px;line-height:1.7;color:#999;">'
        + 'Email body will appear here&hellip;</p>';
    }

    return buildEmailLayout(emailHeader(), bodyHtml);
  }

  return {
    escapeHtml: escapeHtml,
    emailHeader: emailHeader,
    emailFooter: emailFooter,
    buildEmailLayout: buildEmailLayout,
    buildEmailHtml: buildEmailHtml,
  };
});
