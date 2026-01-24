import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminCMSPage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    const connections = await prisma.cMSConnection.findMany({
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    suggestions: true,
                    analytics: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        ACTIVE: 'bg-green-100 text-green-800',
        PARTIAL: 'bg-blue-100 text-blue-800',
        GOOGLE_ONLY: 'bg-purple-100 text-purple-800',
        ERROR: 'bg-red-100 text-red-800',
        DISABLED: 'bg-gray-100 text-gray-800'
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Integrazioni CMS</h1>
                    <p className="text-gray-500 mt-1">Gestisci le connessioni CMS per i progetti</p>
                </div>
                <Link
                    href="/dashboard/admin/cms/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                    + Nuova Connessione
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
                    <p className="text-indigo-100 text-sm">Connessioni Totali</p>
                    <p className="text-3xl font-bold">{connections.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <p className="text-green-100 text-sm">Attive</p>
                    <p className="text-3xl font-bold">
                        {connections.filter(c => c.status === 'ACTIVE').length}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <p className="text-purple-100 text-sm">Google Connesso</p>
                    <p className="text-3xl font-bold">
                        {connections.filter(c => c.googleAnalyticsConnected || c.searchConsoleConnected).length}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                    <p className="text-amber-100 text-sm">Suggerimenti Totali</p>
                    <p className="text-3xl font-bold">
                        {connections.reduce((sum, c) => sum + c._count.suggestions, 0)}
                    </p>
                </div>
            </div>

            {/* Connections List */}
            {connections.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-500">Nessuna connessione CMS configurata</p>
                    <Link
                        href="/dashboard/admin/cms/new"
                        className="text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
                    >
                        Crea la prima connessione
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nome / Progetto
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Stato
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Google
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Suggerimenti
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ultimo Sync
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Azioni
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {connections.map((conn) => (
                                <tr key={conn.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-gray-900">{conn.name}</p>
                                            <p className="text-sm text-gray-500">
                                                {conn.project?.name || 'Progetto non trovato'}
                                                {conn.project?.organization?.name && (
                                                    <span className="text-gray-400"> - {conn.project.organization.name}</span>
                                                )}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[conn.status]}`}>
                                            {conn.status}
                                        </span>
                                        {conn.lastSyncError && (
                                            <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={conn.lastSyncError}>
                                                {conn.lastSyncError}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <span className={`px-2 py-1 text-xs rounded ${conn.googleAnalyticsConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                GA4
                                            </span>
                                            <span className={`px-2 py-1 text-xs rounded ${conn.searchConsoleConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                                SC
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {conn._count.suggestions}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {conn.lastSyncAt
                                            ? new Date(conn.lastSyncAt).toLocaleDateString('it-IT', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/dashboard/admin/cms/${conn.id}`}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                        >
                                            Gestisci
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
