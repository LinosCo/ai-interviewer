# Business Tuner - Piano di Miglioramento Completo

## Contesto

Questo piano nasce dal feedback di un esperto di ricerca qualitativa che ha testato Business Tuner. Le criticità emerse sono state trasformate in 6 fasi di miglioramento con specifiche tecniche dettagliate.

---

## Sintesi delle Criticità Rilevate

| Problema | Impatto | Fase di Risoluzione |
|----------|---------|---------------------|
| Utente non capisce cosa sta facendo | Drop-out iniziale | Fase 2 |
| Partenza "a freddo" con domanda aperta | Barriera d'ingresso alta | Fase 3 |
| "Te l'ho già detto" - ridondanza | Frustrazione, abbandono | Fase 1 |
| Tono troppo "scritto", non adattivo | Esperienza artificiale | Fase 4 |
| Follow-up passivi invece che proattivi | Utente lavora per l'AI | Fase 4 |
| Mancano dati socio-demografici | Analisi incompleta | Fase 5 |
| Posizionamento ambiguo | Aspettative sbagliate | Fase 6 |

---

## Le 6 Fasi

### Fase 1: Memory Layer Anti-Ridondanza
**File:** `FASE-1-MEMORY-LAYER.md`

**Obiettivo:** Eliminare la sensazione "te l'ho già detto"

**Componenti principali:**
- Tabella `ConversationMemory` nel database
- Servizio `FactExtractor` per estrarre fatti dalle risposte
- Servizio `MemoryManager` per gestire e formattare la memoria
- Integrazione nel prompt con sezione "INFORMAZIONI GIÀ RACCOLTE"

**Effort stimato:** 3-4 giorni

---

### Fase 2: Onboarding Trasparente e Progress Semantico
**File:** `FASE-2-ONBOARDING-PROGRESS.md`

**Obiettivo:** Rendere chiaro cosa sta per succedere

**Componenti principali:**
- Componente `WelcomeScreen` riprogettato
- Componente `SemanticProgressBar` con topic come tappe
- Nuovi campi Bot per configurazione onboarding
- Spiegazione del formato conversazionale

**Effort stimato:** 2-3 giorni

---

### Fase 3: Warm-up Configurabile
**File:** `FASE-3-WARMUP-CONFIGURABILE.md`

**Obiettivo:** Abbassare la barriera d'ingresso con domande iniziali meno impegnative

**Componenti principali:**
- 4 stili di warm-up: open, choice, icebreaker, context
- Componente `WarmupQuestion` con UI per ogni stile
- Generatore automatico di scelte basato su target audience
- Configurazione nel bot builder

**Effort stimato:** 2-3 giorni

---

### Fase 4: Adattività del Tono e Follow-up Proattivi
**File:** `FASE-4-TONE-PROACTIVE.md`

**Obiettivo:** L'AI si adatta allo stile dell'utente e offre suggerimenti invece di chiedere chiarimenti

**Componenti principali:**
- `ToneAnalyzer` per rilevare registro, verbosità, emotività
- `TonePromptAdapter` per generare istruzioni di adattamento
- Sistema di suggerimenti proattivi con knowledge base
- Varianti di wording per evitare ripetizioni

**Effort stimato:** 3-4 giorni

---

### Fase 5: Sezione Socio-Demografica
**File:** `FASE-5-DEMOGRAFICI.md`

**Obiettivo:** Raccogliere dati strutturati utili per l'analisi

**Componenti principali:**
- Tabelle `DemographicQuestion` e `DemographicResponse`
- Template predefiniti per settore (turismo, HR, customer, general)
- Componente `DemographicForm` con UI per diversi tipi di domanda
- Posizionamento configurabile (prima/dopo intervista)

**Effort stimato:** 3-4 giorni

---

### Fase 6: Posizionamento e Comunicazione
**File:** `FASE-6-POSIZIONAMENTO.md`

**Obiettivo:** Chiarire cosa Business Tuner è e cosa non è

**Componenti principali:**
- Nuovo copy landing page
- Documentazione metodologica
- Onboarding in-app con tutorial
- Email templates aggiornati
- Script per obiezioni comuni

**Effort stimato:** 2-3 giorni (principalmente contenuti)

---

## Dipendenze tra Fasi

```
Fase 1 (Memory) ─────┐
                     ├──► Fase 4 (Tone/Proactive)
Fase 2 (Onboarding)──┤
                     │
Fase 3 (Warm-up) ────┘

Fase 5 (Demografici) ──► Indipendente

Fase 6 (Posizionamento) ──► Indipendente (può iniziare subito)
```

