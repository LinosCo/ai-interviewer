import * as cheerio from 'cheerio';
import { parseProvidedSitemap, parseSitemap } from '@/lib/visibility/site-crawler-engine';

export interface ScrapedContent {
    title: string;
    content: string;
    description?: string;
    url: string;
}

export interface ScrapedPage extends ScrapedContent {
    pageType: 'homepage' | 'about' | 'services' | 'products' | 'pricing' | 'faq' | 'contact' | 'other' | 'custom';
    customLabel?: string; // Label for custom pages added by user
}

export interface MultiPageScrapedContent {
    homepage: ScrapedContent;
    subpages: ScrapedPage[];
    totalContent: string;
    pagesScraped: number;
}

const NOISE_SELECTORS = [
    'script',
    'style',
    'noscript',
    'template',
    'svg',
    'canvas',
    'iframe',
    'nav',
    'footer',
    'header',
    'aside',
    'form',
    'button',
    '.ad',
    '.ads',
    '.cookie-banner',
    '.cookies',
    '.popup',
    '.modal',
    '.sidebar',
    '.widget',
    '.newsletter',
    '[aria-hidden="true"]',
    '[hidden]',
    '[role="dialog"]'
].join(', ');

const SHORTCODE_PATTERNS = [
    /\[\/?[\w:-]+(?:\s+[^\]]*)?\]/g, // WordPress and plugin shortcodes
    /\{\{[\s\S]*?\}\}/g, // Handlebars / Mustache
    /\{%\s*[\s\S]*?%\}/g, // Liquid templates
    /<%[\s\S]*?%>/g, // EJS templates
    /<\?php[\s\S]*?\?>/gi, // PHP blocks accidentally rendered
    /<!--\s*wp:[\s\S]*?-->/g, // Gutenberg start comments
    /<!--\s*\/wp:[\s\S]*?-->/g // Gutenberg end comments
];

const HTML_ENTITY_MAP: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>'
};

function decodeBasicHtmlEntities(input: string): string {
    return input.replace(/&nbsp;|&amp;|&quot;|&#39;|&apos;|&lt;|&gt;/g, (entity) => HTML_ENTITY_MAP[entity] || entity);
}

function sanitizeExtractedText(raw: string, maxChars: number = 12_000): string {
    if (!raw) return '';

    let text = decodeBasicHtmlEntities(raw);
    for (const pattern of SHORTCODE_PATTERNS) {
        text = text.replace(pattern, ' ');
    }

    text = text
        .replace(/https?:\/\/\S+/gi, ' ') // remove noisy URL-only fragments
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (text.length > maxChars) {
        text = `${text.slice(0, maxChars)}...`;
    }

    return text;
}

function extractPageText($: cheerio.CheerioAPI): string {
    const rootCandidates = $('main, article, [role="main"], #content, .content, .main');
    const root = rootCandidates.length > 0 ? rootCandidates.first().clone() : $('body').clone();

    root.find(NOISE_SELECTORS).remove();
    root.find('br').replaceWith('\n');
    root.find('p, h1, h2, h3, h4, h5, h6, li, tr, section, article, div').append('\n');

    return sanitizeExtractedText(root.text());
}

function buildFallbackContent($: cheerio.CheerioAPI, description: string): string {
    const parts: string[] = [];
    const h1 = sanitizeExtractedText($('h1').first().text(), 400);
    const h2 = sanitizeExtractedText($('h2').first().text(), 300);
    const ogTitle = sanitizeExtractedText($('meta[property="og:title"]').attr('content') || '', 300);
    const twitterTitle = sanitizeExtractedText($('meta[name="twitter:title"]').attr('content') || '', 300);
    const bodyText = sanitizeExtractedText($('body').text(), 2500);

    if (description) parts.push(description);
    if (h1) parts.push(h1);
    if (h2) parts.push(h2);
    if (ogTitle) parts.push(ogTitle);
    if (twitterTitle) parts.push(twitterTitle);
    if (bodyText) parts.push(bodyText);

    return sanitizeExtractedText(parts.join('\n\n'), 6000);
}

function normalizeComparableUrl(rawUrl: string): string | null {
    try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        parsed.hash = '';
        parsed.search = '';
        let normalized = parsed.toString();
        if (parsed.pathname !== '/' && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    } catch {
        return null;
    }
}

function isLikelyScrapablePageUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const pathname = parsed.pathname.toLowerCase();

        if (pathname.endsWith('.xml') || pathname.endsWith('.xml.gz')) return false;
        if (pathname.includes('sitemap')) return false;

        return !/\.(pdf|doc|docx|xls|xlsx|zip|rar|png|jpg|jpeg|gif|svg|webp|mp4|mp3|avi|mov)$/i.test(pathname);
    } catch {
        return false;
    }
}

