export type ModuleAccessType = 'self-service' | 'department';

export interface ModuleConfigItem {
  id: string;
  label: string;
  icon: string;
  access?: {
    type?: ModuleAccessType;
    targetDepartment?: string;
    targetDepartmentAliases?: string[];
  };
}

export interface NavAccessUser {
  role?: string | null;
  department?: string | null;
  departmentName?: string | null;
}

function normalizeDepartmentValue(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isGlobalAdmin(user: NavAccessUser | null | undefined): boolean {
  return String(user?.role || '').toLowerCase() === 'admin';
}

export function isSelfServiceModule(moduleConfig: ModuleConfigItem | null | undefined): boolean {
  return moduleConfig?.access?.type === 'self-service';
}

export function hasDepartmentAccess(
  user: NavAccessUser | null | undefined,
  moduleConfig: ModuleConfigItem | null | undefined,
): boolean {
  const access = moduleConfig?.access;
  if (!access || access.type !== 'department') return false;

  const targetValues = [
    access.targetDepartment,
    ...(access.targetDepartmentAliases || []),
  ]
    .map((value) => normalizeDepartmentValue(value))
    .filter(Boolean);

  if (targetValues.length === 0) return false;

  const userValues = [user?.department, user?.departmentName]
    .map((value) => normalizeDepartmentValue(value))
    .filter(Boolean);

  if (userValues.length === 0) return false;

  return userValues.some((value) => targetValues.includes(value));
}
