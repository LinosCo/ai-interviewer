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
    } else {
        console.log("No .env file found at", envPath);
    }
} catch (e) {
    console.log("Error loading .env:", e.message);
}

const prisma = new PrismaClient();

async function main() {
    console.log("Starting debug script...");
    try {
        const bots = await prisma.bot.findMany({
            select: {
                id: true,
                name: true,
                collectCandidateData: true,
                candidateDataFields: true
            }
        });

        console.log("DEBUG ALL BOTS:");
        console.log(JSON.stringify(bots, null, 2));
    } catch (err) {
        console.error("Prisma Error:", err);
    }
}

main()
    .catch(e => console.error("Main Error:", e))
    .finally(async () => {
        await prisma.$disconnect();
    });
