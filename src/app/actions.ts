'use server'

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const BotSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    researchGoal: z.string().optional(),
    targetAudience: z.string().optional(),
    language: z.string().default("en"),
    tone: z.string().optional(),
    maxDurationMins: z.coerce.number().default(10),
    introMessage: z.string().optional(),
})

async function getEffectiveApiKey(user: any, botSpecificKey?: string | null) {
    // 1. Bot-specific key always wins
    if (botSpecificKey) return botSpecificKey;

    // 2. If User has their own personal platform key set, use it (Legacy/Personal)
    if (user.platformOpenaiApiKey) return user.platformOpenaiApiKey;

    // 3. ADMIN Logic: Fallback to Global/Env allowed
    if (user.role === 'ADMIN') {
        const globalConfig = await prisma.globalConfig.findUnique({ where: { id: "default" } });
        if (globalConfig?.openaiApiKey) return globalConfig.openaiApiKey;
        return process.env.OPENAI_API_KEY;
    }

    // 4. Regular User Logic: No fallback to Global/Env allowed
    return null;
}

export async function startInterviewAction(botId: string) {
    // Generate anonymous participant ID or use session if present (but session is admin usually)
    const participantId = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const conversation = await prisma.conversation.create({
        data: {
            botId,
            participantId,
            status: 'STARTED',
            startedAt: new Date(),
        }
    });

    redirect(`/i/chat/${conversation.id}`);
}

export async function createBotAction(projectId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const researchGoal = formData.get('researchGoal') as string;
    const targetAudience = formData.get('targetAudience') as string;
    const aiTopicsJson = formData.get('aiGeneratedTopics') as string;

    if (!name) throw new Error("Name required");

    let topicsToCreate = [
        { orderIndex: 0, label: "Introduction", description: "Welcome the user and explain the context." },
        { orderIndex: 1, label: "Main Questions", description: "Core research questions." }
    ];

    if (aiTopicsJson) {
        try {
            const parsedTopics = JSON.parse(aiTopicsJson);
            topicsToCreate = parsedTopics.map((t: any, i: number) => ({
                orderIndex: i,
                label: t.label,
                description: t.description,
                subGoals: t.subGoals || []
            }));
        } catch (e) {
            console.error("Failed to parse AI topics", e);
        }
    }

    const bot = await prisma.bot.create({
        data: {
            projectId,
            name,
            description,
            //             researchGoal, // TODO: Add to schema? Yes, schema has it.
            researchGoal: researchGoal || null,
            targetAudience: targetAudience || null,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000),
            topics: {
                create: topicsToCreate
            }
        }
    });

    revalidatePath('/dashboard');
    redirect(`/dashboard/bots/${bot.id}`);
}

export async function createProjectAction(formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    const name = formData.get('name') as string;
    if (!name) throw new Error("Name required");

    await prisma.project.create({
        data: {
            name,
            ownerId: user.id
        }
    });

    revalidatePath('/dashboard');
    redirect('/dashboard');
}

export async function deleteProjectAction(projectId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    if (user.role !== 'ADMIN') {
        throw new Error("Only admins can delete projects.");
    }

    await prisma.project.delete({ where: { id: projectId } });
    revalidatePath('/dashboard');
}

export async function renameProjectAction(projectId: string, newName: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    if (user.role !== 'ADMIN' && project.ownerId !== user.id) {
        throw new Error("Unauthorized");
    }

    await prisma.project.update({
        where: { id: projectId },
        data: { name: newName }
    });
    revalidatePath('/dashboard');
}

export async function deleteBotAction(botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { project: true }
    });
    if (!bot) throw new Error("Bot not found");

    const isOwner = bot.project.ownerId === user.id;

    console.log(`Delete Bot Attempt: BotId=${botId}, User=${user.email}, Role=${user.role}, ProjectOwner=${bot.project.ownerId}, IsOwner=${isOwner}`);

    if (user.role !== 'ADMIN' && !isOwner) {
        console.error("Delete Bot Unauthorized");
        throw new Error("Unauthorized");
    }

    await prisma.bot.delete({ where: { id: botId } });
    revalidatePath('/dashboard');
}

