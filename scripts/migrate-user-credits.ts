/**
 * Script di Migrazione: Inizializza Crediti Utenti Esistenti
 *
 * Questo script:
 * 1. Trova tutti gli utenti esistenti
 * 2. Imposta monthlyCreditsLimit basato sul loro piano
 * 3. Imposta monthlyCreditsUsed a 0 (reset)
 * 4. Imposta creditsResetDate all'inizio del prossimo mese
 * 5. Imposta packCreditsAvailable a 0
 *
 * Eseguire con: npx tsx scripts/migrate-user-credits.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping piano -> crediti mensili (da plans.ts)
const PLAN_CREDITS: Record<string, bigint> = {
    FREE: BigInt(500),
    TRIAL: BigInt(2_000),
    STARTER: BigInt(6_000),
    PRO: BigInt(20_000),
    BUSINESS: BigInt(50_000),
    PARTNER: BigInt(10_000),
    ADMIN: BigInt(-1), // Illimitato
};

function getNextMonthStart(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
}

async function migrateUserCredits() {
    console.log('🚀 Inizio migrazione crediti utenti...\n');

    const resetDate = getNextMonthStart();
    console.log(`📅 Reset date impostata: ${resetDate.toISOString()}\n`);

    // Trova tutti gli utenti
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
        },
    });

    console.log(`👥 Trovati ${users.length} utenti da migrare\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        try {
            const plan = user.plan || 'FREE';
            const credits = PLAN_CREDITS[plan.toUpperCase()] ?? PLAN_CREDITS.FREE;

            // Verifica se l'utente ha già crediti configurati
            const alreadyMigrated = user.monthlyCreditsLimit !== null &&
                                    Number(user.monthlyCreditsLimit) > 0;

            if (alreadyMigrated) {
                console.log(`⏭️  Skip: ${user.email} (già migrato, limit: ${user.monthlyCreditsLimit})`);
                skipped++;
                continue;
            }

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    monthlyCreditsLimit: credits,
                    monthlyCreditsUsed: BigInt(0),
                    creditsResetDate: resetDate,
                    packCreditsAvailable: BigInt(0),
                },
            });

            const creditsDisplay = credits === BigInt(-1) ? 'Illimitati' : credits.toString();
            console.log(`✅ Migrato: ${user.email} (${plan}) → ${creditsDisplay} crediti`);
            updated++;

        } catch (error) {
            console.error(`❌ Errore per ${user.email}:`, error);
            errors++;
        }
    }

    console.log('\n========================================');
    console.log('📊 RIEPILOGO MIGRAZIONE');
    console.log('========================================');
    console.log(`✅ Migrati: ${updated}`);
    console.log(`⏭️  Saltati (già migrati): ${skipped}`);
    console.log(`❌ Errori: ${errors}`);
    console.log(`📊 Totale: ${users.length}`);
    console.log('========================================\n');

    // Verifica finale - conta utenti con crediti configurati (limite > 0)
    const usersWithCredits = await prisma.user.count({
        where: {
            monthlyCreditsLimit: { gt: 0 },
        },
    });

    console.log(`🔍 Utenti con crediti configurati: ${usersWithCredits}/${users.length}`);
}

async function main() {
    try {
        await migrateUserCredits();
    } catch (error) {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
