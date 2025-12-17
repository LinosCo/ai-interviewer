# Business Tuner - Specifica Completa di Implementazione

## Indice
1. [Brand Identity e Testi Landing Page](#1-brand-identity-e-testi-landing-page)
2. [Struttura Piani e Pricing](#2-struttura-piani-e-pricing)
3. [Feature Matrix per Piano](#3-feature-matrix-per-piano)
4. [Limiti Tecnici Nascosti](#4-limiti-tecnici-nascosti)
5. [Strategia Modelli LLM](#5-strategia-modelli-llm)
6. [Schema Database e Controllo Accessi](#6-schema-database-e-controllo-accessi)
7. [Middleware e Logica di Enforcement](#7-middleware-e-logica-di-enforcement)
8. [Comportamento ai Limiti](#8-comportamento-ai-limiti)
9. [Sicurezza e Restrizioni Admin](#9-sicurezza-e-restrizioni-admin)

---

## 1. Brand Identity e Testi Landing Page

### 1.1 Brand Core

```yaml
brand:
  name: "Business Tuner"
  tagline: "Ascolta il mercato. Decidi meglio."
  domain: "businesstuner.it"
  
colors:
  primary: "#F59E0B"      # Amber
  primary_dark: "#D97706" # Amber Dark
  accent: "#FBBF24"       # Gold
  text: "#1F1F1F"         # Nero
  muted: "#525252"        # Grigio
  background: "#FFFBEB"   # Amber 50
  
fonts:
  heading: "Inter"
  body: "Inter"
```

### 1.2 Hero Section

```html
<section class="hero">
  <h1>Ascolta il mercato. Decidi meglio.</h1>
  <p class="subtitle">
    Crea interviste intelligenti in 10 minuti. 
    Raccogli feedback veri da clienti, dipendenti e partner.
  </p>
  
  <div class="cta-group">
    <button class="btn-primary">Inizia gratis</button>
    <button class="btn-secondary">Guarda come funziona (2 min)</button>
  </div>
  
  <div class="use-case-pills">
    <span class="pill">Customer Feedback</span>
    <span class="pill">Exit Interview</span>
    <span class="pill">Clima Aziendale</span>
    <span class="pill">NPS Qualitativo</span>
    <span class="pill">Win/Loss Analysis</span>
  </div>
</section>
```

### 1.3 Stats Section

```html
<section class="stats">
  <div class="stat">
    <span class="stat-value">70%+</span>
    <span class="stat-label">completion rate medio</span>
  </div>
  <div class="stat">
    <span class="stat-value">10 min</span>
    <span class="stat-label">per creare un'intervista</span>
  </div>
  <div class="stat">
    <span class="stat-value">1/10</span>
    <span class="stat-label">del costo ricerca tradizionale</span>
  </div>
</section>
```

### 1.4 Come Funziona

```html
<section class="how-it-works">
  <h2>Come funziona</h2>
  
  <div class="step">
    <span class="step-number">01</span>
    <h3>Descrivi cosa vuoi sapere</h3>
    <p>Scrivi il tuo obiettivo in linguaggio naturale. "Voglio capire perché i clienti non rinnovano."</p>
  </div>
  
  <div class="step">
    <span class="step-number">02</span>
    <h3>L'AI costruisce l'intervista</h3>
    <p>Business Tuner genera domande, tono e flusso conversazionale. Tu rivedi e personalizzi.</p>
  </div>
  
  <div class="step">
    <span class="step-number">03</span>
    <h3>Condividi e raccogli</h3>
    <p>Un link. I tuoi stakeholder rispondono quando vogliono, dal telefono o dal computer.</p>
  </div>
  
  <div class="step">
    <span class="step-number">04</span>
    <h3>Leggi gli insight</h3>
    <p>Temi ricorrenti, sentiment, citazioni chiave. Tutto estratto automaticamente.</p>
  </div>
</section>
```

### 1.5 Casi d'Uso

```html
<section class="use-cases">
  <h2>Per chi è Business Tuner</h2>
  
  <div class="use-case">
    <span class="icon">🏢</span>
    <h3>Clienti B2B</h3>
    <p>Perché hanno scelto te? Cosa li trattiene? Cosa vorrebbero di diverso?</p>
  </div>
  
  <div class="use-case">
    <span class="icon">🛒</span>
    <h3>Clienti B2C</h3>
    <p>Feedback post-acquisto, motivi di abbandono, test di nuove idee.</p>
  </div>
  
  <div class="use-case">
    <span class="icon">👥</span>
    <h3>Risorse Umane</h3>
    <p>Exit interview, clima aziendale, onboarding check, pulse survey.</p>
  </div>
  
  <div class="use-case">
    <span class="icon">⚙️</span>
    <h3>Operations</h3>
    <p>Feedback fornitori, audit interni, raccolta segnalazioni.</p>
  </div>
</section>
```

### 1.6 Perché Funziona

```html
<section class="why-it-works">
  <h2>Perché funziona meglio di un form</h2>
  
  <div class="comparison">
    <div class="item">
      <h3>Conversazione, non caselle</h3>
      <p>Le persone rispondono meglio a domande che si adattano a quello che dicono.</p>
    </div>
    
    <div class="item">
      <h3>70% di completamento</h3>
      <p>I form si abbandonano. Le conversazioni si finiscono.</p>
    </div>
    
    <div class="item">
      <h3>Pronto in 10 minuti</h3>
      <p>Niente settimane di progettazione. Descrivi l'obiettivo, il resto lo fa l'AI.</p>
    </div>
    
    <div class="item">
      <h3>1/10 del costo</h3>
      <p>Niente consulenti, niente software enterprise. Solo risposte.</p>
    </div>
  </div>
</section>
```

### 1.7 CTA Finale

```html
<section class="final-cta">
  <h2>Inizia ad ascoltare. È gratis.</h2>
  <p>Crea la tua prima intervista in 10 minuti. Nessuna carta di credito richiesta.</p>
  <button class="btn-primary btn-large">Inizia ora →</button>
</section>
```

---

## 2. Struttura Piani e Pricing

### 2.1 Definizione Piani

```typescript
// types/plans.ts

export enum PlanType {
  TRIAL = 'trial',
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business'
}

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;           // €/mese
  priceYearly: number;     // €/mese con sconto annuale
  
  // Limiti visibili (pricing page)
  responsesPerMonth: number;
  activeInterviews: number;
  users: number;
  
  // Feature flags
  features: PlanFeatures;
  
  // Limiti nascosti (enforcement)
  limits: PlanLimits;
}

export interface PlanFeatures {
  // Creazione interviste
  aiGeneration: boolean;
  basicTemplates: boolean;
  advancedTemplates: boolean;
  manualEdit: boolean;
  knowledgeBase: boolean;
  conditionalLogic: boolean;
  customTemplates: boolean;
  
  // Branding
  watermark: boolean;
  customColor: boolean;
  customLogo: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  
  // Analytics
  basicStats: boolean;
  transcripts: boolean;
  sentiment: boolean;
  themeExtraction: boolean;
  keyQuotes: boolean;
  trends: boolean;
  comparison: boolean;
  segmentation: boolean;
  customDashboards: boolean;
  
  // Export & Integrations
  exportPdf: boolean;
  exportCsv: boolean;
  webhooks: boolean;
  apiAccess: boolean;
  zapier: boolean;
  sso: boolean;
  
  // Support
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface PlanLimits {
  // Conversazione (nascosti)
  maxExchangesPerInterview: number;
  maxTokensPerInterview: number;
  maxCharsPerUserMessage: number;
  inactivityTimeoutMinutes: number;
  
  // Configurazione bot (nascosti)
  maxQuestionsPerInterview: number;
  maxKnowledgeBaseChars: number;
  maxKnowledgeBaseFiles: number;
  
  // Test e simulazioni (nascosti)
  simulationsPerDayPerBot: number;
  aiRegenerationsPerDay: number;
  
  // Rate limits (nascosti)
  maxParallelInterviews: number;
  messageCooldownSeconds: number;
}
```

### 2.2 Configurazione Piani

```typescript
// config/plans.ts

export const PLANS: Record<PlanType, PlanConfig> = {
  [PlanType.TRIAL]: {
    id: PlanType.TRIAL,
    name: 'Trial',
    price: 0,
    priceYearly: 0,
    
    responsesPerMonth: 10,
    activeInterviews: 1,
    users: 1,
    
    features: {
      aiGeneration: true,
      basicTemplates: true,
      advancedTemplates: false,
      manualEdit: false,
      knowledgeBase: false,
      conditionalLogic: false,
      customTemplates: false,
      
      watermark: true,
      customColor: false,
      customLogo: false,
      customDomain: false,
      whiteLabel: false,
      
      basicStats: true,
      transcripts: true,
      sentiment: false,
      themeExtraction: false,
      keyQuotes: false,
      trends: false,
      comparison: false,
      segmentation: false,
      customDashboards: false,
      
      exportPdf: false,
      exportCsv: false,
      webhooks: false,
      apiAccess: false,
      zapier: false,
      sso: false,
      
      supportLevel: 'community'
    },
    
    limits: {
      maxExchangesPerInterview: 10,
      maxTokensPerInterview: 30000,
      maxCharsPerUserMessage: 1000,
      inactivityTimeoutMinutes: 20,
      
      maxQuestionsPerInterview: 6,
      maxKnowledgeBaseChars: 0,
      maxKnowledgeBaseFiles: 0,
      
      simulationsPerDayPerBot: 2,
      aiRegenerationsPerDay: 3,
      
      maxParallelInterviews: 2,
      messageCooldownSeconds: 3
    }
  },
  
  [PlanType.STARTER]: {
    id: PlanType.STARTER,
    name: 'Starter',
    price: 39,
    priceYearly: 31,  // -20%
    
    responsesPerMonth: 100,
    activeInterviews: 3,
    users: 1,
    
    features: {
      aiGeneration: true,
      basicTemplates: true,
      advancedTemplates: true,
      manualEdit: true,
      knowledgeBase: false,
      conditionalLogic: false,
      customTemplates: false,
      
      watermark: true,
      customColor: true,
      customLogo: false,
      customDomain: false,
      whiteLabel: false,
      
      basicStats: true,
      transcripts: true,
      sentiment: true,
      themeExtraction: true,
      keyQuotes: true,
      trends: false,
      comparison: false,
      segmentation: false,
      customDashboards: false,
      
      exportPdf: true,
      exportCsv: false,
      webhooks: false,
      apiAccess: false,
      zapier: false,
      sso: false,
      
      supportLevel: 'email'
    },
    
    limits: {
      maxExchangesPerInterview: 15,
      maxTokensPerInterview: 50000,
      maxCharsPerUserMessage: 2000,
      inactivityTimeoutMinutes: 30,
      
      maxQuestionsPerInterview: 10,
      maxKnowledgeBaseChars: 0,
      maxKnowledgeBaseFiles: 0,
      
      simulationsPerDayPerBot: 5,
      aiRegenerationsPerDay: 10,
      
      maxParallelInterviews: 10,
      messageCooldownSeconds: 2
    }
  },
  
  [PlanType.PRO]: {
    id: PlanType.PRO,
    name: 'Pro',
    price: 99,
    priceYearly: 79,  // -20%
    
    responsesPerMonth: 300,
    activeInterviews: 10,
    users: 5,
    
    features: {
      aiGeneration: true,
      basicTemplates: true,
      advancedTemplates: true,
      manualEdit: true,
      knowledgeBase: true,        // ⭐ Da Pro
      conditionalLogic: true,     // ⭐ Da Pro
      customTemplates: false,
      
      watermark: false,           // ⭐ Rimosso da Pro
      customColor: true,
      customLogo: true,           // ⭐ Da Pro
      customDomain: false,
      whiteLabel: false,
      
      basicStats: true,
      transcripts: true,
      sentiment: true,
      themeExtraction: true,
      keyQuotes: true,
      trends: true,               // ⭐ Da Pro
      comparison: true,           // ⭐ Da Pro
      segmentation: false,
      customDashboards: false,
      
      exportPdf: true,
      exportCsv: true,            // ⭐ Da Pro
      webhooks: true,             // ⭐ Da Pro
      apiAccess: false,
      zapier: false,
      sso: false,
      
      supportLevel: 'priority'
    },
    
    limits: {
      maxExchangesPerInterview: 20,
      maxTokensPerInterview: 70000,
      maxCharsPerUserMessage: 3000,
      inactivityTimeoutMinutes: 45,
      
      maxQuestionsPerInterview: 15,
      maxKnowledgeBaseChars: 50000,
      maxKnowledgeBaseFiles: 3,
      
      simulationsPerDayPerBot: 10,
      aiRegenerationsPerDay: 25,
      
      maxParallelInterviews: 30,
      messageCooldownSeconds: 1
    }
  },
  
  [PlanType.BUSINESS]: {
    id: PlanType.BUSINESS,
    name: 'Business',
    price: 249,
    priceYearly: 199,  // -20%
    
    responsesPerMonth: 1000,
    activeInterviews: -1,  // Illimitate
    users: 15,
    
    features: {
      aiGeneration: true,
      basicTemplates: true,
      advancedTemplates: true,
      manualEdit: true,
      knowledgeBase: true,
      conditionalLogic: true,
      customTemplates: true,      // ⭐ Solo Business
      
      watermark: false,
      customColor: true,
      customLogo: true,
      customDomain: true,         // ⭐ Solo Business
      whiteLabel: true,           // ⭐ Solo Business
      
      basicStats: true,
      transcripts: true,
      sentiment: true,
      themeExtraction: true,
      keyQuotes: true,
      trends: true,
      comparison: true,
      segmentation: true,         // ⭐ Solo Business
      customDashboards: true,     // ⭐ Solo Business
      
      exportPdf: true,
      exportCsv: true,
      webhooks: true,
      apiAccess: true,            // ⭐ Solo Business
      zapier: true,               // ⭐ Solo Business
      sso: true,                  // ⭐ Solo Business
      
      supportLevel: 'dedicated'
    },
    
    limits: {
      maxExchangesPerInterview: 25,
      maxTokensPerInterview: 100000,
      maxCharsPerUserMessage: 5000,
      inactivityTimeoutMinutes: 60,
      
      maxQuestionsPerInterview: 20,
      maxKnowledgeBaseChars: 200000,
      maxKnowledgeBaseFiles: 10,
      
      simulationsPerDayPerBot: 20,
      aiRegenerationsPerDay: 50,
      
      maxParallelInterviews: 100,
      messageCooldownSeconds: 0.5
    }
  }
};
```

### 2.3 Pricing Page Content

```typescript
// content/pricing.ts

export const PRICING_PAGE = {
  headline: "Scegli il piano giusto per te",
  subheadline: "Inizia gratis, scala quando serve. Nessun vincolo.",
  
  plans: [
    {
      id: 'trial',
      name: 'Trial',
      price: '€0',
      period: 'gratis per sempre',
      description: 'Per provare',
      cta: 'Inizia gratis',
      highlighted: false,
      features: [
        '1 intervista attiva',
        '10 risposte/mese',
        'Template base',
        'Generazione AI',
        'Trascrizioni',
        'Watermark Business Tuner'
      ]
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '€39',
      period: '/mese',
      description: 'Per il professionista',
      cta: 'Prova 14 giorni gratis',
      highlighted: false,
      features: [
        '3 interviste attive',
        '100 risposte/mese',
        'Tutti i template',
        'Analytics completi',
        'Sentiment e temi',
        'Export PDF',
        'Supporto email'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '€99',
      period: '/mese',
      description: 'Per la PMI',
      cta: 'Prova 14 giorni gratis',
      highlighted: true,
      badge: '⭐ Più popolare',
      features: [
        '10 interviste attive',
        '300 risposte/mese',
        '5 utenti inclusi',
        'Knowledge base AI',
        'Logica condizionale',
        'Trend nel tempo',
        'Logo aziendale',
        'Nessun watermark',
        'Export CSV + Webhook',
        'Supporto prioritario'
      ]
    },
    {
      id: 'business',
      name: 'Business',
      price: '€249',
      period: '/mese',
      description: 'Per l\'azienda strutturata',
      cta: 'Contattaci',
      highlighted: false,
      features: [
        'Interviste illimitate',
        '1.000 risposte/mese',
        '15 utenti inclusi',
        'Tutto di Pro +',
        'White label completo',
        'Dominio personalizzato',
        'API REST + Zapier',
        'SSO (SAML/OIDC)',
        'Onboarding dedicato',
        'Account manager'
      ]
    }
  ],
  
  addons: [
    {
      name: 'Risposte aggiuntive',
      price: '€0.25/risposta',
      description: 'Quando superi la soglia mensile'
    },
    {
      name: 'Utenti aggiuntivi',
      price: '€15/utente/mese',
      description: 'Per Pro e Business'
    }
  ],
  
  yearlyDiscount: {
    percentage: 20,
    badge: '-20% annuale'
  },
  
  faq: [
    {
      q: 'Posso cambiare piano in qualsiasi momento?',
      a: 'Sì, upgrade immediato con addebito proporzionale. Downgrade dal mese successivo.'
    },
    {
      q: 'Cosa succede se supero le risposte mensili?',
      a: 'Le interviste vanno in pausa. Puoi acquistare risposte extra a €0.25/risposta o fare upgrade.'
    },
    {
      q: 'Le bozze contano come risposte?',
      a: 'No, contiamo solo le interviste completate dai rispondenti.'
    },
    {
      q: 'C\'è un periodo di prova?',
      a: 'Il piano Trial è gratis per sempre. Starter e Pro hanno 14 giorni di prova gratuita.'
    },
    {
      q: 'Devo inserire la carta di credito per provare?',
      a: 'No, il Trial non richiede carta. Per Starter e Pro sì, ma non addebiteremo nulla per 14 giorni.'
    },
    {
      q: 'Come funziona la fatturazione?',
      a: 'Fattura elettronica mensile o annuale. Accettiamo carta, bonifico, SEPA.'
    },
    {
      q: 'I miei dati sono al sicuro?',
      a: 'Sì, crittografia end-to-end, server EU, GDPR compliant. Nessun dato usato per training AI.'
    },
    {
      q: 'Avete piani enterprise?',
      a: 'Sì, per volumi superiori o esigenze particolari contattaci per un preventivo personalizzato.'
    }
  ]
};
```

---

## 3. Feature Matrix per Piano

### 3.1 Tabella Comparativa Completa

```typescript
// config/featureMatrix.ts

export const FEATURE_MATRIX = {
  categories: [
    {
      name: 'Creazione Interviste',
      features: [
        { key: 'aiGeneration', label: 'Generazione AI da obiettivo', trial: true, starter: true, pro: true, business: true },
        { key: 'basicTemplates', label: 'Template base (5)', trial: true, starter: true, pro: true, business: true },
        { key: 'advancedTemplates', label: 'Template avanzati (15+)', trial: false, starter: true, pro: true, business: true },
        { key: 'manualEdit', label: 'Modifica domande manuale', trial: false, starter: true, pro: true, business: true },
        { key: 'knowledgeBase', label: 'Knowledge base personalizzato', trial: false, starter: false, pro: true, business: true },
        { key: 'conditionalLogic', label: 'Logica condizionale (branching)', trial: false, starter: false, pro: true, business: true },
        { key: 'customTemplates', label: 'Template custom su richiesta', trial: false, starter: false, pro: false, business: true }
      ]
    },
    {
      name: 'Branding',
      features: [
        { key: 'watermark', label: 'Senza watermark', trial: false, starter: false, pro: true, business: true },
        { key: 'customColor', label: 'Colore primario personalizzato', trial: false, starter: true, pro: true, business: true },
        { key: 'customLogo', label: 'Logo aziendale', trial: false, starter: false, pro: true, business: true },
        { key: 'customDomain', label: 'Dominio personalizzato (CNAME)', trial: false, starter: false, pro: false, business: true },
        { key: 'whiteLabel', label: 'White label completo', trial: false, starter: false, pro: false, business: true }
      ]
    },
    {
      name: 'Analytics',
      features: [
        { key: 'basicStats', label: 'Conteggio risposte e completamento', trial: true, starter: true, pro: true, business: true },
        { key: 'transcripts', label: 'Lettura trascrizioni', trial: true, starter: true, pro: true, business: true },
        { key: 'sentiment', label: 'Sentiment analysis', trial: false, starter: true, pro: true, business: true },
        { key: 'themeExtraction', label: 'Estrazione temi automatica', trial: false, starter: true, pro: true, business: true },
        { key: 'keyQuotes', label: 'Citazioni chiave estratte', trial: false, starter: true, pro: true, business: true },
        { key: 'trends', label: 'Trend nel tempo (storico)', trial: false, starter: false, pro: true, business: true },
        { key: 'comparison', label: 'Confronto tra interviste', trial: false, starter: false, pro: true, business: true },
        { key: 'segmentation', label: 'Segmentazione risposte', trial: false, starter: false, pro: false, business: true },
        { key: 'customDashboards', label: 'Dashboard personalizzabili', trial: false, starter: false, pro: false, business: true }
      ]
    },
    {
      name: 'Export e Integrazioni',
      features: [
        { key: 'exportPdf', label: 'Export PDF report', trial: false, starter: true, pro: true, business: true },
        { key: 'exportCsv', label: 'Export CSV dati grezzi', trial: false, starter: false, pro: true, business: true },
        { key: 'webhooks', label: 'Webhook (notifiche in uscita)', trial: false, starter: false, pro: true, business: true },
        { key: 'apiAccess', label: 'API REST completa', trial: false, starter: false, pro: false, business: true },
        { key: 'zapier', label: 'Integrazione Zapier', trial: false, starter: false, pro: false, business: true },
        { key: 'sso', label: 'SSO (SAML/OIDC)', trial: false, starter: false, pro: false, business: true }
      ]
    },
    {
      name: 'Supporto',
      features: [
        { key: 'supportCommunity', label: 'Community', trial: true, starter: false, pro: false, business: false },
        { key: 'supportEmail', label: 'Email', trial: false, starter: true, pro: false, business: false },
        { key: 'supportPriority', label: 'Prioritario', trial: false, starter: false, pro: true, business: false },
        { key: 'supportDedicated', label: 'Dedicato + Onboarding', trial: false, starter: false, pro: false, business: true }
      ]
    }
  ]
};
```

---

## 4. Limiti Tecnici Nascosti

### 4.1 Configurazione Limiti

```typescript
// config/limits.ts

/**
 * LIMITI TECNICI NASCOSTI
 * 
 * Questi limiti NON vengono mostrati nella pricing page
 * ma sono enforced a livello di sistema per:
 * 1. Controllare i costi LLM
 * 2. Prevenire abusi
 * 3. Garantire qualità del servizio
 */

export const HIDDEN_LIMITS = {
  // ============================================
  // CONVERSAZIONE (per singola intervista)
  // ============================================
  conversation: {
    trial: {
      maxExchanges: 10,           // Scambi domanda/risposta
      maxTokensTotal: 30000,      // Token totali conversazione
      maxCharsPerMessage: 1000,   // Caratteri per messaggio utente
      inactivityTimeout: 20,      // Minuti prima di chiusura automatica
    },
    starter: {
      maxExchanges: 15,
      maxTokensTotal: 50000,
      maxCharsPerMessage: 2000,
      inactivityTimeout: 30,
    },
    pro: {
      maxExchanges: 20,
      maxTokensTotal: 70000,
      maxCharsPerMessage: 3000,
      inactivityTimeout: 45,
    },
    business: {
      maxExchanges: 25,
      maxTokensTotal: 100000,
      maxCharsPerMessage: 5000,
      inactivityTimeout: 60,
    }
  },
  
  // ============================================
  // CONFIGURAZIONE BOT
  // ============================================
  botConfig: {
    trial: {
      maxQuestions: 6,
      maxKnowledgeBaseChars: 0,
      maxKnowledgeBaseFiles: 0,
    },
    starter: {
      maxQuestions: 10,
      maxKnowledgeBaseChars: 0,
      maxKnowledgeBaseFiles: 0,
    },
    pro: {
      maxQuestions: 15,
      maxKnowledgeBaseChars: 50000,    // ~12.500 parole
      maxKnowledgeBaseFiles: 3,
    },
    business: {
      maxQuestions: 20,
      maxKnowledgeBaseChars: 200000,   // ~50.000 parole
      maxKnowledgeBaseFiles: 10,
    }
  },
  
  // ============================================
  // TEST E SIMULAZIONI (anti-abuso)
  // ============================================
  testing: {
    trial: {
      simulationsPerDayPerBot: 2,
      aiRegenerationsPerDay: 3,
    },
    starter: {
      simulationsPerDayPerBot: 5,
      aiRegenerationsPerDay: 10,
    },
    pro: {
      simulationsPerDayPerBot: 10,
      aiRegenerationsPerDay: 25,
    },
    business: {
      simulationsPerDayPerBot: 20,
      aiRegenerationsPerDay: 50,
    }
  },
  
  // ============================================
  // RATE LIMITS
  // ============================================
  rateLimit: {
    trial: {
      maxParallelInterviews: 2,
      messageCooldownMs: 3000,
      requestsPerMinute: 10,
    },
    starter: {
      maxParallelInterviews: 10,
      messageCooldownMs: 2000,
      requestsPerMinute: 30,
    },
    pro: {
      maxParallelInterviews: 30,
      messageCooldownMs: 1000,
      requestsPerMinute: 60,
    },
    business: {
      maxParallelInterviews: 100,
      messageCooldownMs: 500,
      requestsPerMinute: 120,
    }
  }
};
```

### 4.2 Tracking Token Usage

```typescript
// services/tokenTracker.ts

interface TokenUsage {
  interviewId: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  exchangeCount: number;
  startedAt: Date;
  lastActivityAt: Date;
}

export class TokenTracker {
  private usageMap: Map<string, TokenUsage> = new Map();
  
  async trackUsage(
    interviewId: string,
    sessionId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const key = `${interviewId}:${sessionId}`;
    const existing = this.usageMap.get(key);
    
    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.totalTokens += inputTokens + outputTokens;
      existing.exchangeCount += 1;
      existing.lastActivityAt = new Date();
    } else {
      this.usageMap.set(key, {
        interviewId,
        sessionId,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        exchangeCount: 1,
        startedAt: new Date(),
        lastActivityAt: new Date()
      });
    }
    
    // Persist to database for billing/analytics
    await this.persistUsage(key, this.usageMap.get(key)!);
  }
  
  getUsage(interviewId: string, sessionId: string): TokenUsage | null {
    return this.usageMap.get(`${interviewId}:${sessionId}`) || null;
  }
  
  checkLimits(usage: TokenUsage, limits: typeof HIDDEN_LIMITS.conversation.trial): {
    allowed: boolean;
    reason?: string;
    shouldClose?: boolean;
  } {
    if (usage.exchangeCount >= limits.maxExchanges) {
      return { 
        allowed: false, 
        reason: 'max_exchanges_reached',
        shouldClose: true 
      };
    }
    
    if (usage.totalTokens >= limits.maxTokensTotal) {
      return { 
        allowed: false, 
        reason: 'max_tokens_reached',
        shouldClose: true 
      };
    }
    
    const inactiveMinutes = (Date.now() - usage.lastActivityAt.getTime()) / 60000;
    if (inactiveMinutes >= limits.inactivityTimeout) {
      return { 
        allowed: false, 
        reason: 'inactivity_timeout',
        shouldClose: true 
      };
    }
    
    return { allowed: true };
  }
  
  private async persistUsage(key: string, usage: TokenUsage): Promise<void> {
    // Save to database
  }
}
```

---

## 5. Strategia Modelli LLM

### 5.1 Configurazione Modelli

```typescript
// config/llmModels.ts

/**
 * STRATEGIA MODELLI LLM
 * 
 * Obiettivo: minimizzare costi mantenendo qualità
 * - Conversazione: modello economico (GPT-4o-mini)
 * - Analytics: modello qualitativo (Claude Haiku)
 * - Fallback automatico tra provider
 */

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google'
}

export enum LLMModel {
  // OpenAI
  GPT4O_MINI = 'gpt-4o-mini',
  
  // Anthropic
  CLAUDE_HAIKU = 'claude-3-5-haiku-latest',
  CLAUDE_SONNET = 'claude-sonnet-4-20250514',
  
  // Google
  GEMINI_FLASH = 'gemini-2.0-flash-exp',
  GEMINI_FLASH_LITE = 'gemini-1.5-flash-8b'
}

export enum LLMTask {
  INTERVIEW_CHAT = 'interview_chat',
  BOT_GENERATION = 'bot_generation',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  THEME_EXTRACTION = 'theme_extraction',
  QUOTE_EXTRACTION = 'quote_extraction',
  SUMMARY_GENERATION = 'summary_generation',
  RAG_RETRIEVAL = 'rag_retrieval'
}

export interface ModelConfig {
  primary: LLMModel;
  fallback: LLMModel[];
  maxTokensInput: number;
  maxTokensOutput: number;
  temperature: number;
}

export const MODEL_ASSIGNMENTS: Record<LLMTask, ModelConfig> = {
  [LLMTask.INTERVIEW_CHAT]: {
    primary: LLMModel.GPT4O_MINI,
    fallback: [LLMModel.GEMINI_FLASH, LLMModel.CLAUDE_HAIKU],
    maxTokensInput: 8000,
    maxTokensOutput: 500,
    temperature: 0.7
  },
  
  [LLMTask.BOT_GENERATION]: {
    primary: LLMModel.CLAUDE_HAIKU,
    fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
    maxTokensInput: 4000,
    maxTokensOutput: 2000,
    temperature: 0.5
  },
  
  [LLMTask.SENTIMENT_ANALYSIS]: {
    primary: LLMModel.CLAUDE_HAIKU,
    fallback: [LLMModel.GEMINI_FLASH, LLMModel.GPT4O_MINI],
    maxTokensInput: 6000,
    maxTokensOutput: 500,
    temperature: 0.3
  },
  
  [LLMTask.THEME_EXTRACTION]: {
    primary: LLMModel.CLAUDE_HAIKU,
    fallback: [LLMModel.GEMINI_FLASH, LLMModel.GPT4O_MINI],
    maxTokensInput: 8000,
    maxTokensOutput: 1000,
    temperature: 0.3
  },
  
  [LLMTask.QUOTE_EXTRACTION]: {
    primary: LLMModel.CLAUDE_HAIKU,
    fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
    maxTokensInput: 6000,
    maxTokensOutput: 800,
    temperature: 0.2
  },
  
  [LLMTask.SUMMARY_GENERATION]: {
    primary: LLMModel.CLAUDE_HAIKU,
    fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
    maxTokensInput: 12000,
    maxTokensOutput: 1500,
    temperature: 0.4
  },
  
  [LLMTask.RAG_RETRIEVAL]: {
    primary: LLMModel.GPT4O_MINI,
    fallback: [LLMModel.GEMINI_FLASH_LITE],
    maxTokensInput: 4000,
    maxTokensOutput: 200,
    temperature: 0.1
  }
};

// Pricing per 1M tokens (in USD)
export const MODEL_PRICING = {
  [LLMModel.GPT4O_MINI]: { input: 0.15, output: 0.60 },
  [LLMModel.CLAUDE_HAIKU]: { input: 0.80, output: 4.00 },
  [LLMModel.CLAUDE_SONNET]: { input: 3.00, output: 15.00 },
  [LLMModel.GEMINI_FLASH]: { input: 0.10, output: 0.40 },
  [LLMModel.GEMINI_FLASH_LITE]: { input: 0.075, output: 0.30 }
};
```

### 5.2 LLM Service con Fallback

```typescript
// services/llmService.ts

import { MODEL_ASSIGNMENTS, LLMTask, LLMModel, LLMProvider } from '../config/llmModels';

export class LLMService {
  private providers: Map<LLMProvider, any> = new Map();
  
  constructor() {
    // Initialize providers
    this.providers.set(LLMProvider.OPENAI, new OpenAIClient());
    this.providers.set(LLMProvider.ANTHROPIC, new AnthropicClient());
    this.providers.set(LLMProvider.GOOGLE, new GoogleAIClient());
  }
  
  async complete(
    task: LLMTask,
    messages: Message[],
    options?: Partial<CompletionOptions>
  ): Promise<CompletionResult> {
    const config = MODEL_ASSIGNMENTS[task];
    const models = [config.primary, ...config.fallback];
    
    let lastError: Error | null = null;
    
    for (const model of models) {
      try {
        const provider = this.getProviderForModel(model);
        const client = this.providers.get(provider);
        
        const result = await client.complete({
          model,
          messages,
          maxTokens: options?.maxTokens || config.maxTokensOutput,
          temperature: options?.temperature || config.temperature
        });
        
        // Track token usage for billing
        await this.trackUsage(task, model, result.usage);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Model ${model} failed, trying fallback...`, error);
        continue;
      }
    }
    
    throw new Error(`All models failed for task ${task}: ${lastError?.message}`);
  }
  
  private getProviderForModel(model: LLMModel): LLMProvider {
    if (model.startsWith('gpt')) return LLMProvider.OPENAI;
    if (model.startsWith('claude')) return LLMProvider.ANTHROPIC;
    if (model.startsWith('gemini')) return LLMProvider.GOOGLE;
    throw new Error(`Unknown model: ${model}`);
  }
  
  private async trackUsage(
    task: LLMTask,
    model: LLMModel,
    usage: { inputTokens: number; outputTokens: number }
  ): Promise<void> {
    // Log to database for cost tracking
    await db.llmUsage.create({
      data: {
        task,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        timestamp: new Date()
      }
    });
  }
}
```

---

## 6. Schema Database e Controllo Accessi

### 6.1 Schema Database

```prisma
// prisma/schema.prisma

model Organization {
  id            String    @id @default(cuid())
  name          String
  
  // Piano e billing
  plan          PlanType  @default(TRIAL)
  billingCycle  BillingCycle @default(MONTHLY)
  
  // Limiti custom (override per enterprise)
  customLimits  Json?
  
  // Contatori uso
  responsesUsedThisMonth  Int @default(0)
  monthlyResetDate        DateTime
  
  // Relazioni
  users         User[]
  interviews    Interview[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  
  // Ruolo (per controllo API key)
  role            UserRole  @default(MEMBER)
  
  // IMPORTANTE: Solo admin possono avere API key personalizzate
  // Questo campo è ignorato per non-admin
  customApiKeys   Json?     // { openai?: string, anthropic?: string }
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Interview {
  id              String    @id @default(cuid())
  title           String
  objective       String?
  
  // Configurazione
  questions       Json
  knowledgeBase   Json?
  branding        Json?
  conditionalLogic Json?
  
  // Stato
  status          InterviewStatus @default(DRAFT)
  
  // Contatori (non esposti)
  totalTokensUsed Int @default(0)
  
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  responses       InterviewResponse[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model InterviewResponse {
  id              String    @id @default(cuid())
  interviewId     String
  interview       Interview @relation(fields: [interviewId], references: [id])
  
  // Sessione
  sessionId       String    @unique
  status          ResponseStatus @default(IN_PROGRESS)
  
  // Contenuto
  transcript      Json
  
  // Metriche nascoste
  exchangeCount   Int @default(0)
  totalTokens     Int @default(0)
  
  // Analytics (calcolati async)
  sentiment       Json?
  themes          Json?
  keyQuotes       Json?
  
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
}

// Tracking uso per billing e limiti
model UsageLog {
  id              String    @id @default(cuid())
  organizationId  String
  
  type            UsageType
  count           Int
  
  // Per tracking token (nascosto)
  tokensInput     Int?
  tokensOutput    Int?
  model           String?
  
  timestamp       DateTime  @default(now())
}

enum PlanType {
  TRIAL
  STARTER
  PRO
  BUSINESS
}

enum BillingCycle {
  MONTHLY
  YEARLY
}

enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

enum InterviewStatus {
  DRAFT
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
}

enum ResponseStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
  LIMIT_REACHED
}

enum UsageType {
  RESPONSE_COMPLETED
  SIMULATION
  AI_REGENERATION
  API_CALL
}
```

### 6.2 Helper Controllo Piano

```typescript
// services/planService.ts

import { PLANS, PlanType, PlanConfig } from '../config/plans';
import { HIDDEN_LIMITS } from '../config/limits';

export class PlanService {
  
  async getOrganizationPlan(orgId: string): Promise<PlanConfig> {
    const org = await db.organization.findUnique({
      where: { id: orgId }
    });
    
    if (!org) throw new Error('Organization not found');
    
    const basePlan = PLANS[org.plan];
    
    // Merge con custom limits se presenti (enterprise)
    if (org.customLimits) {
      return {
        ...basePlan,
        limits: { ...basePlan.limits, ...org.customLimits }
      };
    }
    
    return basePlan;
  }
  
  async checkFeatureAccess(
    orgId: string, 
    feature: keyof PlanFeatures
  ): Promise<boolean> {
    const plan = await this.getOrganizationPlan(orgId);
    return plan.features[feature] === true;
  }
  
  async checkResponseLimit(orgId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
  }> {
    const org = await db.organization.findUnique({
      where: { id: orgId }
    });
    
    const plan = PLANS[org!.plan];
    const used = org!.responsesUsedThisMonth;
    const limit = plan.responsesPerMonth;
    
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used)
    };
  }
  
  async checkActiveInterviewsLimit(orgId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const plan = await this.getOrganizationPlan(orgId);
    
    const activeCount = await db.interview.count({
      where: {
        organizationId: orgId,
        status: 'ACTIVE'
      }
    });
    
    const limit = plan.activeInterviews;
    
    // -1 = illimitate
    if (limit === -1) {
      return { allowed: true, current: activeCount, limit: -1 };
    }
    
    return {
      allowed: activeCount < limit,
      current: activeCount,
      limit
    };
  }
  
  async getHiddenLimits(orgId: string): Promise<typeof HIDDEN_LIMITS.conversation.trial> {
    const org = await db.organization.findUnique({
      where: { id: orgId }
    });
    
    return HIDDEN_LIMITS.conversation[org!.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.conversation];
  }
  
  async incrementResponseCount(orgId: string): Promise<void> {
    await db.organization.update({
      where: { id: orgId },
      data: {
        responsesUsedThisMonth: { increment: 1 }
      }
    });
  }
  
  async resetMonthlyCounters(): Promise<void> {
    // Chiamato da cron job mensile
    await db.organization.updateMany({
      data: {
        responsesUsedThisMonth: 0,
        monthlyResetDate: new Date()
      }
    });
  }
}
```

---

## 7. Middleware e Logica di Enforcement

### 7.1 Feature Guard Middleware

```typescript
// middleware/featureGuard.ts

import { PlanService } from '../services/planService';

const planService = new PlanService();

export function requireFeature(feature: keyof PlanFeatures) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.organizationId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasAccess = await planService.checkFeatureAccess(orgId, feature);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Feature not available',
        code: 'FEATURE_NOT_IN_PLAN',
        feature,
        upgradeUrl: '/pricing'
      });
    }
    
    next();
  };
}

