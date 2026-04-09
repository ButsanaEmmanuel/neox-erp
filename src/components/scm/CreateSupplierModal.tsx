import React, { useState } from 'react';
import { useScmStore } from '../../store/scm/useScmStore';
import { CreateSupplierDTO, SupplierStatus } from '../../types/scm';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const CreateSupplierModal: React.FC = () => {
    const { createSupplier, loading, isCreateModalOpen, setCreateModalOpen } = useScmStore();
    const [formData, setFormData] = useState<CreateSupplierDTO>({
        name: '',
        status: 'active',
        rating: 0,
        leadTimeDays: 0,
        tags: [],
        email: '',
        description: ''
    });

    const [tagInput, setTagInput] = useState('');

    if (!isCreateModalOpen) return null;

    const onClose = () => setCreateModalOpen(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        await createSupplier(formData);
        // Modal closing handled by store in createSupplier action usually, 
        // but explicit close here is safe too or if action doesn't auto-close.
        // In useScmStore check, I added isCreateModalOpen: false update in createSupplier.

        // Reset form
        setFormData({
            name: '',
            status: 'active',
            rating: 0,
            leadTimeDays: 0,
            tags: [],
            email: '',
            description: ''
        });
    };



    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }));
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none p-4">
                <div
                    className="w-full max-w-[500px] bg-card border border-border rounded-xl shadow-2xl pointer-events-auto flex flex-col animate-in zoom-in-95 duration-200"

                >
                    <div className="p-5 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">New Supplier</h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-foreground">Supplier Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input text-sm placeholder:text-muted-foreground"
                                    placeholder="e.g. Acme Industries"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Status & Rating Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-medium text-foreground">Status</label>
                                    <div className="relative">
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value as SupplierStatus })}
                                            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input text-sm appearance-none"
                                        >
                                            <option value="active" className="bg-surface text-primary">Active</option>
                                            <option value="inactive" className="bg-surface text-primary">Inactive</option>
                                            <option value="on-hold" className="bg-surface text-primary">On Hold</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-medium text-foreground">Rating (0-5)</label>
                                    <input
                                        type="number"
                                        min="0" max="5" step="0.1"
                                        value={formData.rating}
                                        onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                                        className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input text-sm"
                                    />
                                </div>
                            </div>

                            {/* Lead Time */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-foreground">Lead Time (Days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.leadTimeDays}
                                    onChange={e => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) })}
                                    className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input text-sm"
                                />
                            </div>

                            {/* Tags */}
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-foreground">Tags</label>
                                <div className="min-h-[40px] px-3 py-1.5 rounded-md border border-input bg-transparent text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:border-input flex flex-wrap gap-2">
                                    {formData.tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-[11px] font-medium text-secondary-foreground border border-border">
                                            {tag}
                                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-foreground"><X size={12} /></button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault(); // Always prevent form submit on Enter in tag field
                                                if (tagInput.trim()) {
                                                    const newTags = tagInput.split(',').map(t => t.trim()).filter(t => t);
                                                    const uniqueTags = newTags.filter(t => !formData.tags.includes(t));

                                                    if (uniqueTags.length > 0) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            tags: [...prev.tags, ...uniqueTags]
                                                        }));
                                                    }
                                                    setTagInput('');
                                                }
                                            }
                                        }}
                                        onBlur={() => {
                                            if (tagInput.trim()) {
                                                if (!formData.tags.includes(tagInput.trim())) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        tags: [...prev.tags, tagInput.trim()]
                                                    }));
                                                }
                                                setTagInput('');
                                            }
                                        }}
                                        className="flex-1 bg-transparent text-sm min-w-[80px] focus:outline-none h-7 placeholder:text-muted-foreground"
                                        placeholder="Add tag (Press Enter)..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 text-sm font-bold text-primary bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-blue-900/20 active:scale-95"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                Create Supplier
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default CreateSupplierModal;


