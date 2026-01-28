'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { acceptTransferInvite } from '@/app/actions/transfer';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/business-tuner/Icons";
import { showToast } from '@/components/toast';
import { Building2, Package, Bot, Tool, CheckCircle2, AlertCircle } from 'lucide-react';

function AcceptTransferContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error'>('confirming');
    const [error, setError] = useState<string | null>(null);

    const handleAccept = async () => {
        if (!token) return;
        setStatus('loading');
        try {
            await acceptTransferInvite(token);
            setStatus('success');
            showToast('Trasferimento completato con successo!', 'success');
            setTimeout(() => router.push('/dashboard'), 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Errore durante l\'accettazione del trasferimento');
            setStatus('error');
        }
    };

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <h1 className="text-2xl font-bold">Token mancante</h1>
                <p className="text-gray-500">Il link di trasferimento non e valido.</p>
                <Button onClick={() => router.push('/dashboard')}>Torna alla Dashboard</Button>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="text-center space-y-6">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto animate-bounce" />
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trasferimento Accettato!</h1>
                <p className="text-slate-500">
                    L'item e stato spostato correttamente nella tua organizzazione.<br />
                    Verrai reindirizzato alla dashboard tra pochi secondi...
                </p>
                <div className="flex justify-center">
                    <Icons.Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="text-center space-y-4">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                <h1 className="text-2xl font-bold text-slate-900">Ops! Qualcosa e andato storto</h1>
                <p className="text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{error}</p>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>Torna alla Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <div className="inline-flex p-4 bg-amber-50 rounded-full mb-4">
                    <Package className="w-10 h-10 text-amber-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Accetta Trasferimento</h1>
                <p className="text-slate-500 max-w-sm mx-auto">
                    Stai per ricevere la proprieta di un nuovo item. Una volta accettato, avrai il controllo totale.
                </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-4 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Verrai aggiunto come proprietario</span>
                </div>
                <div className="flex items-center gap-4 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">L'item sara visibile nella tua dashboard</span>
                </div>
                <div className="flex items-center gap-4 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Potrai gestire collaboratori e permessi</span>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Button
                    onClick={handleAccept}
                    disabled={status === 'loading'}
                    className="h-14 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-200"
                >
                    {status === 'loading' && <Icons.Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Conferma e Ricevi Item
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => router.push('/dashboard')}
                    disabled={status === 'loading'}
                    className="text-slate-400 font-bold"
                >
                    Rifiuta e torna indietro
                </Button>
            </div>
        </div>
    );
}

export default function AcceptTransferPage() {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <Suspense fallback={<div className="flex justify-center"><Icons.Loader2 className="w-10 h-10 animate-spin text-amber-500" /></div>}>
                    <AcceptTransferContent />
                </Suspense>
            </div>
        </div>
    );
}
