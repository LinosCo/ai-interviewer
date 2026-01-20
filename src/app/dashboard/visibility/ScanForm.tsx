'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ScanProgress } from "@/components/visibility/ScanProgress";
import { showToast } from "@/components/toast";

export function ScanForm() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleScan = async () => {
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

            router.refresh();
        } catch (e) {
            console.error(e);
            showToast("Errore durante l'esecuzione della scansione", 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button onClick={handleScan} disabled={loading} className="rounded-full px-6">
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scansione in corso...
                    </>
                ) : (
                    "Esegui Nuova Scansione"
                )}
            </Button>

            <ScanProgress isOpen={loading} onComplete={() => router.refresh()} />
        </>
    );
}
