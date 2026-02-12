import { Client } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';

type LoadedEnv = Record<string, string>;

type BotConfig = {
  id: string;
  slug: string | null;
  name: string;
  language: string | null;
  tone: string | null;
  researchGoal: string | null;
  collectCandidateData: boolean;
  candidateDataFields: any;
  maxDurationMins: number | null;
  modelProvider: string | null;
  modelName: string | null;
};

type ConversationRow = {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  effectiveDuration: number;
  candidateProfile: any;
  metadata: any;
};

type MessageRow = {
  conversationId: string;
  role: string;
  content: string;
  metadata: any;
  createdAt: Date;
};

type ConversationBundle = {
  conversation: ConversationRow;
  messages: MessageRow[];
};

type EvaluatedConversation = {
  id: string;
  startedAt: string;
  status: string;
  totalMessages: number;
  userTurns: number;
  assistantTurns: number;
  semanticScore: number;
  semanticFailedTurns: number;
  transitionFailures: number;
  consentFailures: number;
  hasScan: boolean;
  hasDeep: boolean;
  hasDataCollection: boolean;
  interestingSignalCaptureRate: number;
  engagementQualityRate: number;
  semanticUnderstandingRate: number;
  nonGenericRate: number;
  meaningRespectRate: number;
  transitionCoherenceRate: number;
  duplicateAssistantRate: number;
  genericAssistantRate: number;
  candidateFieldsFilled: number;
  candidateFieldsExpected: number;
  turns: TranscriptSemanticTurn[];
};

type EnvironmentSummary = {
  envLabel: 'production' | 'staging';
  dbHost: string;
  bot: BotConfig;
  allConversationsInWindow: number;
  completedInWindow: number;
  completionRate: number;
  analyzedConversations: number;
  avgMessages: number;
  avgAssistantTurns: number;
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
  avgMeaningRespectRate: number;
  avgTransitionCoherenceRate: number;
  avgDuplicateAssistantRate: number;
  avgGenericAssistantRate: number;
  avgCandidateCompleteness: number;
  conversations: EvaluatedConversation[];
  samples: {
    best?: EvaluatedConversation;
    median?: EvaluatedConversation;
    worst?: EvaluatedConversation;
  };
};

type CompareReport = {
  generatedAt: string;
  botId: string;
  daysWindow: number;
  maxConversations: number;
  minMessages: number;
  production: EnvironmentSummary;
  staging: EnvironmentSummary;
  deltas: Record<string, number>;
};

const GENERIC_PATTERNS_IT = [
  /\bcosa ne pensi\??\b/i,
  /\bmi racconti di piu\??\b/i,
  /\bc e altro\??\b/i,
  /\bcome la vedi\??\b/i,
  /\bany other thoughts\??\b/i,
  /\btell me more\??\b/i,
  /\bwhat do you think\??\b/i,
];

