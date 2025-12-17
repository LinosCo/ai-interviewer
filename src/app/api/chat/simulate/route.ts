
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, tool, CoreMessage } from 'ai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Mock Interfaces matching Prisma models for the simulator
interface MockTopic extends TopicBlock {
    id: string;
    botId: string;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, config, currentTopicIndex = 0, effectiveDuration = 0 } = body;

        if (!messages || !config) {
            return new Response(JSON.stringify({ error: 'Missing messages or config' }), { status: 400 });
        }

        // 1. Construct Mock Objects
        const mockTopics: MockTopic[] = config.topics.map((t: any, i: number) => ({
            id: `topic-${i}`,
            botId: 'mock-bot',
            label: t.label,
            description: t.description,
            subGoals: t.subGoals,
            maxTurns: t.maxTurns || 5,
            orderIndex: i,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        const mockBot: any = {
            id: 'mock-bot',
            name: config.name || 'Preview Bot',
            researchGoal: config.researchGoal,
            targetAudience: config.targetAudience,
            tone: config.tone,
            language: config.language,
            maxDurationMins: config.maxDurationMins,
            introMessage: config.introMessage,
            modelProvider: 'openai', // Default for sim
            modelName: 'gpt-4o',
            topics: mockTopics,
            knowledgeSources: [],
            rewardConfig: { enabled: false }
        };

        const mockConversation: any = {
            id: 'mock-conv',
            botId: 'mock-bot',
            status: 'ACTIVE',
            currentTopicId: mockTopics[currentTopicIndex]?.id || null,
            startedAt: new Date(Date.now() - (effectiveDuration * 1000)),
            effectiveDuration: effectiveDuration
        };

        // 2. Load Methodology
        let methodology = '';
        try {
            methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
        } catch (e) { console.warn("Methodology missing", e); }

        // 3. Build Prompt
        const currentTopic = mockTopics[currentTopicIndex] || null;

        const systemPrompt = PromptBuilder.build(
            mockBot,
            mockConversation,
            currentTopic,
            methodology,
            effectiveDuration
        );

        // 4. Initialize LLM
        // Use environment key directly since we are in simulator (admin/creator usage)
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API Key missing for simulator");

        const openai = createOpenAI({ apiKey });
        const model = openai('gpt-4o');

        // 5. Generate Response
        // We track if topic transition happens to return it to client
        let newTopicIndex = currentTopicIndex;
        let transitionReason = null;
        let isCompleted = false;

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));

        // Fix: Vercel AI SDK throws if messages is empty
        if (messagesForAI.length === 0) {
            messagesForAI.push({ role: 'user', content: "I am ready to start." });
        }

        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
            maxSteps: 5,
            tools: {
                transitionToNextTopic: tool({
                    description: 'Move to the next topic when the current one is sufficiently covered.',
                    parameters: z.object({
                        reason: z.string()
                    }),
                    execute: async ({ reason }: { reason: string }) => {
                        console.log(`[Sim] Transition to next topic: ${reason}`);
                        transitionReason = reason;
                        newTopicIndex = currentTopicIndex + 1;

                        const nextTopic = mockTopics[newTopicIndex];
                        if (nextTopic) {
                            return `TRANSITION_COMPLETE: Moving to topic "${nextTopic.label}".`;
                        } else {
                            return "NO_MORE_TOPICS: You are at the end. Proceed to closing.";
                        }
                    },
                } as any),
                concludeInterview: tool({
                    description: 'End the interview.',
                    parameters: z.object({
                        finalMessage: z.string()
                    }),
                    execute: async ({ finalMessage }: { finalMessage: string }) => {
                        console.log(`[Sim] Conclude interview`);
                        isCompleted = true;
                        return "INTERVIEW_MARKED_COMPLETED";
                    }
                } as any)
            },
        } as any);

        return new Response(JSON.stringify({
            role: 'assistant',
            content: result.text,
            meta: {
                newTopicIndex: newTopicIndex !== currentTopicIndex ? newTopicIndex : undefined,
                isCompleted,
                transitionReason
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Simulator API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
