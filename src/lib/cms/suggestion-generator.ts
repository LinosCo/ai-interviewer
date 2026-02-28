import { prisma } from '@/lib/prisma';
import { CMSSuggestionType } from '@prisma/client';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import {
    inferContentKind,
    normalizePublicationRouting,
    resolvePublishingCapabilities
} from '@/lib/cms/publishing';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createHash } from 'crypto';
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';
import type { SiteStructure } from '@/lib/integrations/site-adapter';
import { SiteDiscoveryService } from '@/lib/integrations/site-discovery.service';

export interface SuggestionInput {
    connectionId: string;
    insightId?: string;
    projectId?: string | null;
    strategicPlan?: string | null;
    type: CMSSuggestionType;
    action?: Record<string, any>;
    signals: {
        chatbotQuestions?: { question: string; count: number }[];
        visibilityGaps?: { topic: string; competitors: string[] }[];
        lowPerformingPages?: { path: string; bounceRate: number; views: number }[];
        searchQueries?: { query: string; impressions: number; position: number; clicks: number }[];
        interviewFeedback?: { topic: string; sentiment: string; quotes: string[] }[];
        aiTips?: { source: string; title: string; priority?: number }[];
        strategyAlignment?: string;
        evidencePoints?: string[];
        channels?: string[];
        validation?: Record<string, any>;
    };
}

const ContentSchema = z.object({
    title: z.string().describe('Titolo SEO-friendly del contenuto'),
    slug: z.string().describe('URL slug (es. "tempi-consegna-spedizioni")'),
    body: z.string().describe('Contenuto completo in formato Markdown'),
    metaDescription: z.string().describe('Meta description per SEO (max 160 caratteri)'),
    reasoning: z.string().describe('Spiegazione dettagliata del perché questo contenuto è importante'),
    targetSection: z.string().describe('Sezione del sito dove pubblicare (blog, faq, pages, news, social, products)'),
    mediaBrief: z.string().optional().describe('Descrizione del visual/video adatto (social)'),
    strategyAlignment: z.string().optional().describe('Frase di allineamento a vision/value proposition/strategic plan'),
    evidencePoints: z.array(z.string()).optional().describe('2-4 evidenze numeriche o factuali'),
    targetEntityId: z.string().optional().describe('ID entità target, es. product id WooCommerce'),
    targetEntitySlug: z.string().optional().describe('Slug entità target, es. product slug WooCommerce'),
    // SEO & Schema.org fields
    schemaMarkup: z.string().optional().describe('Schema.org JSON-LD completo (es. Article, FAQPage, Product, LocalBusiness)'),
    seoFields: z.object({
        focusKeyword: z.string().describe('Keyword principale da targetizzare'),
        seoTitle: z.string().optional().describe('Titolo SEO ottimizzato (max 60 caratteri)'),
        ogTitle: z.string().optional().describe('Open Graph title per condivisione social'),
        ogDescription: z.string().optional().describe('Open Graph description per condivisione social'),
    }).optional().describe('Campi SEO per Yoast/RankMath e social sharing'),
    categories: z.array(z.string()).optional().describe('Nomi categorie esistenti del sito da assegnare'),
    tags: z.array(z.string()).optional().describe('Nomi tag da assegnare al contenuto'),
    imageAltText: z.string().optional().describe('Alt text per immagine principale del contenuto'),
    productAttributes: z.record(z.string(), z.string()).optional().describe('Attributi prodotto WooCommerce (es. { "colore": "rosso", "taglia": "L" })'),
});

