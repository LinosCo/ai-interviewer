import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Lock, Plus } from 'lucide-react';
import { ChatbotsList } from '@/components/dashboard/ChatbotsList';
import { cookies } from 'next/headers';
import { PLANS, subscriptionTierToPlanType, PlanType } from '@/config/plans';

export default async function ChatbotsPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    const membership = activeOrgId
        ? await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: activeOrgId
                }
            },
            include: {
                organization: { include: { subscription: true } }
            }
        })
        : await prisma.membership.findFirst({
            where: { userId: session.user.id },
            include: {
                organization: { include: { subscription: true } }
            }
        });

    if (!membership?.organization) redirect('/login');

    const planType = membership.organization.subscription
        ? subscriptionTierToPlanType(membership.organization.subscription.tier)
        : PlanType.TRIAL;
    const plan = PLANS[planType];
    const hasChatbot = plan.features.chatbot;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chatbot AI</h1>
                    <p className="text-gray-500 mt-1">Crea e gestisci i chatbot per il tuo sito web</p>
                </div>
                {hasChatbot ? (
                    <Link
                        href="/dashboard/bots/create-chatbot"
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Nuovo Chatbot
                    </Link>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-amber-700">Il tuo piano non include Chatbot AI.</span>
                        <Link
                            href="/dashboard/billing/plans"
                            className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
                        >
                            <Lock className="w-4 h-4" />
                            Upgrade
                        </Link>
                    </div>
                )}
            </div>

            {/* Bots List - Client Component that filters by selected project */}
            <ChatbotsList hasChatbot={hasChatbot} />
        </div>
    );
}
