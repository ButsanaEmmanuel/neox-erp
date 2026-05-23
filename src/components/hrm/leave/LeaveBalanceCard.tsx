// HRM-1.5 — Single balance card. One row per (policy, year).

import React from 'react';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import type { LeaveBalance } from '../../../services/leaveApi';

const LeaveBalanceCard: React.FC<{ balance: LeaveBalance }> = ({ balance }) => {
  const allocated = Number(balance.allocated) + Number(balance.carryOver);
  const pct = allocated > 0 ? Math.min(100, Math.round(((balance.used + balance.pending) / allocated) * 100)) : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 transition-colors hover:bg-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {balance.policy.leaveType}
          </p>
          <p className="text-[14px] font-semibold text-primary">{balance.policy.name}</p>
          <p className="text-[11px] text-muted">{balance.year}</p>
        </div>
        <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
          {balance.available} left
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-muted">
          <Calendar size={11} />
          <dt className="sr-only">Allocated</dt>
          <dd>{allocated} allocated</dd>
        </div>
        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <Clock size={11} />
          <dt className="sr-only">Pending</dt>
          <dd>{balance.pending} pending</dd>
        </div>
        <div className="flex items-center gap-1 text-secondary">
          <CheckCircle2 size={11} />
          <dt className="sr-only">Used</dt>
          <dd>{balance.used} used</dd>
        </div>
      </dl>
    </div>
  );
};

export default LeaveBalanceCard;
