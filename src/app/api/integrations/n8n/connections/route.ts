import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';

const createConnectionSchema = z.object({
  projectId: z.string(),
  name: z.string().optional().default('n8n Automation'),
  webhookUrl: z.string().url(),
  triggerOnTips: z.boolean().optional().default(true),
});

function isMissingN8NConnectionTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: string; meta?: { table?: string }; message?: string };
  if (prismaError.code !== 'P2021') return false;
  const tableRef = String(prismaError.meta?.table || '').toLowerCase();
  const messageRef = String(prismaError.message || '').toLowerCase();
  return tableRef.includes('n8nconnection') || messageRef.includes('n8nconnection');
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Check access
    const access = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    });

    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const connection = await prisma.n8NConnection.findUnique({
      where: { projectId },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    if (isMissingN8NConnectionTable(error)) {
      return NextResponse.json({
        connection: null,
        unavailableReason: 'N8NConnection table missing. Run database migrations to enable n8n integration.',
      });
    }
    console.error('Get N8N Connection Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = createConnectionSchema.parse(body);

    // Check access
    const access = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: data.projectId,
        },
      },
    });

    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check plan
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: {
        organizationId: true,
        organization: {
          select: { plan: true }
        }
      },
    });

    if (project?.organizationId) {
      const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
      if (!integrationCheck.allowed) {
        return NextResponse.json(
          { error: integrationCheck.reason || 'Integration creation unavailable on trial' },
          { status: 403 }
        );
      }
    }

    const plan = project?.organization?.plan || 'FREE';
    if (!['BUSINESS', 'PARTNER'].includes(plan)) {
      return NextResponse.json({ error: 'Upgrade to BUSINESS required' }, { status: 403 });
    }

    // Create or update connection
    const connection = await prisma.n8NConnection.upsert({
      where: { projectId: data.projectId },
      create: {
        projectId: data.projectId,
        name: data.name,
        webhookUrl: data.webhookUrl,
        triggerOnTips: data.triggerOnTips,
        createdBy: session.user.id,
        status: 'PENDING',
      },
      update: {
        name: data.name,
        webhookUrl: data.webhookUrl,
        triggerOnTips: data.triggerOnTips,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (isMissingN8NConnectionTable(error)) {
      return NextResponse.json(
        { error: 'N8N integration unavailable: missing N8NConnection table. Run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Create N8N Connection Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
