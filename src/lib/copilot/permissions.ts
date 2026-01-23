// Tiers that have access to project data analysis via Copilot
const TIERS_WITH_PROJECT_ACCESS = ['PRO', 'BUSINESS', 'ENTERPRISE', 'ADMIN', 'PARTNER'];

/**
 * Check if a subscription tier allows access to project data via Copilot
 * Free/Trial/Starter users can only use platform support features
 * Pro+ users can access project data exploration and content generation
 */
export function canAccessProjectData(tier: string): boolean {
    return TIERS_WITH_PROJECT_ACCESS.includes(tier.toUpperCase());
}

/**
 * Get the feature set available for a given tier
 */
export function getCopilotFeatures(tier: string) {
    const hasProjectAccess = canAccessProjectData(tier);

    return {
        // Available to all users
        platformSupport: true,
        searchPlatformHelp: true,
        getPlanInfo: true,
        getCurrentUsage: true,

        // Pro+ only features
        searchConversations: hasProjectAccess,
        getQuotes: hasProjectAccess,
        getProjectStats: hasProjectAccess,
        getKnowledgeGaps: hasProjectAccess,
        generateContent: hasProjectAccess,
        compareSegments: hasProjectAccess,
    };
}
