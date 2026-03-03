'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white' | 'link';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    loadingText?: string;
    /** Expands the button to full container width */
    fullWidth?: boolean;
    /** Adds an animated shimmer sweep over primary variant buttons */
    withShimmer?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className = '',
            variant = 'primary',
            size = 'md',
            loading = false,
            loadingText,
            disabled,
            onClick,
            fullWidth = false,
            withShimmer = false,
            children,
            ...props
        },
        ref
    ) => {
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
        const showLoadingIndicator = loading;

        // Base styles
        const baseStyles =
            'relative inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed active:scale-[0.98] whitespace-nowrap';

        // Variant styles
        const variants: Record<string, string> = {
            primary: `bg-gradient-to-br from-orange-500 via-amber-500 to-amber-400 text-white hover:from-orange-600 hover:via-amber-600 hover:to-amber-500 shadow-[0_8px_30px_rgba(245,158,11,0.35)] focus-visible:ring-amber-500 ${isLoading ? 'opacity-90' : ''}`,
            secondary: 'bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-300',
            outline: 'border-2 border-amber-200 text-amber-900 hover:bg-amber-50 hover:border-amber-300 focus-visible:ring-amber-300',
            ghost: 'hover:bg-amber-50 text-amber-900 focus-visible:ring-amber-300',
            danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md focus-visible:ring-red-500',
            white: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm focus-visible:ring-slate-400',
            // link maps to ghost behaviour — use underline for text-link style
            link: 'text-amber-700 underline-offset-4 hover:underline focus-visible:ring-amber-300',
        };

        // Size styles
        const sizes: Record<string, string> = {
            sm: 'min-h-[36px] px-3.5 py-2 text-sm gap-2',
            md: 'min-h-[42px] px-5 py-2.5 text-sm gap-2',
            lg: 'min-h-[48px] px-6 py-3 text-base gap-2.5',
            icon: 'h-10 w-10 p-0',
        };

        const disabledStyles = disabled || isLoading ? 'opacity-60' : '';
        const widthStyle = fullWidth ? 'w-full' : '';
        const shimmerClass =
            withShimmer && variant === 'primary'
                ? 'overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent after:animate-[shimmer_2s_infinite]'
                : '';

        const combinedClassName = [
            baseStyles,
            variants[variant] ?? variants.primary,
            sizes[size] ?? sizes.md,
            disabledStyles,
            widthStyle,
            shimmerClass,
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <>
                {withShimmer && variant === 'primary' && (
                    <style>{`
                        @keyframes shimmer {
                            0% { transform: translateX(-100%); }
                            100% { transform: translateX(100%); }
                        }
                    `}</style>
                )}
                <button
                    ref={ref}
                    className={combinedClassName}
                    disabled={disabled || isLoading}
                    onClick={handleClick}
                    {...props}
                >
                    {showLoadingIndicator && (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    )}
                    {(!showLoadingIndicator || !loadingText) && (
                        <span className="truncate">{children}</span>
                    )}
                    {showLoadingIndicator && loadingText && (
                        <span className="truncate">{loadingText}</span>
                    )}
                </button>
            </>
        );
    }
);
Button.displayName = 'Button';
