/**
 * Centralized Prompt Sanitizer
 *
 * Previene prompt injection sanitizzando tutti gli input utente
 * PRIMA di interpolarli nei prompt LLM.
 *
 * Uso:
 *   import { sanitize, sanitizeTranscript } from '@/lib/llm/prompt-sanitizer';
 *   const safe = sanitize(userInput);
 *   const safeTranscript = sanitizeTranscript(messages, 8000);
 */

// ── Pattern pericolosi che tentano di sovrascrivere le istruzioni ─────────
const INJECTION_PATTERNS: RegExp[] = [
    // Tentativi diretti di override istruzioni
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
    /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
    /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
    /override\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,

    // Tentativi di role-play o cambio identità
    /you\s+are\s+now\s+(a|an|the)\b/gi,
    /act\s+as\s+(a|an|if)\b/gi,
    /pretend\s+(you\s+are|to\s+be)\b/gi,
    /from\s+now\s+on\s+you\s+(are|will|must|should)\b/gi,
    /new\s+instructions?:\s*/gi,
    /system\s*:\s*/gi,

    // Tentativi di estrazione prompt
    /repeat\s+(your|the|all)\s+(instructions?|prompts?|system\s+message)/gi,
    /show\s+(me\s+)?(your|the)\s+(instructions?|prompts?|system\s+message|rules)/gi,
    /what\s+(are|were)\s+your\s+(instructions?|prompts?|system\s+message|rules)/gi,
    /output\s+(your|the)\s+(instructions?|prompts?|system)/gi,
    /print\s+(your|the)\s+(instructions?|prompts?|system)/gi,

    // Delimitatori di blocco che tentano di iniettare sezioni
    /```\s*(system|assistant|instructions?)\b/gi,
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<<\s*SYS\s*>>/gi,
    /<\|im_start\|>/gi,
];

// ── Caratteri di controllo da rimuovere ───────────────────────────────────
// Mantiene newline (\n), tab (\t), carriage return (\r)
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ── Zero-width characters usati per obfuscare injection ───────────────────
const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g;

/**
 * Sanitizza un singolo input utente prima di interpolarlo in un prompt LLM.
 *
 * - Rimuove caratteri di controllo e zero-width
 * - Neutralizza pattern di injection noti (li wrappa in [FILTERED])
 * - Tronca a maxLength caratteri
 *
 * @param input - Stringa grezza dall'utente
 * @param maxLength - Lunghezza massima (default 4000 caratteri)
 * @returns Stringa sanitizzata sicura per l'interpolazione in prompt
 */
export function sanitize(input: unknown, maxLength: number = 4000): string {
    if (input === null || input === undefined) return '';
    const raw = typeof input === 'string' ? input : String(input);

    let cleaned = raw
        .replace(CONTROL_CHARS_REGEX, '')
        .replace(ZERO_WIDTH_REGEX, '');

    // Neutralizza pattern di injection
    for (const pattern of INJECTION_PATTERNS) {
        // Reset lastIndex per regex globali
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '[FILTERED]');
    }

    // Tronca
    if (cleaned.length > maxLength) {
        cleaned = cleaned.slice(0, maxLength) + '…';
    }

    return cleaned.trim();
}

/**
 * Sanitizza un array di messaggi e li formatta come transcript
 * per prompt di estrazione/analisi.
 *
 * @param messages - Array di messaggi con role e content
 * @param maxTotalLength - Lunghezza massima totale del transcript
 * @returns Transcript sanitizzato
 */
export function sanitizeTranscript(
    messages: Array<{ role: string; content: string }>,
    maxTotalLength: number = 8000
): string {
    const lines: string[] = [];
    let totalLength = 0;

    for (const msg of messages) {
        const role = msg.role.toUpperCase();
        const content = sanitize(msg.content, 2000);
        const line = `${role}: ${content}`;

        if (totalLength + line.length > maxTotalLength) {
            break;
        }

        lines.push(line);
        totalLength += line.length + 1; // +1 for newline
    }

    return lines.join('\n');
}

/**
 * Sanitizza un array di stringhe (es. user messages per analytics).
 *
 * @param items - Array di stringhe
 * @param maxPerItem - Lunghezza massima per item
 * @param maxItems - Numero massimo di items
 * @returns Array sanitizzato
 */
export function sanitizeArray(
    items: string[],
    maxPerItem: number = 500,
    maxItems: number = 100
): string[] {
    return items
        .slice(0, maxItems)
        .map(item => sanitize(item, maxPerItem));
}

/**
 * Sanitizza campi di configurazione bot (name, researchGoal, etc.)
 * Meno aggressivo — questi sono configurati dall'utente admin, non dall'end-user,
 * ma passano comunque nei prompt.
 *
 * @param value - Valore di configurazione
 * @param maxLength - Lunghezza massima (default 1000)
 * @returns Valore sanitizzato
 */
export function sanitizeConfig(value: unknown, maxLength: number = 1000): string {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'string' ? value : String(value);

    return raw
        .replace(CONTROL_CHARS_REGEX, '')
        .replace(ZERO_WIDTH_REGEX, '')
        .slice(0, maxLength)
        .trim();
}
