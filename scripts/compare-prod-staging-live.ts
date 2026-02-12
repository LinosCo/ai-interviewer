import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { encode } from '@auth/core/jwt';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';

type EnvConfig = {
  label: 'production' | 'staging';
  baseUrl: string;
  databaseUrl: string;
  authSecret: string;
};

type Persona = {
  name: string;
  deepAcceptRate: number;
  consentAcceptRate: number;
  skipFieldRate: number;
  firstMessages: string[];
  dynamicAnswers: string[];
  values: {
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    linkedin: string;
  };
};

type RunResult = {
  env: 'production' | 'staging';
  run: number;
  persona: string;
  conversationId: string;
  httpErrors: number;
  completed: boolean;
  totalMessages: number;
  semanticScore: number;
  transitionFailures: number;
  consentFailures: number;
  hasDeep: boolean;
  hasDataCollection: boolean;
  interestingSignalCaptureRate: number;
  engagementQualityRate: number;
  semanticUnderstandingRate: number;
  nonGenericRate: number;
  transcript: Array<{ role: string; phase?: string; topicLabel?: string; content: string }>;
};

type Summary = {
  env: 'production' | 'staging';
  runs: number;
  completionRate: number;
  avgSemanticScore: number;
  passRate: number;
  hasDeepRate: number;
  hasDataCollectionRate: number;
  avgTransitionFailures: number;
  avgConsentFailures: number;
  avgInterestingSignalCaptureRate: number;
  avgEngagementQualityRate: number;
  avgSemanticUnderstandingRate: number;
  avgNonGenericRate: number;
  httpErrorRuns: number;
};

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  const idx = Math.floor(rand() * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, idx))];
}

function inferAskedField(question: string): string | null {
  const q = String(question || '').toLowerCase();
  if (/\b(email|mail)\b/i.test(q)) return 'email';
  if (/\b(telefono|phone|numero)\b/i.test(q)) return 'phone';
  if (/\b(linkedin|profilo)\b/i.test(q)) return 'linkedin';
  if (/\b(azienda|company|organizzazione)\b/i.test(q)) return 'company';
  if (/\b(ruolo|role|posizione)\b/i.test(q)) return 'role';
  if (/\b(nome|cognome|full name|name)\b/i.test(q)) return 'name';
  return null;
}

function isConsentPrompt(question: string): boolean {
  const q = String(question || '').toLowerCase();
  return /\b(posso.*contatt|consenso|permesso|dati di contatto|restare in contatto|may i.*contact|permission)\b/i.test(q);
}

function isDeepOfferPrompt(question: string): boolean {
  const q = String(question || '').toLowerCase();
  return /\b(continuare|proseguire|ancora qualche domanda|approfondire|hai ancora tempo|domande extra|continue|few more questions|go deeper|extend)\b/i.test(q);
}

function estimateSeconds(userText: string, rand: () => number): number {
  const words = String(userText || '').split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(50, Math.round(8 + words * 1.5 + rand() * 6)));
}