// Uso:
// router.post('/interviews/:id/knowledge', requireFeature('knowledgeBase'), uploadKnowledge);
// router.get('/analytics/trends', requireFeature('trends'), getTrends);
// router.post('/webhooks', requireFeature('webhooks'), createWebhook);
```

### 7.2 Response Limit Middleware

```typescript
// middleware/responseLimit.ts

export async function checkResponseLimit(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  const orgId = req.user?.organizationId;
  
  const limitCheck = await planService.checkResponseLimit(orgId);
  
  if (!limitCheck.allowed) {
    return res.status(429).json({
      error: 'Monthly response limit reached',
      code: 'RESPONSE_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit,
      options: {
        buyExtra: {
          pricePerResponse: 0.25,
          url: '/billing/add-responses'
        },
        upgrade: {
          url: '/pricing'
        },
        waitUntil: getNextMonthReset()
      }
    });
  }
  
  // Attach info per uso successivo
  req.responseLimit = limitCheck;
  next();
}
```

### 7.3 Conversation Limits Middleware

```typescript
// middleware/conversationLimits.ts

import { TokenTracker } from '../services/tokenTracker';
import { HIDDEN_LIMITS } from '../config/limits';

const tokenTracker = new TokenTracker();

export async function enforceConversationLimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { interviewId, sessionId } = req.params;
  const orgId = req.user?.organizationId;
  
  // Get plan limits
  const org = await db.organization.findUnique({ where: { id: orgId } });
  const limits = HIDDEN_LIMITS.conversation[org!.plan.toLowerCase()];
  
  // Get current usage
  const usage = tokenTracker.getUsage(interviewId, sessionId);
  
  if (usage) {
    const check = tokenTracker.checkLimits(usage, limits);
    
    if (!check.allowed) {
      if (check.shouldClose) {
        // Triggera chiusura graceful dell'intervista
        return res.status(200).json({
          action: 'CLOSE_INTERVIEW',
          reason: check.reason,
          message: getClosingMessage(check.reason)
        });
      }
      
      return res.status(429).json({
        error: 'Conversation limit reached',
        code: check.reason
      });
    }
  }
  
  // Check message length
  const messageLength = req.body.message?.length || 0;
  if (messageLength > limits.maxCharsPerMessage) {
    return res.status(400).json({
      error: 'Message too long',
      code: 'MESSAGE_TOO_LONG',
      maxLength: limits.maxCharsPerMessage,
      actualLength: messageLength
    });
  }
  
  req.conversationLimits = limits;
  next();
}

