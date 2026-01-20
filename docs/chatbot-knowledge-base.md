# Business Tuner - Knowledge Base per Chatbot di Assistenza

Questa documentazione contiene tutte le informazioni necessarie per assistere gli utenti nell'utilizzo della piattaforma Business Tuner.

---

## Panoramica della Piattaforma

**Business Tuner** è una piattaforma di ricerca qualitativa AI-powered che permette alle aziende di:
- Creare interviste automatizzate per raccogliere feedback
- Implementare chatbot intelligenti per l'assistenza clienti
- Monitorare la visibilità del brand sugli LLM e su Google
- Ottenere insight cross-channel integrati

---

## 1. Dashboard Principale

### Accesso
La dashboard è accessibile dopo il login all'indirizzo `/dashboard`.

### Elementi Principali

#### Banner di Stato Abbonamento
- **Trial attivo**: Mostra i giorni rimanenti del periodo di prova
- **Pagamento scaduto**: Avviso per aggiornare il metodo di pagamento
- **Upgrade disponibile**: Suggerimento per passare a un piano superiore

#### Statistiche di Utilizzo
La dashboard mostra 4 card con le statistiche principali:

1. **Interviste Mensili**: Numero di interviste utilizzate rispetto al limite del piano
2. **Bot Attivi**: Numero di bot creati rispetto al limite del piano
3. **Budget Token AI**: Utilizzo del budget token con indicatore colorato
4. **Acquista Pacchetto**: Pulsante per acquistare crediti aggiuntivi

#### Azioni Rapide
- **Crea Nuova Intervista**: Avvia il wizard di creazione intervista
- **Crea Nuovo Chatbot**: Avvia il wizard di creazione chatbot
- **Sfoglia Template**: Accedi alla libreria di template predefiniti

#### Attività Recenti
Mostra le ultime 5 conversazioni completate con:
- Nome del bot
- Data e ora
- Stato della conversazione

---

## 2. Sezione Interviste

### Pagina Lista Interviste (`/dashboard/interviews`)

Questa sezione mostra tutte le interviste create con:
- **Statistiche globali**: Totale interviste, risposte totali, risposte completate
- **Lista interviste**: Ogni intervista mostra nome, descrizione e numero di conversazioni
- **Pulsante "Nuova Intervista"**: Avvia la creazione guidata

### Come Creare una Nuova Intervista

1. Clicca su "Nuova Intervista" o vai su `/onboarding`
2. **Metodo 1 - Descrivi il tuo obiettivo**:
   - Scrivi cosa vuoi capire (es. "Perché i clienti non completano l'acquisto")
   - Clicca "Genera la mia intervista"
   - L'AI creerà automaticamente la struttura dell'intervista

3. **Metodo 2 - Usa un template**:
   - Clicca "Usa un template"
   - Scegli tra le categorie disponibili (B2B, B2C, HR, Ops)
   - Personalizza il template generato

### Configurazione Intervista (`/dashboard/bots/[botId]`)

#### Impostazioni Base
- **Nome**: Nome identificativo dell'intervista
- **Lingua**: Lingua dell'intervista (Italiano, Inglese, ecc.)
- **Tono e Persona**: Stile comunicativo del bot (Professionale, Amichevole, ecc.)
- **Messaggio di Benvenuto**: Testo introduttivo mostrato all'utente
- **Obiettivo di Ricerca**: Descrizione dello scopo dell'intervista
- **Target Audience**: Chi sono i partecipanti ideali
- **Durata Massima**: Limite di tempo per l'intervista
- **Fase di Warmup**: Abilita/disabilita domande iniziali di riscaldamento

#### Raccolta Dati Candidato
Quando abilitata, permette di raccogliere:
- Nome
- Email
- Telefono
- Azienda
- LinkedIn
- Portfolio
- Ruolo
- Località
- Budget
- Disponibilità

#### Impostazioni Avanzate
- **Provider Modello**: Scegli tra OpenAI o Anthropic
- **Modello Specifico**: GPT-4o, Claude 3.5 Sonnet, o1, ecc.
- **Chiavi API Personalizzate**: Usa le tue chiavi API invece di quelle della piattaforma

#### Editor Landing Page/Branding (PRO)
- **Logo Personalizzato**: Carica il logo aziendale
- **Colori del Brand**: Personalizza la palette colori
- **Testi Personalizzati**: Modifica messaggi di benvenuto e introduzione

