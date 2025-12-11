'use client';

import { startInterviewAction } from '@/app/actions';

export default function StartInterviewButton({ botId }: { botId: string }) {
    const startAction = startInterviewAction.bind(null, botId);

    return (
        <form action={startAction}>
            <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg transform active:scale-95"
            >
                Start Conversation
            </button>
        </form>
    );
}
