// Access Control Center — top summary cards.
//
// Read-only counters fed by GET /api/v1/access-control/summary. Six cards,
// each click-through to the matching section (handled by the parent).

import React from 'react';
import { Shield, ShieldCheck, LayoutGrid, ListChecks, Workflow, History } from 'lucide-react';
import type { AccSummary } from '../../services/accessControlApi';
import type { AccSectionKey } from './acc.constants';

interface AccSummaryCardsProps {
  summary: AccSummary | null;
  loading: boolean;
  onJump: (section: AccSectionKey) => void;
}

interface Card {
  key: string;
  label: string;
  value: (s: AccSummary) => number;
  hint: string;
  icon: React.ReactNode;
  jumpTo: AccSectionKey;
}

const CARDS: ReadonlyArray<Card> = [
  { key: 'roles',     label: 'Total Roles',          value: (s) => s.roles,                hint: 'Active roles across the ERP',                icon: <Shield size={16} />,      jumpTo: 'roles' },
  { key: 'system',    label: 'System Roles',         value: (s) => s.systemRoles,          hint: 'Seeded baseline — cannot be deleted',        icon: <ShieldCheck size={16} />, jumpTo: 'roles' },
  { key: 'pages',     label: 'Pages Registered',     value: (s) => s.pages,                hint: 'Sidebar items under permission control',     icon: <LayoutGrid size={16} />,  jumpTo: 'page-access' },
  { key: 'actions',   label: 'Permission Actions',   value: (s) => s.actions,              hint: 'Business verbs (view, approve, settle, …)',  icon: <ListChecks size={16} />,  jumpTo: 'action-permissions' },
  { key: 'workflows', label: 'Workflows Prepared',   value: (s) => s.approvalWorkflows + s.crossModuleWorkflows, hint: 'Approval + cross-module workflows seeded', icon: <Workflow size={16} />,    jumpTo: 'approval-workflows' },
  { key: 'audit',     label: 'Audit Events',         value: (s) => s.auditEvents,          hint: 'Permission changes recorded',                icon: <History size={16} />,     jumpTo: 'audit-log' },
];

const AccSummaryCards: React.FC<AccSummaryCardsProps> = ({ summary, loading, onJump }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {CARDS.map((c) => {
        const v = loading || !summary ? '—' : c.value(summary).toLocaleString();
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onJump(c.jumpTo)}
            className="text-left rounded-xl border border-border/60 bg-surface/60 hover:bg-surface px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-2 text-muted text-[10px] uppercase tracking-wider">
              <span className="opacity-70 group-hover:opacity-100">{c.icon}</span>
              {c.label}
            </div>
            <p className="mt-1 text-2xl font-semibold text-primary tabular-nums">{v}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted/80">{c.hint}</p>
          </button>
        );
      })}
    </div>
  );
};

export default AccSummaryCards;
