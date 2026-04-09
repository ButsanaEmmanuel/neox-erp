import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerClient as sseRegisterClient, connectedClientCount, broadcast as sseBroadcast } from './services/realtime/sseBroadcaster.mjs';
import { PrismaClient } from '@prisma/client';
import {
  deleteProjectItemFile,
  listProjectItemActivities,
  listProjectItemFiles,
  resolveAbsoluteStoredPath,
  saveProjectItemDetails,
  uploadProjectItemFile,
} from './services/projects/projectItemDetails.service.mjs';
import {
  bulkImportTelecomWorkItems,
  createProjectForUser,
  getEngineeringDashboard,
  listProjectsForUser,
  listUserTeamNotifications,
  notifyTeam,
  repairProjectIntegrity,
} from './services/projects/projectCollaboration.service.mjs';
import { buildFinanceSnapshot } from './services/finance/financeSnapshot.service.mjs';
import {
  approveFinanceEntry,
  backfillProjectFinanceEntries,
  backfillReceivablesAndPayables,
  getPayableDetail,
  getReceivableDetail,
  listPayables,
  listReceivables,
  getFinanceEntryDetail,
  listFinanceEntries,
  listFinanceEntryActivity,
  listFinanceEntryEvidence,
  rejectFinanceEntry,
  resolveAbsoluteFinanceStoredPath,
  uploadFinanceEvidence,
  backfillInvoicesAndBills,
  createCustomerInvoice,
  createPaymentDisbursement,
  createReceiptCollection,
  createVendorBill,
  listCustomerInvoices,
  listPaymentDisbursements,
  listReceiptCollections,
  listVendorBills,
  syncScmPoCommitment,
  createScmVendorBill,
  getScmPoFinanceStatus,
  syncScmRequisitionCommitment,
  createPayrollBatch,
  listPayrollBatches,
  getPayrollBatchDetail,
  approvePayrollBatch,
  disbursePayrollLine,
  reconcilePayrollBatch,
  createExpenseClaim,
  listExpenseClaims,
  approveExpenseClaim,
  createEmployeeAdvance,
  listEmployeeAdvances,
  approveEmployeeAdvance,
  runFinanceReconciliation,
  listFinanceReconciliations,
  getFinanceReconciliationDetail,
  listReconciliationUnmatchedReceipts,
  listReconciliationUnmatchedPayments,
  listReconciliationDiscrepancyCases,
  resolveDiscrepancyCase,
} from './services/finance/financeEntries.service.mjs';
import { getFinanceReports } from './services/finance/financeReporting.service.mjs';
import {
  getFinanceGovernanceSettings,
  rolloutFinanceGovernance,
  upsertFinanceApprovalThreshold,
  upsertFinanceCategorySetting,
  upsertFinanceEvidenceRule,
  upsertFinanceLedgerMapping,
  upsertFinanceNumberingScheme,
  upsertFinancePaymentMethodSetting,
} from './services/finance/financeGovernance.service.mjs';
import {
  createClientAccount,
  getClientFinancialSnapshot,
  listCrmLookups,
  listClientAccounts,
  listCrmDeals,
  updateClientAccount,
  createCrmDeal,
  markDealWonAndCreateInvoiceCandidate,
  updateCrmDeal,
  suggestClientDuplicates as suggestCrmClientDuplicates,
} from './services/crm/clientAccounts.service.mjs';
import {
  getReportsIntelligence,
  synthesizeReportsIntelligence,
} from './services/reports/intelligence.service.mjs';
import { getDashboardOverview } from './services/dashboard/dashboardOverview.service.mjs';
import {
  adjustPayrollRunEmployee,
  executePayrollRun,
  getPayrollRunDetail,
  listEmployeeSalaryProfiles,
  listPayrollRuns,
  listPayrollSchedules,
  postPayrollRun,
  runDuePayrollSchedules,
  upsertEmployeeSalaryProfile,
  upsertPayrollSchedule,
} from './services/hrm/payrollEngine.service.mjs';
import {
  archiveHrmEmployee,
  backfillDefaultAccessProvisioning,
  bulkUpsertHrmEmployees,
  canManageHrmAdministration,
  createHrmDepartment,
  deleteHrmDepartment,
  getLatestHrmEmployeeCredential,
  getHrmBootstrap,
  getHrmEmployeeDetailScoped,
  listHrmEmployeeActivity,
  markHrmEmployeeCredentialsSent,
  regenerateHrmEmployeeCredentials,
  listHrmDepartments,
  listHrmEmployees,
  updateHrmDepartment,
  upsertHrmEmployee,
  canManageHrmEmployee,
} from './services/hrm/hrmDirectory.service.mjs';
import {
  canAccessCrossDepartmentResource,
  getPendingApprovals,
  getUserPermissionSet,
  listResourceStakeholders,
  upsertResourceStakeholder,
} from './services/access/universalAccess.service.mjs';

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const prisma = new PrismaClient();
const PORT = Number(process.env.AUTH_API_PORT ?? 4000);
const ALLOWED_ORIGIN = process.env.AUTH_API_ORIGIN ?? '*';

let previousCpuSnapshot = null;

function readCpuSnapshot() {
  const cpus = os.cpus() || [];
  return cpus.map((cpu) => {
    const times = cpu.times || {};
    const idle = Number(times.idle || 0);
    const total = Number(times.user || 0) + Number(times.nice || 0) + Number(times.sys || 0) + Number(times.irq || 0) + idle;
    return { idle, total };
  });
}

function computeCpuUsagePercent() {
  const current = readCpuSnapshot();
  if (!current.length) return 0;

  if (!previousCpuSnapshot || previousCpuSnapshot.length !== current.length) {
    previousCpuSnapshot = current;
    return 0;
  }

  let totalDelta = 0;
  let idleDelta = 0;

  for (let i = 0; i < current.length; i += 1) {
    const prev = previousCpuSnapshot[i];
    const now = current[i];
    const deltaTotal = Math.max(0, now.total - prev.total);
    const deltaIdle = Math.max(0, now.idle - prev.idle);
    totalDelta += deltaTotal;
    idleDelta += deltaIdle;
  }

  previousCpuSnapshot = current;

  if (totalDelta <= 0) return 0;
  const busy = ((totalDelta - idleDelta) / totalDelta) * 100;
  return Math.max(0, Math.min(100, busy));
}

