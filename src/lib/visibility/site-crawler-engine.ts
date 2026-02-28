/**
 * Site Crawler Engine
 *
 * Orchestrates sitemap discovery + per-page technical SEO audit + LLMO
 * (LLM Optimization) scoring. LLMO evaluates how well each page is structured
 * for AI models to extract, understand and cite its content — going beyond
 * classic Google SEO to cover GEO (Generative Engine Optimization).
 *
 * Cross-references each page with Google Search Console data (topSearchPages)
 * to surface combined performance insights.
 */

import * as cheerio from 'cheerio';
import { auditPage, type PageSEOAudit } from './seo-audit-engine';

const FETCH_TIMEOUT_MS = 8000;
const MAX_SITEMAP_URLS = 50;
const CRAWL_CONCURRENCY = 4;

// ─── LLMO Interfaces ─────────────────────────────────────────────────────────

export interface LLMOSignals {
    hasFAQSchema: boolean;
    hasArticleSchema: boolean;           // Article / BlogPosting / NewsArticle
    hasHowToSchema: boolean;
    hasBreadcrumb: boolean;
    hasOrganizationSchema: boolean;
    hasAuthorInfo: boolean;              // author name/org in Article schema or page meta
    hasDatePublished: boolean;           // datePublished or dateModified in Article schema
    questionHeadingsCount: number;       // H2/H3 whose text starts with interrogative words
    wordCount: number;                   // approximate body word count
    internalLinksCount: number;
    hasVideoObject: boolean;
}

export interface LLMOAudit {
    score: number;                       // 0–100
    signals: LLMOSignals;
    issues: string[];                    // what's missing / weak
    strengths: string[];                 // what's already good
}

// ─── Page Full Audit ─────────────────────────────────────────────────────────

export interface GSCPageData {
    impressions: number;
    clicks: number;
    position: number;
    ctr: number;
}

export interface PageFullAudit extends PageSEOAudit {
    llmo: LLMOAudit;
    gscData?: GSCPageData;
}

// ─── Site Crawl Result ───────────────────────────────────────────────────────

export interface SiteCrawlResult {
    sitemapUrl: string | null;
    pagesDiscovered: number;
    pagesAudited: number;
    pages: PageFullAudit[];
    aggregated: {
        avgSeoScore: number;
        avgLlmoScore: number;
        topSeoIssues: { issue: string; count: number }[];
        topLlmoIssues: { issue: string; count: number }[];
        schemaTypeDistribution: Record<string, number>;
        pagesWithFAQSchema: number;
        pagesWithArticleSchema: number;
        pagesWithGoodTitle: number;
        pagesWithMeta: number;
        pagesWithoutLLMO: number;   // llmoScore < 40
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchRaw(url: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrandAuditBot/1.0)' }
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/**
 * Discover page URLs by parsing sitemap.xml (and optionally sitemap_index.xml).
 * Returns up to MAX_SITEMAP_URLS URLs. Falls back to an empty array if no
 * sitemap is found — callers should then fall back to just the base URL.
 */
export async function parseSitemap(baseUrl: string): Promise<{ urls: string[]; sitemapUrl: string | null }> {
    const normalized = baseUrl.replace(/\/$/, '');
    const candidates = [
        `${normalized}/sitemap.xml`,
        `${normalized}/sitemap_index.xml`,
        `${normalized}/sitemap/`,
    ];

    for (const candidate of candidates) {
        const xml = await fetchRaw(candidate);
        if (!xml) continue;

        const $ = cheerio.load(xml, { xmlMode: true });

        // Sitemap index → collect sub-sitemap URLs then fetch each
        const subSitemaps: string[] = [];
        $('sitemapindex sitemap loc, sitemap loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc && (loc.endsWith('.xml') || loc.includes('sitemap'))) {
                subSitemaps.push(loc);
            }
        });

        const directUrls: string[] = [];
        $('urlset url loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) directUrls.push(loc);
        });

        if (subSitemaps.length > 0 && directUrls.length === 0) {
            // Fetch sub-sitemaps to collect page URLs
            const allUrls: string[] = [];
            for (const sub of subSitemaps.slice(0, 5)) {
                const subXml = await fetchRaw(sub);
                if (!subXml) continue;
                const $sub = cheerio.load(subXml, { xmlMode: true });
                $sub('urlset url loc').each((_, el) => {
                    const loc = $sub(el).text().trim();
                    if (loc) allUrls.push(loc);
                });
                if (allUrls.length >= MAX_SITEMAP_URLS) break;
            }
            if (allUrls.length > 0) {
                return { urls: allUrls.slice(0, MAX_SITEMAP_URLS), sitemapUrl: candidate };
            }
        }

