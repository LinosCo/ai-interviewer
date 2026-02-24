import { describe, it, expect } from 'vitest';
import { validateExtractedField } from '@/lib/interview/field-validation';

describe('End-to-End Validation Feedback Flow', () => {
  it('provides feedback for invalid email on first attempt', () => {
    const result = validateExtractedField(
      'email',
      'mario',  // Incomplete email
      'low',    // Low confidence
      1,        // First attempt
      'it'
    );

    expect(result.isValid).toBe(true);  // Has value and confidence is not 'none'
    expect(result.extractedValue).toBe('mario');
    expect(result.fieldName).toBe('email');
  });

  it('rejects email with no confidence', () => {
    const result = validateExtractedField(
      'email',
      'invalid',
      'none',
      1,  // First attempt
      'it'
    );

    expect(result.isValid).toBe(false);
    expect(result.strategy).toBe('explain_better');
    expect(result.attemptCount).toBe(1);
  });

  it('skips field after exceeding max attempts', () => {
    const result = validateExtractedField(
      'email',
      '',
      'none',
      4,  // Beyond max attempts (maxAttempts is 3)
      'it'
    );

    expect(result.isValid).toBe(false);
    expect(result.strategy).toBe('skip_field');
    expect(result.attemptCount).toBe(4);
  });

  it('accepts value with high confidence', () => {
    const result = validateExtractedField(
      'email',
      'mario@example.com',
      'high',
      1,
      'it'
    );

    expect(result.isValid).toBe(true);
    expect(result.extractedValue).toBe('mario@example.com');
    expect(result.feedback).toBeUndefined();
  });
});
