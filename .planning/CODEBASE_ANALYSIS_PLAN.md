# Piano di Miglioramento Codebase - AI Interviewer

**Data Analisi:** 2026-01-27
**Stato:** In Esecuzione

---

## Riepilogo Problemi Identificati

### Test (Vitest)
- [ ] `vitest.config.ts` non esiste
- [ ] File test usano CommonJS (`require.main === module`)
- [ ] Path alias `@/` non risolti

### Bug Critici
- [ ] Promise non awaited (memory, token tracking)
- [ ] Race condition metadata update
- [ ] Type casting `as any` diffuso
- [ ] API key può essere stringa vuota
- [ ] `readFileSync` blocca event loop

### Performance
- [ ] N+1 queries in `getPartnerClientsDetailed()`
- [ ] Include annidati senza limiti
- [ ] Nessun caching GlobalConfig
- [ ] Bundle framer-motion/lucide non code-split
- [ ] UsageDashboard senza memoization
- [ ] Indici Prisma mancanti

### File Obsoleti
- [ ] `check-data.js`
- [ ] `design-system-complete.jsx`
- [ ] `final-soft-landing.jsx`
- [ ] `typeform-chat.jsx`
- [ ] Componenti visual-effects non utilizzati
- [ ] `useCreditsCheck.ts` hook
- [ ] `tokenTracker.ts` duplicato
- [ ] `pricing.ts` config duplicata

### UX/Usabilità
- [ ] `alert()`/`confirm()` nativi
- [ ] Nessuna validazione real-time form
- [ ] Bottoni senza disabled state
- [ ] Icone senza aria-label
- [ ] Mix lingue inglese/italiano
- [ ] Empty states mancanti

---

## Piano di Esecuzione

### FASE 1: IMMEDIATE (Oggi)

#### 1.1 Configurazione Vitest ✅
- [x] Creare `vitest.config.ts` con path alias
- [x] Aggiungere script test in package.json
- [x] Verificare che i test passino (3/3 test passano)
- [x] Rinominare script E2E standalone (`.test.ts` → `.script.ts`)

#### 1.2 Fix Bug Critici ✅
- [x] Sostituire `readFileSync` con cache in LLMService
- [ ] Promise in route.ts: MANTENUTE fire-and-forget (intenzionale per non bloccare risposta)
- [ ] Validare API key: esistente validazione con throw error

#### 1.3 Eliminazione File Obsoleti ✅
- [x] Rimuovere file JSX/JS obsoleti in root (4 file eliminati)
- [x] Rimuovere componenti visual-effects non usati (cartella eliminata)
- [x] Rimuovere hook useCreditsCheck.ts
- [ ] tokenTracker.ts: MANTENUTO (usato da conversationLimits.ts)
- [x] Rimuovere pricing.ts duplicato

### FASE 2: ALTA PRIORITÀ (Settimana 1) ✅

#### 2.1 Database Performance ✅
- [x] Aggiungere indici Prisma mancanti (9 indici aggiunti)
- [x] Ottimizzare query N+1 partnerService (Promise.all + batch query)
- [x] Implementare caching GlobalConfig (5 min TTL)
- [x] Fix bug partner/page.tsx (include non valido → count)

#### 2.2 UX Critici
- [ ] Sostituire alert()/confirm() con modal
- [ ] Standardizzare messaggi in italiano
- [ ] Aggiungere aria-labels alle icone

### FASE 3: MEDIA PRIORITÀ (Settimana 2) ✅

#### 3.1 Performance Frontend ✅
- [x] Import già ottimizzati (tree-shakeable, nessun wildcard)
- [x] Aggiungere memoization UsageDashboard (useMemo, useCallback, memo)
- [x] ToolUsageItem estratto come componente memoizzato

#### 3.2 UX Miglioramenti ✅
- [x] Creato ConfirmDialog riutilizzabile
- [x] Creato hook useConfirmDialog
- [x] Sostituiti alert()/confirm() in bot-card, BotListItem, project-card
- [x] Aggiunti aria-hidden alle icone decorative

#### 3.3 Form e Validazione (Future)
- [ ] Validazione real-time form critici
- [ ] Password strength indicator
- [ ] Empty states per liste filtrabili

### FASE 4: BASSA PRIORITÀ (Mese 1)

- [ ] Responsive modal
- [ ] Cursor not-allowed su disabled
- [ ] Retention policy ChatbotSession
- [ ] Limiti dimensione JSON fields

---

## File Modificati

| File | Azione | Stato |
|------|--------|-------|
| `vitest.config.ts` | Creato | ✅ |
| `package.json` | Aggiunto script test | ✅ |
| `src/services/llmService.ts` | Fix readFileSync con cache | ✅ |
| `check-data.js` | Eliminato | ✅ |
| `design-system-complete.jsx` | Eliminato | ✅ |
| `final-soft-landing.jsx` | Eliminato | ✅ |
| `typeform-chat.jsx` | Eliminato | ✅ |
| `src/components/ui/visual-effects/*` | Eliminata cartella | ✅ |
| `src/hooks/useCreditsCheck.ts` | Eliminato | ✅ |
| `src/config/pricing.ts` | Eliminato | ✅ |
| `src/lib/tests/*.test.ts` | Rinominati in `.script.ts` | ✅ |
| `prisma/schema.prisma` | Aggiunti 9 indici DB | ✅ |
| `src/services/partnerService.ts` | Ottimizzato N+1 queries | ✅ |
| `src/services/llmService.ts` | Cache GlobalConfig + metodology | ✅ |
| `src/app/dashboard/partner/page.tsx` | Fix include → count | ✅ |
| `src/components/ui/confirm-dialog.tsx` | Nuovo componente + hook | ✅ |
| `src/components/bot-card.tsx` | Migrato a ConfirmDialog | ✅ |
| `src/components/dashboard/BotListItem.tsx` | Migrato a ConfirmDialog | ✅ |
| `src/components/project-card.tsx` | Migrato a ConfirmDialog | ✅ |
| `src/components/dashboard/UsageDashboard.tsx` | Memoization ottimizzata | ✅ |
| `src/components/dashboard/InterviewsList.tsx` | Aggiunti aria-hidden | ✅ |

---

## Note

- I test E2E (`interview-e2e.test.ts`, `conversation-flow.test.ts`) sono script standalone, non test Vitest standard
- La migration cancellata `20260126_add_cms_performance_tracking` deve essere verificata
- Il servizio `tokenTracker.ts` è usato in `conversationLimits.ts` - necessario aggiornare prima di eliminare
