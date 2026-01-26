import { prisma } from '@/lib/prisma';
import { CMSSuggestionStatus, CMSSuggestionType } from '@prisma/client';
import { CMSConnectionService } from './connection.service';
import { decrypt } from './encryption';

interface CreateSuggestionInput {
  connectionId: string;
  title: string;
  body: string;
  targetSection?: string;
  slug?: string;
  metaDescription?: string;
  type: CMSSuggestionType;
  reasoning: string;
  sourceSignals: Record<string, any>;
  priorityScore?: number;
  crossChannelInsightId?: string;
  createdBy?: string;
}

interface PushSuggestionResult {
  success: boolean;
  suggestionId: string;
  cmsContentId?: string;
  previewUrl?: string;
  error?: string;
}

export class CMSSuggestionService {
  /**
   * Crea un nuovo suggerimento (stato PENDING)
   */
  static async create(input: CreateSuggestionInput): Promise<string> {
    const suggestion = await prisma.cMSSuggestion.create({
      data: {
        connectionId: input.connectionId,
        title: input.title,
        body: input.body,
        targetSection: input.targetSection,
        slug: input.slug,
        metaDescription: input.metaDescription,
        type: input.type,
        reasoning: input.reasoning,
        sourceSignals: input.sourceSignals,
        priorityScore: input.priorityScore ?? 50,
        crossChannelInsightId: input.crossChannelInsightId,
        status: 'PENDING',
        createdBy: input.createdBy
      }
    });

    return suggestion.id;
  }

