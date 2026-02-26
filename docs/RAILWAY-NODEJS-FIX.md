# Railway Node.js Version Fix - Task 6 Progress

## Problem
Railway's Nixpacks builder was using Node.js 22.11.0, while Prisma 7.4.0 was failing with a strict version check requiring 22.12.0+.

## Solution Applied
Made three configuration changes to force proper Node.js version selection:

### 1. **package.json** - Added engines field
```json
"engines": {
  "node": ">=22.12.0",
  "npm": ">=10.0.0"
}
```
This is the standard npm way to specify Node.js version requirements. Nixpacks respects this field.

### 2. **railway.json** - Updated Nixpacks config
```json
"nixpacks": {
  "nodejs": "22.12.0",
  "pkgManager": "npm"
}
```
- Changed from 24.0.0 to 22.12.0 (to match .node-version file)
- Added explicit pkgManager specification
- This tells Railway's Nixpacks builder exactly which Node.js version to use

### 3. **.node-version** - Already present
Contains "22.12.0" which is read by some build systems.

## Changes Committed
- Commit: `08febca` - "Fix Node.js version compatibility for Prisma 7.4.0"
- Pushed to: `feat/interview-flow-v2` branch
- Status: Waiting for Railway to pick up the new configuration

## Next Steps

### On Railway Dashboard:
1. Go to Railway Project → Staging App
2. Trigger a new deployment (either manually or wait for GitHub webhook if CI/CD is enabled)
3. Check Build Logs to confirm Node.js 22.12.0+ is being used
4. Verify Prisma npm ci passes without version errors

### What to Expect:
- Build should no longer fail at Prisma preinstall check
- Node.js 22.12.0 or higher will be used
- npm ci should complete successfully
- App should deploy to btstage.voler.ai

### Verification:
Once deployed, test authentication by visiting https://btstage.voler.ai and trying to:
1. Log in with existing credentials
2. Test password recovery flow
3. Create new account (if signup is enabled)

If build still fails with Node.js version error:
- Check Railway Dashboard "Build & Deploy" settings
- Clear Railway's cache (may require Railway CLI: `railway redeploy`)
- Consider downgrading Prisma to 6.x if Node.js 22.11.0 continues to be used

## Files Modified
- `package.json` - added engines field
- `railway.json` - updated nixpacks nodejs version and added pkgManager
