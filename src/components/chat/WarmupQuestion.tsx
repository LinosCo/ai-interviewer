import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/button';

interface WarmupQuestionProps {
    warmupStyle: string; // "open" | "choice" | "icebreaker" | "context"
    warmupChoices?: any; // JSON choices
    warmupIcebreaker?: string | null;
    warmupContextPrompt?: string | null;
    onAnswer: (answer: string) => void;
    onSkip: () => void;
    brandColor?: string;
}

export function WarmupQuestion({
    warmupStyle,
    warmupChoices,
    warmupIcebreaker,
    warmupContextPrompt,
    onAnswer,
    onSkip,
    brandColor = '#f59e0b'
}: WarmupQuestionProps) {
    const [inputValue, setInputValue] = useState('');
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

    // Provide default questions if not configured
    const getQuestionText = () => {
        switch (warmupStyle) {
            case 'open':
                return "Before we begin, what's the main thing you'd like to share today?";
            case 'icebreaker':
                return warmupIcebreaker || "If you could change one thing about your work, what would it be?";
            case 'context':
                return warmupContextPrompt || "To give me better context, what is your current role?";
            case 'choice':
                return "To start, which of these best describes your situation?";
            default:
                return "Ready to get started?";
        }
    };

    const choices = Array.isArray(warmupChoices) ? warmupChoices : [];

    const handleSubmit = () => {
        if (warmupStyle === 'choice' && selectedChoice) {
            onAnswer(selectedChoice);
        } else if (inputValue.trim()) {
            onAnswer(inputValue);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-6 md:p-8 relative overflow-hidden"
        >
            {/* Decorative Header */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20" style={{ color: brandColor }} />

            <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm" style={{ backgroundColor: brandColor }}>
                    <Icons.Zap size={20} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                        Let's warm up
                    </h3>
                    <p className="text-gray-600 text-lg leading-relaxed">
                        {getQuestionText()}
                    </p>
                </div>
            </div>

            {/* Input Area */}
            <div className="space-y-4">
                {warmupStyle === 'choice' && choices.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {choices.map((choice: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedChoice(choice)}
                                className={`p-4 rounded-xl border-2 text-left transition-all hover:bg-stone-50 ${selectedChoice === choice
                                        ? 'border-current bg-stone-50 shadow-sm'
                                        : 'border-transparent bg-white shadow-sm hover:border-gray-200'
                                    }`}
                                style={{ borderColor: selectedChoice === choice ? brandColor : undefined }}
                            >
                                <span className="font-medium text-gray-800">{choice}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="relative">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-opacity-50 focus:outline-none resize-none bg-white/50 text-gray-900 placeholder-gray-400"
                            style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                            rows={3}
                        />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
                <button
                    onClick={onSkip}
                    className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors px-2 py-1"
                >
                    Skip warm-up
                </button>

                <Button
                    onClick={handleSubmit}
                    disabled={warmupStyle === 'choice' ? !selectedChoice : !inputValue.trim()}
                    style={{ backgroundColor: brandColor }}
                    className="text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all"
                >
                    Continue <Icons.ArrowRight size={16} className="ml-2" />
                </Button>
            </div>
        </motion.div>
    );
}
