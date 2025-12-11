import Link from 'next/link';
import { signOut } from '@/auth';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
            <div className="w-full flex-none md:w-64 bg-gray-900 text-white p-4">
                <div className="mb-8 font-bold text-xl">AI Interviewer</div>
                <nav className="flex flex-col gap-2">
                    <Link href="/dashboard" className="p-2 hover:bg-gray-800 rounded">
                        Projects
                    </Link>
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
