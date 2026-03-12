import type { GuidanceStepId } from '@/lib/guidance/guidance-state';

export interface ProjectActivationSnapshot {
  projectId: string;
  toolCounts: {
    interviews: number;
    chatbots: number;
    visibility: number;
    total: number;
  };
  integrationCounts: {
    mcp: number;
    google: number;
    cms: number;
    n8n: number;
    total: number;
  };
  tipCounts: {
    total: number;
  };
  routingRules: {
    total: number;
    enabled: number;
  };
  checklist: {
    hasTools: boolean;
    hasIntegration: boolean;
    hasTips: boolean;
    hasRoutingRule: boolean;
    isActivated: boolean;
  };
}

export interface GuidanceRuleContext {
  pathname: string;
  projectId: string | null;
  activation: ProjectActivationSnapshot | null;
}

export interface GuidanceStepDefinition {
  id: GuidanceStepId;
  title: string;
  description: string;
  whyItMatters: string;
  actionLabel: string;
  actionHref: (ctx: GuidanceRuleContext) => string | null;
  isRelevant: (ctx: GuidanceRuleContext) => boolean;
  isCompleted: (ctx: GuidanceRuleContext) => boolean;
}

function isProjectCockpitPath(pathname: string): boolean {
  return /^\/dashboard\/projects\/[^/]+$/.test(pathname);
}

