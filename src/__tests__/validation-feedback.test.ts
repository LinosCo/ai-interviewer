import { describe, it, expect } from 'vitest';
import { generateValidationFeedback, ValidationResponse, ValidationFeedbackContext } from '@/lib/interview/validation-response';

describe('Validation Feedback System', () => {
  describe('generateValidationFeedback', () => {
    it('generates feedback for intent_unclear', () => {
      const response: ValidationResponse = {
        isValid: false,
        reason: 'intent_unclear'
      };

      const context: ValidationFeedbackContext = {
        language: 'it',
        question: 'continuare l\'intervista',
        userMessage: 'cosa vorresti approfondire?',
        attemptNumber: 1
      };

      const feedback = generateValidationFeedback(response, context);

      expect(feedback).toContain('Non ho capito bene');
      expect(feedback).toContain('continuare l\'intervista');
    });

    it('generates feedback for email_incomplete', () => {
      const response: ValidationResponse = {
        isValid: false,
        reason: 'email_incomplete'
      };

      const context: ValidationFeedbackContext = {
        language: 'it',
        fieldName: 'email',
        fieldType: 'email',
        userMessage: 'mario@',
        attemptNumber: 1
      };

      const feedback = generateValidationFeedback(response, context);

      expect(feedback).toContain('incompleto');
      expect(feedback).toContain('email completa');
    });

    it('generates English feedback when language is en', () => {
      const response: ValidationResponse = {
        isValid: false,
        reason: 'intent_unclear'
      };

      const context: ValidationFeedbackContext = {
        language: 'en',
        question: 'continue the interview',
        userMessage: 'what do you want to explore?',
        attemptNumber: 1
      };

      const feedback = generateValidationFeedback(response, context);

      expect(feedback).toContain('didn\'t quite understand');
      expect(feedback).toContain('more details');
    });

    it('returns empty string for valid responses', () => {
      const response: ValidationResponse = {
        isValid: true
      };

      const context: ValidationFeedbackContext = {
        language: 'it',
        userMessage: 'sì',
        attemptNumber: 1
      };

      const feedback = generateValidationFeedback(response, context);

      expect(feedback).toBe('');
    });
  });
});
