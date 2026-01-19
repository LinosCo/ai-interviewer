
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const convs = await prisma.conversation.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
            id: true,
            botId: true,
            status: true,
            startedAt: true,
            currentTopicId: true,
            exchangeCount: true,
            bot: {
                select: {
                    name: true
                }
            }
        }
    });
    console.log(JSON.stringify(convs, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
