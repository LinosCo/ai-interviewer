import { prisma } from '@/lib/prisma';
import { CMSConnectionStatus, WebhookDirection } from '@prisma/client';
import {
    encrypt,
    decrypt,
    generateApiKey,
    generateWebhookSecret,
    createWebhookSignature
} from './encryption';

export interface CreateConnectionInput {
    projectId: string;
    name: string;
    cmsApiUrl: string;
    cmsDashboardUrl?: string;
    cmsPublicUrl?: string;
    notes?: string;
    enabledBy: string;
}

export interface CreateConnectionResult {
    success: true;
    connectionId: string;
    credentials: {
        apiKey: string;
        webhookUrl: string;
        webhookSecret: string;
    };
    envSnippet: string;
}

export interface TestConnectionResult {
    success: boolean;
    status: 'ok' | 'auth_failed' | 'unreachable' | 'error';
    message: string;
    details?: {
        cmsVersion?: string;
        capabilities?: string[];
        responseTime?: number;
    };
}

export interface PushSuggestionResult {
    success: boolean;
    cmsContentId?: string;
    previewUrl?: string;
    error?: string;
}

export class CMSConnectionService {
    /**
     * Create a new CMS connection for an organization.
     * Returns the credentials that should be shown only once.
     */
    static async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
        const { projectId, name, cmsApiUrl, cmsDashboardUrl, cmsPublicUrl, notes, enabledBy } = input;

        // Check if project already has a CMS connection
        const existing = await prisma.cMSConnection.findUnique({
            where: { projectId }
        });

        if (existing) {
            throw new Error('Project already has a CMS connection');
        }

        // Generate credentials
        const apiKey = generateApiKey('bt_live_');
        const webhookSecret = generateWebhookSecret();

        // Create connection record (we'll get the ID from Prisma)
        const connection = await prisma.cMSConnection.create({
            data: {
                projectId,
                name,
                cmsApiUrl,
                cmsDashboardUrl,
                cmsPublicUrl,
                apiKey: encrypt(apiKey),
                apiKeyPrefix: 'bt_live_',
                apiKeyLastChars: apiKey.slice(-4),
                webhookSecret: encrypt(webhookSecret),
                webhookUrl: '', // Will be updated after we have the ID
                googleScopes: [],
                capabilities: [],
                notes,
                enabledBy,
                status: 'PENDING'
            }
        });

        // Update webhook URL with connection ID
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.businesstuner.io'}/api/webhooks/cms/${connection.id}`;

        await prisma.cMSConnection.update({
            where: { id: connection.id },
            data: { webhookUrl }
        });

        // Generate .env snippet
        const envSnippet = `# Business Tuner Integration
BUSINESS_TUNER_API_KEY=${apiKey}
BUSINESS_TUNER_WEBHOOK_URL=${webhookUrl}
BUSINESS_TUNER_WEBHOOK_SECRET=${webhookSecret}
BUSINESS_TUNER_URL=${process.env.NEXT_PUBLIC_APP_URL || 'https://app.businesstuner.io'}`;

        return {
            success: true,
            connectionId: connection.id,
            credentials: {
                apiKey,
                webhookUrl,
                webhookSecret
            },
            envSnippet
        };
    }

    /**
     * Test the connection to a CMS by calling its /status endpoint.
     */
    static async testConnection(connectionId: string): Promise<TestConnectionResult> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection) {
            return { success: false, status: 'error', message: 'Connection not found' };
        }

        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${connection.cmsApiUrl}/status`, {
                method: 'GET',
                headers: {
                    'X-BT-API-Key': decrypt(connection.apiKey),
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (response.status === 401) {
                await this.updateConnectionStatus(connectionId, 'ERROR', 'API key non valida');
                return {
                    success: false,
                    status: 'auth_failed',
                    message: 'API key non riconosciuta dal CMS'
                };
            }

            if (!response.ok) {
                await this.updateConnectionStatus(connectionId, 'ERROR', `HTTP ${response.status}`);
                return {
                    success: false,
                    status: 'error',
                    message: `CMS ha risposto con errore ${response.status}`
                };
            }

            const data = await response.json();

            // Update connection with capabilities and status
            await prisma.cMSConnection.update({
                where: { id: connectionId },
                data: {
                    status: 'ACTIVE',
                    lastPingAt: new Date(),
                    lastSyncError: null,
                    capabilities: data.capabilities || [],
                    cmsVersion: data.version || null
                }
            });

            return {
                success: true,
                status: 'ok',
                message: 'Connessione verificata',
                details: {
                    cmsVersion: data.version,
                    capabilities: data.capabilities,
                    responseTime
                }
            };

        } catch (error: any) {
            const message = error.name === 'AbortError'
                ? 'CMS non raggiungibile (timeout)'
                : `Errore di rete: ${error.message}`;

            await this.updateConnectionStatus(connectionId, 'ERROR', message);

            return {
                success: false,
                status: 'unreachable',
                message
            };
        }
    }

    /**
     * Regenerate the API key for a connection.
     * This invalidates the previous key.
     */
    static async regenerateApiKey(connectionId: string): Promise<{
        success: true;
        newApiKey: string;
        envSnippet: string;
    }> {
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId }
        });

        if (!connection) {
            throw new Error('Connection not found');
        }

        const newApiKey = generateApiKey('bt_live_');

        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                apiKey: encrypt(newApiKey),
                apiKeyLastChars: newApiKey.slice(-4),
                status: 'PENDING' // Require re-testing after key change
            }
        });

        const envSnippet = `# Business Tuner Integration (API Key Updated)
