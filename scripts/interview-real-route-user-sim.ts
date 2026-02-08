import { PrismaClient } from '@prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';
import { writeFileSync } from 'node:fs';

type CliArgs = {
    botId: string;
    runs: number;
    seed: number;
    maxTurns: number;
    baseUrl: string;
    outputPath?: string;
    model: string;
};

type Persona = {
    name: string;
    style: string;
    detailBias: number;
    deepRefuseChance: number;
    consentRefuseChance: number;
    skipFieldChance: number;
    values: {
        name: string;
        email: string;
        phone: string;
        company: string;
        role: string;
        linkedin: string;
    };
    firstAnswers: string[];
};

type RunSummary = {
    run: number;
    persona: string;
    conversationId: string;
    completed: boolean;
    turns: number;
    semanticScore: number;
    semanticFailedTurns: number;
    transitionFailures: number;
    consentFailures: number;
    hasScan: boolean;
    hasDeep: boolean;
    hasDataCollection: boolean;
    fullTranscript: Array<{
        role: string;
        phase?: string;
        topicLabel?: string;
        text: string;
    }>;
};

function parseArgs(): CliArgs {
    const botId = String(process.argv[2] || '').trim();
    if (!botId) {
        console.error('Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/interview-real-route-user-sim.ts <botId> [runs] [seed] [maxTurns] [baseUrl] [outputPath] [model]');
        process.exit(1);
    }
    const runs = Number(process.argv[3] || 3);
    const seed = Number(process.argv[4] || 42);
    const maxTurns = Number(process.argv[5] || 24);
    const baseUrl = String(process.argv[6] || 'http://127.0.0.1:3000').trim();
    const outputPath = String(process.argv[7] || '').trim() || undefined;
    const model = String(process.argv[8] || 'gpt-4o-mini').trim();
    return {
        botId,
        runs: Number.isFinite(runs) && runs > 0 ? Math.floor(runs) : 3,
        seed: Number.isFinite(seed) ? Math.floor(seed) : 42,
        maxTurns: Number.isFinite(maxTurns) && maxTurns > 0 ? Math.floor(maxTurns) : 24,
        baseUrl,
        outputPath,
        model
    };
}

