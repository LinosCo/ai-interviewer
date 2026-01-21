import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ChatbotsList } from '@/components/dashboard/ChatbotsList';

export default async function ChatbotsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chatbot AI</h1>
                    <p className="text-gray-500 mt-1">Crea e gestisci i chatbot per il tuo sito web</p>
                </div>
                <Link
                    href="/dashboard/bots/create-chatbot"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuovo Chatbot
                </Link>
            </div>

            {/* Bots List - Client Component that filters by selected project */}
            <ChatbotsList />
        </div>
    );
}
