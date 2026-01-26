/**
 * Test GA4 Connection API
 * POST - Test Google Analytics 4 connection
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

  if (!connection) {
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

  // Check GA4 is configured
  if (!connection.ga4Enabled || !connection.ga4PropertyId) {
    return NextResponse.json(
      { error: 'GA4 is not configured. Please set ga4PropertyId first.' },
      { status: 400 }
    );
  }

  // Update status to TESTING
  await prisma.googleConnection.update({
    where: { id },
    data: { ga4Status: 'TESTING' },
  });

  // Test connection
  const result = await GoogleService.testGA4(id);

  return NextResponse.json(result);
}
