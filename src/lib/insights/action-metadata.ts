import { CONTENT_KINDS, type ContentKind } from '@/lib/cms/content-kinds';
import {
  mapContentKindToCategory,
  type RoutingTipCategory,
} from '@/lib/cms/tip-routing-taxonomy';
import type { CMSSuggestionType } from '@prisma/client';

type InsightActionLike = {
  type?: string;
  target?: string;
  title?: string;
  body?: string;
};

export type InsightActionMetadata = {
  contentKind: ContentKind | null;
  category: RoutingTipCategory | null;
  suggestionType: CMSSuggestionType | null;
  executionClass: 'routing_ready' | 'digital_manual' | 'non_digital';
  businessCategory:
    | 'seo_llmo'
    | 'content'
    | 'marketing_pr'
    | 'product_offer'
    | 'sales_cx'
    | 'strategy'
    | 'competitive_intelligence';
};

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function inferContentKind(action: InsightActionLike): ContentKind | null {
  const type = String(action.type || '').toLowerCase();
  const target = String(action.target || '').toLowerCase();
  const title = `${String(action.title || '').toLowerCase()} ${String(action.body || '').toLowerCase()}`;

  if (type === 'add_faq' || includesAny(title, ['faq', 'domande frequenti'])) {
    return CONTENT_KINDS.NEW_FAQ;
  }
  if (includesAny(title, ['schema', 'json-ld', 'structured data'])) {
    return CONTENT_KINDS.SCHEMA_ORG;
  }
  if (includesAny(title, ['meta description', 'meta title'])) {
    return CONTENT_KINDS.META_DESCRIPTION;
  }
  if (includesAny(title, ['alt text', 'alt immagini', 'testo alternativo'])) {
    return CONTENT_KINDS.ALT_DESCRIPTION;
  }
  if (includesAny(title, ['linkedin newsletter'])) {
    return CONTENT_KINDS.LINKEDIN_NEWSLETTER;
  }
  if (includesAny(title, ['linkedin carousel'])) {
    return CONTENT_KINDS.LINKEDIN_CAROUSEL;
  }
  if (includesAny(title, ['linkedin poll', 'sondaggio linkedin'])) {
    return CONTENT_KINDS.LINKEDIN_POLL;
  }
  if (includesAny(title, ['linkedin'])) {
    return CONTENT_KINDS.LINKEDIN_ARTICLE;
  }
  if (includesAny(title, ['email', 'newsletter'])) {
    return CONTENT_KINDS.EMAIL_SNIPPET;
  }
  if (type === 'marketing_campaign' || type === 'respond_to_press' || target === 'marketing' || target === 'pr') {
    return CONTENT_KINDS.SOCIAL_SNIPPET;
  }
  if (type === 'modify_content' || includesAny(title, ['aggiorna', 'update', 'ottimizza'])) {
    if (target === 'product' || includesAny(title, ['prodotto', 'sku'])) {
      return CONTENT_KINDS.PRODUCT_DESCRIPTION;
    }
    if (includesAny(title, ['blog', 'articolo'])) {
      return CONTENT_KINDS.BLOG_UPDATE;
    }
    return CONTENT_KINDS.PAGE_UPDATE;
  }
  if (type === 'create_content' || target === 'website' || target === 'product') {
    if (target === 'product' || includesAny(title, ['prodotto', 'catalogo', 'sku'])) {
      return CONTENT_KINDS.PRODUCT_DESCRIPTION;
    }
    if (includesAny(title, ['blog', 'articolo', 'news'])) {
      return CONTENT_KINDS.BLOG_POST;
    }
    return CONTENT_KINDS.NEW_PAGE;
  }

  return null;
}

function inferSuggestionType(
  action: InsightActionLike,
  contentKind: ContentKind | null
): CMSSuggestionType | null {
  const type = String(action.type || '').toLowerCase();
  const title = String(action.title || '').toLowerCase();

  if (contentKind === CONTENT_KINDS.NEW_FAQ) return 'CREATE_FAQ';
  if (type === 'modify_content') return 'MODIFY_CONTENT';
  if (
    contentKind === CONTENT_KINDS.BLOG_POST ||
    contentKind === CONTENT_KINDS.BLOG_UPDATE ||
    includesAny(title, ['blog', 'articolo'])
  ) {
    return 'CREATE_BLOG_POST';
  }
  if (contentKind === CONTENT_KINDS.NEW_PAGE) return 'CREATE_PAGE';
  if (contentKind === CONTENT_KINDS.PAGE_UPDATE || contentKind === CONTENT_KINDS.PRODUCT_DESCRIPTION) {
    return 'MODIFY_CONTENT';
  }
  if (type === 'create_content') return 'CREATE_PAGE';

  return null;
}

export function buildInsightActionMetadata(action: InsightActionLike): InsightActionMetadata {
  const type = String(action.type || '').toLowerCase();
  const target = String(action.target || '').toLowerCase();
  const text = `${String(action.title || '').toLowerCase()} ${String(action.body || '').toLowerCase()}`;
  const contentKind = inferContentKind(action);
  const category = contentKind ? mapContentKindToCategory(contentKind) : null;

  const executionClass: InsightActionMetadata['executionClass'] = contentKind
    ? 'routing_ready'
    : (target === 'strategy' || target === 'product' || type === 'pricing_change' || type === 'product_improvement')
      ? 'non_digital'
      : 'digital_manual';

  let businessCategory: InsightActionMetadata['businessCategory'] = 'content';
  if (
    category === 'seo_onpage' ||
    category === 'seo_technical' ||
    category === 'llmo_schema' ||
    category === 'llmo_content' ||
    type === 'add_visibility_prompt'
  ) {
    businessCategory = 'seo_llmo';
  } else if (type === 'marketing_campaign' || type === 'respond_to_press' || target === 'marketing' || target === 'pr') {
    businessCategory = 'marketing_pr';
  } else if (type === 'product_improvement' || type === 'pricing_change' || target === 'product' || includesAny(text, ['prezzo', 'offerta', 'packaging'])) {
    businessCategory = 'product_offer';
  } else if (type === 'strategic_recommendation' || target === 'strategy') {
    businessCategory = 'strategy';
  } else if (type === 'monitor_competitor' || target === 'serp') {
    businessCategory = 'competitive_intelligence';
  } else if (includesAny(text, ['sales', 'vendite', 'customer care', 'assistenza', 'onboarding'])) {
    businessCategory = 'sales_cx';
  } else if (category === 'content_strategy') {
    businessCategory = 'content';
  }

  return {
    contentKind,
    category,
    suggestionType: inferSuggestionType(action, contentKind),
    executionClass,
    businessCategory,
  };
}
