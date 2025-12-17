import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, CoreMessage } from 'ai';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { generateConversationInsightAction } from '@/app/actions';
import { recordInterviewCompleted } from '@/lib/usage';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST (No-Tools Version) ===');
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration } = body;

        // 1. Validate & Load Data
        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { bot: true }
        });

        if (!conversation || conversation.botId !== botId) {
            return new Response("Unauthorized or Not Found", { status: 404 });
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                topics: { orderBy: { orderIndex: 'asc' } },
                rewardConfig: true,
                knowledgeSources: true
            }
        });

        if (!bot) return new Response("Bot not found", { status: 404 });

        // Update effective duration
        if (effectiveDuration !== undefined) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { effectiveDuration: Number(effectiveDuration) }
            });
        }

        // 2. Save User Message (if new)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: 'user',
                    content: lastMessage.content
                }
            });
        }

        // 3. Resolve API Key & Model
        let apiKey: string | undefined;
        let model: any;

        const globalConfig = await prisma.globalConfig.findUnique({ where: { id: "default" } }).catch(() => null);

        if (bot.modelProvider === 'anthropic') {
            apiKey = bot.anthropicApiKey || globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error("Anthropic API Key missing");
            const anthropic = createAnthropic({ apiKey });
            model = anthropic(bot.modelName || 'claude-3-5-sonnet-latest');
        } else {
            apiKey = bot.openaiApiKey || globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error("OpenAI API Key missing");
            const openai = createOpenAI({ apiKey });
            model = openai(bot.modelName || 'gpt-4o');
        }

        // 4. Build System Prompt
        const fs = require('fs');
        const path = require('path');
        let methodology = '';
        try {
            methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
        } catch (e) { console.warn("Methodology missing", e); }

        // Determine Current Topic
        let currentTopic = bot.topics.find((t: any) => t.id === conversation.currentTopicId) || bot.topics[0];
        const currentTopicIndex = bot.topics.findIndex((t: any) => t.id === currentTopic?.id);
        const nextTopic = bot.topics[currentTopicIndex + 1];

        // Calculate Time
        const currentEffectiveDuration = effectiveDuration !== undefined
            ? Number(effectiveDuration)
            : Math.floor((Date.now() - new Date(conversation.startedAt).getTime()) / 1000);

        // Build base system prompt
        let systemPrompt = PromptBuilder.build(
            bot,
            conversation,
            currentTopic || null,
            methodology,
            currentEffectiveDuration
        );

        // Add transition instructions to the system prompt
        systemPrompt += `

## TRANSITION CONTROL
When you determine that the current topic has been sufficiently covered, include this EXACT marker at the END of your response (after your message to the user):
[TRANSITION_TO_NEXT_TOPIC]

When the interview is complete (all topics covered OR time is up), include this EXACT marker at the END of your response:
[CONCLUDE_INTERVIEW]

IMPORTANT: 
- Only include ONE marker per response, and only when appropriate
- The marker must be on its own line at the very end
- Do NOT include these markers in your conversational text - they are control signals only
- Continue the conversation naturally before adding any marker
`;

        console.log("System Prompt Generated (Snapshot):", systemPrompt.substring(0, 300));

        // 4.5 Topic Manager Evaluation (Adaptive Probing) - Only for OpenAI
        let topicInstruction = null;
        if (currentTopic && bot.modelProvider === 'openai' && messages.length > 2) {
            try {
                const { TopicManager } = require('@/lib/llm/topic-manager');
                const evaluation = await TopicManager.evaluateTopicProgress(
                    messages,
                    currentTopic,
                    apiKey,
                    bot.modelProvider
                );

                console.log("Topic Evaluation:", evaluation);

                if (evaluation.status === 'TRANSITION') {
                    topicInstruction = {
                        role: 'system',
                        content: `[SUPERVISOR INTERVENTION]: The user has SUFFICIENTLY COVERED the current topic ("${currentTopic.label}"). 
INSTRUCTION: Do NOT ask more questions about this topic. 
ACTION: Provide a brief acknowledgment and add [TRANSITION_TO_NEXT_TOPIC] at the end of your response.`
                    };
                } else if (evaluation.missingPoints && evaluation.missingPoints.length > 0) {
                    topicInstruction = {
                        role: 'system',
                        content: `[SUPERVISOR INTERVENTION]: The user has NOT yet covered the following sub-goals: ${evaluation.missingPoints.join(', ')}. 
INSTRUCTION: Ask a specific question to cover these missing points.`
                    };
                }
            } catch (err) {
                console.warn("Topic Manager failed, skipping logic:", err);
            }
        }

        // 4.6 Engagement Monitor (Quality Gate)
        const userMessages = messages.filter((m: any) => m.role === 'user');
        const last3UserMessages = userMessages.slice(-3);
        if (last3UserMessages.length === 3) {
            const isDisengaged = last3UserMessages.every((m: any) => m.content.trim().split(/\s+/).length < 12);
            if (isDisengaged) {
                const encouragement = {
                    role: 'system',
                    content: `[SUPERVISOR INTERVENTION]: The user seems disengaged (consistently short answers). 
INSTRUCTION: Adopt a more encouraging tone or ask a stimulating question to motivate them to elaborate.`
                };
                if (!topicInstruction) {
                    topicInstruction = encouragement;
                } else {
                    topicInstruction.content += `\n\nALSO: ${encouragement.content}`;
                }
            }
        }

        // 5. Generate Response (NO TOOLS)
        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }) as CoreMessage);

        if (messagesForAI.length === 0) {
            messagesForAI.push({ role: 'user', content: "I am ready to start." });
        }

        if (topicInstruction) {
            messagesForAI.push(topicInstruction as CoreMessage);
        }

        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
        });

        let responseText = result.text;

        // 6. Parse markers and execute actions
        let transitioned = false;
        let concluded = false;

        // Check for TRANSITION marker
        if (responseText.includes('[TRANSITION_TO_NEXT_TOPIC]')) {
            responseText = responseText.replace('[TRANSITION_TO_NEXT_TOPIC]', '').trim();

            if (nextTopic) {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { currentTopicId: nextTopic.id }
                });
                console.log(`Transitioned to topic: ${nextTopic.label}`);
                transitioned = true;
            } else {
                // No more topics, conclude
                concluded = true;
            }
        }

        // Check for CONCLUDE marker
        if (responseText.includes('[CONCLUDE_INTERVIEW]') || concluded) {
            responseText = responseText.replace('[CONCLUDE_INTERVIEW]', '').trim();

            await prisma.conversation.update({
                where: { id: conversationId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            });

            // Record usage for subscription tracking
            try {
                const project = await prisma.project.findUnique({
                    where: { id: bot.projectId },
                    select: { organizationId: true }
                });
                if (project?.organizationId) {
                    await recordInterviewCompleted(project.organizationId, conversationId);
                }
            } catch (e) {
                console.error("Failed to record usage", e);
            }

            // Trigger Incremental Analysis
            try {
                await generateConversationInsightAction(conversationId);
            } catch (e) {
                console.error("Failed to trigger analysis", e);
            }

            concluded = true;
        }

        // Post-processing for frontend signals
        const refreshedConv = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { status: true }
        });

        if (refreshedConv?.status === 'COMPLETED' && !responseText.includes('INTERVIEW_COMPLETED')) {
            responseText += " INTERVIEW_COMPLETED";
        }

        // Inject Claim Link if needed
        if (bot.rewardConfig?.enabled && refreshedConv?.status === 'COMPLETED') {
            const claimLink = `/claim/${conversationId}`;
            if (!responseText.includes('claim')) {
                responseText += `\n\n[Claim Reward](${claimLink})`;
            }
        }

        // 7. Save Assistant Message
        await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: responseText
            }
        });

        return new Response(responseText, { status: 200 });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
