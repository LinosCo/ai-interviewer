import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import Stripe from 'stripe';
import { PlanType, PLANS } from '../src/config/plans';
import { CREDIT_PACKS, formatCredits } from '../src/config/creditPacks';

type BillingPeriod = 'monthly' | 'yearly';

type CatalogTarget = {
  kind: 'plan' | 'pack';
  id: string;
  billing?: BillingPeriod;
  priceId: string;
  productName: string;
  productDescription: string;
  priceNickname: string;
};

type StripeConfigFromDb = {
  stripeSecretKey?: string | null;
  stripePriceStarter?: string | null;
  stripePriceStarterYearly?: string | null;
  stripePricePro?: string | null;
  stripePriceProYearly?: string | null;
  stripePriceBusiness?: string | null;
  stripePriceBusinessYearly?: string | null;
  stripePricePartner?: string | null;
  stripePricePartnerYearly?: string | null;
  stripePriceEnterprise?: string | null;
  stripePriceEnterpriseYearly?: string | null;
  stripePricePackSmall?: string | null;
  stripePricePackMedium?: string | null;
  stripePricePackLarge?: string | null;
};

function buildPlanDescription(planType: PlanType): string {
  const plan = PLANS[planType];
  const highlights = plan.featureList.slice(0, 5).join(' • ');
  return `${plan.name}: ${plan.description}. Include ${formatCredits(plan.monthlyCredits)} crediti/mese. ${highlights}`;
}

function buildPackDescription(packId: string): string {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return '';
  return `${pack.name}: ${formatCredits(pack.credits)} crediti extra una tantum. I crediti non scadono e vengono consumati dopo i crediti del piano.`;
}

async function resolveTargets(stripe: Stripe): Promise<CatalogTarget[]> {
  const dbConfig = await loadStripeConfigFromDb();

  const targets: CatalogTarget[] = [];

  const plansToSync: PlanType[] = [PlanType.STARTER, PlanType.PRO, PlanType.BUSINESS, PlanType.PARTNER];
  const periods: BillingPeriod[] = ['monthly', 'yearly'];

  const planPriceIds: Record<PlanType, { monthly?: string; yearly?: string }> = {
    [PlanType.FREE]: {},
    [PlanType.TRIAL]: {},
    [PlanType.STARTER]: {
      monthly: process.env.STRIPE_PRICE_STARTER || dbConfig?.stripePriceStarter || undefined,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || dbConfig?.stripePriceStarterYearly || undefined
    },
    [PlanType.PRO]: {
      monthly: process.env.STRIPE_PRICE_PRO || dbConfig?.stripePricePro || undefined,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY || dbConfig?.stripePriceProYearly || undefined
    },
    [PlanType.BUSINESS]: {
      monthly: process.env.STRIPE_PRICE_BUSINESS || dbConfig?.stripePriceBusiness || undefined,
      yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || dbConfig?.stripePriceBusinessYearly || undefined
    },
    [PlanType.PARTNER]: {
      monthly: process.env.STRIPE_PRICE_PARTNER || dbConfig?.stripePricePartner || undefined,
      yearly: process.env.STRIPE_PRICE_PARTNER_YEARLY || dbConfig?.stripePricePartnerYearly || undefined
    },
    [PlanType.ENTERPRISE]: {
      monthly: process.env.STRIPE_PRICE_ENTERPRISE || dbConfig?.stripePriceEnterprise || undefined,
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || dbConfig?.stripePriceEnterpriseYearly || undefined
    },
    [PlanType.ADMIN]: {}
  };

  for (const planType of plansToSync) {
    for (const billing of periods) {
      const priceId = billing === 'yearly'
        ? planPriceIds[planType]?.yearly
        : planPriceIds[planType]?.monthly;
      if (!priceId) continue;
      const plan = PLANS[planType];
      const periodLabel = billing === 'monthly' ? 'Mensile' : 'Annuale';

      targets.push({
        kind: 'plan',
        id: planType,
        billing,
        priceId,
        productName: `Business Tuner ${plan.name}`,
        productDescription: buildPlanDescription(planType),
        priceNickname: `${plan.name} - ${periodLabel}`
      });
    }
  }

  for (const pack of CREDIT_PACKS) {
    const priceId =
      pack.id === 'small' ? (process.env.STRIPE_PRICE_PACK_SMALL || dbConfig?.stripePricePackSmall || undefined) :
      pack.id === 'medium' ? (process.env.STRIPE_PRICE_PACK_MEDIUM || dbConfig?.stripePricePackMedium || undefined) :
      pack.id === 'large' ? (process.env.STRIPE_PRICE_PACK_LARGE || dbConfig?.stripePricePackLarge || undefined) :
      undefined;
    if (!priceId) continue;
    targets.push({
      kind: 'pack',
      id: pack.id,
      priceId,
      productName: `Business Tuner ${pack.name}`,
      productDescription: buildPackDescription(pack.id),
      priceNickname: `${pack.name} (${formatCredits(pack.credits)})`
    });
  }

  // Keep only targets whose price exists on Stripe.
  const existingTargets: CatalogTarget[] = [];
  for (const target of targets) {
    try {
      await stripe.prices.retrieve(target.priceId);
      existingTargets.push(target);
    } catch {
      console.warn(`[sync-stripe-catalog] Skip missing price ${target.priceId} (${target.kind}:${target.id})`);
    }
  }

  return existingTargets;
}

