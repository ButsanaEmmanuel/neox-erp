import React, { useState, useMemo, useEffect } from 'react';
import {
    ClipboardList, Plus, LayoutGrid, List as ListIcon, Search,
    FileText, ArrowRight, User, MapPin, Calendar, Package
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { format, isPast } from 'date-fns';
import { useRequisitionsStore } from '../../store/scm/useRequisitionsStore';
import { useScmStore } from '../../store/scm/useScmStore';
import { RequisitionStatus, RequisitionType } from '../../types/requisition';
import { RequisitionFormModal } from './requests/RequisitionFormModal';
import { RequisitionBoardView } from './requests/RequisitionBoardView';

interface RequisitionsPageProps {
    onNavigate: (view: string) => void;
}

const STATUS_CONFIG: Record<RequisitionStatus, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'slate' },
    SUBMITTED: { label: 'Submitted', color: 'blue' },
    APPROVED: { label: 'Approved', color: 'emerald' },
    REJECTED: { label: 'Rejected', color: 'rose' },
    SOURCING: { label: 'Sourcing', color: 'amber' },
    PO_CREATED: { label: 'PO Created', color: 'indigo' },
    TRANSFER_CREATED: { label: 'Transfer Created', color: 'violet' },
    FULFILLING: { label: 'Fulfilling', color: 'cyan' },
    FULFILLED: { label: 'Fulfilled', color: 'teal' },
    CLOSED: { label: 'Closed', color: 'slate' },
    EXCEPTION_HOLD: { label: 'On Hold', color: 'rose' },
    CANCELLED: { label: 'Cancelled', color: 'slate' }
};

