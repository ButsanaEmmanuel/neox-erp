// DH1 — Extracted from useHRMStore.ts (Sprint Dettes Techniques 2026-05-24).
// Hosts the HRM session-level transverse state (currentRole, loading,
// hydration) alongside the employees + departments domain. Picked first
// because hydrateFromDatabase is the entry point for the whole HRM module
// and other slices depend on `employees` for cross-mutations.

import { create } from 'zustand';
import type {
    EmploymentProfile, Department, CreateEmploymentPayload,
} from '../../types/hrm';
import {
    bulkUpsertHrmEmployeesApi,
    createHrmDepartmentApi,
    createHrmEmployeeApi,
    deleteHrmDepartmentApi,
    deleteHrmEmployeeApi,
    fetchHrmEmployeeDetailApi,
    fetchHrmEmployeeActivityApi,
    fetchHrmBootstrapApi,
    HrmEmployeeActivity,
    markHrmEmployeeCredentialsSentApi,
    regenerateHrmEmployeeCredentialsApi,
    updateHrmDepartmentApi,
    updateHrmEmployeeApi,
} from '../../services/hrmApi';

function normalizeEmploymentForSource(profile: EmploymentProfile): EmploymentProfile {
    const source = profile.creationSource ?? 'MANUAL';
    const next = { ...profile, creationSource: source };
    if (source !== 'RECRUITMENT' && next.status === 'onboarding') {
        next.status = 'active';
    }
    return next;
}

// Local fallback data (DB-only ⇒ empty by default).
export const DEPARTMENTS: Department[] = [];
const EMPLOYEES: EmploymentProfile[] = [];

export interface DirectoryStore {
    // --- Transverse session state ---
    isLoading: boolean;
    hydrated: boolean;
    error: string | null;
    currentRole: 'staff' | 'manager' | 'hr';
    setCurrentRole: (role: 'staff' | 'manager' | 'hr') => void;
    hydrateFromDatabase: () => Promise<void>;

    // --- Directory state ---
    departments: Department[];
    employees: EmploymentProfile[];
    activeEmployeeId: string;
    setActiveEmployeeId: (id: string) => void;
    employeeActivities: Record<string, HrmEmployeeActivity[]>;
    loadEmployeeActivities: (employeeId: string) => Promise<void>;
    loadEmployeeDetail: (employeeId: string) => Promise<void>;
    regenerateEmployeeCredentials: (employeeId: string) => Promise<void>;
    markEmployeeCredentialsSent: (employeeId: string) => Promise<void>;

    // --- Department CRUD ---
    addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
    updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;
    deleteDepartment: (id: string) => Promise<void>;
    bulkAddDepartments: (newDepartments: Department[]) => Promise<void>;

    // --- Employee CRUD (API-backed) ---
    addEmployee: (payload: CreateEmploymentPayload) => Promise<void>;
    updateEmployee: (id: string, updates: Partial<EmploymentProfile>) => Promise<void>;
    bulkUpdateEmployees: (ids: string[], updates: Partial<EmploymentProfile>) => Promise<void>;
    bulkAddEmployees: (newEmployees: EmploymentProfile[]) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;

    // --- Local cross-store mutators (no API call) ---
    // Used by useOnboardingStore / useRecruitmentStore for lifecycle-driven
    // status flips (onboarding completed → active, offboarding started →
    // offboarding, etc.) that have historically been pure Zustand sets.
    patchEmployeeLocal: (id: string, updates: Partial<EmploymentProfile>) => void;
    addEmployeeLocal: (employee: EmploymentProfile) => void;
}