function getClosingMessage(reason: string): string {
  switch (reason) {
    case 'max_exchanges_reached':
      return "Grazie mille per il tempo che ci hai dedicato! Abbiamo raccolto informazioni molto utili. C'è qualcos'altro che vorresti aggiungere in chiusura?";
    case 'max_tokens_reached':
      return "Grazie per questa conversazione così ricca! Prima di concludere, c'è un ultimo pensiero che vorresti condividere?";
    case 'inactivity_timeout':
      return "Sembra che tu sia stato occupato. Grazie per le risposte che ci hai dato, sono state molto utili!";
    default:
      return "Grazie per aver partecipato a questa intervista!";
  }
}
```

### 7.4 Rate Limiter

```typescript
// middleware/rateLimiter.ts

import rateLimit from 'express-rate-limit';
import { HIDDEN_LIMITS } from '../config/limits';

export function createPlanBasedRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.organizationId;
    const org = await db.organization.findUnique({ where: { id: orgId } });
    const limits = HIDDEN_LIMITS.rateLimit[org!.plan.toLowerCase()];
    
    // Dynamic rate limit based on plan
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: limits.requestsPerMinute,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      },
      keyGenerator: (req) => req.user?.organizationId || req.ip
    });
    
    return limiter(req, res, next);
  };
}

