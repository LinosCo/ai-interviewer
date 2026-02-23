/**
 * Post-Processing v2: 5 Essential Safety Nets
 * Replaces 15+ layers with focused validation
 */

export interface PostProcessingResult {
    isValid: boolean;
    reason?: string;
    regenerationRequired?: boolean;
}

const GOODBYE_PATTERNS_IT = /arrivederci|addio|a presto|ci vediamo|ciao|saluto|chiuso|finito/i;
const GOODBYE_PATTERNS_EN = /goodbye|farewell|see you|bye|closed|finished|goodbye|signing off/i;

const CONTACT_PATTERNS_IT = /email|telefono|numero|whatsapp|linkedin|contatto|indirizzo|messaggio/i;
const CONTACT_PATTERNS_EN = /email|phone|number|whatsapp|linkedin|contact|address|message/i;

const PROMO_PATTERNS = /https?:\/\/|www\.|link|promozione|discount|offerta|sconto|check out|visit/i;

/**
 * Layer 1: Closure Guard (EXPLORE, DEEPEN)
 * Ensure response has question and isn't closing prematurely
 */
export function validateTopicPhaseClosure(
    responseText: string,
    language: string
): PostProcessingResult {
    const isItalian = language.toLowerCase().startsWith('it');
    const hasQuestion = responseText.includes('?');
    const goodbyePattern = isItalian ? GOODBYE_PATTERNS_IT : GOODBYE_PATTERNS_EN;
    const hasGoodbye = goodbyePattern.test(responseText);
    const hasCompletionTag = /INTERVIEW_COMPLETED/i.test(responseText);
    const contactPattern = isItalian ? CONTACT_PATTERNS_IT : CONTACT_PATTERNS_EN;
    const hasPrematureContact = contactPattern.test(responseText);
    const hasPromo = PROMO_PATTERNS.test(responseText);

    if (!hasQuestion || hasGoodbye || hasCompletionTag || hasPrematureContact || hasPromo) {
        return {
            isValid: false,
            reason: 'Invalid topic phase closure',
            regenerationRequired: true
        };
    }

    return { isValid: true };
}

/**
 * Layer 2: Duplicate Detector (EXPLORE, DEEPEN)
 * Check if question is similar to recent ones
 */
export function checkDuplicateQuestion(
    responseText: string,
    recentQuestions: string[]
): PostProcessingResult {
    // Extract first sentence as the question
    const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) {
        return { isValid: true };
    }

    const currentQuestion = sentences[0].trim().slice(0, 100).toLowerCase();

    // Simple similarity check: if too many words match recent questions, flag as duplicate
    const words = new Set(currentQuestion.split(/\s+/));

    for (const recent of recentQuestions.slice(-3)) { // Check last 3 questions
        const recentWords = new Set(recent.split(/\s+/));
        const overlap = [...words].filter(w => recentWords.has(w)).length;
        const similarityRatio = overlap / Math.max(words.size, recentWords.size);

        if (similarityRatio > 0.6) { // >60% word overlap
            return {
                isValid: false,
                reason: 'Duplicate question detected',
                regenerationRequired: true
            };
        }
    }

    return { isValid: true };
}

/**
 * Layer 3: DEEP_OFFER Enforcer (DEEP_OFFER only)
 * Ensure extension offer question is present
 */
export function validateExtensionOffer(
    responseText: string,
    language: string
): PostProcessingResult {
    const isItalian = language.toLowerCase().startsWith('it');
    const hasQuestion = responseText.includes('?');

    // Check if it asks about continuing/extending
    const continuePattern = isItalian
        ? /continuar|proseguir|allungare|estender|altre|minuti|ancora/i
        : /continue|extend|longer|more|minutes|further|still/i;

    const hasContinueIntent = continuePattern.test(responseText);

    if (!hasQuestion || !hasContinueIntent) {
        return {
            isValid: false,
            reason: 'Invalid extension offer',
            regenerationRequired: true
        };
    }

    return { isValid: true };
}

/**
 * Layer 4: DATA_COLLECTION Enforcer (DATA_COLLECTION only)
 * Ensure field collection question or consent request
 */
export function validateDataCollection(
    responseText: string,
    language: string,
    phase: string
): PostProcessingResult {
    if (phase !== 'DATA_COLLECTION_CONSENT' && phase !== 'DATA_COLLECTION') {
        return { isValid: true };
    }

    const hasQuestion = responseText.includes('?');
    if (!hasQuestion) {
        return {
            isValid: false,
            reason: 'No question in data collection',
            regenerationRequired: true
        };
    }

    return { isValid: true };
}

/**
 * Layer 5: Completion Guard (all phases)
 * If INTERVIEW_COMPLETED tag is present, validate it's appropriate
 */
export function validateCompletion(
    responseText: string,
    phase: string,
    hasAllData: boolean
): PostProcessingResult {
    if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
        return { isValid: true }; // Not claiming completion
    }

    // Only allow completion in final phases
    const finalPhases = ['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'];
    if (!finalPhases.includes(phase)) {
        return {
            isValid: false,
            reason: 'INTERVIEW_COMPLETED in non-final phase',
            regenerationRequired: true
        };
    }

    return { isValid: true };
}

/**
 * Main post-processing orchestrator
 */
export async function runPostProcessing(
    responseText: string,
    {
        phase,
        language,
        recentQuestions = [],
        hasAllData = false
    }: {
        phase: string;
        language: string;
        recentQuestions?: string[];
        hasAllData?: boolean;
    }
): Promise<PostProcessingResult> {
    // Layer 1: Closure Guard
    if (phase === 'EXPLORE' || phase === 'DEEPEN') {
        const result = validateTopicPhaseClosure(responseText, language);
        if (!result.isValid) return result;
    }

    // Layer 2: Duplicate Detector
    if (phase === 'EXPLORE' || phase === 'DEEPEN') {
        const result = checkDuplicateQuestion(responseText, recentQuestions);
        if (!result.isValid) return result;
    }

    // Layer 3: DEEP_OFFER Enforcer
    if (phase === 'DEEP_OFFER') {
        const result = validateExtensionOffer(responseText, language);
        if (!result.isValid) return result;
    }

    // Layer 4: DATA_COLLECTION Enforcer
    if (phase === 'DATA_COLLECTION_CONSENT' || phase === 'DATA_COLLECTION') {
        const result = validateDataCollection(responseText, language, phase);
        if (!result.isValid) return result;
    }

    // Layer 5: Completion Guard
    const result = validateCompletion(responseText, phase, hasAllData);
    if (!result.isValid) return result;

    return { isValid: true };
}
