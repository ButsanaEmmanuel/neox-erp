import React, { useState, useEffect } from 'react';
import {
    Truck, ShoppingCart, AlertTriangle, Clock, Box, ShieldCheck, ArrowRight, AlertCircle,
} from 'lucide-react';
import { useScmOverview, ScmOverviewFilters } from '../../hooks/useScmOverview';
import { useScmStore } from '../../store/scm/useScmStore';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';

interface SCMOverviewProps {
    onNavigate?: (view: string) => void;
}

const SCMOverview: React.FC<SCMOverviewProps> = ({ onNavigate = () => { } }) => {
    const { locations, fetchProducts, fetchSuppliers, fetchCategories } = useScmStore();

    useEffect(() => {
        fetchProducts();
        fetchSuppliers();
        fetchCategories();
    }, [fetchProducts, fetchSuppliers, fetchCategories]);

    // Default filters
    const [filters, setFilters] = useState<ScmOverviewFilters>({
        locationId: 'all',
        timeWindowDays: 30,
        supplierId: 'all',
        categoryId: 'all'
    });

    // Sync filters to URL (simple approach without react-router)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const loc = params.get('location');
        const win = params.get('window');
        const supp = params.get('supplier');
        const cat = params.get('category');

        if (loc || win || supp || cat) {
            setFilters(prev => ({
                ...prev,
                locationId: loc || prev.locationId,
                timeWindowDays: win ? parseInt(win, 10) : prev.timeWindowDays,
                supplierId: supp || prev.supplierId,
                categoryId: cat || prev.categoryId
            }));
        }
    }, []);

    const updateFilter = (key: keyof ScmOverviewFilters, value: any) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);

        // Update URL
        const url = new URL(window.location.href);
        if (value === 'all') {
            url.searchParams.delete(key.replace('Id', ''));
        } else {
            url.searchParams.set(key.replace('Id', ''), String(value));
        }
        window.history.pushState({}, '', url);
    };

    const handleNavigate = (path: string) => {
        // Parse the simulated path (e.g. /scm/inventory?filter=low&location=loc-1)
        // Set the active view based on the pathname and push query params
        const url = new URL(path, window.location.origin);
        const viewMap: Record<string, string> = {
            '/scm/inventory': 'scm-inventory',
            '/scm/purchase-orders': 'scm-purchase-orders',
            '/scm/logistics-transfers': 'scm-logistics-transfers',
            '/scm/logistics-exceptions': 'scm-logistics-exceptions',
            '/scm/logistics-receiving': 'scm-logistics-receiving',
        };

        const activeView = viewMap[url.pathname] || url.pathname.replace(/^\//, '').replace(/\//g, '-');

        // Push State
        window.history.pushState({}, '', url);
        onNavigate(activeView);
    };

    const data = useScmOverview(filters);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
            {/* Filters Bar */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Location</span>
                    <select
                        value={filters.locationId}
                        onChange={e => updateFilter('locationId', e.target.value)}
                        className="h-8 bg-surface border border-border rounded-lg px-2 text-[12px] text-foreground focus:outline-none focus:border-brand"
                    >
                        <option value="all">Global Workspace</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Timeframe</span>
                    <select
                        value={filters.timeWindowDays}
                        onChange={e => updateFilter('timeWindowDays', Number(e.target.value))}
                        className="h-8 bg-surface border border-border rounded-lg px-2 text-[12px] text-foreground focus:outline-none focus:border-brand"
                    >
                        <option value={7}>Next 7 Days</option>
                        <option value={14}>Next 14 Days</option>
                        <option value={30}>Next 30 Days</option>
                        <option value={90}>Next 90 Days</option>
                    </select>
                </div>
                {/* Optional filters can go here */}
            </div>

            {/* KPI Tiles Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                {data.kpis.map((kpi) => (
                    <div
                        key={kpi.label}
                        onClick={() => handleNavigate(kpi.path)}
                        className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden group cursor-pointer hover:border-brand/50 transition-colors"
                    >
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex flex-col h-full justify-between relative z-10">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{kpi.label}</p>
                            <h3 className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{kpi.value}</h3>
                            {kpi.delta && (
                                <p className="text-[11px] font-medium mt-1 text-muted group-hover:text-foreground transition-colors">{kpi.delta}</p>
                            )}
                        </div>
                        <div className={cn(
                            "absolute bottom-0 right-0 w-24 h-24 rounded-tl-full opacity-[0.03] transition-transform group-hover:scale-110",
                            kpi.color === 'blue' ? "bg-blue-500" :
                                kpi.color === 'emerald' ? "bg-emerald-500" :
                                    kpi.color === 'rose' ? "bg-rose-500" :
                                        kpi.color === 'amber' ? "bg-amber-500" : "bg-slate-500"
                        )} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Alerts Panel */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 px-6 border-b border-border flex items-center justify-between bg-surface/30">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <AlertTriangle size={16} className="text-amber-500" /> Actionable Alerts
                            </h3>
                            <span className="text-[11px] font-bold text-muted px-2 py-0.5 bg-surface rounded-full">{data.alerts.length} Total</span>
                        </div>
                        <div className="divide-y divide-border">
                            {data.alerts.length > 0 ? data.alerts.map(alert => (
                                <div key={alert.id} className="p-4 px-6 flex items-center justify-between group hover:bg-surface/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                            alert.severity === 'CRITICAL' ? "bg-rose-500/10 text-rose-500" :
                                                alert.severity === 'HIGH' ? "bg-amber-500/10 text-amber-500" :
                                                    "bg-blue-500/10 text-blue-500"
                                        )}>
                                            {alert.severity === 'CRITICAL' ? <AlertCircle size={14} /> :
                                                alert.severity === 'HIGH' ? <Clock size={14} /> : <AlertTriangle size={14} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-[13px] font-bold text-foreground group-hover:text-brand transition-colors cursor-pointer" onClick={() => handleNavigate(alert.path)}>{alert.title}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-1.5 py-0.5 bg-surface rounded">{alert.ageDays}d ago</span>
                                            </div>
                                            <p className="text-[12px] text-muted mt-0.5">{alert.description}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-center">
                                        {alert.actionLabel && (
                                            <button onClick={() => handleNavigate(alert.path)} className="h-8 px-3 bg-brand/10 text-brand hover:bg-brand hover:text-primary rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all">
                                                {alert.actionLabel}
                                            </button>
                                        )}
                                        {!alert.actionLabel && (
                                            <button onClick={() => handleNavigate(alert.path)} className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground rounded-lg transition-colors">
                                                <ArrowRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-muted">
                                    <ShieldCheck size={32} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-[13px] font-medium">All clear. No critical alerts.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Work Queues (3 cols) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Procurement */}
                        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
                            <div className="p-4 border-b border-border bg-surface/30">
                                <h3 className="text-[12px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2"><ShoppingCart size={14} /> Procurement</h3>
                            </div>
                            <div className="p-2 space-y-1 flex-1">
                                {data.queues.procurement.length > 0 ? data.queues.procurement.map(q => (
                                    <div key={q.id} onClick={() => handleNavigate(q.path)} className="p-3 rounded-lg hover:bg-surface cursor-pointer group transition-colors flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground">{q.title}</span>
                                            <span className="text-[11px] text-muted font-medium mt-0.5">{q.subtitle}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-border group-hover:text-brand transition-colors" />
                                    </div>
                                )) : <div className="p-6 text-center text-muted text-[12px]">Queue empty</div>}
                            </div>
                        </div>

                        {/* Warehouse */}
                        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
                            <div className="p-4 border-b border-border bg-surface/30">
                                <h3 className="text-[12px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2"><Box size={14} /> Warehouse</h3>
                            </div>
                            <div className="p-2 space-y-1 flex-1">
                                {data.queues.warehouse.length > 0 ? data.queues.warehouse.map(q => (
                                    <div key={q.id} onClick={() => handleNavigate(q.path)} className="p-3 rounded-lg hover:bg-surface cursor-pointer group transition-colors flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={cn("text-[13px] font-bold", q.urgent ? "text-amber-500" : "text-foreground")}>{q.title}</span>
                                            <span className="text-[11px] text-muted font-medium mt-0.5">{q.subtitle}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-border group-hover:text-brand transition-colors" />
                                    </div>
                                )) : <div className="p-6 text-center text-muted text-[12px]">Queue empty</div>}
                            </div>
                        </div>

                        {/* Logistics */}
                        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
                            <div className="p-4 border-b border-border bg-surface/30">
                                <h3 className="text-[12px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2"><Truck size={14} /> Logistics</h3>
                            </div>
                            <div className="p-2 space-y-1 flex-1">
                                {data.queues.logistics.length > 0 ? data.queues.logistics.map(q => (
                                    <div key={q.id} onClick={() => handleNavigate(q.path)} className="p-3 rounded-lg hover:bg-surface cursor-pointer group transition-colors flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground">{q.title}</span>
                                            <span className="text-[11px] text-muted font-medium mt-0.5">{q.subtitle}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-border group-hover:text-brand transition-colors" />
                                    </div>
                                )) : <div className="p-6 text-center text-muted text-[12px]">Queue empty</div>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Upcoming Inbound */}
                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                        <div className="p-4 border-b border-border bg-surface/30 flex justify-between items-center">
                            <h3 className="text-[13px] font-bold text-foreground tracking-wide flex items-center gap-2">Upcoming Inbound</h3>
                            <span className="text-[10px] font-bold text-muted uppercase">Next {filters.timeWindowDays} days</span>
                        </div>
                        <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                            {data.upcoming.inbound.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {data.upcoming.inbound.map(item => (
                                        <div key={item.id} onClick={() => handleNavigate(item.path)} className="p-4 px-5 flex items-start gap-4 hover:bg-surface cursor-pointer group transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase leading-none mb-0.5">{format(item.date, 'MMM')}</span>
                                                <span className="text-[14px] font-black text-emerald-600 leading-none">{format(item.date, 'd')}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h4 className="text-[13px] font-bold text-foreground truncate group-hover:text-brand transition-colors">{item.title}</h4>
                                                    <span className="text-[11px] font-medium text-foreground tabular-nums bg-surface px-1.5 py-0.5 rounded">{item.metrics}</span>
                                                </div>
                                                <p className="text-[11px] text-muted truncate">{item.subtitle}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted text-[13px]">No inbound expected.</div>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Outbound */}
                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                        <div className="p-4 border-b border-border bg-surface/30 flex justify-between items-center">
                            <h3 className="text-[13px] font-bold text-foreground tracking-wide flex items-center gap-2">Upcoming Outbound</h3>
                            <span className="text-[10px] font-bold text-muted uppercase">Next {filters.timeWindowDays} days</span>
                        </div>
                        <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                            {data.upcoming.outbound.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {data.upcoming.outbound.map(item => (
                                        <div key={item.id} onClick={() => handleNavigate(item.path)} className="p-4 px-5 flex items-start gap-4 hover:bg-surface cursor-pointer group transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-blue-500 uppercase leading-none mb-0.5">{format(item.date, 'MMM')}</span>
                                                <span className="text-[14px] font-black text-blue-600 leading-none">{format(item.date, 'd')}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h4 className="text-[13px] font-bold text-foreground truncate group-hover:text-brand transition-colors">{item.title}</h4>
                                                    <span className="text-[11px] font-medium text-foreground tabular-nums bg-surface px-1.5 py-0.5 rounded">{item.metrics}</span>
                                                </div>
                                                <p className="text-[11px] text-muted truncate">{item.subtitle}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted text-[13px]">No outbound scheduled.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Debug Info (Only in Dev or accessible via small corner) */}
            <div className="mt-12 pt-8 border-t border-border/50 text-[10px] text-muted-foreground/30 flex justify-between items-center group hover:text-muted-foreground transition-colors cursor-default">
                <p>© 2026 NEOX Command Center • SCM Intelligence Unit</p>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Inv: {data.debugCounts.inventory}</span>
                    <span>Prod: {data.debugCounts.products}</span>
                    <span>POs: {data.debugCounts.pos}</span>
                    <span>Trf: {data.debugCounts.transfers}</span>
                    <span>Shp: {data.debugCounts.shipments}</span>
                    <span>Rcpt: {data.debugCounts.receipts}</span>
                </div>
            </div>
        </div>
    );
};

export default SCMOverview;


