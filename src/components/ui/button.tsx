import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {

        // Base styles
        const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

        // Variant styles
        const variants = {
            primary: "bg-amber-600 text-white hover:bg-amber-700",
            secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
            outline: "border border-gray-200 hover:bg-gray-100",
            ghost: "hover:bg-gray-100 text-gray-700",
            white: "bg-white text-stone-900 border border-white hover:bg-stone-100"
        };

        // Size styles
        const sizes = {
            sm: "h-9 px-3 text-xs",
            md: "h-10 py-2 px-4",
            lg: "h-11 px-8 rounded-md"
        };

        const combinedClassName = `${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;

        return (
            <button
                ref={ref}
                className={combinedClassName}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";
