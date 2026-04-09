import React, { useState, useEffect } from 'react';
import { useScmStore } from '../../store/scm/useScmStore';
import { UpdateSupplierDTO, SupplierStatus } from '../../types/scm';
import {
    X, Star, Clock, MapPin, Globe, ExternalLink,
    Phone, Mail, UserPlus,
    Loader2, Save, PenLine, Trash2, CreditCard
} from 'lucide-react';
import { cn } from '../../utils/cn';
import AddContactModal from './AddContactModal';

const PropertyRow = ({
    icon: Icon,
    label,
    value,
    isEditing,
    editValue,
    onChange,
    placeholder,
    type = "text"
}: {
    icon: any,
    label: string,
    value: React.ReactNode,
    isEditing: boolean,
    editValue?: string | number,
    onChange?: (val: string) => void,
    placeholder?: string,
    type?: "text" | "number"
}) => (
    <div className="grid grid-cols-[140px_1fr] gap-4 items-center py-2 h-10">
        <div className="flex items-center gap-2 text-muted-foreground">
            <Icon size={14} />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="min-w-0 flex-1">
            {isEditing && onChange ? (
                <input
                    type={type}
                    value={editValue || ''}
                    onChange={e => onChange(e.target.value)}
                    className="w-full h-8 px-2 rounded-md bg-muted/50 border-input text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 transition-all"
                    placeholder={placeholder}
                />
            ) : (
                <div className="text-sm text-foreground truncate">{value || <span className="text-muted-foreground/30">—</span>}</div>
            )}
        </div>
    </div>
);

