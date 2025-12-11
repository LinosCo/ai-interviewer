'use client';

import { createProjectAction } from '@/app/actions';

export default function NewProjectPage() {
    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
            <h1 className="text-xl font-bold mb-4">Create New Project</h1>
            <form action={createProjectAction} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Project Name</label>
                    <input
                        name="name"
                        required
                        className="w-full border p-2 rounded"
                        placeholder="e.g. Q3 Customer Research"
                    />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Create Project
                </button>
            </form>
        </div>
    );
}
