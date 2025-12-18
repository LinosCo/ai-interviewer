import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { gradients } from '@/lib/design-system';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

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

    const signOutAction = async () => {
        'use server';
        await signOut();
    };

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden font-sans" style={{ background: gradients.mesh }}>

            <DashboardSidebar isAdmin={isAdmin} signOutAction={signOutAction} />

            {/* Main Content Area */}
            <div className="flex-grow overflow-y-auto p-4 md:p-8 relative z-10">
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
