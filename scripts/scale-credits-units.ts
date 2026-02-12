import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
const SCALE_FACTOR = BigInt(1000);

function scaleBigInt(value: bigint): bigint {
    if (value <= BigInt(0)) return value;
    const scaled = value / SCALE_FACTOR;
    return scaled > BigInt(0) ? scaled : BigInt(1);
}

async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const execute = process.argv.includes('--execute');

    const organizations = await prisma.organization.findMany({
        select: {
            id: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
            packCreditsAvailable: true
        }
    });

    const orgTransactions = await prisma.orgCreditTransaction.findMany({
        select: { id: true, amount: true, balanceAfter: true }
    });

    const orgPacks = await prisma.orgCreditPack.findMany({
        select: { id: true, creditsPurchased: true, creditsRemaining: true }
    });

    console.log(`orgs=${organizations.length} tx=${orgTransactions.length} packs=${orgPacks.length}`);
    console.log(`scale_factor=${SCALE_FACTOR.toString()}`);

    if (!execute) {
        console.log('Dry run mode. Re-run with --execute to apply changes.');
        return;
    }

    for (const org of organizations) {
        await prisma.organization.update({
            where: { id: org.id },
            data: {
                monthlyCreditsLimit: scaleBigInt(org.monthlyCreditsLimit),
                monthlyCreditsUsed: scaleBigInt(org.monthlyCreditsUsed),
                packCreditsAvailable: scaleBigInt(org.packCreditsAvailable)
            }
        });
    }

    for (const tx of orgTransactions) {
        await prisma.orgCreditTransaction.update({
            where: { id: tx.id },
            data: {
                amount: scaleBigInt(tx.amount),
                balanceAfter: scaleBigInt(tx.balanceAfter)
            }
        });
    }

    for (const pack of orgPacks) {
        await prisma.orgCreditPack.update({
            where: { id: pack.id },
            data: {
                creditsPurchased: scaleBigInt(pack.creditsPurchased),
                creditsRemaining: scaleBigInt(pack.creditsRemaining)
            }
        });
    }

    console.log('Credit scaling completed.');
}

main()
    .catch((error) => {
        console.error('Credit scaling failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        const { prisma } = await import('../src/lib/prisma');
        await prisma.$disconnect();
    });
