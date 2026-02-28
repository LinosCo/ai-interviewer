import * as cheerio from 'cheerio';

export interface PageSEOAudit {
    url: string;
    title: {
        value: string | null;
        length: number;
        score: number;
        issues: string[];
    };
    metaDescription: {
        value: string | null;
        length: number;
        score: number;
        issues: string[];
    };
    h1: {
        count: number;
        values: string[];
        score: number;
        issues: string[];
    };
    h2: {
        count: number;
    };
    images: {
        total: number;
        withAlt: number;
        coveragePercent: number;
        score: number;
        issues: string[];
    };
    schema: {
        found: boolean;
        types: string[];
        score: number;
    };
    canonical: {
        present: boolean;
        value: string | null;
    };
    overallScore: number;
    fetchError?: string;
}

export interface SiteAuditSummary {
    pages: PageSEOAudit[];
    aggregated: {
        avgScore: number;
        avgTitleScore: number;
        avgMetaScore: number;
        avgH1Score: number;
        avgImageScore: number;
        avgSchemaScore: number;
        topIssues: { issue: string; count: number }[];
        pagesWithSchemaPercent: number;
        pagesWithGoodTitlePercent: number;
        pagesWithMetaPercent: number;
    };
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchHTML(url: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BrandAuditBot/1.0)'
            }
        });

        clearTimeout(timer);

        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

function scoreTitle(title: string | null): { score: number; issues: string[] } {
    if (!title || title.trim() === '') {
        return { score: 0, issues: ['Title tag mancante'] };
    }
    const len = title.trim().length;
    const issues: string[] = [];
    let score = 100;

    if (len < 30) {
        issues.push(`Title troppo corto (${len} chars, min 30)`);
        score -= 40;
    } else if (len > 65) {
        issues.push(`Title troppo lungo (${len} chars, max 65)`);
        score -= 20;
    }

    return { score: Math.max(0, score), issues };
}

function scoreMeta(meta: string | null): { score: number; issues: string[] } {
    if (!meta || meta.trim() === '') {
        return { score: 0, issues: ['Meta description mancante'] };
    }
    const len = meta.trim().length;
    const issues: string[] = [];
    let score = 100;

    if (len < 100) {
        issues.push(`Meta description troppo corta (${len} chars, min 100)`);
        score -= 40;
    } else if (len > 165) {
        issues.push(`Meta description troppo lunga (${len} chars, max 165)`);
        score -= 20;
    }

    return { score: Math.max(0, score), issues };
}

function scoreH1(h1s: string[]): { score: number; issues: string[] } {
    if (h1s.length === 0) {
        return { score: 0, issues: ['H1 mancante'] };
    }
    const issues: string[] = [];
    let score = 100;

    if (h1s.length > 1) {
        issues.push(`${h1s.length} tag H1 trovati (dovrebbe essere uno solo)`);
        score -= 30;
    }

    if (h1s[0] && h1s[0].trim().length < 10) {
        issues.push('H1 troppo corto (meno di 10 caratteri)');
        score -= 20;
    }

    return { score: Math.max(0, score), issues };
}

function scoreImages(total: number, withAlt: number): { score: number; issues: string[] } {
    if (total === 0) return { score: 100, issues: [] };

    const coverage = total > 0 ? (withAlt / total) * 100 : 100;
    const issues: string[] = [];
    let score = Math.round(coverage);

    const missing = total - withAlt;
    if (missing > 0) {
        issues.push(`${missing} immagin${missing === 1 ? 'e' : 'i'} senza alt text`);
    }

    return { score: Math.max(0, Math.round(score)), issues };
}

/**
 * Audit a single page for technical SEO factors.
 */
