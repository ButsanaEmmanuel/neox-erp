import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';

const CreateProductModal: React.FC = () => {
    const {
        isCreateProductModalOpen,
        setCreateProductModalOpen,
        createProduct,
        suppliers,
        categories
    } = useScmStore();

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        status: 'active' as 'active' | 'inactive',
        costPerUnit: 0,
        preferredSupplierId: '',
        tags: [] as string[]
    });

    const [tagInput, setTagInput] = useState('');
    const [skuPreview, setSkuPreview] = useState('---');

    // Reset form when modal opens
    useEffect(() => {
        if (isCreateProductModalOpen) {
            setFormData({
                name: '',
                sku: '',
                category: '',
                status: 'active',
                costPerUnit: 0,
                preferredSupplierId: suppliers[0]?.id || '', // Default to first supplier
                tags: []
            });
            setTagInput('');
        }
    }, [isCreateProductModalOpen, suppliers]);

    // Update SKU Preview
    useEffect(() => {
        const selectedCat = categories.find(c => c.name === formData.category);
        if (selectedCat) {
            setSkuPreview(`${selectedCat.prefix}-${selectedCat.nextSequence.toString().padStart(6, '0')}`);
        } else {
            setSkuPreview('---');
        }
    }, [formData.category, categories]);

    if (!isCreateProductModalOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Add any pending tag
        let finalTags = [...formData.tags];
        if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
            finalTags.push(tagInput.trim());
        }

        if (!formData.preferredSupplierId) {
            alert("Please select a preferred supplier.");
            return;
        }

        await createProduct({
            ...formData,
            tags: finalTags
        });
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-popover border border-border w-[500px] shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Create New Product</h2>
                    <button
                        onClick={() => setCreateProductModalOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:border-brand/50 transition-colors placeholder:text-muted-foreground/50"
                                placeholder="e.g. Brake Caliper"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU <span className="text-[10px] lowercase font-normal">(auto-generated)</span></label>
                            <div className="w-full bg-muted/30 border border-border rounded-lg h-9 px-3 flex items-center text-sm font-mono text-muted-foreground select-none">
                                {skuPreview}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                            <select
                                required
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                            >
                                <option value="">Select Category...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost Per Unit</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.costPerUnit}
                                onChange={e => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) })}
                                className="w-full bg-surface border border-border rounded-lg h-9 pl-6 pr-3 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preferred Supplier <span className="text-rose-500">*</span></label>
                        <select
                            required
                            value={formData.preferredSupplierId}
                            onChange={e => setFormData({ ...formData, preferredSupplierId: e.target.value })}
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                        >
                            <option value="">Select a supplier...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</label>
                        <div className="bg-surface border border-border rounded-lg p-2 flex flex-wrap gap-2 min-h-[42px]">
                            {formData.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-[10px] font-medium text-secondary-foreground border border-border">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                                        className="hover:text-foreground"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                                            setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
                                            setTagInput('');
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                                        setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
                                        setTagInput('');
                                    }
                                }}
                                className="flex-1 bg-transparent text-sm focus:outline-none min-w-[60px]"
                                placeholder={formData.tags.length === 0 ? "Type tags..." : ""}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setCreateProductModalOpen(false)}
                            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            Create Product
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProductModal;


