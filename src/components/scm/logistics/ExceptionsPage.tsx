import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Plus, LayoutGrid, List, AlertTriangle, Filter,
    MessageSquare, Clock, CheckCircle2, ChevronRight, PackageX
} from 'lucide-react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { ExceptionStatus, ExceptionType } from '../../../types/logistics';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import { getLinkedEntityCode, isBlocking } from '../../../services/exceptionOrchestrator';
import ExceptionFormModal from './ExceptionFormModal';

const STATUS_CONFIG: Record<ExceptionStatus, { label: string, color: string, icon: any }> = {
    'OPEN': { label: 'Open', color: 'rose', icon: AlertTriangle },
    'UNDER_REVIEW': { label: 'Under Review', color: 'amber', icon: Clock },
    'RESOLVED': { label: 'Resolved', color: 'emerald', icon: CheckCircle2 },
    'CLOSED': { label: 'Closed', color: 'slate', icon: CheckCircle2 }
};

const TYPE_CONFIG: Record<ExceptionType, string> = {
    'DAMAGE': 'Damage',
    'SHORTAGE': 'Shortage',
    'DELAY': 'Delay',
    'LOST': 'Lost',
    'OVER_RECEIPT': 'Over Receipt',
    'CUSTOMS_HOLD': 'Customs Hold',
    'DOCS_MISSING': 'Docs Missing',
    'QUALITY_FAIL': 'Quality Fail',
    'POD_MISSING': 'POD Missing',
    'REFUSED_DELIVERY': 'Refused',
    'WRONG_ITEM': 'Wrong Item',
    'SERIAL_LOT_MISSING': 'Serial/Lot',
    'OTHER': 'Other'
};

const SEVERITY_COLORS = {
    'LOW': 'text-muted bg-slate-500/10 border-slate-500/20',
    'MEDIUM': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    'HIGH': 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    'CRITICAL': 'text-red-600 bg-red-600/10 border-red-600/20 font-bold'
};

interface ExceptionsPageProps {
    onNavigate?: (view: string) => void;
}

