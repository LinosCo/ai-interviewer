import React from 'react';
import { colors, radius, shadows } from '@/lib/design-system';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'glass' | 'glass-colored' | 'solid-featured';
    padding?: string;
}

export const Card = ({
    children,
    variant = 'glass',
    padding = '2rem',
    style,
    className,
    ...props
}: CardProps) => {
    const baseStyles: React.CSSProperties = {
        padding,
        borderRadius: radius.xl,
        transition: 'all 0.3s ease',
        ...style,
    };

    const variantStyles = {
        glass: {
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.06)',
        },
        'glass-colored': { // For use on dark/colored backgrounds
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: radius['2xl'],
        },
        'solid-featured': {
            background: colors.white,
            borderRadius: radius['2xl'],
            boxShadow: shadows.lg,
            // Often used with transform: scale(1.05) externally
        },
    };

    return (
        <div
            style={{
                ...baseStyles,
                ...variantStyles[variant],
            }}
            className={className}
            {...props}
            id={props.id}
        >
            {children}
        </div>
    );
};

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
}

export const CardHeader = ({ title, subtitle, style, ...props }: CardHeaderProps) => (
    <div style={{ marginBottom: '1.5rem', ...style }} {...props}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: colors.text, marginBottom: '0.5rem' }}>
            {title}
        </h3>
        {subtitle && (
            <p style={{ fontSize: '0.875rem', color: colors.muted, margin: 0 }}>
                {subtitle}
            </p>
        )}
    </div>
);
