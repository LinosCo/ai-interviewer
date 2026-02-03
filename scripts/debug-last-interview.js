/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const latestConversation = await prisma.conversation.findFirst({
        orderBy: { startedAt: 'desc' },
        include: {
            bot: true,
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!latestConversation) {
        console.log("No conversations found.");
        return;
    }

    console.log("--- Bot Config ---");
    console.log("ID:", latestConversation.bot.id);
    console.log("Collect Data:", latestConversation.bot.collectCandidateData);
    console.log("Data Fields:", JSON.stringify(latestConversation.bot.candidateDataFields, null, 2));
    console.log("Max Duration:", latestConversation.bot.maxDurationMins);

    console.log("\n--- Conversation Status ---");
    console.log("ID:", latestConversation.id);
    console.log("Status:", latestConversation.status);
    console.log("Metadata:", JSON.stringify(latestConversation.metadata, null, 2));

    console.log("\n--- Last 10 Messages ---");
    latestConversation.messages.slice(-10).forEach(m => {
        console.log(`[${m.role}] ${m.content}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