function mulberry32(seed: number): () => number {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(rand: () => number, items: T[]): T {
    return items[Math.max(0, Math.min(items.length - 1, Math.floor(rand() * items.length)))];
}

function makePersonas(): Persona[] {
    return [
        {
            name: 'manager_pragmatico',
            style: 'Risponde in modo diretto, concreto, con esempi operativi.',
            detailBias: 0.45,
            deepRefuseChance: 0.55,
            consentRefuseChance: 0.3,
            skipFieldChance: 0.2,
            values: {
                name: 'Luca Bianchi',
                email: 'luca.bianchi@example.com',
                phone: '+39 333 445 9988',
                company: 'Bianchi SRL',
                role: 'Operations Manager',
                linkedin: 'https://linkedin.com/in/luca-bianchi'
            },
            firstAnswers: ['affidabilità', 'governance', 'fomo controllato']
        },
        {
            name: 'leader_collaborativo',
            style: 'Risponde con contesto, motivazioni e un esempio breve.',
            detailBias: 0.8,
            deepRefuseChance: 0.25,
            consentRefuseChance: 0.1,
            skipFieldChance: 0.08,
            values: {
                name: 'Francesca Ferri',
                email: 'francesca.ferri@example.com',
                phone: '+39 347 778 1122',
                company: 'Ferri SPA',
                role: 'CEO',
                linkedin: 'https://linkedin.com/in/francesca-ferri'
            },
            firstAnswers: ['trasformazione culturale', 'adozione guidata', 'leadership e competenze']
        },
        {
            name: 'scettico_costruttivo',
            style: 'All’inizio critico, poi più disponibile se le domande sono chiare.',
            detailBias: 0.5,
            deepRefuseChance: 0.5,
            consentRefuseChance: 0.45,
            skipFieldChance: 0.25,
            values: {
                name: 'Marco Riva',
                email: 'marco.riva@example.com',
                phone: '+39 349 110 2200',
                company: 'Riva Tech',
                role: 'CTO',
                linkedin: 'https://linkedin.com/in/marco-riva'
            },
            firstAnswers: ['utilità concreta', 'rischio hype', 'servono casi reali']
        }
    ];
}

function inferAskedField(question: string, language: string): string | null {
    const text = String(question || '').toLowerCase();
    const isIt = language.startsWith('it');
    if (/\b(email|mail)\b/i.test(text)) return 'email';
    if (/\b(telefono|phone|numero)\b/i.test(text)) return 'phone';
    if (/\b(linkedin|profilo)\b/i.test(text)) return 'linkedin';
    if (/\b(azienda|company|organizzazione)\b/i.test(text)) return 'company';
    if (/\b(ruolo|role|posizione)\b/i.test(text)) return 'role';
    if (isIt && /\b(nome|cognome)\b/i.test(text)) return 'name';
    if (!isIt && /\bname|full name\b/i.test(text)) return 'name';
    return null;
}

function isConsentPrompt(question: string, language: string): boolean {
    const text = String(question || '').toLowerCase();
    if (language.startsWith('it')) {
        return /\b(posso.*contatt|consenso|permesso|dati di contatto)\b/i.test(text);
    }
    return /\b(may i.*contact|consent|permission|contact details)\b/i.test(text);
}

function isDeepOfferPrompt(question: string, language: string): boolean {
    const text = String(question || '').toLowerCase();
    if (language.startsWith('it')) {
        return /\b(continuare|proseguire|ancora qualche domanda|approfondire|hai ancora tempo)\b/i.test(text);
    }
    return /\b(continue|few more questions|a bit more time|go deeper)\b/i.test(text);
}

function estimateEffectiveSeconds(userText: string, rand: () => number): number {
    const words = String(userText || '').trim().split(/\s+/).filter(Boolean).length;
    const seconds = 7 + words * 1.7 + Math.round(rand() * 8);
    return Math.max(6, Math.min(52, Math.round(seconds)));
}

async function generateUserAnswer(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    persona: Persona;
    rand: () => number;
    assistantQuestion: string;
    turnIndex: number;
    alreadyProvided: Set<string>;
}): Promise<string> {
    const { openai, model, language, persona, rand, assistantQuestion, turnIndex, alreadyProvided } = params;
    const isIt = language.startsWith('it');

    if (turnIndex === 0) {
        return pick(rand, persona.firstAnswers);
    }

    if (isDeepOfferPrompt(assistantQuestion, language)) {
        return rand() < persona.deepRefuseChance
            ? (isIt ? 'preferisco concludere' : 'i prefer to conclude')
            : (isIt ? 'si continuiamo' : 'yes, continue');
    }

    if (isConsentPrompt(assistantQuestion, language)) {
        return rand() < persona.consentRefuseChance
            ? (isIt ? 'preferisco non lasciare i miei dati' : 'i prefer not to share my details')
            : (isIt ? 'si va bene' : 'yes, that is fine');
    }

    const askedField = inferAskedField(assistantQuestion, language);
    if (askedField) {
        if (alreadyProvided.has(askedField) && rand() < 0.7) {
            return isIt ? 'te l ho gia detto' : 'i already told you';
        }
        if (rand() < persona.skipFieldChance) {
            return isIt ? 'preferisco non dirlo' : 'i prefer not to say';
        }
        return persona.values[askedField as keyof Persona['values']] || (isIt ? 'non saprei' : 'not sure');
    }

    const prompt = [
        `Language: ${language}`,
        `Persona: ${persona.name}. ${persona.style}`,
        `Interviewer question: "${assistantQuestion}"`,
        `Rispondi come persona reale in modo ${persona.detailBias > 0.65 ? 'abbastanza articolato (max 35 parole)' : 'sintetico (max 18 parole)'}.`,
        'Niente meta-commenti, niente elenchi numerati.'
    ].join('\n');
    const result = await generateText({
        model: openai(model),
        prompt,
        temperature: 0.45
    });
    const text = String(result.text || '').replace(/\s+/g, ' ').trim();
    return text || (isIt ? 'non saprei dirti altro' : 'i am not sure');
}

