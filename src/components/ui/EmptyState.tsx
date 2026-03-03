import { type ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateAction {
    label: string;
    href?: string;
    onClick?: () => void;
}

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: string;
    action?: EmptyStateAction;
    className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
            <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-400">
                {icon}
            </div>
            <h3 className="mb-2 text-base font-semibold text-gray-700">{title}</h3>
            <p className="mb-6 max-w-xs text-sm text-gray-500">{description}</p>
            {action && (
                action.href ? (
                    <Link
                        href={action.href}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
                    >
                        {action.label}
                    </Link>
                ) : (
                    <button
                        onClick={action.onClick}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
                    >
                        {action.label}
                    </button>
                )
            )}
        </div>
    );
}
