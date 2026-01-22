import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from './encryption';

export interface GAMetrics {
    pageviews: number;
    uniqueVisitors: number;
    avgSessionDuration: number;
    bounceRate: number;
    topPages: { path: string; views: number; avgTime: number; bounceRate: number }[];
    trafficSources: { organic: number; direct: number; referral: number; social: number; other: number };
}

export interface GoogleProperty {
    id: string;
    name: string;
    displayName: string;
}

export interface GoogleAccount {
    id: string;
    name: string;
    properties: GoogleProperty[];
}

export class GoogleAnalyticsService {
    private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/cms/google/callback`
        );
    }

    /**
     * Generate OAuth URL for Google authorization.
     * State contains the connection ID for the callback.
     */
    getAuthUrl(connectionId: string): string {
        const scopes = [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/webmasters.readonly',
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent', // Force refresh token
            state: connectionId
        });
    }

    /**
     * Handle OAuth callback and save tokens.
     */
    async handleOAuthCallback(code: string, connectionId: string): Promise<void> {
        const { tokens } = await this.oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token received. User may need to revoke access and re-authorize.');
        }

        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                googleRefreshToken: encrypt(tokens.refresh_token),
                googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                googleScopes: ['analytics.readonly', 'webmasters.readonly']
            }
        });
    }

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
     * List available GA4 properties.
     */
    async listProperties(connectionId: string): Promise<GoogleAccount[]> {
        const auth = await this.getAuthenticatedClient(connectionId);
        const adminClient = google.analyticsadmin({ version: 'v1beta', auth });

        const accountsResponse = await adminClient.accounts.list();
        const accounts: GoogleAccount[] = [];

        for (const account of accountsResponse.data.accounts || []) {
            const propertiesResponse = await adminClient.properties.list({
                filter: `parent:${account.name}`
            });

            accounts.push({
                id: account.name || '',
                name: account.displayName || 'Unknown Account',
                properties: (propertiesResponse.data.properties || []).map(p => ({
                    id: p.name || '',
                    name: p.name?.split('/')[1] || '',
                    displayName: p.displayName || 'Unknown Property'
                }))
            });
        }

        return accounts;
    }

    /**
     * Configure GA4 property for a connection.
     */
    async configureProperty(connectionId: string, propertyId: string): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                googleAnalyticsPropertyId: propertyId,
                googleAnalyticsConnected: true
            }
        });
    }

    /**
     * Fetch daily metrics from GA4.
     */
    async fetchDailyMetrics(connectionId: string, date: Date): Promise<GAMetrics> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection?.googleAnalyticsPropertyId || !connection.googleRefreshToken) {
            throw new Error('Google Analytics not configured');
        }

        const auth = await this.getAuthenticatedClient(connectionId);

        // Create Analytics Data client with credentials
        const analyticsDataClient = new BetaAnalyticsDataClient({
            authClient: auth as any
        });

        const dateStr = date.toISOString().split('T')[0];

        // Fetch main metrics
        const [metricsResponse] = await analyticsDataClient.runReport({
            property: connection.googleAnalyticsPropertyId,
            dateRanges: [{ startDate: dateStr, endDate: dateStr }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'totalUsers' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' }
            ]
        });

        const row = metricsResponse.rows?.[0];
        const pageviews = parseInt(row?.metricValues?.[0]?.value || '0');
        const uniqueVisitors = parseInt(row?.metricValues?.[1]?.value || '0');
        const avgSessionDuration = Math.round(parseFloat(row?.metricValues?.[2]?.value || '0'));
        const bounceRate = parseFloat(row?.metricValues?.[3]?.value || '0');

        // Fetch top pages
        const [pagesResponse] = await analyticsDataClient.runReport({
            property: connection.googleAnalyticsPropertyId,
            dateRanges: [{ startDate: dateStr, endDate: dateStr }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' }
            ],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 20
        });

        const topPages = (pagesResponse.rows || []).map(r => ({
            path: r.dimensionValues?.[0]?.value || '/',
            views: parseInt(r.metricValues?.[0]?.value || '0'),
            avgTime: Math.round(parseFloat(r.metricValues?.[1]?.value || '0')),
            bounceRate: parseFloat(r.metricValues?.[2]?.value || '0')
        }));

        // Fetch traffic sources
        const [trafficResponse] = await analyticsDataClient.runReport({
            property: connection.googleAnalyticsPropertyId,
            dateRanges: [{ startDate: dateStr, endDate: dateStr }],
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            metrics: [{ name: 'sessions' }]
        });

        const trafficSources = {
            organic: 0,
            direct: 0,
            referral: 0,
            social: 0,
            other: 0
        };

        for (const r of trafficResponse.rows || []) {
            const channel = (r.dimensionValues?.[0]?.value || '').toLowerCase();
            const sessions = parseInt(r.metricValues?.[0]?.value || '0');

            if (channel.includes('organic')) {
                trafficSources.organic += sessions;
            } else if (channel.includes('direct')) {
                trafficSources.direct += sessions;
            } else if (channel.includes('referral')) {
                trafficSources.referral += sessions;
            } else if (channel.includes('social')) {
                trafficSources.social += sessions;
            } else {
                trafficSources.other += sessions;
            }
        }

        return {
            pageviews,
            uniqueVisitors,
            avgSessionDuration,
            bounceRate,
            topPages,
            trafficSources
        };
    }

    /**
     * Disconnect Google from a connection.
     */
    async disconnect(connectionId: string): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                googleRefreshToken: null,
                googleTokenExpiresAt: null,
                googleScopes: [],
                googleAnalyticsPropertyId: null,
                googleAnalyticsConnected: false,
                searchConsoleSiteUrl: null,
                searchConsoleConnected: false
            }
        });
    }
}

// Singleton instance
export const googleAnalyticsService = new GoogleAnalyticsService();
