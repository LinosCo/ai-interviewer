import Link from 'next/link';
import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { colors, gradients, shadows } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';

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
        <div className="flex h-screen flex-col md:flex-row md:overflow-hidden font-sans" style={{ background: gradients.mesh }}>

            {/* Sidebar */}
            <div className="w-full flex-none md:w-72 flex flex-col p-6 z-20 relative">
                <div style={{
                    position: 'absolute',
                    inset: '1.5rem',
                    background: 'rgba(255, 255, 255, 0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: shadows.md,
                    borderRadius: '24px',
                    zIndex: -1
                }} />

                <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-3">
                    <Icons.Logo size={32} />
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Business Tuner</span>
                </Link>

                {/* Quick Create Button */}
                <Link
                    href="/onboarding"
                    className="mb-8 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 group"
                    style={{ background: gradients.primary, boxShadow: shadows.amber }}
                >
                    <Icons.Plus className="w-5 h-5" color="white" />
                    <span>Nuova intervista</span>
                </Link>

                <nav className="flex flex-col gap-2 flex-1">
                    <DashboardLink href="/dashboard" icon={<Icons.Home size={20} />} label="Home" />
                    <DashboardLink href="/dashboard/interviews" icon={<Icons.MessageSquare size={20} />} label="Le mie interviste" />
                    <DashboardLink href="/templates" icon={<Icons.LayoutTemplate size={20} />} label="Template" />

                    {isAdmin && (
                        <div className="mt-6 pt-6 border-t border-gray-200/50">
                            <span className="text-xs text-amber-600 font-bold uppercase tracking-wider px-4 mb-3 block">Admin</span>
                            <DashboardLink href="/dashboard/admin/users" icon={<Icons.Users size={20} />} label="Gestione utenti" isAdmin />
                        </div>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-gray-200/50 pt-4 mt-auto space-y-2">
                    <DashboardLink href="/dashboard/settings" icon={<Icons.Settings size={20} />} label="Impostazioni" />

                    <form
                        action={async () => {
                            'use server';
                            await signOut();
                        }}
                    >
                        <button className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all text-gray-500 hover:text-red-600 hover:bg-red-50 group">
                            <Icons.LogOut size={20} className="text-gray-400 group-hover:text-red-500" />
                            <span className="font-medium">Esci</span>
                        </button>
                    </form>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow md:overflow-y-auto p-4 md:p-6 relative z-10">
                {/* Content Container with slight glass effect for readability if needed, or just transparent on mesh */}
                <div style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '100%' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// Helper Component for Links
function DashboardLink({ href, icon, label, isAdmin = false }: { href: string, icon: React.ReactNode, label: string, isAdmin?: boolean }) {
    return (
        <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isAdmin ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 hover:shadow-sm'}`}>
            <span className={isAdmin ? 'text-amber-600' : 'text-gray-400 group-hover:text-amber-500 transition-colors'}>
                {icon}
            </span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
