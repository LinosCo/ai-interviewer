'use client';

import { useFormState } from 'react-dom';
import { authenticate } from './actions';

export default function LoginPage() {
    // If we want manual client-side redirection to be super safe:
    const [errorMessage, dispatch] = useFormState(authenticate, undefined);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="w-full max-w-md bg-white p-8 rounded shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
                <p className="text-center text-gray-500 mb-4 text-sm">
                    Use seeded credentials: admin@example.com / password123
                </p>
                <form action={dispatch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            name="password"
                            required
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                            placeholder="******"
                        />
                    </div>
                    <div className="text-red-500 text-sm h-4">
                        {errorMessage && <p>{errorMessage}</p>}
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                        Sign In
                    </button>
                    {/* Add a manual link just in case */}
                    <div className="text-center text-xs text-gray-400 mt-2">
                        <a href="/dashboard">Go to Dashboard</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
