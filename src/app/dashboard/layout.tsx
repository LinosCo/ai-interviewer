import Link from 'next/link';
import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Home, MessageSquare, LayoutTemplate, Settings, LogOut, Plus, Users } from 'lucide-react';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    let isAdmin = false;

    if (session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        isAdmin = user?.role === 'ADMIN';
    }

    return (
        <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
            <div className="w-full flex-none md:w-64 bg-gray-900 text-white p-4 flex flex-col">
                <Link href="/dashboard" className="mb-6 font-bold text-xl text-purple-400">
                    voler.AI
                </Link>

                {/* Quick Create Button */}
                <Link
                    href="/onboarding"
                    className="mb-6 flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuova intervista
                </Link>

                <nav className="flex flex-col gap-1 flex-1">
                    <Link href="/dashboard" className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors">
                        <Home className="w-5 h-5 text-gray-400" />
                        <span>Home</span>
                    </Link>
                    <Link href="/dashboard/interviews" className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors">
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                        <span>Le mie interviste</span>
                    </Link>
                    <Link href="/templates" className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors">
                        <LayoutTemplate className="w-5 h-5 text-gray-400" />
                        <span>Template</span>
                    </Link>

                    {isAdmin && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <span className="text-xs text-gray-500 uppercase tracking-wide px-3 mb-2 block">Admin</span>
                            <Link href="/dashboard/admin/users" className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors text-purple-300 hover:text-purple-200">
                                <Users className="w-5 h-5" />
                                <span>Gestione utenti</span>
                            </Link>
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-gray-700 pt-4 space-y-1">
                    <Link href="/dashboard/settings" className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg transition-colors">
                        <Settings className="w-5 h-5 text-gray-400" />
                        <span>Impostazioni</span>
                    </Link>
                    <form
                        action={async () => {
                            'use server';
                            await signOut();
                        }}
                    >
                        <button className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg w-full text-left transition-colors text-gray-400 hover:text-white">
                            <LogOut className="w-5 h-5" />
                            <span>Esci</span>
                        </button>
                    </form>
                </div>
            </div>
            <div className="flex-grow p-6 md:overflow-y-auto md:p-8 bg-gray-50">
                {children}
            </div>
        </div>
    );
}
