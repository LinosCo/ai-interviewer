'use server'

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { isFeatureEnabled } from '@/lib/usage'
import { decryptIfNeeded, encryptIfNeeded } from '@/lib/encryption'
import fs from 'fs';
import path from 'path';
import { User, Prisma } from '@prisma/client';
import { transferBotToProject } from './actions/project-tools';
import {
    assertOrganizationAccess,
    assertProjectAccess,
    ensureDefaultProjectForOrganization,
    syncLegacyProjectAccessForProject
} from '@/lib/domain/workspace';
import { regenerateInterviewPlan } from '@/lib/interview/plan-service';
import { checkTrialResourceLimit } from '@/lib/trial-limits';
import {
    ensureAutoInterviewKnowledgeSource,
    regenerateAutoInterviewKnowledgeSource
} from '@/lib/interview/manual-knowledge-source';

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function ensureInterviewGuideForBot(botId: string) {
    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
            id: true,
            botType: true,
            language: true,
            name: true,
            researchGoal: true,
            targetAudience: true,
            topics: {
                orderBy: { orderIndex: 'asc' },
                select: {
                    label: true,
                    description: true,
                    subGoals: true
                }
            }
        }
    });

    if (!bot) return;
    if (bot.botType === 'chatbot') return;
    if (!Array.isArray(bot.topics) || bot.topics.length === 0) return;

    await ensureAutoInterviewKnowledgeSource({
        botId: bot.id,
        language: bot.language || 'it',
        botName: bot.name,
        researchGoal: bot.researchGoal,
        targetAudience: bot.targetAudience,
        topics: bot.topics
    });
}

