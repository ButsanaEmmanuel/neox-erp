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
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';
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
  const navigate = useNavigate();

  // Hard gate. The Access Control Center is sensitive — non-admins
  // never see the shell, roles, scopes, workflows, or security model.
  // Authorised set:
  //   - legacy ADMIN role
  //   - new super_admin role
  //   - users carrying the `system.rbac.read` permission key
  //   - any wildcard '*' bypass holder
  const isAuthorised = (() => {
    if (!user) return false;
    if (permissions.includes('*')) return true;
    if (permissions.includes('system.rbac.read')) return true;
    const role = (user.role || '').toLowerCase();
    return role === 'admin' || role === 'super_admin' || role === 'superadmin';
  })();

  const [section, setSection] = useState<AccSectionKey>('roles');
  // Forced per-role tab + nonce. The left-nav shortcuts for "Page Access"
  // and "Action Permissions" set these to land users directly on the
  // matching editor inside the Roles flow, instead of showing a
  // placeholder card that admins thought was the real editor.
  const [forcedTab, setForcedTab] = useState<'module-page-access' | 'actions' | null>(null);
  const [forcedTabNonce, setForcedTabNonce] = useState(0);
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
  // Bumped after a successful save so children that need to invalidate
  // cached state (e.g. PageAccessTab counters) can react cheaply.
  const [refreshKey, setRefreshKey] = useState(0);

  // Initial summary + roles. Skipped entirely for unauthorised users
  // — the Access Restricted screen renders before any data fetch
  // and no API calls are ever issued from their session.
  useEffect(() => {
    if (!isAuthorised) {
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
  }, [isAuthorised, user?.id]);

  // Fetch detail whenever the selection changes.
  useEffect(() => {
    if (!isAuthorised || !selectedRoleId) {
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
  }, [isAuthorised, selectedRoleId, user?.id]);

  // Centralised handler for every left-nav click. Two sections are
  // intercepted because the real editors live as per-role tabs inside
  // the Roles flow: clicking "Page Access" or "Action Permissions"
  // would otherwise drop the admin on a Phase-2 placeholder card that
  // looks like the editor is missing.
  const handleSectionChange = useCallback((target: AccSectionKey) => {
    if (target === 'page-access') {
      setSection('roles');
      setForcedTab('module-page-access');
      setForcedTabNonce((n) => n + 1);
      return;
    }
    if (target === 'action-permissions') {
      setSection('roles');
      setForcedTab('actions');
      setForcedTabNonce((n) => n + 1);
      return;
    }
    setSection(target);
    setForcedTab(null);
  }, []);

  const handleJumpFromCard = useCallback((target: AccSectionKey) => {
    handleSectionChange(target);
  }, [handleSectionChange]);

  // Hard 403: render nothing of the actual console for non-admins.
  // No roles, no counts, no section descriptions — just a clean
  // Access Restricted state and a way back. This mirrors the backend
  // gate (`system.rbac.read`) so the UI can't leak structure even if
  // the API ever returned partial data.
  if (!isAuthorised) {
    return (
      <div className="h-full flex items-center justify-center bg-app text-primary p-6">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-surface/50 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300">
            <Lock size={20} />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight">Access restricted</h2>
          <p className="mt-2 text-[12px] text-muted leading-relaxed">
            The Access Control Center is reserved for administrators.
            Ask your system administrator for the appropriate role if you need access.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:bg-card transition-colors"
            >
              <ArrowLeft size={12} />
              Back to Settings
            </button>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-wider text-muted">
            Error code · 403
          </p>
        </div>
      </div>
    );
  }

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
        <AccLeftNav active={section} onSelect={handleSectionChange} />
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
              refreshKey={refreshKey}
              forceTab={forcedTab ?? undefined}
              forceTabNonce={forcedTabNonce}
              onSaved={() => {
                // Re-fetch the role tile counters + this role's detail
                // so the new "pages granted" badge reflects the save.
                setRefreshKey((n) => n + 1);
                if (user?.id) {
                  void accessControlApi.listRoles(user.id).then((r) => setRoles(r)).catch(() => {});
                  if (selectedRoleId) {
                    void accessControlApi.getRole(selectedRoleId, user.id)
                      .then((r) => setRoleDetail(r))
                      .catch(() => {});
                  }
                }
              }}
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
