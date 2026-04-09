import React, { useState, useEffect } from 'react';
import { useScmStore } from '../../store/scm/useScmStore';
import { CreateCategoryDTO, UpdateCategoryDTO, ScmCategory, StockAlertSettings } from '../../types/scm';
import { cn } from '../../utils/cn';
import {
    Settings,
    Tags,
    Archive,
    Plus,
    Search,
    Edit2,
    Lock,
    AlertTriangle,
    Ruler,
    Trash2
} from 'lucide-react';

const ScmConfiguration: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'sku-rules' | 'stock-alerts'>('categories');

    return (
        <div className="flex flex-col h-full bg-app text-foreground animate-in fade-in duration-500">
            {/* Top Navigation Bar */}
            <div className="border-b border-border/40 bg-surface/30 px-8 py-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                            <Settings size={20} className="text-emerald-500" />
                            Configuration
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5 ml-7">Manage your SCM settings and preferences.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all border border-transparent",
                            activeTab === 'categories'
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                    >
                        <Tags size={14} /> Categories
                    </button>
                    <button
                        onClick={() => setActiveTab('stock-alerts')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all border border-transparent",
                            activeTab === 'stock-alerts'
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                    >
                        <AlertTriangle size={14} /> Stock Alerts
                    </button>
                    <button
                        disabled
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold text-muted-foreground/40 cursor-not-allowed"
                    >
                        <Ruler size={14} /> Units
                    </button>
                </div>
            </div>

            {/* Main Action Bar (Float right in header) */}
            {activeTab === 'categories' && (
                <div className="absolute top-6 right-8">
                    <button
                        onClick={() => document.dispatchEvent(new CustomEvent('open-category-modal'))}
                        className={cn(
                            "flex items-center gap-2 px-4 h-8 rounded-lg font-bold text-[12px] transition-all shadow-lg active:scale-95",
                            "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
                        )}
                    >
                        <Plus size={14} /> New Category
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-app overflow-hidden">
                {activeTab === 'categories' && <CategoriesTab />}
                {activeTab === 'stock-alerts' && <StockAlertsTab />}
            </div>
        </div>
    );
};

// --- Sub-Components ---

const StockAlertsTab: React.FC = () => {
    const { stockAlertSettings, updateStockAlertSettings } = useScmStore();
    const [localSettings, setLocalSettings] = useState<StockAlertSettings>(stockAlertSettings);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync local state when store updates
    useEffect(() => {
        setLocalSettings(stockAlertSettings);
        setHasChanges(false);
    }, [stockAlertSettings]);

    const handleThresholdChange = (key: 'low' | 'critical', value: string) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0) return;

        setLocalSettings(prev => ({
            ...prev,
            defaultThresholds: {
                ...prev.defaultThresholds,
                [key]: numValue
            }
        }));
        setHasChanges(true);
    };

    const handleToggleEnable = () => {
        setLocalSettings(prev => ({ ...prev, enabled: !prev.enabled }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if ((localSettings.defaultThresholds.critical ?? 0) > (localSettings.defaultThresholds.low ?? 0)) {
            return;
        }
        updateStockAlertSettings(localSettings);
        setHasChanges(false);
    };

    const isValid = (localSettings.defaultThresholds.critical ?? 0) <= (localSettings.defaultThresholds.low ?? 0);

    return (
        <div className="flex-1 flex flex-col h-full bg-app">
            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-8">
                <div className="max-w-2xl space-y-10">

                    {/* Section 1: Activation */}
                    <div className="flex items-start justify-between group">
                        <div className="space-y-1 max-w-sm">
                            <label className="text-[13px] font-medium text-foreground">Enable Stock Alerts</label>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                                When enabled, products falling below configured thresholds will trigger visual warnings in the inventory list.
                            </p>
                        </div>
                        <button
                            onClick={handleToggleEnable}
                            className={cn(
                                "w-11 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 border-2 border-transparent",
                                localSettings.enabled ? "bg-emerald-500" : "bg-muted"
                            )}
                        >
                            <span className={cn(
                                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                                localSettings.enabled ? "translate-x-5" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    <div className="h-px bg-border/40 w-full" />

                    {/* Section 2: Thresholds */}
                    <div className={cn("space-y-6 transition-opacity duration-200", !localSettings.enabled && "opacity-50 pointer-events-none")}>
                        <div>
                            <h3 className="text-[13px] font-medium text-foreground mb-1">Stock Thresholds</h3>
                            <p className="text-[12px] text-muted-foreground">Define the global trigger points for low and critical stock states.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                            {/* Low Stock Input */}
                            <div className="group">
                                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                    Low Stock
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localSettings.defaultThresholds.low}
                                        onChange={(e) => handleThresholdChange('low', e.target.value)}
                                        className="w-full bg-surface border border-border rounded-md h-9 pl-3 pr-12 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Units</span>
                                    </div>
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-amber-500 opacity-60" />
                                </div>
                                <p className="mt-1.5 text-[11px] text-muted-foreground group-focus-within:text-foreground transition-colors">
                                    Triggers "Low" warning status.
                                </p>
                            </div>

                            {/* Critical Stock Input */}
                            <div className="group">
                                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                    Critical Stock
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={localSettings.defaultThresholds.critical}
                                        onChange={(e) => handleThresholdChange('critical', e.target.value)}
                                        className={cn(
                                            "w-full bg-surface border border-border rounded-md h-9 pl-3 pr-12 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30",
                                            !isValid && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                                        )}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Units</span>
                                    </div>
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-rose-500 opacity-60" />
                                </div>
                                <p className={cn(
                                    "mt-1.5 text-[11px] transition-colors",
                                    isValid ? "text-muted-foreground group-focus-within:text-foreground" : "text-rose-500 font-medium"
                                )}>
                                    {isValid ? "Triggers \"Critical\" warning status." : "Must be less than Low threshold."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Bar - Only visible if changes */}
            {hasChanges && (
                <div className="border-t border-border bg-surface/50 backdrop-blur px-8 py-4 flex items-center justify-between animate-in slide-in-from-bottom-2 fade-in">
                    <span className="text-[12px] font-medium text-amber-500 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Unsaved changes
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setLocalSettings(stockAlertSettings);
                                setHasChanges(false);
                            }}
                            className="bg-surface hover:bg-muted text-muted-foreground hover:text-foreground border border-border h-9 px-4 rounded-lg text-[13px] font-medium transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isValid}
                            className={cn(
                                "h-9 px-6 rounded-lg text-[13px] font-bold transition-all shadow-sm flex items-center gap-2",
                                isValid
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                            )}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CategoriesTab: React.FC = () => {
    const { categories, fetchCategories, createCategory, updateCategory, archiveCategory, deleteCategory } = useScmStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ScmCategory | null>(null);

    useEffect(() => {
        fetchCategories();

        const handleOpenModal = () => setIsCreateModalOpen(true);
        document.addEventListener('open-category-modal', handleOpenModal);
        return () => document.removeEventListener('open-category-modal', handleOpenModal);
    }, [fetchCategories]);

    const handleCreate = async (data: CreateCategoryDTO | UpdateCategoryDTO) => {
        await createCategory(data as CreateCategoryDTO);
        setIsCreateModalOpen(false);
    };

    const handleUpdate = async (id: string, data: UpdateCategoryDTO) => {
        await updateCategory(id, data);
        setEditingCategory(null);
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">


            <div className="flex-1 overflow-auto p-8">
                {/* Search */}
                <div className="relative max-w-md mb-6">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-brand/50 transition-colors w-full placeholder:text-muted-foreground"
                    />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(category => (
                        <div key={category.id} className="p-4 rounded-xl border border-border bg-app hover:border-brand/50 transition-all group">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-muted-foreground">
                                    <Tags size={14} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingCategory(category)}
                                        className="p-1 hover:bg-surface rounded text-muted-foreground hover:text-foreground"
                                        title="Edit"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => archiveCategory(category.id)}
                                        className="p-1 hover:bg-surface rounded text-muted-foreground hover:text-amber-500"
                                        title="Archive"
                                    >
                                        <Archive size={14} />
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to permanently delete this category?')) {
                                                deleteCategory(category.id);
                                            }
                                        }}
                                        className="p-1 hover:bg-surface rounded text-muted-foreground hover:text-red-500"
                                        title="Delete Permanently"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-[13px]">{category.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-surface border border-border px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground">
                                    {category.prefix}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    Next SKU: #{category.nextSequence}
                                </span>
                            </div>
                            <div className="mt-3">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                    category.status === 'active'
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                        : "bg-surface text-muted-foreground border-border"
                                )}>
                                    {category.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <CategoryModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreate}
                title="New Category"
            />
            {editingCategory && (
                <CategoryModal
                    isOpen={!!editingCategory}
                    onClose={() => setEditingCategory(null)}
                    onSubmit={(data) => handleUpdate(editingCategory.id, data)}
                    initialData={editingCategory}
                    title="Edit Category"
                />
            )}
        </div>
    );
};