// Cooldown tra messaggi
export async function enforceMessageCooldown(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { sessionId } = req.params;
  const orgId = req.user?.organizationId;
  
  const org = await db.organization.findUnique({ where: { id: orgId } });
  const limits = HIDDEN_LIMITS.rateLimit[org!.plan.toLowerCase()];
  
  const lastMessageKey = `last_message:${sessionId}`;
  const lastMessageTime = await redis.get(lastMessageKey);
  
  if (lastMessageTime) {
    const elapsed = Date.now() - parseInt(lastMessageTime);
    if (elapsed < limits.messageCooldownMs) {
      return res.status(429).json({
        error: 'Please wait before sending another message',
        code: 'MESSAGE_COOLDOWN',
        retryAfter: Math.ceil((limits.messageCooldownMs - elapsed) / 1000)
      });
    }
  }
  
  // Update last message time
  await redis.set(lastMessageKey, Date.now().toString(), 'EX', 300);
  
  next();
}
```

### 7.5 Simulation Limiter

```typescript
// middleware/simulationLimiter.ts

export async function checkSimulationLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { interviewId } = req.params;
  const orgId = req.user?.organizationId;
  
  const org = await db.organization.findUnique({ where: { id: orgId } });
  const limits = HIDDEN_LIMITS.testing[org!.plan.toLowerCase()];
  
  // Count today's simulations for this bot
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const simulationsToday = await db.usageLog.count({
    where: {
      organizationId: orgId,
      type: 'SIMULATION',
      timestamp: { gte: today }
    }
  });
  
  if (simulationsToday >= limits.simulationsPerDayPerBot) {
    return res.status(429).json({
      error: 'Daily simulation limit reached',
      code: 'SIMULATION_LIMIT_REACHED',
      used: simulationsToday,
      limit: limits.simulationsPerDayPerBot,
      resetAt: getNextMidnightUTC()
    });
  }
  
  next();
}