function isLikelySitemapInput(rawUrl: string): boolean {
    const lower = rawUrl.toLowerCase();
    try {
        const parsed = new URL(rawUrl);
        const pathname = parsed.pathname.toLowerCase();
        if (pathname.endsWith('.xml') || pathname.endsWith('.xml.gz')) {
            return pathname.includes('sitemap') || pathname.endsWith('sitemap.xml');
        }
        return pathname.includes('sitemap_index');
    } catch {
        return (
            lower.includes('sitemap') &&
            (lower.endsWith('.xml') || lower.endsWith('.xml.gz') || lower.includes('sitemap_index'))
        );
    }
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
        if (isLikelySitemapInput(url)) {
            const sitemap = await parseProvidedSitemap(url);
            if (sitemap.urls.length > 0) {
                const listedUrls = sitemap.urls.slice(0, 200).join('\n');
                return {
                    title: 'Sitemap',
                    content: `Sitemap URL: ${sitemap.sitemapUrl || url}\n\nDiscovered URLs (${sitemap.urls.length}):\n${listedUrls}`,
                    description: `Parsed sitemap with ${sitemap.urls.length} URLs`,
                    url
                };
            }
            throw new Error('Sitemap provided but no URLs were discovered');
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BusinessTunerBot/1.0 (AI Assistant; +https://businesstuner.ai)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        $('body').find(NOISE_SELECTORS).remove();
        const title = $('title').text().trim() || $('h1').first().text().trim() || url;
        const rawDescription = $('meta[name="description"]').attr('content')
            || $('meta[property="og:description"]').attr('content')
            || '';
        const description = sanitizeExtractedText(rawDescription, 600);
        let content = extractPageText($);

        if (content.length < 120) {
            const fallback = buildFallbackContent($, description);
            if (fallback.length > content.length) {
                content = fallback;
            }
        }

        if (content.length < 30 && description.length < 30) {
            throw new Error("Content too short or couldn't extract meaningful text");
        }

        return {
            title,
            content,
            description,
            url
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown scraping error';
        console.error(`Scraping error for ${url}:`, error);
        throw new Error(`Failed to scrape URL: ${message}`);
    }
}

// Page type patterns for categorization
const PAGE_TYPE_PATTERNS: Record<ScrapedPage['pageType'], RegExp[]> = {
    homepage: [/^\/?$/, /^\/?(index|home)/i],
    about: [/about/i, /chi-siamo/i, /chi_siamo/i, /azienda/i, /company/i, /team/i, /storia/i],
    services: [/serviz/i, /service/i, /soluzion/i, /solution/i, /cosa-facciamo/i, /what-we-do/i],
    products: [/prodott/i, /product/i, /catalog/i, /shop/i, /store/i],
    pricing: [/prezz/i, /pric/i, /pian/i, /tariff/i, /cost/i],
    faq: [/faq/i, /domande/i, /help/i, /support/i, /assistenza/i],
    contact: [/contatt/i, /contact/i, /dove-siamo/i, /location/i],
    custom: [], // Custom pages added by user
    other: []
};

/**
 * Determine the page type based on URL path
 */
function getPageType(url: string): ScrapedPage['pageType'] {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        for (const [pageType, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
            if (pageType === 'other') continue;
            for (const pattern of patterns) {
                if (pattern.test(path)) {
                    return pageType as ScrapedPage['pageType'];
                }
            }
        }
        return 'other';
    } catch {
        return 'other';
    }
}

/**
 * Extract internal links from HTML content
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    try {
        const baseUrlObj = new URL(baseUrl);
        const baseHost = baseUrlObj.hostname;

        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            try {
                // Handle relative URLs
                const absoluteUrl = new URL(href, baseUrl);

                // Only include same-domain links
                if (absoluteUrl.hostname !== baseHost) return;
                if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return;

                // Skip anchors, javascript, mailto, tel links
                if (href.startsWith('#') || href.startsWith('javascript:') ||
                    href.startsWith('mailto:') || href.startsWith('tel:')) return;

                const normalizedUrl = normalizeComparableUrl(absoluteUrl.toString());
                if (!normalizedUrl) return;
                if (!isLikelyScrapablePageUrl(normalizedUrl)) return;

                links.add(normalizedUrl);
            } catch {
                // Invalid URL, skip
            }
        });
    } catch (error) {
        console.error('Error extracting links:', error);
    }

    return Array.from(links);
}

/**
 * Prioritize links by page type importance
 */
function prioritizeLinks(links: string[], maxLinks: number = 10): string[] {
    const priorityOrder: ScrapedPage['pageType'][] = [
        'about', 'services', 'products', 'pricing', 'faq', 'contact', 'other'
    ];

    // Categorize links
    const categorized: Record<ScrapedPage['pageType'], string[]> = {
        homepage: [],
        about: [],
        services: [],
        products: [],
        pricing: [],
        faq: [],
        contact: [],
        custom: [],
        other: []
    };

    for (const link of links) {
        const pageType = getPageType(link);
        categorized[pageType].push(link);
    }

    // Build prioritized list
    const prioritized: string[] = [];

    for (const pageType of priorityOrder) {
        const typeLinks = categorized[pageType];
        // Take first link of each important type
        if (typeLinks.length > 0 && pageType !== 'other') {
            prioritized.push(typeLinks[0]);
        }
    }

    // Fill remaining slots with 'other' links
    const remaining = maxLinks - prioritized.length;
    if (remaining > 0) {
        prioritized.push(...categorized.other.slice(0, remaining));
    }

    return prioritized.slice(0, maxLinks);
}

export interface AdditionalUrl {
    url: string;
    label: string;
}

/**
 * Scrape a website and its important subpages
 */
export async function scrapeWebsiteWithSubpages(
    url: string,
    maxSubpages: number = 8,
    additionalUrls: AdditionalUrl[] = []
): Promise<MultiPageScrapedContent> {
    console.log(`[scraping] Starting multi-page scrape for ${url}`);

    let homepageUrl = url;
    if (isLikelySitemapInput(url)) {
        try {
            const parsed = new URL(url);
            homepageUrl = `${parsed.protocol}//${parsed.host}`;
            console.log(`[scraping] Sitemap URL provided. Using ${homepageUrl} as homepage base.`);
        } catch {
            // keep original URL if parsing fails
        }
    }

    // 1. Scrape homepage first
    const response = await fetch(homepageUrl, {
        headers: {
            'User-Agent': 'BusinessTunerBot/1.0 (AI Assistant; +https://businesstuner.ai)'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const homepageHtml = await response.text();
    const homepage = await scrapeUrl(homepageUrl);
    console.log(`[scraping] Homepage scraped: ${homepage.title}`);

    // 2. Scrape additional URLs first (user-specified, high priority)
    const subpages: ScrapedPage[] = [];
    const scrapedUrls = new Set<string>(); // Track already scraped URLs
    const normalizedHomepageUrl = normalizeComparableUrl(homepageUrl);
    if (normalizedHomepageUrl) scrapedUrls.add(normalizedHomepageUrl);

    if (additionalUrls.length > 0) {
        console.log(`[scraping] Scraping ${additionalUrls.length} additional user-specified URLs...`);

        for (let i = 0; i < additionalUrls.length; i++) {
            const additionalUrl = additionalUrls[i];
            // Stagger requests
            await new Promise(resolve => setTimeout(resolve, i * 200));

            try {
                const content = await scrapeUrl(additionalUrl.url);
                console.log(`[scraping] Scraped custom page: ${additionalUrl.label} - ${content.title}`);

                subpages.push({
                    ...content,
                    pageType: 'custom',
                    customLabel: additionalUrl.label
                });
                const normalizedAdditional = normalizeComparableUrl(additionalUrl.url);
                if (normalizedAdditional) scrapedUrls.add(normalizedAdditional);
            } catch (error) {
                console.warn(`[scraping] Failed to scrape additional URL ${additionalUrl.url}:`, error);
            }
        }
    }

    // 3. Discover pages from sitemap (preferred) + homepage links fallback
    const remainingSlots = maxSubpages - subpages.length;

    if (remainingSlots > 0) {
        let sitemapLinks: string[] = [];
        let sitemapSource: string | null = null;

        try {
            const sitemapResult = isLikelySitemapInput(url)
                ? await parseProvidedSitemap(url)
                : await parseSitemap(url);

            sitemapSource = sitemapResult.sitemapUrl;
            sitemapLinks = sitemapResult.urls
                .map(normalizeComparableUrl)
                .filter((link): link is string => !!link)
                .filter((link) => !scrapedUrls.has(link))
                .filter((link) => isLikelyScrapablePageUrl(link));

            if (sitemapLinks.length > 0) {
                console.log(
                    `[scraping] Sitemap discovered ${sitemapLinks.length} candidate pages` +
                    (sitemapSource ? ` (${sitemapSource})` : '')
                );
            } else if (sitemapSource) {
                console.log(`[scraping] Sitemap found (${sitemapSource}) but no additional page URLs to scrape`);
            } else {
                console.log('[scraping] No sitemap discovered, fallback to homepage links');
            }
        } catch (error) {
            console.warn('[scraping] Sitemap discovery failed, fallback to homepage links:', error);
        }

        const homepageLinks = extractInternalLinks(homepageHtml, homepageUrl)
            .map(normalizeComparableUrl)
            .filter((link): link is string => !!link)
            .filter((link) => !scrapedUrls.has(link))
            .filter((link) => isLikelyScrapablePageUrl(link));

        console.log(`[scraping] Found ${homepageLinks.length} internal links from homepage`);

        let prioritizedLinks: string[] = [];
        if (sitemapLinks.length > 0) {
            const sitemapPrioritized = prioritizeLinks(sitemapLinks, remainingSlots);
            const sitemapRemainder = sitemapLinks.filter(link => !sitemapPrioritized.includes(link));
            const homepagePrioritized = prioritizeLinks(homepageLinks, remainingSlots);

            prioritizedLinks = Array.from(new Set([
                ...sitemapPrioritized,
                ...sitemapRemainder,
                ...homepagePrioritized
            ])).slice(0, remainingSlots);

            console.log(`[scraping] Prioritized ${prioritizedLinks.length} links (sitemap-first)`);
        } else {
            prioritizedLinks = prioritizeLinks(homepageLinks, remainingSlots);
            console.log(`[scraping] Prioritized ${prioritizedLinks.length} links from homepage`);
        }

        // 4. Scrape auto-discovered subpages in parallel with rate limiting
        const scrapePromises = prioritizedLinks.map(async (link, index) => {
            // Stagger requests to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, index * 200));

            try {
                const content = await scrapeUrl(link);
                const pageType = getPageType(link);

                console.log(`[scraping] Scraped subpage: ${pageType} - ${content.title}`);

                return {
                    ...content,
                    pageType
                } as ScrapedPage;
            } catch (error) {
                console.warn(`[scraping] Failed to scrape ${link}:`, error);
                return null;
            }
        });

        const results = await Promise.all(scrapePromises);
        for (const result of results) {
            if (result) {
                subpages.push(result);
            }
        }
    }

    // 5. Combine all content
    const contentParts = [
        `=== HOMEPAGE ===\n${homepage.content}`,
        ...subpages.map(p => {
            const label = p.pageType === 'custom' && p.customLabel
                ? `CUSTOM (${p.customLabel})`
                : p.pageType.toUpperCase();
            return `=== ${label}: ${p.title} ===\n${p.content}`;
        })
    ];

    const totalContent = contentParts.join('\n\n');

    console.log(`[scraping] Multi-page scrape complete: ${subpages.length + 1} pages, ${totalContent.length} chars total`);

    return {
        homepage,
        subpages,
        totalContent,
        pagesScraped: subpages.length + 1
    };
}
