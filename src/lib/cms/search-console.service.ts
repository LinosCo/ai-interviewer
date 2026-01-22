import { google, searchconsole_v1 } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { decrypt } from './encryption';

export interface SCMetrics {
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
    topQueries: { query: string; impressions: number; clicks: number; ctr: number; position: number }[];
    topPages: { page: string; impressions: number; clicks: number; ctr: number; position: number }[];
}

export interface SearchConsoleSite {
    url: string;
    permissionLevel: string;
}

export class SearchConsoleService {
    /**
     * Get authenticated client for a connection.
     */
    private async getAuthenticatedClient(connectionId: string): Promise<InstanceType<typeof google.auth.OAuth2>> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection?.googleRefreshToken) {
            throw new Error('Google not connected for this CMS connection');
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            refresh_token: decrypt(connection.googleRefreshToken)
        });

        return oauth2Client;
    }

    /**
     * List available sites in Search Console.
     */
    async listSites(connectionId: string): Promise<SearchConsoleSite[]> {
        const auth = await this.getAuthenticatedClient(connectionId);
        const searchconsole = google.searchconsole({ version: 'v1', auth });

        const response = await searchconsole.sites.list();
        const sites = response.data.siteEntry || [];

        return sites.map(site => ({
            url: site.siteUrl || '',
            permissionLevel: site.permissionLevel || 'unknown'
        })).filter(s => s.permissionLevel !== 'siteUnverifiedUser');
    }

    /**
     * Configure Search Console site for a connection.
     */
    async configureSite(connectionId: string, siteUrl: string): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                searchConsoleSiteUrl: siteUrl,
                searchConsoleConnected: true
            }
        });
    }

    /**
     * Fetch daily metrics from Search Console.
     */
    async fetchDailyMetrics(connectionId: string, date: Date): Promise<SCMetrics> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection?.searchConsoleSiteUrl || !connection.googleRefreshToken) {
            throw new Error('Search Console not configured');
        }

        const auth = await this.getAuthenticatedClient(connectionId);
        const searchconsole = google.searchconsole({ version: 'v1', auth });

        const dateStr = date.toISOString().split('T')[0];

        // Fetch aggregate metrics
        const aggregateResponse = await searchconsole.searchanalytics.query({
            siteUrl: connection.searchConsoleSiteUrl,
            requestBody: {
                startDate: dateStr,
                endDate: dateStr,
                dimensions: [],
                rowLimit: 1
            }
        });

        const aggregateRow = aggregateResponse.data.rows?.[0];
        const impressions = aggregateRow?.impressions || 0;
        const clicks = aggregateRow?.clicks || 0;
        const ctr = aggregateRow?.ctr || 0;
        const avgPosition = aggregateRow?.position || 0;

        // Fetch top queries
        const queriesResponse = await searchconsole.searchanalytics.query({
            siteUrl: connection.searchConsoleSiteUrl,
            requestBody: {
                startDate: dateStr,
                endDate: dateStr,
                dimensions: ['query'],
                rowLimit: 50
            }
        });

        const topQueries = (queriesResponse.data.rows || []).map(r => ({
            query: r.keys?.[0] || '',
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            ctr: r.ctr || 0,
            position: r.position || 0
        }));

        // Fetch top pages
        const pagesResponse = await searchconsole.searchanalytics.query({
            siteUrl: connection.searchConsoleSiteUrl,
            requestBody: {
                startDate: dateStr,
                endDate: dateStr,
                dimensions: ['page'],
                rowLimit: 50
            }
        });

        const topPages = (pagesResponse.data.rows || []).map(r => ({
            page: r.keys?.[0] || '',
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            ctr: r.ctr || 0,
            position: r.position || 0
        }));

        return {
            impressions,
            clicks,
            ctr,
            avgPosition,
            topQueries,
            topPages
        };
    }

    /**
     * Fetch metrics for a date range (for trends).
     */
    async fetchRangeMetrics(
        connectionId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{ date: string; impressions: number; clicks: number; ctr: number; position: number }[]> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection?.searchConsoleSiteUrl || !connection.googleRefreshToken) {
            throw new Error('Search Console not configured');
        }

        const auth = await this.getAuthenticatedClient(connectionId);
        const searchconsole = google.searchconsole({ version: 'v1', auth });

        const response = await searchconsole.searchanalytics.query({
            siteUrl: connection.searchConsoleSiteUrl,
            requestBody: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                dimensions: ['date'],
                rowLimit: 1000
            }
        });

        return (response.data.rows || []).map(r => ({
            date: r.keys?.[0] || '',
            impressions: r.impressions || 0,
            clicks: r.clicks || 0,
            ctr: r.ctr || 0,
            position: r.position || 0
        }));
    }
}

// Singleton instance
export const searchConsoleService = new SearchConsoleService();
