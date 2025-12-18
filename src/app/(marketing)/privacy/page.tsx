import { redirect } from 'next/navigation';

export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4">Ultimo aggiornamento: Dicembre 2025</p>
            <div className="prose prose-stone">
                <p>
                    Questa Privacy Policy descrive come Business Tuner ("noi", "ci" o "nostro") raccoglie, utilizza e condivide le tue informazioni personali quando utilizzi il nostro servizio.
                </p>
                <h2 className="text-xl font-semibold mt-6 mb-3">1. Informazioni che raccogliamo</h2>
                <p>
                    Raccogliamo informazioni che ci fornisci direttamente, come quando crei un account, utilizzi il nostro servizio o ci contatti per assistenza.
                </p>
                {/* Placeholder content */}
                <p className="mt-8 text-stone-500 italic">
                    [Contenuto completo della Privacy Policy da inserire qui conformemente al GDPR e alle leggi applicabili.]
                </p>
            </div>
        </div>
    );
}
