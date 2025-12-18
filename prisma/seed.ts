import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'admin@example.com'
    const password = await bcrypt.hash('password123', 10)

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password,
            role: 'ADMIN'
        },
        create: {
            email,
            name: 'Admin User',
            password,
            role: 'ADMIN',
        },
    })

    console.log({ user })

    // Create the specific user requested
    const socialEmail = 'social@linosandco.com'
    const socialUser = await prisma.user.upsert({
        where: { email: socialEmail },
        update: {
            password, // Same password: password123
            role: 'ADMIN',
            emailVerified: new Date()
        },
        create: {
            email: socialEmail,
            name: 'Linos Admin',
            password,
            role: 'ADMIN',
            emailVerified: new Date()
        },
    })
    console.log({ socialUser })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
