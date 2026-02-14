
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Message } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// In-memory cache to avoid re-extraction
const extractionCache = new Map<string, Record<string, unknown>>();
const MAX_CACHE_SIZE = 100;

export class CandidateExtractor {

    static async extractProfile(
        messages: Message[],
        apiKey: string,
        conversationId?: string,
        options?: {
            onUsage?: (payload: {
                source: string;
                model?: string | null;
                usage?: {
                    inputTokens?: number | null;
                    outputTokens?: number | null;
                    totalTokens?: number | null;
                } | null;
            }) => void;
        }
    ) {
        // Check cache first
        if (conversationId && extractionCache.has(conversationId)) {
            console.log('[CandidateExtractor] Using cached profile');
            return extractionCache.get(conversationId);
        }

        // Check DB: if already extracted, skip
        if (conversationId) {
            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });

            if (conversation?.candidateProfile && typeof conversation.candidateProfile === 'object' && !Array.isArray(conversation.candidateProfile)) {
                console.log('[CandidateExtractor] Profile already in DB');
                const profile = conversation.candidateProfile as Record<string, unknown>;
                extractionCache.set(conversationId, profile);
                return profile;
            }
        }

        const openai = createOpenAI({ apiKey });
        const extractionModel = openai('gpt-4o');
        const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const schema = z.object({
            fullName: z.string().nullable().describe("Full name"),
            email: z.string().nullable().describe("Email address"),
            phone: z.string().nullable().describe("Phone number"),
            currentRole: z.string().nullable().describe("Current job title or role"),
            company: z.string().nullable().describe("Current company or organization"),
            location: z.string().nullable().describe("City/Location"),
            linkedIn: z.string().nullable().describe("LinkedIn profile link/handle"),
            portfolio: z.string().nullable().describe("Portfolio or website URL"),
            budget: z.string().nullable().describe("Project budget (if applicable)"),
            availability: z.string().nullable().describe("Availability or timeline (e.g. start date, notice period)"),

            hardSkills: z.array(z.string()).describe("List of technical skills or capabilities mentioned"),
            softSkills: z.array(z.string()).describe("List of soft skills or traits demonstrated"),

            experienceSummary: z.string().describe("Brief summary of experience/background (max 3 sentences)"),

            alignmentScore: z.number().min(1).max(10).describe("1-10 Score on alignment with the goals"),
            summaryNote: z.string().describe("Concise note for the reviewer about this contact."),
            userMessage: z.string().nullable().describe("A specific message, question, or final thought left by the user.")
        });

        try {
            // Add timeout protection (10 seconds)
            const extractionPromise = generateObject({
                model: extractionModel,
                schema,
                prompt: `
You are an expert Lead Qualifier and Profiler.
Analyze the following interview transcript and extract a structured profile.

**GUIDELINES**:
1. **Facts First**: Focus on factual data provided by the user.
2. **Smart Inference**: 
   - Looking for Location/Role in the context of their stories if not explicitly asked.
   - DO NOT infer name from email. Only extract name if explicitly stated or clearly addressed.
3. **Be Generous**: If you are 80% sure, extract the data. Don't return null unless truly unknown.

TRANSCRIPT:
${transcript}
`.trim()
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Extraction timeout after 10s')), 10000)
            );

            const result = await Promise.race([extractionPromise, timeoutPromise]) as {
                object: Record<string, unknown>;
                usage?: {
                    inputTokens?: number | null;
                    outputTokens?: number | null;
                    totalTokens?: number | null;
                };
            };
            if (options?.onUsage) {
                try {
                    options.onUsage({
                        source: 'candidate_extractor',
                        model: (extractionModel as any)?.modelId || 'gpt-4o',
                        usage: result.usage || null
                    });
                } catch (usageError) {
                    console.error('[CandidateExtractor] usage callback failed', usageError);
                }
            }

            // Cache the result
            if (conversationId && result.object) {
                if (extractionCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = extractionCache.keys().next().value;
                    if (firstKey !== undefined) extractionCache.delete(firstKey);
                }
                extractionCache.set(conversationId, result.object);
            }

            return result.object;
        } catch (error) {
            console.error("Candidate Extraction Error", error);
            return null;
        }
    }
}
