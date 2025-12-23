'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { showToast } from '@/components/toast';
import { refineTextAction } from '@/app/actions';

interface RefineInputProps {
    name: string;
    label: string;
    defaultValue: string;
    placeholder?: string;
    fieldType: 'intro' | 'goal' | 'target' | 'tone' | 'topic';
    context?: any;
    rows?: number;
}

export default function RefineInput({ name, label, defaultValue, placeholder, fieldType, context, rows = 3 }: RefineInputProps) {
    const [value, setValue] = useState(defaultValue);
    const [isRefining, setIsRefining] = useState(false);

    const handleRefine = async () => {
        if (!value) {
            showToast('Please enter some text to refine first', 'error');
            return;
        }

        setIsRefining(true);
        try {
            const refined = await refineTextAction(value, label, context || '');
            setValue(refined);
            showToast('Text refined successfully!', 'success');
        } catch (error: any) {
            console.error(error);
            showToast('Failed to refine text: ' + error.message, 'error');
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium">{label}</label>
                <button
                    type="button"
                    onClick={handleRefine}
                    disabled={isRefining}
                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                    {isRefining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {isRefining ? 'Refining...' : 'Refine with AI'}
                </button>
            </div>
            <textarea
                name={name}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={rows}
                className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={placeholder}
            />
        </div>
    );
}
