'use client';

import { useState, useEffect } from 'react';

type Toast = {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
};

let toastId = 0;
const toasts: Toast[] = [];
const listeners: ((toasts: Toast[]) => void)[] = [];

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    const toast: Toast = { id: toastId++, message, type };
    toasts.push(toast);
    listeners.forEach(listener => listener([...toasts]));

    setTimeout(() => {
        const index = toasts.findIndex(t => t.id === toast.id);
        if (index > -1) {
            toasts.splice(index, 1);
            listeners.forEach(listener => listener([...toasts]));
        }
    }, 3000);
}

export function ToastContainer() {
    const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

    useEffect(() => {
        listeners.push(setCurrentToasts);
        return () => {
            const index = listeners.indexOf(setCurrentToasts);
            if (index > -1) listeners.splice(index, 1);
        };
    }, []);

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {currentToasts.map(toast => (
                <div
                    key={toast.id}
                    className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${toast.type === 'success' ? 'bg-green-600' :
                            toast.type === 'error' ? 'bg-red-600' :
                                'bg-blue-600'
                        }`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
