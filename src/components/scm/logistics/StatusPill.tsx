import React from 'react';
import { Clock, CheckCircle2, MapPin, Truck, Package, AlertTriangle, Boxes, XCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { ShipmentStatus, TransferStatus } from '../../../types/logistics';

export const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, { label: string, color: string, icon: any }> = {
    'DRAFT': { label: 'Draft', color: 'slate', icon: Clock },
    'CONFIRMED': { label: 'Confirmed', color: 'blue', icon: CheckCircle2 },
    'BOOKED': { label: 'Booked', color: 'purple', icon: MapPin },
    'DISPATCHED': { label: 'Dispatched', color: 'amber', icon: Truck },
    'IN_TRANSIT': { label: 'In Transit', color: 'blue', icon: Truck },
    'ARRIVED': { label: 'Arrived', color: 'purple', icon: MapPin },
    'RECEIVING': { label: 'Receiving', color: 'amber', icon: Package },
    'PUT_AWAY': { label: 'Put Away', color: 'emerald', icon: CheckCircle2 },
    'CLOSED': { label: 'Closed', color: 'slate', icon: CheckCircle2 },
    'EXCEPTION_HOLD': { label: 'Exception Hold', color: 'rose', icon: AlertTriangle },
    'DELIVERED': { label: 'Delivered', color: 'emerald', icon: CheckCircle2 },
    'CANCELLED': { label: 'Cancelled', color: 'rose', icon: XCircle }
};

export const TRANSFER_STATUS_CONFIG: Record<TransferStatus, { label: string, color: string, icon: any }> = {
    'REQUESTED': { label: 'Requested', color: 'slate', icon: Clock },
    'APPROVED': { label: 'Approved', color: 'blue', icon: CheckCircle2 },
    'REJECTED': { label: 'Rejected', color: 'rose', icon: XCircle },
    'PICKING': { label: 'Picking', color: 'purple', icon: Package },
    'PICKED': { label: 'Picked', color: 'purple', icon: Package },
    'PACKED': { label: 'Packed', color: 'amber', icon: Boxes },
    'DISPATCHED': { label: 'Dispatched', color: 'amber', icon: Truck },
    'IN_TRANSIT': { label: 'In Transit', color: 'blue', icon: Truck },
    'RECEIVING': { label: 'Receiving', color: 'emerald', icon: Package },
    'RECEIVED': { label: 'Received', color: 'emerald', icon: CheckCircle2 },
    'CLOSED': { label: 'Closed', color: 'slate', icon: CheckCircle2 },
    'EXCEPTION_HOLD': { label: 'Exception Hold', color: 'rose', icon: AlertTriangle },
    'CANCELLED': { label: 'Cancelled', color: 'rose', icon: XCircle }
};

interface StatusPillProps {
    status: ShipmentStatus | TransferStatus;
    type?: 'shipment' | 'transfer';
    className?: string;
    showIcon?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, type = 'shipment', className, showIcon = true }) => {
    let config;
    if (type === 'transfer') {
        config = TRANSFER_STATUS_CONFIG[status as TransferStatus] || { label: status, color: 'slate', icon: Clock };
    } else {
        config = SHIPMENT_STATUS_CONFIG[status as ShipmentStatus] || { label: status, color: 'slate', icon: Clock };
    }

    const Icon = config.icon;

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 w-fit",
            config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
            config.color === 'blue' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
            config.color === 'purple' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
            config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
            config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
            className
        )}>
            {showIcon && <Icon size={14} />} {config.label}
        </span>
    );
};


