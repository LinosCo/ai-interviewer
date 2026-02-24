/**
 * N8N Webhook Dispatcher
 *
 * Sends AI tips and publication events to configured n8n webhook endpoints.
 * Used as middleware for social media distribution (LinkedIn, Instagram, Twitter, Facebook)
 * via n8n workflows.
 *
 * Non-blocking: failures are logged but never block the primary operation.
 */

import { prisma } from '@/lib/prisma';

export interface TipPayload {
    id: string;
    title: string;
    content: string;
    contentKind: string;
    targetChannel?: string;
    metaDescription?: string;
    suggestedHashtags?: string[];
    url?: string;
}

export interface PublicationEvent {
    title: string;
    url?: string;
    type: 'post' | 'page' | 'product';
    excerpt?: string;
    channel: string;
    contentId?: string;
}

interface WebhookPayload {
    event: string;
    timestamp: string;
    project: { id: string; name: string };
    [key: string]: unknown;
}

export class N8NDispatcher {
    /**
     * Dispatch AI-generated tips to the n8n webhook.
     * Called after the sync engine or suggestion generator creates tips.
     */
    static async dispatchTips(
        projectId: string,
        tips: TipPayload[]
    ): Promise<void> {
        if (!tips.length) return;

        const connection = await this.getActiveConnection(projectId);
        if (!connection || !connection.triggerOnTips) return;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });

        const payload: WebhookPayload = {
            event: 'ai_tips_generated',
            timestamp: new Date().toISOString(),
            project: { id: projectId, name: project?.name || 'Unknown' },
            tips: tips.map(tip => ({
                id: tip.id,
                title: tip.title,
                content: tip.content,
                contentKind: tip.contentKind,
                targetChannel: tip.targetChannel || null,
                metaDescription: tip.metaDescription || null,
                suggestedHashtags: tip.suggestedHashtags || [],
                url: tip.url || null
            }))
        };

        await this.sendWebhook(connection.id, connection.webhookUrl, payload);
    }

    /**
     * Dispatch a publication event when content is published via any channel.
     * Called after pushSuggestion() succeeds.
     */
    static async dispatchPublicationEvent(
        projectId: string,
        event: PublicationEvent
    ): Promise<void> {
        const connection = await this.getActiveConnection(projectId);
        if (!connection) return;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });

        const payload: WebhookPayload = {
            event: 'content_published',
            timestamp: new Date().toISOString(),
            project: { id: projectId, name: project?.name || 'Unknown' },
            content: {
                title: event.title,
                url: event.url || null,
                type: event.type,
                excerpt: event.excerpt || null,
                channel: event.channel,
                contentId: event.contentId || null
            }
        };

        await this.sendWebhook(connection.id, connection.webhookUrl, payload);
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static async getActiveConnection(projectId: string) {
        return prisma.n8NConnection.findFirst({
            where: {
                projectId,
                status: 'ACTIVE'
            },
            select: {
                id: true,
                webhookUrl: true,
                triggerOnTips: true
            }
        });
    }

    private static async sendWebhook(
        connectionId: string,
        webhookUrl: string,
        payload: WebhookPayload
    ): Promise<void> {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10_000) // 10s timeout
            });

            if (!response.ok) {
                const errorText = `HTTP ${response.status}: ${response.statusText}`;
                console.warn(`N8NDispatcher: Webhook failed for ${connectionId}: ${errorText}`);
                await this.updateConnectionStatus(connectionId, errorText);
                return;
            }

            // Success: update lastTriggerAt, clear lastError
            await prisma.n8NConnection.update({
                where: { id: connectionId },
                data: {
                    lastTriggerAt: new Date(),
                    lastError: null
                }
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.warn(`N8NDispatcher: Webhook error for ${connectionId}:`, errorMsg);
            await this.updateConnectionStatus(connectionId, errorMsg);
        }
    }

    private static async updateConnectionStatus(
        connectionId: string,
        error: string
    ): Promise<void> {
        try {
            await prisma.n8NConnection.update({
                where: { id: connectionId },
                data: {
                    lastTriggerAt: new Date(),
                    lastError: error.substring(0, 500)
                }
            });
        } catch {
            // If we can't even update the status, just log
            console.error(`N8NDispatcher: Failed to update connection ${connectionId} status`);
        }
    }
}
