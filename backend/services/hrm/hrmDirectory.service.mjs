import crypto from 'node:crypto';

let credentialProvisioningTableAvailable = true;

function isMissingCredentialProvisioningTableError(error) {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    code === 'P2021'
    && (message.includes('HrmCredentialProvisioning') || message.includes('hrmCredentialProvisioning'))
  );
}

function markCredentialTableUnavailableIfMissing(error) {
  if (isMissingCredentialProvisioningTableError(error)) {
    credentialProvisioningTableAvailable = false;
    return true;
  }
  return false;
}

async function findLatestCredentialSafe(client, employmentProfileId) {
  if (!credentialProvisioningTableAvailable) return null;
  try {
    return await client.hrmCredentialProvisioning.findFirst({
      where: {
        employmentProfileId,
        revokedAt: null,
      },
      orderBy: { generatedAt: 'desc' },
    });
  } catch (error) {
    if (markCredentialTableUnavailableIfMissing(error)) return null;
    throw error;
  }
}

function isoDateOnlyToDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ensureNonRecruitmentStatus(source, status) {
  if (source !== 'RECRUITMENT' && status === 'onboarding') return 'active';
  return status;
}

function makeEmployeeCode() {
  return `EMP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

function hashPassword(plainTextPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainTextPassword, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function resolvePrimaryRoleFromLinks(roleLinks = []) {
  const priority = [
    'ADMIN',
    'FINANCE',
    'HR_MANAGER',
    'SCM_MANAGER',
    'PROJECT_MANAGER',
    'SALES',
    'USER',
  ];
  const codes = roleLinks
    .map((row) => String(row?.role?.code || '').toUpperCase())
    .filter(Boolean);
  for (const code of priority) {
    if (codes.includes(code)) return code;
  }
  return codes[0] || 'USER';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function resolveHrmViewerScope(prisma, viewerUserId) {
  const userId = String(viewerUserId || '').trim();
  if (!userId) return { isAdmin: false, userId: null, departmentId: null };

  const viewer = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    include: {
      department: {
        select: { code: true, name: true },
      },
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
      hrmEmploymentProfile: {
        select: { authorityLevel: true },
      },
    },
  });
  if (!viewer) return { isAdmin: false, userId, departmentId: null };

  const roleCodes = (viewer.roles || []).map((row) => String(row?.role?.code || '').toUpperCase());
  const authorityLevel = String(viewer.hrmEmploymentProfile?.authorityLevel || 'CONTRIBUTOR').toUpperCase();
  const departmentCode = normalizeText(viewer.department?.code);
  const departmentName = normalizeText(viewer.department?.name);
  const isHrDepartment = departmentCode.includes('hr') || departmentName.includes('human resources') || departmentName === 'hr';
  const isHrRole = roleCodes.includes('HR_MANAGER');
  const isAdmin = roleCodes.includes('ADMIN') || authorityLevel === 'ADMIN';
  return {
    isAdmin,
    isHr: !isAdmin && (isHrDepartment || isHrRole),
    userId,
    departmentId: viewer.departmentId || null,
  };
}

function inferDepartmentRoleCode(department, authorityLevel) {
  const level = String(authorityLevel || 'CONTRIBUTOR').toUpperCase();
  if (level !== 'MANAGER' && level !== 'ADMIN') return null;

  const code = normalizeText(department?.code);
  const name = normalizeText(department?.name);
  const blob = `${code} ${name}`;

  if (blob.includes('hr')) return 'HR_MANAGER';
  if (blob.includes('finance') || blob.includes('fin')) return 'FINANCE';
  if (blob.includes('scm') || blob.includes('supply') || blob.includes('logistic') || blob.includes('procure')) return 'SCM_MANAGER';
  if (blob.includes('project') || blob.includes('engineering') || blob.includes('eng')) return 'PROJECT_MANAGER';
  if (blob.includes('sales') || blob.includes('crm') || blob.includes('commercial')) return 'SALES';
  return null;
}

async function ensureRoleByCode(tx, code) {
  const roleCode = String(code || '').trim().toUpperCase();
  if (!roleCode) return null;
  let role = await tx.role.findFirst({
    where: { code: roleCode, isDeleted: false, isActive: true },
  });
  if (role) return role;

  const roleNameMap = {
    USER: 'User',
    HR_MANAGER: 'HR Manager',
    SCM_MANAGER: 'SCM Manager',
    PROJECT_MANAGER: 'Project Manager',
    SALES: 'Sales',
    FINANCE: 'Finance',
    ADMIN: 'Administrator',
  };
  role = await tx.role.upsert({
    where: { code: roleCode },
    update: { isDeleted: false, isActive: true, name: roleNameMap[roleCode] || roleCode },
    create: {
      code: roleCode,
      name: roleNameMap[roleCode] || roleCode,
      isDeleted: false,
      isActive: true,
    },
  });
  return role;
}

async function syncUserActiveRoles(tx, userId, desiredRoleCodes = []) {
  const desiredCodes = Array.from(new Set(
    desiredRoleCodes
      .map((code) => String(code || '').trim().toUpperCase())
      .filter(Boolean),
  ));

  const desiredRoles = [];
  for (const code of desiredCodes) {
    const role = await ensureRoleByCode(tx, code);
    if (role) desiredRoles.push(role);
  }
  if (!desiredRoles.length) return [];

  const desiredRoleIds = new Set(desiredRoles.map((row) => row.id));
  const current = await tx.userRole.findMany({
    where: { userId, validTo: null },
    select: { id: true, roleId: true },
  });

  const now = new Date();
  for (const link of current) {
    if (!desiredRoleIds.has(link.roleId)) {
      await tx.userRole.update({
        where: { id: link.id },
        data: { validTo: now },
      });
    }
  }

  const activeDesired = new Set(current.filter((row) => desiredRoleIds.has(row.roleId)).map((row) => row.roleId));
  for (const role of desiredRoles) {
    if (!activeDesired.has(role.id)) {
      await tx.userRole.create({
        data: { userId, roleId: role.id },
      });
    }
  }

  return desiredRoles;
}

async function resolveProvisionedRoleCodes(tx, payload, user) {
  const requestedRoleCode = String(payload.systemRole || '').trim().toUpperCase();
  const authorityLevel = String(payload.authorityLevel || 'CONTRIBUTOR').trim().toUpperCase();
  const departmentId = payload.departmentId ? String(payload.departmentId) : user.departmentId;
  const department = departmentId
    ? await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, code: true, name: true } })
    : null;
  const inferredDepartmentRoleCode = inferDepartmentRoleCode(department, authorityLevel);

  const roleCodes = [];
  if (requestedRoleCode) roleCodes.push(requestedRoleCode);
  if (!requestedRoleCode && inferredDepartmentRoleCode) roleCodes.push(inferredDepartmentRoleCode);
  roleCodes.push('USER');

  return Array.from(new Set(roleCodes));
}

async function createHrmCredentialProvisioning(tx, payload) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = hashPassword(temporaryPassword);
  const username = String(payload.username || '').trim();
  const fallbackUsername = String(payload.fallbackUsername || '').trim();

  await tx.user.update({
    where: { id: payload.userId },
    data: {
      username: username || fallbackUsername || undefined,
      passwordHash,
      forcePasswordChange: true,
      passwordChangedAt: null,
      hasSystemAccess: true,
      isActive: true,
    },
  });

  if (!credentialProvisioningTableAvailable) {
    return {
      id: `volatile_${Date.now()}`,
      userId: payload.userId,
      employmentProfileId: payload.employmentProfileId,
      username: username || fallbackUsername || `user_${Date.now().toString(36)}`,
      temporaryPassword,
      statusCode: 'generated_volatile',
      generatedAt: new Date(),
      sentAt: null,
    };
  }

  try {
    await tx.hrmCredentialProvisioning.updateMany({
      where: {
        employmentProfileId: payload.employmentProfileId,
        statusCode: { in: ['generated', 'shared_for_email'] },
        revokedAt: null,
      },
      data: {
        statusCode: 'superseded',
        revokedAt: new Date(),
      },
    });

    return await tx.hrmCredentialProvisioning.create({
      data: {
        userId: payload.userId,
        employmentProfileId: payload.employmentProfileId,
        username: username || fallbackUsername || `user_${Date.now().toString(36)}`,
        temporaryPassword,
        statusCode: 'generated',
        generatedByUserId: payload.generatedByUserId || null,
      },
    });
  } catch (error) {
    if (markCredentialTableUnavailableIfMissing(error)) {
      return {
        id: `volatile_${Date.now()}`,
        userId: payload.userId,
        employmentProfileId: payload.employmentProfileId,
        username: username || fallbackUsername || `user_${Date.now().toString(36)}`,
        temporaryPassword,
        statusCode: 'generated_volatile',
        generatedAt: new Date(),
        sentAt: null,
      };
    }
    throw error;
  }
}

function mapEmployee(profile, options = {}) {
  const includeRoles = Boolean(options.includeRoles);
  const compensationAmount =
    profile.compensationAmount === null || profile.compensationAmount === undefined
      ? null
      : Number(profile.compensationAmount);

  return {
    id: profile.id,
    userId: profile.userId,
    personId: profile.userId,
    employeeCode: profile.employeeCode,
    employmentType: profile.employmentType,
    status: profile.statusCode,
    roleTitle: profile.roleTitle,
    managerPersonId: profile.managerUserId || undefined,
    departmentId: profile.user?.departmentId || undefined,
    startDate: profile.startDate.toISOString().slice(0, 10),
    endDate: profile.endDate ? profile.endDate.toISOString().slice(0, 10) : undefined,
    contractType: profile.contractType || 'CDI',
    contractStatus: profile.contractStatus || 'active',
    probationEndDate: profile.probationEndDate ? profile.probationEndDate.toISOString().slice(0, 10) : undefined,
    confirmationDate: profile.confirmationDate ? profile.confirmationDate.toISOString().slice(0, 10) : undefined,
    terminationReason: profile.terminationReason || undefined,
    workLocation: profile.workLocation || undefined,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    name: profile.user?.name || undefined,
    email: profile.user?.email || undefined,
    phone: undefined,
    hasSystemAccess: profile.user?.hasSystemAccess ?? true,
    accessStatus: profile.systemAccessStatus || 'pending_activation',
    systemRole: includeRoles
      ? resolvePrimaryRoleFromLinks(profile.user?.roles || [])
      : (profile.systemRoleHint || 'USER'),
    authorityLevel: profile.authorityLevel || 'CONTRIBUTOR',
    creationSource: profile.creationSource || 'MANUAL',
    requiresAdminReview: Boolean(profile.requiresAdminReview),
    reviewNotes: Array.isArray(profile.reviewNotesJson) ? profile.reviewNotesJson : undefined,
    compensation: compensationAmount === null ? undefined : {
      currency: profile.compensationCurrency || 'USD',
      amount: compensationAmount,
      frequency: (profile.compensationFrequency || 'monthly').toLowerCase(),
    },
    compensationType: profile.compensationType || undefined,
    compensationEffectiveDate: profile.compensationEffectiveDate
      ? profile.compensationEffectiveDate.toISOString().slice(0, 10)
      : undefined,
    compensationNotes: profile.compensationNotes || undefined,
    latestCredential: profile.credentialProvisionings?.[0]
      ? {
        id: profile.credentialProvisionings[0].id,
        username: profile.credentialProvisionings[0].username,
        temporaryPassword: profile.credentialProvisionings[0].temporaryPassword,
        status: profile.credentialProvisionings[0].statusCode,
        generatedAt: profile.credentialProvisionings[0].generatedAt.toISOString(),
        sentAt: profile.credentialProvisionings[0].sentAt
          ? profile.credentialProvisionings[0].sentAt.toISOString()
          : undefined,
      }
      : undefined,
    salaryHistory: [],
  };
}

export async function listHrmDepartments(prisma) {
  return prisma.department.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, createdAt: true, updatedAt: true },
  });
}

export async function listHrmEmployees(prisma, options = {}) {
  const take = Math.min(Math.max(Number(options.take || 100), 1), 500);
  const skip = Math.max(Number(options.skip || 0), 0);
  const q = String(options.q || '').trim().toLowerCase();
  const startedAt = Date.now();

  const viewerScope = await resolveHrmViewerScope(prisma, options.viewerUserId);

  const where = {
    isDeleted: false,
    user: {
      isDeleted: false,
      ...(q
        ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
          ],
        }
        : {}),
    },
    ...(!viewerScope.userId || viewerScope.isAdmin
      ? {}
      : viewerScope.departmentId
        ? {
          OR: [
            { userId: viewerScope.userId },
            { user: { departmentId: viewerScope.departmentId } },
          ],
        }
        : {
          userId: viewerScope.userId,
        }),
  };

  const dbStartedAt = Date.now();
  let rows;
  try {
    rows = await prisma.hrmEmploymentProfile.findMany({
      where,
      include: {
        ...(credentialProvisioningTableAvailable
          ? {
            credentialProvisionings: {
            where: { revokedAt: null },
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          }
          : {}),
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            departmentId: true,
            hasSystemAccess: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  } catch (error) {
    if (!markCredentialTableUnavailableIfMissing(error)) throw error;
    rows = await prisma.hrmEmploymentProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            departmentId: true,
            hasSystemAccess: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }
  const dbMs = Date.now() - dbStartedAt;
  const total = await prisma.hrmEmploymentProfile.count({ where });
  return {
    employees: rows.map((row) => mapEmployee(row, { includeRoles: false })),
    pagination: {
      take,
      skip,
      total,
      hasMore: skip + rows.length < total,
    },
    meta: {
      dbMs,
      totalMs: Date.now() - startedAt,
      count: rows.length,
    },
  };
}

export async function getHrmBootstrap(prisma, options = {}) {
  const startedAt = Date.now();
  const [departments, employees] = await Promise.all([
    listHrmDepartments(prisma),
    listHrmEmployees(prisma, options),
  ]);
  return {
    departments,
    employees: employees.employees,
    pagination: employees.pagination,
    meta: {
      listEmployeesDbMs: employees.meta?.dbMs ?? null,
      totalMs: Date.now() - startedAt,
    },
  };
}

export async function getHrmEmployeeDetail(prisma, employeeId) {
  let row;
  try {
    row = await prisma.hrmEmploymentProfile.findUnique({
      where: { id: employeeId },
      include: {
        ...(credentialProvisioningTableAvailable
          ? {
            credentialProvisionings: {
            where: { revokedAt: null },
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          }
          : {}),
        user: {
          include: {
            roles: {
              where: { validTo: null },
              include: { role: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!markCredentialTableUnavailableIfMissing(error)) throw error;
    row = await prisma.hrmEmploymentProfile.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          include: {
            roles: {
              where: { validTo: null },
              include: { role: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }
  if (!row || row.isDeleted || !row.user || row.user.isDeleted) return null;
  return mapEmployee(row, { includeRoles: true });
}

export async function getHrmEmployeeDetailScoped(prisma, employeeId, options = {}) {
  const row = await getHrmEmployeeDetail(prisma, employeeId);
  if (!row) return null;
  const viewerScope = await resolveHrmViewerScope(prisma, options.viewerUserId);
  if (!viewerScope.userId || viewerScope.isAdmin) return row;
  if (row.userId === viewerScope.userId) return row;
  if (viewerScope.departmentId && row.departmentId === viewerScope.departmentId) return row;
  return null;
}

export async function canManageHrmEmployee(prisma, employeeId, actorUserId) {
  const viewerScope = await resolveHrmViewerScope(prisma, actorUserId);
  if (!viewerScope.userId) return false;
  if (!(viewerScope.isAdmin || viewerScope.isHr)) return false;
  const scoped = await getHrmEmployeeDetailScoped(prisma, employeeId, { viewerUserId: actorUserId });
  return Boolean(scoped);
}

export async function canManageHrmAdministration(prisma, actorUserId) {
  const viewerScope = await resolveHrmViewerScope(prisma, actorUserId);
  return Boolean(viewerScope.userId && (viewerScope.isAdmin || viewerScope.isHr));
}

export async function createHrmDepartment(prisma, payload, actor) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Department name is required.');
  const codeBase = String(payload.code || name).replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase().slice(0, 24) || 'DEPT';
  const code = `${codeBase}_${Date.now().toString().slice(-5)}`;

  return prisma.$transaction(async (tx) => {
    const created = await tx.department.create({
      data: { name, code, isActive: true, isDeleted: false },
      select: { id: true, code: true, name: true, createdAt: true, updatedAt: true },
    });
    await tx.auditLog.create({
      data: {
        txId: `hrm-dept-create-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'department',
        entityId: created.id,
        actionType: 'department_created',
        newValueJson: created,
      },
    });
    return created;
  });
}

