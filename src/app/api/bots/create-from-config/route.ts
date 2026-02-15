import { auth } from '@/auth';
import { canPublishBot } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { scrapeUrl } from '@/lib/scraping';
import { checkTrialResourceLimit, normalizeBotTypeForTrialLimit } from '@/lib/trial-limits';
import { ensureAutoInterviewKnowledgeSource } from '@/lib/interview/manual-knowledge-source';
import {
    assertProjectAccess,
    getDefaultProjectNameForOrganization,
    syncLegacyProjectAccessForProject
} from '@/lib/domain/workspace';

function generateSlug(name: string): string {
    const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);

    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
}

export async function POST(req: Request) {
    try {
        console.log('🔐 [CREATE-BOT] Starting authentication check');
        const session = await auth();

        console.log('🔐 [CREATE-BOT] Session check:', {
            hasSession: !!session,
            hasUser: !!session?.user
        });

        if (!session?.user?.id) {
            console.error('❌ [CREATE-BOT] Unauthorized: No session or user id');
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                role: true,
                memberships: {
                    where: { status: 'ACTIVE' },
                    select: {
                        organizationId: true
                    }
                }
            }
        });

        console.log('👤 [CREATE-BOT] User lookup:', {
            found: !!user,
            organizationsCount: user?.memberships?.length || 0
        });

        if (!user) {
            console.error('❌ [CREATE-BOT] User not found in database');
            return new Response('User not found', { status: 404 });
        }

        const config = await req.json();

        // Use provided projectId or get default project
        let projectId = config.projectId;

        if (!projectId) {
            const { getOrCreateDefaultOrganization } = await import('@/lib/organizations');
            const organization = await getOrCreateDefaultOrganization(user.id);

            // Create default project linked to this org
            let project = await prisma.project.findFirst({
                where: { organizationId: organization.id },
                orderBy: { createdAt: 'asc' }
            });

            if (!project) {
                const defaultProjectName = await getDefaultProjectNameForOrganization(organization.id);
                project = await prisma.project.create({
                    data: {
                        name: defaultProjectName,
                        ownerId: user.id,
                        organizationId: organization.id
                    }
                });
                await syncLegacyProjectAccessForProject(project.id);
            }
            projectId = project.id;
        } else {
            try {
                await assertProjectAccess(user.id, projectId, 'MEMBER');
            } catch {
                return new Response('Forbidden: Acceduto negato al progetto', { status: 403 });
            }
        }

        // Get organizationId from project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true, name: true, id: true }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        if (!project.organizationId) {
            const { getOrCreateDefaultOrganization } = await import('@/lib/organizations');
            const organization = await getOrCreateDefaultOrganization(user.id);

            await prisma.project.update({
                where: { id: projectId },
                data: { organizationId: organization.id }
            });
            project.organizationId = organization.id;
        }

        // Ensure user still belongs to the organization that owns this project.
        const canUseProjectOrg = user.memberships.some((membership) => membership.organizationId === project.organizationId);
        if (!canUseProjectOrg && user.role !== 'ADMIN') {
            return new Response('Forbidden: organization access denied', { status: 403 });
        }

        console.log('🎯 [CREATE-BOT] Checking usage limits for org');

        const requestedBotType = normalizeBotTypeForTrialLimit(config.botType);
        if (user.role !== 'ADMIN') {
            const trialLimitCheck = await checkTrialResourceLimit({
                organizationId: project.organizationId,
                resource: requestedBotType
            });

            if (!trialLimitCheck.allowed) {
                return new Response(JSON.stringify({
                    error: 'TRIAL_LIMIT_REACHED',
                    message: trialLimitCheck.reason
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const publishCheck = await canPublishBot(project.organizationId);
        console.log('📊 [CREATE-BOT] Usage check result:', {
            allowed: publishCheck.allowed,
            reason: publishCheck.reason
        });

        if (!publishCheck.allowed) {
        console.log('⛔ [CREATE-BOT] Publishing not allowed');
            return new Response(JSON.stringify({
                error: 'LIMIT_REACHED',
                message: publishCheck.reason
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ [CREATE-BOT] Usage check passed, proceeding to create bot');

        // Create the bot with topics/KB based on type
        const slug = generateSlug(config.name || 'intervista');
        const botType = requestedBotType;
        const isChatbot = botType === 'chatbot';
        const botConfig = config.config || {}; // Chatbot config wrapper

        let botData: any = {
            projectId,
            slug,
            name: config.name || 'Nuova intervista',
            status: 'PUBLISHED',
            description: config.researchGoal || botConfig.description,
            language: config.language || 'it',
            botType: botType,
            primaryColor: isChatbot ? (botConfig.primaryColor || '#F59E0B') : '#F59E0B',
        };

        if (isChatbot) {
            // Process knowledge sources (scrape URLs if content is placeholder)
            const processedSources = [];
            if (botConfig.knowledgeSources) {
                for (const k of botConfig.knowledgeSources) {
                    if (k.type === 'url' && (k.content === 'To be scraped' || !k.content)) {
                        try {
                            const scraped = await scrapeUrl(k.title); // Title holds the URL in the simplistic wizard
                            processedSources.push({
                                title: scraped.title,
                                content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`,
                                type: 'url'
                            });
                        } catch (e) {
                            console.error(`Failed to scrape ${k.title}`, e);
                            // Add as failed or skip? Add as basic link
                            processedSources.push({
                                title: k.title,
                                content: `URL: ${k.title} (Scraping failed)`,
                                type: 'url'
                            });
                        }
                    } else {
                        processedSources.push({
                            title: k.title,
                            content: k.content,
                            type: k.type || 'text'
                        });
                    }
                }
            }

            // Chatbot specific fields
            const hasLeadFields = Array.isArray(botConfig.candidateDataFields) && botConfig.candidateDataFields.length > 0;
            const chatbotTopics = Array.isArray(botConfig.topics)
                ? botConfig.topics
                    .map((topic: unknown, index: number) => {
                        const label = typeof topic === 'string'
                            ? topic.trim()
                            : (typeof topic === 'object' && topic !== null && typeof (topic as any).label === 'string'
                                ? String((topic as any).label).trim()
                                : '');
                        if (!label) return null;
                        return {
                            orderIndex: index,
                            label,
                            description: typeof topic === 'object' && topic !== null && typeof (topic as any).description === 'string'
                                ? String((topic as any).description).trim()
                                : null,
                            subGoals: []
                        };
                    })
                    .filter(Boolean)
                : [];

            botData = {
                ...botData,
                researchGoal: (typeof botConfig.goal === 'string' && botConfig.goal.trim()) ||
                    (typeof config.goal === 'string' && config.goal.trim()) ||
                    (typeof config.researchGoal === 'string' && config.researchGoal.trim()) ||
                    null,
                tone: botConfig.tone,
                enablePageContext: true,
                leadCaptureStrategy: botConfig.leadCaptureStrategy || 'after_3_msgs',
                candidateDataFields: botConfig.candidateDataFields,
                collectCandidateData: hasLeadFields, // Auto-enable when lead fields are configured
                fallbackMessage: typeof botConfig.fallbackMessage === 'string' ? botConfig.fallbackMessage : null,
                boundaries: Array.isArray(botConfig.boundaries) ? botConfig.boundaries : [],
                introMessage: botConfig.welcomeMessage,
                bubblePosition: botConfig.bubblePosition || 'bottom-right',
                topics: {
                    create: chatbotTopics as any[]
                },
                knowledgeSources: {
                    create: processedSources
                }
            };
        } else {
            // Interview specific fields
            botData = {
                ...botData,
                researchGoal: config.researchGoal,
                targetAudience: config.targetAudience,
                maxDurationMins: config.maxDurationMins || 10,
                introMessage: config.introMessage,
                useWarmup: false,
                topics: {
                    create: config.topics?.map((topic: any, index: number) => ({
                        orderIndex: index,
                        label: topic.label,
                        description: topic.description,
                        subGoals: topic.subGoals,
                        maxTurns: topic.maxTurns || 4
                    }))
                }
            };
        }

        console.log('🤖 [CREATE-BOT] Creating bot with data:', {
            name: botData.name,
            botType: botData.botType,
            projectId: botData.projectId,
            slug: botData.slug,
            hasTopics: !!botData.topics,
            topicsCount: botData.topics?.create?.length || 0,
            hasKnowledgeSources: !!botData.knowledgeSources,
            knowledgeSourcesCount: botData.knowledgeSources?.create?.length || 0
        });

        const bot = await prisma.bot.create({
            data: botData,
            include: {
                topics: true,
                knowledgeSources: true
            }
        });

        if (!isChatbot) {
            try {
                await ensureAutoInterviewKnowledgeSource({
                    botId: bot.id,
                    language: bot.language || 'it',
                    botName: bot.name,
                    researchGoal: bot.researchGoal,
                    targetAudience: bot.targetAudience,
                    topics: (bot.topics || []).map((topic: any) => ({
                        label: topic.label,
                        description: topic.description,
                        subGoals: topic.subGoals
                    }))
                });
            } catch (error) {
                console.error('[CREATE-BOT] Auto interview knowledge generation failed:', error);
            }
        }

        console.log('🎉 [CREATE-BOT] Bot created successfully:', {
            botId: bot.id,
            slug: bot.slug,
            name: bot.name
        });

        return Response.json({
            botId: bot.id,  // Frontend expects botId
            id: bot.id,
            slug: bot.slug,
            name: bot.name
        });

    } catch (error: any) {
        console.error('❌ [CREATE-BOT] Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
        return new Response(JSON.stringify({
            error: error.code || 'CREATION_FAILED',
            message: error.message || 'Creation failed'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
