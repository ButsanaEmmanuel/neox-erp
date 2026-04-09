import React, { useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface FilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    onApply?: () => void;
    onReset?: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
    isOpen,
    onClose,
    title = 'Filters',
    children,
    onApply,
    onReset
}) => {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="relative w-full max-w-sm bg-app border-l border-border flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Filter size={16} className="text-muted" /> {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {children}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
                    {onReset && (
                        <button
                            onClick={onReset}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-surface border border-border hover:bg-muted transition-colors"
                        >
                            Reset
                        </button>
                    )}
                    {onApply && (
                        <button
                            onClick={() => {
                                onApply();
                                onClose();
                            }}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-primary bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Show Results
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};


