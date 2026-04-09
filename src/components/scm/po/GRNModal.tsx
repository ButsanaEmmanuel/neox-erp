import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Save, AlertTriangle } from 'lucide-react';
import { PurchaseOrder } from '../../../types/po';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';

interface GRNModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPosted?: (grnNumber: string) => void;
    po: PurchaseOrder;
}

interface GRNFormValues {
    items: {
        poLineId: string;
        description: string;
        qtyOrdered: number;
        qtyReceivedSoFar: number;
        qtyToReceive: number;
        locationId: string;
    }[];
}

export const GRNModal: React.FC<GRNModalProps> = ({ isOpen, onClose, onPosted, po }) => {
    const { createGRN, isLoading } = usePoStore();
    const { locations } = useScmStore();

    // Only show lines that are not fully received
    const openLines = po.lines.filter(l => l.qtyReceived < l.qtyOrdered);

    const { register, control, handleSubmit, formState: { errors } } = useForm<GRNFormValues>({
        defaultValues: {
            items: openLines.map(line => ({
                poLineId: line.id,
                description: line.description,
                qtyOrdered: line.qtyOrdered,
                qtyReceivedSoFar: line.qtyReceived,
                qtyToReceive: line.qtyOrdered - line.qtyReceived, // Default to remaining
                locationId: po.shipToLocationId // Default to PO ship location
            }))
        }
    });

    const { fields } = useFieldArray({
        control,
        name: "items"
    });

    const onSubmit = async (data: GRNFormValues) => {
        // Filter out 0 qty items
        const itemsToReceive = data.items
            .filter(i => i.qtyToReceive > 0)
            .map(i => ({
                poLineId: i.poLineId,
                qty: i.qtyToReceive,
                locationId: i.locationId
            }));

        if (itemsToReceive.length === 0) {
            alert('Please enter quantity to receive for at least one item.');
            return;
        }

        try {
            const result = await createGRN(po.id, itemsToReceive);
            if (result?.grnNumber && onPosted) onPosted(result.grnNumber);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to post GRN');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-app border border-input rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex-none flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-primary">Receive Goods (GRN)</h2>
                        <p className="text-sm text-secondary">Receive items against PO <span className="font-mono text-blue-400">{po.poNumber}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <form id="grn-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                        {openLines.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-input rounded-lg">
                                <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={32} />
                                <p className="text-secondary">All items have been fully received.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-surface text-[10px] font-bold text-muted uppercase tracking-wider border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3 text-right">Ordered</th>
                                        <th className="px-4 py-3 text-right">Received</th>
                                        <th className="px-4 py-3 w-32 text-right">This Receipt</th>
                                        <th className="px-4 py-3 w-48">Location</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className="hover:bg-surface">
                                            <td className="px-4 py-3 text-sm text-secondary font-medium">
                                                {field.description}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-secondary font-mono">
                                                {field.qtyOrdered}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-secondary font-mono">
                                                {field.qtyReceivedSoFar}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    {...register(`items.${index}.qtyToReceive`, { valueAsNumber: true, min: 0, max: field.qtyOrdered - field.qtyReceivedSoFar })}
                                                    className="w-full h-8 bg-surface border border-input rounded px-2 text-sm text-primary focus:border-blue-500 outline-none text-right font-mono"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    {...register(`items.${index}.locationId`)}
                                                    className="w-full h-8 bg-surface border border-input rounded px-2 text-xs text-secondary focus:border-blue-500 outline-none"
                                                >
                                                    {locations.map(l => (
                                                        <option key={l.id} value={l.id}>{l.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                    </form>
                </div>

                {/* Footer */}
                <div className="flex-none p-6 border-t border-border flex items-center justify-end gap-3 bg-surface/50">
                    <button
                        onClick={onClose}
                        className="px-4 h-9 rounded-lg border border-input text-sm font-medium text-secondary hover:text-primary hover:border-input transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="grn-form"
                        disabled={isLoading || openLines.length === 0}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 h-9 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <Save size={16} /> Post GRN
                    </button>
                </div>

            </div>
        </div>
    );
};



