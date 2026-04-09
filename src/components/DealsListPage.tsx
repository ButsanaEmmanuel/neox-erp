import React, { useMemo, useState } from 'react';
import { Search, Plus, DollarSign, Calendar, ArrowUpDown, Tag, CheckCircle2 } from 'lucide-react';
import { getStageBadgeStyles } from '../constants/crm';
import { useDeals } from '../contexts/DealsContext';
import { Deal } from '../types/deal';

interface DealsListPageProps {
  readonly isDark: boolean;
  readonly onNavigate: (view: string) => void;
}

const DealsListPage: React.FC<DealsListPageProps> = ({ isDark, onNavigate }) => {
  const { deals, markDealWon } = useDeals();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Deal; direction: 'asc' | 'desc' } | null>(null);
  const [winningDealId, setWinningDealId] = useState<string | null>(null);

  const filteredDeals = useMemo(() => {
    let data = [...deals];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter((d) =>
        d.name.toLowerCase().includes(lowerTerm)
        || (d.company?.name && d.company.name.toLowerCase().includes(lowerTerm))
        || (d.primaryContact?.name && d.primaryContact.name.toLowerCase().includes(lowerTerm)),
      );
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = String(a[sortConfig.key] ?? '');
        const bVal = String(b[sortConfig.key] ?? '');
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [deals, searchTerm, sortConfig]);

  const handleSort = (key: keyof Deal) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleMarkWon = async (deal: Deal) => {
    setWinningDealId(deal.id);
    try {
      await markDealWon(deal.id, { wonAmount: Number(deal.numericValue || 0) });
    } catch (error) {
      console.error('Failed to mark deal as won:', error);
    } finally {
      setWinningDealId(null);
    }
  };

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className="h-full flex flex-col overflow-hidden transition-colors duration-200 bg-app"
    >
      <div className="h-[72px] px-6 flex items-center justify-between border-b flex-none bg-app border-border">
        <div className="flex flex-col gap-1">
          <nav className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted">
            <span className="opacity-70">CRM</span>
            <span className="opacity-40">/</span>
            <span className="opacity-70">PIPELINE</span>
            <span className="opacity-40">/</span>
            <span className="opacity-70">DEALS</span>
          </nav>
          <h1 className="text-xl font-bold tracking-tight text-primary">All Deals</h1>
        </div>

        <button
          onClick={() => onNavigate('crm-pipeline-deals-new')}
          className="h-9 px-4 rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 text-primary text-[13px] font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Deal
        </button>
      </div>

      <div className="h-14 px-6 flex items-center gap-3 border-b flex-none bg-app border-border">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search deals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-lg border text-[13px] transition-all placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/20 bg-surface border-border text-primary hover:border-border/80"
          />
        </div>
        <div className="text-[13px] font-medium text-muted">{filteredDeals.length} {filteredDeals.length === 1 ? 'deal' : 'deals'}</div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-app">
            <tr className="border-b text-[11px] font-bold uppercase tracking-wider border-border text-muted">
              <th className="text-left py-3 px-6 cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-2">Deal Name <ArrowUpDown size={12} /></div>
              </th>
              <th className="text-left py-3 px-6 cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => handleSort('company')}>
                <div className="flex items-center gap-2">Company <ArrowUpDown size={12} /></div>
              </th>
              <th className="text-left py-3 px-6">Stage</th>
              <th className="text-left py-3 px-6 cursor-pointer hover:text-emerald-500 transition-colors" onClick={() => handleSort('numericValue')}>
                <div className="flex items-center gap-2">Value <ArrowUpDown size={12} /></div>
              </th>
              <th className="text-left py-3 px-6">Owner</th>
              <th className="text-left py-3 px-6">Close Date</th>
              <th className="text-left py-3 px-6">Last Activity</th>
              <th className="text-left py-3 px-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal) => (
              <tr key={deal.id} className="border-b transition-colors cursor-pointer border-border hover:bg-surface/50">
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-[14px] font-semibold text-primary">{deal.name}</div>
                    {deal.primaryContact && <div className="text-[12px] text-muted">{deal.primaryContact.name}</div>}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold bg-surface text-muted">{deal.initials}</div>
                    <span className="text-[13px] font-medium text-primary">{deal.company?.name || 'No Company'}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold" style={getStageBadgeStyles(deal.stage)}>
                    <Tag size={12} />
                    {deal.stage}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <div className="text-[14px] font-bold tabular-nums text-emerald-500">{deal.value}</div>
                </td>
                <td className="py-4 px-6">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-500">{deal.owner}</div>
                </td>
                <td className="py-4 px-6">
                  {deal.closeDate ? (
                    <div className="flex items-center gap-2 text-[13px] text-muted">
                      <Calendar size={14} />
                      {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  ) : (
                    <span className="text-[13px] text-muted">-</span>
                  )}
                </td>
                <td className="py-4 px-6">
                  <span className="text-[13px] text-muted">{deal.lastActivity}</span>
                </td>
                <td className="py-4 px-6">
                  <button
                    disabled={winningDealId === deal.id || deal.probabilityValue >= 100}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleMarkWon(deal);
                    }}
                    className="h-8 px-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    {winningDealId === deal.id ? 'Saving...' : 'Mark Won'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <DollarSign size={48} className="text-muted/50 mb-4" />
            <p className="text-[15px] font-semibold mb-2 text-primary">No deals found</p>
            <p className="text-[13px] text-muted mb-6">{searchTerm ? 'Try adjusting your search' : 'Get started by creating your first deal'}</p>
            {!searchTerm && (
              <button
                onClick={() => onNavigate('crm-pipeline-deals-new')}
                className="h-9 px-4 rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 text-primary text-[13px] font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105 transition-all flex items-center gap-2"
              >
                <Plus size={16} strokeWidth={2.5} />
                New Deal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealsListPage;

