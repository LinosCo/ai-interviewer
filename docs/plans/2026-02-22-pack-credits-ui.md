# Pack Credits UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrare i crediti pack acquistati separatamente dai crediti mensili, con barra di avanzamento dedicata, sia nel CreditsWidget della sidebar sia nella pagina Abbonamento.

**Architecture:** Tutti i dati sono già presenti nell'API `/api/credits` (campo `packAvailable`). Il fix è puramente UI: aggiornare `CreditsWidget` e `billing/page.tsx` per visualizzare i pack con una sezione distinta e barra di avanzamento.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide icons

---

## Context: Stato attuale

- **`/api/credits`** (GET): restituisce `packAvailable`, `monthlyRemaining`, `totalAvailable`, tutti i `formatted.*`. I dati sono corretti.
- **`CreditsWidget`** (`src/components/dashboard/CreditsWidget.tsx`): mostra una sola barra per i crediti mensili. I pack appaiono come testo `text-[10px]` quasi invisibile.
- **`billing/page.tsx`** (`src/app/dashboard/billing/page.tsx`): mostra i pack in una cella della griglia 3-colonne ma senza barra e con "-" se zero.
- **`UsageDashboard`** (`src/components/dashboard/UsageDashboard.tsx`): mostra il pack come badge statico senza barra di avanzamento.

---

### Task 1: Aggiornare CreditsWidget — seconda barra per pack

**Files:**
- Modify: `src/components/dashboard/CreditsWidget.tsx`

**Obiettivo:** Quando `packAvailable > 0`, mostrare una seconda sezione separata con etichetta "Pack Extra" e una barra visiva di consumo. La barra dei pack mostra quanti pack sono stati usati rispetto al totale acquistato (non scadono mai, quindi usare `packAvailable` come "rimanenti" su un totale calcolato come `packAvailable + packUsed`).

**Problema:** L'API non restituisce `packUsed` (quanti pack sono stati consumati). Per semplicità, mostrare la barra dei pack come "quantità disponibile" senza percentuale di consumo — il visual serve principalmente a rendere evidente che ci sono crediti extra disponibili.

**Step 1: Leggere il file corrente**

```bash
cat src/components/dashboard/CreditsWidget.tsx
```

**Step 2: Sostituire il blocco di testo pack con una sezione visiva dedicata**

Nel componente `CreditsWidget`, trovare questo blocco (righe ~100-108):

```tsx
<div className="text-[10px] text-stone-500 mb-1 flex items-center justify-between">
    <span>Piano: {credits.formatted.monthlyRemaining}</span>
    <span className={credits.packAvailable > 0 ? 'text-amber-600 font-semibold' : ''}>
        Pack: {credits.formatted.packAvailable}
    </span>
</div>
```

Sostituirlo con:

```tsx
<div className="text-[10px] text-stone-500 mb-1">
    <span>Mensili: {credits.formatted.monthlyRemaining} rimasti</span>
</div>

{credits.packAvailable > 0 && (
    <div className="mt-2 pt-2 border-t border-stone-200">
        <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-700">Pack Extra</span>
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                {credits.formatted.packAvailable}
            </span>
        </div>
        <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: '100%' }} />
        </div>
        <p className="text-[10px] text-amber-600 mt-0.5">Non scadono mai</p>
    </div>
)}
```

**Step 3: Verificare che l'import di `Zap` esista già**

Controllare la riga di import. `Zap` è già importato (`import { Zap, RefreshCcw } from 'lucide-react';`). Nessuna modifica necessaria.

**Step 4: Build check**

```bash
cd /Users/tommycinti/Documents/ai-interviewer/ai-interviewer
npx tsc --noEmit 2>&1 | head -20
```

Expected: nessun errore TypeScript.

**Step 5: Commit**

```bash
git add src/components/dashboard/CreditsWidget.tsx
git commit -m "feat: mostra pack crediti con sezione dedicata nella sidebar widget"
```

---

### Task 2: Aggiornare billing/page.tsx — sezione pack con barra

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx`

**Obiettivo:** Nella sezione "Crediti AI" della pagina abbonamento, aggiungere — quando `packAvailable > 0` — una riga/card separata sotto la griglia mensile che mostri chiaramente i crediti pack disponibili con barra visiva.

**Step 1: Trovare la sezione da modificare**

La sezione si trova nella griglia 3 colonne (righe ~235-270 circa):

```tsx
<div className="grid grid-cols-3 gap-4">
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Limite Mensile</p>
        <p className="text-xl font-bold text-stone-900">...</p>
    </div>
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Utilizzati</p>
        ...
    </div>
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Pack Extra</p>
        <p className="text-xl font-bold text-amber-600">
            {packAvailable > 0 ? formatMonthlyCredits(packAvailable) : '-'}
        </p>
    </div>
</div>
```

**Step 2: Sostituire la terza colonna "Pack Extra" con una colonna "Rimanenti mensili" e aggiungere una sezione pack sotto la griglia**

Sostituire l'intero blocco della griglia + aggiungere sezione pack:

```tsx
{/* Griglia 3 colonne solo per crediti mensili */}
<div className="grid grid-cols-3 gap-4">
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Limite Mensile</p>
        <p className="text-xl font-bold text-stone-900">
            {formatMonthlyCredits(monthlyLimit)}
        </p>
    </div>
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Utilizzati</p>
        <p className="text-xl font-bold text-stone-900">
            {formatMonthlyCredits(monthlyUsed)}
        </p>
    </div>
    <div className="text-center p-3 bg-white rounded-xl">
        <p className="text-xs text-stone-400 font-bold uppercase mb-1">Rimanenti</p>
        <p className={`text-xl font-bold ${monthlyUsed >= monthlyLimit ? 'text-red-500' : 'text-green-600'}`}>
            {formatMonthlyCredits(Math.max(0, monthlyLimit - monthlyUsed))}
        </p>
    </div>
