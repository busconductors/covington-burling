/**
 * Covington & Burling LLP — Contact Form Validation
 * Client-side validation with error display and success state
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const formFields = document.getElementById('formFields');
  const formSuccess = document.getElementById('formSuccess');
  const formReset = document.getElementById('formReset');

  if (!form) return;

  const fields = {
    name: { el: document.getElementById('name'), error: document.getElementById('name-error'), rules: ['required', 'minLength:2'] },
    email: { el: document.getElementById('email'), error: document.getElementById('email-error'), rules: ['required', 'email'] },
    phone: { el: document.getElementById('phone'), error: document.getElementById('phone-error'), rules: ['optionalPhone'] },
    message: { el: document.getElementById('message'), error: document.getElementById('message-error'), rules: ['required', 'minLength:10'] },
    consent: { el: document.getElementById('consent'), error: document.getElementById('consent-error'), rules: ['requiredCheckbox'] }
  };

  const messages = {
    required: 'This field is required.',
    email: 'Please enter a valid email address.',
    minLength: (n) => `Must be at least ${n} characters.`,
    phone: 'Please enter a valid 10-digit phone number.',
    consent: 'You must consent to our data collection policy.'
  };

  function showError(fieldName, msg) {
    const f = fields[fieldName];
    if (f.el) f.el.classList.add('form-input--error');
    if (f.error) {
      f.error.textContent = msg;
      f.error.classList.add('form-error-msg--visible');
    }
  }

  function clearError(fieldName) {
    const f = fields[fieldName];
    if (f.el) f.el.classList.remove('form-input--error');
    if (f.error) {
      f.error.textContent = '';
      f.error.classList.remove('form-error-msg--visible');
    }
  }

  function clearAllErrors() {
    Object.keys(fields).forEach(clearError);
  }

  function validateField(fieldName) {
    const f = fields[fieldName];
    const val = f.el.type === 'checkbox' ? f.el.checked : f.el.value.trim();
    const rules = f.rules;

    for (const rule of rules) {
      if (rule.startsWith('requiredCheckbox')) {
        if (!val) { showError(fieldName, messages.consent); return false; }
      } else if (rule === 'required') {
        if (!val) { showError(fieldName, messages.required); return false; }
      } else if (rule === 'email') {
        if (!/.+@.+\..+/.test(val)) { showError(fieldName, messages.email); return false; }
      } else if (rule.startsWith('minLength:')) {
        const min = parseInt(rule.split(':')[1], 10);
        if (val.length < min) { showError(fieldName, messages.minLength(min)); return false; }
      } else if (rule === 'optionalPhone') {
        if (val && !/^[\d\s\-().+]{10,}$/.test(val.replace(/\s/g, ''))) {
          showError(fieldName, messages.phone); return false;
        }
      }
    }
    clearError(fieldName);
    return true;
  }

  // Live validation on input
  Object.entries(fields).forEach(([name, f]) => {
    if (!f.el) return;
    f.el.addEventListener('input', () => validateField(name));
    if (f.el.type === 'checkbox') {
      f.el.addEventListener('change', () => validateField(name));
    }
  });

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    let valid = true;
    Object.keys(fields).forEach(name => {
      if (!validateField(name)) valid = false;
    });

    if (!valid) {
      // Focus first invalid field
      const firstInvalid = Object.values(fields).find(f => f.el && f.el.classList.contains('form-input--error'));
      if (firstInvalid?.el) firstInvalid.el.focus();
      return;
    }

    // Success — log data, show success state
    const formData = {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      phone: fields.phone.el.value.trim(),
      company: document.getElementById('company')?.value.trim() || '',
      message: fields.message.el.value.trim(),
      contactMethod: document.getElementById('contactMethod')?.value || ''
    };
    console.log('Contact form submission:', formData);

    formFields.style.display = 'none';
    formSuccess.classList.add('form-success--visible');
    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Reset form
  if (formReset) {
    formReset.addEventListener('click', () => {
      form.reset();
      clearAllErrors();
      formSuccess.classList.remove('form-success--visible');
      formFields.style.display = 'block';
      formFields.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
});