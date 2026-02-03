/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function main() {
    console.log("🧪 Testing Chatbot Lead Generation with Required/Optional Fields\n");

    // 1. Create a test bot with mixed required/optional fields
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found");

    // Find or create a project
    let project = await prisma.project.findFirst({
        where: { organizationId: org.id }
    });

    if (!project) {
        project = await prisma.project.create({
            data: {
                name: "Test Project",
                organizationId: org.id,
            }
        });
    }

    const bot = await prisma.bot.create({
        data: {
            name: "Test Lead Bot",
            slug: `test-lead-bot-${Date.now()}`,
            projectId: project.id,
            status: 'PUBLISHED',
            botType: 'chatbot',
            language: 'it',
            tone: 'Friendly',
            researchGoal: 'Test lead generation',
            targetAudience: 'Test users',
            candidateDataFields: [
                {
                    field: "nome",
                    question: "Come ti chiami?",
                    required: true  // REQUIRED
                },
                {
                    field: "email",
                    question: "Qual è la tua email?",
                    required: true  // REQUIRED
                },
                {
                    field: "telefono",
                    question: "Hai un numero di telefono?",
                    required: false  // OPTIONAL
                },
                {
                    field: "azienda",
                    question: "Per quale azienda lavori?",
                    required: false  // OPTIONAL
                }
            ],
            collectCandidateData: true,
            leadCaptureStrategy: 'after_3_msgs',
        }
    });

    console.log(`✅ Created test bot: ${bot.id}\n`);

    // 2. Create conversation and session
    const conversation = await prisma.conversation.create({
        data: {
            botId: bot.id,
            participantId: `test-${Date.now()}`,
            status: 'STARTED',
        }
    });

    const session = await prisma.chatbotSession.create({
        data: {
            conversationId: conversation.id,
            botId: bot.id,
            sessionId: `session-${Date.now()}`,
            pageUrl: 'https://test.com',
            pageTitle: 'Test',
            messagesCount: 0,
            tokensUsed: 0,
        }
    });

    console.log(`✅ Created conversation: ${conversation.id}\n`);

    // 3. Helper function
    async function sendMessage(text, label) {
        console.log(`\n👤 USER: ${text}`);
        try {
            const response = await fetch(`${BASE_URL}/api/chatbot/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: conversation.id,
                    message: text,
                })
            });
            const data = await response.json();
            console.log(`🤖 BOT (${label}): ${data.response}`);
            return data.response;
        } catch (e) {
            console.error('❌ Error:', e.message);
            return null;
        }
    }

    // 4. Test Flow
    console.log("═══════════════════════════════════════════════");
    console.log("PHASE 1: Normal conversation (trigger after 3 msgs)");
    console.log("═══════════════════════════════════════════════");

    await sendMessage("Ciao!", "Msg 1");
    await sendMessage("Vorrei informazioni", "Msg 2");
    await sendMessage("Interessante", "Msg 3 - Should trigger lead capture");

    console.log("\n═══════════════════════════════════════════════");
    console.log("PHASE 2: Provide REQUIRED field (nome)");
    console.log("═══════════════════════════════════════════════");

    await sendMessage("Mi chiamo Alice", "Provide nome");

    console.log("\n═══════════════════════════════════════════════");
    console.log("PHASE 3: Provide REQUIRED field (email)");
    console.log("═══════════════════════════════════════════════");

    await sendMessage("alice@test.com", "Provide email");

    console.log("\n═══════════════════════════════════════════════");
    console.log("PHASE 4: REFUSE OPTIONAL field (telefono)");
    console.log("═══════════════════════════════════════════════");

    await sendMessage("No, preferisco non darlo", "Refuse telefono");

    console.log("\n═══════════════════════════════════════════════");
    console.log("PHASE 5: REFUSE OPTIONAL field (azienda)");
    console.log("═══════════════════════════════════════════════");

    await sendMessage("Non voglio dirlo", "Refuse azienda");

    // 5. Verify results
    console.log("\n═══════════════════════════════════════════════");
    console.log("VERIFICATION");
    console.log("═══════════════════════════════════════════════\n");

    const finalConvo = await prisma.conversation.findUnique({
        where: { id: conversation.id }
    });

    const profile = finalConvo.candidateProfile || {};
    console.log("📊 Final Profile:", JSON.stringify(profile, null, 2));

    // Check results
    const hasNome = profile.nome === 'Alice';
    const hasEmail = profile.email === 'alice@test.com';
    const noTelefono = !profile.telefono;
    const noAzienda = !profile.azienda;

    console.log("\n✅ REQUIRED fields collected:");
    console.log(`   - Nome: ${hasNome ? '✅' : '❌'} (${profile.nome || 'missing'})`);
    console.log(`   - Email: ${hasEmail ? '✅' : '❌'} (${profile.email || 'missing'})`);

    console.log("\n✅ OPTIONAL fields correctly skipped:");
    console.log(`   - Telefono: ${noTelefono ? '✅ (not collected)' : '❌ (should not be collected)'}`);
    console.log(`   - Azienda: ${noAzienda ? '✅ (not collected)' : '❌ (should not be collected)'}`);

    if (hasNome && hasEmail && noTelefono && noAzienda) {
        console.log("\n🎉 SUCCESS: All tests passed!");
    } else {
        console.log("\n❌ FAILURE: Some tests failed");
    }

    // Cleanup
    await prisma.bot.delete({ where: { id: bot.id } });
    console.log("\n🧹 Cleaned up test bot");
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
