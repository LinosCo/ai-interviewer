export default function DPAPage() {
    return (
        <div className="min-h-screen bg-white py-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-stone">
                <h1>Data Processing Agreement (DPA)</h1>
                <p className="text-sm text-gray-500">Versione 1.0 - Ultimo aggiornamento: 13 gennaio 2026</p>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 my-8">
                    <p className="font-semibold text-blue-900 mb-2">📄 Documento per Clienti Business</p>
                    <p className="text-sm text-blue-800">
                        Questo DPA è applicabile ai clienti con piano PRO o BUSINESS che trattano dati personali tramite Business Tuner.
                        Se hai bisogno di una versione firmata per conformità GDPR, contattaci a <strong>hello@voler.ai</strong>.
                    </p>
                </div>

                <h2>1. Definizioni</h2>
                <dl>
                    <dt><strong>Titolare del Trattamento (Data Controller):</strong></dt>
                    <dd>Il Cliente che utilizza Business Tuner per raccogliere e analizzare dati tramite interviste.</dd>

                    <dt><strong>Responsabile del Trattamento (Data Processor):</strong></dt>
                    <dd>Voler AI S.r.l., fornitore di Business Tuner, che tratta i dati per conto del Titolare.</dd>

                    <dt><strong>Dati Personali:</strong></dt>
                    <dd>Qualsiasi informazione relativa a una persona fisica identificata o identificabile raccolta tramite interviste (es. risposte, email di contatto se fornite, metadata).</dd>

                    <dt><strong>Trattamento:</strong></dt>
                    <dd>Qualsiasi operazione eseguita sui dati: raccolta, registrazione, organizzazione, conservazione, consultazione, elaborazione, modifica, estrazione, analisi, cancellazione.</dd>

                    <dt><strong>Sub-Responsabile:</strong></dt>
                    <dd>Servizi terzi autorizzati da Voler AI per supportare l&apos;erogazione del servizio (es. hosting, AI providers).</dd>
                </dl>

                <h2>2. Oggetto e durata</h2>
                <p>
                    Questo DPA regola le modalità con cui Voler AI tratta i Dati Personali per conto del Cliente nell&apos;ambito dell&apos;utilizzo di Business Tuner,
                    in conformità al <strong>Regolamento (UE) 2016/679 (GDPR)</strong> e alla normativa italiana applicabile.
                </p>
                <p>
                    <strong>Durata:</strong> Questo accordo è valido per tutta la durata del contratto di servizio tra Cliente e Voler AI,
                    e termina al momento della cancellazione dell&apos;account e della definitiva rimozione dei dati.
                </p>

                <h2>3. Ruoli e responsabilità</h2>

                <h3>3.1 Il Cliente (Titolare) è responsabile di:</h3>
                <ul>
                    <li>Determinare le finalità e i mezzi del trattamento dei dati</li>
                    <li>Garantire che i partecipanti alle interviste siano informati e abbiano fornito consenso esplicito</li>
                    <li>Configurare correttamente le privacy notice e i consensi nelle interviste</li>
                    <li>Rispettare i diritti degli interessati (accesso, rettifica, cancellazione, portabilità)</li>
                    <li>Condurre DPIA (Data Protection Impact Assessment) se necessario per trattamenti ad alto rischio</li>
                </ul>

                <h3>3.2 Voler AI (Responsabile) è responsabile di:</h3>
                <ul>
                    <li>Trattare i dati solo su istruzione documentata del Cliente</li>
                    <li>Garantire la riservatezza del personale autorizzato al trattamento</li>
                    <li>Implementare misure tecniche e organizzative adeguate per la sicurezza dei dati</li>
                    <li>Assistere il Cliente nel rispondere alle richieste degli interessati</li>
                    <li>Notificare prontamente eventuali data breach</li>
                    <li>Cancellare o restituire i dati al termine del servizio, su richiesta del Cliente</li>
                    <li>Mettere a disposizione informazioni necessarie per dimostrare la conformità</li>
                </ul>

                <h2>4. Natura e finalità del trattamento</h2>

                <h3>Tipologie di dati trattati:</h3>
                <ul>
                    <li><strong>Dati delle interviste:</strong> Risposte testuali, metadata (timestamp, durata, IP address anonimizzato)</li>
                    <li><strong>Dati di contatto (opzionali):</strong> Email, nome, telefono se richiesti dal Cliente nel setup dell&apos;intervista</li>
                    <li><strong>Dati di recruitment (opzionali):</strong> Skill, esperienze, location se attivata la modalità Data Collection</li>
                    <li><strong>Dati analitici:</strong> Sentiment score, topic coverage, quotes estratte da AI</li>
                </ul>

                <h3>Finalità del trattamento:</h3>
                <ul>
                    <li>Raccolta di risposte via chatbot AI</li>
                    <li>Analisi qualitativa automatica (sentiment, themes, key quotes)</li>
                    <li>Archiviazione sicura dei transcript</li>
                    <li>Generazione report e export per il Cliente</li>
                    <li>Miglioramento del servizio (solo con dati aggregati e anonimizzati)</li>
                </ul>

                <h3>Categorie di interessati:</h3>
                <ul>
                    <li>Partecipanti a interviste di ricerca qualitativa</li>
                    <li>Candidati a processi di selezione (se modalità recruitment attivata)</li>
                    <li>Stakeholder aziendali (dipendenti, clienti, partner) del Cliente</li>
                </ul>

                <h2>5. Misure di sicurezza tecniche e organizzative</h2>

                <h3>5.1 Misure tecniche:</h3>
                <ul>
                    <li><strong>Cifratura:</strong> Tutti i dati in transito sono cifrati via TLS 1.3. API keys cifrate con AES-256-GCM.</li>
                    <li><strong>Controllo accessi:</strong> Autenticazione multi-fattore disponibile, RBAC (Role-Based Access Control)</li>
                    <li><strong>Database security:</strong> PostgreSQL con SSL obbligatorio, backup automatici giornalieri cifrati</li>
                    <li><strong>Pseudonimizzazione:</strong> IP address mascherati per impostazione predefinita nelle interviste pubbliche</li>
                    <li><strong>Logging:</strong> Audit log di accessi e modifiche ai dati sensibili</li>
                    <li><strong>Vulnerability management:</strong> Scansioni di sicurezza periodiche, patch tempestive</li>
                </ul>

                <h3>5.2 Misure organizzative:</h3>
                <ul>
                    <li><strong>Formazione:</strong> Personale formato su GDPR e data protection best practices</li>
                    <li><strong>Confidenzialità:</strong> Accordi di riservatezza firmati da tutti i dipendenti</li>
                    <li><strong>Incident response:</strong> Piano di risposta a data breach documentato</li>
                    <li><strong>Accesso limitato:</strong> Principio del &quot;least privilege&quot;, accesso ai dati solo per personale autorizzato</li>
                </ul>

                <h2>6. Sub-responsabili autorizzati</h2>
                <p>
                    Voler AI si avvale dei seguenti sub-responsabili per l&apos;erogazione del servizio:
                </p>

                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Servizio</th>
                            <th>Provider</th>
                            <th>Finalità</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Hosting & Database</td>
                            <td>Neon (via AWS)</td>
                            <td>Archiviazione database PostgreSQL</td>
                            <td>EU (eu-central-1)</td>
                        </tr>
                        <tr>
                            <td>Application Hosting</td>
                            <td>Vercel</td>
                            <td>Hosting Next.js application</td>
                            <td>EU</td>
                        </tr>
                        <tr>
                            <td>AI Processing</td>
                            <td>OpenAI / Anthropic</td>
                            <td>Analisi qualitativa e generazione domande</td>
                            <td>USA (Standard Contractual Clauses)</td>
                        </tr>
                        <tr>
                            <td>Payment Processing</td>
                            <td>Stripe</td>
                            <td>Gestione abbonamenti e pagamenti</td>
                            <td>USA (Privacy Shield certified)</td>
                        </tr>
                        <tr>
                            <td>Email Delivery</td>
                            <td>Resend</td>
                            <td>Invio email transazionali</td>
                            <td>USA</td>
                        </tr>
                    </tbody>
                </table>

                <p className="text-sm text-gray-600 mt-4">
                    <strong>Nota:</strong> Tutti i sub-responsabili hanno firmato accordi di data processing conformi al GDPR.
                    Per trasferimenti extra-UE, Voler AI utilizza Standard Contractual Clauses approvate dalla Commissione Europea.
                </p>

                <h3>Diritto di obiezione:</h3>
                <p>
                    Il Cliente ha il diritto di obiettare all&apos;ingaggio di un nuovo sub-responsabile entro 30 giorni dalla notifica.
                    In caso di obiezione motivata, le parti cercheranno una soluzione alternativa o, se non possibile, il Cliente potrà recedere dal contratto.
                </p>

                <h2>7. Assistenza al Cliente</h2>

                <h3>7.1 Richieste degli interessati (DSAR):</h3>
                <p>
                    Voler AI fornisce strumenti self-service per consentire al Cliente di gestire le richieste degli interessati:
                </p>
                <ul>
                    <li><strong>Accesso:</strong> Export CSV/PDF delle risposte tramite dashboard</li>
                    <li><strong>Rettifica:</strong> Modifica manuale dei transcript tramite interfaccia admin</li>
                    <li><strong>Cancellazione:</strong> Eliminazione permanente di conversazioni specifiche o intere interviste</li>
                    <li><strong>Portabilità:</strong> Export in formato machine-readable (JSON, CSV)</li>
                </ul>
                <p>
                    Per richieste complesse, il Cliente può contattare Voler AI a <strong>hello@voler.ai</strong> e riceverà assistenza entro 72 ore lavorative.
                </p>

                <h3>7.2 Data Protection Impact Assessment (DPIA):</h3>
                <p>
                    Voler AI fornirà informazioni necessarie per consentire al Cliente di condurre DPIA quando richiesto dal GDPR (Art. 35).
                    Documentazione tecnica e misure di sicurezza sono disponibili su richiesta.
                </p>

                <h2>8. Data Breach Notification</h2>
                <p>
                    In caso di violazione dei dati personali (data breach), Voler AI:
                </p>
                <ol>
                    <li><strong>Notifica al Cliente:</strong> Entro 72 ore dalla scoperta, via email a tutti gli admin dell&apos;account</li>
                    <li><strong>Informazioni fornite:</strong>
                        <ul>
                            <li>Natura della violazione (tipo di dati coinvolti, numero di interessati)</li>
                            <li>Probabili conseguenze</li>
                            <li>Misure adottate o proposte per mitigare effetti</li>
                        </ul>
                    </li>
                    <li><strong>Documentazione:</strong> Incident report completo fornito entro 7 giorni</li>
                </ol>

                <p className="bg-amber-50 border-l-4 border-amber-500 p-4">
                    <strong>Importante:</strong> Il Cliente, in qualità di Titolare, rimane responsabile della notifica all&apos;Autorità Garante
                    e agli interessati se richiesto dall&apos;Art. 33 e 34 del GDPR.
                </p>

                <h2>9. Conservazione e cancellazione dati</h2>

                <h3>Retention policy:</h3>
                <ul>
                    <li><strong>Dati interviste attive:</strong> Conservati finché il Cliente mantiene l&apos;account</li>
                    <li><strong>Dati account cancellato:</strong> Cancellazione entro 30 giorni dalla richiesta</li>
                    <li><strong>Backup:</strong> Sovrascritti automaticamente dopo 30 giorni</li>
                    <li><strong>Log di sicurezza:</strong> Conservati per 90 giorni per finalità di audit</li>
                </ul>

                <h3>Modalità di cancellazione:</h3>
                <p>
                    Al termine del contratto, il Cliente può scegliere:
                </p>
                <ol>
                    <li><strong>Export completo:</strong> Download di tutti i dati in formato JSON prima della cancellazione</li>
                    <li><strong>Cancellazione immediata:</strong> Rimozione permanente da database e backup (non reversibile)</li>
                </ol>

                <h2>10. Audit e conformità</h2>
                <p>
                    Il Cliente ha il diritto di verificare la conformità di Voler AI al presente DPA tramite:
                </p>
                <ul>
                    <li>Questionari di audit (forniti entro 30 giorni dalla richiesta)</li>
                    <li>Certificazioni di sicurezza (SOC 2, ISO 27001 se disponibili)</li>
                    <li>Audit on-site (previo accordo, a carico del Cliente, max 1 volta l&apos;anno)</li>
                </ul>

                <h2>11. Modifiche al DPA</h2>
                <p>
                    Voler AI si riserva il diritto di modificare questo DPA per motivi di conformità legale o miglioramento del servizio.
                    Modifiche sostanziali saranno notificate con almeno 30 giorni di preavviso via email e banner in-app.
                </p>

                <h2>12. Legge applicabile e foro competente</h2>
                <ul>
                    <li><strong>Legge applicabile:</strong> Legge italiana e Regolamento UE 2016/679 (GDPR)</li>
                    <li><strong>Foro competente:</strong> Tribunale di Milano, Italia</li>
                </ul>

                <h2>13. Contatti DPO</h2>
                <p>
                    Per questioni relative al trattamento dei dati:
                </p>
                <ul>
                    <li><strong>Email DPO:</strong> dpo@voler.ai</li>
                    <li><strong>Email generale:</strong> hello@voler.ai</li>
                    <li><strong>Oggetto email:</strong> &quot;DPA - [Nome Cliente] - [Richiesta]&quot;</li>
                </ul>

                <div className="bg-green-50 border-l-4 border-green-500 p-6 my-8">
                    <p className="font-semibold text-green-900 mb-2">✅ Versione firmata del DPA</p>
                    <p className="text-sm text-green-800">
                        I clienti con piano BUSINESS possono richiedere una versione firmata di questo DPA per archivio compliance.
                        Inviare richiesta a <strong>hello@voler.ai</strong> con oggetto &quot;DPA Signature Request&quot; includendo:
                    </p>
                    <ul className="text-sm text-green-800 mt-2">
                        <li>Ragione sociale e P.IVA del Cliente</li>
                        <li>Nome e email del referente privacy</li>
                        <li>Organization ID Business Tuner</li>
                    </ul>
                    <p className="text-sm text-green-800 mt-2">
                        Tempo di emissione: 5-7 giorni lavorativi.
                    </p>
                </div>

                <p className="mt-12 text-sm text-gray-500 border-t pt-6">
                    <strong>Voler AI S.r.l.</strong><br />
                    Via della Tecnologia, 123 - 20100 Milano (MI)<br />
                    P.IVA: IT12345678901<br />
                    REA: MI-1234567<br />
                    Email: hello@voler.ai | DPO: dpo@voler.ai
                </p>
            </div>
        </div>
    );
}
