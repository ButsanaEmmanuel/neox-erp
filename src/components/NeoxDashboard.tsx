import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShieldCheck,
  Globe,
  Plus,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import Sidebar from './Sidebar';
import Header from './Header';
import { Truck } from 'lucide-react';
import { AnalyticsCard, ProjectItem, ClusterRow } from './Visuals';
import Reports from './Reports';
import Pipeline from './Pipeline';
import { getStageBadgeStyles } from '../constants/crm';
import PipelineConfiguration from './PipelineConfiguration';
import PeopleListPage from './PeopleListPage';
import CompaniesListPage from './CompaniesListPage';
import PersonFormPage from './PersonFormPage';
import CompanyFormPage from './CompanyFormPage';
import ContactsConfiguration from './ContactsConfiguration';
import TasksPage from './TasksPage';
import ActivityFeedPage from './ActivityFeedPage';
import CalendarPage from './CalendarPage';
import ActivityConfigPage from './ActivityConfigPage';
import DealsListPage from './DealsListPage';
import DealFormPage from './DealFormPage';
import { DealsProvider, useDeals } from '../contexts/DealsContext';
import { PeopleProvider } from '../contexts/PeopleContext';
import { CompaniesProvider } from '../contexts/CompaniesContext';
import { FinanceProvider } from '../contexts/FinanceContext';
import { SCMProvider } from '../contexts/SCMContext';
import FinanceOverview from './FinanceOverview';
import TransactionsPage from './TransactionsPage';
import FinanceReconciliationPage from './FinanceReconciliationPage';
import ReceivablesPage from './ReceivablesPage';
import PayablesPage from './PayablesPage';
import FinanceScmObligationsPage from './FinanceScmObligationsPage';
import InvoicesPage from './InvoicesPage';
import BillsPage from './BillsPage';
import PaymentsPage from './PaymentsPage';
import ReceiptsPage from './ReceiptsPage';
import FinancePayrollPage from './FinancePayrollPage';
import FinanceReimbursementsPage from './FinanceReimbursementsPage';
import {
  BudgetsPlaceholder,
} from './FinancePlaceholders';
import FinanceReportsPage from './FinanceReportsPage';
import FinanceSettingsPage from './FinanceSettingsPage';
import SettingsPage from './SettingsPage';
import SCMOverview from './scm/SCMOverview';
import SuppliersPage from './scm/SuppliersPage';
import ProductsPage from './scm/ProductsPage';
import ScmConfiguration from './scm/ScmConfiguration';
import InventoryPage from './scm/InventoryPage';

