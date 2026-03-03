import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

const MARKETING_KB_COLUMN = 'strategicMarketingKnowledge';
const MARKETING_KB_PATH = path.join(process.cwd(), 'knowledge', 'marketing-strategy-methodology.md');
const INTERVIEW_KB_PATH = path.join(process.cwd(), 'knowledge', 'interview-methodology.md');

function readFileSafe(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf-8').trim();
    } catch {
        return '';
    }
}

export function getDefaultStrategicMarketingKnowledge(): string {
    const content = readFileSafe(MARKETING_KB_PATH);
    if (content) return content;

    return `# Strategic Marketing Knowledge Base

## Positioning
- Definisci target, promessa di valore, differenziatori e proof points.

## SEO + GEO + LLMO
- Prioritizza query ad alta intenzione.
- Copri entita e topic cluster.
- Mantieni contenuti aggiornati e citabili da LLM.

## Content Strategy
- Coordina sito, social, email e PR in campagne coerenti.
- Collega ogni contenuto a un obiettivo e KPI.

## Growth Execution
- Lavora per sprint con backlog, owner, effort, impatto atteso.
- Misura esito, apprendi e rialloca budget sui canali migliori.`;
}

export function getDefaultInterviewMethodologyKnowledge(): string {
    return readFileSafe(INTERVIEW_KB_PATH);
}

async function ensureStrategicMarketingColumn(): Promise<void> {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "PlatformSettings"
        ADD COLUMN IF NOT EXISTS "${MARKETING_KB_COLUMN}" TEXT;
    `);
}

export async function getStrategicMarketingKnowledgeByOrg(
    organizationId: string
): Promise<{ knowledge: string | null; updatedAt: Date | null }> {
    try {
        const rows = await prisma.$queryRawUnsafe<Array<{ strategicMarketingKnowledge: string | null; updatedAt: Date | null }>>(
            `SELECT "${MARKETING_KB_COLUMN}" as "strategicMarketingKnowledge", "updatedAt"
             FROM "PlatformSettings"
             WHERE "organizationId" = $1
             LIMIT 1`,
            organizationId
        );

        if (!rows[0]) {
            return { knowledge: null, updatedAt: null };
        }

        const value = String(rows[0].strategicMarketingKnowledge || '').trim();
        return {
            knowledge: value || null,
            updatedAt: rows[0].updatedAt || null
        };
    } catch (error: any) {
        // Column may not exist yet on older environments.
        if (error?.code === '42703' || String(error?.message || '').toLowerCase().includes('column')) {
            return { knowledge: null, updatedAt: null };
        }
        throw error;
    }
}

export async function setStrategicMarketingKnowledgeByOrg(
    organizationId: string,
    knowledge: string
): Promise<void> {
    await ensureStrategicMarketingColumn();

    const existing = await prisma.platformSettings.findUnique({
        where: { organizationId },
        select: { id: true, methodologyKnowledge: true }
    });

    if (!existing) {
        const baseInterviewKnowledge = getDefaultInterviewMethodologyKnowledge();
        await prisma.platformSettings.create({
            data: {
                organizationId,
                methodologyKnowledge: baseInterviewKnowledge || 'Metodologia interviste non configurata.'
            }
        });
    }

    await prisma.$executeRawUnsafe(
        `UPDATE "PlatformSettings"
         SET "${MARKETING_KB_COLUMN}" = $1, "updatedAt" = NOW()
         WHERE "organizationId" = $2`,
        knowledge,
        organizationId
    );
}
