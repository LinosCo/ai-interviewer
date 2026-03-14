export function getNextMissingCandidateField(
    candidateFieldIds: string[],
    currentProfile: Record<string, unknown>,
    fieldAttemptCounts: Record<string, number> | undefined,
    maxAttempts: number = 3
): string | null {
    for (const fieldName of candidateFieldIds) {
        const attempts = fieldAttemptCounts?.[fieldName] || 0;
        const value = currentProfile[fieldName];
        const normalizedValue = typeof value === 'string' ? value.trim() : value;
        const isSkipped = normalizedValue === '__SKIPPED__';
        const isCollected = normalizedValue !== null && normalizedValue !== undefined && normalizedValue !== '';
        const exceededAttempts = attempts >= maxAttempts;

        if (isCollected || isSkipped || exceededAttempts) continue;
        return fieldName;
    }
    return null;
}

export function isConsentPendingForDataCollection(params: {
    shouldCollectData: boolean;
    candidateFieldIds: string[];
    consentGiven: boolean | null;
    dataCollectionRefused?: boolean;
}): boolean {
    const { shouldCollectData, candidateFieldIds, consentGiven, dataCollectionRefused } = params;
    if (!shouldCollectData) return false;
    if (candidateFieldIds.length === 0) return false;
    if (dataCollectionRefused) return false;
    return consentGiven !== true;
}

export function getFieldLabel(field: string, lang: string): string {
    void lang;
    return String(field || '').trim();
}
