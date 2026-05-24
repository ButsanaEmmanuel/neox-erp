import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { changePasswordWithApi, getProfileWithApi, loginWithApi, updateProfileWithApi } from '../services/authApi';
import { apiRequest } from '../lib/apiClient';

const PERMISSIONS_STORAGE_KEY = 'neox-auth-permissions';

export type Role = string;

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  departmentName?: string;
  department?: string;
  jobTitle?: string;
  job_title?: string;
  phoneNumber?: string;
  supervisorId?: string;
  supervisorName?: string;
  preferredLanguage?: 'fr' | 'en';
  notifyCrm?: boolean;
  notifyProjects?: boolean;
  notifyFinance?: boolean;
  quickStatus?: 'online' | 'in_meeting' | 'on_leave';
  avatar?: string;
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: User | null;
  // HRM-1.2: effective permission keys for the current user.
  // Stored as a string[] (not Set) so it stays JSON-serializable across
  // localStorage and React state. rbac.ts wraps lookups in a Set for O(1).
  permissions: string[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: Role[]) => boolean;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  completePasswordChange: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeIncomingUser(raw: any): Partial<User> {
  if (!raw || typeof raw !== 'object') return {};
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    departmentId: raw.departmentId ?? raw.department_id,
    departmentName: raw.departmentName ?? raw.department_name ?? raw.department,
    department: raw.department ?? raw.departmentName ?? raw.department_name,
    jobTitle: raw.jobTitle ?? raw.job_title,
    job_title: raw.job_title ?? raw.jobTitle,
    phoneNumber: raw.phoneNumber ?? raw.phone_number,
    supervisorId: raw.supervisorId ?? raw.supervisor_id,
    supervisorName: raw.supervisorName ?? raw.supervisor_name,
    preferredLanguage: raw.preferredLanguage ?? raw.preferred_language,
    notifyCrm: raw.notifyCrm ?? raw.notify_crm,
    notifyProjects: raw.notifyProjects ?? raw.notify_projects,
    notifyFinance: raw.notifyFinance ?? raw.notify_finance,
    quickStatus: raw.quickStatus ?? raw.quick_status,
    avatar: raw.avatar,
    forcePasswordChange: raw.forcePasswordChange ?? raw.force_password_change,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('neox-auth-session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [permissions, setPermissionsState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
    } catch {
      return [];
    }
  });

  const persistPermissions = useCallback((perms: string[]) => {
    setPermissionsState(perms);
    try {
      localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(perms));
    } catch {
      // localStorage may be unavailable (private mode, quota). The in-memory
      // state still holds — losing the cache only costs one refetch.
    }
  }, []);

  // HRM-1.2: fetch effective permissions for a given userId.
  // Designed to NEVER throw. On any failure we fall back to [] and let
  // <PermissionGuard> deny access at each guard site — better than
  // crashing the whole app over a missing endpoint or 5xx.
  const hydratePermissionsFor = useCallback(async (userId: string | undefined | null) => {
    if (!userId) {
      persistPermissions([]);
      return;
    }
    try {
      const response = await apiRequest<{ permissions: string[] }>(
        `/api/auth/me/permissions?userId=${encodeURIComponent(userId)}`,
      );
      const next = Array.isArray(response?.permissions)
        ? response.permissions.filter((k): k is string => typeof k === 'string')
        : [];
      persistPermissions(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[AuthContext] Failed to hydrate permissions, defaulting to []:', err);
      persistPermissions([]);
    }
  }, [persistPermissions]);

  // Rehydrate on mount if a user is already in localStorage (page reload).
  // We keep the cached permissions visible immediately for instant paint,
  // then refresh in the background.
  useEffect(() => {
    if (user?.id) {
      void hydratePermissionsFor(user.id);
    }
    // Intentionally only on mount + when the user id changes — login/refresh
    // hydrate explicitly below to keep the order deterministic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const login = async (email: string, password: string) => {
    const response = await loginWithApi(email, password);
    const normalized = normalizeIncomingUser(response.user);
    const authenticatedUser: User = {
      id: String(normalized.id || ''),
      name: String(normalized.name || ''),
      email: String(normalized.email || ''),
      role: String(normalized.role || ''),
      departmentId: normalized.departmentId,
      departmentName: normalized.departmentName,
      department: normalized.department,
      jobTitle: normalized.jobTitle,
      job_title: normalized.job_title,
      phoneNumber: normalized.phoneNumber,
      supervisorId: normalized.supervisorId,
      supervisorName: normalized.supervisorName,
      preferredLanguage: normalized.preferredLanguage ?? 'fr',
      notifyCrm: normalized.notifyCrm ?? true,
      notifyProjects: normalized.notifyProjects ?? true,
      notifyFinance: normalized.notifyFinance ?? true,
      quickStatus: normalized.quickStatus ?? 'online',
      avatar: normalized.avatar,
      forcePasswordChange: normalized.forcePasswordChange ?? false,
    };
    setUser(authenticatedUser);
    localStorage.setItem('neox-auth-session', JSON.stringify(authenticatedUser));
    if (response.token) {
      localStorage.setItem('neox-auth-token', response.token);
    }
    await hydratePermissionsFor(authenticatedUser.id);
    return true;
  };

  const logout = () => {
    setUser(null);
    persistPermissions([]);
    localStorage.removeItem('neox-auth-session');
    localStorage.removeItem('neox-auth-token');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const response = await updateProfileWithApi(user.id, user.email, data);
    const normalized = normalizeIncomingUser(response.user);
    setUser(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...normalized,
      };
      localStorage.setItem('neox-auth-session', JSON.stringify(updated));
      return updated;
    });
  };

  const refreshUserProfile = async () => {
    if (!user) return;
    const response = await getProfileWithApi(user.id, user.email);
    const normalized = normalizeIncomingUser(response.user);
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...normalized };
      localStorage.setItem('neox-auth-session', JSON.stringify(updated));
      return updated;
    });
    await hydratePermissionsFor(user.id);
  };

  const refreshPermissions = async () => {
    await hydratePermissionsFor(user?.id);
  };

  const completePasswordChange = async (currentPassword: string, newPassword: string) => {
    await changePasswordWithApi(currentPassword, newPassword);
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, forcePasswordChange: false };
      localStorage.setItem('neox-auth-session', JSON.stringify(updated));
      return updated;
    });
  };

  const hasRole = (roles: Role[]) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true; // Admin sees everything
    return roles.includes(user.role);
  };

  useEffect(() => {
    const lang = (user?.preferredLanguage || 'fr') === 'en' ? 'en' : 'fr';
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('neox:language-changed', { detail: { lang } }));
  }, [user?.preferredLanguage]);

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, hasRole, updateProfile, refreshUserProfile, refreshPermissions, completePasswordChange }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
