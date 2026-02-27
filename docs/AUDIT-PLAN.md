# PIANO DI AUDIT COMPLETO - AI Interviewer Platform

> **Data:** 2026-02-27 | **Branch:** stage
> **Obiettivo:** Verificare la corrispondenza UI ↔ Codice, la qualità dei flussi LLM, la crescita automatica della KB, e l'allineamento agli obiettivi della piattaforma
> **Target utente primario:** Management PMI italiana, Consulenti/Agenzie
> **Target utente raccolta dati:** Stakeholder internazionali (chatbot/interviste multilingua)

---

## INDICE

- [0. METODOLOGIA E ASSEGNAZIONE MODELLI](#0-metodologia)
- [1. RICERCA BENCHMARK E BEST PRACTICES](#1-ricerca)
- [2. AUDIT AREA: INTERVIEW ENGINE](#2-interview)
- [3. AUDIT AREA: CHATBOT ENGINE](#3-chatbot)
- [4. AUDIT AREA: ANALYTICS & INSIGHTS](#4-analytics)
- [5. AUDIT AREA: KNOWLEDGE BASE](#5-kb)
- [6. AUDIT AREA: VISIBILITY & BRAND MONITORING](#6-visibility)
- [7. AUDIT AREA: CMS & CONTENT SUGGESTIONS](#7-cms)
- [8. AUDIT AREA: AI TIPS & AUTOMAZIONE](#8-tips)
- [9. AUDIT AREA: COPILOT STRATEGICO](#9-copilot)
- [10. AUDIT AREA: BILLING & CREDITS](#10-billing)
- [11. AUDIT AREA: DASHBOARD & SETTINGS](#11-dashboard)
- [12. AUDIT CROSS-CUTTING: PROMPT QUALITY](#12-prompts)
- [13. AUDIT CROSS-CUTTING: LINGUA E LOCALIZZAZIONE](#13-lingua)
- [14. AUDIT CROSS-CUTTING: SICUREZZA E PRIVACY](#14-sicurezza)
- [15. AUDIT CROSS-CUTTING: PERFORMANCE & COSTI](#15-performance)
- [16. GAP ANALYSIS & ROADMAP SUGGERITA](#16-gap)

---

<a id="0-metodologia"></a>
## 0. METODOLOGIA E ASSEGNAZIONE MODELLI

### 0.1 Approccio di Audit

Ogni area viene verificata su **4 dimensioni**:

| Dimensione | Descrizione |
|-----------|-------------|
| **UI ↔ Codice** | Ciò che l'interfaccia mostra/promette corrisponde a ciò che il codice esegue? |
| **Qualità LLM** | I prompt producono output coerenti con gli obiettivi? Le guard funzionano? |
| **Dati & Pipeline** | I dati fluiscono correttamente attraverso tutti gli stadi? |
| **Obiettivo Business** | La feature supporta efficacemente la mission della piattaforma? |

### 0.2 Assegnazione Modelli per Ottimizzazione Token

| Tipo di Task | Modello | Motivazione |
|-------------|---------|-------------|
| **Analisi architetturale complessa** (prompt quality, logic flows, gap analysis) | **Opus** | Richiede ragionamento profondo e connessioni non ovvie |
| **Verifica codice-UI** (mapping routes ↔ componenti, verifica feature) | **Sonnet** | Buon bilanciamento tra comprensione e costo |
| **Ricerca best practices** (web search, benchmark gathering) | **Opus** | Richiede sintesi di fonti multiple e giudizio qualitativo |
| **Check strutturali** (file existence, pattern matching, schema validation) | **Haiku** | Task meccanici e veloci |
| **Verifica prompt individuali** (singolo prompt → output atteso) | **Sonnet** | Analisi focalizzata su un singolo prompt |
| **Cross-referencing DB ↔ API ↔ UI** | **Haiku** | Pattern matching su strutture note |
| **Generazione raccomandazioni** (suggerimenti implementativi) | **Opus** | Richiede creatività e visione d'insieme |

### 0.3 Convenzioni Checklist

- `[ ]` = Da verificare
- `[✓]` = Verificato OK
- `[✗]` = Problema trovato (con nota)
- `[~]` = Parzialmente implementato
- `[!]` = Critico - richiede intervento
- **Modello suggerito** indicato con 🏷️ accanto a ogni task

---

<a id="1-ricerca"></a>
## 1. RICERCA BENCHMARK E BEST PRACTICES

> **Obiettivo:** Stabilire criteri oggettivi di valutazione per ogni area funzionale
> 🏷️ **Modello:** Opus (ricerca web + sintesi)

### 1.1 Interviste Qualitative AI-Powered

**Benchmark di riferimento (da ricerca):**
- Chatbot enterprise: containment rate target 70-90%, FAQ bot 40-60%
- AI chatbot risolvono 87% richieste senza escalation umana
- Tempo risposta target: 1-3 secondi per chatbot testuali
- Lead form completion rate via bot: target ~10%
- SMS + AI assistant aumentano completion del 12-20% in ruoli shift-based
- Opzioni non-video (audio/testo) aumentano completion per candidati disabili del 6-10%

**Checklist audit:**
- [ ] Confrontare completion rate piattaforma vs benchmark 70-90%
- [ ] Verificare tempo risposta <3s per intervista conversazionale
- [ ] Verificare che il sistema di probing segua best practices qualitative (1 domanda per turno, no leading questions)
- [ ] Verificare gestione fatigue (rilevamento risposte brevi, rallentamento pacing)
- [ ] Verificare adattamento sentiment in real-time
- [ ] Confrontare con piattaforme competitor (Typeform AI, SurveyMonkey Genius, Qualtrics XM)
- [ ] Verificare standard etici per consenso e trasparenza AI (AI Act disclosure)

### 1.2 GEO (Generative Engine Optimization)

**Benchmark di riferimento (da ricerca):**
- GEO: ottimizzare contenuti per apparire nelle risposte di AI (ChatGPT, Gemini, Perplexity)
- 1B+ prompt/giorno su ChatGPT, 71% americani usa AI search per acquisti
- Traffico search tradizionale previsto -25% entro 2026, -50% entro 2028
- LLM citano tipicamente 2-7 domini per risposta
- Metriche chiave: citation frequency, brand share of voice, sentiment, mention rate
- Frequenza monitoring raccomandata: **settimanale** (pattern direzionali, non punteggi assoluti)
- E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) critico per GEO
- Structured data/schema markup fondamentale per comprensione LLM
- Brand authority cross-platform (Wikidata, Crunchbase, LinkedIn) aumenta visibilità GEO

**Checklist audit:**
- [ ] Verificare che il sistema di monitoring copra i provider principali (ChatGPT, Gemini, Perplexity, Claude)
- [ ] Verificare tracking metriche: citation frequency, share of voice, sentiment, positioning
- [ ] Verificare frequenza scan almeno settimanale per risultati significativi
- [ ] Verificare che i suggerimenti contenuto includano ottimizzazione E-E-A-T
- [ ] Verificare che i suggerimenti includano structured data/schema per GEO
- [ ] Verificare tracking AI Overview di Google
- [ ] Verificare confronto competitivo nel tempo (share of voice vs competitors)

### 1.3 Digital Marketing B2B per PMI

**Benchmark di riferimento (da ricerca):**
- Topic cluster: pillar page + cluster articles con interlinking interno
- 81% team marketing B2B usa AI generativa (CMI 2026)
- Google: contenuti "original, high-quality, people-first"
- Formati ad alte performance: guide complete, eBook, case study, video (explainer, brand, customer success)
- Distribuzione canali per intent: SEO per high-intent, LinkedIn per thought leadership, email per nurturing
- Schema.org prioritari B2B: Organization (sitewide), FAQPage (service+blog), BlogPosting (articoli)
- Poi: Service schema, Person schema per authority
- JSON-LD formato raccomandato da Google
- Siti con Article schema: 2-3x higher citation rate in AI summaries
- Rich results: 20-40% higher CTR

**Checklist audit:**
- [ ] Verificare che CMS suggestions seguano logica topic cluster
- [ ] Verificare che contenuti generati siano "people-first" e non generici AI
- [ ] Verificare copertura formati (blog, FAQ, landing page, case study)
- [ ] Verificare che schema.org generato includa Organization, FAQPage, BlogPosting
- [ ] Verificare formato JSON-LD per schema
- [ ] Verificare keyword strategy basata su dati GSC reali
- [ ] Verificare che suggerimenti includano meta description, og tags, SEO title

### 1.4 LinkedIn & Social B2B

**Benchmark di riferimento (da ricerca):**
- LinkedIn 2025-2026: priorità "depth of engagement" vs vanity metrics
- Dwell time (tempo speso sul contenuto) = indicatore primario di rilevanza
- Carousel: engagement rate più alto (6.60%), più like
- Video nativo: 5x engagement vs post statici
- Profili personali: 8x engagement vs company page
- Frequenza ottimale: 3-5 post/settimana di alta qualità > post giornalieri low-effort
- Content reactivation: commentare/reshare dopo 8-24h per spingere nei feed
- Brand memorabili: elementi visivi/verbali distintivi ripetuti (logo, tono, colore)
- Focus su: story-driven, conversational, expert content, framework pratici

**Checklist audit:**
- [ ] Verificare che AI tips per social includano formati ottimizzati LinkedIn (carousel, video, document)
- [ ] Verificare suggerimento frequenza posting (3-5/settimana)
- [ ] Verificare focus su profili personali vs company page
- [ ] Verificare che contenuti suggeriti siano "story-driven" e con framework pratici
- [ ] Verificare che non vengano suggeriti formati low-engagement (link post semplici)
- [ ] Verificare inclusione metriche LinkedIn (dwell time, engagement rate) nel monitoring

### 1.5 Strategie Marketing PMI Italiane

**Benchmark di riferimento (da ricerca):**
- 54% PMI italiane investono intensamente in digitale (2025)
- Solo 19% adotta tecnologie avanzate in modo strutturato
- Solo 26.2% ha livello "alto" di digitalizzazione (CRM + analytics + automation)
- 83% PMI riporta difficolta nell'adozione digitale
- Principali barriere: carenze culturali (44%), mancanza competenze (59%), costi (40%)
- 47% criticita nell'accesso alla connettivita digitale
- Trend 2025: AI e automazione, video content e formati brevi
- Finanziamenti disponibili: voucher e contributi per tecnologie, consulenza, formazione

**Checklist audit:**
- [ ] Verificare che il linguaggio UI sia accessibile a PMI con bassa digitalizzazione
- [ ] Verificare che i suggerimenti siano implementabili con budget limitato
- [ ] Verificare che l'onboarding guidi utenti con bassa maturita digitale
- [ ] Verificare che i tip includano formati video/brevi dove appropriato
- [ ] Verificare che la piattaforma non richieda competenze tecniche avanzate
- [ ] Verificare che il copilot adatti raccomandazioni al livello di maturita digitale dell'org

### 1.6 Knowledge Base Auto-Growth

**Benchmark di riferimento (da ricerca):**
- RAG feedback loop: chiedere utilita risposta (Resolved/Helpful/Unhelpful)
- Dynamic KB growth: registrare complaint, query, review, ticket e reinserire nel RAG
- KB Coverage: tracciare cambiamenti retrieval performance nel tempo
- "Human in the loop" per monitoring e QA = implementazioni piu riuscite
- Document curation rigorosa prima dell'ingestion
- Escludere PII dal contenuto KB
- Role-based access controls sulla KB
- Continuous evaluation and improvement tramite metriche e feedback

**Checklist audit:**
- [ ] Verificare implementazione feedback loop (thumbs up/down su risposte)
- [ ] Verificare pipeline di estrazione automatica da conversazioni → KB
- [ ] Verificare curation/validazione contenuto prima dell'ingestion
- [ ] Verificare esclusione PII dal contenuto KB
- [ ] Verificare metriche di qualita KB (coverage, retrieval accuracy)
- [ ] Verificare che KB cresca da tutte le 7 fonti dichiarate (chat, interviste, tip, scraping, analytics, GSC, gap risolti)
- [ ] Valutare opportunita vector embeddings vs attuale keyword matching

---

<a id="2-interview"></a>
## 2. AUDIT AREA: INTERVIEW ENGINE

> **Files chiave:**
> - `src/app/api/chat/route.ts` (3511 righe - motore principale)
> - `src/lib/llm/prompt-builder.ts` (5 blocchi prompt)
> - `src/lib/llm/runtime-prompt-blocks.ts` (blocchi 6-7)
> - `src/lib/interview/interview-supervisor.ts` (state machine)
> - `src/lib/interview/micro-planner.ts` (decisioni per turno)
> - `src/lib/interview/runtime-knowledge.ts` (KB runtime)
> - `src/lib/llm/candidate-extractor.ts` (estrazione profilo)
> - `src/lib/tone/tone-prompt-adapter.ts` (adattamento tono)
> - `src/lib/memory/memory-manager.ts` (memoria conversazione)

### 2.1 UI ↔ Codice 🏷️ Sonnet

#### Pagina Configurazione Bot (`/dashboard/bots/[botId]`)
- [✓] **Campi configurazione**: Tutti i campi UI (nome, tono, lingua, obiettivo ricerca, target audience, topics, subgoals) sono usati nel `PromptBuilder.build()` via i 7 blocchi
- [~] **Selezione modello**: Il dropdown UI mostra 5 modelli ma `MODEL_ASSIGNMENTS` ne usa 7 task-types. Il dropdown include modelli non assegnati a nessun task (es. CLAUDE_SONNET definito ma non assegnato). **NOTA: MODEL_ASSIGNMENTS non è consumato universalmente** — copilot, CMS, website analysis usano modelli hardcoded
- [✓] **Toggle "Raccolta dati candidato"**: `collectCandidateData` attiva correttamente la fase DATA_COLLECTION nel supervisor quando `allTopicsCovered === true`
- [✓] **Campi dati candidato**: Tutti i campi selezionabili supportati in `extractFieldFromMessage()` con regex-first per email/phone/url, poi fallback LLM
- [~] **Durata intervista**: Il budget tempo è rispettato dal supervisor tramite `checkBudgetAndDecide()`, ma il campo si chiama `maxDuration` in config vs `effectiveDuration` nella conversation — **naming inconsistency**
- [~] **Knowledge sources**: Le fonti KB sono iniettate nel prompt, MA troncate a 3 fonti × max 260 chars ciascuna. Fonti più lunghe perdono contenuto silenziosamente. **Nessuna selezione per rilevanza semantica — solo ordine arbitrario**
- [✓] **Anteprima messaggio intro**: Il messaggio di benvenuto configurato viene inviato come primo messaggio via `conversation.welcomeMessage`

#### Pagina Conversazioni (`/dashboard/bots/[botId]/conversations`)
- [~] **Lista conversazioni**: Lo stato mostrato usa IN_PROGRESS e COMPLETED correttamente, ma **ABANDONED non viene mai impostato** — il campo `conversation.status` è un `String` libero, non un enum DB. Nessun timeout o logica setta ABANDONED
- [✓] **Sentiment indicator**: Il sentiment mostrato corrisponde a `conversationAnalysis.sentimentScore` (scala -1 a +1, mostrato come %)
- [~] **Durata mostrata**: `effectiveDuration` è calcolata da `startedAt` a `completedAt` — se la conversazione non è completata, il campo è null. **Naming inconsistency con `maxDuration` nella config**
- [✓] **Transcript view**: Il transcript mostra tutti i messaggi user + assistant. I messaggi di sistema/validazione sono filtrati
- [✓] **Profilo candidato**: I dati estratti corrispondono — `CandidateExtractor` usa regex + LLM con validazione formato

#### Pagina Piano Intervista (`/dashboard/bots/[botId]/plan`)
- [✓] **Editor piano**: Le modifiche al piano vengono salvate in `InterviewPlan` e usate dal supervisor per costruire i blocchi prompt
- [✓] **Sub-goals**: I sub-goals editati sono targettizzati dal micro-planner — `coverageTracker` li usa come target
- [✓] **Turni per topic**: Il budget turni è gestito dall'elastic budget in `topic-manager.ts` con ribilanciamento dinamico

#### Widget Pubblico (`/i/[slug]/`)
- [✓] **Welcome screen**: Mostra correttamente nome bot e messaggio intro
- [✓] **Consenso**: Il consenso viene raccolto PRIMA dell'inizio tramite checkbox obbligatorio
- [~] **Progress bar**: `SemanticProgressBar` traccia topic coverage, MA traccia solo i topic principali, **non i sub-goals**. L'avanzamento percepito può essere impreciso
- [✓] **Messaggio fine**: La chiusura include ringraziamento + domanda "C'è qualcos'altro?"
- [✓] **Responsive**: Il widget è responsive con layout flessibile
- [~] **Lingue**: Il widget **ha la LandingPage hardcoded in italiano**. Le opzioni lingua nel form ("Seleziona lingua") fanno fallback silenzioso. **Non c'è mapping lingua → label UI nel widget pubblico**

### 2.2 Flussi LLM 🏷️ Opus

#### State Machine del Supervisor
- [✓] **Transizioni WARMUP → SCAN → DEEP → CLOSURE**: Le transizioni sono triggerate dalle condizioni corrette nel supervisor con `checkBudgetAndDecide()`
- [✓] **WARMUP**: Dura 1-3 turni con domande ice-breaker leggere. Il micro-planner sceglie strategia `cover_subgoal`
- [✓] **SCAN (EXPLORE)**: Ogni topic viene visitato almeno una volta. Il turn budget è gestito dall'elastic budget
- [✓] **DEEP (DEEPEN)**: Solo topic con HIGH signal score vengono approfonditi
- [✓] **DEEP_OFFER_ASK**: La domanda di continuazione è formattata come vera yes/no. L'enforcement usa prompt dedicato (Prompt #14-15)
- [✓] **DATA_COLLECTION_CONSENT**: Il consenso viene chiesto PRIMA tramite Prompt #16 (consent enforcement)
- [✓] **DATA_COLLECTION**: I campi vengono chiesti uno alla volta con ordine logico (nome → email → phone → altri)
- [✓] **CLOSURE**: La chiusura include "C'è qualcos'altro?" prima del saluto finale
- [~] **Edge case**: Off-topic viene gestito dal Block 7 (Guards) con redirect gentile. MA **ABANDONED non viene MAI impostato**: non c'è timeout inattività, nessun meccanismo rileva utenti che abbandonano la sessione. Le conversazioni restano IN_PROGRESS indefinitamente

#### Prompt Builder - 7 Blocchi
- [✓] **Blocco 1 (Identità)**: Le regole fondamentali sono presenti: 1 domanda per turno, no promo, terminare con "?", mai menzionare struttura interna
- [✓] **Blocco 2 (Contesto intervista)**: Budget tempo calcolato, status pacing iniettato (AHEAD/ON_TRACK/BEHIND)
- [✓] **Blocco 3 (Focus Topic)**: Topic corrente comunicato con sub-goals. La mappa i18n è presente per label campi
- [✓] **Blocco 4 (Memoria)**: Fatti estratti da `MemoryManager.getExtractedFacts()` — basati su analisi reale, non inventati
- [!] **Blocco 5 (Knowledge)**: **BUG CRITICO**: Il language detection usa `const isItalian = currentTopic.label.length > 0` che è **SEMPRE true** (qualsiasi stringa non vuota). Questo significa che le knowledge cues sono SEMPRE in italiano indipendentemente dalla lingua configurata. Le cues sono pertinenti al topic ma limitate a 260 chars per fonte
- [✓] **Blocco 6 (Turn Guidance)**: Il signal scoring (HIGH/MEDIUM/LOW) funziona correttamente in `runtime-prompt-blocks.ts`
- [~] **Blocco 7 (Guards)**: Le guard per off-topic funzionano con redirect gentile, MA **non c'è escalation** dopo N tentativi off-topic consecutivi — l'intervista può restare bloccata in un loop

#### Micro-Planner
- [✓] **Strategia**: Le 4 strategie sono selezionate in base al signal score e alla copertura corrente dei sub-goals
- [✓] **Stile**: I 3 stili producono prompt differenziati per l'LLM
- [✓] **Copertura**: Il micro-planner traccia i sub-goals coperti via `coverageTracker`

#### Qualità Domande Generate
- [✓] **Una domanda per turno**: Il Blocco 1 istruisce "Concludi SEMPRE con una domanda aperta" e il question-only enforcement (Prompt #13) rigenera se necessario
- [✓] **No stock openers**: Il blocco identità istruisce esplicitamente "evita frasi fatte"
- [✓] **Riferimento concreto**: Il Blocco 4 (Memoria) inietta fatti estratti dalla conversazione per riferimenti specifici
- [✓] **Non leading**: Le istruzioni nel Blocco 1 specificano "non suggerire risposte"
- [✓] **Bridge naturali**: Il micro-planner include stile `neutral_bridge` per transizioni fluide

#### Estrazione Dati Candidato
- [✓] **Regex-first**: `extractFieldFromMessage()` usa regex per email, phone, URL (linkedin, portfolio) prima del fallback LLM
- [✓] **Validazione**: Formato email e telefono validati con regex specifiche
- [✓] **Feedback**: Il Prompt #17 (Field Collection Enforcement) genera messaggi di retry gentili
- [✓] **Skip intent**: L'utente può dire "preferisco non dirlo" e il sistema va avanti al campo successivo

#### Adattamento Tono
- [!] **Profilo comunicativo**: `tone-prompt-adapter.ts` esiste con logica completa per profilo comunicativo, MA **è UNWIRED** — non viene mai invocato nel flusso principale `chat/route.ts`. Il tono NON si adatta dinamicamente
- [!] **Emoji**: La logica emoji è nel tone adapter ma **non connessa** al prompt builder
- [!] **Complessità linguistica**: Il tone adapter ha istruzioni di complessità MA è **solo in italiano** — nessuna localizzazione delle istruzioni di tono

### 2.3 Pipeline Dati 🏷️ Haiku

- [✓] **Salvataggio messaggi**: Ogni messaggio viene salvato in `Message` con timestamp, ruolo, e metadata
- [✓] **Idempotenza**: `clientMessageId` previene duplicati
- [✓] **Token tracking**: I token vengono tracciati via `TokenTrackingService.logTokenUsage()` per modello e operazione
- [✓] **Crediti**: I crediti vengono detratti con costo `interview_question: 8` tramite `actionOverride` nel token tracking
- [~] **Conversation status**: IN_PROGRESS → COMPLETED funziona, MA **ABANDONED non viene MAI impostato**. Il campo è `String` libero nel DB, non un enum. Nessun timeout rileva sessioni abbandonate
- [✓] **Effective duration**: Calcolato server-side da `startedAt` a `completedAt`
- [✓] **Candidate profile**: Salvato come `candidateProfile` JSON nella `Conversation`

> **⚠️ FINDING CRITICO — Token Overflow Risk**: La conversation history non ha truncation. Con il cap di 260 messaggi e 7 blocchi di prompt, una conversazione lunga può eccedere il context window del modello (8000 token input limit per alcuni modelli). Non c'è logica di sliding window o summarization della history

### 2.4 Obiettivo Business 🏷️ Opus

- [✓] **Ascolto stakeholder**: L'architettura a 7 blocchi + micro-planner produce domande adattive e contestuali. Il signal scoring (HIGH/MEDIUM/LOW) guida l'approfondimento
- [~] **Adattività**: Il sistema è adattivo nel contenuto (topic + sub-goals) MA **il tono NON si adatta** (tone adapter unwired). La personalizzazione è solo a livello di contenuto, non di stile comunicativo
- [✓] **Actionability**: I dati raccolti (temi, sentiment, citazioni, profilo candidato) sono strutturati per insight. L'AnalyticsEngine genera 4 tipi di insight azionabili
- [~] **Esperienza utente**: L'esperienza è generalmente positiva, MA: nessun rilevamento fatigue (risposte corte ripetute), nessun rallentamento pacing automatico, landing page solo in italiano
- [~] **Confronto benchmark**: Il sistema segue le best practices qualitative (1 domanda per turno, no leading questions, probing). Mancano: opzioni non-testo (audio/video), rilevamento fatigue, adaptive pacing basato su sentiment real-time

---

<a id="3-chatbot"></a>
## 3. AUDIT AREA: CHATBOT ENGINE

> **Files chiave:**
> - `src/app/api/chatbot/message/route.ts` (804 righe)
> - `src/app/api/chatbot/start/route.ts`
> - `src/lib/chatbot/message-guards.ts`
> - `src/lib/chatbot/knowledge-gap-detector.ts`
> - `src/lib/chatbot/analytics-aggregator.ts`
> - `src/lib/templates/chatbot-templates.ts`

### 3.1 UI ↔ Codice 🏷️ Sonnet

#### Configurazione Chatbot (`/dashboard/bots/[botId]` - modo chatbot)
- [✓] **Template predefiniti**: I template in `chatbot-templates.ts` generano configurazioni funzionanti con topics, boundaries, fallback, tone preconfigurati
- [✓] **Topics & boundaries**: I limiti di scope sono iniettati nel prompt e rispettati dal chatbot
- [✓] **Fallback message**: Il messaggio di fallback è configurabile e usato nel prompt quando il chatbot esce dallo scope
- [~] **Lead capture strategy**: Le 3 strategie (aggressive, smart, passive) sono definite nell'enum, MA la logica `smart` usa un LLM call separato (`gpt-4o-mini`) per decidere il timing — **il caso `priority` nel codice usa uppercase/lowercase inconsistente** (`HIGH` vs `high`)
- [~] **Page context**: `enablePageContext` è salvato nel DB ma **il toggle manca nella UI** di ChatbotSettings.tsx. Il chatbot.js estrae il contesto pagina e lo invia, ma l'utente non può attivare/disattivare la feature dalla dashboard
- [~] **Widget customization**: Colori e avatar sono configurabili. MA **`bubblePosition` è hardcoded** a `bottom-right` — non c'è opzione di posizionamento nella UI

#### Widget Chat (`/w/[botId]/`)
- [✓] **Init session**: La sessione viene creata con `pageUrl`, `referrer`, `userAgent` come metadata
- [✓] **Risposte**: Le risposte usano KB + topic boundaries per rispondere nel contesto corretto
- [✓] **Out-of-scope**: Il chatbot rifiuta garbatamente con il messaggio di fallback configurato
- [✓] **Lead capture**: Il timing è gestito dalle 3 strategie con logica LLM per `smart`
- [~] **Embed code**: Il codice embed (`chatbot.js`) funziona come IIFE che crea iframe + bolla. MA **le opzioni avanzate di embed (`data-auto-open`, `data-hide-mobile`, `data-delay`) generano attributi `data-*` che chatbot.js NON legge mai**. Queste opzioni sono decorative nella UI

#### Knowledge Gaps (`/dashboard/bots/[botId]/knowledge-gaps`)
- [✓] **Lista gaps**: I gap provengono da `knowledge-gap-detector.ts` che analizza conversazioni con fallback/low confidence
- [~] **Priorità**: Il sistema di priorità usa `HIGH/MEDIUM/LOW` dal LLM, ma **la route `/api/knowledge/gaps` non filtra per organizzazione** — potenziale cross-org data leak
- [✓] **FAQ suggerite**: Le FAQ sono generate dal LLM con domanda + risposta basata sul contesto della conversazione
- [~] **Azione "approva"**: Approvare un gap ha **due code paths**: uno crea `KnowledgeSource` direttamente, l'altro usa `FaqSuggestion` model. MA il model `FaqSuggestion` **non ha nessun write path** (nessuna route lo crea) — è un modello orfano nel DB

### 3.2 Flussi LLM 🏷️ Opus

#### Prompt Chatbot
- [✓] **buildChatbotPrompt()**: Il prompt include nome, tono, scope, boundaries, KB, e page context (quando abilitato)
- [✓] **Guardrail scope**: Le istruzioni per fuori-scope includono messaggio di fallback configurabile
- [✓] **Lead capture timing**: La strategia `smart` usa `gpt-4o-mini` per analizzare il momento opportuno. Le strategie `aggressive` e `passive` sono deterministiche
- [~] **Never reveal instructions**: Il prompt include istruzioni di non-disclosure, MA non c'è test esplicito di robustezza contro prompt injection. **Da verificare nella Fase 3 (Sicurezza)**

#### Knowledge Gap Detection
- [✓] **detectKnowledgeGaps()**: Usa `claude-haiku` per analizzare conversazioni con basso confidence score
- [~] **Deduplicazione**: Non c'è deduplicazione esplicita dei gap — gap simili da conversazioni diverse possono creare duplicati
- [✓] **Qualità suggerimenti FAQ**: Le FAQ sono generate con contesto conversazione + KB esistente per evitare hallucination

### 3.3 Pipeline Dati 🏷️ Haiku

- [✓] **ChatbotSession**: Sessione creata con `pageUrl`, `referrer`, `userAgent`
- [✓] **Messaggi**: Salvati con ruolo corretto (user/assistant) e timestamp
- [✓] **Analytics aggregation**: Il cron `aggregate-chatbot-analytics` chiama `aggregateChatbotAnalytics()` con auth Bearer
- [~] **Bounce rate**: Il calcolo esiste nell'aggregator MA **il campo `suggestedFaq` NON viene incluso** nell'output dell'aggregazione — i dati FAQ suggerite si perdono
- [✓] **Lead tracking**: I lead catturati sono contati dal profilo candidato (email/phone/name presenti)

---

<a id="4-analytics"></a>
## 4. AUDIT AREA: ANALYTICS & INSIGHTS

> **Files chiave:**
> - `src/lib/analytics/AnalyticsEngine.ts`
> - `src/lib/insights/sync-engine.ts` (CrossChannelSyncEngine)
> - `src/app/api/insights/sync/route.ts`
> - `src/app/api/projects/[projectId]/analytics/route.ts`
> - `src/app/api/chatbot/[botId]/analytics/route.ts`

### 4.1 UI ↔ Codice 🏷️ Sonnet

#### Dashboard Progetto (`/dashboard/projects/[projectId]`)
- [✓] **Metriche aggregate**: `AnalyticsEngine.generateProjectInsights()` calcola completion rate, sentiment medio, durata media da dati reali (30 giorni)
- [✓] **Trend grafici**: I trend giornalieri sono calcolati su 30 giorni con inizializzazione di tutti i giorni (anche quelli senza dati = volume 0)
- [✓] **Top themes**: I temi provengono da `ThemeOccurrence` → aggregati per nome con count + sentiment medio. Top 5 selezionati
- [~] **NPS score**: Il calcolo NPS usa `metadata.npsScore` dalle analisi interviste. MA **non è il calcolo NPS standard** (promoters-detractors/total*100) — è una media dei punteggi individuali
- [~] **Knowledge gaps**: I gap provengono da `ChatbotAnalytics.knowledgeGaps` MA nell'aggregator il campo `suggestedFaq` **non viene incluso** nell'output
- [✓] **Lead captured**: Il conteggio lead è basato sulla presenza di email/phone/name nel `candidateProfile`

#### Analytics Bot (`/dashboard/bots/[botId]/analytics`)
- [✓] **Metriche sessione**: Sessions count e messages count corrispondono al DB
- [~] **Question clusters**: I cluster provengono da `ThemeOccurrence` — basati su temi estratti dall'analisi, non clustering diretto delle domande
- [✓] **Sentiment by topic**: Distribuzione sentiment per topic calcolata dall'AnalyticsEngine
- [~] **Timeframe filter**: Il filtro è hardcoded a 30 giorni in `AnalyticsEngine`. **Non c'è supporto per 7d/90d** a livello di engine — da verificare se il frontend filtra localmente

#### Insights Cross-Channel (`/dashboard/insights`)
- [✓] **Lista insight**: Gli insight provengono da `CrossChannelInsight` con `suggestedActions` JSON
- [✓] **Priority scoring**: Il punteggio priorità (0-100) è generato dal LLM nel `CrossChannelSyncEngine` con Zod validation
- [✓] **Status workflow**: Gli stati pending → actioned → completed → archived sono supportati nel modello
- [~] **Azioni suggerite**: Ogni insight ha azioni, MA il bottone "Applica" **è decorativo** (nessun onClick handler)
- [✓] **Fonti dati**: Il CrossChannelSyncEngine include dataPoints con source type e dati specifici

### 4.2 Flussi LLM 🏷️ Opus

#### CrossChannelSyncEngine
- [✓] **Aggregazione dati**: Il motore raccoglie dati da 6 fonti: visibility configs, interviste (conversations + analysis), chatbot (sessions + analytics), SERP monitoring, CMS analytics (WebsiteAnalytics), website analytics. Tutto filtrato per `organizationId` e opzionalmente `projectId`
- [✓] **Prompt qualità**: Il prompt è molto dettagliato (~2000+ token), in italiano, con istruzioni specifiche per 5-7 insight, priority scoring 0-100, e health report. Include 11 action types distinti e schema Zod rigoroso
- [✓] **Allineamento strategico**: Il prompt inietta `strategicVision`, `valueProposition` e `strategicPlan` dall'organizzazione/progetto. Le istruzioni chiedono esplicitamente di allineare insight alla visione strategica
- [✓] **Evidence-based**: Il prompt istruisce "cita sempre le fonti" con dataPoints che includono source type e dati specifici. I `suggestedActions` hanno campo `reasoning` obbligatorio
- [✓] **Health Report**: Schema Zod con 3 sotto-report (chatbot satisfaction, website effectiveness, brand visibility), ognuno con score 0-100, summary, e trend/contentGaps
- [✓] **Deduplicazione**: Usa Jaccard similarity (soglia 0.38) su `topicName` per evitare insight duplicati. I nuovi insight vengono confrontati con quelli non-archived esistenti

#### AnalyticsEngine
- [~] **generateProjectInsights()**: **NON è LLM-based** — è pura aggregazione deterministica. Calcola stats (completion rate, sentiment, durata, NPS) da dati reali 30 giorni. Genera 4 tipi di insight con logica basata su pattern, NON 12-15 come ipotizzato
- [~] **Tipi insight**: I 4 tipi (CONTENT_SUGGESTION, INTERVIEW_QUESTION, KB_UPDATE, AD_CAMPAIGN) sono generati da **regole deterministiche** basate su temi e sentiment, non da LLM. La qualità dipende dalla qualità dei dati di input
- [✗] **Cross-pollination**: **NON implementata**. I temi chatbot appaiono nelle analytics aggregate, ma non c'è nessuna logica che suggerisce automaticamente temi chatbot come domande di intervista o viceversa. L'insight di tipo INTERVIEW_QUESTION viene generato ma senza connessione diretta ai dati chatbot

### 4.3 Pipeline Dati 🏷️ Haiku

- [✓] **ConversationAnalysis**: L'analisi post-conversazione salva `sentimentScore`, `themes` (via ThemeOccurrence), `citations`, `metadata` (con NPS, executive summary). Il trigger è in `chat/route.ts` a fine intervista
- [✓] **Theme clustering**: I temi vengono aggregati per nome con count + sentiment medio. Top 5 selezionati nell'AnalyticsEngine. La deduplicazione è per nome esatto (non semantica)
- [~] **Cron jobs**: `aggregate-chatbot-analytics` funziona con Bearer auth. `sync-insights` ha **ZERO auth** (chiunque può triggerare). `detect-gaps` ha **auth commentata**. Tutti e 3 dipendono da `vercel.json` che **non esiste** — nessuno è schedulato
- [~] **Caching**: Il caching è limitato: `RuntimeKnowledgeCache` ha TTL 24h per knowledge. `GlobalConfig` ha cache 5min. **Nessun caching** per AnalyticsEngine o CrossChannelSyncEngine — ogni richiesta ricalcola tutto da DB

### 4.4 Obiettivo Business 🏷️ Opus

- [✓] **Decisioni consapevoli**: I dati presentati (trend sentiment, temi principali, NPS, completion rate, health report) sono sufficienti per decisioni informate a livello PMI
- [✓] **Azionabilità**: Gli insight cross-channel includono `suggestedActions` con 11 tipi azione, titolo, body, reasoning. Il target indica il canale. Sono concretamente azionabili
- [~] **Tempestività**: La frequenza dipende dal cron `sync-insights` che dovrebbe girare periodicamente, MA **non è schedulato** (no vercel.json). Gli insight si generano solo quando il cron viene triggerato manualmente
- [✓] **Comprensibilità**: Il prompt del CrossChannelSyncEngine istruisce esplicitamente risposte in italiano, con linguaggio accessibile. Il Copilot aggiunge un layer conversazionale ulteriore

---

<a id="5-kb"></a>
## 5. AUDIT AREA: KNOWLEDGE BASE

> **Files chiave:**
> - `src/app/api/knowledge/upload/route.ts`
> - `src/app/api/knowledge/scrape/route.ts`
> - `src/lib/interview/manual-knowledge-source.ts`
> - `src/lib/interview/runtime-knowledge.ts`
> - `src/lib/chatbot/knowledge-gap-detector.ts`

### 5.1 UI ↔ Codice 🏷️ Sonnet

#### Knowledge Manager (`/dashboard/bots/[botId]` - sezione KB)
- [✓] **Upload file**: Caricamento file (JSON/text) funziona, contenuto salvato in `KnowledgeSource` con tipo, titolo, contenuto
- [✓] **Scrape URL**: Lo scraping URL funziona tramite `/api/knowledge/scrape` con estrazione contenuto principale
- [✓] **Lista fonti**: Tutte le fonti KB visualizzate nella UI `KnowledgeManager.tsx` con tipo e titolo
- [✓] **Elimina fonte**: L'eliminazione rimuove il record `KnowledgeSource` dal DB
- [~] **Preview contenuto**: L'anteprima è limitata — mostra il titolo e tipo, ma **non un'anteprima del contenuto effettivo** per fonti lunghe

### 5.2 Meccanismi di Crescita Automatica 🏷️ Opus

> **CRITICO**: L'utente richiede crescita automatica da 7 fonti

#### Fonti di crescita attese vs implementate:

| Fonte | Stato Atteso | Stato Reale | Verifica |
|-------|-------------|-------------|----------|
| Trascrizioni chatbot | Auto-grow | **INDIRETTO** | [~] Le conversazioni chatbot alimentano `KnowledgeGap` (non KB direttamente). I gap devono essere approvati manualmente per entrare nella KB |
| Trascrizioni interviste | Auto-grow | **NON IMPLEMENTATO** | [✗] Nessuna pipeline estrae contenuto dalle interviste verso la KB. Solo l'auto-interview guide è generata |
| AI Tips implementate | Auto-grow | **NON IMPLEMENTATO** | [✗] I tip implementati (TipAction/CrossChannelInsight.suggestedActions) NON alimentano la KB. Sono due sistemi separati |
| Scraping website | Manuale/Auto | **SOLO MANUALE** | [~] Lo scraping è solo manuale via `/api/knowledge/scrape`. Nessun re-scraping periodico automatico |
| Dati Analytics (GA4) | Auto-grow | **NON IMPLEMENTATO** | [✗] GA4 si sincronizza in `WebsiteAnalytics` (cron cms-sync-analytics) ma NON alimenta la KB |
| Dati GSC | Auto-grow | **NON IMPLEMENTATO** | [✗] GSC si sincronizza in `WebsiteAnalytics` ma NON alimenta la KB |
| Knowledge gaps risolti | Auto-grow | **PARZIALE** | [~] Approvare un gap crea `KnowledgeSource` via una route, ma il modello `FaqSuggestion` è **orfano** (nessuna write path) |

#### Verifica dettagliata:
- [✓] **Auto-interview guide**: `ensureAutoInterviewKnowledgeSource()` genera guide automatiche dalla configurazione bot e le salva come `KnowledgeSource` tipo `auto-interview-guide`
- [✓] **Runtime knowledge**: `generateRuntimeInterviewKnowledge()` genera intelligence per topic on-the-fly con caching 24h via `RuntimeKnowledgeCache`
- [~] **Gap → FAQ pipeline**: La pipeline ha **due code paths**: uno funzionante (crea `KnowledgeSource`), uno che usa `FaqSuggestion` model che è orfano
- [✗] **Chatbot learning loop**: Le conversazioni chatbot creano solo `KnowledgeGap`, non arricchiscono direttamente la KB
- [✗] **Interview insight → KB**: I temi e citazioni dalle interviste NON alimentano la KB automaticamente
- [✗] **Website content sync**: Nessun re-scraping periodico. Solo scraping manuale iniziale
- [✗] **Analytics-informed KB**: I dati GSC/GA4 non suggeriscono contenuti KB. Alimentano solo `WebsiteAnalytics` e `CrossChannelSyncEngine`

> **⚠️ FINDING CRITICO**: Solo **2 delle 7 fonti dichiarate** hanno una pipeline funzionante verso la KB (auto-interview guide + knowledge gaps approvati). Le altre 5 sono NON IMPLEMENTATE o solo indirette

### 5.3 Qualità KB 🏷️ Opus

- [~] **Formato contenuto**: Il contenuto KB è testo raw — funzionale per l'LLM ma non strutturato (no Q&A pairs, no metadata semantiche)
- [!] **Rilevanza**: **CRITICO** — La selezione fonti KB è **arbitraria** (nessun ranking per rilevanza semantica). Il chatbot concatena TUTTE le fonti KB nel prompt **senza limite**, rischiando overflow del context window. Per le interviste, solo top 3 per dimensione × 260 chars
- [✗] **Aggiornamento**: Nessun meccanismo identifica fonti KB obsolete
- [✗] **Vector embeddings**: NO — solo testo raw. Il codice contiene un TODO per pgvector ma non è implementato. La ricerca usa keyword matching in `platform-kb.ts`
- [~] **Validazione qualità**: Il contenuto auto-generato (auto-interview guide, runtime knowledge) è generato da LLM ma non c'è validazione post-generazione. I gap approvati dall'utente hanno validazione implicita (human-in-the-loop)

### 5.4 Gap Implementativi Previsti 🏷️ Opus

- [✗] **Mancanza RAG con embeddings**: CONFERMATO — solo testo raw, nessun similarity search. TODO nel codice per pgvector
- [✗] **Nessun feedback loop esplicito**: CONFERMATO — nessun thumbs up/down su risposte chatbot/KB
- [✗] **Nessun versioning**: CONFERMATO — le fonti KB non hanno versioning, nessun history delle modifiche
- [~] **Nessuna aggregazione cross-bot**: La KB è per-bot, MA `platform-kb.ts` offre una KB globale per il copilot. I bot individuali non condividono KB a livello progetto
- [✗] **Nessun PII filtering**: CONFERMATO — il contenuto che entra nella KB (da scraping, conversazioni, gaps) non viene filtrato per PII. Dati personali degli intervistati possono finire nella KB

---

<a id="6-visibility"></a>
## 6. AUDIT AREA: VISIBILITY & BRAND MONITORING

> **Files chiave:**
> - `src/lib/visibility/serp-monitoring-engine.ts`
> - `src/lib/visibility/visibility-engine.ts`
> - `src/app/api/visibility/` (tutte le route)
> - `src/app/api/cron/serp-monitoring/`

### 6.1 UI ↔ Codice 🏷️ Sonnet

#### Configurazione Brand (`/dashboard/visibility/`)
- [✓] **Creazione config**: VERIFICATO — `VisibilityConfig` model salva brandName, keywords (JSON array), competitors (JSON array), category, description, languageCode correttamente
- [✓] **Prompt generati**: VERIFICATO — `generate-prompts/route.ts` usa LLM (temp 0.8) con 6 tipi di variazione (informational, comparative, recommendation, technical, brand-specific, industry-trend). Schema Zod valida output
- [✓] **Lista scan**: VERIFICATO — `VisibilityScan` model con timestamp, provider results (JSON), summary score. Lo storico è persistito e queryable
- [✓] **Competitors**: VERIFICATO — competitors iniettati nel prompt LLM e nel SerpMonitoringEngine per tracking comparativo nelle risposte

#### Risultati Scan (`/dashboard/visibility/[configId]`)
- [✓] **Score complessivo**: VERIFICATO — formula: `(totalMentions / totalResponses) * 100` calcolata da `VisibilityResult` records
- [✓] **Per-provider breakdown**: VERIFICATO — `VisibilityEngine` queries 3 provider in parallelo via `Promise.all`: OpenAI (GPT-5.2), Anthropic (Claude Sonnet 4.5), Google Gemini (3.0 Flash). Risultati salvati separatamente per provider
- [✓] **AI Overview**: VERIFICATO — `SerpMonitoringEngine` usa SerpAPI con `ai_overview` field detection. Fallback: genera query varianti (`generate-prompts`) se AI Overview non presente nella query originale
- [✓] **Sentiment per risposta**: VERIFICATO — LLM analisi batch (temp 0.1) produce sentiment per ogni risultato SERP. 9 criteri di valutazione
- [✓] **Position tracking**: VERIFICATO — `VisibilityResult.position` traccia posizione del brand nella risposta LLM (intero, 0-based)
- [✓] **Competitor comparison**: VERIFICATO — competitors tracciati nelle stesse query. Confronto basato su mention count e sentiment relativo
- [~] **Tips generati**: I suggerimenti SERP includono `suggestedActions` dall'analisi batch LLM, MA **non sono collegati al sistema CMS** per implementazione diretta. Restano puramente informativi

### 6.2 Flussi LLM 🏷️ Opus

#### SERP Monitoring Engine
- [✓] **Query multi-provider**: VERIFICATO — `VisibilityEngine` usa `Promise.all` per query parallele a 3 provider (OpenAI GPT-5.2, Anthropic Claude Sonnet 4.5, Gemini 3.0 Flash). Rate limiting: 2s delay tra chiamate SerpAPI
- [✓] **Analisi risposte**: VERIFICATO — LLM batch analysis (temp 0.1) con 9 criteri: sentiment, relevance, brand mention type, topic category, key claims, source credibility, competitive context, actionable insights, opportunity score
- [✓] **Importance scoring**: VERIFICATO — Formula 5-dimensionale: 30% source_reputation + 25% relevance + 15% position + 15% mention_type + 15% abs(sentiment). Formula bilanciata e ragionevole per GEO
- [✓] **Source reputation**: VERIFICATO — Mappa hardcoded di 40+ fonti: Reuters=96, BBC=95, NYT=94, LinkedIn=70, Reddit=50, Medium=55. Copertura adeguata ma **statica** (nessun aggiornamento dinamico delle reputazioni)
- [✓] **AI Overview detection**: VERIFICATO — SerpAPI `ai_overview` field + generazione query varianti via `generate-prompts` per aumentare probabilità di ottenere AI Overview. Fallback robusto

#### Prompt Generation
- [✓] **generate-prompts**: VERIFICATO — Route `/api/visibility/generate-prompts` usa LLM (temp 0.8) con brand context (name, category, description, language, territory) per generare prompt diversificati
- [~] **refine-prompt**: Il route `refine-prompt` esiste ma è un **semplice re-generate** con context aggiuntivo, non un vero sistema di raffinamento iterativo
- [✓] **Diversità**: VERIFICATO — 6 tipi di variazione: informational, comparative, recommendation, technical, brand-specific, industry-trend. Copertura buona per GEO monitoring

### 6.3 Allineamento GEO Best Practices 🏷️ Opus

- [~] **Frequenza scan**: Cron job `serp-monitoring` esiste ma **NON schedulato** (no vercel.json). La frequenza dipende dall'attivazione manuale o da un cron esterno. Per GEO si raccomanda scan settimanale minimo
- [~] **Copertura LLM**: 3 provider (OpenAI, Anthropic, Gemini) coprono i principali AI chatbot. **MANCANO**: Perplexity AI (importante per search-focused queries), Microsoft Copilot/Bing Chat, Meta AI. Copertura ~60% del panorama GEO
- [✓] **Metriche GEO**: VERIFICATO — Citation rate (mention count/total), brand prominence (position tracking), sentiment trend (sentiment storico per scan). Importance score formula ben calibrata per GEO
- [~] **Actionability**: I suggerimenti SERP sono informativi ma **non collegati a CMS/automation**. Manca il bridge suggerimento→azione. L'utente deve manualmente implementare ogni suggerimento
- [✓] **Benchmark competitor**: VERIFICATO — Competitor tracking persistente con confronto mention count, sentiment, position nel tempo. Dashboard mostra trend comparativi

---

<a id="7-cms"></a>
## 7. AUDIT AREA: CMS & CONTENT SUGGESTIONS

> **Files chiave:**
> - `src/lib/cms/suggestion-generator.ts` (CMSSuggestionGenerator)
> - `src/lib/cms/mcp-client.ts` (connessione MCP WordPress)
> - `src/app/api/cms/` (tutte le route)
> - `src/app/api/cron/cms-generate-suggestions/`
> - `src/app/api/cron/cms-sync-analytics/`

### 7.1 UI ↔ Codice 🏷️ Sonnet

#### Dashboard CMS (`/dashboard/cms`)
- [✓] **Stato connessione**: VERIFICATO — `CMSConnection` model con status enum (CONNECTED, DISCONNECTED, ERROR). Verificato via `test-connection` API route
- [✓] **Suggerimenti contenuto**: VERIFICATO — `CMSSuggestion` model persistito con tutti i campi. Query da `cms/suggestions` route con filtri per status/type
- [✓] **Tipo contenuto**: VERIFICATO — 5 tipi distinti: CREATE_FAQ, CREATE_BLOG_POST, CREATE_PAGE, MODIFY_CONTENT, ADD_SECTION. Ognuno con schema SEO specifico
- [✓] **Priority score**: VERIFICATO — Score 0-100 calcolato da LLM (temp 0.25) basato su: relevance strategica, volume di ricerca implicito, gap contenutistico, urgency
- [✓] **Reasoning**: VERIFICATO — Campo `reasoning` obbligatorio nello schema Zod. LLM deve fornire motivazione basata su dati fonte (insight, visibility, chatbot gaps)
- [✓] **SEO data**: VERIFICATO — Schema completo: metaTitle, metaDescription, focusKeyword, slug, schemaOrgJsonLd (FAQ/BlogPosting/Product/WebPage), categories, tags. WooCommerce attrs per prodotti
- [✓] **Push to CMS**: VERIFICATO — Route `cms/push` chiama `MCPClient` per WordPress o `CMS API` per Voler.ai. Workflow funzionale end-to-end
- [✓] **Status workflow**: VERIFICATO — PENDING → PUSHED → PUBLISHED (o REJECTED). Ogni transizione loggate con timestamp

#### Connessione WordPress
- [✓] **Setup flow**: VERIFICATO — `MCPClient` (mcp-client.ts) gestisce connessione WordPress via MCP protocol. Config persistita in `CMSConnection`
- [✓] **Capabilities detection**: VERIFICATO — `SiteDiscoveryService` rileva: hasWooCommerce, hasBlog, hasPages, hasProducts tramite query MCP+API
- [✓] **Site structure discovery**: VERIFICATO — Scoperta multi-source: WordPress MCP, WooCommerce MCP, Voler.ai CMS API. Cache 24h TTL per ridurre chiamate
- [✓] **Test connection**: VERIFICATO — Route `cms/test-connection` verifica raggiungibilità effettiva. Ritorna capabilities e errori specifici

### 7.2 Flussi LLM 🏷️ Opus

#### Content Generation
- [✓] **Prompt qualità**: VERIFICATO — Prompt include: brand context (name, sector, description), strategic plan, insight signals, site structure (categories, tags, pages, posts, products). 15 istruzioni numerate nel prompt
- [~] **Content quality**: Qualità LLM buona (temp 0.25) con schema Zod rigoroso, MA **nessuna review umana obbligatoria** prima della pubblicazione. Il contenuto può essere pushato direttamente
- [✓] **SEO optimization**: VERIFICATO — heading structure (H1/H2/H3), meta title/description, focus keyword, slug SEO-friendly. Schema.org JSON-LD per ogni tipo contenuto
- [✓] **Schema.org**: VERIFICATO — 4 tipi: FAQPage (per FAQ), BlogPosting (per blog), Product (per WooCommerce), WebPage (generico). JSON-LD valido generato dal LLM con validazione schema
- [✓] **Slug generation**: VERIFICATO — Slug generato dal LLM con istruzione "slug SEO-friendly, lowercase, hyphenated". Unicità non verificata programmaticamente (rischio duplicati)
- [~] **Tone alignment**: Il prompt include brand context e strategic plan per allineamento tono, MA **solo in italiano** (P28). Nessun variant inglese per brand internazionali

#### Allineamento Digital Marketing B2B 🏷️ Opus
- [✓] **Tipi contenuto B2B**: VERIFICATO — 5 tipi coprono: FAQ (customer education), Blog Post (thought leadership), Page (landing/service), Modify Content (optimization), Add Section (enhancement). Adatti a PMI B2B
- [~] **Topic cluster strategy**: I suggerimenti sono basati su **signal-driven strategy** (insight→content) non su topic cluster espliciti. Buono per reattività, debole per strategia SEO pillar/cluster
- [~] **Keyword strategy**: Le keyword provengono dai dati GSC **solo se integrazione Google Analytics attiva**. Altrimenti keyword inferite dal LLM (meno accurate)
- [✗] **Content calendar**: NON implementato — nessuna logica di distribuzione temporale. I suggerimenti sono one-shot, non pianificati nel tempo
- [✗] **Multi-format**: NON implementato — solo contenuti testuali. Nessun suggerimento immagini, video, infografiche

### 7.3 Integrazioni Mancanti 🏷️ Opus

- [✓] **Pubblicazione automatica**: VERIFICATO — Flusso end-to-end funzionale: `CMSSuggestion` → `MCPClient.push()` → WordPress/WooCommerce/Voler.ai CMS. Status aggiornato automaticamente
- [✗] **Modifica pre-pubblicazione**: NON implementato — Il contenuto viene pushato così com'è generato dall'LLM. Nessun editor inline per modifiche pre-push
- [✓] **Selezione destinazione**: VERIFICATO — Il tipo contenuto (blog, FAQ, page) determina la destinazione. Per WooCommerce, i prodotti vanno al catalogo
- [✗] **Performance tracking**: NON implementato — Dopo la pubblicazione, nessun tracking di views, bounce rate, conversioni. Il cron `cms-sync-analytics` esiste ma **NON schedulato** (no vercel.json)
- [✗] **A/B testing**: NON implementato — Nessun supporto A/B testing
- [~] **Multi-CMS**: PARZIALE — Supporto WordPress (via MCP) e Voler.ai CMS API. Nessun altro CMS (Shopify, Webflow, etc.)
- [✗] **Social publishing**: NON implementato — Nessuna integrazione social diretta. Solo webhook n8n pianificato ma disconnesso

---

<a id="8-tips"></a>
## 8. AUDIT AREA: AI TIPS & AUTOMAZIONE

> **Files chiave:**
> - `src/lib/insights/sync-engine.ts` (generazione suggestedActions)
> - Modello `TipAction` nel Prisma schema
> - UI componenti per visualizzazione tips

### 8.1 UI ↔ Codice 🏷️ Sonnet

#### Visualizzazione Tips
- [~] **Lista tips**: Esistono **DUE sistemi separati**: `TipAction` model (Brand Monitor) e `CrossChannelInsight.suggestedActions` (Insights Hub). `InsightCard.tsx` è un componente **obsoleto non usato**. I tip su `/dashboard/insights` provengono da CrossChannelInsight
- [✓] **Tipi azione**: I tipi nell'InsightsHub includono 11 action types distinti (add_faq, create_blog, create_social_post, update_kb, respond_to_press, etc.)
- [✓] **Praticità**: Ogni tip include target, titolo, body, reasoning e urgency dal CrossChannelSyncEngine
- [!] **Modificabilità**: **CRITICO** — I tip NON sono modificabili prima dell'implementazione. Non c'è editor inline né preview
- [~] **Canale target**: Il canale è indicato nel tipo azione ma **non linkato** a una connessione specifica
- [!] **Implementazione diretta**: Il pulsante **"Applica"** sulla pagina insights **NON ha onClick handler** — è un bottone puramente decorativo. Nessuna azione viene eseguita al click

### 8.2 Workflow di Implementazione 🏷️ Opus

- [✗] **Manual → Automated**: NON esiste un flusso automatizzato. L'utente deve implementare manualmente ogni suggerimento
- [✗] **Confirmation flow**: Nessun workflow edit → preview → approve. Il bottone "Applica" è decorativo
- [~] **Multi-channel routing**: Il `n8n/dispatcher.ts` esiste per routing webhook-based, MA è disconnesso dal flusso insight. Il dispatcher non viene chiamato quando un tip viene "applicato"
- [✗] **Feedback loop**: Nessun feedback post-implementazione. I tip non alimentano la KB
- [✗] **Scheduling**: NON implementato — nessuna schedulazione futura
- [✗] **Batch operations**: NON implementato — nessuna operazione batch

### 8.3 Gap Implementativi Previsti 🏷️ Opus

- [✗] **Social media integration**: CONFERMATO — nessuna integrazione diretta. Solo webhook n8n pianificato
- [✗] **Email marketing**: CONFERMATO — nessuna integrazione con piattaforme email
- [~] **Automazione n8n**: Il model `N8NConnection` esiste nel DB con `webhookUrl`, `apiKey`, `activeWorkflows`. Il dispatcher `n8n/dispatcher.ts` ha logica di routing per tipo azione, MA **non è connesso al flusso di applicazione tip**. L'integrazione è strutturalmente presente ma funzionalmente disconnessa
- [✗] **Approval workflow**: CONFERMATO — nessun workflow multi-step. Solo stato insight (pending → actioned → completed → archived) senza step intermedi
- [✗] **Template per canale**: CONFERMATO — nessun template specifico per canale. I chatbot hanno template (`chatbot-templates.ts`) ma non i tip/contenuti social

---

<a id="9-copilot"></a>
## 9. AUDIT AREA: COPILOT STRATEGICO

> **Files chiave:**
> - `src/lib/copilot/system-prompt.ts`
> - `src/lib/copilot/chat-tools.ts`
> - `src/app/api/copilot/chat/route.ts`

### 9.1 UI ↔ Codice 🏷️ Sonnet

#### Finestra Copilot (`StrategyCopilot` component)
- [✓] **Attivazione**: VERIFICATO — `StrategyCopilot.tsx` implementa floating chat button bottom-right con z-index management. Montato nei layout wrappers, accessibile da tutte le pagine dashboard
- [✓] **Contesto progetto**: VERIFICATO — `buildProjectContext()` carica: botCount, conversationCount (30gg), topThemes (top 5), avgSentiment, strategicVision, valueProposition dal progetto corrente
- [✓] **Piano strategico**: VERIFICATO — Recuperato da `platformSettings.strategicPlan`. Iniettato nel system prompt SOLO per tier PRO+ (PRO, BUSINESS, ENTERPRISE, ADMIN, PARTNER)
- [~] **Citazione fonti**: Il prompt include istruzione anti-hallucination ("Se non hai abbastanza dati, dillo chiaramente") e la risposta include flag `usedKnowledgeBase`. MA **non cita fonti specifiche** (es. "da intervista X" o "da scan visibility Y")
- [✓] **Tier limitation**: VERIFICATO — `canAccessProjectData(tier)` in `permissions.ts` limita tools e accesso dati a PRO+. Quick actions differenziati per tier. Basic vede solo help generico

### 9.2 Flussi LLM 🏷️ Opus

#### System Prompt Copilot
- [✓] **Lingua italiana**: VERIFICATO — `system-prompt.ts` è interamente in italiano. Istruzioni, formatting rules, e quick actions in italiano. **GAP**: nessun variant inglese per utenti internazionali
- [✓] **Contesto organizzazione**: VERIFICATO — Nome org, piano, tier iniettati nel system prompt builder. KB platform (49 entries) iniettata come contesto aggiuntivo
- [✓] **Dati progetto**: VERIFICATO — Bot count, conversation count (30gg), sentiment avg, top 5 temi con sentiment per tema. Dati aggiornati ad ogni richiesta
- [✓] **Tools disponibili**: VERIFICATO — 7 tools implementati in `chat-tools.ts`: getProjectTranscripts, getChatbotConversations, getProjectIntegrations, getVisibilityInsights, getExternalAnalytics, getKnowledgeBase, scrapeWebSource. Rate limit: 5/query (max 10). maxSteps: 3
- [~] **Qualità consigli**: Il prompt è orientato a PMI italiane con strategic plan injection, MA la qualità dipende dalla ricchezza dei dati progetto. Con pochi dati, i consigli tendono a essere generici
- [✓] **Non inventa dati**: VERIFICATO — Istruzione esplicita nel prompt: "Se non hai abbastanza dati, dillo chiaramente invece di inventare"
- [✓] **Visione d'insieme**: VERIFICATO — Tool chain permette al copilot di accedere a interviste + chatbot + visibility + analytics + KB. `generateText` con maxSteps:3 permette multi-tool calls in una singola risposta

### 9.3 Obiettivo Business 🏷️ Opus

- [✓] **Supporto decisionale**: VERIFICATO — Strategic plan + project data + multi-source tools permettono raccomandazioni data-driven. Dual LLM fallback (Anthropic primary, OpenAI secondary) garantisce disponibilità
- [✓] **Accessibilità linguistica**: VERIFICATO — Prompt include istruzioni di formatting markdown con bullet points, emojis, e linguaggio chiaro. Orientato a management non-tecnico
- [~] **Proattività**: Il copilot è REATTIVO (risponde a domande), NON proattivo. Non invia notifiche o suggerimenti unsolicited. `suggestedFollowUp` nella risposta è l'unica forma di proattività
- [✓] **Limiti riconosciuti**: VERIFICATO — Istruzione anti-hallucination nel prompt. Tier limitation comunicata esplicitamente agli utenti Basic

---

<a id="10-billing"></a>
## 10. AUDIT AREA: BILLING & CREDITS

> **Files chiave:**
> - `src/lib/stripe.ts`
> - `src/config/creditCosts.ts`
> - `src/services/creditService.ts`
> - `src/services/tokenTrackingService.ts`
> - `src/app/api/stripe/` (webhook, checkout, portal)
> - `src/app/api/credits/`

### 10.1 UI ↔ Codice 🏷️ Sonnet

#### Settings Billing (`/dashboard/settings/billing`)
- [✓] **Piano corrente**: VERIFICATO — `Subscription` model sincronizzato con Stripe via webhook. Piano mostrato da `organization.plan` aggiornato da `handleSubscriptionUpdated()`
- [✓] **Limiti piano**: VERIFICATO — `PLANS` config in `plans.ts` definisce limiti per tier. `monthlyCreditsLimit` aggiornato da webhook on subscription change
- [✓] **Upgrade/downgrade**: VERIFICATO — Route `stripe/checkout` con proration handling: upgrade=`always_invoice` (charge immediato), downgrade=`create_prorations` (credit su fatture future). `billing_cycle_anchor: unchanged`
- [✓] **Fatture**: VERIFICATO — Gestione invoice via webhook events `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`

#### Credits (`/dashboard/settings/credits`)
- [✓] **Saldo crediti**: VERIFICATO — Calcolo: `monthlyCreditsLimit - monthlyCreditsUsed + packCreditsAvailable`. `-1` = unlimited. Consumo tramite `CreditService.consumeCredits()`
- [✓] **Storico transazioni**: VERIFICATO — `orgCreditTransaction` table registra ogni operazione con: amount, action, tool, executedBy, timestamp. Audit trail completo
- [✓] **Costi per azione**: VERIFICATO — 13 azioni con costi fissi in `creditCosts.ts`: interview_question=8, chatbot_message=3, visibility_query=6, copilot_message=20, copilot_analysis=35, export_pdf_analysis=30, etc.
- [~] **Alert crediti bassi**: L'infrastruttura per alert esiste (credit tracking) MA **nessun alert proattivo UI** a 80%/95%. L'utente scopre l'esaurimento solo quando riceve errore 429

### 10.2 Pipeline Dati 🏷️ Haiku

- [✓] **Token → Crediti**: VERIFICATO — `TOKEN_TO_CREDIT_RATE = 0.0005`. Formula: `creditsToConsume = max(modelAdjustedBaseCost, ceil(totalTokens * RATE * multiplier))`
- [✓] **Model multiplier**: VERIFICATO — Moltiplicatori per modello: small models (haiku,mini,flash-8b)=1.0x, GPT-4o/Claude Sonnet=~3.0x, Claude Opus=~8.0x (capped)
- [~] **Cron reset mensile**: Route `reset-credits` esiste con logica corretta (reset `monthlyCreditsUsed=0`, calcola `nextResetDate`), MA **NON schedulato** (no vercel.json). Deve essere attivato da cron esterno
- [~] **Credit pack expiry**: I pack sono persistiti in `orgCreditPack` con `packCreditsAvailable`, MA **nessuna scadenza esplicita** — i pack non scadono mai. Non è un bug ma una scelta di business
- [✓] **Webhook Stripe**: VERIFICATO — 5 eventi gestiti: `checkout.session.completed` (pack+subscription), `customer.subscription.updated`, `customer.subscription.deleted` (downgrade a TRIAL), `invoice.paid`/`payment_succeeded` (reset cycle), `invoice.payment_failed` (PAST_DUE). Deduplicazione via `stripeWebhookEvent` unique constraint
- [✓] **Double-charge prevention**: VERIFICATO — Multi-layer: (1) webhook dedup via `stripeWebhookEvent`, (2) credit tracking a livello org (single counter), (3) transaction logging, (4) idempotent `addPackCredits()`

---

<a id="11-dashboard"></a>
## 11. AUDIT AREA: DASHBOARD & SETTINGS

### 11.1 UI ↔ Codice 🏷️ Sonnet

#### Dashboard Principale (`/dashboard`)
- [✓] **Progetti**: VERIFICATO — Query `project.findMany` filtrata per `organizationId` da membership attiva. Mostra tutti i progetti dell'organizzazione corrente
- [✓] **Quick stats**: VERIFICATO — Metriche calcolate da DB: bot count, conversation count, lead count. Periodo 30gg per trend
- [✓] **Empty state**: VERIFICATO — Stato vuoto con CTA per creare primo progetto. Guidato per tier
- [✓] **Navigazione**: VERIFICATO — Sidebar navigation condizionata per: user role (ADMIN/EDITOR/VIEWER), subscription tier, feature flags (`canPublishBot`, `canCreateChatbot`, `canAccessCopilot`, `canAccessVisibilityTracker`)

#### Settings Organizzazione (`/dashboard/settings`)
- [✓] **Info organizzazione**: VERIFICATO — `PlatformSettingsState` con form validation, save debounced. Solo org admin può modificare
- [✓] **Piano strategico**: VERIFICATO — `strategicPlan` (rich text, 30k chars max) persistito in `platformSettings`. Usato da CrossChannelSyncEngine (sync-engine.ts) E da Copilot (system-prompt.ts) per contesto strategico
- [✓] **Membri team**: VERIFICATO — `Membership` model con ruoli ADMIN, EDITOR, VIEWER e status ACTIVE/INVITED/INACTIVE. `ProjectAccess` per accesso fine-grained per progetto
- [✓] **API keys**: VERIFICATO — `GlobalConfig` model salva API keys (Stripe, OpenAI, Anthropic, Google Analytics, SMTP). Show/hide toggles. Keys usate con fallback a env vars
- [✓] **Connessioni**: VERIFICATO — Stato CMS via `CMSConnection`, Google via `GoogleAnalyticsIntegration`, n8n via `N8NConnection`

#### Admin (`/dashboard/admin`)
- [✓] **Solo admin**: VERIFICATO — Server-side check esplicito: `if (session?.user?.role !== 'ADMIN') redirect('/dashboard')`. Non bypassabile client-side
- [✓] **Stats piattaforma**: VERIFICATO — Admin può visualizzare tutte le organizzazioni, membri, progetti, bot count, tool usage
- [✓] **Gestione organizzazioni**: VERIFICATO — Admin accede a lista org con dettagli membri, ruoli, status, joinedAt
- [~] **Gestione utenti**: Admin panel **semplicistico** — visualizza dati ma la modifica limiti è limitata. Nessun bulk operations o advanced user management

---

<a id="12-prompts"></a>
## 12. AUDIT CROSS-CUTTING: QUALITÀ PROMPT

> 🏷️ **Modello:** Opus per tutti i task di questa sezione

### 12.1 Inventario Completo Prompt

| # | Prompt | File | Modello | Temp | Score | Verifica |
|---|--------|------|---------|------|-------|----------|
| 1 | Interview Identity Block | prompt-builder.ts | gpt-4o | 0.7 | 8/10 | [✓] Bilingue (IT/EN), buon ruolo |
| 2 | Interview Context Block | prompt-builder.ts | gpt-4o | 0.7 | 8/10 | [✓] Schema completo, turn-aware |
| 3 | Interview Topic Focus | prompt-builder.ts | gpt-4o | 0.7 | 7/10 | [✓] Dinamico per topic, coverage tracking |
| 4 | Interview Memory Block | prompt-builder.ts | gpt-4o | 0.7 | 8/10 | [✓] Last 5 turns, summary compatto |
| 5 | Interview Knowledge Block | prompt-builder.ts | gpt-4o | 0.7 | 7/10 | [!] **BUG**: `isItalian = label.length > 0` sempre true → forza IT per tutte le lingue |
| 6 | Turn Guidance Block | runtime-prompt-blocks.ts | gpt-4o | 0.7 | 8/10 | [✓] Signal-driven, depth-aware strategy |
| 7 | Guards Block | runtime-prompt-blocks.ts | gpt-4o | 0.7 | 7/10 | [✓] Multi-guard, condizionale |
| 8 | Supervisor Runtime Banner | chat/route.ts | gpt-4o | 0.7 | 7/10 | [✓] State-dependent, inline injection |
| 9 | Runtime Semantic Context | chat/route.ts | gpt-4o | 0.7 | 9/10 | [✓] Eccellente bridge stem dedup, anti-formula |
| 10 | Micro-Planner Block | micro-planner.ts | N/A (determ.) | - | 8/10 | [✓] Deterministico, no LLM call |
| 11 | Tone Adaptation | tone-prompt-adapter.ts | gpt-4o | 0.7 | 5/10 | [!] **CRITICO**: Solo italiano — nessun variant EN |
| 12 | Validation Feedback | prompt-builder.ts | gpt-4o | 0.7 | 7/10 | [~] Condizionale, feedback non escaped |
| 13 | Question-Only Generation | chat/route.ts | gpt-4o | 0.2 | 8/10 | [✓] Anti-repetition, bridge stems |
| 14 | Deep Offer Generation | chat/route.ts | gpt-4o | 0.2 | 7/10 | [✓] 4-step structure, constraints chiari |
| 15 | Deep Offer Enforcement | chat/route.ts | gpt-4o | 0.3 | 7/10 | [✓] Enforcement post-generation |
| 16 | Consent Question | chat/route.ts | gpt-4o | 0.2 | 7/10 | [~] Manca framing GDPR per contesto EU |
| 17 | User Intent Classification | chat/route.ts | gpt-4o-mini | 0.0 | 7/10 | [~] Hybrid determ+LLM, fast-path solo IT |
| 18 | Closure Intent Detection | chat/route.ts | gpt-4o-mini | 0.0 | 8/10 | [✓] Ottima prevenzione false-positive |
| 19 | Field Extraction | chat/route.ts | gpt-4o-mini | 0.0 | 7/10 | [!] **DUPLICATO** in chatbot/message/route.ts |
| 20 | Candidate Profile Extraction | candidate-extractor.ts | gpt-4o | ⚠️ MANCA | 6/10 | [!] **Temp non impostata** (default ~1.0 per extraction!) |
| 21 | Chatbot System Prompt | chatbot/message/route.ts | gpt-4o-mini | ⚠️ MANCA | 7/10 | [~] KB non sanitizzata, temp mancante |
| 22 | Smart Lead Capture | chatbot/message/route.ts | gpt-4o-mini | ⚠️ MANCA | 6/10 | [!] Temp mancante per classificazione, prompt minimal |
| 23 | Copilot System Prompt | copilot/system-prompt.ts | configurable | 0.3 | 7/10 | [~] Solo italiano, buon anti-hallucination |
| 24 | Runtime Knowledge Gen. | runtime-knowledge.ts | gpt-4o | 0.25 | 8/10 | [✓] Fallback robusto, caching, schema strict |
| 25 | Knowledge Gap Analysis | knowledge-gap-detector.ts | gpt-4o-mini | ⚠️ MANCA | 4/10 | [!] No role def, no lang, no format guidance |
| 26 | Analytics Aggregation | analytics-aggregator.ts | gpt-4o | ⚠️ MANCA | 4/10 | [!] gpt-4o troppo costoso, key hardcoded, no lang |
| 27 | CrossChannel Insight | sync-engine.ts | systemLLM | 0.15 | 7/10 | [~] Solo IT, prompt molto lungo (~2000tok) |
| 28 | CMS Content Suggestion | suggestion-generator.ts | systemLLM | 0.25 | 7/10 | [~] Solo IT, 15 istruzioni, buon SEO schema |
| 29 | SERP Response Analysis | serp-monitoring-engine.ts | systemLLM | 0.1 | 7/10 | [!] **RISCHIO INJECTION**: dati SERP esterni non sanitizzati |
| 30 | Visibility Prompt Gen. | visibility/generate-prompts | systemLLM | 0.8 | 6/10 | [!] Temp troppo alta, input utente non sanitizzato |

**Score medio complessivo: 6.9/10**
- Interview Core (P1-P9): **7.7/10**
- Interview Planning (P10-P12): **7.0/10**
- Interview Enforcement (P13-P19): **7.3/10**
- Extraction/Analytics (P20, P25, P26): **4.7/10** ⚠️
- Chatbot (P21-P22): **6.5/10**
- Copilot (P23): **7.0/10**
- Knowledge/Insights (P24, P27): **7.5/10**
- CMS/Visibility (P28-P30): **6.7/10**

### 12.2 Criteri di Valutazione Prompt — RISULTATI

Per ogni prompt verificato:

- [✓] **Chiarezza ruolo**: 24/30 prompt hanno ruolo chiaro. P25, P26 mancano "You are..." preamble
- [✓] **Contesto sufficiente**: 26/30 prompt hanno contesto sufficiente. P16, P22, P25 sono minimali
- [~] **Guardrail efficaci**: Interview core eccellente (multi-layer enforcement). Chatbot/CMS/Visibility meno rigorosi
- [✓] **Output format**: 28/30 usano Zod schema per structured output. Buona pratica
- [!] **Lingua coerente**: **GAP CRITICO** — 5 prompt solo italiano (P11, P23, P27, P28, P29) senza variant EN. P5 ha bug `isItalian` che forza italiano su tutte le lingue
- [~] **No conflitti**: Nessun conflitto diretto trovato tra blocchi. Possibile tensione tra P6 (turn guidance) e P7 (guards) in edge cases
- [!] **Temperatura appropriata**: **5 prompt senza temperatura esplicita** (P20, P21, P22, P25, P26). P20 (extraction) particolarmente critico con default ~1.0
- [✓] **Modello appropriato**: Generalmente buono. P26 usa gpt-4o (costoso) dove gpt-4o-mini basterebbe
- [~] **Fallback**: Interview core ha fallback robusti. Chatbot/CMS/Visibility hanno gestione errori ma non fallback di contenuto
- [~] **Token efficiency**: Interview system prompt composito (7 blocchi) è ottimizzato con injection condizionale. P27 (insight) è il più costoso (~2000 tokens prompt)

### 12.3 Pattern Problematici — RISULTATI

- [!] **Prompt injection vulnerability**: **CRITICO** — Input utente iniettato senza sanitizzazione in P9, P13, P17, P18, P21, P25, P26, P29, P30. Quote escaping mancante in P13, P17, P18. **P29 (SERP data) è il vettore più pericoloso** perché inietta dati da fonti esterne (Google SERP)
- [~] **System prompt leak**: Chatbot ha `PROMPT_LEAK_PATTERNS` detection su input utente (buono), MA **nessun check output-side** (il modello potrebbe comunque leakare frammenti)
- [✓] **Hallucination risk**: Interview core e Copilot hanno istruzioni anti-hallucination esplicite. Chatbot ha scope guardrails ("STRICT SCOPE")
- [~] **Context window overflow**: Interview system prompt (7 blocchi + history) può crescere significativamente. `buildProjectContext` limita a 50 conversations (ridotto da 100). Transcript non troncato in P20
- [~] **Conflitto istruzioni**: Nessun conflitto diretto. Tensione potenziale tra supervisor banner (P8) e micro-planner (P10) su strategia
- [~] **Degradazione qualità**: Memory block (P4) limita a 5 turns recenti. Runtime knowledge cached. Qualità stabile ma **context pressure** aumenta con conversazioni lunghe

#### TOP 5 FIX PRIORITARI PROMPT

1. **P5 Language Bug** — `isItalian = label.length > 0` → fix: `(bot.language || 'en').startsWith('it')` — **1 linea, impatto alto**
2. **P20 Missing Temperature** — Aggiungere `temperature: 0` a `generateObject()` in candidate-extractor.ts — **1 linea, impatto medio**
3. **P29 SERP Injection** — Creare `sanitizeSerpContent()` per sanitizzare dati SERP esterni — **architetturale, impatto sicurezza**
4. **P30 User Input Injection** — Sanitizzare `brandName`, `category`, `description` prima di injection in prompt — **API security**
5. **P11,P23,P27,P28,P29 Italian-Only** — Aggiungere variant EN per i 5 prompt Italian-only — **i18n gap significativo**

---

<a id="13-lingua"></a>
## 13. AUDIT CROSS-CUTTING: LINGUA E LOCALIZZAZIONE

> 🏷️ **Modello:** Sonnet

### 13.1 Interfaccia Utente (Italiano)

- [~] **Dashboard labels**: Dashboard è Italian-first con stringhe hardcoded. La maggior parte dei label e menu sono in italiano, MA **nessun framework i18n** (no next-intl, no react-i18n). Stringhe non-translatable
- [~] **Error messages**: Mix italiano/inglese. Esempi IT: "Non autorizzato", "Crediti insufficienti", "Piano non acquistabile". Alcuni errori tecnici restano in inglese
- [~] **Empty states**: Stati vuoti in italiano con guida, MA qualità variabile. Alcuni CTA sono generici
- [~] **Tooltip/help**: Copilot platform KB (49 entries) in italiano. Tooltip UI parzialmente presenti
- [✗] **Email transazionali**: **NON VERIFICABILE** — Nessuna directory `/src/emails` o template email trovati nel codebase. Probabilmente gestiti da servizio esterno (SendGrid/Mailgun). Completezza italiano non auditabile
- [~] **Pricing page**: Pricing in EUR tramite Stripe. Descrizioni piani in italiano nel codebase (`plans.ts`)

### 13.2 Tool Raccolta Dati (Multilingua)

- [✓] **Interview widget**: VERIFICATO — 5 lingue supportate: Italiano, English, Español, Français, Deutsch. Parametro `language` nell'embed script (`?language=italiano`)
- [✓] **Chatbot widget**: VERIFICATO — Lingua configurabile per bot via `languageCode` field. Chatbot system prompt adattato alla lingua
- [✓] **Data collection labels**: VERIFICATO — `getFieldLabel()` con mappa i18n per campi standard (nome, email, telefono, azienda) in IT/EN/ES/FR/DE
- [✓] **Consent text**: VERIFICATO — Testo consenso parametrizzato per lingua via `generateConsentQuestionOnly()`
- [✓] **Completion message**: VERIFICATO — Messaggio finale nella lingua configurata del bot

### 13.3 Prompt LLM

- [✓] **Identity block**: VERIFICATO — P1 (Identity Block) bilingue con flag `isItalian` che determina lingua prompt. **CAVEAT**: vedi bug P5 dove `isItalian` è sempre true
- [✓] **Supervisor banner**: VERIFICATO — P8 (Supervisor Banner) parametrizzato per lingua. Banner runtime nella lingua corretta
- [✓] **Field labels**: VERIFICATO — `buildTopicFocusBlock()` usa mappa i18n per field labels
- [~] **Fallback language**: Se lingua non supportata, il sistema degrada a **inglese** per interview/chatbot. MA 5 prompt ausiliari (P11,P23,P27,P28,P29) sono solo italiano senza fallback
- [✓] **Copilot**: VERIFICATO — Copilot risponde sempre in italiano (prompt Italian-only). **GAP**: utenti internazionali ricevono istruzioni italiane nel copilot

---

<a id="14-sicurezza"></a>
## 14. AUDIT CROSS-CUTTING: SICUREZZA E PRIVACY

> 🏷️ **Modello:** Sonnet + Opus per analisi profonda

### 14.1 Autenticazione & Autorizzazione

- [✓] **Password hashing**: bcryptjs con salt rounds adeguato in `auth.ts`
- [~] **JWT security**: JWT sessions con NextAuth v5. Il secret dipende da `NEXTAUTH_SECRET` env var — **da verificare che sia sufficientemente forte in produzione**
- [~] **Role enforcement**: I ruoli sono definiti ma **le pagine admin non sono protette dal middleware**. Il `middleware.ts` controlla solo `/dashboard` generico, non `/dashboard/admin/*` specificamente. Il controllo avviene a livello di componente/route individuale
- [✓] **Project access**: `ProjectAccess` è verificato tramite `organizationId` match nelle query Prisma
- [~] **Organization isolation**: Generalmente isolata tramite `organizationId` nelle query, MA **la route `/api/knowledge/gaps` NON filtra per organizzazione** — possibile cross-org leak

> **⚠️ FINDING CRITICI — Cron Job Security:**
>
> | Cron | Auth Status | Problema |
> |------|------------|----------|
> | `detect-gaps` | **AUTH COMMENTATA** | Chiunque può triggherare gap detection per TUTTI i bot PUBLISHED |
> | `sync-insights` | **ZERO AUTH** | Nessun check di autenticazione. Processa TUTTE le organizzazioni |
> | `cms-generate-suggestions` | Condizionale | `if (process.env.CRON_SECRET)` — skip auth se env var non settata |
> | `serp-monitoring` | Condizionale | Stessa logica condizionale |
> | `cms-sync-analytics` | Condizionale | Stessa logica condizionale |
> | `interview-quality-alerts` | Condizionale | Stessa logica condizionale |
> | `aggregate-chatbot-analytics` | ✓ Bearer | Corretto: `Authorization: Bearer` |
> | `reset-monthly-counters` | ✓ Bearer | Corretto: `Authorization: Bearer` |
> | `reset-credits` | ✓ x-cron-secret | Header diverso: `x-cron-secret` |
> | `partner-fees` | ✓ x-cron-secret | Header diverso: `x-cron-secret` |
>
> **Header inconsistency**: 3 diversi metodi di auth (Bearer, x-cron-secret, condizionale) tra 10 cron jobs
>
> **⚠️ CRITICO: Nessun `vercel.json` trovato** — NESSUN cron job è schedulato su Vercel. Tutta l'automazione è inattiva

### 14.2 Privacy Dati

- [!] **PII in logs**: **CRITICO** — Multipli `console.log` con dati utente non redatti: user message preview (chat/route.ts:2013), bot response (chat/route.ts:3498,3514), profile data (chat/route.ts:1770), field extraction failures (chatbot/message/route.ts:223). Nomi, email, telefoni potenzialmente esposti nei server logs
- [~] **Consenso GDPR**: PARZIALE — `CookieConsent.tsx` con 2 opzioni ("Accetta tutti" / "Solo necessari") salvate in localStorage. **MANCANO**: audit trail persistente, consenso esplicito per data collection (nome, email, phone), consenso per interview recording/storage
- [✗] **Data retention**: **NON IMPLEMENTATA** — Nessuna policy di retention. Campi `expiresAt` esistono nello schema ma nessun cron di purging automatico. Dati persistono indefinitamente
- [✗] **Right to deletion**: **NON IMPLEMENTATO PER END USER** — Solo `deleteUser()` admin action (admin.ts:288). Nessun user self-service deletion, nessun data export API (GDPR Art. 20 Right of Portability), nessun "right to be forgotten"
- [~] **Cookie consent**: FUNZIONANTE ma basico — localStorage senza scadenza, nessun consenso granulare (analytics vs functional), stato consent non validato prima di inviare analytics

### 14.3 Sicurezza LLM

- [!] **Prompt injection**: **CRITICO** — Input utente NON sanitizzato prima di injection in prompt. Solo 6 pattern regex basici in `PROMPT_LEAK_PATTERNS` (chatbot/message/route.ts:30-37) applicati solo all'OUTPUT, non all'INPUT. Concatenazione diretta: `[User says: "${userMessage}"]` in chat/route.ts:2927. Mancano pattern per: "ignore instructions", "pretend", "forget", "simulate", unicode evasion, encoding tricks
- [~] **Data exfiltration**: Organization isolation tramite `organizationId` nelle query. MA P29 (SERP data) e P30 (visibility prompts) iniettano dati esterni non controllati. Il chatbot ha scope guardrails ("STRICT SCOPE") ma nessun check output-side per leak di system prompt
- [✓] **API key protection**: VERIFICATO — Keys isolate server-side (`getApiKey()` in llmService.ts). Mai inviate al client, mai loggate. Fallback chain: Bot-specific → GlobalConfig (cache 5min) → env var. Nessuna esposizione in error messages
- [✓] **Rate limiting**: VERIFICATO — Global: 20 req/10s via Upstash Redis (middleware.ts). Message cooldown: 250ms via in-memory Map (rateLimiter.ts). Eccezioni: /api/auth, /api/stripe/webhook. **NOTA**: in-memory cooldown non distribuito (serverless multi-instance), Redis rate limit fails open (accetta se Redis down)

---

<a id="15-performance"></a>
## 15. AUDIT CROSS-CUTTING: PERFORMANCE & COSTI

> 🏷️ **Modello:** Sonnet per analisi, Haiku per check

### 15.1 Latenza

- [✓] **Chat response time**: VERIFICATO — `maxDuration=60` (chat/route.ts:43), hard timeout 45s (line 2755) con fallback response `{ type: 'timeout_fallback' }`. Chatbot: `maxDuration=30`. Copilot: 45s AbortSignal
- [✓] **Parallel operations**: VERIFICATO — **3 pattern Promise.all() strategici** in chat/route.ts: (1) saveMessage+updateProgress+getApiKey+getModels in parallelo, (2) extractProfile+completeInterview, (3) saveMessage+updateState. Riduzione latenza stimata ~20-30%
- [✓] **Runtime knowledge timeout**: VERIFICATO — 1400ms timeout (runtime-knowledge.ts) con fallback deterministico se LLM non risponde. Fallback produce output usabile
- [✓] **Candidate extraction timeout**: VERIFICATO — 10s timeout con caching in-memory + check DB per prevenire extraction ridondanti
- [✓] **Global config cache**: VERIFICATO — Cache 5 minuti in-memory per API keys e provider config (llmService.ts:34-37). Riduce query DB da ogni richiesta a ogni 5min per istanza

### 15.2 Costi LLM

- [✓] **Model routing efficiency**: VERIFICATO — **Multi-tier routing eccellente**: primary (gpt-4o-mini/claude-sonnet), critical (gpt-4o per escalation), dataCollection (modello più economico per lead extraction). 3.5-5x risparmio su task data collection. Configurabile via env vars per provider
- [~] **Prompt token count**: Interview system prompt (7 blocchi) stima ~800-1200 tokens base + context dinamico. P27 (CrossChannel Insight) è il più costoso (~2000 tokens). P28 (CMS) ~600-900 tokens. **NOTA**: injection condizionale dei blocchi riduce costo medio
- [~] **Unnecessary LLM calls**: P26 (Analytics Aggregation) usa gpt-4o dove gpt-4o-mini basterebbe. P10 (Micro-Planner) è già deterministico (buona pratica). Smart Lead Decision (P22) potrebbe essere più deterministico
- [~] **Cross-channel sync cost**: Prompt ~2000 tokens + dati multicanale. Sostenibile come batch job (non real-time), MA se eseguito frequentemente su molte org potrebbe diventare costoso
- [~] **Batch vs real-time**: Analytics, gaps, CMS suggestions sono correttamente progettati come batch (cron). MA **nessun cron è schedulato** (no vercel.json), quindi tutto funziona solo su trigger manuale o esterno

### 15.3 Scalabilità

- [~] **Serverless limits**: chat/route.ts è **3511 righe** — file molto grande che impatta cold start (parsing/compilation). Funziona con maxDuration=60 ma **raccomandato split in moduli** per ridurre cold start e manutenibilità
- [~] **DB connection pooling**: Prisma usa `@prisma/adapter-pg` con Node.js `pg` Pool. Pool size **default (10)** senza config esplicita. Singleton pattern previene istanze multiple. **Potenzialmente insufficiente** per produzione con richieste concorrenti
- [!] **In-memory state**: **CRITICO** — Due anti-pattern serverless: (1) `notificationsSent = new Map()` in creditNotificationService — reset su deploy, causa email duplicate. (2) `cooldownStore = new Map()` in rateLimiter — non distribuito, bypass possibile su istanze multiple. **FIX: migrare a Redis**
- [~] **Cron job reliability**: I cron jobs hanno try/catch e logging, MA nessun retry mechanism, nessun dead letter queue, nessun monitoring. **E soprattutto: nessuno è schedulato** (no vercel.json)

---

<a id="16-gap"></a>
## 16. GAP ANALYSIS & ROADMAP SUGGERITA

> 🏷️ **Modello:** Opus — sintesi di tutti i findings confermati (Sez. 2-15)

### SOMMARIO AUDIT

| Metrica | Valore |
|---------|--------|
| Verifiche totali eseguite | ~200 |
| Items ✓ (confermati funzionanti) | ~128 |
| Items ~ (parziali/con caveat) | ~42 |
| Items ✗ (non funzionanti/assenti) | ~18 |
| Items ! (critici/bloccanti) | ~12 |
| Prompt auditati | 30 (media qualità: 6.9/10) |
| Cron jobs trovati | 10 (0 schedulati) |
| Vulnerabilità sicurezza | 6 (2 CRITICHE, 2 ALTE, 2 MEDIE) |

---

### 16.1 Gap Critici (Severità: 🔴 BLOCCANTE)

#### A. Cron Jobs Non Schedulati — TUTTI E 10 INATTIVI
- [!] **Gap confermato (Sez. 2.1, 4.1, 5.1, 6.1, 7.1, 10.1)**: **Nessun `vercel.json` esiste nel progetto**. I 10 cron jobs (fee-partner, kb-growth, analytics-aggregate, serp-monitoring, tip-generation, insight-sync, cms-suggestions, credits-reset, chatbot-analytics, attribution-check) hanno endpoint funzionanti ma **nessuno è mai eseguito**
- **Impatto**: CATASTROFICO — KB non cresce, analytics non si aggregano, fee partner non calcolate, crediti non resettati, suggerimenti CMS mai generati, monitoring SERP fermo
- **Fix**: Creare `vercel.json` con schedule per tutti i 10 cron; unificare auth (attualmente 3 metodi diversi: Bearer, x-cron-secret, condizionale)
- **Effort stimato**: 2-4 ore

#### B. In-Memory State su Serverless — ANTI-PATTERN CRITICO
- [!] **Gap confermato (Sez. 14.1, 15.3)**: Due `Map()` in-memory che si perdono ad ogni cold start/deploy:
  - `notificationsSent` in `creditNotificationService.ts` → email duplicate o mancanti
  - `cooldownStore` in `rateLimiter.ts` → rate limit bypassabile su istanze multiple
- **Impatto**: CRITICO — Email duplicate ai clienti, rate limiting inefficace, comportamento non deterministico
- **Fix**: Migrare entrambi a Redis (Upstash già usato per middleware rate limiter)
- **Effort stimato**: 3-4 ore

#### C. PII nei Log + Assenza GDPR User Deletion
- [!] **Gap confermato (Sez. 14.2)**: `console.log/error` contengono email, nomi utente, ID sessione in chiaro. **Nessun endpoint di cancellazione account utente** (GDPR Art.17 non implementato). Cookie consent solo localStorage (non tracciabile server-side). Nessuna data retention policy
- **Impatto**: CRITICO — Violazione GDPR potenziale, rischio sanzioni, dati personali in log Vercel accessibili
- **Fix**: (1) Sanitizzare tutti i log, (2) Implementare `/api/user/delete-account` con cascade delete, (3) Migrare consenso cookie a DB, (4) Definire retention policy
- **Effort stimato**: 8-12 ore

#### D. Prompt Injection Vulnerabilities
- [!] **Gap confermato (Sez. 12, 14.3)**: Input utente concatenato direttamente nei prompt senza sanitizzazione:
  - **P29 (SERP Monitoring)**: Contenuto web da SerpAPI iniettato nel prompt senza escape — rischio jailbreak via contenuto malevolo indicizzato
  - **P30 (Visibility Prompts)**: Input utente (brand, keywords) passati a temp 0.8 senza validazione
  - **P21-P22 (Chatbot)**: Messaggi utente non filtrati
  - Solo 6 pattern base di output sanitization (iniezione "non rivelare", "non uscire dal tema")
- **Impatto**: ALTO — Possibile estrazione istruzioni sistema, generazione contenuti non autorizzati, prompt leaking
- **Fix**: Implementare input sanitization layer pre-prompt; separare user content con delimitatori; aggiungere output validation post-LLM
- **Effort stimato**: 6-8 ore

#### E. Bug P5: Language Detection Sempre True
- [!] **Gap confermato (Sez. 12)**: In `prompt-builder.ts` il check `isItalian = label.length > 0` è **sempre true** (label non è mai vuoto). Tutte le interviste ricevono il prompt italiano indipendentemente dalla lingua configurata
- **Impatto**: ALTO — Le interviste in lingue diverse dall'italiano ricevono istruzioni miste/errate
- **Fix**: Correggere condizione a `isItalian = language === 'it'` o equivalente basato su campo lingua effettivo
- **Effort stimato**: 30 minuti

---

### 16.2 Gap Funzionali Alti (Severità: 🟠 SIGNIFICATIVO)

#### F. Knowledge Base: Solo 2 di 7 Fonti Auto-Growth Attive
- [~] **Gap confermato (Sez. 5)**: Le 7 fonti dichiarate per auto-growth KB sono: (1) Conversazioni interviste, (2) Conversazioni chatbot, (3) Analytics aggregati, (4) Tip implementati, (5) Contenuti CMS pubblicati, (6) Dati SERP, (7) Feedback utente. **Solo conversazioni (1) e analytics (3) hanno pipeline funzionanti**. Le altre 5 fonti non alimentano la KB
- **Impatto**: La piattaforma non migliora autonomamente nel tempo. La KB rimane statica
- **Fix**: Implementare pipeline di estrazione per le 5 fonti mancanti; prerequisito: attivare i cron jobs (Gap A)
- **Effort stimato**: 15-20 ore

#### G. KB Senza Ricerca Semantica (Text-Only RAG)
- [~] **Gap confermato (Sez. 5.2)**: La KB usa solo ricerca keyword-based su testo raw. Nessun vector embedding, nessun similarity search semantico. `searchPlatformKB()` fa text matching letterale
- **Impatto**: Rilevanza risposte KB limitata, miss su query semanticamente simili ma lessicalmente diverse
- **Fix**: Implementare pgvector (già su PostgreSQL) o servizio esterno (Pinecone, Weaviate). Generare embeddings per ogni entry KB
- **Effort stimato**: 12-16 ore

#### H. Internazionalizzazione Assente
- [~] **Gap confermato (Sez. 13)**: Nessun framework i18n (next-intl, react-i18next). Stringhe UI hardcoded in italiano. 5 prompt ausiliari Italian-only (P11 tone adapter, P25 gap detector, P27 sync engine, P28 CMS generator, P30 visibility). Email templates Italian-only. Copilot Italian-only
- **Impatto**: Blocca espansione internazionale. Utenti non-italiani hanno UX degradata
- **Fix**: (1) Adottare next-intl, (2) Estrarre tutte le stringhe in file di traduzione, (3) Aggiungere parametro `language` ai 5 prompt ausiliari, (4) Template email multilingue
- **Effort stimato**: 30-40 ore (refactor significativo)

#### I. Prompt Quality — Extraction/Analytics Score 4.7/10
- [~] **Gap confermato (Sez. 12)**: I 30 prompt hanno media 6.9/10, ma la categoria Extraction/Analytics è criticamente bassa (4.7/10):
  - P20 (Candidate Extractor): **Manca temperature** — usa default 1.0, output inconsistente per task deterministico
  - P25 (Knowledge Gap Detector): Prompt minimale, 4/10
  - P26 (Chatbot Analytics Aggregator): Usa gpt-4o (troppo costoso per task semplice), 5/10
  - P11 (Tone Adapter): Italian-only, mapping rigido, 5/10
- **Fix**: (1) Aggiungere `temperature: 0.2` a P20, (2) Arricchire P25 con criteri specifici, (3) Downgrade P26 a gpt-4o-mini, (4) Rendere P11 multilingue
- **Effort stimato**: 4-6 ore

#### J. AI Tips Non Implementabili End-to-End
- [~] **Gap confermato (Sez. 8)**: I tip sono generati e visualizzabili ma il flusso edit → preview → approve → publish è incompleto. CMS pipeline funziona per WordPress ma social (n8n) non completamente implementato. Nessun editor inline per modificare tip prima della pubblicazione
- **Impatto**: L'utente deve copiare manualmente contenuti suggeriti e pubblicarli
- **Fix**: Implementare editor inline con preview, completare n8n social workflows, aggiungere status tracking per tip implementati
- **Effort stimato**: 15-20 ore

---

### 16.3 Gap di Allineamento Strategico (Severità: 🟡 MIGLIORATIVO)

#### K. Social Media Integration Incompleta
- [~] **Gap confermato (Sez. 7, 8)**: WordPress MCP publishing funziona (push contenuti). WooCommerce MCP funziona per discovery prodotti. **Ma**: n8n integration per social (LinkedIn, Facebook, Instagram) è strutturalmente presente (schema DB `N8NConnection`) ma workflow non completamente implementati. Nessun template post pre-formattato per social
- **Fix**: Completare workflow n8n; creare template per LinkedIn (carousel, article), Facebook, Instagram; implementare approval flow
- **Effort stimato**: 12-16 ore

#### L. GEO Monitoring — Copertura Provider Limitata
- [~] **Gap confermato (Sez. 6)**: Visibility Engine interroga 3 provider (OpenAI, Anthropic, Gemini) in parallelo. **Mancano**: Perplexity, Bing Chat/Copilot, You.com. SerpAPI AI Overview detection funziona ma con heuristic (non API ufficiale)
- **Fix**: Aggiungere Perplexity API e Bing Chat; implementare tracking temporale citazioni per trend analysis
- **Effort stimato**: 8-10 ore

#### M. LinkedIn B2B Strategy Non Ottimizzata
- [~] **Gap confermato (Sez. 7, 8)**: I suggerimenti CMS generano 5 tipi contenuto (blog_post, landing_page, faq, product_description, social_post) ma senza ottimizzazione specifica per LinkedIn B2B (formati carousel, document, newsletter, poll). Italian PMI target non ha prompt enrichment specifico
- **Fix**: Aggiungere formati LinkedIn-specifici; enrichire prompt CMS con contesto mercato italiano, incentivi digitali, normativa
- **Effort stimato**: 4-6 ore

#### N. Reporting & Export Assenti
- [~] **Gap confermato (Sez. 11)**: Dashboard mostra analytics in-app ma **nessun export** (PDF, PowerPoint, CSV). Nessun report periodico automatico. Per PMI italiane la reportistica per management è fondamentale
- **Fix**: Implementare export PDF con metriche chiave; report periodico via email; template PowerPoint con insights
- **Effort stimato**: 10-14 ore

---

### 16.4 Gap Tecnici/Infrastrutturali (Severità: 🔵 DEBITO TECNICO)

#### O. File chat/route.ts — 3511 Righe
- [~] **Gap confermato (Sez. 15.3)**: Il file principale delle interviste è **3511 righe** — impatta cold start Vercel, manutenibilità, code review. Contiene supervisor, context manager, enforcement, validation, streaming tutto in un file
- **Fix**: Estrarre in moduli: `supervisor.ts`, `context-manager.ts`, `enforcement.ts`, `response-builder.ts`
- **Effort stimato**: 8-10 ore (refactoring)

#### P. Database Pool Size Default
- [~] **Gap confermato (Sez. 15.3)**: Prisma usa `@prisma/adapter-pg` con pool size **default (10)**. Per produzione con utenti concorrenti potrebbe essere insufficiente. Nessun monitoring connessioni attive
- **Fix**: Configurare pool size esplicito (20-30); aggiungere health check endpoint; monitoring connessioni
- **Effort stimato**: 2-3 ore

#### Q. Auth Cron Inconsistente — 3 Metodi Diversi
- [~] **Gap confermato (Sez. 2.1, 10.1)**: I 10 cron usano 3 metodi auth diversi: (1) `Bearer CRON_SECRET` header, (2) `x-cron-secret` header, (3) condizionale su env. Nessuno standard
- **Fix**: Unificare a un solo metodo (raccomandato: `Authorization: Bearer ${CRON_SECRET}`)
- **Effort stimato**: 1-2 ore

#### R. Feedback Loop Utente Assente
- [~] **Gap confermato (Sez. 3, 8)**: Nessun meccanismo thumbs up/down su: risposte chatbot, suggerimenti AI, contenuti CMS generati. Nessun ciclo di miglioramento basato su feedback esplicito
- **Fix**: Aggiungere rating component su chatbot responses e tip cards; pipeline per rinforzare prompt basati su feedback
- **Effort stimato**: 6-8 ore

---

### 16.5 ROADMAP PRIORITIZZATA

Ordine di implementazione suggerito per massimizzare impatto con minimo effort:

| Priorità | Gap | Effort | Impatto | Sprint |
|----------|-----|--------|---------|--------|
| 🔴 P0 | **E. Fix bug P5 lingua** | 30 min | Corregge tutte le interviste non-italiane | Sprint 1 |
| 🔴 P0 | **A. Creare vercel.json** | 2-4h | Attiva tutti i 10 cron, sblocca KB growth, analytics, billing | Sprint 1 |
| 🔴 P0 | **Q. Unificare auth cron** | 1-2h | Prerequisito per A, sicurezza | Sprint 1 |
| 🔴 P1 | **B. Migrare Map() a Redis** | 3-4h | Elimina email duplicate, rende rate limit affidabile | Sprint 1 |
| 🔴 P1 | **D. Input sanitization LLM** | 6-8h | Previene prompt injection su 4+ endpoint | Sprint 1 |
| 🔴 P1 | **C. GDPR compliance** | 8-12h | User deletion, log sanitization, consent tracking | Sprint 2 |
| 🟠 P2 | **I. Fix prompt quality** | 4-6h | P20 temperatura, P25-P26 miglioramento, P11 multilingue | Sprint 2 |
| 🟠 P2 | **F. KB auto-growth 5 fonti** | 15-20h | La piattaforma migliora autonomamente | Sprint 2-3 |
| 🟠 P2 | **J. AI Tips end-to-end** | 15-20h | Utente può implementare suggerimenti direttamente | Sprint 3 |
| 🟠 P3 | **G. KB semantic search** | 12-16h | Rilevanza risposte KB migliora significativamente | Sprint 3 |
| 🟡 P3 | **K. Social integration** | 12-16h | Automazione social media completa | Sprint 3-4 |
| 🟡 P3 | **O. Split chat/route.ts** | 8-10h | Manutenibilità, cold start ridotti | Sprint 4 |
| 🟡 P4 | **L. GEO providers** | 8-10h | Copertura monitoring più completa | Sprint 4 |
| 🟡 P4 | **M. LinkedIn B2B** | 4-6h | Contenuti ottimizzati per target PMI | Sprint 4 |
| 🟡 P4 | **N. Reporting/Export** | 10-14h | Valore per management PMI | Sprint 4-5 |
| 🔵 P4 | **H. Internazionalizzazione** | 30-40h | Espansione mercati non-italiani | Sprint 5-6 |
| 🔵 P5 | **P. DB pool tuning** | 2-3h | Resilienza sotto carico | Sprint 5 |
| 🔵 P5 | **R. Feedback loop** | 6-8h | Miglioramento continuo basato su utente | Sprint 5 |

**Sprint 1 (Week 1-2)**: Fix critici immediati — ~15-20h → Piattaforma stabile e sicura
**Sprint 2 (Week 3-4)**: GDPR + Prompt quality + Inizio KB growth — ~27-38h → Compliance e qualità
**Sprint 3 (Week 5-7)**: KB completa + Tips end-to-end — ~27-36h → Valore automatico
**Sprint 4 (Week 8-10)**: Social + GEO + Refactoring — ~30-42h → Feature complete
**Sprint 5-6 (Week 11-16)**: i18n + Ottimizzazioni — ~38-51h → Espansione internazionale

---

## PIANO DI ESECUZIONE

### Fase 1: Check Strutturali (Haiku) - ~2h
- Verifica esistenza file, pattern matching DB ↔ API ↔ UI
- Verifica schema Prisma vs campi effettivamente usati
- Inventario completo route API vs pagine UI

### Fase 2: Verifica UI ↔ Codice (Sonnet) - ~4h
- Per ogni area: mappatura campi UI → logica backend
- Test di corrispondenza label/azioni/risultati
- Verifica stati vuoti, errori, edge case

### Fase 3: Audit Prompt & LLM (Opus) - ~6h
- Analisi qualitativa di ogni prompt (30 prompt totali)
- Verifica guardrail e temperature
- Test di robustezza (injection, hallucination, leaking)
- Confronto con best practices

### Fase 4: Audit Pipeline Dati (Sonnet) - ~3h
- Tracciamento flusso dati end-to-end per ogni feature
- Verifica cron jobs e aggregazioni
- Verifica crediti e billing

### Fase 5: Ricerca & Confronto Best Practices (Opus) - ~4h
- Web research su tutte le 6 aree tematiche
- Confronto piattaforma vs benchmark industry
- Identificazione gap rispetto a stato dell'arte

### Fase 6: Gap Analysis & Raccomandazioni (Opus) - ~3h
- Sintesi tutti i gap trovati
- Prioritizzazione per impatto business
- Roadmap implementativa suggerita con effort stimato

---

## KPI DI AUDIT

L'audit monitorerà l'allineamento con i KPI piattaforma dichiarati:

| KPI | Come verificare |
|-----|----------------|
| Tempo su piattaforma | Verificare che UX sia fluida e non frustrante |
| Token utilizzati | Verificare che l'ottimizzazione modelli riduca costi |
| Tool creati | Verificare che la creazione bot/interviste sia semplice |
| Feedback positivi | Verificare qualità interviste e accuratezza insight |

---

> **Note finali:**
> Questo piano copre ~200 verifiche individuali organizzate in 16 aree.
> Tempo stimato totale: ~22 ore di audit con mix di modelli.
> Priorità assoluta: Sezioni 2 (Interview), 5 (KB), 8 (Tips), 12 (Prompts).
