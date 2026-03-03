/**
 * Social Media Content Templates
 *
 * Transforms CMSSuggestion / TipPayload objects into platform-optimised
 * payloads that n8n workflows can consume directly to publish on
 * LinkedIn, Facebook and Instagram.
 *
 * Pure functions — no I/O, no side-effects, easy to unit-test.
 */

import type { TipPayload } from './dispatcher';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type SocialPlatform = 'linkedin' | 'facebook' | 'instagram';
export type LinkedInFormat = 'article' | 'carousel';

export interface SocialPayloadBase {
    platform: SocialPlatform;
    tipId: string;
    brandName?: string;
    requiresApproval: boolean;
    /** ISO timestamp — lets n8n schedule publication */
    generatedAt: string;
}

export interface LinkedInArticlePayload extends SocialPayloadBase {
    platform: 'linkedin';
    format: 'article';
    title: string;
    body: string;
    /** First ~280 chars used as the LinkedIn post caption above the article */
    teaser: string;
    hashtags: string[];
    ctaText: string;
    ctaUrl: string | null;
}

export interface LinkedInCarouselPayload extends SocialPayloadBase {
    platform: 'linkedin';
    format: 'carousel';
    title: string;
    slides: Array<{ slideNumber: number; headline: string; body: string }>;
    hashtags: string[];
    ctaText: string;
    ctaUrl: string | null;
}

export interface FacebookPostPayload extends SocialPayloadBase {
    platform: 'facebook';
    format: 'post';
    text: string;
    hashtags: string[];
    linkUrl: string | null;
    linkTitle: string;
    callToAction: 'LEARN_MORE' | 'SIGN_UP' | 'CONTACT_US' | 'SHOP_NOW';
}

export interface InstagramCaptionPayload extends SocialPayloadBase {
    platform: 'instagram';
    format: 'caption';
    caption: string;
    /** Separated from caption so n8n can append them or post as first comment */
    hashtags: string[];
    /** Slide texts for multi-image posts — first element is always the cover */
    slideTexts: string[];
}

export type SocialPayload =
    | LinkedInArticlePayload
    | LinkedInCarouselPayload
    | FacebookPostPayload
    | InstagramCaptionPayload;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CTA_TEXT = 'Scopri di più';
const MAX_IG_CAPTION = 2200; // Instagram caption limit
const MAX_FB_POST = 63_206; // Facebook post limit (practical cap: much lower)
const PRACTICAL_FB_CAP = 500;

/**
 * Derive hashtags from existing suggestedHashtags or generate generic ones
 * from the contentKind/title.
 */
function deriveHashtags(tip: TipPayload, extras: string[] = []): string[] {
    const base: string[] = tip.suggestedHashtags?.length
        ? tip.suggestedHashtags
        : deriveDefaultHashtags(tip);
    return [...new Set([...base, ...extras])].slice(0, 10);
}

function deriveDefaultHashtags(tip: TipPayload): string[] {
    const tags: string[] = [];
    const kind = tip.contentKind?.toLowerCase() ?? '';

    if (kind.includes('blog') || kind.includes('create_blog')) tags.push('#Blog', '#ContentMarketing');
    if (kind.includes('faq')) tags.push('#FAQ', '#Support');
    if (kind.includes('page') || kind.includes('create_page')) tags.push('#LandingPage', '#Marketing');
    if (kind.includes('seo') || kind.includes('modify')) tags.push('#SEO', '#DigitalMarketing');

    // Generic fallbacks
    if (tags.length === 0) tags.push('#DigitalMarketing', '#ContentStrategy');
    tags.push('#AI', '#Insights');
    return tags;
}

/**
 * Split a long body into slide-sized chunks (~120 chars each).
 * Returns at least 3, at most 10 slides.
 */
function bodyToSlides(body: string, title: string): Array<{ slideNumber: number; headline: string; body: string }> {
    // Sentence-aware split
    const sentences = body
        .replace(/\n+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length > 200 && current) {
            chunks.push(current.trim());
            current = sentence;
        } else {
            current = (current + ' ' + sentence).trim();
        }
    }
    if (current) chunks.push(current);

    // Map to slide objects: slide 0 = title card
    const slides: Array<{ slideNumber: number; headline: string; body: string }> = [
        { slideNumber: 1, headline: title, body: '' }
    ];

    chunks.slice(0, 8).forEach((chunk, i) => {
        slides.push({ slideNumber: i + 2, headline: extractHeadlineFromChunk(chunk), body: chunk });
    });

    // Ensure CTA slide at end
    slides.push({
        slideNumber: slides.length + 1,
        headline: DEFAULT_CTA_TEXT,
        body: '📩 Seguici per altri contenuti come questo.'
    });

    return slides;
}

function extractHeadlineFromChunk(chunk: string): string {
    const firstSentence = chunk.split(/[.!?]/)[0] ?? chunk;
    return firstSentence.length > 60 ? firstSentence.substring(0, 57) + '…' : firstSentence;
}

