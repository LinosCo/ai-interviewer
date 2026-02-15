import type { Prisma, VisibilityConfig } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type CreateVisibilityConfigInput = {
    organizationId: string;
    projectId?: string | null;
    brandName: string;
    category: string;
    description?: string;
    websiteUrl?: string | null;
    additionalUrls?: unknown;
    language?: string;
    territory?: string;
    prompts?: Array<{
        text: string;
        enabled?: boolean;
        referenceUrl?: string | null;
    }>;
    competitors?: Array<{
        name: string;
        website?: string | null;
        enabled?: boolean;
    }>;
};

type CreateVisibilityConfigResult = {
    config: VisibilityConfig;
    created: boolean;
};

export function normalizeBrandName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

async function acquireVisibilityNameLock(
    tx: Prisma.TransactionClient,
    organizationId: string,
    projectId: string | null | undefined,
    normalizedBrandName: string
) {
    const scope = projectId || '__org__';
    const lockKey = `${organizationId}:${scope}:${normalizedBrandName.toLowerCase()}`;

    try {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
    } catch (error) {
        console.warn('[visibility-create] Advisory lock unavailable:', error);
    }
}

export async function createVisibilityConfigWithGuard(
    input: CreateVisibilityConfigInput
): Promise<CreateVisibilityConfigResult> {
    const normalizedBrandName = normalizeBrandName(input.brandName);

    const prompts = input.prompts || [];
    const competitors = input.competitors || [];

    return prisma.$transaction(async (tx) => {
        await acquireVisibilityNameLock(tx, input.organizationId, input.projectId, normalizedBrandName);

        const existing = await tx.visibilityConfig.findFirst({
            where: {
                organizationId: input.organizationId,
                projectId: input.projectId || null,
                brandName: {
                    equals: normalizedBrandName,
                    mode: 'insensitive'
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        if (existing) {
            return { config: existing, created: false };
        }

        const created = await tx.visibilityConfig.create({
            data: {
                organizationId: input.organizationId,
                projectId: input.projectId || null,
                brandName: normalizedBrandName,
                category: input.category,
                description: input.description || '',
                websiteUrl: input.websiteUrl || null,
                additionalUrls: input.additionalUrls || null,
                language: input.language || 'it',
                territory: input.territory || 'IT',
                isActive: true,
                nextScanAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                prompts: {
                    create: prompts.map((p, index) => ({
                        text: p.text,
                        enabled: p.enabled ?? true,
                        orderIndex: index,
                        generatedByAI: true,
                        lastEditedAt: new Date(),
                        referenceUrl: p.referenceUrl || null
                    }))
                },
                competitors: {
                    create: competitors.map((c) => ({
                        name: c.name,
                        website: c.website || null,
                        enabled: c.enabled ?? true
                    }))
                }
            }
        });

        return { config: created, created: true };
    });
}
