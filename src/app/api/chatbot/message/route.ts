import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { conversationId, message, isHidden } = await req.json();

        // Load conversation with bot and session
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                bot: { include: { knowledgeSources: true, topics: true } },
                messages: { orderBy: { createdAt: 'asc' } },
                chatbotSession: true
            }
        });

        if (!conversation) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
        }

        const bot = conversation.bot;
        const session = conversation.chatbotSession;

        if (!session) {
            return Response.json({ error: 'Session not found' }, { status: 404 });
        }

        // Check token limits (Monthly + Add-ons)
        // Find organization via Project -> Bot
        const botWithOrg = await prisma.bot.findUnique({
            where: { id: bot.id },
            include: { project: { include: { organization: { include: { tokenUsage: true } } } } }
        });

        const org = botWithOrg?.project?.organization;

        if (org) {
            const limits = getPlanLimits(org.plan || 'TRIAL');
            const currentUsage = org.tokenUsage?.usedTokens || 0;
            const purchased = org.tokenUsage?.purchasedTokens || 0;
            const monthlyLimit = limits.monthlyTokenBudget;

            if (currentUsage >= (monthlyLimit + purchased)) {
                return Response.json({
                    response: 'Il limite mensile di token è stato raggiunto. Contatta l\'amministratore per acquistare pacchetti aggiuntivi.',
                    limitReached: true
                });
            }
        }

        // Check message limit per session
        if (session.messagesCount >= bot.maxMessagesPerSession && !isHidden) {
            return Response.json({
                response: 'Grazie per la conversazione! Per continuare, lasciami il tuo contatto.',
                shouldCaptureLead: true
            });
        }

        // Save user message (even if hidden/system)
        await prisma.message.create({
            data: {
                conversationId,
                role: 'user',
                content: message
            }
        });

        // If hidden (e.g. Lead Form submission), we might just acknowledge and return
        if (isHidden) {
            // In a real scenario we might process this differently. 
            // For now let's just create a thank you note from AI without calling LLM or call LLM with specific context
            // Let's assume we want the AI to acknowledge the lead submission
        }

        // Build context-aware prompt
        const systemPrompt = buildChatbotPrompt(bot, session);

        // Get API key
        const apiKey = bot.openaiApiKey || process.env.OPENAI_API_KEY || '';
        const openai = createOpenAI({ apiKey });

        // Generate response with token limit
        const schema = z.object({
            response: z.string().describe('Conversational response to user'),
            shouldCaptureLead: z.boolean().describe('Should we ask for contact info now?')
        });

        const messages = conversation.messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }));

        // Add current message
        const currentMessages = [...messages, { role: 'user', content: message }];

        // Limit context (last 10 messages)
        const limitedMessages = currentMessages.length > 10
            ? currentMessages.slice(-10)
            : currentMessages;

        const result = await generateObject({
            model: openai('gpt-4o-mini'), // Cheaper model for chatbot
            schema,
            system: systemPrompt,
            messages: limitedMessages as any,
            temperature: 0.7,
            maxTokens: bot.maxTokensPerMessage
        });

        // Save assistant response
        await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: result.object.response
            }
        });

        // Update session stats
        await prisma.chatbotSession.update({
            where: { id: session.id },
            data: {
                messagesCount: { increment: 1 },
                tokensUsed: { increment: result.usage?.totalTokens || 0 }
            }
        });

        // Update Org Token Usage
        if (org) {
            await prisma.tokenUsage.upsert({
                where: { organizationId: org.id },
                update: { usedTokens: { increment: result.usage?.totalTokens || 0 } },
                create: {
                    organizationId: org.id,
                    usedTokens: result.usage?.totalTokens || 0,
                    periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)) // Naive next month
                }
            });
        }

        // Check lead capture strategy
        let shouldCaptureLead = result.object.shouldCaptureLead;
        if (bot.leadCaptureStrategy === 'after_3_msgs' && session.messagesCount >= 3) {
            shouldCaptureLead = true;
        }

        return Response.json({
            response: result.object.response,
            shouldCaptureLead
        });

    } catch (error) {
        console.error('Error in chatbot message:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function buildChatbotPrompt(bot: any, session: any): string {
    const kb = bot.knowledgeSources?.map((k: any) => `[${k.title} (${k.type})]: ${k.content}`).join('\n\n') || '';
    const topics = bot.topics?.map((t: any) => `- ${t.label}: ${t.description}`).join('\n') || 'None';

    return `
You are a helpful AI assistant for "${bot.name}".

## YOUR ROLE
- Answer user questions based on the knowledge base
- Be conversational, friendly, and helpful
- Tone: ${bot.tone || 'Professional and warm'}
- Language: ${bot.language || 'it'}

## KNOWLEDGE BASE (PRIMARY SOURCE)
${kb}

## PAGE CONTEXT (where user is browsing)
URL: ${session.pageUrl}
Title: ${session.pageTitle}
Description: ${session.pageDescription}
Content: ${session.pageContent?.substring(0, 1000)}

## TOPICS OF INTEREST (secondary)
${topics}

## INSTRUCTIONS
1. Answer questions using KNOWLEDGE BASE first
2. Reference PAGE CONTEXT if relevant to user's question
3. If you don't know something, say so honestly: "${bot.fallbackMessage || 'Mi dispiace, non ho informazioni su questo argomento'}"
4. Keep responses concise (max ${bot.maxTokensPerMessage} tokens)
5. After 3-4 exchanges, if user seems interested, suggest leaving contact for follow-up

## LEAD GENERATION
If user shows interest or asks about pricing/demo/contact:
- Set shouldCaptureLead = true
- Say: "${bot.leadCaptureMessage || 'Ti andrebbe di lasciare il tuo contatto? Così possiamo approfondire meglio!'}"
`.trim();
}

function getPlanLimits(plan: string) {
    // Limits calibrated for margins
    const limits: Record<string, any> = {
        TRIAL: { monthlyTokenBudget: 50000, maxTokensPerMessage: 300 }, // ~100 msgs
        STARTER: { monthlyTokenBudget: 200000, maxTokensPerMessage: 500 }, // ~400 msgs
        PRO: { monthlyTokenBudget: 1000000, maxTokensPerMessage: 1000 }, // ~2000 msgs
        BUSINESS: { monthlyTokenBudget: 5000000, maxTokensPerMessage: 1500 } // ~10k msgs
    };
    return limits[plan] || limits.TRIAL;
}
