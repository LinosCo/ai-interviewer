'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', loading = false, loadingText, disabled, onClick, children, ...props }, ref) => {
        const [isProcessing, setIsProcessing] = useState(false);

        const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
            if (loading || isProcessing || disabled) return;

            const result = onClick?.(e) as unknown;
            if (result instanceof Promise) {
                setIsProcessing(true);
                try {
                    await result;
                } finally {
                    setIsProcessing(false);
                }
            }
        };

        const isLoading = loading || isProcessing;

        // Base styles - improved for better text handling
        const baseStyles = "relative inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed active:scale-[0.98] whitespace-nowrap";

        // Variant styles - improved contrast and loading states
        const variants: Record<string, string> = {
            primary: `bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg focus-visible:ring-violet-500 ${isLoading ? 'bg-violet-500' : ''}`,
            secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400",
            outline: "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-400",
            ghost: "hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400",
            danger: "bg-red-600 text-white hover:bg-red-700 shadow-md focus-visible:ring-red-500",
            white: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm focus-visible:ring-slate-400"
        };

        // Size styles - better padding for text fit
        const sizes: Record<string, string> = {
            sm: "min-h-[36px] px-3.5 py-2 text-sm gap-2",
            md: "min-h-[42px] px-5 py-2.5 text-sm gap-2",
            lg: "min-h-[48px] px-6 py-3 text-base gap-2.5",
            icon: "h-10 w-10 p-0"
        };

        // Disabled styles
        const disabledStyles = (disabled || isLoading) ? "opacity-60" : "";

        const combinedClassName = `${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${disabledStyles} ${className}`;

        return (
            <button
                ref={ref}
                className={combinedClassName}
                disabled={disabled || isLoading}
                onClick={handleClick}
                {...props}
            >
                {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                )}
                {(!isLoading || !loadingText) && (
                    <span className="truncate">{children}</span>
                )}
                {isLoading && loadingText && (
                    <span className="truncate">{loadingText}</span>
                )}
            </button>
        );
    }
);
Button.displayName = "Button";
