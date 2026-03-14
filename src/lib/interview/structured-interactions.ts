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

export interface FormFieldDescriptor {
  fieldId: string;
  label?: string;
  inputType: StructuredFieldInputType;
  required: boolean;
  options?: InteractionChoiceOption[];
}

export interface FormInteractionPayload {
  version: 1;
  kind: 'form';
  interactionId: string;
  fields: FormFieldDescriptor[];
}

export type InterviewInteractionPayload =
  | ConsentInteractionPayload
  | FieldInteractionPayload
  | FormInteractionPayload;

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

export interface StructuredFormSubmission {
  interactionId: string;
  kind: 'form';
  values: Record<string, { action: 'submit' | 'skip'; value?: string | null; optionId?: string | null }>;
}

export type StructuredInterviewSubmission =
  | StructuredConsentSubmission
  | StructuredFieldSubmission
  | StructuredFormSubmission;

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
  z.object({
    interactionId: z.string().min(1),
    kind: z.literal('form'),
    values: z.record(z.string(), z.object({
      action: z.enum(['submit', 'skip']),
      value: z.string().optional().nullable(),
      optionId: z.string().optional().nullable(),
    })),
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

export function buildDataCollectionFormPayload(params: {
  interactionId: string;
  fieldIds: string[];
  candidateFields?: any[];
}): FormInteractionPayload {
  const fields: FormFieldDescriptor[] = params.fieldIds.map((fieldId) => {
    const { inputType, options } = getStructuredFieldInputType(fieldId, params.candidateFields || []);
    const rawField = Array.isArray(params.candidateFields)
      ? params.candidateFields.find((c) =>
          typeof c === 'string' ? c === fieldId : c?.field === fieldId || c?.id === fieldId
        )
      : null;
    const label: string | undefined =
      typeof rawField?.question === 'string' && rawField.question.trim()
        ? rawField.question.trim()
        : typeof rawField?.label === 'string' && rawField.label.trim()
          ? rawField.label.trim()
          : undefined;
    return {
      fieldId,
      ...(label ? { label } : {}),
      inputType,
      required: false,  // all fields are skippable
      ...(options && options.length > 0 ? { options } : {}),
    };
  });
  return {
    version: 1,
    kind: 'form',
    interactionId: params.interactionId,
    fields,
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

  if (submission.kind === 'form') {
    // Return summary of filled values, comma-separated
    const filled = Object.entries(submission.values)
      .filter(([, v]) => v.action === 'submit' && (v.value || v.optionId))
      .map(([, v]) => v.value || v.optionId || '')
      .filter(Boolean)
      .join(', ');
    return filled || (isItalian ? 'Dati inviati.' : 'Data submitted.');
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
