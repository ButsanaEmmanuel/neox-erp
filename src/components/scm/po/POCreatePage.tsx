import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Save, Plus, Trash2, Calendar } from 'lucide-react';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { CreatePODTO } from '../../../types/po';

interface POCreatePageProps {
    onNavigate?: (view: string) => void;
}

export const POCreatePage: React.FC<POCreatePageProps> = ({ onNavigate }) => {
    const { createPO, isLoading } = usePoStore();
    const { suppliers, locations, products } = useScmStore();

    // Default form values
    const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreatePODTO>({
        defaultValues: {
            currency: 'USD',
            paymentTerms: 'Net 30',
            expectedDeliveryDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
            lines: []
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "lines"
    });

    // Auto-fill supplier details
    const selectedSupplierId = watch('supplierId');
    useEffect(() => {
        if (selectedSupplierId) {
            const supplier = suppliers.find(s => s.id === selectedSupplierId);
            if (supplier) {
                if (supplier.paymentTerms) setValue('paymentTerms', supplier.paymentTerms);
                if (supplier.leadTimeDays) {
                    const date = new Date();
                    date.setDate(date.getDate() + supplier.leadTimeDays);
                    setValue('expectedDeliveryDate', date.toISOString().split('T')[0]);
                }
            }
        }
    }, [selectedSupplierId, suppliers, setValue]);

    const onSubmit = async (data: CreatePODTO) => {
        try {
            await createPO(data);
            onNavigate?.('scm-purchase-orders');
        } catch (error) {
            console.error(error);
            alert('Failed to create PO');
        }
    };

    const handleAddLine = () => {
        append({
            itemCode: '',
            description: '',
            productId: null,
            uom: 'pcs',
            qtyOrdered: 1,
            unitPrice: 0,
            discount: 0,
            taxCode: 'VAT0'
        });
    };

    // Watch values for totals calc (simplified for UI)
    const formLines = watch('lines');
    const totalAmount = formLines.reduce((sum, line) => {
        return sum + (line.qtyOrdered * line.unitPrice) * (1 - (line.discount || 0) / 100);
    }, 0);

    return (
        <div className="flex flex-col h-full bg-app text-secondary">
            {/* Header */}
            <div className="flex-none p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => onNavigate?.('scm-purchase-orders')} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-primary">New Purchase Order</h1>
                        <p className="text-sm text-muted">Create a new draft order</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 h-10 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    <Save size={16} />
                    {isLoading ? 'Saving...' : 'Save Draft'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto space-y-8">

                    {/* General Info */}
                    <section className="bg-surface border border-border rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-primary mb-6">General Information</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Supplier</label>
                                <select
                                    {...register('supplierId', { required: true })}
                                    className="w-full h-10 bg-app border border-input rounded-lg px-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                >
                                    <option value="">Select Supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Ship To</label>
                                <select
                                    {...register('shipToLocationId', { required: true })}
                                    className="w-full h-10 bg-app border border-input rounded-lg px-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                >
                                    <option value="">Select Location...</option>
                                    {locations.map(l => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Currency</label>
                                <select
                                    {...register('currency')}
                                    className="w-full h-10 bg-app border border-input rounded-lg px-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                >
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Payment Terms</label>
                                <input
                                    {...register('paymentTerms')}
                                    className="w-full h-10 bg-app border border-input rounded-lg px-3 text-sm focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Expected Delivery</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <input
                                        type="date"
                                        {...register('expectedDeliveryDate', { required: true })}
                                        className="w-full h-10 bg-app border border-input rounded-lg pl-10 pr-3 text-sm focus:border-blue-500 outline-none transition-colors [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Lines */}
                    <section className="bg-surface border border-border rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-primary">Order Lines</h2>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-bold transition-colors"
                            >
                                <Plus size={16} /> Add Line
                            </button>
                        </div>

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-3 items-end bg-app/50 p-4 rounded-lg border border-border/60">
                                    <div className="col-span-3">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">Item / Product</label>
                                        <input
                                            {...register(`lines.${index}.description`, { required: true })}
                                            placeholder="Item Description"
                                            className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-primary focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">SKU / Code</label>
                                        <input
                                            {...register(`lines.${index}.itemCode`)}
                                            placeholder="SKU"
                                            className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-secondary focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">Qty</label>
                                        <input
                                            type="number"
                                            {...register(`lines.${index}.qtyOrdered`, { valueAsNumber: true, min: 1 })}
                                            className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-primary focus:border-blue-500 outline-none text-right"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">UOM</label>
                                        <input
                                            {...register(`lines.${index}.uom`)}
                                            className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-secondary focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">Unit Price</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...register(`lines.${index}.unitPrice`, { valueAsNumber: true })}
                                            className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-primary focus:border-blue-500 outline-none text-right"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-muted uppercase mb-1">Total</label>
                                        <div className="h-8 flex items-center justify-end px-2 text-sm font-mono text-secondary">
                                            {((watch(`lines.${index}.qtyOrdered`) || 0) * (watch(`lines.${index}.unitPrice`) || 0)).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="col-span-1 flex justify-center pb-1">
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-muted hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {fields.length === 0 && (
                                <div className="text-center py-8 border border-dashed border-input rounded-lg">
                                    <p className="text-muted text-sm">No items added yet.</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-border flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm text-secondary">
                                    <span>Subtotal</span>
                                    <span>{totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-input">
                                    <span>Grand Total</span>
                                    <span>{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};


