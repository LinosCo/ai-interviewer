import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';
import {
  WorkspaceError,
  assertProjectAccess,
  ensureDefaultProjectForOrganization
} from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Project brands route error:', error);
  return NextResponse.json({ error: 'Failed to manage project brands' }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');

    let project: any = null;
    try {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              subscription: true,
              visibilityConfigs: {
                include: {
                  projectShares: {
                    select: { projectId: true }
                  },
                  scans: {
                    where: { status: 'completed' },
                    orderBy: { completedAt: 'desc' },
                    take: 1
                  }
                }
              }
            }
          }
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2021') throw error;
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          organization: {
            include: {
              subscription: true,
              visibilityConfigs: {
                include: {
                  scans: {
                    where: { status: 'completed' },
                    orderBy: { completedAt: 'desc' },
                    take: 1
                  }
                }
              }
            }
          }
        }
      });
    }

    if (!project || !project.organization) {
      throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (project.organizationId !== access.organizationId) {
      throw new WorkspaceError('Project organization mismatch', 422, 'PROJECT_ORG_MISMATCH');
    }

    const org = project.organization;
    const allBrands = org.visibilityConfigs || [];

    const planType = org.subscription
      ? subscriptionTierToPlanType(org.subscription.tier)
      : 'TRIAL';
    const plan = PLANS[planType as keyof typeof PLANS];
    const maxBrands = plan.limits.visibilityEnabled ? -1 : 0;

    const linkedBrands = allBrands
      .filter((brand: any) => brand.projectId === projectId || brand.projectShares?.some((share: any) => share.projectId === projectId))
      .map((brand: any) => ({
        id: brand.id,
        brandName: brand.brandName,
        category: brand.category,
        projectId: brand.projectId,
        latestScore: brand.scans?.[0]?.score || null
      }));

    const unlinkedBrands = allBrands
      .filter((brand: any) => brand.projectId !== projectId && !brand.projectShares?.some((share: any) => share.projectId === projectId))
      .map((brand: any) => ({
        id: brand.id,
        brandName: brand.brandName,
        category: brand.category,
        projectId: brand.projectId,
        latestScore: brand.scans?.[0]?.score || null
      }));

    return NextResponse.json({
      linkedBrands,
      unlinkedBrands,
      maxBrands,
      totalBrands: allBrands.length
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'ADMIN');
    const body = await request.json();
    const brandId = String(body.brandId || '');
    const action = String(body.action || '');

    if (!brandId || !action) {
      throw new WorkspaceError('brandId and action are required', 400, 'INVALID_PAYLOAD');
    }

    const brand = await prisma.visibilityConfig.findUnique({
      where: { id: brandId },
      select: { id: true, organizationId: true, projectId: true }
    });

    if (!brand || brand.organizationId !== access.organizationId) {
      throw new WorkspaceError('Brand not found or belongs to another organization', 404, 'BRAND_NOT_FOUND');
    }

    const tableExistsResult = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ProjectVisibilityConfig'
      )
    `;
    const sharesTableExists = tableExistsResult[0]?.exists || false;

    if (action === 'link') {
      if (sharesTableExists) {
        await prisma.projectVisibilityConfig.upsert({
          where: {
            projectId_configId: {
              projectId,
              configId: brandId
            }
          },
          update: {},
          create: {
            projectId,
            configId: brandId,
            createdBy: session.user.id
          }
        });
      }

      if (!brand.projectId) {
        await prisma.visibilityConfig.update({
          where: { id: brandId },
          data: { projectId }
        });
      }

      return NextResponse.json({ success: true, action: 'linked' });
    }

    if (action === 'unlink') {
      if (sharesTableExists) {
        await prisma.projectVisibilityConfig.deleteMany({
          where: {
            projectId,
            configId: brandId
          }
        });
      }

      const currentBrand = await prisma.visibilityConfig.findUnique({
        where: { id: brandId },
        select: {
          projectId: true,
          projectShares: {
            where: { projectId: { not: projectId } },
            orderBy: { createdAt: 'asc' },
            select: { projectId: true }
          }
        }
      });

      if (currentBrand?.projectId === projectId) {
        const defaultProject = await ensureDefaultProjectForOrganization(access.organizationId);
        const fallbackProjectId = currentBrand.projectShares?.[0]?.projectId || defaultProject.id;
        await prisma.visibilityConfig.update({
          where: { id: brandId },
          data: { projectId: fallbackProjectId }
        });
      }

      return NextResponse.json({ success: true, action: 'unlinked' });
    }

    throw new WorkspaceError('Invalid action. Use "link" or "unlink"', 400, 'INVALID_ACTION');
  } catch (error) {
    return toErrorResponse(error);
  }
}
