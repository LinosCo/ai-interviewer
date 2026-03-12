import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { WorkspaceError } from '@/lib/domain/workspace';
import { ProjectIntelligenceContextService } from '@/lib/projects/project-intelligence-context.service';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  console.error('Project intelligence context route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

const querySchema = z.object({
  includeCrossProjectContext: z.enum(['true', 'false']).optional(),
  limitPerSource: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      includeCrossProjectContext: url.searchParams.get('includeCrossProjectContext') || undefined,
      limitPerSource: url.searchParams.get('limitPerSource') || undefined,
    });

    const context = await ProjectIntelligenceContextService.getContext({
      projectId,
      viewerUserId: session.user.id,
      includeCrossProjectContext: parsed.includeCrossProjectContext === 'true',
      ...(parsed.limitPerSource ? { limitPerSource: parsed.limitPerSource } : {}),
    });

    return NextResponse.json(context);
  } catch (error) {
    return toErrorResponse(error);
  }
}
