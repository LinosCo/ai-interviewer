# Changelog

All notable changes to Business Tuner will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-01-13

### 🔒 Security Fixes

#### Critical
- **Fixed XSS vulnerability (DOM-based)** in interview-chat.tsx
  - Replaced unsafe `.innerHTML` with safe DOM manipulation
  - Location: `src/components/interview-chat.tsx:610-619`

- **Implemented API key encryption**
  - All API keys now encrypted with AES-256-GCM
  - Added encryption utility module at `src/lib/encryption.ts`
  - Encrypted keys in database (User, Bot, GlobalConfig models)
  - **BREAKING**: Requires `ENCRYPTION_KEY` environment variable

- **Fixed weak random generation**
  - Replaced `Math.random() * 1000` with `crypto.randomUUID()`
  - Location: `src/app/actions.ts:97`

- **Fixed IDOR vulnerabilities**
  - Added authentication checks to `/api/bots/[botId]/reward` route
  - Added authentication checks to `/api/bots/[botId]/legal` route
  - Implemented ownership verification for all bot operations

- **Strengthened authorization checks**
  - `deleteBotAction`: Now only project owner can delete bots
  - `addKnowledgeSourceAction`: Added ownership verification + input sanitization
  - Location: `src/app/actions.ts:164-195, 657-712`

- **Added input sanitization**
  - Knowledge base content: max 50KB, control character removal
  - Title truncation to 200 chars
  - Content validation before storage

### 📝 Documentation

#### Added
- **SECURITY.md**: Comprehensive security guide
  - List of fixed vulnerabilities
  - Setup instructions for encryption
  - Security best practices
  - Production deployment checklist

- **Cookie Policy**: Complete cookie usage documentation
  - Location: `src/app/(marketing)/cookie-policy/page.tsx`
  - GDPR-compliant cookie disclosure
  - Tables of all cookies used

- **Data Processing Agreement (DPA)**: GDPR-compliant DPA
  - Location: `src/app/(marketing)/dpa/page.tsx`
  - Sub-processors list with locations
  - Data retention policies
  - Breach notification procedures

- **Service Level Agreement (SLA)**: Uptime guarantees and support SLA
  - Location: `src/app/(marketing)/sla/page.tsx`
  - Uptime commitments per plan (99.5% - 99.95%)
  - Support response times
  - Service credit calculation

- **Updated FAQ**: 14 comprehensive questions
  - Location: `src/app/(marketing)/faq/page.tsx`
  - Accurate reflection of implemented features
  - Clear disclosure of roadmap features

- **Updated README.md**: Complete project documentation
  - Feature matrix (implemented vs roadmap)
  - Tech stack details
  - Setup instructions with encryption key generation
  - Security warnings

### 🎨 Landing Page Updates

#### Changed
- **Updated plan features** in `src/config/plans.ts`
  - Removed misleading claims about API Access, Zapier, SSO
  - PRO plan now highlights: Knowledge Base, Custom Branding, AI Analysis
  - BUSINESS plan now highlights: White Label, Webhook integrations
  - Feature flags updated to reflect actual implementation status

#### Fixed
- **Feature flags alignment**
  - Disabled non-implemented features: `conditionalLogic`, `customTemplates`, `apiAccess`, `zapier`, `sso`, `segmentation`, `customDashboards`
  - Added comments marking implemented vs TODO features
  - Marketing features now accurately reflect capabilities

### 🛠 Infrastructure

#### Added
- **Encryption system**
  - `src/lib/encryption.ts`: AES-256-GCM implementation
  - Key derivation with PBKDF2 (100k iterations)
  - Unique salt and IV per encrypted value
  - Backward-compatible with plaintext keys (migration support)

#### Changed
- **Environment variables**
  - Added `ENCRYPTION_KEY` requirement (64 hex chars)
  - Documentation on key generation: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### ⚠️ Breaking Changes

1. **ENCRYPTION_KEY required**: Deployment without this variable will fail when saving/retrieving API keys
2. **Feature flags disabled**: Several features marked as "available" are now correctly disabled until implementation

### 🔄 Migration Guide

#### From Pre-1.0.0 (Unencrypted API Keys)

If you have existing API keys in your database, they will continue to work (backward compatible), but new keys will be encrypted. To encrypt existing keys:

```typescript
// Run once after setting ENCRYPTION_KEY
import { prisma } from '@/lib/prisma';
import { encryptIfNeeded } from '@/lib/encryption';

async function migrateKeys() {
  // Migrate global config
  const config = await prisma.globalConfig.findUnique({ where: { id: 'default' } });
  if (config) {
    await prisma.globalConfig.update({
      where: { id: 'default' },
      data: {
        openaiApiKey: encryptIfNeeded(config.openaiApiKey),
        anthropicApiKey: encryptIfNeeded(config.anthropicApiKey)
      }
    });
  }

  // Migrate bot keys
  const bots = await prisma.bot.findMany({ where: { openaiApiKey: { not: null } } });
  for (const bot of bots) {
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        openaiApiKey: encryptIfNeeded(bot.openaiApiKey),
        anthropicApiKey: encryptIfNeeded(bot.anthropicApiKey)
      }
    });
  }
}
```

---

## [0.9.0] - 2025-12-18 (Previous MVP Release)

### Added
- Initial MVP release
- Bot creation with AI generation
- Interview conversation flow
- Basic analytics (sentiment, transcripts)
- Stripe billing integration
- Multi-tenant project structure

### Known Issues (Fixed in 1.0.0)
- XSS vulnerability in brand color handling
- API keys stored in plaintext
- IDOR on several API routes
- Weak random generation for slugs
- Missing authorization checks

---

## Versioning Policy

- **Major version (X.0.0)**: Breaking changes, major features
- **Minor version (0.X.0)**: New features, backward-compatible
- **Patch version (0.0.X)**: Bug fixes, security patches

---

## Security Advisories

For security vulnerabilities, please email **security@voler.ai** instead of opening public issues.

---

**Maintained by Voler AI S.r.l.**
