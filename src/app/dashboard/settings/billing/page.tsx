'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CreditCard,
    ExternalLink,
    Receipt,
    ShieldCheck,
    Zap,
    CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function BillingSettingsPage() {
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPortalLoading, setIsPortalLoading] = useState(false);

    useEffect(() => {
        async function fetchUsage() {
            try {
                const res = await fetch('/api/usage');
                const data = await res.json();
                setUsage(data);
            } catch (err) {
                console.error('Error fetching billing info:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchUsage();
    }, []);

    const openStripePortal = async () => {
        setIsPortalLoading(true);
        try {
            const res = await fetch('/api/stripe/portal');
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Error opening portal:', err);
        } finally {
            setIsPortalLoading(false);
        }
    };

    if (loading) return <div className="p-8">Caricamento billing...</div>;

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
            <div className="space-y-1">
                <h1 className="text-3xl font-black text-slate-900">Configurazione Billing</h1>
                <p className="text-slate-500 font-medium">Gestisci il tuo abbonamento, i metodi di pagamento e le fatture.</p>
            </div>

            {/* Piano Attuale */}
            <Card className="border-slate-100 shadow-sm overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="text-xl font-bold">Il tuo Piano</CardTitle>
                        <CardDescription>Attività e stato del piano attuale</CardDescription>
                    </div>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 font-bold">
                        {usage?.tier || 'FREE'}
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {usage?.status === 'ACTIVE' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                                )}
                                <span className="font-bold text-slate-900">
                                    Stato: {usage?.status === 'ACTIVE' ? 'Sottoscrizione Attiva' : 'Periodo di Prova'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">
                                Il tuo prossimo rinnovo è previsto per il <span className="text-slate-900 font-bold">{new Date(usage?.period.end).toLocaleDateString('it-IT')}</span>.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={openStripePortal}
                                disabled={isPortalLoading}
                                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl font-bold shadow-sm"
                            >
                                {isPortalLoading ? 'Caricamento...' : 'Gestisci su Stripe'}
                                <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                            <Link href="/pricing" className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white px-4 py-2 transition-colors">
                                Modifica Piano
                            </Link>
                        </div>
                    </div>

                    {/* Dettagli Fiscali Reminder */}
                    <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <Receipt className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-900">Dati di fatturazione</p>
                            <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                Puoi aggiornare la tua Partita IVA, il Codice SDI e l'indirizzo di fatturazione direttamente dal portale Stripe. Le fatture verranno generate automaticamente e inviate alla tua email.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Add-on & Extra */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Acquista Add-on
                        </CardTitle>
                        <CardDescription>Risorse extra istantanee</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 mb-6 font-medium">
                            Hai bisogno di più token o interviste per questo mese senza cambiare piano?
                        </p>
                        <Link href="/pricing#addons" className="inline-flex items-center justify-center w-full rounded-xl font-bold border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                            Vedi Pacchetti Extra
                        </Link>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-slate-400" />
                            Storico Fatture
                        </CardTitle>
                        <CardDescription>Scarica e visualizza</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 mb-6 font-medium">
                            Accedi allo storico completo dei tuoi pagamenti e scarica le fatture in formato PDF.
                        </p>
                        <Button variant="outline" onClick={openStripePortal} className="w-full rounded-xl font-bold border-slate-200">
                            Visualizza Fatture
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                    Sicurezza garantita da Stripe Payments. Nessun dato della carta viene salvato sui nostri sistemi.
                </p>
                <div className="flex items-center gap-4 opacity-30 grayscale">
                    <CreditCard className="w-6 h-6" />
                    <Receipt className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