async function loadStripeConfigFromDb(): Promise<StripeConfigFromDb | null> {
  try {
    const { prisma } = await import('../src/lib/prisma');
    return await prisma.globalConfig.findUnique({
      where: { id: 'default' },
      select: {
        stripeSecretKey: true,
        stripePriceStarter: true,
        stripePriceStarterYearly: true,
        stripePricePro: true,
        stripePriceProYearly: true,
        stripePriceBusiness: true,
        stripePriceBusinessYearly: true,
        stripePricePartner: true,
        stripePricePartnerYearly: true,
        stripePriceEnterprise: true,
        stripePriceEnterpriseYearly: true,
        stripePricePackSmall: true,
        stripePricePackMedium: true,
        stripePricePackLarge: true
      }
    });
  } catch {
    return null;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dbConfig = await loadStripeConfigFromDb();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || dbConfig?.stripeSecretKey || undefined;
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY in environment');
  }
  const stripe = new Stripe(stripeSecretKey, {
    typescript: true,
    apiVersion: '2025-12-15.clover'
  });
  const targets = await resolveTargets(stripe);

  console.log(`[sync-stripe-catalog] Targets resolved: ${targets.length}`);

  const updatedProducts = new Set<string>();
  let updatedPrices = 0;

  for (const target of targets) {
    const price = await stripe.prices.retrieve(target.priceId, { expand: ['product'] });
    const product = price.product as Stripe.Product;

    const needsProductUpdate =
      product.name !== target.productName ||
      (product.description || '') !== target.productDescription;

    const needsPriceUpdate = (price.nickname || '') !== target.priceNickname;

    if (!apply) {
      console.log(
        `[DRY-RUN] ${target.kind.toUpperCase()} ${target.id}${target.billing ? `/${target.billing}` : ''} | price=${target.priceId} | product=${product.id}` +
        ` | productUpdate=${needsProductUpdate} | priceUpdate=${needsPriceUpdate}`
      );
      continue;
    }

    if (needsProductUpdate && !updatedProducts.has(product.id)) {
      await stripe.products.update(product.id, {
        name: target.productName,
        description: target.productDescription
      });
      updatedProducts.add(product.id);
    }

    if (needsPriceUpdate) {
      await stripe.prices.update(target.priceId, {
        nickname: target.priceNickname
      });
      updatedPrices += 1;
    }
  }

  if (apply) {
    console.log(`[sync-stripe-catalog] Updated products: ${updatedProducts.size}`);
    console.log(`[sync-stripe-catalog] Updated prices (nickname): ${updatedPrices}`);
  } else {
    console.log('[sync-stripe-catalog] Dry run complete. Re-run with --apply to persist changes.');
  }
}

main().catch((error) => {
  console.error('[sync-stripe-catalog] Failed:', error);
  process.exit(1);
});
