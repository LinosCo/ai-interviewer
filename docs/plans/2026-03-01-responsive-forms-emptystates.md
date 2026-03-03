# Responsive + Form Validation + Empty States Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Make all dashboard tables scroll on mobile; (2) Add client-side zod/react-hook-form validation to all forms; (3) Add empty states to all filterable list pages.

**Architecture:** Three parallel tracks. Track A: `overflow-x-auto` wrapper on 14 raw `<table>` elements. Track B: Zod schemas → react-hook-form layer on top of existing `useActionState` server actions. Track C: Reusable `<EmptyState>` component dropped into list pages.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, react-hook-form ^7.68, zod ^4.2, Prisma, Lucide icons

---

## Track A — Responsive Tables

### Task A1: Create shared `<ScrollTable>` wrapper utility

**Context:** 14 pages render raw `<table>` elements without overflow protection. On mobile the table bleeds outside the viewport. The fix is an `overflow-x-auto` wrapper. We create a tiny utility component once, then import it everywhere.

**Files:**
- Create: `src/components/ui/scroll-table.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/ui/__tests__/scroll-table.test.tsx
import { render, screen } from '@testing-library/react';
import { ScrollTable } from '../scroll-table';

it('renders a scrollable table wrapper', () => {
  render(
    <ScrollTable>
      <table><tbody><tr><td>cell</td></tr></tbody></table>
    </ScrollTable>
  );
  const wrapper = screen.getByRole('region');
  expect(wrapper.className).toContain('overflow-x-auto');
});
```

**Step 2: Run test to confirm it fails**
```bash
cd /Users/tommycinti/Documents/ai-interviewer/ai-interviewer
npx vitest run src/components/ui/__tests__/scroll-table.test.tsx
```
Expected: FAIL — `scroll-table` does not exist.

**Step 3: Implement**

```tsx
// src/components/ui/scroll-table.tsx
import { type ReactNode } from 'react';

interface ScrollTableProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a <table> with overflow-x-auto so it scrolls horizontally on mobile
 * instead of overflowing the viewport.
 */
export function ScrollTable({ children, className = '' }: ScrollTableProps) {
  return (
    <div
      role="region"
      aria-label="scrollable table"
      className={`w-full overflow-x-auto rounded-lg ${className}`}
    >
      {children}
    </div>
  );
}
```

**Step 4: Run test to confirm pass**
```bash
npx vitest run src/components/ui/__tests__/scroll-table.test.tsx
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/components/ui/scroll-table.tsx src/components/ui/__tests__/scroll-table.test.tsx
git commit -m "feat(ui): add ScrollTable overflow wrapper for mobile"
```

---

### Task A2: Fix table overflow — Conversations page

**File:** `src/app/dashboard/bots/[botId]/conversations/page.tsx`

Find the `<div>` immediately wrapping `<table>` (look for `className` containing `overflow` or just `<div>` before `<table>`). Replace that div (or add a wrapping div) so the pattern becomes:

```tsx
// BEFORE (find the table section):
<div className="...existing classes...">
  <table className="...">

// AFTER:
<div className="overflow-x-auto w-full rounded-lg">
  <table className="...">
```

If no wrapping div exists, add one. Do NOT use `ScrollTable` here — a plain div is simpler for direct page edits.

**Step 1:** Open the file, find `<table`, add `<div className="overflow-x-auto w-full">` immediately before it and close `</div>` immediately after `</table>`.

**Step 2:** Run tests (full suite must stay green):
```bash
npx vitest run
```

**Step 3: Commit**
```bash
git add src/app/dashboard/bots/[botId]/conversations/page.tsx
git commit -m "fix(responsive): overflow-x-auto on conversations table"
```

---

### Task A3: Fix table overflow — Analytics views (2 files)

**Files:**
- `src/app/dashboard/bots/[botId]/analytics/ChatbotAnalyticsView.tsx`
- `src/app/dashboard/bots/[botId]/analytics/analytics-view.tsx`

