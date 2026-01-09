'use client';

import { refineTextAction } from '@/app/actions';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export function RefinableField({
    label,
    name,
    value,
    onChange, // If using state. If utilizing form defaultValue, this might be tricky in pure server forms, but we are in client component editors.
    context,
    multiline = false,
    className = "",
    placeholder = "",
    rows = 2
}: {
    label: string,
    name: string,
    value: string,
    onChange?: (val: string) => void,
    context: string,
    multiline?: boolean,
    className?: string,
    placeholder?: string,
    rows?: number
}) {
    const [isRefining, setIsRefining] = useState(false);
    // If no onChange is provided, we assume we want to update the input's value directly? 
    // Or we stick to controlled components for editors. 
    // TopicsEditor uses uncontrolled form submission (defaultValue).
    // So we need to switch TopicsEditor to controlled or use a ref/state for this field.
    // Let's make this component capable of strictly controlling an internal state if onChange is not passed,
    // but that doesn't help the parent form unless we sync back.
    // For TopicsEditor, it is easier if we make the form controlled or use this component to render the input.

    // Actually, for TopicsEditor, I will refactor the `TopicCard` form to be slightly controlled or just handle the update.

    const [internalValue, setInternalValue] = useState(value);

    const handleRefine = async (e: any) => {
        e.preventDefault();
        const textToRefine = onChange ? value : internalValue;
        if (!textToRefine) return;

        setIsRefining(true);
        try {
            const refined = await refineTextAction(textToRefine, label, context);
            if (onChange) {
                onChange(refined);
            } else {
                setInternalValue(refined);
            }
        } catch (error: any) {
            alert("Refine failed: " + error.message);
        } finally {
            setIsRefining(false);
        }
    };

    const displayValue = onChange ? value : internalValue;

    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase text-gray-500">{label}</label>
                <button
                    onClick={handleRefine}
                    disabled={isRefining || !displayValue}
                    className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                    type="button"
                >
                    {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Refine
                </button>
            </div>
            {multiline ? (
                <textarea
                    name={name}
                    value={displayValue}
                    onChange={(e) => {
                        setInternalValue(e.target.value);
                        onChange?.(e.target.value);
                    }}
                    placeholder={placeholder}
                    rows={rows}
                    className="w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            ) : (
                <input
                    name={name}
                    value={displayValue}
                    onChange={(e) => {
                        setInternalValue(e.target.value);
                        onChange?.(e.target.value);
                    }}
                    placeholder={placeholder}
                    className="w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            )}
        </div>
    );
}
