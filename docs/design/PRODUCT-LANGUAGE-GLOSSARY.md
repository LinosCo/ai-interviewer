# Product Language Glossary

## Obiettivo

Questo glossario congela il linguaggio di Phase 6. Ogni nuova superficie deve riusare questi termini senza introdurre sinonimi locali.

## Loop operativo del progetto

| Sezione | Significato | Cosa trova l'utente |
| --- | --- | --- |
| `Overview` | Quadro operativo del progetto | stato generale, tool attivi, team, attivazione |
| `Listen` | Raccolta dei segnali | conversazioni, interviste, visibility, fonti |
| `Tips` | Prioritizzazione delle decisioni | tip canonici, reasoning, evidenze, prossime mosse |
| `Execute` | Messa in azione dei tip | routing, policy, invii, esecuzioni |
| `Measure` | Lettura dei risultati | trend, confronto, impatto, prossima decisione |
| `Strategy` | Inquadramento strategico | posizionamento, priorita, metodo, contesto |
| `Connections` | Collegamenti con tool esterni | CMS, WordPress, Google, n8n, stato setup |

## Oggetti canonici

- `Tip canonico`: unita operativa centrale che collega segnale, logica, routing ed esecuzione.
- `Segnale`: evidenza o pattern osservato nelle fonti progetto.
- `Routing`: regola o configurazione che decide dove inviare un tip o un contenuto derivato.
- `Esecuzione`: evento tracciato di invio o azione su un canale esterno.
- `Connessione`: integrazione attiva con un sistema esterno.

## Stati canonici del tip

| Stato tecnico | Etichetta UX | Uso |
| --- | --- | --- |
| `manual_only` | `Solo manuale` | il tip non ha ancora una strada operativa configurata |
| `ready_to_route` | `Pronto da instradare` | il tip ha struttura chiara e puo entrare in routing |
| `awaiting_approval` | `In attesa di approvazione` | esiste una regola o un invio che richiede conferma |
| `automated` | `Automatizzato` | il tip puo essere gestito da un flusso automatico |
| `completed` | `Completato` | il ciclo operativo principale e stato chiuso |
| `failed` | `Da correggere` | un route o una execution e fallita |

## Regole di denominazione

- Preferire `tip` a `insight` quando si parla dell'oggetto operativo.
- Usare `segnale` quando si parla dell'origine dati e non della decisione.
- Usare `instradare` o `routing` solo per la parte di destinazione/esecuzione.
- Usare `connessioni` per setup esterno e `execute` per il momento operativo del tip.
- Mantenere in inglese solo termini gia naturalizzati nel prodotto: `Overview`, `Listen`, `Tips`, `Execute`, `Measure`, `Strategy`, `Connections`, `routing`, `Copilot`.

## CTA approvate

- `Apri overview`
- `Vedi segnali`
- `Rivedi tip`
- `Configura routing`
- `Apri connections`
- `Misura impatto`
- `Usa nel Copilot`
- `Completa setup`
- `Correggi blocco`

## Template di pagina

- `Eyebrow`: nome sezione o contesto.
- `Titolo`: orientato al risultato, non al modulo tecnico.
- `Descrizione`: deve spiegare cosa si decide o si fa in quella sezione.
- `Barra riassuntiva`: deve mostrare stato progetto, volume tip e readiness operativa.

## Empty state

Ogni empty state deve contenere:

1. cosa manca
2. perche conta
3. prima azione consigliata

## Guidance layer

- La guidance e `contestuale`, `disattivabile`, `riapribile`.
- La guidance non blocca il lavoro: suggerisce il prossimo passo utile.
- La guidance usa lo stesso vocabolario del loop operativo.

## Gerarchia analytics

Le analytics devono sempre rispondere in questo ordine:

1. `Cosa sta cambiando`
2. `Perche conta`
3. `Dove intervenire`
4. `Qual e la prossima mossa`

## IA sintetica Phase 6

```text
Overview -> Listen -> Tips -> Execute -> Measure
                     \-> Strategy
Connections supporta Execute ma resta una sezione distinta di setup.
```
