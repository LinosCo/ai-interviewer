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
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">1. Il Servizio</h2>
                    <p>
                        Business Tuner (di seguito "il Servizio") è una piattaforma SaaS (Software as a Service) fornita da Voler.ai S.r.l., con sede legale in [INDIRIZZO], P.IVA [P.IVA].
                        Le presenti Condizioni Generali di Vendita disciplinano l'acquisto e l'utilizzo degli abbonamenti ai piani a pagamento (Starter, Pro, Business).
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">2. Conclusione del Contratto</h2>
                    <p>
                        Il contratto tra Business Tuner e il Cliente si conclude al momento della conferma del pagamento tramite la piattaforma Stripe. Il Cliente riceverà una conferma via email dell'avvenuto acquisto e della sottoscrizione del piano prescelto.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">3. Prezzi e Fatturazione</h2>
                    <p>
                        Tutti i prezzi sono indicati in Euro e si intendono IVA esclusa (se applicabile). La fatturazione avviene mensilmente o annualmente, in base alla scelta del Cliente.
                        Per l'emissione della fattura elettronica (obbligatoria in Italia), il Cliente è tenuto a fornire i dati fiscali completi: Ragione Sociale/Nome e Cognome, Indirizzo, P.IVA/Codice Fiscale, Codice Destinatario (SDI) e/o PEC.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">4. Pagamenti</h2>
                    <p>
                        I pagamenti sono gestiti tramite Stripe. Business Tuner non memorizza i dati della carta di credito del Cliente. In caso di mancato pagamento, Business Tuner si riserva il diritto di sospendere l'accesso ai piani a pagamento fino alla regolarizzazione della posizione.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">5. Right of Withdrawal (Recesso)</h2>
                    <p>
                        <strong>Per Clienti Professionisti (B2B):</strong> Non è previsto il diritto di recesso una volta attivato il servizio.
                        <strong>Per Clienti Consumatori (B2C):</strong> Ai sensi dell'art. 59 del Codice del Consumo, il diritto di recesso è escluso per la fornitura di contenuto digitale mediante supporto non materiale se l'esecuzione è iniziata con l'accordo espresso del consumatore.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">6. Durata e Rinnovo</h2>
                    <p>
                        Gli abbonamenti si rinnovano automaticamente alla scadenza del periodo (mese o anno) scelto, salvo disdetta da parte del Cliente tramite l'area "Impostazioni Billing" nel dashboard, da effettuarsi prima della data di rinnovo.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">7. Limitazione di Responsabilità</h2>
                    <p>
                        Business Tuner non è responsabile per danni diretti o indiretti derivanti dall'uso del servizio o dall'impossibilità di utilizzarlo, salvo i casi di dolo o colpa grave.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">8. Legge Applicabile e Foro Competente</h2>
                    <p>
                        Le presenti condizioni sono regolate dalla legge italiana. Per ogni controversia sarà competente il Foro di Milano, fatto salvo il foro inderogabile del consumatore ove applicabile.
                    </p>
                </section>
            </div>
        </div>
    );
}