function buildSystemHealthPayload() {
  const cpuPercent = computeCpuUsagePercent();
  const totalMem = os.totalmem() || 1;
  const freeMem = os.freemem() || 0;
  const ramPercent = ((totalMem - freeMem) / totalMem) * 100;
  const loadPercent = Math.max(cpuPercent, ramPercent);

  const healthLabel = loadPercent >= 85 ? 'heavy_processing' : 'optimal';
  const tooltip = loadPercent >= 85 ? 'Server Load: Heavy Processing in progress' : 'Server Load: Optimal';

  return {
    cpuPercent: Number(cpuPercent.toFixed(1)),
    ramPercent: Number(ramPercent.toFixed(1)),
    loadPercent: Number(loadPercent.toFixed(1)),
    status: healthLabel,
    tooltip,
    sampledAt: new Date().toISOString(),
  };
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function verifyPassword(plainTextPassword, storedPasswordHash) {
  if (!storedPasswordHash) return false;

  if (!storedPasswordHash.includes(':')) {
    return plainTextPassword === storedPasswordHash;
  }

  const [salt, hash] = storedPasswordHash.split(':');
  if (!salt || !hash) return false;

  const check = crypto.scryptSync(plainTextPassword, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function hashPassword(plainTextPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainTextPassword, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function ensureLockedAdminIdentity() {
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      name: 'Administrator',
      isActive: true,
      isDeleted: false,
    },
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      isActive: true,
      isDeleted: false,
    },
    select: { id: true },
  });

  const targetUser = await prisma.user.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { id: 'usr_ebutsana_full_access_20260321' },
        { email: { in: ['admin@neox.com', 'ebutsana@neox.io'] } },
        { username: { in: ['admin@neox.com', 'ebutsana@neox.io'] } },
        { name: { equals: 'Emmanuel BUTSANA', mode: 'insensitive' } },
        { name: { equals: 'Emmanuel Butsana', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  if (!targetUser?.id) return;

  const existingAdminLink = await prisma.userRole.findFirst({
    where: {
      userId: targetUser.id,
      roleId: adminRole.id,
      validTo: null,
    },
    select: { id: true },
  });

  if (!existingAdminLink) {
    await prisma.userRole.create({
      data: {
        userId: targetUser.id,
        roleId: adminRole.id,
        validFrom: new Date(),
      },
    });
  }

  // Hard lock: the protected admin identity must not keep concurrent active non-admin role links.
  await prisma.userRole.updateMany({
    where: {
      userId: targetUser.id,
      validTo: null,
      NOT: { roleId: adminRole.id },
    },
    data: {
      validTo: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      isActive: true,
      hasSystemAccess: true,
    },
  });

  await prisma.hrmEmploymentProfile.upsert({
    where: { userId: targetUser.id },
    update: {
      authorityLevel: 'ADMIN',
      systemAccessStatus: 'active',
      statusCode: 'active',
      roleTitle: 'Administrator',
    },
    create: {
      userId: targetUser.id,
      employeeCode: `ADM-${targetUser.id.slice(-6).toUpperCase()}`,
      roleTitle: 'Administrator',
      employmentType: 'employee',
      statusCode: 'active',
      startDate: new Date(),
      contractType: 'CDI',
      contractStatus: 'active',
      authorityLevel: 'ADMIN',
      systemAccessStatus: 'active',
      creationSource: 'MANUAL',
    },
  });
}

function resolvePrimaryRoleCode(roleLinks = []) {
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
    .map((link) => String(link?.role?.code || '').toUpperCase())
    .filter(Boolean);
  for (const code of priority) {
    if (codes.includes(code)) return code;
  }
  return codes[0] || 'USER';
}

function buildAuthUserPayload(user, primaryRole) {
  return {
    id: user.id,
    name: user.name ?? user.email ?? user.username ?? 'Utilisateur',
    email: user.email ?? user.username ?? '',
    role: primaryRole,
    departmentId: user.departmentId ?? undefined,
    departmentName: user.department?.name ?? undefined,
    avatar: user.image ?? undefined,
    forcePasswordChange: user.forcePasswordChange,
    jobTitle: user.jobTitle ?? undefined,
    phoneNumber: user.phoneNumber ?? undefined,
    supervisorId: user.supervisorId ?? undefined,
    supervisorName: user.supervisor?.name ?? undefined,
    preferredLanguage: user.preferredLanguage ?? 'fr',
    notifyCrm: user.notifyCrm ?? true,
    notifyProjects: user.notifyProjects ?? true,
    notifyFinance: user.notifyFinance ?? true,
    quickStatus: user.quickStatus ?? 'online',
  };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function parseActor(body) {
  return {
    actorUserId: String(body.actorUserId || body.userId || '').trim() || null,
    actorDisplayName: String(body.actorDisplayName || body.userName || '').trim() || 'User',
  };
}

async function resolvePermissionSetForRequest(prismaClient, url, body = null) {
  const queryUserId = String(url.searchParams.get('userId') || '').trim();
  const bodyUserId = String(body?.actorUserId || body?.userId || '').trim();
  const userId = queryUserId || bodyUserId;
  if (!userId) return null;
  return getUserPermissionSet(prismaClient, userId);
}

async function resolveOmniAdminForRequest(prismaClient, url, body = null) {
  const queryUserId = String(url.searchParams.get('userId') || '').trim();
  const bodyUserId = String(body?.actorUserId || body?.userId || '').trim();
  const userId = queryUserId || bodyUserId;
  if (!userId) return false;

  const user = await prismaClient.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    include: {
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
      hrmEmploymentProfile: {
        select: { authorityLevel: true },
      },
    },
  });
  if (!user) return false;

  const roleCodes = (user.roles || []).map((row) => String(row?.role?.code || '').toUpperCase());
  const authorityLevel = String(user.hrmEmploymentProfile?.authorityLevel || 'CONTRIBUTOR').toUpperCase();
  if (roleCodes.includes('ADMIN') || authorityLevel === 'ADMIN') return true;

  const explicitBypass = await prismaClient.userPermissionSet.findFirst({
    where: {
      userId,
      module: 'global',
      resource: 'all',
      action: 'all_access',
      effect: { not: 'deny' },
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(explicitBypass?.id);
}

async function assertModuleAccess(prismaClient, url, moduleId, body = null) {
  if (await resolveOmniAdminForRequest(prismaClient, url, body)) {
    return null;
  }
  const permissionSet = await resolvePermissionSetForRequest(prismaClient, url, body);
  if (!permissionSet) return null;
  const capability = permissionSet.modules?.[moduleId];
  if (!capability?.visible) {
    const err = new Error(`Access denied for module '${moduleId}'.`);
    err.statusCode = 403;
    throw err;
  }
  return permissionSet;
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email || !password) {
    return json(res, 400, { message: 'Email et mot de passe requis.' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username: email }],
      isDeleted: false,
      isActive: true,
    },
    include: {
      department: true,
      supervisor: true,
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash ?? '')) {
    return json(res, 401, { message: 'Identifiants invalides.' });
  }

  const primaryRole = resolvePrimaryRoleCode(user.roles);
  const token = crypto.randomBytes(24).toString('base64url');

  return json(res, 200, {
    token,
    user: buildAuthUserPayload(user, primaryRole),
  });
}

async function handleChangePassword(req, res) {
  const body = await parseBody(req);
  const email = String(body.email ?? '').trim().toLowerCase();
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (!email || !currentPassword || !newPassword) {
    return json(res, 400, { message: 'Email, mot de passe actuel et nouveau mot de passe requis.' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username: email }],
      isDeleted: false,
      isActive: true,
    },
  });

  if (!user || !verifyPassword(currentPassword, user.passwordHash ?? '')) {
    return json(res, 401, { message: 'Mot de passe actuel invalide.' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword),
      forcePasswordChange: false,
      passwordChangedAt: new Date(),
    },
  });

  return json(res, 200, { success: true });
}

