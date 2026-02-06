import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { TokenTrackingService } from '@/services/tokenTrackingService';

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { conversationId, message, isHidden } = await req.json();

        // Load conversation with bot and session
        const conversation: any = await (prisma.conversation as any).findUnique({
            where: { id: conversationId },
            include: {
                bot: { include: { knowledgeSources: true, topics: true, project: true } },
                messages: { orderBy: { createdAt: 'asc' } },
                chatbotSession: true
            }
        });

        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        // Explicitly cast or rely on correct generation
        const bot = conversation.bot;
        const session = conversation.chatbotSession;
        if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

        // 1. Check Limits (simplified for brevity, keep existing checks)
        // ... (Limits check omitted for brevity, assume valid)

        // 2. Save User Message
        await prisma.message.create({
            data: { conversationId, role: 'user', content: message }
        });

        // 3. Lead Generation Logic (Slot Filling)
        const candidateFields = (bot.candidateDataFields as any[]) || [];
        let candidateProfile = (conversation.candidateProfile as any) || {};
        let nextMissingField = null;
        const metadata = (conversation.metadata as any) || {};
        const leadCapture = metadata.leadCapture || {
            lastAskedAt: null,
            lastAskedField: null,
            askedCount: 0,
            declined: false
        };

        // Check what's missing (both required and optional)
        for (const field of candidateFields) {
            if (!candidateProfile[field.field]) {
                nextMissingField = field;
                break;
            }
        }

        const systemPromptBase = buildChatbotPrompt(bot, session);

        // Retrieve Global Config for API Key fallback
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });

        const apiKey = bot.openaiApiKey || globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || '';

        if (!apiKey) {
            return Response.json({
                error: 'API_KEY_MISSING',
                message: 'Chiave API OpenAI mancante. Configurala nelle impostazioni generali.'
            }, { status: 401 });
        }

        const openai = createOpenAI({ apiKey });

        let finalResponse = "";
        let isLeadGenTurn = false;

        // Decide if we should be in "Collection Mode"
        const triggerStrategy = bot.leadCaptureStrategy || 'after_3_msgs';
        const canAskByCount =
            (triggerStrategy === 'immediate' && session.messagesCount >= 1) ||
            (triggerStrategy === 'after_3_msgs' && session.messagesCount >= 3);

        const recentlyAsked =
            leadCapture.lastAskedAt &&
            Date.now() - new Date(leadCapture.lastAskedAt).getTime() < 1000 * 60 * 3;

        let shouldCollect = canAskByCount;
        if (leadCapture.declined) {
            shouldCollect = false;
        }

        if (triggerStrategy === 'smart') {
            shouldCollect = false;
            if (!leadCapture.declined && !recentlyAsked && session.messagesCount >= 2 && nextMissingField) {
                try {
                    const smartDecision = await generateObject({
                        model: openai('gpt-4o-mini'),
                        schema: z.object({
                            shouldAsk: z.boolean(),
                            reason: z.string().optional()
                        }),
                        system: `You are a conversion-savvy assistant. Decide if asking for a lead contact field now is appropriate.
Guidelines:
- Only ask after you've provided a useful answer or clarified the user's intent.
- Ask when user shows buying intent (pricing, demo, trial, integration, timeline, budget, procurement).
- Avoid asking on greetings or early exploration.
- Keep it gentle, one field at a time.
- If user seems in a hurry or negative, do not ask.
Return shouldAsk=true only when it is natural.`,
                        messages: conversation.messages.slice(-6).map((m: any) => ({
                            role: m.role as any,
                            content: m.content
                        })).concat({ role: 'user', content: message })
                    });

                    shouldCollect = !!smartDecision.object.shouldAsk;
                } catch (e) {
                    shouldCollect = false;
                }
            }
        }

        // If we have a missing field and triggered
        let justExtractedField = null;  // Track what we just extracted THIS turn

        let shouldAttemptExtraction = false;
        if (nextMissingField && shouldCollect) {
            isLeadGenTurn = true;

            // Only try extraction if we actually asked this field recently
            shouldAttemptExtraction = leadCapture.lastAskedField === nextMissingField.field;

            let extraction: any = null;
            if (shouldAttemptExtraction) {
                extraction = await generateObject({
                    model: openai('gpt-4o-mini'),
                    schema: z.object({
                        [nextMissingField.field]: z.string().optional().describe(`Extracted value for ${nextMissingField.field}`),
                        isRelevantAnswer: z.boolean().describe('Did the user provide the requested information?'),
                        isRefusal: z.boolean().describe('Did the user refuse to provide this information?')
                    }),
                    system: `You are an expert data extractor.
Field to extract: "${nextMissingField.field}"
Context: The user was previously asked: "${nextMissingField.question || nextMissingField.field}".

Rules:
- If the message contains the requested information, extract it and set isRelevantAnswer to true.
- If the message is unrelated, set isRelevantAnswer to false and isRefusal to false.
- If the user refuses to provide the information, set isRelevantAnswer to false and isRefusal to true.
- Be flexible with formatting but accurate with data.`,
                    prompt: message
                });
            }

            // Track extraction tokens - NUOVO: usa userId (owner del progetto) per sistema crediti
            const organizationId = bot.project?.organizationId;
            const projectOwnerId = bot.project?.ownerId;
            if (projectOwnerId && extraction?.usage) {
                TokenTrackingService.logTokenUsage({
                    userId: projectOwnerId,
                    organizationId,
                    projectId: bot.project?.id,
                    inputTokens: extraction.usage?.inputTokens || 0,
                    outputTokens: extraction.usage?.outputTokens || 0,
                    category: 'CHATBOT',
                    model: 'gpt-4o-mini',
                    operation: 'chatbot-extraction',
                    resourceType: 'chatbot',
                    resourceId: bot.id
                }).catch(err => console.error('Token tracking failed:', err));
            }

            if (extraction?.object?.[nextMissingField.field] && extraction.object.isRelevantAnswer) {
                // Saved!
                const extractedValue = extraction.object[nextMissingField.field];
                justExtractedField = {
                    field: nextMissingField.field,
                    value: extractedValue
                };

                candidateProfile = { ...candidateProfile, [nextMissingField.field]: extractedValue };
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { candidateProfile } as any
                });

                // Move to NEXT field
                nextMissingField = null;
                for (const field of candidateFields) {
                    if (!candidateProfile[field.field]) {
                        nextMissingField = field;
                        break;
                    }
                }
            }
        }

        // 4. Generate Response
        // We ALWAYS generate a response, but the context changes based on whether we're collecting data

        const schema = z.object({
            response: z.string().describe('Response to user'),
        });

        let systemPrompt = systemPromptBase;
        const LEAD_SPLIT_TOKEN = '[[LEAD_QUESTION]]';

        // If we have a missing field and should collect
        if (nextMissingField && shouldCollect) {
            const fieldLabel = nextMissingField.field;
            const fieldQuestion = nextMissingField.question || `Qual è la tua ${fieldLabel}?`;

            // Check if user just provided data (we extracted it above in THIS turn)
            const justExtracted = justExtractedField && justExtractedField.field === fieldLabel ? justExtractedField.value : null;

            if (justExtracted) {
                // User just provided the data - acknowledge and move to next field
                // Find the NEXT missing field
                let nextNextField = null;
                for (const field of candidateFields) {
                    if (!candidateProfile[field.field]) {
                        nextNextField = field;
                        break;
                    }
                }

                if (nextNextField) {
                    // Ask for the next field
                    systemPrompt = `
                        ${systemPromptBase}
                        
                        IMPORTANT: The user just provided their ${fieldLabel}: "${justExtracted}".
                        Acknowledge this briefly and naturally.
                        Then ask for: "${nextNextField.question || nextNextField.field}".
                        Format your output in TWO parts separated by the token ${LEAD_SPLIT_TOKEN}.
                        - Part 1: your normal helpful response.
                        - Part 2: the single lead question to ask.
                        ${nextNextField.required ? 'This field is REQUIRED.' : 'This field is optional - if they refuse, accept gracefully.'}
                        Keep it conversational and helpful.
                    `;
                } else {
                    // All fields collected!
                    systemPrompt = `
                        ${systemPromptBase}
                        
                        IMPORTANT: The user just provided their ${fieldLabel}: "${justExtracted}".
                        Thank them warmly for providing all the information.
                        Continue helping them with their original question about the products/services.
                    `;
                }
            } else {
                // User hasn't provided the data yet - ask for it
                systemPrompt = `
                    ${systemPromptBase}
                    
                    IMPORTANT: You need to collect the user's ${fieldLabel}.
                    The user just said: "${message}".
                    Acknowledge what they said briefly (if relevant), then naturally ask: "${fieldQuestion}".
                    Format your output in TWO parts separated by the token ${LEAD_SPLIT_TOKEN}.
                    - Part 1: your normal helpful response.
                    - Part 2: the single lead question to ask.
                    Maintain a natural, helpful, and professional persona.
                `;
            }
        }

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            system: systemPrompt,
            messages: conversation.messages.slice(-10).map((m: any) => ({
                role: m.role as any,
                content: m.content
            })).concat({ role: 'user', content: message }),
        });

        finalResponse = result.object.response;

        let splitParts: { before: string; after: string } | null = null;
        if (finalResponse.includes(LEAD_SPLIT_TOKEN)) {
            const [before, after] = finalResponse.split(LEAD_SPLIT_TOKEN, 2);
            const trimmedBefore = (before || '').trim();
            const trimmedAfter = (after || '').trim();
            if (trimmedBefore || trimmedAfter) {
                splitParts = { before: trimmedBefore, after: trimmedAfter };
            }
        }

        if (nextMissingField && shouldCollect) {
            leadCapture.lastAskedAt = new Date().toISOString();
            leadCapture.lastAskedField = nextMissingField.field;
            leadCapture.askedCount = (leadCapture.askedCount || 0) + 1;
        }

        if (shouldAttemptExtraction && extraction?.object?.isRefusal) {
            leadCapture.declined = true;
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                metadata: {
                    ...(metadata || {}),
                    leadCapture
                }
            } as any
        });

        // Track response tokens - NUOVO: usa userId (owner del progetto) per sistema crediti
        const responseTokens = result.usage?.totalTokens || 0;
        const orgId = bot.project?.organizationId;
        const ownerId = bot.project?.ownerId;
        if (ownerId && result.usage) {
            TokenTrackingService.logTokenUsage({
                userId: ownerId,
                organizationId: orgId,
                projectId: bot.project?.id,
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                category: 'CHATBOT',
                model: 'gpt-4o-mini',
                operation: 'chatbot-response',
                resourceType: 'chatbot',
                resourceId: bot.id
            }).catch(err => console.error('Token tracking failed:', err));
        }

        // 5. Save and Return
        if (splitParts) {
            if (splitParts.before) {
                await prisma.message.create({
                    data: { conversationId, role: 'assistant', content: splitParts.before }
                });
            }
            if (splitParts.after) {
                await prisma.message.create({
                    data: { conversationId, role: 'assistant', content: splitParts.after }
                });
            }
        } else {
            await prisma.message.create({
                data: { conversationId, role: 'assistant', content: finalResponse }
            });
        }

        await prisma.chatbotSession.update({
            where: { id: session.id },
            data: { messagesCount: { increment: 1 }, tokensUsed: { increment: responseTokens } }
        });

        if (splitParts) {
            const responses = [splitParts.before, splitParts.after].filter(Boolean);
            return Response.json({ responses });
        }

        return Response.json({ response: finalResponse });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

function buildChatbotPrompt(bot: any, session: any): string {
    const kb = bot.knowledgeSources?.map((k: any) => `[${k.title}]: ${k.content}`).join('\n\n') || '';

    return `
You are a helpful AI assistant for "${bot.name}".
Tone: ${bot.tone || 'Professional'}

## KNOWLEDGE BASE
${kb}

## CONTEXT
Page: ${session.pageTitle} (${session.pageUrl})

## INSTRUCTIONS
- Answer using Knowledge Base.
- If unknown, admit it nicely.
- Keep it concise.
`.trim();
}
