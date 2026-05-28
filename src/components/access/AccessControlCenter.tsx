// Access Control Center — phase 2 main page.
//
// Layout: header → summary cards → 3-pane (left nav · role list · role
// detail). The role list and the detail are only rendered when the
// active section is "roles" (the default landing). Other sections fall
// back to AccSectionPlaceholder until their own dedicated phase ships.
//
// Access control: the page itself is reachable to anyone who can reach
// /settings; the data calls below are gated server-side by
// `system.rbac.read` (ADMIN and super_admin pass via the existing
// wildcard bypass). Non-admins see the shell with an empty state and
// a 403-style banner — no UI breakage.

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  accessControlApi,
  type AccRole,
  type AccRoleDetail as AccRoleDetailType,
  type AccSummary,
} from '../../services/accessControlApi';
import { type AccSectionKey } from './acc.constants';
import AccSummaryCards from './AccSummaryCards';
import AccLeftNav from './AccLeftNav';
import AccRoleList from './AccRoleList';
import AccRoleDetail from './AccRoleDetail';
import AccSectionPlaceholder from './AccSectionPlaceholder';

const AccessControlCenter: React.FC = () => {
  const { user, permissions } = useAuth();

  const isAdmin = (() => {
    if (!user) return false;
    if (permissions.includes('*')) return true;
    const role = (user.role || '').toLowerCase();
    return role === 'admin' || role === 'super_admin' || role === 'superadmin';
  })();

  const [section, setSection] = useState<AccSectionKey>('roles');
  const [summary, setSummary] = useState<AccSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [roles, setRoles] = useState<AccRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDetail, setRoleDetail] = useState<AccRoleDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Initial summary + roles. Both 403-tolerant so non-admins see the
  // shell with a clear access banner instead of a crash.
  useEffect(() => {
    if (!isAdmin) {
      setSummaryLoading(false);
      setRolesLoading(false);
      return;
    }
    let cancelled = false;
    void accessControlApi.getSummary(user?.id)
      .then((s) => { if (!cancelled) { setSummary(s); setSummaryError(null); } })
      .catch((e) => { if (!cancelled) setSummaryError(e instanceof Error ? e.message : 'Failed to load summary'); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    void accessControlApi.listRoles(user?.id)
      .then((r) => {
        if (cancelled) return;
        setRoles(r);
        setRolesError(null);
        // Pre-select the first role so the detail pane is never blank.
        if (r.length > 0) setSelectedRoleId((prev) => prev || r[0].id);
      })
      .catch((e) => { if (!cancelled) setRolesError(e instanceof Error ? e.message : 'Failed to load roles'); })
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
  }, [isAdmin, user?.id]);

  // Fetch detail whenever the selection changes.
  useEffect(() => {
    if (!isAdmin || !selectedRoleId) {
      setRoleDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void accessControlApi.getRole(selectedRoleId, user?.id)
      .then((r) => { if (!cancelled) { setRoleDetail(r); setDetailError(null); } })
      .catch((e) => { if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Failed to load role'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [isAdmin, selectedRoleId, user?.id]);

  const handleJumpFromCard = useCallback((target: AccSectionKey) => {
    setSection(target);
  }, []);

  return (
    <div className="h-full flex flex-col bg-app text-primary">
      {/* Title strip */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-300">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Access Control Center</h1>
            <p className="text-[11px] text-muted leading-relaxed">
              Manage roles, page access, approval authority, data scope, and cross-module permissions.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Read-only preview.</p>
              <p className="text-amber-300/80">
                Full Access Control Center features require an admin role (ADMIN or super_admin).
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <AccSummaryCards
            summary={summary}
            loading={summaryLoading}
            onJump={handleJumpFromCard}
          />
          {summaryError && (
            <p className="mt-2 text-[10px] text-rose-400">{summaryError}</p>
          )}
        </div>
      </div>

      {/* Body: left nav · main area */}
      <div className="flex-1 flex min-h-0">
        <AccLeftNav active={section} onSelect={setSection} />
        {section === 'roles' ? (
          <>
            <AccRoleList
              roles={roles}
              loading={rolesLoading}
              error={rolesError}
              selectedRoleId={selectedRoleId}
              search={search}
              onSearchChange={setSearch}
              onSelect={setSelectedRoleId}
            />
            <AccRoleDetail
              role={roleDetail}
              loading={detailLoading}
              error={detailError}
            />
          </>
        ) : (
          <AccSectionPlaceholder sectionKey={section} />
        )}
      </div>
    </div>
  );
};

export default AccessControlCenter;
