import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CMSSuggestionType } from '@prisma/client';
import { createHash } from 'crypto';

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9àèéìòùäöüßçñ\s-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}

function mapRecommendationType(recType: string, title?: string): CMSSuggestionType {
    const lowerTitle = (title || '').toLowerCase();
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

        const contentDraft = draft || recommendation.contentDraft;
        if (!contentDraft?.title || !contentDraft?.body) {
            return NextResponse.json({ error: 'contentDraft.title and contentDraft.body are required' }, { status: 400 });
        }

        const tipKey = createHash('md5')
            .update(`${recommendation.title}-${recommendation.type}`)
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

        const suggestion = await prisma.cMSSuggestion.create({
            data: {
                connectionId: cmsConnection.id,
                createdBy: user?.id,
                type: mapRecommendationType(recommendation.type, contentDraft.title || recommendation.title),
                title: contentDraft.title,
                slug: contentDraft.slug || slugify(contentDraft.title),
                body: contentDraft.body,
                metaDescription: contentDraft.metaDescription || null,
                targetSection: contentDraft.targetSection || null,
                reasoning: recommendation.description || recommendation.impact || 'Suggerimento generato dal Brand Monitor',
                sourceSignals: {
                    origin: 'visibility_tip',
                    configId,
                    tipKey,
                    tipType: recommendation.type,
                    dataSource: recommendation.dataSource,
                    relatedPrompts: recommendation.relatedPrompts || []
                },
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
