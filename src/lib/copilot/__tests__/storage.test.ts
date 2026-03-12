import { describe, expect, it } from 'vitest';

import { getCopilotConversationStorageKey } from '@/lib/copilot/storage';

describe('copilot storage key', () => {
  it('scopes conversation storage by organization and project', () => {
    const key = getCopilotConversationStorageKey('org-1', 'project-1');

    expect(key).toBe('bt-copilot-conversation:v2:org-1:project-1');
  });

  it('uses multi-project fallback scope when project is missing', () => {
    const key = getCopilotConversationStorageKey('org-1', null);

    expect(key).toBe('bt-copilot-conversation:v2:org-1:__ALL__');
  });
});
