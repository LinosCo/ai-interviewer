import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { VisibilityEngine } from '@/lib/visibility/visibility-engine';
import { checkResourceAccess } from '@/lib/guards/resourceGuard';

// Extend timeout for long-running scans (5 minutes)
export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get configId from request body
        const body = await request.json().catch(() => ({}));
        const { configId } = body;

        // Find the specific config (with security check)
        const config = await prisma.visibilityConfig.findFirst({
            where: {
                ...(configId ? { id: configId } : {}),
                OR: [
                    // Config legata a un progetto di cui l'utente è owner
                    {
                        project: {
                            ownerId: session.user.id
                        }
                    },
                    // Fallback: config dell'org di cui è membro (legacy)
                    {
                        organization: {
                            members: {
                                some: { userId: session.user.id }
                            }
                        }
                    }
                ]
            },
            include: {
                project: {
                    select: { id: true, ownerId: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Check plan limits - usa l'owner del progetto
        const projectId = config.projectId || config.project?.id;
        const access = await checkResourceAccess('VISIBILITY_QUERY', 0, { projectId: projectId || undefined });

        if (!access.allowed) {
            return NextResponse.json(
                { error: access.error },
                { status: access.status }
            );
        }

        // No cooldown - scans only consume AI credits from the plan
        // Run the scan
        const result = await VisibilityEngine.runScan(config.id);

        return NextResponse.json({
            success: true,
            scanId: result.scanId,
            partial: result.partial,
            message: result.partial
                ? 'Scan completed with some providers skipped (check API keys).'
                : 'Scan completed successfully.'
        });

    } catch (error) {
        console.error('Error running scan:', error);
        return NextResponse.json(
            { error: 'Failed to run scan' },
            { status: 500 }
        );
    }
}
