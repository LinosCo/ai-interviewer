'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerUser } from './actions';
import Link from 'next/link';

function RegisterForm() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan');
    const [errorMessage, dispatch, isPending] = useActionState(registerUser, undefined);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Inizia la tua prova gratuita</h1>
                    <p className="text-gray-500 mt-2">Crea un account per pubblicare interviste</p>
                    {plan && (
                        <div className="mt-4 bg-purple-50 text-purple-700 py-1 px-3 rounded-full text-sm inline-block">
                            Piano selezionato: <strong>{plan}</strong> (14 giorni gratis)
                        </div>
                    )}
                </div>

                <form action={dispatch} className="space-y-4">
                    {/* Hidden input to pass plan */}
                    <input type="hidden" name="plan" value={plan || ''} />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                        <input
                            type="text"
                            name="name"
                            required
                            placeholder="Mario Rossi"
                            className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email aziendale</label>
                        <input
                            type="email"
                            name="email"
                            required
                            placeholder="nome@azienda.com"
                            className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            required
                            placeholder="••••••••"
                            minLength={6}
                            className="w-full rounded-lg border-gray-300 shadow-sm p-3 border focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    {errorMessage && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isPending ? 'Creazione account...' : 'Registrati e inizia prova'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    Hai già un account?{' '}
                    <Link href="/login" className="text-purple-600 font-medium hover:underline">
                        Accedi
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
