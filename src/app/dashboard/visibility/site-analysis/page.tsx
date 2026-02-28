export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandReportEngine } from '@/lib/visibility/brand-report-engine';
import { SiteAnalysisClient } from './SiteAnalysisClient';

export default async function SiteAnalysisPage({
    searchParams,
}: {
    searchParams: Promise<{ configId?: string; brandId?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    const params = await searchParams;
    // Support both ?configId= and ?brandId= for consistency with the main visibility page
    const configId = params.configId ?? params.brandId;

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { include: { organization: true } } },
    });

    const activeMembership = activeOrgId
        ? user?.memberships.find(m => m.organizationId === activeOrgId) ?? user?.memberships[0]
        : user?.memberships[0];

    const orgId = activeMembership?.organizationId;
    if (!orgId) redirect('/login');

    // Resolve config — use provided configId or fall back to first config for org
    const config = await prisma.visibilityConfig.findFirst({
        where: {
            organizationId: orgId,
            ...(configId ? { id: configId } : {}),
        },
        select: {
            id: true,
            brandName: true,
            websiteUrl: true,
        },
    });

    if (!config) {
        redirect('/dashboard/visibility');
    }

    if (!config.websiteUrl) {
        redirect('/dashboard/visibility');
    }

    // Fetch latest report
    const [report, running] = await Promise.all([
        BrandReportEngine.getLatest(config.id),
        BrandReportEngine.getRunning(config.id),
    ]);

    return (
        <div className="container max-w-5xl py-6 space-y-4">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/visibility">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-stone-500 hover:text-stone-700 -ml-2">
                        <ArrowLeft className="h-4 w-4" />
                        Visibilità
                    </Button>
                </Link>
                <span className="text-stone-300">/</span>
                <span className="text-sm text-stone-500">Analisi Sito</span>
            </div>

            <SiteAnalysisClient
                configId={config.id}
                brandName={config.brandName}
                websiteUrl={config.websiteUrl}
                initialReport={report as Parameters<typeof SiteAnalysisClient>[0]['initialReport']}
                initialIsRunning={!!running}
            />
        </div>
    );
}
