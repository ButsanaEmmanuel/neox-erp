// HRM-1.5 — Leave page shell. Refactored to use the new DB-driven API
// and the 5 dedicated subcomponents. Visual structure (PageHeader +
// horizontal tabs) is preserved to stay consistent with the rest of
// HRM (DirectoryPage, HRMConfiguration).

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Calendar as CalendarIcon, Inbox, Settings, Clock, CheckCircle2, XCircle, Trash2, RefreshCw } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import LeaveBalanceCard from './LeaveBalanceCard';
import LeaveRequestModal from './LeaveRequestModal';
import LeaveCalendar from './LeaveCalendar';
import PendingApprovalsPanel from './PendingApprovalsPanel';
import LeavePolicyManager from './LeavePolicyManager';
import { leaveApi, type LeaveBalance, type LeaveRequest } from '../../../services/leaveApi';
import { useHrmRealtimeSync } from '../../../hooks/useHrmRealtimeSync';

type Tab = 'mine' | 'calendar' | 'approvals' | 'policies';

const LeavePage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error') => toast?.addToast(msg, type);

  const canManagePolicies = isReady && has('hrm.leave.admin');
  const canApprove        = isReady && has('hrm.leave.execute');
  const canRequest        = isReady && has('hrm.leave.write');

  const [tab, setTab] = useState<Tab>('mine');
  const [modalOpen, setModalOpen] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const userId = user?.id ?? '';

  const reloadMine = async () => {
    if (!userId) {
      setBalances([]);
      setMyRequests([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [b, r] = await Promise.all([
        leaveApi.listBalances({ userId, forUserId: userId, year: new Date().getFullYear() }),
        leaveApi.listRequests({ userId, forUserId: userId }),
      ]);
      setBalances(b.balances);
      setMyRequests(r.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'mine') void reloadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  // HRM-2.6 — react to live decisions on my own requests.
  useHrmRealtimeSync(userId, {
    'hrm.leave.approved': (payload) => {
      if (payload?.userId !== userId) return;
      notify('Your leave request was approved', 'success');
      if (tab === 'mine') void reloadMine();
    },
    'hrm.leave.rejected': (payload) => {
      if (payload?.userId !== userId) return;
      const note = typeof payload?.reviewNote === 'string' && payload.reviewNote.trim() ? `: ${payload.reviewNote}` : '';
      notify(`Your leave request was rejected${note}`, 'error');
      if (tab === 'mine') void reloadMine();
    },
    // Managers on the Approvals tab: refresh the pending list when a
    // new request lands.
    'hrm.leave.requested': () => {
      if (tab === 'approvals' && canApprove) {
        // PendingApprovalsPanel is the listener for this — it reloads
        // through its own onChange callback on every poll trigger.
        // We piggy-back by re-mounting via a quick state nudge.
        void reloadMine();
      }
    },
  });

  const handleCancel = async (req: LeaveRequest) => {
    if (req.statusCode !== 'pending' && req.statusCode !== 'approved') return;
    if (!confirm(`Cancel this ${req.statusCode} request (${req.days} day${req.days === 1 ? '' : 's'})?`)) return;
    setCancelBusyId(req.id);
    try {
      await leaveApi.cancelRequest(req.id, userId);
      notify('Request cancelled', 'success');
      await reloadMine();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Cancel failed', 'error');
    } finally {
      setCancelBusyId(null);
    }
  };

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
      { id: 'mine', label: 'My leave', icon: <Inbox size={14} /> },
      { id: 'calendar', label: 'Team calendar', icon: <CalendarIcon size={14} /> },
    ];
    if (canApprove) list.push({ id: 'approvals', label: 'Approvals', icon: <CheckCircle2 size={14} /> });
    if (canManagePolicies) list.push({ id: 'policies', label: 'Policies', icon: <Settings size={14} /> });
    return list;
  }, [canApprove, canManagePolicies]);

  return (
    <div className="h-full flex flex-col bg-app overflow-hidden">
      <PageHeader
        title="Leave"
        subtitle="Submit requests, watch balances, manage policies"
        actions={
          canRequest && tab === 'mine' ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Plus size={15} /> Request leave
            </button>
          ) : undefined
        }
      />

      <div className="px-6 border-b border-border flex items-center gap-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-3 text-[13px] font-medium flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.id
                ? 'text-primary border-emerald-500'
                : 'text-muted border-transparent hover:text-primary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {tab === 'mine' && (
          <>
            {error && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => void reloadMine()}
                  className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10"
                >
                  Retry
                </button>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-primary">My balances</h3>
              {loading && !balances ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-border/60 bg-card/40" />)}
                </div>
              ) : balances && balances.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-surface/30 px-4 py-6 text-center text-[12px] text-muted">
                  No balance for {new Date().getFullYear()} yet — HR can initialize them from Policies.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {balances?.map((b) => <LeaveBalanceCard key={b.id} balance={b} />)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-primary">
                  My requests {myRequests ? `(${myRequests.length})` : ''}
                </h3>
                <button
                  type="button"
                  onClick={() => void reloadMine()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-secondary hover:bg-border"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              {loading && !myRequests ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-border/60 bg-card/40" />)}
                </div>
              ) : myRequests && myRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface/30 p-8 text-center">
                  <p className="text-[13px] text-muted">No leave request yet.</p>
                  {canRequest && (
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700"
                    >
                      <Plus size={14} /> Submit your first request
                    </button>
                  )}
                </div>
              ) : (
                <ul className="space-y-2">
                  {myRequests?.map((r) => {
                    const cancellable = r.statusCode === 'pending' || (r.statusCode === 'approved' && new Date(r.startDate).getTime() > Date.now());
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-primary">
                            {r.policy?.name ?? r.policyId}
                            <span className="ml-2 text-[11px] uppercase text-muted">{r.policy?.leaveType}</span>
                          </p>
                          <p className="text-[12px] text-muted">
                            {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} ·{' '}
                            <span className="font-medium text-primary">{r.days} day{r.days === 1 ? '' : 's'}</span>
                          </p>
                          {r.reason && <p className="mt-0.5 text-[11px] text-secondary">&ldquo;{r.reason}&rdquo;</p>}
                          {r.reviewNote && (
                            <p className="mt-0.5 text-[11px] text-muted">
                              Reviewer note: {r.reviewNote}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusChip status={r.statusCode} />
                          {cancellable && (
                            <button
                              type="button"
                              disabled={cancelBusyId === r.id}
                              onClick={() => handleCancel(r)}
                              className="rounded-md border border-border bg-surface p-1.5 text-secondary hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
                              title="Cancel"
                            >
                              {cancelBusyId === r.id ? <Clock size={12} /> : <Trash2 size={12} />}
                            </button>
                          )}
                          {r.statusCode === 'rejected' && (
                            <XCircle size={14} className="text-red-500" aria-hidden="true" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === 'calendar' && <LeaveCalendar />}

        {tab === 'approvals' && canApprove && userId && (
          <PendingApprovalsPanel actorUserId={userId} onChange={() => { void reloadMine(); }} />
        )}

        {tab === 'policies' && canManagePolicies && userId && (
          <LeavePolicyManager actorUserId={userId} />
        )}
      </div>

      {userId && (
        <LeaveRequestModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={userId}
          actorUserId={userId}
          onCreated={() => {
            notify('Leave request submitted', 'success');
            void reloadMine();
          }}
        />
      )}
    </div>
  );
};

export default LeavePage;
