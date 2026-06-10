(function () {
  'use strict';

  var form = document.getElementById('requestForm');
  var formFields = document.getElementById('requestFormFields');
  var success = document.getElementById('requestSuccess');
  var resetBtn = document.getElementById('requestReset');
  var submitError = document.getElementById('req-submit-error');
  if (!form || !formFields || !success) return;

  var fields = {
    name:     { el: document.getElementById('req-name'),     error: document.getElementById('req-name-error'),     rules: ['required', 'minLength:2'] },
    email:    { el: document.getElementById('req-email'),    error: document.getElementById('req-email-error'),    rules: ['required', 'email'] },
    phone:    { el: document.getElementById('req-phone'),    error: document.getElementById('req-phone-error'),    rules: ['optionalPhone'] },
    company:  { el: document.getElementById('req-company'),  error: null, rules: [] },
    formType: { el: document.getElementById('req-formType'), error: document.getElementById('req-formType-error'), rules: ['required'] },
    matter:   { el: document.getElementById('req-matter'),   error: document.getElementById('req-matter-error'),   rules: ['required', 'minLength:10'] },
    consent:  { el: document.getElementById('req-consent'),  error: document.getElementById('req-consent-error'),  rules: ['requiredCheckbox'] }
  };

  var errorMessages = {
    required: 'This field is required.',
    email: 'Please enter a valid email address.',
    'minLength:2': 'Please enter at least 2 characters.',
    'minLength:10': 'Please provide at least 10 characters describing your matter.',
    requiredCheckbox: 'You must consent to continue.',
    optionalPhone: ''
  };

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

    for (var i = 0; i < f.rules.length; i++) {
      var rule = f.rules[i];

      if (rule === 'required' && !val) {
        showError(fieldName, errorMessages.required);
        return false;
      }
      if (rule === 'requiredCheckbox' && !val) {
        showError(fieldName, errorMessages.requiredCheckbox);
        return false;
      }
      if (rule === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        showError(fieldName, errorMessages.email);
        return false;
      }
      if (rule === 'optionalPhone' && val && !/^[+]?[\d\s()\-.]{7,20}$/.test(val)) {
        showError(fieldName, 'Please enter a valid phone number.');
        return false;
      }
      if (rule.indexOf('minLength:') === 0) {
        var min = parseInt(rule.split(':')[1], 10);
        if (val && val.length < min) {
          showError(fieldName, errorMessages[rule]);
          return false;
        }
      }
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
      if (!validateField(name)) {
        valid = false;
        if (!firstInvalid) firstInvalid = fields[name].el;
      }
    });

    if (!valid) {
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var formData = {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      phone: fields.phone.el.value.trim(),
      company: fields.company.el.value.trim(),
      formType: fields.formType.el.value,
      matterDescription: fields.matter.el.value.trim()
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }
    if (submitError) {
      submitError.textContent = '';
      submitError.classList.remove('form-error-msg--visible');
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 15000);

    fetch('https://covington-api.onrender.com/api/request-forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) return res.json().then(function (err) { throw err; });
        return res.json();
      })
      .then(function () {
        formFields.style.display = 'none';
        success.classList.add('request-success--visible');
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Request';
        }
        var msg = err && err.error ? err.error : 'Something went wrong. Please try again or contact our office at 202-662-6000.';
        if (err && err.name === 'AbortError') {
          msg = 'Request timed out. Please check your connection and try again, or contact our office at 202-662-6000.';
        }
        if (submitError) {
          submitError.textContent = msg;
          submitError.classList.add('form-error-msg--visible');
        }
      });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      Object.keys(fields).forEach(function (name) { clearError(name); });
      formFields.style.display = '';
      success.classList.remove('request-success--visible');
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
    });
  }
})();
