import { prisma } from '@/lib/prisma';

export type AlertType = 
  | 'TRAFFIC_DROP' 
  | 'NEGATIVE_LLM_MENTION' 
  | 'KNOWLEDGE_GAP_STALE' 
  | 'INTEGRATION_STALE';

export interface AlertPayload {
  alertType: AlertType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export class CopilotAlertEngine {
  /**
   * Run all checks for an organization and create new alerts.
   * Skips duplicate alerts created in the last 24h for same alertType.
   */
  static async runChecksForOrg(organizationId: string): Promise<number> {
    const alerts: AlertPayload[] = [];

    const [trafficAlerts, llmAlerts, gapAlerts, integrationAlerts] = await Promise.all([
      CopilotAlertEngine.checkTrafficDrop(organizationId),
      CopilotAlertEngine.checkNegativeLLMMentions(organizationId),
      CopilotAlertEngine.checkStaleKnowledgeGaps(organizationId),
      CopilotAlertEngine.checkStaleIntegrations(organizationId),
    ]);

    alerts.push(...trafficAlerts, ...llmAlerts, ...gapAlerts, ...integrationAlerts);

    if (alerts.length === 0) return 0;

    // Deduplication: skip alert types already created in last 24h for this org
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = await prisma.copilotAlert.findMany({
      where: {
        organizationId,
        createdAt: { gte: oneDayAgo },
      },
      select: { alertType: true },
    });
    const recentTypes = new Set(recentAlerts.map((a) => a.alertType));

    const newAlerts = alerts.filter((a) => !recentTypes.has(a.alertType));
    if (newAlerts.length === 0) return 0;

    await prisma.copilotAlert.createMany({
      data: newAlerts.map((a) => ({
        organizationId,
        alertType: a.alertType,
        severity: a.severity,
        title: a.title,
        body: a.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (a.metadata ?? null) as any,
      })),
      skipDuplicates: true,
    });

    return newAlerts.length;
  }

  static async runChecksForAllOrgs(): Promise<{ orgsChecked: number; alertsCreated: number }> {
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });

    let alertsCreated = 0;
    for (const org of orgs) {
      try {
        alertsCreated += await CopilotAlertEngine.runChecksForOrg(org.id);
      } catch (e) {
        console.error(`[alert-engine] org ${org.id} failed:`, e);
      }
    }

