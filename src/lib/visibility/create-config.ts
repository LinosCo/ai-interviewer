import { Prisma } from '@prisma/client';
import type { VisibilityConfig } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type CreateVisibilityConfigInput = {
    organizationId: string;
    projectId?: string | null;
    brandName: string;
    brandAliases?: string[];
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

export function normalizeBrandAliases(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const aliases = input
        .map((item) => normalizeBrandName(String(item || '')))
        .filter(Boolean);
    return Array.from(new Set(aliases));
}

function toNullableJsonInput(
    value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
    } catch (error) {
        console.warn('[visibility-create] Advisory lock unavailable:', error);
    }
}

export async function createVisibilityConfigWithGuard(
    input: CreateVisibilityConfigInput
): Promise<CreateVisibilityConfigResult> {
    const normalizedBrandName = normalizeBrandName(input.brandName);
    const normalizedBrandAliases = normalizeBrandAliases(input.brandAliases).filter(
        (alias) => alias.toLowerCase() !== normalizedBrandName.toLowerCase()
    );

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
                brandAliases: normalizedBrandAliases,
                category: input.category,
                description: input.description || '',
                websiteUrl: input.websiteUrl || null,
                additionalUrls: toNullableJsonInput(input.additionalUrls),
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
