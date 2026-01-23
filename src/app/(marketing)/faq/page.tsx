import { colors } from '@/lib/design-system';

const faqs = [
    {
        question: "Cos'è Business Tuner?",
        answer: "Business Tuner è una piattaforma di business intelligence che ascolta continuativamente clienti, dipendenti e stakeholder. Utilizziamo agenti AI conversazionali per condurre interviste intelligenti, un assistente chatbot per rispondere ai clienti 24/7 e Brand Monitor per tracciare cosa dicono di te i motori AI e il web."
    },
    {
        question: "A chi è rivolto Business Tuner?",
        answer: "A PMI, professionisti e agenzie che vogliono capire meglio il proprio mercato senza spendere budget enterprise. Business Tuner raccoglie feedback da clienti, dipendenti, fornitori e altri stakeholder per offrirti una visione a 360° del tuo ecosistema."
    },
    {
        question: "Come funzionano le interviste intelligenti?",
        answer: "Partendo dal tuo obiettivo di ricerca, l'AI genera automaticamente una struttura di intervista con domande pertinenti. Puoi personalizzare ogni domanda, modificare il tono e aggiungere contesto. Durante l'intervista, l'AI fa domande di approfondimento come farebbe un consulente esperto, raggiungendo un completion rate del 70%+ rispetto ai tradizionali form."
    },
    {
        question: "Cos'è l'Assistente Chatbot?",
        answer: "È un chatbot AI che risponde alle domande dei tuoi clienti 24/7 basandosi sui contenuti del tuo sito e knowledge base. La cosa più importante: ti mostra le domande a cui non ha saputo rispondere (gap detection) e ti suggerisce le risposte da aggiungere. Così sai esattamente cosa manca sul tuo sito."
    },
    {
        question: "Cos'è Brand Monitor?",
        answer: "Brand Monitor traccia cosa dicono di te ChatGPT, Perplexity, Claude e altri motori AI, oltre a Google News, forum e articoli online. Scopri se quando qualcuno chiede un prodotto come il tuo, vieni menzionato o no. Se non vieni menzionato, ti diciamo come migliorare la tua visibilità AI."
    },
    {
        question: "I dati delle interviste sono sicuri?",
        answer: "Sì. Tutti i dati sono cifrati in transito (TLS 1.3) e a riposo (AES-256). I dati non vengono mai utilizzati per addestrare modelli AI esterni. Sei il proprietario esclusivo dei dati raccolti e puoi esportarli o eliminarli in qualsiasi momento. Siamo conformi al GDPR con server in Europa."
    },
    {
        question: "Quanto dura un'intervista tipica?",
        answer: "La durata media è 8-12 minuti. L'AI include un sistema di rilevamento fatica per evitare interviste troppo lunghe e mantenere alta la qualità delle risposte. Puoi impostare una durata stimata che viene comunicata agli utenti."
    },
    {
        question: "Posso usare Business Tuner per ascoltare i dipendenti?",
        answer: "Assolutamente sì. Le interviste intelligenti sono perfette per survey interne, feedback sul clima aziendale, exit interview automatizzate, onboarding assessment. L'AI garantisce anonimato quando richiesto e genera insight aggregati senza esporre risposte individuali."
    },
    {
        question: "Quali sono i limiti dei piani?",
        answer: "FREE: 20 interviste/mese, 1 progetto. STARTER (€49-69/mese): 100 interviste/mese, 1 chatbot, 3 progetti. PRO (€149-199/mese): 400 interviste/mese, 3 chatbot, Brand Monitor, AI Tips. BUSINESS (€299-399/mese): 1.000 interviste/mese, 10 chatbot, Brand Monitor avanzato, Priority Support."
    },
    {
        question: "Offrite trial gratuito?",
        answer: "Sì! 14 giorni gratis con accesso completo a tutte le funzionalità PRO. Nessuna carta di credito richiesta. Puoi annullare in qualsiasi momento senza costi."
    },
    {
        question: "Cosa sono gli AI Tips?",
        answer: "È il nostro Strategic Copilot che analizza tutti i dati raccolti (interviste, chat, menzioni web) e ti suggerisce azioni concrete: aggiungere una FAQ, modificare un prezzo, rispondere a una recensione. Tu approvi con un click e il sistema agisce."
    },
    {
        question: "Come funziona il CMS Automation?",
        answer: "Per i clienti che affidano lo sviluppo del sito a Voler.ai, offriamo l'integrazione CMS Automation: quando l'AI scopre una lacuna o un'opportunità, può aggiornare automaticamente FAQ e contenuti sul sito senza che tu debba toccare codice."
    },
    {
        question: "Posso integrare Business Tuner con altri tool?",
        answer: "Dal piano PRO supportiamo Webhook per inviare dati a sistemi esterni in tempo reale (CRM, Slack, sistemi interni). Il piano BUSINESS include API REST complete per integrazione con i tuoi sistemi aziendali."
    },
    {
        question: "Supportate lingue diverse dall'italiano?",
        answer: "Sì. Le interviste e il chatbot possono essere configurati in qualsiasi lingua supportata dai modelli AI (oltre 50 lingue). L'AI si adatta automaticamente alla lingua per generare domande, risposte e analisi nella lingua corretta."
    },
    {
        question: "Avete piani enterprise?",
        answer: "Sì, per volumi superiori o esigenze particolari (SSO, SLA garantito, account manager dedicato) contattaci per un preventivo personalizzato."
    }
];

export default function FAQPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4" style={{ color: colors.text }}>Domande frequenti</h1>
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
