import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { InterviewsList } from '@/components/dashboard/InterviewsList';

export default async function InterviewsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Interviste AI</h1>
                    <p className="text-gray-500 mt-1">Gestisci le tue interviste e visualizza le risposte</p>
                </div>
                <Link
                    href="/onboarding"
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuova intervista
                </Link>
            </div>

            {/* Interviews List - filtered by project */}
            <InterviewsList />
        </div>
    );
}