Same pattern as A2: add `overflow-x-auto w-full` wrapper div around each `<table>`.

**Step 1:** Edit both files, add overflow wrapper.

**Step 2:**
```bash
npx vitest run
```

**Step 3: Commit**
```bash
git add src/app/dashboard/bots/[botId]/analytics/ChatbotAnalyticsView.tsx \
        src/app/dashboard/bots/[botId]/analytics/analytics-view.tsx
git commit -m "fix(responsive): overflow-x-auto on analytics tables"
```

---

### Task A4: Fix table overflow — Claims page

**File:** `src/app/dashboard/bots/[botId]/claims/page.tsx`

Same pattern. Add `<div className="overflow-x-auto w-full rounded-lg">` wrapper around `<table>`.

**Step 1:** Edit, add overflow wrapper.

**Step 2:** `npx vitest run`

**Step 3: Commit**
```bash
git add src/app/dashboard/bots/[botId]/claims/page.tsx
git commit -m "fix(responsive): overflow-x-auto on claims table"
```

---

### Task A5: Fix table overflow — Site Analysis, Training Sessions

**Files:**
- `src/app/dashboard/visibility/site-analysis/SiteAnalysisClient.tsx`
- `src/app/dashboard/training/[botId]/sessions/page.tsx`

Same pattern.

**Step 1:** Edit both files.

**Step 2:** `npx vitest run`

**Step 3: Commit**
```bash
git add src/app/dashboard/visibility/site-analysis/SiteAnalysisClient.tsx \
        src/app/dashboard/training/[botId]/sessions/page.tsx
git commit -m "fix(responsive): overflow-x-auto on site-analysis + training tables"
```

---

### Task A6: Fix table overflow — Admin views (5 files)

**Files:**
- `src/app/dashboard/admin/organizations/organizations-view.tsx`
- `src/app/dashboard/admin/projects/projects-view.tsx`
- `src/app/dashboard/admin/projects/[projectId]/project-detail-view.tsx`
- `src/app/dashboard/admin/cms/page.tsx`
- `src/app/dashboard/admin/users/users-view.tsx`
- `src/app/dashboard/admin/interviews/page.tsx`

Same pattern for all 6 files.

**Step 1:** Edit all 6 files — find each `<table`, add overflow wrapper div.

**Step 2:** `npx vitest run`

**Step 3: Commit**
```bash
git add src/app/dashboard/admin/
git commit -m "fix(responsive): overflow-x-auto on all admin tables"
```

---

### Task A7: Fix table overflow — CMS + Billing Plans + Partner ClientsTable

**Files:**
- `src/app/dashboard/cms/page.tsx`
- `src/app/dashboard/billing/plans/page.tsx`
- `src/components/partner/ClientsTable.tsx`

Same pattern.

**Step 1:** Edit all 3 files.

**Step 2:** `npx vitest run`

**Step 3: Commit**
```bash
git add src/app/dashboard/cms/page.tsx \
        src/app/dashboard/billing/plans/page.tsx \
        src/components/partner/ClientsTable.tsx
git commit -m "fix(responsive): overflow-x-auto on cms, billing, partner tables"
```

---

### Task A8: Marketing pages responsive audit

**Files:** All pages under `src/app/(marketing)/`

This is an audit + fix task. For each page, check if:
1. The root container has `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (or similar responsive padding)
2. Grid layouts use responsive cols: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
3. Text sizes use responsive variants: `text-3xl md:text-5xl`
4. Images use `w-full h-auto` or `object-cover`
5. Flex rows fall back to `flex-col` on mobile: `flex flex-col md:flex-row`

**Specific pages to fix (highest impact):**
- `pricing/page.tsx` — pricing cards stack vertically on mobile
- `(marketing)/page.tsx` — homepage hero and feature grid
- `features/page.tsx` — feature grid responsive
- `templates/page.tsx` — template cards grid

**Step 1:** Open `src/app/(marketing)/pricing/page.tsx`. Find any `grid` or `flex` layout for pricing cards. Make sure it has `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.