import LocationsPage from './scm/LocationsPage';
import LogisticsDashboard from './scm/logistics/LogisticsDashboard';
import ShipmentsPage from './scm/logistics/ShipmentsPage';
import ShipmentDetailPage from './scm/logistics/ShipmentDetailPage';
import TransfersPage from './scm/logistics/TransfersPage';
import { TransferDetailPage } from './scm/logistics/TransferDetailPage';
import DeliveriesPage from './scm/logistics/DeliveriesPage';
import DeliveryDetailPage from './scm/logistics/DeliveryDetailPage';
import ReceivingWorkspace from './scm/logistics/ReceivingWorkspace';
import ExceptionsPage from './scm/logistics/ExceptionsPage';
import ExceptionDetailPage from './scm/logistics/ExceptionDetailPage';
import RequisitionsPage from './scm/RequisitionsPage';
import { RequisitionDetailPage } from './scm/requests/RequisitionDetailPage';
import { SCMReportsPage, SCMSettingsPage } from './scm/SCMPlaceholders';
import PurchaseOrdersPage from './scm/po/PurchaseOrdersPage'; // Import
import { POCreatePage } from './scm/po/POCreatePage'; // Import
import { PODetailPage } from './scm/po/PODetailPage'; // Import
import { selectKpis, selectStageAggregates, selectTopDeals } from '../selectors/crmSelectors';
import { formatCurrency } from '../utils/formatters';
import HRMRouter from './hrm/HRMRouter';
import PMRouter from './pm/PMRouter';
import { ToastProvider } from './ui/Toast';
import { useTheme } from './ThemeProvider';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DashboardContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<string>(() => {
    if (!user) return 'dashboard';
    const role = user.role?.toUpperCase();
    if (role === 'SALES') return 'crm-overview';
    if (role === 'PROJECT_MANAGER') return 'project';
    if (role === 'SCM_MANAGER') return 'scm';
    if (role === 'FINANCE') return 'finance';
    if (role === 'HR_MANAGER') return 'hrm';
    return 'dashboard';
  });
  const location = useLocation();
  const navigate = useNavigate();

  const { deals } = useDeals();
  const tableRef = useRef<HTMLDivElement>(null);
  const [dashboardOverview, setDashboardOverview] = useState<{
    crm: { pipelineRevenue: number; openDeals: number; bars: number[] };
    scm: { clustersValue: number; delayedCount: number; rows: Array<{ name: string; region: string; status: 'Track' | 'Delayed' }> };
    workforce: { pxCount: number; efficiency: number; approvedTimesheets: number; pendingTimesheets: number };
    hse: { environment: number; protocol: number; equipment: number };
    projects: { criticalCount: number; rows: Array<{ name: string; progress: number; status: 'active' | 'at-risk' | 'complete' }> };
  } | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const kpis = useMemo(() => selectKpis(deals), [deals]);
  const stageAggregates = useMemo(() => selectStageAggregates(deals), [deals]);
  const topDeals = useMemo(() => selectTopDeals(deals, 10), [deals]);

  const stats = useMemo(() => [
    {
      label: 'Total Pipeline Value',
      value: kpis.formattedTotalValue,
      delta: '+12.5%',
      positive: true,
      secondary: `${kpis.openDealsCount} open deals`,
      sparkline: {
        color: '#10b981',
        path: "M40,38 L60,30 L80,34 L100,20 L120,24 L160,18 L200,10",
        areaPath: "M40,48 L40,38 L60,30 L80,34 L100,20 L120,24 L160,18 L200,10 L200,48 Z"
      }
    },
    {
      label: 'Average Deal Size',
      value: kpis.formattedAvgDealSize,
      delta: '+3%',
      positive: true,
      secondary: `Avg age · ${kpis.avgDealAge} days`,
      sparkline: {
        color: '#3b82f6',
        path: "M40,28 L70,25 L100,28 L130,22 L160,26 L200,24",
        areaPath: "M40,48 L40,28 L70,25 L100,28 L130,22 L160,26 L200,24 L200,48 Z"
      }
    },
    {
      label: 'Win Rate',
      value: '—',
      delta: '0%',
      positive: true,
      secondary: 'Requires won/lost tracking',
      sparkline: {
        color: '#f43f5e',
        path: "M40,15 L70,18 L100,14 L130,22 L160,28 L200,32",
        areaPath: "M40,48 L40,15 L70,18 L100,14 L130,22 L160,28 L200,32 L200,48 Z"
      }
    },
  ], [kpis]);

  const chartData = useMemo(() => {
    const maxValue = Math.max(...stageAggregates.map(d => d.totalValue)) || 1;
    return stageAggregates.map(d => ({
      label: d.stage,
      value: d.totalValue,
      displayValue: d.formattedValue,
      count: d.count,
      color: getStageBadgeStyles(d.stage).color,
      heightPercentage: (d.totalValue / maxValue) * 100
    }));
  }, [stageAggregates]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/settings')) {
      setActiveView('settings');
      return;
    }
    if (path.startsWith('/projects')) {
      if (path.includes('/overview')) setActiveView('projects-overview');
      else if (path.includes('/scope')) setActiveView('projects-scope');
      else if (path.includes('/work-items')) setActiveView('projects-work-items');
      else if (path.includes('/documents')) setActiveView('projects-documents');
      else if (path.includes('/imports')) setActiveView('projects-imports');
      else setActiveView('projects');
    } else if (path === '/dashboard') {
      setActiveView('dashboard');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = 0;
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'dashboard') return;
    let cancelled = false;
    const loadOverview = async () => {
      setDashboardLoading(true);
      try {
        const data = await apiRequest<{ overview: {
          crm: { pipelineRevenue: number; openDeals: number; bars: number[] };
          scm: { clustersValue: number; delayedCount: number; rows: Array<{ name: string; region: string; status: 'Track' | 'Delayed' }> };
          workforce: { pxCount: number; efficiency: number; approvedTimesheets: number; pendingTimesheets: number };
          hse: { environment: number; protocol: number; equipment: number };
          projects: { criticalCount: number; rows: Array<{ name: string; progress: number; status: 'active' | 'at-risk' | 'complete' }> };
        } }>('/api/v1/dashboard/overview');
        if (!cancelled) setDashboardOverview(data.overview || null);
      } catch {
        if (!cancelled) setDashboardOverview(null);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };
    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [activeView]);

  return (
    <div
      className={cn(
        "h-screen w-screen transition-colors duration-300 overflow-hidden font-variant-numeric: tabular-nums select-none",
        "bg-app text-primary"
      )}
      style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}
    >
      <Sidebar
        isDark={isDark}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <div className="flex flex-col min-w-0 h-full overflow-hidden relative">
        <Header
          isDark={isDark}
          isSidebarOpen={true}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => { }}
          onQuickNavigate={(view, path) => {
            setActiveView(view);
            if (path) navigate(path);
          }}
        />

        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth",
          (activeView === 'reports' || activeView === 'crm-pipeline') ? "p-0" : "p-6"
        )}>
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full gap-6 flex flex-col min-h-[800px]"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 flex-none h-[220px]">
                  <AnalyticsCard title="CRM Pipeline Revenue" value={formatCurrency(dashboardOverview?.crm.pipelineRevenue || 0)} trend={{ val: dashboardLoading ? 'Loading...' : `${dashboardOverview?.crm.openDeals || 0} open`, positive: (dashboardOverview?.crm.openDeals || 0) > 0 }} icon={<TrendingUp size={14} />} isDark={isDark} className="md:col-span-8 h-full">
                    <div className="flex items-end justify-between h-full pb-2 px-1 gap-1">
                      {(dashboardOverview?.crm.bars || []).length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted">No records from DB</div>
                      ) : (dashboardOverview?.crm.bars || []).map((h, i) => (
                        <div key={i} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/50 transition-colors rounded-sm" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </AnalyticsCard>
                  <AnalyticsCard title="SCM Global Pulse" value={`${dashboardOverview?.scm.clustersValue || 0} Requests`} icon={<Globe size={14} />} isDark={isDark} className="md:col-span-4 h-full">
                    <div className="space-y-3 pt-4">
                      {(dashboardOverview?.scm.rows || []).slice(0, 3).map((row, idx) => (
                        <ClusterRow key={`${row.name}-${idx}`} name={row.name} region={row.region} status={row.status} isDark={isDark} />
                      ))}
                    </div>
                  </AnalyticsCard>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 flex-none h-[200px]">
                  <AnalyticsCard title="Workforce Intelligence" value={`${dashboardOverview?.workforce.pxCount || 0} PX`} icon={<Users size={14} />} isDark={isDark} className="md:col-span-4 h-full">
                    <div className="h-full flex flex-col justify-center">
                      <div className="flex justify-between text-xs mb-2 text-muted"><span>Efficiency</span><span>{dashboardOverview?.workforce.efficiency || 0}%</span></div>
                      <div className="h-1 bg-surface-highlight rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${dashboardOverview?.workforce.efficiency || 0}%` }}></div></div>
                    </div>
                  </AnalyticsCard>
                  <AnalyticsCard title="HSE Safety Metrics" value={`${dashboardOverview?.hse.environment || 0}%`} icon={<ShieldCheck size={14} />} isDark={isDark} className="md:col-span-3 h-full">
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-[11px] text-muted"><span>Environment</span><span className="text-emerald-500">{dashboardOverview?.hse.environment || 0}</span></div>
                      <div className="flex justify-between text-[11px] text-muted"><span>Protocol</span><span className="text-emerald-500">{dashboardOverview?.hse.protocol || 0}</span></div>
                      <div className="flex justify-between text-[11px] text-muted"><span>Equipment</span><span className="text-amber-500">{dashboardOverview?.hse.equipment || 0}</span></div>
                    </div>
                  </AnalyticsCard>
                  <AnalyticsCard title="Critical Projects" value={`${dashboardOverview?.projects.criticalCount || 0} Critical`} icon={<Plus size={14} />} isDark={isDark} className="md:col-span-5 h-full">
                    <div className="space-y-2 pt-2">
                      {(dashboardOverview?.projects.rows || []).length === 0 ? (
                        <div className="text-xs text-muted">No projects from DB</div>
                      ) : (dashboardOverview?.projects.rows || []).slice(0, 2).map((row, idx) => (
                        <ProjectItem key={`${row.name}-${idx}`} name={row.name} progress={row.progress} status={row.status} isDark={isDark} />
                      ))}
                    </div>
                  </AnalyticsCard>
                </div>              </motion.div>
            ) : activeView === 'reports' ? (
              <Reports isDark={isDark} isSidebarOpen={true} />
            ) : activeView === 'settings' ? (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SettingsPage isDark={isDark} />
              </motion.div>
            ) : activeView === 'crm-pipeline' ? (
              <Pipeline isDark={isDark} />
            ) : activeView === 'crm-pipeline-deals' ? (
              <motion.div key="pipeline-deals-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <DealsListPage isDark={isDark} onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'crm-pipeline-deals-new' ? (
              <motion.div key="pipeline-deals-new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <DealFormPage isDark={isDark} onBack={() => setActiveView('crm-pipeline-deals')} />
              </motion.div>
            ) : activeView === 'crm-configuration' ? (
              <PipelineConfiguration isDark={isDark} onBack={() => setActiveView('crm-pipeline')} />
            ) : activeView === 'crm-contacts' || activeView === 'crm-contacts-people' ? (
              <motion.div key="contacts-people-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PeopleListPage isDark={isDark} onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'crm-contacts-companies' ? (
              <motion.div key="contacts-companies-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <CompaniesListPage isDark={isDark} onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'crm-contacts-people-new' ? (
              <motion.div key="people-new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PersonFormPage isDark={isDark} onBack={() => setActiveView('crm-contacts-people')} />
              </motion.div>
            ) : activeView === 'crm-contacts-companies-new' ? (
              <motion.div key="companies-new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <CompanyFormPage isDark={isDark} onBack={() => setActiveView('crm-contacts-companies')} />
              </motion.div>
            ) : activeView === 'crm-contacts-configuration' ? (
              <ContactsConfiguration isDark={isDark} onBack={() => setActiveView('crm-contacts-people')} />
            ) : activeView === 'crm-tasks' ? (
              <motion.div key="crm-tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <TasksPage />
              </motion.div>
            ) : activeView === 'crm-activity' ? (
              <motion.div key="crm-activity" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ActivityFeedPage />
              </motion.div>
            ) : activeView === 'crm-calendar' ? (
              <motion.div key="crm-calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <CalendarPage />
              </motion.div>
            ) : activeView === 'crm-activity-config' ? (
              <motion.div key="crm-activity-config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ActivityConfigPage />
              </motion.div>
            ) : activeView === 'finance-overview' ? (
              <motion.div key="finance-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceOverview />
              </motion.div>
            ) : activeView === 'finance-transactions' ? (
              <motion.div key="finance-transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <TransactionsPage />
              </motion.div>
            ) : activeView === 'finance-reconciliation' ? (
              <motion.div key="finance-reconciliation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceReconciliationPage />
              </motion.div>
            ) : activeView === 'finance-receivables' ? (
              <motion.div key="finance-receivables" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ReceivablesPage />
              </motion.div>
            ) : activeView === 'finance-payables' ? (
              <motion.div key="finance-payables" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PayablesPage />
              </motion.div>
            ) : activeView === 'finance-scm-obligations' ? (
              <motion.div key="finance-scm-obligations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceScmObligationsPage />
              </motion.div>
            ) : activeView === 'finance-invoices' ? (
              <motion.div key="finance-invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <InvoicesPage />
              </motion.div>
            ) : activeView === 'finance-bills' ? (
              <motion.div key="finance-bills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <BillsPage />
              </motion.div>
            ) : activeView === 'finance-payments' ? (
              <motion.div key="finance-payments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PaymentsPage />
              </motion.div>
            ) : activeView === 'finance-receipts' ? (
              <motion.div key="finance-receipts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ReceiptsPage />
              </motion.div>
            ) : activeView === 'finance-hrm-payroll' ? (
              <motion.div key="finance-hrm-payroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinancePayrollPage />
              </motion.div>
            ) : activeView === 'finance-hrm-reimbursements' ? (
              <motion.div key="finance-hrm-reimbursements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceReimbursementsPage />
              </motion.div>
            ) : activeView === 'finance-budgets' ? (
              <motion.div key="finance-budgets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <BudgetsPlaceholder />
              </motion.div>
            ) : activeView === 'finance-reports' ? (
              <motion.div key="finance-reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceReportsPage />
              </motion.div>
            ) : activeView === 'finance-settings' ? (
              <motion.div key="finance-settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <FinanceSettingsPage />
              </motion.div>
            ) : activeView === 'scm-overview' ? (
              <motion.div key="scm-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SCMOverview />
              </motion.div>
            ) : activeView === 'scm-suppliers' ? (
              <motion.div key="scm-suppliers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SuppliersPage />
              </motion.div>
            ) : activeView === 'scm-products' ? (
              <motion.div key="scm-products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ProductsPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-config' ? (
              <motion.div key="scm-config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ScmConfiguration />
              </motion.div>
            ) : activeView === 'scm-inventory' ? (
              <motion.div key="scm-inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <InventoryPage />
              </motion.div>
            ) : activeView === 'scm-locations' ? (
              <motion.div key="scm-locations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <LocationsPage />
              </motion.div>
            ) : activeView === 'scm-logistics-dashboard' ? (
              <motion.div key="scm-logistics-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <LogisticsDashboard />
              </motion.div>
            ) : activeView === 'scm-logistics-shipments' ? (
              <motion.div key="scm-logistics-shipments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ShipmentsPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-logistics-shipments-detail-') ? (
              <motion.div key="scm-logistics-shipments-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ShipmentDetailPage shipmentId={activeView.replace('scm-logistics-shipments-detail-', '')} onBack={() => setActiveView('scm-logistics-shipments')} />
              </motion.div>
            ) : activeView === 'scm-logistics-transfers' ? (
              <motion.div key="scm-logistics-transfers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <TransfersPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-logistics-transfers-detail-') ? (
              <motion.div key="scm-logistics-transfers-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <TransferDetailPage
                  transferId={activeView.replace('scm-logistics-transfers-detail-', '')}
                  onBack={() => setActiveView('scm-logistics-transfers')}
                />
              </motion.div>
            ) : activeView === 'scm-logistics-receiving' ? (
              <motion.div key="scm-logistics-receiving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ReceivingWorkspace onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-logistics-deliveries' ? (
              <motion.div key="scm-logistics-deliveries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <DeliveriesPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-logistics-deliveries-detail-') ? (
              <motion.div key="scm-logistics-deliveries-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <DeliveryDetailPage deliveryId={activeView.replace('scm-logistics-deliveries-detail-', '')} onBack={() => setActiveView('scm-logistics-deliveries')} onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-logistics-exceptions' ? (
              <motion.div key="scm-logistics-exceptions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ExceptionsPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-logistics-exceptions-detail-') ? (
              <motion.div key="scm-logistics-exceptions-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ExceptionDetailPage exceptionId={activeView.replace('scm-logistics-exceptions-detail-', '')} onBack={() => setActiveView('scm-logistics-exceptions')} onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-requisitions' ? (
              <motion.div key="scm-requisitions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <RequisitionsPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-requisitions-detail-') ? (
              <motion.div key="scm-requisitions-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <RequisitionDetailPage
                  requisitionId={activeView.replace('scm-requisitions-detail-', '')}
                  onBack={() => setActiveView('scm-requisitions')}
                  onEditDraft={() => setActiveView('scm-requisitions')}
                  onNavigateToPO={(id) => setActiveView(`scm-purchase-orders-detail-${id}`)}
                  onNavigateToTransfer={(id) => setActiveView(`scm-logistics-transfers-detail-${id}`)}
                />
              </motion.div>
            ) : activeView === 'scm-reports' ? (
              <motion.div key="scm-reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SCMReportsPage />
              </motion.div>
            ) : activeView === 'scm-purchase-orders' ? (
              <motion.div key="scm-purchase-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PurchaseOrdersPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-purchase-orders-new' ? (
              <motion.div key="scm-purchase-orders-new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <POCreatePage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-purchase-orders-detail') ? (
              <motion.div key="scm-purchase-orders-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PODetailPage onNavigate={setActiveView} />
              </motion.div>
            ) : activeView === 'scm-settings' ? (
              <motion.div key="scm-settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SCMSettingsPage />
              </motion.div>
            ) : activeView.startsWith('hrm-') ? (
              <motion.div key="hrm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <ToastProvider>
                  <HRMRouter activeView={activeView} onNavigate={setActiveView} />
                </ToastProvider>
              </motion.div>
            ) : activeView.startsWith('project') || (location.pathname.startsWith('/projects') && activeView === 'dashboard') ? (
              <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <PMRouter onNavigate={setActiveView} />
              </motion.div>
            ) : activeView.startsWith('scm-') ? (
              <motion.div key="scm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <div className="flex flex-col items-center justify-center h-full text-muted">
                  <Truck size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">SCM Module: {activeView.replace('scm-', '').toUpperCase()}</p>
                  <p className="text-xs mt-2 opacity-50 italic">Implementation in progress...</p>
                </div>
              </motion.div>
            ) : activeView === 'crm-overview' ? (
              <motion.div
                key="crm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col gap-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-none h-auto md:h-[160px]">
                  {stats.map((stat) => (
                    <div key={stat.label} className={cn(
                      "rounded-[12px] border flex flex-col relative overflow-hidden transition-all duration-300",
                      "bg-card border-border shadow-sm hover:shadow-md"
                    )}
                      style={{ padding: '24px' }}
                    >
                      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
                      <div className="flex flex-col h-full justify-between z-10 relative">
                        <div>
                          <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">{stat.label}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-primary">
                              {stat.value}
                            </p>
                            <div className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border",
                              stat.positive
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            )}>
                              {stat.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {stat.delta}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="h-[1px] w-full bg-border mb-3" />
                          <p className="text-[12px] text-muted font-medium flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                            {stat.secondary}
                          </p>
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-0 left-0 h-[60px] opacity-[0.15] pointer-events-none mix-blend-screen">
                        <svg width="100%" height="100%" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d={stat.sparkline.areaPath} fill={stat.sparkline.color} />
                        </svg>
                      </div>
                      <div className="absolute bottom-0 right-0 left-0 h-[60px] opacity-80 pointer-events-none">
                        <svg width="100%" height="100%" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d={stat.sparkline.path} fill="none" stroke={stat.sparkline.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex-1 min-h-[400px] grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 overflow-hidden pb-1">
                  <div className="flex flex-col rounded-[12px] border border-border bg-card shadow-sm overflow-hidden h-full relative">
                    <div className="p-6 pb-4 border-b border-border flex items-center justify-between flex-none bg-inherit z-20">
                      <h3 className="text-[14px] font-semibold text-primary">Open Deals Portfolio</h3>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActiveView('crm-pipeline'); }}
                        className="text-[12px] font-medium text-muted hover:text-brand hover:underline flex items-center gap-1 transition-colors"
                      >
                        View more <ArrowRight size={12} />
                      </a>
                    </div>
                    <div className="flex-1 min-h-0 relative flex flex-col">
                      <div
                        className="grid items-center px-6 py-3 border-b border-border sticky top-0 z-10 backdrop-blur-md bg-card/95"
                        style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px' }}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Deal Name</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Company</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Stage</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted text-right pr-4">Value</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted text-center">Owner</span>
                      </div>
                      <div
                        ref={tableRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-2"
                      >
                        {topDeals.map((deal) => (
                          <div
                            key={deal.id}
                            className="grid items-center px-6 border-b border-border last:border-0 transition-all group relative cursor-default hover:bg-surface"
                            style={{
                              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px',
                              height: '56px'
                            }}
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-[13px] font-medium truncate pr-2 group-hover:translate-x-1 transition-transform text-secondary group-hover:text-primary">
                              {deal.name}
                            </span>
                            <span className="text-[13px] text-muted truncate">{deal.company?.name || 'No Company'}</span>
                            <div>
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide inline-block"
                                style={getStageBadgeStyles(deal.stage)}
                              >
                                {deal.stage}
                              </span>
                            </div>
                            <span className="text-[13px] font-medium text-right tabular-nums pr-4 text-primary">
                              {deal.value}
                            </span>
                            <div className="flex justify-center">
                              <div className="w-7 h-7 rounded-full bg-surface-highlight border border-border flex items-center justify-center text-[10px] font-bold text-muted">
                                {deal.owner}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col rounded-[12px] border border-border bg-card shadow-sm overflow-hidden h-full relative">
                    <div className="p-6 pb-2 flex-none">
                      <h3 className="text-[14px] font-semibold mb-1 text-primary">Pipeline by Stage</h3>
                      <p className="text-[12px] text-muted">Volume distribution across active stages</p>
                    </div>
                    <div className="flex-1 min-h-0 relative w-full px-6 pb-6 pt-4 flex flex-col justify-end">
                      <div className="absolute inset-x-6 top-4 bottom-6 flex flex-col justify-between pointer-events-none z-0">
                        <div className="border-t border-dashed border-border/40 w-full h-px" />
                        <div className="border-t border-dashed border-border/40 w-full h-px" />
                        <div className="border-t border-dashed border-border/40 w-full h-px" />
                        <div className="border-t border-border/60 w-full h-px" />
                      </div>
                      <div className="flex justify-between items-end h-full z-10 gap-3">
                        {chartData.map((d) => (
                          <div key={d.label} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div className="mb-2 opacity-80 transition-transform transform translate-y-1 group-hover:translate-y-0 duration-200">
                              <span className="text-[10px] font-semibold text-muted tabular-nums">{formatCurrency(d.value)}</span>
                            </div>
                            <div
                              className="w-full rounded-t-[3px] relative transition-all duration-500 ease-out hover:opacity-100 opacity-90"
                              style={{
                                height: `${Math.max(d.heightPercentage, 4)}%`,
                                backgroundColor: d.color,
                                boxShadow: `0 -4px 12px ${d.color}20`
                              }}
                            >
                              <div className="absolute top-0 inset-x-0 h-[1px] bg-white/20" />
                            </div>
                            <div className="mt-3 text-[10px] font-bold text-muted uppercase tracking-widest truncate max-w-full text-center">
                              {d.label.substring(0, 3)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const NeoxDashboard: React.FC = () => {
  return (
    <CompaniesProvider>
      <PeopleProvider>
        <DealsProvider>
          <FinanceProvider>
            <SCMProvider>
              <DashboardContent />
            </SCMProvider>
          </FinanceProvider>
        </DealsProvider>
      </PeopleProvider>
    </CompaniesProvider>
  );
};

export default NeoxDashboard;

