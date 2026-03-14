import { describe, expect, it } from 'vitest';
import {
  buildDataCollectionInteractionPayload,
  getStructuredFieldInputType,
  getStructuredSubmissionDisplayText,
} from '@/lib/interview/structured-interactions';

describe('structured-interactions', () => {
  it('builds a consent interaction without localized logic', () => {
    expect(buildDataCollectionInteractionPayload({
      interactionId: 'int-1',
      consentPending: true,
    })).toEqual({
      version: 1,
      kind: 'consent',
      interactionId: 'int-1',
    });
  });

  it('maps deterministic field ids to structured input types', () => {
    expect(getStructuredFieldInputType('email')).toEqual({ inputType: 'email' });
    expect(getStructuredFieldInputType('phone')).toEqual({ inputType: 'tel' });
    expect(getStructuredFieldInputType('company')).toEqual({ inputType: 'text' });
  });

  it('supports explicit choice options from field config', () => {
    expect(getStructuredFieldInputType('role', [
      {
        field: 'role',
        options: ['CEO', 'CTO'],
      },
    ])).toEqual({
      inputType: 'choice',
      options: [
        { id: 'CEO', label: 'CEO' },
        { id: 'CTO', label: 'CTO' },
      ],
    });
  });

  it('builds field payloads with the expected input type', () => {
    expect(buildDataCollectionInteractionPayload({
      interactionId: 'int-2',
      fieldId: 'email',
      candidateFields: ['email'],
    })).toEqual({
      version: 1,
      kind: 'field',
      interactionId: 'int-2',
      fieldId: 'email',
      inputType: 'email',
      allowSkip: true,
    });
  });

  it('creates stable user-visible display text for structured submissions', () => {
    expect(getStructuredSubmissionDisplayText({
      interactionId: 'int-3',
      kind: 'consent',
      action: 'accept',
    }, 'en')).toBe('Yes, I agree.');

    expect(getStructuredSubmissionDisplayText({
      interactionId: 'int-4',
      kind: 'field',
      fieldId: 'company',
      action: 'skip',
    }, 'it')).toBe('Preferisco saltare questo campo.');
  });
});
