/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bots = await prisma.bot.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            botType: true
        }
    });
    console.log(JSON.stringify(bots, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
