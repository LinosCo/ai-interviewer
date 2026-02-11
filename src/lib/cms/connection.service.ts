import { prisma } from '@/lib/prisma';
import { CMSConnectionStatus, CMSSuggestionType, WebhookDirection } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { MCPGatewayService } from '@/lib/integrations/mcp/gateway.service';
import { WORDPRESS_TOOLS } from '@/lib/integrations/mcp/wordpress.adapter';
import { WOOCOMMERCE_TOOLS } from '@/lib/integrations/mcp/woocommerce.adapter';
import {
    defaultPublicationRouting,
    inferContentKind,
    normalizePublicationRouting,
    resolvePublishingCapabilities,
    type PublicationRouting
} from './publishing';
import {
    encrypt,
    decrypt,
    generateApiKey,
    generateWebhookSecret
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
    markPublished?: boolean;
    error?: string;
}

interface MCPLookupResult {
    contentId?: string;
    previewUrl?: string;
}

export class CMSConnectionService {
    private static readonly INTERNAL_LANDING_CMS_API_URLS = new Set([
        'internal://landing',
        'internal://business-tuner-landing',
        'internal:landing'
    ]);

    private static isInternalLandingConnection(connection: { cmsApiUrl?: string | null }): boolean {
        const url = String(connection.cmsApiUrl || '').trim().toLowerCase();
        return this.INTERNAL_LANDING_CMS_API_URLS.has(url);
    }

