import { EmploymentProfile, AuthorityLevel, HRMRole } from '../types/hrm';

export type ModuleName = 'hrm' | 'crm' | 'scm' | 'project' | 'finance';

export type Action =
    | 'view' | 'create' | 'edit' | 'delete'
    | 'approve' | 'submit' | 'acknowledge'
    | 'manage_templates' | 'manage_settings'
    | 'approve_transaction' | 'qa_verify' | 'approve_milestone'
    | 'view_costs' | 'manage_costs'
    | 'all';

export type Resource =
    | 'directory' | 'own_profile'
    | 'onboarding' | 'offboarding'
    | 'recruitment' | 'candidates'
    | 'timesheets' | 'team_timesheets'
    | 'leave' | 'team_leave'
    | 'training' | 'policies' | 'cases'
    | 'all';

const MODULE_OWNER_DEPARTMENTS: Record<string, string> = {
    hrm: 'dept-hr',
    project: 'dept-eng',
    crm: 'dept-sales',
    scm: 'dept-ops',
    finance: 'dept-finance',
};

const OWNER_PERMISSIONS: Record<AuthorityLevel, Action[]> = {
    ADMIN: ['all'],
    MANAGER: ['view', 'create', 'edit', 'approve', 'submit', 'manage_templates', 'qa_verify', 'approve_milestone', 'view_costs', 'manage_costs'],
    CONTRIBUTOR: ['view', 'create', 'edit', 'submit', 'acknowledge'],
    OBSERVER: ['view'],
};

const TIERS_PERMISSIONS: Record<string, Action[]> = {
    hrm: ['view', 'create', 'submit'],
    scm: ['view', 'create', 'submit'],
    project: ['view'],
    crm: [],
    finance: [],
};

const TIERS_RESOURCE_ALLOWLIST: Record<string, string[]> = {
    hrm: ['own_profile', 'timesheets', 'leave', 'training', 'policies'],
    scm: ['all'],
    project: ['all'],
    crm: [],
    finance: [],
};

export function can(
    employee: EmploymentProfile | HRMRole | undefined,
    action: Action,
    resource: Resource | ModuleName
): boolean {
    if (typeof employee === 'string') {
        const roleMap: Record<HRMRole, EmploymentProfile> = {
            hr: {
                id: 'role-hr',
                personId: 'role-hr',
                employeeCode: 'ROLE-HR',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'HR',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'MANAGER',
                departmentId: MODULE_OWNER_DEPARTMENTS.hrm
            },
            manager: {
                id: 'role-manager',
                personId: 'role-manager',
                employeeCode: 'ROLE-MANAGER',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'Manager',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'MANAGER',
                departmentId: MODULE_OWNER_DEPARTMENTS.project
            },
            staff: {
                id: 'role-staff',
                personId: 'role-staff',
                employeeCode: 'ROLE-STAFF',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'Staff',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'CONTRIBUTOR',
                departmentId: MODULE_OWNER_DEPARTMENTS.hrm
            }
        };
        employee = roleMap[employee];
    }

    if (!employee || !employee.hasSystemAccess) return false;

    const level = employee.authorityLevel || 'OBSERVER';
    const deptId = employee.departmentId;

    if (level === 'ADMIN') return true;

    const resourceKey = String(resource);
    const parentModule = getParentModule(resourceKey);
    const isOwner = deptId === MODULE_OWNER_DEPARTMENTS[parentModule];

    const isCostRelated = action === 'view_costs' || action === 'manage_costs' || parentModule === 'finance';
    if (isCostRelated && !isOwner) return false;

    if (isOwner) {
        const allowed = OWNER_PERMISSIONS[level];
        if (allowed.includes('all')) return true;
        return allowed.includes(action);
    }

    const serviceActions = TIERS_PERMISSIONS[parentModule] || [];
    const allowlist = TIERS_RESOURCE_ALLOWLIST[parentModule] || [];
    if (resourceKey !== parentModule && !allowlist.includes('all') && !allowlist.includes(resourceKey)) {
        return false;
    }

    if (action === 'approve' || action === 'edit' || action === 'delete') {
        return false;
    }

    return serviceActions.includes(action);
}

function getParentModule(resource: string): string {
    const mapping: Record<string, string> = {
        directory: 'hrm',
        own_profile: 'hrm',
        onboarding: 'hrm',
        offboarding: 'hrm',
        recruitment: 'hrm',
        candidates: 'hrm',
        timesheets: 'hrm',
        team_timesheets: 'hrm',
        leave: 'hrm',
        team_leave: 'hrm',
        training: 'hrm',
        policies: 'hrm',
        cases: 'hrm',
    };
    return mapping[resource] || resource;
}

export function canAccess(employee: EmploymentProfile | HRMRole | undefined, resource: Resource | ModuleName): boolean {
    return can(employee, 'view', resource);
}
