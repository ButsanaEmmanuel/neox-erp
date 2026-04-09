import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import type { ModuleCapability, PermissionSetPayload } from '../types/access';

export type ModuleId = 'dashboard' | 'crm' | 'finance' | 'scm' | 'project' | 'hrm' | 'hse' | 'reports';

const FALLBACK_MODULES: Record<ModuleId, ModuleCapability> = {
  dashboard: { visible: true, readOnly: false, reason: 'fallback' },
  crm: { visible: false, readOnly: true, reason: 'fallback' },
  finance: { visible: false, readOnly: true, reason: 'fallback' },
  scm: { visible: true, readOnly: true, reason: 'self_service_fallback' },
  project: { visible: true, readOnly: true, reason: 'fallback' },
  hrm: { visible: true, readOnly: true, reason: 'self_service_fallback' },
  hse: { visible: false, readOnly: true, reason: 'fallback' },
  reports: { visible: false, readOnly: true, reason: 'fallback' },
};

export function usePermissions() {
  const { user } = useAuth();
  const [payload, setPayload] = useState<PermissionSetPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin =
    String(user?.role || '').toUpperCase() === 'ADMIN'
    || Boolean(payload?.permissions?.['global:all:all_access']);

  useEffect(() => {
    if (!user?.id) {
      setPayload(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void apiRequest<PermissionSetPayload>(`/api/v1/access/permission-set?userId=${encodeURIComponent(user.id)}`)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
      })
      .catch(() => {
        if (cancelled) return;
        setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const modules = useMemo(() => {
    const out: Record<ModuleId, ModuleCapability> = { ...FALLBACK_MODULES };
    if (isAdmin) {
      for (const moduleId of Object.keys(out) as ModuleId[]) {
        out[moduleId] = { visible: true, readOnly: false, reason: 'omni_admin_frontend' };
      }
      return out;
    }
    if (!payload?.modules) return out;

    for (const moduleId of Object.keys(out) as ModuleId[]) {
      const row = payload.modules[moduleId];
      if (!row) continue;
      out[moduleId] = {
        visible: Boolean(row.visible),
        readOnly: Boolean(row.readOnly),
        reason: row.reason,
      };
    }

    return out;
  }, [payload, isAdmin]);

  const canViewModule = (moduleId: ModuleId): boolean => {
    if (moduleId === 'dashboard') return true;
    if (isAdmin) return true;
    return Boolean(modules[moduleId]?.visible);
  };

  const isReadOnlyModule = (moduleId: ModuleId): boolean => {
    if (isAdmin) return false;
    return Boolean(modules[moduleId]?.readOnly);
  };

  const hasPermission = (module: string, resource: string, action: string): boolean => {
    if (isAdmin) return true;
    if (payload?.permissions?.['global:all:all_access']) {
      return true;
    }
    const key = `${module.toLowerCase()}:${resource.toLowerCase()}:${action.toLowerCase()}`;
    return Boolean(payload?.permissions?.[key]);
  };

  return {
    canViewModule,
    isReadOnlyModule,
    hasPermission,
    moduleCapabilities: modules,
    permissionSet: payload,
    loading,
  };
}
