import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Download, Gift } from 'lucide-react';

export default async function ClaimsPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            rewardConfig: true,
            conversations: {
                where: { rewardGrant: { isNot: null } },
                include: { rewardGrant: true }
            }
        }
    });

    if (!bot) notFound();

    const claims = bot.conversations.map(c => ({
        id: c.rewardGrant!.id,
        code: c.rewardGrant!.code,
        claimedAt: c.rewardGrant!.claimedAt,
        conversationId: c.id,
        userEmail: c.rewardGrant!.guestEmail || (c.rewardGrant!.userId ? 'Registered User' : 'Anonymous'),
        userName: c.rewardGrant!.guestName || (c.rewardGrant!.userId ? 'Registered User' : '-')
    })).sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Gift className="w-6 h-6 text-amber-600" />
                        Reward Claims: {bot.name}
                    </h1>
                    <p className="text-sm text-gray-500">
                        Total Claims: {claims.length}
                    </p>
                </div>
                <div className="flex gap-4">
                    <Link href={`/dashboard/bots/${bot.id}`} className="px-4 py-2 border rounded hover:bg-gray-50">
                        Back to Editor
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code / Link</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversation ID</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {claims.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                                    No rewards claimed yet.
                                </td>
                            </tr>
                        ) : (
                            claims.map(claim => (
                                <tr key={claim.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {new Date(claim.claimedAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div className="font-medium">{claim.userName}</div>
                                        <div className="text-gray-500 text-xs">{claim.userEmail}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-amber-600">
                                        {claim.code || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600 hover:underline">
                                        <Link href={`/dashboard/bots/${bot.id}/conversations/${claim.conversationId}`}>
                                            View Transcript
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
}