export async function auditPage(url: string): Promise<PageSEOAudit> {
    const html = await fetchHTML(url);

    if (!html) {
        return {
            url,
            title: { value: null, length: 0, score: 0, issues: ['Pagina non raggiungibile'] },
            metaDescription: { value: null, length: 0, score: 0, issues: [] },
            h1: { count: 0, values: [], score: 0, issues: [] },
            h2: { count: 0 },
            images: { total: 0, withAlt: 0, coveragePercent: 100, score: 100, issues: [] },
            schema: { found: false, types: [], score: 0 },
            canonical: { present: false, value: null },
            overallScore: 0,
            fetchError: 'Impossibile recuperare la pagina'
        };
    }

    const $ = cheerio.load(html);

    // Title
    const titleValue = $('title').first().text().trim() || null;
    const titleResult = scoreTitle(titleValue);

    // Meta description
    const metaValue = $('meta[name="description"]').attr('content')?.trim() || null;
    const metaResult = scoreMeta(metaValue);

    // H1
    const h1Elements: string[] = [];
    $('h1').each((_, el) => {
        h1Elements.push($(el).text().trim());
    });
    const h1Result = scoreH1(h1Elements);

    // H2
    const h2Count = $('h2').length;

    // Images
    let totalImages = 0;
    let imagesWithAlt = 0;
    $('img').each((_, el) => {
        totalImages++;
        const alt = $(el).attr('alt');
        if (alt !== undefined && alt.trim() !== '') {
            imagesWithAlt++;
        }
    });
    const imageResult = scoreImages(totalImages, imagesWithAlt);

    // Schema.org JSON-LD
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const parsed = JSON.parse($(el).html() || '{}');
            const type = parsed?.['@type'];
            if (typeof type === 'string') schemaTypes.push(type);
            else if (Array.isArray(type)) schemaTypes.push(...type);
        } catch { /* ignore malformed */ }
    });
    const schemaFound = schemaTypes.length > 0;
    const schemaScore = schemaFound ? 100 : 30;

    // Canonical
    const canonicalValue = $('link[rel="canonical"]').attr('href') || null;

    // Overall score (weighted)
    const overallScore = Math.round(
        titleResult.score * 0.25 +
        metaResult.score * 0.20 +
        h1Result.score * 0.20 +
        imageResult.score * 0.15 +
        schemaScore * 0.20
    );

    return {
        url,
        title: {
            value: titleValue,
            length: titleValue?.length ?? 0,
            score: titleResult.score,
            issues: titleResult.issues
        },
        metaDescription: {
            value: metaValue,
            length: metaValue?.length ?? 0,
            score: metaResult.score,
            issues: metaResult.issues
        },
        h1: {
            count: h1Elements.length,
            values: h1Elements.slice(0, 3),
            score: h1Result.score,
            issues: h1Result.issues
        },
        h2: { count: h2Count },
        images: {
            total: totalImages,
            withAlt: imagesWithAlt,
            coveragePercent: totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100,
            score: imageResult.score,
            issues: imageResult.issues
        },
        schema: {
            found: schemaFound,
            types: schemaTypes,
            score: schemaScore
        },
        canonical: {
            present: !!canonicalValue,
            value: canonicalValue
        },
        overallScore
    };
}

/**
 * Audit multiple pages and return per-page results + aggregated summary.
 */
export async function auditSite(
    urls: string[],
    maxPages: number = 12
): Promise<SiteAuditSummary> {
    const targetUrls = urls.slice(0, maxPages);

    // Parallel audits with concurrency limit of 4
    const results: PageSEOAudit[] = [];
    for (let i = 0; i < targetUrls.length; i += 4) {
        const batch = targetUrls.slice(i, i + 4);
        const batchResults = await Promise.all(batch.map(url => auditPage(url)));
        results.push(...batchResults);
    }

    // Aggregate
    const validPages = results.filter(p => !p.fetchError);
    if (validPages.length === 0) {
        return {
            pages: results,
            aggregated: {
                avgScore: 0,
                avgTitleScore: 0,
                avgMetaScore: 0,
                avgH1Score: 0,
                avgImageScore: 0,
                avgSchemaScore: 0,
                topIssues: [],
                pagesWithSchemaPercent: 0,
                pagesWithGoodTitlePercent: 0,
                pagesWithMetaPercent: 0
            }
        };
    }

    const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

    const issueCounts: Record<string, number> = {};
    for (const page of validPages) {
        const allIssues = [
            ...page.title.issues,
            ...page.metaDescription.issues,
            ...page.h1.issues,
            ...page.images.issues
        ];
        for (const issue of allIssues) {
            issueCounts[issue] = (issueCounts[issue] || 0) + 1;
        }
    }

    const topIssues = Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([issue, count]) => ({ issue, count }));

    return {
        pages: results,
        aggregated: {
            avgScore: avg(validPages.map(p => p.overallScore)),
            avgTitleScore: avg(validPages.map(p => p.title.score)),
            avgMetaScore: avg(validPages.map(p => p.metaDescription.score)),
            avgH1Score: avg(validPages.map(p => p.h1.score)),
            avgImageScore: avg(validPages.map(p => p.images.score)),
            avgSchemaScore: avg(validPages.map(p => p.schema.score)),
            topIssues,
            pagesWithSchemaPercent: Math.round(
                (validPages.filter(p => p.schema.found).length / validPages.length) * 100
            ),
            pagesWithGoodTitlePercent: Math.round(
                (validPages.filter(p => p.title.score >= 80).length / validPages.length) * 100
            ),
            pagesWithMetaPercent: Math.round(
                (validPages.filter(p => p.metaDescription.score >= 60).length / validPages.length) * 100
            )
        }
    };
}
