import React from 'react';
import {
    Truck,
    MapPin,
    Package,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Search,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import { useSCM } from '../../contexts/SCMContext';
import { ShipmentStatus } from '../../types/scm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const STATUS_CONFIG: Record<ShipmentStatus, { label: string, color: string, icon: any }> = {
    'planned': { label: 'Planned', color: 'slate', icon: Clock },
    'scheduled': { label: 'Scheduled', color: 'blue', icon: Clock },
    'in-transit': { label: 'In Transit', color: 'blue', icon: Truck },
    'delivered': { label: 'Delivered', color: 'emerald', icon: CheckCircle2 },
    'delayed': { label: 'Delayed', color: 'rose', icon: AlertTriangle },
    'cancelled': { label: 'Cancelled', color: 'rose', icon: AlertCircle },
    'exception': { label: 'Exception', color: 'rose', icon: AlertTriangle }
};

const ShipmentsPage: React.FC = () => {
    const { shipments, locations, suppliers } = useSCM();

    const getLocation = (id?: string) => locations.find(l => l.id === id);
    const getSupplier = (id?: string) => suppliers.find(s => s.id === id);

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-app">
            <div className="p-6 border-b border-border flex items-center justify-between">
                <h1 className="text-xl font-bold text-primary tracking-tight">Logistics & Shipments</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input type="text" placeholder="Tracking ID..." className="bg-surface border border-border/80 rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none w-48" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-3 border-b border-border grid grid-cols-[140px_1fr_180px_180px_120px_40px] items-center gap-4">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Reference</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Origin / Supplier</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Destination</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Estimated Arrival</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest uppercase">Status</span>
                    <span />
                </div>

                {shipments.map(ship => {
                    const originSupplier = getSupplier(ship.supplierId);
                    const originLoc = getLocation(ship.originLocationId);
                    const destLoc = getLocation(ship.destinationLocationId);
                    const Config = STATUS_CONFIG[ship.status];

                    return (
                        <div key={ship.id} className="px-6 h-[72px] border-b border-border/60 grid grid-cols-[140px_1fr_180px_180px_120px_40px] items-center gap-4 hover:bg-surface transition-colors cursor-pointer group">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-primary tracking-widest uppercase">{ship.reference}</span>
                                <span className="text-[10px] text-muted font-bold uppercase tracking-tighter">{ship.carrier}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-border/80 flex items-center justify-center text-muted">
                                    {ship.type === 'inbound' ? <Package size={14} /> : <Truck size={14} />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] text-primary font-medium truncate">
                                        {originSupplier?.name || originLoc?.name || 'External'}
                                    </span>
                                    <span className="text-[10px] text-muted flex items-center gap-1 uppercase font-bold tracking-tight">
                                        <MapPin size={10} /> {ship.type.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[13px] text-primary font-semibold">{destLoc?.name || 'TBD'}</span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[13px] text-primary tabular-nums">{new Date(ship.eta).toLocaleDateString()}</span>
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">On Schedule</span>
                            </div>

                            <div>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1.5 w-fit",
                                    Config.color === 'blue' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                        Config.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                            "bg-white/5 text-muted border-input"
                                )}>
                                    <Config.icon size={10} /> {Config.label}
                                </span>
                            </div>

                            <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface rounded-md text-muted transition-all">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ShipmentsPage;


