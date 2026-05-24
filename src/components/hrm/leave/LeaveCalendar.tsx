// HRM-1.5 — Team leave calendar (approved + pending) for a given month.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { leaveApi, type LeaveRequest } from '../../../services/leaveApi';

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

const STATUS_COLOR: Record<string, string> = {
  approved: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  pending:  'bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-amber-500/30',
};

const LeaveCalendar: React.FC = () => {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    leaveApi
      .listRequests({
        from: fmt(startOfMonth(cursor)),
        to: fmt(endOfMonth(cursor)),
      })
      .then((r) => {
        if (cancelled) return;
        setRequests(r.requests.filter((req) => req.statusCode === 'approved' || req.statusCode === 'pending'));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load calendar');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cursor]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const padStart = (first.getDay() + 6) % 7; // Monday-first grid
    const days: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < padStart; i += 1) days.push({ date: null, key: `pad-${i}` });
    for (let d = 1; d <= last.getDate(); d += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      days.push({ date, key: fmt(date) });
    }
    return days;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    if (!requests) return map;
    for (const r of requests) {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      for (let t = new Date(start.getFullYear(), start.getMonth(), start.getDate()); t <= end; t.setDate(t.getDate() + 1)) {
        const key = fmt(t);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
    }
    return map;
  }, [requests]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-primary capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="rounded-md border border-border bg-surface p-1.5 text-secondary hover:bg-border"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-secondary hover:bg-border"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="rounded-md border border-border bg-surface p-1.5 text-secondary hover:bg-border"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-[10px] font-medium uppercase text-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 py-1 text-center">{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          if (!c.date) return <div key={c.key} className="h-20" />;
          const key = fmt(c.date);
          const entries = byDay.get(key) ?? [];
          const isWeekend = c.date.getDay() === 0 || c.date.getDay() === 6;
          return (
            <div
              key={c.key}
              className={`h-20 rounded-md border p-1 text-[11px] ${
                isWeekend ? 'border-border/40 bg-surface/40 text-muted' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary">{c.date.getDate()}</span>
                {entries.length > 0 && (
                  <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {entries.length}
                  </span>
                )}
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {entries.slice(0, 2).map((r) => (
                  <li
                    key={r.id}
                    title={`${r.user?.name ?? 'Someone'} — ${r.policy?.leaveType ?? 'leave'}`}
                    className={`truncate rounded px-1 ring-1 ring-inset ${STATUS_COLOR[r.statusCode] ?? ''}`}
                  >
                    {r.user?.name?.split(' ')[0] ?? '—'}
                  </li>
                ))}
                {entries.length > 2 && (
                  <li className="px-1 text-[10px] text-muted">+{entries.length - 2}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="mt-3 inline-flex items-center gap-1 text-[12px] text-muted">
          <Loader2 size={12} className="animate-spin" /> refreshing…
        </div>
      )}
      {!loading && requests && requests.length === 0 && (
        <p className="mt-3 text-center text-[12px] text-muted">No team leave during this month.</p>
      )}
    </div>
  );
};

export default LeaveCalendar;
