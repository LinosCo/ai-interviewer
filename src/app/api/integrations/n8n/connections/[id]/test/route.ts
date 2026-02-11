import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

function isMissingN8NConnectionTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: string; meta?: { table?: string } };
  return prismaError.code === 'P2021' && String(prismaError.meta?.table || '').includes('N8NConnection');
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.n8NConnection.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Check access
    const access = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: connection.projectId,
        },
      },
    });

    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update status to TESTING
    await prisma.n8NConnection.update({
      where: { id },
      data: { status: 'TESTING' },
    });

    try {
      // Send test payload to n8n webhook
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        project: {
          id: connection.project.id,
          name: connection.project.name,
        },
        message: 'Test connection from Voler.ai',
      };

      const response = await fetch(connection.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        await prisma.n8NConnection.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            lastTriggerAt: new Date(),
            lastError: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Webhook test successful',
        });
      } else {
        const errorText = await response.text();
        await prisma.n8NConnection.update({
          where: { id },
          data: {
            status: 'ERROR',
            lastError: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          },
        });

        return NextResponse.json({
          success: false,
          error: `Webhook returned ${response.status}`,
        });
      }
    } catch (fetchError: unknown) {
      const fetchErrorMessage = fetchError instanceof Error
        ? fetchError.message
        : 'Failed to connect to webhook';
      await prisma.n8NConnection.update({
        where: { id },
        data: {
          status: 'ERROR',
          lastError: fetchErrorMessage,
        },
      });

      return NextResponse.json({
        success: false,
        error: fetchErrorMessage,
      });
    }
  } catch (error) {
    if (isMissingN8NConnectionTable(error)) {
      return NextResponse.json(
        { error: 'N8N integration unavailable: missing N8NConnection table. Run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Test N8N Connection Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
