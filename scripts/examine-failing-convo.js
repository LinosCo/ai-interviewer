
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const convId = 'cmkkzjcfl0003h019n6xrtms5';
    const c = await prisma.conversation.findUnique({
        where: { id: convId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            memory: true
        }
    });

    console.log("--- Last 15 Message of real test ---");
    c.messages.slice(-15).forEach(m => {
        console.log(`[${m.role}] [Metadata: ${JSON.stringify(m.metadata)}] ${m.content.substring(0, 150)}...`);
    });

    console.log("\n--- Final Memory Status ---");
    console.log(JSON.stringify(c.memory, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
