import Link from 'next/link';
import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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
            <div className="w-full flex-none md:w-64 bg-gray-900 text-white p-4">
                <div className="mb-8 font-bold text-xl">AI Interviewer</div>
                <nav className="flex flex-col gap-2">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded">
                        Projects
                    </Link>
                    {isAdmin && (
                        <Link href="/dashboard/admin/users" className="p-2 hover:bg-gray-800 rounded text-purple-300 hover:text-purple-200">
                            User Management
                        </Link>
                    )}
                    <Link href="/dashboard/settings" className="p-2 hover:bg-gray-800 rounded">
                        Settings
                    </Link>
                    <form
                        action={async () => {
                            'use server';
                            await signOut();
                        }}
                    >
                        <button className="p-2 hover:bg-gray-800 rounded w-full text-left mt-8">
                            Sign Out
                        </button>
                    </form>
                </nav>
            </div>
            <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
                {children}
            </div>
        </div>
    );
}
