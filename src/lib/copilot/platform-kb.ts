// Platform Knowledge Base for Strategy Copilot
// In a production environment, this would use vector embeddings and proper RAG
// For now, we use a simple keyword-based search on structured content

interface KBEntry {
    id: string;
    title: string;
    content: string;
    category: string;
    keywords: string[];
}

// Platform knowledge base content
const PLATFORM_KB: KBEntry[] = [
    // Getting Started
    {
        id: 'gs-1',
        title: 'Iniziare con Business Tuner',
        content: `Business Tuner e una piattaforma per comprendere i tuoi clienti attraverso AI Interviews, Chatbot Intelligence e Visibility Tracker.

Per iniziare:
1. Crea un progetto dalla dashboard
2. Scegli quale strumento usare (interviste AI, chatbot, o visibility tracker)
3. Configura lo strumento secondo le tue esigenze
4. Raccogli dati e analizza i risultati

Il piano Trial include 14 giorni di prova con accesso a tutte le funzionalita.`,
        category: 'getting-started',
        keywords: ['iniziare', 'start', 'primo', 'tutorial', 'guida', 'come funziona']
    },
    {
        id: 'gs-2',
        title: 'Creare un nuovo progetto',
        content: `Per creare un nuovo progetto:
1. Vai alla Dashboard
2. Clicca su "Nuovo Progetto"
3. Inserisci un nome descrittivo
4. Il progetto verra creato e potrai iniziare ad aggiungere bot

I progetti raggruppano i tuoi bot (interviste e chatbot) per organizzare meglio il lavoro. Puoi avere piu progetti per diversi scopi: ricerca clienti, supporto, feedback prodotto, etc.`,
        category: 'getting-started',
        keywords: ['progetto', 'creare', 'nuovo', 'organizzazione']
    },

    // AI Interviews
    {
        id: 'int-1',
        title: 'Creare un\'intervista AI',
        content: `Le AI Interviews permettono di condurre interviste qualitative automatizzate.

Per creare un'intervista:
1. Vai nel progetto e clicca "Nuova Intervista"
2. Definisci l'obiettivo della ricerca
3. Specifica il target audience
4. Aggiungi i topic blocks (argomenti da esplorare)
5. Personalizza tono, durata e stile
6. Pubblica e condividi il link

L'AI condurra l'intervista in modo naturale, esplorando gli argomenti in profondita e adattandosi alle risposte.`,
        category: 'interviews',
        keywords: ['intervista', 'creare', 'ricerca', 'qualitativa', 'topic', 'configurare']
    },
    {
        id: 'int-2',
        title: 'Configurare i topic blocks',
        content: `I Topic Blocks sono gli argomenti che l'AI esplorera durante l'intervista.

Per ogni topic puoi definire:
- Label: nome visibile (es. "Esperienza d'acquisto")
- Descrizione: cosa vuoi scoprire
- Sub-goals: punti specifici da approfondire
- Max turns: quanti scambi dedicare al topic

Suggerimenti:
- Ordina i topic dal piu generale al piu specifico
- Inizia con domande facili per mettere a proprio agio
- Non superare 4-5 topic per intervista
- Usa sub-goals specifici e misurabili`,
        category: 'interviews',
        keywords: ['topic', 'argomenti', 'configurare', 'domande', 'struttura']
    },
    {
        id: 'int-3',
        title: 'Analizzare i risultati delle interviste',
        content: `Dopo le interviste, Business Tuner analizza automaticamente:

1. **Sentiment**: Valutazione emotiva delle risposte
2. **Temi**: Argomenti ricorrenti identificati dall'AI
3. **Citazioni chiave**: Quote significative estratte
4. **Copertura topic**: Quanto ogni argomento e stato esplorato

Dalla dashboard puoi:
- Filtrare le conversazioni per tema, sentiment, data
- Esportare i dati in CSV
- Generare report automatici
- Confrontare periodi diversi`,
        category: 'interviews',
        keywords: ['analisi', 'risultati', 'sentiment', 'temi', 'report', 'insight']
    },

    // Chatbot Intelligence
    {
        id: 'chat-1',
        title: 'Creare un chatbot',
        content: `I Chatbot Intelligence sono assistenti AI che rispondono alle domande degli utenti usando la tua knowledge base.

Per creare un chatbot:
1. Vai nel progetto e clicca "Nuovo Chatbot"
2. Dai un nome e descrizione
3. Aggiungi fonti di conoscenza (testi, FAQ, documenti)
4. Personalizza aspetto e comportamento
5. Pubblica e ottieni il codice embed

Il chatbot imparera dalla tua knowledge base e rispondera in modo coerente.`,
        category: 'chatbot',
        keywords: ['chatbot', 'creare', 'assistente', 'supporto', 'widget']
    },
    {
        id: 'chat-2',
        title: 'Gestire la Knowledge Base',
        content: `La Knowledge Base e il "cervello" del tuo chatbot.

Puoi aggiungere:
- **Testo libero**: Documenti, FAQ, guide
- **URL**: Il chatbot leggera il contenuto della pagina
- **File**: PDF e documenti (in alcuni piani)

Best practices:
- Organizza il contenuto in sezioni chiare
- Scrivi risposte complete ma concise
- Aggiorna regolarmente con nuove informazioni
- Monitora i "knowledge gaps" per identificare lacune`,
        category: 'chatbot',
        keywords: ['knowledge', 'base', 'conoscenza', 'faq', 'contenuti', 'fonti']
    },
    {
        id: 'chat-3',
        title: 'Embedddare il chatbot nel sito',
        content: `Per installare il chatbot sul tuo sito:

1. Vai nelle impostazioni del chatbot
2. Copia il codice embed JavaScript
3. Incollalo prima del tag </body> nel tuo sito

Il codice e simile a:
\`\`\`html
<script src="https://app.businesstuner.it/widget/CHATBOT_ID.js"></script>
\`\`\`

Puoi personalizzare:
- Posizione del bubble (angolo dello schermo)
- Colori e aspetto
- Messaggio di benvenuto
- Comportamento di apertura`,
        category: 'chatbot',
        keywords: ['embed', 'installare', 'sito', 'widget', 'codice', 'javascript']
    },
    {
        id: 'chat-4',
        title: 'Knowledge Gaps e FAQ Suggestions',
        content: `Business Tuner identifica automaticamente:

**Knowledge Gaps**: Domande che gli utenti fanno ma a cui il chatbot non sa rispondere bene. Indica che manca contenuto nella knowledge base.

**FAQ Suggestions**: Suggerimenti di FAQ basati sulle domande piu frequenti. Puoi approvarle con un click.

Per ogni gap vedi:
- Priorita (HIGH, MEDIUM, LOW)
- Esempi di domande degli utenti
- Suggerimento di risposta da aggiungere

Risolvere i gap migliora l'esperienza utente e riduce il carico sul supporto.`,
        category: 'chatbot',
        keywords: ['gap', 'lacune', 'faq', 'suggerimenti', 'migliorare']
    },

    // Visibility Tracker & Brand Monitor
    {
        id: 'vis-1',
        title: 'Cos\'e il Brand Monitor (Visibility Tracker)',
        content: `Il Brand Monitor (ex Visibility Tracker) monitora come il tuo brand appare nelle risposte degli AI e nei risultati di ricerca Google.

**Monitoraggio Multi-LLM:**
- OpenAI (GPT-4o-mini)
- Anthropic (Claude 3.5 Haiku)
- Google Gemini (Gemini 2.0 Flash)

**SERP Monitoring:**
- Traccia le menzioni su Google Search
- Analisi sentiment dei risultati
- Monitoraggio reputazione fonti

**Funzionalita:**
- Traccia la menzione del tuo brand in prompt specifici
- Confronta con i competitor su ogni piattaforma AI
- Analizza il sentiment delle menzioni
- Monitora l'evoluzione nel tempo
- Cross-channel insights per pattern ricorrenti

Questo ti aiuta a capire quanto sei "visibile" nel nuovo mondo delle ricerche AI e su Google.`,
        category: 'visibility',
        keywords: ['visibility', 'visibilita', 'brand', 'monitor', 'AI', 'menzioni', 'serp', 'google', 'gemini', 'openai', 'anthropic']
    },
    {
        id: 'vis-2',
        title: 'Configurare il Brand Monitor',
        content: `Per configurare il Brand Monitor:

1. Vai in "Visibility" dalla sidebar
2. Clicca "Nuovo Brand" o "Configura"
3. Inserisci:
   - Nome del brand
   - Categoria/settore
   - Lingua e territorio target
   - Competitor da monitorare

4. Aggiungi i prompt da testare:
   - Puoi scriverli manualmente
   - O generarli automaticamente con AI

5. Avvia la prima scansione

**Come funziona la scansione:**
- Interroga simultaneamente OpenAI, Anthropic e Gemini
- Analizza le risposte per trovare menzioni del brand
- Calcola posizione e sentiment
- Genera uno score di visibilita (0-100)

**Cooldown:** Le scansioni manuali hanno un cooldown di 24 ore per ottimizzare i costi.`,
        category: 'visibility',
        keywords: ['configurare', 'brand', 'competitor', 'prompt', 'scansione', 'setup']
    },
    {
        id: 'vis-3',
        title: 'SERP Monitoring (Google Search)',
        content: `Il SERP Monitoring traccia come il tuo brand appare nei risultati di ricerca Google.

**Cosa monitora:**
- Posizione nei risultati di ricerca
- Sentiment degli articoli che menzionano il brand
- Reputazione delle fonti (alta, media, bassa)
- Trend nel tempo

**Metriche:**
- Risultati positivi/negativi/neutri
- Importanza media delle menzioni
- Coverage totale

**Configurazione:**
Richiede una API key di SerpAPI configurata nelle impostazioni admin (Google SERP API Key).

**Frequenza:**
Lo scan SERP viene eseguito automaticamente settimanalmente o manualmente dalla dashboard.`,
        category: 'visibility',
        keywords: ['serp', 'google', 'search', 'risultati', 'seo', 'ricerca', 'monitoring']
    },
    {
        id: 'vis-4',
        title: 'Cross-Channel Insights',
        content: `I Cross-Channel Insights combinano dati da tutte le fonti per generare suggerimenti strategici.

**Fonti analizzate:**
- Chatbot: conversazioni, knowledge gaps
- Interviste: feedback, temi, sentiment
- Brand Monitor: visibilita LLM, menzioni SERP
- Analytics: trend, pattern ricorrenti

**Tipi di suggerimenti generati:**
- strategic_recommendation: strategie di alto livello
- product_improvement: miglioramenti prodotto/servizio
- pricing_change: suggerimenti su pricing
- marketing_campaign: iniziative marketing
- create_content / modify_content: strategia contenuti
- respond_to_press: risposte PR
- monitor_competitor: tracciamento competitor

**Come funziona:**
Il sistema sincronizza automaticamente i dati e genera insight actionable basati su pattern cross-channel.`,
        category: 'visibility',
        keywords: ['insights', 'cross-channel', 'strategia', 'suggerimenti', 'analisi', 'pattern']
    },

    // Analytics & Dashboard
    {
        id: 'an-1',
        title: 'Dashboard Analytics',
        content: `La dashboard analytics mostra una panoramica del tuo utilizzo:

**Metriche principali**:
- Conversazioni totali
- Sentiment medio
- Temi piu discussi
- Trend nel tempo

**Cross-Channel Insights** (Pro+):
Analisi che combina dati da interviste, chatbot e visibility per identificare pattern ricorrenti e opportunita.

Puoi filtrare per:
- Periodo temporale
- Progetto/Bot specifico
- Tipo di interazione`,
        category: 'analytics',
        keywords: ['analytics', 'statistiche', 'metriche', 'dashboard', 'trend']
    },
    {
        id: 'an-2',
        title: 'Navigare la Dashboard principale',
        content: `La Dashboard principale e il punto di partenza per tutte le operazioni.

**Sidebar (menu laterale):**
- **Dashboard**: panoramica generale
- **Progetti**: lista dei tuoi progetti
- **Visibility**: Brand Monitor e SERP tracking
- **Impostazioni**: configurazione account e API keys
- **Usage**: monitoraggio crediti e consumi

**Area centrale:**
- Selezione progetto attivo (dropdown in alto)
- Statistiche riassuntive del progetto
- Azioni rapide (crea intervista, chatbot, etc.)

**Header:**
- Notifiche e avvisi
- Profilo utente
- Strategy Copilot (icona chat)

**Suggerimento**: Seleziona sempre un progetto dal dropdown per vedere i dati contestualizzati.`,
        category: 'dashboard',
        keywords: ['dashboard', 'navigare', 'menu', 'sidebar', 'interfaccia', 'layout']
    },
    {
        id: 'an-3',
        title: 'Leggere i risultati delle interviste',
        content: `Dopo aver raccolto interviste, ecco come interpretare i risultati:

**1. Panoramica Intervista**
- Stato: completata, abbandonata, in corso
- Durata: tempo totale dell'intervista
- Copertura topic: % di argomenti esplorati

**2. Analisi Sentiment**
- Score da -1 (negativo) a +1 (positivo)
- Colore: rosso (negativo), giallo (neutro), verde (positivo)
- Trend: confronto con interviste precedenti

**3. Temi Estratti**
- Temi automaticamente identificati dall'AI
- Frequenza: quante volte il tema appare
- Sentiment per tema: come si sente l'utente su quel tema

**4. Citazioni Chiave**
- Quote significative estratte automaticamente
- Contesto della citazione
- Sentiment associato

**5. Metriche di Copertura**
Per ogni topic block:
- Turns dedicati: quanti scambi
- Profondita: superficiale, adeguata, approfondita
- Sub-goals raggiunti

**Come usare questi dati:**
- Confronta sentiment tra segmenti di utenti
- Identifica temi ricorrenti per prioritizzare azioni
- Usa le citazioni per report e presentazioni`,
        category: 'analytics',
        keywords: ['risultati', 'interviste', 'leggere', 'interpretare', 'sentiment', 'temi', 'citazioni']
    },
    {
        id: 'an-4',
        title: 'Leggere i risultati del chatbot',
        content: `I risultati del chatbot mostrano come gli utenti interagiscono con il tuo assistente.

**1. Metriche di Sessione**
- Sessioni totali: numero di conversazioni
- Messaggi medi per sessione: engagement
- Durata media: tempo di interazione
- Tasso di completamento: sessioni con obiettivo raggiunto

**2. Analisi Domande**
- Domande piu frequenti: topic trending
- Domande senza risposta: knowledge gaps
- Sentiment delle interazioni

**3. Knowledge Gaps**
- Priorita: HIGH (urgente), MEDIUM, LOW
- Esempi di domande non gestite
- Suggerimento di risposta da aggiungere
- Azione: "Aggiungi alla KB" con un click

**4. Lead Capture**
- Lead raccolti: email/contatti acquisiti
- Conversion rate: % sessioni con lead
- Qualita lead: basata su engagement

**5. Performance Bot**
- Tempo di risposta medio
- Accuratezza risposte (se feedback abilitato)
- Escalation rate: richieste di supporto umano

**Azioni consigliate:**
- Risolvi i knowledge gaps ad alta priorita
- Analizza domande frequenti per migliorare FAQ
- Monitora conversion rate per ottimizzare lead capture`,
        category: 'analytics',
        keywords: ['chatbot', 'risultati', 'sessioni', 'gaps', 'lead', 'performance']
    },
    {
        id: 'an-5',
        title: 'Leggere i risultati del Brand Monitor',
        content: `Il Brand Monitor mostra la visibilita del tuo brand nelle risposte AI.

**1. Visibility Score (0-100)**
- 0-30: Bassa visibilita, brand raramente menzionato
- 31-60: Visibilita media, presente ma non dominante
- 61-100: Alta visibilita, brand ben posizionato

**2. Risultati per LLM**
Per ogni provider (OpenAI, Anthropic, Gemini):
- Brand menzionato: Si/No
- Posizione: dove appare nella lista (1 = primo)
- Competitor positions: dove appaiono i concorrenti
- Sentiment: tono della menzione

**3. Analisi Comparativa**
- Grafico radar: confronto con competitor
- Trend nel tempo: evoluzione visibilita
- Gap analysis: dove i competitor vincono

**4. SERP Results**
- Menzioni Google: articoli che parlano del brand
- Sentiment SERP: positivo/negativo/neutro
- Source reputation: affidabilita delle fonti
- Coverage: numero totale di menzioni

**5. Come interpretare:**
- Score alto + posizione bassa = brand noto ma non consigliato
- Score basso + competitor alto = opportunita di miglioramento
- Trend negativo = monitorare e intervenire

**Azioni consigliate:**
- Migliora contenuti se visibilita bassa
- Analizza prompt dove competitor vincono
- Monitora trend settimanali per rilevare cambiamenti`,
        category: 'analytics',
        keywords: ['brand', 'visibility', 'risultati', 'score', 'competitor', 'serp', 'llm']
    },
    {
        id: 'an-6',
        title: 'Esportare e condividere i dati',
        content: `Business Tuner permette di esportare i dati in vari formati.

**Esportazione CSV:**
- Vai nella sezione Analytics del bot/progetto
- Clicca "Esporta" o icona download
- Seleziona periodo e metriche
- Scarica il file CSV

**Contenuto export interviste:**
- ID intervista, data, durata
- Transcript completo
- Sentiment score
- Temi estratti
- Citazioni chiave

**Contenuto export chatbot:**
- Sessioni con timestamp
- Messaggi scambiati
- Knowledge gaps identificati
- Lead raccolti

**Report automatici (Pro+):**
- Report settimanali via email
- Summary esecutivo con KPI
- Trend e anomalie rilevate

**Condivisione:**
- Link pubblici per singole interviste (con consenso)
- Dashboard condivisa per team
- API per integrazione con altri tool

**Privacy:**
- Dati anonimizzati per default
- Opzione di rimuovere PII prima dell'export
- Conformita GDPR`,
        category: 'analytics',
        keywords: ['esportare', 'export', 'csv', 'condividere', 'report', 'download', 'dati']
    },
    {
        id: 'an-7',
        title: 'Filtrare e segmentare i dati',
        content: `I filtri permettono di analizzare sottoinsiemi specifici di dati.

**Filtri disponibili:**

**Per periodo:**
- Ultimi 7/30/90 giorni
- Mese corrente/precedente
- Range personalizzato

**Per sentiment:**
- Solo positivi (score > 0.3)
- Solo negativi (score < -0.3)
- Neutri

**Per tema:**
- Seleziona uno o piu temi
- Escludi temi specifici
- Combina con operatori AND/OR

**Per bot/intervista:**
- Filtra per bot specifico
- Filtra per tipo (intervista vs chatbot)

**Per completamento:**
- Solo completate
- Abbandonate
- In corso

**Segmentazione avanzata (Pro+):**
- Per campo candidato (eta, ruolo, etc.)
- Per fonte di traffico
- Per device (mobile/desktop)

**Come usare i filtri:**
1. Seleziona i filtri desiderati
2. I grafici si aggiornano in tempo reale
3. Esporta i dati filtrati
4. Salva il filtro come "Vista" per riutilizzarlo`,
        category: 'analytics',
        keywords: ['filtrare', 'filtri', 'segmentare', 'periodo', 'sentiment', 'tema', 'dati']
    },

    // Strategy Copilot
    {
        id: 'cop-1',
        title: 'Strategy Copilot',
        content: `Lo Strategy Copilot e un assistente AI avanzato alimentato da Claude 4.5 Opus che ti aiuta a:

**Per tutti gli utenti:**
- Rispondere a domande su come usare Business Tuner
- Spiegare funzionalita, limiti e piani
- Guidare nella configurazione di interviste, chatbot, brand monitor
- Risolvere problemi comuni

**Per piani Pro e superiori:**
- **Esplorare i dati**: cerca nelle conversazioni, trova citazioni, filtra per tema/sentiment
- **Ragionare insieme**: analizza trend, confronta periodi, interpreta risultati
- **Creare contenuti**: genera email, FAQ, report basati sui dati reali del progetto

**Come accedere:**
Clicca sull'icona del Copilot nella sidebar o usa la scorciatoia da tastiera.

**Costi:**
- copilot_message: 20.000 crediti per interazione
- copilot_analysis: 35.000 crediti per analisi approfondita

**Disponibilita per piano:**
- FREE/STARTER: Solo supporto piattaforma
- TRIAL/PRO/BUSINESS/PARTNER: Accesso completo con analisi dati`,
        category: 'copilot',
        keywords: ['copilot', 'strategico', 'assistente', 'ai', 'claude', 'analisi', 'dati']
    },

    // Account & Billing
    {
        id: 'acc-1',
        title: 'Piani e prezzi',
        content: `Business Tuner offre diversi piani:

**Starter** (da 49€/mese):
- 6M crediti/mese
- Interviste e chatbot base
- Analytics base

**Pro** (da 149€/mese):
- 20M crediti/mese
- Brand Monitor (1 brand)
- Strategy Copilot con analisi dati
- Cross-channel insights

**Business** (da 349€/mese):
- 50M crediti/mese
- Brand Monitor (3 brand)
- White label, API, dominio custom
- Supporto prioritario

**Trial** (14 giorni gratuiti):
- 2M crediti
- Accesso a tutte le funzionalita Pro

Tutti i prezzi sono mensili. Sconto 20% con fatturazione annuale.`,
        category: 'account',
        keywords: ['piani', 'prezzi', 'costo', 'abbonamento', 'upgrade', 'starter', 'pro', 'business']
    },
    {
        id: 'acc-2',
        title: 'Gestire l\'abbonamento',
        content: `Per gestire il tuo abbonamento:

1. Vai in "Impostazioni" > "Abbonamento"
2. Qui puoi:
   - Vedere il piano attuale e utilizzo
   - Effettuare upgrade o downgrade
   - Gestire metodi di pagamento
   - Scaricare fatture
   - Annullare (alla fine del periodo)

Per cambio piano contatta il supporto se hai esigenze particolari.

Le fatture sono emesse automaticamente e disponibili nel portale.`,
        category: 'account',
        keywords: ['abbonamento', 'gestire', 'upgrade', 'fatture', 'pagamento', 'annullare']
    },
    {
        id: 'acc-3',
        title: 'Sistema Crediti',
        content: `Business Tuner usa un sistema di crediti unificato per tutte le operazioni AI.

**Come funzionano i crediti:**
Ogni operazione AI consuma crediti in base alla complessita:

| Operazione | Crediti |
|------------|---------|
| Messaggio intervista | ~5.000 |
| Messaggio chatbot | ~3.000 |
| Analisi sentiment | ~8.000 |
| Estrazione temi | ~10.000 |
| Copilot message | 20.000 |
| Copilot analysis | 35.000 |
| Brand scan (per LLM) | ~15.000 |

**Budget mensili per piano:**
- FREE: 500K crediti
- STARTER: 6M crediti
- PRO: 20M crediti
- BUSINESS: 50M crediti
- ADMIN: Illimitati

**Monitoraggio:**
- Dashboard mostra crediti usati/rimanenti
- Notifica automatica al 80% e 95%
- Reset automatico alla data di rinnovo

**Cosa succede a esaurimento:**
- Le funzionalita AI si bloccano
- Puoi fare upgrade o attendere il reset mensile`,
        category: 'account',
        keywords: ['crediti', 'credits', 'limiti', 'utilizzo', 'token', 'quota', 'reset', 'budget']
    },
    {
        id: 'acc-4',
        title: 'Limiti e utilizzo',
        content: `Ogni piano ha limiti specifici oltre ai crediti:

**Limiti per risorsa:**
- Progetti: variano per piano
- Bot per progetto: variano per piano
- Brand monitor: 0 (Starter), 1 (Pro), 3 (Business)
- Membri team: variano per piano

**Cooldown e rate limits:**
- Brand scan manuale: 1 ogni 24 ore
- SERP scan: settimanale automatico
- Chatbot: max messaggi per sessione configurabile

**Monitoraggio utilizzo:**
- Dashboard "Usage" mostra tutti i consumi
- Breakdown per categoria (interviste, chatbot, visibility)
- Storico mensile

**Al raggiungimento limiti:**
- Ricevi notifica
- Funzionalita specifica si blocca
- Upgrade o attendi reset mensile`,
        category: 'account',
        keywords: ['limiti', 'utilizzo', 'quota', 'reset', 'extra', 'cooldown']
    },

    // Troubleshooting
    {
        id: 'tr-1',
        title: 'Il chatbot non risponde correttamente',
        content: `Se il chatbot non risponde bene:

1. **Verifica la knowledge base**:
   - Il contenuto copre l'argomento?
   - Le informazioni sono aggiornate?
   - Ci sono contraddizioni?

2. **Controlla i knowledge gaps**:
   - Vai in Analytics > Knowledge Gaps
   - Aggiungi contenuto per le lacune identificate

3. **Testa manualmente**:
   - Usa la chat di test nel builder
   - Prova diverse formulazioni della domanda

4. **Ottimizza il contenuto**:
   - Scrivi risposte dirette e complete
   - Usa un linguaggio simile a quello degli utenti`,
        category: 'troubleshooting',
        keywords: ['problema', 'chatbot', 'risponde', 'male', 'errore', 'fix']
    },
    {
        id: 'tr-2',
        title: 'Problemi con l\'embed del widget',
        content: `Se il widget non appare sul sito:

1. **Verifica il codice**:
   - E inserito prima di </body>?
   - L'ID del chatbot e corretto?
   - Non ci sono errori di sintassi?

2. **Controlla i domini**:
   - Il dominio e nella whitelist?
   - Vai in Impostazioni > Domini consentiti

3. **Ispeziona la console**:
   - Apri DevTools (F12)
   - Cerca errori JavaScript
   - Verifica che lo script carichi

4. **Cache**:
   - Svuota la cache del browser
   - Prova in modalita incognito`,
        category: 'troubleshooting',
        keywords: ['widget', 'embed', 'non appare', 'errore', 'sito', 'problema']
    },
    {
        id: 'tr-3',
        title: 'Contattare il supporto',
        content: `Per assistenza:

**Email**: support@businesstuner.it
**Orari**: Lun-Ven 9:00-18:00

Quando scrivi, includi:
- Nome del tuo account/organizzazione
- Descrizione dettagliata del problema
- Screenshot se possibile
- Passaggi per riprodurre il problema

Tempi di risposta:
- Starter: 48 ore
- Pro: 24 ore
- Business: 4 ore (prioritario)`,
        category: 'troubleshooting',
        keywords: ['supporto', 'contatto', 'aiuto', 'assistenza', 'email']
    }
];

