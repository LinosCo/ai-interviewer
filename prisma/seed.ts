import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'admin@example.com'
    const password = await bcrypt.hash('password123', 10)

    // Users are now managed via Admin UI or manual registration.
    // Commenting out seed users to prevent overwrite on deploy.
    /*
    const user = await prisma.user.upsert({
        where: { email },
        update: {}, // Don't overwrite existing admin data
        create: {
            email,
            name: 'Admin User',
            password,
            role: 'ADMIN',
        },
    })
    console.log({ user })

    const socialEmail = 'social@linosandco.com'
    const socialUser = await prisma.user.upsert({
        where: { email: socialEmail },
        update: {}, // Don't overwrite existing user data
        create: {
            email: socialEmail,
            name: 'Linos Admin',
            password,
            role: 'ADMIN',
            emailVerified: new Date()
        },
    })
    console.log({ socialUser })
    */

    // Initialize Global Config
    const config = await prisma.globalConfig.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            // We don't hardcode the key here for security, expecting the user to set it via Admin UI 
            // or rely on env vars. But creating the record ensures the app doesn't crash on null.
            openaiApiKey: process.env.OPENAI_API_KEY || null,
        },
    })
    console.log({ config })

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
