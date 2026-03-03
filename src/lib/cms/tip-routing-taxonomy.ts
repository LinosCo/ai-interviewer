import { CONTENT_KINDS, type ContentKind, CONTENT_KIND_LABELS } from '@/lib/cms/content-kinds';

export type RoutingTipCategory =
  | 'seo_onpage'
  | 'seo_technical'
  | 'llmo_schema'
  | 'llmo_content'
  | 'content_strategy'
  | 'gsc_performance'
  | 'geo_visibility';

export const ROUTING_TIP_CATEGORY_LABELS: Record<RoutingTipCategory, string> = {
  seo_onpage: 'SEO On-page',
  seo_technical: 'SEO Tecnico',
  llmo_schema: 'LLMO Schema',
  llmo_content: 'LLMO Contenuto',
  content_strategy: 'Strategia Contenuti',
  gsc_performance: 'GSC Performance',
  geo_visibility: 'GEO Visibilita',
};

export const CATEGORY_TO_CONTENT_KINDS: Record<RoutingTipCategory, ContentKind[]> = {
  seo_onpage: [CONTENT_KINDS.META_DESCRIPTION, CONTENT_KINDS.PAGE_UPDATE, CONTENT_KINDS.BLOG_UPDATE],
  seo_technical: [CONTENT_KINDS.SCHEMA_ORG, CONTENT_KINDS.PAGE_UPDATE],
  llmo_schema: [CONTENT_KINDS.SCHEMA_ORG, CONTENT_KINDS.NEW_FAQ, CONTENT_KINDS.PAGE_UPDATE],
  llmo_content: [CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.NEW_PAGE, CONTENT_KINDS.BLOG_UPDATE],
  content_strategy: [CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.NEW_PAGE],
  gsc_performance: [CONTENT_KINDS.BLOG_UPDATE, CONTENT_KINDS.META_DESCRIPTION, CONTENT_KINDS.PAGE_UPDATE],
  geo_visibility: [CONTENT_KINDS.SOCIAL_SNIPPET, CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.LINKEDIN_ARTICLE],
};

export function mapSuggestionTypeToCategory(tipType: string): RoutingTipCategory | null {
  const normalized = String(tipType || '').toLowerCase();

  if (normalized === 'add_structured_data' || normalized === 'add_faq') return 'llmo_schema';
  if (normalized === 'add_keyword_content' || normalized === 'improve_clarity') return 'llmo_content';
  if (normalized === 'improve_value_proposition' || normalized === 'improve_meta') return 'seo_onpage';
  if (normalized === 'modify_content') return 'seo_technical';
  if (normalized === 'add_page' || normalized === 'competitive_positioning') return 'content_strategy';
  if (normalized === 'social_post' || normalized === 'address_knowledge_gap') return 'geo_visibility';
  if (normalized === 'leverage_interview_insight') return 'content_strategy';
  if (normalized === 'product_content_optimization') return 'seo_onpage';

  return null;
}

export function mapContentKindToCategory(contentKind: string): RoutingTipCategory | null {
  const kind = String(contentKind || '').toUpperCase() as ContentKind;

  if (kind === CONTENT_KINDS.SCHEMA_ORG || kind === CONTENT_KINDS.NEW_FAQ) return 'llmo_schema';
  if (kind === CONTENT_KINDS.BLOG_POST || kind === CONTENT_KINDS.NEW_PAGE) return 'content_strategy';
  if (kind === CONTENT_KINDS.BLOG_UPDATE) return 'llmo_content';
  if (kind === CONTENT_KINDS.PAGE_UPDATE || kind === CONTENT_KINDS.META_DESCRIPTION || kind === CONTENT_KINDS.ALT_DESCRIPTION) return 'seo_onpage';
  if (kind === CONTENT_KINDS.PRODUCT_DESCRIPTION || kind === CONTENT_KINDS.PRODUCT_FAQ) return 'seo_technical';
  if (
    kind === CONTENT_KINDS.SOCIAL_SNIPPET ||
    kind === CONTENT_KINDS.EMAIL_SNIPPET ||
    kind === CONTENT_KINDS.LINKEDIN_ARTICLE ||
    kind === CONTENT_KINDS.LINKEDIN_CAROUSEL ||
    kind === CONTENT_KINDS.LINKEDIN_NEWSLETTER ||
    kind === CONTENT_KINDS.LINKEDIN_POLL
  ) {
    return 'geo_visibility';
  }

  return null;
}

export function mapCMSSuggestionTypeToFallbackKind(type: string): ContentKind {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'CREATE_FAQ') return CONTENT_KINDS.NEW_FAQ;
  if (normalized === 'CREATE_BLOG_POST') return CONTENT_KINDS.BLOG_POST;
  if (normalized === 'MODIFY_CONTENT') return CONTENT_KINDS.PAGE_UPDATE;
  if (normalized === 'ADD_SECTION') return CONTENT_KINDS.NEW_PAGE;
  return CONTENT_KINDS.NEW_PAGE;
}

export function getContentKindLabel(kind: string): string {
  return CONTENT_KIND_LABELS[kind as ContentKind] || kind;
}