export class CMSSuggestionGenerator {
    /**
     * Generate a content suggestion based on cross-channel signals.
     */
    static async generateSuggestion(input: SuggestionInput): Promise<string> {
        const { connectionId, insightId, type, signals } = input;

        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: {
                project: {
                    include: {
                        organization: {
                            select: {
                                strategicVision: true,
                                valueProposition: true,
                                name: true,
                                platformSettings: {
                                    select: {
                                        strategicPlan: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!connection || !connection.project) {
            throw new Error('CMS connection not found');
        }

        const brandName = connection.project.name || connection.project.organization?.name || 'Brand';
        const strategicPlan = input.strategicPlan || connection.project.organization?.platformSettings?.strategicPlan || null;

        const capabilities = await resolvePublishingCapabilities({
            projectId: input.projectId || connection.projectId,
            hasCmsApi: true,
            hasGoogleAnalytics: Boolean(connection.googleAnalyticsConnected),
            hasSearchConsole: Boolean(connection.searchConsoleConnected)
        });

        // Load site structure if available (non-blocking)
        let siteStructure: SiteStructure | null = null;
        const projectId = input.projectId || connection.projectId;
        if (projectId) {
            try {
                siteStructure = await SiteDiscoveryService.getProjectStructure(projectId);
            } catch (err) {
                console.warn('Failed to load site structure for content generation:', err);
            }
        }

        const content = await this.generateContent(
            type,
            signals,
            brandName,
            connection.project.organization?.strategicVision,
            connection.project.organization?.valueProposition,
            strategicPlan,
            capabilities,
            siteStructure
        );

        const inferredKind = inferContentKind({
            suggestionType: type,
            tipType: this.deriveTipTypeFromAction(input.action),
            targetSection: content.targetSection,
            title: content.title
        });

        const implementationHint = this.buildImplementationHint(input.action, content);
        const publishRouting = normalizePublicationRouting(
            implementationHint,
            inferredKind,
            capabilities,
            content.targetSection
        );

        const priorityScore = this.calculatePriorityScore(signals);

        const tipKey = createHash('md5')
            .update(`${insightId || ''}:${type}:${content.title}:${publishRouting.contentKind}`)
            .digest('hex')
            .substring(0, 16);

        const recentSuggestions = await prisma.cMSSuggestion.findMany({
            where: {
                connectionId,
                createdAt: {
                    gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
                }
            },
            select: { id: true, sourceSignals: true }
        });

        const existing = recentSuggestions.find(s => {
            const sourceSignals = (s.sourceSignals && typeof s.sourceSignals === 'object')
                ? (s.sourceSignals as Record<string, unknown>)
                : {};
            return sourceSignals.tipKey === tipKey;
        });

        if (existing) {
            return existing.id;
        }

        // Enrich publishRouting with categories/tags from generated content
        if (content.categories?.length) {
            publishRouting.wpCategories = content.categories;
            if (publishRouting.publishChannel === 'WOOCOMMERCE_MCP') {
                publishRouting.wooProductCategories = content.categories;
            }
        }
        if (content.tags?.length) {
            publishRouting.wpTags = content.tags;
        }

        const sourceSignalsPayload = {
            ...signals,
            origin: 'cross_channel_insight',
            insightId,
            projectId: input.projectId || connection.projectId,
            tipKey,
            tipType: this.deriveTipTypeFromAction(input.action),
            strategyAlignment: content.strategyAlignment || signals.strategyAlignment || null,
            evidencePoints: content.evidencePoints || signals.evidencePoints || [],
            publishRouting,
            mediaBrief: content.mediaBrief || null,
            targetEntityId: content.targetEntityId || null,
            targetEntitySlug: content.targetEntitySlug || null,
            strategicPlan: strategicPlan || null,
            dataCapabilities: {
                hasGoogleAnalytics: capabilities.hasGoogleAnalytics,
                hasSearchConsole: capabilities.hasSearchConsole,
                hasWordPress: capabilities.hasWordPress,
                hasWooCommerce: capabilities.hasWooCommerce
            }
        };

        // Build seoData from generated content (stored separately for publishing)
        const seoData = this.buildSeoData(content);

        const suggestion = await prisma.cMSSuggestion.create({
            data: {
                connectionId,
                crossChannelInsightId: insightId,
                type,
                title: content.title,
                slug: content.slug,
                body: content.body,
                metaDescription: content.metaDescription,
                targetSection: content.targetSection,
                reasoning: content.reasoning,
                sourceSignals: sourceSignalsPayload as any,
                priorityScore,
                status: 'PENDING',
                ...(seoData ? { seoData: seoData as any } : {})
            }
        });

        return suggestion.id;
    }

    private static deriveTipTypeFromAction(action?: Record<string, any>): string | undefined {
        if (!action) return undefined;
        if (typeof action.tipType === 'string') return action.tipType;
        if (action.target === 'product') return 'product_content_optimization';
        if ((action.title || '').toLowerCase().includes('social')) return 'social_post';
        return typeof action.type === 'string' ? action.type : undefined;
    }

    private static buildImplementationHint(action: Record<string, any> | undefined, content: z.infer<typeof ContentSchema>) {
        if (!action) return undefined;

        const hintedChannel = (() => {
            if (action.target === 'product') return 'WOOCOMMERCE_MCP';
            if ((action.target || '').toLowerCase() === 'website') return undefined;
            return undefined;
        })();

        const hintedKind = (() => {
            if (action.target === 'product') return 'PRODUCT_DESCRIPTION';
            if ((action.title || '').toLowerCase().includes('social')) return 'SOCIAL_POST';
            if ((action.title || '').toLowerCase().includes('schema')) return 'SCHEMA_PATCH';
            if ((action.title || '').toLowerCase().includes('seo')) return 'SEO_PATCH';
            return undefined;
        })();

        return {
            publishChannel: hintedChannel,
            contentKind: hintedKind,
            targetSection: content.targetSection,
            targetEntityType: action.target === 'product' ? 'product' : undefined,
            targetEntityId: content.targetEntityId || action.targetEntityId || action.entityId,
            targetEntitySlug: content.targetEntitySlug || action.targetEntitySlug || action.entitySlug
        };
    }

    /**
     * Generate content using LLM.
     */
    private static async generateContent(
        type: CMSSuggestionType,
        signals: SuggestionInput['signals'],
        brandName: string,
        strategicVision?: string | null,
        valueProposition?: string | null,
        strategicPlan?: string | null,
        capabilities?: {
            hasWordPress: boolean;
            hasWooCommerce: boolean;
            hasGoogleAnalytics: boolean;
            hasSearchConsole: boolean;
        },
        siteStructure?: SiteStructure | null
    ): Promise<z.infer<typeof ContentSchema>> {
        const { model } = await getSystemLLM({ preferLatestVisibilityModel: true });

        const typeInstructions: Record<CMSSuggestionType, string> = {
            CREATE_PAGE: 'Crea una nuova pagina informativa completa con sezioni ben strutturate.',
            CREATE_FAQ: 'Crea una pagina FAQ con domande e risposte chiare e concise.',
            CREATE_BLOG_POST: 'Crea un articolo di blog/news oppure un contenuto social se i segnali lo indicano.',
            MODIFY_CONTENT: 'Suggerisci modifiche specifiche a contenuti esistenti (SEO, schema.org, pagine o prodotti).',
            ADD_SECTION: 'Crea una nuova sezione da aggiungere a una pagina esistente.'
        };

        const signalsSummary = this.formatSignalsForPrompt(signals);
        const siteContextBlock = this.formatSiteStructureForPrompt(siteStructure);
        const schemaInstructions = this.getSchemaOrgInstructions(type, capabilities);
        const linkedInBlock = this.buildLinkedInBlock(signals.channels);

        const { object } = await generateObject({
            model,
            schema: ContentSchema,
            prompt: `Sei un content strategist esperto in SEO, LLMO e conversione per PMI italiane.

=== BRAND ===
Nome: ${sanitizeConfig(brandName, 200)}
${strategicVision ? `Visione strategica: ${sanitizeConfig(strategicVision, 500)}` : ''}
${valueProposition ? `Value proposition: ${sanitizeConfig(valueProposition, 500)}` : ''}
${strategicPlan ? `Piano strategico copilot: ${sanitizeConfig(strategicPlan, 1000)}` : ''}

=== TIPO DI CONTENUTO ===
${typeInstructions[type]}

=== CAPABILITIES ATTIVE ===
- WordPress MCP: ${capabilities?.hasWordPress ? 'attivo' : 'non attivo'}
- WooCommerce MCP: ${capabilities?.hasWooCommerce ? 'attivo' : 'non attivo'}
- Google Analytics: ${capabilities?.hasGoogleAnalytics ? 'attivo' : 'non attivo'}
- Search Console: ${capabilities?.hasSearchConsole ? 'attivo' : 'non attivo'}
${siteContextBlock}
=== DATI CHE MOTIVANO QUESTO CONTENUTO ===
${signalsSummary}

=== ISTRUZIONI ===
1. Il titolo deve essere SEO-friendly e catturare l'attenzione.
2. Lo slug deve essere breve, descrittivo e SEO-friendly (usa trattini, no spazi).
3. Il body deve essere in Markdown con H2/H3, paragrafi brevi, liste e CTA.
4. La meta description deve essere <=160 caratteri.
5. Il reasoning deve spiegare perche questo contenuto e importante citando i segnali reali.
6. Compila strategyAlignment con una frase chiara di coerenza con vision/value proposition/piano strategico.
7. Compila evidencePoints con 2-4 evidenze sintetiche.
8. Se il contenuto e per social, aggiungi mediaBrief (descrizione immagine/video).
9. Se il contenuto e per prodotto, imposta targetSection="products" e quando possibile targetEntityId o targetEntitySlug.
${linkedInBlock}${schemaInstructions}
=== SEO & SCHEMA.ORG ===
10. Genera schemaMarkup con un JSON-LD valido e completo per il tipo di contenuto.
11. Compila seoFields con focusKeyword (basata sulle query GSC se disponibili), seoTitle (max 60 char), ogTitle e ogDescription.
12. Se esistono categorie nel sito, usa categories con i NOMI ESATTI delle categorie esistenti. Non inventarne di nuove a meno che non ci sia una corrispondenza.
13. Suggerisci tags pertinenti (possono essere nuovi o esistenti).
14. Compila imageAltText con un alt text SEO-friendly per l'immagine principale.
15. Se il contenuto e per prodotto WooCommerce, compila productAttributes con attributi rilevanti.

Tono: professionale ma accessibile, orientato all'azione e alla lead generation.`,
            temperature: 0.25
        });

        return object;
    }

    /**
     * Format site structure into a context block for the LLM prompt.
     * Provides the LLM with awareness of existing pages, posts, categories,
     * products and GSC-derived keyword opportunities.
     */
    private static formatSiteStructureForPrompt(siteStructure?: SiteStructure | null): string {
        if (!siteStructure) return '';

        const parts: string[] = ['\n=== STRUTTURA SITO ATTUALE ==='];

        if (siteStructure.siteInfo?.name) {
            parts.push(`Sito: ${sanitizeConfig(siteStructure.siteInfo.name, 200)}${siteStructure.siteInfo.url ? ` (${sanitizeConfig(siteStructure.siteInfo.url, 200)})` : ''}`);
            if (siteStructure.siteInfo.language) {
                parts.push(`Lingua: ${sanitizeConfig(siteStructure.siteInfo.language, 20)}`);
            }
        }

        if (siteStructure.categories.length > 0) {
            parts.push(`\nCATEGORIE ESISTENTI (usa questi nomi esatti per "categories"):`);
            for (const cat of siteStructure.categories.slice(0, 20)) {
                parts.push(`- ${sanitizeConfig(cat.name, 200)} (slug: ${sanitizeConfig(cat.slug, 100)}${cat.count ? `, ${cat.count} post` : ''})`);
            }
        }

        if (siteStructure.tags.length > 0) {
            parts.push(`\nTAG ESISTENTI:`);
            for (const tag of siteStructure.tags.slice(0, 30)) {
                parts.push(`- ${sanitizeConfig(tag.name, 200)}`);
            }
        }

        if (siteStructure.pages.length > 0) {
            parts.push(`\nPAGINE ESISTENTI (${siteStructure.pages.length} totali):`);
            for (const page of siteStructure.pages.slice(0, 15)) {
                parts.push(`- "${sanitizeConfig(page.title, 300)}" (/${sanitizeConfig(page.slug, 100)})`);
            }
            if (siteStructure.pages.length > 15) {
                parts.push(`  ... e altre ${siteStructure.pages.length - 15} pagine`);
            }
        }

        if (siteStructure.posts.length > 0) {
            parts.push(`\nPOST BLOG ESISTENTI (${siteStructure.posts.length} totali):`);
            for (const post of siteStructure.posts.slice(0, 10)) {
                parts.push(`- "${sanitizeConfig(post.title, 300)}" (/${sanitizeConfig(post.slug, 100)})`);
            }
            if (siteStructure.posts.length > 10) {
                parts.push(`  ... e altri ${siteStructure.posts.length - 10} post`);
            }
        }

        if (siteStructure.products && siteStructure.products.length > 0) {
            parts.push(`\nPRODOTTI WOOCOMMERCE (${siteStructure.products.length} totali):`);
            for (const product of siteStructure.products.slice(0, 15)) {
                parts.push(`- "${sanitizeConfig(product.name, 300)}" (slug: ${sanitizeConfig(product.slug, 100)}${product.sku ? `, SKU: ${sanitizeConfig(product.sku, 50)}` : ''}${product.price ? `, €${product.price}` : ''})`);
            }
            if (siteStructure.products.length > 15) {
                parts.push(`  ... e altri ${siteStructure.products.length - 15} prodotti`);
            }
        }

        if (siteStructure.productCategories && siteStructure.productCategories.length > 0) {
            parts.push(`\nCATEGORIE PRODOTTO WOOCOMMERCE:`);
            for (const cat of siteStructure.productCategories.slice(0, 15)) {
                parts.push(`- ${sanitizeConfig(cat.name, 200)} (slug: ${sanitizeConfig(cat.slug, 100)})`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Build LinkedIn B2B-specific content instructions block.
     * Injected into the LLM prompt when channels contain LinkedIn content kinds.
     */
    private static buildLinkedInBlock(channels?: string[]): string {
        if (!channels?.length) return '';

        const hasArticle = channels.includes('LINKEDIN_ARTICLE');
        const hasCarousel = channels.includes('LINKEDIN_CAROUSEL');
        const hasNewsletter = channels.includes('LINKEDIN_NEWSLETTER');
        const hasPoll = channels.includes('LINKEDIN_POLL');

        if (!hasArticle && !hasCarousel && !hasNewsletter && !hasPoll) return '';

        const parts: string[] = ['\n=== FORMATO LINKEDIN B2B ==='];
        parts.push('Il contenuto è destinato a LinkedIn. Imposta targetSection="social".');

        if (hasArticle) {
            parts.push(`LINKEDIN_ARTICLE — Articolo long-form (800-1500 parole):
- Apertura con hook narrativo (problema reale del target B2B)
- 3-5 sezioni H2 con insight concreti e dati
- Conclusione con call-to-action verso il sito
- Tono: thought leadership professionale, prima persona`);
        }
        if (hasCarousel) {
            parts.push(`LINKEDIN_CAROUSEL — Documento PDF a slide (8-12 slide):
- Slide 1 (hook): titolo provocatorio + promessa di valore
- Slide 2-3: problema/contesto con dato numerico
- Slide 4-9: insight actionable, uno per slide, titolo breve + 2-3 bullet
- Slide 10-11: caso studio o esempio pratico
- Slide 12 (CTA): link al sito, follow, commento
- Nel body: struttura ogni slide come "### Slide N: [titolo]\\n[contenuto]"`);
        }
        if (hasNewsletter) {
            parts.push(`LINKEDIN_NEWSLETTER — Newsletter editoriale:
- Oggetto: max 60 caratteri, curioso e specifico
- Intro: hook con domanda o dato sorprendente (2-3 righe)
- Corpo: 3 sezioni con H2, insight pratici per decision maker
- Sezione "Da non perdere": 2-3 link di valore
- Footer: CTA per iscriversi alla newsletter o al sito`);
        }
        if (hasPoll) {
            parts.push(`LINKEDIN_POLL — Sondaggio a risposta multipla:
- Domanda principale: max 140 caratteri, provocatoria o rivelativa
- 2-4 opzioni di risposta (bilanciate, non leading)
- Nel body: includi la domanda e le opzioni come lista Markdown
- Aggiungi 3-5 righe di contesto per stimolare il commento
- Hashtag: 3-5 hashtag settoriali rilevanti`);
        }

        return parts.join('\n') + '\n';
    }

    /**
     * Get schema.org generation instructions based on content type and capabilities.
     */
    private static getSchemaOrgInstructions(
        type: CMSSuggestionType,
        capabilities?: { hasWooCommerce: boolean }
    ): string {
        const schemaExamples: Record<string, string> = {
            CREATE_FAQ: `Per FAQ, genera schema FAQPage:
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"...","acceptedAnswer":{"@type":"Answer","text":"..."}}]}`,
            CREATE_BLOG_POST: `Per blog post/news, genera schema Article o BlogPosting:
{"@context":"https://schema.org","@type":"BlogPosting","headline":"...","description":"...","author":{"@type":"Organization","name":"..."},"datePublished":"..."}`,
            CREATE_PAGE: `Per pagine informative, genera schema WebPage con breadcrumb:
{"@context":"https://schema.org","@type":"WebPage","name":"...","description":"...","breadcrumb":{"@type":"BreadcrumbList","itemListElement":[...]}}`,
            MODIFY_CONTENT: `Per modifiche SEO, genera lo schema appropriato per il tipo di contenuto (Article, Product, FAQPage, WebPage).`,
            ADD_SECTION: `Per nuove sezioni, genera schema WebPage o aggiorna lo schema esistente.`
        };

        let instructions = `\n=== SCHEMA.ORG SPECIFICO ===\n${schemaExamples[type] || schemaExamples.CREATE_PAGE}`;

        if (capabilities?.hasWooCommerce) {
            instructions += `\nPer prodotti WooCommerce, genera schema Product:
{"@context":"https://schema.org","@type":"Product","name":"...","description":"...","sku":"...","offers":{"@type":"Offer","price":"...","priceCurrency":"EUR","availability":"https://schema.org/InStock"},"brand":{"@type":"Brand","name":"..."}}`;
        }

        return instructions;
    }

    /**
     * Extract SEO-related fields from generated content into a separate seoData object
     * for storage in CMSSuggestion.seoData and later use during publishing.
     */
    private static buildSeoData(content: z.infer<typeof ContentSchema>): Record<string, unknown> | null {
        const hasAnyField = content.schemaMarkup || content.seoFields || content.categories?.length
            || content.tags?.length || content.imageAltText || content.productAttributes;

        if (!hasAnyField) return null;

        return {
            ...(content.schemaMarkup ? { schemaMarkup: content.schemaMarkup } : {}),
            ...(content.seoFields ? { seoFields: content.seoFields } : {}),
            ...(content.categories?.length ? { categories: content.categories } : {}),
            ...(content.tags?.length ? { tags: content.tags } : {}),
            ...(content.imageAltText ? { imageAltText: content.imageAltText } : {}),
            ...(content.productAttributes ? { productAttributes: content.productAttributes } : {}),
        };
    }

    /**
     * Format signals into a readable summary for the LLM prompt.
     */
    private static formatSignalsForPrompt(signals: SuggestionInput['signals']): string {
        const parts: string[] = [];

        if (signals.chatbotQuestions?.length) {
            parts.push('DOMANDE FREQUENTI CHATBOT:');
            for (const q of signals.chatbotQuestions.slice(0, 6)) {
                parts.push(`- "${sanitize(q.question, 300)}" (${q.count} volte)`);
            }
        }

        if (signals.visibilityGaps?.length) {
            parts.push('GAP DI VISIBILITA:');
            for (const g of signals.visibilityGaps.slice(0, 5)) {
                parts.push(`- Topic: ${sanitizeConfig(g.topic, 200)} | Competitor presenti: ${g.competitors.map(c => sanitizeConfig(c, 100)).join(', ')}`);
            }
        }

        if (signals.lowPerformingPages?.length) {
            parts.push('PAGINE CON ALTO BOUNCE RATE:');
            for (const p of signals.lowPerformingPages.slice(0, 5)) {
                parts.push(`- ${p.path} | Bounce: ${(p.bounceRate * 100).toFixed(1)}% | Views: ${p.views}`);
            }
        }

        if (signals.searchQueries?.length) {
            parts.push('QUERY SEARCH CONSOLE:');
            for (const q of signals.searchQueries.slice(0, 6)) {
                parts.push(`- "${sanitize(q.query, 200)}" | Impressioni: ${q.impressions} | Posizione: ${q.position.toFixed(1)} | Click: ${q.clicks}`);
            }
        }

        if (signals.interviewFeedback?.length) {
            parts.push('FEEDBACK DALLE INTERVISTE:');
            for (const f of signals.interviewFeedback.slice(0, 4)) {
                parts.push(`- Topic: ${sanitizeConfig(f.topic, 200)} | Sentiment: ${f.sentiment}`);
                if (f.quotes.length > 0) {
                    parts.push(`  Quote: "${sanitize(f.quotes[0], 300)}"`);
                }
            }
        }

        if (signals.aiTips?.length) {
            parts.push('AI TIPS CORRELATI:');
            for (const tip of signals.aiTips.slice(0, 5)) {
                parts.push(`- [${sanitizeConfig(tip.source, 50)}] ${sanitize(tip.title, 200)}${typeof tip.priority === 'number' ? ` (priorita ${tip.priority})` : ''}`);
            }
        }

        if (signals.strategyAlignment) {
            parts.push(`ALLINEAMENTO STRATEGICO RICHIESTO: ${sanitizeConfig(signals.strategyAlignment, 500)}`);
        }

        if (signals.channels?.length) {
            parts.push(`CANALI DATI DISPONIBILI: ${signals.channels.join(', ')}`);
        }

        if (signals.validation?.matchTitle) {
            parts.push(`CONTENUTO SIMILE ESISTENTE: ${sanitizeConfig(signals.validation.matchTitle, 200)} (score ${signals.validation.score || 'n/d'})`);
        }

        return parts.join('\n') || 'Nessun segnale dettagliato disponibile.';
    }

    /**
     * Calculate priority score (0-100) based on signal strength.
     */
    private static calculatePriorityScore(signals: SuggestionInput['signals']): number {
        let score = 30;

        if (signals.chatbotQuestions?.length) {
            const totalQuestions = signals.chatbotQuestions.reduce((sum, q) => sum + q.count, 0);
            score += Math.min(totalQuestions / 5, 20);
        }

        if (signals.visibilityGaps?.length) {
            score += Math.min(signals.visibilityGaps.length * 6, 24);
        }

        if (signals.lowPerformingPages?.length) {
            const avgBounce = signals.lowPerformingPages.reduce((sum, p) => sum + p.bounceRate, 0) / signals.lowPerformingPages.length;
            if (avgBounce > 0.7) score += 15;
            else if (avgBounce > 0.5) score += 10;
        }

        if (signals.searchQueries?.length) {
            const improvableQueries = signals.searchQueries.filter(q => q.position > 10 && q.impressions > 50);
            score += Math.min(improvableQueries.length * 3, 15);
        }

        if (signals.interviewFeedback?.length) {
            const negativeFeedback = signals.interviewFeedback.filter(f => f.sentiment === 'negative');
            score += Math.min(negativeFeedback.length * 5, 15);
        }

        if (signals.aiTips?.length) {
            score += Math.min(signals.aiTips.length * 2, 8);
        }

        return Math.min(Math.max(Math.round(score), 0), 100);
    }

    /**
     * Generate suggestions from a CrossChannelInsight that has create_content or modify_content actions.
     */
    static async generateFromInsight(insightId: string): Promise<string[]> {
        const insight = await prisma.crossChannelInsight.findUnique({
            where: { id: insightId },
            include: {
                organization: {
                    select: {
                        id: true,
                        platformSettings: {
                            select: {
                                strategicPlan: true
                            }
                        }
                    }
                }
            }
        });

        if (!insight) {
            return [];
        }

        const projects = await prisma.project.findMany({
            where: {
                organizationId: insight.organizationId,
                ...(insight.projectId ? { id: insight.projectId } : {})
            },
            include: {
                cmsConnection: true,
                newCmsConnection: true,
                cmsShares: {
                    include: {
                        connection: true
                    }
                }
            } as any
        });

        const projectsWithCMS = projects.filter((project: any) =>
            Boolean(project.newCmsConnection || project.cmsConnection || project.cmsShares?.[0]?.connection)
        );

        if (projectsWithCMS.length === 0) {
            return [];
        }

        const actions = Array.isArray(insight.suggestedActions) ? insight.suggestedActions as any[] : [];
        const contentActions = actions.filter((action: any) =>
            action?.type === 'create_content'
            || action?.type === 'modify_content'
            || action?.target === 'website'
            || action?.target === 'product'
            || action?.target === 'marketing'
        );

        if (contentActions.length === 0) {
            return [];
        }

        const suggestionIds: string[] = [];

        for (const project of projectsWithCMS) {
            const connection = (project as any).newCmsConnection
                || (project as any).cmsConnection
                || (project as any).cmsShares?.[0]?.connection;

            if (!connection?.id) continue;

            for (const action of contentActions) {
                const type = this.mapActionTypeToSuggestionType(action);
                const signals = this.extractSignalsFromInsight(insight, action);

                const suggestionId = await this.generateSuggestion({
                    connectionId: connection.id,
                    insightId,
                    projectId: project.id,
                    type,
                    action,
                    strategicPlan: insight.organization?.platformSettings?.strategicPlan || null,
                    signals
                });

                suggestionIds.push(suggestionId);
            }
        }

        return suggestionIds;
    }

    /**
     * Map CrossChannel action type to CMSSuggestionType.
     */
    private static mapActionTypeToSuggestionType(action: any): CMSSuggestionType {
        const target = (action.target || '').toLowerCase();
        const title = (action.title || '').toLowerCase();

        if (title.includes('faq') || title.includes('domanda')) {
            return 'CREATE_FAQ';
        }
        if (title.includes('blog') || title.includes('articolo') || title.includes('news') || title.includes('social')) {
            return 'CREATE_BLOG_POST';
        }
        if (action.type === 'modify_content' || title.includes('schema') || title.includes('seo') || target === 'product') {
            return 'MODIFY_CONTENT';
        }
        if (title.includes('sezione')) {
            return 'ADD_SECTION';
        }

        return 'CREATE_PAGE';
    }

    /**
     * Extract signals from CrossChannelInsight data.
     */
    private static extractSignalsFromInsight(insight: any, action: any): SuggestionInput['signals'] {
        const signals: SuggestionInput['signals'] = {};
        const channels = new Set<string>();

        if (insight.chatbotData) {
            channels.add('chatbot');
            const chatbotData = insight.chatbotData as any;

            if (Array.isArray(chatbotData.gaps)) {
                signals.chatbotQuestions = chatbotData.gaps.map((g: any) => ({
                    question: g.topic || g.question,
                    count: g.count || 1
                }));
            }
        }

        if (insight.visibilityData) {
            channels.add('visibility');
            const visibilityData = insight.visibilityData as any;

            if (Array.isArray(visibilityData.visibilitySummary)) {
                const competitors = visibilityData.visibilitySummary
                    .flatMap((item: any) => Array.isArray(item?.competitors) ? item.competitors : [])
                    .map((c: any) => typeof c === 'string' ? c : c?.name)
                    .filter((value: any) => typeof value === 'string' && value.trim().length > 0);

                if (competitors.length > 0) {
                    const uniqueCompetitors = Array.from(new Set(competitors)) as string[];
                    signals.visibilityGaps = [{
                        topic: insight.topicName,
                        competitors: uniqueCompetitors.slice(0, 6)
                    }];
                }
            }

            const analytics = visibilityData.websiteAnalytics;
            if (analytics) {
                channels.add('analytics');
                if (Array.isArray(analytics.lowPerformingPages)) {
                    signals.lowPerformingPages = analytics.lowPerformingPages.slice(0, 6).map((p: any) => ({
                        path: p.path || p.page || p.url || 'unknown',
                        bounceRate: Number(p.bounceRate || 0),
                        views: Number(p.views || p.pageviews || 0)
                    }));
                }
                if (Array.isArray(analytics.searchQueries)) {
                    signals.searchQueries = analytics.searchQueries.slice(0, 8).map((q: any) => ({
                        query: q.query || q.keyword || '',
                        impressions: Number(q.impressions || 0),
                        position: Number(q.position || q.avgPosition || 0),
                        clicks: Number(q.clicks || 0)
                    }));
                }
            }
        }

        if (insight.interviewData) {
            channels.add('interviews');
            const interviewData = insight.interviewData as any[];
            if (Array.isArray(interviewData)) {
                signals.interviewFeedback = interviewData.slice(0, 5).map((i: any) => ({
                    topic: i.themes?.[0] || i.topic || insight.topicName,
                    sentiment: i.sentiment?.overall || i.sentiment || 'neutral',
                    quotes: Array.isArray(i.quotes) ? i.quotes : []
                }));
            }
        }

        if (action?.reasoning) {
            signals.aiTips = [{
                source: action.target || 'cross-channel',
                title: action.title || insight.topicName,
                priority: typeof insight.priorityScore === 'number' ? insight.priorityScore : undefined
            }];
        }

        if (action?.validation && typeof action.validation === 'object') {
            signals.validation = action.validation;
        }

        signals.strategyAlignment = typeof action?.reasoning === 'string' ? action.reasoning : undefined;
        signals.channels = Array.from(channels);
        signals.evidencePoints = [
            typeof insight.priorityScore === 'number' ? `priority_score=${insight.priorityScore}` : null,
            Array.isArray(signals.searchQueries) ? `search_queries=${signals.searchQueries.length}` : null,
            Array.isArray(signals.chatbotQuestions) ? `chatbot_questions=${signals.chatbotQuestions.length}` : null,
            Array.isArray(signals.interviewFeedback) ? `interview_feedback=${signals.interviewFeedback.length}` : null
        ].filter((value): value is string => Boolean(value));

        return signals;
    }
}
