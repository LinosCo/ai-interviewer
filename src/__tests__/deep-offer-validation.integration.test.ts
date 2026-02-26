import { describe, it, expect } from 'vitest';
import { createDeepOfferInsight } from '@/lib/interview/interview-supervisor';
import { ValidationResponse } from '@/lib/interview/validation-response';

describe('DEEP_OFFER with Validation Feedback Integration', () => {
  it('includes validation feedback when user response is unclear', () => {
    const validationFeedback: ValidationResponse = {
      isValid: false,
      reason: 'intent_unclear',
      confidence: 'low',
      attemptCount: 1,
      maxAttempts: 2,
      strategy: 'ask_differently',
      feedback: 'Non ho capito bene. Intendi continuare l\'intervista?'
    };

    const insight = createDeepOfferInsight(
      ['Esplorare limmagine del marchio'],
      validationFeedback
    );

    expect(insight.status).toBe('DEEP_OFFER_ASK');
    expect(insight.validationFeedback).toBeDefined();
    expect(insight.feedbackMessage).toContain('Non ho capito bene');
    expect(insight.extensionPreview).toContain('Esplorare limmagine del marchio');
  });

  it('includes strategy for next attempt in validation feedback', () => {
    const validationFeedback: ValidationResponse = {
      isValid: false,
      reason: 'intent_unclear',
      attemptCount: 2,
      maxAttempts: 2,
      strategy: 'move_on'
    };

    const insight = createDeepOfferInsight(undefined, validationFeedback);

    expect(insight.validationFeedback?.strategy).toBe('move_on');
  });
});