**Step 2:** Open `src/app/(marketing)/page.tsx`. Find the hero section. Make sure heading is `text-3xl sm:text-4xl md:text-6xl` and any side-by-side layout is `flex-col md:flex-row`.

**Step 3:** Check `features/page.tsx` and `templates/page.tsx` for the same grid pattern.

**Step 4:** `npx vitest run`

**Step 5: Commit**
```bash
git add src/app/\(marketing\)/
git commit -m "fix(responsive): marketing pages mobile layout"
```

---

## Track B — Form Validation

### Task B1: Create Zod validation schemas

**Context:** All forms currently have zero client-side validation. Browser `required` attributes are the only protection. We add a central `schemas.ts` that defines validation rules, which we'll import in each form.

**Files:**
- Create: `src/lib/validation/schemas.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/validation/__tests__/schemas.test.ts
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas';

describe('loginSchema', () => {
  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'notanemail', password: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '123' });
    expect(result.success).toBe(false);
  });

  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'mypassword123' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Mario',
      email: 'mario@example.com',
      password: 'password123',
      confirmPassword: 'differentpassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password', () => {
    const result = registerSchema.safeParse({
      name: 'Mario',
      email: 'mario@example.com',
      password: '123',
      confirmPassword: '123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      name: 'Mario Rossi',
      email: 'mario@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    });
    expect(result.success).toBe(true);
  });
});

describe('forgotPasswordSchema', () => {
  it('rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'notvalid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('rejects short password', () => {
    const result = resetPasswordSchema.safeParse({ password: '123', confirmPassword: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({ password: 'LongPass123!', confirmPassword: 'Different123!' });
    expect(result.success).toBe(false);
  });

  it('accepts valid reset data', () => {
    const result = resetPasswordSchema.safeParse({ password: 'NewPass123!', confirmPassword: 'NewPass123!' });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run to confirm fail**
```bash
npx vitest run src/lib/validation/__tests__/schemas.test.ts
```
Expected: FAIL — module not found.

**Step 3: Implement schemas**

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email obbligatoria')
    .email('Formato email non valido'),
  password: z
    .string()
    .min(6, 'La password deve essere di almeno 6 caratteri'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Il nome deve essere di almeno 2 caratteri')
      .max(100, 'Il nome è troppo lungo'),
    email: z
      .string()
      .min(1, 'Email obbligatoria')
      .email('Formato email non valido'),
    password: z
      .string()
      .min(8, 'La password deve essere di almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
    confirmPassword: z.string().min(1, 'Conferma la password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email obbligatoria')
    .email('Formato email non valido'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La password deve essere di almeno 8 caratteri')
      .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
      .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
    confirmPassword: z.string().min(1, 'Conferma la password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  });

// Dashboard schemas
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, 'Email obbligatoria')
    .email('Formato email non valido'),
});

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, 'Il nome deve essere di almeno 2 caratteri')
    .max(100, 'Il nome è troppo lungo'),
  description: z.string().max(500, 'La descrizione è troppo lunga').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

**Step 4: Run tests to confirm pass**
```bash
npx vitest run src/lib/validation/__tests__/schemas.test.ts
```
Expected: All 10 tests PASS.

**Step 5: Commit**
```bash
git add src/lib/validation/
git commit -m "feat(validation): add zod schemas for all forms"
```

---

### Task B2: Create PasswordStrength component

**Context:** The register form needs a visual indicator of password strength so users understand the strength requirements before submitting.

**Files:**
- Create: `src/components/ui/PasswordStrength.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/ui/__tests__/PasswordStrength.test.tsx
import { render, screen } from '@testing-library/react';
import { PasswordStrength } from '../PasswordStrength';

it('shows "Debole" for short passwords', () => {
  render(<PasswordStrength password="abc" />);
  expect(screen.getByText('Debole')).toBeInTheDocument();
});

