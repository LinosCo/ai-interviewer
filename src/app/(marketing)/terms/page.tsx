import { colors } from '@/lib/design-system';

export default function TermsPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <h1 className="text-4xl font-bold mb-8" style={{ color: colors.text }}>Termini di Servizio</h1>
            <p className="text-gray-500 mb-8">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

            <div className="prose prose-stone max-w-none space-y-8 text-gray-700 leading-relaxed">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Il Servizio</h2>
                    <p>
                        Business Tuner è un servizio SaaS di Voler.ai che include funzionalità AI (interviste, chatbot, visibility, copilot) con modello di consumo a crediti per organizzazione.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Modello Crediti</h2>
                    <p>
                        Ogni organizzazione dispone di crediti mensili in base al piano. Le operazioni AI consumano crediti. Quando i crediti disponibili sono esauriti,
                        le funzionalità AI vengono bloccate fino al successivo reset mensile o all&apos;acquisto di Credit Pack.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Credit Pack</h2>
                    <p>
                        I Credit Pack sono acquisti extra una tantum (small/medium/large), associati all&apos;organizzazione. I pack non scadono salvo diversa comunicazione contrattuale.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Piani e Vendita</h2>
                    <p>
                        I piani self-serve acquistabili online sono Starter e Pro. Il piano Business è disponibile esclusivamente tramite contatto Sales e accordo commerciale dedicato.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Proprietà e Sicurezza dei Dati</h2>
                    <p>
                        Il cliente mantiene la proprietà dei dati caricati e generati. I dati sono trattati secondo le policy di sicurezza e privacy applicabili, inclusi gli obblighi GDPR.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Uso Accettabile</h2>
                    <p>
                        È vietato usare il servizio per attività illecite, abuso infrastrutturale, tentativi di compromissione o violazioni normative.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">7. Contatti</h2>
                    <p>
                        Per informazioni legali o contrattuali: businesstuner@voler.ai
                    </p>
                </section>
            </div>
        </div>
    );
}
