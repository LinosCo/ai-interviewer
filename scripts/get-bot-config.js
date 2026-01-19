
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const botId = process.argv[2] || 'cmk72vk5p0001nu9pozhwk5as';
    const bot = await prisma.bot.findUnique({
        where: { id: botId }
    });
    console.log(JSON.stringify(bot, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
