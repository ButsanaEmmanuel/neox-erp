import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative ${SIZE_MAP[size]} w-full bg-card rounded-xl shadow-2xl border border-border/60 flex flex-col max-h-[85vh]`}>
                {/* Header */}
                <div className="flex-none px-6 py-4 border-b border-border/60 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-primary">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>
                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
                {/* Footer */}
                {footer && (
                    <div className="flex-none px-6 py-4 border-t border-border/60 bg-surface flex items-center justify-end gap-3 rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
