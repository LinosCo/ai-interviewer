# Guidance State Model (Phase 6)

## Obiettivo
Garantire guidance contestuale, disattivabile e riapribile senza bloccare il lavoro.

## Stato

- `enabled`: guida attiva/disattiva globalmente.
- `dismissedSteps`: passi chiusi dall'utente in questa sessione di lavoro.
- `completedCheckpoints`: passi completati in base a stato reale del progetto.

## Persistenza

- Storage locale client tramite `src/lib/guidance/guidance-state.ts`.
- Chiave versione: `bt_phase6_guidance_state_v1`.

## Regole

- Mostrare popup solo quando il contesto lo richiede.
- Non mostrare passi gia completati o dismessi.
- Consentire riapertura della guida tramite toggle dedicato.

## Componenti

- `src/components/guidance/GuidanceLayer.tsx`
- `src/components/guidance/GuidancePopup.tsx`
- `src/components/guidance/GuideToggle.tsx`
- `src/components/guidance/ProjectActivationChecklist.tsx`

## Verifica

- test guidance state: `src/lib/guidance/__tests__/guidance-state.test.ts`
