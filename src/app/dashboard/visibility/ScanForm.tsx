'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ScanProgress } from "@/components/visibility/ScanProgress";
import { showToast } from "@/components/toast";
import { PLANS, PlanType } from "@/config/plans";

export function ScanForm() {
    const [loading, setLoading] = useState(false);
    const [canScan, setCanScan] = useState(true);
    const [limitReason, setLimitReason] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        checkLimits();
    }, []);

    const checkLimits = async () => {
        try {
            const res = await fetch('/api/user/settings');
            const data = await res.json();

            if (data.memberships?.[0]?.organization) {
                const org = data.memberships[0].organization;
                const planKey = org.plan as PlanType;
                const planConfig = PLANS[planKey] || PLANS[PlanType.TRIAL];

                // Simple client-side check for UX, backend enforces strictly
                // Logic based on PLAN: Pro = 10 manual/day, etc.
                // Here we check if scans in last 24h >= limit
                const last24hScans = org.visibilityConfig?.scans?.filter((s: any) =>
                    new Date(s.startedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
                ).length || 0;

                const manualLimit = planKey === PlanType.PRO ? 10 : planKey === PlanType.BUSINESS ? 50 : 0;

                if (manualLimit > 0 && last24hScans >= manualLimit) {
                    setCanScan(false);
                    setLimitReason(`Limite giornaliero raggiunto (${manualLimit}/${manualLimit})`);
                }
            }
        } catch (e) {
            console.error("Failed to check limits", e);
        }
    };

    const handleScan = async () => {
        if (!canScan) return;
        setLoading(true);
        try {
            const response = await fetch('/api/visibility/scan/run', {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Scan failed');
            }

            const data = await response.json();

            if (data.partial) {
                showToast("Scansione completata parzialmente. Alcuni provider non sono configurati.");
            } else {
                showToast("Scansione completata con successo!");
            }

            if (data.scanId) {
                router.push(`/dashboard/visibility?scanId=${data.scanId}`);
            } else {
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            showToast(e instanceof Error ? e.message : "Errore durante l'esecuzione della scansione", 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex flex-col items-end gap-1">
                <Button
                    onClick={handleScan}
                    disabled={loading || !canScan}
                    className="rounded-full px-6"
                    title={limitReason || ""}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scansione in corso...
                        </>
                    ) : !canScan ? (
                        "Attendi 24h per nuova scansione"
                    ) : (
                        "Esegui Nuova Scansione"
                    )}
                </Button>
                {limitReason && (
                    <p className="text-xs text-red-500">{limitReason}</p>
                )}
            </div>

            <ScanProgress isOpen={loading} onComplete={() => {
                router.refresh();
                checkLimits(); // Re-check limits after scan
            }} />
        </>
    );
}
