// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const { validateValue } = nodeRequire('../public/js/form-handler.js');

const noMsgs = {};

describe('FormHandler.validateValue', () => {
  it('required: rejects empty, accepts non-empty', () => {
    expect(validateValue(['required'], '', noMsgs)).toBe('This field is required.');
    expect(validateValue(['required'], 'x', noMsgs)).toBe(null);
  });

  it('requiredCheckbox: rejects false, accepts true', () => {
    expect(validateValue(['requiredCheckbox'], false, noMsgs)).toBe('You must consent to continue.');
    expect(validateValue(['requiredCheckbox'], true, noMsgs)).toBe(null);
  });

  it('email: accepts valid, rejects invalid, skips empty (optional until required)', () => {
    expect(validateValue(['email'], 'a@b.co', noMsgs)).toBe(null);
    expect(validateValue(['email'], 'not-an-email', noMsgs)).toBe('Please enter a valid email address.');
    expect(validateValue(['email'], 'a@b', noMsgs)).toBe('Please enter a valid email address.');
    expect(validateValue(['email'], '', noMsgs)).toBe(null);
  });

  it('required+email composes: empty fails required first', () => {
    expect(validateValue(['required', 'email'], '', noMsgs)).toBe('This field is required.');
    expect(validateValue(['required', 'email'], 'bad', noMsgs)).toBe('Please enter a valid email address.');
  });

  it('optionalPhone: empty ok, valid formats ok, junk rejected', () => {
    expect(validateValue(['optionalPhone'], '', noMsgs)).toBe(null);
    expect(validateValue(['optionalPhone'], '+1 (202) 555-0100', noMsgs)).toBe(null);
    expect(validateValue(['optionalPhone'], '202.555.0100', noMsgs)).toBe(null);
    expect(validateValue(['optionalPhone'], 'abc', noMsgs)).toBe('Please enter a valid phone number.');
    expect(validateValue(['optionalPhone'], '12345', noMsgs)).toBe('Please enter a valid phone number.');
  });

  it('minLength: boundary at exactly N characters', () => {
    expect(validateValue(['minLength:10'], 'x'.repeat(9), noMsgs)).toBe('Please provide at least 10 characters.');
    expect(validateValue(['minLength:10'], 'x'.repeat(10), noMsgs)).toBe(null);
    expect(validateValue(['minLength:2'], 'a', noMsgs)).toBe('Please enter at least 2 characters.');
    expect(validateValue(['minLength:2'], 'ab', noMsgs)).toBe(null);
  });

  it('minLength skips empty values (required handles those)', () => {
    expect(validateValue(['minLength:10'], '', noMsgs)).toBe(null);
  });

  it('message overrides win over defaults', () => {
    const msgs = { requiredCheckbox: 'You must consent to our data collection policy.' };
    expect(validateValue(['requiredCheckbox'], false, msgs)).toBe('You must consent to our data collection policy.');
  });

  it('no rules: anything passes', () => {
    expect(validateValue([], '', noMsgs)).toBe(null);
  });
});
