
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const convId = 'cmkl13yqw003sh0198oo4nwmz';
    const c = await prisma.conversation.findUnique({
        where: { id: convId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            bot: { select: { collectCandidateData: true, candidateDataFields: true } }
        }
    });

    console.log("--- Bot Config for this Convo ---");
    console.log("Collect Data:", c.bot.collectCandidateData);
    console.log("Fields:", JSON.stringify(c.bot.candidateDataFields, null, 2));

    console.log("\n--- Full Message History ---");
    c.messages.forEach((m, i) => {
        console.log(`${i + 1}. [${m.role}] ${m.content}`);
    });

    console.log("\n--- Metadata ---");
    console.log(JSON.stringify(c.metadata, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
