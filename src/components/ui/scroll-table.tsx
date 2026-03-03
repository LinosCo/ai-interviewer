import { type ReactNode } from 'react';

interface ScrollTableProps {
    children: ReactNode;
    className?: string;
}

/**
 * Wraps a <table> with overflow-x-auto so it scrolls horizontally on mobile
 * instead of overflowing the viewport.
 */
export function ScrollTable({ children, className = '' }: ScrollTableProps) {
    return (
        <div
            role="region"
            aria-label="scrollable table"
            className={`w-full overflow-x-auto rounded-lg ${className}`}
        >
            {children}
        </div>
    );
}
