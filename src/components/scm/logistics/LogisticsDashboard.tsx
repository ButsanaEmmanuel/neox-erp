import React, { useEffect, useMemo } from 'react';
import { Truck, AlertTriangle, Clock, Plus, Package, MapPin } from 'lucide-react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { formatDistanceToNow } from 'date-fns';
interface LogisticsDashboardProps {
    onNavigate?: (view: string) => void;
}

interface Activity {
    id: string;
    entity: string;
    entityCode: string;
    action: string;
    actor: string;
    timestamp: Date;
}

const LogisticsDashboard: React.FC<LogisticsDashboardProps> = ({ onNavigate }) => {
    const {
        shipments,
        exceptions,
        fetchShipments,
        fetchExceptions,
        fetchTransfers
    } = useLogisticsStore();

    useEffect(() => {
        fetchShipments();
        fetchExceptions();
        fetchTransfers();
    }, [fetchShipments, fetchExceptions, fetchTransfers]);

    // Compute KPIs
    const kpis = useMemo(() => {
        const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT').length;
        const pendingReceiving = shipments.filter(s => s.status === 'ARRIVED' || s.status === 'RECEIVING').length;
        const openExceptions = exceptions.filter(e => e.status === 'OPEN' || e.status === 'UNDER_REVIEW').length;

        const now = new Date().getTime();
        const lateShipments = shipments.filter(s => {
            if (s.status === 'CLOSED' || s.status === 'PUT_AWAY') return false;
            if (!s.etaDate) return false;
            return new Date(s.etaDate).getTime() < now;
        }).length;

        return { inTransit, pendingReceiving, openExceptions, lateShipments };
    }, [shipments, exceptions]);

    // Aggregate recent activity
    const recentActivity = useMemo(() => {
        const activities: Activity[] = [];

        shipments.forEach(s => {
            s.auditLog.forEach(log => {
                activities.push({
                    id: log.id,
                    entity: 'Shipment',
                    entityCode: s.code,
                    action: log.message,
                    actor: log.actor,
                    timestamp: new Date(log.timestamp)
                });
            });
        });

        exceptions.forEach(e => {
            e.auditLog.forEach(log => {
                activities.push({
                    id: log.id,
                    entity: 'Exception',
                    entityCode: e.type,
                    action: log.message,
                    actor: log.actor,
                    timestamp: new Date(log.timestamp)
                });
            });
        });

        // Sort by newest first, take top 10
        return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
    }, [shipments, exceptions]);

    return (
        <div className="flex flex-col h-full bg-app overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between flex-none bg-app">
                <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight">Logistics Overview</h1>
                    <p className="text-sm text-muted">Monitor and manage all inbound and outbound operations</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95">
                        <Plus size={16} /> Create Inbound
                    </button>
                    <button className="flex items-center gap-2 bg-surface hover:bg-muted border border-border text-foreground px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-sm active:scale-95">
                        <Plus size={16} /> Create Outbound
                    </button>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: KPIs & Quick Actions */}
                <div className="lg:col-span-2 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted uppercase tracking-wider">In Transit</span>
                                <Truck size={14} className="text-blue-500" />
                            </div>
                            <span className="text-3xl font-bold tabular-nums text-foreground">{kpis.inTransit}</span>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted uppercase tracking-wider">Pending GRN</span>
                                <Package size={14} className="text-emerald-500" />
                            </div>
                            <span className="text-3xl font-bold tabular-nums text-foreground">{kpis.pendingReceiving}</span>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted uppercase tracking-wider">Open Exceptions</span>
                                <AlertTriangle size={14} className={kpis.openExceptions > 0 ? "text-amber-500" : "text-secondary"} />
                            </div>
                            <span className="text-3xl font-bold tabular-nums text-foreground">{kpis.openExceptions}</span>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between h-28">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-muted uppercase tracking-wider">Late Shipments</span>
                                <Clock size={14} className={kpis.lateShipments > 0 ? "text-rose-500" : "text-secondary"} />
                            </div>
                            <span className="text-3xl font-bold tabular-nums text-foreground">{kpis.lateShipments}</span>
                        </div>
                    </div>

                    {/* Quick Access / Operations Map */}
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-foreground mb-4">Operations Map</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div
                                className="group p-4 rounded-lg border border-border hover:border-blue-500/30 bg-surface hover:bg-blue-500/5 transition-all cursor-pointer flex flex-col"
                                onClick={() => onNavigate?.('scm-logistics-receiving')}
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Package size={16} />
                                </div>
                                <h4 className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">Receiving Workspace</h4>
                                <p className="text-[11px] text-muted mt-1 leading-relaxed">Process inbound shipments, record GRNs, and log exceptions.</p>
                            </div>

                            <div
                                className="group p-4 rounded-lg border border-border hover:border-emerald-500/30 bg-surface hover:bg-emerald-500/5 transition-all cursor-pointer flex flex-col"
                                onClick={() => onNavigate?.('scm-logistics-transfers')}
                            >
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Truck size={16} />
                                </div>
                                <h4 className="text-[13px] font-bold text-foreground group-hover:text-emerald-500 transition-colors">Internal Transfers</h4>
                                <p className="text-[11px] text-muted mt-1 leading-relaxed">Manage stock movements between your warehouses and locations.</p>
                            </div>

                            <div
                                className="group p-4 rounded-lg border border-border hover:border-amber-500/30 bg-surface hover:bg-amber-500/5 transition-all cursor-pointer flex flex-col"
                                onClick={() => onNavigate?.('scm-logistics-deliveries')}
                            >
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <MapPin size={16} />
                                </div>
                                <h4 className="text-[13px] font-bold text-foreground group-hover:text-amber-500 transition-colors">Outbound Deliveries</h4>
                                <p className="text-[11px] text-muted mt-1 leading-relaxed">Track customer deliveries and capture Proof of Delivery (POD).</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Timeline */}
                <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col max-h-[600px]">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50 rounded-t-xl">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Recent Activity</h3>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                        {recentActivity.length === 0 ? (
                            <p className="text-xs text-muted text-center py-6 block w-full border border-dashed border-border rounded-lg bg-surface">No recent activity</p>
                        ) : (
                            <div className="space-y-4">
                                {recentActivity.map((activity, index) => (
                                    <div key={activity.id} className="relative flex gap-3 group">
                                        {/* Connecting Line */}
                                        {index !== recentActivity.length - 1 && (
                                            <div className="absolute left-[11px] top-6 bottom-[-20px] w-px bg-border group-hover:bg-blue-500/30 transition-colors" />
                                        )}

                                        {/* Dot */}
                                        <div className="w-[22px] h-[22px] rounded-full bg-surface border-2 border-border flex-none mt-0.5 relative z-10 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pb-2">
                                            <div className="flex items-start justify-between">
                                                <p className="text-[13px] text-foreground font-medium leading-tight">
                                                    {activity.action}
                                                </p>
                                                <span className="text-[10px] text-muted whitespace-nowrap ml-2">
                                                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[11px] font-bold text-muted tracking-tight">
                                                    {activity.entityCode}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-muted opacity-50" />
                                                <span className="text-[11px] text-muted">{activity.actor}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogisticsDashboard;