const RequisitionsPage: React.FC<RequisitionsPageProps> = ({ onNavigate }) => {
    const { requisitions, fetchRequisitions } = useRequisitionsStore();
    const { locations } = useScmStore();
    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status')?.toUpperCase() as RequisitionStatus;

    const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'ALL'>(initialStatus || 'ALL');
    const [typeFilter, setTypeFilter] = useState<RequisitionType | 'ALL'>('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Sync filters to URL
    useEffect(() => {
        const url = new URL(window.location.href);
        if (statusFilter !== 'ALL') {
            url.searchParams.set('status', statusFilter.toLowerCase());
        } else {
            url.searchParams.delete('status');
        }
        window.history.pushState({}, '', url);
    }, [statusFilter]);

    useEffect(() => {
        fetchRequisitions();
    }, [fetchRequisitions]);

    const filteredReqs = useMemo(() => {
        let filtered = [...requisitions];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.code.toLowerCase().includes(query) ||
                r.requestedBy.toLowerCase().includes(query) ||
                r.requestedForLocationId.toLowerCase().includes(query) ||
                r.lines.some(l =>
                    l.sku?.toLowerCase().includes(query) ||
                    l.description?.toLowerCase().includes(query)
                )
            );
        }

        if (statusFilter !== 'ALL') filtered = filtered.filter(r => r.status === statusFilter);
        if (typeFilter !== 'ALL') filtered = filtered.filter(r => r.type === typeFilter);

        // Sort: newest first
        filtered.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

        return filtered;
    }, [requisitions, searchQuery, statusFilter, typeFilter]);

    return (
        <div className="flex flex-col h-full bg-app">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between flex-none bg-app z-10">
                <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight">Internal Requisitions</h1>
                    <p className="text-sm text-muted mt-1">Manage internal requests for stock and services.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsFormOpen(true)}
                        className="px-4 h-9 rounded-lg font-bold text-[13px] bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 transition-all flex items-center gap-2">
                        <Plus size={16} /> Create Request
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-border bg-surface/50 flex flex-wrap items-center gap-4 flex-none">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by code, requester, location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-muted/70"
                    />
                </div>

                <div className="w-px h-6 bg-border mx-2" />

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-card border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 outline-none min-w-[140px] appearance-none cursor-pointer">
                    <option value="ALL">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>

                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="bg-card border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 outline-none min-w-[140px] appearance-none cursor-pointer">
                    <option value="ALL">All Types</option>
                    <option value="STOCK">Stock</option>
                    <option value="SERVICE">Service</option>
                </select>

                <div className="flex-1" />

                <div className="bg-card border border-border rounded-lg p-1 flex">
                    <button onClick={() => setViewMode('table')} className={cn("p-1.5 rounded-md transition-all", viewMode === 'table' ? "bg-surface shadow-sm text-foreground" : "text-muted hover:text-foreground")}><ListIcon size={14} /></button>
                    <button onClick={() => setViewMode('kanban')} className={cn("p-1.5 rounded-md transition-all", viewMode === 'kanban' ? "bg-surface shadow-sm text-foreground" : "text-muted hover:text-foreground")}><LayoutGrid size={14} /></button>
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {requisitions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                            <ClipboardList size={32} className="text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">No Requisitions Found</h3>
                        <p className="text-[14px] text-muted max-w-md mx-auto leading-relaxed mb-6">Create your first internal request for stock or services.</p>
                        <button onClick={() => setIsFormOpen(true)}
                            className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[13px] shadow-lg active:scale-95 transition-all">
                            Create Request
                        </button>
                    </div>
                ) : filteredReqs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted">
                        <Search size={32} className="mb-4 opacity-50" />
                        <p>No requisitions match your search criteria.</p>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-surface/95 backdrop-blur z-10 border-b border-border">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Code / Type</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Requester</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Dates</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Links</th>
                                    <th className="px-6 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredReqs.map(req => {
                                    const config = STATUS_CONFIG[req.status];
                                    const overdue = req.neededBy && !['FULFILLED', 'CLOSED', 'CANCELLED'].includes(req.status) && isPast(new Date(req.neededBy));

                                    return (
                                        <tr key={req.id}
                                            onClick={() => onNavigate(`scm-requisitions-detail-${req.id}`)}
                                            className="group hover:bg-surface/50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">{req.code}</span>
                                                    <span className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                                                        {req.type === 'STOCK' ? <Package size={12} /> : <FileText size={12} />}
                                                        {req.type}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center">
                                                        <User size={12} className="text-muted" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-medium text-foreground">{req.requestedBy}</span>
                                                        {req.department && <span className="text-[11px] text-muted">{req.department}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                                                    <MapPin size={14} className="text-muted" />
                                                    {locations.find(l => l.id === req.requestedForLocationId)?.name || req.requestedForLocationId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col text-[12px]">
                                                    <span className="text-muted flex items-center gap-1">Requested: {format(new Date(req.requestedAt), 'MMM d, yyyy')}</span>
                                                    {req.neededBy && (
                                                        <span className={cn("flex items-center gap-1 font-medium mt-0.5", overdue ? "text-rose-500" : "text-foreground")}>
                                                            <Calendar size={12} /> Needed: {format(new Date(req.neededBy), 'MMM d, yyyy')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                                    config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
                                                    config.color === 'blue' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                                    config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                                    config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                                                    config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                                    config.color === 'indigo' && "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
                                                    config.color === 'violet' && "bg-violet-500/10 text-violet-500 border-violet-500/20",
                                                    config.color === 'cyan' && "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
                                                    config.color === 'teal' && "bg-teal-500/10 text-teal-500 border-teal-500/20",
                                                )}>
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {req.linkedPOId && <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-indigo-500/20 text-indigo-500 font-bold">PO</span>}
                                                    {req.linkedTransferId && <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-violet-500/20 text-violet-500 font-bold">TRF</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <ArrowRight size={16} className="text-muted group-hover:text-blue-500 transition-colors inline-block" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto bg-app custom-scrollbar h-full">
                        <RequisitionBoardView requisitions={filteredReqs} onNavigate={onNavigate} />
                    </div>
                )}
            </div>

            <RequisitionFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
            />
        </div>
    );
};

export default RequisitionsPage;


