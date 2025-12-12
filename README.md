# AI Interviewer Platform (MVP)

A multi-tenant SaaS application for creating AI-powered qualitative research bots. Built with Next.js 14, Prisma, and Vercel AI SDK.

## Features

- **Bot Builder**: Configure research goals, target audience, and conversational flow.
- **AI Interviewer**: Adaptive chat interface that probes for deeper insights.
- **Analytics**: Basic conversation tracking (MVP) with scaffolds for Themes & Insights.
- **Multi-Tenant**: Supports Projects and Teams (User-based tenancy for MVP).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Auth**: NextAuth.js (v5 Beta)
- **AI**: Vercel AI SDK + OpenAI / Anthropic

## Getting Started

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
   AUTH_SECRET="your_generated_secret" # generate with: openssl rand -base64 32
   AUTH_URL="http://localhost:3000"
   OPENAI_API_KEY="sk-..."
   ANTHROPIC_API_KEY="sk-..."
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Default Credentials**
   The seed script creates a default admin user:
   - **Email**: `admin@example.com`
   - **Password**: `password123`
   
   To run seed manually: `npx prisma db seed`.

5. **Run Locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## Deployment Guide (Vercel)

### 1. Push to GitHub
If you haven't already, push your code to a new GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 2. Import in Vercel
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** -> **"Project"**.
3. Select your GitHub repository (`ai-interviewer`) and click **Import**.

### 3. Configure Database (Vercel Postgres)
*Before clicking Deploy:*
1. In the configuration screen, expand the **"Storage"** section (or set it up after deploying).
2. It's easiest to create the database **after** the project is created but before a successful build, OR:
   - Click "Deploy" first (it might fail on DB connection initially if variables aren't there).
   - Once the project exists in Vercel, go to the **Storage** tab.
   - Click **Connect Store** -> **Create New**.
   - Select **Neon** (Serverless Postgres) or **Vercel Postgres** from the Marketplace list.
   - Accept the defaults.
   - **Important**: This automatically adds `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, etc., to your environment variables.

### 4. Configure Environment Variables
Go to **Settings** -> **Environment Variables** and add the remaining keys:

| Key | Value | Note |
|-----|-------|------|
| `DATABASE_URL` | *Copy value from POSTGRES_PRISMA_URL* | **CRITICAL**: Vercel creates `POSTGRES_PRISMA_URL`. You MUST create a new variable called `DATABASE_URL` and paste that same value into it so Prisma can find it. |
| `AUTH_SECRET` | *Generate a random strong string* | Use `openssl rand -base64 32` locally to generate one. |
| `OPENAI_API_KEY`| `sk-...` | Your OpenAI Key. |
| `ANTHROPIC_API_KEY` | `sk-...` | Your Anthropic Key (Optional). |

*Note: `AUTH_URL` is generally not required on Vercel as it detects the deployment URL automatically.* 

### 5. Final Redeploy
1. Go to **Deployments**.
2. If the first deploy failed, click **Redeploy** now that the Database and Env Vars are set.
3. The `postinstall` script (`prisma generate`) will run automatically.
4. Your app should be live!

### 6. Initialize the DB
After deployment, you might need to push your schema to the production DB. You can do this locally by pointing to the prod DB, or assume `db push` isn't run automatically. 
**Recommended**: Connect your local terminal to the remote DB just once to push schema:
```bash
# In your local terminal
export DATABASE_URL="<your-vercel-postgres-connection-string>"
npx prisma db push
```
*(Retrieve the connection string from Vercel Storage -> .env.local -> Copy snippet)*

## Project Structure

- `/src/app/dashboard`: Admin UI for creating bots.
- `/src/app/i/[slug]`: Public participant interface.
- `/src/lib/llm/orchestrator.ts`: Core logic for managing interview state and prompts.
- `/prisma/schema.prisma`: Data model.
