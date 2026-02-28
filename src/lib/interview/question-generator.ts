/**
 * question-generator.ts
 * LLM-based question generation helpers for the interview chat route.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import {
    buildSoftDiagnosticHint,
    normalizeSingleQuestion,
    replaceLiteralTopicTitle,
    isExtensionOfferQuestion,
} from '@/lib/chat/response-builder';
import type { LLMUsageCollector } from '@/lib/interview/chat-intent';

// ---------------------------------------------------------------------------
// generateQuestionOnly
// ---------------------------------------------------------------------------

/**
 * Generates a single focused interview question for a given topic using
 * the provided LLM model instance.
 */
export async function generateQuestionOnly(params: {
    model: any;
    language: string;
    topicLabel: string;
    topicCue?: string | null;
    subGoal?: string | null;
    lastUserMessage?: string | null;
    previousAssistantQuestion?: string | null;
    semanticBridgeHint?: string | null;
    avoidBridgeStems?: string[];
    requireAcknowledgment?: boolean;
    transitionMode?: 'bridge' | 'clean_pivot';
    onUsage?: LLMUsageCollector;
}) {
    const {
        model,
        language,
        topicLabel,
        topicCue,
        subGoal,
        lastUserMessage,
        previousAssistantQuestion,
        semanticBridgeHint,
        avoidBridgeStems,
        requireAcknowledgment,
        transitionMode
    } = params;
    const questionSchema = z.object({
        question: z.string().describe("A single interview question ending with a question mark.")
    });

    const structureInstruction = requireAcknowledgment
        ? `Output structure: (1) one short acknowledgment sentence; (2) one specific question.`
        : `Output structure: one concise question.`;
    const transitionInstruction = transitionMode === 'bridge'
        ? `Transition mode: bridge naturally from the user's point to "${topicLabel}" without literal quotes.`
        : transitionMode === 'clean_pivot'
            ? `Transition mode: clean pivot. Use a neutral acknowledgment and do not paraphrase irrelevant user details.`
            : null;
    const diagnosticHint = buildSoftDiagnosticHint({
        language,
        lastUserMessage: lastUserMessage || '',
        topicLabel,
        subGoal: subGoal || ''
    });

    const prompt = [
        `Language: ${language}`,
        `Topic title (internal): ${topicLabel}`,
        topicCue ? `Natural topic cue for user-facing wording: ${topicCue}` : null,
        subGoal ? `Sub-goal: ${subGoal}` : null,
        lastUserMessage ? `User last message: "${lastUserMessage}"` : null,
        previousAssistantQuestion ? `Previous assistant question to avoid repeating: "${previousAssistantQuestion}"` : null,
        avoidBridgeStems && avoidBridgeStems.length > 0
            ? `Do NOT reuse these recent bridge openings (normalized): ${avoidBridgeStems.slice(0, 8).join(' | ')}`
            : null,
        semanticBridgeHint ? `Bridge hint: ${semanticBridgeHint}` : null,
        `Acknowledgment quality: reference one concrete detail from the user's message (fact, constraint, example, or cause/effect).`,
        `Avoid stock openers like "molto interessante", "e un punto importante", "grazie per aver condiviso", "very interesting", "that's an important point", "thanks for sharing".`,
        `Prefer concrete follow-ups over broad prompts like "cosa ne pensi?" / "what do you think?" unless no better signal is available.`,
        diagnosticHint || null,
        structureInstruction,
        transitionInstruction,
        `Task: Ask exactly ONE concise interview question about the topic. Do NOT close the interview. Do NOT ask for contact data. Avoid literal quote of user's words. Do NOT repeat the topic title verbatim; use natural phrasing. End with a single question mark.`
    ].filter(Boolean).join('\n');

    const result = await generateObject({
        model,
        schema: questionSchema,
        prompt,
        temperature: 0.2
    });
    params.onUsage?.({
        source: 'generate_question_only',
        model: (model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    let question = normalizeSingleQuestion(String(result.object.question || '').trim());
    if (topicCue) {
        question = replaceLiteralTopicTitle(question, topicLabel, topicCue);
    }
    return question;
}

// ---------------------------------------------------------------------------
// generateDeepOfferOnly
// ---------------------------------------------------------------------------

/**
 * Generates the extension-offer message that appears at the end of the
 * scheduled interview duration, asking whether the user wants to continue.
 */
export async function generateDeepOfferOnly(params: {
    model: any;
    language: string;
    extensionPreview?: string[];
    onUsage?: LLMUsageCollector;
}) {
    const schema = z.object({
        message: z.string().describe('A short message that ends with one yes/no extension question.')
    });

    const previewHints = (params.extensionPreview || [])
        .map(h => String(h || '').trim())
        .filter(Boolean)
        .slice(0, 1);
    const starterTheme = previewHints[0] || '';

    const prompt = [
        `Language: ${params.language}`,
        `Task: Write a short extension message with this structure:`,
        `1) Start with a short thank-you for the user's availability and answers so far.`,
        `2) Say naturally that the planned interview time is over (or would be over).`,
        starterTheme
            ? `3) Propose to continue and mention one indirect starting point connected to what the user shared, for example around: ${starterTheme}. Use no quotes, labels, or list formatting.`
            : `3) Propose to continue and mention one concrete single starting point connected to what the user shared, using indirect wording.`,
        `4) Ask exactly ONE yes/no question asking availability for a few more deep-dive questions.`,
        `Do NOT ask topic questions. Do NOT ask for contacts. Do NOT close the interview.`,
        `Keep it natural and concise. End with exactly one question mark.`
    ].join('\n');

    const result = await generateObject({
        model: params.model,
        schema,
        prompt,
        temperature: 0.2
    });
    params.onUsage?.({
        source: 'generate_deep_offer_only',
        model: (params.model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    return normalizeSingleQuestion(String(result.object.message || '').trim());
}

// ---------------------------------------------------------------------------
// enforceDeepOfferQuestion
// ---------------------------------------------------------------------------

/**
 * Ensures the current response text is a valid extension-offer question.
 * If not, attempts to regenerate. Falls back to a hardcoded bilingual template.
 */
export async function enforceDeepOfferQuestion(params: {
    model: any;
    language: string;
    currentText?: string | null;
    extensionPreview?: string[];
    onUsage?: LLMUsageCollector;
}) {
    const { model, language, currentText, extensionPreview } = params;
    const cleanedCurrent = normalizeSingleQuestion(
        String(currentText || '')
            .replace(/INTERVIEW_COMPLETED/gi, '')
            .trim()
    );

    if (isExtensionOfferQuestion(cleanedCurrent, language)) {
        return cleanedCurrent;
    }

    try {
        const generated = await generateDeepOfferOnly({ model, language, extensionPreview, onUsage: params.onUsage });
        if (isExtensionOfferQuestion(generated, language)) {
            return generated;
        }
    } catch (e) {
        console.error('enforceDeepOfferQuestion generation failed:', e);
    }

    const hintText = (extensionPreview || []).map(v => String(v || '').trim()).filter(Boolean)[0] || '';
    return language === 'it'
        ? (hintText
            ? `Grazie per il tempo e per i contributi condivisi fin qui. Il tempo previsto per l'intervista sarebbe terminato: se vuoi, possiamo continuare con qualche domanda in piu, partendo da uno dei punti emersi, ad esempio ${hintText}. Ti va di proseguire ancora per qualche minuto?`
            : `Grazie per il tempo e per i contributi condivisi fin qui. Il tempo previsto per l'intervista sarebbe terminato: se vuoi, possiamo continuare con qualche domanda in piu su uno dei punti più utili emersi. Ti va di proseguire ancora per qualche minuto?`)
        : (hintText
            ? `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions, starting from one point that emerged, for example ${hintText}. Would you like to continue for a few more minutes?`
            : `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions on one useful point that emerged. Would you like to continue for a few more minutes?`);
}