// --- Category Modal Component ---

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateCategoryDTO | UpdateCategoryDTO) => void;
    initialData?: ScmCategory;
    title: string;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSubmit, initialData, title }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [prefix, setPrefix] = useState(initialData?.prefix || '');
    const [nextSequence, setNextSequence] = useState(initialData?.nextSequence?.toString() || '1');

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setPrefix(initialData?.prefix || '');
            setNextSequence(initialData?.nextSequence?.toString() || '1');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            name,
            prefix: prefix.toUpperCase(),
            nextSequence: parseInt(nextSequence) || 1
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-popover border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden scale-in-95 animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <Plus size={18} className="rotate-45" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                            Category Name
                        </label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            placeholder="e.g. Brakes"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                Prefix {initialData && <Lock size={10} className="text-muted-foreground" />}
                            </label>
                            <input
                                required
                                type="text"
                                maxLength={6}
                                value={prefix}
                                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                                disabled={!!initialData} // Lock prefix on edit for now
                                className={cn(
                                    "w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono uppercase",
                                    initialData && "opacity-50 cursor-not-allowed"
                                )}
                                placeholder="BRK"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                Next Sequence
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={nextSequence}
                                onChange={(e) => setNextSequence(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-surface transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            {initialData ? 'Save Changes' : 'Create Category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScmConfiguration;