export async function checkRegenerationLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const orgId = req.user?.organizationId;
  
  const org = await db.organization.findUnique({ where: { id: orgId } });
  const limits = HIDDEN_LIMITS.testing[org!.plan.toLowerCase()];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const regenerationsToday = await db.usageLog.count({
    where: {
      organizationId: orgId,
      type: 'AI_REGENERATION',
      timestamp: { gte: today }
    }
  });
  
  if (regenerationsToday >= limits.aiRegenerationsPerDay) {
    return res.status(429).json({
      error: 'Daily AI regeneration limit reached',
      code: 'REGENERATION_LIMIT_REACHED',
      used: regenerationsToday,
      limit: limits.aiRegenerationsPerDay,
      resetAt: getNextMidnightUTC()
    });
  }
  
  next();
}
```

---

## 8. Comportamento ai Limiti

### 8.1 Chiusura Graceful Intervista

```typescript
// services/interviewChatService.ts

export class InterviewChatService {
  
  async processMessage(
    interviewId: string,
    sessionId: string,
    userMessage: string,
    limits: ConversationLimits
  ): Promise<ChatResponse> {
    
    const usage = await this.getSessionUsage(sessionId);
    
    // Check if we need to close soon
    const exchangesRemaining = limits.maxExchanges - usage.exchangeCount;
    const tokensRemaining = limits.maxTokensTotal - usage.totalTokens;
    
    // Se siamo all'ultimo scambio, genera messaggio di chiusura
    if (exchangesRemaining <= 1) {
      return this.generateClosingResponse(interviewId, sessionId, 'max_exchanges');
    }
    
    // Se stiamo per esaurire i token, genera chiusura
    if (tokensRemaining < 5000) {
      return this.generateClosingResponse(interviewId, sessionId, 'max_tokens');
    }
    
    // Altrimenti procedi normalmente
    const response = await this.llmService.complete(
      LLMTask.INTERVIEW_CHAT,
      this.buildPrompt(interviewId, sessionId, userMessage)
    );
    
    // Track usage
    await this.tokenTracker.trackUsage(
      interviewId,
      sessionId,
      response.usage.inputTokens,
      response.usage.outputTokens
    );
    
    return {
      message: response.content,
      isComplete: false
    };
  }
  
