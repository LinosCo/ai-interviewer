"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void | Promise<void>;
    loading?: boolean;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Conferma",
    cancelLabel = "Annulla",
    variant = "default",
    onConfirm,
    loading = false,
}: ConfirmDialogProps) {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onOpenChange(false);
        } finally {
            setIsLoading(false);
        }
    };

    const buttonClass = variant === "destructive"
        ? "bg-red-600 hover:bg-red-700 text-white"
        : "bg-indigo-600 hover:bg-indigo-700 text-white";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading || loading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading || loading}
                        className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 ${buttonClass}`}
                    >
                        {isLoading || loading ? "..." : confirmLabel}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Hook per gestire lo stato del dialog di conferma
interface UseConfirmDialogReturn {
    isOpen: boolean;
    open: (options: ConfirmOptions) => Promise<boolean>;
    close: () => void;
    dialogProps: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        title: string;
        description: string;
        confirmLabel: string;
        cancelLabel: string;
        variant: "default" | "destructive";
        onConfirm: () => void;
    };
}

interface ConfirmOptions {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
}

export function useConfirmDialog(): UseConfirmDialogReturn {
    const [isOpen, setIsOpen] = React.useState(false);
    const [options, setOptions] = React.useState<ConfirmOptions>({
        title: "",
        description: "",
    });
    const resolveRef = React.useRef<((value: boolean) => void) | undefined>(undefined);

    const open = React.useCallback((opts: ConfirmOptions): Promise<boolean> => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const close = React.useCallback(() => {
        setIsOpen(false);
        resolveRef.current?.(false);
    }, []);

    const handleConfirm = React.useCallback(() => {
        resolveRef.current?.(true);
        setIsOpen(false);
    }, []);

    const handleOpenChange = React.useCallback((open: boolean) => {
        if (!open) {
            resolveRef.current?.(false);
        }
        setIsOpen(open);
    }, []);

    return {
        isOpen,
        open,
        close,
        dialogProps: {
            open: isOpen,
            onOpenChange: handleOpenChange,
            title: options.title,
            description: options.description,
            confirmLabel: options.confirmLabel || "Conferma",
            cancelLabel: options.cancelLabel || "Annulla",
            variant: options.variant || "default",
            onConfirm: handleConfirm,
        },
    };
}
