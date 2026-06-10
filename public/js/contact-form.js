/**
 * Carlington & Burling LLP — Contact Form
 * Validates and submits to backend API
 */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  var formFields = document.getElementById('formFields');
  var formSuccess = document.getElementById('formSuccess');
  var formReset = document.getElementById('formReset');
  var submitError = document.getElementById('contact-submit-error');
  if (!form || !formFields || !formSuccess) return;

  var fields = {
    name:    { el: document.getElementById('name'),          error: document.getElementById('name-error'),          rules: ['required', 'minLength:2'] },
    email:   { el: document.getElementById('email'),         error: document.getElementById('email-error'),         rules: ['required', 'email'] },
    phone:   { el: document.getElementById('phone'),         error: document.getElementById('phone-error'),         rules: ['optionalPhone'] },
    company: { el: document.getElementById('company'),        error: null, rules: [] },
    message: { el: document.getElementById('message'),       error: document.getElementById('message-error'),       rules: ['required', 'minLength:10'] },
    consent: { el: document.getElementById('consent'),       error: document.getElementById('consent-error'),       rules: ['requiredCheckbox'] }
  };

  var errorMessages = {
    required: 'This field is required.',
    email: 'Please enter a valid email address.',
    'minLength:2': 'Please enter at least 2 characters.',
    'minLength:10': 'Please provide at least 10 characters.',
    requiredCheckbox: 'You must consent to our data collection policy.',
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
      company: fields.company.el ? fields.company.el.value.trim() : '',
      formType: 'contact',
      matterDescription: fields.message.el.value.trim()
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
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
        formSuccess.classList.add('form-success--visible');
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  if (formReset) {
    formReset.addEventListener('click', function () {
      form.reset();
      Object.keys(fields).forEach(function (name) { clearError(name); });
      formSuccess.classList.remove('form-success--visible');
      formFields.style.display = '';
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }
    });
  }
})();