  private async generateClosingResponse(
    interviewId: string,
    sessionId: string,
    reason: string
  ): Promise<ChatResponse> {
    const closingPrompt = `
      Genera un messaggio di chiusura naturale per questa intervista.
      Ringrazia il partecipante, riassumi brevemente che le informazioni
      saranno utili, e chiedi se c'è un ultimo pensiero da condividere.
      Tono: caldo, professionale, non frettoloso.
    `;
    
    const response = await this.llmService.complete(
      LLMTask.INTERVIEW_CHAT,
      [{ role: 'user', content: closingPrompt }]
    );
    
    // Mark session as closing
    await this.markSessionClosing(sessionId, reason);
    
    return {
      message: response.content,
      isComplete: false,
      isClosing: true,
      allowOneMoreMessage: true
    };
  }
  
  async processFinalMessage(
    interviewId: string,
    sessionId: string,
    userMessage: string
  ): Promise<ChatResponse> {
    // Salva l'ultimo messaggio
    await this.saveMessage(sessionId, userMessage);
    
    // Genera ringraziamento finale
    const finalResponse = "Grazie ancora per il tuo contributo. Le tue risposte ci aiuteranno molto. Buona giornata!";
    
    // Completa la sessione
    await this.completeSession(sessionId);
    
    return {
      message: finalResponse,
      isComplete: true
    };
  }
}
```

### 8.2 Gestione Limite Risposte Mensili

```typescript
// services/interviewService.ts

