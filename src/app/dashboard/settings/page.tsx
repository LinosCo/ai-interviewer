import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <div className="bg-white p-6 rounded shadow">
                <p className="text-gray-600">
                    Account settings and global configurations will appear here.
                </p>
                <div className="mt-4 border-t pt-4">
                    <p className="text-sm text-gray-500">
                        Logged in as: <strong>{session.user.email}</strong>
                    </p>
                </div>
            </div>
        </div>
    );
}
