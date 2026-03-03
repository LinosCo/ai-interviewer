# BT AI Tips -> CMS voler.ai Chatbot Contract

## Scopo
Definire un contratto univoco per trasmettere da BT al CMS (`voler.ai`) task editoriali/SEO come prompt strutturati, con isolamento tenant, validazione forte e output applicabile in sicurezza.

## Obiettivi
- Rendere i "tips" eseguibili dal chatbot CMS senza ambiguita'.
- Distinguere chiaramente il tipo di intervento (`interventionType`) dal task operativo (`taskType`).
- Standardizzare input/output per orchestrazione asincrona e audit.

## Modello Concettuale
- `interventionType`: macro-categoria business (cosa si vuole migliorare).
- `taskType`: azione operativa specifica (cosa deve fare il bot).
- `targetScope`: dove applicare l'azione (site, section, page, component).
- `executionMode`: simulazione (`dry_run`) o proposta pronta per apply (`propose_patch`).

## Tassonomia Interventi

### 1) `CONTENT_QUALITY`
Migliora chiarezza, completezza e leggibilita'.
- Task principali:
  - `REWRITE_BLOCK`
  - `EXPAND_SECTION`
  - `SUMMARIZE_SECTION`
  - `IMPROVE_READABILITY`
  - `LOCALIZE_COPY`

### 2) `SEO_ONPAGE`
Ottimizza segnali on-page per ricerca tradizionale e AI search.
- Task principali:
  - `OPTIMIZE_TITLE`
  - `OPTIMIZE_META_DESCRIPTION`
  - `OPTIMIZE_H1_H2`
  - `ADD_INTERNAL_LINKS`
  - `IMPROVE_ENTITY_COVERAGE`

### 3) `CONVERSION_CRO`
Migliora conversione e chiarezza del valore.
- Task principali:
  - `REWRITE_CTA`
  - `ADD_TRUST_ELEMENTS`
  - `REFINE_VALUE_PROP`
  - `SIMPLIFY_FORM_COPY`
  - `REDUCE_FRICTION_COPY`

### 4) `ACCESSIBILITY_COMPLIANCE`
Migliora accessibilita' dei contenuti testuali.
- Task principali:
  - `SIMPLIFY_LANGUAGE`
  - `ADD_IMAGE_ALT_TEXT`
  - `FIX_LINK_TEXT_CLARITY`
  - `IMPROVE_HEADING_STRUCTURE`

### 5) `BRAND_VOICE`
Allinea tone-of-voice al brand.
- Task principali:
  - `ALIGN_TONE`
  - `APPLY_STYLE_GUIDE`
  - `NORMALIZE_TERMINOLOGY`

### 6) `CONTENT_GOVERNANCE`
Task di manutenzione e coerenza cross-page.
- Task principali:
  - `DETECT_DUPLICATE_CONTENT`
  - `STANDARDIZE_SECTIONS`
  - `FLAG_STALE_CONTENT`
  - `ENFORCE_LEGAL_DISCLAIMER`

## Catalogo Task Operativi (Dettaglio)
Ogni task deve dichiarare `taskType`, `targetScope`, `inputData`, `acceptanceRules`.

### Rewriting / Editing
- `REWRITE_BLOCK`: riscrive un blocco mantenendo significato e intent.
- `EXPAND_SECTION`: estende contenuto con dettagli utili.
- `SUMMARIZE_SECTION`: crea versione sintetica per hero/snippet.
- `LOCALIZE_COPY`: adatta lingua/locale mantenendo intent commerciale.
- `ALIGN_TONE`: riallinea tono secondo profile brand.

### SEO
- `OPTIMIZE_TITLE`: title tag entro limite caratteri con keyword primaria.
- `OPTIMIZE_META_DESCRIPTION`: meta description orientata CTR.
- `OPTIMIZE_H1_H2`: struttura heading logica, senza keyword stuffing.
- `ADD_INTERNAL_LINKS`: propone anchor e destinazioni interne rilevanti.
- `IMPROVE_ENTITY_COVERAGE`: aggiunge entita' e contesto semantico.

