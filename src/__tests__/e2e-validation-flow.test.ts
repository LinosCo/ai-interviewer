import { describe, it, expect } from 'vitest';
import { validateExtractedField } from '@/lib/interview/field-validation';

describe('End-to-End Validation Feedback Flow', () => {
  it('provides feedback for invalid email on first attempt', () => {
    const result = validateExtractedField(
      'email',
      '',       // Empty email
      'none',   // No confidence
      1,        // First attempt
      'it'
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('field_no_value_extracted');
    expect(result.feedback).toBeDefined();
    expect(result.strategy).toBe('explain_better');
  });

  it('skips field after 2 failed attempts', () => {
    const result = validateExtractedField(
      'email',
      '',       // No value extracted
      'none',
      2,        // Second attempt
      'it'
    );

    expect(result.isValid).toBe(false);
    expect(result.strategy).toBe('skip_field');
    expect(result.attemptCount).toBe(2);
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