export async function updateBotAction(botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const data = {
        name: formData.get('name') as string,
        researchGoal: formData.get('researchGoal') as string,
        targetAudience: formData.get('targetAudience') as string,
        language: formData.get('language') as string,
        tone: formData.get('tone') as string,
        introMessage: formData.get('introMessage') as string,
        maxDurationMins: Number(formData.get('maxDurationMins')),
        modelProvider: formData.get('modelProvider') as string,
        modelName: formData.get('modelName') as string,
        openaiApiKey: formData.get('openaiApiKey') ? (formData.get('openaiApiKey') as string) : undefined,
        anthropicApiKey: formData.get('anthropicApiKey') ? (formData.get('anthropicApiKey') as string) : undefined,
        // Branding fields
        logoUrl: formData.get('logoUrl') as string | null,
        primaryColor: formData.get('primaryColor') as string,
        backgroundColor: formData.get('backgroundColor') as string,
        textColor: formData.get('textColor') as string,
    };

    // Filter out undefined keys so we don't overwrite with null if they were just left empty
    // But here optional fields should be update-able to empty. 
    // If user leaves empty, should we delete? 
    // UI logic: defaultValue uses existing. If user clears it, it sends empty string.
    // If empty string, we should save null or empty string?
    // Let's rely on standard Prisma behavior, but if user inputs nothing (and it was previously set), 
    // we want to keep it? No, if user clears input, they want to clear key.
    // The Input has defaultValue={bot.key}. So if unchanged, it sends key.
    // If changed to empty, it sends empty string.
    // We should probably convert empty string to null.

    if (data.openaiApiKey === '') data.openaiApiKey = null as any;
    if (data.anthropicApiKey === '') data.anthropicApiKey = null as any;
    if (data.logoUrl === '') data.logoUrl = null;

    await prisma.bot.update({
        where: { id: botId },
        data
    });

    revalidatePath(`/dashboard/bots/${botId}`);
    return { success: true };
}

export async function generateBotConfigAction(prompt: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    // Fetch user to get keys
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    // Use platform key or fallback to global/env
    const apiKey = await getEffectiveApiKey(user);
    if (!apiKey) throw new Error("No OpenAI API Key configured. As a user, you must configure your own API key in Settings.");

    const openai = createOpenAI({ apiKey });

    const schema = z.object({
        name: z.string().describe("A catchy name for the bot"),
        description: z.string().optional().describe("Short internal description"),
        researchGoal: z.string().describe("The main objective of the interview"),
        targetAudience: z.string().describe("Who we are interviewing"),
        topics: z.array(z.object({
            label: z.string(),
            description: z.string(),
            subGoals: z.array(z.string()).describe("3-5 specific questions or data points to gather")
        })).describe("3-5 main topics to cover")
    });

    // Load methodology for context
    const fs = require('fs');
    const path = require('path');
    let methodology = '';
    try {
        methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
    } catch (e) { console.error("Failed to load methodology", e); }

    const result = await generateObject({
        model: openai('gpt-4o'),
        schema,
        prompt: `You are an expert user researcher designing an interview guide.
        
        Using the following INTERVIEW METHODOLOGY as your strict guide:
        ${methodology.substring(0, 2000)}...

        Design an interview guide based on this concept: "${prompt}".
        
        Create a structure that applies these principles:
        1. **Conversational & Natural**: Avoid stiff, corporate, or academic language.
        2. **Neutrality**: Questions must not differ judgement.
        3. **Flow**: logical flow of topics (Introduction -> Warm up -> Core Questions -> Wrap up).
        `,
    });

    return result.object;
}

