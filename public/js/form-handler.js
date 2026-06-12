/**
 * Shared form validation + submit engine for the public forms
 * (contact-form.js and waiver-request.js pass their own config).
 *
 * Dual-mode: window.FormHandler in the browser, module.exports in tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FormHandler = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var defaultMessages = {
    required: 'This field is required.',
    email: 'Please enter a valid email address.',
    'minLength:2': 'Please enter at least 2 characters.',
    'minLength:10': 'Please provide at least 10 characters.',
    requiredCheckbox: 'You must consent to continue.',
    phone: 'Please enter a valid phone number.',
  };

  function validateValue(rules, val, messages) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];

      if (rule === 'required' && !val) {
        return messages.required || defaultMessages.required;
      }
      if (rule === 'requiredCheckbox' && !val) {
        return messages.requiredCheckbox || defaultMessages.requiredCheckbox;
      }
      if (rule === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return messages.email || defaultMessages.email;
      }
      if (rule === 'optionalPhone' && val && !/^[+]?[\d\s()\-.]{7,20}$/.test(val)) {
        return messages.phone || defaultMessages.phone;
      }
      if (rule.indexOf('minLength:') === 0) {
        var min = parseInt(rule.split(':')[1], 10);
        if (val && val.length < min) {
          return messages[rule] || defaultMessages[rule] || ('Please enter at least ' + min + ' characters.');
        }
      }
    }
    return null;
  }

  /**
   * config = {
   *   form, formFields, success, resetBtn, submitError: elements
   *   fields: { name: { el, error, rules } ... }
   *   messages: rule -> message overrides
   *   buildPayload(fields) -> request body object
   *   endpoint: API path
   *   submitLabel / sendingLabel: button text states
   *   genericError / timeoutError: messages
   * }
   */
  function init(config) {
    var form = config.form;
    var formFields = config.formFields;
    var success = config.success;
    if (!form || !formFields || !success) return;

    var fields = config.fields;
    var messages = config.messages || {};

    function showError(fieldName, msg) {
      var f = fields[fieldName];
      f.el.classList.add('form-input--error');
      if (f.error) {
        f.error.textContent = msg;
        f.error.classList.add('form-error-msg--visible');
      }
    }

    function clearError(fieldName) {
      var f = fields[fieldName];
      f.el.classList.remove('form-input--error');
      if (f.error) {
        f.error.textContent = '';
        f.error.classList.remove('form-error-msg--visible');
      }
    }

    function validateField(fieldName) {
      var f = fields[fieldName];
      var val = (f.el.type === 'checkbox') ? f.el.checked : f.el.value.trim();
      var msg = validateValue(f.rules, val, messages);
      if (msg) {
        showError(fieldName, msg);
        return false;
      }
      clearError(fieldName);
      return true;
    }

    Object.keys(fields).forEach(function (name) {
      var f = fields[name];
      if (!f.el) return;
      f.el.addEventListener('input', function () { validateField(name); });
      f.el.addEventListener('change', function () { validateField(name); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var firstInvalid = null;

      Object.keys(fields).forEach(function (name) {
        if (!fields[name].el) return;
        if (!validateField(name)) {
          valid = false;
          if (!firstInvalid) firstInvalid = fields[name].el;
        }
      });

      if (!valid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = config.sendingLabel || 'Sending…';
      }
      if (config.submitError) {
        config.submitError.textContent = '';
        config.submitError.classList.remove('form-error-msg--visible');
      }

      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 15000);

      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.buildPayload(fields)),
        signal: controller.signal
      })
        .then(function (res) {
          clearTimeout(timeoutId);
          if (!res.ok) return res.json().then(function (err) { throw err; });
          return res.json();
        })
        .then(function () {
          formFields.style.display = 'none';
          success.classList.add(config.successClass || 'form-success--visible');
          if (config.scrollToSuccess !== false) {
            success.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        })
        .catch(function (err) {
          clearTimeout(timeoutId);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = config.submitLabel || 'Submit';
          }
          var msg = err && err.error ? err.error : (config.genericError || 'Something went wrong. Please try again.');
          if (err && err.name === 'AbortError') {
            msg = config.timeoutError || 'Request timed out. Please check your connection and try again.';
          }
          if (config.submitError) {
            config.submitError.textContent = msg;
            config.submitError.classList.add('form-error-msg--visible');
          }
        });
    });

    if (config.resetBtn) {
      config.resetBtn.addEventListener('click', function () {
        form.reset();
        Object.keys(fields).forEach(function (name) {
          if (fields[name].el) clearError(name);
        });
        success.classList.remove(config.successClass || 'form-success--visible');
        formFields.style.display = '';
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = false; btn.textContent = config.submitLabel || 'Submit'; }
      });
    }
  }

  return { init: init, validateValue: validateValue };
});
