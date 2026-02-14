import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PLANS, subscriptionTierToPlanType, PlanType } from "@/config/plans";
import { BrandsList } from "@/components/dashboard/BrandsList";
import { cookies } from "next/headers";

export default async function BrandsListPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    // Resolve membership with fallback to first available org when cookie is stale.
    const userWithMemberships = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            memberships: {
                include: {
                    organization: {
                        include: { subscription: true }
                    }
                }
            }
        }
    });

    const membership = activeOrgId
        ? userWithMemberships?.memberships.find((m) => m.organizationId === activeOrgId)
            || userWithMemberships?.memberships[0]
        : userWithMemberships?.memberships[0];

    if (!membership?.organization) redirect("/login");

    const subscription = membership.organization.subscription;
    const planType = subscription ? subscriptionTierToPlanType(subscription.tier) : PlanType.TRIAL;
    const plan = PLANS[planType];
    const hasVisibility = plan.features.visibilityTracker;

    return <BrandsList hasVisibility={hasVisibility} planType={planType} />;
}