const ExceptionsPage: React.FC<ExceptionsPageProps> = ({ onNavigate }) => {
    const { exceptions, fetchExceptions } = useLogisticsStore();
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status')?.toUpperCase() as ExceptionStatus;

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ExceptionStatus | 'ALL'>(initialStatus || 'ALL');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => { fetchExceptions(); }, [fetchExceptions]);

    const filteredExceptions = useMemo(() => {
        return exceptions.filter(e => {
            const matchesSearch = !searchQuery || (
                (e.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.assignedTo || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
            const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [exceptions, searchQuery, statusFilter]);

    return (
        <div className="flex flex-col h-full bg-app">
            <div className="p-6 border-b border-border flex flex-col gap-4 flex-none bg-app z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                            <AlertTriangle size={20} className="text-rose-500" /> Issue Resolution
                        </h1>
                        <p className="text-sm text-muted">Manage logistics exceptions, damages, and shortages</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95">
                            <Plus size={16} /> Log Issue
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search by code, summary, type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-72 transition-all"
                            />
                        </div>

                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="appearance-none flex items-center pr-8 pl-9 h-9 rounded-lg border border-border bg-surface text-[13px] font-medium text-muted hover:text-foreground hover:border-muted-foreground/30 transition-all focus:outline-none focus:border-blue-500/50 cursor-pointer"
                            >
                                <option value="ALL">All Statuses</option>
                                {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                        <button
                            className={cn("p-1.5 rounded-md transition-colors", viewMode === 'table' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                            onClick={() => setViewMode('table')}
                        >
                            <List size={14} />
                        </button>
                        <button
                            className={cn("p-1.5 rounded-md transition-colors", viewMode === 'board' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                            onClick={() => setViewMode('board')}
                        >
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'table' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-3 border-b border-border grid grid-cols-[140px_100px_1fr_120px_140px_120px_40px] items-center gap-4 sticky top-0 bg-app/95 backdrop-blur-sm z-10">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Case ID</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Type</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Summary</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Severity</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Linked Entity</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Status</span>
                        <span />
                    </div>

                    <div className="pb-6">
                        {filteredExceptions.length === 0 ? (
                            <div className="p-12 text-center text-muted flex items-center justify-center flex-col gap-3">
                                <CheckCircle2 size={32} className="text-emerald-500/50" />
                                <span className="text-sm font-medium">No active exceptions found.</span>
                            </div>
                        ) : (
                            filteredExceptions.map(exception => {
                                const Config = STATUS_CONFIG[exception.status];
                                const entityCode = getLinkedEntityCode(exception.linkedEntityType, exception.linkedEntityId);
                                const blocking = isBlocking(exception.type, exception.severity);
                                return (
                                    <div
                                        key={exception.id}
                                        className="px-6 h-[72px] border-b border-border grid grid-cols-[140px_100px_1fr_120px_140px_120px_40px] items-center gap-4 hover:bg-surface/50 transition-colors cursor-pointer group"
                                        onClick={() => onNavigate?.(`scm-logistics-exceptions-detail-${exception.id}`)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground group-hover:text-rose-500 transition-colors">
                                                {exception.code || exception.id.split('-').slice(0, 2).join('-')}
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-muted font-medium mt-0.5">
                                                <Clock size={10} /> {format(new Date(exception.createdAt), 'MMM d, yyyy')}
                                            </span>
                                        </div>

                                        <div className="text-[13px] text-foreground font-medium">
                                            {TYPE_CONFIG[exception.type] || exception.type}
                                        </div>

                                        <div className="flex flex-col justify-center overflow-hidden">
                                            <span className="text-[13px] text-foreground font-medium truncate flex items-center gap-1.5">
                                                {blocking && <AlertTriangle size={12} className="text-red-500 flex-none" />}
                                                {exception.summary}
                                            </span>
                                        </div>

                                        <div>
                                            <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border", SEVERITY_COLORS[exception.severity])}>
                                                {exception.severity}
                                            </span>
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[11px] text-muted font-bold tracking-widest uppercase">{exception.linkedEntityType}</span>
                                            <span className="text-[13px] text-foreground font-medium">{entityCode}</span>
                                        </div>

                                        <div className="flex justify-end">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                                                Config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
                                                Config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                                                Config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                                Config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                            )}>
                                                <Config.icon size={12} /> {Config.label}
                                            </span>
                                        </div>

                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted text-muted hover:text-foreground rounded-md transition-all justify-self-end">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'board' && (
                <div className="flex-1 overflow-x-auto p-6 flex gap-6 bg-surface/30">
                    {(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as ExceptionStatus[]).map((status) => {
                        const colCases = filteredExceptions.filter(e => e.status === status);
                        const Config = STATUS_CONFIG[status];

                        return (
                            <div key={status} className="w-[300px] flex-none flex flex-col gap-3">
                                <div className="flex items-center justify-between pb-2 border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <Config.icon size={14} className={cn(
                                            Config.color === 'rose' && 'text-rose-500',
                                            Config.color === 'amber' && 'text-amber-500',
                                            Config.color === 'emerald' && 'text-emerald-500',
                                            Config.color === 'slate' && 'text-muted',
                                        )} />
                                        <span className="text-xs font-bold text-foreground uppercase tracking-widest">{Config.label}</span>
                                    </div>
                                    <span className="text-xs font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border">
                                        {colCases.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {colCases.map(exception => {
                                        const blocking = isBlocking(exception.type, exception.severity);
                                        return (
                                            <div key={exception.id} className="bg-card border border-border p-3 rounded-lg shadow-sm hover:border-rose-500/50 transition-colors cursor-pointer"
                                                onClick={() => onNavigate?.(`scm-logistics-exceptions-detail-${exception.id}`)}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[13px] font-bold text-foreground">{exception.code || exception.id.slice(0, 8)}</span>
                                                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border", SEVERITY_COLORS[exception.severity])}>
                                                        {exception.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[13px] text-foreground font-medium mb-3 line-clamp-2 flex items-center gap-1.5">
                                                    {blocking && <AlertTriangle size={12} className="text-red-500 flex-none" />}
                                                    {exception.summary}
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted uppercase tracking-widest bg-surface px-1.5 py-0.5 rounded border border-border">
                                                        <PackageX size={10} /> {TYPE_CONFIG[exception.type] || exception.type}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted text-[11px] font-medium">
                                                        <MessageSquare size={12} /> {exception.auditLog.length}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {showCreateModal && <ExceptionFormModal onClose={() => setShowCreateModal(false)} onCreated={fetchExceptions} />}
        </div>
    );
};

export default ExceptionsPage;


