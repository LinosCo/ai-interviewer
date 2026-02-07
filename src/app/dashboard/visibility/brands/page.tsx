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

    // Get user's subscription info for the selected organization
    const membership = activeOrgId
        ? await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: activeOrgId
                }
            },
            include: {
                organization: {
                    include: { subscription: true }
                }
            }
        })
        : await prisma.membership.findFirst({
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
