import { PlanType, SubscriptionStatus } from '@prisma/client';
import { subscriptionTierToPlanType } from '../src/config/plans';

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

function resolveExpectedPlan(params: {
  currentPlan: PlanType;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: string | null;
}): PlanType {
  const { currentPlan, subscriptionStatus, subscriptionTier } = params;

  if (subscriptionStatus === SubscriptionStatus.TRIALING) {
    return PlanType.TRIAL;
  }

  if (subscriptionTier) {
    return subscriptionTierToPlanType(subscriptionTier);
  }

  return currentPlan;
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const apply = process.argv.includes('--apply');

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      subscription: {
        select: {
          status: true,
          tier: true
        }
      }
    }
  });

  const mismatches = organizations
    .map((org) => {
      const expectedPlan = resolveExpectedPlan({
        currentPlan: org.plan,
        subscriptionStatus: org.subscription?.status || null,
        subscriptionTier: org.subscription?.tier || null
      });

      return {
        id: org.id,
        name: org.name,
        currentPlan: org.plan,
        expectedPlan,
        subscriptionStatus: org.subscription?.status || null,
        subscriptionTier: org.subscription?.tier || null
      };
    })
    .filter((row) => row.currentPlan !== row.expectedPlan);

  console.log(`[normalize-subscription-plan-alignment] Organizations checked: ${organizations.length}`);
  console.log(`[normalize-subscription-plan-alignment] Mismatches found: ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.table(
      mismatches.slice(0, 50).map((m) => ({
        id: m.id,
        name: m.name,
        currentPlan: m.currentPlan,
        expectedPlan: m.expectedPlan,
        subscriptionStatus: m.subscriptionStatus,
        subscriptionTier: m.subscriptionTier
      }))
    );
  }

  if (!apply) {
    console.log('[normalize-subscription-plan-alignment] Dry run only. Re-run with --apply to update organization.plan.');
    return;
  }

  let updated = 0;
  for (const mismatch of mismatches) {
    await prisma.organization.update({
      where: { id: mismatch.id },
      data: { plan: mismatch.expectedPlan }
    });
    updated += 1;
  }

  console.log(`[normalize-subscription-plan-alignment] Updated organizations: ${updated}`);
}

main()
  .catch((error) => {
    console.error('[normalize-subscription-plan-alignment] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  });
