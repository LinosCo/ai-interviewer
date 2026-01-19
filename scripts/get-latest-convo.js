
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const latestConversation = await prisma.conversation.findFirst({
        orderBy: { startedAt: 'desc' },
        include: {
            bot: {
                select: { name: true, slug: true }
            },
            messages: {
                orderBy: { createdAt: 'asc' }
            },
            analysis: true,
            memory: true
        }
    });

    if (!latestConversation) {
        console.log("No conversations found.");
        return;
    }

    console.log(JSON.stringify(latestConversation, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