BUSINESS_TUNER_API_KEY=${newApiKey}
BUSINESS_TUNER_WEBHOOK_URL=${connection.webhookUrl}
BUSINESS_TUNER_WEBHOOK_SECRET=<existing-secret>
BUSINESS_TUNER_URL=${process.env.NEXT_PUBLIC_APP_URL || 'https://app.businesstuner.io'}`;

        return {
            success: true,
            newApiKey,
            envSnippet
        };
    }

    /**
     * Disable a CMS connection.
     */
    static async disableConnection(connectionId: string): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: { status: 'DISABLED' }
        });
    }

    /**
     * Enable a previously disabled CMS connection.
     */
    static async enableConnection(connectionId: string): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: { status: 'PENDING' } // Require re-testing
        });
    }

    /**
     * Delete a CMS connection for a project.
     */
    static async deleteConnection(connectionId: string): Promise<void> {
        // Delete connection (cascades to suggestions, analytics, logs)
        await prisma.cMSConnection.delete({
            where: { id: connectionId }
        });
    }

    /**
     * Push a suggestion to the CMS as a draft.
     */
    static async pushSuggestion(suggestionId: string): Promise<PushSuggestionResult> {
        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id: suggestionId },
            include: { connection: true }
        });

        if (!suggestion) {
            return { success: false, error: 'Suggestion not found' };
        }

        if (!suggestion.connection) {
            return { success: false, error: 'CMS connection not found' };
        }

        if (suggestion.status !== 'PENDING') {
            return { success: false, error: `Suggestion already ${suggestion.status.toLowerCase()}` };
        }

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

        try {
            const response = await fetch(`${suggestion.connection.cmsApiUrl}/suggestions`, {
                method: 'POST',
                headers: {
                    'X-BT-API-Key': decrypt(suggestion.connection.apiKey),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            // Log the outbound webhook
            await this.logWebhook(
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
                return { success: false, error: `CMS returned ${response.status}` };
            }

            const data = await response.json();

            await prisma.cMSSuggestion.update({
                where: { id: suggestionId },
                data: {
                    status: 'PUSHED',
                    pushedAt: new Date(),
                    cmsContentId: data.contentId,
                    cmsPreviewUrl: data.previewUrl
                }
            });

            return {
                success: true,
                cmsContentId: data.contentId,
                previewUrl: data.previewUrl
            };

        } catch (error: any) {
            await this.logWebhook(
                suggestion.connectionId,
                'OUTBOUND',
                'suggestion.push',
                false,
                payload,
                undefined,
                undefined,
                error.message
            );

            await prisma.cMSSuggestion.update({
                where: { id: suggestionId },
                data: { status: 'FAILED' }
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Update connection status with error message.
     */
    private static async updateConnectionStatus(
        connectionId: string,
        status: CMSConnectionStatus,
        errorMessage?: string
    ): Promise<void> {
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                status,
                lastSyncError: errorMessage
            }
        });
    }

    /**
     * Log a webhook event for audit purposes.
     */
    static async logWebhook(
        connectionId: string,
        direction: WebhookDirection,
        event: string,
        success: boolean,
        requestPayload?: any,
        responseStatus?: number,
        responseBody?: string,
        errorMessage?: string
    ): Promise<void> {
        await prisma.cMSWebhookLog.create({
            data: {
                connectionId,
                direction,
                event,
                success,
                requestPayload,
                responseStatus,
                responseBody,
                errorMessage
            }
        });
    }

    /**
     * Get the full status of a CMS connection.
     */
    static async getConnectionStatus(projectId: string) {
        const connection = await prisma.cMSConnection.findUnique({
            where: { projectId },
            include: {
                _count: {
                    select: {
                        suggestions: true,
                        analytics: true
                    }
                }
            }
        });

        if (!connection) {
            return null;
        }

        // Get suggestion stats
        const suggestionStats = await prisma.cMSSuggestion.groupBy({
            by: ['status'],
            where: { connectionId: connection.id },
            _count: { status: true }
        });

        const statsMap = suggestionStats.reduce((acc, s) => {
            acc[s.status] = s._count.status;
            return acc;
        }, {} as Record<string, number>);

        return {
            connection: {
                id: connection.id,
                name: connection.name,
                status: connection.status,
                cmsApiUrl: connection.cmsApiUrl,
                cmsDashboardUrl: connection.cmsDashboardUrl,
                cmsPublicUrl: connection.cmsPublicUrl,
                apiKeyPreview: `${connection.apiKeyPrefix}...${connection.apiKeyLastChars}`,
                webhookUrl: connection.webhookUrl,
                lastPingAt: connection.lastPingAt,
                lastSyncAt: connection.lastSyncAt,
                lastSyncError: connection.lastSyncError,
                capabilities: connection.capabilities,
                cmsVersion: connection.cmsVersion
            },
            google: {
                analyticsConnected: connection.googleAnalyticsConnected,
                analyticsPropertyId: connection.googleAnalyticsPropertyId,
                searchConsoleConnected: connection.searchConsoleConnected,
                searchConsoleSiteUrl: connection.searchConsoleSiteUrl
            },
            stats: {
                suggestionsPending: statsMap['PENDING'] || 0,
                suggestionsPushed: statsMap['PUSHED'] || 0,
                suggestionsPublished: statsMap['PUBLISHED'] || 0,
                suggestionsRejected: statsMap['REJECTED'] || 0,
                suggestionsFailed: statsMap['FAILED'] || 0,
                analyticsRecordsCount: connection._count.analytics
            },
            audit: {
                enabledAt: connection.enabledAt,
                enabledBy: connection.enabledBy,
                notes: connection.notes
            }
        };
    }

    /**
     * Get all CMS connections (for admin panel).
     */
    static async getAllConnections() {
        return prisma.cMSConnection.findMany({
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        },
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        suggestions: true,
                        analytics: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
