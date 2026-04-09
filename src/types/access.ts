export interface ModuleCapability {
  visible: boolean;
  readOnly: boolean;
  reason?: string;
}

export interface PermissionSetPayload {
  userId: string;
  roles: string[];
  departmentId?: string | null;
  authorityLevel?: string;
  projectMembershipCount?: number;
  modules: Record<string, ModuleCapability>;
  permissions: Record<string, boolean>;
}

export interface UserContextProfile {
  id: string;
  role?: string;
  departmentId?: string | null;
}

