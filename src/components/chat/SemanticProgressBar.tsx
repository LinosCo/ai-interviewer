import React from 'react';

interface SemanticProgressBarProps {
    currentTopicId: string;
    topics: { id: string; label: string; orderIndex: number }[];
    progress: number; // 0-100 numeric fallback
}

export function SemanticProgressBar({ currentTopicId, topics, progress }: SemanticProgressBarProps) {
    // If no topics, verify numeric progress
    if (!topics || topics.length === 0) {
        return (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
                <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
        );
    }

    const currentTopicIndex = topics.findIndex(t => t.id === currentTopicId);
    const activeIndex = currentTopicIndex === -1 ? 0 : currentTopicIndex;

    return (
        <div className="w-full mb-8">
            <div className="relative">
                {/* Connection Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0"></div>

                {/* Steps */}
                <div className="relative z-10 flex justify-between">
                    {topics.map((topic, index) => {
                        const isCompleted = index < activeIndex;
                        const isCurrent = index === activeIndex;

                        return (
                            <div key={topic.id} className="flex flex-col items-center group relative">
                                {/* Dot */}
                                <div
                                    className={`
                    w-3 h-3 rounded-full border-2 transition-all duration-300
                    ${isCompleted
                                            ? 'bg-indigo-600 border-indigo-600 scale-100'
                                            : isCurrent
                                                ? 'bg-white border-indigo-600 scale-125 shadow-sm shadow-indigo-200'
                                                : 'bg-white border-gray-300'
                                        }
                  `}
                                />

                                {/* Label (only for current or if space permits, improved logic) */}
                                <span
                                    className={`
                    absolute top-6 text-xs whitespace-nowrap transition-all duration-300 -translate-x-1/2 left-1/2
                    ${isCurrent ? 'font-medium text-indigo-700 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}
                  `}
                                >
                                    {topic.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Percentage text (Optional) */}
            <div className="mt-8 text-right">
                <span className="text-xs font-medium text-gray-400">
                    {Math.round(progress)}% completato
                </span>
            </div>
        </div>
    );
}
