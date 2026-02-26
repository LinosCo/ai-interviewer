import { prisma } from '@/lib/prisma';
import { CMSSuggestionType, MCPConnectionType } from '@prisma/client';

export type PublishChannel = 'CMS_API' | 'WORDPRESS_MCP' | 'WOOCOMMERCE_MCP' | 'MANUAL';
export type ContentKind =
    | 'STATIC_PAGE'
    | 'BLOG_POST'
    | 'NEWS_ARTICLE'
    | 'FAQ_PAGE'
    | 'SCHEMA_PATCH'
    | 'SEO_PATCH'
    | 'SOCIAL_POST'
    | 'PRODUCT_DESCRIPTION';
export type ContentMode = 'STATIC' | 'DYNAMIC';

export interface PublishCapabilities {
    hasCmsApi: boolean;
    hasWordPress: boolean;
    hasWooCommerce: boolean;
    hasGoogleAnalytics: boolean;
    hasSearchConsole: boolean;
    wordPressConnectionId?: string;
    wooCommerceConnectionId?: string;
}

export interface PublicationRouting {
    publishChannel: PublishChannel;
    contentKind: ContentKind;
    contentMode: ContentMode;
    wpPostType?: 'page' | 'post';
    targetSection?: string;
    targetEntityType?: 'product';
    targetEntityId?: string;
    targetEntitySlug?: string;
    // Enhanced publishing fields
    wpCategories?: string[];
    wpTags?: string[];
    wpExistingPostId?: number;
    wpExistingPageId?: number;
    wooProductId?: number;
    wooProductCategories?: string[];
}

export interface PublishOption {
    channel: PublishChannel;
    label: string;
    available: boolean;
    reason?: string;
}

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function defaultKindForSuggestionType(type: CMSSuggestionType): ContentKind {
    switch (type) {
        case 'CREATE_FAQ':
            return 'FAQ_PAGE';
        case 'CREATE_BLOG_POST':
            return 'BLOG_POST';
        case 'MODIFY_CONTENT':
            return 'SEO_PATCH';
        case 'ADD_SECTION':
            return 'STATIC_PAGE';
        case 'CREATE_PAGE':
        default:
            return 'STATIC_PAGE';
    }
}

export function inferContentKind(params: {
    suggestionType: CMSSuggestionType;
    tipType?: string;
    targetSection?: string;
    title?: string;
}): ContentKind {
    const tipType = (params.tipType || '').toLowerCase();
    const targetSection = (params.targetSection || '').toLowerCase();
    const title = (params.title || '').toLowerCase();

    if (tipType === 'add_structured_data' || title.includes('schema.org') || title.includes('structured data')) {
        return 'SCHEMA_PATCH';
    }

    if (
        tipType === 'improve_meta' ||
        tipType === 'add_keyword_content' ||
        title.includes('seo') ||
        title.includes('meta')
    ) {
        return 'SEO_PATCH';
    }

    if (tipType === 'social_post' || title.includes('social') || title.includes('linkedin') || title.includes('instagram')) {
        return 'SOCIAL_POST';
    }

    if (
        targetSection === 'products' ||
        targetSection === 'shop' ||
        title.includes('prodotto') ||
        title.includes('product')
    ) {
        return 'PRODUCT_DESCRIPTION';
    }

    if (targetSection === 'news' || title.includes('news')) {
        return 'NEWS_ARTICLE';
    }

    if (params.suggestionType === 'CREATE_FAQ' || targetSection === 'faq') {
        return 'FAQ_PAGE';
    }

    if (params.suggestionType === 'CREATE_BLOG_POST' || targetSection === 'blog') {
        return 'BLOG_POST';
    }

    return defaultKindForSuggestionType(params.suggestionType);
}

function defaultModeForKind(kind: ContentKind): ContentMode {
    if (kind === 'STATIC_PAGE' || kind === 'FAQ_PAGE' || kind === 'SCHEMA_PATCH' || kind === 'SEO_PATCH') {
        return 'STATIC';
    }
    return 'DYNAMIC';
}

function isChannelAvailable(channel: PublishChannel, caps: PublishCapabilities): boolean {
    if (channel === 'CMS_API') return caps.hasCmsApi;
    if (channel === 'WORDPRESS_MCP') return caps.hasWordPress;
    if (channel === 'WOOCOMMERCE_MCP') return caps.hasWooCommerce;
    return true;
}

export function defaultPublicationRouting(
    kind: ContentKind,
    caps: PublishCapabilities,
    targetSection?: string
): PublicationRouting {
    let publishChannel: PublishChannel = 'MANUAL';

    if (kind === 'PRODUCT_DESCRIPTION') {
        if (caps.hasWooCommerce) publishChannel = 'WOOCOMMERCE_MCP';
        else if (caps.hasWordPress) publishChannel = 'WORDPRESS_MCP';
        else if (caps.hasCmsApi) publishChannel = 'CMS_API';
    } else if (kind === 'BLOG_POST' || kind === 'NEWS_ARTICLE' || kind === 'SOCIAL_POST') {
        if (caps.hasWordPress) publishChannel = 'WORDPRESS_MCP';
        else if (caps.hasCmsApi) publishChannel = 'CMS_API';
    } else {
        if (caps.hasCmsApi) publishChannel = 'CMS_API';
        else if (caps.hasWordPress) publishChannel = 'WORDPRESS_MCP';
    }

    const contentMode = defaultModeForKind(kind);
    const wpPostType = contentMode === 'STATIC' ? 'page' : 'post';

    return {
        publishChannel,
        contentKind: kind,
        contentMode,
        wpPostType,
        targetSection: normalizeString(targetSection),
        ...(kind === 'PRODUCT_DESCRIPTION' ? { targetEntityType: 'product' as const } : {})
    };
}