    /**
     * Create a new CMS connection for an organization.
     * Returns the credentials that should be shown only once.
     */
    static async createConnection(input: CreateConnectionInput): Promise<CreateConnectionResult> {
        const { projectId, name, cmsApiUrl, cmsDashboardUrl, cmsPublicUrl, notes, enabledBy } = input;

        // Get project to find organization
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { cmsConnection: true }
        });

        if (!project) throw new Error('Project not found');
        if (project.cmsConnection) throw new Error('Project already has a CMS connection');
        if (!project.organizationId) throw new Error('Project must belong to an organization');

        // Generate credentials
        const apiKey = generateApiKey('bt_live_');
        const webhookSecret = generateWebhookSecret();

        // Create connection record
        const connection = await (prisma.cMSConnection as any).create({
            data: {
                organizationId: project.organizationId,
                projectId,
                name,
                cmsApiUrl,
                cmsDashboardUrl,
                cmsPublicUrl,
                apiKey: encrypt(apiKey),
                apiKeyPrefix: 'bt_live_',
                apiKeyLastChars: apiKey.slice(-4),
                webhookSecret: encrypt(webhookSecret),
                webhookUrl: '', // Will be updated
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
            if (this.isInternalLandingConnection(connection)) {
                await prisma.cMSConnection.update({
                    where: { id: connectionId },
                    data: {
                        status: 'ACTIVE',
                        lastPingAt: new Date(),
                        lastSyncError: null,
                        capabilities: ['internal-landing'],
                        cmsVersion: 'internal'
                    }
                });

                return {
                    success: true,
                    status: 'ok',
                    message: 'Connessione interna landing attiva',
                    details: {
                        cmsVersion: 'internal',
                        capabilities: ['internal-landing'],
                        responseTime: Date.now() - startTime
                    }
                };
            }

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

            // Additional validation of the response body to avoid false positives
            if (data.status === 'error' || data.success === false) {
                const errorMsg = data.message || 'CMS ha restituito un errore nel corpo della risposta';
                await this.updateConnectionStatus(connectionId, 'ERROR', errorMsg);
                return {
                    success: false,
                    status: 'error',
                    message: errorMsg
                };
            }

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
     * Transfer CMS connection to another project.
     * Validates permissions and target project availability.
     */
    static async transferConnection(
        connectionId: string,
        targetProjectId: string,
        userId: string,
        mode: 'MOVE' | 'ASSOCIATE' = 'MOVE'
    ): Promise<{ success: boolean; error?: string }> {
        // Get source connection with project and organization
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: {
                organization: true,
                project: true
            } as any
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission in the connection's organization
        const orgMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: connection.organizationId || '',
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!orgMembership) {
            return { success: false, error: 'Insufficient permissions in the source organization' };
        }

        // Get target project
        const targetProject = await prisma.project.findUnique({
            where: { id: targetProjectId },
            include: { organization: true }
        });

        if (!targetProject) {
            return { success: false, error: 'Target project not found' };
        }

        // Verify target project is in the same organization (as per user request)
        if (targetProject.organizationId !== connection.organizationId) {
            return { success: false, error: 'Target project must be in the same organization as the CMS connection' };
        }

        // Verify user has permission in the target project/org (already checked org permission, so we're good)

        // Perform move or association
        if (mode === 'MOVE') {
            // Remove connection from all other projects first if we want strict MOVE
            // Or just remove from the "current" ones. 
            // For now, let's just associate it with the new one. 
            // If the user wants to remove others, they can do it via a separate UI action.
        }

        await (prisma.cMSConnection as any).update({
            where: { id: connectionId },
            data: { projectId: targetProjectId }
        });

        // Log the action
        await prisma.integrationLog.create({
            data: {
                cmsConnectionId: connectionId,
                action: mode === 'MOVE' ? 'connection.transferred' : 'connection.associated',
                success: true,
                durationMs: 0,
                result: {
                    toProjectId: targetProjectId,
                    organizationId: connection.organizationId,
                    performedBy: userId
                }
            }
        });

        return { success: true };
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

    private static normalizeSourceSignals(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...(value as Record<string, unknown>) };
    }

    private static parseMcpResult(data: unknown): MCPLookupResult {
        if (!data || typeof data !== 'object') return {};
        const candidateObjects: Array<Record<string, unknown>> = [];
        const maybeData = data as Record<string, unknown>;

        const directContent = maybeData.content;
        if (Array.isArray(directContent)) {
            for (const item of directContent) {
                if (!item || typeof item !== 'object') continue;
                const typed = item as Record<string, unknown>;
                if (typed.data && typeof typed.data === 'object') {
                    if (Array.isArray(typed.data)) {
                        for (const entry of typed.data) {
                            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                                candidateObjects.push(entry as Record<string, unknown>);
                            }
                        }
                    } else {
                        candidateObjects.push(typed.data as Record<string, unknown>);
                    }
                }
                if (typeof typed.text === 'string') {
                    const text = typed.text.trim();
                    if (text.startsWith('{') || text.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(text);
                            if (Array.isArray(parsed)) {
                                for (const entry of parsed) {
                                    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                                        candidateObjects.push(entry as Record<string, unknown>);
                                    }
                                }
                            } else if (parsed && typeof parsed === 'object') {
                                candidateObjects.push(parsed as Record<string, unknown>);
                            }
                        } catch {
                            // ignore malformed text payload
                        }
                    }
                }
            }
        }

        const extractString = (obj: Record<string, unknown>, keys: string[]): string | undefined => {
            for (const key of keys) {
                const value = obj[key];
                if (typeof value === 'string' && value.trim().length > 0) return value.trim();
                if (typeof value === 'number' && Number.isFinite(value)) return String(value);
                if (Array.isArray(value)) {
                    for (const entry of value) {
                        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                            const nestedArrayValue = extractString(entry as Record<string, unknown>, keys);
                            if (nestedArrayValue) return nestedArrayValue;
                        }
                    }
                }
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const nested = value as Record<string, unknown>;
                    const nestedValue = extractString(nested, keys);
                    if (nestedValue) return nestedValue;
                }
            }
            return undefined;
        };

        for (const obj of candidateObjects) {
            const contentId = extractString(obj, ['id', 'postId', 'productId', 'contentId', 'ID']);
            const previewUrl = extractString(obj, ['previewUrl', 'url', 'link', 'permalink']);
            if (contentId || previewUrl) {
                return { contentId, previewUrl };
            }
        }

        return {};
    }

    private static buildCmsPayload(
        suggestion: any,
        routing: PublicationRouting,
        sourceSignals: Record<string, unknown>
    ) {
        return {
            btSuggestionId: suggestion.id,
            type: suggestion.type,
            title: suggestion.title,
            slug: suggestion.slug,
            body: suggestion.body,
            metaDescription: suggestion.metaDescription,
            targetSection: suggestion.targetSection,
            reasoning: suggestion.reasoning,
            priorityScore: suggestion.priorityScore,
            publishRouting: routing,
            mediaBrief: sourceSignals.mediaBrief || null,
            strategyAlignment: sourceSignals.strategyAlignment || null,
            explainability: sourceSignals.explainability || null
        };
    }

    private static async pushToCmsApi(
        suggestion: any,
        routing: PublicationRouting,
        sourceSignals: Record<string, unknown>
    ): Promise<PushSuggestionResult> {
        const payload = this.buildCmsPayload(suggestion, routing, sourceSignals);
        const response = await fetch(`${suggestion.connection.cmsApiUrl}/suggestions`, {
            method: 'POST',
            headers: {
                'X-BT-API-Key': decrypt(suggestion.connection.apiKey),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        await this.logWebhook(
            suggestion.connectionId,
            'OUTBOUND',
            'suggestion.push.cms_api',
            response.ok,
            payload,
            response.status,
            undefined,
            response.ok ? undefined : `HTTP ${response.status}`
        );

        if (!response.ok) {
            return { success: false, error: `CMS returned ${response.status}` };
        }

        const data = await response.json().catch(() => ({}));
        return {
            success: true,
            cmsContentId: typeof data?.contentId === 'string' ? data.contentId : undefined,
            previewUrl: typeof data?.previewUrl === 'string' ? data.previewUrl : undefined
        };
    }

    private static async pushToInternalLanding(
        suggestion: any,
        routing: PublicationRouting,
        sourceSignals: Record<string, unknown>
    ): Promise<PushSuggestionResult> {
        const baseCandidate = typeof suggestion.connection?.cmsPublicUrl === 'string'
            ? suggestion.connection.cmsPublicUrl.trim()
            : '';
        const fallbackBase = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';
        const baseUrl = (baseCandidate.startsWith('http') ? baseCandidate : fallbackBase).replace(/\/+$/, '');
        const slug = suggestion.slug || suggestion.id;
        const section = String(suggestion.targetSection || routing.targetSection || '').toLowerCase();
        const previewPath = section.includes('news') ? `/#news-${slug}` : '/#news';

        await this.logWebhook(
            suggestion.connectionId,
            'OUTBOUND',
            'suggestion.push.internal_landing',
            true,
            this.buildCmsPayload(suggestion, routing, sourceSignals),
            200
        );

        return {
            success: true,
            cmsContentId: suggestion.id,
            previewUrl: `${baseUrl}${previewPath}`,
            markPublished: true
        };
    }

    private static async pushToWordPress(
        suggestion: any,
        routing: PublicationRouting,
        wordPressConnectionId: string
    ): Promise<PushSuggestionResult> {
        const kind = routing.contentKind;
        const isPageKind = routing.wpPostType === 'page'
            || kind === 'STATIC_PAGE'
            || kind === 'FAQ_PAGE'
            || kind === 'SCHEMA_PATCH'
            || kind === 'SEO_PATCH';
        const toolName = isPageKind ? WORDPRESS_TOOLS.CREATE_PAGE : WORDPRESS_TOOLS.CREATE_POST;

        const args: Record<string, unknown> = {
            title: suggestion.title,
            content: suggestion.body,
            status: 'draft'
        };
        if (suggestion.slug) args.slug = suggestion.slug;
        if (suggestion.metaDescription) args.excerpt = suggestion.metaDescription;

        const result = await MCPGatewayService.callTool(wordPressConnectionId, toolName, args);
        if (!result.success || !result.data || result.data.isError) {
            return { success: false, error: result.error || 'WordPress MCP call failed' };
        }

        const parsed = this.parseMcpResult(result.data);
        return {
            success: true,
            cmsContentId: parsed.contentId,
            previewUrl: parsed.previewUrl
        };
    }

    private static async resolveWooProductId(
        wooConnectionId: string,
        routing: PublicationRouting
    ): Promise<string | null> {
        if (routing.targetEntityId) return routing.targetEntityId;
        if (!routing.targetEntitySlug) return null;

        const listResult = await MCPGatewayService.callTool(
            wooConnectionId,
            WOOCOMMERCE_TOOLS.LIST_PRODUCTS,
            { search: routing.targetEntitySlug, per_page: 20 }
        );

        if (!listResult.success || !listResult.data || listResult.data.isError) {
            return null;
        }

        const parsed = this.parseMcpResult(listResult.data);
        return parsed.contentId || null;
    }

    private static async pushToWooCommerce(
        suggestion: any,
        routing: PublicationRouting,
        wooConnectionId: string
    ): Promise<PushSuggestionResult> {
        if (routing.contentKind !== 'PRODUCT_DESCRIPTION') {
            return { success: false, error: 'WooCommerce is available only for product content suggestions' };
        }

        const productId = await this.resolveWooProductId(wooConnectionId, routing);
        if (!productId) {
            return {
                success: false,
                error: 'Product target missing. Set targetEntityId or targetEntitySlug before pushing to WooCommerce.'
            };
        }

        const args: Record<string, unknown> = {
            id: productId,
            description: suggestion.body
        };
        if (suggestion.metaDescription) args.short_description = suggestion.metaDescription;
        if (suggestion.title) args.name = suggestion.title;
        if (suggestion.slug) args.slug = suggestion.slug;

        const result = await MCPGatewayService.callTool(
            wooConnectionId,
            WOOCOMMERCE_TOOLS.UPDATE_PRODUCT,
            args
        );

        if (!result.success || !result.data || result.data.isError) {
            return { success: false, error: result.error || 'WooCommerce MCP call failed' };
        }

        const parsed = this.parseMcpResult(result.data);
        return {
            success: true,
            cmsContentId: parsed.contentId || productId,
            previewUrl: parsed.previewUrl
        };
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

        const sourceSignals = this.normalizeSourceSignals(suggestion.sourceSignals);
        const projectIdFromSignals = typeof sourceSignals.projectId === 'string'
            ? sourceSignals.projectId
            : null;
        const projectId = projectIdFromSignals || suggestion.connection.projectId || null;

        const capabilities = await resolvePublishingCapabilities({
            projectId,
            hasCmsApi: Boolean(suggestion.connection?.id),
            hasGoogleAnalytics: Boolean(suggestion.connection.googleAnalyticsConnected),
            hasSearchConsole: Boolean(suggestion.connection.searchConsoleConnected)
        });

        const inferredKind = inferContentKind({
            suggestionType: suggestion.type as CMSSuggestionType,
            tipType: typeof sourceSignals.tipType === 'string' ? sourceSignals.tipType : undefined,
            targetSection: suggestion.targetSection || undefined,
            title: suggestion.title
        });

        const routing = normalizePublicationRouting(
            sourceSignals.publishRouting,
            inferredKind,
            capabilities,
            suggestion.targetSection || undefined
        );
        const fallbackRouting = defaultPublicationRouting(inferredKind, capabilities, suggestion.targetSection || undefined);
        const effectiveRouting: PublicationRouting = {
            ...fallbackRouting,
            ...routing
        };

        try {
            let result: PushSuggestionResult;

            if (effectiveRouting.publishChannel === 'MANUAL') {
                result = {
                    success: false,
                    error: 'Suggestion is configured for manual handling only. Update routing before push.'
                };
            } else if (effectiveRouting.publishChannel === 'WORDPRESS_MCP') {
                if (!capabilities.wordPressConnectionId) {
                    result = { success: false, error: 'WordPress MCP connection not active for this project' };
                } else {
                    result = await this.pushToWordPress(
                        suggestion,
                        effectiveRouting,
                        capabilities.wordPressConnectionId
                    );
                }
            } else if (effectiveRouting.publishChannel === 'WOOCOMMERCE_MCP') {
                if (!capabilities.wooCommerceConnectionId) {
                    result = { success: false, error: 'WooCommerce MCP connection not active for this project' };
                } else {
                    result = await this.pushToWooCommerce(
                        suggestion,
                        effectiveRouting,
                        capabilities.wooCommerceConnectionId
                    );
                }
            } else {
                if (this.isInternalLandingConnection(suggestion.connection)) {
                    result = await this.pushToInternalLanding(
                        suggestion,
                        effectiveRouting,
                        sourceSignals
                    );
                } else {
                    if (suggestion.connection.status !== 'ACTIVE') {
                        result = {
                            success: false,
                            error: 'CMS connection is not active. Please verify the connection first.'
                        };
                    } else {
                        result = await this.pushToCmsApi(suggestion, effectiveRouting, sourceSignals);
                    }
                }
            }

            if (!result.success) {
                await prisma.cMSSuggestion.update({
                    where: { id: suggestionId },
                    data: { status: 'FAILED' }
                });
                return result;
            }

            const updatedSignals = JSON.parse(JSON.stringify({
                ...sourceSignals,
                publishRouting: effectiveRouting,
                lastPush: {
                    channel: effectiveRouting.publishChannel,
                    pushedAt: new Date().toISOString()
                }
            })) as Prisma.InputJsonValue;

            const now = new Date();
            await prisma.cMSSuggestion.update({
                where: { id: suggestionId },
                data: {
                    status: result.markPublished ? 'PUBLISHED' : 'PUSHED',
                    pushedAt: now,
                    publishedAt: result.markPublished ? now : null,
                    cmsContentId: result.cmsContentId || null,
                    cmsPreviewUrl: result.previewUrl || null,
                    sourceSignals: updatedSignals
                }
            });

            return {
                success: true,
                cmsContentId: result.cmsContentId,
                previewUrl: result.previewUrl
            };

        } catch (error: any) {
            await this.logWebhook(
                suggestion.connectionId,
                'OUTBOUND',
                'suggestion.push',
                false,
                {
                    suggestionId,
                    publishRouting: effectiveRouting
                },
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
        const connection = await (prisma.cMSConnection as any).findFirst({
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
                analyticsRecordsCount: (connection as any)._count.analytics
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
        return (prisma.cMSConnection as any).findMany({
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

    /**
     * NEW MULTI-PROJECT SUPPORT
     * Associate a CMS connection with a project.
     * Allows sharing connections across multiple projects.
     */
    static async associateProject(
        connectionId: string,
        projectId: string,
        userId: string,
        role: 'OWNER' | 'EDITOR' | 'VIEWER' = 'VIEWER'
    ): Promise<{ success: boolean; error?: string }> {
        // Get connection and verify it exists
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: { organization: true }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Get project and verify it exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { organization: true }
        });

        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        // Verify user has permission in the connection's organization
        const orgMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: connection.organizationId || '',
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!orgMembership) {
            return { success: false, error: 'Insufficient permissions in the connection organization' };
        }

        // Check if already associated
        const existing = await prisma.projectCMSConnection.findUnique({
            where: {
                projectId_connectionId: {
                    projectId,
                    connectionId
                }
            }
        });

        if (existing) {
            return { success: false, error: 'Connection already associated with this project' };
        }

        // Create association
        await prisma.projectCMSConnection.create({
            data: {
                projectId,
                connectionId,
                role,
                createdBy: userId
            }
        });

        // Log the action
        await prisma.integrationLog.create({
            data: {
                cmsConnectionId: connectionId,
                action: 'connection.project_associated',
                success: true,
                durationMs: 0,
                result: {
                    projectId,
                    role,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }

    /**
     * Dissociate a CMS connection from a project.
     */
    static async dissociateProject(
        connectionId: string,
        projectId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Verify connection exists
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            select: { organizationId: true }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission
        const orgMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: connection.organizationId || '',
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!orgMembership) {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Delete association
        const deleted = await prisma.projectCMSConnection.deleteMany({
            where: {
                projectId,
                connectionId
            }
        });

        if (deleted.count === 0) {
            return { success: false, error: 'Association not found' };
        }

        // Log the action
        await prisma.integrationLog.create({
            data: {
                cmsConnectionId: connectionId,
                action: 'connection.project_dissociated',
                success: true,
                durationMs: 0,
                result: {
                    projectId,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }

    /**
     * Get all projects associated with a CMS connection.
     */
    static async getAssociatedProjects(connectionId: string) {
        const associations = await prisma.projectCMSConnection.findMany({
            where: { connectionId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return associations.map(assoc => ({
            projectId: assoc.project.id,
            projectName: assoc.project.name,
            organization: assoc.project.organization,
            role: assoc.role,
            associatedAt: assoc.createdAt,
            associatedBy: assoc.createdBy
        }));
    }

    /**
     * Get all CMS connections available to a project.
     * Includes both direct connections and shared connections.
     */
    static async getProjectConnections(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });

        if (!project || !project.organizationId) {
            return [];
        }

        // Get shared connections
        const shared = await prisma.projectCMSConnection.findMany({
            where: { projectId },
            include: {
                connection: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        cmsApiUrl: true,
                        cmsPublicUrl: true,
                        lastSyncAt: true,
                        googleAnalyticsConnected: true,
                        searchConsoleConnected: true
                    }
                }
            }
        });

        return shared.map(s => ({
            ...s.connection,
            associationType: 'SHARED' as const,
            role: s.role,
            associatedAt: s.createdAt
        }));
    }

    /**
     * Transfer CMS connection to another organization.
     * Enhanced version that supports cross-organization transfer.
     */
    static async transferToOrganization(
        connectionId: string,
        targetOrganizationId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Get source connection
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: {
                organization: true,
                projectShares: {
                    include: {
                        project: true
                    }
                }
            }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission in source organization
        if (connection.organizationId) {
            const sourceMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: connection.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            if (!sourceMembership) {
                return { success: false, error: 'Insufficient permissions in source organization' };
            }
        }

        // Verify user has permission in target organization
        const targetMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: targetOrganizationId,
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!targetMembership) {
            return { success: false, error: 'Insufficient permissions in target organization' };
        }

        // Verify target organization exists
        const targetOrg = await prisma.organization.findUnique({
            where: { id: targetOrganizationId }
        });

        if (!targetOrg) {
            return { success: false, error: 'Target organization not found' };
        }

        // Remove all project associations (they belong to the old org)
        await prisma.projectCMSConnection.deleteMany({
            where: { connectionId }
        });

        // Transfer the connection
        await prisma.cMSConnection.update({
            where: { id: connectionId },
            data: {
                organizationId: targetOrganizationId,
                projectId: null // Clear direct project association
            }
        });

        // Log the action
        await prisma.integrationLog.create({
            data: {
                cmsConnectionId: connectionId,
                action: 'connection.organization_transferred',
                success: true,
                durationMs: 0,
                result: {
                    fromOrganizationId: connection.organizationId,
                    toOrganizationId: targetOrganizationId,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }
}
