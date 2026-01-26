/**
 * Script di Migrazione: Popola ownerId sui Progetti
 *
 * Questo script:
 * 1. Trova tutti i progetti senza ownerId
 * 2. Per ogni progetto, cerca l'utente con ruolo OWNER nella accessList
 * 3. Se trovato, imposta ownerId
 * 4. Se non trovato, cerca il primo membro della accessList
 * 5. Se nessun accesso, cerca di usare l'organizzazione per trovare un owner
 *
 * IMPORTANTE: Questo fix è necessario perché il sistema di crediti
 * richiede ownerId per sapere a chi addebitare i crediti.
 *
 * Eseguire con: npx tsx scripts/migrate-project-owner.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateProjectOwners() {
    console.log('🚀 Inizio migrazione ownerId progetti...\n');

    // 1. Trova progetti senza ownerId
    const projectsWithoutOwner = await prisma.project.findMany({
        where: {
            ownerId: null
        },
        include: {
            accessList: {
                include: {
                    user: {
                        select: { id: true, email: true }
                    }
                },
                orderBy: { createdAt: 'asc' }
            },
            organization: {
                include: {
                    members: {
                        where: { role: 'OWNER' },
                        include: {
                            user: { select: { id: true, email: true } }
                        },
                        take: 1
                    }
                }
            }
        }
    });

    console.log(`📊 Trovati ${projectsWithoutOwner.length} progetti senza ownerId\n`);

    if (projectsWithoutOwner.length === 0) {
        console.log('✅ Tutti i progetti hanno già un ownerId!\n');
        return;
    }

    let updated = 0;
    let failed = 0;

    for (const project of projectsWithoutOwner) {
        let newOwnerId: string | null = null;
        let source = '';

        // Strategia 1: Cerca utente con ruolo OWNER nella accessList
        const ownerAccess = project.accessList.find(a => a.role === 'OWNER');
        if (ownerAccess) {
            newOwnerId = ownerAccess.userId;
            source = 'accessList (OWNER)';
        }

        // Strategia 2: Primo membro della accessList
        if (!newOwnerId && project.accessList.length > 0) {
            newOwnerId = project.accessList[0].userId;
            source = 'accessList (first member)';
        }

        // Strategia 3: Owner dell'organizzazione
        if (!newOwnerId && project.organization?.members?.[0]) {
            newOwnerId = project.organization.members[0].userId;
            source = 'organization owner';
        }

        if (newOwnerId) {
            try {
                await prisma.project.update({
                    where: { id: project.id },
                    data: { ownerId: newOwnerId }
                });

                const ownerEmail = project.accessList.find(a => a.userId === newOwnerId)?.user?.email
                    || project.organization?.members?.find(m => m.userId === newOwnerId)?.user?.email
                    || newOwnerId;

                console.log(`✅ ${project.name} (${project.id})`);
                console.log(`   → Owner: ${ownerEmail} (via ${source})`);
                updated++;
            } catch (error) {
                console.error(`❌ Errore per progetto ${project.name}:`, error);
                failed++;
            }
        } else {
            console.log(`⚠️  ${project.name} (${project.id})`);
            console.log(`   → Nessun owner trovato! Progetto orfano.`);
            failed++;
        }
    }

    console.log('\n========================================');
    console.log('📊 RIEPILOGO MIGRAZIONE OWNER PROGETTI');
    console.log('========================================');
    console.log(`✅ Aggiornati: ${updated}`);
    console.log(`❌ Falliti/Orfani: ${failed}`);
    console.log(`📊 Totale processati: ${projectsWithoutOwner.length}`);
    console.log('========================================\n');

    // Verifica finale
    const stillWithoutOwner = await prisma.project.count({
        where: { ownerId: null }
    });
    console.log(`🔍 Progetti ancora senza owner: ${stillWithoutOwner}`);
}

async function main() {
    try {
        await migrateProjectOwners();
    } catch (error) {
        console.error('❌ Errore fatale:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
