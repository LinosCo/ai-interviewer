'use client';

import { Template } from '@/lib/templates';
import { ArrowRight } from 'lucide-react';

interface TemplateCardProps {
    template: Template;
    onClick?: () => void;
    showDetails?: boolean;
}

export default function TemplateCard({ template, onClick, showDetails = false }: TemplateCardProps) {
    return (
        <button
            onClick={onClick}
            className="group w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl p-5 text-left transition-all"
        >
            <div className="flex items-start gap-4">
                <span className="text-3xl flex-shrink-0">{template.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                            {template.name}
                        </h3>
                        <span className="px-2 py-1 text-xs bg-white/10 rounded text-slate-400 capitalize flex-shrink-0">
                            {template.category}
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                        {template.description}
                    </p>

                    {showDetails && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-4 text-xs text-slate-500">
                            <span>{template.defaultConfig.topics.length} topic</span>
                            <span>~{template.defaultConfig.maxDurationMins} min</span>
                            <span className="capitalize">{template.defaultConfig.tone}</span>
                        </div>
                    )}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0 mt-1" />
            </div>
        </button>
    );
}