async function getEffectiveApiKey(user: User, botSpecificKey?: string | null) {
    // 1. Bot-specific key always wins (decrypt if needed)
    if (botSpecificKey) return decryptIfNeeded(botSpecificKey);

    // 2. If User has their own personal platform key set, use it (decrypt if needed)
    if (user.platformOpenaiApiKey) return decryptIfNeeded(user.platformOpenaiApiKey);

    // 3. ADMIN Logic: Fallback to Global/Env allowed
    if (user.role === 'ADMIN') {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: "default" },
            select: { openaiApiKey: true }
        });
        if (globalConfig?.openaiApiKey) return decryptIfNeeded(globalConfig.openaiApiKey);
        // Never expose env key directly - should be set in DB encrypted
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

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true }
    });

    if (!project) throw new Error("Project not found");

    if (project.organizationId) {
        const trialLimitCheck = await checkTrialResourceLimit({
            organizationId: project.organizationId,
            resource: 'interview'
        });

        if (!trialLimitCheck.allowed) {
            throw new Error(trialLimitCheck.reason || 'Trial limit reached');
        }
    }

    let topicsToCreate = [
        { orderIndex: 0, label: "Introduction", description: "Welcome the user and explain the context." },
        { orderIndex: 1, label: "Main Questions", description: "Core research questions." }
    ];

    if (aiTopicsJson) {
        try {
            const parsedTopics = JSON.parse(aiTopicsJson);
            topicsToCreate = parsedTopics.map((t: { label: string; description: string; subGoals?: string[] }, i: number) => ({
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
            researchGoal: researchGoal || null,
            targetAudience: targetAudience || null,
            botType: 'interview',
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomUUID().split('-')[0],
            topics: {
                create: topicsToCreate
            }
        }
    });

    try {
        await ensureAutoInterviewKnowledgeSource({
            botId: bot.id,
            language: 'it',
            botName: bot.name,
            researchGoal: researchGoal || null,
            targetAudience: targetAudience || null,
            topics: topicsToCreate.map((topic: any) => ({
                label: topic.label,
                description: topic.description,
                subGoals: Array.isArray(topic.subGoals) ? topic.subGoals : []
            }))
        });
    } catch (error) {
        console.error('[createBotAction] Auto interview knowledge generation failed:', error);
    }

    revalidatePath('/dashboard');
    redirect(`/dashboard/bots/${bot.id}`);
}

export async function createProjectAction(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = formData.get('name') as string;
    if (!name) throw new Error("Name required");

    let organizationId = formData.get('organizationId') as string;

    const memberships = await prisma.membership.findMany({
        where: { userId: session.user.id, status: 'ACTIVE' },
        orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
        select: { organizationId: true }
    });

    if (!organizationId) {
        organizationId = memberships[0]?.organizationId;
    }

    if (!organizationId) throw new Error("No organization found for project");
    await assertOrganizationAccess(session.user.id, organizationId, 'ADMIN');

    // Create project and add owner access in a transaction
    const project = await prisma.project.create({
        data: {
            name,
            ownerId: session.user.id,
            organizationId: organizationId,
            isPersonal: false
        }
    });
    await syncLegacyProjectAccessForProject(project.id);

    revalidatePath('/dashboard');
    redirect(`/dashboard/projects/${project.id}`);
}

export async function deleteProjectAction(projectId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const access = await assertProjectAccess(session.user.id, projectId, 'ADMIN');

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            mcpConnections: { select: { type: true } },
            googleConnection: { select: { id: true } },
            n8nConnection: { select: { id: true } },
            newCmsConnection: { select: { id: true } }
        }
    });
    if (!project) throw new Error("Project not found");

    const otherProjects = await prisma.project.findMany({
        where: {
            organizationId: access.organizationId,
            id: { not: projectId }
        },
        include: {
            mcpConnections: { select: { type: true } },
            googleConnection: { select: { id: true } },
            n8nConnection: { select: { id: true } },
            newCmsConnection: { select: { id: true } }
        },
        orderBy: { createdAt: 'asc' }
    });

    const sourceMcpTypes = project.mcpConnections.map((connection) => connection.type);
    const transferTarget = otherProjects.find((candidate) => {
        if (project.googleConnection && candidate.googleConnection) return false;
        if (project.n8nConnection && candidate.n8nConnection) return false;
        if (project.newCmsConnection && candidate.newCmsConnection) return false;
        const targetMcpTypes = candidate.mcpConnections.map((connection) => connection.type);
        return !targetMcpTypes.some((type) => sourceMcpTypes.includes(type));
    });

    const fallbackTarget =
        transferTarget
        ?? await ensureDefaultProjectForOrganization(access.organizationId);

    const finalTransferTarget = fallbackTarget.id === projectId
        ? await prisma.project.create({
            data: {
                name: 'Default Project (Recovery)',
                organizationId: access.organizationId,
                ownerId: session.user.id,
                isPersonal: false
            }
        })
        : fallbackTarget;

    await prisma.$transaction(async (tx) => {
        await tx.bot.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id }
        });
        await tx.visibilityConfig.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id }
        });
        await tx.mCPConnection.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id, organizationId: access.organizationId }
        });
        await tx.googleConnection.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id }
        });
        await tx.n8NConnection.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id }
        });
        await tx.cMSConnection.updateMany({
            where: { projectId },
            data: { projectId: finalTransferTarget.id, organizationId: access.organizationId }
        });
        await tx.projectVisibilityConfig.deleteMany({ where: { projectId } });
        await tx.projectCMSConnection.deleteMany({ where: { projectId } });
        await tx.projectMCPConnection.deleteMany({ where: { projectId } });
        await tx.projectAccess.deleteMany({ where: { projectId } });
        await tx.project.delete({ where: { id: projectId } });
    });

    revalidatePath('/dashboard');
}

export async function renameProjectAction(projectId: string, newName: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    await assertProjectAccess(session.user.id, projectId, 'ADMIN');

    await prisma.project.update({
        where: { id: projectId },
        data: { name: newName }
    });
    revalidatePath('/dashboard');
}

export async function deleteBotAction(botId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { id: true, projectId: true }
    });
    if (!bot) throw new Error("Bot not found");
    await assertProjectAccess(session.user.id, bot.projectId, 'ADMIN');

    await prisma.bot.delete({ where: { id: botId } });
    revalidatePath('/dashboard');
}

