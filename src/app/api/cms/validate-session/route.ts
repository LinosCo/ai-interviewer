import { prisma } from '@/lib/prisma';
import { CMSSessionService } from '@/lib/cms/session.service';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/cms/encryption';

/**
 * POST /api/cms/validate-session
 * Chiamato dal CMS esterno per validare un token JWT.
 * Protetto da API key della connessione CMS.
 */
export async function POST(request: Request) {
  try {
    // Verifica API key del CMS
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { valid: false, error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const body = await request.json();
    const { token, connectionId } = body;

    if (!token || !connectionId) {
      return NextResponse.json(
        { valid: false, error: 'Missing token or connectionId' },
        { status: 400 }
      );
    }

    // Trova la connessione e verifica l'API key
    const connection = await prisma.cMSConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return NextResponse.json(
        { valid: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Verifica API key (decrypt e confronta)
    const storedApiKey = decrypt(connection.apiKey);

    if (apiKey !== storedApiKey) {
      return NextResponse.json(
        { valid: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Valida il token JWT
    const result = await CMSSessionService.validateToken(token, connectionId);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 401 }
      );
    }

    // Log dell'accesso per audit
    await prisma.cMSWebhookLog.create({
      data: {
        connectionId,
        direction: 'INCOMING',
        event: 'validate_session',
        success: true,
        requestPayload: { action: 'validate_session', userId: result.payload?.userId },
        responseStatus: 200
      }
    });

    return NextResponse.json({
      valid: true,
      user: {
        id: result.payload!.userId,
        email: result.payload!.userEmail,
        permissions: result.payload!.permissions
      },
      project: {
        id: result.payload!.projectId
      },
      organization: {
        id: result.payload!.organizationId
      }
    });

  } catch (error: any) {
    console.error('Error validating CMS session:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
