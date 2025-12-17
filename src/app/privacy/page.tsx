'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PrivacyContent() {
    const searchParams = useSearchParams();
    const lang = searchParams.get('lang') === 'it' ? 'it' : 'en';

    const content = {
        it: {
            title: "Informativa sulla Privacy (GDPR)",
            intro: "La presente informativa descrive le modalità di trattamento dei dati personali raccolti attraverso la piattaforma 'Business Tuner Interviewer'. La piattaforma facilita interviste di ricerca qualitativa automatizzate mediate da Intelligenza Artificiale.",
            roles_title: "1. Titolare e Responsabile del Trattamento",
            roles_text: (
                <>
                    <p className="mb-2">Ai sensi del Regolamento UE 2016/679 (GDPR):</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Titolare del Trattamento (Data Controller):</strong> È l'organizzazione o il ricercatore che ha creato e distribuito questo specifico chatbot. Essi definiscono le finalità e i mezzi del trattamento dei tuoi dati.</li>
                        <li><strong>Responsabile del Trattamento (Data Processor):</strong> È <strong>Business Tuner</strong>, che fornisce l'infrastruttura tecnologica sicura per condurre l'intervista per conto del Titolare.</li>
                    </ul>
                </>
            ),
            data_title: "2. Dati Raccolti",
            data_text: (
                <>
                    <p>Raccogliamo le seguenti categorie di dati:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Dati di Conversazione:</strong> Le risposte fornite liberamente durante l'intervista.</li>
                        <li><strong>Dati Tecnici:</strong> Log di connessione, durata, tipologia di dispositivo e indirizzo IP (se richiesto per sicurezza).</li>
                        <li><strong>Categorie Particolari:</strong> Se riveli volontariamente dati sensibili (es. opinioni politiche, salute), questi saranno trattati basandosi sul tuo consenso esplicito.</li>
                    </ul>
                </>
            ),
            ai_title: "3. Utilizzo dell'Intelligenza Artificiale",
            ai_text: "Ti informiamo che stai interagendo con un sistema automatizzato. Le tue risposte vengono processate in tempo reale da Modelli Linguistici di Grandi Dimensioni (LLM) forniti da terze parti (es. OpenAI, Anthropic) al solo scopo di generare le domande successive e analizzare i risultati per il ricercatore. Questi fornitori operano sotto stringenti accordi di riservatezza e non utilizzano i tuoi dati per addestrare i loro modelli pubblici.",
            purpose_title: "4. Finalità e Base Giuridica",
            purpose_text: "I dati sono trattati esclusivamente per finalità di ricerca di mercato o sociale. La base giuridica del trattamento è il tuo <strong>Consenso Esplicito</strong> (Art. 6.1.a GDPR), che manifesti spuntando la casella di accettazione prima dell'inizio dell'intervista. Puoi revocare il consenso in qualsiasi momento interrompendo l'intervista, ma il trattamento effettuato fino a quel momento rimarrà lecito.",
            rights_title: "5. I Tuoi Diritti",
            rights_text: (
                <>
                    <p>Hai il diritto di:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Accedere ai tuoi dati personali.</li>
                        <li>Chiedere la rettifica o la cancellazione ("diritto all'oblio") dei dati.</li>
                        <li>Limitare il trattamento o opporti allo stesso.</li>
                        <li>Richiedere la portabilità dei dati.</li>
                    </ul>
                    <p className="mt-2">Per esercitare questi diritti, contatta direttamente l'organizzazione che ti ha invitato. Se non disponi dei loro contatti, scrivi a <a href="mailto:privacy@businesstuner.ai" className="text-blue-600 hover:underline">privacy@businesstuner.ai</a> e inoltreremo la richiesta al Titolare competente.</p>
                </>
            )
        },
        en: {
            title: "Privacy Policy (GDPR)",
            intro: "This policy describes how personal data collected through the 'Business Tuner Interviewer' platform is processed. The platform facilitates automated qualitative research interviews mediated by Artificial Intelligence.",
            roles_title: "1. Data Controller & Processor",
            roles_text: (
                <>
                    <p className="mb-2">Under EU Regulation 2016/679 (GDPR):</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Data Controller:</strong> The organization or researcher who created and distributed this specific chatbot. They determine the purposes and means of processing your data.</li>
                        <li><strong>Data Processor:</strong> <strong>Business Tuner</strong>, providing the secure technological infrastructure to conduct the interview on behalf of the Controller.</li>
                    </ul>
                </>
            ),
            data_title: "2. Data Collected",
            data_text: (
                <>
                    <p>We collect the following categories of data:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Conversation Data:</strong> Responses you freely provide during the interview.</li>
                        <li><strong>Technical Data:</strong> Connection logs, duration, device type, and IP address (if required for security).</li>
                        <li><strong>Special Categories:</strong> If you voluntarily disclose sensitive data (e.g., political opinions, health), these will be processed based on your explicit consent.</li>
                    </ul>
                </>
            ),
            ai_title: "3. Use of Artificial Intelligence",
            ai_text: "Please be aware that you are interacting with an automated system. Your responses are processed in real-time by Large Language Models (LLMs) provided by third parties (e.g., OpenAI, Anthropic) solely to generate follow-up questions and analyze results for the researcher. These providers operate under strict confidentiality agreements and do not use your data to train their public models.",
            purpose_title: "4. Purpose & Legal Basis",
            purpose_text: "Data is processed exclusively for market or social research purposes. The legal basis for processing is your <strong>Explicit Consent</strong> (Art. 6.1.a GDPR), provided by checking the acceptance box before starting the interview. You may withdraw consent at any time by stopping the interview, though processing prior to withdrawal remains lawful.",
            rights_title: "5. Your Rights",
            rights_text: (
                <>
                    <p>You have the right to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Access your personal data.</li>
                        <li>Request rectification or erasure (\"right to be forgotten\") of your data.</li>
                        <li>Restrict or object to processing.</li>
                        <li>Request data portability.</li>
                    </ul>
                    <p className="mt-2">To exercise these rights, please contact the organization that invited you directly. If you do not have their contact details, write to <a href="mailto:privacy@businesstuner.ai" className="text-blue-600 hover:underline">privacy@businesstuner.ai</a>, and we will forward your request to the relevant Controller.</p>
                </>
            )
        }
    };

    const t = content[lang];

    return (
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
            <h1 className="text-3xl font-bold mb-8">{t.title}</h1>

            <div className="prose prose-blue max-w-none space-y-6 text-gray-700">
                <p className="lead">{t.intro}</p>

                <section>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.roles_title}</h2>
                    {t.roles_text}
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.data_title}</h2>
                    {t.data_text}
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.ai_title}</h2>
                    <p>{t.ai_text}</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.purpose_title}</h2>
                    <p dangerouslySetInnerHTML={{ __html: t.purpose_text as string }} />
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.rights_title}</h2>
                    {t.rights_text}
                </section>
            </div>
        </div>
    );
}

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<div>Loading...</div>}>
                <PrivacyContent />
            </Suspense>
        </div>
    );
}
