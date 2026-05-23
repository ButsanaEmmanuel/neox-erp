// HRM-1.5 — Modal: create a leave request from a policy + date range.

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../ui/Modal';
import { leaveApi, type LeavePolicy } from '../../../services/leaveApi';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  actorUserId?: string | null;
  onCreated: () => void;
}

function workingDaysBetween(startStr: string, endStr: string) {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose, userId, actorUserId, onCreated }) => {
  const [policies, setPolicies] = useState<LeavePolicy[] | null>(null);
  const [policyId, setPolicyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPolicyId('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setPolicies(null);
    leaveApi
      .listPolicies()
      .then((r) => {
        setPolicies(r.policies);
        if (r.policies.length > 0) setPolicyId(r.policies[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load policies'));
  }, [isOpen]);

  const days = useMemo(() => workingDaysBetween(startDate, endDate), [startDate, endDate]);

  const handleSubmit = async () => {
    if (!policyId || !startDate || !endDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await leaveApi.createRequest({
        userId,
        policyId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      }, actorUserId);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request leave"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-border"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!policyId || !startDate || !endDate || submitting || days <= 0}
            onClick={handleSubmit}
            className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : `Submit (${days} day${days === 1 ? '' : 's'})`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Policy</label>
          {!policies ? (
            <p className="text-[13px] text-muted">Loading policies…</p>
          ) : policies.length === 0 ? (
            <p className="text-[13px] text-muted">No active policy — ask HR to create one.</p>
          ) : (
            <select
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.leaveType} ({Number(p.daysPerYear)} days/year)
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Start *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">End *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Working days are counted (Saturday / Sunday excluded).
          {/* DH2 — public holidays not yet excluded server-side. */}
        </p>
        <div>
          <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Optional — context for your manager"
            className="w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary placeholder:text-muted focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
};

export default LeaveRequestModal;
