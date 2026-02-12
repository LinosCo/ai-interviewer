# Live Conversation Flow Benchmark (Production vs Staging)

Generated at: 2026-02-12T08:43:51.606Z
Bot ID: cmke4ayef000613i8m5dkiuli
Runs per env: 6 | maxTurns per run: 12

## Summary Metrics

| Metric | Production | Staging | Delta (Stg-Prod) |
|---|---:|---:|---:|
| Completion rate | 0.00% | 33.33% | 33.33 pp |
| Pass rate (>=80 + DEEP + DATA + transition<=2) | 0.00% | 0.00% | 0.00 pp |
| Has DEEP rate | 0.00% | 100.00% | 100.00 pp |
| Has DATA_COLLECTION rate | 0.00% | 50.00% | 50.00 pp |
| Interesting signal capture | 79.17% | 79.17% | 0.00 pp |
| Engagement quality | 16.67% | 22.22% | 5.56 pp |
| Semantic understanding | 62.50% | 68.06% | 5.56 pp |
| Non-generic question rate | 98.61% | 100.00% | 1.39 pp |
| Avg semantic score | 79.00 | 76.50 | -2.50 |
| Avg transition failures | 0.00 | 2.67 | 2.67 |
| Avg consent failures | 0.00 | 0.00 | 0.00 |
| HTTP error runs | 0.00 | 0.00 | 0.00 |

## PRODUCTION Worst Run
- run: 2 | persona: leader_collaborativo | conversationId: cmlj7c7140001odrq4w8ihvpd
- completed: false | semanticScore: 74 | deep: false | dataCollection: false
```text
U: L urgenza è culturale: servono competenze e fiducia nel cambiamento.
A[-|-]: È un punto cruciale quello che hai sollevato riguardo alla cultura e al cambiamento. Quali aspettative ha la tua azienda rispetto all'introduzione dell'intelligenza artificiale?
U: Ferri SPA
A[-|-]: È interessante vedere come Ferri SPA stia affrontando il tema. Ci sono progetti significativi in corso legati all'intelligenza artificiale nella tua azienda?
U: te l ho gia detto
A[-|-]: Grazie per avermi aggiornato. Parlando del valore percepito delle iniziative AI, come vengono viste queste innovazioni all'interno della tua organizzazione?
U: te l ho gia detto
A[-|-]: Capisco, grazie per la pazienza. Tornando al TEDx, ci sono temi specifici o iniziative legate all'intelligenza artificiale che ti interesserebbe vedere affrontati durante l'evento?
U: Le aspettative sul TEDx sono alte: mi aspetto visione ma anche strumenti pratici.
A[-|-]: È un'aspettativa importante quella di combinare visione e praticità. Ci sono temi specifici o strumenti pratici che pensi potrebbero essere particolarmente utili per la tua azienda durante il TEDx?
U: te l ho gia detto
A[-|-]: Grazie per aver condiviso le tue aspettative. Se dovessi pensare alla collaborazione con TEDx, quali aspetti ritieni avrebbero più valore per la tua azienda?
U: te l ho gia detto
A[-|-]: Capisco, grazie per la tua pazienza. Se ci sono altre considerazioni che ritieni importanti riguardo al TEDx, sentiti libero di condividerle.
U: Le aspettative sul TEDx sono alte: mi aspetto visione ma anche strumenti pratici.
A[-|-]: Grazie per aver ribadito questo punto. Se ci fosse un percorso di co-progettazione con alcuni reparti della tua azienda, quali temi o progetti ti piacerebbe esplorare?
U: te l ho gia detto
A[-|-]: Capisco che tu abbia già condiviso alcune informazioni. Grazie per la tua pazienza. Hai qualche minuto in più per rispondere ad alcune domande di approfondimento?
U: Le aspettative sul TEDx sono alte: mi aspetto visione ma anche strumenti pratici.
A[-|-]: Grazie per aver condiviso le tue aspettative sul TEDx. Hai qualche minuto in più per continuare con alcune domande extra di approfondimento?
U: si continuiamo
A[-|-]: Perfetto, grazie per la disponibilità. Tornando al tema dell'intelligenza artificiale, ci sono timori o resistenze particolari nel tuo settore riguardo all'adozione di queste tecnologie?
U: Mi interessa capire come trasformare insight in iniziative concrete.
A[-|-]: Questa è una prospettiva molto pratica. Ci sono esempi o idee specifiche su come vorresti vedere questi insight trasformarsi in iniziative nella tua azienda?
```

