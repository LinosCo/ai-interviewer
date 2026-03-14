import { NextResponse } from 'next/server';
import { getLandingFaqs, getPublishedLandingSuggestions } from '@/lib/business-tuner-content';

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
    const [items, summary] = await Promise.all([
      getLandingFaqs(explicitProjectId),
      getPublishedLandingSuggestions(explicitProjectId),
    ]);

    return NextResponse.json(
      {
        projectId: summary.projectId,
        projectName: summary.projectName,
        items,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[landing-faqs] Error loading FAQs:', error);
    return NextResponse.json(
      { error: 'Failed to load landing FAQs' },
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
}
