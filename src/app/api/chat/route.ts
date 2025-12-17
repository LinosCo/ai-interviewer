import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, tool, CoreMessage } from 'ai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { generateConversationInsightAction } from '@/app/actions';
import { recordInterviewCompleted } from '@/lib/usage';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST (Refactored) ===');
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
            // Check if already saved (idempotency check ideal, but simple check for now)
            // Actually, frontend sends optimistic updates. We should save only if not exists or blindly save?
            // Existing logic saved it. Let's stick to it.
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

        // 4. Build System Prompt via Service
        // Load Methodology
        // Optimization: Cache methodology in memory or DB? For now, read file (fast enough).
        const fs = require('fs');
        const path = require('path');
        let methodology = '';
        try {
            methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
        } catch (e) { console.warn("Methodology missing", e); }

        // Determine Current Topic
        let currentTopic = bot.topics.find(t => t.id === conversation.currentTopicId) || bot.topics[0];

        // Calculate Time
        const currentEffectiveDuration = effectiveDuration !== undefined
            ? Number(effectiveDuration)
            : Math.floor((Date.now() - new Date(conversation.startedAt).getTime()) / 1000);

        const systemPrompt = PromptBuilder.build(
            bot,
            conversation,
            currentTopic || null,
            methodology,
            currentEffectiveDuration
        );

        console.log("System Prompt Generated (Snapshot):", systemPrompt.substring(0, 200));

        // 4.5 Topic Manager Evaluation (Adaptive Probing)
        // Only run if we are in a topic (not closing) and using OpenAI (until we support Anthropic schema in TopicManager widely)
        let topicInstruction = null;
        if (currentTopic && bot.modelProvider === 'openai' && messages.length > 2) {
            try {
                // Determine if we should evaluate. Evaluate every turn? Or every other? 
                // Every turn is safest for "Smart Flow".
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
                        content: `[SUPERVISOR INTERVENTION]: The user has SUFFICIENTLY COVERED the current topic ("${currentTopic.label}"). \nINSTRUCTION: Do NOT ask more questions about this topic. \nACTION: Use the 'transitionToNextTopic' tool immediately.`
                    };
                } else if (evaluation.missingPoints && evaluation.missingPoints.length > 0) {
                    topicInstruction = {
                        role: 'system',
                        content: `[SUPERVISOR INTERVENTION]: The user has NOT yet covered the following sub-goals: ${evaluation.missingPoints.join(', ')}. \nINSTRUCTION: Ask a specific question to cover these missing points.`
                    };
                }
            } catch (err) {
                console.warn("Topic Manager failed, skipping logic:", err);
            }
        }

        // 4.6 Engagement Monitor (Quality Gate)
        // Check for 3 consecutive short answers
        const userMessages = messages.filter((m: any) => m.role === 'user');
        const last3UserMessages = userMessages.slice(-3);
        if (last3UserMessages.length === 3) {
            const isDisengaged = last3UserMessages.every((m: any) => m.content.trim().split(/\s+/).length < 12);
            if (isDisengaged) {
                const encouragement = {
                    role: 'system',
                    content: `[SUPERVISOR INTERVENTION]: The user seems disengaged (consistently short answers). \nINSTRUCTION: Adopt a more encouraging tone or ask a stimulating question to motivate them to elaborate.`
                };
                if (!topicInstruction) {
                    topicInstruction = encouragement; // Use encouragement if no topic instruction
                } else {
                    // Combine them if both exist
                    topicInstruction.content += `\n\nALSO: ${encouragement.content}`;
                }
            }
        }

        // 5. Generate Response with Tools
        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }) as CoreMessage);
        if (topicInstruction) {
            messagesForAI.push(topicInstruction as CoreMessage);
        }

        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
            maxSteps: 5, // Allow tool usage loop
            tools: {
                transitionToNextTopic: tool({
                    description: 'Move to the next topic when the current one is sufficiently covered.',
                    parameters: z.object({
                        reason: z.string().describe('Why we are moving on (e.g. "User covered all sub-goals")')
                    }),
                    execute: async ({ reason }: { reason: string }) => {
                        console.log(`Tool: transitionToNextTopic triggered. Reason: ${reason}`);

                        // Find next topic
                        const currentIndex = bot.topics.findIndex(t => t.id === currentTopic?.id);
                        const nextTopic = bot.topics[currentIndex + 1];

                        if (nextTopic) {
                            await prisma.conversation.update({
                                where: { id: conversationId },
                                data: { currentTopicId: nextTopic.id }
                            });
                            return `TRANSITION_COMPLETE: Moving to topic "${nextTopic.label}".`;
                        } else {
                            return "NO_MORE_TOPICS: You are at the end. Proceed to closing.";
                        }
                    },
                } as any),
                concludeInterview: tool({
                    description: 'End the interview when time is up or all topics are covered.',
                    parameters: z.object({
                        finalMessage: z.string().describe('The final closing statement to the user')
                    }),
                    execute: async ({ finalMessage }: { finalMessage: string }) => {
                        console.log("Tool: concludeInterview triggered.");
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

                        return "INTERVIEW_MARKED_COMPLETED";
                    }
                } as any),
                // We could add logInsight tool here later for incremental analytics!
            }
        } as any); // Cast to any because maxSteps might allow wider types or TS definition is lagging

        let responseText = result.text;

        // Post-processing for frontend signals
        // If the tool `concludeInterview` was called, we might want to ensure the token is present for frontend handling
        // The previous frontend depended on "INTERVIEW_COMPLETED" string.
        // Let's re-inject it if the status is completed, just in case the model didn't say it in text.
        const refreshedConv = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { status: true }
        });

        if (refreshedConv?.status === 'COMPLETED' && !responseText.includes('INTERVIEW_COMPLETED')) {
            responseText += " INTERVIEW_COMPLETED";
        }

        // Inject Claim Link if needed (Fallback if model forgot, though context prompt asks for it)
        if (bot.rewardConfig?.enabled && refreshedConv?.status === 'COMPLETED') {
            const claimLink = `/claim/${conversationId}`; // Relative link is fine for frontend
            if (!responseText.includes('claim')) {
                responseText += `\n\n[Claim Reward](${claimLink})`;
            }
        }

        // 6. Save Assistant Message
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
