import React, { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Target,
    Truck,
    BarChart3,
    FileText,
    Users,
    ShieldCheck,
    Settings,
    ChevronUp,
    ChevronDown,
    Box,
    Package,

    MapPin,
    ClipboardList,
    UserPlus,
    UserMinus,
    Briefcase,
    Clock,
    CalendarOff,
    GraduationCap,
    BookOpen,
    AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/pm/useProjectStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import sidebarConfig from '../config/sidebar.config.json';
import { apiRequest } from '../lib/apiClient';
import {
    hasDepartmentAccess,
    isGlobalAdmin,
    isSelfServiceModule,
    type ModuleConfigItem,
} from '../lib/navigationAccess';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SidebarProps {
    readonly isDark: boolean;
    readonly activeView: string;
    readonly onViewChange: (view: string) => void;
}

interface NavSubmenuItem {
    id: string;
    label: string;
    icon?: React.ComponentType<any> | string;
    expandable?: boolean;
    subItems?: NavSubmenuItem[];
    isSelfService?: boolean;
}

const CRM_SUBMENU = (sidebarConfig.submenu?.crm as Array<{ id: string; label: string; expandable?: boolean }>)?.map((item) => ({
    ...item,
    isSelfService: item.id === 'crm-overview',
})) || [
    { id: 'crm-overview', label: 'Overview', expandable: false, isSelfService: true },
    { id: 'crm-pipeline', label: 'Pipeline', expandable: true, isSelfService: false },
    { id: 'crm-contacts', label: 'Contacts', expandable: true, isSelfService: false },
    { id: 'crm-activity-module', label: 'Tasks & Activity', expandable: true, isSelfService: false },
];

const FINANCE_SUBMENU = (sidebarConfig.submenu?.finance as Array<{ id: string; label: string; expandable?: boolean }>) || [
    { id: 'finance-overview', label: 'Overview', expandable: false },
    { id: 'finance-transactions', label: 'Transactions', expandable: false },
    { id: 'finance-reconciliation', label: 'Reconciliation', expandable: false },
    { id: 'finance-receivables', label: 'Receivables', expandable: false },
    { id: 'finance-payables', label: 'Payables', expandable: false },
    { id: 'finance-scm-obligations', label: 'SCM Obligations', expandable: false },
    { id: 'finance-invoices', label: 'Invoices', expandable: false },
    { id: 'finance-bills', label: 'Bills', expandable: false },
    { id: 'finance-payments', label: 'Payments', expandable: false },
    { id: 'finance-receipts', label: 'Receipts', expandable: false },
    { id: 'finance-hrm-payroll', label: 'HRM Payroll', expandable: false },
    { id: 'finance-hrm-reimbursements', label: 'HRM Reimbursements', expandable: false },
    { id: 'finance-budgets', label: 'Budgets', expandable: false },
    { id: 'finance-reports', label: 'Reports', expandable: false },
    { id: 'finance-settings', label: 'Settings', expandable: false },
];

const SCM_SUBMENU = [
    { id: 'scm-overview', label: 'Overview', icon: LayoutDashboard, isSelfService: true },
    { id: 'scm-suppliers', label: 'Suppliers', icon: Target, isSelfService: false },
    { id: 'scm-products', label: 'Products', icon: Box, isSelfService: false },
    { id: 'scm-inventory', label: 'Inventory', icon: Package, isSelfService: false },

    { id: 'scm-locations', label: 'Locations', icon: MapPin, isSelfService: false },
    { id: 'scm-purchase-orders', label: 'Purchase Orders', icon: ClipboardList, isSelfService: false },

    // --- Logistics Submodule ---
    {
        id: 'scm-logistics-dashboard',
        label: 'Logistics',
        icon: Truck,
        isSelfService: false,
        expandable: true,
        subItems: [
            { id: 'scm-logistics-shipments', label: 'Shipments', icon: Package, isSelfService: false },
            { id: 'scm-logistics-transfers', label: 'Transfers', icon: Truck, isSelfService: false },
            { id: 'scm-logistics-receiving', label: 'Receiving', icon: Box, isSelfService: false },
            { id: 'scm-logistics-deliveries', label: 'Deliveries', icon: MapPin, isSelfService: false },
            { id: 'scm-logistics-exceptions', label: 'Exceptions', icon: AlertTriangle, isSelfService: false },
        ]
    },
    // ---------------------------

    { id: 'scm-requisitions', label: 'Requests', icon: ClipboardList, isSelfService: true },
    { id: 'scm-reports', label: 'Reports', icon: BarChart3, isSelfService: false },
    { id: 'scm-config', label: 'Configuration', icon: Settings, isSelfService: false },
];

const HRM_SUBMENU = [
    { id: 'hrm-overview', label: 'Overview', icon: LayoutDashboard, isSelfService: true },
    { id: 'hrm-directory', label: 'Directory', icon: Users, isSelfService: true },
    { id: 'hrm-onboarding', label: 'Onboarding', icon: UserPlus, isSelfService: false },
    { id: 'hrm-offboarding', label: 'Offboarding', icon: UserMinus, isSelfService: false },
    { id: 'hrm-recruitment', label: 'Recruitment', icon: Briefcase, isSelfService: false },
    { id: 'hrm-timesheets', label: 'Timesheets', icon: Clock, isSelfService: true },
    { id: 'hrm-leave', label: 'Leave', icon: CalendarOff, isSelfService: true },
    { id: 'hrm-training', label: 'Training', icon: GraduationCap, isSelfService: true },
    { id: 'hrm-policies', label: 'Policies', icon: BookOpen, isSelfService: true },
    { id: 'hrm-cases', label: 'Cases', icon: AlertTriangle, isSelfService: false },
    { id: 'hrm-configuration', label: 'Configuration', icon: Settings, isSelfService: false },
];

const PROJECTS_SUBMENU = (sidebarConfig.submenu?.projects as Array<{ id: string; label: string; icon: string }>) || [
    { id: 'projects-overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects-scope', label: 'Scope', icon: Target },
    { id: 'projects-work-items', label: 'Work Items', icon: ClipboardList },
    { id: 'projects-documents', label: 'Documents', icon: FileText },
    { id: 'projects-imports', label: 'Imports', icon: Box },
];

const Sidebar: React.FC<SidebarProps> = ({ isDark, activeView, onViewChange }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEnglish = (user?.preferredLanguage || 'fr') === 'en';
    const t = (fr: string, en: string) => (isEnglish ? en : fr);
    const translateLabel = (label: string) => {
        const map: Record<string, string> = {
            'Overview': 'Vue d ensemble',
            'Tasks & Activity': 'Taches & Activite',
            'Receivables': 'Creances',
            'Payables': 'Dettes',
            'SCM Obligations': 'Obligations SCM',
            'Bills': 'Factures fournisseurs',
            'Receipts': 'Recouvrements',
            'HRM Payroll': 'Paie RH',
            'HRM Reimbursements': 'Remboursements RH',
            'Reports': 'Rapports',
            'Settings': 'Parametres',
            'Suppliers': 'Fournisseurs',
            'Products': 'Produits',
            'Inventory': 'Stock',
            'Locations': 'Sites',
            'Purchase Orders': 'Bons de commande',
            'Logistics': 'Logistique',
            'Requests': 'Demandes',
            'Directory': 'Annuaire',
            'Onboarding': 'Integration',
            'Offboarding': 'Sortie',
            'Recruitment': 'Recrutement',
            'Timesheets': 'Feuilles de temps',
            'Leave': 'Conges',
            'Training': 'Formation',
            'Policies': 'Politiques',
            'Cases': 'Dossiers',
            'Scope': 'Perimetre',
            'Work Items': 'Elements de travail',
            'Imports': 'Imports',
            'Projects': 'Projets',
            'People': 'Personnes',
            'Companies': 'Entreprises',
            'Configuration': 'Configuration',
            'Default View': 'Vue par defaut',
            'Deals': 'Opportunites',
            'Activity Feed': 'Flux d activite',
            'Calendar': 'Calendrier',
        };
        return isEnglish ? label : (map[label] || label);
    };
    const { activeProjectId } = useProjectStore();
    const { canViewModule, isReadOnlyModule, hasPermission } = usePermissions();
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [expandedSubItems, setExpandedSubItems] = useState<Set<string>>(new Set());
    const [systemLoad, setSystemLoad] = useState<{ loadPercent: number; tooltip: string }>({
        loadPercent: 0,
        tooltip: 'Server Load: Optimal',
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const toggleSubItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSubItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSubItems(next);
    };

    const ICONS: Record<string, React.ComponentType<any>> = {
        LayoutDashboard,
        Target,
        BarChart3,
        Truck,
        FileText,
        Users,
        ShieldCheck,
    };

    const moduleConfigs = (sidebarConfig.modules || []) as ModuleConfigItem[];
    const isOmniAdmin = isGlobalAdmin(user);
    const moduleById = new Map(moduleConfigs.map((module) => [module.id, module]));
    const hasDepartmentModuleAccess = (moduleId: string): boolean =>
        hasDepartmentAccess(user, moduleById.get(moduleId));
    const canAccessModule = (moduleId: string): boolean => {
        const moduleConfig = moduleById.get(moduleId);
        if (isOmniAdmin) return true;
        if (isSelfServiceModule(moduleConfig)) return true;
        if (hasDepartmentModuleAccess(moduleId)) return true;
        return canViewModule(moduleId as any);
    };

    const menuItems = moduleConfigs
        .map((item) => ({ ...item, icon: ICONS[item.icon] || FileText }))
        .filter((item) => canAccessModule(item.id));

    const isProjectReadOnly = isReadOnlyModule('project');
    const projectSubmenuItems = isProjectReadOnly
        ? PROJECTS_SUBMENU.filter((sub) => sub.id === 'projects-overview')
        : PROJECTS_SUBMENU;
    const canManageDepartmentModule = (moduleId: string): boolean => isOmniAdmin || hasDepartmentModuleAccess(moduleId);
    const filterDepartmentSubmenu = (
        moduleId: string,
        items: NavSubmenuItem[],
        extraAccess?: (item: NavSubmenuItem) => boolean,
    ): NavSubmenuItem[] => {
        if (canManageDepartmentModule(moduleId)) return items;
        return items.filter((item) => Boolean(item.isSelfService || extraAccess?.(item)));
    };

    const hrmSubmenuItems = filterDepartmentSubmenu('hrm', HRM_SUBMENU, (item) => (
        item.id === 'hrm-configuration'
            ? hasPermission('hrm', 'contracts', 'read') || hasPermission('hrm', 'compensation', 'read')
            : false
    ));

    const scmSubmenuItems = filterDepartmentSubmenu('scm', SCM_SUBMENU, (item) => (
        item.id === 'scm-requisitions' && hasPermission('scm', 'requisition', 'approve')
    ));

    const crmSubmenuItems = filterDepartmentSubmenu('crm', CRM_SUBMENU);

    useEffect(() => {
        let cancelled = false;

        const loadSystemHealth = async () => {
            try {
                const data = await apiRequest<{ health?: { loadPercent?: number; tooltip?: string } }>('/api/system/health');
                if (cancelled) return;
                setSystemLoad({
                    loadPercent: Number(data?.health?.loadPercent ?? 0),
                    tooltip: String(data?.health?.tooltip || 'Server Load: Optimal'),
                });
            } catch {
                if (!cancelled) {
                    setSystemLoad((prev) => ({
                        loadPercent: prev.loadPercent || 0,
                        tooltip: prev.tooltip || 'Server Load: Optimal',
                    }));
                }
            }
        };

        void loadSystemHealth();
        const timer = setInterval(() => {
            void loadSystemHealth();
        }, 15000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        const onNetworkActivity = (event: Event) => {
            const customEvent = event as CustomEvent<{ busy?: boolean }>;
            setIsProcessing(Boolean(customEvent.detail?.busy));
        };
        window.addEventListener('neox:network-activity', onNetworkActivity as EventListener);
        return () => {
            window.removeEventListener('neox:network-activity', onNetworkActivity as EventListener);
        };
    }, []);

    return (
        <aside
            className={cn(
                "h-full w-60 flex flex-col border-r transition-all duration-300 z-50 overflow-hidden bg-sidebar border-border"
            )}
        >
            {/* Logo area */}
            <div className="p-[20px_16px] flex items-center gap-3 flex-none">
                <div className="w-6 h-6 rounded bg-neox-emerald flex items-center justify-center font-bold text-black text-[10px]">
                    NX
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-primary">
                    NEOX
                </span>
            </div>

            {/* Navigation */}
            <nav
                className="flex-1 px-3 space-y-0.5 mt-2 overflow-y-auto"
                style={{
                    maxHeight: 'calc(100vh - 64px)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
            >
                <style dangerouslySetInnerHTML={{
                    __html: `
                    nav::-webkit-scrollbar { display: none; }
                ` }} />

                {menuItems.map((item) => {
                    const isActive = activeView === item.id ||
                        (item.id === 'crm' && activeView.startsWith('crm')) ||
                        (item.id === 'finance' && activeView.startsWith('finance')) ||
                        (item.id === 'scm' && activeView.startsWith('scm')) ||
                        (item.id === 'finance' && activeView.startsWith('finance')) ||
                        (item.id === 'scm' && activeView.startsWith('scm')) ||
                        (item.id === 'hrm' && activeView.startsWith('hrm')) ||
                        (item.id === 'project' && activeView.startsWith('projects'));

                    if (item.id === 'crm' && expandedModule === 'crm') {
                        return (
                            <div key="crm-expanded" className="mb-2">
                                {/* Expanded CRM Header */}
                                <button
                                    onClick={() => {
                                        setExpandedModule(null);
                                        onViewChange('crm-overview');
                                    }}
                                    className={cn(
                                        "w-full h-[41px] px-3.5 flex items-center justify-between rounded-lg font-semibold text-sm transition-all",
                                        isDark
                                            ? "bg-[#1a2e2a] text-[#10b981]"
                                            : "bg-[#ecfdf5] text-[#059669]"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={16} />
                                        <span>CRM</span>
                                    </div>
                                    <ChevronUp size={16} />
                                </button>

                                {/* CRM Submenu - Fully Transparent, No Borders */}
                                <div
                                    className="ml-2 mt-1 overflow-hidden transition-all duration-[250ms] ease-in-out flex flex-col gap-[2px] bg-transparent"
                                    style={{ maxHeight: '600px' }}
                                >
                                    {crmSubmenuItems.map((sub) => {
                                        const isSubExpanded = expandedSubItems.has(sub.id);
                                        const isSubActive = activeView === sub.id || (sub.id === 'crm-pipeline' && activeView === 'crm-pipeline');

                                        return (
                                            <div key={sub.id}>
                                                <div
                                                    onClick={(e) => {
                                                        if (sub.id === 'crm-overview') onViewChange('crm-overview');
                                                        else if (sub.expandable) toggleSubItem(sub.id, e);
                                                    }}
                                                    className={cn(
                                                        "group flex items-center justify-between px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors rounded-md",
                                                        isSubActive
                                                            ? (isDark ? "text-[#10b981]" : "text-[#059669]")
                                                            : "text-muted hover:text-primary hover:bg-white/5"
                                                    )}
                                                >
                                                    <span>{translateLabel(sub.label)}</span>
                                                    {sub.expandable && (
                                                        <ChevronDown
                                                            size={14}
                                                            className={cn(
                                                                "transition-transform duration-200 text-[#334155]",
                                                                isSubExpanded && "rotate-180"
                                                            )}
                                                        />
                                                    )}
                                                </div>

                                                {/* 2nd Level Indented Items */}
                                                {sub.expandable && (
                                                    <div
                                                        className="overflow-hidden transition-all duration-200 ease-in-out"
                                                        style={{ maxHeight: isSubExpanded ? '200px' : '0' }}
                                                    >
                                                        <div className="flex flex-col gap-[2px] py-1">
                                                            {(sub.id === 'crm-contacts'
                                                                ? ['People', 'Companies', 'Configuration']
                                                                : sub.id === 'crm-pipeline'
                                                                    ? ['Default View', 'Deals', 'Configuration']
                                                                    : sub.id === 'crm-activity-module'
                                                                        ? ['Tasks', 'Activity Feed', 'Calendar', 'Configuration']
                                                                        : ['Default View', 'Configuration']
                                                            ).map((label, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        if (sub.id === 'crm-pipeline') {
                                                                            if (idx === 0) onViewChange('crm-pipeline');
                                                                            if (idx === 1) onViewChange('crm-pipeline-deals');
                                                                            if (idx === 2) onViewChange('crm-configuration');
                                                                        }
                                                                        if (sub.id === 'crm-contacts') {
                                                                            if (idx === 0) onViewChange('crm-contacts-people');
                                                                            if (idx === 1) onViewChange('crm-contacts-companies');
                                                                            if (idx === 2) onViewChange('crm-contacts-configuration');
                                                                        }
                                                                        if (sub.id === 'crm-activity-module') {
                                                                            if (idx === 0) onViewChange('crm-tasks');
                                                                            if (idx === 1) onViewChange('crm-activity');
                                                                            if (idx === 2) onViewChange('crm-calendar');
                                                                            if (idx === 3) onViewChange('crm-activity-config');
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "text-[12px] py-1.5 px-3 pl-7 cursor-pointer rounded-md transition-all",
                                                                        isDark
                                                                            ? "text-[#475569] hover:bg-white/[0.04] hover:text-[#94a3b8]"
                                                                            : "text-[#94a3b8] hover:bg-black/[0.03] hover:text-[#475569]"
                                                                    )}
                                                                >
                                                                    {translateLabel(label)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    if (item.id === 'finance' && expandedModule === 'finance') {
                        return (
                            <div key="finance-expanded" className="mb-2">
                                <button
                                    onClick={() => setExpandedModule(null)}
                                    className={cn(
                                        "w-full h-[41px] px-3.5 flex items-center justify-between rounded-lg font-semibold text-sm transition-all",
                                        isDark
                                            ? "bg-[#1e293b] text-[#3b82f6]"
                                            : "bg-[#eff6ff] text-[#2563eb]"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={16} />
                                        <span>Finance</span>
                                    </div>
                                    <ChevronUp size={16} />
                                </button>

                                <div className="ml-2 mt-1 flex flex-col gap-[2px] bg-transparent">
                                    {FINANCE_SUBMENU.map((sub) => {
                                        const isSubActive = activeView === sub.id;

                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => onViewChange(sub.id)}
                                                className={cn(
                                                    "group flex items-center justify-between px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors rounded-md",
                                                    isSubActive
                                                        ? (isDark ? "text-[#3b82f6]" : "text-[#2563eb]")
                                                        : (isDark ? "text-[#64748b] hover:text-[#94a3b8] hover:bg-white/5" : "text-[#64748b] hover:text-[#475569] hover:bg-black/5")
                                                )}
                                            >
                                                <span>{translateLabel(sub.label)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    // Added SCM expanded module rendering
                    if (item.id === 'scm' && expandedModule === 'scm') {
                        return (
                            <div key="scm-expanded" className="mb-2">
                                <button
                                    onClick={() => setExpandedModule(null)}
                                    className={cn(
                                        "w-full h-[41px] px-3.5 flex items-center justify-between rounded-lg font-semibold text-sm transition-all",
                                        isDark
                                            ? "bg-[#1a2e2a] text-[#10b981]"
                                            : "bg-[#ecfdf5] text-[#059669]"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={16} />
                                        <span>SCM</span>
                                    </div>
                                    <ChevronUp size={16} />
                                </button>

                                <div className="ml-2 mt-1 flex flex-col gap-[2px] bg-transparent">
                                    {scmSubmenuItems.map((sub: any) => {
                                        const isSubActive = activeView === sub.id || (sub.id === 'scm-logistics-dashboard' && activeView.startsWith('scm-logistics-'));
                                        const isSubExpanded = expandedSubItems.has(sub.id);
                                        const SubIcon = (sub.icon as React.ComponentType<any>) || FileText;

                                        return (
                                            <div key={sub.id}>
                                                <div
                                                    onClick={(e) => {
                                                        onViewChange(sub.id);
                                                        if (sub.expandable) {
                                                            toggleSubItem(sub.id, e);
                                                        } else {
                                                            setExpandedSubItems(new Set());
                                                        }
                                                    }}
                                                    className={cn(
                                                        "group flex items-center justify-between px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors rounded-md",
                                                        isSubActive
                                                            ? (isDark ? "text-blue-400 bg-blue-500/5 text-blue-500" : "text-blue-600 bg-blue-50/50")
                                                            : (isDark ? "text-slate-500 hover:text-slate-200 hover:bg-white/5" : "text-[#64748b] hover:text-[#475569] hover:bg-black/5")
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <SubIcon size={14} className={cn(isSubActive ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                                                        <span>{translateLabel(sub.label)}</span>
                                                    </div>
                                                    {sub.expandable && (
                                                        <ChevronDown
                                                            size={14}
                                                            className={cn(
                                                                "transition-transform duration-200 opacity-50",
                                                                isSubExpanded && "rotate-180"
                                                            )}
                                                        />
                                                    )}
                                                </div>

                                                {sub.expandable && sub.subItems && (
                                                    <div
                                                        className="overflow-hidden transition-all duration-200 ease-in-out pl-6 flex flex-col gap-[2px] py-1 border-l border-border/10"
                                                        style={{ maxHeight: isSubExpanded ? '300px' : '0' }}
                                                    >
                                                        {sub.subItems.map((nested: any) => {
                                                            const isNestedActive = activeView === nested.id || activeView.startsWith(`${nested.id}-detail`);
                                                            return (
                                                                <div
                                                                    key={nested.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onViewChange(nested.id);
                                                                    }}
                                                                    className={cn(
                                                                        "group flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-[12px] font-medium transition-colors rounded-md",
                                                                        isNestedActive
                                                                            ? (isDark ? "text-blue-400 bg-blue-500/10" : "text-blue-600 bg-blue-50/50")
                                                                            : (isDark ? "text-slate-400 hover:text-slate-200 hover:bg-white/5" : "text-slate-500 hover:text-slate-800 hover:bg-black/5")
                                                                    )}
                                                                >
                                                                    <nested.icon size={12} className={cn(isNestedActive ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                                                                    <span>{translateLabel(nested.label)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    if (item.id === 'hrm' && expandedModule === 'hrm') {
                        return (
                            <div key="hrm-expanded" className="mb-2">
                                <button
                                    onClick={() => setExpandedModule(null)}
                                    className={cn(
                                        "w-full h-[41px] px-3.5 flex items-center justify-between rounded-lg font-semibold text-sm transition-all",
                                        isDark
                                            ? "bg-[#1f2937] text-purple-400"
                                            : "bg-purple-50 text-purple-600"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={16} />
                                        <span>HRM</span>
                                    </div>
                                    <ChevronUp size={16} />
                                </button>

                                <div className="ml-2 mt-1 flex flex-col gap-[2px] bg-transparent">
                                    {hrmSubmenuItems.map((sub) => {
                                        const isSubActive = activeView === sub.id;
                                        const SubIcon = (sub.icon as React.ComponentType<any>) || FileText;

                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => onViewChange(sub.id)}
                                                className={cn(
                                                    "group flex items-center gap-3 px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors rounded-md",
                                                    isSubActive
                                                        ? (isDark ? "text-purple-400 bg-purple-500/5" : "text-purple-600 bg-purple-50/50")
                                                        : (isDark ? "text-slate-500 hover:text-slate-200 hover:bg-white/5" : "text-[#64748b] hover:text-[#475569] hover:bg-black/5")
                                                )}
                                            >
                                                <SubIcon size={14} className={cn(isSubActive ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                                                <span>{translateLabel(sub.label)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    if (item.id === 'project' && (expandedModule === 'project' || activeView.startsWith('projects'))) {
                        return (
                            <div key="projects-expanded" className="mb-2">
                                <button
                                    onClick={() => {
                                        setExpandedModule(null);
                                        navigate('/projects');
                                        onViewChange('projects-overview');
                                    }}
                                    className={cn(
                                        "w-full h-[41px] px-3.5 flex items-center justify-between rounded-lg font-semibold text-sm transition-all",
                                        isDark
                                            ? "bg-[#2d2a1a] text-[#ffd700]"
                                            : "bg-[#fffbe6] text-[#d97706]"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={16} />
                                        <span>{t('Projets', 'Projects')}</span>
                                    </div>
                                    <ChevronUp size={16} />
                                </button>

                                <div className="ml-2 mt-1 flex flex-col gap-[2px] bg-transparent">
                                    {projectSubmenuItems.map((sub) => {
                                        const isSubActive = activeView === sub.id;
                                        const SubIcon = ICONS[(sub as any).icon] || FileText;

                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => {
                                                    const subItem = sub.id.replace('projects-', '');
                                                    if (activeProjectId) {
                                                        navigate(`/projects/${activeProjectId}/${subItem}`);
                                                    } else {
                                                        navigate('/projects');
                                                    }
                                                    onViewChange(sub.id);
                                                }}
                                                className={cn(
                                                    "group flex items-center gap-3 px-3 py-2 cursor-pointer text-[13px] font-medium transition-colors rounded-md",
                                                    isSubActive
                                                        ? (isDark ? "text-[#ffd700] bg-[#ffd700]/5" : "text-[#d97706] bg-[#d97706]/10")
                                                        : (isDark ? "text-slate-500 hover:text-slate-200 hover:bg-white/5" : "text-[#64748b] hover:text-[#475569] hover:bg-black/5")
                                                )}
                                            >
                                                <SubIcon size={14} className={cn(isSubActive ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                                                <span>{translateLabel(sub.label)}</span>
                                            </div>
                                        );
                                    })}
                                    {!activeProjectId && !isProjectReadOnly && (
                                        <div className="px-3 py-1 text-[11px] text-slate-500 italic">
                                            {t('Selectionnez un projet pour ouvrir les pages du projet.', 'Select a project to open project-specific pages.')}
                                        </div>
                                    )}
                                    {isProjectReadOnly && !isOmniAdmin && (
                                        <div className="px-3 py-1 text-[11px] text-slate-500 italic">
                                            {t('Lecture seule: rejoignez une equipe projet pour debloquer Perimetre, Elements de travail et Imports.', 'Read-only: join a project team to unlock Scope, Work Items and Imports.')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'crm') {
                                    setExpandedModule('crm');
                                    onViewChange('crm-overview');
                                }
                                else if (item.id === 'finance') {
                                    setExpandedModule('finance');
                                    onViewChange('finance-overview');
                                }
                                else if (item.id === 'scm') {
                                    setExpandedModule('scm');
                                    onViewChange('scm-overview');
                                }
                                else if (item.id === 'hrm') {
                                    setExpandedModule('hrm');
                                    onViewChange('hrm-directory');
                                }
                                else if (item.id === 'project') {
                                    setExpandedModule('project');
                                    navigate('/projects');
                                    onViewChange('projects-overview');
                                }
                                else {
                                    setExpandedModule(null);
                                    onViewChange(item.id);
                                }
                            }}
                            className={cn(
                                "w-full h-9 px-3 flex items-center gap-3 rounded-md text-sm transition-all group relative",
                                isActive
                                    ? "bg-[rgba(16,185,129,0.06)] text-neox-emerald font-medium"
                                    : "text-muted hover:bg-white/5 hover:text-primary"
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-neox-emerald rounded-r-full" />
                            )}
                            <item.icon size={16} className={cn("flex-none", isActive ? "text-neox-emerald" : "text-inherit")} />
                            <span className="truncate">{translateLabel(item.label)}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="mt-auto px-3 pb-6 space-y-4 flex-none">
                <button
                    onClick={() => {
                        setExpandedModule(null);
                        navigate('/settings');
                        onViewChange('settings');
                    }}
                    className={cn(
                        "w-full h-9 px-3 flex items-center gap-3 rounded-md text-sm transition-all",
                        activeView === 'settings'
                            ? "bg-[rgba(16,185,129,0.06)] text-neox-emerald font-medium"
                            : "text-muted hover:bg-white/5 hover:text-primary"
                    )}
                >
                    <Settings size={16} />
                    <span>{t('Parametres', 'Settings')}</span>
                </button>

                {/* {t('Puissance calcul', 'Compute Pwr')} Widget */}
                <div className="px-3" title={isProcessing ? 'Server Load: Heavy Processing in progress' : systemLoad.tooltip}>
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">{t('Puissance calcul', 'Compute Pwr')}</span>
                        <span className="text-[10px] font-medium text-slate-400">
                            {Math.round(
                                isProcessing
                                    ? Math.max(systemLoad.loadPercent, 86)
                                    : systemLoad.loadPercent,
                            )}%
                        </span>
                    </div>
                    <div className="h-1 bg-[#1e2d3d] rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full transition-all duration-500 relative",
                                (isProcessing ? Math.max(systemLoad.loadPercent, 86) : systemLoad.loadPercent) >= 95
                                    ? "bg-rose-500"
                                    : (isProcessing ? Math.max(systemLoad.loadPercent, 86) : systemLoad.loadPercent) >= 85
                                        ? "bg-amber-500"
                                        : "bg-neox-emerald"
                            )}
                            style={{ width: `${Math.max(0, Math.min(100, isProcessing ? Math.max(systemLoad.loadPercent, 86) : systemLoad.loadPercent))}%` }}
                        >
                            {isProcessing && (
                                <span className="absolute inset-0 opacity-60 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] animate-[pulse_1s_ease-in-out_infinite]" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;




