'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface FloatingElementProps {
    children: React.ReactNode;
    className?: string;
    duration?: number;
    yOffset?: number;
    delay?: number;
}

export const FloatingElement = ({
    children,
    className = '',
    duration = 6,
    yOffset = 20,
    delay = 0,
}: FloatingElementProps) => {
    return (
        <motion.div
            animate={{ y: [0, -yOffset, 0] }}
            transition={{
                repeat: Infinity,
                duration: duration,
                ease: 'easeInOut',
                delay: delay,
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};
