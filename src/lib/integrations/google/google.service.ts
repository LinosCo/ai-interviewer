/**
 * Google Service
 * Direct API integration for Google Analytics 4 and Search Console
 * Uses Service Account authentication
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { normalizeGscSiteUrl } from '@/lib/integrations/google/normalization';
import { decrypt } from '../encryption';

export interface GA4Metrics {
  pageviews: number;
  sessions: number;
  users: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPages: Array<{
    path: string;
    views: number;
    bounceRate: number;
  }>;
}

export interface GSCMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  queries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
}

export interface TestConnectionResult {
  success: boolean;
  propertyName?: string;
  siteUrl?: string;
  error?: string;
}

export interface DailyAnalytics {
  ga4?: GA4Metrics;
  gsc?: GSCMetrics;
}

type GoogleLogLevel = 'info' | 'warn' | 'error';

function serializeGoogleError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const asRecord = error as Error & {
      code?: string | number;
      status?: number;
      response?: { status?: number; data?: unknown };
      errors?: unknown;
    };

    return {
      name: error.name,
      message: error.message,
      code: asRecord.code,
      status: asRecord.status,
      responseStatus: asRecord.response?.status,
      responseData: asRecord.response?.data,
      errors: asRecord.errors,
    };
  }

  return { message: String(error || 'Unknown error') };
}

function logGoogleEvent(
  stage: string,
  details: Record<string, unknown>,
  level: GoogleLogLevel = 'info'
): void {
  const payload = { stage, ...details };

  if (level === 'warn') {
    console.warn('[GoogleService]', payload);
    return;
  }

  if (level === 'error') {
    console.error('[GoogleService]', payload);
    return;
  }

  console.info('[GoogleService]', payload);
}

class GoogleServiceClass {
  private async writeIntegrationLog(params: {
    googleConnectionId: string;
    action: string;
    arguments?: Record<string, unknown>;
    result?: Record<string, unknown>;
    success: boolean;
    errorMessage?: string | null;
    durationMs: number;
  }): Promise<void> {
    try {
      await prisma.integrationLog.create({
        data: {
          googleConnectionId: params.googleConnectionId,
          action: params.action,
          arguments: params.arguments,
          result: params.result,
          success: params.success,
          errorMessage: params.errorMessage || null,
          creditsUsed: 0,
          durationMs: params.durationMs,
        },
      });
    } catch (logError) {
      logGoogleEvent('integration_log_write_failed', {
        googleConnectionId: params.googleConnectionId,
        action: params.action,
        error: serializeGoogleError(logError),
      }, 'warn');
    }
  }

  private normalizeGa4PropertyId(rawPropertyId: string): { value: string; error?: string } {
    const trimmed = rawPropertyId.trim();
    const withoutPrefix = trimmed.replace(/^properties\//i, '');

    if (!withoutPrefix) {
      return { value: '', error: 'GA4 property ID not configured' };
    }

    if (/^G-/i.test(withoutPrefix)) {
      return {
        value: '',
        error: 'Property ID GA4 non valido: hai inserito un Measurement ID (G-...). Usa il Property ID numerico.',
      };
    }

    if (!/^\d+$/.test(withoutPrefix)) {
      return {
        value: '',
        error: 'Property ID GA4 non valido: usa solo il valore numerico (es. 123456789).',
      };
    }

    return { value: withoutPrefix };
  }

  private formatGa4TestError(rawErrorMessage: string, propertyId: string, serviceAccountEmail: string): string {
    const normalized = rawErrorMessage.toLowerCase();
    const baseMessage = rawErrorMessage.trim();

    if (normalized.includes('permission_denied') || normalized.includes('sufficient permissions')) {
      return `PERMISSION_DENIED su Property ID ${propertyId}. Verifica che ${serviceAccountEmail} sia utente della proprietà GA4 (Viewer o superiore), che il Property ID sia numerico (non G-...) e che Analytics Data API sia attiva nel progetto Google Cloud del Service Account.`;
    }

    if (normalized.includes('not found')) {
      return `Property ID ${propertyId} non trovato. Controlla di aver inserito il Property ID GA4 numerico corretto (non Measurement ID G-...).`;
    }

    return baseMessage || 'Unknown error';
  }

  private formatGscTestError(rawErrorMessage: string, siteUrl: string, serviceAccountEmail: string): string {
    const normalized = rawErrorMessage.toLowerCase();
    const baseMessage = rawErrorMessage.trim();

    if (normalized.includes('permission_denied') || normalized.includes('sufficient permission')) {
      return `PERMISSION_DENIED su site '${siteUrl}'. Verifica che ${serviceAccountEmail} sia utente della proprietà Search Console corretta e che il formato sia esatto: URL-prefix => https://dominio.tld/ (slash finale), Domain property => sc-domain:dominio.tld.`;
    }

    if (normalized.includes('not found')) {
      return `Proprietà Search Console non trovata per '${siteUrl}'. Controlla formato e corrispondenza esatta della proprietà (URL-prefix con slash finale oppure sc-domain:dominio.tld).`;
    }

    return baseMessage || 'Unknown error';
  }

  /**
   * Create GA4 client with Service Account credentials
   */
  private createGA4Client(serviceAccountJson: string): BetaAnalyticsDataClient {
    const credentials = JSON.parse(decrypt(serviceAccountJson));
    return new BetaAnalyticsDataClient({ credentials });
  }

  /**
   * Create Search Console client with Service Account credentials
   */
  private createGSCClient(serviceAccountJson: string) {
    const credentials = JSON.parse(decrypt(serviceAccountJson));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    return google.searchconsole({ version: 'v1', auth });
  }

  /**
   * Test GA4 connection
   */
  async testGA4(connectionId: string): Promise<TestConnectionResult> {
    const startedAt = Date.now();
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        projectId: true,
        serviceAccountJson: true,
        serviceAccountEmail: true,
        ga4PropertyId: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!connection?.ga4PropertyId) {
      logGoogleEvent('ga4_test_skipped', {
        connectionId,
        reason: 'GA4 not configured',
      }, 'warn');
      return { success: false, error: 'GA4 not configured' };
    }

    const normalizedProperty = this.normalizeGa4PropertyId(connection.ga4PropertyId);
    logGoogleEvent('ga4_test_start', {
      connectionId,
      projectId: connection.projectId,
      projectName: connection.project?.name || null,
      serviceAccountEmail: connection.serviceAccountEmail,
      rawPropertyId: connection.ga4PropertyId,
      normalizedPropertyId: normalizedProperty.value || null,
      normalizationError: normalizedProperty.error || null,
    });
    if (normalizedProperty.error) {
      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          ga4Status: 'ERROR',
          ga4LastError: normalizedProperty.error,
        },
      });
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_ga4',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          rawPropertyId: connection.ga4PropertyId,
        },
        result: {
          normalizedPropertyId: normalizedProperty.value || null,
          validationError: normalizedProperty.error,
        },
        success: false,
        errorMessage: normalizedProperty.error,
        durationMs: Date.now() - startedAt,
      });
      return { success: false, error: normalizedProperty.error };
    }

    try {
      const client = this.createGA4Client(connection.serviceAccountJson);

      // Run a simple query to test the connection
      await client.runReport({
        property: `properties/${normalizedProperty.value}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      // Update connection status
      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          ga4Status: 'ACTIVE',
          ga4LastSyncAt: new Date(),
          ga4LastError: null,
        },
      });

      logGoogleEvent('ga4_test_success', {
        connectionId,
        projectId: connection.projectId,
        projectName: connection.project?.name || null,
        propertyId: normalizedProperty.value,
        durationMs: Date.now() - startedAt,
      });
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_ga4',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          propertyId: normalizedProperty.value,
        },
        result: {
          propertyName: `Property ${normalizedProperty.value}`,
        },
        success: true,
        durationMs: Date.now() - startedAt,
      });

      return {
        success: true,
        propertyName: `Property ${normalizedProperty.value}`,
      };
    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = this.formatGa4TestError(rawErrorMessage, normalizedProperty.value, connection.serviceAccountEmail);

      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          ga4Status: 'ERROR',
          ga4LastError: errorMessage,
        },
      });

      logGoogleEvent('ga4_test_failure', {
        connectionId,
        projectId: connection.projectId,
        projectName: connection.project?.name || null,
        serviceAccountEmail: connection.serviceAccountEmail,
        propertyId: normalizedProperty.value,
        formattedError: errorMessage,
        rawError: serializeGoogleError(error),
        durationMs: Date.now() - startedAt,
      }, 'error');
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_ga4',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          propertyId: normalizedProperty.value,
        },
        result: {
          rawError: serializeGoogleError(error),
          formattedError: errorMessage,
        },
        success: false,
        errorMessage,
        durationMs: Date.now() - startedAt,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test Search Console connection
   */
  async testGSC(connectionId: string): Promise<TestConnectionResult> {
    const startedAt = Date.now();
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        projectId: true,
        serviceAccountJson: true,
        serviceAccountEmail: true,
        gscSiteUrl: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!connection?.gscSiteUrl) {
      logGoogleEvent('gsc_test_skipped', {
        connectionId,
        reason: 'Search Console not configured',
      }, 'warn');
      return { success: false, error: 'Search Console not configured' };
    }

    const normalizedSite = normalizeGscSiteUrl(connection.gscSiteUrl);
    logGoogleEvent('gsc_test_site_normalization', {
      connectionId,
      projectId: connection.projectId,
      rawSiteUrl: connection.gscSiteUrl,
      normalizedSiteUrl: normalizedSite.value || null,
      normalizationError: normalizedSite.error || null,
    });
    if (normalizedSite.error) {
      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          gscStatus: 'ERROR',
          gscLastError: normalizedSite.error,
        },
      });
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_gsc',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          siteUrl: connection.gscSiteUrl,
        },
        result: {
          normalizedSiteUrl: normalizedSite.value || null,
        },
        success: false,
        errorMessage: normalizedSite.error,
        durationMs: Date.now() - startedAt,
      });
      return { success: false, error: normalizedSite.error };
    }

    try {
      const client = this.createGSCClient(connection.serviceAccountJson);

      // Calculate date range (yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      logGoogleEvent('gsc_test_start', {
        connectionId,
        projectId: connection.projectId,
        projectName: connection.project?.name || null,
        serviceAccountEmail: connection.serviceAccountEmail,
        siteUrl: normalizedSite.value,
        queryDate: dateStr,
      });

      await client.searchanalytics.query({
        siteUrl: normalizedSite.value,
        requestBody: {
          startDate: dateStr,
          endDate: dateStr,
          dimensions: ['query'],
          rowLimit: 1,
        },
      });

      logGoogleEvent('gsc_test_success', {
        connectionId,
        projectId: connection.projectId,
        projectName: connection.project?.name || null,
        siteUrl: normalizedSite.value,
        durationMs: Date.now() - startedAt,
      });
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_gsc',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          siteUrl: normalizedSite.value,
          queryDate: dateStr,
        },
        result: {
          siteUrl: normalizedSite.value,
        },
        success: true,
        durationMs: Date.now() - startedAt,
      });

      // Update connection status
      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          gscStatus: 'ACTIVE',
          gscLastSyncAt: new Date(),
          gscLastError: null,
        },
      });

      return {
        success: true,
        siteUrl: normalizedSite.value,
      };
    } catch (error) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = this.formatGscTestError(rawErrorMessage, normalizedSite.value, connection.serviceAccountEmail);

      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          gscStatus: 'ERROR',
          gscLastError: errorMessage,
        },
      });

      logGoogleEvent('gsc_test_failure', {
        connectionId,
        projectId: connection.projectId,
        projectName: connection.project?.name || null,
        serviceAccountEmail: connection.serviceAccountEmail,
        siteUrl: normalizedSite.value,
        formattedError: errorMessage,
        rawError: serializeGoogleError(error),
        durationMs: Date.now() - startedAt,
      }, 'error');
      await this.writeIntegrationLog({
        googleConnectionId: connectionId,
        action: 'google.test_gsc',
        arguments: {
          projectId: connection.projectId,
          projectName: connection.project?.name || null,
          serviceAccountEmail: connection.serviceAccountEmail,
          siteUrl: normalizedSite.value,
        },
        result: {
          rawError: serializeGoogleError(error),
          formattedError: errorMessage,
        },
        success: false,
        errorMessage,
        durationMs: Date.now() - startedAt,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Fetch daily analytics from GA4 and GSC
   */
  async fetchDailyAnalytics(connectionId: string, date?: Date): Promise<DailyAnalytics> {
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const targetDate = date || new Date();
    targetDate.setDate(targetDate.getDate() - 1); // Default to yesterday
    const dateStr = targetDate.toISOString().split('T')[0];

    const result: DailyAnalytics = {};

    // Fetch GA4 metrics
    if (connection.ga4Enabled && connection.ga4PropertyId) {
      try {
        result.ga4 = await this.fetchGA4Metrics(connection, dateStr);
      } catch (error) {
        logGoogleEvent('ga4_fetch_failure', {
          connectionId,
          date: dateStr,
          error: serializeGoogleError(error),
        }, 'error');
      }
    }

    // Fetch GSC metrics
    if (connection.gscEnabled && connection.gscSiteUrl) {
      try {
        result.gsc = await this.fetchGSCMetrics(connection, dateStr);
      } catch (error) {
        logGoogleEvent('gsc_fetch_failure', {
          connectionId,
          date: dateStr,
          error: serializeGoogleError(error),
        }, 'error');
      }
    }

    return result;
  }

  /**
   * Fetch GA4 metrics for a specific date
   */
  private async fetchGA4Metrics(
    connection: { serviceAccountJson: string; ga4PropertyId: string | null },
    dateStr: string
  ): Promise<GA4Metrics> {
    if (!connection.ga4PropertyId) {
      throw new Error('GA4 property ID not configured');
    }

    const normalizedProperty = this.normalizeGa4PropertyId(connection.ga4PropertyId);
    if (normalizedProperty.error) {
      throw new Error(normalizedProperty.error);
    }

    const client = this.createGA4Client(connection.serviceAccountJson);
    const property = `properties/${normalizedProperty.value}`;

    // Fetch main metrics
    const [metricsResponse] = await client.runReport({
      property,
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    // Fetch top pages
    const [pagesResponse] = await client.runReport({
      property,
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    });

    const row = metricsResponse.rows?.[0]?.metricValues || [];

    return {
      pageviews: parseInt(row[0]?.value || '0', 10),
      sessions: parseInt(row[1]?.value || '0', 10),
      users: parseInt(row[2]?.value || '0', 10),
      avgSessionDuration: parseFloat(row[3]?.value || '0'),
      bounceRate: parseFloat(row[4]?.value || '0') * 100, // Convert to percentage
      topPages: (pagesResponse.rows || []).map(r => ({
        path: r.dimensionValues?.[0]?.value || '',
        views: parseInt(r.metricValues?.[0]?.value || '0', 10),
        bounceRate: parseFloat(r.metricValues?.[1]?.value || '0') * 100,
      })),
    };
  }

  /**
   * Fetch GSC metrics for a specific date
   */
  private async fetchGSCMetrics(
    connection: { serviceAccountJson: string; gscSiteUrl: string | null },
    dateStr: string
  ): Promise<GSCMetrics> {
    if (!connection.gscSiteUrl) {
      throw new Error('GSC site URL not configured');
    }

    const normalizedSite = normalizeGscSiteUrl(connection.gscSiteUrl);
    if (normalizedSite.error) {
      throw new Error(normalizedSite.error);
    }

    const client = this.createGSCClient(connection.serviceAccountJson);

    const response = await client.searchanalytics.query({
      siteUrl: normalizedSite.value,
      requestBody: {
        startDate: dateStr,
        endDate: dateStr,
        dimensions: ['query'],
        rowLimit: 50,
      },
    });

    const rows = response.data.rows || [];

    // Calculate aggregate metrics
    const totalImpressions = rows.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const totalClicks = rows.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const avgPosition = rows.length
      ? rows.reduce((sum, r) => sum + (r.position || 0), 0) / rows.length
      : 0;

    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgPosition,
      queries: rows.map(r => ({
        query: r.keys?.[0] || '',
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        ctr: (r.ctr || 0) * 100,
        position: r.position || 0,
      })),
    };
  }

  /**
   * Sync and store daily analytics
   */
  async syncDailyAnalytics(connectionId: string): Promise<void> {
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const analytics = await this.fetchDailyAnalytics(connectionId, yesterday);

    // Upsert analytics data
    await prisma.googleAnalyticsData.upsert({
      where: {
        googleConnectionId_date: {
          googleConnectionId: connectionId,
          date: new Date(dateStr),
        },
      },
      update: {
        pageviews: analytics.ga4?.pageviews || 0,
        sessions: analytics.ga4?.sessions || 0,
        users: analytics.ga4?.users || 0,
        avgSessionDuration: analytics.ga4?.avgSessionDuration || 0,
        bounceRate: analytics.ga4?.bounceRate || 0,
        topPages: analytics.ga4?.topPages || [],
        searchImpressions: analytics.gsc?.impressions || 0,
        searchClicks: analytics.gsc?.clicks || 0,
        avgPosition: analytics.gsc?.avgPosition || 0,
        topSearchQueries: analytics.gsc?.queries || [],
      },
      create: {
        googleConnectionId: connectionId,
        date: new Date(dateStr),
        pageviews: analytics.ga4?.pageviews || 0,
        sessions: analytics.ga4?.sessions || 0,
        users: analytics.ga4?.users || 0,
        avgSessionDuration: analytics.ga4?.avgSessionDuration || 0,
        bounceRate: analytics.ga4?.bounceRate || 0,
        topPages: analytics.ga4?.topPages || [],
        searchImpressions: analytics.gsc?.impressions || 0,
        searchClicks: analytics.gsc?.clicks || 0,
        avgPosition: analytics.gsc?.avgPosition || 0,
        topSearchQueries: analytics.gsc?.queries || [],
      },
    });

    // Log the sync
    await prisma.integrationLog.create({
      data: {
        googleConnectionId: connectionId,
        action: 'google.sync_daily_analytics',
        arguments: { date: dateStr },
        result: {
          ga4: analytics.ga4 ? true : false,
          gsc: analytics.gsc ? true : false,
        },
        success: true,
        creditsUsed: 500,
        durationMs: 0,
      },
    });
  }

  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string) {
    return prisma.googleConnection.findUnique({
      where: { id: connectionId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });
  }

  /**
   * Get connection by project ID
   */
  async getProjectConnection(projectId: string) {
    return prisma.googleConnection.findUnique({
      where: { projectId },
    });
  }

  /**
   * Get analytics data for a connection
   */
  async getAnalyticsData(connectionId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.googleAnalyticsData.findMany({
      where: {
        googleConnectionId: connectionId,
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });
  }
}

// Export singleton instance
export const GoogleService = new GoogleServiceClass();
