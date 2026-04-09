import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import EmptyState from './EmptyState';

export interface Column<T> {
    key: string;
    header: string;
    render: (row: T) => React.ReactNode;
    sortable?: boolean;
    align?: 'left' | 'right' | 'center';
    width?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    onRowClick?: (row: T) => void;
    emptyTitle?: string;
    emptyDescription?: string;
    selectable?: boolean;
}

function DataTable<T>({
    columns, data, keyExtractor, onRowClick,
    emptyTitle = 'No data', emptyDescription,
    selectable = false,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === data.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(data.map(r => keyExtractor(r))));
        }
    };

    const gridCols = useMemo(() => {
        const cols = columns.map(c => c.width || '1fr').join(' ');
        return selectable ? `36px ${cols}` : cols;
    }, [columns, selectable]);

    if (data.length === 0) {
        return <EmptyState title={emptyTitle} description={emptyDescription} />;
    }

    const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <div
                className="grid items-center px-6 py-3 border-b border-border/60 sticky top-0 z-10 bg-card/95 backdrop-blur-md"
                style={{ gridTemplateColumns: gridCols }}
            >
                {selectable && (
                    <div className="flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={selected.size === data.length && data.length > 0}
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 rounded border-input bg-transparent text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                        />
                    </div>
                )}
                {columns.map(col => (
                    <button
                        key={col.key}
                        onClick={() => col.sortable && handleSort(col.key)}
                        className={`text-[10px] font-bold uppercase tracking-[0.08em] text-muted ${ALIGN[col.align || 'left']} ${col.sortable ? 'cursor-pointer hover:text-primary transition-colors' : 'cursor-default'} flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}
                    >
                        {col.header}
                        {col.sortable && sortKey === col.key && (
                            sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                        )}
                    </button>
                ))}
            </div>

            {/* Rows */}
            {data.map(row => {
                const id = keyExtractor(row);
                return (
                    <div
                        key={id}
                        onClick={() => onRowClick?.(row)}
                        className={`grid items-center px-6 border-b border-border/50 transition-all cursor-pointer hover:bg-surface ${selected.has(id) ? 'bg-emerald-500/[0.04]' : ''
                            }`}
                        style={{ gridTemplateColumns: gridCols, minHeight: '52px' }}
                    >
                        {selectable && (
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={selected.has(id)}
                                    onChange={() => { }} // handled by onClick
                                    onClick={(e) => toggleSelect(id, e)}
                                    className="h-3.5 w-3.5 rounded border-input bg-transparent text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                                />
                            </div>
                        )}
                        {columns.map(col => (
                            <div key={col.key} className={`text-[13px] ${ALIGN[col.align || 'left']} py-3`}>
                                {col.render(row)}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

export default DataTable;
