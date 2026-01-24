export default function SLAPage() {
    return (
        <div className="min-h-screen bg-white py-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-stone">
                <h1>Service Level Agreement (SLA)</h1>
                <p className="text-sm text-gray-500">Versione 1.0 - Ultimo aggiornamento: 13 gennaio 2026</p>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 my-8">
                    <p className="font-semibold text-blue-900 mb-2">📊 Impegni di Servizio</p>
                    <p className="text-sm text-blue-800">
                        Questo SLA definisce i livelli di servizio garantiti da Business Tuner, i tempi di risposta del supporto,
                        e i rimborsi applicabili in caso di downtime. Valido per tutti i piani a pagamento (STARTER, PRO, BUSINESS).
                    </p>
                </div>

                <h2>1. Definizioni</h2>
                <dl>
                    <dt><strong>Uptime:</strong></dt>
                    <dd>Percentuale di tempo in cui il servizio Business Tuner è accessibile e funzionante.</dd>

                    <dt><strong>Downtime:</strong></dt>
                    <dd>Periodo in cui il servizio è completamente inaccessibile o non utilizzabile, escluse manutenzioni programmate e cause di forza maggiore.</dd>

                    <dt><strong>Manutenzione Programmata:</strong></dt>
                    <dd>Interventi pianificati notificati con almeno 72 ore di anticipo, solitamente durante ore notturne (02:00-05:00 CET).</dd>

                    <dt><strong>Periodo di Fatturazione:</strong></dt>
                    <dd>Intervallo mensile di riferimento per il calcolo dell'uptime (es. 1-31 gennaio).</dd>

                    <dt><strong>Service Credit:</strong></dt>
                    <dd>Rimborso sotto forma di credito applicabile alla fattura successiva in caso di mancato rispetto degli SLA.</dd>
                </dl>

                <h2>2. Uptime Garantito</h2>

                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Piano</th>
                            <th>Uptime Mensile</th>
                            <th>Downtime Massimo/Mese</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>STARTER</strong></td>
                            <td>99.5%</td>
                            <td>~3h 37min</td>
                        </tr>
                        <tr>
                            <td><strong>PRO</strong></td>
                            <td>99.9%</td>
                            <td>~43 minuti</td>
                        </tr>
                        <tr>
                            <td><strong>BUSINESS</strong></td>
                            <td>99.95%</td>
                            <td>~22 minuti</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Esclusioni dal calcolo Downtime:</h3>
                <ul>
                    <li><strong>Manutenzione programmata:</strong> Notificata con 72 ore di anticipo</li>
                    <li><strong>Forza maggiore:</strong> Eventi fuori dal controllo di Voler AI (disastri naturali, interruzioni ISP, attacchi DDoS)</li>
                    <li><strong>Problemi lato cliente:</strong> Configurazioni errate, problemi di rete del cliente, browser non supportati</li>
                    <li><strong>Servizi terzi:</strong> Downtime di OpenAI/Anthropic, Stripe, o altri provider esterni</li>
                    <li><strong>Beta features:</strong> Funzionalità contrassegnate come "Beta" o "Experimental"</li>
                </ul>

                <h2>3. Tempi di Risposta Supporto</h2>

                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Piano</th>
                            <th>Canali Supporto</th>
                            <th>Risposta Iniziale</th>
                            <th>Orario Supporto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>STARTER</strong></td>
                            <td>Email, Knowledge Base</td>
                            <td>48 ore lavorative</td>
                            <td>Lun-Ven 9-18 CET</td>
                        </tr>
                        <tr>
                            <td><strong>PRO</strong></td>
                            <td>Email, Chat, Knowledge Base</td>
                            <td>24 ore lavorative</td>
                            <td>Lun-Ven 9-18 CET</td>
                        </tr>
                        <tr>
                            <td><strong>BUSINESS</strong></td>
                            <td>Email, Chat, Phone (on request)</td>
                            <td>4 ore lavorative (P1)<br />12 ore (P2/P3)</td>
                            <td>Lun-Dom 8-20 CET</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Classificazione Priorità:</h3>
                <ul>
                    <li><strong>P1 - Critico:</strong> Servizio completamente inaccessibile, perdita di dati, security breach</li>
                    <li><strong>P2 - Alto:</strong> Funzionalità chiave non disponibili, impatto significativo sugli utenti</li>
                    <li><strong>P3 - Medio:</strong> Funzionalità minori degradate, workaround disponibile</li>
                    <li><strong>P4 - Basso:</strong> Domande generali, richieste di funzionalità, chiarimenti</li>
                </ul>

                <h2>4. Performance Garantite</h2>

                <h3>Tempi di Risposta API/Chat:</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Operazione</th>
                            <th>P95 Response Time</th>
                            <th>P99 Response Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Dashboard Load</td>
                            <td>&lt; 2s</td>
                            <td>&lt; 4s</td>
                        </tr>
                        <tr>
                            <td>Interview Start</td>
                            <td>&lt; 3s</td>
                            <td>&lt; 6s</td>
                        </tr>
                        <tr>
                            <td>AI Response (Chat)</td>
                            <td>&lt; 8s</td>
                            <td>&lt; 15s</td>
                        </tr>
                        <tr>
                            <td>Analytics Generation</td>
                            <td>&lt; 30s</td>
                            <td>&lt; 60s</td>
                        </tr>
                    </tbody>
                </table>

                <p className="text-sm text-gray-600">
                    <strong>Nota:</strong> Tempi di risposta AI dipendono dalla lunghezza della conversazione e dal carico dei provider LLM.
                    Garantiamo best effort ma non possiamo controllare latenza di OpenAI/Anthropic.
                </p>

                <h3>Rate Limits:</h3>
                <ul>
                    <li><strong>STARTER:</strong> 100 richieste/minuto per organizzazione</li>
                    <li><strong>PRO:</strong> 300 richieste/minuto per organizzazione</li>
                    <li><strong>BUSINESS:</strong> 1000 richieste/minuto per organizzazione</li>
                </ul>

                <h2>5. Backup e Data Recovery</h2>

                <h3>Backup Policy:</h3>
                <ul>
                    <li><strong>Frequenza:</strong> Backup automatici giornalieri (ogni 24 ore)</li>
                    <li><strong>Retention:</strong> 30 giorni di snapshot incrementali</li>
                    <li><strong>Storage location:</strong> EU region, cifrati AES-256</li>
                    <li><strong>Recovery Point Objective (RPO):</strong> Max 24 ore di dati persi</li>
                    <li><strong>Recovery Time Objective (RTO):</strong>
                        <ul>
                            <li>STARTER/PRO: 24 ore</li>
                            <li>BUSINESS: 4 ore</li>
                        </ul>
                    </li>
                </ul>

                <h3>Ripristino dati:</h3>
                <p>
                    In caso di perdita accidentale di dati, i clienti possono richiedere ripristino da backup:
                </p>
                <ul>
                    <li><strong>STARTER:</strong> Non incluso (export manuale raccomandato)</li>
                    <li><strong>PRO:</strong> 1 ripristino gratuito/anno, successivi €200/ripristino</li>
                    <li><strong>BUSINESS:</strong> Ripristini illimitati inclusi</li>
                </ul>

                <h2>6. Service Credits (Rimborsi)</h2>

                <p>
                    In caso di mancato rispetto dell'uptime garantito, Voler AI emetterà Service Credits automatici secondo questa tabella:
                </p>

                <h3>STARTER Plan:</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Uptime Effettivo</th>
                            <th>Service Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>99.0% - 99.5%</td>
                            <td>10% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>95.0% - 99.0%</td>
                            <td>25% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>&lt; 95.0%</td>
                            <td>50% del canone mensile</td>
                        </tr>
                    </tbody>
                </table>

                <h3>PRO Plan:</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Uptime Effettivo</th>
                            <th>Service Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>99.5% - 99.9%</td>
                            <td>15% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>99.0% - 99.5%</td>
                            <td>30% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>&lt; 99.0%</td>
                            <td>50% del canone mensile</td>
                        </tr>
                    </tbody>
                </table>

                <h3>BUSINESS Plan:</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th>Uptime Effettivo</th>
                            <th>Service Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>99.9% - 99.95%</td>
                            <td>20% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>99.5% - 99.9%</td>
                            <td>40% del canone mensile</td>
                        </tr>
                        <tr>
                            <td>&lt; 99.5%</td>
                            <td>100% del canone mensile</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Procedura di richiesta:</h3>
                <ol>
                    <li>Il cliente deve richiedere il Service Credit entro 30 giorni dalla fine del periodo di fatturazione</li>
                    <li>Richiesta via email a <strong>billing@voler.ai</strong> con oggetto "Service Credit Request - [Mese/Anno]"</li>
                    <li>Voler AI verifica i log di uptime e risponde entro 5 giorni lavorativi</li>
                    <li>Credit applicato automaticamente alla fattura successiva</li>
                </ol>

                <p className="bg-amber-50 border-l-4 border-amber-500 p-4">
                    <strong>Nota:</strong> I Service Credits sono l'unico rimedio per mancato rispetto dello SLA.
                    Sono esclusi rimborsi in denaro, salvo diverso accordo scritto.
                </p>

                <h2>7. Monitoraggio e Trasparenza</h2>

                <h3>Status Page:</h3>
                <p>
                    Voler AI mantiene una Status Page pubblica disponibile su <strong>status.voler.ai</strong> che mostra:
                </p>
                <ul>
                    <li>Uptime real-time degli ultimi 90 giorni</li>
                    <li>Incident history</li>
                    <li>Manutenzioni programmate</li>
                    <li>Performance metrics (latenza, error rate)</li>
                </ul>

                <h3>Notifiche Incident:</h3>
                <ul>
                    <li><strong>P1 (Critico):</strong> Notifica immediata via email + banner in-app</li>
                    <li><strong>P2 (Alto):</strong> Notifica entro 1 ora via email</li>
                    <li><strong>P3/P4:</strong> Comunicazione post-risoluzione tramite changelog</li>
                </ul>

                <h2>8. Limitazioni SLA</h2>

                <p>
                    Questo SLA NON copre:
                </p>
                <ul>
                    <li>Funzionalità in Beta/Preview esplicitamente contrassegnate</li>
                    <li>Integrazioni con servizi terzi (Zapier, Webhooks custom del cliente)</li>
                    <li>Problemi causati da uso improprio o violazione dei Terms of Service</li>
                    <li>Attacchi DDoS o security incidents non dovuti a negligenza di Voler AI</li>
                    <li>Downtime di provider terzi (OpenAI, Anthropic, Stripe, Neon, Vercel)</li>
                </ul>

                <h2>9. Miglioramento Continuo</h2>

                <h3>Post-Mortem:</h3>
                <p>
                    Per incident P1 con downtime &gt; 1 ora, Voler AI pubblica un post-mortem pubblico entro 7 giorni contenente:
                </p>
                <ul>
                    <li>Timeline dettagliato dell'incident</li>
                    <li>Root cause analysis</li>
                    <li>Impatto quantificato</li>
                    <li>Action items per prevenire ricorrenze</li>
                </ul>

                <h3>Quarterly Business Review (Solo BUSINESS):</h3>
                <p>
                    Clienti BUSINESS hanno accesso a un QBR trimestrale con:
                </p>
                <ul>
                    <li>Analisi uptime e performance del periodo</li>
                    <li>Roadmap features upcoming</li>
                    <li>Feedback session su miglioramenti richiesti</li>
                </ul>

                <h2>10. Modifiche allo SLA</h2>
                <p>
                    Voler AI si riserva il diritto di modificare questo SLA con preavviso di 60 giorni.
                    Modifiche che riducono i livelli di servizio daranno diritto al cliente di recedere dal contratto senza penali.
                </p>

                <h2>11. Contatti</h2>

                <h3>Supporto Tecnico:</h3>
                <ul>
                    <li><strong>Email:</strong> support@voler.ai</li>
                    <li><strong>Chat in-app:</strong> Disponibile per PRO e BUSINESS (durante orari supporto)</li>
                    <li><strong>Emergency (solo BUSINESS):</strong> Numero dedicato fornito via email dopo onboarding</li>
                </ul>

                <h3>Billing & Service Credits:</h3>
                <ul>
                    <li><strong>Email:</strong> billing@voler.ai</li>
                </ul>

                <h3>Status Updates:</h3>
                <ul>
                    <li><strong>Status Page:</strong> status.voler.ai</li>
                    <li><strong>Twitter:</strong> @VolerAI</li>
                </ul>

                <div className="bg-green-50 border-l-4 border-green-500 p-6 my-8">
                    <p className="font-semibold text-green-900 mb-2">💼 SLA Personalizzato per Enterprise</p>
                    <p className="text-sm text-green-800">
                        Aziende con esigenze specifiche possono richiedere un SLA personalizzato con:
                    </p>
                    <ul className="text-sm text-green-800 mt-2">
                        <li>Uptime garantito fino a 99.99% (Four Nines)</li>
                        <li>Supporto 24/7/365</li>
                        <li>Dedicated Success Manager</li>
                        <li>Custom RTO/RPO</li>
                        <li>On-premise deployment options</li>
                    </ul>
                    <p className="text-sm text-green-800 mt-2">
                        Contattaci a <strong>enterprise@voler.ai</strong> per discutere le tue esigenze.
                    </p>
                </div>

                <p className="mt-12 text-sm text-gray-500 border-t pt-6">
                    <strong>Voler AI S.r.l.</strong><br />
                    Via della Tecnologia, 123 - 20100 Milano (MI)<br />
                    P.IVA: IT12345678901<br />
                    Support: support@voler.ai | Billing: billing@voler.ai
                </p>
            </div>
        </div>
    );
}