export class InterviewService {
  
  async checkAndPauseIfNeeded(orgId: string): Promise<void> {
    const limitCheck = await this.planService.checkResponseLimit(orgId);
    
    if (!limitCheck.allowed) {
      // Pausa tutte le interviste attive
      await db.interview.updateMany({
        where: {
          organizationId: orgId,
          status: 'ACTIVE'
        },
        data: {
          status: 'PAUSED'
        }
      });
      
      // Notifica l'organizzazione
      await this.notificationService.send(orgId, {
        type: 'RESPONSE_LIMIT_REACHED',
        title: 'Limite risposte mensili raggiunto',
        message: `Hai utilizzato tutte le ${limitCheck.limit} risposte incluse nel tuo piano. Le interviste sono in pausa.`,
        actions: [
          { label: 'Acquista risposte extra', url: '/billing/add-responses' },
          { label: 'Fai upgrade', url: '/pricing' }
        ]
      });
    }
  }
  
  async getInterviewForRespondent(
    interviewId: string
  ): Promise<InterviewForRespondent | ErrorResponse> {
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: { organization: true }
    });
    
    if (!interview) {
      return { error: 'Interview not found', code: 'NOT_FOUND' };
    }
    
    if (interview.status === 'PAUSED') {
      return {
        error: 'Interview temporarily unavailable',
        code: 'INTERVIEW_PAUSED',
        message: 'Questa intervista è temporaneamente non disponibile. Riprova più tardi.'
      };
    }
    
    // Check response limit before starting
    const limitCheck = await this.planService.checkResponseLimit(
      interview.organizationId
    );
    
    if (!limitCheck.allowed) {
      // Pausa questa intervista
      await db.interview.update({
        where: { id: interviewId },
        data: { status: 'PAUSED' }
      });
      
      return {
        error: 'Interview temporarily unavailable',
        code: 'LIMIT_REACHED',
        message: 'Questa intervista è temporaneamente non disponibile. Riprova più tardi.'
      };
    }
    
    return this.formatInterviewForRespondent(interview);
  }
}
```

---

## 9. Sicurezza e Restrizioni Admin

### 9.1 Rimozione API Key Personalizzate per Non-Admin

```typescript
// middleware/apiKeyRestriction.ts

