/**
 * qualitative-evaluator.ts
 * Stateless per-turn quality checks for a single interview assistant response.
 *
 * Uses the legacy SCAN/DEEP naming convention for backward compatibility with
 * transcript-semantic-evaluator.ts, which maps 'SCAN' → EXPLORE and 'DEEP' → DEEPEN
 * phase semantics internally.
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type QualitativePhase =
    | 'SCAN'
    | 'DEEP'
    | 'EXPLORE'
    | 'DEEPEN'
    | 'DEEP_OFFER'
    | 'DATA_COLLECTION';

export interface QualitativeChecks {
    /** No farewell / closure language in a topic-interview phase */
    avoidsClosure: boolean;
    /** No contact-info request outside DATA_COLLECTION */
    avoidsPrematureContact: boolean;
    /** In DEEP_OFFER the message must be a continuation offer, not a topic question */
    deepOfferIntent: boolean;
    /** When user answers in ≤5 words the assistant must use a specific (non-generic) probe */
    probingWhenUserIsBrief: boolean;
    /** When user answer is substantial (>8 words) the assistant should pick up at least one keyword */
    referencesUserContext: boolean;
    /** Response must not be identical (normalised) to the previous assistant turn */
    nonRepetitive: boolean;
}

export interface QualitativeResult {
    passed: boolean;
    score: number;
    checks: QualitativeChecks;
    issues: string[];
}

// --------------------------------------------------------------------------
// Language-sensitive regex patterns
// --------------------------------------------------------------------------

const CLOSURE_IT = /\b(arrivederci|buona giornata|buon lavoro|a presto|ci sentiamo|alla prossima|buona fortuna)\b|INTERVIEW_COMPLETED/i;
const CLOSURE_EN = /\b(goodbye|good-bye|have a great day|have a good day|farewell|see you soon|all the best|bye bye)\b|INTERVIEW_COMPLETED/i;

const CONTACT_IT = /\b(email|e-mail|telefono|cellulare|numero di (telefono|cellulare|contatto)|linkedin)\b/i;
const CONTACT_EN = /\b(email|e-mail|phone number|telephone|mobile number|linkedin)\b/i;

const CONTINUATION_IT = /\b(continu\w*|prosegu\w*|ancora qualche|ancora un po|altri minuti|pi[uù] minuti|ulteriori domande|qualche domanda|qualche minuto|paio di minuti)\b/i;
const CONTINUATION_EN = /\b(continu\w*|keep going|a few more|few extra|some more questions|bit longer|more minutes|a few questions)\b/i;

const SPECIFIC_PROBE_IT = /\b(esempio|concreto|raccont\w+|in che modo|entrare nel dettaglio|nello specifico)\b/i;
const SPECIFIC_PROBE_EN = /\b(example|specific|concret\w*|tell me (more about|how)|in what way|walk me through|detail)\b/i;

// --------------------------------------------------------------------------
// Private helpers
// --------------------------------------------------------------------------

