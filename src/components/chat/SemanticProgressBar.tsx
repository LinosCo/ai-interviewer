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
    const activeTopic = topics[activeIndex];

    return (
        <>
            {/* Mobile View: Show only active topic */}
            <div className="sm:hidden w-full mb-4 mt-4 px-4">
                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full" style={{ backgroundColor: `${brandColor}20` }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }}></div>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: brandColor }}>
                        {activeTopic?.label || 'Loading...'}
                    </span>
                    <span className="text-xs text-gray-500">
                        {activeIndex + 1}/{topics.length}
                    </span>
                </div>
            </div>

            {/* Desktop View: Full progress bar */}
            <div className="hidden sm:block w-full mb-2 mt-6 px-6 md:px-8">
                <div className="relative pt-6">
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
                                            absolute -top-8 text-[9px] font-bold uppercase tracking-wider text-center transition-all duration-300 -translate-x-1/2 left-1/2 w-24 leading-tight
                                            ${isCurrent ? 'opacity-100 scale-105' : 'text-gray-400 opacity-60 group-hover:opacity-100'}
                                            line-clamp-2 text-ellipsis overflow-hidden
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
            </div>
        </>
    );
}