async function handleUpdateProfile(req, res) {
  const body = await parseBody(req);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'role')) {
    return json(res, 403, { message: 'Role cannot be modified from profile update.' });
  }
  const currentUserId = String(body.currentUserId ?? '').trim();
  const currentEmail = String(body.currentEmail ?? '').trim().toLowerCase();
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  const avatar = typeof body.avatar === 'string' ? body.avatar : undefined;
  const jobTitle = typeof body.jobTitle === 'string' ? body.jobTitle.trim() : undefined;
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : undefined;
  const supervisorId = body.supervisorId === null ? null : (typeof body.supervisorId === 'string' ? body.supervisorId.trim() : undefined);
  const preferredLanguage = typeof body.preferredLanguage === 'string' ? body.preferredLanguage.trim().toLowerCase() : undefined;
  const notifyCrm = typeof body.notifyCrm === 'boolean' ? body.notifyCrm : undefined;
  const notifyProjects = typeof body.notifyProjects === 'boolean' ? body.notifyProjects : undefined;
  const notifyFinance = typeof body.notifyFinance === 'boolean' ? body.notifyFinance : undefined;
  const quickStatus = typeof body.quickStatus === 'string' ? body.quickStatus.trim().toLowerCase() : undefined;

  if (!currentUserId && !currentEmail) {
    return json(res, 400, { message: 'Utilisateur introuvable.' });
  }

  let user = null;
  if (currentUserId) {
    user = await prisma.user.findFirst({
      where: {
        id: currentUserId,
        isDeleted: false,
      },
      include: {
        department: true,
        supervisor: true,
        roles: {
          where: { validTo: null },
          include: { role: true },
        },
      },
    });
  }

  if (!user && currentEmail) {
    user = await prisma.user.findFirst({
      where: {
        OR: [{ email: currentEmail }, { username: currentEmail }],
        isDeleted: false,
      },
      include: {
        department: true,
        supervisor: true,
        roles: {
          where: { validTo: null },
          include: { role: true },
        },
      },
    });
  }

  if (!user) {
    return json(res, 404, { message: 'Utilisateur introuvable.' });
  }

  const updateData = {
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email, username: email } : {}),
    ...(avatar !== undefined ? { image: avatar } : {}),
    ...(jobTitle !== undefined ? { jobTitle } : {}),
    ...(phoneNumber !== undefined ? { phoneNumber } : {}),
    ...(supervisorId !== undefined ? { supervisorId } : {}),
    ...(preferredLanguage !== undefined ? { preferredLanguage: preferredLanguage === 'en' ? 'en' : 'fr' } : {}),
    ...(notifyCrm !== undefined ? { notifyCrm } : {}),
    ...(notifyProjects !== undefined ? { notifyProjects } : {}),
    ...(notifyFinance !== undefined ? { notifyFinance } : {}),
    ...(quickStatus !== undefined ? { quickStatus } : {}),
  };

  console.log('[auth:updateProfile] sanitized update payload', updateData);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    include: {
      department: true,
      supervisor: true,
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });

  // Safety: profile update must never downgrade locked admin identity.
  await ensureLockedAdminIdentity();
  const finalUser = await prisma.user.findUnique({
    where: { id: updated.id },
    include: {
      department: true,
      supervisor: true,
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });
  const primaryRole = resolvePrimaryRoleCode(finalUser?.roles || updated.roles || []);

  return json(res, 200, {
    user: buildAuthUserPayload(finalUser || updated, primaryRole),
  });
}

