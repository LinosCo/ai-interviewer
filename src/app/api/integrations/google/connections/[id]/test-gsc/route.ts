/**
 * Test GSC Connection API
 * POST - Test Google Search Console connection
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GoogleService } from '@/lib/integrations/google';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userEmail = session.user.email;

  const { id } = await params;

  // Get connection and verify access
  const connection = await prisma.googleConnection.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          owner: { select: { email: true } },
          organization: {
            include: {
              members: { select: { user: { select: { email: true } } } },
            },
          },
          accessList: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  if (!connection || !connection.project) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // Verify access
  const hasAccess =
    connection.project.owner?.email === userEmail ||
    connection.project.accessList.some(a => a.user.email === userEmail) ||
    connection.project.organization?.members.some(m => m.user.email === userEmail);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Check GSC is configured
  if (!connection.gscEnabled || !connection.gscSiteUrl) {
    return NextResponse.json(
      { error: 'Search Console is not configured. Please set gscSiteUrl first.' },
      { status: 400 }
    );
  }

  // Update status to TESTING
  await prisma.googleConnection.update({
    where: { id },
    data: { gscStatus: 'TESTING' },
  });

  // Test connection
  const result = await GoogleService.testGSC(id);

  return NextResponse.json(result);
}
