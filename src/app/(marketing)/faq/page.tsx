import { colors } from '@/lib/design-system';

const faqs = [
    {
        question: "Cos'è Business Tuner?",
        answer: "Business Tuner è una piattaforma di Customer Research automatizzata. Utilizziamo agenti AI avanzati per condurre interviste qualitative in profondità con i tuoi clienti o target audience, analizzando poi le risposte per fornirti insight strategici."
    },
    {
        question: "Come funzionano le interviste simulate?",
        answer: "Il nostro simulatore ti permette di testare il flusso dell'intervista prima di inviarla a persone reali. L'AI interpreta il ruolo di un tuo cliente tipo (persona) e risponde alle domande, permettendoti di affinare l'obiettivo e il tono."
    },
    {
        question: "Le risposte sono private?",
        answer: "Assolutamente sì. I dati raccolti sono tuoi e non vengono condivisi con terze parti per scopi commerciali. I modelli AI processano i dati solo per generare le interviste e le analisi, ma non vengono addestrati sui tuoi dati specifici."
    },
    {
        question: "Quanto dura un'intervista media?",
        answer: "Dipende dalla configurazione, ma generalmente un'intervista dura tra 5 e 15 minuti. L'AI si adatta al ritmo dell'utente, andando in profondità solo quando necessario e mantenendo la conversazione fluida."
    },
    {
        question: "Posso esportare i dati?",
        answer: "Sì, puoi esportare tutte le trascrizioni e i report di analisi in vari formati (CSV, PDF) direttamente dalla tua dashboard."
    },
    {
        question: "Quanto costa?",
        answer: "Offriamo un piano gratuito per iniziare e piani Pro per esigenze più avanzate. Visita la nostra pagina Prezzi per tutti i dettagli."
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
