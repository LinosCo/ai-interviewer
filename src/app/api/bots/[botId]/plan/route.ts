import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getOrCreateInterviewPlan,
  previewInterviewPlan,
  regenerateInterviewPlan,
  updateInterviewPlanOverrides,
} from '@/lib/interview/plan-service';
import { assertProjectAccess } from '@/lib/domain/workspace';

const subGoalOverrideSchema = z.object({
  importanceScore: z.number().optional(),
  importanceBand: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  coverageTier: z.enum(['target', 'stretch', 'overflow', 'disabled']).optional(),
  rationale: z.string().optional(),
  enabled: z.boolean().optional(),
}).strict();

const overridesSchema = z.object({
  explore: z.object({
    topics: z.record(z.string(), z.object({
      minTurns: z.number().optional(),
      maxTurns: z.number().optional(),
      importanceScore: z.number().optional(),
      importanceBand: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      rationale: z.string().optional(),
      enabled: z.boolean().optional(),
      targetTurns: z.number().optional(),
      stretchTurns: z.number().optional(),
      targetSubGoalCount: z.number().optional(),
      stretchSubGoalCount: z.number().optional(),
      subGoals: z.record(z.string(), subGoalOverrideSchema).optional(),
    })).optional()
  }).optional(),
  deepen: z.object({
    maxTurnsPerTopic: z.number().optional(),
    fallbackTurns: z.number().optional()
  }).optional()
}).strict();

const patchSchema = z.object({
  overrides: overridesSchema.optional(),
  maxDurationMins: z.number().int().min(1).max(240).optional(),
}).strict();

const postSchema = z.object({
  mode: z.enum(['preview', 'regenerate']),
  overrides: overridesSchema.optional(),
  maxDurationMins: z.number().int().min(1).max(240).optional(),
}).strict();

async function requireBotAccess(botId: string, userId: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { project: { include: { organization: true } }, topics: { orderBy: { orderIndex: 'asc' } } }
  });
  if (!bot) return { bot: null, access: false };

  try {
    await assertProjectAccess(userId, bot.projectId, 'MEMBER');
    return { bot, access: true };
  } catch {
    return { bot, access: false };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { botId } = await params;
    const { bot, access } = await requireBotAccess(botId, session.user.id);
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
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { botId } = await params;
    const { bot, access } = await requireBotAccess(botId, session.user.id);
    if (!bot) return new NextResponse('Bot not found', { status: 404 });
    if (!access) return new NextResponse('Forbidden', { status: 403 });

    const rawBody = await req.json();
    const parsedPatch = patchSchema.safeParse(rawBody);
    const body = parsedPatch.success
      ? parsedPatch.data
      : {
          overrides: overridesSchema.parse(rawBody),
          maxDurationMins: undefined,
        };

    const mergedPlan = await updateInterviewPlanOverrides(botId, body.overrides || {}, {
      maxDurationMins: body.maxDurationMins
    });
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { botId } = await params;
    const { bot, access } = await requireBotAccess(botId, session.user.id);
    if (!bot) return new NextResponse('Bot not found', { status: 404 });
    if (!access) return new NextResponse('Forbidden', { status: 403 });

    const body = postSchema.parse(await req.json());

    if (body.mode === 'preview') {
      const preview = await previewInterviewPlan({
        botId,
        overrides: body.overrides || {},
        maxDurationMins: body.maxDurationMins,
      });
      return NextResponse.json({ plan: preview });
    }

    const regenerated = await regenerateInterviewPlan(botId);
    const stored = await prisma.interviewPlan.findUnique({ where: { botId } });
    return NextResponse.json({
      plan: regenerated,
      basePlan: stored?.basePlan ?? regenerated,
      overrides: stored?.overrides ?? null,
      version: stored?.version ?? regenerated.version,
    });
  } catch (error) {
    console.error('[PLAN_POST_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