it('shows "Media" for medium passwords', () => {
  render(<PasswordStrength password="Abc12345" />);
  expect(screen.getByText('Media')).toBeInTheDocument();
});

it('shows "Forte" for strong passwords', () => {
  render(<PasswordStrength password="Abc12345!@#" />);
  expect(screen.getByText('Forte')).toBeInTheDocument();
});

it('renders nothing for empty password', () => {
  const { container } = render(<PasswordStrength password="" />);
  expect(container.firstChild).toBeNull();
});
```

**Step 2: Run to confirm fail**
```bash
npx vitest run src/components/ui/__tests__/PasswordStrength.test.tsx
```

**Step 3: Implement**

```tsx
// src/components/ui/PasswordStrength.tsx
'use client';

interface PasswordStrengthProps {
  password: string;
}

type Strength = 'weak' | 'medium' | 'strong';

function getStrength(password: string): Strength {
  if (password.length < 6) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score <= 2) return 'medium';
  return 'strong';
}

const strengthConfig = {
  weak:   { label: 'Debole', color: '#EF4444', bars: 1 },
  medium: { label: 'Media',  color: '#F59E0B', bars: 2 },
  strong: { label: 'Forte',  color: '#10B981', bars: 3 },
} as const;

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const strength = getStrength(password);
  const { label, color, bars } = strengthConfig[strength];

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: bar <= bars ? color : '#E5E7EB',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color, fontWeight: 500 }}>{label}</p>
    </div>
  );
}
```

**Step 4: Run tests to confirm pass**
```bash
npx vitest run src/components/ui/__tests__/PasswordStrength.test.tsx
```

**Step 5: Commit**
```bash
git add src/components/ui/PasswordStrength.tsx src/components/ui/__tests__/PasswordStrength.test.tsx
git commit -m "feat(ui): add PasswordStrength indicator component"
```

---

### Task B3: Add validation to Login form

**File:** `src/app/login/page.tsx`

**Context:** Login uses `useActionState(authenticate, undefined)`. We add react-hook-form on top: `handleSubmit` validates first, then we programmatically trigger the server action. The pattern:
1. `useForm` with zodResolver
2. On `onSubmit(data)`: call `startTransition(() => dispatch(formData))`
3. Show field errors inline below each Input

**Step 1: Implement**

```tsx
// src/app/login/page.tsx — MODIFIED
'use client';

import { Suspense, useActionState, useEffect, useRef, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authenticate } from './actions';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';