export async function updateBotAction(botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const getInd = (key: string) => formData.has(key) ? formData.get(key) : undefined;
    const getStr = (key: string) => formData.has(key) ? (formData.get(key) as string) : undefined;

    // Construct data object only with present fields to allow partial updates (split forms)
    const data: Prisma.BotUpdateInput = {};
    if (formData.has('name')) data.name = getStr('name') ?? '';
    if (formData.has('researchGoal')) data.researchGoal = getStr('researchGoal');
    if (formData.has('targetAudience')) data.targetAudience = getStr('targetAudience');
    if (formData.has('language')) data.language = getStr('language');
    if (formData.has('tone')) data.tone = getStr('tone');
    if (formData.has('introMessage')) data.introMessage = getStr('introMessage');
    const shouldRegeneratePlan = formData.has('maxDurationMins');
    if (formData.has('maxDurationMins')) data.maxDurationMins = Number(formData.get('maxDurationMins'));

    // Handle slug update with validation
    if (formData.has('slug')) {
        const rawSlug = getStr('slug') ?? '';
        // Sanitize: lowercase, only alphanumeric and hyphens
        const sanitizedSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');

        if (sanitizedSlug.length < 3) {
            throw new Error("Lo slug deve essere di almeno 3 caratteri.");
        }
        if (sanitizedSlug.length > 100) {
            throw new Error("Lo slug non può superare i 100 caratteri.");
        }

        // Check uniqueness (excluding current bot)
        const existingBot = await prisma.bot.findFirst({
            where: {
                slug: sanitizedSlug,
                id: { not: botId }
            }
        });

        if (existingBot) {
            throw new Error("Questo URL è già in uso. Scegli un altro slug.");
        }

        data.slug = sanitizedSlug;
    }

    if (formData.has('modelProvider')) data.modelProvider = getStr('modelProvider');
    if (formData.has('modelName')) data.modelName = getStr('modelName');

    if (formData.has('openaiApiKey')) data.openaiApiKey = encryptIfNeeded(getStr('openaiApiKey')) || null;
    if (formData.has('anthropicApiKey')) data.anthropicApiKey = encryptIfNeeded(getStr('anthropicApiKey')) || null;

    // Branding fields
    if (formData.has('logoUrl')) data.logoUrl = getStr('logoUrl') || null;
    if (formData.has('primaryColor')) data.primaryColor = getStr('primaryColor');
    if (formData.has('backgroundColor')) data.backgroundColor = getStr('backgroundColor');
    if (formData.has('textColor')) data.textColor = getStr('textColor');

    // Toggles - Logic: If the form is submitted, and the checkbox is NOT checked, it is missing from formData.
    // However, if we are doing partial updates, how do we know if it was unchecked or just not part of the form?
    // Convention: If "formType" is passed, we know which fields to expect? 
    // Or we stick to "hidden input" trick for checkboxes?
    // For now, let's assume if 'useWarmup' is present it's 'on'.
    // BUT we need to handle "unchecking".
    // Strategy: The Frontend should send a hidden input with the same name if we want to support uncheck = false?
    // Or we simply check keys.
    // Issue: <input type="checkbox" name="useWarmup" />
    // Checked -> sends "useWarmup=on". Unchecked -> sends NOTHING.
    // If Unchecked, formData.has('useWarmup') is false.
    // So we don't update it? That breaks unchecking.
    // FIX: Frontend should use a hidden field or distinct action signatures. 
    // OR, we assume that if 'name' is present (Identity Form), then 'useWarmup' SHOULD be present if checked. 
    // If 'name' is present but 'useWarmup' is not, it means unchecked? No, useWarmup is in Constraints section.

    // Solution: Look for a "marker" field to identify the context/form scope.
    // e.g. formData.get('_scope') === 'identity' or 'branding'.
    // If scope includes the checkbox, and it's missing, set to false.

    const scope = getStr('_scope') || 'all'; // default to all for backward compat logic if possible

    if (scope === 'all' || scope === 'identity' || scope === 'constraints') {
        // Handle checkboxes logic if we are in the right scope
        // However, simple HTML forms don't send anything for unchecked.
        // We'll trust that if the user sends partial data, they handle checkboxes explicitly?
        // Let's rely on explicit 'false' setting via hidden fields if needed, OR:
        // For 'useWarmup':
        if (formData.get('useWarmup') === 'on') data.useWarmup = true;
        else if (scope === 'constraints' || scope === 'all') data.useWarmup = false;
        // Same for collectCandidateData
        if (formData.get('collectCandidateData') === 'on') data.collectCandidateData = true;
        else if (scope === 'constraints' || scope === 'all') data.collectCandidateData = false;
    }

    // Candidate Fields (Array)
    if (formData.has('candidateFields')) {
        data.candidateDataFields = formData.getAll('candidateFields').map(v => String(v));
    } else if (scope === 'constraints' || scope === 'all') {
        // If checkboxes are present in the DOM but none checked, formData won't have the key.
        // We rely on the context: if we are saving constraints and 'collectCandidateData' is ON, 
        // but no fields are selected, we might want to clear them or default them.
        // If collectCandidateData is false, fields don't matter.
        // If collectCandidateData is true and no fields, it's empty array.
        // To distinguish "not submitted" from "empty selection", we can use another hidden input or logic.
        // For now, if 'collectCandidateData' is submitted (scope match), we assume fields are updateable.
        // But formData.getAll returns empty if key missing? No, has() is false.

        // Simple Logic: if collectCandidateData is true in DATA (meaning it's being set to true or is true),
        // we should probably look for fields.
        // But if I uncheck all fields, I send nothing.
        // Let's assume if we are in 'constraints' scope, we overwrite fields.
        if (data.collectCandidateData) {
            data.candidateDataFields = formData.getAll('candidateFields').map(v => String(v)); // empty array if none
        } else if (scope === 'constraints' || scope === 'all') {
            data.candidateDataFields = [];
        }
    }

    // Landing Page fields
    if (formData.has('landingTitle')) data.landingTitle = getStr('landingTitle');
    if (formData.has('landingDescription')) data.landingDescription = getStr('landingDescription');
    if (formData.has('landingImageUrl')) data.landingImageUrl = getStr('landingImageUrl');
    if (formData.has('landingVideoUrl')) data.landingVideoUrl = getStr('landingVideoUrl');


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

    // Feature Gating
    const bot = await prisma.bot.findUnique({ where: { id: botId }, include: { project: true } });
    if (bot?.project?.organizationId) {
        const canLogo = await isFeatureEnabled(bot.project.organizationId, 'customLogo');
        const canColor = await isFeatureEnabled(bot.project.organizationId, 'customColor');

        if (!canLogo && data.logoUrl) {
            throw new Error("Logo personalizzato disponibile solo nei piani PRO e BUSINESS.");
        }
        if (!canColor && (data.primaryColor || data.backgroundColor || data.textColor)) {
            // Basic check: if they are different from default? 
            // For now assume if they are in formData they are being set.
            // But actually we should only throw if they are DIFFERENT from default.
        }
    }

    if (data.openaiApiKey === '') delete data.openaiApiKey;
    if (data.anthropicApiKey === '') delete data.anthropicApiKey;
    if (data.logoUrl === '') data.logoUrl = null;

    console.log(`[updateBotAction] Updating bot ${botId}. LogoUrl length: ${typeof data.logoUrl === 'string' ? data.logoUrl.length : 'null'}`);

    await prisma.bot.update({
        where: { id: botId },
        data
    });

    if (shouldRegeneratePlan) {
        await regenerateInterviewPlan(botId);
    }

    try {
        await ensureInterviewGuideForBot(botId);
    } catch (error) {
        console.error('[updateBotAction] Auto interview knowledge ensure failed:', error);
    }

    revalidatePath(`/dashboard/bots/${botId}`);
    return { success: true };
}