#### Editor Argomenti/Flusso Conversazione
Per ogni argomento puoi configurare:
- **Etichetta**: Nome dell'argomento
- **Descrizione**: Contesto per l'AI
- **Sotto-obiettivi**: Obiettivi specifici da esplorare
- **Domande Chiave**: Domande da porre
- **Turni Massimi**: Quante interazioni per argomento
- **Logica Condizionale** (PRO): Mostra argomenti in base a risposte precedenti

#### Knowledge Base
Aggiungi fonti di conoscenza:
- **Documenti**: Carica PDF, Word, TXT
- **Siti Web**: Inserisci URL da scansionare
- **Testo Libero**: Incolla contenuti direttamente
- **FAQ**: Domande e risposte frequenti

#### Impostazioni Privacy/Legali
- **Informativa Privacy**: Testo sulla gestione dati
- **Disclaimer Utilizzo Dati**: Come verranno usati i dati
- **Testo Consenso**: Richiesta di consenso esplicito
- **Livello Anonimizzazione**: Quanto anonimizzare i dati
- **Mostra Info Anonimato**: Informare l'utente dell'anonimizzazione

#### Configurazione Reward
- **Abilita Reward**: Attiva incentivi per la partecipazione
- **Codici Sconto**: Gestisci codici regalo
- **Gift Card**: Configura premi automatici

### Analytics Interviste (`/dashboard/bots/[botId]/analytics`)

La pagina analytics mostra:
- **Panoramica Sessioni**: Statistiche generali
- **Analisi Temi**: Argomenti più discussi e sentiment
- **Trascrizioni**: Accesso alle conversazioni complete
- **Knowledge Gaps**: Domande senza risposta rilevate
- **Estrazione Insight**: Punti chiave emersi dalle interviste

### Knowledge Gaps (`/dashboard/bots/[botId]/knowledge-gaps`)

Questa sezione mostra le domande a cui il bot non ha saputo rispondere:
- **Priorità**: Alta, Media, Bassa
- **Azioni disponibili**:
  - **Approva**: Converti in FAQ
  - **Ignora**: Rimuovi dalla lista

### Profili Candidati (`/dashboard/bots/[botId]/profiles`)

Visualizza i dati raccolti dai partecipanti:
- Lista completa dei profili
- Dettagli per ogni candidato
- Data di completamento
- Esporta in CSV

### Claims/Richieste Premio (`/dashboard/bots/[botId]/claims`)

Traccia le richieste di premio:
- Data della richiesta
- Informazioni utente
- Codice di riscatto
- Link alla conversazione

---

## 3. Sezione Chatbot

### Pagina Lista Chatbot (`/dashboard/bots`)

Mostra tutti i chatbot con:
- Griglia di card
- Nome e descrizione
- Stato (attivo/disattivo)
- Numero di conversazioni
- Pulsanti: "Embed" e "Gestisci"

### Creare un Nuovo Chatbot

#### Wizard di Creazione (`/dashboard/bots/create-chatbot`)

**Step 1 - Generazione Prompt**
- L'AI genera una configurazione iniziale basata sul tuo input
- Descrivi lo scopo del chatbot

**Step 2 - Configurazione**
- Nome del chatbot
- Descrizione
- Selezione del modello AI

**Step 3 - Knowledge Base**
- Carica documenti (PDF, Word, TXT)
- Aggiungi URL di siti web da scansionare
- Incolla contenuti testuali

**Step 4 - Confini**
- Definisci cosa il chatbot può/non può fare
- Imposta limitazioni nelle risposte
- Configura risposte di fallback

**Step 5 - Raccolta Lead**
- Abilita/disabilita raccolta dati
- Scegli quali campi raccogliere
- Configura quando chiedere i dati

**Step 6 - Anteprima e Pubblicazione**
- Testa il chatbot
- Verifica le risposte
- Pubblica quando pronto

### Embed del Chatbot (`/dashboard/bots/[botId]/embed`)

Per integrare il chatbot nel tuo sito:

1. Vai alla pagina Embed del chatbot
2. Copia il codice di embed fornito
3. Incolla il codice prima del tag `</body>` del tuo sito

```html
<script src="https://tuodominio.com/widget/[botId].js" async></script>
```

#### Anteprima Widget (`/dashboard/bots/[botId]/widget`)
- Visualizza il chatbot come apparirà sul sito
- Testa le interazioni in tempo reale

---

## 4. Sezione Progetti

### Pagina Progetti (`/dashboard/projects`)

