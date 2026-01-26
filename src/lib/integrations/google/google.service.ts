/**
 * Google Service
 * Direct API integration for Google Analytics 4 and Search Console
 * Uses Service Account authentication
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
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

class GoogleServiceClass {
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
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection?.ga4PropertyId) {
      return { success: false, error: 'GA4 not configured' };
    }

    try {
      const client = this.createGA4Client(connection.serviceAccountJson);

      // Run a simple query to test the connection
      const [response] = await client.runReport({
        property: `properties/${connection.ga4PropertyId}`,
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

      return {
        success: true,
        propertyName: `Property ${connection.ga4PropertyId}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          ga4Status: 'ERROR',
          ga4LastError: errorMessage,
        },
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test Search Console connection
   */
  async testGSC(connectionId: string): Promise<TestConnectionResult> {
    const connection = await prisma.googleConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection?.gscSiteUrl) {
      return { success: false, error: 'Search Console not configured' };
    }

    try {
      const client = this.createGSCClient(connection.serviceAccountJson);

      // Calculate date range (yesterday)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await client.searchanalytics.query({
        siteUrl: connection.gscSiteUrl,
        requestBody: {
          startDate: dateStr,
          endDate: dateStr,
          dimensions: ['query'],
          rowLimit: 1,
        },
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
        siteUrl: connection.gscSiteUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.googleConnection.update({
        where: { id: connectionId },
        data: {
          gscStatus: 'ERROR',
          gscLastError: errorMessage,
        },
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
        console.error('GA4 fetch error:', error);
      }
    }

    // Fetch GSC metrics
    if (connection.gscEnabled && connection.gscSiteUrl) {
      try {
        result.gsc = await this.fetchGSCMetrics(connection, dateStr);
      } catch (error) {
        console.error('GSC fetch error:', error);
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

    const client = this.createGA4Client(connection.serviceAccountJson);
    const property = `properties/${connection.ga4PropertyId}`;

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

    const client = this.createGSCClient(connection.serviceAccountJson);

    const response = await client.searchanalytics.query({
      siteUrl: connection.gscSiteUrl,
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
