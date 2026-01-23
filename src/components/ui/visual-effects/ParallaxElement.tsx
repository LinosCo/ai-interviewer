'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ParallaxElementProps {
    children: React.ReactNode;
    className?: string;
    offset?: number;
    delay?: number;
}

export const ParallaxElement = ({ children, className = '', offset = 50, delay = 0 }: ParallaxElementProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start end', 'end start'],
    });

    const y = useTransform(scrollYProgress, [0, 1], [-offset, offset]);

    return (
        <motion.div
            ref={ref}
            style={{ y }}
            transition={{ delay }}
            className={className}
        >
            {children}
        </motion.div>
    );
};
