import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { getDefaultInterviewMethodologyKnowledge } from '@/lib/marketing/strategic-kb';

const TRAINING_KB_COLUMN = 'trainingMethodologyKnowledge';
const TRAINING_KB_PATH = path.join(process.cwd(), 'knowledge', 'training-methodology.md');

function readTrainingFileSafe(): string {
    try {
        return fs.readFileSync(TRAINING_KB_PATH, 'utf-8').trim();
    } catch {
        return '';
    }
}

export function getDefaultTrainingMethodologyKnowledge(): string {
    return readTrainingFileSafe();
}

async function ensureTrainingMethodologyColumn(): Promise<void> {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "PlatformSettings"
        ADD COLUMN IF NOT EXISTS "${TRAINING_KB_COLUMN}" TEXT;
    `);
}

export async function getTrainingMethodologyKnowledgeByOrg(
    organizationId: string
): Promise<{ knowledge: string | null; updatedAt: Date | null }> {
    try {
        const rows = await prisma.$queryRawUnsafe<Array<{ trainingMethodologyKnowledge: string | null; updatedAt: Date | null }>>(
            `SELECT "${TRAINING_KB_COLUMN}" as "trainingMethodologyKnowledge", "updatedAt"
             FROM "PlatformSettings"
             WHERE "organizationId" = $1
             LIMIT 1`,
            organizationId
        );

        if (!rows[0]) {
            return { knowledge: null, updatedAt: null };
        }

        const value = String(rows[0].trainingMethodologyKnowledge || '').trim();
        return {
            knowledge: value || null,
            updatedAt: rows[0].updatedAt || null
        };
    } catch (error: any) {
        if (error?.code === '42703' || String(error?.message || '').toLowerCase().includes('column')) {
            return { knowledge: null, updatedAt: null };
        }
        throw error;
    }
}

export async function setTrainingMethodologyKnowledgeByOrg(
    organizationId: string,
    knowledge: string
): Promise<void> {
    await ensureTrainingMethodologyColumn();

    const existing = await prisma.platformSettings.findUnique({
        where: { organizationId },
        select: { id: true, methodologyKnowledge: true }
    });

    if (!existing) {
        const defaultInterviewKnowledge = getDefaultInterviewMethodologyKnowledge();
        await prisma.platformSettings.create({
            data: {
                organizationId,
                methodologyKnowledge: defaultInterviewKnowledge || 'Metodologia interviste non configurata.'
            }
        });
    }

    await prisma.$executeRawUnsafe(
        `UPDATE "PlatformSettings"
         SET "${TRAINING_KB_COLUMN}" = $1, "updatedAt" = NOW()
         WHERE "organizationId" = $2`,
        knowledge,
        organizationId
    );
}
