import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default function InterviewLoadingPage() {
    const brandColor = '#f59e0b';

    return (
        <div className="min-h-screen bg-white">
            <div className="fixed inset-0 z-40 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/40 backdrop-blur-[2px]" />
                <div className="relative flex items-center justify-center">
                    <motion.div
                        className="absolute rounded-full"
                        style={{
                            width: 96,
                            height: 96,
                            border: `3px solid ${brandColor}30`,
                        }}
                        animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.6, 0.2, 0.6],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                    <motion.div
                        className="relative flex items-center justify-center rounded-full bg-white shadow-lg"
                        style={{
                            width: 80,
                            height: 80,
                            border: `2px solid ${brandColor}40`,
                        }}
                        animate={{
                            scale: [1, 1.03, 1],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <Icons.Logo size={36} style={{ color: brandColor }} />
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
