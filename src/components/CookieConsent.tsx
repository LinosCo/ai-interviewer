'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/business-tuner/Button';
import { ShieldCheck, X } from 'lucide-react';

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie-consent', 'accepted');
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookie-consent', 'declined');
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={{ y: -100, opacity: 0, x: '-50%' }}
                    className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] md:w-[600px] z-[99999]"
                >
                    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-stone-200/50 p-4 md:p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-stone-900 text-lg">Cookie Policy</h4>
                                <p className="text-sm text-stone-500 leading-relaxed mt-1">
                                    Utilizziamo i cookie per migliorare la tua esperienza e analizzare il traffico.
                                    Scopri di più nella nostra <Link href="/cookies" className="text-amber-600 hover:underline font-medium">Cookie Policy</Link>.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="text-stone-300 hover:text-stone-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            <Button
                                onClick={handleAccept}
                                className="flex-1 rounded-full py-4 sm:py-6 text-sm sm:text-base"
                            >
                                Accetta tutti
                            </Button>
                            <Button
                                onClick={handleDecline}
                                variant="outline"
                                className="flex-1 rounded-full py-4 sm:py-6 text-sm sm:text-base border-stone-200"
                            >
                                Solo necessari
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
