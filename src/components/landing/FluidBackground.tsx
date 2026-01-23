'use client';

import { motion } from 'framer-motion';

export function FluidBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base mesh gradient */}
      <div className="absolute inset-0 gradient-mesh" />

      {/* Animated floating blobs - exact Lovable parameters */}
      <motion.div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-coral/30 to-orange-400/20 blur-[120px]"
        animate={{
          x: [0, 30, -20, 40, 0],
          y: [0, -50, 20, 30, 0],
          scale: [1, 1.05, 0.95, 1.02, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute -top-20 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-amber/25 to-purple-400/15 blur-[100px]"
        animate={{
          x: [0, -30, 20, -40, 0],
          y: [0, 30, -20, 50, 0],
          scale: [1, 0.95, 1.05, 0.98, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />

      <motion.div
        className="absolute top-1/3 left-1/3 w-[700px] h-[700px] rounded-full bg-gradient-to-r from-blue-400/15 to-cyan-400/10 blur-[150px]"
        animate={{
          x: [0, 50, -30, 20, 0],
          y: [0, -30, 40, -20, 0],
          scale: [1, 1.02, 0.98, 1.05, 1],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
      />

      <motion.div
        className="absolute bottom-20 right-20 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-coral/25 to-amber/20 blur-[120px]"
        animate={{
          x: [0, -40, 30, -20, 0],
          y: [0, 40, -30, 20, 0],
          scale: [1, 0.98, 1.03, 0.97, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 6,
        }}
      />

      <motion.div
        className="absolute top-2/3 left-10 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-purple-400/10 to-pink-400/10 blur-[100px]"
        animate={{
          x: [0, 30, -40, 20, 0],
          y: [0, -40, 30, -20, 0],
          scale: [1, 1.04, 0.96, 1.02, 1],
        }}
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 8,
        }}
      />
    </div>
  );
}
