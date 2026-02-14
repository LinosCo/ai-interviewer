/**
 * Test MCP Connection API
 * POST - Test connection by initializing MCP handshake
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MCPGatewayService } from '@/lib/integrations/mcp';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('MCP test route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const connection = await prisma.mCPConnection.findUnique({
      where: { id },
      select: { id: true, projectId: true }
    });

    if (!connection) {
      throw new WorkspaceError('Connection not found', 404, 'MCP_NOT_FOUND');
    }

    await assertProjectAccess(session.user.id, connection.projectId, 'ADMIN');

    await prisma.mCPConnection.update({
      where: { id },
      data: { status: 'TESTING' }
    });

    const result = await MCPGatewayService.testConnection(id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