export async function updateHrmDepartment(prisma, id, payload, actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.department.findUnique({ where: { id } });
    if (!current || current.isDeleted) throw new Error('Department not found.');
    const updated = await tx.department.update({
      where: { id },
      data: { name: payload.name ? String(payload.name).trim() : undefined },
      select: { id: true, code: true, name: true, createdAt: true, updatedAt: true },
    });
    await tx.auditLog.create({
      data: {
        txId: `hrm-dept-update-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'department',
        entityId: id,
        actionType: 'department_updated',
        oldValueJson: { name: current.name },
        newValueJson: { name: updated.name },
      },
    });
    return updated;
  });
}

export async function deleteHrmDepartment(prisma, id, actor) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.department.findUnique({ where: { id } });
    if (!current || current.isDeleted) throw new Error('Department not found.');
    await tx.department.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        txId: `hrm-dept-delete-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'department',
        entityId: id,
        actionType: 'department_deleted',
        oldValueJson: { name: current.name },
      },
    });
    return { id };
  });
}

export async function upsertHrmEmployee(prisma, payload, actor) {
  return prisma.$transaction(async (tx) => {
    return upsertHrmEmployeeTx(tx, payload, actor);
  });
}

async function resolveManagerUserId(tx, payload) {
  const direct = payload.managerUserId ? String(payload.managerUserId).trim() : '';
  if (direct) {
    const userById = await tx.user.findUnique({ where: { id: direct } });
    if (userById) return userById.id;
  }

  const managerRef = payload.managerPersonId ? String(payload.managerPersonId).trim() : '';
  if (managerRef) {
    const userById = await tx.user.findUnique({ where: { id: managerRef } });
    if (userById) return userById.id;

    const profileById = await tx.hrmEmploymentProfile.findUnique({
      where: { id: managerRef },
      select: { userId: true },
    });
    if (profileById?.userId) return profileById.userId;

    if (managerRef.includes('@')) {
      const userByEmail = await tx.user.findFirst({
        where: { email: managerRef.toLowerCase(), isDeleted: false },
        select: { id: true },
      });
      if (userByEmail?.id) return userByEmail.id;
    }
  }

  const managerEmail = payload.managerEmail ? String(payload.managerEmail).trim().toLowerCase() : '';
  if (managerEmail) {
    const userByEmail = await tx.user.findFirst({
      where: { email: managerEmail, isDeleted: false },
      select: { id: true },
    });
    if (userByEmail?.id) return userByEmail.id;
  }

  return null;
}

