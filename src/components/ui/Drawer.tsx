import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    width?: string;
    children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, width = 'max-w-lg', children }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
            {/* Panel */}
            <div className={`relative ${width} w-full bg-card h-full shadow-2xl border-l border-border/60 flex flex-col animate-in slide-in-from-right duration-200`}>
                {title && (
                    <div className="flex-none h-14 px-6 border-b border-border/60 flex items-center justify-between">
                        <h2 className="text-[15px] font-semibold text-primary">{title}</h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

export default Drawer;
