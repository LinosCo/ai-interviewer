/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const convoId = 'cmkkyi46y0001qg18xawtt2hv';
    const messages = await prisma.message.findMany({
        where: { conversationId: convoId },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log("Last 5 messages (reversed):");
    messages.forEach(m => {
        console.log(`[${m.role}] ${m.content}`);
    });

    const conversation = await prisma.conversation.findUnique({
        where: { id: convoId },
        include: {
            analysis: true,
            memory: true
        }
    });
    console.log("Candidate Profile:", JSON.stringify(conversation.candidateProfile, null, 2));
    console.log("Tags:", conversation.tags);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
