import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen, onClose, onConfirm, title, description,
    confirmLabel = 'Confirm', destructive = true,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative max-w-sm w-full bg-[#161b22] rounded-xl shadow-2xl border border-white/[0.06] p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-none ${destructive ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        <AlertTriangle size={20} className={destructive ? 'text-red-400' : 'text-amber-400'} />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-semibold text-white mb-1">{title}</h3>
                        <p className="text-[13px] text-slate-400 leading-relaxed">{description}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[13px] font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${destructive
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