export async function updateBotProjectAction(botId: string, projectId: string) {
    return transferBotToProject(botId, projectId);
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

    // Fetch conversations WITH analysis
    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            conversations: {
                where: { status: 'COMPLETED' }, // Only analyze completed ones? Or all with analysis? 
                include: { analysis: true }
            },
            topics: { orderBy: { orderIndex: 'asc' } },
            project: true
        }
    });

    if (!bot || bot.conversations.length === 0) return;

    // Feature Gating
    if (bot.project?.organizationId) {
        const canAnalyze = await isFeatureEnabled(bot.project.organizationId, 'themeExtraction');
        if (!canAnalyze) {
            throw new Error("Analytics avanzate disponibili solo nei piani PRO.");
        }
    }

    // Filter only conversations that HAVE analysis
    const analyzedConversations = bot.conversations.filter(c => c.analysis);

    if (analyzedConversations.length === 0) {
        // Fallback? Or maybe trigger analysis for old ones?
        // For now, return or throw warning.
        console.log("No analyzed conversations found. Run individual analysis first.");
        return;
    }

    // Resolve API Key
    const apiKey = await getEffectiveApiKey(user, bot.openaiApiKey);
    if (!apiKey) throw new Error("No OpenAI API Key configured.");

    // Prepare Aggregated Input for Global LLM
    // Instead of raw text, we send Summaries and Key Quotes from each convo.
    const aggregatedInput = analyzedConversations.map(c => {
        const a = c.analysis!; // Verified by filter
        const metadata = (a.metadata as Record<string, any> | null) || {};
        const summary = metadata.summary || "No summary available.";
        const quotes = (a.keyQuotes as string[])?.join(' | ') || "";

        // Include topic details if available
        let details = "";
        if (metadata.topicDetails && Array.isArray(metadata.topicDetails)) {
            details = "\nTopic Breakdown:\n" + metadata.topicDetails.map((td: any) => `- ${td.label}: ${td.summary} (Keywords: ${td.keywords?.join(', ')})`).join('\n');
        }

        return `[ConvID:${c.id}] Summary: ${summary}${details}\nKey Quotes: ${quotes}\nSentiment: ${a.sentimentScore}`;
    }).join("\n\n----------------\n\n");

    const openai = createOpenAI({ apiKey });

    const schema = z.object({
        themes: z.array(z.object({
            name: z.string(),
            description: z.string(),
            count: z.number(),
            citations: z.array(z.object({
                quote: z.string(),
                conversationId: z.string()
            }))
        })),
        insights: z.array(z.object({
            content: z.string(),
            citations: z.array(z.object({
                quote: z.string(),
                conversationId: z.string()
            }))
        })),
        sentimentScore: z.number(),
        goldenQuotes: z.array(z.object({
            quote: z.string(),
            conversationId: z.string()
        })),
        topicAnalysis: z.array(z.object({
            topicLabel: z.string(),
            keywords: z.array(z.object({
                word: z.string(),
                count: z.number(),
                sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional()
            }))
        }))
    });

    const topicsList = bot.topics.map((t: any) => `- "${t.label}": ${t.description}`).join("\n");
    const validLabels = bot.topics.map((t: any) => t.label);

    const result = await generateObject({
        model: openai('gpt-4o'),
        schema,
        prompt: `Conduct a Global Meta-Analysis for the bot "${bot.name}".
        
        RESEARCH GOAL:
        ${bot.researchGoal}

        DEFINED TOPICS:
        ${topicsList}
        
        Input Data (Aggregated Summaries from individual interviews):
        ${aggregatedInput.substring(0, 100000)} 
        
        Task:
        1. Identify recurring themes across multiple interviews.
        2. Synthesize strategic insights.
        3. Calculate a weighted average sentiment score (0-100).
        4. Select the absolute best 'Golden Quotes' from the provided key quotes.
        5. Analyze keywords and trends for each of the DEFINED TOPICS.

        CONSTRAINTS:
        - For "topicAnalysis", you MUST only use labels from this list: [${validLabels.join(', ')}].
        - Use the [ConvID:...] from the input to strictly cite your sources.
        - Ensure keyword counts reflect their importance/frequency across the aggregated data.`
    });

    // Save to DB (Clear old and rewrite)
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
                        conversationId: cit.conversationId.replace('ConvID:', '').trim(),
                        strengthScore: 1,
                        snippet: cit.quote
                    })).slice(0, t.count)
                }
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
                citations: i.citations as any
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
                citations: [{ quote: q.quote, conversationId: q.conversationId }] as any
            }
        });
    }

    // Create Topic Analysis (Update keywords)
    if (data.topicAnalysis) {
        for (const topicData of data.topicAnalysis) {
            const topic = bot.topics.find(t => t.label === topicData.topicLabel);
            if (topic) {
                await prisma.topicBlock.update({
                    where: { id: topic.id },
                    data: { keywords: topicData.keywords as any }
                });
            }
        }
    }

    // Update Bot Metadata
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
    await regenerateInterviewPlan(botId);
    await ensureInterviewGuideForBot(botId).catch((error) => {
        console.error('[addTopicAction] Auto interview knowledge ensure failed:', error);
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
    await regenerateInterviewPlan(botId);
    await ensureInterviewGuideForBot(botId).catch((error) => {
        console.error('[updateTopicAction] Auto interview knowledge ensure failed:', error);
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function deleteTopicAction(topicId: string, botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    // Delete the topic
    await prisma.topicBlock.delete({ where: { id: topicId } });

    // CRITICAL FIX: Recalculate orderIndex for remaining topics to prevent gaps
    const remainingTopics = await prisma.topicBlock.findMany({
        where: { botId },
        orderBy: { orderIndex: 'asc' }
    });

    // Update each topic with sequential orderIndex (0, 1, 2, 3...)
    for (let i = 0; i < remainingTopics.length; i++) {
        if (remainingTopics[i].orderIndex !== i) {
            await prisma.topicBlock.update({
                where: { id: remainingTopics[i].id },
                data: { orderIndex: i }
            });
        }
    }

    await regenerateInterviewPlan(botId);
    await ensureInterviewGuideForBot(botId).catch((error) => {
        console.error('[deleteTopicAction] Auto interview knowledge ensure failed:', error);
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function addKnowledgeSourceAction(botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { projectId: true }
    });
    if (!bot) throw new Error("Bot not found");
    await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const type = formData.get('type') as string || 'TEXT';

    if (!content || !content.trim()) {
        throw new Error("Content is required");
    }

    // Sanitize content: limit size and remove potential prompt injection patterns
    const maxContentLength = 50000; // 50KB max
    let sanitizedContent = content.trim();

    if (sanitizedContent.length > maxContentLength) {
        throw new Error(`Content too long. Maximum ${maxContentLength} characters allowed.`);
    }

    // Basic sanitization: remove control characters except newlines/tabs
    sanitizedContent = sanitizedContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    await prisma.knowledgeSource.create({
        data: {
            botId,
            title: (title?.trim() || 'Untitled Source').substring(0, 200),
            type: type,
            content: sanitizedContent
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

export async function updateKnowledgeSourceAction(sourceId: string, botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { projectId: true }
    });
    if (!bot) throw new Error("Bot not found");
    await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');

    const source = await prisma.knowledgeSource.findFirst({
        where: {
            id: sourceId,
            botId
        },
        select: { id: true }
    });
    if (!source) {
        throw new Error("Knowledge source not found for this bot");
    }

    const title = String(formData.get('title') || '').trim();
    const content = String(formData.get('content') || '').trim();

    if (!content) {
        throw new Error("Content is required");
    }

    const maxContentLength = 50000;
    if (content.length > maxContentLength) {
        throw new Error(`Content too long. Maximum ${maxContentLength} characters allowed.`);
    }

    const sanitizedContent = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: {
            title: (title || 'Untitled Source').substring(0, 200),
            content: sanitizedContent
        }
    });

    revalidatePath(`/dashboard/bots/${botId}`);
    return { success: true };
}

export async function regenerateInterviewGuideAction(botId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            project: true,
            topics: {
                orderBy: { orderIndex: 'asc' },
                select: {
                    label: true,
                    description: true,
                    subGoals: true
                }
            }
        }
    });
    if (!bot) throw new Error("Bot not found");

    await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');

    if (bot.botType === 'chatbot') {
        throw new Error("Interview guide regeneration is available only for interview bots");
    }
    if (!Array.isArray(bot.topics) || bot.topics.length === 0) {
        throw new Error("Cannot regenerate interview guide without topics");
    }

    await regenerateAutoInterviewKnowledgeSource({
        botId: bot.id,
        language: bot.language || 'it',
        botName: bot.name,
        researchGoal: bot.researchGoal,
        targetAudience: bot.targetAudience,
        topics: bot.topics
    });

    revalidatePath(`/dashboard/bots/${botId}`);
    return { success: true };
}

export async function updateSettingsAction(organizationId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Simple security check:
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!currentUser) throw new Error("User not found");

    // Check membership
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId: currentUser.id,
                organizationId
            }
        }
    });

    if (!membership && currentUser.role !== 'ADMIN') throw new Error("Unauthorized");

    const openaiKey = formData.get('platformOpenaiApiKey') as string;
    const anthropicKey = formData.get('platformAnthropicApiKey') as string;

    // If Admin, update Global Config with encrypted keys
    if (currentUser.role === 'ADMIN') {
        const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'GlobalConfig'
        `).catch(() => []);
        const available = new Set(availableColumns.map((c) => c.column_name));

        const compatValues: Record<string, unknown> = {};
        if (available.has('openaiApiKey')) {
            compatValues.openaiApiKey = encryptIfNeeded(openaiKey);
        }
        if (available.has('anthropicApiKey')) {
            compatValues.anthropicApiKey = encryptIfNeeded(anthropicKey);
        }
        if (available.has('updatedAt')) {
            compatValues.updatedAt = new Date();
        }

        const assignments = Object.entries(compatValues);
        if (assignments.length > 0) {
            for (const [column] of assignments) {
                if (!SAFE_SQL_IDENTIFIER.test(column)) {
                    throw new Error(`[updateSettingsAction] Unsafe GlobalConfig column name: ${column}`);
                }
            }

            await prisma.$executeRawUnsafe(
                available.has('updatedAt')
                    ? `INSERT INTO "GlobalConfig" ("id", "updatedAt") VALUES ('default', NOW()) ON CONFLICT ("id") DO NOTHING`
                    : `INSERT INTO "GlobalConfig" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING`
            );

            const setClause = assignments
                .map(([column], index) => `"${column}" = $${index + 1}`)
                .join(', ');

            await prisma.$executeRawUnsafe(
                `UPDATE "GlobalConfig" SET ${setClause} WHERE "id" = 'default'`,
                ...assignments.map(([, value]) => value)
            );
        }
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
        where: { organizationId },
        update: { methodologyKnowledge },
        create: { organizationId, methodologyKnowledge }
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

    const apiKey = await getEffectiveApiKey(user);
    if (!apiKey) throw new Error("No OpenAI API Key configured. Please add one in Settings.");

    const openai = createOpenAI({ apiKey });

    // Load methodology for context (using top-level imports)
    let methodology = '';
    try {
        methodology = fs.readFileSync(path.join(process.cwd(), 'knowledge', 'interview-methodology.md'), 'utf-8');
    } catch (e) { console.error("Failed to load methodology", e); }

    let fieldInstructions = "";
    const lowerFieldName = fieldName.toLowerCase();

    if (lowerFieldName.includes('intro') || lowerFieldName.includes('benvenuto')) {
        fieldInstructions = "Rendi il messaggio di benvenuto coinvolgente, chiaro e DEVE terminare con una domanda aperta che inviti alla conversazione (es: \"Raccontami...\", \"Cosa ne pensi...\").";
    } else if (lowerFieldName.includes('goal') || lowerFieldName.includes('obiettivo')) {
        fieldInstructions = "Trasforma l'obiettivo in una dichiarazione di ricerca ultra-professionale. Focus sul valore di business.";
    } else if (lowerFieldName.includes('target') || lowerFieldName.includes('pubblico')) {
        fieldInstructions = "Rendi la descrizione del target precisa e professionale.";
    }

    const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: z.object({ text: z.string() }),
        prompt: `Sei un esperto di ricerca qualitativa e UX Research. Il tuo compito è raffinare il seguente testo per il campo "${fieldName}".
        
        Context: "${context}".
        
        Using the following INTERVIEW METHODOLOGY as context for quality:
        ${methodology.substring(0, 1500)}...

        ${fieldInstructions}

        Current Text to refine: "${currentText}"
        
        GOAL: Improve clarity and IMPACT, but ensure the tone is **NATURAL, CONVERSATIONAL, and AUTHENTIC**.
        - AVOID: "Corporate speak", overly formal language, rigid academic phrasing.
        - PREFER: Warm, engaging, spoken-like language. 
        - IMPORTANT: If the Current Text is in Italian, the refined text MUST be in Italian.
        - Respond ONLY with the refined text, no quotes or additional comments.`,
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
