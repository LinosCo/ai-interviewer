import { prisma } from '@/lib/prisma';
import { CMSSessionService } from '@/lib/cms/session.service';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/cms/encryption';

// CORS headers for cross-origin requests from CMS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * OPTIONS /api/cms/validate-session
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

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
        { status: 401, headers: corsHeaders }
      );
    }

    const apiKey = authHeader.substring(7);
    const body = await request.json();
    const { token, connectionId } = body;

    if (!token || !connectionId) {
      return NextResponse.json(
        { valid: false, error: 'Missing token or connectionId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Trova la connessione e verifica l'API key
    const connection = await prisma.cMSConnection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return NextResponse.json(
        { valid: false, error: 'Connection not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verifica API key (decrypt e confronta)
    const storedApiKey = decrypt(connection.apiKey);

    if (apiKey !== storedApiKey) {
      return NextResponse.json(
        { valid: false, error: 'Invalid API key' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Valida il token JWT
    const result = await CMSSessionService.validateToken(token, connectionId);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 401, headers: corsHeaders }
      );
    }

    // Log dell'accesso per audit
    await prisma.cMSWebhookLog.create({
      data: {
        connectionId,
        direction: 'INBOUND',
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
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Error validating CMS session:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
