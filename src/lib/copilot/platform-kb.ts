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

    // Visibility Tracker
    {
        id: 'vis-1',
        title: 'Cos\'e il Visibility Tracker',
        content: `Il Visibility Tracker monitora come il tuo brand appare nelle risposte degli AI (ChatGPT, Claude, Perplexity, etc.).

Funzionalita:
- Traccia la menzione del tuo brand in prompt specifici
- Confronta con i competitor
- Analizza il sentiment delle menzioni
- Monitora l'evoluzione nel tempo

Questo ti aiuta a capire quanto sei "visibile" nel nuovo mondo delle ricerche AI.`,
        category: 'visibility',
        keywords: ['visibility', 'visibilita', 'brand', 'monitor', 'AI', 'menzioni']
    },
    {
        id: 'vis-2',
        title: 'Configurare il Visibility Tracker',
        content: `Per configurare il Visibility Tracker:

1. Vai in "Visibility Tracker" dalla sidebar
2. Clicca "Nuovo Brand"
3. Inserisci:
   - Nome del brand
   - Categoria/settore
   - Descrizione (cosa fa il brand)
   - Competitor da monitorare

4. Aggiungi i prompt da testare:
   - Puoi scriverli manualmente
   - O generarli automaticamente con AI

5. Avvia la prima scansione

I risultati mostreranno quanto spesso il tuo brand viene menzionato rispetto ai competitor.`,
        category: 'visibility',
        keywords: ['configurare', 'brand', 'competitor', 'prompt', 'scansione']
    },

    // Analytics
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

    // Account & Billing
    {
        id: 'acc-1',
        title: 'Piani e prezzi',
        content: `Business Tuner offre diversi piani:

**Starter** (da 49/mese):
- 5 interviste attive, 300 risposte/mese
- 1 chatbot, 2.000 sessioni
- Analytics base

**Pro** (da 149/mese):
- 15 interviste, 1.000 risposte
- 3 chatbot, 10.000 sessioni
- 1 Visibility Tracker
- Strategy Copilot con analisi dati

**Business** (da 349/mese):
- Interviste illimitate, 3.000 risposte
- 10 chatbot, 30.000 sessioni
- 3 Visibility Tracker
- White label, API, dominio custom

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
        title: 'Limiti e utilizzo',
        content: `Ogni piano ha limiti specifici:

**Come funzionano i limiti**:
- Token: budget mensile per chiamate AI
- Risposte: numero di interviste completate
- Sessioni chatbot: conversazioni con il chatbot
- Scansioni visibility: query ai modelli AI

I contatori si resettano ogni mese alla data di rinnovo.

**Cosa succede al raggiungimento**:
- Ricevi una notifica
- Le funzionalita correlate si bloccano
- Puoi acquistare pacchetti extra o fare upgrade

Monitora l'utilizzo dalla dashboard "Usage" per evitare sorprese.`,
        category: 'account',
        keywords: ['limiti', 'utilizzo', 'token', 'quota', 'reset', 'extra']
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
    let entries = category === 'all'
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
