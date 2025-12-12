import { streamText, convertToCoreMessages, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import { Bot, Conversation, TopicBlock, Message } from '@prisma/client';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runInterviewTurn(
    bot: Bot & { topics: TopicBlock[] },
    conversation: Conversation,
    messages: CoreMessage[]
) {
    // 1. Determine Model & Provider
    let model;
    let apiKey: string | undefined;

    if (bot.modelProvider === 'anthropic') {
        apiKey = bot.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error("No Anthropic API key configured. Please add one in bot settings or system settings.");
        }
        const anthropicProvider = createAnthropic({ apiKey });
        model = anthropicProvider(bot.modelName || 'claude-3-5-sonnet-latest');
    } else {
        apiKey = bot.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("No OpenAI API key configured. Please add one in bot settings or system settings.");
        }
        const openaiProvider = createOpenAI({ apiKey });
        model = openaiProvider(bot.modelName || 'gpt-4o');
    }

    // 2. Determine Context & State
    let currentTopicIndex = -1;
    if (conversation.currentTopicId) {
        currentTopicIndex = bot.topics.findIndex(t => t.id === conversation.currentTopicId);
    } else {
        // Start or Intro: Default to first topic if exists
        currentTopicIndex = 0;
    }

    // Safety check if topics empty or index invalid
    if (currentTopicIndex === -1 && bot.topics.length > 0) currentTopicIndex = 0;

    const currentTopic: TopicBlock | undefined = bot.topics[currentTopicIndex];
    const nextTopic: TopicBlock | undefined = bot.topics[currentTopicIndex + 1];

    // 3. Construct System Prompt
    const systemPrompt = `
You are an expert qualitative researcher conducting an interview.
Your goal: ${bot.researchGoal}
Audience Info: ${bot.targetAudience}
Tone: ${bot.tone || 'Friendly and professional'}
Language: ${bot.language}

CURRENT STATE:
Topic: ${currentTopic ? currentTopic.label : 'Closing'}
Description: ${currentTopic ? currentTopic.description : 'Wrap up the interview.'}
Sub-Goals to cover: ${currentTopic ? currentTopic.subGoals.join(', ') : 'Ensure user feels heard and thank them.'}

INSTRUCTIONS:
1. Ask ONE question at a time.
2. Keep questions short and conversational.
3. If the user answers briefly, probe deeper ("Can you say more about that?").
4. If the user covers a sub-goal, check it off mentally and move to the next.
5. When you feel this topic is covered (or max turns reached), transition to the next topic: "${nextTopic ? nextTopic.label : 'Closing'}".
6. Respect privacy. Do not ask for PII unless necessary.

Current Progress: Topic ${currentTopicIndex + 1} of ${bot.topics.length}.
    `.trim();

    // 4. Stream Response
    const result = await streamText({
        model,
        messages,
        system: systemPrompt,
        onFinish: async (event) => {
            // Save Assistant Message
            await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    role: 'assistant',
                    content: event.text,
                    metadata: { tokens: event.usage.totalTokens }
                }
            });

            // State Transition Logic
            if (currentTopic) {
                // Heuristic: Check if we should move on.
                // For this MVP, we will count how many assistant messages we have sent in TOTAL
                // and if it exceeds cumulative thresholds, we move on. 
                // A better way is to track "turns in current topic" in DB, but we lack the field.

                // Let's assume 1 message = 1 turn.
                const msgs = await prisma.message.count({ where: { conversationId: conversation.id, role: 'assistant' } });

                // Simple logic: If we have > (Index+1) * 5 messages, move to next. 
                // This assumes constant 5 turns per topic. 
                // We should use currentTopic.maxTurns.

                // Fetch all previous topics to sum their maxTurns
                const previousTopics = bot.topics.slice(0, currentTopicIndex);
                const previousTurnsBase = previousTopics.reduce((acc, t) => acc + (t.maxTurns || 5), 0);

                // Current threshold
                const currentThreshold = previousTurnsBase + (currentTopic.maxTurns || 5);

                if (msgs >= currentThreshold) {
                    if (nextTopic) {
                        await prisma.conversation.update({
                            where: { id: conversation.id },
                            data: { currentTopicId: nextTopic.id }
                        });
                    } else {
                        // End of topics -> Closing
                        await prisma.conversation.update({
                            where: { id: conversation.id },
                            data: { currentTopicId: null, status: 'CLOSING' }
                        });
                    }
                }
            }
        }
    });

    return (result as any).toDataStreamResponse();
}
