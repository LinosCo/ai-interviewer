/**
 * Site Structure API
 * GET  - Get cached site structure for a connection
 * POST - Trigger fresh site structure discovery
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SiteDiscoveryService } from '@/lib/integrations/site-discovery.service';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Site structure route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

type ConnectionType = 'mcp' | 'cms';

async function resolveProjectId(
  connectionType: ConnectionType,
  connectionId: string
): Promise<string | null> {
  if (connectionType === 'mcp') {
    const conn = await prisma.mCPConnection.findUnique({
      where: { id: connectionId },
      select: { projectId: true },
    });
    return conn?.projectId ?? null;
  }
  const conn = await prisma.cMSConnection.findUnique({
    where: { id: connectionId },
    select: { projectId: true },
  });
  return conn?.projectId ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('connectionType') as ConnectionType | null;
    const connectionId = searchParams.get('connectionId');
    const projectId = searchParams.get('projectId');

    // Option 1: Get structure for a specific connection
    if (connectionType && connectionId) {
      const resolvedProjectId = await resolveProjectId(connectionType, connectionId);
      if (!resolvedProjectId) {
        throw new WorkspaceError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
      }
      await assertProjectAccess(session.user.id, resolvedProjectId, 'MEMBER');

      const structure = await SiteDiscoveryService.getCachedStructure(connectionType, connectionId);
      return NextResponse.json({ structure, stale: await SiteDiscoveryService.isStale(connectionType, connectionId) });
    }

    // Option 2: Get merged structure for a project
    if (projectId) {
      await assertProjectAccess(session.user.id, projectId, 'MEMBER');
      const structure = await SiteDiscoveryService.getProjectStructure(projectId);
      return NextResponse.json({ structure });
    }

    return NextResponse.json(
      { error: 'Provide connectionType+connectionId or projectId' },
      { status: 400 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      connectionType?: string;
      connectionId?: string;
      projectId?: string;
    };

    const connectionType = body.connectionType as ConnectionType | undefined;
    const connectionId = body.connectionId;
    const projectId = body.projectId;

    // Option 1: Discover for a specific connection
    if (connectionType && connectionId) {
      const resolvedProjectId = await resolveProjectId(connectionType, connectionId);
      if (!resolvedProjectId) {
        throw new WorkspaceError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
      }
      await assertProjectAccess(session.user.id, resolvedProjectId, 'ADMIN');

      const structure = await SiteDiscoveryService.discoverAndStore(connectionType, connectionId);
      return NextResponse.json({ success: true, structure });
    }

    // Option 2: Discover all connections for a project
    if (projectId) {
      await assertProjectAccess(session.user.id, projectId, 'ADMIN');

      const mcpConnections = await prisma.mCPConnection.findMany({
        where: { projectId, status: 'ACTIVE' },
        select: { id: true, type: true },
      });

      const cmsConnection = await prisma.cMSConnection.findFirst({
        where: { projectId, status: { in: ['ACTIVE', 'PARTIAL'] } },
        select: { id: true },
      });

      const results: Array<{ connectionId: string; type: string; success: boolean }> = [];

      for (const conn of mcpConnections) {
        try {
          await SiteDiscoveryService.discoverAndStore('mcp', conn.id);
          results.push({ connectionId: conn.id, type: conn.type, success: true });
        } catch {
          results.push({ connectionId: conn.id, type: conn.type, success: false });
        }
      }

      if (cmsConnection) {
        try {
          await SiteDiscoveryService.discoverAndStore('cms', cmsConnection.id);
          results.push({ connectionId: cmsConnection.id, type: 'CMS', success: true });
        } catch {
          results.push({ connectionId: cmsConnection.id, type: 'CMS', success: false });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    return NextResponse.json(
      { error: 'Provide connectionType+connectionId or projectId' },
      { status: 400 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
