import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Star,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    MapPin
} from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { ScmSupplier } from '../../types/scm';
import { cn } from '../../utils/cn';
import SupplierDrawer from './SupplierDrawer';
import CreateSupplierModal from './CreateSupplierModal';

const SuppliersPage: React.FC = () => {
    const {
        suppliers,
        hydrateFromDatabase,
        loading,
        fetchSuppliers,
        initialized,
        selectedSupplierId,
        setSelectedSupplierId,
        setCreateModalOpen
    } = useScmStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'on-hold'>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ScmSupplier; direction: 'asc' | 'desc' } | null>(null);
    const [activeFilterDropdown, setActiveFilterDropdown] = useState<'status' | 'location' | null>(null);

    // Initial fetch
    useEffect(() => {
        if (!initialized) {
            hydrateFromDatabase().catch(() => {
                fetchSuppliers();
            });
        }
    }, [initialized, fetchSuppliers, hydrateFromDatabase]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeFilterDropdown && !(event.target as Element).closest('.filter-group')) {
                setActiveFilterDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeFilterDropdown]);

    // Unique locations
    const uniqueLocations = useMemo(() => {
        const locations = new Set(suppliers.map(s => s.address).filter(Boolean));
        return Array.from(locations).sort();
    }, [suppliers]);

    // Sorting logic
    const handleSort = (key: keyof ScmSupplier) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedSuppliers = useMemo(() => {
        let sortableSuppliers = [...suppliers];
        if (sortConfig) {
            sortableSuppliers.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === undefined || bValue === undefined) return 0;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableSuppliers;
    }, [suppliers, sortConfig]);

    // Filtering logic
    const filteredSuppliers = useMemo(() => {
        return sortedSuppliers.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
            const matchesLocation = locationFilter === 'all' || s.address === locationFilter;
            return matchesSearch && matchesStatus && matchesLocation;
        });
    }, [sortedSuppliers, searchQuery, statusFilter, locationFilter]);

    return (
        <div className="flex h-full relative overflow-hidden animate-in fade-in duration-500">
            <div className="flex-1 flex flex-col min-w-0 bg-app">
                {/* Header Actions */}
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search suppliers or tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-brand/50 transition-colors w-64 placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Status Filter */}
                            <div className="relative filter-group group">
                                <button
                                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'status' ? null : 'status')}
                                    className={cn(
                                        "flex items-center gap-2 h-9 px-3 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-surface transition-all text-xs font-bold uppercase tracking-widest",
                                        activeFilterDropdown === 'status' ? "border-brand/50 bg-surface text-foreground" : "border-border"
                                    )}
                                >
                                    <Filter size={14} />
                                    {statusFilter === 'all' ? 'Status' : statusFilter}
                                </button>
                                <div className={cn(
                                    "absolute top-full left-0 mt-1 w-32 bg-popover border border-border rounded-lg shadow-lg z-20 transition-all duration-200",
                                    "before:absolute before:-top-4 before:left-0 before:w-full before:h-4 before:bg-transparent", // Bridge for hover
                                    activeFilterDropdown === 'status'
                                        ? "visible opacity-100 translate-y-0 pointer-events-auto"
                                        : "invisible opacity-0 -translate-y-2 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                                )}>
                                    {['all', 'active', 'inactive', 'on-hold'].map(status => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status as any);
                                                setActiveFilterDropdown(null);
                                            }}
                                            className={cn(
                                                "w-full text-left px-4 py-2 text-xs font-medium hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg",
                                                statusFilter === status ? "text-primary bg-muted/30" : "text-muted-foreground"
                                            )}
                                        >
                                            {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Location Filter */}
                            <div className="relative filter-group group">
                                <button
                                    onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'location' ? null : 'location')}
                                    className={cn(
                                        "flex items-center gap-2 h-9 px-3 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-surface transition-all text-xs font-bold uppercase tracking-widest",
                                        activeFilterDropdown === 'location' ? "border-brand/50 bg-surface text-foreground" : "border-border"
                                    )}
                                >
                                    <MapPin size={14} />
                                    {locationFilter === 'all' ? 'Location' : locationFilter}
                                </button>
                                <div className={cn(
                                    "absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto custom-scrollbar transition-all duration-200",
                                    "before:absolute before:-top-4 before:left-0 before:w-full before:h-4 before:bg-transparent", // Bridge for hover
                                    activeFilterDropdown === 'location'
                                        ? "visible opacity-100 translate-y-0 pointer-events-auto"
                                        : "invisible opacity-0 -translate-y-2 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                                )}>
                                    <button
                                        onClick={() => {
                                            setLocationFilter('all');
                                            setActiveFilterDropdown(null);
                                        }}
                                        className={cn(
                                            "w-full text-left px-4 py-2 text-xs font-medium hover:bg-muted/50 transition-colors first:rounded-t-lg",
                                            locationFilter === 'all' ? "text-primary bg-muted/30" : "text-muted-foreground"
                                        )}
                                    >
                                        All Locations
                                    </button>
                                    {uniqueLocations.map(location => (
                                        <button
                                            key={location}
                                            onClick={() => {
                                                setLocationFilter(location as string);
                                                setActiveFilterDropdown(null);
                                            }}
                                            className={cn(
                                                "w-full text-left px-4 py-2 text-xs font-medium hover:bg-muted/50 transition-colors",
                                                locationFilter === location ? "text-primary bg-muted/30" : "text-muted-foreground"
                                            )}
                                        >
                                            {location}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        <Plus size={16} /> New Supplier
                    </button>
                </div>

                {/* Table Header */}
                <div className="px-6 py-3 border-b border-border bg-app sticky top-0 z-10 grid grid-cols-[1fr_120px_100px_120px_100px_40px] items-center gap-4">
                    <SortableHeader label="Supplier Name" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Rating" sortKey="rating" currentSort={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Lead Time" sortKey="leadTimeDays" currentSort={sortConfig} onSort={handleSort} className="text-center" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest select-none">Active POs</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest select-none">Status</span>
                    <span />
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p className="text-sm">Chargement des donnees fournisseurs...</p>
                        </div>
                    ) : filteredSuppliers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p className="text-sm">Aucun enregistrement trouve</p>
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="mt-4 text-xs text-primary hover:underline"
                            >
                                Creer votre premier fournisseur
                            </button>
                        </div>
                    ) : (
                        filteredSuppliers.map(s => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedSupplierId(s.id)}
                                className={cn(
                                    "px-6 border-b border-border grid grid-cols-[1fr_120px_100px_120px_100px_40px] items-center gap-4 transition-all cursor-pointer group h-[64px]",
                                    selectedSupplierId === s.id ? "bg-brand/5" : "hover:bg-surface"
                                )}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/5 flex items-center justify-center text-blue-400 font-bold text-xs">
                                        {s.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[13.5px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                            {s.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {s.tags.slice(0, 2).map(tag => (
                                                <span key={tag} className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight px-1.5 py-0.5 bg-surface rounded">
                                                    {tag}
                                                </span>
                                            ))}
                                            {s.tags.length > 2 && (
                                                <span className="text-[9px] font-bold text-muted-foreground">+ {s.tags.length - 2}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Star size={12} className={cn("text-amber-500", s.rating ? "fill-amber-500" : "fill-none opacity-30")} />
                                    <span className="text-[13px] font-medium text-foreground tabular-nums">{s.rating || '-'}</span>
                                </div>
                                <div className="text-[13px] text-muted-foreground text-center tabular-nums">
                                    {s.leadTimeDays || '-'}d
                                </div>
                                <div className="text-[13px] text-foreground font-bold tabular-nums">
                                    {s.activePOs || 0} Open
                                </div>
                                <div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                                        s.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                            s.status === 'on-hold' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                "bg-surface text-muted-foreground border-border"
                                    )}>
                                        {s.status}
                                    </span>
                                </div>
                                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface rounded-md transition-all text-muted-foreground">
                                    <MoreHorizontal size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Components */}
            <SupplierDrawer />

            <CreateSupplierModal />
        </div>
    );
};

const SortableHeader = ({
    label,
    sortKey,
    currentSort,
    onSort,
    className
}: {
    label: string,
    sortKey: keyof ScmSupplier,
    currentSort: { key: keyof ScmSupplier, direction: 'asc' | 'desc' } | null,
    onSort: (key: keyof ScmSupplier) => void,
    className?: string
}) => {
    const isActive = currentSort?.key === sortKey;

    return (
        <div
            className={cn("flex items-center gap-1 cursor-pointer group select-none", className)}
            onClick={() => onSort(sortKey)}
        >
            <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
                {label}
            </span>
            <div className="text-muted-foreground/50 group-hover:text-muted-foreground">
                {isActive ? (
                    currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                ) : (
                    <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
        </div>
    );
}

export default SuppliersPage;


