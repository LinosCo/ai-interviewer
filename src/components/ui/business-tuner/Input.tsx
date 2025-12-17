import React from 'react';
import { colors, radius } from '@/lib/design-system';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = ({ label, error, icon, style, ...props }: InputProps) => {
    return (
        <div style={{ marginBottom: '1.5rem', width: '100%' }}>
            {label && (
                <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: colors.text,
                    marginBottom: '0.5rem'
                }}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative' }}>
                {icon && (
                    <div style={{
                        position: 'absolute',
                        left: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: colors.muted
                    }}>
                        {icon}
                    </div>
                )}
                <input
                    style={{
                        width: '100%',
                        padding: icon ? '0.875rem 1rem 0.875rem 2.75rem' : '0.875rem 1rem',
                        background: 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(10px)',
                        border: error ? `1px solid ${colors.error}` : '1px solid rgba(0,0,0,0.08)',
                        borderRadius: radius.md,
                        fontSize: '1rem',
                        color: colors.text,
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        ...style
                    }}
                    className="focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    {...props}
                />
            </div>
            {error && (
                <p style={{ fontSize: '0.8125rem', color: colors.error, marginTop: '0.5rem' }}>
                    {error}
                </p>
            )}
        </div>
    );
};
