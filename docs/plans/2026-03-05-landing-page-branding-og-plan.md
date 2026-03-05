# Landing Page Branding, OG Preview & Image Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 distinct branding/UX issues: video clear bug, logo display, cover image upload, per-interview OG image generation, OG metadata text, and Railway volume image serving.

**Architecture:** New image upload/serve API at `/api/uploads/image` stores files on the existing Railway volume (`BACKUP_PATH=/app/backups/uploads/`). The per-interview OG image generator uses Next.js App Router's file-based convention (`opengraph-image.tsx` co-located with the route) with Node.js runtime to access Prisma directly.

**Tech Stack:** Next.js 14 App Router, Prisma, Node.js `fs`, Next.js `ImageResponse`, Tailwind CSS, Vitest

---

## Task 1: Fix video and image URL clear bug

**Files:**
- Modify: `src/app/actions.ts:528-531`

**Context:** When the user clears the `landingVideoUrl` or `landingImageUrl` input and saves, `getStr()` returns `""` (empty string). Prisma receives `""` and stores it — so the video persists. Compare line 463 where `logoUrl` correctly does `|| null`. We need the same for landing fields.

**Step 1: Apply the fix**

In `src/app/actions.ts`, find lines 528-531:
```typescript
    if (formData.has('landingTitle')) data.landingTitle = getStr('landingTitle');
    if (formData.has('landingDescription')) data.landingDescription = getStr('landingDescription');
    if (formData.has('landingImageUrl')) data.landingImageUrl = getStr('landingImageUrl');
    if (formData.has('landingVideoUrl')) data.landingVideoUrl = getStr('landingVideoUrl');
```

Replace with:
```typescript
    if (formData.has('landingTitle')) data.landingTitle = getStr('landingTitle') || null;
    if (formData.has('landingDescription')) data.landingDescription = getStr('landingDescription') || null;
    if (formData.has('landingImageUrl')) data.landingImageUrl = getStr('landingImageUrl') || null;
    if (formData.has('landingVideoUrl')) data.landingVideoUrl = getStr('landingVideoUrl') || null;
```

**Step 2: Verify the build still passes**

```bash
cd /Users/tommycinti/Documents/ai-interviewer/ai-interviewer
npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors (there are pre-existing errors documented in MEMORY.md — those are fine).

**Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "fix: clear landingVideoUrl/landingImageUrl when field is emptied"
```

---

## Task 2: Fix logo display in interview chat — round → square, contain

**Files:**
- Modify: `src/components/interview-chat.tsx:725-748`

**Context:** The logo in the chat header is displayed inside a `rounded-full` container with `object-cover` on the `<img>`. This crops non-square logos. The user wants `rounded-lg` (square with rounded corners) and `object-contain` so the full logo is always visible.

The loading indicator (lines 824-845) uses a `rounded-full` outer animation ring — that's the visual pulsing circle, NOT the logo shape. The logo inside it already uses `object-contain`. Keep the outer pulsing ring as `rounded-full`, but make the **inner white container** square with `rounded-lg` too.

**Step 1: Fix the header logo container (lines 725-748)**

Find this block in `src/components/interview-chat.tsx`:
```tsx
                <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md border border-stone-200/50 p-2 pl-3 pr-4 rounded-full shadow-lg pointer-events-auto transition-all hover:shadow-xl hover:scale-105">
                    {logoUrl ? (
                        <div className="h-8 w-8 rounded-full overflow-hidden border border-stone-100 flex-shrink-0 bg-stone-50">
                            <img
                                src={logoUrl}
                                alt={botName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    // Fallback if image fails to load - XSS safe
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallbackDiv = document.createElement('div');
                                    fallbackDiv.className = 'w-full h-full rounded-full flex items-center justify-center text-white';
                                    fallbackDiv.style.background = brandColor;
                                    fallbackDiv.textContent = '?';
                                    img.parentElement?.appendChild(fallbackDiv);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: brandColor }}>
                            <Icons.Chat size={16} />
                        </div>
                    )}
```

Replace with:
```tsx
                <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md border border-stone-200/50 p-2 pl-3 pr-4 rounded-full shadow-lg pointer-events-auto transition-all hover:shadow-xl hover:scale-105">
                    {logoUrl ? (
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-stone-100 flex-shrink-0 bg-white">
                            <img
                                src={logoUrl}
                                alt={botName}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                    // Fallback if image fails to load - XSS safe
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallbackDiv = document.createElement('div');
                                    fallbackDiv.className = 'w-full h-full rounded-lg flex items-center justify-center text-white';
                                    fallbackDiv.style.background = brandColor;
                                    fallbackDiv.textContent = '?';
                                    img.parentElement?.appendChild(fallbackDiv);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: brandColor }}>
                            <Icons.Chat size={16} />
                        </div>
                    )}
```

