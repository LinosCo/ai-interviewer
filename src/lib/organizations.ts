import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function getOrCreateDefaultOrganization(userId: string) {
    // 1. Check if user already has any organization
    const existingMembership = await prisma.membership.findFirst({
        where: { userId },
        include: { organization: true }
    });

    if (existingMembership) {
        return existingMembership.organization;
    }

    // 2. No organization found, create a default one
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, plan: true, monthlyCreditsLimit: true, monthlyCreditsUsed: true, creditsResetDate: true, packCreditsAvailable: true }
    });

    if (!user) throw new Error("User not found");

    const orgName = user.name ? `${user.name}'s Org` : "My Workspace";
    // Consistent slug format: lowercase name + short random to avoid collisions
    const baseSlug = (user.name || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;

    console.log(`[OrgHelper] Creating default organization for user ${userId}: ${slug}`);

    const organization = await prisma.organization.create({
        data: {
            name: orgName,
            slug,
            plan: (user as any).plan || 'FREE',
            monthlyCreditsLimit: user.monthlyCreditsLimit,
            monthlyCreditsUsed: user.monthlyCreditsUsed,
            creditsResetDate: user.creditsResetDate,
            packCreditsAvailable: user.packCreditsAvailable,
            members: {
                create: {
                    userId: userId,
                    role: 'OWNER',
                    status: 'ACTIVE'
                }
            }
        }
    });

    return organization;
}
