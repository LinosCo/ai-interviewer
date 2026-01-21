import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

type OrganizationWithUsage = Prisma.OrganizationGetPayload<{
    include: {
        subscription: true;
        _count: {
            select: {
                members: true;
                projects: true;
                bots: true;
            };
        };
    };
}>;

export default async function AdminUsagePage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    // Simple check for admin - in production use proper role check middleware/util
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    const organizations: OrganizationWithUsage[] = await prisma.organization.findMany({
        include: {
            subscription: true,
            _count: {
                select: {
                    members: true,
                    projects: true,
                    bots: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-2xl font-bold">Monitoraggio Consumi Utenti (Admin)</h1>

            <div className="grid gap-6">
                {organizations.map((org) => (
                    <Card key={org.id} className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-semibold">{org.name}</h3>
                                <p className="text-sm text-gray-500">{org.id}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${org.plan === 'BUSINESS' ? 'bg-purple-100 text-purple-800' :
                                        org.plan === 'PRO' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                    }`}>
                                    {org.plan}
                                </span>
                                <span className="text-xs text-gray-500 mt-1">
                                    Sub Status: {org.subscription?.status || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-gray-500 mb-1">Interviste Mese</p>
                                <p className="font-semibold text-lg">{org.subscription?.interviewsUsedThisMonth || 0}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-gray-500 mb-1">Bot Totali</p>
                                <p className="font-semibold text-lg">{org._count.bots}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-gray-500 mb-1">Utenti</p>
                                <p className="font-semibold text-lg">{org._count.members}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-gray-500 mb-1">Progetti</p>
                                <p className="font-semibold text-lg">{org._count.projects}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" size="sm">Modifica Limiti (Coming Soon)</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
