// src/lib/interview/field-validation.ts

import { ValidationResponse, ValidationFailureReason, generateValidationFeedback, ValidationFeedbackContext } from './validation-response';

export interface FieldExtractionResult extends ValidationResponse {
  fieldName: string;
  extractedValue: string | null;
}

/**
 * Validate extracted field value with structured feedback
 */
export function validateExtractedField(
  fieldName: string,
  extractedValue: string | null,
  confidence: 'high' | 'low' | 'none',
  attemptNumber: number = 1,
  language: 'it' | 'en' = 'it'
): FieldExtractionResult {
  const result: FieldExtractionResult = {
    isValid: Boolean(extractedValue && confidence !== 'none'),
    fieldName,
    extractedValue,
    confidence,
    attemptCount: attemptNumber,
    maxAttempts: 3
  };

  if (!result.isValid) {
    // Determine failure reason
    if (!extractedValue) {
      result.reason = 'field_no_value_extracted';
    } else if (confidence === 'low') {
      // Low confidence - might be wrong format
      if (fieldName === 'email') result.reason = 'email_incomplete';
      else if (fieldName === 'phone') result.reason = 'phone_invalid_format';
      else if (fieldName === 'url' || fieldName === 'linkedin' || fieldName === 'portfolio') {
        result.reason = 'url_invalid_format';
      } else {
        result.reason = 'field_no_value_extracted';
      }
    }

    // Generate feedback message
    const feedbackContext: ValidationFeedbackContext = {
      language,
      fieldName,
      fieldType: fieldName as any,
      userMessage: extractedValue || '(empty)',
      attemptNumber,
      maxAttempts: 3
    };

    result.feedback = generateValidationFeedback(result, feedbackContext);
    result.strategy = attemptNumber === 1 ? 'give_example' : 'skip_field';
  }

  return result;
}

/**
 * Check if user explicitly wants to skip a field
 */
export function checkSkipIntent(userMessage: string, language: 'it' | 'en' = 'it'): boolean {
  const SKIP_FIELD_IT = /\b(non ho|non ce l'ho|non posso|preferisco non|salta|skip)\b/i;
  const SKIP_FIELD_EN = /\b(i don't have|don't have|can't provide|prefer not to|skip)\b/i;
  const pattern = language === 'it' ? SKIP_FIELD_IT : SKIP_FIELD_EN;
  return pattern.test(userMessage);
}
