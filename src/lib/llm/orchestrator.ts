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
    // 1. Determine Model
    const model = bot.modelProvider === 'anthropic'
        ? anthropic(bot.modelName || 'claude-3-5-sonnet-20240620')
        : openai(bot.modelName || 'gpt-4o');

    // 2. Determine Context & State
    // Simple state machine: Intro -> Topic 1... -> Closing
    // We rely on conversation.currentTopicId or order logic.

    let currentTopicIndex = -1;
    if (conversation.currentTopicId) {
        currentTopicIndex = bot.topics.findIndex(t => t.id === conversation.currentTopicId);
    } else {
        // Start or Intro
        // If no topic set, we are at Intro (Topic 0) usually
        currentTopicIndex = 0;
        // In a real app we'd update DB state here, but streaming response shouldn't block.
        // We'll update state "lazily" or assume Topic 0 context.
    }

    const currentTopic = bot.topics[currentTopicIndex];
    const nextTopic = bot.topics[currentTopicIndex + 1];

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
    // We hook onFinish to save the assistant message to DB

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

            // Save User Message (the last one in 'messages' array is likely the user's latest, 
            // BUT 'messages' passed here includes it. We need to save it if not already saved.
            // Actually, usually we save User message BEFORE calling runInterviewTurn.
            // The API route should handle User message saving.
        }
    });

    return result.toDataStreamResponse();
}
