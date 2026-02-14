'use client';

import React from 'react';
import { colors } from '@/lib/design-system';

export default function SalesTermsPage() {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <h1 className="text-4xl font-bold mb-8" style={{ color: colors.text }}>Condizioni Generali di Vendita</h1>
            <p className="text-gray-500 mb-8">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

            <div className="prose prose-stone max-w-none space-y-8 text-gray-700 leading-relaxed">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Ambito</h2>
                    <p>
                        Le presenti condizioni disciplinano la vendita dei piani self-serve Starter/Pro e dei Credit Pack, oltre agli accordi Sales per il piano Business.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Conclusione del Contratto</h2>
                    <p>
                        Per Starter/Pro e Credit Pack il contratto si perfeziona con conferma pagamento tramite Stripe. Per Business il contratto si perfeziona con offerta accettata e relativo ordine/accordo commerciale.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Prezzi e Fatturazione</h2>
                    <p>
                        I prezzi sono espressi in Euro. La fatturazione dei piani ricorrenti segue il ciclo selezionato (mensile/annuale). I Credit Pack sono una tantum. Il piano Business segue condizioni economiche definite in trattativa Sales.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Crediti e Sospensione Funzioni AI</h2>
                    <p>
                        Le funzionalità AI consumano crediti disponibili dell&apos;organizzazione. In assenza di crediti sufficienti, le API AI e le funzioni collegate restano sospese fino a nuovo plafond (reset o pack acquistato).
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Rinnovo e Cancellazione</h2>
                    <p>
                        I piani ricorrenti si rinnovano automaticamente fino a disdetta dal portale billing. La cancellazione non elimina l&apos;accesso ai dati già raccolti, salvo ulteriori policy contrattuali.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Legge Applicabile</h2>
                    <p>
                        Le presenti condizioni sono regolate dalla legge italiana; foro competente come da normativa e da eventuale contratto specifico.
                    </p>
                </section>
            </div>
        </div>
    );
}
