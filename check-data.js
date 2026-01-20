
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const interviewCount = await prisma.interview.count();
    const chatbotCount = await prisma.chatbotSession.count();
    const visibilityCount = await prisma.visibilityScan.count();

    console.log({
        interviewCount,
        chatbotCount,
        visibilityCount
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
