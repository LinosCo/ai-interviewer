import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, CoreMessage } from 'ai';
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

        let systemPrompt = await PromptBuilder.build(
            mockBot,
            mockConversation,
            currentTopic,
            methodology,
            effectiveDuration
        );

        // 4. Initialize LLM
        // Use environment key directly since we are in simulator (admin/creator usage)
        let apiKey = process.env.OPENAI_API_KEY;

        // Fallback to Global Settings if env var is missing
        if (!apiKey) {
            const globalConfig = await prisma.globalConfig.findUnique({
                where: { id: "default" },
                select: { openaiApiKey: true }
            }).catch(() => null);
            apiKey = globalConfig?.openaiApiKey || undefined;
        }

        if (!apiKey) throw new Error("OpenAI API Key missing for simulator (Check Global Settings or Env Vars)");

        const openai = createOpenAI({ apiKey });
        const model = openai('gpt-4o');

        // 5. Generate Response
        // We track if topic transition happens to return it to client
        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));

        // Fix: Vercel AI SDK throws if messages is empty
        if (messagesForAI.length === 0) {
            messagesForAI.push({ role: 'user', content: "I am ready to start." });
        }


        // Add Transition Control Instructions to System Prompt
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

        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
            frequencyPenalty: 0.5,
            presencePenalty: 0.3,
        });

        let responseText = result.text;
        let transitionReason: string | null = null;
        let newTopicIndex: number | null = null;
        let isCompleted = false;

        // Parse markers
        if (responseText.includes('[TRANSITION_TO_NEXT_TOPIC]')) {
            responseText = responseText.replace('[TRANSITION_TO_NEXT_TOPIC]', '').trim();
            transitionReason = "Topic covered (implied)";
            newTopicIndex = currentTopicIndex + 1;

            const nextTopic = mockTopics[newTopicIndex as number];
            if (!nextTopic) {
                isCompleted = true; // No more topics
            } else {
                console.log(`[Sim] Transition to next topic: ${nextTopic.label}`);
            }
        }

        if (responseText.includes('[CONCLUDE_INTERVIEW]') || (newTopicIndex !== null && !mockTopics[newTopicIndex])) {
            responseText = responseText.replace('[CONCLUDE_INTERVIEW]', '').trim();
            isCompleted = true;
            console.log(`[Sim] Conclude interview`);
        }

        // Add completion marker for frontend if needed
        if (isCompleted && !responseText.includes('INTERVIEW_MARKED_COMPLETED')) {
            // In simulator we might want to just signal it via response body structure if we were returning JSON, 
            // but here we are streaming or just returning text? 
            // The simulator returns a JSON object. We should just set the flags.
        }

        return new Response(JSON.stringify({
            role: 'assistant',
            content: responseText,
            nextTopicIndex: newTopicIndex,
            isCompleted: isCompleted,
            transitionReason: transitionReason
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Simulator API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