        if (directUrls.length > 0) {
            return { urls: directUrls.slice(0, MAX_SITEMAP_URLS), sitemapUrl: candidate };
        }
    }

    return { urls: [], sitemapUrl: null };
}

// ─── LLMO Audit ──────────────────────────────────────────────────────────────

const QUESTION_PREFIXES_IT = ['come', 'cosa', 'perché', 'perche', 'chi', 'dove', 'quando', 'quale', 'quali', 'quanto', 'quanti'];
const QUESTION_PREFIXES_EN = ['how', 'what', 'why', 'who', 'where', 'when', 'which', 'is', 'are', 'can', 'does', 'do', 'should'];
const QUESTION_PREFIXES = [...QUESTION_PREFIXES_IT, ...QUESTION_PREFIXES_EN];

function isQuestionHeading(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return QUESTION_PREFIXES.some(p => lower.startsWith(p + ' ') || lower.startsWith(p + "'")) || lower.endsWith('?');
}

function countWords(text: string): number {
    return text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

/**
 * Run LLMO audit on already-fetched HTML.
 */
function runLLMOAudit(html: string): LLMOAudit {
    const $ = cheerio.load(html);

    // ── Schema.org detection ──────────────────────────────────────────────────
    const schemaTypes: string[] = [];
    const schemaObjects: Record<string, unknown>[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const parsed = JSON.parse($(el).html() || '{}');
            const addTypes = (obj: Record<string, unknown>) => {
                const t = obj['@type'];
                if (typeof t === 'string') { schemaTypes.push(t); schemaObjects.push(obj); }
                else if (Array.isArray(t)) { t.forEach(s => { schemaTypes.push(s); schemaObjects.push(obj); }); }
                // Handle @graph arrays
                const graph = obj['@graph'];
                if (Array.isArray(graph)) {
                    graph.forEach((node: unknown) => {
                        if (node && typeof node === 'object') addTypes(node as Record<string, unknown>);
                    });
                }
            };
            addTypes(parsed);
        } catch { /* ignore malformed */ }
    });

    const hasFAQSchema = schemaTypes.some(t =>
        ['FAQPage', 'FAQ'].includes(t)
    );
    const articleTypes = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle'];
    const hasArticleSchema = schemaTypes.some(t => articleTypes.includes(t));
    const hasHowToSchema = schemaTypes.some(t => t === 'HowTo');
    const hasBreadcrumb = schemaTypes.some(t => t === 'BreadcrumbList');
    const hasOrganizationSchema = schemaTypes.some(t => ['Organization', 'LocalBusiness', 'Corporation'].includes(t));
    const hasVideoObject = schemaTypes.some(t => t === 'VideoObject');

    // E-E-A-T: author + date from Article schema or <meta>
    const articleObj = schemaObjects.find((obj) =>
        articleTypes.includes(String(obj['@type']))
    );
    const hasAuthorInfo = !!(
        (articleObj && (articleObj['author'] || articleObj['creator'])) ||
        $('meta[name="author"]').attr('content') ||
        $('[rel="author"]').length > 0
    );
    const hasDatePublished = !!(
        (articleObj && (articleObj['datePublished'] || articleObj['dateModified'])) ||
        $('meta[property="article:published_time"]').attr('content') ||
        $('time[datetime]').length > 0
    );

    // ── Question-pattern headings ─────────────────────────────────────────────
    let questionHeadingsCount = 0;
    $('h2, h3').each((_, el) => {
        if (isQuestionHeading($(el).text())) questionHeadingsCount++;
    });

    // ── Word count (approximate, from body text) ──────────────────────────────
    // Remove scripts/styles before counting
    $('script, style, nav, footer, header').remove();
    const bodyText = $('body').text() || $('main').text() || '';
    const wordCount = countWords(bodyText);

    // ── Internal links ────────────────────────────────────────────────────────
    const internalLinksCount = $('a[href]').filter((_, el) => {
        const href = $(el).attr('href') || '';
        return !href.startsWith('http') || href.includes(
            // Heuristic: relative links or same-origin links
            ($('meta[property="og:url"]').attr('content') || '').split('/')[2] || ''
        );
    }).length;

    // ── Score computation ─────────────────────────────────────────────────────
    let score = 0;
    const issues: string[] = [];
    const strengths: string[] = [];

    if (hasFAQSchema) {
        score += 25;
        strengths.push('FAQ schema presente: ottimo per citazioni AI');
    } else {
        issues.push('Manca FAQ schema (FAQPage JSON-LD): aggiungilo per favorire citazioni AI');
    }

    if (hasArticleSchema) {
        if (hasAuthorInfo && hasDatePublished) {
            score += 20;
            strengths.push('Article schema con autore e data: segnale E-E-A-T forte');
        } else {
            score += 10;
            if (!hasAuthorInfo) issues.push('Article schema senza autore: aggiungi campo "author" per E-E-A-T');
            if (!hasDatePublished) issues.push('Article schema senza data pubblicazione: aggiungi "datePublished"');
        }
    } else {
        issues.push('Nessun Article/BlogPosting schema: utile per contenuti editoriali');
    }

    if (hasHowToSchema) {
        score += 10;
        strengths.push('HowTo schema: eccellente per query procedurali AI');
    }

    if (questionHeadingsCount >= 3) {
        score += 15;
        strengths.push(`${questionHeadingsCount} heading con formato domanda: struttura ottimale per AI`);
    } else if (questionHeadingsCount >= 1) {
        score += 7;
        issues.push(`Solo ${questionHeadingsCount} heading con domanda: punta a 3+ per migliore visibilità AI`);
    } else {
        issues.push('Nessun heading con formato domanda (Come/What/Perché): riformula alcune sezioni');
    }

    if (wordCount >= 1000) {
        score += 12;
        strengths.push(`Contenuto ricco (${wordCount} parole): favorisce citazioni dettagliate AI`);
    } else if (wordCount >= 500) {
        score += 6;
        issues.push(`Contenuto medio (${wordCount} parole): punta a 1000+ per maggiore autorevolezza`);
    } else {
        issues.push(`Contenuto scarso (${wordCount} parole): rischio di essere ignorato dall'AI`);
    }

    if (hasBreadcrumb) {
        score += 5;
        strengths.push('Breadcrumb schema: aiuta l\'AI a capire la struttura del sito');
    } else {
        issues.push('Manca Breadcrumb schema: aggiungilo per migliorare la comprensione strutturale');
    }

    if (hasOrganizationSchema) {
        score += 8;
        strengths.push('Organization schema: rafforza l\'identità del brand per l\'AI');
    } else {
        issues.push('Nessun Organization/LocalBusiness schema: aggiungi identità brand');
    }

    if (hasVideoObject) {
        score += 5;
        strengths.push('VideoObject schema: formato multimediale apprezzato dai motori AI');
    }

    return {
        score: Math.min(100, score),
        signals: {
            hasFAQSchema,
            hasArticleSchema,
            hasHowToSchema,
            hasBreadcrumb,
            hasOrganizationSchema,
            hasAuthorInfo,
            hasDatePublished,
            questionHeadingsCount,
            wordCount,
            internalLinksCount,
            hasVideoObject,
        },
        issues,
        strengths,
    };
}