**Step 2: Fix the loading indicator inner container (around line 824-829)**

Find:
```tsx
                            <motion.div
                                className="relative flex items-center justify-center rounded-full bg-white shadow-lg"
                                style={{
                                    width: 80,
                                    height: 80,
                                    border: `2px solid ${brandColor}40`,
                                }}
```

Replace `rounded-full` with `rounded-2xl`:
```tsx
                            <motion.div
                                className="relative flex items-center justify-center rounded-2xl bg-white shadow-lg"
                                style={{
                                    width: 80,
                                    height: 80,
                                    border: `2px solid ${brandColor}40`,
                                }}
```

Note: The two outer `motion.div` rings with `rounded-full` (lines ~806-821 and ~923-924) are the animation rings — leave those as `rounded-full`. Only the white inner container that holds the logo changes.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/components/interview-chat.tsx
git commit -m "fix: logo display - rounded-lg + object-contain in chat header and loading indicator"
```

---

## Task 3: Create image upload/serve API on Railway volume

**Files:**
- Create: `src/app/api/uploads/image/route.ts`

**Context:** This is the foundation for Tasks 4 and 5. Files are stored at `${BACKUP_PATH}/uploads/{orgId}/{botId}/{type}-{timestamp}.{ext}`. The GET endpoint serves files back with immutable cache headers. Security: path must start with `uploads/` (no directory traversal).

`BACKUP_PATH` defaults to `/app/backups`. In dev, if `BACKUP_PATH` is not set, files go to `/tmp/uploads` (no persistence, fine for dev).

The auth check uses the bot's `projectId` → `organization` to verify the user has MEMBER access. For the GET endpoint, files are served publicly (no auth) since they're used as `<img src>` and OG images.

**Step 1: Create the route file**

Create `src/app/api/uploads/image/route.ts`:

```typescript
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess, WorkspaceError } from '@/lib/domain/workspace';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_MIME: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function getUploadDir(): string {
    const base = process.env.BACKUP_PATH || '/tmp';
    return path.join(base, 'uploads');
}

function sanitizePath(p: string): boolean {
    // Must start with 'uploads/' and contain no traversal
    const normalized = path.normalize(p);
    return normalized.startsWith('uploads/') && !normalized.includes('..');
}