/**
 * IMPORTANTE: Solo gli utenti con ruolo ADMIN possono
 * configurare API key personalizzate per i provider LLM.
 * 
 * Questo per:
 * 1. Sicurezza - evitare leak di chiavi
 * 2. Controllo costi - usare sempre le chiavi aziendali
 * 3. Compliance - audit trail centralizzato
 */

export async function restrictApiKeyAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user;
  
  // Se l'utente sta cercando di impostare/modificare API key
  if (req.body.customApiKeys !== undefined) {
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        error: 'Only administrators can configure custom API keys',
        code: 'ADMIN_ONLY_FEATURE'
      });
    }
  }
  
  next();
}

// Anche nel frontend, nascondi la sezione
export function shouldShowApiKeySettings(user: User): boolean {
  return user.role === UserRole.ADMIN;
}
```

### 9.2 Schema Settings senza API Key per Non-Admin

```typescript
// api/settings/route.ts

export async function GET(req: Request) {
  const user = await getCurrentUser();
  
  const settings = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      // API keys solo per admin
      ...(user.role === UserRole.ADMIN && {
        customApiKeys: true
      }),
      organization: {
        select: {
          id: true,
          name: true,
          plan: true,
          branding: true
        }
      }
    }
  });
  
  return Response.json(settings);
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  const body = await req.json();
  
  // Rimuovi customApiKeys se non admin
  if (user.role !== UserRole.ADMIN) {
    delete body.customApiKeys;
  }
  
  // Validate remaining fields
  const validated = settingsSchema.parse(body);
  
  await db.user.update({
    where: { id: user.id },
    data: validated
  });
  
  return Response.json({ success: true });
}
```

### 9.3 LLM Service - Ignora API Key Non-Admin

```typescript
// services/llmService.ts

export class LLMService {
  
  async complete(
    task: LLMTask,
    messages: Message[],
    context: RequestContext
  ): Promise<CompletionResult> {
    
    // Determina quale API key usare
    const apiKey = await this.resolveApiKey(task, context);
    
    // ... rest of implementation
  }
  
  private async resolveApiKey(
    task: LLMTask,
    context: RequestContext
  ): Promise<string> {
    const user = context.user;
    
    // SOLO admin possono usare chiavi personalizzate
    if (user.role === UserRole.ADMIN && user.customApiKeys) {
      const provider = this.getProviderForTask(task);
      const customKey = user.customApiKeys[provider];
      
      if (customKey) {
        return customKey;
      }
    }
    
    // Tutti gli altri usano le chiavi di sistema
    return this.getSystemApiKey(task);
  }
  
  private getSystemApiKey(task: LLMTask): string {
    const provider = this.getProviderForTask(task);
    
    switch (provider) {
      case LLMProvider.OPENAI:
        return process.env.OPENAI_API_KEY!;
      case LLMProvider.ANTHROPIC:
        return process.env.ANTHROPIC_API_KEY!;
      case LLMProvider.GOOGLE:
        return process.env.GOOGLE_AI_API_KEY!;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

### 9.4 UI Settings - Nascondi Sezione API Key

```tsx
// components/settings/ApiKeysSection.tsx

import { useUser } from '@/hooks/useUser';
import { UserRole } from '@/types';

export function ApiKeysSection() {
  const { user } = useUser();
  
  // Non mostrare nulla se non admin
  if (user.role !== UserRole.ADMIN) {
    return null;
  }
  
  return (
    <section className="settings-section">
      <h2>API Keys Personalizzate</h2>
      <p className="text-muted">
        Configura chiavi API personalizzate per i provider LLM.
        Queste chiavi verranno usate al posto di quelle di sistema.
      </p>
      
      <div className="space-y-4">
        <ApiKeyInput 
          provider="openai" 
          label="OpenAI API Key" 
        />
        <ApiKeyInput 
          provider="anthropic" 
          label="Anthropic API Key" 
        />
        <ApiKeyInput 
          provider="google" 
          label="Google AI API Key" 
        />
      </div>
      
      <Alert variant="warning" className="mt-4">
        <AlertDescription>
          Le chiavi API sono sensibili. Assicurati di usare chiavi
          con i permessi minimi necessari e di ruotarle periodicamente.
        </AlertDescription>
      </Alert>
    </section>
  );
}
```

---

## Appendice: Checklist Implementazione

### Fase 1: Database e Core
- [ ] Schema Prisma aggiornato
- [ ] Migrazione database
- [ ] Service PlanService
- [ ] Service TokenTracker
- [ ] Service LLMService con fallback

### Fase 2: Middleware
- [ ] Feature guard middleware
- [ ] Response limit middleware
- [ ] Conversation limits middleware
- [ ] Rate limiter
- [ ] Simulation limiter
- [ ] API key restriction

### Fase 3: Business Logic
- [ ] Chiusura graceful interviste
- [ ] Gestione pausa per limiti
- [ ] Tracking usage per billing
- [ ] Reset contatori mensili (cron)

### Fase 4: Frontend
- [ ] Pricing page aggiornata
- [ ] Feature matrix component
- [ ] Upsell modals ai limiti
- [ ] Settings senza API key per non-admin
- [ ] Dashboard usage

### Fase 5: Landing Page
- [ ] Hero section
- [ ] Stats section
- [ ] How it works
- [ ] Use cases
- [ ] Testimonials
- [ ] CTA finale

### Fase 6: Testing
- [ ] Unit test limiti
- [ ] Integration test piani
- [ ] E2E test upgrade flow
- [ ] Load test rate limits

---

*Documento generato per Business Tuner - Dicembre 2024*
*Versione: 1.0*
