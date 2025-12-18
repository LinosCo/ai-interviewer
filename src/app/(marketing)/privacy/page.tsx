import { redirect } from 'next/navigation';

export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4">Ultimo aggiornamento: Dicembre 2025</p>
            <div className="prose prose-stone">
                <p>
                    Questa Privacy Policy descrive come Business Tuner ("noi", "ci" o "nostro") raccoglie, utilizza e condivide le tue informazioni personali quando utilizzi il nostro servizio. Ci impegniamo a proteggere la tua privacy e a garantire la trasparenza nel trattamento dei dati, in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR).
                </p>
                <h2 className="text-xl font-semibold mt-8 mb-4">1. Titolare del Trattamento</h2>
                <p>
                    Il titolare del trattamento dei dati è Business Tuner. Per qualsiasi domanda relativa alla presente Informativa, puoi contattarci all'indirizzo email privacy@businesstuner.it.
                </p>
                <h2 className="text-xl font-semibold mt-8 mb-4">2. Informazioni che raccogliamo</h2>
                <p className="mb-4">Raccogliamo le seguenti tipologie di informazioni:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                    <li><strong>Dati dell'Account:</strong> Indirizzo email, nome e cognome forniti durante la registrazione.</li>
                    <li><strong>Dati Fiscali:</strong> Ragione sociale, P.IVA, Codice Fiscale, indirizzo di fatturazione, Codice SDI e PEC per l'adempimento degli obblighi di legge (Fatturazione Elettronica).</li>
                    <li><strong>Dati di Utilizzo:</strong> Informazioni su come interagisci con la piattaforma, inclusi indirizzi IP, tipo di browser e pagine visitate.</li>
                    <li><strong>Dati delle Interviste:</strong> Trascrizioni delle interviste, risposte fornite dagli utenti e analisi generate dall'AI.</li>
                </ul>
                <h2 className="text-xl font-semibold mt-8 mb-4">3. Utilizzo dell'Intelligenza Artificiale</h2>
                <p className="mb-4">
                    Il nostro servizio utilizza modelli di linguaggio avanzati (LLM) forniti da terze parti (come OpenAI e Anthropic) per generare domande e analizzare risposte.
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                    <li>I dati inviati all'AI sono minimizzati e anonimizzati ove possibile.</li>
                    <li>I nostri partner AI non utilizzano i dati delle tue interviste per addestrare i propri modelli globali, grazie ad accordi enterprise.</li>
                </ul>
                <h2 className="text-xl font-semibold mt-8 mb-4">4. Base Giuridica del Trattamento</h2>
                <p>
                    Trattiamo i tuoi dati sulla base del consenso fornito durante la creazione dell'account e l'accettazione esplicita durante l'avvio di ogni intervista, nonché per l'adempimento di obblighi contrattuali.
                </p>
                <h2 className="text-xl font-semibold mt-8 mb-4">5. Conservazione dei Dati</h2>
                <p>
                    Conserviamo i dati finché il tuo account è attivo o secondo quanto necessario per fornirti i nostri servizi. Puoi richiedere la cancellazione dei tuoi dati in qualsiasi momento tramite le impostazioni del profilo o contattando il supporto.
                </p>
                <h2 className="text-xl font-semibold mt-8 mb-4">6. I Tuoi Diritti (GDPR)</h2>
                <p className="mb-4">Ai sensi del GDPR, hai il diritto di:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                    <li>Accedere ai tuoi dati personali.</li>
                    <li>Rettificare o cancellare i tuoi dati.</li>
                    <li>Opporti al trattamento o richiederne la limitazione.</li>
                    <li>Richiedere la portabilità dei dati.</li>
                </ul>
                <h2 className="text-xl font-semibold mt-8 mb-4">7. Sicurezza</h2>
                <p>
                    Implementiamo misure di sicurezza tecniche e organizzative per proteggere i tuoi dati, inclusa la crittografia SSL per tutte le trasmissioni di dati.
                </p>
                <h2 className="text-xl font-semibold mt-8 mb-4">8. Modifiche</h2>
                <p>
                    Potremmo aggiornare questa informativa periodicamente. Ti informeremo di eventuali modifiche sostanziali tramite email o avvisi sulla piattaforma.
                </p>
            </div>
        </div>
    );
}