function loadEnvFile(filePath: string): LoadedEnv {
  const fs = require('node:fs');
  const raw = fs.readFileSync(filePath, 'utf8');
  const out: LoadedEnv = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = String(m[2] || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(value: number, digits = 2): number {
  const p = Math.pow(10, digits);
  return Math.round(value * p) / p;
}

function normalizeText(text: string): string {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getDbHost(urlStr: string): string {
  try {
    return new URL(urlStr).host;
  } catch {
    return 'unknown';
  }
}

function inferExpectedFieldCount(candidateDataFields: any): number {
  if (!candidateDataFields) return 0;
  if (Array.isArray(candidateDataFields)) {
    const required = candidateDataFields.filter((f: any) => f && (f.required === true || f.isRequired === true));
    return required.length > 0 ? required.length : candidateDataFields.length;
  }
  if (typeof candidateDataFields === 'object') {
    const keys = Object.keys(candidateDataFields);
    return keys.length;
  }
  return 0;
}

function countFilledCandidateFields(profile: any): number {
  if (!profile || typeof profile !== 'object') return 0;
  return Object.values(profile).filter((v: any) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }).length;
}

async function fetchEnvironmentDataset(params: {
  envLabel: 'production' | 'staging';
  databaseUrl: string;
  botId: string;
  maxConversations: number;
  minMessages: number;
  daysWindow: number;
}): Promise<EnvironmentSummary> {
  const client = new Client({ connectionString: params.databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const botResult = await client.query(
      `
      select id, slug, name, language, tone, "researchGoal", "collectCandidateData", "candidateDataFields", "maxDurationMins", "modelProvider", "modelName"
      from "Bot"
      where id = $1
      `,
      [params.botId]
    );

    if (botResult.rowCount === 0) {
      throw new Error(`Bot ${params.botId} not found in ${params.envLabel}`);
    }

    const bot = botResult.rows[0] as BotConfig;

    const totalWindowResult = await client.query(
      `
      select
        count(*)::int as total,
        sum(case when status = 'COMPLETED' then 1 else 0 end)::int as completed
      from "Conversation"
      where "botId" = $1
        and "startedAt" >= now() - ($2 * interval '1 day')
      `,
      [params.botId, params.daysWindow]
    );

    const totalWindow = Number(totalWindowResult.rows[0]?.total || 0);
    const completedWindow = Number(totalWindowResult.rows[0]?.completed || 0);

    const conversationIdsResult = await client.query(
      `
      select c.id, c.status, c."startedAt", c."completedAt", c."effectiveDuration", c."candidateProfile", c.metadata,
        coalesce(msg_stats.msg_count, 0)::int as msg_count
      from "Conversation" c
      left join (
        select "conversationId", count(*)::int as msg_count
        from "Message"
        group by "conversationId"
      ) as msg_stats on msg_stats."conversationId" = c.id
      where c."botId" = $1
        and c.status = 'COMPLETED'
        and c."startedAt" >= now() - ($2 * interval '1 day')
        and coalesce(msg_stats.msg_count, 0) >= $3
      order by c."startedAt" desc
      limit $4
      `,
      [params.botId, params.daysWindow, params.minMessages, params.maxConversations]
    );

    const conversations = conversationIdsResult.rows as Array<ConversationRow & { msg_count: number }>;
    const ids = conversations.map(c => c.id);

    const byConversation = new Map<string, MessageRow[]>();
    if (ids.length > 0) {
      const messagesResult = await client.query(
        `
        select "conversationId", role, content, metadata, "createdAt"
        from "Message"
        where "conversationId" = any($1::text[])
        order by "conversationId" asc, "createdAt" asc
        `,
        [ids]
      );

      for (const row of messagesResult.rows as MessageRow[]) {
        const arr = byConversation.get(row.conversationId) || [];
        arr.push(row);
        byConversation.set(row.conversationId, arr);
      }
    }

    const expectedCandidateFields = inferExpectedFieldCount(bot.candidateDataFields);

    const evaluated: EvaluatedConversation[] = conversations.map(conv => {
      const messages = byConversation.get(conv.id) || [];
      const transcriptTurns: TranscriptSemanticTurn[] = messages
        .filter(m => m.role === 'assistant' || m.role === 'user')
        .map(m => {
          if (m.role === 'user') {
            return {
              role: 'user',
              content: String(m.content || '')
            } as TranscriptSemanticTurn;
          }

          const meta: Record<string, any> = m.metadata && typeof m.metadata === 'object'
            ? (m.metadata as Record<string, any>)
            : {};
          const phaseRaw = typeof meta.phase === 'string' ? meta.phase.toUpperCase() : '';
          const phase = phaseRaw === 'SCAN' || phaseRaw === 'DEEP' || phaseRaw === 'DEEP_OFFER' || phaseRaw === 'DATA_COLLECTION'
            ? (phaseRaw as 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION')
            : undefined;

          return {
            role: 'assistant',
            content: String(m.content || ''),
            phase,
            topicLabel: typeof meta.topicLabel === 'string' ? meta.topicLabel : undefined,
          } as TranscriptSemanticTurn;
        });

      const semantic = evaluateTranscriptSemanticFlow({
        turns: transcriptTurns,
        language: bot.language || 'it'
      });

      const assistantTurns = transcriptTurns.filter(t => t.role === 'assistant');
      const userTurns = transcriptTurns.filter(t => t.role === 'user');

      const phaseSet = new Set<string>();
      for (const a of assistantTurns) {
        if (a.phase) phaseSet.add(String(a.phase).toUpperCase());
      }

      const normalizedAssistant = assistantTurns.map(t => normalizeText(t.content));
      const uniqueAssistant = new Set(normalizedAssistant.filter(Boolean));
      const duplicateAssistantRate = assistantTurns.length > 0
        ? 1 - (uniqueAssistant.size / assistantTurns.length)
        : 0;

      const genericAssistantTurns = assistantTurns.filter(t => {
        const text = String(t.content || '');
        return GENERIC_PATTERNS_IT.some(re => re.test(text));
      }).length;
      const genericAssistantRate = assistantTurns.length > 0 ? genericAssistantTurns / assistantTurns.length : 0;

      const checks = semantic.turns.map(t => t.checks);
      const interestingSignalCaptureRate = checks.length ? checks.filter(c => c.interestingSignalCapture).length / checks.length : 0;
      const engagementQualityRate = checks.length ? checks.filter(c => c.engagementQuality).length / checks.length : 0;
      const semanticUnderstandingRate = checks.length ? checks.filter(c => c.semanticUnderstanding).length / checks.length : 0;
      const nonGenericRate = checks.length ? checks.filter(c => c.nonRepetitiveNonGeneric).length / checks.length : 0;
      const meaningRespectRate = checks.length ? checks.filter(c => c.meaningRespect).length / checks.length : 0;
      const transitionCoherenceRate = checks.length ? checks.filter(c => c.transitionCoherence).length / checks.length : 0;

      const filledCandidateFields = countFilledCandidateFields(conv.candidateProfile);

      return {
        id: conv.id,
        startedAt: new Date(conv.startedAt).toISOString(),
        status: conv.status,
        totalMessages: messages.length,
        userTurns: userTurns.length,
        assistantTurns: assistantTurns.length,
        semanticScore: semantic.score,
        semanticFailedTurns: semantic.failedTurns,
        transitionFailures: semantic.transitionFailures,
        consentFailures: semantic.consentFailures,
        hasScan: phaseSet.has('SCAN'),
        hasDeep: phaseSet.has('DEEP'),
        hasDataCollection: phaseSet.has('DATA_COLLECTION'),
        interestingSignalCaptureRate,
        engagementQualityRate,
        semanticUnderstandingRate,
        nonGenericRate,
        meaningRespectRate,
        transitionCoherenceRate,
        duplicateAssistantRate,
        genericAssistantRate,
        candidateFieldsFilled: filledCandidateFields,
        candidateFieldsExpected: expectedCandidateFields,
        turns: transcriptTurns,
      };
    });

    const passRate = evaluated.length
      ? evaluated.filter(c => c.semanticScore >= 80 && c.transitionFailures <= 2 && c.hasDeep && c.hasDataCollection).length / evaluated.length
      : 0;

    const sortedByScore = [...evaluated].sort((a, b) => a.semanticScore - b.semanticScore);
    const median = sortedByScore.length > 0
      ? sortedByScore[Math.floor((sortedByScore.length - 1) / 2)]
      : undefined;

    const avgCandidateCompleteness = bot.collectCandidateData
      ? avg(evaluated.map(c => {
          if (c.candidateFieldsExpected <= 0) return 1;
          return Math.min(1, c.candidateFieldsFilled / c.candidateFieldsExpected);
        }))
      : 1;

    return {
      envLabel: params.envLabel,
      dbHost: getDbHost(params.databaseUrl),
      bot,
      allConversationsInWindow: totalWindow,
      completedInWindow: completedWindow,
      completionRate: totalWindow > 0 ? completedWindow / totalWindow : 0,
      analyzedConversations: evaluated.length,
      avgMessages: avg(evaluated.map(c => c.totalMessages)),
      avgAssistantTurns: avg(evaluated.map(c => c.assistantTurns)),
      avgSemanticScore: avg(evaluated.map(c => c.semanticScore)),
      passRate,
      hasDeepRate: avg(evaluated.map(c => (c.hasDeep ? 1 : 0))),
      hasDataCollectionRate: avg(evaluated.map(c => (c.hasDataCollection ? 1 : 0))),
      avgTransitionFailures: avg(evaluated.map(c => c.transitionFailures)),
      avgConsentFailures: avg(evaluated.map(c => c.consentFailures)),
      avgInterestingSignalCaptureRate: avg(evaluated.map(c => c.interestingSignalCaptureRate)),
      avgEngagementQualityRate: avg(evaluated.map(c => c.engagementQualityRate)),
      avgSemanticUnderstandingRate: avg(evaluated.map(c => c.semanticUnderstandingRate)),
      avgNonGenericRate: avg(evaluated.map(c => c.nonGenericRate)),
      avgMeaningRespectRate: avg(evaluated.map(c => c.meaningRespectRate)),
      avgTransitionCoherenceRate: avg(evaluated.map(c => c.transitionCoherenceRate)),
      avgDuplicateAssistantRate: avg(evaluated.map(c => c.duplicateAssistantRate)),
      avgGenericAssistantRate: avg(evaluated.map(c => c.genericAssistantRate)),
      avgCandidateCompleteness,
      conversations: evaluated,
      samples: {
        best: sortedByScore[sortedByScore.length - 1],
        median,
        worst: sortedByScore[0],
      }
    };
  } finally {
    await client.end();
  }
}

function transcriptExcerpt(conv?: EvaluatedConversation, maxTurns = 18): string {
  if (!conv) return '_n/a_';
  const lines: string[] = [];
  const turns = conv.turns.slice(0, maxTurns);
  for (const t of turns) {
    const role = t.role === 'assistant' ? 'A' : 'U';
    const phase = t.role === 'assistant' ? `[${t.phase || '-'}|${t.topicLabel || '-'}]` : '';
    const text = String(t.content || '').replace(/\s+/g, ' ').trim();
    lines.push(`${role}${phase}: ${text}`);
  }
  return lines.join('\n');
}

function buildMarkdown(report: CompareReport): string {
  const p = report.production;
  const s = report.staging;

  const lines: string[] = [];
  lines.push(`# Production vs Staging Conversation Flow`);
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Bot ID: ${report.botId}`);
  lines.push(`Window: last ${report.daysWindow} days | max ${report.maxConversations} completed conversations/env | min messages ${report.minMessages}`);
  lines.push('');
  lines.push('## Bot Config Check');
  lines.push(`- Production bot: \`${p.bot.name}\` (slug: \`${p.bot.slug}\`, language: \`${p.bot.language}\`)`);
  lines.push(`- Staging bot: \`${s.bot.name}\` (slug: \`${s.bot.slug}\`, language: \`${s.bot.language}\`)`);
  lines.push(`- Research goal (prod): ${p.bot.researchGoal || 'n/a'}`);
  lines.push(`- Research goal (staging): ${s.bot.researchGoal || 'n/a'}`);
  lines.push(`- Candidate data collection enabled: prod=${p.bot.collectCandidateData} staging=${s.bot.collectCandidateData}`);
  lines.push('');

  lines.push('## Quantitative Comparison');
  lines.push('');
  lines.push('| Metric | Production | Staging | Delta (Staging-Prod) |');
  lines.push('|---|---:|---:|---:|');

  const rows: Array<[string, number, number]> = [
    ['Completion rate', p.completionRate, s.completionRate],
    ['Avg semantic score', p.avgSemanticScore, s.avgSemanticScore],
    ['Pass rate (score>=80 + DEEP + DATA)', p.passRate, s.passRate],
    ['Has DEEP rate', p.hasDeepRate, s.hasDeepRate],
    ['Has DATA_COLLECTION rate', p.hasDataCollectionRate, s.hasDataCollectionRate],
    ['Avg transition failures', p.avgTransitionFailures, s.avgTransitionFailures],
    ['Avg consent failures', p.avgConsentFailures, s.avgConsentFailures],
    ['Interesting signal capture rate', p.avgInterestingSignalCaptureRate, s.avgInterestingSignalCaptureRate],
    ['Engagement quality rate', p.avgEngagementQualityRate, s.avgEngagementQualityRate],
    ['Semantic understanding rate', p.avgSemanticUnderstandingRate, s.avgSemanticUnderstandingRate],
    ['Non-generic question rate', p.avgNonGenericRate, s.avgNonGenericRate],
    ['Meaning respect rate', p.avgMeaningRespectRate, s.avgMeaningRespectRate],
    ['Transition coherence rate', p.avgTransitionCoherenceRate, s.avgTransitionCoherenceRate],
    ['Duplicate assistant rate (lower is better)', p.avgDuplicateAssistantRate, s.avgDuplicateAssistantRate],
    ['Generic assistant rate (lower is better)', p.avgGenericAssistantRate, s.avgGenericAssistantRate],
    ['Candidate completeness', p.avgCandidateCompleteness, s.avgCandidateCompleteness],
  ];

  for (const [label, pv, sv] of rows) {
    const delta = sv - pv;
    lines.push(`| ${label} | ${round(pv * (label.includes('score') ? 1 : 100), 2)}${label.includes('score') ? '' : '%'} | ${round(sv * (label.includes('score') ? 1 : 100), 2)}${label.includes('score') ? '' : '%'} | ${round(delta * (label.includes('score') ? 1 : 100), 2)}${label.includes('score') ? '' : ' pp'} |`);
  }
  lines.push('');

  lines.push('## Sample Transcripts (As Seen by User)');
  lines.push('');

  for (const env of [p, s]) {
    lines.push(`### ${env.envLabel.toUpperCase()} - Best Sample`);
    if (env.samples.best) {
      lines.push(`- conversationId: \`${env.samples.best.id}\` | semanticScore=${env.samples.best.semanticScore} | messages=${env.samples.best.totalMessages}`);
      lines.push('```text');
      lines.push(transcriptExcerpt(env.samples.best));
      lines.push('```');
    } else {
      lines.push('_n/a_');
    }

    lines.push(`### ${env.envLabel.toUpperCase()} - Median Sample`);
    if (env.samples.median) {
      lines.push(`- conversationId: \`${env.samples.median.id}\` | semanticScore=${env.samples.median.semanticScore} | messages=${env.samples.median.totalMessages}`);
      lines.push('```text');
      lines.push(transcriptExcerpt(env.samples.median));
      lines.push('```');
    } else {
      lines.push('_n/a_');
    }

    lines.push(`### ${env.envLabel.toUpperCase()} - Worst Sample`);
    if (env.samples.worst) {
      lines.push(`- conversationId: \`${env.samples.worst.id}\` | semanticScore=${env.samples.worst.semanticScore} | messages=${env.samples.worst.totalMessages}`);
      lines.push('```text');
      lines.push(transcriptExcerpt(env.samples.worst));
      lines.push('```');
    } else {
      lines.push('_n/a_');
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const botId = String(process.argv[2] || 'cmke4ayef000613i8m5dkiuli');
  const daysWindow = Number(process.argv[3] || 30);
  const maxConversations = Number(process.argv[4] || 20);
  const minMessages = Number(process.argv[5] || 18);

  const prodEnv = loadEnvFile('/tmp/aii-prod.env');
  const stagingEnv = loadEnvFile('/tmp/aii-staging.env');

  if (!prodEnv.DATABASE_URL || !stagingEnv.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in /tmp/aii-prod.env or /tmp/aii-staging.env');
  }

  const [production, staging] = await Promise.all([
    fetchEnvironmentDataset({
      envLabel: 'production',
      databaseUrl: prodEnv.DATABASE_URL,
      botId,
      maxConversations,
      minMessages,
      daysWindow,
    }),
    fetchEnvironmentDataset({
      envLabel: 'staging',
      databaseUrl: stagingEnv.DATABASE_URL,
      botId,
      maxConversations,
      minMessages,
      daysWindow,
    }),
  ]);

  const deltas: Record<string, number> = {
    avgSemanticScore: round(staging.avgSemanticScore - production.avgSemanticScore, 3),
    passRate: round(staging.passRate - production.passRate, 3),
    interestingSignalCaptureRate: round(staging.avgInterestingSignalCaptureRate - production.avgInterestingSignalCaptureRate, 3),
    engagementQualityRate: round(staging.avgEngagementQualityRate - production.avgEngagementQualityRate, 3),
    semanticUnderstandingRate: round(staging.avgSemanticUnderstandingRate - production.avgSemanticUnderstandingRate, 3),
    transitionCoherenceRate: round(staging.avgTransitionCoherenceRate - production.avgTransitionCoherenceRate, 3),
    avgTransitionFailures: round(staging.avgTransitionFailures - production.avgTransitionFailures, 3),
    avgConsentFailures: round(staging.avgConsentFailures - production.avgConsentFailures, 3),
    avgDuplicateAssistantRate: round(staging.avgDuplicateAssistantRate - production.avgDuplicateAssistantRate, 3),
    avgGenericAssistantRate: round(staging.avgGenericAssistantRate - production.avgGenericAssistantRate, 3),
    avgCandidateCompleteness: round(staging.avgCandidateCompleteness - production.avgCandidateCompleteness, 3),
  };

  const report: CompareReport = {
    generatedAt: new Date().toISOString(),
    botId,
    daysWindow,
    maxConversations,
    minMessages,
    production,
    staging,
    deltas,
  };

  mkdirSync('docs/analysis', { recursive: true });
  writeFileSync('docs/analysis/prod-vs-staging-flow-report.json', JSON.stringify(report, null, 2));
  writeFileSync('docs/analysis/prod-vs-staging-flow-report.md', buildMarkdown(report));

  console.log('report_json=docs/analysis/prod-vs-staging-flow-report.json');
  console.log('report_md=docs/analysis/prod-vs-staging-flow-report.md');
  console.log(`production_analyzed=${production.analyzedConversations} staging_analyzed=${staging.analyzedConversations}`);
  console.log(`production_avg_semantic=${round(production.avgSemanticScore, 2)} staging_avg_semantic=${round(staging.avgSemanticScore, 2)}`);
  console.log(`delta_semantic=${round(staging.avgSemanticScore - production.avgSemanticScore, 2)}`);
}

main().catch(err => {
  console.error('COMPARE_FLOW_ERROR', err);
  process.exit(1);
});