I progetti permettono di organizzare bot e configurazioni:
- **Griglia progetti**: Visualizza tutti i progetti
- **Badge "Condiviso"/"Proprietario"**: Indica il tipo di accesso
- **Statistiche**: Numero bot, tracker visibilità, membri team
- **Azioni**: Apri, Impostazioni

### Creare un Nuovo Progetto

1. Clicca "Nuovo Progetto"
2. Inserisci nome e descrizione
3. Il progetto viene creato e puoi iniziare ad aggiungervi bot

### Cockpit Progetto (`/dashboard/projects/[projectId]`)

Vista unificata del progetto:

#### Sezione Interviste
- Lista di tutte le interviste nel progetto
- Pulsante per crearne di nuove
- Conteggio conversazioni per intervista

#### Sezione Chatbot
- Lista di tutti i chatbot nel progetto
- Pulsante per crearne di nuovi
- Conteggio sessioni per bot

#### Sezione Monitoraggio Visibilità
- Tracker attivi
- Punteggi di visibilità brand
- Stato tracking competitor

#### Sidebar Info Progetto
- Proprietario del progetto
- Lista membri del team
- Pulsante "Gestisci Team"

### Impostazioni Progetto (`/dashboard/projects/[projectId]/settings`)

#### Gestione Accessi
- **Condividi con il team**: Aggiungi membri tramite email
- **Permessi**: Imposta livelli di accesso
- **Rimuovi accesso**: Revoca permessi a membri

#### Configurazione Base (Coming Soon)
- Rinomina progetto
- Elimina progetto

### Analytics Progetto (`/dashboard/projects/[projectId]/analytics`)

Analytics unificato per tutti i bot del progetto:
- Metriche aggregate
- Confronti tra bot
- Filtri per tipo di bot
- Insight cross-bot

---

## 5. Monitoraggio Visibilità

### Pagina Principale (`/dashboard/visibility`)

Due tab principali:

#### Tab "Visibilità LLM"
Monitora come il tuo brand appare nelle risposte degli LLM:
- **Punteggi per piattaforma**: Google Gemini, ChatGPT, Claude, Perplexity
- **Percentuale menzioni**: Quanto spesso il brand viene citato
- **Analisi sentiment**: Tono delle menzioni
- **Posizionamento competitor**: Confronto con la concorrenza

#### Tab "Google News"
Monitora le menzioni su Google:
- **SERP Monitoring**: Ricerche Google relative al brand
- **News Tracking**: Articoli e notizie
- **Analisi automatica**: Sentiment e importanza

#### Sidebar Cronologia Scansioni
- Ultime 10 scansioni
- Data e ora
- Punteggio (badge colorato)
- Click per visualizzare risultati specifici

#### Azioni Disponibili
- **Impostazioni**: Configura il monitoraggio
- **Esegui Scansione**: Avvia analisi manuale

### Wizard Setup Visibilità (`/dashboard/visibility/create`)

**Step 1 - Info Brand**
- Nome del brand
- Categoria/settore
- Descrizione attività
- Lingua principale
- Territorio di riferimento

**Step 2 - Prompt di Monitoraggio**
- Genera prompt automaticamente
- Modifica e affina i prompt
- Aggiungi prompt personalizzati

**Step 3 - Competitor**
- Aggiungi brand concorrenti
- Nome e descrizione competitor
- Rimuovi competitor non più rilevanti

**Step 4 - Revisione**
- Verifica configurazione completa
- Salva e avvia prima scansione

---

## 6. Insight Cross-Channel

### Hub Insight (`/dashboard/insights`)

#### Card Valutazione Salute
Tre metriche principali con punteggio 0-100:

1. **Soddisfazione Chatbot**
   - Score basato sul sentiment utenti
   - Trend (in miglioramento/peggioramento)
   - Riepilogo feedback

2. **Efficacia Sito Web**
   - Il sito risponde alle domande emerse?
   - Colma le lacune del chatbot?
   - Trend e feedback

3. **Visibilità Brand**
   - Combinazione LLM + Google
   - Sentiment menzioni online
   - Trend e analisi

#### Insight Cross-Channel
Per ogni insight:
- **Topic**: Argomento analizzato
- **Score Cross-Channel**: Correlazione tra fonti
- **Priorità**: Alta, Media, Bassa
- **Azioni Suggerite**: Con spiegazione del reasoning

#### Azioni Suggerite
Tipi di azione:
- **create_content**: Crea nuovi contenuti sul sito
- **modify_content**: Modifica contenuti esistenti
- **add_faq**: Aggiungi FAQ al chatbot
- **add_interview_topic**: Esplora nuovo argomento nelle interviste
- **add_visibility_prompt**: Monitora nuove query sugli LLM
- **respond_to_press**: Risposta a notizie/PR
- **monitor_competitor**: Monitora attività competitor