    return { orgsChecked: orgs.length, alertsCreated };
  }

  // ── Check 1: Traffic drop >20% week-over-week ───────────────────────────────

  private static async checkTrafficDrop(organizationId: string): Promise<AlertPayload[]> {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await prisma.googleAnalyticsData.findMany({
      where: {
        googleConnection: { project: { organizationId } },
        date: { gte: twoWeeksAgo },
      },
      select: { date: true, sessions: true, googleConnection: { select: { project: { select: { name: true } } } } },
      orderBy: { date: 'asc' },
    });

    const prevWeek = rows.filter((r) => r.date < oneWeekAgo);
    const currWeek = rows.filter((r) => r.date >= oneWeekAgo);

    if (prevWeek.length === 0 || currWeek.length === 0) return [];

    const prevSessions = prevWeek.reduce((s, r) => s + (r.sessions ?? 0), 0);
    const currSessions = currWeek.reduce((s, r) => s + (r.sessions ?? 0), 0);

    if (prevSessions === 0) return [];

    const dropPct = ((prevSessions - currSessions) / prevSessions) * 100;
    if (dropPct < 20) return [];

    return [{
      alertType: 'TRAFFIC_DROP',
      severity: dropPct >= 40 ? 'high' : 'medium',
      title: `Calo traffico del ${Math.round(dropPct)}% rispetto alla settimana scorsa`,
      body: `Le sessioni sono scese da ${prevSessions} a ${currSessions} su base settimanale. Controlla le campagne attive e le integrazioni Google Analytics.`,
      metadata: { prevSessions, currSessions, dropPct: Math.round(dropPct) },
    }];
  }

  // ── Check 2: Negative LLM mentions ─────────────────────────────────────────

  private static async checkNegativeLLMMentions(organizationId: string): Promise<AlertPayload[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const negativeMentions = await prisma.visibilityResponse.findMany({
      where: {
        scan: {
          visibilityConfig: { organizationId },
        },
        createdAt: { gte: sevenDaysAgo },
        sentiment: { in: ['negative', 'NEGATIVE'] },
      },
      select: {
        platform: true,
        sentiment: true,
        scan: {
          select: {
            visibilityConfig: { select: { brandName: true } },
          },
        },
      },
      take: 10,
    });

    if (negativeMentions.length === 0) return [];

    const platforms = [...new Set(negativeMentions.map((m) => m.platform).filter(Boolean))];
    const brandName = negativeMentions[0]?.scan?.visibilityConfig?.brandName || 'il tuo brand';

    return [{
      alertType: 'NEGATIVE_LLM_MENTION',
      severity: negativeMentions.length >= 5 ? 'high' : 'medium',
      title: `${negativeMentions.length} menzioni negative su AI rilevate`,
      body: `${brandName} ha ricevuto ${negativeMentions.length} menzioni negative su ${platforms.join(', ') || 'piattaforme AI'} negli ultimi 7 giorni. Considera di aggiornare la KB e lo Schema.org.`,
      metadata: { count: negativeMentions.length, platforms },
    }];
  }

  // ── Check 3: Stale knowledge gaps (unresolved >7 days) ─────────────────────

  private static async checkStaleKnowledgeGaps(organizationId: string): Promise<AlertPayload[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const staleGaps = await prisma.knowledgeGap.findMany({
      where: {
        bot: { project: { organizationId } },
        status: { notIn: ['resolved', 'completed', 'dismissed', 'bridged'] },
        createdAt: { lte: sevenDaysAgo },
        priority: { in: ['high', 'medium'] },
      },
      select: { topic: true, priority: true },
      take: 20,
    });

    if (staleGaps.length === 0) return [];

    const highCount = staleGaps.filter((g) => g.priority === 'high').length;
    const topics = staleGaps.slice(0, 3).map((g) => g.topic).join(', ');

    return [{
      alertType: 'KNOWLEDGE_GAP_STALE',
      severity: highCount >= 3 ? 'high' : 'medium',
      title: `${staleGaps.length} knowledge gap irrisolte da oltre 7 giorni`,
      body: `Il chatbot non riesce a rispondere su: ${topics}${staleGaps.length > 3 ? ` e altri ${staleGaps.length - 3} topic` : ''}. Aggiorna la KB del chatbot o crea contenuti FAQ.`,
      metadata: { count: staleGaps.length, highCount, sampleTopics: staleGaps.slice(0, 5).map((g) => g.topic) },
    }];
  }

  // ── Check 4: Stale integrations (no data >14 days) ─────────────────────────

  private static async checkStaleIntegrations(organizationId: string): Promise<AlertPayload[]> {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const staleConnections = await prisma.googleConnection.findMany({
      where: {
        project: { organizationId },
        OR: [
          { ga4Enabled: true },
          { gscEnabled: true },
        ],
        analytics: {
          none: {
            date: { gte: fourteenDaysAgo },
          },
        },
      },
      select: {
        ga4Enabled: true,
        gscEnabled: true,
        project: { select: { name: true } },
      },
      take: 5,
    });

    if (staleConnections.length === 0) return [];

    const projectNames = staleConnections.map((c) => c.project.name).join(', ');

    return [{
      alertType: 'INTEGRATION_STALE',
      severity: 'medium',
      title: `${staleConnections.length} integrazione Google senza dati da 14+ giorni`,
      body: `Le integrazioni Google Analytics/Search Console per ${projectNames} non hanno ricevuto nuovi dati. Verifica le credenziali e la configurazione.`,
      metadata: { count: staleConnections.length, projects: staleConnections.map((c) => c.project.name) },
    }];
  }
}
