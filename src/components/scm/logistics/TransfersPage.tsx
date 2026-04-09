import React, { useState, useMemo } from 'react';
import {
    Search, Filter, Plus, LayoutGrid, List, ArrowRight, Clock, ChevronRight
} from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useLogisticsStore, canTransitionTransfer } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { TransferStatus, Transfer } from '../../../types/logistics';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import { StatusPill, TRANSFER_STATUS_CONFIG } from './StatusPill';
import { FilterDrawer } from './FilterDrawer';
import { TransferFormModal } from './TransferFormModal';

const KANBAN_COLUMNS: TransferStatus[] = [
    'REQUESTED', 'APPROVED', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVING'
];

interface KanbanColumnProps {
    id: string;
    children: React.ReactNode;
    className?: string;
}

const KanbanColumn = ({ id, children, className }: KanbanColumnProps) => {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={className}>
            {children}
        </div>
    );
};

interface SortableTransferCardProps {
    transfer: Transfer;
    onClick?: () => void;
}

interface TransferCardProps {
    transfer: Transfer;
    isDragging?: boolean;
    style?: React.CSSProperties;
    onClick?: () => void;
    attributes?: any;
    listeners?: any;
    nodeRef?: (node: HTMLElement | null) => void;
}

const TransferCard = React.forwardRef<HTMLDivElement, TransferCardProps>(({
    transfer, isDragging, style, onClick, attributes, listeners, nodeRef
}, ref) => {
    const { locations } = useScmStore();
    const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || id;

    return (
        <div
            ref={(node) => {
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
                if (nodeRef) nodeRef(node);
            }}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "bg-card border p-3 rounded-lg shadow-sm transition-colors cursor-grab active:cursor-grabbing",
                isDragging ? "border-blue-500 shadow-md ring-1 ring-blue-500/20" : "border-border hover:border-blue-500/50"
            )}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-foreground">{transfer.code}</span>
                <span className="text-[10px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                    {transfer.lines.length} items
                </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted drop-shadow-sm mb-3">
                <span className="truncate">{getLocationName(transfer.sourceLocationId)}</span>
                <ArrowRight size={10} className="flex-none" />
                <span className="truncate text-foreground font-medium">{getLocationName(transfer.destLocationId)}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                    <Clock size={12} />
                    Due: {transfer.neededDate ? format(new Date(transfer.neededDate), 'MMM d, yyyy') : 'N/A'}
                </div>
            </div>
        </div>
    );
});

TransferCard.displayName = 'TransferCard';

const SortableTransferCard = ({ transfer, onClick }: SortableTransferCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: transfer.id, data: { status: transfer.status } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <TransferCard
            transfer={transfer}
            isDragging={isDragging}
            style={style}
            onClick={onClick}
            attributes={attributes}
            listeners={listeners}
            nodeRef={setNodeRef}
        />
    );
};

interface TransfersPageProps {
    onNavigate?: (view: string) => void;
}

