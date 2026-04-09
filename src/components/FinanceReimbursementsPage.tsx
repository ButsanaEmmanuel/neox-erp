import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCcw } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ExpenseClaim {
  id: string;
  claimNumber: string;
  employeeName: string;
  amount: number;
  currencyCode: string;
  status: string;
  approvalStatus: string;
  submissionDate: string;
  payableId?: string | null;
}

interface EmployeeAdvance {
  id: string;
  advanceNumber: string;
  employeeName: string;
  amount: number;
  currencyCode: string;
  status: string;
  approvalStatus: string;
  requestedAt: string;
  payableId?: string | null;
}

const FinanceReimbursementsPage: React.FC = () => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [claimsData, advancesData] = await Promise.all([
      apiRequest<{ claims: ExpenseClaim[] }>('/api/v1/finance/hrm/expense-claims?take=200'),
      apiRequest<{ advances: EmployeeAdvance[] }>('/api/v1/finance/hrm/employee-advances?take=200'),
    ]);
    setClaims(claimsData.claims || []);
    setAdvances(advancesData.advances || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const claimPending = claims.filter((c) => c.approvalStatus !== 'approved').reduce((s, c) => s + Number(c.amount || 0), 0);
    const advancePending = advances.filter((a) => a.approvalStatus !== 'approved').reduce((s, a) => s + Number(a.amount || 0), 0);
    return { claimPending, advancePending };
  }, [claims, advances]);

  const quickCreateClaim = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/v1/finance/hrm/expense-claims', {
        method: 'POST',
        body: {
          employeeName: 'Employee Reimbursement',
          amount: 125,
          currencyCode: 'USD',
          categoryCode: 'travel',
          description: 'Taxi reimbursement',
        },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const quickCreateAdvance = async () => {
    setBusy(true);
    try {
      await apiRequest('/api/v1/finance/hrm/employee-advances', {
        method: 'POST',
        body: {
          employeeName: 'Employee Advance',
          amount: 200,
          currencyCode: 'USD',
          reason: 'Field operation cash advance',
        },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const approveClaim = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/finance/hrm/expense-claims/${id}/approve`, {
        method: 'POST',
        body: { actorDisplayName: 'Finance Approver' },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const approveAdvance = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/finance/hrm/employee-advances/${id}/approve`, {
        method: 'POST',
        body: { actorDisplayName: 'Finance Approver' },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">Reimbursement Queue</h3>
          <p className="text-xs text-secondary mt-1">Approved expense claims and employee advances become finance-controlled payables.</p>
          <p className="text-xs text-emerald-300 mt-2">Pending claims: {formatCurrency(totals.claimPending)} - Pending advances: {formatCurrency(totals.advancePending)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={busy} onClick={() => void quickCreateClaim()} className="h-9 px-3 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold disabled:opacity-50">New Claim</button>
          <button disabled={busy} onClick={() => void quickCreateAdvance()} className="h-9 px-3 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold disabled:opacity-50">New Advance</button>
          <button disabled={busy} onClick={() => void load()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 disabled:opacity-50"><RefreshCcw size={14} />Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Expense Claims</div>
          <div className="max-h-[500px] overflow-y-auto">
            {claims.map((row) => (
              <div key={row.id} className="px-5 py-4 border-b border-border/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">{row.claimNumber}</p>
                    <p className="text-xs text-muted mt-1">{row.employeeName} - {formatDate(row.submissionDate, 'short')}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(Number(row.amount || 0))}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] uppercase text-secondary">{row.approvalStatus}</span>
                  <button disabled={busy || row.approvalStatus === 'approved'} onClick={() => void approveClaim(row.id)} className="h-7 px-2.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1"><CheckCircle2 size={12} />Approve</button>
                </div>
              </div>
            ))}
            {claims.length === 0 && <div className="p-6 text-sm text-muted">No expense claims.</div>}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Employee Advances</div>
          <div className="max-h-[500px] overflow-y-auto">
            {advances.map((row) => (
              <div key={row.id} className="px-5 py-4 border-b border-border/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">{row.advanceNumber}</p>
                    <p className="text-xs text-muted mt-1">{row.employeeName} - {formatDate(row.requestedAt, 'short')}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(Number(row.amount || 0))}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] uppercase text-secondary">{row.approvalStatus}</span>
                  <button disabled={busy || row.approvalStatus === 'approved'} onClick={() => void approveAdvance(row.id)} className="h-7 px-2.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1"><CheckCircle2 size={12} />Approve</button>
                </div>
              </div>
            ))}
            {advances.length === 0 && <div className="p-6 text-sm text-muted">No employee advances.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceReimbursementsPage;