// ─── GSC Cross-reference ─────────────────────────────────────────────────────

type GSCPage = { page: string; impressions: number; clicks: number; position: number };

/**
 * Match a full page URL against GSC topSearchPages data.
 * GSC pages can be full URLs or paths — we compare by path.
 */
function matchGSC(url: string, gscPages: GSCPage[]): GSCPageData | undefined {
    try {
        const urlPath = new URL(url).pathname.replace(/\/$/, '') || '/';
        for (const gsc of gscPages) {
            let gscPath: string;
            try {
                gscPath = new URL(gsc.page).pathname.replace(/\/$/, '') || '/';
            } catch {
                gscPath = gsc.page.replace(/\/$/, '') || '/';
            }
            if (gscPath === urlPath) {
                const ctr = gsc.impressions > 0 ? (gsc.clicks / gsc.impressions) * 100 : 0;
                return {
                    impressions: gsc.impressions,
                    clicks: gsc.clicks,
                    position: Math.round(gsc.position * 10) / 10,
                    ctr: Math.round(ctr * 10) / 10,
                };
            }
        }
    } catch { /* ignore malformed URLs */ }
    return undefined;
}

// ─── Full Page Audit ─────────────────────────────────────────────────────────

async function auditFullPage(url: string, gscPages: GSCPage[]): Promise<PageFullAudit> {
    // Re-fetch so we can run both SEO + LLMO on the same HTML
    // (auditPage internally fetches; we fetch separately for LLMO)
    const [seoAudit, html] = await Promise.all([
        auditPage(url),
        fetchRaw(url),
    ]);

    const llmo = html ? runLLMOAudit(html) : {
        score: 0,
        signals: {
            hasFAQSchema: false, hasArticleSchema: false, hasHowToSchema: false,
            hasBreadcrumb: false, hasOrganizationSchema: false, hasAuthorInfo: false,
            hasDatePublished: false, questionHeadingsCount: 0, wordCount: 0,
            internalLinksCount: 0, hasVideoObject: false,
        },
        issues: ['Pagina non raggiungibile'],
        strengths: [],
    };

    const gscData = matchGSC(url, gscPages);

    return { ...seoAudit, llmo, gscData };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CrawlOptions {
    /** GSC topSearchPages data for cross-referencing */
    gscPages?: GSCPage[];
    /** Maximum pages to audit (default 30) */
    maxPages?: number;
}

/**
 * Discover and audit an entire site.
 *
 * 1. Parse sitemap to discover URLs (falls back to base URL only)
 * 2. Audit each URL: technical SEO + LLMO scoring
 * 3. Cross-reference with GSC data
 * 4. Aggregate results
 */
export async function crawlSite(
    websiteUrl: string,
    options: CrawlOptions = {}
): Promise<SiteCrawlResult> {
    const { gscPages = [], maxPages = 30 } = options;
    const normalized = websiteUrl.replace(/\/$/, '');

    // 1. Discover URLs
    const { urls: discovered, sitemapUrl } = await parseSitemap(normalized);
    const urlsToAudit = discovered.length > 0
        ? discovered.slice(0, maxPages)
        : [normalized]; // fallback to homepage only

    const pagesDiscovered = discovered.length || 1;

    // 2. Parallel crawl with concurrency limit
    const pages: PageFullAudit[] = [];
    for (let i = 0; i < urlsToAudit.length; i += CRAWL_CONCURRENCY) {
        const batch = urlsToAudit.slice(i, i + CRAWL_CONCURRENCY);
        const results = await Promise.all(batch.map(u => auditFullPage(u, gscPages)));
        pages.push(...results);
    }

    // 3. Aggregate
    const validPages = pages.filter(p => !p.fetchError);

    const avg = (arr: number[]) =>
        arr.length === 0 ? 0 : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

    const seoIssueCounts: Record<string, number> = {};
    const llmoIssueCounts: Record<string, number> = {};
    const schemaTypeDist: Record<string, number> = {};

    for (const page of validPages) {
        for (const issue of [...page.title.issues, ...page.metaDescription.issues, ...page.h1.issues, ...page.images.issues]) {
            seoIssueCounts[issue] = (seoIssueCounts[issue] || 0) + 1;
        }
        for (const issue of page.llmo.issues) {
            llmoIssueCounts[issue] = (llmoIssueCounts[issue] || 0) + 1;
        }
        for (const t of page.schema.types) {
            schemaTypeDist[t] = (schemaTypeDist[t] || 0) + 1;
        }
    }

    const topSeoIssues = Object.entries(seoIssueCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([issue, count]) => ({ issue, count }));

    const topLlmoIssues = Object.entries(llmoIssueCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([issue, count]) => ({ issue, count }));

    return {
        sitemapUrl,
        pagesDiscovered,
        pagesAudited: pages.length,
        pages,
        aggregated: {
            avgSeoScore: avg(validPages.map(p => p.overallScore)),
            avgLlmoScore: avg(validPages.map(p => p.llmo.score)),
            topSeoIssues,
            topLlmoIssues,
            schemaTypeDistribution: schemaTypeDist,
            pagesWithFAQSchema: validPages.filter(p => p.llmo.signals.hasFAQSchema).length,
            pagesWithArticleSchema: validPages.filter(p => p.llmo.signals.hasArticleSchema).length,
            pagesWithGoodTitle: validPages.filter(p => p.title.score >= 80).length,
            pagesWithMeta: validPages.filter(p => p.metaDescription.score >= 60).length,
            pagesWithoutLLMO: validPages.filter(p => p.llmo.score < 40).length,
        },
    };
}
