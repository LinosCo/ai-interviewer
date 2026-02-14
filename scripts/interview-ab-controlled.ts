import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';
import { writeFileSync } from 'node:fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

let prisma: any;

type Variant = 'control' | 'treatment';

type CliArgs = {
  botId: string;
  runsPerVariant: number;
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
  values: { name: string; email: string; phone: string; company: string; role: string; linkedin: string };
  firstAnswers: string[];
};

type RunMetrics = {
  variant: Variant;
  semanticScore: number;
  transitionFailures: number;
  assistantTurns: number;
  regeneratedTurns: number;
  regenerationRate: number;
  qualityAvg: number | null;
  qualityEvaluatedTurns: number;
  languageCoherenceRate: number;
  completed: boolean;
};

type Aggregate = {
  variant: Variant;
  runs: number;
  avgSemanticScore: number;
  avgTransitionFailures: number;
  avgRegenerationRate: number;
  avgQuality: number | null;
  avgLanguageCoherence: number;
  completionRate: number;
};

function parseArgs(): CliArgs {
  const botId = String(process.argv[2] || '').trim();
  if (!botId) {
    console.error('Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/interview-ab-controlled.ts <botId> [runsPerVariant] [seed] [maxTurns] [baseUrl] [outputPath] [model]');
    process.exit(1);
  }
  const runsPerVariant = Number(process.argv[3] || 12);
  const seed = Number(process.argv[4] || 42);
  const maxTurns = Number(process.argv[5] || 24);
  const baseUrl = String(process.argv[6] || 'http://127.0.0.1:3000').trim();
  const outputPath = String(process.argv[7] || '').trim() || undefined;
  const model = String(process.argv[8] || 'gpt-4o-mini').trim();
  return {
    botId,
    runsPerVariant: Number.isFinite(runsPerVariant) && runsPerVariant > 0 ? Math.floor(runsPerVariant) : 12,
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
        name: 'Luca Bianchi', email: 'luca.bianchi@example.com', phone: '+39 333 445 9988', company: 'Bianchi SRL', role: 'Operations Manager', linkedin: 'https://linkedin.com/in/luca-bianchi'
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
        name: 'Francesca Ferri', email: 'francesca.ferri@example.com', phone: '+39 347 778 1122', company: 'Ferri SPA', role: 'CEO', linkedin: 'https://linkedin.com/in/francesca-ferri'
      },
      firstAnswers: ['trasformazione culturale', 'adozione guidata', 'leadership e competenze']
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
  if (language.startsWith('it')) return /\b(posso.*contatt|consenso|permesso|dati di contatto)\b/i.test(text);
  return /\b(may i.*contact|consent|permission|contact details)\b/i.test(text);
}

function isDeepOfferPrompt(question: string, language: string): boolean {
  const text = String(question || '').toLowerCase();
  if (language.startsWith('it')) return /\b(continuare|proseguire|ancora qualche domanda|approfondire|hai ancora tempo)\b/i.test(text);
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
  if (turnIndex === 0) return pick(rand, persona.firstAnswers);
  if (isDeepOfferPrompt(assistantQuestion, language)) return rand() < persona.deepRefuseChance ? (isIt ? 'preferisco concludere' : 'i prefer to conclude') : (isIt ? 'si continuiamo' : 'yes, continue');
  if (isConsentPrompt(assistantQuestion, language)) return rand() < persona.consentRefuseChance ? (isIt ? 'preferisco non lasciare i miei dati' : 'i prefer not to share my details') : (isIt ? 'si va bene' : 'yes, that is fine');
  const askedField = inferAskedField(assistantQuestion, language);
  if (askedField) {
    if (alreadyProvided.has(askedField) && rand() < 0.7) return isIt ? 'te l ho gia detto' : 'i already told you';
    if (rand() < persona.skipFieldChance) return isIt ? 'preferisco non dirlo' : 'i prefer not to say';
    return persona.values[askedField as keyof Persona['values']] || (isIt ? 'non saprei' : 'not sure');
  }

  const prompt = [
    `Language: ${language}`,
    `Persona: ${persona.name}. ${persona.style}`,
    `Interviewer question: "${assistantQuestion}"`,
    `Rispondi come persona reale in modo ${persona.detailBias > 0.65 ? 'abbastanza articolato (max 35 parole)' : 'sintetico (max 18 parole)'}.`,
    'Niente meta-commenti, niente elenchi numerati.'
  ].join('\n');

  const result = await generateText({ model: openai(model), prompt, temperature: 0.45 });
  const text = String(result.text || '').replace(/\s+/g, ' ').trim();
  return text || (isIt ? 'non saprei dirti altro' : 'i am not sure');
}

