export type CopilotToolName =
    | 'searchPlatformHelp'
    | 'getAccountUsage'
    | 'getStrategicKnowledge'
    | 'getProjectTranscripts'
    | 'getChatbotConversations'
    | 'getProjectIntegrations'
    | 'getVisibilityInsights'
    | 'getProjectAiTips'
    | 'getExternalAnalytics'
    | 'getKnowledgeBase'
    | 'scrapeWebSource'
    | 'createStrategicTip'
    | 'manageTipRouting'
    | 'manageCanonicalTips'
    | 'manageProjectConnections'
    | 'getCompetitorIntelligence'
    | 'analyzeSeoGeoAeo';

export type CopilotIntentArea =
    | 'usage'
    | 'support'
    | 'connections'
    | 'tips'
    | 'analytics'
    | 'visibility'
    | 'knowledge'
    | 'competitive'
    | 'seo'
    | 'general';

export type CopilotIntentProfile = {
    primaryArea: CopilotIntentArea;
    areas: CopilotIntentArea[];
    kbCategory: string;
    prefetchKb: boolean;
    maxSteps: number;
    needsOperationalExecution: boolean;
};

export type CopilotHistoryMessage = {
    role: 'user' | 'assistant';
    content: string;
    toolsUsed?: string[];
};

function hasAny(text: string, fragments: string[]): boolean {
    return fragments.some((fragment) => text.includes(fragment));
}

