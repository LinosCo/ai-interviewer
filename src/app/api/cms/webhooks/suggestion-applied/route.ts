import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CMSSuggestionService } from '@/lib/cms/suggestion.service';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import crypto from 'crypto';
import { decrypt } from '@/lib/cms/encryption';

/**
 * POST /api/cms/webhooks/suggestion-applied
 * Webhook chiamato dal CMS quando un suggerimento viene pubblicato.
 * Protetto da HMAC signature.
 */
export async function POST(request: Request) {
  try {
    // Ottieni signature e body
    const signature = request.headers.get('x-bt-signature');
    const body = await request.text();

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    let payload: {
      suggestionId: string;
      connectionId: string;
      appliedBy?: string;
      contentId?: string;
      publishedUrl?: string;
    };

    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { suggestionId, connectionId, appliedBy, contentId, publishedUrl } = payload;

    if (!suggestionId || !connectionId) {
      return NextResponse.json(
        { error: 'Missing required fields: suggestionId and connectionId' },
        { status: 400 }
      );
    }

    // Trova la connessione
    const connection = await prisma.cMSConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    if (!connection.webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 400 }
      );
    }

    // Verifica HMAC signature
    const webhookSecret = decrypt(connection.webhookSecret);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      // Log tentativo fallito
      await CMSConnectionService.logWebhook(
        connectionId,
        'INBOUND',
        'suggestion_applied',
        false,
        payload,
        undefined,
        undefined,
        'Invalid signature'
      );

      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Verifica che il suggerimento esista e appartenga a questa connessione
    const suggestion = await prisma.cMSSuggestion.findUnique({
      where: { id: suggestionId }
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    if (suggestion.connectionId !== connectionId) {
      return NextResponse.json(
        { error: 'Suggestion does not belong to this connection' },
        { status: 400 }
      );
    }

    // Marca come pubblicato
    await prisma.cMSSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        cmsContentId: contentId || suggestion.cmsContentId
      }
    });

    // Log webhook success
    await CMSConnectionService.logWebhook(
      connectionId,
      'INBOUND',
      'suggestion_applied',
      true,
      payload,
      200,
      undefined,
      undefined
    );

    return NextResponse.json({
      success: true,
      message: 'Suggestion marked as published'
    });

  } catch (error: any) {
    console.error('[Webhook suggestion-applied] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    );
  }
}
