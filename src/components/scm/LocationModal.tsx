import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { Location, LocationType } from '../../types/scm';
import { useScmStore } from '../../store/scm/useScmStore';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    locationToEdit?: Location | null;
}

type FormData = {
    name: string;
    type: LocationType;
    facilityLabel?: string;
    address?: string;
    city?: string;
    country?: string;
    capacity?: number;
    capacityUnits?: string;
    status: 'active' | 'inactive';
};

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, locationToEdit }) => {
    const { createLocation, updateLocation } = useScmStore();
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            name: '',
            type: 'warehouse',
            status: 'active'
        }
    });

    useEffect(() => {
        if (locationToEdit) {
            setValue('name', locationToEdit.name);
            setValue('type', locationToEdit.type);
            setValue('facilityLabel', locationToEdit.facilityLabel || '');
            setValue('address', locationToEdit.address || '');
            setValue('city', locationToEdit.city || '');
            setValue('country', locationToEdit.country || '');
            setValue('capacity', locationToEdit.capacity);
            setValue('capacityUnits', locationToEdit.capacityUnits || '');
            setValue('status', locationToEdit.status as 'active' | 'inactive');
        } else {
            reset({
                name: '',
                type: 'warehouse',
                facilityLabel: '',
                address: '',
                city: '',
                country: '',
                status: 'active'
            });
        }
    }, [locationToEdit, isOpen, setValue, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            if (locationToEdit) {
                await updateLocation(locationToEdit.id, data);
            } else {
                await createLocation({
                    ...data,
                    id: `loc-${Date.now()}`,
                    // Providing default values for required fields that might be missing from form
                } as Location);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save location:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold text-primary">
                        {locationToEdit ? 'Edit Location' : 'New Location'}
                    </h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-secondary">Name</label>
                        <input
                            {...register('name', { required: 'Name is required' })}
                            className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Chicago Distribution Center"
                        />
                        {errors.name && <span className="text-xs text-red-400">{errors.name.message}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Type</label>
                            <select
                                {...register('type')}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="warehouse">Warehouse</option>
                                <option value="site">Site</option>
                                <option value="office">Office</option>
                                <option value="yard">Yard</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Facility Code</label>
                            <input
                                {...register('facilityLabel')}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. CDC-01"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-secondary">Address</label>
                        <input
                            {...register('address')}
                            className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Street Address"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">City</label>
                            <input
                                {...register('city')}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="City"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Country</label>
                            <input
                                {...register('country')}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Country"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Capacity</label>
                            <input
                                type="number"
                                {...register('capacity', { valueAsNumber: true })}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Units</label>
                            <input
                                {...register('capacityUnits')}
                                className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. sqft, pallets"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                        >
                            {locationToEdit ? 'Save Changes' : 'Create Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


