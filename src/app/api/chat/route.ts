import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST called ===');
    try {
        const body = await req.json();
        console.log('Request body:', JSON.stringify(body, null, 2));
        const { messages, conversationId, botId } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages)) {
            console.error('Invalid messages format:', messages);
            return new Response(
                JSON.stringify({ error: 'Messages must be an array' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: true }
        });

        if (!conversation || conversation.botId !== botId) {
            console.error('Unauthorized: conversation not found or botId mismatch');
            return new Response("Unauthorized", { status: 401 });
        }

        // Save the latest User message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: 'user',
                    content: lastMessage.content
                }
            });
            console.log('Saved user message to DB');
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { topics: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!bot) {
            console.error('Bot not found:', botId);
            return new Response("Bot not found", { status: 404 });
        }

        console.log('Bot loaded:', {
            id: bot.id,
            name: bot.name,
            topicsCount: bot.topics?.length
        });

        // Build system prompt
        const currentTopic = bot.topics?.[0];
        const systemPrompt = `You are an expert qualitative researcher conducting an interview.
Your goal: ${bot.researchGoal}
Audience Info: ${bot.targetAudience}
Tone: ${bot.tone || 'Friendly and professional'}
Language: ${bot.language}

${currentTopic ? `Current Topic: ${currentTopic.label}
Description: ${currentTopic.description}
Sub-Goals: ${currentTopic.subGoals?.join(', ')}` : ''}

INSTRUCTIONS:
1. Ask ONE question at a time.
2. Keep questions short and conversational.
3. If the user answers briefly, probe deeper.
4. Respect privacy.`;

        // Call OpenAI/Anthropic directly
        const apiKey = bot.modelProvider === 'anthropic'
            ? (bot.anthropicApiKey || process.env.ANTHROPIC_API_KEY)
            : (bot.openaiApiKey || process.env.OPENAI_API_KEY);

        if (!apiKey) {
            throw new Error(`No API key configured for ${bot.modelProvider}`);
        }

        let responseText = '';

        if (bot.modelProvider === 'anthropic') {
            // Call Anthropic API
            // Filter out system messages - they go in the system parameter
            const anthropicMessages = messages
                .filter((m: any) => m.role !== 'system')
                .map((m: any) => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                }));

            console.log('Calling Anthropic with:', {
                model: bot.modelName || 'claude-3-5-sonnet-latest',
                messagesCount: anthropicMessages.length,
                systemPromptLength: systemPrompt.length
            });

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: bot.modelName || 'claude-3-5-sonnet-latest',
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: anthropicMessages
                })
            });

            const data = await response.json();
            console.log('Anthropic response:', data);

            if (data.error) {
                throw new Error(`Anthropic API error: ${data.error.message}`);
            }

            responseText = data.content?.[0]?.text || 'Sorry, I could not generate a response.';
        } else {
            // Call OpenAI API
            console.log('Calling OpenAI with:', {
                model: bot.modelName || 'gpt-4o',
                messagesCount: messages.length + 1
            });

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: bot.modelName || 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.map((m: any) => ({
                            role: m.role,
                            content: m.content
                        }))
                    ]
                })
            });

            const data = await response.json();
            console.log('OpenAI response:', data);

            if (data.error) {
                throw new Error(`OpenAI API error: ${data.error.message}`);
            }

            responseText = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
        }

        // Save assistant response
        await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: responseText
            }
        });

        // Return simple text response
        return new Response(responseText, {
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        console.error("Error stack:", error.stack);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
