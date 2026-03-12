import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateDefaultOrganization } from '@/lib/organizations';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function buildUniqueOrganizationSlug(baseName: string) {
  const base = slugify(baseName) || 'team';
  let candidate = base;
  let attempt = 1;

  while (attempt <= 50) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });

    if (!existing) return candidate;
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }

  return `${base}-${Date.now()}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
            packCreditsAvailable: true
          }
        }
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }]
    });

    if (memberships.length === 0) {
      const organization = await getOrCreateDefaultOrganization(session.user.id);
      memberships = await prisma.membership.findMany({
        where: {
          userId: session.user.id,
          organizationId: organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              monthlyCreditsLimit: true,
              monthlyCreditsUsed: true,
              packCreditsAvailable: true
            }
          }
        }
      });
    }

    const organizations = memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role,
      monthlyCreditsLimit: membership.organization.monthlyCreditsLimit?.toString(),
      monthlyCreditsUsed: membership.organization.monthlyCreditsUsed?.toString(),
      packCreditsAvailable: membership.organization.packCreditsAvailable?.toString()
    }));

    return NextResponse.json({ organizations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Organizations route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim() : '';

    if (rawName.length < 2) {
      return NextResponse.json(
        { error: 'Il nome team deve contenere almeno 2 caratteri' },
        { status: 400 }
      );
    }

    let slug = rawSlug ? slugify(rawSlug) : '';
    if (!slug) {
      slug = await buildUniqueOrganizationSlug(rawName);
    } else {
      const exists = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true }
      });
      if (exists) {
        return NextResponse.json(
          { error: 'Slug già in uso, scegli un valore diverso' },
          { status: 409 }
        );
      }
    }

    const organization = await prisma.$transaction(async (tx) => {
      const createdOrg = await tx.organization.create({
        data: {
          name: rawName,
          slug,
          plan: 'FREE',
        }
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: createdOrg.id,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
          acceptedAt: new Date(),
        }
      });

      return createdOrg;
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Organizations create route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
