const COPILOT_STORAGE_VERSION = 'v2';
const COPILOT_STORAGE_PREFIX = `bt-copilot-conversation:${COPILOT_STORAGE_VERSION}`;

export function getCopilotConversationStorageKey(
    organizationId?: string | null,
    projectId?: string | null
): string {
    const organizationScope = organizationId || 'no-org';
    const projectScope = projectId || '__ALL__';
    return `${COPILOT_STORAGE_PREFIX}:${organizationScope}:${projectScope}`;
}
