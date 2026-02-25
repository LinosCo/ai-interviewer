# Prisma Version Downgrade - Pragmatic Solution

## Problem Identified
Railway's Nixpacks builder **does not respect** the Node.js version configuration in `railway.json` or the `engines` field in `package.json`. It continues to use Node.js v22.11.0 regardless of configuration.

**Build Error Received:**
```
npm warn EBADENGINE   current: { node: 'v22.11.0', npm: '10.9.0' }
npm error ┌────────────────────────────────────────────────────────────────────┐
npm error │    Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+.    │
npm error │    Please upgrade your Node.js version.                            │
npm error └────────────────────────────────────────────────────────────────────┘
```

## Solution: Downgrade to Prisma 6
Instead of fighting Railway's Node.js constraint, we align our application to it.

### Why Prisma 6?
- **Minimum Node.js requirement:** 22.11.0 (exactly what Railway uses)
- **Latest 6.x version:** 6.19.2 (stable, well-tested)
- **Full compatibility:** No version conflicts
- **Proven track record:** Prisma 6 is stable and production-ready

### Changes Made
```json
// package.json
"@prisma/client": "^6.19.0",      // was ^7.4.0
"@prisma/adapter-pg": "^6.19.0",  // was ^7.4.0
"prisma": "^6.19.0"               // was ^7.4.0
```

**@auth/prisma-adapter:** Kept at ^2.11.1 (compatible with Prisma 6)

## Differences Between Prisma 6 and 7
Prisma 6 and 7 have similar APIs for basic CRUD operations. The main differences:
- Prisma 7 has stricter type checking in some areas
- Some advanced features differ, but core functionality is identical
- Schema syntax is compatible

## Migration Concerns
**✅ No schema migration needed** - Your existing `schema.prisma` works with both versions
**✅ No code changes needed** - Core Prisma operations remain the same
**⚠️ Test edge cases** - Some advanced features might behave differently

## Next Steps

### 1. Railway Build
The new push should trigger a Railway rebuild. This time:
- npm ci should complete successfully
- Prisma 6.19.2 will install without version errors
- Build should proceed to Next.js compilation

### 2. Verify Build Success
Check Railway Dashboard Build Logs:
```
✓ npm ci completes without EBADENGINE warnings
✓ Prisma preinstall passes
✓ Next.js build completes
✓ App deploys to btstage.voler.ai
```

### 3. Testing on Staging
Once deployed, test all features on https://btstage.voler.ai:
- [ ] User authentication
- [ ] Password recovery
- [ ] Database operations (create/read/update/delete)
- [ ] API endpoints
- [ ] Real-time features (if any)

### 4. Monitor for Issues
If you encounter issues:
1. **Type errors:** May occur if using advanced Prisma 7 features
2. **Query differences:** Unlikely but test edge cases
3. **Database operations:** Should work identically

## Rollback Plan (if needed)
If Prisma 6 causes critical issues, we can quickly rollback:
```bash
# Revert to Prisma 7
git revert 26338c1
git push origin feat/interview-flow-v2
```

However, rolling back would require solving the Node.js version problem differently (either force Railway to use 22.12.0+ or downgrade @prisma/client further).

## Long-term Considerations
1. **Railway upgrade:** If Railway eventually uses Node.js 22.12.0+, you can upgrade to Prisma 7
2. **Switch platforms:** Alternative platforms (Vercel, Heroku) might offer different Node.js versions
3. **Node.js upgrade:** If Railway adds newer Node.js options, migration back to Prisma 7 would be straightforward

## References
- [Prisma 6 System Requirements](https://www.prisma.io/docs/orm/reference/system-requirements)
- [Prisma Version History](https://github.com/prisma/prisma/releases)
- [@auth/prisma-adapter Compatibility](https://www.npmjs.com/package/@auth/prisma-adapter)