## STAGING Worst Run
- run: 2 | persona: leader_collaborativo | conversationId: cmlj7jhs90007odrqj8mni91f
- completed: false | semanticScore: 74 | deep: true | dataCollection: false
```text
U: L urgenza è culturale: servono competenze e fiducia nel cambiamento.
A[SCAN|Percezione dell'Intelligenza Artificiale]: Hai toccato un punto cruciale riguardo l'importanza delle competenze e della fiducia nel cambiamento. Quali sono le tue aspettative rispetto all'utilizzo dell'intelligenza artificiale nella tua azienda?
U: Ferri SPA
A[SCAN|Percezione dell'Intelligenza Artificiale]: Grazie per aver menzionato Ferri SPA. Mi interessa sapere, attualmente, qual è il livello di conoscenza e competenza sull'intelligenza artificiale nella tua azienda?
U: Ferri SPA
A[SCAN|Iniziative Aziendali sull'AI]: È utile sapere che lavori presso Ferri SPA. Puoi raccontarmi se ci sono progetti significativi in corso legati all'intelligenza artificiale nella tua azienda?
U: te l ho gia detto
A[SCAN|Iniziative Aziendali sull'AI]: Grazie per la pazienza. Passando ad un altro aspetto, ci sono progetti futuri in sviluppo che coinvolgono l'intelligenza artificiale?
U: Stiamo lavorando su processi cross-team per sperimentare in modo responsabile.
A[SCAN|Iniziative Aziendali sull'AI]: È interessante che stiate adottando un approccio cross-team. Quali benefici sperate di ottenere attraverso queste sperimentazioni con l'AI?
U: Stiamo lavorando su processi cross-team per sperimentare in modo responsabile.
A[SCAN|Aspettative per il TEDx]: Capisco, grazie per aver condiviso. Pensando al TEDx, quali temi o iniziative specifiche legate all'intelligenza artificiale ti interesserebbero particolarmente?
U: Stiamo lavorando su processi cross-team per sperimentare in modo responsabile.
A[SCAN|Aspettative per il TEDx]: Grazie per aver sottolineato il focus sui processi cross-team. In relazione al TEDx, ci sono aspetti particolari di questa collaborazione che ritieni potrebbero avere un valore aggiunto per Ferri SPA?
U: Il valore emerge quando tecnologia e persone crescono insieme.
A[SCAN|Aspettative per il TEDx]: Quello che dici è molto significativo. In che modo pensi che una collaborazione con TEDx possa supportare questa crescita congiunta di tecnologia e persone?
U: Mi interessa capire come trasformare insight in iniziative concrete.
A[DEEP|Percezione dell'Intelligenza Artificiale]: È un obiettivo importante. Quali tipi di supporto o risorse pensi potrebbero facilitare questa trasformazione degli insight in azioni concrete all'interno della tua azienda?
U: te l ho gia detto
A[DEEP_OFFER|Percezione dell'Intelligenza Artificiale]: Grazie per la tua pazienza. Vuoi continuare l'intervista per qualche minuto in più per esplorare altri aspetti?
U: si continuiamo
A[DEEP|Percezione dell'Intelligenza Artificiale]: Ottimo, grazie! Parlando di aspettative, quali risultati speri di vedere dall'integrazione dell'intelligenza artificiale nei vostri processi aziendali?
U: Stiamo lavorando su processi cross-team per sperimentare in modo responsabile.
A[DEEP|Percezione dell'Intelligenza Artificiale]: Capisco che i processi cross-team siano fondamentali. Quali sfide avete incontrato finora in questo approccio e come le state affrontando?
```
