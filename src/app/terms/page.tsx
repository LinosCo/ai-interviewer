export default function TermsPage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold mb-8">Termini di Servizio</h1>
            <div className="prose prose-stone">
                <p>Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>
                <p>Benvenuto in Business Tuner. Utilizzando il nostro servizio, accetti questi termini.</p>
                <h2>1. Panoramica</h2>
                <p>Business Tuner è una piattaforma per la raccolta e l'analisi di feedback qualitativi tramite interviste AI.</p>
                <h2>2. Account</h2>
                <p>Sei responsabile per la sicurezza del tuo account e per tutte le attività che avvengono sotto il tuo account.</p>
                <h2>3. Utilizzo</h2>
                <p>L'uso della piattaforma è soggetto a limitazioni eque e al rispetto delle leggi vigenti.</p>
                {/* Aggiungere contenuti legali completi qui */}
            </div>
        </div>
    );
}