export function normalizePublicationRouting(
    rawRouting: unknown,
    fallbackKind: ContentKind,
    caps: PublishCapabilities,
    targetSection?: string
): PublicationRouting {
    const base = defaultPublicationRouting(fallbackKind, caps, targetSection);
    if (!rawRouting || typeof rawRouting !== 'object') return base;

    const raw = rawRouting as Record<string, unknown>;
    const maybeChannel = normalizeString(raw.publishChannel) as PublishChannel | undefined;
    const maybeKind = normalizeString(raw.contentKind) as ContentKind | undefined;
    const maybeMode = normalizeString(raw.contentMode) as ContentMode | undefined;
    const maybePostType = normalizeString(raw.wpPostType) as 'page' | 'post' | undefined;

    const chosenKind = maybeKind || base.contentKind;
    const chosenMode = maybeMode || defaultModeForKind(chosenKind);
    const chosenChannel = maybeChannel && isChannelAvailable(maybeChannel, caps)
        ? maybeChannel
        : defaultPublicationRouting(chosenKind, caps, targetSection).publishChannel;

    // Pass through enhanced publishing fields if present
    const wpCategories = Array.isArray(raw.wpCategories) ? raw.wpCategories as string[] : undefined;
    const wpTags = Array.isArray(raw.wpTags) ? raw.wpTags as string[] : undefined;
    const wpExistingPostId = typeof raw.wpExistingPostId === 'number' ? raw.wpExistingPostId : undefined;
    const wpExistingPageId = typeof raw.wpExistingPageId === 'number' ? raw.wpExistingPageId : undefined;
    const wooProductId = typeof raw.wooProductId === 'number' ? raw.wooProductId : undefined;
    const wooProductCategories = Array.isArray(raw.wooProductCategories) ? raw.wooProductCategories as string[] : undefined;

    return {
        publishChannel: chosenChannel,
        contentKind: chosenKind,
        contentMode: chosenMode,
        wpPostType: maybePostType || (chosenMode === 'STATIC' ? 'page' : 'post'),
        targetSection: normalizeString(raw.targetSection) || normalizeString(targetSection) || base.targetSection,
        targetEntityType: normalizeString(raw.targetEntityType) === 'product' ? 'product' : (base.targetEntityType || undefined),
        targetEntityId: normalizeString(raw.targetEntityId),
        targetEntitySlug: normalizeString(raw.targetEntitySlug),
        ...(wpCategories?.length ? { wpCategories } : {}),
        ...(wpTags?.length ? { wpTags } : {}),
        ...(wpExistingPostId ? { wpExistingPostId } : {}),
        ...(wpExistingPageId ? { wpExistingPageId } : {}),
        ...(wooProductId ? { wooProductId } : {}),
        ...(wooProductCategories?.length ? { wooProductCategories } : {}),
    };
}

export function buildPublishOptions(caps: PublishCapabilities): PublishOption[] {
    return [
        {
            channel: 'CMS_API',
            label: 'CMS integrato',
            available: caps.hasCmsApi,
            reason: caps.hasCmsApi ? undefined : 'Connessione CMS non attiva'
        },
        {
            channel: 'WORDPRESS_MCP',
            label: 'WordPress (MCP)',
            available: caps.hasWordPress,
            reason: caps.hasWordPress ? undefined : 'Connessione WordPress MCP non attiva'
        },
        {
            channel: 'WOOCOMMERCE_MCP',
            label: 'WooCommerce (MCP)',
            available: caps.hasWooCommerce,
            reason: caps.hasWooCommerce ? undefined : 'Connessione WooCommerce MCP non attiva'
        },
        {
            channel: 'MANUAL',
            label: 'Solo bozza manuale',
            available: true
        }
    ];
}

export async function resolvePublishingCapabilities(args: {
    projectId?: string | null;
    hasCmsApi?: boolean;
    hasGoogleAnalytics?: boolean;
    hasSearchConsole?: boolean;
}): Promise<PublishCapabilities> {
    const projectId = args.projectId || null;
    let wordPressConnectionId: string | undefined;
    let wooCommerceConnectionId: string | undefined;

    if (projectId) {
        const mcpConnections = await prisma.mCPConnection.findMany({
            where: {
                status: 'ACTIVE',
                type: { in: ['WORDPRESS', 'WOOCOMMERCE'] as MCPConnectionType[] },
                OR: [
                    { projectId },
                    { projectShares: { some: { projectId } } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true }
        });

        wordPressConnectionId = mcpConnections.find(c => c.type === 'WORDPRESS')?.id;
        wooCommerceConnectionId = mcpConnections.find(c => c.type === 'WOOCOMMERCE')?.id;
    }

    return {
        hasCmsApi: args.hasCmsApi !== false,
        hasWordPress: Boolean(wordPressConnectionId),
        hasWooCommerce: Boolean(wooCommerceConnectionId),
        hasGoogleAnalytics: Boolean(args.hasGoogleAnalytics),
        hasSearchConsole: Boolean(args.hasSearchConsole),
        wordPressConnectionId,
        wooCommerceConnectionId
    };
}
