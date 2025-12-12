# AI Interviewer Platform (MVP)

A multi-tenant SaaS application for creating AI-powered qualitative research bots. Built with Next.js 14, Prisma, and Vercel AI SDK.

## Features

- **Bot Builder**: Configure research goals, target audience, and conversational flow.
- **AI Interviewer**: Adaptive chat interface that probes for deeper insights.
- **Analytics**: Basic conversation tracking (MVP) with scaffolds for Themes & Insights.
- **Multi-Tenant**: Supports Projects and Teams (User-based tenancy for MVP).

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Auth**: NextAuth.js (v5 Beta)
- **AI**: Vercel AI SDK + OpenAI / Anthropic

## getting Started

1. **Clone & Install**
   ```bash
   git clone <repo>
   cd ai-interviewer
   npm install
   ```

2. **Environment Setup**
   Copy `.env.template` (or just create `.env`):
   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/ai_interviewer"
   AUTH_SECRET="your_generated_secret"
   AUTH_URL="http://localhost:3000"
   OPENAI_API_KEY="sk-..."
   ANTHROPIC_API_KEY="sk-..."
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push # For rapid prototyping (or `migrate dev`)
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## Deployment (Vercel)

1. Push to GitHub.
2. Import project in Vercel.
3. Add Environment Variables (DATABASE_URL, OPENAI_API_KEY, etc.).
4. Deploy.

*Note: Ensure your database (e.g. Neon, Supabase) is accessible from Vercel's IP range.*

## Project Structure

- `/src/app/dashboard`: Admin UI for creating bots.
- `/src/app/i/[slug]`: Public participant interface.
- `/src/lib/llm/orchestrator.ts`: Core logic for managing interview state and prompts.
- `/prisma/schema.prisma`: Data model.
