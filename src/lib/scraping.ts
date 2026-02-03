import * as cheerio from 'cheerio';

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

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
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

        // Remove script, style, and navigation elements to clean up text
        $('script, style, nav, footer, header, aside, .ad, .cookie-banner, .popup, .modal, .sidebar, .widget, iframe').remove();

        const title = $('title').text().trim() || $('h1').first().text().trim() || url;
        const description = $('meta[name="description"]').attr('content')?.trim();

        // Extract main content
        // Try to find main content container
        let contentEl = $('main, article, #content, .content, .main').first();

        // Fallback to body if no main container found
        if (contentEl.length === 0) {
            contentEl = $('body');
        }

        // Convert to clean text
        // Replace block elements with newlines to preserve structure
        $('br').replaceWith('\n');
        $('p, h1, h2, h3, h4, h5, h6, li, tr').after('\n');

        const content = contentEl.text()
            .replace(/\[\/?[\w-]+.*?\]/g, '') // Remove WordPress-style shortcodes
            .replace(/\s\s+/g, ' ') // Collapse multiple spaces
            .replace(/\n\s*\n/g, '\n\n') // Collapse multiple newlines
            .trim();

        if (content.length < 50) {
            throw new Error("Content too short or couldn't extract meaningful text");
        }

        return {
            title,
            content,
            description,
            url
        };
    } catch (error: any) {
        console.error(`Scraping error for ${url}:`, error);
        throw new Error(`Failed to scrape URL: ${error.message}`);
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

                // Skip anchors, javascript, mailto, tel links
                if (href.startsWith('#') || href.startsWith('javascript:') ||
                    href.startsWith('mailto:') || href.startsWith('tel:')) return;

                // Skip file downloads
                if (/\.(pdf|doc|docx|xls|xlsx|zip|rar|png|jpg|jpeg|gif|svg|webp)$/i.test(absoluteUrl.pathname)) return;

                // Normalize URL (remove trailing slash, hash, query params)
                absoluteUrl.hash = '';
                absoluteUrl.search = '';
                let normalizedUrl = absoluteUrl.toString();
                if (normalizedUrl.endsWith('/') && normalizedUrl.length > 1) {
                    normalizedUrl = normalizedUrl.slice(0, -1);
                }

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

    // 1. Scrape homepage first
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'BusinessTunerBot/1.0 (AI Assistant; +https://businesstuner.ai)'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const homepageHtml = await response.text();
    const homepage = await scrapeUrl(url);
    console.log(`[scraping] Homepage scraped: ${homepage.title}`);

    // 2. Scrape additional URLs first (user-specified, high priority)
    const subpages: ScrapedPage[] = [];
    const scrapedUrls = new Set<string>([url]); // Track already scraped URLs

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
                scrapedUrls.add(additionalUrl.url);
            } catch (error) {
                console.warn(`[scraping] Failed to scrape additional URL ${additionalUrl.url}:`, error);
            }
        }
    }

    // 3. Extract and prioritize internal links (fill remaining slots)
    const remainingSlots = maxSubpages - subpages.length;

    if (remainingSlots > 0) {
        const allLinks = extractInternalLinks(homepageHtml, url);
        // Filter out already scraped URLs
        const newLinks = allLinks.filter(link => !scrapedUrls.has(link));
        console.log(`[scraping] Found ${newLinks.length} new internal links`);

        const prioritizedLinks = prioritizeLinks(newLinks, remainingSlots);
        console.log(`[scraping] Prioritized ${prioritizedLinks.length} links to scrape`);

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