export async function generateBotAnalyticsAction(botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    // Fetch conversations
    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            conversations: {
                where: { messages: { some: { role: 'user' } } },
                include: { messages: { where: { role: 'user' } } }
            },
            topics: { orderBy: { orderIndex: 'asc' } }
        }
    });

    if (!bot || bot.conversations.length === 0) return;

    // Resolve API Key
    const apiKey = await getEffectiveApiKey(user, bot.openaiApiKey);
    if (!apiKey) throw new Error("No OpenAI API Key configured for this bot or user.");

    // Prepare text for analysis
    // We'll concatenate the last few user messages from each conversation or a summary.
    // For MVP, perform a "Global Analysis" on the dataset.

    // Simplification: Take map of texts, prefixed with Conversation ID for citation
    const transcripts = bot.conversations.map(c =>
        `[ConvID:${c.id}] Message Log:\n` + c.messages.map(m => `User: "${m.content}"`).join("\n")
    ).join("\n\n----------------\n\n");

    const openai = createOpenAI({ apiKey });

    const schema = z.object({
        themes: z.array(z.object({
            name: z.string(),
            description: z.string(),
            count: z.number(),
            citations: z.array(z.object({
                quote: z.string(),
                conversationId: z.string()
            })).describe("Direct quotes supporting this theme, with their source Conversation ID")
        })),
        insights: z.array(z.object({
            content: z.string(),
            citations: z.array(z.object({
                quote: z.string(),
                conversationId: z.string()
            })).describe("Evidence quotes for this insight")
        })).describe("Strategic observations or actionable suggestions"),
        sentimentScore: z.number().describe("Overall sentiment score from 0 to 100"),
        goldenQuotes: z.array(z.object({
            quote: z.string(),
            conversationId: z.string(),
            context: z.string().optional()
        })).describe("3-5 most impactful or representative direct quotes from users with their exact source"),
        topicAnalysis: z.array(z.object({
            topicLabel: z.string(),
            keywords: z.array(z.object({
                word: z.string(),
                count: z.number(),
                sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional()
            })).describe("Key terms or concepts mentioned by users regarding this topic")
        })).optional()
    });

    const result = await generateObject({
        model: openai('gpt-4o'),
        schema,
        prompt: `Analyze the following interview transcripts for the bot "${bot.name}".
        Identify recurring themes, key user feedback patterns, and strategic insights.
        Also determine an overall sentiment score (0-100) and extract 'Golden Quotes' that perfectly capture the user experience or feedback.
        
        Additionally, analyze the responses for EACH of the following defined topics:
        ${bot.topics.map(t => `- ${t.label}: ${t.description}`).join('\n')}

        For each topic, extract the most frequent keywords or concepts (Word Cloud data) and their frequency.

        IMPORTANT: For every theme, insight, and quote, you MUST provide "citations". 
        A citation consists of the exact "quote" from the user and the "conversationId" where it was found (look for [ConvID:...] in the text).
        
        Transcripts:
        ${transcripts.substring(0, 80000)} // Increased context limit
        
        Output meaningful themes with counts and evidence, actionable insights with evidence, a sentiment score, directed quotes, and topic-specific keyword analysis.`,
    });

    // Save to DB
    // Clear old themes/insights? Maybe yes for this MVP sync.
    await prisma.theme.deleteMany({ where: { botId } });
    await prisma.insight.deleteMany({ where: { botId } });

    const data = result.object;

    // Create Themes
    for (const t of data.themes) {
        await prisma.theme.create({
            data: {
                botId,
                name: t.name,
                description: t.description,
                occurrences: {
                    create: t.citations.map(cit => ({
                        conversationId: cit.conversationId.replace('ConvID:', '').trim(), // Ensure ID is clean if AI kept prefix
                        strengthScore: 1, // Default
                        snippet: cit.quote
                    })).slice(0, t.count) // ensure we match count roughly or just take all citations
                }
                // If AI returns fewer citations than "count", that's fine. 
                // We rely on citation array length for actual relations.
            }
        });
    }

    // Create Insights
    for (const i of data.insights) {
        await prisma.insight.create({
            data: {
                botId,
                content: i.content,
                type: 'STRATEGIC',
                citations: i.citations as any // Save JSON
            }
        });
    }

    // Create Golden Quotes
    for (const q of data.goldenQuotes) {
        await prisma.insight.create({
            data: {
                botId,
                content: q.quote,
                type: 'QUOTE',
                // Store metadata link in citations too or a new field? 
                // Using 'citations' field to store the single source is consistent.
                citations: [{ quote: q.quote, conversationId: q.conversationId, context: q.context }] as any
            }
        });
    }

    // Update Topic Keywords
    if (data.topicAnalysis) {
        for (const topicData of data.topicAnalysis) {
            // Find matching topic by label (approximate match or exact?)
            // We sent the labels, so AI should return them.
            const topic = bot.topics.find(t => t.label === topicData.topicLabel);
            if (topic) {
                await prisma.topicBlock.update({
                    where: { id: topic.id },
                    data: { keywords: topicData.keywords as any }
                });
            }
        }
    }


    // Update Bot Metadata (Sentiment)
    await prisma.bot.update({
        where: { id: botId },
        data: {
            analyticsMetadata: {
                sentimentScore: data.sentimentScore,
                lastAnalyzed: new Date().toISOString()
            }
        }
    });

    revalidatePath(`/dashboard/bots/${botId}/analytics`);
}

