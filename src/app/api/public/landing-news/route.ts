import { NextResponse } from 'next/server';
import { getLandingArticles, getPublishedLandingSuggestions } from '@/lib/business-tuner-content';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const explicitProjectId = url.searchParams.get('projectId');
    const limit = clamp(Number(url.searchParams.get('limit') || 6) || 6, 1, 20);
    const [articles, summary] = await Promise.all([
      getLandingArticles(limit, explicitProjectId),
      getPublishedLandingSuggestions(explicitProjectId),
    ]);

    return NextResponse.json(
      {
        projectId: summary.projectId,
        projectName: summary.projectName,
        items: articles.map((item) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          body: item.body,
          publishedAt: item.publishedAt,
          updatedAt: item.updatedAt,
          url: item.url,
          cmsPreviewUrl: item.cmsPreviewUrl,
          metaDescription: item.metaDescription,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[landing-news] Error loading news:', error);
    return NextResponse.json(
      { error: 'Failed to load landing news' },
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
}