/**
 * Search the platform knowledge base
 * Simple keyword-based search - in production would use vector embeddings
 */
export async function searchPlatformKB(
    query: string,
    category: string = 'all'
): Promise<KBEntry[]> {
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

    // Filter by category if specified
    const entries = category === 'all'
        ? PLATFORM_KB
        : PLATFORM_KB.filter(e => e.category === category);

    // Score each entry
    const scored = entries.map(entry => {
        let score = 0;

        // Check keywords
        for (const keyword of entry.keywords) {
            if (normalizedQuery.includes(keyword)) {
                score += 10;
            }
            for (const word of queryWords) {
                if (keyword.includes(word) || word.includes(keyword)) {
                    score += 5;
                }
            }
        }

        // Check title
        if (entry.title.toLowerCase().includes(normalizedQuery)) {
            score += 15;
        }
        for (const word of queryWords) {
            if (entry.title.toLowerCase().includes(word)) {
                score += 3;
            }
        }

        // Check content
        for (const word of queryWords) {
            const matches = (entry.content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
            score += matches * 2;
        }

        return { entry, score };
    });

    // Sort by score and filter out zero scores
    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.entry);
}

/**
 * Get all categories available in the KB
 */
export function getKBCategories(): string[] {
    return [...new Set(PLATFORM_KB.map(e => e.category))];
}
