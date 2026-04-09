import React, { useState, useRef, useEffect } from 'react';
import { 
    Zap, 
    FolderPlus, 
    ShoppingCart, 
    UserPlus, 
    Truck, 
    FileText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface QuickActionDropdownProps {
    readonly isDark: boolean;
    readonly onNavigateView: (view: string, path?: string) => void;
}

export const QuickActionDropdown: React.FC<QuickActionDropdownProps> = ({ isDark, onNavigateView }) => {
    const { user } = useAuth();
    const isEnglish = (user?.preferredLanguage || 'fr') === 'en';
    const t = (fr: string, en: string) => (isEnglish ? en : fr);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleAction = (view: string, path?: string) => {
        setIsOpen(false);
        onNavigateView(view, path);
    };

    interface ActionItem {
        icon: any;
        label: string;
        view: string;
        path?: string;
        color: string;
        bg: string;
        disabled?: boolean;
    }

    interface ActionGroup {
        category: string;
        items: ActionItem[];
    }

    const actions: ActionGroup[] = [
        {
            category: t("Gestion de projet", "Project Management"),
            items: [
                { icon: FolderPlus, label: t("Creer un projet", "Create New Project"), view: "projects-overview", path: "/projects", color: "text-blue-500", bg: "bg-blue-500/10" }
            ]
        },
        {
            category: t("Supply Chain", "Supply Chain"),
            items: [
                { icon: ShoppingCart, label: t("Nouveau bon de commande", "New Purchase Order"), view: "scm-purchase-orders-new", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { icon: Truck, label: t("Ajouter un fournisseur", "Add Supplier"), view: "scm-suppliers", color: "text-amber-500", bg: "bg-amber-500/10" }
            ]
        },
        {
            category: t("Ressources humaines", "Human Resources"),
            items: [
                { icon: UserPlus, label: t("Ajouter un employe", "Add Employee"), view: "hrm-directory", color: "text-purple-500", bg: "bg-purple-500/10" }
            ]
        },
        {
            category: t("Finance", "Finance"),
            items: [
                { icon: FileText, label: t("Creer une facture", "Create Invoice"), view: "finance-invoices", color: "text-slate-400", bg: "bg-slate-400/10" }
            ]
        }
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="h-8 px-3.5 rounded-md bg-neox-emerald hover:bg-emerald-500 text-black text-[13px] font-medium shadow-sm active:scale-95 transition-all flex items-center gap-2"
            >
                {t('Initier une transaction', 'Initiate Transaction')} <Zap size={13} fill="currentColor" />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute top-full right-0 mt-3 w-72 rounded-xl shadow-2xl border overflow-hidden z-[200]",
                    isDark ? "bg-[#111822] border-[#2d3748]" : "bg-white border-slate-200"
                )}>
                    <div className={cn(
                        "px-4 py-3 border-b flex justify-between items-center",
                        isDark ? "border-[#2d3748] bg-[#1e2d3d]/50" : "border-slate-200 bg-slate-50"
                    )}>
                        <h3 className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-300" : "text-slate-700")}>
                            {t('Actions rapides', 'Quick Actions')}
                        </h3>
                    </div>
                    
                    <div className="max-h-[70vh] overflow-y-auto py-2 custom-scrollbar">
                        {actions.map((group, idx) => (
                            <div key={idx} className="mb-2 last:mb-0">
                                <div className={cn(
                                    "px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                                    isDark ? "text-slate-500" : "text-slate-400"
                                )}>
                                    {group.category}
                                </div>
                                {group.items.map((item, itemIdx) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={itemIdx}
                                            disabled={item.disabled}
                                            onClick={() => !item.disabled && handleAction(item.view, item.path)}
                                            className={cn(
                                                "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                                                isDark 
                                                    ? "hover:bg-[#1e2d3d]" 
                                                    : "hover:bg-slate-50",
                                                item.disabled ? "opacity-50 cursor-not-allowed" : ""
                                            )}
                                        >
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.bg, item.color)}>
                                                <Icon size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <p className={cn(
                                                    "text-[13px] font-medium",
                                                    isDark ? "text-slate-200" : "text-slate-700"
                                                )}>
                                                    {item.label}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
