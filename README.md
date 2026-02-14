# Business Tuner - AI-Powered Qualitative Research Platform

**Version**: 1.0.0  
**Last Updated**: 2026-01-13

Business Tuner è una piattaforma SaaS che automatizza le interviste qualitative utilizzando agenti AI conversazionali. Sostituisce i tradizionali questionari con conversazioni naturali, analizzando automaticamente le risposte per estrarre insight strategici.

---

## 🎯 Funzionalità Principali

### ✅ Implementate

#### Core Features
- **AI Interview Generation**: Generazione automatica di interviste strutturate
- **Conversational AI**: Chat bot intelligente basato su GPT-4/Claude
- **Multi-Topic Structure**: Organizzazione dell'intervista in topic logici
- **Fatigue Detection**: Sistema di rilevamento stanchezza utente
- **Knowledge Base**: Upload di documenti/testi di contesto per l'AI
- **Warm-up Questions**: Domande introduttive opzionali

#### Analytics & Insights
- **Sentiment Analysis**: Scoring automatico 0-100 del sentiment
- **Theme Extraction**: Identificazione automatica di temi ricorrenti
- **Key Quotes**: Estrazione automatica delle citazioni più significative
- **Topic Coverage**: Analisi di completezza per ogni area tematica
- **Aggregated Insights**: Meta-analisi su dataset completi

#### Data Collection Mode
- **Recruitment Mode**: Raccolta strutturata di profili candidati
- **Lead Generation**: Cattura lead qualificati con informazioni contestuali
- **Structured Export**: Export CSV con campi strutturati

#### Customization & Branding
- **Custom Logo**: Upload logo personalizzato (PRO+)
- **Brand Colors**: Personalizzazione colori primari e background
- **Custom Landing Page**: Landing page personalizzata per ogni bot
- **Watermark Removal**: Rimozione branding Business Tuner (PRO+)
- **White Label**: Completa rimozione riferimenti Business Tuner (BUSINESS)
- **Custom Domain**: Utilizzo domini personalizzati (BUSINESS)

#### Security & Compliance
- **End-to-end Encryption**: TLS 1.3 in transito, AES-256-GCM per API keys
- **GDPR Compliant**: Consent management, DSAR tools, data portability
- **Role-Based Access Control**: ADMIN, MEMBER, VIEWER, USER roles
- **Audit Logging**: Tracking azioni sensibili per compliance

---

## 🛠 Stack Tecnologico

- **Framework**: Next.js 16.0.8 (App Router)
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: NextAuth 5.0.0-beta.30
- **AI Providers**: OpenAI (GPT-4), Anthropic (Claude 3.5)
- **Payments**: Stripe 20.1.0
- **Hosting**: Vercel

---

## 📦 Setup & Installation

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
AUTH_SECRET=your_32_byte_random_secret

# Encryption (CRITICAL)
ENCRYPTION_KEY=your_64_character_hex_key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
# SiteGround SMTP
SMTP_HOST=mail.voler.ai
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=businesstuner@voler.ai
SMTP_PASS=your_mail_password

# Optional fallback (if SMTP missing)
RESEND_API_KEY=re_...
EMAIL_FROM="Business Tuner <businesstuner@voler.ai>"
NOTIFICATION_EMAIL=businesstuner@voler.ai
```

### Installation

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

---

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for complete security documentation.

**Critical**: Always set `ENCRYPTION_KEY` before storing API keys.

---

## 📖 Documentation

- [Security Guide](./SECURITY.md)
- [Cookie Policy](./src/app/(marketing)/cookie-policy/page.tsx)
- [DPA](./src/app/(marketing)/dpa/page.tsx)
- [SLA](./src/app/(marketing)/sla/page.tsx)
- [FAQ](./src/app/(marketing)/faq/page.tsx)
- [CHANGELOG](./CHANGELOG.md)

---

## 📞 Support

- Email: hello@voler.ai
- Security: security@voler.ai

---

**Made with ❤️ by Voler AI**