async function upsertHrmEmployeeTx(tx, payload, actor) {
  const name = String(payload.name || '').trim();
  const roleTitle = String(payload.roleTitle || '').trim();
  if (!name) throw new Error('Employee name is required.');
  if (!roleTitle) throw new Error('Employee roleTitle is required.');

  const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
  const creationSource = String(payload.creationSource || 'MANUAL').toUpperCase();
  const requestedStatus = String(payload.status || 'active').toLowerCase();
  const statusCode = ensureNonRecruitmentStatus(creationSource, requestedStatus);
  const managerUserId = await resolveManagerUserId(tx, payload);
  const startDate = isoDateOnlyToDate(payload.startDate) || new Date();
  const endDate = isoDateOnlyToDate(payload.endDate);
  const contractType = String(payload.contractType || 'CDI').toUpperCase();
  const probationEndDate = isoDateOnlyToDate(payload.probationEndDate);
  const confirmationDate = isoDateOnlyToDate(payload.confirmationDate);
  const compensationEffectiveDate = isoDateOnlyToDate(payload.compensationEffectiveDate);
  const compensationAmount = toNumberOrNull(payload.compensation?.amount ?? payload.baseSalary ?? payload.compensationAmount);
  const compensationCurrency = String(payload.compensation?.currency || payload.compensationCurrency || 'USD').toUpperCase();
  const compensationFrequency = String(payload.compensation?.frequency || payload.paymentFrequency || payload.compensationFrequency || 'monthly').toLowerCase();
  const compensationType = String(payload.compensationType || 'base_salary').toLowerCase();
  const contractStatus = String(payload.contractStatus || (statusCode === 'inactive' ? 'inactive' : 'active')).toLowerCase();
  const accessStatus = String(payload.accessStatus || payload.systemAccessStatus || (payload.hasSystemAccess === false ? 'disabled' : 'active')).toLowerCase();

  if (contractType === 'CDD' && !endDate) {
    throw new Error('Contract end date is required for CDD.');
  }
    let user;
    let createdNewUser = false;
    if (payload.userId) {
      user = await tx.user.findUnique({ where: { id: String(payload.userId) } });
    }
    if (!user && email) {
      user = await tx.user.findFirst({ where: { email, isDeleted: false } });
    }

    if (user) {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          email: email || user.email,
          username: email || user.username,
          departmentId: payload.departmentId ? String(payload.departmentId) : null,
          hasSystemAccess: payload.hasSystemAccess === undefined ? user.hasSystemAccess : Boolean(payload.hasSystemAccess),
          isActive: statusCode !== 'inactive',
          isDeleted: false,
        },
      });
    } else {
      user = await tx.user.create({
        data: {
          name,
          email,
          username: email || `user_${Date.now().toString(36)}`,
          departmentId: payload.departmentId ? String(payload.departmentId) : null,
          hasSystemAccess: payload.hasSystemAccess === undefined ? true : Boolean(payload.hasSystemAccess),
          isActive: statusCode !== 'inactive',
          isDeleted: false,
        },
      });
      createdNewUser = true;
    }

    const existingProfile = await tx.hrmEmploymentProfile.findFirst({
      where: { OR: [{ id: payload.id || '' }, { userId: user.id }] },
    });

    const profileData = {
      userId: user.id,
      employeeCode: String(payload.employeeCode || existingProfile?.employeeCode || makeEmployeeCode()),
      employmentType: String(payload.employmentType || existingProfile?.employmentType || 'employee').toLowerCase(),
      statusCode,
      roleTitle,
      managerUserId,
      startDate,
      endDate: contractType === 'CDI' ? null : endDate,
      contractType,
      contractStatus,
      probationEndDate,
      confirmationDate,
      terminationReason: payload.terminationReason ? String(payload.terminationReason) : null,
      workLocation: payload.workLocation ? String(payload.workLocation) : null,
      compensationAmount,
      compensationCurrency,
      compensationFrequency,
      compensationType,
      compensationEffectiveDate,
      compensationNotes: payload.compensationNotes ? String(payload.compensationNotes) : null,
      systemAccessStatus: accessStatus,
      authorityLevel: String(payload.authorityLevel || existingProfile?.authorityLevel || 'CONTRIBUTOR').toUpperCase(),
      creationSource,
      requiresAdminReview: Boolean(payload.requiresAdminReview ?? existingProfile?.requiresAdminReview ?? false),
      reviewNotesJson: payload.reviewNotes ?? existingProfile?.reviewNotesJson ?? null,
      isDeleted: false,
      deletedAt: null,
    };

    const profile = existingProfile
      ? await tx.hrmEmploymentProfile.update({ where: { id: existingProfile.id }, data: profileData, include: { user: true } })
      : await tx.hrmEmploymentProfile.create({ data: profileData, include: { user: true } });

    const shouldProvisionCredentials = Boolean(
      user.hasSystemAccess
      && (createdNewUser || !user.passwordHash || payload.regenerateCredentials === true),
    );

    if (shouldProvisionCredentials) {
      await createHrmCredentialProvisioning(tx, {
        userId: user.id,
        employmentProfileId: profile.id,
        username: user.email || user.username,
        fallbackUsername: user.username || user.email || `user_${Date.now().toString(36)}`,
        generatedByUserId: actor.actorUserId,
      });
    }

    if (payload.markCredentialsSent === true) {
      const latestCredential = await findLatestCredentialSafe(tx, profile.id);
      if (latestCredential) {
        if (credentialProvisioningTableAvailable) {
          await tx.hrmCredentialProvisioning.update({
            where: { id: latestCredential.id },
            data: {
              statusCode: 'shared_for_email',
              sentAt: new Date(),
            },
          });
        }
      }
    }

    if (user.hasSystemAccess) {
      const roleCodes = await resolveProvisionedRoleCodes(tx, payload, user);
      await syncUserActiveRoles(tx, user.id, roleCodes);
    } else {
      await tx.userRole.updateMany({
        where: { userId: user.id, validTo: null },
        data: { validTo: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        txId: `hrm-employee-upsert-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'employment_profile',
        entityId: profile.id,
        actionType: existingProfile ? 'employee_updated' : 'employee_created',
        oldValueJson: existingProfile
          ? {
            roleTitle: existingProfile.roleTitle,
            statusCode: existingProfile.statusCode,
            contractType: existingProfile.contractType,
            contractEndDate: existingProfile.endDate,
            compensationAmount: existingProfile.compensationAmount,
            systemAccessStatus: existingProfile.systemAccessStatus,
          }
          : null,
        newValueJson: {
          userId: user.id,
          roleTitle,
          statusCode,
          contractType,
          contractEndDate: profileData.endDate,
          compensationAmount,
          compensationCurrency,
          compensationFrequency,
          accessStatus,
          systemRole: payload.systemRole || 'USER',
          creationSource,
        },
      },
    });

    const mapped = await tx.hrmEmploymentProfile.findUnique({
      where: { id: profile.id },
      include: {
        ...(credentialProvisioningTableAvailable
          ? {
            credentialProvisionings: {
            where: { revokedAt: null },
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          }
          : {}),
        user: {
          include: {
            roles: {
              where: { validTo: null },
              include: { role: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    return mapEmployee(mapped);
}

export async function bulkUpsertHrmEmployees(prisma, payload, actor) {
  const rows = Array.isArray(payload?.employees) ? payload.employees : [];
  if (!rows.length) return { employees: [] };

  const employees = [];
  await prisma.$transaction(async (tx) => {
    const tempPersonToUserId = new Map();
    const pendingManagerLinks = [];

    // Pass 1: create/update profiles without manager link to avoid FK ordering issues.
    for (const row of rows) {
      const preparedRow = {
        ...row,
        managerPersonId: undefined,
        managerUserId: undefined,
      };

      const created = await upsertHrmEmployeeTx(tx, preparedRow, actor);
      employees.push(created);

      const sourcePersonId = row?.personId ? String(row.personId).trim() : '';
      if (sourcePersonId && created?.userId) {
        tempPersonToUserId.set(sourcePersonId, created.userId);
      }

      pendingManagerLinks.push({
        profileId: created.id,
        employeeUserId: created.userId,
        managerPersonId: row?.managerPersonId ? String(row.managerPersonId).trim() : '',
        managerUserId: row?.managerUserId ? String(row.managerUserId).trim() : '',
        managerEmail: row?.managerEmail ? String(row.managerEmail).trim().toLowerCase() : '',
      });
    }

    // Pass 2: resolve and apply manager links once all rows are created.
    for (const link of pendingManagerLinks) {
      let resolvedManagerUserId = null;

      if (link.managerUserId) {
        const byUserId = await tx.user.findUnique({ where: { id: link.managerUserId }, select: { id: true } });
        if (byUserId?.id) resolvedManagerUserId = byUserId.id;
      }

      if (!resolvedManagerUserId && link.managerPersonId) {
        if (tempPersonToUserId.has(link.managerPersonId)) {
          resolvedManagerUserId = tempPersonToUserId.get(link.managerPersonId) || null;
        }
      }

      if (!resolvedManagerUserId && link.managerPersonId) {
        const byUserId = await tx.user.findUnique({ where: { id: link.managerPersonId }, select: { id: true } });
        if (byUserId?.id) resolvedManagerUserId = byUserId.id;
      }

      if (!resolvedManagerUserId && link.managerPersonId) {
        const byProfileId = await tx.hrmEmploymentProfile.findUnique({
          where: { id: link.managerPersonId },
          select: { userId: true },
        });
        if (byProfileId?.userId) resolvedManagerUserId = byProfileId.userId;
      }

      if (!resolvedManagerUserId && link.managerPersonId && link.managerPersonId.includes('@')) {
        const byEmail = await tx.user.findFirst({
          where: { email: link.managerPersonId.toLowerCase(), isDeleted: false },
          select: { id: true },
        });
        if (byEmail?.id) resolvedManagerUserId = byEmail.id;
      }

      if (!resolvedManagerUserId && link.managerEmail) {
        const byEmail = await tx.user.findFirst({
          where: { email: link.managerEmail, isDeleted: false },
          select: { id: true },
        });
        if (byEmail?.id) resolvedManagerUserId = byEmail.id;
      }

      if (resolvedManagerUserId && resolvedManagerUserId !== link.employeeUserId) {
        await tx.hrmEmploymentProfile.update({
          where: { id: link.profileId },
          data: { managerUserId: resolvedManagerUserId },
        });
      }
    }
  });
  return { employees };
}

export async function backfillDefaultAccessProvisioning(prisma, actor) {
  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      hasSystemAccess: true,
    },
    select: {
      id: true,
      departmentId: true,
      hrmEmploymentProfile: {
        where: { isDeleted: false },
        select: { id: true, authorityLevel: true },
      },
    },
  });

  const updatedUsers = [];
  const now = Date.now();

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      const profile = user.hrmEmploymentProfile || null;
      const roleCodes = await resolveProvisionedRoleCodes(tx, {
        systemRole: null,
        authorityLevel: profile?.authorityLevel || 'CONTRIBUTOR',
        departmentId: user.departmentId || undefined,
      }, user);
      await syncUserActiveRoles(tx, user.id, roleCodes);
      updatedUsers.push({
        userId: user.id,
        roleCodes,
      });
    }

    await tx.auditLog.create({
      data: {
        txId: `hrm-access-backfill-${now}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'access_provisioning',
        entityId: `backfill_${now}`,
        actionType: 'default_access_backfilled',
        newValueJson: {
          updatedCount: updatedUsers.length,
        },
      },
    });
  });

  return {
    updatedCount: updatedUsers.length,
    users: updatedUsers,
  };
}