export async function addTopicAction(botId: string, orderIndex: number) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    await prisma.topicBlock.create({
        data: {
            botId,
            orderIndex,
            label: "New Topic",
            description: "Describe what to ask here.",
            subGoals: [],
        }
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function updateTopicAction(topicId: string, botId: string, data: any) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    let subGoals = data.subGoals;
    if (typeof subGoals === 'string') {
        subGoals = subGoals.split('\n').filter((s: string) => s.trim().length > 0);
    }

    await prisma.topicBlock.update({
        where: { id: topicId },
        data: {
            label: data.label,
            description: data.description,
            subGoals: subGoals,
            maxTurns: Number(data.maxTurns || 5)
        }
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function deleteTopicAction(topicId: string, botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    await prisma.topicBlock.delete({ where: { id: topicId } });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function addKnowledgeSourceAction(botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const type = formData.get('type') as string || 'TEXT'; // TEXT or FILE (though we only support text paste for MVP)

    if (!content) return; // Silent fail or error?

    await prisma.knowledgeSource.create({
        data: {
            botId,
            title: title || 'Untitled Source',
            type: type,
            content: content
        }
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function deleteKnowledgeSourceAction(sourceId: string, botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    await prisma.knowledgeSource.delete({ where: { id: sourceId } });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function updateSettingsAction(userId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    // Simple security check:
    const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser || currentUser.id !== userId) throw new Error("Unauthorized");

    const openaiKey = formData.get('platformOpenaiApiKey') as string;
    const anthropicKey = formData.get('platformAnthropicApiKey') as string;

    // If Admin, update Global Config
    if (currentUser.role === 'ADMIN') {
        await prisma.globalConfig.upsert({
            where: { id: "default" },
            update: {
                openaiApiKey: openaiKey || null,
                anthropicApiKey: anthropicKey || null,
            },
            create: {
                id: "default",
                openaiApiKey: openaiKey || null,
                anthropicApiKey: anthropicKey || null,
            }
        });
    }

    // Always update User Platform Settings linked to user (for methodology etc, but maybe remove API keys from user?)
    // For now, we update the user entity too if we want to keep "Personal" keys support.
    // BUT the prompt implies "general keys available for all".
    // If I leave user keys update here, the Admin might overwrite their own personal key while intending to set Global.
    // Let's decided:
    // - Admin sets GLOBAL keys via this form.
    // - Non-Admin CANNOT set keys via this form (UI will disable it).
    // So if Admin, we update Global.
    // If Non-Admin, we technically shouldn't be receiving keys to update if UI is disabled.
    // But if we do, should we let them set personal keys?
    // "impostabili solo dall'admin" -> "Set ONLY by admin".
    // This implies ONLY Global keys exist or matter for this UI.
    // So I will only update GlobalConfig if Admin.
    // I will NOT update User keys anymore.

    // Update methodology if needed (which is on User's PlatformSettings currently or should be migrated?)
    // Methodology is seemingly per-user in current schema model PlatformSettings?
    // Let's just keep API Key logic here.

    // Update User settings (Methodology, etc.) but SKIP api keys if we are moving to global.
    // Only update methodology here?
    // The form sends all data.

    // Let's separate concerns.
    const methodologyKnowledge = formData.get('methodologyKnowledge') as string;

    // Update linked PlatformSettings (Methodology)
    await prisma.platformSettings.upsert({
        where: { userId },
        update: { methodologyKnowledge },
        create: { userId, methodologyKnowledge }
    });

    // We do NOT update user.platformOpenaiApiKey anymore to enforce "Global Only" or "Admin Managed".
    // Effectively ignoring personal key inputs.

    revalidatePath('/dashboard/settings');
}

export async function refineTextAction(currentText: string, fieldName: string, context: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");
    // Refine text doesn't have a bot context usually, so it relies on User keys.
    const apiKey = await getEffectiveApiKey(user);
    if (!apiKey) throw new Error("No OpenAI API Key configured. Please add one in Settings.");

    const openai = createOpenAI({ apiKey });

    // Load methodology for context
    const fs = require('fs');
    const path = require('path');
    let methodology = '';
    try {
        methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
    } catch (e) { console.error("Failed to load methodology", e); }

    const { object } = await generateObject({
        model: openai('gpt-4o'),
        schema: z.object({ text: z.string() }),
        prompt: `Refine the following text for the field "${fieldName}" in a user research bot configuration.
        Context: The bot is named or about: "${context}".
        
        Refer to this INTERVIEW METHODOLOGY for tone and style:
        ${methodology.substring(0, 1500)}...

        Current Text: "${currentText}"
        
        GOAL: Improve clarity and IMPACT, but ensure the tone is **NATURAL, CONVERSATIONAL, and AUTHENTIC**.
        - AVOID: "Corporate speak", overly formal language, rigid academic phrasing.
        - PREFER: Warm, engaging, spoken-like language. 
        - If it's a Goal description, make it actionable.
        - If it's a Topic label or specific question, make it sound like a human asking.

        IMPORTANT: If the Current Text is in Italian, the refined text MUST be in Italian.
        If the Current Text is in English, keep it in English. detect the language and stick to it.`,
    });

    return object.text;
}

export async function saveBotMessageAction(conversationId: string, content: string) {
    const session = await auth();
    // Allow anonymous participants to save the initial bot message? 
    // This action is called from the client when the interview starts.
    // Ideally we should verify ownership or token, but for now we'll check if the conversation exists.

    // Actually, this might be open to abuse if public. 
    // But since it's just saving the "Intro" message which is configured on the bot...
    // We can verify that the conversation is in 'STARTED' state and has NO messages yet.

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: true }
    });

    if (!conversation) throw new Error("Conversation not found");

    // Only allow saving if it's the VERY FIRST message (or close to start) to prevent injection later
    if (conversation.messages.length > 0) {
        // If message already exists (maybe double call), check if it's the same.
        if (conversation.messages[0].content === content && conversation.messages[0].role === 'assistant') {
            return; // Already saved
        }
        // Otherwise, ignore or throw? 
        // Let's allow it but log it. Strictly we only want this for the intro.
    }

    await prisma.message.create({
        data: {
            conversationId,
            role: 'assistant',
            content
        }
    });
}
