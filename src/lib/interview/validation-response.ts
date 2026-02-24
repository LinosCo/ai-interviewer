/**
 * Unified Validation Response System
 * Handles validation failures across DEEP_OFFER, DATA_COLLECTION, and chatbot scenarios
 */

/**
 * Union type for validation failure reasons
 */
export type ValidationFailureReason =
  | 'email_invalid_format'
  | 'email_incomplete'
  | 'phone_invalid_format'
  | 'url_invalid_format'
  | 'field_no_value_extracted'
  | 'intent_unclear'
  | 'intent_neutral'
  | 'response_too_brief'
  | 'clarification_needed'
  | 'user_skip_requested';

/**
 * Union type for re-engagement strategies
 */
export type ReengagementStrategy =
  | 'explain_better'
  | 'ask_differently'
  | 'skip_field'
  | 'move_on'
  | 'accept_and_continue'
  | 'give_example'
  | 'accept_skip_notify';

/**
 * Confidence level for validation results
 */
export type ConfidenceLevel = 'high' | 'low' | 'none';

/**
 * Validation response interface
 */
export interface ValidationResponse {
  isValid: boolean;
  reason?: ValidationFailureReason;
  confidence?: ConfidenceLevel;
  feedback?: string;
  strategy?: ReengagementStrategy;
  attemptCount?: number;
  maxAttempts?: number;
  shouldSkip?: boolean;
  extractedValue?: string | null;
  timestamp?: Date;
}

/**
 * Context for generating validation feedback
 */
export interface ValidationFeedbackContext {
  language: 'it' | 'en';
  fieldName?: string;
  fieldType?: 'email' | 'phone' | 'name' | 'url' | 'text' | 'enum';
  question?: string;
  userMessage: string;
  attemptNumber: number;
  maxAttempts?: number;
}

/**
 * Message templates for validation feedback
 */
const FEEDBACK_MESSAGES: Record<ValidationFailureReason, Record<'it' | 'en', string>> = {
  email_invalid_format: {
    it: 'Per favore, inserisci un indirizzo email valido (ad esempio: nome@dominio.com)',
    en: 'Please enter a valid email address (for example: name@domain.com)'
  },
  email_incomplete: {
    it: 'L\'indirizzo email sembra incompleto. Puoi fornire l\'email completa?',
    en: 'The email address seems incomplete. Could you provide the complete email?'
  },
  phone_invalid_format: {
    it: 'Per favore, inserisci un numero di telefono valido con almeno 10 cifre',
    en: 'Please enter a valid phone number with at least 10 digits'
  },
  url_invalid_format: {
    it: 'Per favore, inserisci un URL valido (ad esempio: https://www.sito.com)',
    en: 'Please enter a valid URL (for example: https://www.site.com)'
  },
  field_no_value_extracted: {
    it: 'Non sono riuscito a estrarre il valore dal tuo messaggio. Puoi riprovare?',
    en: 'I couldn\'t extract a value from your message. Could you try again?'
  },
  intent_unclear: {
    it: 'La tua risposta non è del tutto chiara. Puoi fornire più dettagli?',
    en: 'Your response isn\'t quite clear. Could you provide more details?'
  },
  intent_neutral: {
    it: 'La tua risposta non sembra dare una risposta diretta. Puoi essere più specifico?',
    en: 'Your response doesn\'t seem to give a direct answer. Could you be more specific?'
  },
  response_too_brief: {
    it: 'La tua risposta è troppo breve. Puoi fornire maggiori informazioni?',
    en: 'Your response is too brief. Could you provide more information?'
  },
  clarification_needed: {
    it: 'Abbiamo bisogno di chiarimenti sulla tua risposta. Puoi spiegare meglio?',
    en: 'We need clarification on your response. Could you explain better?'
  },
  user_skip_requested: {
    it: 'Hai richiesto di saltare questo campo.',
    en: 'You requested to skip this field.'
  }
};

/**
 * Generates user-facing validation feedback messages
 *
 * @param response - The validation response
 * @param context - The validation feedback context
 * @returns User-facing feedback message in the specified language
 */
export function generateValidationFeedback(
  response: ValidationResponse,
  context: ValidationFeedbackContext
): string {
  // Return empty string for valid responses
  if (response.isValid) {
    return '';
  }

  // Return feedback message if reason is specified
  if (response.reason && FEEDBACK_MESSAGES[response.reason]) {
    return FEEDBACK_MESSAGES[response.reason][context.language];
  }

  // Return fallback message if no template matches
  const fallbackMessages: Record<'it' | 'en', string> = {
    it: 'Per favore, fornisci una risposta valida.',
    en: 'Please provide a valid response.'
  };

  return fallbackMessages[context.language];
}

/**
 * Determines the next re-engagement strategy based on validation response
 *
 * @param response - The validation response
 * @param attemptNumber - Current attempt number (default: 1)
 * @param maxAttempts - Maximum number of attempts (default: 2)
 * @returns The determined re-engagement strategy
 */
export function determineStrategy(
  response: ValidationResponse,
  attemptNumber: number = 1,
  maxAttempts: number = 2
): ReengagementStrategy {
  // Valid responses: move forward
  if (response.isValid) {
    return 'move_on';
  }

  // Beyond max attempts: skip field
  if (attemptNumber > maxAttempts) {
    return 'skip_field';
  }

  // Attempt 1: Provide guidance based on failure reason
  if (attemptNumber === 1) {
    const reason = response.reason;

    // Format errors: give example
    if (
      reason === 'email_invalid_format' ||
      reason === 'email_incomplete' ||
      reason === 'phone_invalid_format' ||
      reason === 'url_invalid_format'
    ) {
      return 'give_example';
    }

    // Unclear intent: ask differently
    if (
      reason === 'intent_unclear' ||
      reason === 'intent_neutral' ||
      reason === 'response_too_brief' ||
      reason === 'clarification_needed'
    ) {
      return 'ask_differently';
    }

    // Default for attempt 1
    return 'explain_better';
  }

  // Attempt 2 and beyond: escalate to skipping
  if (attemptNumber === 2) {
    if (
      response.reason === 'field_no_value_extracted' ||
      response.reason === 'user_skip_requested'
    ) {
      return 'skip_field';
    }
    return 'move_on'; // covers intent_neutral and all other cases
  }

  // Default fallback
  return 'move_on';
}