#### Sincronizza Insight
- Pulsante per aggiornare i dati
- Raccoglie dati da tutte le fonti
- Genera nuovi insight con AI

---

## 7. Template

### Libreria Template (`/dashboard/templates`)

Template predefiniti per diverse esigenze:

#### Categorie Disponibili
- **B2B**: Ricerche per aziende business-to-business
- **B2C**: Ricerche consumer
- **HR**: Ricerche risorse umane
- **Prodotto**: Feedback su prodotti
- **Customer Experience**: Esperienza cliente

#### Ogni Template Include
- Icona e badge categoria
- Nome e descrizione
- Dimensioni di analisi preconfigurate
- Struttura ottimale dell'intervista
- Framework domande
- Best practice di settore

#### Come Usare un Template
1. Sfoglia la libreria
2. Clicca "Crea da template"
3. Personalizza secondo le tue esigenze
4. Pubblica l'intervista

---

## 8. Impostazioni

### Impostazioni Utente (`/dashboard/settings`)

#### Chiavi API
Configura le tue chiavi API per:
- **OpenAI**: Per modelli GPT
- **Anthropic**: Per modelli Claude
- **Google Gemini**: Per modelli Google

#### Metodologia Interviste
- Editor della conoscenza metodologica
- Personalizzazione dei prompt globali
- Configurazioni che si applicano a tutti i bot

### Fatturazione (`/dashboard/billing`)

#### Piano Corrente
- Nome del piano attivo
- Stato abbonamento
- Limiti:
  - Risposte al mese
  - Bot attivi
  - Utenti

#### Azioni Fatturazione
- **Cambia abbonamento**: Upgrade/downgrade
- **Aggiorna metodo pagamento**: Modifica carta
- **Storico fatture**: Visualizza pagamenti passati

#### Benefici Piano PRO
- Analytics avanzato
- Export dati e webhook
- Branding personalizzato
- Logica condizionale

### Piani Disponibili (`/dashboard/billing/plans`)

| Funzionalità | Trial | Starter | PRO | Enterprise |
|-------------|-------|---------|-----|------------|
| Interviste | Limitate | Base | Illimitate | Custom |
| Chatbot | Base | Standard | Avanzato | Custom |
| Branding | No | No | Sì | Sì |
| Analytics | Base | Standard | Avanzato | Custom |
| Logica Condizionale | No | No | Sì | Sì |
| Export/Webhook | No | No | Sì | Sì |
| Supporto | Community | Email | Prioritario | Dedicato |

**Risparmia il 20%** con fatturazione annuale.

---

## 9. Amministrazione (Solo Admin)

### Gestione Utenti (`/dashboard/admin/users`)
- Lista completa utenti
- Assegnazione progetti
- Gestione ruoli
- Controllo accessi

### Gestione Progetti (`/dashboard/admin/projects`)
- Panoramica globale progetti
- Gestione centralizzata
- Assegnazioni utenti
- Metriche organizzazione

---

## 10. Domande Frequenti (FAQ)

### Account e Accesso

**Come posso recuperare la password?**
Dalla pagina di login, clicca "Password dimenticata?" e inserisci la tua email. Riceverai un link per reimpostare la password.

**Come cambio la mia email?**
Attualmente non è possibile cambiare l'email autonomamente. Contatta il supporto per assistenza.

**Come invito membri del team?**
Vai nelle impostazioni del progetto → Gestione Accessi → Aggiungi membro tramite email.

### Interviste

**Quante domande può avere un'intervista?**
Non c'è un limite fisso. Puoi configurare il numero di turni per ogni argomento.

**Posso modificare un'intervista dopo averla pubblicata?**
Sì, puoi modificare la configurazione in qualsiasi momento. Le modifiche si applicano alle nuove conversazioni.

**Come vedo le risposte raccolte?**
Vai su Analytics dell'intervista → Trascrizioni per vedere tutte le conversazioni.

**Posso esportare i dati delle interviste?**
Sì, dalla sezione Profili puoi esportare in formato CSV (funzione PRO).

### Chatbot

**Quanto tempo ci vuole per addestrare un chatbot?**
La configurazione iniziale richiede pochi minuti. L'elaborazione della knowledge base dipende dalla quantità di contenuti.

**Il chatbot può rispondere in più lingue?**
Sì, il chatbot risponde nella lingua configurata e può gestire conversazioni multilingua se la knowledge base lo supporta.

