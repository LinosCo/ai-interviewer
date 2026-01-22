import { prisma } from '@/lib/prisma';
import { decrypt, verifyWebhookSignature } from '@/lib/cms/encryption';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

interface CMSWebhookPayload {
    event: 'content.published' | 'content.updated' | 'content.deleted';
    contentId: string;
    contentType: string;
    title: string;
    slug: string;
    url: string;
    btSuggestionId?: string;
    publishedAt: string;
}

/**
 * POST /api/webhooks/cms/[connectionId]
 * Receive webhooks from CMS when content is published/updated/deleted.
 * Verifies HMAC-SHA256 signature.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    const { connectionId } = await params;

    // 1. Find the connection
    const connection = await prisma.cMSConnection.findUnique({
        where: { id: connectionId }
    });

    if (!connection) {
        return NextResponse.json(
            { error: 'Connection not found' },
            { status: 404 }
        );
    }

    // 2. Get raw body and verify signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-cms-signature');

    const webhookSecret = decrypt(connection.webhookSecret);
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.warn(`[CMS Webhook] Invalid signature for connection ${connectionId}`);

        // Log failed attempt
        await CMSConnectionService.logWebhook(
            connectionId,
            'INBOUND',
            'unknown',
            false,
            undefined,
            undefined,
            undefined,
            'Invalid signature'
        );

        return NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
        );
    }

    // 3. Parse and process event
    let payload: CMSWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON payload' },
            { status: 400 }
        );
    }

    try {
        switch (payload.event) {
            case 'content.published':
                await handleContentPublished(connection.id, payload);
                break;
            case 'content.updated':
                await handleContentUpdated(connection.id, payload);
                break;
            case 'content.deleted':
                await handleContentDeleted(connection.id, payload);
                break;
            default:
                console.log(`[CMS Webhook] Unknown event: ${payload.event}`);
        }

        // Log success
        await CMSConnectionService.logWebhook(
            connectionId,
            'INBOUND',
            payload.event,
            true,
            payload,
            200
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[CMS Webhook] Error processing:', error);

        await CMSConnectionService.logWebhook(
            connectionId,
            'INBOUND',
            payload.event,
            false,
            payload,
            500,
            undefined,
            error.message
        );

        return NextResponse.json(
            { error: 'Processing failed' },
            { status: 500 }
        );
    }
}

/**
 * Handle content.published event.
 * If this content originated from a BT suggestion, mark it as published.
 */
async function handleContentPublished(connectionId: string, payload: CMSWebhookPayload) {
    // If this was a BT suggestion, update its status
    if (payload.btSuggestionId) {
        await prisma.cMSSuggestion.updateMany({
            where: {
                connectionId,
                id: payload.btSuggestionId,
                status: 'PUSHED'
            },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(payload.publishedAt),
                cmsContentId: payload.contentId
            }
        });

        console.log(`[CMS Webhook] Suggestion ${payload.btSuggestionId} marked as published`);
    }

    // Update connection sync timestamp
    await prisma.cMSConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() }
    });
}

/**
 * Handle content.updated event.
 */
async function handleContentUpdated(connectionId: string, payload: CMSWebhookPayload) {
    // Optional: track content updates
    console.log(`[CMS Webhook] Content updated: ${payload.title}`);

    // Update connection sync timestamp
    await prisma.cMSConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() }
    });
}

/**
 * Handle content.deleted event.
 * If this content originated from a BT suggestion, mark it as rejected.
 */
async function handleContentDeleted(connectionId: string, payload: CMSWebhookPayload) {
    if (payload.btSuggestionId) {
        await prisma.cMSSuggestion.updateMany({
            where: {
                connectionId,
                id: payload.btSuggestionId
            },
            data: {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedReason: 'Contenuto eliminato dal CMS'
            }
        });

        console.log(`[CMS Webhook] Suggestion ${payload.btSuggestionId} marked as rejected (deleted)`);
    }
}
