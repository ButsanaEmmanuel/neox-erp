import React, { useState, useMemo } from 'react';
import {
    MapPin,
    Home,
    Building2,
    Store,
    Layers,
    Users,
    ChevronRight,
    Plus,
    Search,
    Edit2,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { useHRMStore } from '../../store/hrm/useHRMStore';
import { Location, LocationType } from '../../types/scm';
import { LocationModal } from './LocationModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const LOCATION_ICONS: Record<LocationType, any> = {
    'warehouse': Home,
    'site': MapPin,
    'office': Building2,
    'yard': Layers,
    'other': Store
};

const LocationsPage: React.FC = () => {
    const { locations, inventory, products, deleteLocation } = useScmStore();
    const { employees } = useHRMStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [locationToEdit, setLocationToEdit] = useState<Location | null>(null);

    // Get staff countmap
    const staffCountByLocation = useMemo(() => {
        const counts: Record<string, number> = {};
        employees.forEach(emp => {
            if (emp.locationId) {
                counts[emp.locationId] = (counts[emp.locationId] || 0) + 1;
            }
        });
        return counts;
    }, [employees]);

    // Calculate value and SKU count
    const getLocationStats = (locationId: string) => {
        const locationInventory = inventory.filter(item => item.locationId === locationId);
        const skuCount = locationInventory.length;
        const totalValue = locationInventory.reduce((sum, item) => {
            const prod = products.find(p => p.id === item.productId);
            return sum + (item.onHand * (prod?.costPerUnit || 0));
        }, 0);
        return { skuCount, totalValue };
    };

    const filteredLocations = useMemo(() => {
        return locations.filter(loc =>
            loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.facilityLabel?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [locations, searchQuery]);

    const handleEdit = (e: React.MouseEvent, loc: Location) => {
        e.stopPropagation();
        setLocationToEdit(loc);
        setIsModalOpen(true);
    };

    const handleDelete = async (e: React.MouseEvent, loc: Location) => {
        e.stopPropagation();
        const staffCount = staffCountByLocation[loc.id] || 0;
        const { skuCount } = getLocationStats(loc.id);

        if (staffCount > 0) {
            alert(`Cannot delete location "${loc.name}" because it has ${staffCount} staff members assigned. Please reassign them in HRM first.`);
            return;
        }

        if (skuCount > 0) {
            if (!window.confirm(`Location "${loc.name}" has ${skuCount} inventory items. Deleting it will remove this inventory visibility. Are you sure?`)) {
                return;
            }
        } else {
            if (!window.confirm(`Are you sure you want to delete "${loc.name}"?`)) {
                return;
            }
        }

        await deleteLocation(loc.id);
    };

    const handleAdd = () => {
        setLocationToEdit(null);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-app">
            <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search locations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border/80 rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none w-64 focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95"
                >
                    <Plus size={16} /> Add Location
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {filteredLocations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p>No locations found matching "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLocations.map(loc => {
                            const Icon = LOCATION_ICONS[loc.type] || MapPin;
                            const { skuCount, totalValue } = getLocationStats(loc.id);
                            const staffCount = staffCountByLocation[loc.id] || 0;

                            return (
                                <div
                                    key={loc.id}
                                    onClick={() => { setLocationToEdit(loc); setIsModalOpen(true); }}
                                    className="bg-card border border-border rounded-xl p-5 hover:border-input transition-colors cursor-pointer group relative"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleEdit(e, loc)}
                                                className="p-1.5 hover:bg-surface rounded-md text-secondary hover:text-primary"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, loc)}
                                                className="p-1.5 hover:bg-red-500/20 rounded-md text-secondary hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-base font-bold text-primary">{loc.name}</h3>
                                        {loc.facilityLabel && (
                                            <span className="px-1.5 py-0.5 rounded bg-surface border border-input text-[10px] font-mono text-secondary">
                                                {loc.facilityLabel}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted font-medium mb-6 flex items-center gap-1.5 uppercase tracking-tighter truncate">
                                        <MapPin size={10} /> {loc.city ? `${loc.address}, ${loc.city}` : (loc.address || 'No Address')}
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Total Value</span>
                                            <span className="text-sm font-bold text-primary tabular-nums">${totalValue.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Stock Levels</span>
                                            <span className="text-sm font-bold text-primary tabular-nums">{skuCount} SKUs</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-widest" title={`Capacity: ${loc.capacity} ${loc.capacityUnits}`}>
                                                <Layers size={14} /> {loc.capacity ? `${(loc.capacity / 1000).toFixed(1)}k ${loc.capacityUnits}` : 'N/A'}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-widest">
                                                <Users size={14} /> {staffCount} Staff
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <LocationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                locationToEdit={locationToEdit}
            />
        </div>
    );
};

export default LocationsPage;


