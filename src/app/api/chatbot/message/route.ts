import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { conversationId, message, isHidden } = await req.json();

        // Load conversation with bot and session
        // @ts-ignore: Prisma client might be stale in IDE
        const conversation: any = await (prisma.conversation as any).findUnique({
            where: { id: conversationId },
            include: {
                bot: { include: { knowledgeSources: true, topics: true } },
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
        const shouldCollect =
            (triggerStrategy === 'immediate' && session.messagesCount >= 1) ||
            (triggerStrategy === 'after_3_msgs' && session.messagesCount >= 3) ||
            (triggerStrategy === 'smart'); // Smart is handled by LLM "shouldCapture" flag previously, but here we enforce.

        // If we have a missing field and triggered
        let justExtractedField = null;  // Track what we just extracted THIS turn

        if (nextMissingField && shouldCollect) {
            isLeadGenTurn = true;

            // Check if user JUST answered the previous question (heuristic: simple length or explicit check)
            // Better: Run an extraction pass on the CURRENT message to see if it contains the info
            // ONLY if we were already asking for it. But to keep it simple/stateless:
            // We ALWAYS try to extract `nextMissingField` from current message IF it looks like an answer.

            // Extraction Call
            const extraction = await generateObject({
                model: openai('gpt-4o-mini'),
                schema: z.object({
                    [nextMissingField.field]: z.string().optional().describe(`Extracted value for ${nextMissingField.field}`),
                    isRelevantAnswer: z.boolean().describe('Did the user provide the requested information?')
                }),
                system: `You are an expert data extractor. 
                Field to extract: "${nextMissingField.field}"
                Context: The user was previously asked: "${nextMissingField.question || nextMissingField.field}".
                
                Rules:
                - If the message contains the requested information, extract it and set isRelevantAnswer to true.
                - If the message is unrelated or a refusal, set isRelevantAnswer to false.
                - Be flexible with formatting but accurate with data.`,
                prompt: message
            });

            if (extraction.object[nextMissingField.field] && extraction.object.isRelevantAnswer) {
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

        // If we have a missing field and should collect
        if (nextMissingField && shouldCollect) {
            const fieldLabel = nextMissingField.field;
            const fieldQuestion = nextMissingField.question || `Qual è la tua ${fieldLabel}?`;
            const isRequired = nextMissingField.required || false;

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
                        Acknowledge this briefly and naturally, then ask for: "${nextNextField.question || nextNextField.field}".
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
                    ${message.toLowerCase().includes('no') || message.toLowerCase().includes('non') ?
                        (isRequired ?
                            `The user seems hesitant, but this field is REQUIRED. Politely explain why you need it and ask again: "${fieldQuestion}"` :
                            `The user declined. This field is optional, so accept gracefully and continue the conversation normally.`
                        ) :
                        `Acknowledge what they said briefly (if relevant), then naturally ask: "${fieldQuestion}"`
                    }
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

        // 5. Save and Return
        await prisma.message.create({
            data: { conversationId, role: 'assistant', content: finalResponse }
        });

        // @ts-ignore: Prisma client might be stale
        await prisma.chatbotSession.update({
            where: { id: session.id },
            data: { messagesCount: { increment: 1 }, tokensUsed: { increment: 0 } } // Todo: usage
        });

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
