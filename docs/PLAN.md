# Piano di intervento - Sintesi e priorità

**Sintesi**
Ho fatto una revisione statica della repo (non ho eseguito build/test). Il prodotto ha una base solida, ma ci sono alcune criticità che impattano sicurezza/compliance, affidabilità e qualità percepita. Le più urgenti sono: gestione migrazioni DB in produzione, logging di dati sensibili, consenso cookie/AI Act, incoerenze UI e costo/latency dei prompt "AI tips".

**Ultimo aggiornamento stato:** 2026-03-01 — verificati i 10 item contro la codebase reale.

---

## Stato attuale (verificato 2026-03-01)

| # | Problema | Evidenza | Stato |
|---|---|---|---|
| 1 | `postinstall` fa `prisma db push` in build | `package.json` | ✅ **RISOLTO** — Sprint 1 ha rimosso lo script |
| 2 | Log di PII in server/API | `src/app/api/chat/route.ts`, `src/app/actions/admin.ts` | ✅ **RISOLTO** — Sprint 9 ha rimosso log di email/profili; rimane solo `conversationId` e preview testo (400 chars) |
| 3 | Consenso cookie solo "UI", senza gating reale | `src/components/CookieConsent.tsx` | ✅ **ACCETTABILE** — nessuno script analytics/marketing caricato nel layout; gating non necessario al momento |
| 4 | Due design system in conflitto (tailwind vs inline) | `src/components/ui/button.tsx`, `src/components/ui/business-tuner/Button.tsx` | ⚠️ **OPEN** — bassa priorità, backlog |
| 5 | AI Tips generici quando manca strategia | `src/lib/insights/sync-engine.ts` | ⚠️ **OPEN** — ancora da ottimizzare |
| 6 | Logging e prompt estremamente pesanti | `src/lib/insights/sync-engine.ts` | ⚠️ **OPEN** — `JSON.stringify` su oggetti grandi nei prompt; ancora da ridurre |
| 7 | "Feature guard" non usata | `src/middleware/featureGuard.ts` | ✅ **RISOLTO** — file eliminato nei cleanup Sprint 7-9 |
| 8 | Memory manager usa count di "facts" per media risposta | `src/lib/memory/memory-manager.ts` | ✅ **RISOLTO** — ora usa `messageLength` correttamente (running average) |
| 9 | Polling senza cleanup su unmount | `src/app/dashboard/insights/page.tsx` | ✅ **ACCETTABILE** — polling avviato da click, non da `useEffect`; timeout 120s presente come fallback |
| 10 | Doppie pagine Cookie Policy | `src/app/(marketing)/cookies/page.tsx`, `src/app/(marketing)/cookie-policy/page.tsx` | ✅ **RISOLTO** — `cookies/page.tsx` ora è un redirect permanente a `/cookie-policy` |

---

## Item ancora aperti (priorità residua)

### 4. Dual design system — Backlog basso
- **Due UI kit paralleli:** `src/components/ui/button.tsx` (violet/tailwind) vs `src/components/ui/business-tuner/Button.tsx` (coral/amber)
- **Effetto:** UI incoerente tra marketing e dashboard; brand perception fragile
- **Fix suggerito:** Consolidare in un unico sistema; il Button coral/amber è usato nel marketing, quello violet in dashboard
- **Urgenza:** Bassa — nessun impatto funzionale

### 5 + 6. AI Tips generici / Prompt pesanti — Backlog medio
- **File:** `src/lib/insights/sync-engine.ts` (598 righe)
- **Problema:** Il `CrossChannelSyncEngine` costruisce prompt con `JSON.stringify` su oggetti interi (websiteSummary, chatbotSummary, interviewSummary, visibilitySummary + SERP)
- **Effetto:** Latenza alta, costi LLM elevati, AI Tips poco specifici senza strategia impostata
- **Fix suggerito:** Pre-aggregare i dati (top N elementi), caching 10-30 minuti, template settoriali per AI Tips
- **Urgenza:** Media — impatta costi e qualità UX

---

## UI/UX – Coerenza e Qualità Visiva

- Due UI kit paralleli con colori diversi (vedi item 4 sopra). Urgenza: **Bassa**, ROI: **Alta**.
- Pricing page usa palette indigo non allineata al brand principale. Evidenza: `src/app/(marketing)/pricing/page.tsx`. Urgenza: **Bassa**, ROI: **Media**.
- Font incoerenti: layout importa Geist, ma `globals.css` imposta `--font-sans` su Inter. Evidenza: `src/app/layout.tsx`, `src/app/globals.css`. Urgenza: **Bassa**, ROI: **Media**.
- Animazioni e background molto pesanti senza fallback `prefers-reduced-motion`. Evidenza: `src/components/landing/FluidBackground.tsx`. Urgenza: **Bassa**, ROI: **Media**.

---

## Codice rimosso / già sistemato nei Sprint 1-9

- ✅ `src/app/(marketing)/page.tsx.bak` — rimosso
- ✅ `prisma/schema.prisma.bak` — rimosso
- ✅ Middleware non usati rimossi: `rateLimiter.ts`, `responseLimit.ts`, `conversationLimits.ts`, `simulationLimiter.ts`, `featureGuard.ts`
- ✅ Migrazioni DB: `postinstall` rimosso; schema gestito via `prisma migrate deploy`
- ✅ Log PII: rimossi log di email, profili completi, token utente
- ✅ Memory `avgResponseLength`: calcolo corretto con `messageLength`
- ✅ Cookie Policy duplicata: redirect canonical su `/cookie-policy`

---

## Performance – Backend & LLM (ancora open)

- `CrossChannelSyncEngine` costruisce prompt giganteschi con `JSON.stringify` su molti dati. Evidenza: `src/lib/insights/sync-engine.ts`. Suggerito: pre-aggregazione e riduzione token; caching per 10-30 minuti. ROI alta.
- Copilot include conversazioni annidate (100) con analysis+themes in una singola query. Evidenza: `src/app/api/copilot/chat/route.ts`. Suggerito: ridurre campi e campionare per ultimo periodo.

---

## Compliance (GDPR, AI Act, Accessibility)

- ✅ Cookie consent: componente con Accept/Decline funzionante; nessuno script esterno da gateare al momento.
- ⚠️ AI Act: serve disclosure chiara "interazione con AI" + possibilità di contatto umano. Attualmente solo "Powered by AI". Evidenza: `src/components/chat/WelcomeScreen.tsx`. Urgenza: **Media**.
- ⚠️ Accessibilità: mancano fallback `prefers-reduced-motion` e alcuni `aria-label` su close buttons. Urgenza: **Bassa**.

---

## Miglioramenti Funzionali ad Alto ROI (backlog)

- Interviste: il fatto extractor manca del contesto storico completo. Evidenza: `src/lib/memory/memory-manager.ts`. ROI: **Alta**.
- AI Tips: rendere obbligatoria la strategia o usare un prompt guidato + template settoriali per PMI. ROI: **Alta**.
- Chatbot: generazione automatica FAQ da conversazioni reali con "one-click apply" in UI (già supportato da `add_faq`). ROI: **Alta**.

---

*Prima audit: 2026-01-26 | Verifica stato: 2026-03-01*
