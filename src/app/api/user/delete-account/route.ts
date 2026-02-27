import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/user/delete-account
 *
 * GDPR Art.17 — Right to Erasure.
 * Permanently deletes the authenticated user's account and all associated data.
 *
 * Cascade order:
 * 1. Organizations where the user is the sole member → deleted (and their bots/projects)
 * 2. User record → Prisma cascade deletes accounts, sessions, memberships, projects,
 *    reports, copilot sessions, credit transactions, credit packs, etc.
 */
export async function DELETE() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // 1. Find organizations where this user is the only member.
        //    These would become orphaned after deletion, so we delete them explicitly.
        const soleOwnedOrgs = await prisma.organization.findMany({
            where: {
                memberships: {
                    every: { userId }
                }
            },
            select: { id: true }
        });

        if (soleOwnedOrgs.length > 0) {
            const orgIds = soleOwnedOrgs.map(o => o.id);
            await prisma.organization.deleteMany({
                where: { id: { in: orgIds } }
            });
        }

        // 2. Delete user — Prisma cascade handles:
        //    Account, Session, PasswordResetToken, Membership (remaining),
        //    Project (owned), Report, CopilotSession, CreditTransaction,
        //    CreditPack, PartnerClientAttribution, etc.
        await prisma.user.delete({
            where: { id: userId }
        });

        console.log('[delete-account] User account deleted successfully');

        return NextResponse.json({
            success: true,
            message: 'Account and all associated data have been permanently deleted.'
        });

    } catch (error) {
        console.error('[delete-account] error:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { error: 'Failed to delete account. Please contact support.' },
            { status: 500 }
        );
    }
}
