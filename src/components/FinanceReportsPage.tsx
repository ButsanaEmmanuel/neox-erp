import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';

interface AgingBucket {
  key: string;
  label: string;
  amount: number;
  count: number;
}

interface FinanceReportsPayload {
  generatedAt: string;
  receivablesAging: AgingBucket[];
  payablesAging: AgingBucket[];
  collectionsByClient: Array<{ clientId?: string | null; clientName: string; totalCollected: number; entries: number; lastReceiptAt?: string | null }>;
  disbursementsBySupplier: Array<{ supplierName: string; totalDisbursed: number; entries: number; lastPaymentAt?: string | null }>;
  projectCashflow: Array<{ projectId: string; projectName: string; inflow: number; outflow: number; net: number; pendingSettlement: number }>;
  evidenceCompliance: { requiredEntries: number; compliantEntries: number; missingEntries: number; complianceRate: number };
  pendingValidation: Array<{ id: string; referenceCode: string; title: string; amount: number; lifecycleStatus: string; approvalStatus: string; evidenceStatus: string; settlementStatus: string; sourceModule: string; updatedAt: string }>;
  reconciliationExceptions: {
    latestReconciliationCode?: string | null;
    openDiscrepancies: number;
    highSeverity: number;
    unresolvedCases: Array<{ id: string; title: string; severity: string; status: string; caseType: string; sourceModule?: string | null; reconciliationCode?: string | null; createdAt: string }>;
  };
}

const emptyReports: FinanceReportsPayload = {
  generatedAt: new Date(0).toISOString(),
  receivablesAging: [],
  payablesAging: [],
  collectionsByClient: [],
  disbursementsBySupplier: [],
  projectCashflow: [],
  evidenceCompliance: { requiredEntries: 0, compliantEntries: 0, missingEntries: 0, complianceRate: 100 },
  pendingValidation: [],
  reconciliationExceptions: { latestReconciliationCode: null, openDiscrepancies: 0, highSeverity: 0, unresolvedCases: [] },
};