export async function archiveHrmEmployee(prisma, employeeId, actor) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.hrmEmploymentProfile.findUnique({ where: { id: employeeId } });
    if (!profile || profile.isDeleted) throw new Error('Employee profile not found.');
    await tx.hrmEmploymentProfile.update({
      where: { id: employeeId },
      data: { isDeleted: true, deletedAt: new Date(), statusCode: 'inactive' },
    });
    await tx.user.update({
      where: { id: profile.userId },
      data: { isActive: false },
    });
    await tx.auditLog.create({
      data: {
        txId: `hrm-employee-archive-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'employment_profile',
        entityId: employeeId,
        actionType: 'employee_archived',
      },
    });
    return { id: employeeId };
  });
}

export async function listHrmEmployeeActivity(prisma, employeeId) {
  const rows = await prisma.auditLog.findMany({
    where: {
      module: 'hrm',
      entity: 'employment_profile',
      entityId: employeeId,
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
    select: {
      id: true,
      occurredAt: true,
      actionType: true,
      oldValueJson: true,
      newValueJson: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.occurredAt.toISOString(),
    actionType: row.actionType,
    actorUserId: row.user?.id || null,
    actorDisplayName: row.user?.name || row.user?.email || 'System',
    oldValue: row.oldValueJson || null,
    newValue: row.newValueJson || null,
    message: `${row.user?.name || 'System'} ${row.actionType.replaceAll('_', ' ')}`,
  }));
}

export async function regenerateHrmEmployeeCredentials(prisma, employeeId, actor) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.hrmEmploymentProfile.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });
    if (!profile || profile.isDeleted || !profile.user || profile.user.isDeleted) {
      throw new Error('Employee not found.');
    }
    if (!profile.user.hasSystemAccess) {
      throw new Error('Platform access is disabled for this employee.');
    }

    const credential = await createHrmCredentialProvisioning(tx, {
      userId: profile.user.id,
      employmentProfileId: profile.id,
      username: profile.user.email || profile.user.username,
      fallbackUsername: profile.user.username || profile.user.email || `user_${Date.now().toString(36)}`,
      generatedByUserId: actor.actorUserId,
    });

    await tx.auditLog.create({
      data: {
        txId: `hrm-credential-regenerate-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'employment_profile',
        entityId: profile.id,
        actionType: 'employee_credentials_regenerated',
        newValueJson: {
          credentialId: credential.id,
          username: credential.username,
          status: credential.statusCode,
        },
      },
    });

    return {
      id: credential.id,
      username: credential.username,
      temporaryPassword: credential.temporaryPassword,
      status: credential.statusCode,
      generatedAt: credential.generatedAt.toISOString(),
      sentAt: credential.sentAt ? credential.sentAt.toISOString() : undefined,
    };
  });
}

