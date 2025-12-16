import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST called ===');
    try {
        const body = await req.json();
        console.log('Request body:', JSON.stringify(body, null, 2));
        const { messages, conversationId, botId, effectiveDuration } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages)) {
            console.error('Invalid messages format:', messages);
            return new Response(
                JSON.stringify({ error: 'Messages must be an array' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate conversation ownership/existence
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { bot: true }
        });

        if (!conversation) {
            return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Update effective duration if provided (cumulative from frontend)
        if (effectiveDuration !== undefined) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { effectiveDuration: Number(effectiveDuration) }
            });
        }

        if (conversation.botId !== botId) {
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
            include: {
                topics: { orderBy: { orderIndex: 'asc' } },
                rewardConfig: true
            }
        });

        if (!bot) {
            console.error('Bot not found:', botId);
            return new Response("Bot not found", { status: 404 });
        }

        console.log('Bot loaded:', {
            id: bot.id,
            name: bot.name,
            topicsCount: bot.topics?.length,
            hasReward: !!bot.rewardConfig?.enabled
        });

        // Load system-wide interview methodology knowledge
        const fs = require('fs');
        const path = require('path');
        let methodologyKnowledge = '';

        try {
            const knowledgePath = path.join(process.cwd(), 'knowledge', 'interview-methodology.md');
            methodologyKnowledge = fs.readFileSync(knowledgePath, 'utf-8');
        } catch (error) {
            console.warn('Could not load interview methodology knowledge:', error);
        }

        // Load bot-specific knowledge sources
        const botKnowledgeSources = await prisma.knowledgeSource.findMany({
            where: { botId: bot.id }
        });

        const botKnowledge = botKnowledgeSources.length > 0
            ? '\n\n## Bot-Specific Knowledge\n' + botKnowledgeSources.map(ks =>
                `### ${ks.title}\n${ks.content}`
            ).join('\n\n')
            : '';

        // Calculate time context
        // Calculate time context (Use Effective Time if available, fallback to Wall Clock)
        // effectiveDuration is in seconds.
        const effectiveMinutes = effectiveDuration !== undefined
            ? Math.floor(effectiveDuration / 60)
            : Math.floor((Date.now() - new Date(conversation.startedAt).getTime()) / 60000);

        const elapsedMinutes = effectiveMinutes;
        const maxDuration = bot.maxDurationMins || 15;
        const remainingMinutes = maxDuration - elapsedMinutes;

        // Format topics for the prompt
        const topicsList = bot.topics?.map((t, i) =>
            `${i + 1}. ${t.label} (Goal: ${t.subGoals?.join(', ') || t.description})`
        ).join('\n');

        // Reward context string and Link
        const headerHost = req.headers.get('host') || 'localhost:3000';
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const claimLink = `${protocol}://${headerHost}/claim/${conversationId}`;

        const rewardContext = bot.rewardConfig?.enabled
            ? `\n- **Reward Active**: User gets "${bot.rewardConfig.displayText}".\n- **Claim Link**: ${claimLink} (ONLY provide this when interview ends)`
            : '';

        const closingInstruction = bot.rewardConfig?.enabled
            ? `**Closing Instruction**: When the interview ends (for any reason), ALWAYS say goodbye, provide the Reward Claim Link: ${claimLink}, and append "INTERVIEW_COMPLETED" to signify the end.`
            : `**Closing Instruction**: When the interview ends (for any reason), ALWAYS say goodbye, DO NOT mention the reward claim link, and append "INTERVIEW_COMPLETED" to signify the end.`;

        const systemPrompt = `You are an expert qualitative researcher conducting an interview.
        
## Interview Methodology & Strategy
${methodologyKnowledge}

## Time Management Context
- **Total Budget**: ${maxDuration} minutes
- **Elapsed Time**: ${elapsedMinutes} minutes
- **Remaining Time**: ${remainingMinutes} minutes
- **Current Status**: ${remainingMinutes < 2 ? 'CLOSING SOON' : 'IN PROGRESS'}
${rewardContext}

## Circular Flow Strategy
1. **Phase 1 (Survey)**: Ask main question for EACH topic.
   - If time is abundant (> 5 mins remaining): Ask 1 follow-up for interesting answers.
   - If time is tight (< 5 mins remaining): No follow-ups, move to next topic.
2. **Phase 2 (Deep Dive)**: If all topics covered and time remains, revisit interesting answers.

**CRITICAL - TIME EXPIRATION PROTOCOL**:
If \`Remaining Time\` <= 0 AND you haven't negotiated overtime yet:
   - STOP regular questions.
   - **First**: Briefly acknowledge/validate the user's last response to close the topic naturally.
   - **Then, Output EXACTLY this structure (translated to ${bot.language || 'the user\'s language'})**:
     1. [Transition]: "However, I see that the time available to us is up. Thank you for your availability."
     2. "You can obtain your reward by clicking here: [Claim Reward](${claimLink})" (ONLY if reward is active).
     3. "Your answers about [mention specific interesting point from their last few messages] were very interesting."
     4. "If you are available, I would likely to deepen these topics to improve our products and services. Shall we continue for a few more minutes?"

**IF user says YES to overtime**:
   - Acknowledge their kindness.
   - **Explicitly state (in ${bot.language || 'user language'})**: "Perfect. Since you've already earned the reward, feel free to stop this conversation whenever you want."
   - Continue with Phase 2 (Deep Dive) and ignore time limits.
   - Focus on the topics you mentioned as interesting.

**IF user says NO to overtime**:
   - Thank them warmly.
   - Say "INTERVIEW_COMPLETED" at the very end.

**IF user has NOT answered the overtime question yet**:
   - Do NOT say "INTERVIEW_COMPLETED" yet. Wait for their Yes/No.

## Research Topics (Your Agenda)
${topicsList}

## Your Mission
Goal: ${bot.researchGoal}
Audience: ${bot.targetAudience}
Tone: ${bot.tone || 'Friendly and professional'}
Language: ${bot.language}

${botKnowledge}

## Instructions
1. **Check History**: Have you already asked for overtime? If user said Yes, keep going.
2. **Determine Phase**: Phase 1 (Coverage) -> Phase 2 (Depth).
3. **One Question Rule**: Ask ONE question at a time.
4. **No Pedantry**: Do not be annoying.

${closingInstruction}`.trim();

        // Get API keys - Hierarchy: Bot Specific -> Global Config (DB) -> Env Var
        let apiKey: string | undefined;
        let globalConfig: any = null;

        // Fetch Global Config for fallback
        try {
            globalConfig = await prisma.globalConfig.findUnique({ where: { id: "default" } });
        } catch (e) {
            console.warn("Failed to fetch global config", e);
        }

        if (bot.modelProvider === 'anthropic') {
            apiKey = bot.anthropicApiKey || globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
        } else {
            apiKey = bot.openaiApiKey || globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;
        }

        if (!apiKey) {
            const errorMsg = `No API key configured for ${bot.modelProvider}. Please add your ${bot.modelProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key in the dashboard settings (Settings → API Keys).`;
            console.error(errorMsg);
            return new Response(
                errorMsg,
                { status: 400, headers: { 'Content-Type': 'text/plain' } }
            );
        }

        console.log(`Using ${bot.modelProvider} API key from ${bot.anthropicApiKey || bot.openaiApiKey ? 'bot settings' : 'platform defaults'}`);

        let responseText = '';

        if (bot.modelProvider === 'anthropic') {
            // Call Anthropic API
            // Filter out system messages - they go in the system parameter
            let anthropicMessages = messages
                .filter((m: any) => m.role !== 'system')
                .map((m: any) => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                }));

            // Anthropic requires first message to be from user
            if (anthropicMessages.length === 0 || anthropicMessages[0].role !== 'user') {
                anthropicMessages = [
                    { role: 'user', content: "I'm ready to start the interview." },
                    ...anthropicMessages
                ];
            }

            console.log('Calling Anthropic with:', {
                model: bot.modelName || 'claude-3-5-sonnet-latest',
                messagesCount: anthropicMessages.length,
                systemPromptLength: systemPrompt.length,
                firstMessage: anthropicMessages[0]
            });

            const anthropicBody = {
                model: bot.modelName || 'claude-3-5-sonnet-latest',
                max_tokens: 1024,
                system: systemPrompt,
                messages: anthropicMessages
            };

            console.log('Anthropic request body:', JSON.stringify(anthropicBody, null, 2));

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(anthropicBody)
            });

            const data = await response.json();
            console.log('Anthropic response:', JSON.stringify(data, null, 2));

            if (data.error) {
                throw new Error(`Anthropic API error: ${JSON.stringify(data.error)}`);
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

            responseText = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
        }

        // Check for completion signal (Unified for ALL providers)
        if (responseText.includes("INTERVIEW_COMPLETED") || (bot.rewardConfig?.enabled && responseText.includes(claimLink))) {
            console.log("Completion signal detected. Marking conversation as COMPLETED.");
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            });
            // Clean up the output so user doesn't see the raw flag
            responseText = responseText.replace(/INTERVIEW_COMPLETED/g, "").trim();
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
