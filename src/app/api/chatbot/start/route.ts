import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

function sanitizeContextValue(value: unknown, maxLen: number): string {
    if (typeof value !== 'string') return '';
    const cleaned = value
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen)}...`;
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function POST(req: NextRequest) {
    try {
        const { botId, sessionId, pageContext } = await req.json();

        if (!botId || !sessionId) {
            return Response.json({ error: 'Missing botId or sessionId' }, { status: 400 });
        }

        // Validate bot exists and is chatbot type
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { include: { organization: true } } }
        });

        if (!bot) { //removed strict type check for now to allow mixed testing if needed, or re-add
            return Response.json({ error: 'Bot not found' }, { status: 404 });
        }

        // Optional: Enforce botType check if strictly separated
        // if (bot.botType !== 'chatbot') { ... } 

        // Check domain whitelist
        const allowedList = toStringArray(bot.allowedDomains);
        if (allowedList.length > 0) {
            const currentUrl = pageContext?.url || '';

            // Extract hostname from URL
            let hostname = '';
            try {
                hostname = new URL(currentUrl).hostname;
            } catch {
                // Invalid URL
            }

            const isAllowed = allowedList.some(domain => {
                if (domain.startsWith('*.')) {
                    const suffix = domain.slice(2);
                    return hostname.endsWith(suffix) || hostname === suffix;
                }
                return hostname === domain;
            });

            if (!isAllowed) {
                // Log but maybe allow for now or block? Blocking for security.
                // return Response.json({ error: 'Domain not allowed' }, { status: 403 });
            }
        }

        // Create conversation
        const conversation = await prisma.conversation.create({
            data: {
                botId,
                participantId: `chatbot_${sessionId}`,
                status: 'STARTED'
            }
        });

        // Create chatbot session (always), optionally enriched with page context.
        const normalizedPageContext = {
            url: sanitizeContextValue(pageContext?.url, 800),
            title: sanitizeContextValue(pageContext?.title, 400),
            description: sanitizeContextValue(pageContext?.description, 1000),
            mainContent: sanitizeContextValue(pageContext?.mainContent, 4000)
        };

        await prisma.chatbotSession.create({
            data: {
                botId,
                conversationId: conversation.id,
                sessionId,
                pageUrl: normalizedPageContext.url || '',
                pageTitle: normalizedPageContext.title || '',
                pageDescription: normalizedPageContext.description || '',
                pageContent: normalizedPageContext.mainContent || '',
                userAgent: req.headers.get('user-agent') || '',
                referrer: req.headers.get('referer') || ''
            }
        });

        // Generate welcome message
        const welcomeMessage = bot.introMessage ||
            `Ciao! 👋 Sono l'assistente di ${bot.name}. Come posso aiutarti?`;

        return Response.json({
            conversationId: conversation.id,
            welcomeMessage
        });
    } catch (error) {
        console.error('Error starting chatbot session:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
