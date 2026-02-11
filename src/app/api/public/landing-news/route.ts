import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const FALLBACK_PROJECT_IDS = [
    'cmligk3h20001rucy8506g0mk',
    'cmligmdfa0001r7sdw05g4ccc'
];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function stripRichText(value: string): string {
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/[`*_#>\[\]\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toExcerpt(value: string, maxLength = 180): string {
    const plain = stripRichText(value);
    if (plain.length <= maxLength) return plain;
    return `${plain.slice(0, maxLength).trimEnd()}...`;
}

async function resolveLandingProjectId(explicitProjectId?: string | null): Promise<string | null> {
    const configuredProjectId = process.env.BUSINESS_TUNER_SELF_PROJECT_ID?.trim();
    const candidateProjectIds = [
        explicitProjectId?.trim(),
        configuredProjectId,
        ...FALLBACK_PROJECT_IDS
    ].filter((value): value is string => Boolean(value));

    for (const id of candidateProjectIds) {
        const exists = await prisma.project.findUnique({
            where: { id },
            select: { id: true }
        });
        if (exists?.id) return exists.id;
    }

    const fallbackByName = await prisma.project.findFirst({
        where: {
            name: {
                equals: 'Business Tuner',
                mode: 'insensitive'
            },
            isPersonal: false
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
    });

    return fallbackByName?.id || null;
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const explicitProjectId = url.searchParams.get('projectId');
        const limit = clamp(Number(url.searchParams.get('limit') || 6) || 6, 1, 20);

        const projectId = await resolveLandingProjectId(explicitProjectId);
        if (!projectId) {
            return NextResponse.json({
                projectId: null,
                projectName: null,
                items: []
            });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true }
        });

        if (!project) {
            return NextResponse.json({
                projectId: null,
                projectName: null,
                items: []
            });
        }

        const suggestions = await prisma.cMSSuggestion.findMany({
            where: {
                status: 'PUBLISHED',
                connection: { projectId }
            },
            orderBy: [
                { publishedAt: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 50,
            select: {
                id: true,
                title: true,
                slug: true,
                body: true,
                type: true,
                targetSection: true,
                sourceSignals: true,
                metaDescription: true,
                cmsPreviewUrl: true,
                createdAt: true,
                publishedAt: true
            }
        });

        const normalized = suggestions.map((suggestion) => {
            const sourceSignals = suggestion.sourceSignals as Record<string, unknown> | null;
            const publishRouting = sourceSignals?.publishRouting as Record<string, unknown> | undefined;
            const contentKind = String(publishRouting?.contentKind || '').toUpperCase();
            const targetSection = String(suggestion.targetSection || '').toLowerCase();

            const isNews = targetSection.includes('news') || contentKind === 'NEWS_ARTICLE';
            const isBlogLike = suggestion.type === 'CREATE_BLOG_POST' || contentKind === 'BLOG_POST';

            const excerptBase = suggestion.metaDescription?.trim() || suggestion.body || '';
            const slug = suggestion.slug || suggestion.id;

            return {
                id: suggestion.id,
                title: suggestion.title,
                slug,
                excerpt: toExcerpt(excerptBase),
                body: suggestion.body,
                publishedAt: suggestion.publishedAt || suggestion.createdAt,
                cmsPreviewUrl: suggestion.cmsPreviewUrl,
                url: suggestion.cmsPreviewUrl || `/#news-${slug}`,
                isNews,
                isBlogLike
            };
        });

        const selectedItems = [
            ...normalized.filter((item) => item.isNews),
            ...normalized.filter((item) => !item.isNews && item.isBlogLike)
        ].slice(0, limit);

        return NextResponse.json({
            projectId: project.id,
            projectName: project.name,
            items: selectedItems.map(item => ({
                id: item.id,
                title: item.title,
                slug: item.slug,
                excerpt: item.excerpt,
                body: item.body,
                publishedAt: item.publishedAt,
                url: item.url,
                cmsPreviewUrl: item.cmsPreviewUrl
            }))
        });
    } catch (error) {
        console.error('[landing-news] Error loading news:', error);
        return NextResponse.json(
            { error: 'Failed to load landing news' },
            { status: 500 }
        );
    }
}

