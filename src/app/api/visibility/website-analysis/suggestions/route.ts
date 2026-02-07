import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CMSSuggestionType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import {
    inferContentKind,
    normalizePublicationRouting,
    resolvePublishingCapabilities
} from '@/lib/cms/publishing';

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9àèéìòùäöüßçñ\s-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}

function mapRecommendationType(recType: string, title?: string, contentKind?: string): CMSSuggestionType {
    const lowerTitle = (title || '').toLowerCase();
    const lowerKind = (contentKind || '').toLowerCase();

    if (lowerKind === 'faq_page') return 'CREATE_FAQ';
    if (lowerKind === 'blog_post' || lowerKind === 'news_article' || lowerKind === 'social_post') return 'CREATE_BLOG_POST';
    if (lowerKind === 'schema_patch' || lowerKind === 'seo_patch' || lowerKind === 'product_description') return 'MODIFY_CONTENT';

    if (recType === 'add_faq' || lowerTitle.includes('faq') || lowerTitle.includes('domanda')) {
        return 'CREATE_FAQ';
    }
    if (lowerTitle.includes('blog') || lowerTitle.includes('articolo') || lowerTitle.includes('news')) {
        return 'CREATE_BLOG_POST';
    }
    if (recType === 'modify_content') {
        return 'MODIFY_CONTENT';
    }
    if (lowerTitle.includes('sezione')) {
        return 'ADD_SECTION';
    }
    return 'CREATE_PAGE';
}

function priorityToScore(priority: string) {
    if (priority === 'high') return 80;
    if (priority === 'medium') return 60;
    return 40;
}

function fallbackDraftFromRecommendation(recommendation: any) {
    const title = String(recommendation?.title || '').trim();
    const description = String(recommendation?.description || recommendation?.impact || '').trim();
    if (!title || !description) return null;
    return {
        title,
        slug: slugify(title),
        body: description,
        metaDescription: String(recommendation?.impact || '').trim().slice(0, 160),
        targetSection: recommendation?.type === 'social_post' ? 'social' : 'pages',
        mediaBrief: recommendation?.type === 'social_post'
            ? 'Visual consigliato: immagine/video breve focalizzato sul beneficio principale con CTA chiara.'
            : undefined
    };
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { configId, recommendation, draft } = body || {};

        if (!configId || !recommendation) {
            return NextResponse.json({ error: 'configId and recommendation are required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                memberships: { take: 1, select: { organizationId: true } }
            }
        });

        const organizationId = user?.memberships?.[0]?.organizationId;
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const config = await prisma.visibilityConfig.findFirst({
            where: { id: configId, organizationId },
            include: { project: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        if (!config.projectId) {
            return NextResponse.json({ error: 'Project not linked to this brand' }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id: config.projectId },
            include: {
                cmsConnection: true,
                newCmsConnection: true,
                cmsShares: { include: { connection: true } }
            } as any
        });

        const cmsConnection = (project as any)?.newCmsConnection
            || project?.cmsConnection
            || (project as any)?.cmsShares?.[0]?.connection
            || null;

        if (!cmsConnection?.id) {
            return NextResponse.json({ error: 'CMS integration not enabled for this project' }, { status: 400 });
        }

        const contentDraft = draft || recommendation.contentDraft || fallbackDraftFromRecommendation(recommendation);
        if (!contentDraft?.title || !contentDraft?.body) {
            return NextResponse.json({ error: 'contentDraft.title and contentDraft.body are required' }, { status: 400 });
        }

        const capabilities = await resolvePublishingCapabilities({
            projectId: config.projectId,
            hasCmsApi: Boolean(cmsConnection?.id),
            hasGoogleAnalytics: Boolean(cmsConnection?.googleAnalyticsConnected),
            hasSearchConsole: Boolean(cmsConnection?.searchConsoleConnected)
        });

        const inferredKind = inferContentKind({
            suggestionType: mapRecommendationType(recommendation.type, contentDraft.title || recommendation.title),
            tipType: recommendation.type,
            targetSection: contentDraft.targetSection,
            title: contentDraft.title || recommendation.title
        });

        const publishRouting = normalizePublicationRouting(
            recommendation.implementation,
            inferredKind,
            capabilities,
            contentDraft.targetSection
        );

        const tipKey = createHash('md5')
            .update(`${recommendation.title}-${recommendation.type}-${publishRouting.contentKind}`)
            .digest('hex')
            .substring(0, 16);

        const recentSuggestions = await prisma.cMSSuggestion.findMany({
            where: {
                connectionId: cmsConnection.id,
                createdAt: {
                    gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60)
                }
            },
            select: { id: true, sourceSignals: true }
        });

        const existing = recentSuggestions.find(s => {
            const signals = s.sourceSignals as any;
            return signals?.tipKey === tipKey;
        });

        if (existing) {
            return NextResponse.json({ suggestionId: existing.id, alreadyExists: true });
        }

        const sourceSignals = JSON.parse(JSON.stringify({
            origin: recommendation?.dataSource ? 'ai_tip' : 'visibility_tip',
            configId,
            projectId: config.projectId,
            tipKey,
            tipType: recommendation.type,
            dataSource: recommendation.dataSource,
            relatedPrompts: recommendation.relatedPrompts || [],
            strategyAlignment: recommendation.strategyAlignment || recommendation?.explainability?.strategicGoal || null,
            evidencePoints: recommendation.evidencePoints || recommendation?.explainability?.evidence || [],
            explainability: recommendation.explainability || null,
            publishRouting,
            mediaBrief: contentDraft.mediaBrief || null,
            dataCapabilities: {
                hasGoogleAnalytics: capabilities.hasGoogleAnalytics,
                hasSearchConsole: capabilities.hasSearchConsole,
                hasWordPress: capabilities.hasWordPress,
                hasWooCommerce: capabilities.hasWooCommerce
            }
        })) as Prisma.InputJsonValue;

        const suggestion = await prisma.cMSSuggestion.create({
            data: {
                connectionId: cmsConnection.id,
                createdBy: user?.id,
                type: mapRecommendationType(recommendation.type, contentDraft.title || recommendation.title, publishRouting.contentKind),
                title: contentDraft.title,
                slug: contentDraft.slug || slugify(contentDraft.title),
                body: contentDraft.body,
                metaDescription: contentDraft.metaDescription || null,
                targetSection: contentDraft.targetSection || publishRouting.targetSection || null,
                reasoning: recommendation.description || recommendation.impact || 'Suggerimento AI tip multi-canale',
                sourceSignals,
                priorityScore: priorityToScore(recommendation.priority),
                status: 'PENDING'
            }
        });

        return NextResponse.json({ suggestionId: suggestion.id });
    } catch (error: any) {
        console.error('[website-analysis] create suggestion error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create CMS suggestion' },
            { status: 500 }
        );
    }
}
