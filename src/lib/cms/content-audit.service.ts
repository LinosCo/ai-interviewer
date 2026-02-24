/**
 * Content & Product Audit Service
 *
 * Analyzes existing WordPress/WooCommerce/CMS content, cross-references
 * with GSC data, and generates optimization suggestions targeting
 * specific existing content (UPDATE vs CREATE).
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { SiteDiscoveryService } from '@/lib/integrations/site-discovery.service';
import type { SiteStructure, SitePage, SitePost, SiteProduct } from '@/lib/integrations/site-adapter';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type AuditIssueType =
    | 'missing_schema'
    | 'weak_meta'
    | 'missing_alt_text'
    | 'thin_content'
    | 'thin_product_description'
    | 'missing_product_attributes'
    | 'outdated_content'
    | 'gsc_opportunity'
    | 'gsc_low_ctr';

export interface AuditIssue {
    type: AuditIssueType;
    severity: 'high' | 'medium' | 'low';
    entityType: 'page' | 'post' | 'product';
    entityId: string | number;
    entityTitle: string;
    entitySlug: string;
    description: string;
    /** GSC query that triggered this issue (if applicable) */
    gscQuery?: string;
    gscData?: { impressions: number; clicks: number; ctr: number; position: number };
}

export interface AuditResult {
    projectId: string;
    discoveredAt: string;
    totalPages: number;
    totalPosts: number;
    totalProducts: number;
    issues: AuditIssue[];
    summary: {
        high: number;
        medium: number;
        low: number;
        total: number;
    };
}

interface GSCQuery {
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
}

// -----------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------

