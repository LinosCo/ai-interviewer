'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', loading = false, loadingText, disabled, onClick, children, ...props }, ref) => {
        const [isProcessing, setIsProcessing] = useState(false);

        const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
            if (loading || isProcessing || disabled) return;

            // If onClick returns a promise, handle loading state automatically
            const result = onClick?.(e);
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

        // Base styles
        const baseStyles = "relative inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

        // Variant styles
        const variants = {
            primary: "bg-amber-600 text-white hover:bg-amber-700 shadow-sm",
            secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
            outline: "border border-gray-200 hover:bg-gray-100",
            ghost: "hover:bg-gray-100 text-gray-700",
            danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
            white: "bg-white text-stone-900 border border-white hover:bg-stone-100"
        };

        // Size styles
        const sizes = {
            sm: "h-9 px-3 text-xs gap-1.5",
            md: "h-10 py-2 px-4 gap-2",
            lg: "h-11 px-8 rounded-md gap-2"
        };

        const combinedClassName = `${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${isLoading ? 'cursor-wait' : ''} ${className}`;

        return (
            <button
                ref={ref}
                className={combinedClassName}
                disabled={disabled || isLoading}
                onClick={handleClick}
                {...props}
            >
                {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span className={isLoading && loadingText ? 'hidden' : ''}>
                    {children}
                </span>
                {isLoading && loadingText && (
                    <span>{loadingText}</span>
                )}
            </button>
        );
    }
);
Button.displayName = "Button";