function compactText(text: string, maxChars: number): string {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= maxChars) return compact;
    return `${compact.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

export function isLowSignalUserMessage(text: string): boolean {
    const normalized = String(text || '').toLowerCase().trim();
    if (!normalized) return true;

    const compact = normalized.replace(/[!?.,;:]/g, '').trim();
    const lowSignalSet = new Set([
        'ok',
        'va bene',
        'perfetto',
        'grazie',
        'si',
        'sì',
        'si grazie',
        'sì grazie',
        'ottimo',
        'chiaro',
        'capito',
        'yes',
        'ok grazie'
    ]);
    if (lowSignalSet.has(compact)) return true;

    const words = compact.split(/\s+/).filter(Boolean);
    return words.length <= 2 && compact.length <= 14;
}

export function isGoogleAnalyticsIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    const mentionsGoogleAnalytics =
        /\bga4\b/.test(normalized) ||
        /\bga\b/.test(normalized) ||
        /\bgsc\b/.test(normalized) ||
        normalized.includes('google analytics') ||
        normalized.includes('search console');
    return (
        mentionsGoogleAnalytics &&
        hasAny(normalized, ['connet', 'integra', 'collega', 'setup', 'configura', 'verifica', 'test'])
    );
}

export function isConnectionsIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return (
        hasAny(normalized, [
            'connession',
            'integrazion',
            'collegament',
            'wordpress',
            'woocommerce',
            'mcp',
            'cms',
            'webhook',
            'n8n',
            'routing'
        ]) || isGoogleAnalyticsIntent(normalized)
    );
}

export function isConnectionFlowContext(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return (
        isConnectionsIntent(normalized) ||
        normalized.includes('google analytics') ||
        /\bga4\b/.test(normalized) ||
        /\bga\b/.test(normalized) ||
        /\bgsc\b/.test(normalized) ||
        normalized.includes('search console')
    );
}

export function isConnectionTestIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, ['test', 'verifica', 'controlla', 'stato', 'diagnostica']);
}

export function isDocsIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        'come funziona',
        'cos',
        'piano',
        'limiti',
        'prezzo',
        'credito',
        'documentazione',
        'guida',
        'tutorial',
        'supporto'
    ]);
}

export function isUsageIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        'utilizzo',
        'credit',
        'consumo',
        'spesa',
        'costo',
        'piano attuale',
        'limite',
        'quota',
        'billing'
    ]);
}

export function isTipsIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        ' tip',
        'tips',
        'ai tip',
        'crea tip',
        'modifica tip',
        'aggiorna tip',
        'canonical',
        'routing',
        'bozza',
        'draft',
        'execute',
        'esegui'
    ]);
}

export function isAnalyticsIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        'analisi',
        'dati',
        'trend',
        'metrica',
        'metriche',
        'tema',
        'temi',
        'insight',
        'riassumi',
        'conversaz',
        'trascritt',
        'intervist',
        'sentiment',
        'knowledge gap',
        'quote'
    ]);
}

export function isVisibilityIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        'visibility',
        'brand monitor',
        'serp',
        'prompt monitor',
        'website analysis',
        'llm visibility'
    ]);
}

export function isKnowledgeIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, [
        'knowledge base',
        'kb',
        'scrape',
        'sitemap',
        'url',
        'faq',
        'fonte',
        'contenuto'
    ]);
}

export function isCompetitiveIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, ['competitor', 'concorrent', 'battlecard', 'benchmark']);
}

export function isSeoIntent(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return hasAny(normalized, ['seo', 'geo', 'aeo', 'featured snippet', 'citation', 'llmo']);
}

export function isConnectionNonAnswer(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    if (!normalized.trim()) return true;
    return hasAny(normalized, [
        'prima di tutto',
        'verifico lo stato',
        'ti aiuto a configurare',
        'posso aiutarti su questo tema',
        'se vuoi, posso'
    ]);
}

export function detectCopilotIntent(message: string): CopilotIntentProfile {
    const normalized = String(message || '').toLowerCase().trim();
    const areas: CopilotIntentArea[] = [];

    if (isUsageIntent(normalized)) areas.push('usage');
    if (isConnectionsIntent(normalized)) areas.push('connections');
    if (isTipsIntent(normalized)) areas.push('tips');
    if (isVisibilityIntent(normalized)) areas.push('visibility');
    if (isCompetitiveIntent(normalized)) areas.push('competitive');
    if (isSeoIntent(normalized)) areas.push('seo');
    if (isKnowledgeIntent(normalized)) areas.push('knowledge');
    if (isAnalyticsIntent(normalized)) areas.push('analytics');
    if (areas.length === 0 && isDocsIntent(normalized)) areas.push('support');
    if (areas.length === 0) areas.push('general');

    const primaryArea = areas[0];
    const prefetchKb = primaryArea === 'usage' || primaryArea === 'support' || primaryArea === 'general';

    const kbCategoryByArea: Record<CopilotIntentArea, string> = {
        usage: 'account',
        support: 'troubleshooting',
        connections: 'copilot',
        tips: 'copilot',
        analytics: 'copilot',
        visibility: 'visibility',
        knowledge: 'chatbot',
        competitive: 'visibility',
        seo: 'visibility',
        general: 'all'
    };

    const maxStepsByArea: Record<CopilotIntentArea, number> = {
        usage: 2,
        support: 2,
        connections: 5,
        tips: 5,
        analytics: 4,
        visibility: 4,
        knowledge: 4,
        competitive: 4,
        seo: 4,
        general: 3
    };

    return {
        primaryArea,
        areas,
        kbCategory: kbCategoryByArea[primaryArea],
        prefetchKb,
        maxSteps: maxStepsByArea[primaryArea],
        needsOperationalExecution: primaryArea === 'connections' || primaryArea === 'tips'
    };
}

const TOOLS_BY_AREA: Record<CopilotIntentArea, CopilotToolName[]> = {
    usage: ['getAccountUsage', 'searchPlatformHelp'],
    support: ['searchPlatformHelp', 'getAccountUsage'],
    connections: ['getProjectIntegrations', 'manageProjectConnections', 'manageTipRouting', 'manageCanonicalTips'],
    tips: ['getProjectAiTips', 'manageCanonicalTips', 'createStrategicTip', 'manageTipRouting', 'getStrategicKnowledge'],
    analytics: ['getProjectTranscripts', 'getChatbotConversations', 'getVisibilityInsights', 'getExternalAnalytics', 'getProjectAiTips', 'getStrategicKnowledge'],
    visibility: ['getVisibilityInsights', 'getExternalAnalytics', 'getCompetitorIntelligence', 'analyzeSeoGeoAeo', 'getStrategicKnowledge'],
    knowledge: ['getKnowledgeBase', 'scrapeWebSource', 'getProjectAiTips', 'getStrategicKnowledge'],
    competitive: ['getCompetitorIntelligence', 'analyzeSeoGeoAeo', 'getExternalAnalytics', 'getVisibilityInsights'],
    seo: ['analyzeSeoGeoAeo', 'getExternalAnalytics', 'getVisibilityInsights', 'getCompetitorIntelligence'],
    general: ['searchPlatformHelp', 'getAccountUsage', 'getStrategicKnowledge']
};

export function selectCopilotToolNames(
    profile: CopilotIntentProfile,
    hasProjectAccess: boolean
): CopilotToolName[] {
    const selected = new Set<CopilotToolName>(['searchPlatformHelp', 'getAccountUsage']);

    if (!hasProjectAccess) {
        return Array.from(selected);
    }

    if (profile.primaryArea !== 'usage' && profile.primaryArea !== 'support') {
        selected.add('getStrategicKnowledge');
    }

    for (const area of profile.areas) {
        for (const toolName of TOOLS_BY_AREA[area]) {
            selected.add(toolName);
        }
    }

    return Array.from(selected).slice(0, 8);
}

export function buildCondensedConversationHistory(
    messages: CopilotHistoryMessage[],
    options?: { maxRecentMessages?: number }
): {
    recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    summary: string | null;
} {
    const maxRecentMessages = Math.max(2, Math.min(options?.maxRecentMessages ?? 6, 10));
    const normalized = messages
        .map((message) => ({
            role: message.role,
            content: String(message.content || '').trim(),
            toolsUsed: Array.isArray(message.toolsUsed) ? message.toolsUsed : []
        }))
        .filter((message) => message.content.length > 0);

    const recentMessages = normalized.slice(-maxRecentMessages).map((message) => ({
        role: message.role,
        content: message.content
    }));

    const olderMessages = normalized.slice(0, -maxRecentMessages);
    if (olderMessages.length === 0) {
        return { recentMessages, summary: null };
    }

    const olderUserRequests = Array.from(new Set(
        olderMessages
            .filter((message) => message.role === 'user' && !isLowSignalUserMessage(message.content))
            .map((message) => compactText(message.content, 180))
    )).slice(-4);

    const olderAssistantOutcomes = olderMessages
        .filter((message) => message.role === 'assistant')
        .map((message) => {
            const toolPrefix = message.toolsUsed.length > 0
                ? `[${message.toolsUsed.slice(0, 3).join(', ')}] `
                : '';
            return compactText(`${toolPrefix}${message.content}`, 180);
        })
        .filter(Boolean)
        .slice(-4);

    const sections: string[] = [];
    if (olderUserRequests.length > 0) {
        sections.push(`Richieste precedenti rilevanti:\n- ${olderUserRequests.join('\n- ')}`);
    }
    if (olderAssistantOutcomes.length > 0) {
        sections.push(`Risposte o azioni gia fornite:\n- ${olderAssistantOutcomes.join('\n- ')}`);
    }

    if (sections.length === 0) {
        return { recentMessages, summary: null };
    }

    return {
        recentMessages,
        summary: compactText(sections.join('\n\n'), 1400)
    };
}
