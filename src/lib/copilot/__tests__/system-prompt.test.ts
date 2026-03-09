import { describe, expect, it } from 'vitest';

import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';

describe('copilot system prompt', () => {
  it('describes canonical tip creation without claiming draft generation', () => {
    const prompt = buildCopilotSystemPrompt({
      userName: 'Tommy',
      organizationName: 'BT',
      tier: 'BUSINESS',
      hasProjectAccess: true,
      projectContext: {
        projectId: 'project-1',
        projectName: 'Project One',
        strategy: null,
        methodologies: [],
        tips: [],
        routingCapabilities: [],
      },
    });

    expect(prompt).toContain('creare il tip canonico in Insights');
    expect(prompt).toContain('instradare le azioni compatibili via routing/n8n');
    expect(prompt).not.toContain('generare bozze contenuto');
  });
});
