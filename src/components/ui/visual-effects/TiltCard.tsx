'use client';

import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    rotationFactor?: number;
    isStatic?: boolean; // Option to disable tilt for mobile or specific cases if needed
}

export const TiltCard = ({ children, className = '', rotationFactor = 5, isStatic = false }: TiltCardProps) => {
    const ref = useRef<HTMLDivElement>(null);

    // Mouse position state
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smoothed mouse values
    const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseY = useSpring(y, { stiffness: 300, damping: 30 });

    function onMouseMove({ clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
        if (!ref.current || isStatic) return;

        const rect = ref.current.getBoundingClientRect();

        // Calculate mouse position relative to card center (-0.5 to 0.5)
        const xPct = (clientX - rect.left) / rect.width - 0.5;
        const yPct = (clientY - rect.top) / rect.height - 0.5;

        x.set(xPct);
        y.set(yPct);
    }

    function onMouseLeave() {
        x.set(0);
        y.set(0);
    }

    // Maps mouse position to rotation degrees
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [rotationFactor, -rotationFactor]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-rotationFactor, rotationFactor]);

    // Glare effect opacity and position
    const glareOpacity = useTransform(mouseY, [-0.5, 0.5], [0, 0.4]);
    const glareX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']);
    const glareY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']);

    return (
        <motion.div
            ref={ref}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{
                transformStyle: 'preserve-3d',
                rotateX: isStatic ? 0 : rotateX,
                rotateY: isStatic ? 0 : rotateY,
            }}
            className={`relative transition-all duration-500 ease-out will-change-transform ${className}`}
        >
            <div
                style={{
                    transform: 'translateZ(10px)', // Subtle lift
                    transformStyle: 'preserve-3d',
                }}
                className="relative h-full"
            >
                {children}
            </div>

            {/* Glare / Gloss Effect Layer */}
            <motion.div
                className="absolute inset-0 z-50 pointer-events-none rounded-[inherit] overflow-hidden"
                style={{
                    opacity: glareOpacity,
                    background: `radial-gradient(circle at ${50 + x.get() * 100}% ${50 + y.get() * 100}%, rgba(255,255,255,0.1), transparent 60%)`,
                }}
            />
        </motion.div>
    );
};