</div>

{/* Barra avanzamento crediti mensili */}
<div className="mt-3">
    <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
            className={`h-full transition-all duration-300 ${
                monthlyUsed / monthlyLimit >= 0.95 ? 'bg-red-500' :
                monthlyUsed / monthlyLimit >= 0.85 ? 'bg-orange-500' :
                monthlyUsed / monthlyLimit >= 0.70 ? 'bg-yellow-500' :
                'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100))}%` }}
        />
    </div>
    <p className="text-xs text-stone-400 mt-1 text-right">
        {Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100))}% utilizzato
    </p>
</div>

{/* Sezione Pack Extra — visibile solo se disponibili */}
{packAvailable > 0 && (
    <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Icons.Sparkles size={14} className="text-amber-600" />
                </div>
                <div>
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Pack Extra</p>
                    <p className="text-[10px] text-amber-600">Usati dopo i crediti mensili · Non scadono</p>
                </div>
            </div>
            <p className="text-2xl font-black text-amber-600">{formatMonthlyCredits(packAvailable)}</p>
        </div>
        <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }} />
        </div>
        <p className="text-[10px] text-amber-500 mt-1">
            {formatMonthlyCredits(packAvailable)} crediti pack disponibili
        </p>
    </div>
)}
```

**Step 3: Calcolare `monthlyRemaining` nella sezione variabili del Server Component**

Dopo la riga 186 (`const packAvailable = ...`), aggiungere:

```ts
const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
```

(Già calcolabile inline ma rende il template più leggibile.)

**Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: nessun errore.

**Step 5: Commit**

```bash
git add src/app/dashboard/billing/page.tsx
git commit -m "feat: sezione pack crediti con barra avanzamento nella pagina abbonamento"
```

---

### Task 3: Aggiornare UsageDashboard — barra avanzamento pack

**Files:**
- Modify: `src/components/dashboard/UsageDashboard.tsx`

**Obiettivo:** La sezione "Pack Credits" (righe 292-306) è un badge statico. Trasformarla in una card con barra visiva uguale allo stile della sezione mensile.

**Step 1: Trovare il blocco da modificare**

```tsx
{/* Pack Credits */}
{credits.packAvailable > 0 && (
    <div className="bg-amber-50 rounded-lg p-3 flex items-center justify-between border border-amber-100">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <div>
                <p className="text-xs text-amber-700 font-medium">Pack crediti</p>
                <p className="text-sm font-bold text-amber-900">{credits.formatted.packAvailable}</p>
            </div>
        </div>
        <span className="text-xs text-amber-600">Non scadono</span>
    </div>
)}
```

**Step 2: Sostituire con card espansa con barra**

```tsx
{/* Pack Credits */}
{credits.packAvailable > 0 && (
    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pack Extra</p>
                    <p className="text-[10px] text-amber-600">Usati dopo i crediti mensili</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-xl font-black text-amber-700">{credits.formatted.packAvailable}</p>
                <p className="text-[10px] text-amber-500">disponibili</p>
            </div>
        </div>
        <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: '100%' }} />
        </div>
        <p className="text-[10px] text-amber-500 text-right">Non scadono mai</p>
    </div>
)}
```

**Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/components/dashboard/UsageDashboard.tsx
git commit -m "feat: card pack crediti con barra avanzamento in UsageDashboard"
```

---

### Task 4: Verifica finale e test manuale

**Step 1: Avviare il server di sviluppo**

```bash
npm run dev
```

**Step 2: Verificare la sidebar CreditsWidget**

Andare su `/dashboard`. Nella sidebar in basso:
- Se `packAvailable === 0`: vedere solo la barra mensile (nessuna sezione pack)
- Se `packAvailable > 0`: vedere sezione "Pack Extra" separata con barra amber sotto la sezione mensile

**Step 3: Verificare la pagina Abbonamento**

Andare su `/dashboard/billing`:
- Sezione "Crediti AI": vedere griglia 3 colonne (Limite Mensile | Utilizzati | Rimanenti) + barra progress mensile
- Se `packAvailable > 0`: vedere card amber "Pack Extra" con barra sotto

**Step 4: Verificare UsageDashboard**

Nella sezione bassa della pagina billing (UsageDashboard):
- Se `packAvailable > 0`: vedere card pack espansa con barra

**Step 5: Test con dati reali**

Per testare senza acquisto reale, usare la console admin (`/dashboard/admin/organizations`) per aggiungere manualmente `packCreditsAvailable` all'organizzazione di test tramite SQL o Prisma Studio:

```bash
npx prisma studio
```

Modificare `packCreditsAvailable` dell'organizzazione a `5000` e ricaricare `/dashboard/billing`.

**Step 6: Commit finale se tutto ok**

```bash
git add -A
git commit -m "chore: verifica visiva pack credits UI completata"
```

---

## Note implementative

- **Barra pack sempre piena (100%)**: I pack non hanno un "totale originale" accessibile nell'API — solo i rimanenti. La barra al 100% indica "hai ancora tutti i pack disponibili". Se in futuro si vuole mostrare il consumo, aggiungere `packUsed` all'API response.
- **Ordine di consumo**: La UI riflette la logica del backend — i crediti mensili vengono consumati prima, poi i pack. Questo è comunicato con il testo "Usati dopo i crediti mensili".
- **Zero pack**: Nessuna UI aggiuntiva viene mostrata se `packAvailable === 0`, per non confondere utenti senza pack.