const SupplierDrawer: React.FC = () => {
    const {
        suppliers,
        selectedSupplierId,
        setSelectedSupplierId,
        updateSupplier,
        deleteSupplier,
        setAddContactModalOpen,
        loading
    } = useScmStore();

    const supplier = suppliers.find(s => s.id === selectedSupplierId) || null;
    const open = !!supplier;

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<UpdateSupplierDTO>({});

    // Reset edit state when supplier changes or drawer closes
    useEffect(() => {
        if (open && supplier) {
            setIsEditing(false);
            setEditForm({
                name: supplier.name,
                status: supplier.status,
                rating: supplier.rating,
                leadTimeDays: supplier.leadTimeDays,
                tags: supplier.tags,
                email: supplier.email,
                phone: supplier.phone,
                address: supplier.address,
                description: supplier.description,
                paymentTerms: supplier.paymentTerms,
            });
        }
    }, [open, supplier]);

    if (!open || !supplier) return null;

    const onClose = () => setSelectedSupplierId(null);

    const handleSave = async () => {
        if (!supplier) return;
        await updateSupplier(supplier.id, editForm);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!supplier || !window.confirm('Are you sure you want to delete this supplier?')) return;
        await deleteSupplier(supplier.id);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] transition-opacity duration-300",
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={cn(
                "fixed inset-y-0 right-0 w-[500px] bg-card border-l border-border shadow-2xl z-[100] flex flex-col transform transition-transform duration-300 ease-in-out",
                open ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="flex-none p-6 border-b border-border">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex gap-4 flex-1 min-w-0 items-center">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-900/20 flex items-center justify-center text-primary font-bold text-xl flex-none">
                                {supplier.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full text-xl font-bold bg-muted/50 rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Supplier Name"
                                    />
                                ) : (
                                    <h2 className="text-xl font-bold text-foreground tracking-tight truncate">{supplier.name}</h2>
                                )}
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <select
                                            value={editForm.status}
                                            onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as SupplierStatus }))}
                                            className="h-6 text-xs bg-muted/50 rounded px-2 text-foreground font-medium focus:outline-none"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="on-hold">On Hold</option>
                                        </select>
                                    ) : (
                                        <div className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                            supplier.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                supplier.status === 'inactive' ? "bg-slate-500/10 text-muted border-slate-500/20" :
                                                    "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        )}>
                                            {supplier.status}
                                        </div>
                                    )}

                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-muted/50 rounded px-2 h-6">
                                            <Star size={12} className="text-muted-foreground" />
                                            <input
                                                type="number"
                                                min="0" max="5" step="0.1"
                                                value={editForm.rating}
                                                onChange={e => setEditForm(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                                                className="w-8 bg-transparent text-xs font-medium focus:outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-bold">
                                            <Star size={10} fill="currentColor" />
                                            <span>{supplier.rating}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Edit Supplier">
                                    <PenLine size={16} />
                                </button>
                            )}
                            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 h-9 bg-blue-600 text-white hover:bg-blue-500 rounded-md text-sm font-bold transition-all shadow-sm shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Supplier
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="h-9 px-4 border border-input bg-transparent hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button className="flex-1 h-9 bg-blue-600 text-white hover:bg-blue-500 rounded-md text-sm font-bold transition-all shadow-sm shadow-blue-900/20 active:scale-95">
                                Create Purchase Order
                            </button>
                            <button
                                onClick={handleDelete}
                                className="h-9 w-9 flex items-center justify-center border border-input bg-transparent hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 rounded-md transition-colors text-muted-foreground"
                                title="Delete Supplier"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-8">

                        {/* About Section */}
                        <section className="space-y-3">
                            <h3 className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest pl-1">About</h3>
                            <div className="bg-card rounded-lg border border-border/50 overflow-hidden divide-y divide-border/50">
                                <PropertyRow
                                    icon={Clock}
                                    label="Lead Time (Days)"
                                    value={supplier.leadTimeDays}
                                    isEditing={isEditing}
                                    editValue={editForm.leadTimeDays}
                                    onChange={v => setEditForm(prev => ({ ...prev, leadTimeDays: parseInt(v) || 0 }))}
                                    type="number"
                                />
                                <PropertyRow
                                    icon={MapPin}
                                    label="Location"
                                    value={supplier.address}
                                    isEditing={isEditing}
                                    editValue={editForm.address}
                                    onChange={v => setEditForm(prev => ({ ...prev, address: v }))}
                                    placeholder="Enter address..."
                                />
                                <PropertyRow
                                    icon={Globe}
                                    label="Website"
                                    value={supplier.description ?
                                        <a href="#" className="text-blue-500 hover:underline flex items-center gap-1">{supplier.description} <ExternalLink size={10} /></a> : null
                                    }
                                    isEditing={isEditing}
                                    editValue={editForm.description}
                                    onChange={v => setEditForm(prev => ({ ...prev, description: v }))} // Note: mapping description to website for now per previous schema
                                    placeholder="www.example.com"
                                />
                                <PropertyRow
                                    icon={CreditCard}
                                    label="Payment Terms"
                                    value={supplier.paymentTerms}
                                    isEditing={isEditing}
                                    editValue={editForm.paymentTerms}
                                    onChange={v => setEditForm(prev => ({ ...prev, paymentTerms: v }))}
                                    placeholder="e.g. Net 30"
                                />
                                <PropertyRow
                                    icon={Mail}
                                    label="Email"
                                    value={supplier.email}
                                    isEditing={isEditing}
                                    editValue={editForm.email}
                                    onChange={v => setEditForm(prev => ({ ...prev, email: v }))}
                                    placeholder="contact@supplier.com"
                                />
                                <PropertyRow
                                    icon={Phone}
                                    label="Phone"
                                    value={supplier.phone}
                                    isEditing={isEditing}
                                    editValue={editForm.phone}
                                    onChange={v => setEditForm(prev => ({ ...prev, phone: v }))}
                                    placeholder="+1 (555) 000-0000"
                                />

                                {/* Tags Row */}
                                <div className="grid grid-cols-[140px_1fr] gap-4 items-start py-2 min-h-[40px]">
                                    <div className="flex items-center gap-2 text-muted-foreground pt-1.5">
                                        <div className="w-3.5 h-3.5 flex items-center justify-center">#</div>
                                        <span className="text-xs font-medium text-muted-foreground">Tags</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="flex flex-wrap gap-2">
                                                {(editForm.tags || []).map(tag => (
                                                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-[10px] font-medium text-secondary-foreground border border-border">
                                                        {tag}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditForm(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }))}
                                                            className="hover:text-foreground"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    className="h-6 bg-muted/50 rounded px-2 text-xs w-24 focus:w-32 transition-all focus:outline-none focus:ring-1 focus:ring-primary"
                                                    placeholder="+ Add tag"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault(); // Prevent accidental form submit issues if any
                                                            const val = e.currentTarget.value.trim();
                                                            if (val && !(editForm.tags || []).includes(val)) {
                                                                setEditForm(prev => ({ ...prev, tags: [...(prev.tags || []), val] }));
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {supplier.tags && supplier.tags.length > 0 ? (
                                                    supplier.tags.map(tag => (
                                                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded bg-secondary/50 text-secondary-foreground border border-border text-[11px]">
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground/30 text-sm">—</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Contacts Section */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">People</h3>
                                <button
                                    onClick={() => setAddContactModalOpen(true)}
                                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                    title="Add Contact"
                                >
                                    <UserPlus size={14} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {supplier.contacts && supplier.contacts.length > 0 ? (
                                    supplier.contacts.map((contact, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border bg-card/50 hover:border-primary/20 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold text-xs">
                                                    {contact.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                                                    <p className="text-xs text-muted-foreground">{contact.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Mail size={14} /></button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-6 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-center bg-muted/5">
                                        <p className="text-xs text-muted-foreground">No contacts linked</p>
                                        <button onClick={() => setAddContactModalOpen(true)} className="mt-2 text-xs text-blue-500 hover:underline">Add someone</button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                <AddContactModal />
            </div>
        </>
    );
};

export default SupplierDrawer;


