/**
 * POST /api/integrations/mcp/[connectionId]/transfer-organization
 * Transfer an MCP connection to another organization
 */

import { auth } from '@/auth';
import { MCPConnectionService } from '@/lib/integrations/mcp/connection.service';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId } = await params;
        const body = await request.json();
        const { targetOrganizationId } = body;

        if (!targetOrganizationId) {
            return NextResponse.json(
                { error: 'targetOrganizationId is required' },
                { status: 400 }
            );
        }

        const result = await MCPConnectionService.transferToOrganization(
            connectionId,
            targetOrganizationId,
            session.user.id
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error transferring MCP connection:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
