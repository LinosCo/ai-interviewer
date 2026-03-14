import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { LANDING_FAQS } from '@/components/landing/landing-faq-data';

const FALLBACK_PROJECT_IDS = [
  'cmligk3h20001rucy8506g0mk',
  'cmligmdfa0001r7sdw05g4ccc',
];

export type BusinessTunerArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
  cmsPreviewUrl: string | null;
  metaDescription: string | null;
};

export type BusinessTunerFaq = {
  question: string;
  answer: string;
  slug: string;
  publishedAt?: string;
};

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

const resolveLandingProjectIdCached = unstable_cache(
  async (): Promise<string | null> => {
    const configuredProjectId = process.env.BUSINESS_TUNER_SELF_PROJECT_ID?.trim();
    const candidateProjectIds = [configuredProjectId, ...FALLBACK_PROJECT_IDS].filter(
      (value): value is string => Boolean(value),
    );

    for (const id of candidateProjectIds) {
      const exists = await prisma.project.findUnique({
        where: { id },
        select: { id: true },
      });
      if (exists?.id) return exists.id;
    }

    const fallbackByName = await prisma.project.findFirst({
      where: {
        name: {
          equals: 'Business Tuner',
          mode: 'insensitive',
        },
        isPersonal: false,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    return fallbackByName?.id || null;
  },
  ['business-tuner-landing-project-id'],
  { revalidate: 60, tags: ['cms-suggestions', 'projects'] },
);

export async function resolveLandingProjectId(explicitProjectId?: string | null): Promise<string | null> {
  if (explicitProjectId?.trim()) {
    const exists = await prisma.project.findUnique({
      where: { id: explicitProjectId.trim() },
      select: { id: true },
    });
    if (exists?.id) return exists.id;
  }

  return resolveLandingProjectIdCached();
}

const getPublishedSuggestionsCached = unstable_cache(
  async () => {
    const projectId = await resolveLandingProjectId();
    if (!projectId) {
      return {
        projectId: null,
        projectName: null,
        suggestions: [],
      };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return {
        projectId: null,
        projectName: null,
        suggestions: [],
      };
    }

    const suggestions = await prisma.cMSSuggestion.findMany({
      where: {
        status: 'PUBLISHED',
        connection: { projectId },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
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
        publishedAt: true,
        updatedAt: true,
      },
    });

    return {
      projectId: project.id,
      projectName: project.name,
      suggestions,
    };
  },
  ['business-tuner-published-suggestions'],
  { revalidate: 60, tags: ['cms-suggestions', 'projects'] },
);

export async function getPublishedLandingSuggestions(explicitProjectId?: string | null) {
  if (!explicitProjectId?.trim()) {
    return getPublishedSuggestionsCached();
  }

  const projectId = await resolveLandingProjectId(explicitProjectId);
  if (!projectId) {
    return { projectId: null, projectName: null, suggestions: [] };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    return { projectId: null, projectName: null, suggestions: [] };
  }

  const suggestions = await prisma.cMSSuggestion.findMany({
    where: {
      status: 'PUBLISHED',
      connection: { projectId },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
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
      publishedAt: true,
      updatedAt: true,
    },
  });

  return {
    projectId: project.id,
    projectName: project.name,
    suggestions,
  };
}

export async function getLandingArticles(limit = 20, explicitProjectId?: string | null): Promise<BusinessTunerArticle[]> {
  const { suggestions } = await getPublishedLandingSuggestions(explicitProjectId);

  return suggestions
    .map((suggestion) => {
      const sourceSignals = suggestion.sourceSignals as Record<string, unknown> | null;
      const publishRouting = sourceSignals?.publishRouting as Record<string, unknown> | undefined;
      const contentKind = String(publishRouting?.contentKind || '').toUpperCase();
      const targetSection = String(suggestion.targetSection || '').toLowerCase();
      const isNews = targetSection.includes('news') || contentKind === 'NEWS_ARTICLE';
      const isBlogLike = suggestion.type === 'CREATE_BLOG_POST' || contentKind === 'BLOG_POST';

      if (!isNews && !isBlogLike) return null;

      const slug = suggestion.slug || suggestion.id;
      const publishedAt = (suggestion.publishedAt || suggestion.createdAt).toISOString();
      const updatedAt = suggestion.updatedAt.toISOString();
      const excerptBase = suggestion.metaDescription?.trim() || suggestion.body || '';
      const url = suggestion.cmsPreviewUrl || `/insights/${slug}`;

      return {
        id: suggestion.id,
        title: suggestion.title,
        slug,
        excerpt: toExcerpt(excerptBase),
        body: suggestion.body,
        publishedAt,
        updatedAt,
        url,
        cmsPreviewUrl: suggestion.cmsPreviewUrl,
        metaDescription: suggestion.metaDescription,
      } satisfies BusinessTunerArticle;
    })
    .filter((item): item is BusinessTunerArticle => Boolean(item))
    .slice(0, clamp(limit, 1, 100));
}

export async function getLandingArticleBySlug(slug: string): Promise<BusinessTunerArticle | null> {
  const items = await getLandingArticles(100);
  return items.find((item) => item.slug === slug) || null;
}

export async function getLandingFaqs(explicitProjectId?: string | null): Promise<BusinessTunerFaq[]> {
  const { suggestions } = await getPublishedLandingSuggestions(explicitProjectId);

  const cmsFaqs = suggestions
    .filter((suggestion) => {
      const sourceSignals = suggestion.sourceSignals as Record<string, unknown> | null;
      const publishRouting = sourceSignals?.publishRouting as Record<string, unknown> | undefined;
      const contentKind = String(publishRouting?.contentKind || '').toUpperCase();
      const targetSection = String(suggestion.targetSection || '').toLowerCase();
      return suggestion.type === 'CREATE_FAQ' || targetSection === 'faq' || contentKind === 'FAQ_PAGE';
    })
    .map((suggestion) => ({
      question: suggestion.title.trim(),
      answer: stripRichText(suggestion.body),
      slug: suggestion.slug || suggestion.id,
      publishedAt: (suggestion.publishedAt || suggestion.createdAt).toISOString(),
    }))
    .filter((faq) => faq.question.length > 0 && faq.answer.length > 0);

  const fallbackFaqs = LANDING_FAQS.map((faq, index) => ({
    question: faq.question,
    answer: faq.answer,
    slug: `default-${index + 1}`,
  }));

  const merged = [...cmsFaqs, ...fallbackFaqs];
  const seen = new Set<string>();

  return merged.filter((faq) => {
    const key = faq.question.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