const FinanceReportsPage: React.FC = () => {
  const [reports, setReports] = useState<FinanceReportsPayload>(emptyReports);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ reports: FinanceReportsPayload }>('/api/v1/finance/reports');
      setReports(data.reports || emptyReports);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const receivables = reports.receivablesAging.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const payables = reports.payablesAging.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { receivables, payables };
  }, [reports]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">Finance Reports (DB-backed)</h3>
          <p className="text-xs text-secondary mt-1">Receivables aging, payables aging, collections, disbursements, evidence compliance, and reconciliation exceptions.</p>
          <p className="text-[11px] text-muted mt-2">Generated at {formatDate(reports.generatedAt, 'short')}</p>
        </div>
        <button onClick={() => void load()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 hover:bg-surface" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-secondary">Receivables Aging Total</p>
          <p className="text-2xl text-emerald-300 font-semibold mt-2">{formatCurrency(totals.receivables)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-secondary">Payables Aging Total</p>
          <p className="text-2xl text-rose-300 font-semibold mt-2">{formatCurrency(totals.payables)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-secondary">Pending Validation</p>
          <p className="text-2xl text-amber-300 font-semibold mt-2">{reports.pendingValidation.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-secondary">Evidence Compliance</p>
          <p className="text-2xl text-cyan-300 font-semibold mt-2">{reports.evidenceCompliance.complianceRate.toFixed(2)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-primary text-sm font-semibold"><BarChart3 size={15} /> Receivables Aging</div>
          <div className="p-4 space-y-2">
            {reports.receivablesAging.map((row) => (
              <div key={row.key} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-surface border border-border/70">
                <span className="text-secondary">{row.label}</span>
                <span className="text-emerald-300 font-semibold">{formatCurrency(row.amount)} - {row.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-primary text-sm font-semibold"><BarChart3 size={15} /> Payables Aging</div>
          <div className="p-4 space-y-2">
            {reports.payablesAging.map((row) => (
              <div key={row.key} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-surface border border-border/70">
                <span className="text-secondary">{row.label}</span>
                <span className="text-rose-300 font-semibold">{formatCurrency(row.amount)} - {row.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-primary text-sm font-semibold">Collections by Client</div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-muted bg-surface">
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2 text-right">Collected</th>
                  <th className="px-4 py-2 text-right">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {reports.collectionsByClient.map((row) => (
                  <tr key={`${row.clientId || row.clientName}`}>
                    <td className="px-4 py-2 text-sm text-primary">{row.clientName}</td>
                    <td className="px-4 py-2 text-sm text-right text-emerald-300">{formatCurrency(row.totalCollected)}</td>
                    <td className="px-4 py-2 text-sm text-right text-secondary">{row.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-primary text-sm font-semibold">Disbursements by Supplier</div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-muted bg-surface">
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2 text-right">Disbursed</th>
                  <th className="px-4 py-2 text-right">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {reports.disbursementsBySupplier.map((row) => (
                  <tr key={row.supplierName}>
                    <td className="px-4 py-2 text-sm text-primary">{row.supplierName}</td>
                    <td className="px-4 py-2 text-sm text-right text-rose-300">{formatCurrency(row.totalDisbursed)}</td>
                    <td className="px-4 py-2 text-sm text-right text-secondary">{row.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-primary text-sm font-semibold"><Clock3 size={15} /> Pending Validation</div>
          <div className="max-h-80 overflow-auto divide-y divide-white/[0.05]">
            {reports.pendingValidation.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-primary font-medium">{row.referenceCode}</p>
                  <span className="text-xs text-amber-300">{formatCurrency(row.amount)}</span>
                </div>
                <p className="text-xs text-secondary mt-1">{row.title} - {row.sourceModule}</p>
                <p className="text-[11px] text-muted mt-1">{row.lifecycleStatus} / {row.approvalStatus} / {row.evidenceStatus}</p>
              </div>
            ))}
            {reports.pendingValidation.length === 0 && <div className="p-4 text-xs text-muted">No pending validation entries.</div>}
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-primary text-sm font-semibold"><AlertTriangle size={15} /> Reconciliation Exceptions</div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-border/80 bg-surface px-3 py-2">
                <p className="text-[10px] uppercase text-muted">Open</p>
                <p className="text-lg text-rose-300 font-semibold">{reports.reconciliationExceptions.openDiscrepancies}</p>
              </div>
              <div className="rounded-md border border-border/80 bg-surface px-3 py-2">
                <p className="text-[10px] uppercase text-muted">High severity</p>
                <p className="text-lg text-amber-300 font-semibold">{reports.reconciliationExceptions.highSeverity}</p>
              </div>
              <div className="rounded-md border border-border/80 bg-surface px-3 py-2">
                <p className="text-[10px] uppercase text-muted">Latest run</p>
                <p className="text-sm text-cyan-300 font-semibold mt-1">{reports.reconciliationExceptions.latestReconciliationCode || '-'}</p>
              </div>
            </div>
            <div className="max-h-48 overflow-auto divide-y divide-white/[0.05]">
              {reports.reconciliationExceptions.unresolvedCases.slice(0, 20).map((row) => (
                <div key={row.id} className="py-2">
                  <p className="text-sm text-primary">{row.title}</p>
                  <p className="text-xs text-secondary mt-1">{row.caseType} - {row.severity} - {row.status}</p>
                </div>
              ))}
              {reports.reconciliationExceptions.unresolvedCases.length === 0 && <p className="text-xs text-muted">No unresolved discrepancies.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-primary">Evidence Compliance</h4>
          <span className="text-xs text-secondary">Proof-backed outflows governance</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="rounded-md bg-surface border border-border p-3">
            <p className="text-[10px] uppercase text-muted">Required</p>
            <p className="text-lg text-primary font-semibold">{reports.evidenceCompliance.requiredEntries}</p>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <p className="text-[10px] uppercase text-muted">Compliant</p>
            <p className="text-lg text-emerald-300 font-semibold">{reports.evidenceCompliance.compliantEntries}</p>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <p className="text-[10px] uppercase text-muted">Missing</p>
            <p className="text-lg text-rose-300 font-semibold">{reports.evidenceCompliance.missingEntries}</p>
          </div>
          <div className="rounded-md bg-surface border border-border p-3">
            <p className="text-[10px] uppercase text-muted">Rate</p>
            <p className="text-lg text-cyan-300 font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> {reports.evidenceCompliance.complianceRate.toFixed(2)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceReportsPage;


