'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Bot } from 'lucide-react';

interface ChatBubbleProps {
    botId: string;
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left';
    welcomeMessage?: string;
    initialIsOpen?: boolean;
    isOpen?: boolean;
    onToggle?: (isOpen: boolean) => void;
}

export default function ChatBubble({
    botId,
    primaryColor = '#7C3AED',
    position = 'bottom-right',
    welcomeMessage,
    initialIsOpen = false,
    isOpen: controlledIsOpen,
    onToggle
}: ChatBubbleProps) {
    const [internalIsOpen, setInternalIsOpen] = useState(initialIsOpen);
    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
    const seenStorageKey = `bt_seen_${botId}`;
    const [hasUnread, setHasUnread] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.localStorage.getItem(seenStorageKey) !== '1';
    });

    const handleToggle = () => {
        const newState = !isOpen;
        if (!isControlled) setInternalIsOpen(newState);
        if (newState) {
            setHasUnread(false);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(seenStorageKey, '1');
            }
        }
        onToggle?.(newState);
    };

    // When the chat window is open, hide the floating toggle to avoid overlap.
    if (isOpen) {
        return null;
    }

    const positionClasses = position === 'bottom-right'
        ? 'bottom-6 right-6'
        : 'bottom-6 left-6';

    return (
        <div className={`fixed ${positionClasses} z-[9000] flex flex-col items-end gap-4`}>
            {/* Chat Window Container would go here - handled by parent or separate component */}

            {/* Welcome Message Tooltip */}
            <AnimatePresence>
                {!isOpen && hasUnread && welcomeMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`absolute bottom-20 ${position === 'bottom-right' ? 'right-0' : 'left-0'} max-w-xs p-4 bg-white rounded-2xl shadow-2xl border border-gray-100 cursor-pointer z-[10001]`}
                        onClick={() => {
                            if (!isControlled) setInternalIsOpen(true);
                            setHasUnread(false);
                            if (typeof window !== 'undefined') {
                                window.localStorage.setItem(seenStorageKey, '1');
                            }
                            onToggle?.(true);
                        }}
                    >
                        <div className="flex gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-700 leading-relaxed font-medium">
                                    {welcomeMessage}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 font-medium">
                                    Clicca per chattare
                                </p>
                            </div>
                        </div>
                        {/* Arrow */}
                        <div className={`absolute -bottom-2 ${position === 'bottom-right' ? 'right-6' : 'left-6'} w-4 h-4 bg-white border-r border-b border-gray-100 transform rotate-45`}></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bubble Button */}
            <motion.button
                layout
                onClick={handleToggle}
                className="relative group w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                style={{ backgroundColor: primaryColor }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <motion.div
                    key="open"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                >
                    <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white/20 stroke-[2.5px]" />
                </motion.div>

                {/* Unread Indicator */}
                {hasUnread && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    </span>
                )}
            </motion.button>
        </div>
    );
}