**Note:**
- La Fase 4 beneficia della Fase 1 (usa la memoria per evitare ridondanze nel tono)
- La Fase 4 beneficia della Fase 2 (il progress bar aiuta l'AI a calibrare il ritmo)
- Le Fasi 5 e 6 sono indipendenti e possono procedere in parallelo

---

## Roadmap Consigliata

### Sprint 1 (Settimana 1-2)
**Focus: Fondamenta**

| Giorno | Attività |
|--------|----------|
| 1-2 | Fase 1: Schema DB + types |
| 3-4 | Fase 1: FactExtractor + MemoryManager |
| 5 | Fase 1: Integrazione API chat |
| 6-7 | Fase 2: WelcomeScreen |
| 8-9 | Fase 2: SemanticProgressBar |
| 10 | Test e fix |

**Deliverable:** Interviste senza ridondanza, con onboarding chiaro

---

### Sprint 2 (Settimana 3-4)
**Focus: Esperienza Utente**

| Giorno | Attività |
|--------|----------|
| 1-2 | Fase 3: Warm-up styles + UI |
| 3 | Fase 3: Integrazione flusso |
| 4-5 | Fase 4: ToneAnalyzer |
| 6-7 | Fase 4: TonePromptAdapter |
| 8-9 | Fase 4: ProactiveSuggestions |
| 10 | Test e fix |

**Deliverable:** Interviste adattive con partenza morbida

---

### Sprint 3 (Settimana 5-6)
**Focus: Completezza e Comunicazione**

| Giorno | Attività |
|--------|----------|
| 1-2 | Fase 5: Schema DB demografici |
| 3-4 | Fase 5: DemographicForm + templates |
| 5-6 | Fase 5: Integrazione flusso |
| 7-8 | Fase 6: Copy landing + help center |
| 9-10 | Fase 6: Onboarding in-app + email |

**Deliverable:** Prodotto completo con posizionamento chiaro

---

## Metriche di Successo

### Prima dell'implementazione (baseline)
- [ ] Misurare completion rate attuale
- [ ] Misurare tempo medio completamento
- [ ] Raccogliere feedback qualitativi su esperienza

### Dopo Sprint 1
- [ ] Completion rate: target +10%
- [ ] Riduzione feedback "domande ripetitive": target -50%

### Dopo Sprint 2
- [ ] Completion rate: target +15% totale
- [ ] Aumento risposte >50 caratteri: target +20%
- [ ] Riduzione drop-out primi 2 minuti: target -30%

### Dopo Sprint 3
- [ ] Dati demografici raccolti: target 80% interviste
- [ ] Chiarezza posizionamento (survey utenti): target >4/5

---

## File di Riferimento

```
business-tuner-improvements/
├── README.md                        # Questo file
├── FASE-1-MEMORY-LAYER.md          # Memory anti-ridondanza
├── FASE-2-ONBOARDING-PROGRESS.md   # Onboarding e progress
├── FASE-3-WARMUP-CONFIGURABILE.md  # Warm-up styles
├── FASE-4-TONE-PROACTIVE.md        # Adattività e proattività
├── FASE-5-DEMOGRAFICI.md           # Sezione demografica
└── FASE-6-POSIZIONAMENTO.md        # Copy e comunicazione
```

---

## Quick Start per Sviluppatori

### 1. Leggi prima questi file
1. Questo README per il quadro generale
2. La fase su cui stai lavorando per i dettagli

### 2. Ordine di implementazione consigliato per ogni fase
1. Schema database (Prisma)
2. Types TypeScript
3. Servizi/utilities
4. Componenti UI
5. Integrazione API
6. Test

### 3. Comandi utili

```bash
# Dopo modifiche a schema.prisma
npx prisma migrate dev --name <nome_migration>

# Generare types Prisma
npx prisma generate

# Test
npm run test

# Dev server
npm run dev
```

---

## Note per il Product Owner

### Priorità assolute (non negoziabili)
1. **Fase 1 (Memory)** - Il problema ridondanza è il più sentito
2. **Fase 2 (Onboarding)** - Senza chiarezza iniziale, tutto il resto è inutile

### Priorità alte (forte impatto)
3. **Fase 4 (Tone)** - Migliora significativamente l'esperienza
4. **Fase 3 (Warm-up)** - Riduce barriera d'ingresso

### Priorità medie (completano il prodotto)
5. **Fase 5 (Demografici)** - Utile per analisi ma non bloccante
6. **Fase 6 (Posizionamento)** - Importante ma può iterare nel tempo

### Considerazioni costi
- Fase 1 e 4 aumentano le chiamate AI (estrazione fatti, analisi tono)
- Usare modelli economici (gpt-4o-mini) per operazioni di supporto
- Monitorare costi per risposta dopo implementazione

---

## Changelog

| Data | Versione | Note |
|------|----------|------|
| 2024-XX-XX | 1.0 | Prima stesura completa |
