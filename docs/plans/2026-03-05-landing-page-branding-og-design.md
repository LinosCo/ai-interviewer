# Design: Landing Page Branding, OG Preview & Image Upload

**Date:** 2026-03-05
**Status:** Approved

---

## Problem Summary

1. **Social preview (OG)** shows generic Business Tuner branding instead of interview-specific content when sharing links on WhatsApp/LinkedIn/etc.
2. **Cover image** only accepts a URL (unreliable with Google Drive), no file upload option.
3. **YouTube video** persists on the landing page even after the URL field is cleared (data not properly nulled).
4. **Logo** stretches on the landing page (`object-cover` inconsistency) and gets cropped in the chat circle (wrong display mode).
5. **Logo in circle** — the round crop is problematic for most logo formats; changing to a rounded square makes it more reliable.

---

## Scope

6 distinct changes, all coordinated across the same feature set:

1. **Image storage on Railway volume** — new upload/serve API
2. **Cover image file upload** in landing-page-editor
3. **Logo display fix** — `object-contain` everywhere, circle → rounded square in chat
4. **Dynamic OG image per interview** — new per-slug OG image generator
5. **OG metadata text fix** — use interview's `landingTitle`/`landingDescription`
6. **Video clear bug fix** — properly null the field when URL is removed

---

## Architecture

### 1. Image Storage: Railway Volume API

**New files:**
- `src/app/api/uploads/image/route.ts` — POST (upload) + GET (serve)

**POST `/api/uploads/image`**
- Auth: session required, user must own/have access to the bot
- Input: `FormData` with `file` (Blob), `botId`, `type` (`logo` | `cover`)
- Validates: mime type (image/png, image/jpeg, image/webp, image/svg+xml), max 2MB
- Saves to: `${BACKUP_PATH}/uploads/{orgId}/{botId}/{type}-{timestamp}.{ext}`
  - Falls back to `/tmp/uploads/` if `BACKUP_PATH` not set
- Returns: `{ url: "/api/uploads/image?path=uploads/{orgId}/{botId}/..." }`

**GET `/api/uploads/image?path=...`**
- Reads file from Railway volume
- Returns with `Cache-Control: public, max-age=31536000, immutable`
- Content-Type derived from file extension
- Security: path must start with `uploads/` — no directory traversal

**Logo migration:** No automatic migration needed. Existing Base64 logos continue to work (the DB field holds either Base64 or a `/api/uploads/image?path=...` URL — both are valid `src` values).

---

### 2. Cover Image Upload in Editor

**Modified file:** `src/app/dashboard/bots/[botId]/landing-page-editor.tsx`

Replace the Cover Image URL text input with a dual-mode component:
- **Tab 1: Upload file** — file picker, preview thumbnail, 2MB limit warning, calls `POST /api/uploads/image`
- **Tab 2: URL** — keep existing URL text input for backward compatibility

On upload success, the returned URL is stored in the hidden `landingImageUrl` form field and submitted via the existing `updateBotAction`.

**Logo upload:** Same pattern already exists. Migrate logo upload to also use the volume API (store via POST, not Base64). For logos already stored as Base64, they keep working.

---

### 3. Logo Display Fix

**Modified files:**
- `src/components/interview/LandingPage.tsx` — ensure `object-contain` on logo `<img>`
- `src/components/interview-chat.tsx` — change avatar container from `rounded-full` to `rounded-lg`, change `object-cover` to `object-contain`, add white background behind logo

**Chat avatar (all three locations in interview-chat.tsx):**
```
Before: rounded-full, object-cover
After:  rounded-lg, object-contain, bg-white (or bg-stone-50)
```

Landing page logo: already uses `object-contain` in most places — audit and standardize all logo `<img>` tags to ensure consistency.

---

### 4. Dynamic OG Image Per Interview

**New file:** `src/app/i/[slug]/opengraph-image.tsx`

This uses Next.js `ImageResponse` (edge runtime, 1200×630px). Logic:

```
if (bot.landingImageUrl exists and is an absolute URL or /api/uploads path):
  → fetch and render the cover image directly at 1200x630
else if (bot.logoUrl exists):
  → render branded card:
    - Background: bot.backgroundColor or #0F172A (dark)
    - Logo (object-contain, centered or top-left)
    - Interview title (bot.landingTitle or bot.name)
    - Short description (bot.landingDescription, max 120 chars)
    - Brand color accent bar at bottom
else:
  → render default Business Tuner card (current /opengraph-image behavior)
```

The slug page's `generateMetadata` already sets `openGraph.images` — this file auto-registers as the OG image for `/i/[slug]` in Next.js App Router conventions.

---

### 5. OG Metadata Text Fix

**Modified file:** `src/app/i/[slug]/page.tsx` — `generateMetadata()`

Current fallback chain is partial. Full improved chain:

```
title:       landingTitle → bot.name → "Interview"
description: landingDescription → bot.researchGoal → bot.introMessage → "Join this interview"
images:      landingImageUrl → /i/[slug]/opengraph-image (new dynamic OG)
```

Also update:
- `og:title`, `og:description`, `twitter:title`, `twitter:description`
- `og:site_name` to the bot's org name or "Business Tuner"
- `theme-color` already uses `primaryColor` — keep

---

### 6. Video Clear Bug Fix

**Modified file:** `src/app/dashboard/bots/[botId]/landing-page-editor.tsx`

When `landingVideoUrl` input is cleared to empty string, the form currently sends `""` which the API may ignore. Fix:

- In the form submission, convert `""` to `null` for `landingVideoUrl` and `landingImageUrl`
- In `src/app/api/bots/[botId]/route.ts` PATCH handler: accept `null` explicitly for these fields and pass to Prisma update as `null` (not `undefined`, which Prisma ignores)

---

## Data Flow

```
User sets cover image (upload)
  → POST /api/uploads/image
  → File saved to /app/backups/uploads/{orgId}/{botId}/cover-{ts}.jpg
  → Returns URL: /api/uploads/image?path=uploads/...
  → landingImageUrl = "/api/uploads/image?path=..."
  → PATCH /api/bots/[botId] saves to DB

User shares /i/[slug] link
  → WhatsApp/LinkedIn fetches OG tags
  → generateMetadata() returns title, description from bot fields
  → /i/[slug]/opengraph-image.tsx generates 1200x630 image
    → reads bot data by slug
    → renders cover or branded card
  → Preview shows interview-specific branding
```

---

## Files to Create / Modify

| Action | File |
|--------|------|
| CREATE | `src/app/api/uploads/image/route.ts` |
| CREATE | `src/app/i/[slug]/opengraph-image.tsx` |
| MODIFY | `src/app/dashboard/bots/[botId]/landing-page-editor.tsx` |
| MODIFY | `src/app/i/[slug]/page.tsx` (generateMetadata) |
| MODIFY | `src/components/interview/LandingPage.tsx` |
| MODIFY | `src/components/interview-chat.tsx` |
| MODIFY | `src/app/api/bots/[botId]/route.ts` |

---

## Constraints & Notes

- **No DB schema changes** — `landingImageUrl` and `logoUrl` fields already exist as `String?`
- **Railway volume path** reuses `BACKUP_PATH` env var (`/app/backups`) with sub-path `/uploads/`
- **No new npm dependencies** — use Node.js `fs`, Next.js `ImageResponse` (already in use)
- **Backward compat** — Base64 logo URLs continue to work as `<img src>` values
- **Plan gating** — cover upload still requires PRO/BUSINESS/TRIAL (same as URL input)
- **Security** — uploaded file paths are validated server-side to prevent directory traversal

---

## Out of Scope

- Migrating existing Base64 logos to volume (they continue to work)
- Video hosting / upload (video embed URL stays as-is, just fix the clear bug)
- Changing who can upload (auth rules unchanged)
