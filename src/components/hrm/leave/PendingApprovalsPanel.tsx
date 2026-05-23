// HRM-1.5 — Manager queue of pending leave requests.

import React, { useEffect, useState } from 'react';
import { Check, X, RefreshCw, Clock } from 'lucide-react';
import { useToast } from '../../ui/Toast';
import { leaveApi, type LeaveRequest } from '../../../services/leaveApi';

interface PendingApprovalsPanelProps {
  actorUserId: string;
  onChange?: () => void;
}

const PendingApprovalsPanel: React.FC<PendingApprovalsPanelProps> = ({ actorUserId, onChange }) => {
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error') => toast?.addToast(msg, type);
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await leaveApi.listRequests({ status: 'pending' });
      setRequests(r.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      if (decision === 'approve') await leaveApi.approveRequest(id, undefined, actorUserId);
      else await leaveApi.rejectRequest(id, undefined, actorUserId);
      notify(decision === 'approve' ? 'Leave approved' : 'Leave rejected', 'success');
      await reload();
      onChange?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-primary">
          Pending approvals {requests ? `(${requests.length})` : ''}
        </h3>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-secondary hover:bg-border"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !requests ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border/60 bg-card/40" />
          ))}
        </div>
      ) : requests && requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/30 p-8 text-center">
          <p className="text-[13px] text-muted">No pending approval right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {requests?.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-4"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-primary">
                  {r.user?.name ?? r.user?.email ?? r.userId}
                </p>
                <p className="text-[12px] text-muted">
                  {r.policy?.name ?? r.policyId} · {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} ·{' '}
                  <span className="font-medium text-primary">{r.days} day{r.days === 1 ? '' : 's'}</span>
                </p>
                {r.reason && <p className="mt-0.5 text-[11px] text-secondary">&ldquo;{r.reason}&rdquo;</p>}
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted">
                  <Clock size={10} /> submitted {new Date(r.startDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'approve')}
                  className="rounded-md bg-emerald-600/10 p-2 text-emerald-600 hover:bg-emerald-600/20 disabled:opacity-40 dark:text-emerald-400"
                  title="Approve"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'reject')}
                  className="rounded-md bg-red-600/10 p-2 text-red-600 hover:bg-red-600/20 disabled:opacity-40 dark:text-red-400"
                  title="Reject"
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PendingApprovalsPanel;
