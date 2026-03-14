import { z } from 'zod';

export type StructuredFieldInputType = 'text' | 'email' | 'tel' | 'choice';

export interface InteractionChoiceOption {
  id: string;
  label: string;
}

export interface ConsentInteractionPayload {
  version: 1;
  kind: 'consent';
  interactionId: string;
}

export interface FieldInteractionPayload {
  version: 1;
  kind: 'field';
  interactionId: string;
  fieldId: string;
  inputType: StructuredFieldInputType;
  allowSkip: boolean;
  options?: InteractionChoiceOption[];
}

export type InterviewInteractionPayload =
  | ConsentInteractionPayload
  | FieldInteractionPayload;

export interface StructuredConsentSubmission {
  interactionId: string;
  kind: 'consent';
  action: 'accept' | 'refuse';
}

export interface StructuredFieldSubmission {
  interactionId: string;
  kind: 'field';
  fieldId: string;
  action: 'submit' | 'skip';
  value?: string | null;
  optionId?: string | null;
}

export type StructuredInterviewSubmission =
  | StructuredConsentSubmission
  | StructuredFieldSubmission;

export const StructuredInterviewSubmissionSchema = z.discriminatedUnion('kind', [
  z.object({
    interactionId: z.string().min(1),
    kind: z.literal('consent'),
    action: z.enum(['accept', 'refuse']),
  }),
  z.object({
    interactionId: z.string().min(1),
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    action: z.enum(['submit', 'skip']),
    value: z.string().optional().nullable(),
    optionId: z.string().optional().nullable(),
  }),
]);

function normalizeOption(rawOption: any): InteractionChoiceOption | null {
  if (typeof rawOption === 'string') {
    const trimmed = rawOption.trim();
    if (!trimmed) return null;
    return { id: trimmed, label: trimmed };
  }

  if (!rawOption || typeof rawOption !== 'object') return null;

  const id = String(rawOption.id || rawOption.value || rawOption.label || '').trim();
  const label = String(rawOption.label || rawOption.value || rawOption.id || '').trim();

  if (!id || !label) return null;
  return { id, label };
}

export function getStructuredFieldInputType(
  fieldId: string,
  candidateFields: any[] = []
): { inputType: StructuredFieldInputType; options?: InteractionChoiceOption[] } {
  const normalizedFieldId = String(fieldId || '').trim();
  const rawField = Array.isArray(candidateFields)
    ? candidateFields.find((candidate) => {
        if (typeof candidate === 'string') return candidate === normalizedFieldId;
        return candidate?.field === normalizedFieldId || candidate?.id === normalizedFieldId;
      })
    : null;

  const rawOptions = Array.isArray(rawField?.options) ? rawField.options : [];
  const options = rawOptions
    .map(normalizeOption)
    .filter((option: InteractionChoiceOption | null): option is InteractionChoiceOption => option !== null);

  if (options.length > 0) {
    return { inputType: 'choice', options };
  }

  if (normalizedFieldId === 'email') return { inputType: 'email' };
  if (normalizedFieldId === 'phone') return { inputType: 'tel' };
  return { inputType: 'text' };
}

export function buildDataCollectionInteractionPayload(params: {
  interactionId: string;
  consentPending?: boolean;
  fieldId?: string | null;
  candidateFields?: any[];
  allowSkip?: boolean;
}): InterviewInteractionPayload | null {
  if (params.consentPending) {
    return {
      version: 1,
      kind: 'consent',
      interactionId: params.interactionId,
    };
  }

  const fieldId = String(params.fieldId || '').trim();
  if (!fieldId) return null;

  const { inputType, options } = getStructuredFieldInputType(fieldId, params.candidateFields || []);

  return {
    version: 1,
    kind: 'field',
    interactionId: params.interactionId,
    fieldId,
    inputType,
    allowSkip: params.allowSkip !== false,
    ...(options && options.length > 0 ? { options } : {}),
  };
}

export function getStructuredSubmissionDisplayText(
  submission: StructuredInterviewSubmission,
  language: string = 'en'
): string {
  const isItalian = String(language || 'en').toLowerCase().startsWith('it');

  if (submission.kind === 'consent') {
    if (submission.action === 'accept') {
      return isItalian ? 'Sì, acconsento.' : 'Yes, I agree.';
    }
    return isItalian ? 'No, preferisco di no.' : 'No, I prefer not to.';
  }

  if (submission.action === 'skip') {
    return isItalian ? 'Preferisco saltare questo campo.' : 'I prefer to skip this field.';
  }

  const explicitValue = String(submission.value || '').trim();
  if (explicitValue) return explicitValue;

  const explicitOptionId = String(submission.optionId || '').trim();
  if (explicitOptionId) return explicitOptionId;

  return '';
}
