// Access Control Center — selected role detail with 9 read-only tabs.
//
// Phase 2: every tab renders an explanatory placeholder card. Phase 3+
// wires real toggles + saves. No mutations are exposed here yet.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, LayoutGrid, ListChecks, MapPin, Network,
  Workflow, EyeOff, Users, History, Info, Sparkles,
} from 'lucide-react';
import { ACC_ROLE_TABS, type AccRoleTabKey } from './acc.constants';
import type { AccRoleDetail as AccRoleDetailType } from '../../services/accessControlApi';
import PageAccessTab from './PageAccessTab';
import ActionPermissionsTab from './ActionPermissionsTab';

interface AccRoleDetailProps {
  role: AccRoleDetailType | null;
  loading: boolean;
  error: string | null;
  /** Bumped after a save to invalidate cached counters in this view. */
  refreshKey?: number;
  /** Notifies the parent that the role tree should refetch its counters. */
  onSaved?: () => void;
  /**
   * Optional controlled override: when this changes, the internal tab
   * state snaps to it. Used by the left-nav shortcuts (Page Access,
   * Action Permissions) so clicking those entries lands the user
   * directly on the corresponding per-role editor.
   */
  forceTab?: AccRoleTabKey;
  /** Bumps each time the parent wants to re-trigger forceTab even if the value is unchanged. */
  forceTabNonce?: number;
}

const TAB_ICONS: Record<AccRoleTabKey, React.ReactNode> = {
  overview:            <Sparkles size={13} />,
  'module-page-access':<LayoutGrid size={13} />,
  actions:             <ListChecks size={13} />,
  'data-scope':        <MapPin size={13} />,
  'cross-module-access':<Network size={13} />,
  'approval-authority':<Workflow size={13} />,
  'field-restrictions':<EyeOff size={13} />,
  members:             <Users size={13} />,
  'audit-trail':       <History size={13} />,
};