/** POST /api/uploads/image — upload a logo or cover image */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const botId = formData.get('botId') as string | null;
        const type = formData.get('type') as string | null; // 'logo' | 'cover'

        if (!file || !botId || !type) {
            return NextResponse.json({ error: 'Missing file, botId, or type' }, { status: 400 });
        }

        if (!['logo', 'cover'].includes(type)) {
            return NextResponse.json({ error: 'type must be logo or cover' }, { status: 400 });
        }

        const mime = file.type;
        const ext = ALLOWED_MIME[mime];
        if (!ext) {
            return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPG, WebP, SVG, or GIF.' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Image too large. Maximum size is 2MB.' }, { status: 400 });
        }

        // Auth: verify user has access to this bot
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { include: { organization: true } } }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        try {
            await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const orgId = bot.project.organizationId;
        const timestamp = Date.now();
        const filename = `${type}-${timestamp}.${ext}`;
        const relativePath = `uploads/${orgId}/${botId}/${filename}`;
        const uploadDir = path.join(getUploadDir(), orgId, botId);
        const fullPath = path.join(uploadDir, filename);

        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(fullPath, buffer);

        const url = `/api/uploads/image?path=${encodeURIComponent(relativePath)}`;
        return NextResponse.json({ url });

    } catch (error) {
        console.error('[IMAGE_UPLOAD_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** GET /api/uploads/image?path=uploads/{orgId}/{botId}/filename.ext — serve an uploaded image */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const relativePath = searchParams.get('path');

        if (!relativePath || !sanitizePath(relativePath)) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }

        const base = process.env.BACKUP_PATH || '/tmp';
        const fullPath = path.join(base, relativePath);

        let buffer: Buffer;
        try {
            buffer = await fs.readFile(fullPath);
        } catch {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Determine content type from extension
        const ext = path.extname(fullPath).slice(1).toLowerCase();
        const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            gif: 'image/gif',
        };
        const contentType = mimeMap[ext] || 'application/octet-stream';

        return new Response(buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });

    } catch (error) {
        console.error('[IMAGE_SERVE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

**Step 3: Quick manual test (dev server must be running)**

```bash
# In a separate terminal: npm run dev
# Then test the GET endpoint with a non-existent file (should return 404):
curl -s "http://localhost:3000/api/uploads/image?path=uploads/test/test/test.png" | head -20
# Expected: {"error":"Not found"}

# Test path traversal protection:
curl -s "http://localhost:3000/api/uploads/image?path=../../etc/passwd" | head -20
# Expected: {"error":"Invalid path"}
```

**Step 4: Commit**

```bash
git add src/app/api/uploads/image/route.ts
git commit -m "feat: add image upload/serve API on Railway volume"
```

---

## Task 4: Replace cover image URL input with file upload in editor

**Files:**
- Modify: `src/app/dashboard/bots/[botId]/landing-page-editor.tsx`

**Context:** Currently the landing page editor has a plain URL text input for the cover image (`name="landingImageUrl"`). Replace it with a component that has two modes: file upload (primary) and URL fallback. The upload calls `POST /api/uploads/image` with `type=cover` and stores the returned URL in a hidden `landingImageUrl` field.

The existing form uses `action={handleSubmit}` → `updateBotAction`. We don't change this flow — the hidden input contains the URL which gets submitted normally.

**Step 1: Add state variables at the top of the component**

Find the existing state declarations around line 19:
```typescript
    const [logoPreview, setLogoPreview] = useState(bot.logoUrl || '');
```

Add after it:
```typescript
    const [coverPreview, setCoverPreview] = useState(bot.landingImageUrl || '');
    const [coverMode, setCoverMode] = useState<'upload' | 'url'>((bot.landingImageUrl && !bot.landingImageUrl.startsWith('/api/uploads')) ? 'url' : 'upload');
    const [coverUploading, setCoverUploading] = useState(false);
```

**Step 2: Add the upload handler function**

Add before the `return` statement:
```typescript
    const handleCoverUpload = async (file: File) => {
        if (file.size > 2 * 1024 * 1024) {
            alert("L'immagine è troppo grande. Massimo 2MB.");
            return;
        }
        setCoverUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('botId', bot.id);
            fd.append('type', 'cover');
            const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Errore upload');
                return;
            }
            const { url } = await res.json();
            setCoverPreview(url);
        } catch {
            alert('Errore durante il caricamento. Riprova.');
        } finally {
            setCoverUploading(false);
        }
    };
```

**Step 3: Replace the cover image URL input (lines 161-171)**

Find:
```tsx
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                                <input
                                    name="landingImageUrl"
                                    type="url"
                                    defaultValue={bot.landingImageUrl || ''}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
```

Replace with:
```tsx
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>

                                {/* Mode toggle */}
                                <div className="flex gap-2 mb-3">
                                    <button type="button" onClick={() => setCoverMode('upload')}
                                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${coverMode === 'upload' ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-300'}`}>
                                        Carica File
                                    </button>
                                    <button type="button" onClick={() => setCoverMode('url')}
                                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${coverMode === 'url' ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-300'}`}>
                                        Usa URL
                                    </button>
                                </div>

                                {/* Hidden field that always carries the value */}
                                <input type="hidden" name="landingImageUrl" value={coverPreview} />

                                {coverMode === 'upload' ? (
                                    <div className="space-y-2">
                                        {coverPreview && (
                                            <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                                <img src={coverPreview} alt="Cover preview" className="w-full h-full object-contain" />
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            disabled={coverUploading}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 disabled:opacity-50"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleCoverUpload(file);
                                            }}
                                        />
                                        {coverUploading && <p className="text-xs text-amber-600">Caricamento in corso...</p>}
                                        {coverPreview && (
                                            <button type="button" onClick={() => setCoverPreview('')}
                                                className="text-xs text-red-500 hover:text-red-700">
                                                Rimuovi immagine
                                            </button>
                                        )}
                                        <p className="text-xs text-gray-400">PNG, JPG, WebP o GIF — max 2MB</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="url"
                                            value={coverPreview}
                                            onChange={(e) => setCoverPreview(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        />
                                        <p className="text-xs text-gray-400">URL diretto a un'immagine (no Google Drive)</p>
                                    </div>
                                )}
                            </div>
```

**Step 4: Add `Upload` to imports if not already there**

The `Upload` icon is already imported at line 5:
```typescript
import { Save, Lock, Layout, Image as ImageIcon, Video, Type, AlignLeft, Palette, Upload } from 'lucide-react';
```
✓ Already imported.

**Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/app/dashboard/bots/[botId]/landing-page-editor.tsx
git commit -m "feat: cover image file upload in landing page editor (Railway volume)"
```

---

## Task 5: Migrate logo upload from Base64 to Railway volume

**Files:**
- Modify: `src/app/dashboard/bots/[botId]/landing-page-editor.tsx`

**Context:** Logo upload currently uses `FileReader.readAsDataURL()` → Base64 stored in DB. This works but is large (each save embeds the image in the DB row). We now have the upload API from Task 3, so migrate logo to the same pattern. The change is isolated to the onChange handler of the logo file input.

The hidden `<input type="hidden" name="logoUrl" value={logoPreview} />` stays — it will now hold the API URL instead of Base64.

**Step 1: Add a logo uploading state variable**

Find:
```typescript
    const [logoPreview, setLogoPreview] = useState(bot.logoUrl || '');
```

Add after it:
```typescript
    const [logoUploading, setLogoUploading] = useState(false);
```

**Step 2: Replace the logo file input onChange handler (around lines 87-103)**

Find the entire onChange block:
```typescript
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // Check size limit (max 500KB to ensure Base64 < 1MB limit of Server Actions)
                                                // 500KB * 1.33 = ~665KB Base64. Safe.
                                                if (file.size > 500 * 1024) {
                                                    alert("L'immagine è troppo grande. Per favore usa un file più piccolo di 500KB.");
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const res = reader.result as string;
                                                    setLogoPreview(res);
                                                    // No need for manual DOM update, we use controlled input below
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
```

Replace with:
```typescript
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (file.size > 2 * 1024 * 1024) {
                                                alert("L'immagine è troppo grande. Massimo 2MB.");
                                                return;
                                            }
                                            setLogoUploading(true);
                                            try {
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                fd.append('botId', bot.id);
                                                fd.append('type', 'logo');
                                                const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
                                                if (!res.ok) {
                                                    const err = await res.json();
                                                    alert(err.error || 'Errore upload logo');
                                                    return;
                                                }
                                                const { url } = await res.json();
                                                setLogoPreview(url);
                                            } catch {
                                                alert('Errore durante il caricamento. Riprova.');
                                            } finally {
                                                setLogoUploading(false);
                                            }
                                        }}
```

**Step 3: Add uploading feedback and update the size hint**

Find:
```tsx
                                    <p className="text-xs text-gray-400">Consigliato: PNG trasparente 200x200px.</p>
```

Replace with:
```tsx
                                    {logoUploading && <p className="text-xs text-amber-600">Caricamento logo...</p>}
                                    <p className="text-xs text-gray-400">Consigliato: PNG trasparente — max 2MB.</p>
```

**Step 4: Add `disabled` to the file input when uploading**

Find the file input opening tag (around line 83-84):
```tsx
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="block w-full text-sm ...
```

Add `disabled={logoUploading}` attribute:
```tsx
                                    <input
                                        type="file"
                                        accept="image/*"
                                        disabled={logoUploading}
                                        className="block w-full text-sm ...
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add src/app/dashboard/bots/[botId]/landing-page-editor.tsx
git commit -m "feat: migrate logo upload from Base64 to Railway volume API"
```

---

## Task 6: Create per-interview OG image generator

**Files:**
- Create: `src/app/i/[slug]/opengraph-image.tsx`

**Context:** Next.js App Router automatically uses a `opengraph-image.tsx` file co-located with a route as the OG image for that route. The file exports a default function returning `ImageResponse`. We use **Node.js runtime** (not edge) so we can access Prisma directly without HTTP round-trips.

Logic:
1. If `landingImageUrl` is set and is a proper URL (not Base64) → fetch and use it as-is (redirect to image URL via OG `<img>`)
2. Else if `logoUrl` is set → render branded card with logo + title + description + brand color
3. Else → render generic Business Tuner card (same as root `/opengraph-image.tsx`)

**Important constraint:** `ImageResponse` can only load images via `fetch()` with absolute URLs. Relative paths like `/api/uploads/image?path=...` need to be made absolute using `NEXT_PUBLIC_APP_URL`.

**Step 1: Create the file**

Create `src/app/i/[slug]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export const alt = 'Interview';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

const BRAND_NAME = 'Business Tuner';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';

function isUsableImageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    // Exclude Base64 data URLs (can't be fetched by ImageResponse)
    if (url.startsWith('data:')) return false;
    // Accept absolute URLs and our API paths
    return url.startsWith('http') || url.startsWith('/api/uploads');
}

function toAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${APP_URL}${url}`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const bot = await prisma.bot.findUnique({
        where: { slug },
        select: {
            name: true,
            landingTitle: true,
            landingDescription: true,
            landingImageUrl: true,
            logoUrl: true,
            primaryColor: true,
            backgroundColor: true,
            project: {
                select: {
                    organization: { select: { name: true } }
                }
            }
        }
    });

    const title = bot?.landingTitle || bot?.name || 'Intervista';
    const description = bot?.landingDescription || `Partecipa all'intervista interattiva "${title}"`;
    const brandColor = bot?.primaryColor || '#f59e0b';
    const bgColor = bot?.backgroundColor || '#0f172a';
    const orgName = bot?.project?.organization?.name || BRAND_NAME;

    // Case 1: Has a usable cover image → render it large with a title overlay
    if (isUsableImageUrl(bot?.landingImageUrl)) {
        const coverUrl = toAbsoluteUrl(bot!.landingImageUrl!);

        return new ImageResponse(
            (
                <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Dark overlay + title at bottom */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                        padding: '40px 60px 50px',
                        display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                        <div style={{ fontSize: '48px', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
                            {title}
                        </div>
                        <div style={{ fontSize: '24px', color: 'rgba(255,255,255,0.75)' }}>
                            {orgName}
                        </div>
                    </div>
                </div>
            ),
            { ...size }
        );
    }

    // Case 2: Has a usable logo → branded card
    if (isUsableImageUrl(bot?.logoUrl)) {
        const logoUrl = toAbsoluteUrl(bot!.logoUrl!);

        return new ImageResponse(
            (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: bgColor.startsWith('#') ? bgColor : '#0f172a',
                    padding: '60px 80px',
                    gap: '32px',
                }}>
                    {/* Logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={orgName} style={{ maxHeight: '120px', maxWidth: '400px', objectFit: 'contain' }} />

                    {/* Title */}
                    <div style={{
                        fontSize: '52px', fontWeight: 800, color: '#ffffff',
                        textAlign: 'center', lineHeight: 1.15,
                        display: 'flex',
                    }}>
                        {title}
                    </div>

                    {/* Description */}
                    <div style={{
                        fontSize: '26px', color: 'rgba(255,255,255,0.65)',
                        textAlign: 'center', maxWidth: '900px', lineHeight: 1.4,
                        display: 'flex',
                    }}>
                        {description.slice(0, 120)}{description.length > 120 ? '...' : ''}
                    </div>

                    {/* Brand accent bar */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: '8px', background: brandColor,
                    }} />
                </div>
            ),
            { ...size }
        );
    }

    // Case 3: No logo, no cover → generic Business Tuner card (same as root opengraph-image)
    return new ImageResponse(
        (
            <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                padding: '60px 80px',
            }}>
                <div style={{ fontSize: '56px', fontWeight: 700, color: '#f59e0b', textAlign: 'center', display: 'flex', marginBottom: '24px' }}>
                    {BRAND_NAME}
                </div>
                <div style={{ fontSize: '36px', color: '#94a3b8', textAlign: 'center', display: 'flex' }}>
                    {title}
                </div>
            </div>
        ),
        { ...size }
    );
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Verify the route exists at build time (dev)**

```bash
# With dev server running:
curl -I "http://localhost:3000/i/YOUR_TEST_SLUG/opengraph-image"
# Expected: HTTP 200, Content-Type: image/png
```
Replace `YOUR_TEST_SLUG` with a real bot slug from your dev DB.

**Step 4: Commit**

```bash
git add src/app/i/[slug]/opengraph-image.tsx
git commit -m "feat: dynamic per-interview OG image (cover > logo card > generic)"
```

---

## Task 7: Fix OG metadata in the slug page

**Files:**
- Modify: `src/app/i/[slug]/page.tsx:41-111`

**Context:** The current `generateMetadata` at line 52 does `image = bot.landingImageUrl || bot.logoUrl`. Two problems:
1. If `logoUrl` is a Base64 string, it becomes the OG image URL — this doesn't work in OG tags (too large, not a URL)
2. Now that we have `opengraph-image.tsx` in the same directory, Next.js will auto-use it. But `generateMetadata` also manually sets `openGraph.images` — we need to let the auto-generated OG image take priority OR set it explicitly to the route's OG image.

The cleanest fix: **remove the manual image override** from `generateMetadata` when there's a dynamic OG image file. Next.js will automatically resolve `/i/[slug]/opengraph-image` when no images are set in `generateMetadata`. Alternatively, set the canonical URL explicitly so social crawlers can find it.

Actually, Next.js App Router: when both `generateMetadata` returns `openGraph.images` AND `opengraph-image.tsx` exists, the `generateMetadata` value takes priority. So we need to either:
- Remove `images` from `generateMetadata` (let the file win)
- OR set `images` to the OG image route URL

Best approach: set `images` to the explicit OG image route URL, which is always valid. Also filter out Base64 from the logo fallback.

**Step 1: Update `generateMetadata` in `src/app/i/[slug]/page.tsx`**

Find lines 52-55:
```typescript
    const image = bot.landingImageUrl || bot.logoUrl;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';
    const canonicalUrl = `${appUrl}/i/${slug}`;
    const fallbackSocialImage = `${appUrl}/opengraph-image`;
```

Replace with:
```typescript
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.voler.ai';
    const canonicalUrl = `${appUrl}/i/${slug}`;
    // Use the per-interview OG image route — handles cover/logo/fallback logic internally
    const socialImage = `${canonicalUrl}/opengraph-image`;
```

Find lines 88-98 (openGraph images array):
```typescript
            images: image ? [{
                url: image,
                width: 1200,
                height: 630,
                alt: `${title} - Intervista interattiva`,
            }] : [{
                url: fallbackSocialImage,
                width: 1200,
                height: 630,
                alt: `${brandName} - Interviste AI`,
            }],
```

Replace with:
```typescript
            images: [{
                url: socialImage,
                width: 1200,
                height: 630,
                alt: `${title} - Intervista interattiva`,
            }],
```

Find line 106 (twitter images):
```typescript
            images: image ? [image] : [fallbackSocialImage],
```

Replace with:
```typescript
            images: [socialImage],
```

**Step 2: Also improve the description fallback chain (line 51)**

Find:
```typescript
    const description = bot.landingDescription || bot.researchGoal || `Partecipa all'intervista interattiva "${title}" - Un'esperienza conversazionale intelligente creata con Business Tuner.`;
```

Replace with:
```typescript
    const description = bot.landingDescription || bot.researchGoal || bot.introMessage || `Partecipa all'intervista "${title}" con ${brandName}.`;
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/i/[slug]/page.tsx
git commit -m "fix: OG metadata uses dynamic per-interview image route, improve description fallback"
```

---

## Task 8: Final verification

**Step 1: Run TypeScript check on full project**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
```
Expected: Only the pre-existing errors from MEMORY.md (organizations/route.ts, platform-settings route, training-service.ts). No new errors.

**Step 2: Run existing tests**

```bash
npm run test:run 2>&1 | tail -20
```
Expected: all tests pass (no new failures).

**Step 3: Manual smoke test (with dev server running)**

Test checklist:
- [ ] Go to `/dashboard/bots/[any-bot-id]` → branding tab → upload a logo file → verify upload succeeds and preview shows
- [ ] Upload a cover image → verify it shows in the preview thumbnail
- [ ] Set a video URL, save, then clear it and save again → verify the video disappears from the landing page
- [ ] Visit `/i/[slug]` → verify logo is not cropped (shows as square with contain)
- [ ] Start an interview → verify chat header shows logo in rounded square (not circle)
- [ ] Share `/i/[slug]` URL in a social preview tool (e.g., https://metatags.io) → verify interview-specific image appears

**Step 4: Final commit message**

```bash
git log --oneline -8
```
Verify 7 commits are present from Tasks 1-7. If all good, the feature branch is ready for review.

---

## Summary of Files Changed

| Task | File | Action |
|------|------|--------|
| 1 | `src/app/actions.ts` | Fix empty string → null for landing fields |
| 2 | `src/components/interview-chat.tsx` | rounded-full → rounded-lg, object-cover → object-contain |
| 3 | `src/app/api/uploads/image/route.ts` | **NEW** — upload/serve on Railway volume |
| 4 | `src/app/dashboard/bots/[botId]/landing-page-editor.tsx` | Cover image file upload UI |
| 5 | `src/app/dashboard/bots/[botId]/landing-page-editor.tsx` | Logo: Base64 → volume API |
| 6 | `src/app/i/[slug]/opengraph-image.tsx` | **NEW** — dynamic per-interview OG image |
| 7 | `src/app/i/[slug]/page.tsx` | OG metadata points to dynamic image route |
