import React from 'react';
import { colors, radius, shadows, gradients } from '@/lib/design-system';

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
    style,
    disabled,
    ...props
}: ButtonProps) => {
    const baseStyles: React.CSSProperties = {
        display: fullWidth ? 'flex' : 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.625rem',
        borderRadius: radius.full,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        border: 'none',
        position: 'relative',
        overflow: 'hidden',
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'inherit',
        ...style,
    };

    const sizeStyles = {
        sm: { padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 500 },
        md: { padding: '0.75rem 1.25rem', fontSize: '0.9375rem', fontWeight: 600 },
        lg: { padding: '0.875rem 1.75rem', fontSize: '1.0625rem', fontWeight: 600 },
    };

    const variantStyles = {
        primary: {
            background: gradients.primary,
            color: 'white',
            boxShadow: shadows.amber,
        },
        secondary: {
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(10px)',
            color: colors.muted,
            border: '1px solid rgba(0,0,0,0.08)',
        },
        ghost: {
            background: 'transparent',
            color: colors.amber, // Using amber for ghost text
        },
        outline: {
            background: 'transparent',
            color: colors.text,
            border: `1.5px solid ${colors.light}80`,
        },
        link: {
            background: 'transparent',
            color: colors.amber,
            padding: 0,
            boxShadow: 'none',
            justifyContent: 'flex-start',
        },
    };

    return (
        <button
            style={{
                ...baseStyles,
                ...sizeStyles[size],
                ...variantStyles[variant],
            }}
            className={className}
            disabled={disabled}
            {...props}
        >
            {children}
            {withShimmer && !disabled && variant === 'primary' && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        animation: 'shimmer 2s infinite',
                    }}
                />
            )}
            <style>{`
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
        </button>
    );
};
