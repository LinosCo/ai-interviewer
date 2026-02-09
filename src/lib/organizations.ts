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
    // Consistent slug format: lowercase name + more random to avoid collisions
    const baseSlug = (user.name || "workspace")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30); // Limit base length
    const slug = `${baseSlug}-${randomBytes(4).toString('hex')}`;

    console.log(`[OrgHelper] Creating default organization for user ${userId}: ${slug}`);

    try {
        const organization = await prisma.organization.create({
            data: {
                name: orgName,
                slug,
                plan: (user.plan as any) || 'FREE',
                monthlyCreditsLimit: user.monthlyCreditsLimit ?? BigInt(500000),
                monthlyCreditsUsed: user.monthlyCreditsUsed ?? BigInt(0),
                creditsResetDate: user.creditsResetDate,
                packCreditsAvailable: user.packCreditsAvailable ?? BigInt(0),
                members: {
                    create: {
                        userId: userId,
                        role: 'OWNER',
                        status: 'ACTIVE',
                        joinedAt: new Date(),
                        acceptedAt: new Date()
                    }
                }
            }
        });

        return organization;
    } catch (err) {
        console.error(`[OrgHelper] Failed to create organization for user ${userId}:`, err);
        // If it's a slug collision, try once more with even more randomness
        const fallbackSlug = `${baseSlug}-${randomBytes(8).toString('hex')}`;
        return await prisma.organization.create({
            data: {
                name: orgName,
                slug: fallbackSlug,
                plan: (user.plan as any) || 'FREE',
                monthlyCreditsLimit: user.monthlyCreditsLimit ?? BigInt(500000),
                monthlyCreditsUsed: user.monthlyCreditsUsed ?? BigInt(0),
                creditsResetDate: user.creditsResetDate,
                packCreditsAvailable: user.packCreditsAvailable ?? BigInt(0),
                members: {
                    create: {
                        userId: userId,
                        role: 'OWNER',
                        status: 'ACTIVE',
                        joinedAt: new Date(),
                        acceptedAt: new Date()
                    }
                }
            }
        });
    }
}