async function callRealChat(params: {
  baseUrl: string;
  variant: Variant;
  conversationId: string;
  botId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  effectiveDuration: number;
  clientMessageId: string;
}): Promise<{ text: string; isCompleted: boolean }> {
  const res = await fetch(`${params.baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-chat-simulate': '1',
      'x-interview-ab': params.variant
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
  if (!res.ok) throw new Error(`CHAT_API_${res.status}: ${JSON.stringify(data)}`);
  return { text: String(data.text || ''), isCompleted: Boolean(data.isCompleted) };
}

function detectLanguageCode(text: string): 'en' | 'it' | 'de' | 'fr' | 'es' | 'unknown' {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const dict: Record<'en' | 'it' | 'de' | 'fr' | 'es', string[]> = {
    it: [' il ', ' lo ', ' la ', ' gli ', ' che ', ' non ', ' per ', ' con ', ' una ', ' sono ', ' nel '],
    en: [' the ', ' and ', ' you ', ' your ', ' with ', ' for ', ' this ', ' that ', ' are ', ' can '],
    de: [' der ', ' die ', ' und ', ' nicht ', ' mit ', ' für ', ' ist ', ' ich ', ' sie ', ' das '],
    fr: [' le ', ' la ', ' les ', ' et ', ' avec ', ' pour ', ' est ', ' vous ', ' dans ', ' des '],
    es: [' el ', ' la ', ' los ', ' y ', ' con ', ' para ', ' que ', ' una ', ' en ', ' es ']
  };
  const scores = (Object.keys(dict) as Array<keyof typeof dict>).map((lang) => ({
    lang,
    score: dict[lang].reduce((acc, token) => acc + (lower.includes(token) ? 1 : 0), 0)
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score >= 2 ? scores[0].lang : 'unknown';
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function summarize(variant: Variant, runs: RunMetrics[]): Aggregate {
  const qualityVals = runs.map(r => r.qualityAvg).filter((v): v is number => typeof v === 'number');
  return {
    variant,
    runs: runs.length,
    avgSemanticScore: average(runs.map(r => r.semanticScore)),
    avgTransitionFailures: average(runs.map(r => r.transitionFailures)),
    avgRegenerationRate: average(runs.map(r => r.regenerationRate)),
    avgQuality: qualityVals.length ? average(qualityVals) : null,
    avgLanguageCoherence: average(runs.map(r => r.languageCoherenceRate)),
    completionRate: average(runs.map(r => (r.completed ? 1 : 0)))
  };
}

async function runVariant(params: {
  openai: ReturnType<typeof createOpenAI>;
  bot: { id: string; language: string | null };
  variant: Variant;
  persona: Persona;
  runIndex: number;
  maxTurns: number;
  baseUrl: string;
  model: string;
  rand: () => number;
}): Promise<RunMetrics> {
  const { openai, bot, variant, persona, runIndex, maxTurns, baseUrl, model, rand } = params;
  const conversation = await prisma.conversation.create({
    data: {
      botId: bot.id,
      participantId: `ab-${variant}-${Date.now()}-${runIndex}`,
      status: 'STARTED',
      metadata: { abTestRun: true, abVariant: variant }
    }
  });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const providedFields = new Set<string>();
  let turn = 0;
  let completed = false;
  let effective = 0;

  while (!completed && turn < maxTurns) {
    const lastAssistant = messages.slice().reverse().find(m => m.role === 'assistant')?.content || '';
    const userText = await generateUserAnswer({
      openai,
      model,
      language: bot.language || 'it',
      persona,
      rand,
      assistantQuestion: lastAssistant,
      turnIndex: turn,
      alreadyProvided: providedFields
    });

    const askedField = inferAskedField(lastAssistant, bot.language || 'it');
    if (askedField && !/preferisco non|i prefer not|te l ho gia|already told/i.test(userText)) providedFields.add(askedField);

    messages.push({ role: 'user', content: userText });
    effective += estimateEffectiveSeconds(userText, rand);

    const chatResp = await callRealChat({
      baseUrl,
      variant,
      conversationId: conversation.id,
      botId: bot.id,
      messages,
      effectiveDuration: effective,
      clientMessageId: `ab-${variant}-${runIndex}-${turn + 1}-${Date.now()}`
    });
    messages.push({ role: 'assistant', content: chatResp.text });
    completed = chatResp.isCompleted;
    turn += 1;
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: {
      status: true,
      messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true, metadata: true } }
    }
  });

  const turns: TranscriptSemanticTurn[] = (conv?.messages || [])
    .filter((m: any) => m.role === 'assistant' || m.role === 'user')
    .map((m: any) => {
      if (m.role === 'user') return { role: 'user', content: String(m.content || '') };
      const meta = (m.metadata && typeof m.metadata === 'object') ? (m.metadata as Record<string, unknown>) : {};
      return {
        role: 'assistant',
        content: String(m.content || ''),
        phase: (typeof meta.phase === 'string' ? meta.phase : undefined) as any,
        topicLabel: typeof meta.topicLabel === 'string' ? meta.topicLabel : undefined
      };
    });

  const semantic = evaluateTranscriptSemanticFlow({ turns, language: bot.language || 'it' });

  const assistants = (conv?.messages || []).filter((m: any) => m.role === 'assistant');
  let regeneratedTurns = 0;
  const qualityScores: number[] = [];
  let coherenceHits = 0;
  let coherenceChecked = 0;

  for (const m of assistants) {
    const meta = (m.metadata && typeof m.metadata === 'object') ? (m.metadata as Record<string, any>) : {};
    const q = meta.quality && typeof meta.quality === 'object' ? meta.quality : null;
    if (q?.regenerated === true) regeneratedTurns++;
    if (typeof q?.score === 'number') qualityScores.push(q.score);

    const detected = detectLanguageCode(String(m.content || ''));
    const expected = String(bot.language || 'it').toLowerCase().slice(0, 2) as 'en' | 'it' | 'de' | 'fr' | 'es';
    if (['en', 'it', 'de', 'fr', 'es'].includes(expected) && detected !== 'unknown') {
      coherenceChecked++;
      if (detected === expected) coherenceHits++;
    }
  }

  return {
    variant,
    semanticScore: semantic.score,
    transitionFailures: semantic.transitionFailures,
    assistantTurns: assistants.length,
    regeneratedTurns,
    regenerationRate: assistants.length ? regeneratedTurns / assistants.length : 0,
    qualityAvg: qualityScores.length ? average(qualityScores) : null,
    qualityEvaluatedTurns: qualityScores.length,
    languageCoherenceRate: coherenceChecked ? coherenceHits / coherenceChecked : 1,
    completed: Boolean(conv?.status === 'COMPLETED' || completed)
  };
}

async function main() {
  const args = parseArgs();
  const rand = mulberry32(args.seed);
  try {
    if (!prisma) {
      const prismaModule = await import('../src/lib/prisma');
      prisma = prismaModule.prisma;
    }
    const bot = await prisma.bot.findUnique({ where: { id: args.botId }, select: { id: true, name: true, language: true, openaiApiKey: true } });
    if (!bot) throw new Error(`Bot not found: ${args.botId}`);

    const globalConfig = await prisma.globalConfig.findUnique({ where: { id: 'default' }, select: { openaiApiKey: true } });
    const apiKey = process.env.OPENAI_API_KEY || bot.openaiApiKey || globalConfig?.openaiApiKey || '';
    if (!apiKey) throw new Error('OpenAI API key missing (env/bot/globalConfig).');
    const openai = createOpenAI({ apiKey });

    const personas = makePersonas();
    const controlRuns: RunMetrics[] = [];
    const treatmentRuns: RunMetrics[] = [];

    console.log(`A/B controlled test started: botId=${bot.id} language=${bot.language || 'it'} runsPerVariant=${args.runsPerVariant}`);

    for (let i = 0; i < args.runsPerVariant; i++) {
      const persona = pick(rand, personas);
      const control = await runVariant({ openai, bot, variant: 'control', persona, runIndex: i + 1, maxTurns: args.maxTurns, baseUrl: args.baseUrl, model: args.model, rand });
      controlRuns.push(control);
      console.log(`control run=${i + 1}/${args.runsPerVariant} regenRate=${control.regenerationRate.toFixed(3)} q=${control.qualityAvg?.toFixed(1) || 'n/a'} lang=${control.languageCoherenceRate.toFixed(3)}`);

      const treatment = await runVariant({ openai, bot, variant: 'treatment', persona, runIndex: i + 1, maxTurns: args.maxTurns, baseUrl: args.baseUrl, model: args.model, rand });
      treatmentRuns.push(treatment);
      console.log(`treatment run=${i + 1}/${args.runsPerVariant} regenRate=${treatment.regenerationRate.toFixed(3)} q=${treatment.qualityAvg?.toFixed(1) || 'n/a'} lang=${treatment.languageCoherenceRate.toFixed(3)}`);
    }

    const controlAgg = summarize('control', controlRuns);
    const treatmentAgg = summarize('treatment', treatmentRuns);

    const out = {
      generatedAt: new Date().toISOString(),
      botId: bot.id,
      botLanguage: bot.language || 'it',
      runsPerVariant: args.runsPerVariant,
      totals: { interviews: args.runsPerVariant * 2 },
      control: controlAgg,
      treatment: treatmentAgg,
      delta: {
        regenerationRate: treatmentAgg.avgRegenerationRate - controlAgg.avgRegenerationRate,
        quality: (treatmentAgg.avgQuality ?? 0) - (controlAgg.avgQuality ?? 0),
        languageCoherence: treatmentAgg.avgLanguageCoherence - controlAgg.avgLanguageCoherence,
        semanticScore: treatmentAgg.avgSemanticScore - controlAgg.avgSemanticScore
      }
    };

    console.log('\nA/B Summary');
    console.log('----------');
    console.log(JSON.stringify(out, null, 2));

    if (args.outputPath) {
      writeFileSync(args.outputPath, JSON.stringify(out, null, 2), 'utf8');
      console.log(`report written: ${args.outputPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('INTERVIEW_AB_CONTROLLED_ERROR', err);
  process.exit(1);
});
