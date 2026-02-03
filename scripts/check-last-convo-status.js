/* eslint-disable @typescript-eslint/no-require-imports */
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
            }
        }
    });

    if (!latestConversation) {
        console.log("No conversations found.");
        return;
    }

    console.log("Conversation ID:", latestConversation.id);
    console.log("Bot:", latestConversation.bot.name);
    console.log("Status:", latestConversation.status);
    console.log("Started At:", latestConversation.startedAt);
    console.log("Completed At:", latestConversation.completedAt);
    console.log("Message Count:", latestConversation.messages.length);
    console.log("Last 5 messages:");
    latestConversation.messages.slice(-5).forEach(m => {
        console.log(`[${m.role}] ${m.content.substring(0, 100)}...`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
