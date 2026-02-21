import { colors } from '@/lib/design-system';

export default function CookiesPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <h1 className="text-4xl font-bold mb-8" style={{ color: colors.text }}>Cookie Policy</h1>
            <p className="text-gray-500 mb-8">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

            <div className="prose prose-stone max-w-none space-y-8 text-gray-700 leading-relaxed">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Cosa sono i cookie?</h2>
                    <p>
                        I cookie sono piccoli file di testo che i siti visitati dagli utenti inviano ai loro terminali,
                        dove vengono memorizzati per essere ritrasmessi agli stessi siti in occasione di visite successive.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Cookie utilizzati da Business Tuner</h2>
                    <p>Utilizziamo le seguenti categorie di cookie:</p>
                    <ul className="list-disc pl-6 space-y-2 mt-4">
                        <li>
                            <strong>Cookie Tecnici:</strong> Essenziali per il corretto funzionamento del sito e per consentire la navigazione.
                            Non richiedono il consenso dell&apos;utente.
                        </li>
                        <li>
                            <strong>Cookie Analitici:</strong> Utilizzati per raccogliere informazioni, in forma aggregata,
                            sul numero degli utenti e su come questi visitano il sito (es. Google Analytics, Vercel Analytics).
                        </li>
                        <li>
                            <strong>Cookie di Funzionalità:</strong> Permettono all&apos;utente la navigazione in funzione di una serie
                            di criteri selezionati (ad esempio, la lingua) al fine di migliorare il servizio reso.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Gestione dei cookie</h2>
                    <p>
                        Puoi gestire le preferenze relative ai cookie direttamente all&apos;interno del tuo browser ed impedire
                        che terze parti possano installarne. Tramite le preferenze del browser è inoltre possibile eliminare
                        i cookie installati in passato.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Contatti</h2>
                    <p>
                        Per ulteriori informazioni sul trattamento dei tuoi dati personali, ti invitiamo a consultare la nostra Privacy Policy
                        Se hai domande sulla nostra Cookie Policy, contattaci a businesstuner@voler.ai.
                    </p>
                </section>
            </div>
        </div>
    );
}