const TransfersPage: React.FC<TransfersPageProps> = ({ onNavigate }) => {
    const { transfers, fetchTransfers, transitionTransferStatus } = useLogisticsStore();
    const { locations } = useScmStore();
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

    const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || id;

    React.useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);
    const [searchQuery, setSearchQuery] = useState('');

    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status')?.toUpperCase() as TransferStatus;

    const [selectedStatuses, setSelectedStatuses] = useState<TransferStatus[]>(initialStatus ? [initialStatus] : []);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const toggleStatusFilter = (status: TransferStatus) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedStatuses([]);
    };

    // DND State
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeTransfer = useMemo(() => transfers.find(t => t.id === activeId), [activeId, transfers]);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [overStatus, setOverStatus] = useState<TransferStatus | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (!over) {
            setOverStatus(null);
            return;
        }

        if (KANBAN_COLUMNS.includes(over.id as TransferStatus)) {
            setOverStatus(over.id as TransferStatus);
        } else {
            const overItem = transfers.find(t => t.id === over.id);
            if (overItem) setOverStatus(overItem.status);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverStatus(null);
        if (!over) return;

        let newStatus: TransferStatus;

        if (KANBAN_COLUMNS.includes(over.id as TransferStatus)) {
            newStatus = over.id as TransferStatus;
        } else {
            const overItem = transfers.find(t => t.id === over.id);
            if (!overItem) return;
            newStatus = overItem.status;
        }

        const trf = transfers.find(t => t.id === active.id);

        if (trf && trf.status !== newStatus) {
            if (canTransitionTransfer(trf, newStatus)) {
                try {
                    await transitionTransferStatus(trf.id, newStatus);
                } catch (e) {
                    console.error("Transition failed", e);
                }
            } else {
                console.warn(`Cannot transition transfer ${trf.code} from ${trf.status} to ${newStatus}`);
            }
        }
    };

    const filteredTransfers = transfers.filter(t => {
        // Search filter
        if (searchQuery && !t.code.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        // Status filter
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(t.status)) {
            return false;
        }
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-app">
            <div className="p-6 border-b border-border flex flex-col gap-4 flex-none bg-app z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight">Internal Transfers</h1>
                        <p className="text-sm text-muted">Manage stock movements between facilities</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95"
                            onClick={() => setIsFormOpen(true)}
                        >
                            <Plus size={16} /> New Transfer
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search transfers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-64 transition-all"
                            />
                        </div>
                        <button
                            className="h-9 px-3 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2 text-[13px] font-medium"
                            onClick={() => setIsFilterOpen(true)}
                        >
                            <Filter size={14} /> Filter
                        </button>
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
                    <div className="px-6 py-3 border-b border-border grid grid-cols-[140px_1fr_140px_140px_140px_40px] items-center gap-4 sticky top-0 bg-app/95 backdrop-blur-sm z-10">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Transfer ID</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Route</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Requested By</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Needed By</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Status</span>
                        <span />
                    </div>

                    <div className="pb-6">
                        {filteredTransfers.length === 0 ? (
                            <div className="p-12 text-center text-muted text-sm border-b border-border">No transfers found.</div>
                        ) : (
                            filteredTransfers.map(transfer => {
                                return (
                                    <div
                                        key={transfer.id}
                                        className="px-6 h-[64px] border-b border-border grid grid-cols-[140px_1fr_140px_140px_140px_40px] items-center gap-4 hover:bg-surface/50 transition-colors cursor-pointer group"
                                        onClick={() => onNavigate?.(`scm-logistics-transfers-detail-${transfer.id}`)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">
                                                {transfer.code}
                                            </span>
                                            <span className="text-[10px] text-muted font-medium mt-0.5">
                                                {transfer.lines.length} items
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted font-medium truncate max-w-[150px]">
                                                {getLocationName(transfer.sourceLocationId)}
                                            </span>
                                            <ArrowRight size={12} className="text-muted/50 flex-none" />
                                            <span className="text-[13px] text-foreground font-medium truncate max-w-[150px]">
                                                {getLocationName(transfer.destLocationId)}
                                            </span>
                                        </div>

                                        <div className="text-[13px] text-muted text-right truncate">
                                            {transfer.requestedBy}
                                        </div>

                                        <div className="text-[13px] text-foreground tabular-nums text-right font-medium">
                                            {transfer.neededDate ? format(new Date(transfer.neededDate), 'MMM d, yyyy') : 'N/A'}
                                        </div>

                                        <div className="flex justify-end pr-8">
                                            <StatusPill status={transfer.status} type="transfer" />
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
                <div className="flex-1 overflow-x-auto p-6 flex gap-6 bg-surface/30 min-h-0">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        {KANBAN_COLUMNS.map((status) => {
                            const colTransfers = filteredTransfers.filter(t => t.status === status);
                            const config = TRANSFER_STATUS_CONFIG[status];
                            const Icon = config.icon;

                            return (
                                <div key={status} className="w-[300px] flex-none flex flex-col gap-3 max-h-full">
                                    <div className={cn(
                                        "flex items-center justify-between pb-2 border-b-2 transition-colors",
                                        overStatus === status ? "border-blue-500" : "border-border"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <Icon size={14} className={cn(overStatus === status ? "text-blue-500" : `text-${config.color}-500`)} />
                                            <span className={cn(
                                                "text-xs font-bold uppercase tracking-widest transition-colors",
                                                overStatus === status ? "text-blue-500" : "text-foreground"
                                            )}>
                                                {config.label}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border">
                                            {colTransfers.length}
                                        </span>
                                    </div>

                                    <KanbanColumn id={status} className={cn(
                                        "flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 min-h-[150px] transition-colors rounded-lg",
                                        overStatus === status && "bg-blue-500/5 ring-1 ring-blue-500/10"
                                    )}>
                                        <SortableContext items={colTransfers.map(t => t.id)}>
                                            <div className="space-y-3">
                                                {colTransfers.map(t => (
                                                    <SortableTransferCard
                                                        key={t.id}
                                                        transfer={t}
                                                        onClick={() => onNavigate?.(`scm-logistics-transfers-detail-${t.id}`)}
                                                    />
                                                ))}
                                                {colTransfers.length === 0 && (
                                                    <div className="h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-xs text-muted font-medium bg-surface/30">
                                                        Drop here
                                                    </div>
                                                )}
                                            </div>
                                        </SortableContext>
                                    </KanbanColumn>
                                </div>
                            )
                        })}

                        <DragOverlay dropAnimation={null}>
                            {activeTransfer ? (
                                <div className="rotate-2 scale-105 pointer-events-none">
                                    <TransferCard transfer={activeTransfer} />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}

            <FilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filter Transfers"
                onReset={resetFilters}
                onApply={() => setIsFilterOpen(false)}
            >
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-3 block">Status</label>
                        <div className="grid grid-cols-1 gap-2">
                            {KANBAN_COLUMNS.map(s => {
                                const isSelected = selectedStatuses.includes(s);
                                const config = TRANSFER_STATUS_CONFIG[s];
                                return (
                                    <button
                                        key={s}
                                        onClick={() => toggleStatusFilter(s)}
                                        className={cn(
                                            "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left",
                                            isSelected
                                                ? "bg-blue-600/10 border-blue-500 shadow-sm"
                                                : "bg-surface/50 border-border hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                isSelected ? "bg-blue-500" : `bg-${config.color}-500`
                                            )} />
                                            <span className={cn(
                                                "text-[13px] font-medium transition-colors",
                                                isSelected ? "text-blue-500 font-bold" : "text-foreground"
                                            )}>
                                                {config.label}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                                <Plus size={10} className="text-primary rotate-45" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </FilterDrawer>

            <TransferFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
            />
        </div>
    );
};

export default TransfersPage;


