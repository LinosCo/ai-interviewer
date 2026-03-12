# Analytics Hierarchy Note (Phase 6)

## Principio
Ogni blocco analytics deve rispondere in ordine a:

1. Cosa sta cambiando
2. Perche conta
3. Dove intervenire
4. Qual e la prossima mossa

## Struttura consigliata

- `Headline decisionale`: sintesi strategica in linguaggio operativo.
- `Priorita`: 2-4 indicatori chiave orientati a decisione.
- `Lettura per lane`: ascolto, tip, esecuzione, misura.
- `Rischi/opportunita`: blocchi e acceleratori a breve.
- `Azione successiva`: collegamento esplicito a Tips/Execute.

## Mapping attuale

- `src/components/analytics/ProjectAnalytics.tsx` implementa:
  - headline decisionale
  - cards prioritarie
  - lettura lane operative
  - rischi/opportunita immediate
  - suggerimenti da portare nel loop

## Regola di copy

- Evitare solo numeri grezzi senza interpretazione.
- Ogni grafico deve avere testo che chiarisce implicazione e decisione.
