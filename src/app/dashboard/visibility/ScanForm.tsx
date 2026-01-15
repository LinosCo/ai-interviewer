'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runVisibilityScan } from "./actions";

export function ScanForm() {
    const [loading, setLoading] = useState(false);

    // Hardcoded for MVP speed, ideally a Dialog with inputs
    const handleScan = async () => {
        setLoading(true);
        try {
            await runVisibilityScan("CRM Software", "Business Tuner"); // Defaults
            alert("Scan started! Refresh in a few seconds.");
        } catch (e) {
            alert("Error running scan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleScan} disabled={loading}>
            {loading ? "Scanning..." : "Esegui Nuova Scansione"}
        </Button>
    );
}
