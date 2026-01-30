/**
 * GET /api/integrations/mcp/[connectionId]/projects
 * Get all projects associated with an MCP connection
 */

import { auth } from '@/auth';
import { MCPConnectionService } from '@/lib/integrations/mcp/connection.service';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId } = await params;

        const projects = await MCPConnectionService.getAssociatedProjects(connectionId);

        return NextResponse.json({ projects });

    } catch (error: any) {
        console.error('Error getting associated projects:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