const errorStyle = { color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' };

function LoginForm() {
    const searchParams = useSearchParams();
    const [serverError, dispatch, isPending] = useActionState(authenticate, undefined);
    const [, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    const nextPathRaw = searchParams.get('next');
    const nextPath = nextPathRaw && nextPathRaw.startsWith('/') ? nextPathRaw : null;
    const verificationState = searchParams.get('verification');
    const verifiedState = searchParams.get('verified');
    const verificationReason = searchParams.get('reason');

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitSuccessful },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const isLoading = isPending || (isSubmitSuccessful && serverError === null);

    useEffect(() => {
        if (!isPending && serverError === null && isSubmitSuccessful) {
            const target = nextPath || '/dashboard';
            window.location.replace(target);
        }
    }, [serverError, isPending, isSubmitSuccessful, nextPath]);

    const onSubmit = () => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            startTransition(() => { dispatch(formData); });
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: gradients.mesh,
            fontFamily: "'Inter', sans-serif", padding: '1rem',
            position: 'relative', overflow: 'hidden'
        }}>
            <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: `radial-gradient(circle, ${colors.amberLight} 0%, transparent 70%)`, opacity: 0.4, filter: 'blur(40px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: `radial-gradient(circle, ${colors.peach} 0%, transparent 70%)`, opacity: 0.5, filter: 'blur(60px)' }} />

            <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                        <Icons.Logo size={40} />
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.text, marginBottom: '0.5rem' }}>Bentornato</h1>
                    <p style={{ color: colors.muted }}>Accedi per gestire le tue interviste</p>
                </div>

                <Card variant="glass" padding="2.5rem">
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <Input
                                label="Email"
                                type="email"
                                {...register('email')}
                                placeholder="nome@azienda.com"
                                disabled={isLoading}
                                icon={<Icons.Users size={18} />}
                            />
                            {errors.email && <span style={errorStyle}>{errors.email.message}</span>}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Input
                                label="Password"
                                type="password"
                                {...register('password')}
                                placeholder="••••••••"
                                disabled={isLoading}
                                icon={<div style={{ width: '18px' }}>🔒</div>}
                            />
                            {errors.password && <span style={errorStyle}>{errors.password.message}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                            <Link href="/forgot-password" style={{ fontSize: '0.875rem', color: colors.amber, textDecoration: 'none', fontWeight: 500 }}>
                                Password dimenticata?
                            </Link>
                        </div>

                        {serverError && (
                            <div style={{ padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {serverError}
                            </div>
                        )}

                        {!serverError && verificationState === 'sent' && (
                            <div style={{ padding: '0.75rem', background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: '8px', color: '#1D4ED8', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Ti abbiamo inviato una email di conferma. Apri il link per attivare l&apos;account.
                            </div>
                        )}

                        {!serverError && verifiedState === '1' && (
                            <div style={{ padding: '0.75rem', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Email confermata con successo. Ora puoi accedere.
                            </div>
                        )}

                        {!serverError && verifiedState === '0' && (
                            <div style={{ padding: '0.75rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', color: '#92400E', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {verificationReason === 'expired_token'
                                    ? 'Il link di conferma è scaduto. Richiedi un nuovo link dal supporto.'
                                    : 'Il link di conferma non è valido.'}
                            </div>
                        )}

                        <Button type="submit" fullWidth disabled={isLoading} withShimmer={!isLoading}>
                            {isLoading ? 'Accesso in corso...' : 'Accedi'}
                        </Button>
                    </form>
                </Card>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: colors.muted }}>
                        Non hai un account?{' '}
                        <Link href="/register" style={{ color: colors.amber, fontWeight: 600, textDecoration: 'none' }}>
                            Inizia la prova gratuita
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.mesh }}>Caricamento...</div>}>
            <LoginForm />
        </Suspense>
    );
}
```

**Important:** Install `@hookform/resolvers` if not already present:
```bash
npm list @hookform/resolvers 2>/dev/null | grep hookform || npm install @hookform/resolvers
```

**Step 2: Run tests**
```bash
npx vitest run
```

**Step 3: Commit**
```bash
git add src/app/login/page.tsx
git commit -m "feat(validation): react-hook-form + zod on login form"
```

---

### Task B4: Add validation to Register form

**File:** `src/app/register/page.tsx`

**Context:** Read the file first to understand its current structure, then apply the same react-hook-form + zodResolver pattern as Task B3. Use `registerSchema` from schemas.ts. Also import and render `<PasswordStrength>` below the password field (watch the `password` field with `watch('password')`).

**Step 1:** Read `src/app/register/page.tsx` to understand current form structure.

**Step 2:** Apply the pattern:
```tsx
// At top of file, add:
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/validation/schemas';
import { PasswordStrength } from '@/components/ui/PasswordStrength';

// In the component:
const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterInput>({
  resolver: zodResolver(registerSchema),
});
const passwordValue = watch('password', '');

// Under each Input: {errors.fieldName && <span style={errorStyle}>{errors.fieldName.message}</span>}
// Under password Input: <PasswordStrength password={passwordValue} />
```

**Step 3:** `npx vitest run`

**Step 4: Commit**
```bash
git add src/app/register/page.tsx
git commit -m "feat(validation): react-hook-form + zod + PasswordStrength on register form"
```

---

### Task B5: Add validation to Forgot Password and Reset Password forms

**Files:**
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`

Same pattern. Use `forgotPasswordSchema` for forgot-password, `resetPasswordSchema` for reset-password. For reset-password, add `<PasswordStrength>` below the password field.

**Step 1:** Read both files.

**Step 2:** Apply react-hook-form + zodResolver to both.

**Step 3:** `npx vitest run`

**Step 4: Commit**
```bash
git add src/app/forgot-password/page.tsx src/app/reset-password/page.tsx
git commit -m "feat(validation): react-hook-form + zod on forgot/reset password forms"
```

---

### Task B6: Add validation to dashboard forms (invite member, create project)

**Files:**
- `src/app/dashboard/settings/members/page.tsx` — invite member email
- `src/app/dashboard/projects/new/page.tsx` — create project name

**Context:** These dashboard forms use Tailwind (not inline styles). The error display can use Tailwind classes:
```tsx
{errors.email && (
  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
)}
```

**Step 1:** Read both files.

**Step 2:** For each form, add:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberSchema, type InviteMemberInput } from '@/lib/validation/schemas';
```

Apply the same pattern: `handleSubmit` validates → calls server action.

**Step 3:** `npx vitest run`

**Step 4: Commit**
```bash
git add src/app/dashboard/settings/members/page.tsx \
        src/app/dashboard/projects/new/page.tsx
git commit -m "feat(validation): react-hook-form + zod on dashboard forms"
```

---

## Track C — Empty States

### Task C1: Create reusable EmptyState component

**Files:**
- Create: `src/components/ui/EmptyState.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/ui/__tests__/EmptyState.test.tsx
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { Inbox } from 'lucide-react';

it('renders title and description', () => {
  render(
    <EmptyState
      icon={<Inbox />}
      title="Nessun bot trovato"
      description="Crea il tuo primo bot per iniziare."
    />
  );
  expect(screen.getByText('Nessun bot trovato')).toBeInTheDocument();
  expect(screen.getByText('Crea il tuo primo bot per iniziare.')).toBeInTheDocument();
});

it('renders optional action button', () => {
  render(
    <EmptyState
      icon={<Inbox />}
      title="Vuoto"
      description="Nessun elemento"
      action={{ label: 'Aggiungi', onClick: () => {} }}
    />
  );
  expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument();
});

it('renders optional action link', () => {
  render(
    <EmptyState
      icon={<Inbox />}
      title="Vuoto"
      description="Nessun elemento"
      action={{ label: 'Vai alla dashboard', href: '/dashboard' }}
    />
  );
  expect(screen.getByRole('link', { name: 'Vai alla dashboard' })).toBeInTheDocument();
});
```

**Step 2: Run to confirm fail**
```bash
npx vitest run src/components/ui/__tests__/EmptyState.test.tsx
```

**Step 3: Implement**

```tsx
// src/components/ui/EmptyState.tsx
import { type ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-400">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-gray-700">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">{description}</p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
```

**Step 4: Run tests to confirm pass**
```bash
npx vitest run src/components/ui/__tests__/EmptyState.test.tsx
```

**Step 5: Commit**
```bash
git add src/components/ui/EmptyState.tsx src/components/ui/__tests__/EmptyState.test.tsx
git commit -m "feat(ui): add reusable EmptyState component"
```

---

### Task C2: Add empty state to Dashboard Bot List

**File:** `src/app/dashboard/page.tsx`

**Context:** Read the file. Find where `bots.map(...)` renders the bot cards. If `bots` is an empty array, the page shows nothing. Add an empty state above or instead of the map.

**Step 1:** Read `src/app/dashboard/page.tsx`.

**Step 2:** Find the `bots.map(...)` section. Replace with:

```tsx
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

// In the JSX:
{bots.length === 0 ? (
  <EmptyState
    icon={<Bot className="w-8 h-8" />}
    title="Nessun bot ancora"
    description="Crea il tuo primo bot per iniziare a raccogliere interviste."
    action={{ label: 'Crea bot', href: '/dashboard/projects' }}
  />
) : (
  bots.map((bot) => ( /* existing render */ ))
)}
```

**Step 3:** `npx vitest run`

**Step 4: Commit**
```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(ux): empty state for bot list"
```

---

### Task C3: Add empty states to Partner and History pages

**Files:**
- `src/app/dashboard/partner/page.tsx` — client list empty state
- `src/app/dashboard/history/page.tsx` — interview history empty state (if this file exists; if not, check `src/components/dashboard/InterviewsList.tsx`)

**Step 1:** Read both files.

**Step 2:** For `partner/page.tsx`, find where clients render and add:
```tsx
import { Users } from 'lucide-react';
// If clients.length === 0:
<EmptyState
  icon={<Users className="w-8 h-8" />}
  title="Nessun cliente ancora"
  description="Aggiungi il tuo primo cliente partner."
/>
```

**Step 3:** For `InterviewsList.tsx` (or history page), check if an empty state already exists. If the list has no interviews, add:
```tsx
import { MessageSquare } from 'lucide-react';
// If interviews.length === 0:
<EmptyState
  icon={<MessageSquare className="w-8 h-8" />}
  title="Nessuna intervista ancora"
  description="Le interviste completate appariranno qui."
/>
```

**Step 4:** `npx vitest run`

**Step 5: Commit**
```bash
git add src/app/dashboard/partner/page.tsx \
        src/components/dashboard/InterviewsList.tsx
git commit -m "feat(ux): empty states for partner + history lists"
```

---

### Task C4: Add empty states to conversations and admin lists

**Files:**
- `src/app/dashboard/bots/[botId]/conversations/page.tsx`
- Any admin list pages that show empty state for zero records

**Step 1:** Read `conversations/page.tsx`. Find where `conversations.map(...)` renders. Add:
```tsx
import { MessageSquare } from 'lucide-react';
// If conversations.length === 0:
<EmptyState
  icon={<MessageSquare className="w-8 h-8" />}
  title="Nessuna conversazione"
  description="Le conversazioni di questo bot appariranno qui."
/>
```

**Step 2:** `npx vitest run`

**Step 3: Commit**
```bash
git add src/app/dashboard/bots/[botId]/conversations/page.tsx
git commit -m "feat(ux): empty state for conversations list"
```

---

## Final Verification

### Task V1: Run full test suite and type check

```bash
cd /Users/tommycinti/Documents/ai-interviewer/ai-interviewer
npx vitest run
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

Expected:
- All tests green (86+ passing)
- Zero TypeScript errors

### Task V2: Final commit

If all tests pass:
```bash
git log --oneline -20
```
Review all commits from this plan. If everything looks good, push to origin:
```bash
git push origin stage
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/components/ui/scroll-table.tsx` | Scrollable table wrapper |
| `src/lib/validation/schemas.ts` | All zod schemas |
| `src/components/ui/PasswordStrength.tsx` | Password strength indicator |
| `src/components/ui/EmptyState.tsx` | Reusable empty state |

## Summary of Modified Files

| File | Change |
|------|--------|
| 14 table files | Add `overflow-x-auto` wrapper |
| 16 marketing pages | Responsive layout fixes |
| `src/app/login/page.tsx` | react-hook-form + zod validation |
| `src/app/register/page.tsx` | react-hook-form + zod + PasswordStrength |
| `src/app/forgot-password/page.tsx` | react-hook-form + zod |
| `src/app/reset-password/page.tsx` | react-hook-form + zod + PasswordStrength |
| `src/app/dashboard/settings/members/page.tsx` | react-hook-form + zod |
| `src/app/dashboard/projects/new/page.tsx` | react-hook-form + zod |
| `src/app/dashboard/page.tsx` | EmptyState for bot list |
| `src/app/dashboard/partner/page.tsx` | EmptyState for client list |
| `src/components/dashboard/InterviewsList.tsx` | EmptyState for interview list |
| `src/app/dashboard/bots/[botId]/conversations/page.tsx` | EmptyState for conversations |
