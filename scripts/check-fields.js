/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Manual .env loading
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log("Found .env");
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
} catch (e) {
    console.log("Error loading .env:", e.message);
}

const prisma = new PrismaClient();

async function main() {
    const bot = await prisma.bot.findFirst({
        where: {
            name: { contains: 'TEDx', mode: 'insensitive' }
        },
        select: {
            name: true,
            candidateDataFields: true
        }
    });

    console.log("DEBUG FIELDS:", JSON.stringify(bot, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