const AccRoleDetail: React.FC<AccRoleDetailProps> = ({
  role, loading, error, refreshKey, onSaved, forceTab, forceTabNonce,
}) => {
  const [tab, setTab] = useState<AccRoleTabKey>('overview');

  // Pull the forced tab in whenever the parent pushes a new request.
  // Watching nonce too lets the same key (e.g. 'actions') re-fire when
  // the user clicks the left-nav shortcut twice in a row.
  useEffect(() => {
    if (forceTab) setTab(forceTab);
  }, [forceTab, forceTabNonce]);

  if (loading && !role) {
    return (
      <div className="flex-1 p-8 text-xs text-muted">Loading role…</div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 p-8 text-xs text-rose-400">{error}</div>
    );
  }
  if (!role) {
    // Contextual hint when admins arrive here via the left-nav
    // shortcuts. The editors are per-role, so we tell them which
    // editor we'll open once a role is picked.
    const incomingEditor =
      forceTab === 'module-page-access' ? 'Module & Page Access editor'
      : forceTab === 'actions' ? 'Action Permissions editor'
      : null;
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-surface/60 border border-border/60 flex items-center justify-center text-muted">
            <ShieldCheck size={18} />
          </div>
          <p className="mt-3 text-sm text-primary font-medium">Pick a role to inspect</p>
          <p className="mt-1 text-[11px] text-muted leading-relaxed">
            Roles list on the left. Selection brings up every tab below.
            {incomingEditor && (
              <> The <strong className="text-primary">{incomingEditor}</strong> will open
              automatically once you pick a role.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/60 bg-card/40 flex items-start justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
            <span className="font-mono">{role.code}</span>
            {role.isSystem && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 normal-case tracking-normal">
                System
              </span>
            )}
            {!role.isActive && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 normal-case tracking-normal">
                Inactive
              </span>
            )}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-primary truncate">{role.label || role.name}</h2>
          {role.description && (
            <p className="mt-1 text-[11px] text-muted leading-relaxed line-clamp-2">{role.description}</p>
          )}
        </div>
        <div className="text-right text-[10px] text-muted shrink-0">
          <p>Created {new Date(role.createdAt).toLocaleDateString()}</p>
          <p>Updated {new Date(role.updatedAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Tabs wrap to a second line instead of scrolling — the thin dark
          scrollbar was invisible on wide viewports and admins thought
          the trailing tabs (Members, Audit Trail) had been dropped. */}
      <div className="px-6 border-b border-border/60 flex flex-wrap gap-x-4 gap-y-0 shrink-0 min-w-0">
        {ACC_ROLE_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`py-3 inline-flex items-center gap-1.5 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                active
                  ? 'text-blue-300 border-blue-400'
                  : 'text-muted border-transparent hover:text-primary'
              }`}
            >
              {TAB_ICONS[t.key]}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab body — vertical scroll only; horizontal contained so action
          chips wrap inside their parent instead of pushing the panel. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-6">
        {tab === 'overview' && <OverviewTab role={role} />}
        {tab === 'module-page-access' && (
          <PageAccessTab roleId={role.id} refreshKey={refreshKey} onSaved={onSaved} />
        )}
        {tab === 'actions' && (
          <ActionPermissionsTab roleId={role.id} refreshKey={refreshKey} onSaved={onSaved} />
        )}
        {tab !== 'overview' && tab !== 'module-page-access' && tab !== 'actions' && (
          <PlaceholderTab tabKey={tab} />
        )}
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ role: AccRoleDetailType }> = ({ role }) => {
  const summary = useMemo(() => [
    { label: 'Members assigned',     value: role.counts.members },
    { label: 'Pages granted',        value: role.counts.pages },
    { label: 'Actions granted',      value: role.counts.actions },
    { label: 'Data scope rules',     value: role.counts.dataScopes },
    { label: 'Field restrictions',   value: role.counts.fieldRestrictions },
    { label: 'Linked-record rules',  value: role.counts.linkedRecords },
  ], [role]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-primary tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-surface/30 p-5">
        <p className="text-xs font-semibold text-primary flex items-center gap-2">
          <MapPin size={13} className="text-muted" />
          Data scope summary
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Each row says “for module <span className="font-mono text-secondary">X</span>, this role sees
          <span className="font-mono text-secondary"> Y</span>-scoped data.” Read-only in phase 2.
        </p>
        <div className="mt-4 space-y-1.5">
          {role.scopes.length === 0 && (
            <p className="text-[11px] text-muted italic">No scope rules defined yet.</p>
          )}
          {role.scopes.map((s, i) => (
            <div key={`${s.moduleKey}-${i}`} className="flex items-center justify-between rounded-md border border-border/50 bg-card/30 px-3 py-1.5">
              <span className="text-[11px] text-secondary">
                Module <span className="font-mono text-primary">{s.moduleKey}</span>
                {s.pageKey && <> · Page <span className="font-mono text-primary">{s.pageKey}</span></>}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-blue-300 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">
                {s.scopeType}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PhaseBanner />
    </div>
  );
};

const PlaceholderTab: React.FC<{ tabKey: AccRoleTabKey }> = ({ tabKey }) => {
  const meta = ACC_ROLE_TABS.find((t) => t.key === tabKey);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-8 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-surface/60 border border-border/60 flex items-center justify-center text-muted">
          <Info size={16} />
        </div>
        <p className="mt-3 text-sm text-primary font-medium">{meta?.label}</p>
        <p className="mt-1 text-[11px] text-muted max-w-md mx-auto leading-relaxed">{meta?.preview}</p>
        <p className="mt-3 text-[10px] uppercase tracking-wider text-blue-300">Ships in a later phase</p>
      </div>
      <PhaseBanner />
    </div>
  );
};

const PhaseBanner: React.FC = () => (
  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[11px] text-amber-300 leading-relaxed">
    <strong className="font-semibold">Phase 4 in progress.</strong>{' '}
    The <strong>Module &amp; Page Access</strong> and <strong>Actions</strong> tabs are live with real toggles
    and audited saves. Other tabs remain placeholders until phase 5 (data scope), phase 7 (cross-module),
    phase 8 (approvals), phase 9 (field-level), phase 10 (audit log).
  </div>
);

export default AccRoleDetail;
