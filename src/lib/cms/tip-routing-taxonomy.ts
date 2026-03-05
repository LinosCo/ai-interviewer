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
  geo_visibility: 'GEO Visibilità',
};

export const ROUTING_TIP_CATEGORY_ORDER: RoutingTipCategory[] = [
  'seo_onpage',
  'seo_technical',
  'llmo_schema',
  'llmo_content',
  'content_strategy',
  'gsc_performance',
  'geo_visibility',
];

export type SuggestedRoutingConnection = 'site_cms' | 'woocommerce' | 'n8n';

export const SUGGESTED_ROUTING_CONNECTION_LABELS: Record<SuggestedRoutingConnection, string> = {
  site_cms: 'Sito/CMS',
  woocommerce: 'WooCommerce',
  n8n: 'n8n',
};

export const CATEGORY_TO_CONTENT_KINDS: Record<RoutingTipCategory, ContentKind[]> = {
  seo_onpage: [CONTENT_KINDS.META_DESCRIPTION, CONTENT_KINDS.PAGE_UPDATE, CONTENT_KINDS.BLOG_UPDATE],
  seo_technical: [CONTENT_KINDS.SCHEMA_ORG, CONTENT_KINDS.PAGE_UPDATE],
  llmo_schema: [CONTENT_KINDS.SCHEMA_ORG, CONTENT_KINDS.NEW_FAQ, CONTENT_KINDS.PAGE_UPDATE],
  llmo_content: [CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.NEW_PAGE, CONTENT_KINDS.BLOG_UPDATE, CONTENT_KINDS.CITATION_SNIPPET],
  content_strategy: [CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.NEW_PAGE],
  gsc_performance: [CONTENT_KINDS.BLOG_UPDATE, CONTENT_KINDS.META_DESCRIPTION, CONTENT_KINDS.PAGE_UPDATE, CONTENT_KINDS.FEATURED_SNIPPET_OPT],
  geo_visibility: [CONTENT_KINDS.SOCIAL_SNIPPET, CONTENT_KINDS.BLOG_POST, CONTENT_KINDS.LINKEDIN_ARTICLE],
};

export const CONTENT_KIND_PRIMARY_CATEGORY: Record<ContentKind, RoutingTipCategory> = {
  BLOG_POST: 'content_strategy',
  BLOG_UPDATE: 'llmo_content',
  NEW_FAQ: 'llmo_schema',
  SCHEMA_ORG: 'llmo_schema',
  NEW_PAGE: 'content_strategy',
  PAGE_UPDATE: 'seo_onpage',
  ALT_DESCRIPTION: 'seo_onpage',
  META_DESCRIPTION: 'seo_onpage',
  PRODUCT_DESCRIPTION: 'seo_technical',
  PRODUCT_FAQ: 'seo_technical',
  SOCIAL_SNIPPET: 'geo_visibility',
  EMAIL_SNIPPET: 'geo_visibility',
  LINKEDIN_ARTICLE: 'geo_visibility',
  LINKEDIN_CAROUSEL: 'geo_visibility',
  LINKEDIN_NEWSLETTER: 'geo_visibility',
  LINKEDIN_POLL: 'geo_visibility',
  GOOGLE_BUSINESS_POST: 'geo_visibility',
  CITATION_SNIPPET: 'llmo_content',
  FEATURED_SNIPPET_OPT: 'gsc_performance',
};

export const CONTENT_KIND_SUGGESTED_CONNECTIONS: Record<ContentKind, SuggestedRoutingConnection[]> = {
  BLOG_POST: ['site_cms'],
  BLOG_UPDATE: ['site_cms'],
  NEW_FAQ: ['site_cms'],
  SCHEMA_ORG: ['site_cms'],
  NEW_PAGE: ['site_cms'],
  PAGE_UPDATE: ['site_cms'],
  ALT_DESCRIPTION: ['site_cms'],
  META_DESCRIPTION: ['site_cms'],
  PRODUCT_DESCRIPTION: ['woocommerce'],
  PRODUCT_FAQ: ['woocommerce'],
  SOCIAL_SNIPPET: ['n8n'],
  EMAIL_SNIPPET: ['n8n'],
  LINKEDIN_ARTICLE: ['n8n'],
  LINKEDIN_CAROUSEL: ['n8n'],
  LINKEDIN_NEWSLETTER: ['n8n'],
  LINKEDIN_POLL: ['n8n'],
  GOOGLE_BUSINESS_POST: ['n8n'],
  CITATION_SNIPPET: ['site_cms'],
  FEATURED_SNIPPET_OPT: ['site_cms'],
};

export function getContentKindCategory(kind: ContentKind): RoutingTipCategory {
  return CONTENT_KIND_PRIMARY_CATEGORY[kind] || 'content_strategy';
}

export function getContentKindSuggestedConnections(kind: ContentKind): SuggestedRoutingConnection[] {
  return CONTENT_KIND_SUGGESTED_CONNECTIONS[kind] || ['site_cms'];
}

export function getContentKindSuggestedConnectionsLabel(kind: ContentKind): string {
  return getContentKindSuggestedConnections(kind)
    .map((conn) => SUGGESTED_ROUTING_CONNECTION_LABELS[conn] || conn)
    .join(' · ');
}

export function getContentKindRoutingDisplayLabel(kind: ContentKind): string {
  const base = CONTENT_KIND_LABELS[kind] || kind;
  const suggested = getContentKindSuggestedConnectionsLabel(kind);
  return `${base} — ${suggested} consigliato`;
}

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

  return CONTENT_KIND_PRIMARY_CATEGORY[kind] || null;
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
