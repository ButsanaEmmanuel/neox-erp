import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Upload,
  Plus,
  Building2,
  Globe,
  Users,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  DollarSign,
  Receipt,
  Clock3,
  Edit2,
  Save,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getStageBadgeStyles } from '../constants/crm';
import { useCompanies } from '../contexts/CompaniesContext';
import { useDeals } from '../contexts/DealsContext';
import { apiRequest } from '../lib/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useToast } from './ui/Toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DrawerTab = 'Overview' | 'Deals' | 'Financial' | 'Activity';

interface CompanyRow {
  id: string;
  name: string;
  logoBg: string;
  domain: string;
  industry: string;
  size: string;
  owner: string;
  stage: 'Discovery' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closing';
  lastActivity: string;
  address: string;
}

interface ClientFinancialSnapshot {
  summary: {
    totalReceivable: number;
    totalOutstanding: number;
    totalCollected: number;
    overdueCount: number;
    invoiceCount: number;
    receiptCount: number;
  };
  collections: Array<{
    id: string;
    reference: string;
    amount: number;
    method: string;
    status: string;
    receiptDate: string;
  }>;
}

interface CompaniesListPageProps {
  readonly isDark: boolean;
  readonly onNavigate: (view: string) => void;
}

const CompaniesListPage: React.FC<CompaniesListPageProps> = ({ isDark, onNavigate }) => {
  const { companies: dbCompanies, updateCompany } = useCompanies();
  const { deals } = useDeals();
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('Overview');
  const [financialByClientId, setFinancialByClientId] = useState<Record<string, ClientFinancialSnapshot>>({});
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CompanyRow; direction: 'asc' | 'desc' } | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: '',
    address: '',
    contactPerson: '',
    email: '',
    phone: '',
  });

  const companies = useMemo<CompanyRow[]>(() => {
    return dbCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      logoBg: '#3B82F6',
      domain: c.domain || '-',
      industry: c.industry || '-',
      size: c.size || '-',
      owner: 'N/A',
      stage: 'Discovery',
      lastActivity: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('fr-FR') : '-',
      address: c.address || '-',
    }));
  }, [dbCompanies]);

  const filteredCompanies = useMemo(() => {
    let data = [...companies];

    if (searchTerm.trim()) {
      const lower = searchTerm.trim().toLowerCase();
      data = data.filter((c) =>
        c.name.toLowerCase().includes(lower) ||
        c.domain.toLowerCase().includes(lower) ||
        c.industry.toLowerCase().includes(lower),
      );
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const av = String(a[sortConfig.key] ?? '').toLowerCase();
        const bv = String(b[sortConfig.key] ?? '').toLowerCase();
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [companies, searchTerm, sortConfig]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    if (!selectedCompany) {
      setIsEditingCompany(false);
      setCompanyForm({ name: '', industry: '', address: '', contactPerson: '', email: '', phone: '' });
      return;
    }
    const source = dbCompanies.find((c) => c.id === selectedCompany.id);
    setCompanyForm({
      name: selectedCompany.name || '',
      industry: selectedCompany.industry === '-' ? '' : (selectedCompany.industry || ''),
      address: selectedCompany.address === '-' ? '' : (selectedCompany.address || ''),
      contactPerson: source?.contactPerson || '',
      email: source?.email || '',
      phone: source?.phone || '',
    });
  }, [selectedCompany, dbCompanies]);

  const selectedCompanyDeals = useMemo(
    () => deals.filter((d) => d.companyId === selectedCompanyId),
    [deals, selectedCompanyId],
  );

  const selectedFinancialSnapshot = selectedCompanyId ? financialByClientId[selectedCompanyId] : undefined;

  useEffect(() => {
    if (!selectedCompanyId || activeTab !== 'Financial') return;
    if (financialByClientId[selectedCompanyId]) return;

    let cancelled = false;
    setFinancialLoading(true);
    setFinancialError(null);

    void apiRequest<ClientFinancialSnapshot>(`/api/v1/crm/clients/${selectedCompanyId}/financials`)
      .then((snapshot) => {
        if (cancelled) return;
        setFinancialByClientId((prev) => ({ ...prev, [selectedCompanyId]: snapshot }));
      })
      .catch((error) => {
        if (cancelled) return;
        setFinancialError(error instanceof Error ? error.message : 'Unable to load client financial data.');
      })
      .finally(() => {
        if (!cancelled) setFinancialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, financialByClientId, selectedCompanyId]);

  const handleSort = (key: keyof CompanyRow) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
      <div className="h-12 px-6 flex items-center justify-between flex-none border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Contacts - Companies</span>
          <h1 className={cn('text-[18px] font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>Companies</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-[220px] h-8 pl-9 pr-3 rounded-md text-[12px] border transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500/50',
                isDark
                  ? 'bg-[#111827] border-[#1e2d3d] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50'
                  : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400',
              )}
            />
          </div>

          <button
            className={cn(
              'h-8 px-3 rounded-md flex items-center gap-2 text-[12px] font-medium border transition-colors',
              isDark ? 'border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            <Filter size={14} />
            Filter
          </button>

          <button
            className={cn(
              'h-8 px-3 rounded-md flex items-center gap-2 text-[12px] font-medium border transition-colors',
              isDark ? 'border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            <Upload size={14} />
            Import
          </button>

          <button
            onClick={() => onNavigate('crm-contacts-companies-new')}
            className="h-8 pl-2 pr-3.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[12px] font-semibold rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            New Company
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0 relative">
        <div className={cn('flex-1 border rounded-[10px] overflow-hidden flex flex-col relative', isDark ? 'bg-[#111827] border-[#1e2d3d]' : 'bg-white border-slate-200')}>
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: 'auto' }} />
              </colgroup>

              <thead className={cn('sticky top-0 z-10 text-left border-b', isDark ? 'bg-[#0d1117] border-white/[0.06]' : 'bg-slate-50 border-slate-200')}>
                <tr>
                  {[
                    { label: 'Company', key: 'name' },
                    { label: 'Domain', key: 'domain' },
                    { label: 'Industry', key: 'industry' },
                    { label: 'Owner', key: 'owner' },
                    { label: 'Stage', key: 'stage' },
                    { label: 'Last Activity', key: 'lastActivity' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      onClick={() => handleSort(col.key as keyof CompanyRow)}
                      className={cn(
                        'h-10 px-5 text-[10px] font-bold uppercase tracking-[0.07em] cursor-pointer select-none transition-colors',
                        isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.label}
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp size={10} className="text-emerald-500" />
                          ) : (
                            <ArrowDown size={10} className="text-emerald-500" />
                          )
                        ) : (
                          <ArrowUpDown size={10} className="opacity-30" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      setActiveTab('Overview');
                    }}
                    className={cn(
                      'h-[56px] border-b transition-all cursor-pointer group relative',
                      isDark ? 'border-white/[0.03] hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50',
                      selectedCompanyId === company.id && (isDark ? 'bg-emerald-500/[0.05]' : 'bg-emerald-50'),
                    )}
                  >
                    <td className={cn('px-5 py-0 transition-all border-l-2 border-transparent', selectedCompanyId === company.id ? 'border-emerald-500' : 'group-hover:border-emerald-500')}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: company.logoBg }}>
                          {company.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className={cn('text-[13px] font-medium truncate', isDark ? 'text-slate-100' : 'text-slate-900')}>{company.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-0">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Globe size={12} />
                        <span className="text-[13px] truncate">{company.domain}</span>
                      </div>
                    </td>

                    <td className="px-5 py-0">
                      <span className="text-[13px] text-slate-500 truncate block max-w-full">{company.industry}</span>
                    </td>

                    <td className="px-5 py-0">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[9px] font-bold">
                          {company.owner.charAt(0)}
                        </div>
                        <span className="text-[13px] text-slate-500 truncate">{company.owner}</span>
                      </div>
                    </td>

                    <td className="px-5 py-0">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border" style={getStageBadgeStyles(company.stage)}>
                        {company.stage}
                      </span>
                    </td>

                    <td className="px-5 py-0">
                      <span className="text-[12px] text-slate-500 tabular-nums">{company.lastActivity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedCompany && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn('absolute top-0 right-0 h-full w-[420px] border-l z-20 shadow-2xl flex flex-col', isDark ? 'bg-[#111827] border-[#1e2d3d]' : 'bg-white border-slate-200')}
          >
            <div className="p-6 border-b border-white/[0.06] flex-none">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-md flex items-center justify-center text-[16px] font-bold text-white shadow-md" style={{ backgroundColor: selectedCompany.logoBg }}>
                  {selectedCompany.name.substring(0, 2).toUpperCase()}
                </div>
                <button onClick={() => setSelectedCompanyId(null)} className="p-1 rounded-md hover:bg-white/5 text-slate-500 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <h2 className={cn('text-[16px] font-semibold mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>{selectedCompany.name}</h2>
              <div className="flex items-center gap-2 text-slate-500 text-[12px]">
                <Globe size={12} />
                {selectedCompany.domain}
              </div>
            </div>

              <div className="flex px-6 border-b border-white/[0.06] gap-6">
              {(['Overview', 'Deals', 'Financial', 'Activity'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'py-3 text-[12px] font-medium border-b-2 transition-colors',
                    activeTab === tab ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500 hover:text-slate-300',
                  )}
                >
                  {tab}
                </button>
              ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeTab === 'Overview' && (
                  <>
                    <div className="flex items-center justify-end gap-2">
                      {isEditingCompany ? (
                        <>
                          <button
                            onClick={() => setIsEditingCompany(false)}
                            className={cn(
                              'h-8 px-3 rounded-md text-[12px] font-medium border transition-colors',
                              isDark ? 'border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedCompany?.id) return;
                              try {
                                await updateCompany({
                                  id: selectedCompany.id,
                                  name: companyForm.name.trim(),
                                  industry: companyForm.industry.trim() || undefined,
                                  address: companyForm.address.trim() || undefined,
                                  contactPerson: companyForm.contactPerson.trim() || undefined,
                                  email: companyForm.email.trim() || undefined,
                                  phone: companyForm.phone.trim() || undefined,
                                });
                                setIsEditingCompany(false);
                                addToast('Company updated successfully.', 'success');
                              } catch (error) {
                                addToast(error instanceof Error ? error.message : 'Failed to update company.', 'error');
                              }
                            }}
                            className="h-8 px-3 rounded-md text-[12px] font-semibold bg-emerald-500 hover:bg-emerald-400 text-black inline-flex items-center gap-1.5"
                          >
                            <Save size={13} /> Save
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsEditingCompany(true)}
                          className={cn(
                            'h-8 px-3 rounded-md text-[12px] font-medium border transition-colors inline-flex items-center gap-1.5',
                            isDark ? 'border-[#1e2d3d] text-slate-300 hover:text-slate-100 hover:bg-[#1e2d3d]' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          <Edit2 size={13} /> Edit Company
                        </button>
                      )}
                    </div>

                    <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                      <label className="block text-[11px] text-slate-500 mb-1">Company Name</label>
                      {isEditingCompany ? (
                        <input
                          value={companyForm.name}
                          onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                        />
                      ) : (
                        <p className="text-[13px] text-slate-200">{selectedCompany.name}</p>
                      )}
                    </div>

                    <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                      <label className="block text-[11px] text-slate-500 mb-1">Industry</label>
                      {isEditingCompany ? (
                        <input
                          value={companyForm.industry}
                          onChange={(e) => setCompanyForm((prev) => ({ ...prev, industry: e.target.value }))}
                          className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                        />
                      ) : (
                        <p className="text-[13px] text-slate-200">{selectedCompany.industry}</p>
                      )}
                    </div>

                    <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                      <label className="block text-[11px] text-slate-500 mb-1">Address</label>
                      {isEditingCompany ? (
                        <input
                          value={companyForm.address}
                          onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))}
                          className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                        />
                      ) : (
                        <p className="text-[13px] text-slate-200">{selectedCompany.address}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                        <label className="block text-[11px] text-slate-500 mb-1">Contact Person</label>
                        {isEditingCompany ? (
                          <input
                            value={companyForm.contactPerson}
                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                            className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                          />
                        ) : (
                          <p className="text-[13px] text-slate-200">{companyForm.contactPerson || '-'}</p>
                        )}
                      </div>
                      <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                        <label className="block text-[11px] text-slate-500 mb-1">Owner</label>
                        <p className="text-[13px] text-slate-200">{selectedCompany.owner}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                        <label className="block text-[11px] text-slate-500 mb-1">Email</label>
                        {isEditingCompany ? (
                          <input
                            value={companyForm.email}
                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                          />
                        ) : (
                          <p className="text-[13px] text-slate-200">{companyForm.email || '-'}</p>
                        )}
                      </div>
                      <div className={cn('px-4 py-3 rounded-lg border border-white/[0.06]', isDark ? 'bg-[#0d1117]' : 'bg-slate-50')}>
                        <label className="block text-[11px] text-slate-500 mb-1">Phone</label>
                        {isEditingCompany ? (
                          <input
                            value={companyForm.phone}
                            onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className="w-full h-9 px-3 rounded-md text-[13px] bg-transparent border border-white/[0.12] text-white"
                          />
                        ) : (
                          <p className="text-[13px] text-slate-200">{companyForm.phone || '-'}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

              {activeTab === 'Deals' && (
                <>
                  {selectedCompanyDeals.length === 0 ? (
                    <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4 text-sm text-slate-400">No deals linked to this client yet.</div>
                  ) : (
                    selectedCompanyDeals.map((deal) => (
                      <div key={deal.id} className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{deal.name}</p>
                            <p className="text-xs text-slate-400 mt-1">Stage: {deal.stage}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-300">{deal.value}</span>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'Financial' && (
                <>
                  {financialLoading && <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4 text-sm text-slate-400">Loading financial profile...</div>}
                  {financialError && !financialLoading && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{financialError}</div>
                  )}
                  {!financialLoading && !financialError && selectedFinancialSnapshot && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <FinancialKpi label="Total Receivable" value={formatCurrency(selectedFinancialSnapshot.summary.totalReceivable)} icon={<DollarSign size={14} />} />
                        <FinancialKpi label="Outstanding" value={formatCurrency(selectedFinancialSnapshot.summary.totalOutstanding)} icon={<Clock3 size={14} />} />
                        <FinancialKpi label="Collected" value={formatCurrency(selectedFinancialSnapshot.summary.totalCollected)} icon={<Receipt size={14} />} />
                        <FinancialKpi label="Overdue" value={String(selectedFinancialSnapshot.summary.overdueCount)} icon={<Clock3 size={14} />} />
                      </div>

                      <div className="rounded-lg border border-white/[0.08] bg-[#0d1117]">
                        <div className="px-4 py-3 border-b border-white/[0.06]">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Collection History</h4>
                        </div>
                        {selectedFinancialSnapshot.collections.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">No collections recorded yet.</div>
                        ) : (
                          <div className="max-h-[280px] overflow-y-auto">
                            {selectedFinancialSnapshot.collections.slice(0, 12).map((row) => (
                              <div key={row.id} className="px-4 py-3 border-b border-white/[0.04] last:border-b-0 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm text-white font-medium">{row.reference || '-'}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{row.method || '-'} - {formatDate(row.receiptDate, 'short')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-emerald-300 font-semibold">{formatCurrency(Number(row.amount || 0))}</p>
                                  <p className="text-[10px] uppercase text-slate-500 mt-0.5">{row.status || '-'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'Activity' && (
                <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] p-4">
                  <p className="text-xs text-slate-400">Client record activity</p>
                  <p className="text-sm text-white mt-2">Last update: {selectedCompany.lastActivity}</p>
                  <p className="text-xs text-slate-500 mt-2">Detailed CRM activity feed can be connected here to audit logs.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FinancialKpi = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-lg border border-white/[0.08] bg-[#0d1117] px-3 py-2">
    <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">{icon}{label}</p>
    <p className="text-sm text-white font-mono mt-1">{value}</p>
  </div>
);

export default CompaniesListPage;
