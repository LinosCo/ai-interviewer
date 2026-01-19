
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const convs = await prisma.conversation.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
            bot: { select: { name: true } },
            _count: { select: { messages: true } }
        }
    });

    convs.forEach(c => {
        console.log(`ID: ${c.id}, Bot: ${c.bot.name}, Msg Count: ${c._count.messages}, Started: ${c.startedAt}, Status: ${c.status}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
