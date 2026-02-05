# Piano di intervento - Sintesi e priorita

**Sintesi**
Ho fatto una revisione statica della repo (non ho eseguito build/test). Il prodotto ha una base solida, ma ci sono alcune criticita che impattano sicurezza/compliance, affidabilita e qualita percepita. Le piu urgenti sono: gestione migrazioni DB in produzione, logging di dati sensibili, consenso cookie/AI Act, incoerenze UI e costo/latency dei prompt “AI tips”.

---

**Priorita (Urgenza + ROI)**
| # | Problema | Evidenza | Impatto | Urgenza | ROI |
|---|---|---|---|---|---|
| 1 | `postinstall` fa `prisma db push` in build | `package.json` | Rischio schema drift e potenziale perdita dati su DB prod | **Ora** | **Alta** |
| 2 | Log di PII in server/API | `src/app/api/chat/route.ts`, `src/app/actions/admin.ts`, `src/app/api/bots/create-from-config/route.ts` | Rischio GDPR/AI Act + esposizione dati sensibili | **Ora** | **Alta** |
| 3 | Consenso cookie solo “UI”, senza gating reale | `src/components/CookieConsent.tsx` | Non conformita GDPR (analytics/marketing senza consenso) | **Ora** | **Alta** |
| 4 | Due design system in conflitto (tailwind vs inline) | `src/components/ui/button.tsx`, `src/components/ui/business-tuner/Button.tsx`, `src/app/(marketing)/pricing/page.tsx` | UI incoerente, brand perception fragile | **Prossime 2-4 settimane** | **Media/Alta** |
| 5 | AI Tips generici quando manca strategia | `src/lib/insights/sync-engine.ts` | Basso valore percepito dagli early clienti | **Prossime 2-4 settimane** | **Alta** |
| 6 | Logging e prompt estremamente pesanti | `src/app/api/chat/route.ts`, `src/lib/insights/sync-engine.ts`, `src/app/api/copilot/chat/route.ts` | Latenza, costi LLM alti, performance | **Prossime 2-4 settimane** | **Alta** |
| 7 | “Feature guard” non usata | `src/middleware/featureGuard.ts` | Possibili accessi a feature non autorizzate | **Prossime 2-4 settimane** | **Media** |
| 8 | Memory manager usa count di “facts” per media risposta | `src/lib/memory/memory-manager.ts` | Metriche di qualita/fatica distorte | **Prossime 4-6 settimane** | **Media** |
| 9 | Polling senza cleanup su unmount | `src/app/dashboard/insights/page.tsx` | Leak + richieste inutili | **Backlog breve** | **Media** |
| 10 | Doppie pagine Cookie Policy | `src/app/(marketing)/cookies/page.tsx`, `src/app/(marketing)/cookie-policy/page.tsx` | Incoerenza legale e UX | **Backlog breve** | **Bassa** |

---

**UI/UX – Coerenza e Qualita Visiva**
- Due UI kit paralleli con colori diversi: `src/components/ui/button.tsx` (violet) vs `src/components/ui/business-tuner/Button.tsx` (coral/amber). Questo rompe la continuita tra marketing e dashboard. Urgenza: **Media**, ROI: **Alta**.
- Pricing page usa palette indigo non allineata al brand principale. Evidenza: `src/app/(marketing)/pricing/page.tsx`. Urgenza: **Media**, ROI: **Media**.
- Font incoerenti: layout importa Geist, ma `globals.css` imposta `--font-sans` su Inter e il tailwind config e in `src/tailwind.config.ts` (probabile non caricato). Evidenza: `src/app/layout.tsx`, `src/app/globals.css`, `src/tailwind.config.ts`. Urgenza: **Media**, ROI: **Media**.
- Animazioni e background molto pesanti senza fallback `prefers-reduced-motion`. Evidenza: `src/components/landing/FluidBackground.tsx`, `src/app/globals.css`. Urgenza: **Media**, ROI: **Media**.
- Copilot floating window con dimensioni fisse, potenzialmente scomodo su viewport piccoli. Evidenza: `src/components/copilot/StrategyCopilot.tsx`. Urgenza: **Bassa**, ROI: **Media**.

