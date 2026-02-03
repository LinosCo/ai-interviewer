/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Manual .env loading
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1'); // remove quotes
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
    console.log("Loaded .env file");
} catch (e: any) {
    console.log("Could not load .env file:", e.message);
}

const prisma = new PrismaClient();

async function main() {
    console.log("Starting debug script...");
    const bots = await prisma.bot.findMany({
        select: {
            id: true,
            name: true,
            collectCandidateData: true,
            candidateDataFields: true
        }
    });

    console.log("DEBUG ALL BOTS:", JSON.stringify(bots, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
