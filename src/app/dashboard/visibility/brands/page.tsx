import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PLANS, subscriptionTierToPlanType, PlanType } from "@/config/plans";
import { BrandsList } from "@/components/dashboard/BrandsList";

export default async function BrandsListPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    // Get user's subscription info for the plan features
    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        include: {
            organization: {
                include: { subscription: true }
            }
        }
    });

    if (!membership?.organization) redirect("/login");

    const subscription = membership.organization.subscription;
    const planType = subscription ? subscriptionTierToPlanType(subscription.tier) : PlanType.TRIAL;
    const plan = PLANS[planType];
    const hasVisibility = plan.features.visibilityTracker;

    return <BrandsList hasVisibility={hasVisibility} planType={planType} />;
}