function projectScopedHref(projectId: string | null, basePath: string): string {
  if (!projectId) return basePath;
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}projectId=${projectId}`;
}

function hasTipsAndRoutingOrNoIntegration(activation: ProjectActivationSnapshot): boolean {
  if (!activation.checklist.hasTips) return false;
  if (!activation.checklist.hasIntegration) return true;
  return activation.checklist.hasRoutingRule;
}

function isProjectBotCreatorPath(pathname: string): boolean {
  return /^\/dashboard\/projects\/[^/]+\/bots\/new/.test(pathname);
}

export const GUIDANCE_STEPS: readonly GuidanceStepDefinition[] = [
  {
    id: 'project_without_tools',
    title: 'Attiva il primo tool del progetto',
    description: 'Questo progetto non ha ancora strumenti attivi. Parti da una prima intervista o da un setup visibility per generare segnali utili.',
    whyItMatters: 'Senza segnali reali le sezioni Listen, Tips ed Execute restano vuote.',
    actionLabel: 'Crea prima intervista',
    actionHref: (ctx) => projectScopedHref(ctx.projectId, '/dashboard/interviews/create'),
    isRelevant: (ctx) => isProjectCockpitPath(ctx.pathname) && Boolean(ctx.activation),
    isCompleted: (ctx) => Boolean(ctx.activation?.checklist.hasTools),
  },
  {
    id: 'first_interview_creation',
    title: 'Prima intervista: imposta un obiettivo chiaro',
    description: 'Compila obiettivo e pubblico in modo specifico. Ti aiuta a ottenere insight subito riutilizzabili.',
    whyItMatters: 'Un obiettivo ambiguo produce output poco azionabili e ritarda la fase tips.',
    actionLabel: 'Completa wizard intervista',
    actionHref: (ctx) => (
      isProjectBotCreatorPath(ctx.pathname) && ctx.projectId
        ? `/dashboard/projects/${ctx.projectId}/bots/new`
        : projectScopedHref(ctx.projectId, '/dashboard/interviews/create')
    ),
    isRelevant: (ctx) => ctx.pathname.startsWith('/dashboard/interviews/create') || isProjectBotCreatorPath(ctx.pathname),
    isCompleted: (ctx) => Boolean((ctx.activation?.toolCounts.interviews || 0) > 0),
  },
  {
    id: 'first_chatbot_creation',
    title: 'Primo chatbot: definisci confini e tono',
    description: 'Configura knowledge, limiti e handoff prima della pubblicazione per evitare risposte incoerenti.',
    whyItMatters: 'Un chatbot senza confini aumenta il rumore e riduce la qualità delle conversazioni.',
    actionLabel: 'Completa setup chatbot',
    actionHref: (ctx) => projectScopedHref(ctx.projectId, '/dashboard/bots/create-chatbot'),
    isRelevant: (ctx) => ctx.pathname.startsWith('/dashboard/bots/create-chatbot'),
    isCompleted: (ctx) => Boolean((ctx.activation?.toolCounts.chatbots || 0) > 0),
  },
  {
    id: 'first_visibility_setup',
    title: 'Prima configurazione visibility',
    description: 'Definisci brand, prompt e competitor per avviare monitoraggio e analisi cross-canale.',
    whyItMatters: 'Senza monitoraggio visibility mancano segnali esterni per prioritizzare i tips.',
    actionLabel: 'Completa setup visibility',
    actionHref: (ctx) => projectScopedHref(ctx.projectId, '/dashboard/visibility/create'),
    isRelevant: (ctx) => ctx.pathname.startsWith('/dashboard/visibility/create'),
    isCompleted: (ctx) => Boolean((ctx.activation?.toolCounts.visibility || 0) > 0),
  },
  {
    id: 'first_integration_connection',
    title: 'Apri Connections e collega una destinazione',
    description: 'Connetti CMS, WordPress, Google o n8n prima di portare i tip in esecuzione.',
    whyItMatters: 'Senza Connections attive il routing resta solo teorico.',
    actionLabel: 'Apri Connections',
    actionHref: (ctx) => (ctx.projectId ? `/dashboard/projects/${ctx.projectId}/integrations?tab=connections` : '/dashboard/projects'),
    isRelevant: (ctx) => ctx.pathname.includes('/integrations') && Boolean(ctx.activation),
    isCompleted: (ctx) => Boolean(ctx.activation?.checklist.hasIntegration),
  },
  {
    id: 'first_tip_review_or_routing',
    title: 'Rivedi il primo tip e portalo in Execute',
    description: 'Apri Tips, valida priorita e related actions, poi passa in Execute per il routing.',
    whyItMatters: 'Questo passaggio converte i segnali in una decisione pronta a muoversi nel loop operativo.',
    actionLabel: 'Apri Tips',
    actionHref: (ctx) => {
      if (!ctx.projectId) return '/dashboard/insights?view=tips';
      if (!ctx.activation?.checklist.hasTips) return `/dashboard/insights?projectId=${ctx.projectId}&view=tips`;
      if (!ctx.activation.checklist.hasRoutingRule && ctx.activation.checklist.hasIntegration) {
        return `/dashboard/projects/${ctx.projectId}/integrations?tab=routing`;
      }
      return `/dashboard/insights?projectId=${ctx.projectId}&view=tips`;
    },
    isRelevant: (ctx) =>
      (ctx.pathname.startsWith('/dashboard/insights') || ctx.pathname.includes('/integrations')) && Boolean(ctx.activation),
    isCompleted: (ctx) => (ctx.activation ? hasTipsAndRoutingOrNoIntegration(ctx.activation) : false),
  },
];

export function getAutoCompletedGuidanceSteps(ctx: GuidanceRuleContext): GuidanceStepId[] {
  return GUIDANCE_STEPS.filter((step) => step.isCompleted(ctx)).map((step) => step.id);
}

export function resolveContextualGuidanceStep(
  ctx: GuidanceRuleContext,
  options?: {
    dismissedSteps?: Set<GuidanceStepId>;
    completedSteps?: Set<GuidanceStepId>;
    ignoreDismissed?: boolean;
  }
): GuidanceStepDefinition | null {
  const dismissedSteps = options?.dismissedSteps || new Set<GuidanceStepId>();
  const completedSteps = options?.completedSteps || new Set<GuidanceStepId>();
  const ignoreDismissed = Boolean(options?.ignoreDismissed);

  for (const step of GUIDANCE_STEPS) {
    if (!step.isRelevant(ctx)) continue;
    if (step.isCompleted(ctx) || completedSteps.has(step.id)) continue;
    if (!ignoreDismissed && dismissedSteps.has(step.id)) continue;
    return step;
  }

  return null;
}

export function resolveGuidanceProjectId(
  pathname: string,
  searchParams: URLSearchParams,
  selectedProjectId: string | null
): string | null {
  const projectMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  if (projectMatch && projectMatch[1] && projectMatch[1] !== 'new') {
    return projectMatch[1];
  }

  const fromQuery = searchParams.get('projectId');
  if (fromQuery && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  if (selectedProjectId && selectedProjectId !== '__ALL__') {
    return selectedProjectId;
  }

  return null;
}
