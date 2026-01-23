export default function CookiePolicyPage() {
    return (
        <div className="min-h-screen bg-white py-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-stone">
                <h1>Cookie Policy</h1>
                <p className="text-sm text-gray-500">Ultimo aggiornamento: 13 gennaio 2026</p>

                <h2>1. Introduzione</h2>
                <p>
                    Questa Cookie Policy spiega come Business Tuner by Voler AI utilizza i cookie e tecnologie simili per riconoscere gli utenti quando visitano il nostro sito web.
                    Spiega cosa sono queste tecnologie, perché le utilizziamo e i tuoi diritti di controllarne l'uso.
                </p>

                <h2>2. Cosa sono i cookie?</h2>
                <p>
                    I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, tablet o smartphone) quando visiti un sito web.
                    Permettono al sito di riconoscere il tuo dispositivo e memorizzare alcune informazioni sulle tue preferenze o azioni passate.
                </p>

                <h3>Tipi di cookie:</h3>
                <ul>
                    <li><strong>Cookie di sessione:</strong> Temporanei, eliminati quando chiudi il browser</li>
                    <li><strong>Cookie persistenti:</strong> Rimangono sul dispositivo per un periodo prestabilito</li>
                    <li><strong>Cookie di prima parte:</strong> Impostati direttamente da Business Tuner</li>
                    <li><strong>Cookie di terze parti:</strong> Impostati da servizi esterni che utilizziamo</li>
                </ul>

                <h2>3. Cookie utilizzati da Business Tuner</h2>

                <h3>3.1 Cookie Strettamente Necessari</h3>
                <p>Questi cookie sono essenziali per il funzionamento del sito e non possono essere disattivati.</p>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Provider</th>
                            <th>Scopo</th>
                            <th>Durata</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>authjs.session-token</code></td>
                            <td>Business Tuner</td>
                            <td>Mantiene la sessione utente autenticata</td>
                            <td>30 giorni</td>
                        </tr>
                        <tr>
                            <td><code>authjs.csrf-token</code></td>
                            <td>Business Tuner</td>
                            <td>Protezione contro attacchi CSRF</td>
                            <td>Sessione</td>
                        </tr>
                        <tr>
                            <td><code>authjs.callback-url</code></td>
                            <td>Business Tuner</td>
                            <td>URL di redirect dopo login</td>
                            <td>Sessione</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.2 Cookie di Preferenze</h3>
                <p>Questi cookie permettono al sito di ricordare le tue scelte (come lingua o regione).</p>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Provider</th>
                            <th>Scopo</th>
                            <th>Durata</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>interview_language</code></td>
                            <td>Business Tuner</td>
                            <td>Memorizza la lingua preferita per le interviste</td>
                            <td>1 anno</td>
                        </tr>
                        <tr>
                            <td><code>consent_given</code></td>
                            <td>Business Tuner</td>
                            <td>Memorizza il consenso privacy dell'utente</td>
                            <td>1 anno</td>
                        </tr>
                    </tbody>
                </table>

                <h3>3.3 Cookie Analitici (Opzionali)</h3>
                <p>Questi cookie ci aiutano a capire come gli utenti interagiscono con il sito.</p>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Provider</th>
                            <th>Scopo</th>
                            <th>Durata</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>_ga</code></td>
                            <td>Google Analytics</td>
                            <td>Distingue gli utenti</td>
                            <td>2 anni</td>
                        </tr>
                        <tr>
                            <td><code>_gid</code></td>
                            <td>Google Analytics</td>
                            <td>Distingue gli utenti</td>
                            <td>24 ore</td>
                        </tr>
                        <tr>
                            <td><code>_gat</code></td>
                            <td>Google Analytics</td>
                            <td>Limita richieste</td>
                            <td>1 minuto</td>
                        </tr>
                    </tbody>
                </table>
                <p className="text-sm text-gray-600">
                    <strong>Nota:</strong> Google Analytics è attualmente NON attivo. Verrà implementato solo previo consenso esplicito degli utenti.
                </p>

                <h3>3.4 Cookie di Marketing (Opzionali)</h3>
                <p>Questi cookie tracciano le visite attraverso i siti web per mostrare annunci pertinenti.</p>
                <p className="text-sm text-gray-600">
                    <strong>Attualmente non utilizziamo cookie di marketing o remarketing.</strong>
                </p>

                <h2>4. Cookie nelle Interviste Pubbliche</h2>
                <p>
                    Quando un utente partecipa a un'intervista tramite link pubblico (<code>/i/[slug]</code>), utilizziamo solo cookie strettamente necessari:
                </p>
                <ul>
                    <li><strong>Session ID:</strong> Identifica la sessione dell'intervista (eliminato automaticamente alla chiusura)</li>
                    <li><strong>Consent flag:</strong> Memorizza il consenso esplicito alla privacy policy</li>
                </ul>
                <p>
                    <strong>Nessun dato identificativo personale viene memorizzato senza consenso esplicito.</strong>
                </p>

                <h2>5. Tecnologie simili ai cookie</h2>

                <h3>Local Storage</h3>
                <p>
                    Utilizziamo il Local Storage del browser per memorizzare temporaneamente:
                </p>
                <ul>
                    <li>Draft di risposte in corso (per evitare perdita dati in caso di chiusura accidentale)</li>
                    <li>Preferenze UI (tema, layout dashboard)</li>
                </ul>
                <p className="text-sm text-gray-600">
                    I dati nel Local Storage rimangono sul tuo dispositivo e non vengono trasmessi ai nostri server a meno che tu non completi esplicitamente un'azione.
                </p>

                <h3>Session Storage</h3>
                <p>
                    Utilizzato per dati temporanei validi solo per la durata della sessione corrente (es. stato wizard onboarding).
                </p>

                <h2>6. Cookie di terze parti</h2>

                <h3>Vercel Analytics (Opzionale)</h3>
                <p>
                    Il nostro sito è ospitato su Vercel. Potrebbero essere impostati cookie di performance per monitorare uptime e performance.
                </p>
                <p className="text-sm">
                    <strong>Privacy Policy Vercel:</strong> <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">https://vercel.com/legal/privacy-policy</a>
                </p>

                <h3>Stripe (Pagamenti)</h3>
                <p>
                    Durante il processo di pagamento, Stripe può impostare cookie per prevenire frodi e garantire la sicurezza.
                </p>
                <p className="text-sm">
                    <strong>Privacy Policy Stripe:</strong> <a href="https://stripe.com/privacy" target="_blank" rel="noopener">https://stripe.com/privacy</a>
                </p>

                <h2>7. Come gestire i cookie</h2>

                <h3>Impostazioni del browser</h3>
                <p>
                    Puoi controllare e gestire i cookie attraverso le impostazioni del tuo browser. Ecco le guide per i browser più comuni:
                </p>
                <ul>
                    <li><strong>Chrome:</strong> Impostazioni &gt; Privacy e sicurezza &gt; Cookie</li>
                    <li><strong>Firefox:</strong> Preferenze &gt; Privacy e sicurezza &gt; Cookie e dati dei siti</li>
                    <li><strong>Safari:</strong> Preferenze &gt; Privacy &gt; Gestisci dati siti web</li>
                    <li><strong>Edge:</strong> Impostazioni &gt; Cookie e autorizzazioni sito</li>
                </ul>

                <p className="bg-amber-50 border-l-4 border-amber-500 p-4 text-sm">
                    <strong>Attenzione:</strong> Disabilitare i cookie strettamente necessari potrebbe compromettere il funzionamento di Business Tuner (es. impossibilità di effettuare il login).
                </p>

                <h3>Opt-out specifici</h3>
                <ul>
                    <li><strong>Google Analytics Opt-out:</strong> <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Browser Add-on</a></li>
                </ul>

                <h2>8. Cookie Consent Management</h2>
                <p>
                    Al primo accesso al sito, ti chiediamo il consenso per i cookie non essenziali attraverso un banner.
                    Puoi modificare le tue preferenze in qualsiasi momento tramite:
                </p>
                <ul>
                    <li>Link "Cookie Settings" nel footer del sito</li>
                    <li>Impostazioni account (per utenti registrati)</li>
                </ul>

                <h2>9. Aggiornamenti della policy</h2>
                <p>
                    Potremmo aggiornare questa Cookie Policy periodicamente per riflettere cambiamenti nelle nostre pratiche o per motivi legali.
                    Ti informeremo di modifiche significative tramite:
                </p>
                <ul>
                    <li>Banner sul sito web</li>
                    <li>Email (per utenti registrati)</li>
                </ul>

                <h2>10. Contatti</h2>
                <p>
                    Per domande su questa Cookie Policy o per esercitare i tuoi diritti in materia di privacy:
                </p>
                <ul>
                    <li><strong>Email:</strong> hello@voler.ai</li>
                    <li><strong>Oggetto:</strong> "Cookie Policy - Richiesta informazioni"</li>
                </ul>

                <h2>11. Base giuridica (GDPR)</h2>
                <p>
                    L'utilizzo dei cookie si basa su:
                </p>
                <ul>
                    <li><strong>Consenso esplicito:</strong> Per cookie analitici e marketing (Art. 6(1)(a) GDPR)</li>
                    <li><strong>Interesse legittimo:</strong> Per cookie di preferenze e performance (Art. 6(1)(f) GDPR)</li>
                    <li><strong>Esecuzione contratto:</strong> Per cookie strettamente necessari al servizio (Art. 6(1)(b) GDPR)</li>
                </ul>

                <p className="mt-12 text-sm text-gray-500 border-t pt-6">
                    <strong>Business Tuner by Voler.ai S.r.l.</strong><br />
                    [INDIRIZZO]<br />
                    P.IVA: [P.IVA]<br />
                    Email: hello@voler.ai
                </p>
            </div>
        </div>
    );
}
