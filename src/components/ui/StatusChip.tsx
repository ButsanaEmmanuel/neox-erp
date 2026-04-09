import React from 'react';

const COLOR_MAP: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    onboarding: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    offboarding: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    not_started: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    open: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    investigating: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
    sourced: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    screening: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    interview: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    offer: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hired: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    signed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'pending-qa': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'pending-acceptance': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'in-progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    imported: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    needs_manual_completion: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ready_for_calculation: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    finance_pending: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    finance_synced: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    finance_sync_error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    awaiting_qa_approval: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    awaiting_signed_acceptance: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    awaiting_financial_eligibility: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    complete: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    synced: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    blocked: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

interface StatusChipProps {
    status: string;
    className?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, className = '' }) => {
    const colors = COLOR_MAP[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    const label = status.replace(/_/g, ' ');
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border whitespace-nowrap leading-none ${colors} ${className}`}>
            {label}
        </span>
    );
};

export default StatusChip;

