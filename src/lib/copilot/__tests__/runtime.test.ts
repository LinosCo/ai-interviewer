import { describe, expect, it } from 'vitest';

import {
  buildCondensedConversationHistory,
  detectCopilotIntent,
  selectCopilotToolNames,
} from '@/lib/copilot/runtime';

describe('copilot runtime helpers', () => {
  it('selects lightweight account tools for usage requests', () => {
    const profile = detectCopilotIntent('Mostra il mio utilizzo e i crediti residui');
    const tools = selectCopilotToolNames(profile, true);

    expect(profile.primaryArea).toBe('usage');
    expect(tools).toContain('getAccountUsage');
    expect(tools).toContain('searchPlatformHelp');
    expect(tools).not.toContain('getProjectTranscripts');
  });

  it('selects operational tools for connection requests', () => {
    const profile = detectCopilotIntent('Verifica le connessioni e testa GA4 del progetto');
    const tools = selectCopilotToolNames(profile, true);

    expect(profile.primaryArea).toBe('connections');
    expect(profile.needsOperationalExecution).toBe(true);
    expect(tools).toContain('manageProjectConnections');
    expect(tools).toContain('manageTipRouting');
  });

  it('condenses older history and preserves recent turns', () => {
    const history = buildCondensedConversationHistory([
      { role: 'user', content: 'Analizza le ultime conversazioni e trova i temi emergenti' },
      { role: 'assistant', content: 'Ho analizzato i temi principali', toolsUsed: ['getChatbotConversations'] },
      { role: 'user', content: 'Crea un tip operativo per ridurre la frizione onboarding' },
      { role: 'assistant', content: 'Ho proposto un tip con azioni coordinate', toolsUsed: ['createStrategicTip'] },
      { role: 'user', content: 'Ora verifica le connessioni Google del progetto' },
      { role: 'assistant', content: 'Sto verificando lo stato delle connessioni', toolsUsed: ['manageProjectConnections'] },
      { role: 'user', content: 'Dammi il prossimo passo' },
    ], { maxRecentMessages: 4 });

    expect(history.summary).toContain('Richieste precedenti rilevanti');
    expect(history.summary).toContain('getChatbotConversations');
    expect(history.recentMessages).toHaveLength(4);
    expect(history.recentMessages.at(-1)?.content).toBe('Dammi il prossimo passo');
  });
});
