import React, { useMemo } from 'react';
import { Requisition, RequisitionStatus } from '../../../types/requisition';
import { format } from 'date-fns';
import { Package, FileText, MapPin, User, Calendar } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface RequisitionBoardViewProps {
    requisitions: Requisition[];
    onNavigate: (view: string) => void;
}

const COLUMNS: RequisitionStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PO_CREATED', 'TRANSFER_CREATED', 'FULFILLING', 'FULFILLED', 'CLOSED'];

const STATUS_LABELS: Record<RequisitionStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    SOURCING: 'Sourcing',
    PO_CREATED: 'PO Linked',
    TRANSFER_CREATED: 'TRF Linked',
    FULFILLING: 'Fulfilling',
    FULFILLED: 'Fulfilled',
    CLOSED: 'Closed',
    EXCEPTION_HOLD: 'Hold',
    CANCELLED: 'Cancelled'
};

export const RequisitionBoardView: React.FC<RequisitionBoardViewProps> = ({ requisitions, onNavigate }) => {
    // Group Requisitions by status
    const columns = useMemo(() => {
        const groups: Record<RequisitionStatus, Requisition[]> = {} as any;
        COLUMNS.forEach(c => groups[c] = []);
        requisitions.forEach(req => {
            if (groups[req.status]) {
                groups[req.status].push(req);
            } else if (['REJECTED', 'CANCELLED', 'EXCEPTION_HOLD', 'SOURCING'].includes(req.status)) {
                // If they have outlier statuses, map them to an existing column or ignore
                // For a simple board, let's put Sourcing under Approved, and skip Rejected/Cancelled
                if (req.status === 'SOURCING') groups['APPROVED'].push(req);
            }
        });
        return groups;
    }, [requisitions]);

    return (
        <div className="h-full overflow-x-auto p-6 whitespace-nowrap custom-scrollbar">
            <div className="flex gap-4 h-full">
                {COLUMNS.map(status => (
                    <Column key={status} status={status} items={columns[status] || []} onNavigate={onNavigate} />
                ))}
            </div>
        </div>
    );
};

const Column: React.FC<{ status: RequisitionStatus; items: Requisition[]; onNavigate: (view: string) => void }> = ({ status, items, onNavigate }) => {
    return (
        <div className="w-80 flex-none flex flex-col h-full bg-surface border border-border rounded-xl mx-1 overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{STATUS_LABELS[status]}</span>
                    <span className="bg-surface border border-border text-muted text-[10px] px-1.5 py-0.5 rounded font-mono">{items.length}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {items.map(req => <RequisitionCard key={req.id} req={req} onNavigate={onNavigate} />)}
            </div>
        </div>
    );
};

const RequisitionCard: React.FC<{ req: Requisition; onNavigate: (view: string) => void }> = ({ req, onNavigate }) => {
    const totalLines = req.lines.length;

    return (
        <div
            onClick={() => onNavigate(`scm-requisitions-detail-${req.id}`)}
            className="bg-card border border-border p-3 rounded-lg shadow-sm hover:border-blue-500/30 hover:shadow-md cursor-pointer transition-all group active:scale-95 whitespace-normal"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[12px] font-bold text-blue-500 font-mono group-hover:underline">{req.code}</span>
                <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                    req.priority === 'URGENT' ? "bg-rose-500/10 text-rose-500" :
                        req.priority === 'HIGH' ? "bg-amber-500/10 text-amber-500" :
                            "bg-surface text-muted border border-border"
                )}>{req.priority}</span>
            </div>

            <div className="text-[13px] font-medium text-foreground mb-1 flex items-center gap-1.5">
                <User size={12} className="text-muted" /> {req.requestedBy}
            </div>

            <div className="text-[11px] text-muted mb-3 flex items-center gap-1.5 truncate">
                <MapPin size={12} className="text-muted shrink-0" /> {req.requestedForLocationId}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-muted">
                        {req.type === 'STOCK' ? <Package size={12} /> : <FileText size={12} />}
                        {totalLines} {totalLines === 1 ? 'line' : 'lines'}
                    </div>
                </div>
                {req.neededBy && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-muted">
                        <Calendar size={10} /> {format(new Date(req.neededBy), 'MMM d')}
                    </div>
                )}
            </div>
        </div>
    );
};


