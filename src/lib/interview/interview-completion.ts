/**
 * interview-completion.ts
 * Interview lifecycle finalization helpers for the interview chat route.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { ChatService } from '@/services/chat-service';
import { prisma } from '@/lib/prisma';
import type { LLMUsageCollector } from '@/lib/interview/chat-intent';

// ---------------------------------------------------------------------------
// completeInterview
// ---------------------------------------------------------------------------

/**
 * Finalizes an interview by running profile extraction and marking the
 * conversation as completed in parallel. Saves the extracted candidate
 * profile to the conversation record if extraction succeeds.
 */
export async function completeInterview(
    conversationId: string,
    messages: any[],
    apiKey: string,
    existingProfile: any,
    options?: { simulationMode?: boolean; onLlmUsage?: LLMUsageCollector; language?: string }
): Promise<void> {
    // Run profile extraction and completion marking in PARALLEL
    // This saves time by not waiting for one before starting the other
    const [extractedProfile] = await Promise.all([
        // Profile extraction (slow LLM call)
        (async () => {
            try {
                const { CandidateExtractor } = await import('@/lib/llm/candidate-extractor');
                return await CandidateExtractor.extractProfile(messages, apiKey, conversationId, options?.language, {
                    onUsage: options?.onLlmUsage
                });
            } catch (e) {
                console.error("Profile extraction failed:", e);
                return null;
            }
        })(),
        // Mark interview as completed.
        // In local simulation mode, skip usage counters/credits side effects.
        options?.simulationMode
            ? prisma.conversation.update({
                where: { id: conversationId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })
            : ChatService.completeInterview(conversationId)
    ]);

    // Save extracted profile if available
    if (extractedProfile) {
        const mergedProfile = { ...extractedProfile, ...existingProfile };
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { candidateProfile: mergedProfile }
        });
        console.log("👤 Profile saved");
    }
}
