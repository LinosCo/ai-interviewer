import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { assertProjectAccess, WorkspaceError } from '@/lib/domain/workspace';
import { prisma } from '@/lib/prisma';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error('Activation status route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    await assertProjectAccess(session.user.id, projectId, 'VIEWER');

    const [
      project,
      bots,
      directVisibilityConfigs,
      sharedVisibilityConfigs,
      directMcpConnections,
      sharedMcpConnections,
      googleConnection,
      n8nConnection,
      sharedCmsConnections,
      tipCount,
      routingRulesTotal,
      routingRulesEnabled,
    ] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          cmsConnectionId: true,
          newCmsConnection: { select: { id: true } },
        },
      }),
      prisma.bot.findMany({
        where: { projectId },
        select: { botType: true },
      }),
      prisma.visibilityConfig.findMany({
        where: { projectId },
        select: { id: true },
      }),
      prisma.projectVisibilityConfig.findMany({
        where: { projectId },
        select: { configId: true },
      }),
      prisma.mCPConnection.findMany({
        where: { projectId },
        select: { id: true },
      }),
      prisma.projectMCPConnection.findMany({
        where: { projectId },
        select: { connectionId: true },
      }),
      prisma.googleConnection.findUnique({
        where: { projectId },
        select: { id: true },
      }),
      prisma.n8NConnection.findUnique({
        where: { projectId },
        select: { id: true },
      }),
      prisma.projectCMSConnection.findMany({
        where: { projectId },
        select: { connectionId: true },
      }),
      prisma.projectTip.count({
        where: { projectId },
      }),
      prisma.tipRoutingRule.count({
        where: { projectId },
      }),
      prisma.tipRoutingRule.count({
        where: { projectId, enabled: true },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const interviewCount = bots.filter((bot) => bot.botType !== 'chatbot').length;
    const chatbotCount = bots.filter((bot) => bot.botType === 'chatbot').length;

    const visibilityConfigIds = new Set<string>();
    for (const config of directVisibilityConfigs) {
      visibilityConfigIds.add(config.id);
    }
    for (const sharedConfig of sharedVisibilityConfigs) {
      visibilityConfigIds.add(sharedConfig.configId);
    }

    const mcpConnectionIds = new Set<string>();
    for (const connection of directMcpConnections) {
      mcpConnectionIds.add(connection.id);
    }
    for (const sharedConnection of sharedMcpConnections) {
      mcpConnectionIds.add(sharedConnection.connectionId);
    }

    const cmsConnectionIds = new Set<string>();
    if (project.cmsConnectionId) {
      cmsConnectionIds.add(project.cmsConnectionId);
    }
    if (project.newCmsConnection?.id) {
      cmsConnectionIds.add(project.newCmsConnection.id);
    }
    for (const sharedConnection of sharedCmsConnections) {
      cmsConnectionIds.add(sharedConnection.connectionId);
    }

    const toolCounts = {
      interviews: interviewCount,
      chatbots: chatbotCount,
      visibility: visibilityConfigIds.size,
      total: interviewCount + chatbotCount + visibilityConfigIds.size,
    };

    const integrationCounts = {
      mcp: mcpConnectionIds.size,
      google: googleConnection ? 1 : 0,
      cms: cmsConnectionIds.size,
      n8n: n8nConnection ? 1 : 0,
      total: mcpConnectionIds.size + (googleConnection ? 1 : 0) + cmsConnectionIds.size + (n8nConnection ? 1 : 0),
    };

    const checklist = {
      hasTools: toolCounts.total > 0,
      hasIntegration: integrationCounts.total > 0,
      hasTips: tipCount > 0,
      hasRoutingRule: routingRulesEnabled > 0,
      isActivated: toolCounts.total > 0 && integrationCounts.total > 0 && tipCount > 0,
    };

    return NextResponse.json({
      projectId,
      toolCounts,
      integrationCounts,
      tipCounts: {
        total: tipCount,
      },
      routingRules: {
        total: routingRulesTotal,
        enabled: routingRulesEnabled,
      },
      checklist,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
