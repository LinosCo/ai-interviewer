'use client';

import { useMemo, useState } from 'react';
import type {
  FieldInteractionPayload,
  FormInteractionPayload,
  FormFieldDescriptor,
  StructuredFormSubmission,
  InterviewInteractionPayload,
  StructuredInterviewSubmission,
} from '@/lib/interview/structured-interactions';

interface StructuredInterviewInputProps {
  interaction: InterviewInteractionPayload;
  brandColor: string;
  language?: string;
  loading?: boolean;
  onSubmit: (submission: StructuredInterviewSubmission) => void;
}

function safeColor(color: string, fallback = '#f59e0b'): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function getFieldPlaceholder(fieldId: string, language: string, inputType: FieldInteractionPayload['inputType'], label?: string): string {
  const isItalian = language.toLowerCase().startsWith('it');

  if (inputType === 'email') {
    return isItalian ? 'Inserisci la tua email' : 'Enter your email';
  }
  if (inputType === 'tel') {
    return isItalian ? 'Inserisci il tuo numero' : 'Enter your phone number';
  }

  switch (fieldId) {
    case 'name':
    case 'fullName':
      return isItalian ? 'Inserisci il tuo nome completo' : 'Enter your full name';
    case 'company':
      return isItalian ? 'Inserisci la tua azienda' : 'Enter your company';
    case 'role':
      return isItalian ? 'Inserisci il tuo ruolo' : 'Enter your role';
    case 'location':
      return isItalian ? 'Inserisci la tua località' : 'Enter your location';
    default:
      return label || (isItalian ? 'Inserisci la risposta' : 'Enter your answer');
  }
}