function truncate(str: string, max: number): string {
    return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

// ---------------------------------------------------------------------------
// LinkedIn formatters
// ---------------------------------------------------------------------------

/**
 * Format a tip as a LinkedIn article payload.
 * Best for long-form, educational content (blog posts, guides, analyses).
 */
export function formatLinkedInArticle(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): LinkedInArticlePayload {
    const teaser = truncate(tip.metaDescription ?? tip.content.substring(0, 280), 280);
    const hashtags = deriveHashtags(tip, ['#LinkedIn']);

    return {
        platform: 'linkedin',
        format: 'article',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        title: tip.title,
        body: tip.content,
        teaser,
        hashtags,
        ctaText: DEFAULT_CTA_TEXT,
        ctaUrl: tip.url ?? null,
    };
}

/**
 * Format a tip as a LinkedIn carousel (slide deck) payload.
 * Best for step-by-step content, lists, or visually rich ideas.
 */
export function formatLinkedInCarousel(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): LinkedInCarouselPayload {
    const slides = bodyToSlides(tip.content, tip.title);
    const hashtags = deriveHashtags(tip, ['#LinkedIn', '#Carousel']);

    return {
        platform: 'linkedin',
        format: 'carousel',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        title: tip.title,
        slides,
        hashtags,
        ctaText: DEFAULT_CTA_TEXT,
        ctaUrl: tip.url ?? null,
    };
}

// ---------------------------------------------------------------------------
// Facebook formatter
// ---------------------------------------------------------------------------

/**
 * Format a tip as a Facebook post payload.
 */
export function formatFacebookPost(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): FacebookPostPayload {
    const summary = tip.metaDescription ?? truncate(tip.content, PRACTICAL_FB_CAP);
    const hashtags = deriveHashtags(tip, ['#Facebook']);

    // Compose post text: hook + body + subtle CTA
    const brandLabel = opts.brandName ? `📣 ${opts.brandName}\n\n` : '';
    const text = truncate(
        `${brandLabel}${tip.title}\n\n${summary}\n\n${hashtags.join(' ')}`,
        PRACTICAL_FB_CAP + hashtags.join(' ').length + 50
    );

    return {
        platform: 'facebook',
        format: 'post',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        text,
        hashtags,
        linkUrl: tip.url ?? null,
        linkTitle: tip.title,
        callToAction: 'LEARN_MORE',
    };
}

// ---------------------------------------------------------------------------
// Instagram formatter
// ---------------------------------------------------------------------------

/**
 * Format a tip as an Instagram caption + optional carousel slides payload.
 */
export function formatInstagramCaption(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): InstagramCaptionPayload {
    const hashtags = deriveHashtags(tip, ['#Instagram', '#Reels']);

    // Instagram captions work best with line breaks and emojis
    const intro = `✨ ${tip.title}\n\n`;
    const body = truncate(
        tip.metaDescription ?? tip.content.substring(0, 800),
        MAX_IG_CAPTION - intro.length - 200 // leave room for hashtags
    );
    const caption = `${intro}${body}`;

    // Slide texts for carousel posts (keep short — each slide max ~150 chars)
    const slideTexts = tip.content
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 10)
        .slice(0, 8)
        .map(line => truncate(line, 150));

    // Cover slide = title
    if (!slideTexts.length || slideTexts[0] !== tip.title) {
        slideTexts.unshift(tip.title);
    }

    return {
        platform: 'instagram',
        format: 'caption',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        caption,
        hashtags,
        slideTexts,
    };
}

// ---------------------------------------------------------------------------
// Channel router
// ---------------------------------------------------------------------------

export type SocialChannelConfig =
    | { platform: 'linkedin'; format: LinkedInFormat }
    | { platform: 'facebook' }
    | { platform: 'instagram' };

/**
 * Route a tip to the correct formatter based on channel config.
 */
export function formatForChannel(
    tip: TipPayload,
    channel: SocialChannelConfig,
    opts: { brandName?: string } = {}
): SocialPayload {
    switch (channel.platform) {
        case 'linkedin':
            return channel.format === 'carousel'
                ? formatLinkedInCarousel(tip, opts)
                : formatLinkedInArticle(tip, opts);
        case 'facebook':
            return formatFacebookPost(tip, opts);
        case 'instagram':
            return formatInstagramCaption(tip, opts);
    }
}

/**
 * Infer a sensible default channel config from the tip's contentKind / targetChannel.
 */
export function inferChannelConfig(tip: TipPayload): SocialChannelConfig {
    const channel = (tip.targetChannel ?? '').toLowerCase();
    const kind = (tip.contentKind ?? '').toLowerCase();

    if (channel.includes('instagram')) return { platform: 'instagram' };
    if (channel.includes('facebook')) return { platform: 'facebook' };
    if (channel.includes('carousel')) return { platform: 'linkedin', format: 'carousel' };
    if (channel.includes('linkedin') || kind.includes('blog') || kind.includes('article')) {
        return { platform: 'linkedin', format: 'article' };
    }
    // Default: LinkedIn article (highest engagement for B2B content)
    return { platform: 'linkedin', format: 'article' };
}
