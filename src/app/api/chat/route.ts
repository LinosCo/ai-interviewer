import { prisma } from '@/lib/prisma';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { generateText, CoreMessage } from 'ai';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { recordInterviewCompleted, checkInterviewStatus, markInterviewAsCompleted } from '@/lib/usage';
import { LLMService } from '@/services/llmService';
import { ToneAnalyzer } from '@/lib/tone/tone-analyzer';
import { buildToneAdaptationPrompt } from '@/lib/tone/tone-prompt-adapter';
import { analyzeForProactiveSuggestions } from '@/lib/proactive/proactive-suggestions';
import { TopicManager } from '@/lib/llm/topic-manager';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST (Phase 5: Limits Implementation) ===');
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration } = body;

        // 1. Data Loading & Initial Validation
        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                bot: {
                    include: {
                        topics: { orderBy: { orderIndex: 'asc' } }
                    }
                }
            }
        });

        if (!conversation || conversation.botId !== botId) {
            return new Response("Unauthorized or Not Found", { status: 404 });
        }

        if (conversation.status === 'COMPLETED') {
            return new Response("INTERVIEW_COMPLETED", { status: 200 });
        }

        // 2. Update Progress (Effective Duration & Stats)
        const updatedEffectiveDuration = effectiveDuration !== undefined ? Number(effectiveDuration) : conversation.effectiveDuration;

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                effectiveDuration: updatedEffectiveDuration,
                exchangeCount: { increment: 1 }
            }
        });

        // 3. Status & Limit Check
        const status = await checkInterviewStatus(conversationId);

        if (status.shouldConclude) {
            console.log(`Interview Limit Reached (${status.reason}) for ${conversationId}`);
            await markInterviewAsCompleted(conversationId);

            // Send a final "Limit Reached" message or signal
            const closingNotice = status.reason === 'TIME'
                ? "Il tempo a disposizione per questa intervista è terminato. Grazie per la partecipazione!"
                : "Abbiamo raccolto sufficienti informazioni per questa fase. Grazie mille!";

            return Response.json({
                text: `${closingNotice} INTERVIEW_COMPLETED`,
                isCompleted: true,
                currentTopicId: conversation.currentTopicId
            });
        }

        // 4. Resolve Model
        const model = await LLMService.getModel(conversation.bot);
        const methodology = LLMService.getMethodology();

        // 5. Build Prompts
        const currentTopic = conversation.bot.topics.find((t: any) => t.id === conversation.currentTopicId) || conversation.bot.topics[0];

        // --- RESTORED TOPIC SUPERVISOR ---
        let supervisorInsight = undefined;
        if (currentTopic && messages.length > 2) {
            // Only run supervisor if we have some history
            try {
                console.log("🔍 Running Topic Supervisor...");
                const analysis = await TopicManager.evaluateTopicProgress(
                    messages as any[],
                    currentTopic,
                    process.env.OPENAI_API_KEY || ''
                );
                console.log("🔍 Supervisor Verdict:", analysis);
                supervisorInsight = {
                    status: analysis.status,
                    nextSubGoal: analysis.nextSubGoal,
                    focusPoint: analysis.focusPoint
                };
            } catch (err) {
                console.error("Supervisor Failed", err);
            }
        }

        // --- FAILSAFE: FORCE TRANSITION IF STUCK ON TOPIC 1 ---
        // User reported "10 questions always on first subtopic".
        // If we are on the first topic and have excessive history, force move.
        // Approx 2 messages per turn. 10 turns = 20 messages.
        const topicIndex = conversation.bot.topics.findIndex((t: any) => t.id === conversation.currentTopicId);
        if (topicIndex === 0 && messages.length > 18) {
            console.log("🚨 FORCE TRANSITION: Stuck on Topic 1 for too long.");
            supervisorInsight = {
                status: 'TRANSITION'
            };
        }

        let systemPrompt = PromptBuilder.build(
            conversation.bot,
            conversation,
            currentTopic || null,
            methodology,
            updatedEffectiveDuration,
            supervisorInsight
        );

        // --- BUSINESS TUNER MEMORY INTEGRATION ---
        // 1. Update memory with new user message (if applicable)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            const apiKey = process.env.OPENAI_API_KEY || '';
            const currentTopicLabel = currentTopic?.label || 'Generale';

            // Non-blocking memory update (fire and forget to not slow down response too much, 
            // or await if we want to ensure consistency)
            // Awaiting is safer for the prototype to avoid race conditions on next turn
            await MemoryManager.updateAfterUserResponse(
                conversationId,
                lastMessage.content,
                currentTopic?.id || '',
                currentTopicLabel,
                apiKey
            );
        }

        // 2. Get formatted memory context
        const memory = await MemoryManager.get(conversationId);
        const memoryContext = memory ? MemoryManager.formatForPrompt(memory) : '';

        // 3. Inject into prompt
        // We inject it before the control section

        // --- PHASE 4: TONE ADAPTATION ---
        const toneAnalyzer = new ToneAnalyzer(process.env.OPENAI_API_KEY || '');
        // Analyze recent memory or messages
        // We can use the memory's detectedTone or re-analyze last messages if needed.
        // For simplicity, let's use the memory's detected tone if available, or analyze recent.

        let toneInstructions = "";
        if (memory?.detectedTone) {
            // Simplified adaptation based on single label
            toneInstructions = memory.detectedTone === 'formal' ? "Mantieni un tono professionale." :
                memory.detectedTone === 'casual' ? "Usa un tono colloquiale." : "";
        } else {
            // Deeper analysis
            const lastMessages = messages.slice(-5).map((m: any) => ({ role: m.role, content: m.content }));
            const toneProfile = await toneAnalyzer.analyzeTone(lastMessages);
            toneInstructions = buildToneAdaptationPrompt(toneProfile);
        }

        // -----------------------------------------

        systemPrompt += `

${memoryContext}

${toneInstructions}

## TRANSITION & COMPLETION CONTROL
When topic is covered, add: [TRANSITION_TO_NEXT_TOPIC]
When interview is complete, add: [CONCLUDE_INTERVIEW]

IMPORTANT: Markers must be on THEIR OWN LINE at the very end of your response.
`;

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }) as CoreMessage);
        if (messagesForAI.length === 0) messagesForAI.push({ role: 'user', content: "I am ready." });

        // 6. Generate
        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
            frequencyPenalty: 0.8, // Aggressive penalty for repeats
            presencePenalty: 0.6, // Encourage new topics
        });

        let responseText = result.text;

        // 7. Post-Processing (Markers & Status)

        // --- PHASE 4: PROACTIVE SUGGESTIONS ---
        // If the user's last answer was short/vague, we might want to append suggestions.
        // We check this AFTER generating the AI response, but we might also append it as metadata/structured data.
        // For now, let's append it to the text if the AI didn't already handle it well, 
        // OR better: return it as a structured part of the response if we were using a JSON API.
        // Since we return text/stream, we'll append it visually or handle it client-side.
        // Here, we'll try to detect if we need it.

        if (lastMessage && lastMessage.role === 'user' && lastMessage.content.length < 50) {
            const suggestions = await analyzeForProactiveSuggestions(
                lastMessage.content,
                currentTopic?.label || '',
                null,
                process.env.OPENAI_API_KEY || ''
            );

            if (suggestions) {
                // Append suggestions as a special block for the client to parse?
                // Or just append text. Let's append text for now.
                const suggestionsText = suggestions.suggestions.map(s => `• ${s}`).join('\n');
                responseText += `\n\n(Suggerimenti: \n${suggestionsText})`;
            }
        }

        if (responseText.includes('[CONCLUDE_INTERVIEW]')) {
            responseText = responseText.replace('[CONCLUDE_INTERVIEW]', '').trim();
            await markInterviewAsCompleted(conversationId);
            responseText += " INTERVIEW_COMPLETED";
        } else if (responseText.includes('[TRANSITION_TO_NEXT_TOPIC]')) {
            responseText = responseText.replace('[TRANSITION_TO_NEXT_TOPIC]', '').trim();
            // Topic transition logic from Bot.topics index...
            const botTopics = await prisma.topicBlock.findMany({
                where: { botId: conversation.bot.id },
                orderBy: { orderIndex: 'asc' }
            });
            const currentIndex = botTopics.findIndex((t: any) => t.id === conversation.currentTopicId);
            const nextTopic = botTopics[currentIndex + 1];

            if (nextTopic) {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { currentTopicId: nextTopic.id }
                });
            } else {
                await markInterviewAsCompleted(conversationId);
                responseText += " INTERVIEW_COMPLETED";
            }
        }

        // 8. Save Assistant Message
        await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: responseText
            }
        });

        return Response.json({
            text: responseText,
            currentTopicId: conversation.currentTopicId, // Updated topic ID if changed
            isCompleted: responseText.includes('INTERVIEW_COMPLETED')
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