function makePersonas(): Persona[] {
  return [
    {
      name: 'manager_pragmatico',
      deepAcceptRate: 0.45,
      consentAcceptRate: 0.8,
      skipFieldRate: 0.1,
      firstMessages: [
        'Nel breve periodo la priorità è capire dove l AI porta margine operativo reale.',
        'Serve concretezza: meno hype e più risultati misurabili.',
      ],
      dynamicAnswers: [
        'Nel nostro caso l impatto è sulla velocità decisionale e sulla qualità del servizio.',
        'Il rischio principale è implementare troppo presto senza governance.',
        'Per me conta avere KPI chiari e ownership interna.',
        'Vorrei più casi reali e meno teoria.',
      ],
      values: {
        name: 'Luca Bianchi',
        email: 'luca.bianchi@example.com',
        phone: '+39 333 445 9988',
        company: 'Bianchi SRL',
        role: 'Operations Manager',
        linkedin: 'https://linkedin.com/in/luca-bianchi'
      }
    },
    {
      name: 'leader_collaborativo',
      deepAcceptRate: 0.75,
      consentAcceptRate: 0.95,
      skipFieldRate: 0.05,
      firstMessages: [
        'Per me la priorità è accompagnare le persone nella trasformazione con un piano chiaro.',
        'L urgenza è culturale: servono competenze e fiducia nel cambiamento.',
      ],
      dynamicAnswers: [
        'Stiamo lavorando su processi cross-team per sperimentare in modo responsabile.',
        'Mi interessa capire come trasformare insight in iniziative concrete.',
        'Le aspettative sul TEDx sono alte: mi aspetto visione ma anche strumenti pratici.',
        'Il valore emerge quando tecnologia e persone crescono insieme.',
      ],
      values: {
        name: 'Francesca Ferri',
        email: 'francesca.ferri@example.com',
        phone: '+39 347 778 1122',
        company: 'Ferri SPA',
        role: 'CEO',
        linkedin: 'https://linkedin.com/in/francesca-ferri'
      }
    },
    {
      name: 'scettico_costruttivo',
      deepAcceptRate: 0.3,
      consentAcceptRate: 0.55,
      skipFieldRate: 0.2,
      firstMessages: [
        'Prima di tutto voglio vedere utilità concreta, non slogan.',
        'L urgenza è evitare decisioni guidate dalla fomo.',
      ],
      dynamicAnswers: [
        'Ci sono potenzialità ma anche rischi forti di superficialità.',
        'Se non definiamo limiti e responsabilità, il progetto deraglia.',
        'Sono aperto a sperimentare, ma solo con casi d uso ben delimitati.',
        'Mi interessa il tema etico e l impatto sul lavoro.',
      ],
      values: {
        name: 'Marco Riva',
        email: 'marco.riva@example.com',
        phone: '+39 349 110 2200',
        company: 'Riva Tech',
        role: 'CTO',
        linkedin: 'https://linkedin.com/in/marco-riva'
      }
    }
  ];
}

