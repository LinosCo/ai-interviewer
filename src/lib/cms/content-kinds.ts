/**
 * ContentKind constants — granular AI tip types that drive routing rules.
 * Stored as free strings in sourceSignals.publishRouting.contentKind
 * and in TipRoutingRule.contentKind.
 */

export const CONTENT_KINDS = {
  // Blog / editorial
  BLOG_POST: 'BLOG_POST',
  BLOG_UPDATE: 'BLOG_UPDATE',

  // SEO structural
  NEW_FAQ: 'NEW_FAQ',
  SCHEMA_ORG: 'SCHEMA_ORG',
  NEW_PAGE: 'NEW_PAGE',
  PAGE_UPDATE: 'PAGE_UPDATE',

  // Media / assets
  ALT_DESCRIPTION: 'ALT_DESCRIPTION',
  META_DESCRIPTION: 'META_DESCRIPTION',

  // E-commerce
  PRODUCT_DESCRIPTION: 'PRODUCT_DESCRIPTION',
  PRODUCT_FAQ: 'PRODUCT_FAQ',

  // Social / automation
  SOCIAL_SNIPPET: 'SOCIAL_SNIPPET',
  EMAIL_SNIPPET: 'EMAIL_SNIPPET',

  // LinkedIn B2B (Gap M — Sprint 6)
  LINKEDIN_ARTICLE: 'LINKEDIN_ARTICLE',
  LINKEDIN_CAROUSEL: 'LINKEDIN_CAROUSEL',
  LINKEDIN_NEWSLETTER: 'LINKEDIN_NEWSLETTER',
  LINKEDIN_POLL: 'LINKEDIN_POLL',

  // Google Business
  GOOGLE_BUSINESS_POST: 'GOOGLE_BUSINESS_POST',

  // SEO/GEO/AEO (Wave 3 — T12)
  CITATION_SNIPPET: 'CITATION_SNIPPET',
  FEATURED_SNIPPET_OPT: 'FEATURED_SNIPPET_OPT',
} as const;

export type ContentKind = typeof CONTENT_KINDS[keyof typeof CONTENT_KINDS];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  BLOG_POST: 'Articolo blog',
  BLOG_UPDATE: 'Aggiornamento blog',
  NEW_FAQ: 'Nuova FAQ',
  SCHEMA_ORG: 'Schema.org (JSON-LD)',
  NEW_PAGE: 'Nuova pagina',
  PAGE_UPDATE: 'Aggiornamento pagina',
  ALT_DESCRIPTION: 'Alt text immagini',
  META_DESCRIPTION: 'Meta description',
  PRODUCT_DESCRIPTION: 'Descrizione prodotto',
  PRODUCT_FAQ: 'FAQ prodotto',
  SOCIAL_SNIPPET: 'Post social',
  EMAIL_SNIPPET: 'Snippet email/DEM',
  LINKEDIN_ARTICLE: 'Articolo LinkedIn',
  LINKEDIN_CAROUSEL: 'Carousel LinkedIn',
  LINKEDIN_NEWSLETTER: 'Newsletter LinkedIn',
  LINKEDIN_POLL: 'Sondaggio LinkedIn',
  GOOGLE_BUSINESS_POST: 'Post Google Business',
  CITATION_SNIPPET: 'Citation Snippet (LLM)',
  FEATURED_SNIPPET_OPT: 'Featured Snippet Optimizer',
};

export const ALL_CONTENT_KINDS = Object.values(CONTENT_KINDS);
