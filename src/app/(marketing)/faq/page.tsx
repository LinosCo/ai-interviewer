import { colors } from '@/lib/design-system';

const faqs = [
    {
        question: "Cos'è Business Tuner?",
        answer: "Business Tuner è una piattaforma di ricerca qualitativa automatizzata. Utilizziamo agenti AI conversazionali per condurre interviste in profondità con clienti, dipendenti o stakeholder, analizzando poi le risposte per estrarre temi ricorrenti, sentiment e insight strategici. Sostituisce i tradizionali questionari con conversazioni naturali guidate dall'AI."
    },
    {
        question: "Come funziona la generazione automatica delle interviste?",
        answer: "Partendo dal tuo obiettivo di ricerca e target audience, la nostra AI genera automaticamente una struttura di intervista con domande pertinenti organizzate per topic. Puoi personalizzare ogni domanda, modificare il tono, aggiungere una Knowledge Base di contesto, e testare il flusso prima di pubblicarlo. L'AI si adatta dinamicamente alle risposte dell'utente per approfondire aspetti rilevanti."
    },
    {
        question: "I dati delle interviste sono sicuri e privati?",
        answer: "Sì. Tutti i dati sono cifrati in transito (TLS 1.3) e a riposo (AES-256). Le API keys sono crittografate nel database. I dati non vengono mai utilizzati per addestrare modelli AI esterni. Sei il proprietario esclusivo dei dati raccolti e puoi esportarli o eliminarli in qualsiasi momento. Siamo conformi al GDPR con Data Processing Agreement (DPA) disponibile su richiesta."
    },
    {
        question: "Quali LLM supportate?",
        answer: "Supportiamo OpenAI (GPT-4, GPT-4 Turbo) e Anthropic (Claude 3.5 Sonnet). Puoi scegliere il modello per ogni bot. Inoltre, puoi utilizzare le tue API keys personali per controllo completo su costi e compliance, oppure usare le nostre chiavi condivise (incluse nei piani a pagamento)."
    },
    {
        question: "Quanto dura un'intervista tipica?",
        answer: "La durata media è 8-12 minuti, ma varia in base alla configurazione. Puoi impostare una durata stimata (es. '10 minuti') che viene comunicata agli utenti. L'AI include un sistema di fatigue detection per evitare interviste troppo lunghe e mantenere alta la qualità delle risposte."
    },
    {
        question: "Posso personalizzare il branding?",
        answer: "Sì. Dal piano PRO in poi puoi: aggiungere il tuo logo, personalizzare colori primari e background, creare landing page custom per ogni intervista, rimuovere il watermark Business Tuner. Il piano BUSINESS include anche white-label completo e custom domain."
    },
    {
        question: "Come funziona l'analisi AI?",
        answer: "Dopo ogni intervista, l'AI genera automaticamente: (1) Summary della conversazione, (2) Sentiment score (0-100), (3) Key quotes estratte, (4) Topic coverage per ogni area esplorata. A livello aggregato su tutte le interviste, identifica temi ricorrenti, pattern comuni e genera insight strategici. L'analisi è disponibile da piano STARTER in poi."
    },
    {
        question: "Supportate la modalità Data Collection per recruitment?",
        answer: "Sì. Puoi attivare la modalità 'Data Collection' per raccogliere profili strutturati (es. candidati per posizioni lavorative, lead qualificati). L'AI estrae automaticamente competenze, esperienze e informazioni rilevanti dalle risposte, salvandole in campi strutturati esportabili. Ideale per HR e team sales."
    },
    {
        question: "Posso integrare Business Tuner con altri tool?",
        answer: "Sì. Dal piano PRO supportiamo Webhook per inviare dati a sistemi esterni in tempo reale (es. CRM, Slack). Il piano BUSINESS include anche export CSV automatico. API pubblica e integrazione Zapier sono in roadmap ma non ancora disponibili."
    },
    {
        question: "Quali sono i limiti dei vari piani?",
        answer: "STARTER: 100 risposte/mese, 3 bot attivi, 1 utente. PRO: 300 risposte/mese, 10 bot attivi, 5 utenti, Knowledge Base, Custom branding. BUSINESS: 1000+ risposte/mese, bot illimitati, 15 utenti, White label, Webhook. Tutti i piani includono analytics AI e export PDF. Vedi la pagina Pricing per dettagli completi."
    },
    {
        question: "Offrite trial gratuito?",
        answer: "Sì, tutti i piani offrono 14 giorni di prova gratuita senza carta di credito. Durante il trial hai accesso completo alle funzionalità del piano scelto. Puoi annullare in qualsiasi momento senza costi."
    },
    {
        question: "Come gestiamo il consenso GDPR nelle interviste?",
        answer: "Ogni intervista include un checkbox obbligatorio di consenso privacy che l'utente deve accettare prima di iniziare. Puoi personalizzare il testo della privacy notice per ogni bot. Gli utenti hanno sempre il diritto di richiedere accesso, modifica o cancellazione dei propri dati. Forniamo strumenti self-service per gestire DSAR (Data Subject Access Requests)."
    },
    {
        question: "Posso usare Business Tuner per ricerca accademica?",
        answer: "Assolutamente sì. Business Tuner è ideale per ricerca qualitativa in ambito accademico, sociologia, UX research. Garantiamo anonimizzazione dei dati quando richiesto e forniamo export completi per analisi esterne. Per progetti accademici di grandi dimensioni, contattaci per piani personalizzati."
    },
    {
        question: "Supportate lingue diverse dall'italiano?",
        answer: "Sì. Le interviste possono essere configurate in qualsiasi lingua supportata dai modelli LLM (oltre 50 lingue). L'interfaccia admin è attualmente disponibile in italiano e inglese. L'AI si adatta automaticamente alla lingua dell'intervista per generare domande e analisi nella lingua corretta."
    }
];

export default function FAQPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4" style={{ color: colors.text }}>Domande Frequenti</h1>
                <p className="text-xl text-gray-500">Tutto quello che devi sapere su Business Tuner</p>
            </div>

            <div className="space-y-6">
                {faqs.map((faq, index) => (
                    <div
                        key={index}
                        className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <h3 className="text-lg font-bold mb-2" style={{ color: colors.text }}>{faq.question}</h3>
                        <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
