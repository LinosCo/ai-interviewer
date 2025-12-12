import { createBotAction } from '@/app/actions';

export default async function NewBotPage(props: { params: Promise<{ projectId: string }> }) {
    const params = await props.params;
    const createBotWithProject = createBotAction.bind(null, params.projectId);

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
            <h1 className="text-xl font-bold mb-4">Create New Bot</h1>
            <form action={createBotWithProject} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Bot Name</label>
                    <input
                        name="name"
                        required
                        className="w-full border p-2 rounded"
                        placeholder="e.g. Travel Habits Interviewer"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                    <textarea
                        name="description"
                        className="w-full border p-2 rounded"
                        placeholder="Internal notes about this bot..."
                    />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Create Bot
                </button>
            </form>
        </div>
    );
}
