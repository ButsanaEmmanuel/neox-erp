import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => { } });

export const useToast = () => useContext(ToastContext);

const ICON_MAP = { success: CheckCircle, error: XCircle, info: Info };
const COLOR_MAP = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

const ToastItem: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    const Icon = ICON_MAP[toast.type];
    useEffect(() => {
        const t = setTimeout(() => onDismiss(toast.id), 4000);
        return () => clearTimeout(t);
    }, [toast.id, onDismiss]);

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${COLOR_MAP[toast.type]} backdrop-blur-md animate-in slide-in-from-right duration-300`}>
            <Icon size={16} className="flex-none" />
            <span className="text-[13px] font-medium text-white flex-1">{toast.message}</span>
            <button onClick={() => onDismiss(toast.id)} className="flex-none text-slate-500 hover:text-white">
                <X size={14} />
            </button>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
