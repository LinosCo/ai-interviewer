
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const userCount = await prisma.user.count()
    const botCount = await prisma.bot.count()
    const conversationCount = await prisma.conversation.count()

    console.log(`Users: ${userCount}`)
    console.log(`Bots: ${botCount}`)
    console.log(`Conversations: ${conversationCount}`)

    const users = await prisma.user.findMany({ select: { email: true } })
    console.log('User emails:', users.map(u => u.email).join(', '))
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
