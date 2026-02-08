"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface SwitchProps {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    className?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ checked = false, onCheckedChange, disabled = false, className = "" }, ref) => {
        const toggle = () => {
            if (!disabled && onCheckedChange) {
                onCheckedChange(!checked)
            }
        }

        return (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={toggle}
                className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full 
          transition-colors duration-200 ease-in-out focus-visible:outline-none 
          focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-amber-600' : 'bg-gray-200'}
          ${className}
        `}
            >
                <motion.span
                    animate={{ x: checked ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`
            pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 
            transition-transform duration-200 ease-in-out
          `}
                />
            </button>
        )
    }
)

Switch.displayName = "Switch"

export { Switch }
