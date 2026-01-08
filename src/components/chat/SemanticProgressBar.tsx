import React from 'react';

interface SemanticProgressBarProps {
    currentTopicId: string;
    topics: { id: string; label: string; orderIndex: number }[];
    progress: number; // 0-100 numeric fallback
    brandColor?: string;
}

export function SemanticProgressBar({ currentTopicId, topics, progress, brandColor = '#F59E0B' }: SemanticProgressBarProps) {
    // If no topics, verify numeric progress
    if (!topics || topics.length === 0) {
        return (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 mt-4">
                <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: brandColor }}
                />
            </div>
        );
    }

    const currentTopicIndex = topics.findIndex(t => t.id === currentTopicId);
    const activeIndex = currentTopicIndex === -1 ? 0 : currentTopicIndex;

    return (
        <div className="w-full mb-2 mt-6 px-6 md:px-8">
            <div className="relative pt-6"> {/* Increased top space for labels */}
                {/* Connection Line */}
                <div className="absolute top-[30px] left-0 w-full h-0.5 bg-gray-100 z-0"></div>

                {/* Steps */}
                <div className="relative z-10 flex justify-between">
                    {topics.map((topic, index) => {
                        const isCompleted = index < activeIndex;
                        const isCurrent = index === activeIndex;

                        return (
                            <div key={topic.id} className="flex flex-col items-center group relative">
                                {/* Label - Moved ABOVE the dot */}
                                <span
                                    className={`
                                        absolute -top-6 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 -translate-x-1/2 left-1/2
                                        ${isCurrent ? 'opacity-100' : 'text-gray-400 opacity-60 group-hover:opacity-100'}
                                    `}
                                    style={{
                                        color: isCurrent ? brandColor : undefined
                                    }}
                                >
                                    {topic.label}
                                </span>

                                {/* Dot */}
                                <div
                                    className={`
                                        w-3 h-3 rounded-full border-2 transition-all duration-300 mt-[18px]
                                        ${isCurrent ? 'scale-125 shadow-sm' : ''}
                                        ${!isCompleted && !isCurrent ? 'bg-white border-gray-300' : ''}
                                    `}
                                    style={{
                                        backgroundColor: isCompleted ? brandColor : (isCurrent ? 'white' : undefined),
                                        borderColor: (isCompleted || isCurrent) ? brandColor : undefined,
                                        boxShadow: isCurrent ? `0 0 10px ${brandColor}40` : undefined
                                    }}
                                />
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
