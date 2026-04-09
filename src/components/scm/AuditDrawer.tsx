import React from 'react';
import { X, History, ArrowRightLeft, RotateCcw, User, Clock, ArrowUpRight, ArrowDownRight, MapPin } from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AuditDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    filterProductId?: string;
}

const AuditDrawer: React.FC<AuditDrawerProps> = ({ isOpen, onClose, filterProductId }) => {
    const { auditLog, products, locations } = useScmStore();

    const filteredLog = filterProductId
        ? auditLog.filter(log => log.productId === filterProductId)
        : auditLog;

    if (!isOpen) return null;

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Unknown Product';
    const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'Unknown Location';

    const renderEventIcon = (type: string) => {
        switch (type) {
            case 'transfer': return <ArrowRightLeft size={14} className="text-blue-500" />;
            case 'reconcile': return <RotateCcw size={14} className="text-amber-500" />;
            default: return <History size={14} className="text-muted" />;
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface border-l border-border z-[70] shadow-2xl animate-in slide-in-from-right duration-500">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-border flex items-center justify-between bg-card/30">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-secondary">
                                <History size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-primary leading-tight">Inventory Audit Log</h3>
                                <p className="text-[11px] text-muted font-bold uppercase tracking-widest mt-0.5">Recent stock movements</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {filteredLog.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted opacity-50">
                                <History size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No audit events found</p>
                            </div>
                        ) : (
                            filteredLog.map((event) => (
                                <div key={event.id} className="relative pl-6 border-l border-border/50 group pb-6 last:pb-0">
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full bg-border group-hover:bg-blue-500 transition-colors border-2 border-surface" />

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-bold text-secondary uppercase">
                                                {renderEventIcon(event.type)}
                                                {event.type}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase">
                                                <Clock size={10} />
                                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold text-primary">{getProductName(event.productId)}</h4>
                                            <p className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                                                <MapPin size={10} /> {getLocationName(event.locationId)}
                                            </p>
                                        </div>

                                        <div className="bg-surface border border-border/50 rounded-lg p-3 text-[12px]">
                                            {event.type === 'transfer' && (
                                                <div className="flex items-center gap-2 text-secondary">
                                                    <span className="font-bold text-primary">{event.meta.qty} units</span>
                                                    moved to
                                                    <span className="text-blue-400 font-semibold">{getLocationName(event.meta.toLocationId || '')}</span>
                                                </div>
                                            )}
                                            {event.type === 'reconcile' && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted">Corrected to</span>
                                                        <span className="font-bold text-primary">{event.meta.newQty}</span>
                                                        {event.meta.delta !== undefined && (
                                                            <span className={cn(
                                                                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                event.meta.delta > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                                            )}>
                                                                {event.meta.delta > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                                                {Math.abs(event.meta.delta)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-muted italic">"{event.meta.reason}"</div>
                                                </div>
                                            )}
                                            {event.meta.note && (
                                                <div className="mt-2 text-secondary border-t border-border/30 pt-2 text-[11px]">
                                                    Note: {event.meta.note}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-[10px] text-muted font-bold uppercase bg-white/5 w-fit px-2 py-1 rounded">
                                            <User size={10} /> {event.actor}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-border bg-card/30">
                        <button
                            onClick={onClose}
                            className="w-full px-4 h-11 rounded-xl bg-slate-500/10 border border-slate-500/20 text-secondary font-bold text-[13px] hover:bg-surface transition-all"
                        >
                            Close History
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuditDrawer;


