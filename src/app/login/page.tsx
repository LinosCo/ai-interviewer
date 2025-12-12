'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authenticate } from './actions';

export default function LoginPage() {
    const router = useRouter();
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);

    // Redirect to dashboard if login successful (errorMessage is null and not pending)
    useEffect(() => {
        // After form submission, if no error and not pending, redirect
        if (!isPending && errorMessage === null) {
            console.log('Login successful, redirecting to dashboard...');
            router.push('/dashboard');
        }
    }, [errorMessage, isPending, router]);

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
                            disabled={isPending}
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border disabled:opacity-50"
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            name="password"
                            required
                            disabled={isPending}
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border disabled:opacity-50"
                            placeholder="******"
                        />
                    </div>
                    <div className="text-red-500 text-sm h-4">
                        {errorMessage && <p>{errorMessage}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isPending ? 'Signing in...' : 'Sign In'}
                    </button>
                    {/* Manual fallback link */}
                    <div className="text-center text-xs text-gray-500 mt-4">
                        Already logged in? <a href="/dashboard" className="text-blue-600 hover:underline">Go to Dashboard</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