export function StructuredInterviewInput({
  interaction,
  brandColor,
  language = 'en',
  loading = false,
  onSubmit,
}: StructuredInterviewInputProps) {
  const safeBrandColor = safeColor(brandColor);
  const isItalian = language.toLowerCase().startsWith('it');
  const [fieldValue, setFieldValue] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formOptionIds, setFormOptionIds] = useState<Record<string, string | null>>({});

  const labels = useMemo(() => ({
    consentAccept: isItalian ? 'Acconsento' : 'I agree',
    consentRefuse: isItalian ? 'Preferisco di no' : 'I prefer not to',
    submit: isItalian ? 'Conferma' : 'Submit',
    skip: isItalian ? 'Salta' : 'Skip',
  }), [isItalian]);

  if (interaction.kind === 'form') {
    const formInteraction = interaction as FormInteractionPayload;
    const isItalianForm = language.toLowerCase().startsWith('it');

    const handleFormSubmit = () => {
      const values: StructuredFormSubmission['values'] = {};
      for (const field of formInteraction.fields) {
        const optionId = formOptionIds[field.fieldId] ?? null;
        const textValue = formValues[field.fieldId]?.trim() || null;
        if (field.inputType === 'choice') {
          values[field.fieldId] = optionId
            ? { action: 'submit', optionId }
            : { action: 'skip' };
        } else {
          values[field.fieldId] = textValue
            ? { action: 'submit', value: textValue }
            : { action: 'skip' };
        }
      }
      onSubmit({
        interactionId: formInteraction.interactionId,
        kind: 'form',
        values,
      } as any);
    };

    return (
      <div className="bg-white rounded-[18px] shadow-2xl ring-1 ring-black/5 p-4 md:p-5 space-y-4">
        {formInteraction.fields.map((field: FormFieldDescriptor) => {
          const isChoice = field.inputType === 'choice' && Array.isArray(field.options) && field.options!.length > 0;
          const selectedOption = formOptionIds[field.fieldId];
          return (
            <div key={field.fieldId} className="space-y-1.5">
              {field.label && (
                <p className="text-xs font-semibold text-gray-500 px-1">{field.label}</p>
              )}
              {isChoice ? (
                <div className="grid grid-cols-1 gap-2">
                  {field.options!.map((option) => {
                    const selected = selectedOption === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={loading}
                        onClick={() => setFormOptionIds(prev => ({ ...prev, [field.fieldId]: option.id }))}
                        className={`rounded-xl border px-4 py-2 text-left text-sm font-medium transition-all disabled:opacity-50 ${selected ? 'shadow-sm' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                        style={selected ? { borderColor: `${safeColor(brandColor)}88`, background: `${safeColor(brandColor)}12`, color: safeColor(brandColor) } : undefined}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type={field.inputType === 'email' ? 'email' : field.inputType === 'tel' ? 'tel' : 'text'}
                  inputMode={field.inputType === 'email' ? 'email' : field.inputType === 'tel' ? 'tel' : 'text'}
                  autoComplete={
                    field.fieldId === 'name' || field.fieldId === 'fullName' ? 'name' :
                    field.fieldId === 'email' ? 'email' :
                    field.fieldId === 'company' ? 'organization' :
                    field.fieldId === 'phone' ? 'tel' : 'off'
                  }
                  value={formValues[field.fieldId] || ''}
                  onChange={(e) => setFormValues(prev => ({ ...prev, [field.fieldId]: e.target.value }))}
                  disabled={loading}
                  placeholder={getFieldPlaceholder(field.fieldId, language, field.inputType, field.label)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ ['--tw-ring-color' as any]: `${safeColor(brandColor)}55` }}
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          disabled={loading}
          onClick={handleFormSubmit}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: safeColor(brandColor) }}
        >
          {isItalianForm ? 'Conferma' : 'Submit'}
        </button>
      </div>
    );
  }

  if (interaction.kind === 'consent') {
    return (
      <div className="bg-white rounded-[18px] shadow-2xl ring-1 ring-black/5 p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({
              interactionId: interaction.interactionId,
              kind: 'consent',
              action: 'accept',
            })}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: safeBrandColor }}
          >
            {labels.consentAccept}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({
              interactionId: interaction.interactionId,
              kind: 'consent',
              action: 'refuse',
            })}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            {labels.consentRefuse}
          </button>
        </div>
      </div>
    );
  }

  const fieldInteraction = interaction;
  const isChoiceField = fieldInteraction.inputType === 'choice' && Array.isArray(fieldInteraction.options) && fieldInteraction.options.length > 0;
  const canSubmit = isChoiceField ? Boolean(selectedOptionId) : Boolean(fieldValue.trim());

  return (
    <div className="bg-white rounded-[18px] shadow-2xl ring-1 ring-black/5 p-4 md:p-5 space-y-4">
      {isChoiceField ? (
        <div className="grid grid-cols-1 gap-2">
          {fieldInteraction.options!.map((option) => {
            const selected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={loading}
                onClick={() => setSelectedOptionId(option.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all disabled:opacity-50 ${
                  selected ? 'shadow-sm' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
                style={selected ? { borderColor: `${safeBrandColor}88`, background: `${safeBrandColor}12`, color: safeBrandColor } : undefined}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type={fieldInteraction.inputType === 'email' ? 'email' : fieldInteraction.inputType === 'tel' ? 'tel' : 'text'}
          inputMode={fieldInteraction.inputType === 'email' ? 'email' : fieldInteraction.inputType === 'tel' ? 'tel' : 'text'}
          autoComplete={
            fieldInteraction.fieldId === 'name' || fieldInteraction.fieldId === 'fullName'
              ? 'name'
              : fieldInteraction.fieldId === 'email'
                ? 'email'
                : fieldInteraction.fieldId === 'company'
                  ? 'organization'
                  : fieldInteraction.fieldId === 'phone'
                    ? 'tel'
                    : 'off'
          }
          value={fieldValue}
          onChange={(event) => setFieldValue(event.target.value)}
          disabled={loading}
          placeholder={getFieldPlaceholder(fieldInteraction.fieldId, language, fieldInteraction.inputType)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{ ['--tw-ring-color' as any]: `${safeBrandColor}55` }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={loading || !canSubmit}
          onClick={() => onSubmit({
            interactionId: fieldInteraction.interactionId,
            kind: 'field',
            fieldId: fieldInteraction.fieldId,
            action: 'submit',
            value: isChoiceField ? null : fieldValue,
            optionId: isChoiceField ? selectedOptionId : null,
          })}
          className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: safeBrandColor }}
        >
          {labels.submit}
        </button>

        {fieldInteraction.allowSkip && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onSubmit({
              interactionId: fieldInteraction.interactionId,
              kind: 'field',
              fieldId: fieldInteraction.fieldId,
              action: 'skip',
            })}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            {labels.skip}
          </button>
        )}
      </div>
    </div>
  );
}
