import { CONTENT_KINDS } from '@/lib/cms/content-kinds';
import { buildInsightActionMetadata } from '@/lib/insights/action-metadata';

type TipContext = {
  title: string;
  summary?: string | null;
  contentKind?: string | null;
  category?: string | null;
  executionClass?: string | null;
  recommendedActions?: unknown;
  suggestedRouting?: unknown;
  sourceSnapshot?: unknown;
};

export type RelatedActionSuggestion = {
  key: string;
  title: string;
  description: string;
  rationale: string;
  contentKind: string;
  channel: string;
};

export type DerivedTipSuggestions = {
  version: 'tip-related-suggestions-v1';
  primaryContentKind: string | null;
  relatedActionSuggestions: RelatedActionSuggestion[];
  relatedPromptSuggestions: string[];
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function makePromptLabel(title: string, summary?: string | null): string {
  const base = cleanText(title) || cleanText(summary) || 'questa iniziativa';
  return truncate(base, 110);
}

function inferContentKindFromActions(actions: unknown): string | null {
  if (!Array.isArray(actions)) return null;

  for (const action of actions) {
    const actionRecord = toRecord(action);
    const explicit = cleanText(actionRecord?.contentKind);
    if (explicit) return explicit.toUpperCase();

    const metadata = buildInsightActionMetadata({
      type: cleanText(actionRecord?.type),
      target: cleanText(actionRecord?.target),
      title: cleanText(actionRecord?.title),
      body: cleanText(actionRecord?.body),
    });
    if (metadata.contentKind) return metadata.contentKind;
  }

  return null;
}

function inferContentKindFromObject(value: unknown): string | null {
  const record = toRecord(value);
  if (!record) return null;

  const direct = cleanText(record.contentKind);
  if (direct) return direct.toUpperCase();

  const publishRouting = toRecord(record.publishRouting);
  const publishKind = cleanText(publishRouting?.contentKind);
  if (publishKind) return publishKind.toUpperCase();

  const nestedContentDraft = toRecord(record.contentDraft);
  const nestedKind = cleanText(nestedContentDraft?.contentKind);
  if (nestedKind) return nestedKind.toUpperCase();

  return null;
}

export function extractPrimaryContentKind(context: TipContext): string | null {
  const explicitKind = cleanText(context.contentKind);
  if (explicitKind) return explicitKind.toUpperCase();

  const fromActions = inferContentKindFromActions(context.recommendedActions);
  if (fromActions) return fromActions;

  const fromRouting = inferContentKindFromObject(context.suggestedRouting);
  if (fromRouting) return fromRouting;

  const fromSnapshot = inferContentKindFromObject(context.sourceSnapshot);
  if (fromSnapshot) return fromSnapshot;

  const text = `${cleanText(context.title)} ${cleanText(context.summary)}`.toLowerCase();
  if (text.includes('faq')) return CONTENT_KINDS.NEW_FAQ;
  if (text.includes('linkedin')) return CONTENT_KINDS.LINKEDIN_ARTICLE;
  if (text.includes('newsletter') || text.includes('email')) return CONTENT_KINDS.EMAIL_SNIPPET;
  if (text.includes('schema')) return CONTENT_KINDS.SCHEMA_ORG;
  if (text.includes('blog') || text.includes('articolo')) return CONTENT_KINDS.BLOG_POST;
  if (text.includes('pagina') || text.includes('landing')) return CONTENT_KINDS.NEW_PAGE;

  return null;
}

function buildTemplateSuggestions(primaryContentKind: string | null, label: string): RelatedActionSuggestion[] {
  switch (primaryContentKind) {
    case CONTENT_KINDS.BLOG_POST:
    case CONTENT_KINDS.BLOG_UPDATE:
    case CONTENT_KINDS.NEW_PAGE:
    case CONTENT_KINDS.PAGE_UPDATE:
    case CONTENT_KINDS.CITATION_SNIPPET:
    case CONTENT_KINDS.FEATURED_SNIPPET_OPT:
      return [
        {
          key: 'linkedin-amplification',
          title: 'Crea un post LinkedIn di rilancio',
          description: `Amplifica ${label} con un post orientato a insight e click-through verso il contenuto principale.`,
          rationale: 'Estende la reach organica del contenuto già in lavorazione.',
          contentKind: CONTENT_KINDS.LINKEDIN_ARTICLE,
          channel: 'linkedin',
        },
        {
          key: 'email-follow-up',
          title: 'Prepara una newsletter o email teaser',
          description: `Usa ${label} come asset principale e distribuiscilo anche a lead o clienti già acquisiti.`,
          rationale: 'Trasforma il contenuto in traffico di ritorno e nurture.',
          contentKind: CONTENT_KINDS.EMAIL_SNIPPET,
          channel: 'email',
        },
        {
          key: 'faq-derivative',
          title: 'Estrai 3 FAQ collegate dal contenuto',
          description: `Ricava FAQ pratiche da ${label} per rinforzare sito, chatbot o knowledge base.`,
          rationale: 'Aumenta copertura semantica e utilità operativa dello stesso tema.',
          contentKind: CONTENT_KINDS.NEW_FAQ,
          channel: 'site_faq',
        },
      ];
    case CONTENT_KINDS.NEW_FAQ:
    case CONTENT_KINDS.SCHEMA_ORG:
    case CONTENT_KINDS.META_DESCRIPTION:
    case CONTENT_KINDS.ALT_DESCRIPTION:
      return [
        {
          key: 'page-consolidation',
          title: 'Aggiorna la pagina principale collegata',
          description: `Allinea la pagina che ospita ${label} con copy, prove e CTA coerenti.`,
          rationale: 'Evita che il miglioramento tecnico resti isolato dal contenuto di conversione.',
          contentKind: CONTENT_KINDS.PAGE_UPDATE,
          channel: 'site_cms',
        },
        {
          key: 'linkedin-carousel',
          title: 'Crea un carousel LinkedIn educativo',
          description: `Trasforma ${label} in una sequenza breve da condividere come contenuto educational.`,
          rationale: 'Riusa il tema in un formato a maggiore distribuzione.',
          contentKind: CONTENT_KINDS.LINKEDIN_CAROUSEL,
          channel: 'linkedin',
        },
        {
          key: 'blog-deep-dive',
          title: 'Apri un contenuto di approfondimento',
          description: `Espandi ${label} in un articolo o approfondimento che risponda alle obiezioni principali.`,
          rationale: 'Converte un fix tecnico in asset editoriale ad alto valore.',
          contentKind: CONTENT_KINDS.BLOG_POST,
          channel: 'site_cms',
        },
      ];
    case CONTENT_KINDS.PRODUCT_DESCRIPTION:
    case CONTENT_KINDS.PRODUCT_FAQ:
      return [
        {
          key: 'product-email',
          title: 'Crea una email commerciale di supporto',
          description: `Usa ${label} come base per una DEM focalizzata su beneficio, prova e CTA.`,
          rationale: 'Porta il contenuto prodotto dentro i flussi di conversione.',
          contentKind: CONTENT_KINDS.EMAIL_SNIPPET,
          channel: 'email',
        },
        {
          key: 'product-linkedin',
          title: 'Prepara un post LinkedIn orientato al caso d’uso',
          description: `Racconta ${label} in chiave problema-soluzione con CTA verso prodotto o demo.`,
          rationale: 'Collega l’ottimizzazione di pagina a domanda top-of-funnel.',
          contentKind: CONTENT_KINDS.LINKEDIN_CAROUSEL,
          channel: 'linkedin',
        },
        {
          key: 'product-faq-extension',
          title: 'Aggiungi FAQ pre-vendita correlate',
          description: `Estrai domande frequenti e barriere d’acquisto partendo da ${label}.`,
          rationale: 'Riduce attrito e migliora il supporto all’acquisto.',
          contentKind: CONTENT_KINDS.NEW_FAQ,
          channel: 'site_faq',
        },
      ];
    case CONTENT_KINDS.LINKEDIN_ARTICLE:
    case CONTENT_KINDS.LINKEDIN_CAROUSEL:
    case CONTENT_KINDS.LINKEDIN_NEWSLETTER:
    case CONTENT_KINDS.LINKEDIN_POLL:
    case CONTENT_KINDS.SOCIAL_SNIPPET:
    case CONTENT_KINDS.GOOGLE_BUSINESS_POST:
      return [
        {
          key: 'site-anchor-content',
          title: 'Collega il contenuto a una pagina o articolo del sito',
          description: `Usa ${label} per portare traffico verso un asset proprietario più completo.`,
          rationale: 'Evita che il contenuto resti confinato su un canale esterno.',
          contentKind: CONTENT_KINDS.BLOG_POST,
          channel: 'site_cms',
        },
        {
          key: 'email-repackaging',
          title: 'Riutilizza il messaggio in email',
          description: `Trasforma ${label} in una email breve per lead nurturing o customer update.`,
          rationale: 'Aumenta riuso del messaggio e frequenza di contatto.',
          contentKind: CONTENT_KINDS.EMAIL_SNIPPET,
          channel: 'email',
        },
        {
          key: 'faq-capture',
          title: 'Ricava FAQ o obiezioni da gestire sul sito',
          description: `Parti da ${label} per costruire risposte rapide su sito o chatbot.`,
          rationale: 'Converte engagement social in knowledge asset riusabile.',
          contentKind: CONTENT_KINDS.NEW_FAQ,
          channel: 'site_faq',
        },
      ];
    case CONTENT_KINDS.EMAIL_SNIPPET:
      return [
        {
          key: 'blog-support',
          title: 'Crea una pagina o articolo di supporto',
          description: `Offri a chi riceve l’email un asset di approfondimento collegato a ${label}.`,
          rationale: 'Dà profondità al messaggio email e migliora la conversione.',
          contentKind: CONTENT_KINDS.BLOG_POST,
          channel: 'site_cms',
        },
        {
          key: 'linkedin-resonance',
          title: 'Rilancia il tema su LinkedIn',
          description: `Riprendi ${label} con un hook più pubblico e un CTA coerente.`,
          rationale: 'Allinea la distribuzione tra canali owned ed earned.',
          contentKind: CONTENT_KINDS.LINKEDIN_ARTICLE,
          channel: 'linkedin',
        },
        {
          key: 'faq-answer',
          title: 'Formalizza una FAQ dalla mail',
          description: `Estrai una risposta strutturata da ${label} per sito o supporto commerciale.`,
          rationale: 'Trasforma il copy email in asset evergreen.',
          contentKind: CONTENT_KINDS.NEW_FAQ,
          channel: 'site_faq',
        },
      ];
    default:
      return [
        {
          key: 'linkedin-support',
          title: 'Prepara un contenuto LinkedIn collegato',
          description: `Costruisci un rilancio coerente di ${label} per aumentare distribuzione e autorevolezza.`,
          rationale: 'Aggiunge un canale di distribuzione complementare.',
          contentKind: CONTENT_KINDS.LINKEDIN_ARTICLE,
          channel: 'linkedin',
        },
        {
          key: 'email-support',
          title: 'Prepara un follow-up email',
          description: `Riusa ${label} in una DEM o email di nurturing con CTA all’asset principale.`,
          rationale: 'Trasforma il tip in una sequenza multi-canale concreta.',
          contentKind: CONTENT_KINDS.EMAIL_SNIPPET,
          channel: 'email',
        },
      ];
  }
}

function buildPromptSuggestions(label: string, suggestions: RelatedActionSuggestion[]): string[] {
  return suggestions.map((suggestion) => {
    switch (suggestion.contentKind) {
      case CONTENT_KINDS.LINKEDIN_ARTICLE:
      case CONTENT_KINDS.LINKEDIN_CAROUSEL:
      case CONTENT_KINDS.LINKEDIN_NEWSLETTER:
      case CONTENT_KINDS.LINKEDIN_POLL:
        return `Crea un contenuto LinkedIn collegato a "${label}" con hook forte, 3 punti chiave e CTA coerente.`;
      case CONTENT_KINDS.EMAIL_SNIPPET:
        return `Trasforma "${label}" in una email breve con oggetto, apertura, beneficio principale e CTA finale.`;
      case CONTENT_KINDS.NEW_FAQ:
        return `Estrai 3 FAQ operative da "${label}" con risposta breve, tono chiaro e taglio SEO/LLMO.`;
      case CONTENT_KINDS.BLOG_POST:
      case CONTENT_KINDS.NEW_PAGE:
      case CONTENT_KINDS.PAGE_UPDATE:
        return `Costruisci una bozza sito collegata a "${label}" con struttura H2/H3, prove e CTA finale.`;
      default:
        return `Suggerisci un contenuto correlato a "${label}" adatto al canale ${suggestion.channel}.`;
    }
  });
}

export function buildDerivedTipSuggestions(context: TipContext): DerivedTipSuggestions {
  const primaryContentKind = extractPrimaryContentKind(context);
  const label = makePromptLabel(context.title, context.summary);
  const relatedActionSuggestions = buildTemplateSuggestions(primaryContentKind, label).slice(0, 3);
  const relatedPromptSuggestions = buildPromptSuggestions(label, relatedActionSuggestions).slice(0, 3);

  return {
    version: 'tip-related-suggestions-v1',
    primaryContentKind,
    relatedActionSuggestions,
    relatedPromptSuggestions,
  };
}

export function mergeSuggestedRoutingWithDerivedSuggestions(context: TipContext): Record<string, unknown> {
  const baseRouting = toRecord(context.suggestedRouting) ?? {};
  return {
    ...baseRouting,
    derivedSuggestions: buildDerivedTipSuggestions(context),
  };
}

export function readDerivedTipSuggestions(suggestedRouting: unknown): DerivedTipSuggestions | null {
  const routingRecord = toRecord(suggestedRouting);
  const derivedRecord = toRecord(routingRecord?.derivedSuggestions);
  if (!derivedRecord) return null;

  const relatedActionSuggestions = Array.isArray(derivedRecord.relatedActionSuggestions)
    ? derivedRecord.relatedActionSuggestions
        .map((entry) => {
          const record = toRecord(entry);
          if (!record) return null;

          const key = cleanText(record.key);
          const title = cleanText(record.title);
          const description = cleanText(record.description);
          const rationale = cleanText(record.rationale);
          const contentKind = cleanText(record.contentKind);
          const channel = cleanText(record.channel);

          if (!key || !title || !description || !rationale || !contentKind || !channel) {
            return null;
          }

          return {
            key,
            title,
            description,
            rationale,
            contentKind,
            channel,
          } satisfies RelatedActionSuggestion;
        })
        .filter((entry): entry is RelatedActionSuggestion => Boolean(entry))
    : [];

  const relatedPromptSuggestions = Array.isArray(derivedRecord.relatedPromptSuggestions)
    ? derivedRecord.relatedPromptSuggestions
        .map((entry) => cleanText(entry))
        .filter(Boolean)
    : [];

  return {
    version: 'tip-related-suggestions-v1',
    primaryContentKind: cleanText(derivedRecord.primaryContentKind) || null,
    relatedActionSuggestions,
    relatedPromptSuggestions,
  };
}

export function buildRelatedCopilotPromptSuggestions(prompt: string): string[] {
  const label = makePromptLabel(prompt);
  const primaryContentKind = extractPrimaryContentKind({
    title: prompt,
    summary: prompt,
  });
  const relatedActionSuggestions = buildTemplateSuggestions(primaryContentKind, label).slice(0, 3);
  return buildPromptSuggestions(label, relatedActionSuggestions).slice(0, 3);
}