**Come miglioro le risposte del chatbot?**
Controlla i Knowledge Gaps per vedere le domande senza risposta e aggiungi le informazioni mancanti alla knowledge base.

**Posso usare il chatbot su più siti?**
Sì, il codice embed può essere inserito su qualsiasi sito web.

### Visibilità

**Quanto spesso vengono aggiornati i dati di visibilità?**
Le scansioni automatiche avvengono settimanalmente. Puoi eseguire scansioni manuali in qualsiasi momento.

**Cosa significano i punteggi di visibilità?**
Il punteggio indica quanto spesso e in che modo il tuo brand viene menzionato dagli LLM (0-100, dove 100 è massima visibilità positiva).

**Posso monitorare i competitor?**
Sì, nella configurazione visibilità puoi aggiungere brand competitor per confrontare i risultati.

### Fatturazione

**Come posso fare upgrade del piano?**
Vai su Fatturazione → Cambia abbonamento e seleziona il nuovo piano.

**Cosa succede se supero i limiti del piano?**
Riceverai un avviso e alcune funzionalità potrebbero essere limitate fino all'upgrade o al reset mensile.

**Posso richiedere un rimborso?**
Contatta il supporto entro 14 giorni dall'acquisto per richiedere un rimborso.

**Come cancello l'abbonamento?**
Vai su Fatturazione → Gestisci abbonamento → Cancella. Manterrai l'accesso fino alla fine del periodo pagato.

---

## 11. Risoluzione Problemi

### Il chatbot non risponde correttamente

1. **Verifica la Knowledge Base**: Assicurati che le informazioni siano presenti
2. **Controlla i Knowledge Gaps**: Potrebbero esserci domande frequenti non coperte
3. **Aggiorna i contenuti**: Aggiungi FAQ specifiche per le domande problematiche
4. **Verifica le impostazioni**: Controlla che il modello AI sia configurato correttamente

### La scansione visibilità non funziona

1. **Verifica la configurazione**: Assicurati che brand e prompt siano configurati
2. **Controlla le chiavi API**: Alcune scansioni richiedono chiavi API valide
3. **Riprova più tardi**: I servizi esterni potrebbero essere temporaneamente non disponibili

### Non riesco a creare nuovi bot

1. **Verifica i limiti del piano**: Potresti aver raggiunto il limite di bot attivi
2. **Controlla l'abbonamento**: Assicurati che l'abbonamento sia attivo
3. **Fai upgrade**: Passa a un piano con più bot disponibili

### Le analytics non mostrano dati

1. **Attendi le conversazioni**: I dati appaiono dopo le prime interazioni
2. **Verifica il periodo**: Controlla il filtro temporale selezionato
3. **Sincronizza**: Usa il pulsante di sincronizzazione se disponibile

### Problemi con l'embed del chatbot

1. **Verifica il codice**: Assicurati di aver copiato tutto il codice embed
2. **Posizione corretta**: Il codice deve essere prima di `</body>`
3. **Cache del browser**: Svuota la cache e ricarica la pagina
4. **Console errori**: Controlla la console del browser per errori JavaScript

---

## 12. Contatti e Supporto

Per assistenza:
- **Email**: support@businesstuner.com
- **Documentazione**: docs.businesstuner.com
- **Status sistema**: status.businesstuner.com

**Orari supporto**: Lun-Ven, 9:00-18:00 (CET)

---

## Glossario

| Termine | Definizione |
|---------|-------------|
| **Bot** | Un'intervista automatizzata o un chatbot creato sulla piattaforma |
| **Conversazione** | Una sessione di interazione tra un utente e un bot |
| **Knowledge Base** | Insieme di documenti e informazioni che il bot usa per rispondere |
| **Knowledge Gap** | Domanda a cui il bot non ha saputo rispondere |
| **LLM** | Large Language Model - modelli AI come GPT-4 o Claude |
| **SERP** | Search Engine Results Page - pagina risultati di Google |
| **Prompt** | Istruzione o domanda inviata a un modello AI |
| **Visibilità** | Quanto e come il brand appare nelle risposte AI e ricerche |
| **Insight** | Analisi e conclusioni derivate dai dati raccolti |
| **Webhook** | Notifica automatica inviata a un URL esterno |
| **Embed** | Codice per integrare il chatbot in un sito web |
| **Template** | Configurazione predefinita per creare interviste rapidamente |

---

*Documento aggiornato: Gennaio 2026*
*Versione: 1.0*
