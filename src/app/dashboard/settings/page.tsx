import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SettingsForm from './settings-form';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user) return <div>User not found</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <SettingsForm user={user} />
        </div>
    );
}
