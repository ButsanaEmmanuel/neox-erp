const DEFAULT_ROLE_MODULE_ACCESS = {
  ADMIN: ['dashboard', 'crm', 'finance', 'scm', 'project', 'hrm', 'hse', 'reports'],
  HR_MANAGER: ['dashboard', 'hrm', 'project', 'reports'],
  SCM_MANAGER: ['dashboard', 'scm', 'project', 'reports'],
  PROJECT_MANAGER: ['dashboard', 'project', 'reports'],
  SALES_ACCOUNT_MANAGER: ['dashboard', 'crm', 'project', 'reports'],
  SALES: ['dashboard', 'crm', 'project', 'reports'],
  FINANCE: ['dashboard', 'finance', 'reports', 'project'],
  USER: ['dashboard', 'project', 'hrm', 'scm'],
};

function normalizeRoleCodes(roles = []) {
  return roles
    .map((row) => String(row?.role?.code || '').toUpperCase())
    .filter(Boolean);
}

function deriveRoleModules(roleCodes = []) {
  const result = new Set(['dashboard']);
  for (const role of roleCodes) {
    for (const moduleId of DEFAULT_ROLE_MODULE_ACCESS[role] || []) {
      result.add(moduleId);
    }
  }
  return result;
}

async function loadUserContext(prisma, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    include: {
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
      hrmEmploymentProfile: {
        select: { authorityLevel: true },
      },
      department: {
        select: { id: true, code: true, name: true },
      },
    },
  });
  if (!user) throw new Error('User not found.');

  const roleCodes = normalizeRoleCodes(user.roles || []);
  const authorityLevel = String(user.hrmEmploymentProfile?.authorityLevel || 'CONTRIBUTOR').toUpperCase();
  const adminEmail = String(user.email || '').toLowerCase();
  const isLockedAdminIdentity =
    user.id === 'usr_ebutsana_full_access_20260321'
    || adminEmail === 'ebutsana@neox.io'
    || adminEmail === 'admin@neox.com';
  const isAdmin = roleCodes.includes('ADMIN') || authorityLevel === 'ADMIN' || isLockedAdminIdentity;

  const identityUserIds = [user.id];
  const email = String(user.email || '').trim().toLowerCase();
  if (email) {
    const aliases = await prisma.user.findMany({
      where: {
        email,
        isDeleted: false,
        isActive: true,
      },
      select: { id: true },
    });
    for (const alias of aliases) {
      const id = String(alias.id || '').trim();
      if (id && !identityUserIds.includes(id)) identityUserIds.push(id);
    }
  }

  const projectMembershipCount = await prisma.projectMember.count({
    where: {
      isDeleted: false,
      OR: [
        { userId: { in: identityUserIds } },
        ...(email
          ? [
              {
                user: {
                  email,
                  isDeleted: false,
                  isActive: true,
                },
              },
            ]
          : []),
      ],
    },
  });

  const managedProjectCount = await prisma.project.count({
    where: {
      isDeleted: false,
      OR: [
        { managerId: { in: identityUserIds } },
        ...(email
          ? [
              {
                manager: {
                  email,
                  isDeleted: false,
                  isActive: true,
                },
              },
            ]
          : []),
      ],
    },
  });

  const engineeringTeamProjectCount = await prisma.projectMember.count({
    where: {
      isDeleted: false,
      AND: [
        {
          OR: [
            { userId: { in: identityUserIds } },
            ...(email
              ? [
                  {
                    user: {
                      email,
                      isDeleted: false,
                      isActive: true,
                    },
                  },
                ]
              : []),
          ],
        },
        {
          OR: [
            { roleCode: { in: ['LEAD', 'CONTRIBUTOR', 'VIEWER', 'ENGINEERING'] } },
            {
              department: {
                OR: [
                  { code: { contains: 'ENG', mode: 'insensitive' } },
                  { name: { contains: 'Engineering', mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  return {
    user,
    userId,
    roleCodes,
    isAdmin,
    departmentId: user.departmentId || null,
    departmentCode: user.department?.code || null,
    departmentName: user.department?.name || null,
    jobTitle: user.jobTitle || null,
    authorityLevel: user.hrmEmploymentProfile?.authorityLevel || 'CONTRIBUTOR',
    projectMembershipCount,
    managedProjectCount,
    engineeringTeamProjectCount,
    identityUserIds,
  };
}

function setPermissionValue(map, module, resource, action, allowed) {
  const key = `${module}:${resource}:${action}`;
  map.set(key, Boolean(allowed));
}

export async function getUserPermissionSet(prisma, userId) {
  if (!userId) throw new Error('userId is required.');
  const context = await loadUserContext(prisma, userId);

  const roleModules = deriveRoleModules(context.roleCodes);
  const moduleAccess = new Map();
  for (const moduleId of ['dashboard', 'crm', 'finance', 'scm', 'project', 'hrm', 'hse', 'reports']) {
    const visible = context.isAdmin || roleModules.has(moduleId);
    moduleAccess.set(moduleId, {
      visible,
      readOnly: visible && !context.isAdmin,
      reason: visible ? 'role_grant' : 'role_restricted',
    });
  }

  // Self-service baseline: all active users should get HRM + SCM minimum access.
  if (!context.isAdmin) {
    moduleAccess.set('hrm', {
      visible: true,
      readOnly: true,
      reason: 'self_service_baseline',
    });
    moduleAccess.set('scm', {
      visible: true,
      readOnly: true,
      reason: 'self_service_baseline',
    });
  }

  const projectCapability = moduleAccess.get('project') || { visible: true, readOnly: true };
  const inEngineeringDepartment =
    String(context.departmentCode || '').toLowerCase().includes('eng')
    || String(context.departmentName || '').toLowerCase().includes('engineering');
  const isProjectManagerTitle = String(context.jobTitle || '').toLowerCase().includes('project manager');
  const hasProjectFullAccess =
    context.isAdmin
    || inEngineeringDepartment
    || isProjectManagerTitle
    || context.managedProjectCount > 0
    || context.engineeringTeamProjectCount > 0
    || context.projectMembershipCount > 0
    || context.roleCodes.includes('PROJECT_MANAGER');

  if (hasProjectFullAccess) {
    moduleAccess.set('project', {
      ...projectCapability,
      visible: true,
      readOnly: false,
      reason:
        inEngineeringDepartment
          ? 'engineering_department_access'
          : isProjectManagerTitle
            ? 'project_manager_title_access'
            : context.managedProjectCount > 0
          ? 'project_manager_assignment'
          : context.engineeringTeamProjectCount > 0
            ? 'engineering_team_assignment'
            : context.projectMembershipCount > 0
              ? 'project_membership'
              : 'role_grant',
    });
  } else {
    const salesProgressReadOnly =
      context.roleCodes.includes('SALES') || context.roleCodes.includes('SALES_ACCOUNT_MANAGER');
    moduleAccess.set('project', {
      ...projectCapability,
      visible: salesProgressReadOnly,
      readOnly: true,
      reason: salesProgressReadOnly ? 'sales_client_progress_readonly' : 'no_membership',
    });
  }

  const permissions = new Map();
  const rolePermissionRows = await prisma.rolePermission.findMany({
    where: {
      roleId: { in: (context.user.roles || []).map((row) => row.roleId) },
    },
    include: { permission: true },
  });

  for (const row of rolePermissionRows) {
    const module = String(row.permission?.module || '').toLowerCase() || 'global';
    const resource = String(row.permission?.resource || 'all').toLowerCase();
    const action = String(row.permission?.action || 'read').toLowerCase();
    setPermissionValue(permissions, module, resource, action, true);
  }

  const userOverrides = await prisma.userPermissionSet.findMany({
    where: { userId: context.userId, isActive: true },
  });
  for (const rule of userOverrides) {
    const allowed = String(rule.effect || 'allow').toLowerCase() !== 'deny';
    setPermissionValue(
      permissions,
      String(rule.module || 'global').toLowerCase(),
      String(rule.resource || 'all').toLowerCase(),
      String(rule.action || 'read').toLowerCase(),
      allowed,
    );
  }

  const isScmManager =
    context.roleCodes.includes('SCM_MANAGER') ||
    (String(context.departmentCode || '').toLowerCase().includes('scm') &&
      ['MANAGER', 'ADMIN'].includes(String(context.authorityLevel || '').toUpperCase()));
  const isHrOwner =
    context.roleCodes.includes('HR_MANAGER') ||
    String(context.departmentCode || '').toLowerCase().includes('hr');

  const baselineGrants = [
    ['hrm', 'own_profile', 'read', true],
    ['hrm', 'timesheets', 'create', true],
    ['hrm', 'timesheets', 'read_own', true],
    ['hrm', 'leave', 'create', true],
    ['hrm', 'leave', 'read_own', true],
    ['hrm', 'directory', 'read', true],
    ['hrm', 'contracts', 'read', context.isAdmin || isHrOwner],
    ['hrm', 'compensation', 'read', context.isAdmin || isHrOwner],
    ['scm', 'requisition', 'create', true],
    ['scm', 'supplier_registration', 'create', true],
    ['scm', 'requisition', 'approve', context.isAdmin || isScmManager],
    ['project', 'overview', 'read', hasProjectFullAccess || context.roleCodes.includes('SALES') || context.roleCodes.includes('SALES_ACCOUNT_MANAGER')],
    ['project', 'scope', 'read', hasProjectFullAccess],
    ['project', 'work_items', 'read', hasProjectFullAccess],
    ['project', 'documents', 'read', hasProjectFullAccess],
    ['project', 'scope', 'write', hasProjectFullAccess],
    ['project', 'work_items', 'write', hasProjectFullAccess],
    ['project', 'documents', 'write', hasProjectFullAccess],
  ];
  for (const [module, resource, action, allowed] of baselineGrants) {
    setPermissionValue(permissions, module, resource, action, Boolean(allowed));
  }

  if (context.isAdmin) {
    for (const moduleId of ['dashboard', 'crm', 'finance', 'scm', 'project', 'hrm', 'hse', 'reports']) {
      moduleAccess.set(moduleId, {
        visible: true,
        readOnly: false,
        reason: 'omni_admin',
      });
    }
    setPermissionValue(permissions, 'global', 'all', 'all_access', true);
  }

  return {
    userId: context.userId,
    roles: context.roleCodes,
    departmentId: context.departmentId,
    authorityLevel: context.authorityLevel,
    projectMembershipCount: context.projectMembershipCount,
    managedProjectCount: context.managedProjectCount,
    engineeringTeamProjectCount: context.engineeringTeamProjectCount,
    modules: Object.fromEntries(moduleAccess.entries()),
    permissions: Object.fromEntries(permissions.entries()),
  };
}

export function buildUniversalAbacWhere({
  currentUserId,
  isAdmin = false,
  ownerField = 'ownerId',
  publicField = 'isPublic',
  stakeholderField = null,
} = {}) {
  if (isAdmin) return {};
  const uid = String(currentUserId || '').trim();
  if (!uid) return { [publicField]: true };
  const or = [
    { [ownerField]: uid },
    { [publicField]: true },
  ];
  if (stakeholderField) {
    or.push({
      [stakeholderField]: {
        some: {
          userId: uid,
          isActive: true,
        },
      },
    });
  }
  return { OR: or };
}

function resolveBoolean(payload, fallback = false) {
  if (payload === undefined || payload === null) return fallback;
  if (typeof payload === 'boolean') return payload;
  const text = String(payload).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(text);
}

export async function upsertResourceStakeholder(prisma, payload = {}, actor = {}) {
  const module = String(payload.module || '').trim().toLowerCase();
  const resourceType = String(payload.resourceType || '').trim().toLowerCase();
  const resourceId = String(payload.resourceId || '').trim();
  const userId = String(payload.userId || '').trim();
  if (!module || !resourceType || !resourceId || !userId) {
    throw new Error('module, resourceType, resourceId and userId are required.');
  }

  return prisma.resourceStakeholder.upsert({
    where: {
      module_resourceType_resourceId_userId: {
        module,
        resourceType,
        resourceId,
        userId,
      },
    },
    create: {
      module,
      resourceType,
      resourceId,
      userId,
      stakeholderRole: payload.stakeholderRole ? String(payload.stakeholderRole) : null,
      isActive: resolveBoolean(payload.isActive, true),
      createdByUserId: actor?.actorUserId || null,
    },
    update: {
      stakeholderRole: payload.stakeholderRole ? String(payload.stakeholderRole) : null,
      isActive: resolveBoolean(payload.isActive, true),
    },
  });
}

export async function listResourceStakeholders(prisma, filters = {}) {
  const where = {
    ...(filters.module ? { module: String(filters.module).toLowerCase() } : {}),
    ...(filters.resourceType ? { resourceType: String(filters.resourceType).toLowerCase() } : {}),
    ...(filters.resourceId ? { resourceId: String(filters.resourceId) } : {}),
    ...(filters.userId ? { userId: String(filters.userId) } : {}),
    ...(filters.onlyActive !== undefined ? { isActive: resolveBoolean(filters.onlyActive, true) } : {}),
  };

  return prisma.resourceStakeholder.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function getSubordinateUserIds(prisma, managerUserId) {
  const root = String(managerUserId || '').trim();
  if (!root) return [];

  const visited = new Set([root]);
  const queue = [root];
  const result = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const rows = await prisma.hrmEmploymentProfile.findMany({
      where: {
        managerUserId: current,
        isDeleted: false,
      },
      select: { userId: true },
    });

    for (const row of rows) {
      const subordinateId = String(row.userId || '').trim();
      if (!subordinateId || visited.has(subordinateId)) continue;
      visited.add(subordinateId);
      result.add(subordinateId);
      queue.push(subordinateId);
    }
  }

  return Array.from(result);
}

export async function getPendingApprovals(prisma, userId) {
  if (!userId) throw new Error('userId is required.');

  const [permissionSet, subordinateIds] = await Promise.all([
    getUserPermissionSet(prisma, userId),
    getSubordinateUserIds(prisma, userId),
  ]);

  const canApprove =
    permissionSet.roles.includes('ADMIN') ||
    permissionSet.roles.includes('HR_MANAGER') ||
    permissionSet.roles.includes('SCM_MANAGER') ||
    permissionSet.roles.includes('FINANCE') ||
    permissionSet.roles.includes('FINANCE_MANAGER') ||
    permissionSet.authorityLevel === 'MANAGER' ||
    permissionSet.authorityLevel === 'ADMIN';

  const scopeIds = canApprove ? subordinateIds : [userId];

  const [timesheets, purchaseRequests] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: {
        userId: { in: scopeIds.length ? scopeIds : ['__none__'] },
        statusCode: { in: ['submitted', 'pending_approval'] },
        isDeleted: false,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.purchaseRequest.findMany({
      where: {
        requesterUserId: { in: scopeIds.length ? scopeIds : ['__none__'] },
        statusCode: { in: ['submitted', 'pending', 'pending_approval'] },
        isDeleted: false,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        requesterDepartment: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  return {
    userId,
    canApprove,
    subordinateUserIds: subordinateIds,
    queue: {
      timesheets: timesheets.map((row) => ({
        id: row.id,
        type: 'timesheet',
        status: row.statusCode,
        submittedBy: row.user?.name || row.user?.email || row.userId,
        submittedByUserId: row.userId,
        department: row.department?.name || null,
        amountHint: Number(row.hours || 0),
        occurredAt: row.updatedAt,
      })),
      purchaseRequests: purchaseRequests.map((row) => ({
        id: row.id,
        type: 'purchase_request',
        status: row.statusCode,
        submittedBy: row.requester?.name || row.requester?.email || row.requesterUserId,
        submittedByUserId: row.requesterUserId,
        department: row.requesterDepartment?.name || null,
        amountHint: Number(row.totalAmount || 0),
        occurredAt: row.updatedAt,
      })),
    },
  };
}

export async function canAccessCrossDepartmentResource(prisma, {
  userId,
  module,
  resourceType,
  resourceId,
} = {}) {
  const uid = String(userId || '').trim();
  const normalizedModule = String(module || '').trim().toLowerCase();
  const normalizedType = String(resourceType || '').trim().toLowerCase();
  const rid = String(resourceId || '').trim();
  if (!uid || !normalizedModule || !normalizedType || !rid) return false;

  const tag = await prisma.resourceStakeholder.findFirst({
    where: {
      module: normalizedModule,
      resourceType: normalizedType,
      resourceId: rid,
      userId: uid,
      isActive: true,
    },
    select: { id: true },
  });

  return Boolean(tag?.id);
}