export const useDirectoryStore = create<DirectoryStore>((set, get) => ({
    // --- Transverse ---
    isLoading: false,
    hydrated: false,
    error: null,
    currentRole: (() => {
        try {
            const sessionRaw = localStorage.getItem('neox-auth-session');
            const parsed = sessionRaw ? JSON.parse(sessionRaw) : null;
            const roleCode = String(parsed?.role || '').toUpperCase();
            if (roleCode === 'ADMIN' || roleCode === 'HR_MANAGER') return 'hr';
            if (roleCode === 'PROJECT_MANAGER' || roleCode === 'SCM_MANAGER' || roleCode === 'FINANCE' || roleCode === 'SALES') return 'manager';
            return 'staff';
        } catch {
            return 'staff';
        }
    })(),
    setCurrentRole: (role) => set({ currentRole: role }),

    hydrateFromDatabase: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
            const data = await fetchHrmBootstrapApi({ take: 200, skip: 0 });
            const employees = (data.employees || []).map((emp) => normalizeEmploymentForSource(emp));
            const departments = data.departments || [];
            if (import.meta.env.DEV && data.meta) {
                console.debug('[HRM] bootstrap timings', data.meta);
            }
            set((state) => ({
                isLoading: false,
                hydrated: true,
                departments,
                employees,
                activeEmployeeId: state.activeEmployeeId && employees.some((e) => e.id === state.activeEmployeeId)
                    ? state.activeEmployeeId
                    : (employees[0]?.id || ''),
            }));
        } catch (err) {
            const message = String((err as Error).message || 'Unknown error');
            const friendly = message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('timeout')
                ? 'Network/API unreachable. Verify the API server and try again.'
                : message;
            set({ isLoading: false, error: friendly, hydrated: true });
        }
    },

    // --- Directory state ---
    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    activeEmployeeId: '',
    setActiveEmployeeId: (id) => set({ activeEmployeeId: id }),
    employeeActivities: {},

    loadEmployeeActivities: async (employeeId) => {
        const payload = await fetchHrmEmployeeActivityApi(employeeId);
        set((state) => ({
            employeeActivities: {
                ...state.employeeActivities,
                [employeeId]: payload.activities || [],
            },
        }));
    },

    loadEmployeeDetail: async (employeeId) => {
        const payload = await fetchHrmEmployeeDetailApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? normalizeEmploymentForSource({ ...employee, ...payload.employee })
                : employee)),
        }));
    },

    regenerateEmployeeCredentials: async (employeeId) => {
        const payload = await regenerateHrmEmployeeCredentialsApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? { ...employee, latestCredential: payload.credential }
                : employee)),
        }));
    },

    markEmployeeCredentialsSent: async (employeeId) => {
        const payload = await markHrmEmployeeCredentialsSentApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? { ...employee, latestCredential: payload.credential }
                : employee)),
        }));
    },

    // --- Department CRUD ---
    addDepartment: async (dept) => {
        const created = await createHrmDepartmentApi(dept);
        set((s) => ({ departments: [...s.departments, created.department] }));
    },
    updateDepartment: async (id, updates) => {
        const updated = await updateHrmDepartmentApi(id, updates);
        set((s) => ({
            departments: s.departments.map((d) => (d.id === id ? { ...d, ...updated.department } : d)),
        }));
    },
    deleteDepartment: async (id) => {
        await deleteHrmDepartmentApi(id);
        set((s) => ({
            departments: s.departments
                .filter((d) => d.id !== id)
                .map((d) => (d.parentId === id ? { ...d, parentId: undefined } : d)),
        }));
    },
    bulkAddDepartments: async (newDepartments) => {
        const created: Department[] = [];
        for (const dept of newDepartments) {
            const result = await createHrmDepartmentApi(dept);
            created.push(result.department);
        }
        set((s) => ({ departments: [...s.departments, ...created] }));
    },

    // --- Employee CRUD ---
    addEmployee: async (payload) => {
        const created = await createHrmEmployeeApi({
            ...payload,
            creationSource: payload.creationSource || 'MANUAL',
        });
        set((s) => ({ employees: [normalizeEmploymentForSource(created.employee), ...s.employees] }));
    },
    updateEmployee: async (id, updates) => {
        const updated = await updateHrmEmployeeApi(id, updates);
        set((s) => ({
            employees: s.employees.map((e) => (e.id === id ? normalizeEmploymentForSource(updated.employee) : e)),
        }));
    },
    bulkUpdateEmployees: async (ids, updates) => {
        for (const id of ids) {
            const updated = await updateHrmEmployeeApi(id, updates);
            set((s) => ({
                employees: s.employees.map((e) => (e.id === id ? normalizeEmploymentForSource(updated.employee) : e)),
            }));
        }
    },
    bulkAddEmployees: async (newEmployees) => {
        const normalized = newEmployees.map((emp) => normalizeEmploymentForSource({
            ...emp,
            creationSource: emp.creationSource || 'IMPORT',
        }));
        const result = await bulkUpsertHrmEmployeesApi(normalized);
        const createdIds = new Set((result.employees || []).map((e) => e.id));
        set((s) => ({
            employees: [
                ...(result.employees || []).map((e) => normalizeEmploymentForSource(e)),
                ...s.employees.filter((e) => !createdIds.has(e.id)),
            ],
        }));
    },
    deleteEmployee: async (id) => {
        await deleteHrmEmployeeApi(id);
        set((s) => ({
            employees: s.employees.filter((e) => e.id !== id),
        }));
    },

    // --- Local cross-store mutators ---
    patchEmployeeLocal: (id, updates) => set((s) => ({
        employees: s.employees.map((e) => (e.id === id
            ? { ...e, ...updates, updatedAt: new Date().toISOString() }
            : e)),
    })),
    addEmployeeLocal: (employee) => set((s) => ({
        employees: [...s.employees, employee],
    })),
}));