async function callRealChat(params: {
    baseUrl: string;
    conversationId: string;
    botId: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    effectiveDuration: number;
    clientMessageId: string;
}): Promise<{ text: string; isCompleted: boolean; currentTopicId?: string | null }> {
    const res = await fetch(`${params.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-chat-simulate': '1'
        },
        body: JSON.stringify({
            conversationId: params.conversationId,
            botId: params.botId,
            messages: params.messages,
            effectiveDuration: params.effectiveDuration,
            clientMessageId: params.clientMessageId
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`CHAT_API_${res.status}: ${JSON.stringify(data)}`);
    }
    return {
        text: String(data.text || ''),
        isCompleted: Boolean(data.isCompleted),
        currentTopicId: data.currentTopicId
    };
}

function buildMarkdownReport(runs: RunSummary[]): string {
    const lines: string[] = [];
    lines.push('# Real /api/chat User-Only Simulation');
    lines.push('');
    for (const run of runs) {
        lines.push(`## Run ${run.run} (${run.persona})`);
        lines.push(`- conversationId: ${run.conversationId}`);
        lines.push(`- completed: ${run.completed}`);
        lines.push(`- turns: ${run.turns}`);
        lines.push(`- semanticScore: ${run.semanticScore}`);
        lines.push(`- failedTurns: ${run.semanticFailedTurns}`);
        lines.push(`- transitionFailures: ${run.transitionFailures}`);
        lines.push(`- consentFailures: ${run.consentFailures}`);
        lines.push(`- phasesSeen: SCAN=${run.hasScan} DEEP=${run.hasDeep} DATA_COLLECTION=${run.hasDataCollection}`);
        lines.push('');
        lines.push('```text');
        for (const msg of run.fullTranscript) {
            const role = msg.role === 'assistant' ? 'A' : 'U';
            const phase = msg.role === 'assistant' ? `[${msg.phase || '-'}|${msg.topicLabel || '-'}]` : '';
            lines.push(`${role}${phase}: ${msg.text}`);
        }
        lines.push('```');
        lines.push('');
    }
    return lines.join('\n');
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();
    const rand = mulberry32(args.seed);

    try {
        const bot = await prisma.bot.findUnique({
            where: { id: args.botId },
            select: {
                id: true,
                name: true,
                language: true,
                modelProvider: true,
                modelName: true,
                openaiApiKey: true
            }
        });
        if (!bot) throw new Error(`Bot not found: ${args.botId}`);

        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { openaiApiKey: true }
        });
        const apiKey = process.env.OPENAI_API_KEY || bot.openaiApiKey || globalConfig?.openaiApiKey || '';
        if (!apiKey) throw new Error('OpenAI API key missing (env/bot/globalConfig).');
        const openai = createOpenAI({ apiKey });

        const personas = makePersonas();
        const runs: RunSummary[] = [];
        console.log('\nReal route simulation started');
        console.log('============================');
        console.log(`botId=${bot.id} botName=${bot.name}`);
        console.log(`runs=${args.runs} baseUrl=${args.baseUrl}`);

        for (let r = 0; r < args.runs; r++) {
            const persona = pick(rand, personas);
            const conversation = await prisma.conversation.create({
                data: {
                    botId: bot.id,
                    participantId: `sim-${Date.now()}-${r + 1}`,
                    status: 'STARTED',
                    metadata: {}
                }
            });

            const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
            let effective = 0;
            let completed = false;
            let turn = 0;
            const providedFields = new Set<string>();

            while (!completed && turn < args.maxTurns) {
                const lastAssistant = messages.slice().reverse().find(m => m.role === 'assistant')?.content || '';
                const userText = await generateUserAnswer({
                    openai,
                    model: args.model,
                    language: bot.language || 'it',
                    persona,
                    rand,
                    assistantQuestion: lastAssistant,
                    turnIndex: turn,
                    alreadyProvided: providedFields
                });

                const askedField = inferAskedField(lastAssistant, bot.language || 'it');
                if (askedField && !/preferisco non|i prefer not|te l ho gia|already told/i.test(userText)) {
                    providedFields.add(askedField);
                }

                messages.push({ role: 'user', content: userText });
                effective += estimateEffectiveSeconds(userText, rand);

                const chatResp = await callRealChat({
                    baseUrl: args.baseUrl,
                    conversationId: conversation.id,
                    botId: bot.id,
                    messages,
                    effectiveDuration: effective,
                    clientMessageId: `sim-${r + 1}-${turn + 1}-${Date.now()}`
                });
                messages.push({ role: 'assistant', content: chatResp.text });
                completed = chatResp.isCompleted;
                turn += 1;
            }

            const conv = await prisma.conversation.findUnique({
                where: { id: conversation.id },
                select: {
                    status: true,
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        select: { role: true, content: true, metadata: true }
                    }
                }
            });
            const transcriptTurns: TranscriptSemanticTurn[] = (conv?.messages || [])
                .filter(m => m.role === 'assistant' || m.role === 'user')
                .map(m => {
                    if (m.role === 'user') return { role: 'user', content: String(m.content || '') };
                    const meta = (m.metadata && typeof m.metadata === 'object')
                        ? (m.metadata as Record<string, unknown>)
                        : {};
                    return {
                        role: 'assistant',
                        content: String(m.content || ''),
                        phase: (typeof meta.phase === 'string' ? meta.phase : undefined) as any,
                        topicLabel: typeof meta.topicLabel === 'string' ? meta.topicLabel : undefined
                    };
                });

            const semantic = evaluateTranscriptSemanticFlow({
                turns: transcriptTurns,
                language: bot.language || 'it'
            });

            const assistants = (conv?.messages || []).filter(m => m.role === 'assistant');
            const hasScan = assistants.some(m => {
                const meta = m.metadata as any;
                return (meta?.phase || '').toString().toUpperCase() === 'SCAN';
            });
            const hasDeep = assistants.some(m => {
                const meta = m.metadata as any;
                return (meta?.phase || '').toString().toUpperCase() === 'DEEP';
            });
            const hasDataCollection = assistants.some(m => {
                const meta = m.metadata as any;
                return (meta?.phase || '').toString().toUpperCase() === 'DATA_COLLECTION';
            });

            runs.push({
                run: r + 1,
                persona: persona.name,
                conversationId: conversation.id,
                completed: Boolean(conv?.status === 'COMPLETED' || completed),
                turns: messages.length,
                semanticScore: semantic.score,
                semanticFailedTurns: semantic.failedTurns,
                transitionFailures: semantic.transitionFailures,
                consentFailures: semantic.consentFailures,
                hasScan,
                hasDeep,
                hasDataCollection,
                fullTranscript: (conv?.messages || []).map(m => {
                    const meta = (m.metadata && typeof m.metadata === 'object')
                        ? (m.metadata as Record<string, unknown>)
                        : {};
                    return {
                        role: m.role,
                        phase: typeof meta.phase === 'string' ? meta.phase : undefined,
                        topicLabel: typeof meta.topicLabel === 'string' ? meta.topicLabel : undefined,
                        text: String(m.content || '').replace(/\s+/g, ' ').trim()
                    };
                })
            });

            console.log(`run=${r + 1} conv=${conversation.id} completed=${runs[r].completed} semantic=${semantic.score} phases: scan=${hasScan} deep=${hasDeep} data=${hasDataCollection}`);
        }

        const pass = runs.filter(r => r.semanticScore >= 80 && r.transitionFailures <= 2 && r.hasDeep && r.hasDataCollection).length;
        console.log('\nSummary');
        console.log('-------');
        console.log(`passRuns=${pass}/${runs.length}`);
        console.log(`avgSemantic=${(runs.reduce((a, b) => a + b.semanticScore, 0) / Math.max(1, runs.length)).toFixed(1)}`);
        console.log(`avgTransitionFailures=${(runs.reduce((a, b) => a + b.transitionFailures, 0) / Math.max(1, runs.length)).toFixed(2)}`);

        if (args.outputPath) {
            writeFileSync(args.outputPath, buildMarkdownReport(runs), 'utf8');
            console.log(`full transcripts written: ${args.outputPath}`);
        } else {
            for (const run of runs) {
                console.log(`\n--- RUN ${run.run} (${run.persona}) ---`);
                for (const msg of run.fullTranscript) {
                    const role = msg.role === 'assistant' ? 'A' : 'U';
                    const phase = msg.role === 'assistant' ? `[${msg.phase || '-'}|${msg.topicLabel || '-'}]` : '';
                    console.log(`${role}${phase}: ${msg.text}`);
                }
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('REAL_ROUTE_USER_SIM_ERROR', err);
    process.exit(1);
});

