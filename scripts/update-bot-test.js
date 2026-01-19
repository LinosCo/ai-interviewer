
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const botId = 'cmk72vk5p0001nu9pozhwk5as';
    const updatedBot = await prisma.bot.update({
        where: { id: botId },
        data: {
            maxDurationMins: 5,
            collectCandidateData: true,
            candidateDataFields: [
                { id: 'fullName', label: 'Nome Completo', required: true, type: 'text' },
                { id: 'email', label: 'Email', required: true, type: 'email' },
                { id: 'linkedin', label: 'Profilo LinkedIn', required: false, type: 'url' }
            ]
        }
    });
    console.log("Bot updated successfully.");
    console.log("New Config:", JSON.stringify({
        maxDurationMins: updatedBot.maxDurationMins,
        collectCandidateData: updatedBot.collectCandidateData,
        candidateDataFields: updatedBot.candidateDataFields
    }, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