### CRO
- `REWRITE_CTA`: CTA action-oriented con beneficio esplicito.
- `REFINE_VALUE_PROP`: chiarisce outcome/benefit principale.
- `SIMPLIFY_FORM_COPY`: riduce frizione testuale nei form.
- `ADD_TRUST_ELEMENTS`: suggerisce social proof, garanzie, proof points.

### Accessibility
- `SIMPLIFY_LANGUAGE`: lessico semplice e frasi piu' brevi.
- `ADD_IMAGE_ALT_TEXT`: genera alt text descrittivi e non ridondanti.
- `FIX_LINK_TEXT_CLARITY`: evita "clicca qui", usa anchor semantiche.
- `IMPROVE_HEADING_STRUCTURE`: normalizza gerarchia H1-H6.

### Governance
- `DETECT_DUPLICATE_CONTENT`: identifica duplicazioni e propone canonicalizzazione editoriale.
- `FLAG_STALE_CONTENT`: segnala contenuti potenzialmente obsoleti.
- `ENFORCE_LEGAL_DISCLAIMER`: verifica e applica disclaimer obbligatori.

## Scope di destinazione (`targetScope`)
- `SITE`: azione trasversale su sito/tenant.
- `SECTION`: area specifica (es. blog, docs, landing).
- `PAGE`: singola pagina (`pageId` o `url`).
- `COMPONENT`: blocco specifico (`blockId`, selector o field path).

Campi minimi target:
- `scopeType`: `SITE|SECTION|PAGE|COMPONENT`
- `siteId`: string
- `sectionId`: string opzionale
- `pageId`: string opzionale
- `url`: string opzionale
- `componentRef`: string opzionale

## Payload consigliato BT -> CMS

```json
{
  "siteId": "site_123",
  "locale": "it-IT",
  "interventionType": "SEO_ONPAGE",
  "taskType": "OPTIMIZE_META_DESCRIPTION",
  "priority": "MEDIUM",
  "targetScope": {
    "scopeType": "PAGE",
    "siteId": "site_123",
    "pageId": "pg_784",
    "url": "https://example.com/servizi/consulenza"
  },
  "inputData": {
    "currentContent": "...",
    "keywords": ["consulenza strategica", "business tuner"],
    "brandVoiceProfile": "professionale, diretto, concreto",
    "constraints": [
      "Mantieni naming prodotto invariato",
      "No claim assoluti"
    ]
  },
  "acceptanceRules": {
    "maxChanges": 5,
    "maxTitleLength": 60,
    "maxMetaDescriptionLength": 155,
    "forbiddenTerms": ["garantito al 100%"]
  },
  "executionMode": "dry_run",
  "metadata": {
    "tipId": "tip_20260303_001",
    "source": "bt-ai-tips",
    "generatedAt": "2026-03-03T14:00:00Z"
  }
}
```

## Mapping Tip BT -> Contract
- Tip generico BT -> `interventionType` + `taskType`.
- Prompt libero BT -> `inputData.instructions` (non sostituisce i campi strutturati).
- Vincoli BT -> `inputData.constraints` + `acceptanceRules`.
- Importanza tip -> `priority` (`LOW|MEDIUM|HIGH|CRITICAL`).

Esempio mapping:
- "Rendi il testo piu' chiaro e meno tecnico" ->
  - `interventionType=CONTENT_QUALITY`
  - `taskType=IMPROVE_READABILITY`
- "Migliora snippet per aumentare CTR" ->
  - `interventionType=SEO_ONPAGE`
  - `taskType=OPTIMIZE_META_DESCRIPTION`

## Prompt interno verso Chatbot CMS
Template obbligatorio:
- `CONTEXT`: tenant, locale, scope target.
- `OBJECTIVE`: intervention + task + priorita'.
- `INPUT`: contenuti correnti e dati utili.
- `CONSTRAINTS`: vincoli hard (mai violabili).
- `OUTPUT_SCHEMA`: JSON vincolato.