  /**
   * Invia un suggerimento al CMS
   */
  static async pushToCMS(
    suggestionId: string,
    userId: string
  ): Promise<PushSuggestionResult> {
    const suggestion = await prisma.cMSSuggestion.findUnique({
      where: { id: suggestionId },
      include: { connection: true }
    });

    if (!suggestion) {
      return { success: false, suggestionId, error: 'Suggestion not found' };
    }

    if (suggestion.status !== 'PENDING') {
      return { success: false, suggestionId, error: 'Suggestion already processed' };
    }

    if (!suggestion.connection || suggestion.connection.status === 'DISABLED') {
      return { success: false, suggestionId, error: 'CMS connection not active' };
    }

    try {
      // Cattura metriche pre-applicazione
      const performanceBefore = await this.capturePerformanceMetrics(
        suggestion.connectionId,
        suggestion.targetSection
      );

      const payload = {
        btSuggestionId: suggestion.id,
        type: suggestion.type,
        title: suggestion.title,
        slug: suggestion.slug,
        body: suggestion.body,
        metaDescription: suggestion.metaDescription,
        targetSection: suggestion.targetSection,
        reasoning: suggestion.reasoning,
        priorityScore: suggestion.priorityScore
      };

      // Invia al CMS
      const response = await fetch(`${suggestion.connection.cmsApiUrl}/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BT-API-Key': decrypt(suggestion.connection.apiKey)
        },
        body: JSON.stringify(payload)
      });

      // Log webhook
      await CMSConnectionService.logWebhook(
        suggestion.connectionId,
        'OUTBOUND',
        'suggestion.push',
        response.ok,
        payload,
        response.status,
        undefined,
        response.ok ? undefined : `HTTP ${response.status}`
      );

      if (!response.ok) {
        await prisma.cMSSuggestion.update({
          where: { id: suggestionId },
          data: { status: 'FAILED' }
        });
        return { success: false, suggestionId, error: `CMS returned ${response.status}` };
      }

      const data = await response.json();

      // Aggiorna stato
      await prisma.cMSSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'PUSHED',
          pushedAt: new Date(),
          performanceBefore: performanceBefore ?? undefined,
          cmsContentId: data.contentId,
          cmsPreviewUrl: data.previewUrl
        }
      });

      // Log success
      const userEmail = await this.getUserEmail(userId);
      await prisma.cMSWebhookLog.create({
        data: {
          connectionId: suggestion.connectionId,
          direction: 'OUTBOUND',
          event: 'suggestion_sent',
          requestPayload: { suggestionId, userId },
          success: true,
          responseStatus: 200
        }
      });

      return {
        success: true,
        suggestionId,
        cmsContentId: data.contentId,
        previewUrl: data.previewUrl
      };

    } catch (error: any) {
      // Log errore
      await prisma.cMSWebhookLog.create({
        data: {
          connectionId: suggestion.connectionId,
          direction: 'OUTBOUND',
          event: 'suggestion_send_failed',
          requestPayload: { suggestionId, error: error.message },
          success: false
        }
      });

      await prisma.cMSSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'FAILED' }
      });

      return { success: false, suggestionId, error: error.message };
    }
  }

  /**
   * Marca un suggerimento come applicato/pubblicato.
   * Chiamato quando il CMS notifica che il contenuto e stato pubblicato.
   */
  static async markAsApplied(
    suggestionId: string,
    appliedBy?: string
  ): Promise<void> {
    await prisma.cMSSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date()
      }
    });

    // Schedula cattura metriche post-applicazione (dopo 7 giorni)
    // Questo viene gestito dal cron job cms-capture-performance
  }

  /**
   * Marca un suggerimento come rifiutato.
   */
  static async markAsRejected(
    suggestionId: string,
    reason?: string,
    rejectedBy?: string
  ): Promise<void> {
    await prisma.cMSSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedReason: reason
      }
    });
  }

  /**
   * Aggiorna le metriche post-applicazione per un suggerimento.
   * Chiamato dal cron job dopo 7 giorni dalla pubblicazione.
   */
  static async updatePerformanceAfter(suggestionId: string): Promise<void> {
    const suggestion = await prisma.cMSSuggestion.findUnique({
      where: { id: suggestionId }
    });

    if (!suggestion || suggestion.status !== 'PUBLISHED' || !suggestion.targetSection) {
      return;
    }

    const performanceAfter = await this.capturePerformanceMetrics(
      suggestion.connectionId,
      suggestion.targetSection
    );

    if (performanceAfter) {
      await prisma.cMSSuggestion.update({
        where: { id: suggestionId },
        data: { performanceAfter }
      });
    }
  }

  /**
   * Lista suggerimenti per una connessione
   */
  static async listByConnection(
    connectionId: string,
    options?: {
      status?: CMSSuggestionStatus;
      limit?: number;
    }
  ) {
    return prisma.cMSSuggestion.findMany({
      where: {
        connectionId,
        ...(options?.status && { status: options.status })
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50
    });
  }

  /**
   * Ottiene suggerimenti in attesa di cattura metriche post-pubblicazione.
   * Suggerimenti pubblicati da almeno 7 giorni senza performanceAfter.
   */
  static async getSuggestionsNeedingPerformanceCapture(): Promise<string[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const suggestions = await prisma.cMSSuggestion.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: sevenDaysAgo },
        performanceAfter: { equals: null },
        targetSection: { not: null }
      },
      select: { id: true }
    });

    return suggestions.map(s => s.id);
  }

  /**
   * Cattura metriche di performance per una pagina
   */
  private static async capturePerformanceMetrics(
    connectionId: string,
    targetSection?: string | null
  ): Promise<Record<string, any> | null> {
    if (!targetSection) return null;

    // Ottieni ultimi 7 giorni di analytics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const analytics = await prisma.websiteAnalytics.findMany({
      where: {
        connectionId,
        date: { gte: sevenDaysAgo }
      },
      orderBy: { date: 'desc' },
      take: 7
    });

    if (!analytics.length) return null;

    // Cerca la pagina target nei topPages
    let totalPageviews = 0;
    let totalBounceRate = 0;
    let totalAvgTime = 0;
    let count = 0;

    for (const day of analytics) {
      const pages = day.topPages as any[];
      if (!Array.isArray(pages)) continue;

      const pageData = pages.find(p =>
        p.path === targetSection ||
        p.path?.includes(targetSection) ||
        targetSection?.includes(p.path)
      );

      if (pageData) {
        totalPageviews += pageData.views || 0;
        totalBounceRate += pageData.bounceRate || 0;
        totalAvgTime += pageData.avgTime || 0;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      captureDate: new Date().toISOString(),
      period: '7days',
      pageviews: totalPageviews,
      avgBounceRate: totalBounceRate / count,
      avgTimeOnPage: totalAvgTime / count,
      dataPoints: count
    };
  }

  private static async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    return user?.email;
  }
}
