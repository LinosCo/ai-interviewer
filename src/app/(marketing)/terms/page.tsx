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
                        Business Tuner ("il Servizio") è un prodotto di [RAGIONE SOCIALE], con sede in [INDIRIZZO], P.IVA [P.IVA], C.F. [C.F.], Iscritta al Registro Imprese di [PROVINCIA], REA [NUMERO], Capitale Sociale Euro [AMMONTARE] i.v.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Condizioni di Vendita</h2>
                    <p>
                        L'acquisto di abbonamenti e servizi tramite la piattaforma è regolato dalle nostre <a href="/sales-terms" className="text-amber-600 hover:underline">Condizioni Generali di Vendita</a>, che integrano i presenti Termini.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Descrizione del Servizio</h2>
                    <p>
                        Business Tuner fornisce una piattaforma basata su intelligenza artificiale per la conduzione e l'analisi di interviste qualitative.
                        Ci riserviamo il diritto di modificare, sospendere o interrompere il Servizio in qualsiasi momento.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Account Utente</h2>
                    <p>
                        Per accedere ad alcune funzionalità del Servizio, è necessario creare un account. L'utente è responsabile della sicurezza
                        delle proprie credenziali e di tutte le attività che avvengono sotto il proprio account.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Proprietà dei Dati</h2>
                    <p>
                        L'utente mantiene la piena proprietà dei dati inseriti e generati tramite il Servizio. Business Tuner non rivendica alcun diritto di proprietà
                        sui tuoi contenuti. Tuttavia, concedi a Business Tuner una licenza limitata per utilizzare i tuoi contenuti al solo fine di fornire e migliorare il Servizio.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Uso Accettabile</h2>
                    <p>
                        Non è consentito utilizzare il Servizio per scopi illegali o non autorizzati. L'utente si impegna a non utilizzare il Servizio per:
                        <ul className="list-disc pl-6 mt-2">
                            <li>Violare leggi o regolamenti vigenti.</li>
                            <li>Inviare spam o messaggi non richiesti.</li>
                            <li>Tenta di compromettere l'integrità o la sicurezza del sistema.</li>
                        </ul>
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Limitazione di Responsabilità</h2>
                    <p>
                        In nessun caso Business Tuner sarà responsabile per danni indiretti, incidentali, speciali o consequenziali derivanti dall'uso del Servizio.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">7. Contatti</h2>
                    <p>
                        Per qualsiasi domanda sui presenti Termini, contattaci all'indirizzo: legal@businesstuner.ai
                    </p>
                </section>
            </div>
        </div>
    );
}
