/**
 * Carlington & Burling LLP — Waiver/NDA Request Form
 * Config for the shared FormHandler engine (form-handler.js).
 */
(function () {
  'use strict';

  if (!window.FormHandler) return;

  window.FormHandler.init({
    form: document.getElementById('requestForm'),
    formFields: document.getElementById('requestFormFields'),
    success: document.getElementById('requestSuccess'),
    resetBtn: document.getElementById('requestReset'),
    submitError: document.getElementById('req-submit-error'),
    endpoint: '/api/request-forms',
    submitLabel: 'Submit Request',
    sendingLabel: 'Submitting…',
    successClass: 'request-success--visible',
    scrollToSuccess: false,
    genericError: 'Something went wrong. Please try again or contact our office at 202-662-6000.',
    timeoutError: 'Request timed out. Please check your connection and try again, or contact our office at 202-662-6000.',
    messages: {
      'minLength:10': 'Please provide at least 10 characters describing your matter.',
      requiredCheckbox: 'You must consent to continue.',
    },
    fields: {
      name:     { el: document.getElementById('req-name'),     error: document.getElementById('req-name-error'),     rules: ['required', 'minLength:2'] },
      email:    { el: document.getElementById('req-email'),    error: document.getElementById('req-email-error'),    rules: ['required', 'email'] },
      phone:    { el: document.getElementById('req-phone'),    error: document.getElementById('req-phone-error'),    rules: ['optionalPhone'] },
      company:  { el: document.getElementById('req-company'),  error: null, rules: [] },
      formType: { el: document.getElementById('req-formType'), error: document.getElementById('req-formType-error'), rules: ['required'] },
      matter:   { el: document.getElementById('req-matter'),   error: document.getElementById('req-matter-error'),   rules: ['required', 'minLength:10'] },
      consent:  { el: document.getElementById('req-consent'),  error: document.getElementById('req-consent-error'),  rules: ['requiredCheckbox'] }
    },
    buildPayload: function (fields) {
      return {
        name: fields.name.el.value.trim(),
        email: fields.email.el.value.trim(),
        phone: fields.phone.el.value.trim(),
        company: fields.company.el ? fields.company.el.value.trim() : '',
        formType: fields.formType.el.value,
        matterDescription: fields.matter.el.value.trim()
      };
    }
  });
})();
