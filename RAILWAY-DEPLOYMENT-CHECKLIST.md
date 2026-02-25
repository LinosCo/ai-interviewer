# Railway Staging Deployment Checklist

## ✅ Configuration Files Updated
- [x] package.json - engines field added (Node.js >=22.12.0)
- [x] railway.json - nixpacks config updated (nodejs: 22.12.0)
- [x] .node-version - already present (22.12.0)
- [x] Code committed and pushed to feat/interview-flow-v2

## 🔍 Railway Dashboard Verification Checklist

### Environment Variables (Verify in Railway Dashboard)
Check that these are set for the Staging App:
- [ ] AUTH_SECRET=mBaDJNBZqzEcyNlK2Lj2rNeLCHtep+ptZMQSkZBpARc=
- [ ] ENCRYPTION_KEY=<value from local .env.local>
- [ ] DATABASE_URL=postgres://user:pass@host:port/db?sslmode=disable (external Railway host)
- [ ] NEXTAUTH_URL=https://btstage.voler.ai
- [ ] NODE_OPTIONS should NOT be set to anything problematic

**DO NOT SET:**
- NODE_VERSION environment variable (this conflicts with Nixpacks config)
- Any npm configuration that might override Node.js version

### Build & Deploy Settings
In Railway Dashboard → Staging App → Settings:
- [ ] Nixpacks builder is selected
- [ ] GitHub repo is connected (feat/interview-flow-v2 branch)
- [ ] Auto-deploy is enabled OR manual trigger available

## 🚀 Deployment Steps

### Option 1: GitHub Webhook (Automatic)
1. Changes are already pushed to feat/interview-flow-v2
2. If GitHub integration is active, Railway should automatically trigger a build
3. Check Railway Dashboard → Build Logs

### Option 2: Manual Trigger via Railway Dashboard
1. Go to Railway Project → Staging App
2. Click "Redeploy" or "Deploy" button
3. Monitor the build in "Build & Deploy" tab

### Option 3: Railway CLI (if available)
```bash
railway login
railway link  # Select your staging project
railway deploy
```

## 📋 Build Success Indicators
1. Build log shows: `Node.js version: 22.12.0` (or higher)
2. Prisma preinstall passes without version error
3. npm ci completes successfully
4. Next.js build completes without critical errors
5. App starts without DATABASE_URL or AUTH_SECRET errors

## ✨ Testing on Staging (btstage.voler.ai)
Once deployment is successful:
1. [ ] Open https://btstage.voler.ai
2. [ ] Test login with existing credentials
3. [ ] Test password recovery flow
4. [ ] Check browser console for errors
5. [ ] Test creating a new bot/conversation if available

## ❌ Troubleshooting

### If still Node.js 22.11.0:
1. Check if NODE_VERSION environment variable is set (delete it if present)
2. Try Railway CLI: `railway redeploy --force`
3. Clear Railway's build cache (may need Railway support)
4. As fallback: Downgrade Prisma to 6.x (compatible with Node.js 22.11.0)

### If DATABASE_URL connection fails:
1. Verify external Railway PostgreSQL host in DATABASE_URL
2. Check if sslmode is set correctly (disable for now)
3. Verify password is correct in DATABASE_URL

### If AUTH errors persist:
1. Verify AUTH_SECRET is set correctly
2. Verify NEXTAUTH_URL matches domain (https://btstage.voler.ai)
3. Check if trustHost: true is set in src/auth.ts
