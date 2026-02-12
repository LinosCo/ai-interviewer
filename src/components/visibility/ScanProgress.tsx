'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Search, Brain, BarChart3, Cloud, Layout } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS = [
    { id: 'init', label: 'Inizializzazione scansione', icon: Layout },
    { id: 'query', label: 'Interrogazione motori AI', icon: Cloud },
    { id: 'analyze', label: 'Analisi semantica', icon: Brain },
    { id: 'aggregate', label: 'Calcolo visibilità', icon: BarChart3 },
    { id: 'finalize', label: 'Finalizzazione report', icon: Check },
];

export function ScanProgress({ isOpen, onComplete }: { isOpen: boolean, onComplete: () => void }) {
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (isOpen) {
            // Fake progress since the actual request is synchronous
            // We'll advance steps based on time, but the last step waits for the actual completion
            const interval = setInterval(() => {
                setCurrentStep(prev => {
                    if (prev < STEPS.length - 2) return prev + 1;
                    return prev;
                });
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            const timeout = setTimeout(() => setCurrentStep(0), 0);
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-3xl w-full max-w-md overflow-hidden border border-stone-100"
            >
                <div className="p-8 pb-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                            <Search size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-stone-900">Scansione in corso</h3>
                            <p className="text-sm text-stone-500">Monitoraggio visibilità brand...</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {STEPS.map((step, index) => {
                            const isCompleted = index < currentStep;
                            const isActive = index === currentStep;
                            const Icon = step.icon;

                            return (
                                <div key={step.id} className="flex items-center gap-4 group">
                                    <div className={`
                                        w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300
                                        ${isCompleted ? 'bg-green-100 text-green-600' :
                                            isActive ? 'bg-amber-100 text-amber-600' : 'bg-stone-50 text-stone-300'}
                                    `}>
                                        {isActive ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : isCompleted ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Icon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <span className={`
                                        text-sm font-medium transition-colors duration-300
                                        ${isCompleted ? 'text-stone-400' :
                                            isActive ? 'text-stone-900 font-bold' : 'text-stone-300'}
                                    `}>
                                        {step.label}
                                    </span>
                                    {isActive && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="ml-auto"
                                        >
                                            <div className="flex gap-1">
                                                <div className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1 h-1 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-8 pt-0 mt-4">
                    <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-amber-500"
                            initial={{ width: "0%" }}
                            animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mt-3 text-center">
                        Non chiudere questa finestra. L'operazione può richiedere fino a 30 secondi.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
