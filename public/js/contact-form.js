/**
 * Carlington & Burling LLP — Contact Form
 * Config for the shared FormHandler engine (form-handler.js).
 */
(function () {
  'use strict';

  if (!window.FormHandler) return;

  window.FormHandler.init({
    form: document.getElementById('contactForm'),
    formFields: document.getElementById('formFields'),
    success: document.getElementById('formSuccess'),
    resetBtn: document.getElementById('formReset'),
    submitError: document.getElementById('contact-submit-error'),
    endpoint: '/api/request-forms',
    submitLabel: 'Submit Inquiry',
    sendingLabel: 'Sending…',
    genericError: 'Something went wrong. Please try again or contact our office at 202-662-6000.',
    timeoutError: 'Request timed out. Please check your connection and try again, or contact our office at 202-662-6000.',
    messages: {
      'minLength:10': 'Please provide at least 10 characters.',
      requiredCheckbox: 'You must consent to our data collection policy.',
    },
    fields: {
      name:    { el: document.getElementById('name'),          error: document.getElementById('name-error'),          rules: ['required', 'minLength:2'] },
      email:   { el: document.getElementById('email'),         error: document.getElementById('email-error'),         rules: ['required', 'email'] },
      phone:   { el: document.getElementById('phone'),         error: document.getElementById('phone-error'),         rules: ['optionalPhone'] },
      company: { el: document.getElementById('company'),       error: null, rules: [] },
      message: { el: document.getElementById('message'),       error: document.getElementById('message-error'),       rules: ['required', 'minLength:10'] },
      contactMethod: { el: document.getElementById('contactMethod'), error: document.getElementById('contactMethod-error'), rules: [] },
      consent: { el: document.getElementById('consent'),       error: document.getElementById('consent-error'),       rules: ['requiredCheckbox'] }
    },
    buildPayload: function (fields) {
      return {
        name: fields.name.el.value.trim(),
        email: fields.email.el.value.trim(),
        phone: fields.phone.el.value.trim(),
        company: fields.company.el ? fields.company.el.value.trim() : '',
        contactMethod: fields.contactMethod.el ? fields.contactMethod.el.value : '',
        formType: 'contact',
        matterDescription: fields.message.el.value.trim()
      };
    }
  });
})();
