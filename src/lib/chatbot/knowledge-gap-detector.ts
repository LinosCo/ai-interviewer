import { prisma } from "@/lib/prisma";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

const GapSchema = z.object({
    topic: z.string().describe("The main topic of the missing information"),
    priority: z.enum(["high", "medium", "low"]).describe("Importance of filling this gap based on user intent"),
    reasoning: z.string().describe("Why this is a gap"),
    suggestedQuestion: z.string().describe("How this should be phrased as a FAQ question"),
    suggestedAnswerDraft: z.string().describe("A draft answer if inferable, or guidelines on how to answer")
});

export async function detectKnowledgeGaps(botId: string, lookbackDays: number = 7) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new Error("Bot not found");

    const fallbackMsg = bot.fallbackMessage || "non ho questa informazione"; // Default partial match

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    // 1. Find conversations where the bot likely used a fallback
    // This is a heuristic. Ideally we flag messages as "fallback" in metadata during chat.
    // For now, we search message content.
    const badConversations = await prisma.conversation.findMany({
        where: {
            botId: botId,
            startedAt: { gte: startDate },
            messages: {
                some: {
                    role: "assistant",
                    content: { contains: fallbackMsg, mode: 'insensitive' }
                }
            }
        },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    console.log(`[GapDetector] Found ${badConversations.length} conversations with potential gaps.`);

    for (const convo of badConversations) {
        // Find the exchange where fallback occurred
        const messages = convo.messages;

        // Find index of fallback
        // Simplification: just analyze the FIRST fallback for now to save tokens
        const fallbackIndex = messages.findIndex(m =>
            m.role === 'assistant' &&
            m.content.toLowerCase().includes(fallbackMsg.toLowerCase())
        );

        if (fallbackIndex > 0) {
            const userQuestion = messages[fallbackIndex - 1]; // The message before fallback
            if (userQuestion.role !== 'user') continue;

            // 2. Analyze with LLM
            try {
                const { object: gap } = await generateObject({
                    model: openai("gpt-4o-mini"),
                    schema: GapSchema,
                    temperature: 0,
                    prompt: `
                    You are a knowledge gap analyst. An AI chatbot failed to answer a user question.
                    Analyze the interaction and identify the specific knowledge gap.

                    Bot Context: ${sanitizeConfig(bot.description) || "Customer Service Bot"}

                    User Question: "${sanitize(userQuestion.content)}"
                    Bot Response: "${sanitize(messages[fallbackIndex].content)}"

                    Gap Categories (choose the most fitting):
                    - PRODUCT_INFO: Missing product specs, features, availability
                    - PRICING: Missing pricing, plans, discounts, payment info
                    - PROCESS: Missing how-to, steps, procedures, workflows
                    - POLICY: Missing return/refund/cancellation/legal policies
                    - CONTACT: Missing contact details, support channels, hours
                    - TECHNICAL: Missing technical specs, integration, compatibility
                    - COMPANY: Missing about-us, team, history, certifications
                    - OTHER: Does not fit above categories

                    Priority rules:
                    - HIGH: Direct blocker to purchase or main user goal; asked multiple times
                    - MEDIUM: Important context the user needs but not an immediate blocker
                    - LOW: Nice-to-have detail, edge case, or out-of-scope request

                    Generate a clear FAQ question and a draft answer. If the answer is not inferable
                    from context, describe exactly what information should be added to the knowledge base.
                `
                });

                // 3. Save to DB
                // Check if similar gap already exists? String matching on topic
                const existing = await prisma.knowledgeGap.findFirst({
                    where: {
                        botId: botId,
                        topic: gap.topic
                    }
                });

                if (existing) {
                    // Update evidence count
                    // (Simplified update)
                    await prisma.knowledgeGap.update({
                        where: { id: existing.id },
                        data: {
                            evidence: {
                                count: (existing.evidence as any)?.count + 1 || 2
                            }
                        }
                    });
                } else {
                    await prisma.knowledgeGap.create({
                        data: {
                            botId,
                            topic: gap.topic,
                            priority: gap.priority,
                            evidence: {
                                fallbackCount: 1,
                                questions: [userQuestion.content]
                            },
                            suggestedFaq: {
                                question: gap.suggestedQuestion,
                                answer: gap.suggestedAnswerDraft
                            },
                            status: 'pending'
                        }
                    });
                }

            } catch (error) {
                console.error("Failed to analyze gap", error);
            }
        }
    }
}
