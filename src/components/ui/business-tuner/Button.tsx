import React from 'react';
import { Button as CoreButton } from '@/components/ui/button';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'link';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    withShimmer?: boolean;
}

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    withShimmer = false,
    className,
    disabled,
    ...props
}: ButtonProps) => {
    const mappedSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
    const mappedVariant = variant === 'link' ? 'ghost' : variant;
    const shimmerClass = withShimmer && variant === 'primary'
        ? "relative overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent after:animate-[shimmer_2s_infinite]"
        : "";

    return (
        <CoreButton
            variant={mappedVariant as any}
            size={mappedSize as any}
            className={`${fullWidth ? 'w-full' : ''} rounded-full ${shimmerClass} ${className || ''}`}
            disabled={disabled}
            {...props}
        >
            {children}
            {withShimmer && variant === 'primary' && (
                <style>{`
                    @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                `}</style>
            )}
        </CoreButton>
    );
};
