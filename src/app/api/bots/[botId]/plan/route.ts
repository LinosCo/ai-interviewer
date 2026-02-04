import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateInterviewPlan, updateInterviewPlanOverrides } from '@/lib/interview/plan-service';

const overridesSchema = z.object({
  scan: z.object({
    topics: z.record(z.string(), z.object({
      minTurns: z.number().optional(),
      maxTurns: z.number().optional()
    })).optional()
  }).optional(),
  deep: z.object({
    maxTurnsPerTopic: z.number().optional(),
    fallbackTurns: z.number().optional(),
    topics: z.record(z.string(), z.object({
      maxTurns: z.number().optional()
    })).optional()
  }).optional()
}).strict();

async function requireBotAccess(botId: string, email: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { project: { include: { organization: true } }, topics: { orderBy: { orderIndex: 'asc' } } }
  });
  if (!bot) return { bot: null, access: false };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { ownedProjects: true, projectAccess: true }
  });

  const isOwner = user?.ownedProjects.some(p => p.id === bot.projectId);
  const hasAccess = user?.projectAccess.some(pa => pa.projectId === bot.projectId);

  return { bot, access: Boolean(isOwner || hasAccess) };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { botId } = await params;
    const { bot, access } = await requireBotAccess(botId, session.user.email);
    if (!bot) return new NextResponse('Bot not found', { status: 404 });
    if (!access) return new NextResponse('Forbidden', { status: 403 });

    const mergedPlan = await getOrCreateInterviewPlan(bot);
    const stored = await prisma.interviewPlan.findUnique({ where: { botId } });

    return NextResponse.json({
      plan: mergedPlan,
      basePlan: stored?.basePlan ?? mergedPlan,
      overrides: stored?.overrides ?? null,
      version: stored?.version ?? mergedPlan.version
    });
  } catch (error) {
    console.error('[PLAN_GET_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { botId } = await params;
    const { bot, access } = await requireBotAccess(botId, session.user.email);
    if (!bot) return new NextResponse('Bot not found', { status: 404 });
    if (!access) return new NextResponse('Forbidden', { status: 403 });

    const body = await req.json();
    const overrides = overridesSchema.parse(body);

    const mergedPlan = await updateInterviewPlanOverrides(botId, overrides);
    const stored = await prisma.interviewPlan.findUnique({ where: { botId } });

    return NextResponse.json({
      plan: mergedPlan,
      basePlan: stored?.basePlan ?? mergedPlan,
      overrides: stored?.overrides ?? null,
      version: stored?.version ?? mergedPlan.version
    });
  } catch (error) {
    console.error('[PLAN_PATCH_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
