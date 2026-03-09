import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAssertProjectAccess,
  mockAssertOrganizationAccess,
  mockCreateCopilotTip,
  mockDispatchTips,
  mockExecuteRouting,
} = vi.hoisted(() => ({
  mockAssertProjectAccess: vi.fn(),
  mockAssertOrganizationAccess: vi.fn(),
  mockCreateCopilotTip: vi.fn(),
  mockDispatchTips: vi.fn(),
  mockExecuteRouting: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/domain/workspace', () => ({
  assertProjectAccess: mockAssertProjectAccess,
  assertOrganizationAccess: mockAssertOrganizationAccess,
}));

vi.mock('@/lib/projects/project-tip.service', () => ({
  ProjectTipService: {
    createCopilotTip: mockCreateCopilotTip,
  },
}));

vi.mock('@/lib/integrations/n8n/dispatcher', () => ({
  N8NDispatcher: {
    dispatchTips: mockDispatchTips,
  },
}));

vi.mock('@/lib/cms/tip-routing-executor', () => ({
  TipRoutingExecutor: {
    execute: mockExecuteRouting,
  },
}));

import {
  buildStrategicTipRoutingPayload,
  createStrategicTipCreationTool,
} from '@/lib/copilot/chat-tools';

describe('copilot strategic tip tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertProjectAccess.mockResolvedValue({ organizationId: 'org-1' });
    mockAssertOrganizationAccess.mockResolvedValue(undefined);
    mockDispatchTips.mockResolvedValue(undefined);
    mockExecuteRouting.mockResolvedValue([{ success: true }]);
  });

  it('builds routing payloads with canonical content kinds only', async () => {
    const payload = buildStrategicTipRoutingPayload('tip-1', [
      {
        type: 'add_faq',
        target: 'website',
        title: 'FAQ pricing',
        body: 'Add a FAQ about pricing tiers.',
        reasoning: 'Requested by users.',
        contentKind: 'NEW_FAQ',
      },
      {
        type: 'strategic_recommendation',
        target: 'strategy',
        title: 'Clarify ICP',
        body: 'Document the ICP before expanding channels.',
        reasoning: 'Avoid channel waste.',
        contentKind: null,
      },
    ]);

    expect(payload).toEqual([
      {
        id: 'tip-1',
        title: 'FAQ pricing',
        content: 'Add a FAQ about pricing tiers.',
        contentKind: 'NEW_FAQ',
        targetChannel: 'website',
      },
    ]);
  });

  it('routes only canonical actions and never reports fake draft creation', async () => {
    mockCreateCopilotTip.mockResolvedValue({ id: 'tip-123' });

    const tool = createStrategicTipCreationTool({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
    });

    const result = await tool.execute({
      projectId: 'project-1',
      topicName: 'Riduci frizione onboarding',
      reasoning: 'Le richieste utenti mostrano confusione sulla fase iniziale.',
      autoCreateContentDrafts: true,
      autoDispatchRouting: true,
      actions: [
        {
          type: 'add_faq',
          target: 'website',
          title: 'FAQ onboarding',
          body: 'Aggiungi una FAQ sul tempo medio di setup.',
          reasoning: 'Tema ricorrente nelle conversazioni.',
        },
        {
          type: 'strategic_recommendation',
          target: 'strategy',
          title: 'Rivedi il posizionamento',
          body: 'Allinea il messaggio core alla promessa del prodotto.',
          reasoning: 'Serve maggiore chiarezza.',
        },
      ],
    });

    expect(result).toMatchObject({
      success: true,
      automations: {
        contentDraftsCreated: 0,
        draftGenerationSupported: false,
        ignoredAutoCreateContentDrafts: true,
        routableActionsCount: 1,
      },
    });

    expect(mockDispatchTips).toHaveBeenCalledWith('project-1', [
      expect.objectContaining({
        id: 'tip-123',
        title: 'FAQ onboarding',
        contentKind: 'NEW_FAQ',
      }),
    ]);
    expect(mockExecuteRouting).toHaveBeenCalledWith('project-1', [
      expect.objectContaining({
        id: 'tip-123',
        title: 'FAQ onboarding',
        contentKind: 'NEW_FAQ',
      }),
    ]);
  });

  it('returns an error when canonical tip creation fails', async () => {
    mockCreateCopilotTip.mockRejectedValue(new Error('db offline'));

    const tool = createStrategicTipCreationTool({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
    });

    const result = await tool.execute({
      projectId: 'project-1',
      topicName: 'Migliora il nurturing',
      reasoning: 'I lead freddi non ricevono abbastanza contesto.',
      actions: [
        {
          type: 'add_faq',
          target: 'website',
          title: 'FAQ lead time',
          body: 'Spiega in quali tempi arriva il primo risultato.',
          reasoning: 'Riduce aspettative sbagliate.',
        },
      ],
    });

    expect(result).toEqual({
      error: 'Failed to create AI tip from Copilot',
      details: 'db offline',
    });
    expect(mockDispatchTips).not.toHaveBeenCalled();
    expect(mockExecuteRouting).not.toHaveBeenCalled();
  });
});
