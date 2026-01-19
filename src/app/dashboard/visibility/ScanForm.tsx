'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
                alert("Scan completato parzialmente. Alcuni provider non sono configurati o hanno fallito.");
            } else {
                alert("Scan completato con successo!");
            }

            router.refresh();
        } catch (e) {
            console.error(e);
            alert("Errore durante l'esecuzione dello scan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleScan} disabled={loading}>
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                </>
            ) : (
                "Esegui Nuova Scansione"
            )}
        </Button>
    );
}