export async function markHrmEmployeeCredentialsSent(prisma, employeeId, actor) {
  if (!credentialProvisioningTableAvailable) {
    throw new Error('Credential provisioning table is unavailable. Please run latest database migrations.');
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.hrmEmploymentProfile.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!profile) throw new Error('Employee not found.');

    const latest = await tx.hrmCredentialProvisioning.findFirst({
      where: {
        employmentProfileId: profile.id,
        revokedAt: null,
      },
      orderBy: { generatedAt: 'desc' },
    });
    if (!latest) throw new Error('No credentials available for this employee.');

    const sentAt = new Date();
    const updated = await tx.hrmCredentialProvisioning.update({
      where: { id: latest.id },
      data: {
        statusCode: 'shared_for_email',
        sentAt,
      },
    });

    await tx.auditLog.create({
      data: {
        txId: `hrm-credential-sent-${Date.now()}`,
        userId: actor.actorUserId,
        module: 'hrm',
        entity: 'employment_profile',
        entityId: profile.id,
        actionType: 'employee_credentials_marked_sent',
        newValueJson: {
          credentialId: updated.id,
          sentAt,
        },
      },
    });

    return {
      id: updated.id,
      username: updated.username,
      temporaryPassword: updated.temporaryPassword,
      status: updated.statusCode,
      generatedAt: updated.generatedAt.toISOString(),
      sentAt: updated.sentAt ? updated.sentAt.toISOString() : undefined,
    };
  });
}

export async function getLatestHrmEmployeeCredential(prisma, employeeId) {
  const profile = await prisma.hrmEmploymentProfile.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!profile) throw new Error('Employee not found.');

  const latest = await findLatestCredentialSafe(prisma, profile.id);

  if (!latest) {
    return null;
  }

  return {
    id: latest.id,
    username: latest.username,
    temporaryPassword: latest.temporaryPassword,
    status: latest.statusCode,
    generatedAt: latest.generatedAt.toISOString(),
    sentAt: latest.sentAt ? latest.sentAt.toISOString() : undefined,
  };
}