Regole:
- Nessuna modifica fuori da `targetScope`.
- Se dati insufficienti: `needsHumanReview=true` + motivo.
- Se regola hard violata: output `status=blocked`.

## Output standard CMS -> BT

```json
{
  "status": "completed",
  "jobId": "job_abc123",
  "interventionType": "SEO_ONPAGE",
  "taskType": "OPTIMIZE_META_DESCRIPTION",
  "summary": "Aggiornata meta description con focus su intent commerciale.",
  "changes": [
    {
      "changeType": "replace",
      "target": {
        "scopeType": "PAGE",
        "pageId": "pg_784",
        "field": "seo.metaDescription"
      },
      "before": "Testo precedente...",
      "after": "Nuova meta description..."
    }
  ],
  "qualityChecks": {
    "rulesPassed": ["maxMetaDescriptionLength", "forbiddenTerms"],
    "rulesFailed": []
  },
  "riskLevel": "low",
  "needsHumanReview": true,
  "humanReviewReasons": ["Contenuto ad alto impatto SEO"],
  "audit": {
    "promptHash": "sha256:...",
    "processedAt": "2026-03-03T14:00:08Z",
    "durationMs": 812
  }
}
```

## Stati Job e comportamento
- `queued`: ricevuto e messo in coda.
- `processing`: in esecuzione worker/chatbot.
- `completed`: output valido disponibile.
- `failed`: errore tecnico o validazione.
- `blocked`: richiesta valida ma non eseguibile per policy/regole hard.

Retry:
- retry automatico solo su errori transitori.
- stessa `idempotencyKey` non deve duplicare job o apply.

## Policy di sicurezza
- Autenticazione machine-to-machine (Bearer/JWT o HMAC firmato).
- Tenant isolation obbligatoria su `siteId`.
- Audit log completo senza secret leakage.
- Rate limiting per tenant + source.
- PII minimization: inviare solo contenuto necessario al task.

## Matrice intervento -> rischio -> review
- `CONTENT_QUALITY`: rischio medio, review consigliata.
- `SEO_ONPAGE`: rischio medio/alto, review obbligatoria.
- `CONVERSION_CRO`: rischio medio/alto, review obbligatoria.
- `ACCESSIBILITY_COMPLIANCE`: rischio medio, review consigliata.
- `BRAND_VOICE`: rischio basso/medio, review consigliata.
- `CONTENT_GOVERNANCE`: rischio variabile, review obbligatoria se impatta piu' pagine.

## Endpoint suggeriti
- `POST /api/integrations/bt/ai-tips` -> `202 + jobId`
- `GET /api/integrations/bt/ai-tips/:jobId` -> stato + risultato
- `POST /api/integrations/bt/ai-tips/:jobId/apply` -> applica patch approvata (opzionale)

## Env vars minime
- `BT_AI_TIPS_ENABLED=true|false`
- `BT_AI_TIPS_AUTH_MODE=bearer|hmac`
- `BT_AI_TIPS_SHARED_SECRET=...` (se HMAC)
- `BT_AI_TIPS_RATE_LIMIT_PER_MINUTE=...`
- `BT_AI_TIPS_MAX_PAYLOAD_KB=...`

## Test minimi richiesti
- Validazione schema payload e enum.
- Tenant isolation (`siteId` non autorizzato -> 403).
- Idempotenza (`X-Idempotency-Key` duplicata -> stesso `jobId`).
- Blocchi policy (`forbiddenTerms`, scope overflow).
- Output schema compliance dal chatbot.

## Note operative per implementazione Codex sulla repo CMS
- Implementare enum condivisi `interventionType`/`taskType` in modulo centralizzato.
- Gestire versioning contratto con `contractVersion` (es. `1.0.0`).
- Aggiungere metriche: total jobs, blocked rate, avg latency, manual review rate.
- Documentare in `docs/integrations/` con esempi cURL per ciascun `interventionType`.
