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

export type SocialPlatform = 'linkedin' | 'facebook' | 'instagram' | 'email' | 'google_business';
export type LinkedInFormat = 'article' | 'carousel' | 'newsletter' | 'poll';

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

export interface LinkedInNewsletterPayload extends SocialPayloadBase {
    platform: 'linkedin';
    format: 'newsletter';
    subject: string;
    introText: string;
    sections: Array<{ heading: string; body: string }>;
    ctaText: string;
    ctaUrl: string | null;
    hashtags: string[];
}

export interface LinkedInPollPayload extends SocialPayloadBase {
    platform: 'linkedin';
    format: 'poll';
    question: string;
    options: string[];
    /** Context text posted above the poll */
    contextText: string;
    hashtags: string[];
}

export interface EmailSnippetPayload extends SocialPayloadBase {
    platform: 'email';
    format: 'snippet';
    subject: string;
    preheader: string;
    bodyHtml: string;
    bodyText: string;
    ctaText: string;
    ctaUrl: string | null;
}

export interface GoogleBusinessPostPayload extends SocialPayloadBase {
    platform: 'google_business';
    format: 'post';
    /** Max 1500 chars for Google Business posts */
    text: string;
    ctaType: 'LEARN_MORE' | 'CALL' | 'BOOK' | 'ORDER' | 'SIGN_UP' | 'SHOP';
    ctaUrl: string | null;
    /** Optional: ISO date strings for event posts */
    eventStart?: string;
    eventEnd?: string;
}

export type SocialPayload =
    | LinkedInArticlePayload
    | LinkedInCarouselPayload
    | LinkedInNewsletterPayload
    | LinkedInPollPayload
    | FacebookPostPayload
    | InstagramCaptionPayload
    | EmailSnippetPayload
    | GoogleBusinessPostPayload;

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
// LinkedIn Newsletter formatter
// ---------------------------------------------------------------------------

/**
 * Format a tip as a LinkedIn Newsletter issue.
 * Best for thought-leadership series and recurring editorial content.
 */