function makeUserReply(params: {
  assistantQuestion: string;
  persona: Persona;
  rand: () => number;
  turnIndex: number;
  provided: Set<string>;
}): string {
  const { assistantQuestion, persona, rand, turnIndex, provided } = params;

  if (turnIndex === 0) {
    return pick(rand, persona.firstMessages);
  }

  if (isDeepOfferPrompt(assistantQuestion)) {
    return rand() <= persona.deepAcceptRate ? 'si continuiamo' : 'preferisco concludere';
  }

  if (isConsentPrompt(assistantQuestion)) {
    return rand() <= persona.consentAcceptRate ? 'si va bene' : 'preferisco non lasciare i miei dati';
  }

  const askedField = inferAskedField(assistantQuestion);
  if (askedField) {
    if (provided.has(askedField) && rand() < 0.65) return 'te l ho gia detto';
    if (rand() < persona.skipFieldRate) return 'preferisco non dirlo';
    provided.add(askedField);
    const value = persona.values[askedField as keyof Persona['values']];
    return value || pick(rand, persona.dynamicAnswers);
  }

  return pick(rand, persona.dynamicAnswers);
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n: number, d = 3): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function createPrisma(databaseUrl: string): { prisma: PrismaClient; pool: any } {
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

async function createAuthCookie(authSecret: string): Promise<string> {
  const cookieName = '__Secure-authjs.session-token';
  const token = await encode({
    secret: authSecret,
    salt: cookieName,
    token: {
      sub: 'codex-flow-tester',
      role: 'ADMIN',
      name: 'Codex Flow Tester',
      email: 'codex.flow.tester@example.com'
    },
    maxAge: 60 * 60
  });
  return `${cookieName}=${token}`;
}

async function callChat(baseUrl: string, cookie: string, payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : 'request_failed' }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runEnvironment(params: {
  env: EnvConfig;
  botId: string;
  runPlan: Persona[];
  maxTurns: number;
  seed: number;
}): Promise<{ summary: Summary; runs: RunResult[] }> {
  const { env, botId, runPlan, maxTurns, seed } = params;
  const { prisma, pool } = createPrisma(env.databaseUrl);
  const cookie = await createAuthCookie(env.authSecret);

  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: {
        id: true,
        language: true,
        topics: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true }
        }
      }
    });
    if (!bot) throw new Error(`bot_not_found_${env.label}`);

    const runs: RunResult[] = [];

    for (let i = 0; i < runPlan.length; i++) {
      const persona = runPlan[i];
      const rand = mulberry32(seed + i * 31 + (env.label === 'staging' ? 997 : 0));
      const conv = await prisma.conversation.create({
        data: {
          botId,
          participantId: `flow-bench-${env.label}-${Date.now()}-${i + 1}`,
          status: 'STARTED',
          currentTopicId: bot.topics[0]?.id || null,
          metadata: {},
        }
      });

      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      const provided = new Set<string>();
      let effectiveDuration = 0;
      let completed = false;
      let httpErrors = 0;

      for (let t = 0; t < maxTurns && !completed; t++) {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
        const userReply = makeUserReply({
          assistantQuestion: lastAssistant,
          persona,
          rand,
          turnIndex: t,
          provided,
        });

        messages.push({ role: 'user', content: userReply });
        effectiveDuration += estimateSeconds(userReply, rand);

        const response = await callChat(env.baseUrl, cookie, {
          messages,
          conversationId: conv.id,
          botId,
          effectiveDuration,
          clientMessageId: `${env.label}-run${i + 1}-turn${t + 1}-${Date.now()}`
        });

        if (!response.ok) {
          httpErrors += 1;
          console.log(`${env.label} run=${i + 1} turn=${t + 1} http_error status=${response.status} err=${String(response.data?.error || '').slice(0, 200)}`);
          break;
        }

        const assistantText = String(response.data?.text || '').trim();
        messages.push({ role: 'assistant', content: assistantText });
        completed = Boolean(response.data?.isCompleted);
      }

      const convState = await prisma.conversation.findUnique({
        where: { id: conv.id },
        select: {
          status: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true, metadata: true }
          }
        }
      });

      const transcriptTurns: TranscriptSemanticTurn[] = (convState?.messages || [])
        .filter(m => m.role === 'assistant' || m.role === 'user')
        .map(m => {
          if (m.role === 'user') {
            return { role: 'user', content: String(m.content || '') };
          }
          const meta: Record<string, any> = (m.metadata && typeof m.metadata === 'object')
            ? (m.metadata as Record<string, any>)
            : {};
          const phaseRaw = typeof meta.phase === 'string' ? meta.phase.toUpperCase() : '';
          const phase = (phaseRaw === 'SCAN' || phaseRaw === 'DEEP' || phaseRaw === 'DEEP_OFFER' || phaseRaw === 'DATA_COLLECTION')
            ? (phaseRaw as 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION')
            : undefined;

          return {
            role: 'assistant',
            content: String(m.content || ''),
            phase,
            topicLabel: typeof meta.topicLabel === 'string' ? meta.topicLabel : undefined,
          };
        });

      const semantic = evaluateTranscriptSemanticFlow({
        turns: transcriptTurns,
        language: bot.language || 'it'
      });

      const checks = semantic.turns.map(t => t.checks);
      const phaseSet = new Set<string>();
      for (const t of transcriptTurns) {
        if (t.role === 'assistant' && t.phase) {
          phaseSet.add(String(t.phase).toUpperCase());
        }
      }

      runs.push({
        env: env.label,
        run: i + 1,
        persona: persona.name,
        conversationId: conv.id,
        httpErrors,
        completed: convState?.status === 'COMPLETED' || completed,
        totalMessages: transcriptTurns.length,
        semanticScore: semantic.score,
        transitionFailures: semantic.transitionFailures,
        consentFailures: semantic.consentFailures,
        hasDeep: phaseSet.has('DEEP') || phaseSet.has('DEEP_OFFER'),
        hasDataCollection: phaseSet.has('DATA_COLLECTION'),
        interestingSignalCaptureRate: checks.length ? checks.filter(c => c.interestingSignalCapture).length / checks.length : 0,
        engagementQualityRate: checks.length ? checks.filter(c => c.engagementQuality).length / checks.length : 0,
        semanticUnderstandingRate: checks.length ? checks.filter(c => c.semanticUnderstanding).length / checks.length : 0,
        nonGenericRate: checks.length ? checks.filter(c => c.nonRepetitiveNonGeneric).length / checks.length : 0,
        transcript: transcriptTurns.map(t => ({
          role: t.role,
          phase: t.role === 'assistant' ? t.phase : undefined,
          topicLabel: t.role === 'assistant' ? t.topicLabel : undefined,
          content: String(t.content || '').replace(/\s+/g, ' ').trim()
        }))
      });

      console.log(`${env.label} run=${i + 1} conv=${conv.id} completed=${runs[runs.length - 1].completed} score=${runs[runs.length - 1].semanticScore} deep=${runs[runs.length - 1].hasDeep} data=${runs[runs.length - 1].hasDataCollection} httpErrors=${httpErrors}`);
    }

    const summary: Summary = {
      env: env.label,
      runs: runs.length,
      completionRate: avg(runs.map(r => (r.completed ? 1 : 0))),
      avgSemanticScore: avg(runs.map(r => r.semanticScore)),
      passRate: avg(runs.map(r => (r.semanticScore >= 80 && r.hasDeep && r.hasDataCollection && r.transitionFailures <= 2 ? 1 : 0))),
      hasDeepRate: avg(runs.map(r => (r.hasDeep ? 1 : 0))),
      hasDataCollectionRate: avg(runs.map(r => (r.hasDataCollection ? 1 : 0))),
      avgTransitionFailures: avg(runs.map(r => r.transitionFailures)),
      avgConsentFailures: avg(runs.map(r => r.consentFailures)),
      avgInterestingSignalCaptureRate: avg(runs.map(r => r.interestingSignalCaptureRate)),
      avgEngagementQualityRate: avg(runs.map(r => r.engagementQualityRate)),
      avgSemanticUnderstandingRate: avg(runs.map(r => r.semanticUnderstandingRate)),
      avgNonGenericRate: avg(runs.map(r => r.nonGenericRate)),
      httpErrorRuns: runs.filter(r => r.httpErrors > 0).length,
    };

    return { summary, runs };
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function buildMarkdown(params: {
  generatedAt: string;
  botId: string;
  runsPerEnv: number;
  maxTurns: number;
  production: Summary;
  staging: Summary;
  prodRuns: RunResult[];
  stgRuns: RunResult[];
}): string {
  const { generatedAt, botId, runsPerEnv, maxTurns, production, staging, prodRuns, stgRuns } = params;

  function row(label: string, pv: number, sv: number, isPct = true): string {
    if (isPct) {
      return `| ${label} | ${(pv * 100).toFixed(2)}% | ${(sv * 100).toFixed(2)}% | ${((sv - pv) * 100).toFixed(2)} pp |`;
    }
    return `| ${label} | ${pv.toFixed(2)} | ${sv.toFixed(2)} | ${(sv - pv).toFixed(2)} |`;
  }

  const lines: string[] = [];
  lines.push('# Live Conversation Flow Benchmark (Production vs Staging)');
  lines.push('');
  lines.push(`Generated at: ${generatedAt}`);
  lines.push(`Bot ID: ${botId}`);
  lines.push(`Runs per env: ${runsPerEnv} | maxTurns per run: ${maxTurns}`);
  lines.push('');

  lines.push('## Summary Metrics');
  lines.push('');
  lines.push('| Metric | Production | Staging | Delta (Stg-Prod) |');
  lines.push('|---|---:|---:|---:|');
  lines.push(row('Completion rate', production.completionRate, staging.completionRate));
  lines.push(row('Pass rate (>=80 + DEEP + DATA + transition<=2)', production.passRate, staging.passRate));
  lines.push(row('Has DEEP rate', production.hasDeepRate, staging.hasDeepRate));
  lines.push(row('Has DATA_COLLECTION rate', production.hasDataCollectionRate, staging.hasDataCollectionRate));
  lines.push(row('Interesting signal capture', production.avgInterestingSignalCaptureRate, staging.avgInterestingSignalCaptureRate));
  lines.push(row('Engagement quality', production.avgEngagementQualityRate, staging.avgEngagementQualityRate));
  lines.push(row('Semantic understanding', production.avgSemanticUnderstandingRate, staging.avgSemanticUnderstandingRate));
  lines.push(row('Non-generic question rate', production.avgNonGenericRate, staging.avgNonGenericRate));
  lines.push(row('Avg semantic score', production.avgSemanticScore, staging.avgSemanticScore, false));
  lines.push(row('Avg transition failures', production.avgTransitionFailures, staging.avgTransitionFailures, false));
  lines.push(row('Avg consent failures', production.avgConsentFailures, staging.avgConsentFailures, false));
  lines.push(row('HTTP error runs', production.httpErrorRuns, staging.httpErrorRuns, false));
  lines.push('');

  const prodWorst = [...prodRuns].sort((a, b) => a.semanticScore - b.semanticScore)[0];
  const stgWorst = [...stgRuns].sort((a, b) => a.semanticScore - b.semanticScore)[0];

  for (const sample of [prodWorst, stgWorst]) {
    lines.push(`## ${sample.env.toUpperCase()} Worst Run`);
    lines.push(`- run: ${sample.run} | persona: ${sample.persona} | conversationId: ${sample.conversationId}`);
    lines.push(`- completed: ${sample.completed} | semanticScore: ${sample.semanticScore} | deep: ${sample.hasDeep} | dataCollection: ${sample.hasDataCollection}`);
    lines.push('```text');
    for (const turn of sample.transcript.slice(0, 26)) {
      const role = turn.role === 'assistant' ? 'A' : 'U';
      const phase = turn.role === 'assistant' ? `[${turn.phase || '-'}|${turn.topicLabel || '-'}]` : '';
      lines.push(`${role}${phase}: ${turn.content}`);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const botId = String(process.argv[2] || 'cmke4ayef000613i8m5dkiuli');
  const runsPerEnv = Number(process.argv[3] || 6);
  const maxTurns = Number(process.argv[4] || 14);
  const seed = Number(process.argv[5] || 42);

  const prod = loadEnv('/tmp/aii-prod.env');
  const stg = loadEnv('/tmp/aii-staging.env');

  const envs: EnvConfig[] = [
    {
      label: 'production',
      baseUrl: 'https://businesstuner.voler.ai',
      databaseUrl: prod.DATABASE_URL,
      authSecret: prod.AUTH_SECRET,
    },
    {
      label: 'staging',
      baseUrl: 'https://btstage.voler.ai',
      databaseUrl: stg.DATABASE_URL,
      authSecret: stg.AUTH_SECRET,
    }
  ];

  if (!envs.every(e => e.baseUrl && e.databaseUrl && e.authSecret)) {
    throw new Error('Missing baseUrl/databaseUrl/authSecret in env files.');
  }

  const personas = makePersonas();
  const runPlan: Persona[] = [];
  for (let i = 0; i < runsPerEnv; i++) {
    runPlan.push(personas[i % personas.length]);
  }

  const prodResult = await runEnvironment({ env: envs[0], botId, runPlan, maxTurns, seed });
  const stgResult = await runEnvironment({ env: envs[1], botId, runPlan, maxTurns, seed });

  const finalReport = {
    generatedAt: new Date().toISOString(),
    botId,
    runsPerEnv,
    maxTurns,
    production: prodResult.summary,
    staging: stgResult.summary,
    delta: {
      avgSemanticScore: round(stgResult.summary.avgSemanticScore - prodResult.summary.avgSemanticScore),
      passRate: round(stgResult.summary.passRate - prodResult.summary.passRate),
      hasDeepRate: round(stgResult.summary.hasDeepRate - prodResult.summary.hasDeepRate),
      hasDataCollectionRate: round(stgResult.summary.hasDataCollectionRate - prodResult.summary.hasDataCollectionRate),
      interestingSignalCaptureRate: round(stgResult.summary.avgInterestingSignalCaptureRate - prodResult.summary.avgInterestingSignalCaptureRate),
      engagementQualityRate: round(stgResult.summary.avgEngagementQualityRate - prodResult.summary.avgEngagementQualityRate),
      semanticUnderstandingRate: round(stgResult.summary.avgSemanticUnderstandingRate - prodResult.summary.avgSemanticUnderstandingRate),
      avgTransitionFailures: round(stgResult.summary.avgTransitionFailures - prodResult.summary.avgTransitionFailures),
      avgConsentFailures: round(stgResult.summary.avgConsentFailures - prodResult.summary.avgConsentFailures),
    },
    runs: {
      production: prodResult.runs,
      staging: stgResult.runs,
    }
  };

  mkdirSync('docs/analysis', { recursive: true });
  writeFileSync('docs/analysis/prod-vs-staging-live-report.json', JSON.stringify(finalReport, null, 2));
  writeFileSync('docs/analysis/prod-vs-staging-live-report.md', buildMarkdown({
    generatedAt: finalReport.generatedAt,
    botId,
    runsPerEnv,
    maxTurns,
    production: prodResult.summary,
    staging: stgResult.summary,
    prodRuns: prodResult.runs,
    stgRuns: stgResult.runs,
  }));

  console.log('live_report_json=docs/analysis/prod-vs-staging-live-report.json');
  console.log('live_report_md=docs/analysis/prod-vs-staging-live-report.md');
  console.log(`prod_avg_semantic=${round(prodResult.summary.avgSemanticScore,2)} stg_avg_semantic=${round(stgResult.summary.avgSemanticScore,2)}`);
  console.log(`prod_pass_rate=${round(prodResult.summary.passRate,3)} stg_pass_rate=${round(stgResult.summary.passRate,3)}`);
}

main().catch(err => {
  console.error('COMPARE_LIVE_ERROR', err);
  process.exit(1);
});