function normalizeText(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function wordCount(input: string): number {
    return normalizeText(input).split(/\s+/).filter(Boolean).length;
}

function extractKeywords(text: string): string[] {
    return normalizeText(text)
        .split(/\s+/)
        .map(w => w.replace(/[^\w]/g, ''))
        .filter(w => w.length >= 4);
}

// --------------------------------------------------------------------------
// Main export
// --------------------------------------------------------------------------

/**
 * Evaluates a single assistant response turn for interview quality.
 * All checks are stateless regex/heuristic-based (no LLM calls).
 */
export function evaluateInterviewQuestionQuality(params: {
    phase: QualitativePhase;
    topicLabel: string;
    userResponse: string;
    assistantResponse: string;
    previousAssistantResponse?: string | null;
    language: string;
}): QualitativeResult {
    const { phase, userResponse, assistantResponse, previousAssistantResponse, language } = params;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const isDataCollection = phase === 'DATA_COLLECTION';
    const isDeepOffer = phase === 'DEEP_OFFER';

    const closurePattern = isItalian ? CLOSURE_IT : CLOSURE_EN;
    const contactPattern = isItalian ? CONTACT_IT : CONTACT_EN;
    const continuationPattern = isItalian ? CONTINUATION_IT : CONTINUATION_EN;
    const specificProbePattern = isItalian ? SPECIFIC_PROBE_IT : SPECIFIC_PROBE_EN;

    // 1. avoidsClosure — no farewell / closure language in the response
    const avoidsClosure = !closurePattern.test(assistantResponse);

    // 2. avoidsPrematureContact — no contact-info request outside DATA_COLLECTION
    const avoidsPrematureContact = isDataCollection || !contactPattern.test(assistantResponse);

    // 3. deepOfferIntent — in DEEP_OFFER the response must propose continuation
    const deepOfferIntent = !isDeepOffer || continuationPattern.test(assistantResponse);

    // 4. probingWhenUserIsBrief — if user answered ≤5 words, assistant must use a specific probe
    //    (not a broad generic question); exempt for DATA_COLLECTION and DEEP_OFFER
    const userWords = wordCount(userResponse);
    let probingWhenUserIsBrief: boolean;
    if (isDataCollection || isDeepOffer || userWords > 5) {
        probingWhenUserIsBrief = true;
    } else {
        probingWhenUserIsBrief = specificProbePattern.test(assistantResponse);
    }

    // 5. referencesUserContext — if user response is substantial (>8 words) the assistant
    //    should pick up at least one keyword from it; exempt for DATA_COLLECTION and DEEP_OFFER
    let referencesUserContext: boolean;
    if (isDataCollection || isDeepOffer || userWords <= 8) {
        referencesUserContext = true;
    } else {
        const userKeywords = extractKeywords(userResponse);
        const assistantLower = normalizeText(assistantResponse);
        referencesUserContext = userKeywords.some(kw => assistantLower.includes(kw));
    }

    // 6. nonRepetitive — normalised response must differ from the previous assistant turn
    let nonRepetitive = true;
    if (previousAssistantResponse) {
        nonRepetitive =
            normalizeText(assistantResponse) !== normalizeText(previousAssistantResponse);
    }

    // ---------- aggregate ----------
    const checks: QualitativeChecks = {
        avoidsClosure,
        avoidsPrematureContact,
        deepOfferIntent,
        probingWhenUserIsBrief,
        referencesUserContext,
        nonRepetitive
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const score = Math.round((passedChecks / Object.keys(checks).length) * 100);

    const issues: string[] = [];
    if (!avoidsClosure) {
        issues.push(isItalian
            ? "Chiude prematuramente l'intervista in una fase topic."
            : 'Closes the interview prematurely in a topic phase.');
    }
    if (!avoidsPrematureContact) {
        issues.push(isItalian
            ? 'Richiede dati di contatto fuori dalla fase DATA_COLLECTION.'
            : 'Requests contact data outside DATA_COLLECTION phase.');
    }
    if (!deepOfferIntent) {
        issues.push(isItalian
            ? 'In DEEP_OFFER deve proporre continuazione, non porre una domanda topic.'
            : 'In DEEP_OFFER must offer to continue, not ask a topic question.');
    }
    if (!probingWhenUserIsBrief) {
        issues.push(isItalian
            ? "Risposta breve dell'utente richiede probing specifico, non domanda generica."
            : 'Brief user response requires specific probing, not a generic question.');
    }
    if (!referencesUserContext) {
        issues.push(isItalian
            ? "Non aggancia chiaramente alla risposta dell'utente: manca riferimento al contenuto condiviso."
            : "Does not clearly anchor to the user's response: missing reference to shared content.");
    }
    if (!nonRepetitive) {
        issues.push(isItalian
            ? 'Domanda identica a quella precedente.'
            : 'Question is identical to the previous one.');
    }

    return { passed: issues.length === 0, score, checks, issues };
}