export class ContentAuditService {
    /**
     * Run a full content audit for a project.
     * Combines site structure discovery with GSC cross-referencing.
     */
    static async runAudit(projectId: string): Promise<AuditResult> {
        // Load merged site structure (returns null if no connections found)
        const siteStructure = await SiteDiscoveryService.getProjectStructure(projectId) || {
            pages: [], posts: [], categories: [], tags: []
        } as SiteStructure;

        // Load GSC data (last 30 days)
        const gscQueries = await this.loadGSCQueries(projectId);

        const issues: AuditIssue[] = [];

        // Audit pages
        for (const page of siteStructure.pages) {
            issues.push(...this.auditPage(page));
        }

        // Audit posts
        for (const post of siteStructure.posts) {
            issues.push(...this.auditPost(post));
        }

        // Audit products
        if (siteStructure.products) {
            for (const product of siteStructure.products) {
                issues.push(...this.auditProduct(product));
            }
        }

        // GSC cross-reference
        issues.push(...this.crossReferenceWithGSC(siteStructure, gscQueries));

        // Sort by severity
        const severityOrder = { high: 0, medium: 1, low: 2 };
        issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
            projectId,
            discoveredAt: new Date().toISOString(),
            totalPages: siteStructure.pages.length,
            totalPosts: siteStructure.posts.length,
            totalProducts: siteStructure.products?.length || 0,
            issues,
            summary: {
                high: issues.filter(i => i.severity === 'high').length,
                medium: issues.filter(i => i.severity === 'medium').length,
                low: issues.filter(i => i.severity === 'low').length,
                total: issues.length
            }
        };
    }

    // -----------------------------------------------------------------------
    // Page/Post/Product auditors
    // -----------------------------------------------------------------------

    private static auditPage(page: SitePage): AuditIssue[] {
        const issues: AuditIssue[] = [];

        // Check for outdated content (6+ months)
        if (page.modified) {
            const modifiedDate = new Date(page.modified);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (modifiedDate < sixMonthsAgo) {
                issues.push({
                    type: 'outdated_content',
                    severity: 'medium',
                    entityType: 'page',
                    entityId: page.id,
                    entityTitle: page.title,
                    entitySlug: page.slug,
                    description: `Pagina non aggiornata da ${this.monthsSince(modifiedDate)} mesi. Verifica che il contenuto sia ancora attuale.`
                });
            }
        }

        return issues;
    }

    private static auditPost(post: SitePost): AuditIssue[] {
        const issues: AuditIssue[] = [];

        // Thin content check (excerpt too short usually means thin content)
        if (post.excerpt && post.excerpt.length < 50) {
            issues.push({
                type: 'thin_content',
                severity: 'medium',
                entityType: 'post',
                entityId: post.id,
                entityTitle: post.title,
                entitySlug: post.slug,
                description: `Post con contenuto potenzialmente scarso (excerpt: ${post.excerpt.length} caratteri). Considera di espandere il contenuto.`
            });
        }

        // Outdated check
        if (post.modified) {
            const modifiedDate = new Date(post.modified);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (modifiedDate < sixMonthsAgo) {
                issues.push({
                    type: 'outdated_content',
                    severity: 'low',
                    entityType: 'post',
                    entityId: post.id,
                    entityTitle: post.title,
                    entitySlug: post.slug,
                    description: `Post non aggiornato da ${this.monthsSince(modifiedDate)} mesi.`
                });
            }
        }

        return issues;
    }

    private static auditProduct(product: SiteProduct): AuditIssue[] {
        const issues: AuditIssue[] = [];

        // Thin product description
        if (product.shortDescription && product.shortDescription.length < 80) {
            issues.push({
                type: 'thin_product_description',
                severity: 'high',
                entityType: 'product',
                entityId: product.id,
                entityTitle: product.name,
                entitySlug: product.slug,
                description: `Descrizione prodotto troppo corta (${product.shortDescription.length} car.). Le descrizioni complete migliorano SEO e conversioni.`
            });
        }

        // Missing SKU (affects schema Product)
        if (!product.sku) {
            issues.push({
                type: 'missing_product_attributes',
                severity: 'medium',
                entityType: 'product',
                entityId: product.id,
                entityTitle: product.name,
                entitySlug: product.slug,
                description: `Prodotto senza SKU. Lo SKU è necessario per uno schema Product completo.`
            });
        }

        // No categories assigned
        if (!product.categories || product.categories.length === 0) {
            issues.push({
                type: 'missing_product_attributes',
                severity: 'medium',
                entityType: 'product',
                entityId: product.id,
                entityTitle: product.name,
                entitySlug: product.slug,
                description: `Prodotto senza categorie assegnate. Le categorie migliorano la navigazione e la SEO.`
            });
        }

        return issues;
    }

    // -----------------------------------------------------------------------
    // GSC Cross-Reference
    // -----------------------------------------------------------------------

    private static crossReferenceWithGSC(
        siteStructure: SiteStructure,
        gscQueries: GSCQuery[]
    ): AuditIssue[] {
        if (gscQueries.length === 0) return [];

        const issues: AuditIssue[] = [];

        // Build a set of all known slugs for matching
        const allSlugs = new Set<string>();
        const allTitles = new Set<string>();

        for (const page of siteStructure.pages) {
            allSlugs.add(page.slug.toLowerCase());
            allTitles.add(page.title.toLowerCase());
        }
        for (const post of siteStructure.posts) {
            allSlugs.add(post.slug.toLowerCase());
            allTitles.add(post.title.toLowerCase());
        }
        if (siteStructure.products) {
            for (const product of siteStructure.products) {
                allSlugs.add(product.slug.toLowerCase());
                allTitles.add(product.name.toLowerCase());
            }
        }

        for (const q of gscQueries) {
            const queryLower = q.query.toLowerCase();

            // GSC Opportunity: high impressions but no matching page
            if (q.impressions >= 100 && q.clicks < 5) {
                const hasMatch = this.queryMatchesContent(queryLower, allSlugs, allTitles);
                if (!hasMatch) {
                    issues.push({
                        type: 'gsc_opportunity',
                        severity: 'high',
                        entityType: 'post',
                        entityId: `gsc:${q.query}`,
                        entityTitle: q.query,
                        entitySlug: q.query.replace(/\s+/g, '-').toLowerCase(),
                        description: `Query GSC "${q.query}" ha ${q.impressions} impressioni ma nessuna pagina corrispondente. Opportunità di creare contenuto targetizzato.`,
                        gscQuery: q.query,
                        gscData: { impressions: q.impressions, clicks: q.clicks, ctr: q.ctr, position: q.position }
                    });
                }
            }

            // GSC Low CTR: good position but low CTR → improve title/meta
            if (q.position <= 20 && q.impressions >= 50 && q.ctr < 0.02) {
                const matchingPage = this.findMatchingEntity(queryLower, siteStructure);
                if (matchingPage) {
                    issues.push({
                        type: 'gsc_low_ctr',
                        severity: 'high',
                        entityType: matchingPage.type,
                        entityId: matchingPage.id,
                        entityTitle: matchingPage.title,
                        entitySlug: matchingPage.slug,
                        description: `"${matchingPage.title}" appare in posizione ${q.position.toFixed(1)} per "${q.query}" (${q.impressions} imp.) ma con CTR ${(q.ctr * 100).toFixed(1)}%. Migliora title e meta description.`,
                        gscQuery: q.query,
                        gscData: { impressions: q.impressions, clicks: q.clicks, ctr: q.ctr, position: q.position }
                    });
                }
            }
        }

        return issues;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static async loadGSCQueries(projectId: string): Promise<GSCQuery[]> {
        // Find CMS connections for this project to get WebsiteAnalytics
        const connections = await prisma.cMSConnection.findMany({
            where: { projectId, searchConsoleConnected: true },
            select: { id: true }
        });

        if (connections.length === 0) return [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get the most recent WebsiteAnalytics with GSC data
        const analytics = await prisma.websiteAnalytics.findMany({
            where: {
                connectionId: { in: connections.map(c => c.id) },
                date: { gte: thirtyDaysAgo },
                NOT: [
                    { topSearchQueries: { equals: Prisma.DbNull } },
                    { topSearchQueries: { equals: Prisma.JsonNull } }
                ]
            },
            orderBy: { date: 'desc' },
            take: 7, // Last 7 days
            select: { topSearchQueries: true }
        });

        // Merge and deduplicate queries across days
        const queryMap = new Map<string, GSCQuery>();

        for (const day of analytics) {
            const queries = day.topSearchQueries as GSCQuery[] | null;
            if (!Array.isArray(queries)) continue;

            for (const q of queries) {
                if (!q.query) continue;
                const existing = queryMap.get(q.query.toLowerCase());
                if (existing) {
                    // Aggregate: sum impressions/clicks, average position/ctr
                    existing.impressions += q.impressions || 0;
                    existing.clicks += q.clicks || 0;
                    existing.position = (existing.position + (q.position || 0)) / 2;
                    existing.ctr = existing.clicks / (existing.impressions || 1);
                } else {
                    queryMap.set(q.query.toLowerCase(), {
                        query: q.query,
                        impressions: q.impressions || 0,
                        clicks: q.clicks || 0,
                        ctr: q.ctr || 0,
                        position: q.position || 0
                    });
                }
            }
        }

        return Array.from(queryMap.values())
            .sort((a, b) => b.impressions - a.impressions);
    }

    private static queryMatchesContent(
        query: string,
        slugs: Set<string>,
        titles: Set<string>
    ): boolean {
        // Check if any slug or title contains the query words
        const words = query.split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return false;

        for (const slug of slugs) {
            if (words.every(w => slug.includes(w))) return true;
        }
        for (const title of titles) {
            if (words.every(w => title.includes(w))) return true;
        }
        return false;
    }

    private static findMatchingEntity(
        query: string,
        structure: SiteStructure
    ): { type: 'page' | 'post' | 'product'; id: string | number; title: string; slug: string } | null {
        const words = query.split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return null;

        // Check pages
        for (const page of structure.pages) {
            if (words.every(w => page.title.toLowerCase().includes(w) || page.slug.toLowerCase().includes(w))) {
                return { type: 'page', id: page.id, title: page.title, slug: page.slug };
            }
        }

        // Check posts
        for (const post of structure.posts) {
            if (words.every(w => post.title.toLowerCase().includes(w) || post.slug.toLowerCase().includes(w))) {
                return { type: 'post', id: post.id, title: post.title, slug: post.slug };
            }
        }

        // Check products
        if (structure.products) {
            for (const product of structure.products) {
                if (words.every(w => product.name.toLowerCase().includes(w) || product.slug.toLowerCase().includes(w))) {
                    return { type: 'product', id: product.id, title: product.name, slug: product.slug };
                }
            }
        }

        return null;
    }

    private static monthsSince(date: Date): number {
        const now = new Date();
        return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30));
    }
}
