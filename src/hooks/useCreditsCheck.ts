'use client';

/**
 * useCreditsCheck Hook
 *
 * Hook per verificare lo stato dei crediti e se l'utente può usare le funzionalità AI.
 * Utile per bloccare azioni che consumano crediti quando esauriti.
 */

import { useEffect, useState, useCallback } from 'react';

interface UseCreditsCheckResult {
    canUseAI: boolean;
    isExhausted: boolean;
    alertLevel: string | null;
    resetDate: string | null;
    percentageUsed: number;
    isLoading: boolean;
    checkCredits: () => Promise<boolean>;
    refresh: () => void;
}

export function useCreditsCheck(): UseCreditsCheckResult {
    const [canUseAI, setCanUseAI] = useState(true);
    const [isExhausted, setIsExhausted] = useState(false);
    const [alertLevel, setAlertLevel] = useState<string | null>(null);
    const [resetDate, setResetDate] = useState<string | null>(null);
    const [percentageUsed, setPercentageUsed] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const checkCredits = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch('/api/credits');
            if (res.ok) {
                const data = await res.json();
                const exhausted = data.alertLevel === 'exhausted';
                setIsExhausted(exhausted);
                setCanUseAI(!exhausted || data.isUnlimited);
                setAlertLevel(data.alertLevel);
                setResetDate(data.resetDate);
                setPercentageUsed(data.percentageUsed || 0);
                return !exhausted || data.isUnlimited;
            }
        } catch (error) {
            console.error('Error checking credits:', error);
        }
        return true;
    }, []);

    useEffect(() => {
        const doCheck = async () => {
            setIsLoading(true);
            await checkCredits();
            setIsLoading(false);
        };
        doCheck();
    }, [checkCredits]);

    const refresh = useCallback(() => {
        checkCredits();
    }, [checkCredits]);

    return {
        canUseAI,
        isExhausted,
        alertLevel,
        resetDate,
        percentageUsed,
        isLoading,
        checkCredits,
        refresh
    };
}

export default useCreditsCheck;