---

**Bug e Criticita Tecniche**
- Migrazioni DB non sicure: `prisma db push` in `postinstall` puo applicare cambi non versionati. Evidenza: `package.json`. Urgenza: **Alta**.
- Log di PII (email, profili, messaggi). Evidenza: `src/app/api/chat/route.ts`, `src/app/actions/admin.ts`. Urgenza: **Alta**.
- Memory/analytics: `avgResponseLength` calcolato usando count di fatti, non messaggi. Evidenza: `src/lib/memory/memory-manager.ts`. Urgenza: **Media**.
- Polling senza cleanup in dashboard insights. Evidenza: `src/app/dashboard/insights/page.tsx`. Urgenza: **Bassa**.
- `CreditNotificationService` usa `Map` in-memory: in serverless e volatile e puo duplicare email. Evidenza: `src/services/creditNotificationService.ts`. Urgenza: **Media**.

---

**Codice Inutilizzato / Ridondante**
- `src/app/(marketing)/page.tsx.bak`
- `prisma/schema.prisma.bak`
- Middleware non usati: `src/middleware/rateLimiter.ts`, `src/middleware/responseLimit.ts`, `src/middleware/conversationLimits.ts`, `src/middleware/simulationLimiter.ts`, `src/middleware/featureGuard.ts`
- Script di test non integrati nel runner: `src/lib/tests/*.script.ts` (non coperti da `vitest.config.ts`).

---

**Performance – Frontend**
- Background animati e blur grandi (GPU heavy). Ridurre count, aggiungere `prefers-reduced-motion`, e disabilitare animazioni su mobile. Evidenza: `src/components/landing/FluidBackground.tsx`, `src/app/globals.css`.
- Middleware globale su tutte le route. Possibile ridurre matcher a `/dashboard/*` e `/api/*` per evitare overhead. Evidenza: `src/middleware.ts`.

---

**Performance – Backend & LLM**
- `CrossChannelSyncEngine` costruisce prompt giganteschi con `JSON.stringify` su molti dati. Evidenza: `src/lib/insights/sync-engine.ts`. Suggerito: pre-aggregazione e riduzione token; caching per 10-30 minuti. ROI alta.
- Copilot include conversazioni annidate (100) con analysis+themes in una singola query. Evidenza: `src/app/api/copilot/chat/route.ts`. Suggerito: ridurre campi e campionare per ultimo periodo.
- Logging verboso in API chat. Evidenza: `src/app/api/chat/route.ts`. Ridurre o guardare con `NODE_ENV`.

---

**Compliance (GDPR, AI Act, Accessibility Act)**
- Cookie consent e solo UI: manca controllo reale su analytics e marketing. Evidenza: `src/components/CookieConsent.tsx`. Urgenza: **Alta**.
- AI Act: serve disclosure chiara “interazione con AI” + possibilita di contatto umano, logica, e tracciamento decisioni. Attualmente solo “Powered by AI”. Evidenza: `src/components/chat/WelcomeScreen.tsx`. Urgenza: **Alta**.
- Accessibilita: mancano fallback `prefers-reduced-motion` e alcune UI custom non hanno `aria-label` espliciti (es. close button). Evidenza: `src/components/CookieConsent.tsx`, `src/components/landing/FluidBackground.tsx`. Urgenza: **Media**.

---

**Miglioramenti Funzionali ad Alto ROI**
- Interviste: passare il contesto storico al fact extractor e correggere la logica di media risposta. Evidenza: `src/lib/memory/memory-manager.ts`. ROI: **Alta**.
- AI Tips: rendere obbligatoria la strategia o usare un prompt guidato + template settoriali per PMI veronesi. Evidenza: `src/lib/insights/sync-engine.ts`. ROI: **Alta**.
- Brand monitoring: unificare SERP + AI overview con scoring stabile e soglie di alert per consulenti partner. Evidenza: `src/lib/visibility/*`. ROI: **Media/Alta**.
- Chatbot: generazione automatica FAQ da conversazioni reali con “one-click apply” in UI (gia supportato da `add_faq`). ROI: **Alta**.