async function handleGetProfile(req, res, url) {
  const userId = String(url.searchParams.get('userId') || '').trim();
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  if (!userId && !email) {
    return json(res, 400, { message: 'Utilisateur introuvable.' });
  }
  const user = await prisma.user.findFirst({
    where: {
      ...(userId ? { id: userId } : {
        OR: [{ email }, { username: email }],
      }),
      isDeleted: false,
    },
    include: {
      department: true,
      supervisor: true,
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });
  if (!user) {
    return json(res, 404, { message: 'Utilisateur introuvable.' });
  }
  const primaryRole = resolvePrimaryRoleCode(user.roles);
  return json(res, 200, { user: buildAuthUserPayload(user, primaryRole) });
}

async function handleGetMyStats(req, res, url) {
  const userId = String(url.searchParams.get('userId') || '').trim();
  if (!userId) return json(res, 400, { message: 'userId is required.' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, username: true, isDeleted: true },
  });
  if (!user || user.isDeleted) {
    return json(res, 404, { message: 'Utilisateur introuvable.' });
  }

  const projectData = await listProjectsForUser(prisma, { userId, take: 300, skip: 0 });
  const doneStates = new Set(['done', 'complete', 'closed', 'finance_synced']);
  const identityTokens = [user.name, user.email, user.username, user.id]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignedItems = (projectData.workItems || []).filter((wi) =>
    identityTokens.some((token) => String(wi.assignee || '').toLowerCase().includes(token))
  );

  const tasksCompleted = assignedItems.filter((wi) => doneStates.has(String(wi.status || '').toLowerCase())).length;
  const tasksOverdue = assignedItems.filter((wi) => {
    if (!wi.plannedDate) return false;
    const planned = new Date(wi.plannedDate);
    if (Number.isNaN(planned.getTime())) return false;
    planned.setHours(0, 0, 0, 0);
    return planned < today && !doneStates.has(String(wi.status || '').toLowerCase());
  }).length;

  const activeTeamMembers = new Set(
    (projectData.projects || []).flatMap((project) => (project.members || []).map((m) => m.userId)),
  ).size;

  return json(res, 200, {
    stats: {
      projectsCount: (projectData.projects || []).length,
      assignedTasks: assignedItems.length,
      tasksCompleted,
      tasksOverdue,
      activeTeamMembers,
    },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { message: 'Invalid request.' });
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (method === 'GET' && pathname === '/health') {
      return json(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/api/system/health') {
      const health = buildSystemHealthPayload();
      return json(res, 200, { health });
    }

    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      return await handleLogin(req, res);
    }

    if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
      return await handleChangePassword(req, res);
    }

    if (method === 'PATCH' && pathname === '/api/v1/auth/profile') {
      return await handleUpdateProfile(req, res);
    }
    if (method === 'GET' && pathname === '/api/v1/auth/profile') {
      return await handleGetProfile(req, res, url);
    }
    if (method === 'GET' && pathname === '/api/v1/auth/my-stats') {
      return await handleGetMyStats(req, res, url);
    }

    if (method === 'GET' && pathname === '/api/v1/access/permission-set') {
      const permissionSet = await getUserPermissionSet(prisma, String(url.searchParams.get('userId') || '').trim());
      return json(res, 200, permissionSet);
    }

    if (method === 'GET' && pathname === '/api/v1/access/pending-approvals') {
      const data = await getPendingApprovals(prisma, String(url.searchParams.get('userId') || '').trim());
      return json(res, 200, data);
    }

    if (method === 'GET' && pathname === '/api/v1/access/stakeholders') {
      const rows = await listResourceStakeholders(prisma, {
        module: url.searchParams.get('module') || undefined,
        resourceType: url.searchParams.get('resourceType') || undefined,
        resourceId: url.searchParams.get('resourceId') || undefined,
        userId: url.searchParams.get('userId') || undefined,
        onlyActive: url.searchParams.get('onlyActive') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { stakeholders: rows });
    }

    if (method === 'POST' && pathname === '/api/v1/access/stakeholders') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const stakeholder = await upsertResourceStakeholder(prisma, body || {}, actor);
      return json(res, 201, { stakeholder });
    }

    if (method === 'GET' && pathname === '/api/v1/access/cross-department/check') {
      const allowed = await canAccessCrossDepartmentResource(prisma, {
        userId: url.searchParams.get('userId') || undefined,
        module: url.searchParams.get('module') || undefined,
        resourceType: url.searchParams.get('resourceType') || undefined,
        resourceId: url.searchParams.get('resourceId') || undefined,
      });
      return json(res, 200, { allowed });
    }

    if (method === 'GET' && pathname === '/api/v1/hrm/bootstrap') {
      await assertModuleAccess(prisma, url, 'hrm');
      const data = await getHrmBootstrap(prisma, {
        viewerUserId: url.searchParams.get('userId') || undefined,
        q: url.searchParams.get('q') || undefined,
        take: url.searchParams.get('take') || undefined,
        skip: url.searchParams.get('skip') || undefined,
      });
      return json(res, 200, data);
    }

    if (method === 'GET' && (pathname === '/api/v1/hrm/analytics' || pathname === '/api/hrm/analytics')) {
      await assertModuleAccess(prisma, url, 'hrm');
      const viewerUserId = String(url.searchParams.get('userId') || '').trim();
      const allowed = await canManageHrmAdministration(prisma, viewerUserId);
      if (!allowed) return json(res, 403, { message: 'Forbidden. HR analytics is restricted to HR/Admin.' });

      const rows = await listHrmEmployees(prisma, {
        viewerUserId,
        take: 1000,
        skip: 0,
      });
      const employees = rows.employees || [];
      const today = new Date();
      const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      const contractExpirations = employees.filter((e) => {
        if (!e.endDate) return false;
        const d = new Date(`${String(e.endDate).slice(0, 10)}T00:00:00.000Z`);
        return !Number.isNaN(d.getTime()) && d >= today && d <= in90Days;
      }).length;

      return json(res, 200, {
        totalHeadcount: employees.length,
        activeEmployees: employees.filter((e) => e.status === 'active').length,
        onboardingEmployees: employees.filter((e) => e.status === 'onboarding').length,
        contractExpirationsNext90Days: contractExpirations,
      });
    }

    if (method === 'GET' && (pathname === '/api/v1/hrm/contracts' || pathname === '/api/hrm/contracts')) {
      await assertModuleAccess(prisma, url, 'hrm');
      const viewerUserId = String(url.searchParams.get('userId') || '').trim();
      const allowed = await canManageHrmAdministration(prisma, viewerUserId);
      if (!allowed) return json(res, 403, { message: 'Forbidden. Contract details are restricted to HR/Admin.' });

      const rows = await listHrmEmployees(prisma, {
        viewerUserId,
        take: Number(url.searchParams.get('take') || 200),
        skip: Number(url.searchParams.get('skip') || 0),
      });
      const contracts = (rows.employees || []).map((employee) => ({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        departmentId: employee.departmentId,
        contractType: employee.contractType,
        contractStatus: employee.contractStatus,
        startDate: employee.startDate,
        endDate: employee.endDate || null,
      }));
      return json(res, 200, { contracts, pagination: rows.pagination || null });
    }

    if (method === 'GET' && pathname === '/api/v1/projects') {
      await assertModuleAccess(prisma, url, 'project');
      const result = await listProjectsForUser(prisma, {
        userId: url.searchParams.get('userId') || undefined,
        take: url.searchParams.get('take') || undefined,
        skip: url.searchParams.get('skip') || undefined,
      });
      return json(res, 200, result);
    }

    if (method === 'POST' && pathname === '/api/v1/projects') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const project = await createProjectForUser(prisma, {
        ...body,
        creatorUserId: actor.actorUserId || body.creatorUserId,
        creatorDisplayName: actor.actorDisplayName || body.creatorDisplayName,
      });
      return json(res, 201, { project });
    }

    const projectBulkImportMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/work-items\/bulk-telecom$/);
    if (method === 'POST' && projectBulkImportMatch) {
      const [, projectId] = projectBulkImportMatch;
      const body = await parseBody(req);
      await assertModuleAccess(prisma, url, 'project', body);
      const actor = parseActor(body);
      const result = await bulkImportTelecomWorkItems(prisma, {
        projectId,
        fileName: body.fileName,
        rows: body.rows,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, result);
    }

    if (method === 'POST' && pathname === '/api/v1/projects/repair-integrity') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await repairProjectIntegrity(prisma, {
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/projects/engineering-dashboard') {
      await assertModuleAccess(prisma, url, 'project');
      const result = await getEngineeringDashboard(prisma, {
        userId: url.searchParams.get('userId') || undefined,
      });
      return json(res, 200, result);
    }

    if (method === 'GET' && (pathname === '/api/v1/projects/notifications' || pathname === '/api/v1/notifications')) {
      const result = await listUserTeamNotifications(prisma, {
        userId: url.searchParams.get('userId') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, result);
    }

    const projectNotifyTeamMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/notify-team$/);
    if (projectNotifyTeamMatch && method === 'POST') {
      const [, projectId] = projectNotifyTeamMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await notifyTeam(prisma, {
        projectId,
        actionType: body.actionType,
        type: body.type,
        details: body.details,
        link: body.link,
        department: body.department,
        isActionable: body.isActionable,
        approval: body.approval,
        message: body.message,
        meta: body.meta,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      try {
        for (const target of result.targets || []) {
          // Global broadcaster is currently all-clients; frontend filters by targetUserId.
          // Keep payload compact for instant bell badge updates.
          const payload = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            targetUserId: target.targetUserId,
            ...target.payload,
          };
          sseBroadcast('notification_created', payload);
        }
      } catch {
        // non-blocking
      }
      return json(res, 200, result);
    }

    if (method === 'POST' && pathname === '/api/v1/notifications/action') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const notificationId = String(body.notificationId || '').trim();
      const action = String(body.action || '').trim().toLowerCase();
      const approval = body.approval && typeof body.approval === 'object' ? body.approval : null;
      const entityType = String(approval?.entityType || '').trim().toLowerCase();
      const entityId = String(approval?.entityId || '').trim();

      if (!notificationId || !action) {
        return json(res, 400, { message: 'notificationId and action are required.' });
      }

      if (!approval || !entityType || !entityId) {
        return json(res, 409, { message: 'This notification is informational and has no quick action.' });
      }

      if (entityType === 'finance_entry') {
        if (action === 'approve') {
          const result = await approveFinanceEntry(prisma, entityId, {
            actorUserId: actor.actorUserId,
            actorDisplayName: actor.actorDisplayName,
            comment: String(body.comment || 'Approved from notification quick action.'),
          });
          return json(res, 200, { ok: true, result });
        }
        if (action === 'reject') {
          const result = await rejectFinanceEntry(prisma, entityId, {
            actorUserId: actor.actorUserId,
            actorDisplayName: actor.actorDisplayName,
            reason: String(body.reason || 'Rejected from notification quick action.'),
          });
          return json(res, 200, { ok: true, result });
        }
      }

      return json(res, 501, { message: `Quick action not implemented for entityType='${entityType}'.` });
    }

    if (method === 'GET' && pathname === '/api/v1/hrm/departments') {
      await assertModuleAccess(prisma, url, 'hrm');
      const departments = await listHrmDepartments(prisma);
      return json(res, 200, { departments });
    }

    if (method === 'POST' && pathname === '/api/v1/hrm/departments') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM administration is restricted to HR/Admin.' });
      const department = await createHrmDepartment(prisma, body, actor);
      return json(res, 201, { department });
    }

    const hrmDepartmentMatch = pathname.match(/^\/api\/v1\/hrm\/departments\/([^/]+)$/);
    if (hrmDepartmentMatch && method === 'PATCH') {
      const [, departmentId] = hrmDepartmentMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM administration is restricted to HR/Admin.' });
      const department = await updateHrmDepartment(prisma, departmentId, body, actor);
      return json(res, 200, { department });
    }
    if (hrmDepartmentMatch && method === 'DELETE') {
      const [, departmentId] = hrmDepartmentMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM administration is restricted to HR/Admin.' });
      const result = await deleteHrmDepartment(prisma, departmentId, actor);
      return json(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/hrm/employees') {
      await assertModuleAccess(prisma, url, 'hrm');
      const result = await listHrmEmployees(prisma, {
        viewerUserId: url.searchParams.get('userId') || undefined,
        q: url.searchParams.get('q') || undefined,
        take: url.searchParams.get('take') || undefined,
        skip: url.searchParams.get('skip') || undefined,
      });
      return json(res, 200, result);
    }

    const hrmEmployeeDetailMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/detail$/);
    if (hrmEmployeeDetailMatch && method === 'GET') {
      const [, employeeId] = hrmEmployeeDetailMatch;
      const employee = await getHrmEmployeeDetailScoped(prisma, employeeId, {
        viewerUserId: url.searchParams.get('userId') || undefined,
      });
      if (!employee) return json(res, 404, { message: 'Employee not found or not accessible.' });
      return json(res, 200, { employee });
    }

    if (method === 'POST' && pathname === '/api/v1/hrm/employees') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM employee management is restricted to HR/Admin.' });
      const employee = await upsertHrmEmployee(prisma, body, actor);
      return json(res, 201, { employee });
    }

    if (method === 'POST' && pathname === '/api/v1/hrm/employees/bulk') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM bulk import is restricted to HR/Admin.' });
      const result = await bulkUpsertHrmEmployees(prisma, body, actor);
      return json(res, 201, result);
    }

    if (method === 'POST' && pathname === '/api/v1/hrm/access/backfill-defaults') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM access provisioning is restricted to HR/Admin.' });
      const result = await backfillDefaultAccessProvisioning(prisma, actor);
      return json(res, 200, result);
    }

    const hrmEmployeeMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)$/);
    if (hrmEmployeeMatch && method === 'PATCH') {
      const [, employeeId] = hrmEmployeeMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM employee updates are restricted to HR/Admin.' });
      const employee = await upsertHrmEmployee(prisma, { ...body, id: employeeId }, actor);
      return json(res, 200, { employee });
    }
    if (hrmEmployeeMatch && method === 'DELETE') {
      const [, employeeId] = hrmEmployeeMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM employee deletion is restricted to HR/Admin.' });
      const result = await archiveHrmEmployee(prisma, employeeId, actor);
      return json(res, 200, result);
    }
    const hrmEmployeeActivityMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/activity$/);
    if (hrmEmployeeActivityMatch && method === 'GET') {
      const [, employeeId] = hrmEmployeeActivityMatch;
      const activities = await listHrmEmployeeActivity(prisma, employeeId);
      return json(res, 200, { activities });
    }
    const hrmEmployeeCredentialsRegenerateMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/credentials\/regenerate$/);
    if (hrmEmployeeCredentialsRegenerateMatch && method === 'POST') {
      const [, employeeId] = hrmEmployeeCredentialsRegenerateMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM credential actions are restricted to HR/Admin.' });
      const credential = await regenerateHrmEmployeeCredentials(prisma, employeeId, actor);
      return json(res, 200, { credential });
    }
    const hrmEmployeeCredentialsGenerateAliasMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/credentials\/generate$/);
    if (hrmEmployeeCredentialsGenerateAliasMatch && method === 'POST') {
      const [, employeeId] = hrmEmployeeCredentialsGenerateAliasMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM credential actions are restricted to HR/Admin.' });
      const credential = await regenerateHrmEmployeeCredentials(prisma, employeeId, actor);
      return json(res, 200, { credential });
    }
    const hrmEmployeeCredentialsSentMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/credentials\/sent$/);
    if (hrmEmployeeCredentialsSentMatch && method === 'POST') {
      const [, employeeId] = hrmEmployeeCredentialsSentMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM credential actions are restricted to HR/Admin.' });
      const credential = await markHrmEmployeeCredentialsSent(prisma, employeeId, actor);
      return json(res, 200, { credential });
    }
    const hrmEmployeeCredentialsMarkSentAliasMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/credentials\/mark-sent$/);
    if (hrmEmployeeCredentialsMarkSentAliasMatch && method === 'POST') {
      const [, employeeId] = hrmEmployeeCredentialsMarkSentAliasMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const allowed = await canManageHrmAdministration(prisma, actor.actorUserId);
      if (!allowed) return json(res, 403, { message: 'HRM credential actions are restricted to HR/Admin.' });
      const credential = await markHrmEmployeeCredentialsSent(prisma, employeeId, actor);
      return json(res, 200, { credential });
    }
    const hrmEmployeeCredentialsCurrentMatch = pathname.match(/^\/api\/v1\/hrm\/employees\/([^/]+)\/credentials$/);
    if (hrmEmployeeCredentialsCurrentMatch && method === 'GET') {
      const [, employeeId] = hrmEmployeeCredentialsCurrentMatch;
      const queryUserId = String(url.searchParams.get('userId') || '').trim();
      if (queryUserId) {
        const allowed = await canManageHrmEmployee(prisma, employeeId, queryUserId);
        if (!allowed) return json(res, 403, { message: 'Access denied for this employee.' });
      }
      const credential = await getLatestHrmEmployeeCredential(prisma, employeeId);
      return json(res, 200, { credential });
    }

    if (method === 'GET' && (pathname === '/api/v1/crm/lookups' || pathname === '/api/crm/lookups')) {
      await assertModuleAccess(prisma, url, 'crm');
      const lookups = await listCrmLookups(prisma, {
        types: url.searchParams.get('types') || '',
        q: url.searchParams.get('q') || '',
      });
      return json(res, 200, lookups);
    }

    if (method === 'GET' && pathname === '/api/v1/crm/clients') {
      await assertModuleAccess(prisma, url, 'crm');
      const clients = await listClientAccounts(prisma, url.searchParams.get('q') || '', url.searchParams.get('take') || 200);
      return json(res, 200, { clients });
    }

    if (method === 'POST' && pathname === '/api/v1/crm/clients/duplicates') {
      const body = await parseBody(req);
      const duplicates = await suggestCrmClientDuplicates(prisma, body || {});
      return json(res, 200, { duplicates });
    }

    if (method === 'POST' && pathname === '/api/v1/crm/clients') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const client = await createClientAccount(prisma, body, actor);
      return json(res, 201, { client });
    }

    const crmClientPatchMatch = pathname.match(/^\/api\/v1\/crm\/clients\/([^/]+)$/);
    if (method === 'PATCH' && crmClientPatchMatch) {
      const [, clientId] = crmClientPatchMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const client = await updateClientAccount(prisma, clientId, body, actor);
      return json(res, 200, { client });
    }

    const crmClientFinancialsMatch = pathname.match(/^\/api\/v1\/crm\/clients\/([^/]+)\/financials$/);
    if (method === 'GET' && crmClientFinancialsMatch) {
      const [, clientAccountId] = crmClientFinancialsMatch;
      const snapshot = await getClientFinancialSnapshot(prisma, clientAccountId);
      return json(res, 200, snapshot);
    }

    if (method === 'GET' && pathname === '/api/v1/crm/deals') {
      await assertModuleAccess(prisma, url, 'crm');
      const deals = await listCrmDeals(prisma, {
        clientAccountId: url.searchParams.get('clientAccountId') || undefined,
        status: url.searchParams.get('status') || undefined,
        take: url.searchParams.get('take') || undefined,
        userId: url.searchParams.get('userId') || undefined,
      });
      return json(res, 200, { deals });
    }

    if (method === 'POST' && pathname === '/api/v1/crm/deals') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const deal = await createCrmDeal(prisma, body, actor);
      return json(res, 201, { deal });
    }

    const crmDealPatchMatch = pathname.match(/^\/api\/v1\/crm\/deals\/([^/]+)$/);
    if (method === 'PATCH' && crmDealPatchMatch) {
      const [, dealId] = crmDealPatchMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const deal = await updateCrmDeal(prisma, dealId, body, actor);
      return json(res, 200, { deal });
    }

    const crmDealWonMatch = pathname.match(/^\/api\/v1\/crm\/deals\/([^/]+)\/won$/);
    if (method === 'POST' && crmDealWonMatch) {
      const [, dealId] = crmDealWonMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await markDealWonAndCreateInvoiceCandidate(prisma, dealId, body, actor);
      return json(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/finance/snapshot') {
      const snapshot = await buildFinanceSnapshot(prisma);
      return json(res, 200, snapshot);
    }

    if (method === 'GET' && pathname === '/api/v1/finance/reports') {
      const reports = await getFinanceReports(prisma);
      return json(res, 200, { reports });
    }

    if (method === 'GET' && pathname === '/api/v1/dashboard/overview') {
      const overview = await getDashboardOverview(prisma);
      return json(res, 200, { overview });
    }

    if (method === 'GET' && pathname === '/api/v1/reports/intelligence') {
      const metrics = url.searchParams.getAll('metric').filter(Boolean);
      const intelligence = await getReportsIntelligence(prisma, {
        query: url.searchParams.get('query') || undefined,
        timeHorizon: url.searchParams.get('timeHorizon') || undefined,
        entityScope: url.searchParams.get('entityScope') || undefined,
        metrics: metrics.length ? metrics : undefined,
      });
      return json(res, 200, { intelligence });
    }

    if (method === 'POST' && pathname === '/api/v1/reports/intelligence/synthesize') {
      const body = await parseBody(req);
      const intelligence = await synthesizeReportsIntelligence(prisma, body || {});
      return json(res, 200, { intelligence });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/settings') {
      await assertModuleAccess(prisma, url, 'finance');
      const settings = await getFinanceGovernanceSettings(prisma);
      return json(res, 200, { settings });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/governance/rollout') {
      const result = await rolloutFinanceGovernance(prisma);
      return json(res, 200, { result });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/categories') {
      const body = await parseBody(req);
      const category = await upsertFinanceCategorySetting(prisma, body || {});
      return json(res, 201, { category });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/evidence-rules') {
      const body = await parseBody(req);
      const rule = await upsertFinanceEvidenceRule(prisma, body || {});
      return json(res, 201, { rule });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/approval-thresholds') {
      const body = await parseBody(req);
      const threshold = await upsertFinanceApprovalThreshold(prisma, body || {});
      return json(res, 201, { threshold });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/numbering-schemes') {
      const body = await parseBody(req);
      const scheme = await upsertFinanceNumberingScheme(prisma, body || {});
      return json(res, 201, { scheme });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/payment-methods') {
      const body = await parseBody(req);
      const paymentMethod = await upsertFinancePaymentMethodSetting(prisma, body || {});
      return json(res, 201, { paymentMethod });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/settings/ledger-mappings') {
      const body = await parseBody(req);
      const ledgerMapping = await upsertFinanceLedgerMapping(prisma, body || {});
      return json(res, 201, { ledgerMapping });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/entries') {
      await assertModuleAccess(prisma, url, 'finance');
      const entries = await listFinanceEntries(prisma, {
        entryType: url.searchParams.get('entryType') || undefined,
        direction: url.searchParams.get('direction') || undefined,
        lifecycleStatus: url.searchParams.get('lifecycleStatus') || undefined,
        projectId: url.searchParams.get('projectId') || undefined,
        workItemId: url.searchParams.get('workItemId') || undefined,
        take: url.searchParams.get('take') || undefined,
        userId: url.searchParams.get('userId') || undefined,
      });
      return json(res, 200, { entries });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/backfill/project-entries') {
      const result = await backfillProjectFinanceEntries(prisma);
      return json(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/finance/receivables') {
      await assertModuleAccess(prisma, url, 'finance');
      const receivables = await listReceivables(prisma, {
        status: url.searchParams.get('status') || undefined,
        collectionStatus: url.searchParams.get('collectionStatus') || undefined,
        projectId: url.searchParams.get('projectId') || undefined,
        workItemId: url.searchParams.get('workItemId') || undefined,
        take: url.searchParams.get('take') || undefined,
        userId: url.searchParams.get('userId') || undefined,
      });
      return json(res, 200, { receivables });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/payables') {
      await assertModuleAccess(prisma, url, 'finance');
      const payables = await listPayables(prisma, {
        status: url.searchParams.get('status') || undefined,
        paymentStatus: url.searchParams.get('paymentStatus') || undefined,
        projectId: url.searchParams.get('projectId') || undefined,
        workItemId: url.searchParams.get('workItemId') || undefined,
        take: url.searchParams.get('take') || undefined,
        userId: url.searchParams.get('userId') || undefined,
      });
      return json(res, 200, { payables });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/backfill/controls') {
      const result = await backfillReceivablesAndPayables(prisma);
      return json(res, 200, result);
    }

    const receivableMatch = pathname.match(/^\/api\/v1\/finance\/receivables\/([^/]+)$/);
    if (method === 'GET' && receivableMatch) {
      const [, receivableId] = receivableMatch;
      const receivable = await getReceivableDetail(prisma, receivableId);
      if (!receivable) return json(res, 404, { message: 'Receivable not found.' });
      return json(res, 200, { receivable });
    }

    const payableMatch = pathname.match(/^\/api\/v1\/finance\/payables\/([^/]+)$/);
    if (method === 'GET' && payableMatch) {
      const [, payableId] = payableMatch;
      const payable = await getPayableDetail(prisma, payableId);
      if (!payable) return json(res, 404, { message: 'Payable not found.' });
      return json(res, 200, { payable });
    }
    if (method === 'GET' && pathname === '/api/v1/finance/invoices') {
      const invoices = await listCustomerInvoices(prisma, {
        status: url.searchParams.get('status') || undefined,
        receivableId: url.searchParams.get('receivableId') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { invoices });
    }
    if (method === 'POST' && pathname === '/api/v1/finance/invoices') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const invoice = await createCustomerInvoice(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { invoice });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/bills') {
      const bills = await listVendorBills(prisma, {
        status: url.searchParams.get('status') || undefined,
        payableId: url.searchParams.get('payableId') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { bills });
    }
    if (method === 'POST' && pathname === '/api/v1/finance/bills') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const bill = await createVendorBill(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { bill });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/payments') {
      const payments = await listPaymentDisbursements(prisma, {
        status: url.searchParams.get('status') || undefined,
        payableId: url.searchParams.get('payableId') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { payments });
    }
    if (method === 'POST' && pathname === '/api/v1/finance/payments') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await createPaymentDisbursement(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, result);
    }

    if (method === 'GET' && pathname === '/api/v1/finance/receipts') {
      const receipts = await listReceiptCollections(prisma, {
        status: url.searchParams.get('status') || undefined,
        receivableId: url.searchParams.get('receivableId') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { receipts });
    }
    if (method === 'POST' && pathname === '/api/v1/finance/receipts') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await createReceiptCollection(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, result);
    }

    if (method === 'POST' && pathname === '/api/v1/finance/backfill/documents') {
      const result = await backfillInvoicesAndBills(prisma);
      return json(res, 200, result);
    }

    if (method === 'POST' && pathname === '/api/v1/finance/scm/po-commitment') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const entry = await syncScmPoCommitment(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { entry });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/scm/vendor-bills') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await createScmVendorBill(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, result);
    }

    const scmPoFinanceStatusMatch = pathname.match(/^\/api\/v1\/finance\/scm\/po\/([^/]+)\/status$/);
    if (method === 'GET' && scmPoFinanceStatusMatch) {
      const [, poId] = scmPoFinanceStatusMatch;
      const status = await getScmPoFinanceStatus(prisma, poId);
      return json(res, 200, status);
    }

    if (method === 'POST' && pathname === '/api/v1/finance/scm/requisition-commitment') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const entry = await syncScmRequisitionCommitment(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { entry });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/payroll-schedules') {
      const schedules = await listPayrollSchedules(prisma);
      return json(res, 200, { schedules });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/salary-profiles') {
      const profiles = await listEmployeeSalaryProfiles(prisma, {
        userId: url.searchParams.get('userId') || undefined,
        isActive: url.searchParams.get('isActive') === null ? undefined : url.searchParams.get('isActive') === 'true',
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { profiles });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/salary-profiles') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const profile = await upsertEmployeeSalaryProfile(prisma, body || {}, actor);
      return json(res, 201, { profile });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/payroll-schedules') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const schedule = await upsertPayrollSchedule(prisma, body || {}, actor);
      return json(res, 201, { schedule });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/payroll-runs') {
      const runs = await listPayrollRuns(prisma, {
        status: url.searchParams.get('status') || undefined,
        postingStatus: url.searchParams.get('postingStatus') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { runs });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/payroll-runs/execute') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const run = await executePayrollRun(prisma, body || {}, actor);
      return json(res, 201, { run });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/payroll-runs/run-due') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const runs = await runDuePayrollSchedules(prisma, actor);
      return json(res, 200, { runs });
    }

    const payrollRunDetailMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-runs\/([^/]+)$/);
    if (method === 'GET' && payrollRunDetailMatch) {
      const [, payrollRunId] = payrollRunDetailMatch;
      const run = await getPayrollRunDetail(prisma, payrollRunId);
      if (!run) return json(res, 404, { message: 'Payroll run not found.' });
      return json(res, 200, { run });
    }

    const payrollRunPostMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-runs\/([^/]+)\/post$/);
    if (method === 'POST' && payrollRunPostMatch) {
      const [, payrollRunId] = payrollRunPostMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await postPayrollRun(prisma, payrollRunId, body || {}, actor);
      return json(res, 200, result);
    }

    const payrollRunAdjustMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-runs\/employees\/([^/]+)\/adjust$/);
    if (method === 'PATCH' && payrollRunAdjustMatch) {
      const [, payrollRunEmployeeId] = payrollRunAdjustMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const employeeLine = await adjustPayrollRunEmployee(prisma, payrollRunEmployeeId, body || {}, actor);
      return json(res, 200, { employeeLine });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/payroll-batches') {
      const batches = await listPayrollBatches(prisma, {
        status: url.searchParams.get('status') || undefined,
        approvalStatus: url.searchParams.get('approvalStatus') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { batches });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/payroll-batches') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const batch = await createPayrollBatch(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { batch });
    }

    const payrollBatchMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-batches\/([^/]+)$/);
    if (method === 'GET' && payrollBatchMatch) {
      const [, payrollBatchId] = payrollBatchMatch;
      const batch = await getPayrollBatchDetail(prisma, payrollBatchId);
      if (!batch) return json(res, 404, { message: 'Payroll batch not found.' });
      return json(res, 200, { batch });
    }

    const payrollBatchApproveMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-batches\/([^/]+)\/approve$/);
    if (method === 'POST' && payrollBatchApproveMatch) {
      const [, payrollBatchId] = payrollBatchApproveMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const batch = await approvePayrollBatch(prisma, payrollBatchId, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, { batch });
    }

    const payrollBatchReconcileMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-batches\/([^/]+)\/reconcile$/);
    if (method === 'POST' && payrollBatchReconcileMatch) {
      const [, payrollBatchId] = payrollBatchReconcileMatch;
      const body = await parseBody(req);
      const batch = await reconcilePayrollBatch(prisma, payrollBatchId, body || {});
      return json(res, 200, { batch });
    }

    const payrollLineDisburseMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/payroll-lines\/([^/]+)\/disburse$/);
    if (method === 'POST' && payrollLineDisburseMatch) {
      const [, payrollLineId] = payrollLineDisburseMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const result = await disbursePayrollLine(prisma, payrollLineId, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, result);
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/expense-claims') {
      const claims = await listExpenseClaims(prisma, {
        status: url.searchParams.get('status') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { claims });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/expense-claims') {
      const body = await parseBody(req);
      const claim = await createExpenseClaim(prisma, body || {});
      return json(res, 201, { claim });
    }

    const expenseClaimApproveMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/expense-claims\/([^/]+)\/approve$/);
    if (method === 'POST' && expenseClaimApproveMatch) {
      const [, claimId] = expenseClaimApproveMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const claim = await approveExpenseClaim(prisma, claimId, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, { claim });
    }

    if (method === 'GET' && pathname === '/api/v1/finance/hrm/employee-advances') {
      const advances = await listEmployeeAdvances(prisma, {
        status: url.searchParams.get('status') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { advances });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/hrm/employee-advances') {
      const body = await parseBody(req);
      const advance = await createEmployeeAdvance(prisma, body || {});
      return json(res, 201, { advance });
    }

    const employeeAdvanceApproveMatch = pathname.match(/^\/api\/v1\/finance\/hrm\/employee-advances\/([^/]+)\/approve$/);
    if (method === 'POST' && employeeAdvanceApproveMatch) {
      const [, advanceId] = employeeAdvanceApproveMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const advance = await approveEmployeeAdvance(prisma, advanceId, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, { advance });
    }
    if (method === 'GET' && pathname === '/api/v1/finance/reconciliations') {
      const reconciliations = await listFinanceReconciliations(prisma, {
        status: url.searchParams.get('status') || undefined,
        take: url.searchParams.get('take') || undefined,
      });
      return json(res, 200, { reconciliations });
    }

    if (method === 'POST' && pathname === '/api/v1/finance/reconciliations/run') {
      const body = await parseBody(req);
      const actor = parseActor(body);
      const reconciliation = await runFinanceReconciliation(prisma, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { reconciliation });
    }

    const reconciliationMatch = pathname.match(/^\/api\/v1\/finance\/reconciliations\/([^/]+)$/);
    if (method === 'GET' && reconciliationMatch) {
      const [, reconciliationId] = reconciliationMatch;
      const reconciliation = await getFinanceReconciliationDetail(prisma, reconciliationId);
      if (!reconciliation) return json(res, 404, { message: 'Reconciliation not found.' });
      return json(res, 200, { reconciliation });
    }

    const reconciliationReceiptsMatch = pathname.match(/^\/api\/v1\/finance\/reconciliations\/([^/]+)\/unmatched-receipts$/);
    if (method === 'GET' && reconciliationReceiptsMatch) {
      const [, reconciliationId] = reconciliationReceiptsMatch;
      const lines = await listReconciliationUnmatchedReceipts(prisma, reconciliationId);
      return json(res, 200, { lines });
    }

    const reconciliationPaymentsMatch = pathname.match(/^\/api\/v1\/finance\/reconciliations\/([^/]+)\/unmatched-payments$/);
    if (method === 'GET' && reconciliationPaymentsMatch) {
      const [, reconciliationId] = reconciliationPaymentsMatch;
      const lines = await listReconciliationUnmatchedPayments(prisma, reconciliationId);
      return json(res, 200, { lines });
    }

    const reconciliationCasesMatch = pathname.match(/^\/api\/v1\/finance\/reconciliations\/([^/]+)\/discrepancies$/);
    if (method === 'GET' && reconciliationCasesMatch) {
      const [, reconciliationId] = reconciliationCasesMatch;
      const cases = await listReconciliationDiscrepancyCases(prisma, reconciliationId, {
        status: url.searchParams.get('status') || undefined,
      });
      return json(res, 200, { cases });
    }

    const discrepancyResolveMatch = pathname.match(/^\/api\/v1\/finance\/discrepancies\/([^/]+)$/);
    if (method === 'PATCH' && discrepancyResolveMatch) {
      const [, caseId] = discrepancyResolveMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const discrepancy = await resolveDiscrepancyCase(prisma, caseId, {
        ...body,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 200, { discrepancy });
    }
    const financeEntryMatch = pathname.match(/^\/api\/v1\/finance\/entries\/([^/]+)$/);
    if (method === 'GET' && financeEntryMatch) {
      const [, financeEntryId] = financeEntryMatch;
      const entry = await getFinanceEntryDetail(prisma, financeEntryId);
      if (!entry) return json(res, 404, { message: 'Finance entry not found.' });
      return json(res, 200, { entry });
    }

    const financeEntryActivityMatch = pathname.match(/^\/api\/v1\/finance\/entries\/([^/]+)\/activity$/);
    if (method === 'GET' && financeEntryActivityMatch) {
      const [, financeEntryId] = financeEntryActivityMatch;
      const activities = await listFinanceEntryActivity(prisma, financeEntryId);
      return json(res, 200, { activities });
    }

    const financeEntryEvidenceMatch = pathname.match(/^\/api\/v1\/finance\/entries\/([^/]+)\/evidence$/);
    if (method === 'GET' && financeEntryEvidenceMatch) {
      const [, financeEntryId] = financeEntryEvidenceMatch;
      const evidence = await listFinanceEntryEvidence(prisma, financeEntryId);
      return json(res, 200, { evidence });
    }
    if (method === 'POST' && financeEntryEvidenceMatch) {
      const [, financeEntryId] = financeEntryEvidenceMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const evidence = await uploadFinanceEvidence(prisma, {
        financeEntryId,
        originalFileName: body.originalFileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        documentType: body.documentType,
        notes: body.notes,
        contentBase64: body.contentBase64,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { evidence });
    }

    const financeApproveMatch = pathname.match(/^\/api\/v1\/finance\/entries\/([^/]+)\/approve$/);
    if (method === 'PATCH' && financeApproveMatch) {
      const [, financeEntryId] = financeApproveMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const entry = await approveFinanceEntry(prisma, financeEntryId, {
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
        notes: body.notes,
      });
      return json(res, 200, { entry });
    }

    const financeRejectMatch = pathname.match(/^\/api\/v1\/finance\/entries\/([^/]+)\/reject$/);
    if (method === 'PATCH' && financeRejectMatch) {
      const [, financeEntryId] = financeRejectMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const entry = await rejectFinanceEntry(prisma, financeEntryId, {
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
        notes: body.notes,
      });
      return json(res, 200, { entry });
    }

    const financeEvidenceDownloadMatch = pathname.match(/^\/api\/v1\/finance\/evidence\/([^/]+)\/download$/);
    if (method === 'GET' && financeEvidenceDownloadMatch) {
      const [, evidenceId] = financeEvidenceDownloadMatch;
      const evidence = await prisma.financeEvidenceDocument.findUnique({ where: { id: evidenceId } });
      if (!evidence || evidence.deletedAt) {
        return json(res, 404, { message: 'Finance evidence not found.' });
      }
      const absolutePath = resolveAbsoluteFinanceStoredPath(evidence.storagePath);
      if (!fs.existsSync(absolutePath)) {
        return json(res, 404, { message: 'Stored finance evidence not found.' });
      }
      res.writeHead(200, {
        'Content-Type': evidence.mimeType || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + evidence.originalFileName + '"',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      });
      fs.createReadStream(absolutePath).pipe(res);
      return;
    }

    const detailMatch = pathname.match(/^\/api\/v1\/pm\/projects\/([^/]+)\/work-items\/([^/]+)\/details$/);
    if (method === 'PATCH' && detailMatch) {
      const [, projectId, workItemId] = detailMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const saved = await saveProjectItemDetails(prisma, {
        projectId,
        workItemId,
        poUnitPrice: body.poUnitPrice,
        ticketNumber: body.ticketNumber,
        contractorPayableAmount: body.contractorPayableAmount,
        qaStatus: body.qaStatus,
        acceptanceStatus: body.acceptanceStatus,
        importedFields: body.importedFields,
        operationalManualFields: body.operationalManualFields,
        acceptanceManualFields: body.acceptanceManualFields,
        ...actor,
      });
      return json(res, 200, { state: saved });
    }

    const activitiesMatch = pathname.match(/^\/api\/v1\/pm\/projects\/([^/]+)\/work-items\/([^/]+)\/activities$/);
    if (method === 'GET' && activitiesMatch) {
      const [, projectId, workItemId] = activitiesMatch;
      const activities = await listProjectItemActivities(prisma, projectId, workItemId);
      return json(res, 200, { activities });
    }

    const filesCollectionMatch = pathname.match(/^\/api\/v1\/pm\/projects\/([^/]+)\/work-items\/([^/]+)\/files$/);
    if (method === 'GET' && filesCollectionMatch) {
      const [, projectId, workItemId] = filesCollectionMatch;
      const files = await listProjectItemFiles(prisma, projectId, workItemId);
      return json(res, 200, { files });
    }
    if (method === 'POST' && filesCollectionMatch) {
      const [, projectId, workItemId] = filesCollectionMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const file = await uploadProjectItemFile(prisma, {
        projectId,
        workItemId,
        originalFileName: body.originalFileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        category: body.category,
        contentBase64: body.contentBase64,
        actorUserId: actor.actorUserId,
        actorDisplayName: actor.actorDisplayName,
      });
      return json(res, 201, { file });
    }

    const fileDeleteMatch = pathname.match(/^\/api\/v1\/pm\/files\/([^/]+)$/);
    if (method === 'DELETE' && fileDeleteMatch) {
      const [, fileId] = fileDeleteMatch;
      const body = await parseBody(req);
      const actor = parseActor(body);
      const out = await deleteProjectItemFile(prisma, fileId, {
        id: actor.actorUserId,
        name: actor.actorDisplayName,
      });
      return json(res, 200, out);
    }

    const fileDownloadMatch = pathname.match(/^\/api\/v1\/pm\/files\/([^/]+)\/download$/);
    if (method === 'GET' && fileDownloadMatch) {
      const [, fileId] = fileDownloadMatch;
      const file = await prisma.projectItemFile.findUnique({ where: { id: fileId } });
      if (!file || file.deletedAt) {
        return json(res, 404, { message: 'File not found.' });
      }
      const absolutePath = resolveAbsoluteStoredPath(file.storagePath);
      if (!fs.existsSync(absolutePath)) {
        return json(res, 404, { message: 'Stored file not found.' });
      }
      res.writeHead(200, {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + file.originalFileName + '"',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      });
      fs.createReadStream(absolutePath).pipe(res);
      return;
    }

    // ── SSE real-time event stream ──────────────────────────────────
    if (method === 'GET' && pathname === '/api/v1/events/stream') {
      const userId = String(url.searchParams.get('userId') || '').trim();
      if (!userId) return json(res, 400, { message: 'userId query parameter is required.' });
      sseRegisterClient(userId, res, ALLOWED_ORIGIN);
      return; // response stays open — SSE
    }

    return json(res, 404, { message: 'Route not found.', method, pathname });
  } catch (error) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    return json(res, status, { message: error instanceof Error ? error.message : 'Internal server error.' });
  }
});

void ensureLockedAdminIdentity().catch((error) => {
  console.error('Failed to enforce locked admin identity:', error);
});

server.listen(PORT, () => {
  console.log(`Auth API listening on http://localhost:${PORT}`);
});

























