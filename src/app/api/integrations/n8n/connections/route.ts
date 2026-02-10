import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createConnectionSchema = z.object({
  projectId: z.string(),
  name: z.string().optional().default('n8n Automation'),
  webhookUrl: z.string().url(),
  triggerOnTips: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return new Response('projectId is required', { status: 400 });
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
      return new Response('Access denied', { status: 403 });
    }

    const connection = await prisma.n8NConnection.findUnique({
      where: { projectId },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    console.error('Get N8N Connection Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
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
      return new Response('Access denied', { status: 403 });
    }

    // Check plan
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      include: { organization: { select: { plan: true } } },
    });

    const plan = project?.organization?.plan || 'FREE';
    if (!['BUSINESS', 'PARTNER'].includes(plan)) {
      return new Response('Upgrade to BUSINESS required', { status: 403 });
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
      return new Response(error.issues[0].message, { status: 400 });
    }
    console.error('Create N8N Connection Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
