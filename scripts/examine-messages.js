/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const convId = 'cmkkzjcfl0003h019n6xrtms5';
    const c = await prisma.conversation.findUnique({
        where: { id: convId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } }
        }
    });

    console.log("--- End of Conversation cmkkzjcfl ---");
    c.messages.slice(-20).forEach((m, i) => {
        console.log(`${i + 1}. [${m.role}] ${m.content}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