export function formatLinkedInNewsletter(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): LinkedInNewsletterPayload {
    const hashtags = deriveHashtags(tip, ['#LinkedIn', '#Newsletter']);

    // Split body into sections by double-newline or H2 markdown headers
    const rawSections = tip.content
        .split(/\n{2,}|(?=^##\s)/m)
        .map(s => s.trim())
        .filter(Boolean);

    const sections = rawSections.slice(0, 6).map((block, i) => {
        const lines = block.split('\n');
        const heading = lines[0].replace(/^#+\s*/, '').trim() || `Sezione ${i + 1}`;
        const body = lines.slice(1).join('\n').trim() || block;
        return { heading, body: truncate(body, 600) };
    });

    // If no sections were derived, wrap entire content as single section
    if (sections.length === 0) {
        sections.push({ heading: tip.title, body: truncate(tip.content, 1200) });
    }

    return {
        platform: 'linkedin',
        format: 'newsletter',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        subject: tip.title,
        introText: truncate(tip.metaDescription ?? tip.content.substring(0, 300), 300),
        sections,
        ctaText: DEFAULT_CTA_TEXT,
        ctaUrl: tip.url ?? null,
        hashtags,
    };
}

// ---------------------------------------------------------------------------
// LinkedIn Poll formatter
// ---------------------------------------------------------------------------

/**
 * Format a tip as a LinkedIn Poll payload.
 * Best for opinion gathering, market research, and engagement campaigns.
 */
export function formatLinkedInPoll(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): LinkedInPollPayload {
    const hashtags = deriveHashtags(tip, ['#LinkedIn', '#Poll']);

    // Extract or generate poll options from tip content
    const bulletMatches = tip.content.match(/^[-*•]\s+(.+)$/gm) ?? [];
    const extractedOptions = bulletMatches
        .map(line => line.replace(/^[-*•]\s+/, '').trim())
        .filter(opt => opt.length > 0 && opt.length <= 30)
        .slice(0, 4);

    // LinkedIn polls require 2–4 options, each max 30 chars
    const fallbackOptions = ['Sì, assolutamente', 'No, non ancora', 'In parte', 'Non so'];
    const options = extractedOptions.length >= 2 ? extractedOptions : fallbackOptions;

    const contextText = truncate(
        tip.metaDescription ?? `${tip.title}\n\n${tip.content.substring(0, 200)}`,
        700
    );

    return {
        platform: 'linkedin',
        format: 'poll',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        question: truncate(tip.title, 140), // LinkedIn poll question max 140 chars
        options,
        contextText,
        hashtags,
    };
}

// ---------------------------------------------------------------------------
// Email Snippet formatter
// ---------------------------------------------------------------------------

/**
 * Format a tip as an email / DEM snippet payload.
 * Produces both HTML and plain-text variants for ESP compatibility.
 */
export function formatEmailSnippet(
    tip: TipPayload,
    opts: { brandName?: string } = {}
): EmailSnippetPayload {
    const preheader = truncate(tip.metaDescription ?? tip.content.substring(0, 90), 90);
    const brandLabel = opts.brandName ? `<strong>${opts.brandName}</strong><br><br>` : '';
    const ctaUrl = tip.url ?? null;

    const bodyHtml = `${brandLabel}<h2>${tip.title}</h2>\n<p>${tip.content.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>\n${ctaUrl ? `<a href="${ctaUrl}">${DEFAULT_CTA_TEXT}</a>` : ''}`;
    const bodyText = `${opts.brandName ? opts.brandName + '\n\n' : ''}${tip.title}\n\n${tip.content}${ctaUrl ? `\n\n${DEFAULT_CTA_TEXT}: ${ctaUrl}` : ''}`;

    return {
        platform: 'email',
        format: 'snippet',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        subject: tip.title,
        preheader,
        bodyHtml,
        bodyText,
        ctaText: DEFAULT_CTA_TEXT,
        ctaUrl,
    };
}

// ---------------------------------------------------------------------------
// Google Business Post formatter
// ---------------------------------------------------------------------------

const MAX_GBP_POST = 1500;

/**
 * Format a tip as a Google Business Profile post.
 * Best for local business updates, offers, and event announcements.
 */
export function formatGoogleBusinessPost(
    tip: TipPayload,
    opts: { brandName?: string; ctaType?: GoogleBusinessPostPayload['ctaType'] } = {}
): GoogleBusinessPostPayload {
    const brandLabel = opts.brandName ? `📍 ${opts.brandName}\n\n` : '';
    const summary = tip.metaDescription ?? tip.content.substring(0, 500);
    const text = truncate(`${brandLabel}${tip.title}\n\n${summary}`, MAX_GBP_POST);

    return {
        platform: 'google_business',
        format: 'post',
        tipId: tip.id,
        brandName: opts.brandName,
        requiresApproval: true,
        generatedAt: new Date().toISOString(),
        text,
        ctaType: opts.ctaType ?? 'LEARN_MORE',
        ctaUrl: tip.url ?? null,
    };
}

// ---------------------------------------------------------------------------
// Channel router
// ---------------------------------------------------------------------------

export type SocialChannelConfig =
    | { platform: 'linkedin'; format: LinkedInFormat }
    | { platform: 'facebook' }
    | { platform: 'instagram' }
    | { platform: 'email' }
    | { platform: 'google_business'; ctaType?: GoogleBusinessPostPayload['ctaType'] };

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
            if (channel.format === 'carousel') return formatLinkedInCarousel(tip, opts);
            if (channel.format === 'newsletter') return formatLinkedInNewsletter(tip, opts);
            if (channel.format === 'poll') return formatLinkedInPoll(tip, opts);
            return formatLinkedInArticle(tip, opts);
        case 'facebook':
            return formatFacebookPost(tip, opts);
        case 'instagram':
            return formatInstagramCaption(tip, opts);
        case 'email':
            return formatEmailSnippet(tip, opts);
        case 'google_business':
            return formatGoogleBusinessPost(tip, { ...opts, ctaType: channel.ctaType });
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
    if (channel.includes('google_business') || kind.includes('google_business')) return { platform: 'google_business' };
    if (channel.includes('email') || kind.includes('email_snippet')) return { platform: 'email' };
    if (channel.includes('newsletter') || kind.includes('newsletter')) return { platform: 'linkedin', format: 'newsletter' };
    if (channel.includes('poll') || kind.includes('poll')) return { platform: 'linkedin', format: 'poll' };
    if (channel.includes('carousel')) return { platform: 'linkedin', format: 'carousel' };
    if (channel.includes('linkedin') || kind.includes('blog') || kind.includes('article')) {
        return { platform: 'linkedin', format: 'article' };
    }
    // Default: LinkedIn article (highest engagement for B2B content)
    return { platform: 'linkedin', format: 'article' };
}
