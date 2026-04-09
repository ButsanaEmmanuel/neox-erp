import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Box,
    MoreHorizontal,
    PenLine,
    Trash2,
    Save,
    ArrowUpRight
} from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatters';

const ProductDrawer: React.FC = () => {
    // Atomic Selectors
    const products = useScmStore(state => state.products);
    const selectedProductId = useScmStore(state => state.selectedProductId);
    const setSelectedProductId = useScmStore(state => state.setSelectedProductId);
    const updateProduct = useScmStore(state => state.updateProduct);
    const deleteProduct = useScmStore(state => state.deleteProduct);
    const suppliers = useScmStore(state => state.suppliers);
    const setSelectedSupplierId = useScmStore(state => state.setSelectedSupplierId);
    const getProductStockTotals = useScmStore(state => state.getProductStockTotals);
    const inventory = useScmStore(state => state.inventory); // Subscribe to inventory changes for stock totals

    const product = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);
    const [isEditing, setIsEditing] = useState(false);

    // Edit form state
    const [editForm, setEditForm] = useState<any>({});

    useEffect(() => {
        if (product) {
            setEditForm({
                name: product.name,
                sku: product.sku,
                category: product.category,
                status: product.status,
                costPerUnit: product.costPerUnit,
                preferredSupplierId: product.preferredSupplierId,
                tags: product.tags || []
            });
        }
    }, [product]);

    const handleSave = async () => {
        if (!product) return;
        await updateProduct(product.id, editForm);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!product) return;
        if (confirm('Are you sure you want to delete this product?')) {
            await deleteProduct(product.id);
            setSelectedProductId(null);
        }
    };

    const supplier = useMemo(() => {
        if (!product) return undefined;
        return suppliers.find(s => s.id === (isEditing ? editForm.preferredSupplierId : product.preferredSupplierId));
    }, [suppliers, isEditing, editForm.preferredSupplierId, product, product?.preferredSupplierId]);

    const stockLevel = useMemo(() => {
        if (!product) return 0;
        return getProductStockTotals(product.id).onHand;
    }, [product, inventory, getProductStockTotals]);

    if (!selectedProductId || !product) return null;

    const PropertyRow = ({ label, children, className }: { label: string, children: React.ReactNode, className?: string }) => (
        <div className={cn("grid grid-cols-[140px_1fr] gap-4 items-center py-2 h-[40px]", className)}>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <div className="min-w-0 flex items-center">{children}</div>
        </div>
    );

    return (
        <div className="flex flex-col bg-app border-l border-border shadow-2xl z-40 h-full w-full sm:w-[400px] lg:w-[440px] fixed inset-y-0 right-0 md:static md:shadow-none animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-app/50 backdrop-blur-sm z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedProductId(null)}
                        className="p-1.5 -ml-2 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Product Details
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-3 py-1.5 bg-brand text-brand-foreground rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"
                            >
                                <Save size={14} /> Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <PenLine size={16} />
                            </button>
                            <button className="p-2 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                                <MoreHorizontal size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Hero Section */}
                <div className="p-8 pb-8 border-b border-border bg-gradient-to-b from-surface/50 to-transparent">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-input flex items-center justify-center text-amber-500 font-bold text-2xl mb-6 shadow-xl shadow-amber-900/10">
                        <Box size={32} />
                    </div>

                    {isEditing ? (
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="text-2xl font-bold bg-muted/50 border border-transparent focus:border-border rounded px-2 -ml-2 w-full text-foreground focus:outline-none mb-2"
                        />
                    ) : (
                        <h1 className="text-2xl font-bold text-foreground mb-2">{product.name}</h1>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                        <div className="flex items-center gap-2 font-mono text-xs bg-surface px-2 py-1 rounded border border-border">
                            {isEditing ? (
                                <input
                                    value={editForm.sku}
                                    onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                                    className="bg-transparent w-24 focus:outline-none"
                                />
                            ) : product.sku}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "w-2 h-2 rounded-full",
                                (isEditing ? editForm.status : product.status) === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-muted-foreground"
                            )} />
                            {isEditing ? (
                                <select
                                    value={editForm.status}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                    className="bg-transparent focus:outline-none border-b border-muted-foreground/30 text-xs"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            ) : (
                                <span className="capitalize">{(product.status)}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Sections */}
                <div className="p-6 space-y-8">
                    {/* Key Properties */}
                    <section>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Properties</h3>
                        <div className="space-y-0 text-sm">
                            <PropertyRow label="Category">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editForm.category}
                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                        className="h-7 bg-muted/50 rounded px-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                ) : (
                                    <span className="text-foreground">{product.category}</span>
                                )}
                            </PropertyRow>

                            <PropertyRow label="Cost Per Unit">
                                {isEditing ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <span className="text-muted-foreground">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.costPerUnit}
                                            onChange={e => setEditForm({ ...editForm, costPerUnit: parseFloat(e.target.value) })}
                                            className="h-7 bg-muted/50 rounded px-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-foreground">{formatCurrency(product.costPerUnit)}</span>
                                )}
                            </PropertyRow>

                            <PropertyRow label="Stock Level">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "font-bold",
                                        stockLevel === 0 ? "text-rose-500" :
                                            stockLevel < 20 ? "text-amber-500" : "text-emerald-500"
                                    )}>{stockLevel}</span>
                                    <span className="text-muted-foreground text-xs">units</span>
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Preferred Supplier">
                                {isEditing ? (
                                    <select
                                        value={editForm.preferredSupplierId}
                                        onChange={e => setEditForm({ ...editForm, preferredSupplierId: e.target.value })}
                                        className="h-7 bg-muted/50 rounded px-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="">Select supplier...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => supplier && setSelectedSupplierId(supplier.id)}>
                                        <div className="w-5 h-5 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-bold">
                                            {supplier?.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-foreground group-hover:text-primary transition-colors underline decoration-dotted decoration-border group-hover:decoration-primary underline-offset-4">
                                            {supplier?.name || "Unknown"}
                                        </span>
                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                    </div>
                                )}
                            </PropertyRow>

                            <div className="grid grid-cols-[140px_1fr] gap-4 items-start py-2 min-h-[40px]">
                                <div className="flex items-center gap-2 text-muted-foreground pt-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">Tags</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    {isEditing ? (
                                        <div className="flex flex-wrap gap-2">
                                            {(editForm.tags || []).map((tag: string) => (
                                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-[10px] font-medium text-secondary-foreground border border-border">
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditForm((prev: any) => ({ ...prev, tags: (prev.tags || []).filter((t: string) => t !== tag) }))}
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
                                                        e.preventDefault();
                                                        const val = e.currentTarget.value.trim();
                                                        if (val && !(editForm.tags || []).includes(val)) {
                                                            setEditForm((prev: any) => ({ ...prev, tags: [...(prev.tags || []), val] }));
                                                            e.currentTarget.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {product.tags && product.tags.length > 0 ? (
                                                product.tags.map(tag => (
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

                    {/* Metadata */}
                    <div className="pt-8 border-t border-border mt-auto">
                        {isEditing && (
                            <button
                                onClick={handleDelete}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors mb-6"
                            >
                                <Trash2 size={14} /> Delete Product
                            </button>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-[11px] text-muted-foreground">
                            <div>
                                <span className="block font-bold mb-1">Created</span>
                                {new Date(product.createdAt).toLocaleDateString()}
                            </div>
                            <div>
                                <span className="block font-bold mb-1">ID</span>
                                <span className="font-mono">{product.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDrawer;


