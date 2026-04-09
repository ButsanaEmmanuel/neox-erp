import crypto from 'node:crypto';
import { broadcast as sseBroadcast } from '../realtime/sseBroadcaster.mjs';

function decimalToNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(typeof value === 'object' && value !== null && typeof value.toString === 'function' ? value.toString() : value);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deriveTelecomStatusFromState(baseStatus, stateLike = {}, rowLike = {}) {
  const ticket = decimalToNumber(stateLike.ticketNumber);
  const qaStatus = String(stateLike.qaStatus || rowLike.qaStatus || '').toLowerCase();
  const acceptanceStatus = String(stateLike.acceptanceStatus || rowLike.acceptanceStatus || '').toLowerCase();
  const financeSyncStatus = String(stateLike.financeSyncStatus || rowLike.financeSyncStatus || '').toLowerCase();
  const isEligible = Boolean(
    stateLike.isFinanciallyEligible !== undefined
      ? stateLike.isFinanciallyEligible
      : rowLike.isFinanciallyEligible,
  );

  if (ticket === null || ticket <= 0) return 'needs_manual_completion';
  if (qaStatus !== 'approved') return 'awaiting_qa_approval';
  if (acceptanceStatus !== 'signed') return 'awaiting_signed_acceptance';
  if (financeSyncStatus === 'synced' || isEligible) return 'finance_synced';
  return 'finance_pending';
}

function computeKpis(workItems = []) {
  const doneStates = new Set(['done', 'complete', 'finance_synced']);
  const qaStates = new Set(['pending-qa', 'awaiting_qa_approval']);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalWorkItems = workItems.length;
  const completed = workItems.filter((wi) => doneStates.has(String(wi.status || '').toLowerCase())).length;
  const pendingQA = workItems.filter((wi) => qaStates.has(String(wi.status || '').toLowerCase())).length;
  const pendingAcceptance = workItems.filter((wi) => String(wi.status || '').toLowerCase() === 'awaiting_signed_acceptance').length;
  const overdue = workItems.filter((wi) => {
    if (!wi.plannedDate) return false;
    const planned = new Date(wi.plannedDate);
    if (Number.isNaN(planned.getTime())) return false;
    planned.setHours(0, 0, 0, 0);
    return planned < today && !doneStates.has(String(wi.status || '').toLowerCase());
  }).length;

  return {
    totalWorkItems,
    completed,
    pendingQA,
    pendingAcceptance,
    overdue,
    progress: totalWorkItems > 0 ? Math.round((completed / totalWorkItems) * 100) : 0,
  };
}

function mapWorkItem(row, state) {
  const effectiveQaStatus = state?.qaStatus ?? row.qaStatus;
  const effectiveAcceptanceStatus = state?.acceptanceStatus ?? row.acceptanceStatus;
  const effectiveTicketNumber = state?.ticketNumber ?? row.ticketNumber;
  const effectivePoUnitPrice = state?.poUnitPrice ?? row.poUnitPrice;
  const effectivePoUnitPriceCompleted = state?.poUnitPriceCompleted ?? row.poUnitPriceCompleted;
  const effectiveContractorPayableAmount = state?.contractorPayableAmount ?? row.contractorPayableAmount;
  const effectiveFinanceSyncStatus = state?.financeSyncStatus ?? row.financeSyncStatus;
  const effectiveFinanceSyncAt = state?.financeSyncAt ?? row.financeSyncAt;
  const effectiveFinanceReferenceId = state?.financeReferenceId ?? row.financeReferenceId;
  const effectiveFinanceErrorMessage = state?.financeErrorMessage ?? row.financeErrorMessage;
  const effectiveOperationalFields = state?.operationalManualFieldsJson ?? row.operationalManualFieldsJson;
  const effectiveAcceptanceFields = state?.acceptanceManualFieldsJson ?? row.acceptanceManualFieldsJson;
  const effectiveEligibility =
    state?.isFinanciallyEligible !== undefined
      ? state.isFinanciallyEligible
      : row.isFinanciallyEligible;

  const telecomCandidate = Boolean(row.importBatchId || row.type === 'site' || state);
  const effectiveStatus = telecomCandidate
    ? deriveTelecomStatusFromState(row.status, {
      ticketNumber: effectiveTicketNumber,
      qaStatus: effectiveQaStatus,
      acceptanceStatus: effectiveAcceptanceStatus,
      financeSyncStatus: effectiveFinanceSyncStatus,
      isFinanciallyEligible: effectiveEligibility,
    }, row)
    : row.status;

  return {
    id: row.id,
    projectId: row.projectId,
    import_batch_id: row.importBatchId || undefined,
    title: row.title,
    type: row.type,
    status: effectiveStatus,
    priority: row.priority,
    assignee: row.assignee || undefined,
    plannedDate: toIsoDate(row.plannedDate),
    actualDate: toIsoDate(row.actualDate),
    qaStatus: effectiveQaStatus || undefined,
    qaDate: toIsoDate(row.qaDate),
    acceptanceStatus: effectiveAcceptanceStatus || undefined,
    acceptanceDate: toIsoDate(row.acceptanceDate),
    manual_completion_status: row.manualCompletionStatus || undefined,
    finance_sync_status: effectiveFinanceSyncStatus || undefined,
    finance_sync_at: toIsoDate(effectiveFinanceSyncAt),
    finance_reference_id: effectiveFinanceReferenceId || undefined,
    finance_error_message: effectiveFinanceErrorMessage || undefined,
    is_financially_eligible: Boolean(effectiveEligibility),
    financial_eligibility_reason: row.financialEligibilityReason || undefined,
    po_unit_price: decimalToNumber(effectivePoUnitPrice) ?? undefined,
    ticket_number: decimalToNumber(effectiveTicketNumber) ?? undefined,
    po_unit_price_completed: decimalToNumber(effectivePoUnitPriceCompleted) ?? undefined,
    contractor_payable_amount: decimalToNumber(effectiveContractorPayableAmount) ?? undefined,
    imported_fields: row.importedFieldsJson || undefined,
    operational_manual_fields: effectiveOperationalFields || undefined,
    acceptance_manual_fields: effectiveAcceptanceFields || undefined,
    description: row.description || undefined,
  };
}

function mapProject(row, stateByWorkItemId = new Map()) {
  const workItems = (row.workItems || []).map((item) => mapWorkItem(item, stateByWorkItemId.get(item.id)));
  const kpis = computeKpis(workItems);
  return {
    id: row.id,
    name: row.name,
    client: row.clientName,
    clientId: row.clientAccountId || '',
    clientName: row.clientAccount?.name || row.clientName || '',
    managerId: row.managerId,
    managerName: row.manager?.name || row.manager?.email || '',
    manager: row.manager?.name || row.manager?.email || '',
    status: row.status,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    projectMode: row.projectMode || 'standard',
    isTelecomProject: Boolean(row.isTelecomProject),
    bulkImportRequired: Boolean(row.bulkImportRequired),
    purchase_order: row.purchaseOrder || undefined,
    poNumber: row.purchaseOrder || '',
    currency: 'USD',
    costHT: 0,
    vatRate: 0,
    vatAmount: 0,
    costTTC: 0,
    description: row.description || '',
    kpis,
    members: (row.members || []).map((m) => ({
      id: m.id,
      userId: m.userId,
      roleCode: m.roleCode,
      userName: m.user?.name || m.user?.email || 'Unknown',
      departmentId: m.departmentId,
    })),
    workItems,
  };
}

async function resolveFallbackDepartmentId(prisma, preferredDepartmentId, fallbackUserIds = []) {
  const preferred = String(preferredDepartmentId || '').trim();
  if (preferred) return preferred;

  const candidateUserIds = (fallbackUserIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (candidateUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: candidateUserIds }, isDeleted: false },
      select: { departmentId: true },
    });
    const departmentFromUsers = users.map((u) => String(u.departmentId || '').trim()).find(Boolean);
    if (departmentFromUsers) return departmentFromUsers;
  }

  const defaultDepartment = await prisma.department.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true },
  });
  return defaultDepartment?.id || null;
}

async function resolveOmniAdmin(prisma, user) {
  const roleCodes = (user?.roles || []).map((row) => String(row?.role?.code || '').toUpperCase());
  if (roleCodes.includes('ADMIN')) return true;
  if (!user?.id) return false;
  const explicitBypass = await prisma.userPermissionSet.findFirst({
    where: {
      userId: user.id,
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

async function resolveIdentityUserIds(prisma, userId) {
  const primaryUserId = String(userId || '').trim();
  if (!primaryUserId) return { primaryUser: null, identityUserIds: [] };

  const primaryUser = await prisma.user.findFirst({
    where: { id: primaryUserId, isDeleted: false, isActive: true },
    select: { id: true, email: true, name: true },
  });
  if (!primaryUser) return { primaryUser: null, identityUserIds: [] };

  const ids = [primaryUser.id];
  const email = String(primaryUser.email || '').trim().toLowerCase();
  if (email) {
    const aliases = await prisma.user.findMany({
      where: { email, isDeleted: false, isActive: true },
      select: { id: true },
    });
    for (const alias of aliases) {
      const id = String(alias.id || '').trim();
      if (id && !ids.includes(id)) ids.push(id);
    }
  }

  return { primaryUser, identityUserIds: ids };
}

export async function listProjectsForUser(prisma, input = {}) {
  const userId = String(input.userId || '').trim();
  if (!userId) {
    return { projects: [], workItems: [] };
  }
  const take = Math.max(1, Math.min(200, Number(input.take || 100)));
  const skip = Math.max(0, Number(input.skip || 0));

  const { primaryUser, identityUserIds } = await resolveIdentityUserIds(prisma, userId);
  if (!primaryUser || identityUserIds.length === 0) {
    return { projects: [], workItems: [] };
  }

  const user = await prisma.user.findFirst({
    where: { id: primaryUser.id, isDeleted: false, isActive: true },
    include: {
      department: {
        select: { code: true, name: true },
      },
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });
  const roleCodes = (user?.roles || []).map((row) => String(row?.role?.code || '').toUpperCase());
  const isAdmin = await resolveOmniAdmin(prisma, user);
  const inEngineeringDepartment =
    String(user?.department?.code || '').toLowerCase().includes('eng')
    || String(user?.department?.name || '').toLowerCase().includes('engineering');
  const isProjectManagerTitle = String(user?.jobTitle || '').toLowerCase().includes('project manager');
  const hasStructuralProjectAccess = isAdmin || inEngineeringDepartment || isProjectManagerTitle || roleCodes.includes('PROJECT_MANAGER');
  const isSales = roleCodes.includes('SALES') || roleCodes.includes('SALES_ACCOUNT_MANAGER');

  let salesClientAccountIds = [];
  if (isSales) {
    const ownedClients = await prisma.clientAccount.findMany({
      where: { ownerUserId: { in: identityUserIds }, isDeleted: false },
      select: { id: true },
    });
    const dealClients = await prisma.crmDeal.findMany({
      where: { ownerUserId: { in: identityUserIds }, isDeleted: false, clientAccountId: { not: null } },
      select: { clientAccountId: true },
    });
    salesClientAccountIds = [
      ...new Set([
        ...ownedClients.map((row) => row.id),
        ...dealClients.map((row) => row.clientAccountId).filter(Boolean),
      ]),
    ];
  }

  const where = hasStructuralProjectAccess
    ? { isDeleted: false }
    : {
        isDeleted: false,
        OR: [
          {
            members: {
              some: {
                userId: { in: identityUserIds },
                isDeleted: false,
              },
            },
          },
          {
            managerId: { in: identityUserIds },
          },
          ...(primaryUser.email
            ? [
                {
                  manager: {
                    email: primaryUser.email,
                    isDeleted: false,
                    isActive: true,
                  },
                },
              ]
            : []),
          ...(salesClientAccountIds.length
            ? [{ clientAccountId: { in: salesClientAccountIds } }]
            : []),
        ],
      };

  const rows = await prisma.project.findMany({
    where,
    include: {
      manager: {
        select: { id: true, name: true, email: true },
      },
      clientAccount: {
        select: { id: true, name: true },
      },
      members: {
        where: { isDeleted: false },
        include: {
          user: {
            select: { id: true, name: true, email: true, isActive: true },
          },
        },
      },
      workItems: {
        where: { isDeleted: false },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    skip,
    take,
  });

  const projectIds = rows.map((row) => row.id);
  const workItemIds = rows.flatMap((row) => (row.workItems || []).map((item) => item.id));
  const stateRows = workItemIds.length > 0
    ? await prisma.projectItemState.findMany({
      where: {
        projectId: { in: projectIds },
        workItemId: { in: workItemIds },
      },
    })
    : [];
  const stateByWorkItemId = new Map(stateRows.map((state) => [state.workItemId, state]));

  const staleSyncOps = [];
  for (const row of rows) {
    for (const item of row.workItems || []) {
      const state = stateByWorkItemId.get(item.id);
      if (!state) continue;
      const nextStatus = deriveTelecomStatusFromState(item.status, state, item);
      const needsSync =
        String(item.status || '') !== String(nextStatus || '')
        || String(item.qaStatus || '') !== String(state.qaStatus || '')
        || String(item.acceptanceStatus || '') !== String(state.acceptanceStatus || '')
        || String(item.financeSyncStatus || '') !== String(state.financeSyncStatus || '')
        || decimalToNumber(item.ticketNumber) !== decimalToNumber(state.ticketNumber)
        || decimalToNumber(item.poUnitPriceCompleted) !== decimalToNumber(state.poUnitPriceCompleted)
        || decimalToNumber(item.contractorPayableAmount) !== decimalToNumber(state.contractorPayableAmount);
      if (!needsSync) continue;
      staleSyncOps.push(
        prisma.workItem.update({
          where: { id: item.id },
          data: {
            status: nextStatus,
            qaStatus: state.qaStatus,
            acceptanceStatus: state.acceptanceStatus,
            ticketNumber: state.ticketNumber,
            poUnitPriceCompleted: state.poUnitPriceCompleted,
            contractorPayableAmount: state.contractorPayableAmount,
            financeSyncStatus: state.financeSyncStatus,
            financeSyncAt: state.financeSyncAt,
            financeReferenceId: state.financeReferenceId,
            financeErrorMessage: state.financeErrorMessage,
            isFinanciallyEligible: state.isFinanciallyEligible,
            financialEligibilityReason: state.financialEligibilityReason,
            operationalManualFieldsJson: state.operationalManualFieldsJson,
            acceptanceManualFieldsJson: state.acceptanceManualFieldsJson,
          },
        }),
      );
    }
  }
  if (staleSyncOps.length > 0) {
    await Promise.all(staleSyncOps.slice(0, 200));
  }

  const projects = rows.map((row) => mapProject(row, stateByWorkItemId));
  const workItems = projects.flatMap((project) => project.workItems || []);
  return { projects, workItems };
}

export async function getEngineeringDashboard(prisma, input = {}) {
  const userId = String(input.userId || '').trim();
  if (!userId) {
    return {
      projectCount: 0,
      progression: 0,
      assignedTasks: 0,
      activeMembers: 0,
    };
  }

  const { primaryUser, identityUserIds } = await resolveIdentityUserIds(prisma, userId);
  if (!primaryUser || identityUserIds.length === 0) {
    return {
      projectCount: 0,
      progression: 0,
      assignedTasks: 0,
      activeMembers: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: primaryUser.id },
    include: {
      department: {
        select: { code: true, name: true },
      },
      roles: {
        where: { validTo: null },
        include: { role: true },
      },
    },
  });
  if (!user) {
    return {
      projectCount: 0,
      progression: 0,
      assignedTasks: 0,
      activeMembers: 0,
    };
  }

  const roleCodes = (user?.roles || []).map((row) => String(row?.role?.code || '').toUpperCase());
  const isAdmin = await resolveOmniAdmin(prisma, user);
  const inEngineeringDepartment =
    String(user?.department?.code || '').toLowerCase().includes('eng')
    || String(user?.department?.name || '').toLowerCase().includes('engineering');
  const isProjectManagerTitle = String(user?.jobTitle || '').toLowerCase().includes('project manager');
  const hasStructuralProjectAccess = isAdmin || inEngineeringDepartment || isProjectManagerTitle || roleCodes.includes('PROJECT_MANAGER');

  const ownedAndMemberProjects = await prisma.project.findMany({
    where: hasStructuralProjectAccess
      ? { isDeleted: false }
      : {
          isDeleted: false,
          OR: [
            { managerId: { in: identityUserIds } },
            {
              members: {
                some: {
                  userId: { in: identityUserIds },
                  isDeleted: false,
                },
              },
            },
            ...(primaryUser.email
              ? [
                  {
                    manager: {
                      email: primaryUser.email,
                      isDeleted: false,
                      isActive: true,
                    },
                  },
                ]
              : []),
          ],
        },
    select: { id: true },
  });
  const projectIds = [...new Set(ownedAndMemberProjects.map((p) => p.id))];

  if (projectIds.length === 0) {
    return {
      projectCount: 0,
      progression: 0,
      assignedTasks: 0,
      activeMembers: 0,
    };
  }

  const [workItems, members] = await Promise.all([
    prisma.workItem.findMany({
      where: { projectId: { in: projectIds }, isDeleted: false },
      select: { id: true, projectId: true, status: true, assignee: true, type: true, importBatchId: true, qaStatus: true, acceptanceStatus: true, ticketNumber: true, financeSyncStatus: true, isFinanciallyEligible: true },
    }),
    prisma.projectMember.findMany({
      where: {
        projectId: { in: projectIds },
        isDeleted: false,
        user: {
          isDeleted: false,
          isActive: true,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const workItemStates = workItems.length > 0
    ? await prisma.projectItemState.findMany({
      where: {
        projectId: { in: projectIds },
        workItemId: { in: workItems.map((wi) => wi.id) },
      },
      select: {
        projectId: true,
        workItemId: true,
        qaStatus: true,
        acceptanceStatus: true,
        ticketNumber: true,
        financeSyncStatus: true,
        isFinanciallyEligible: true,
      },
    })
    : [];
  const stateByWorkItemId = new Map(workItemStates.map((state) => [state.workItemId, state]));

  const completedSet = new Set(['done', 'complete', 'finance_synced']);
  const completed = workItems.filter((wi) => {
    const state = stateByWorkItemId.get(wi.id);
    const telecomCandidate = Boolean(wi.importBatchId || wi.type === 'site' || state);
    const effectiveStatus = telecomCandidate
      ? deriveTelecomStatusFromState(wi.status, state || {}, wi)
      : wi.status;
    return completedSet.has(String(effectiveStatus || '').toLowerCase());
  }).length;
  const progression = workItems.length > 0 ? Math.round((completed / workItems.length) * 100) : 0;
  const assignedTasks = isAdmin
    ? workItems.filter((wi) => String(wi.assignee || '').trim().length > 0).length
    : (() => {
        const nameCandidates = [user.name || '', user.email || '', user.id].map((v) => String(v).trim().toLowerCase()).filter(Boolean);
        return workItems.filter((wi) => nameCandidates.some((token) => String(wi.assignee || '').toLowerCase().includes(token))).length;
      })();

  return {
    projectCount: projectIds.length,
    progression,
    assignedTasks,
    activeMembers: members.length,
  };
}

export async function notifyTeam(prisma, input = {}) {
  const projectId = String(input.projectId || '').trim();
  const actionType = String(input.actionType || '').trim() || 'project_updated';
  if (!projectId) {
    throw new Error('projectId is required.');
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true, name: true, managerId: true },
  });
  if (!project) throw new Error('Project not found.');

  const members = await prisma.projectMember.findMany({
    where: { projectId, isDeleted: false, user: { isDeleted: false, isActive: true } },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  const manager = project.managerId
    ? await prisma.user.findFirst({
        where: { id: project.managerId, isDeleted: false, isActive: true },
        select: { id: true, email: true, name: true },
      })
    : null;

  const recipientsById = new Map();
  for (const member of members) {
    recipientsById.set(member.userId, {
      userId: member.userId,
      email: member.user?.email || null,
      name: member.user?.name || null,
    });
  }
  if (manager?.id) {
    recipientsById.set(manager.id, {
      userId: manager.id,
      email: manager.email || null,
      name: manager.name || null,
    });
  }
  const recipients = Array.from(recipientsById.values());

  const txId = `team-notify-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const actorDisplayName = String(input.actorDisplayName || 'System');
  const rawActorUserId = String(input.actorUserId || '').trim() || null;
  let actorUserId = rawActorUserId;
  if (actorUserId) {
    const actorExists = await prisma.user.findFirst({
      where: { id: actorUserId, isDeleted: false },
      select: { id: true },
    });
    if (!actorExists?.id) {
      actorUserId = null;
    }
  }
  const meta = input.meta && typeof input.meta === 'object' ? input.meta : {};
  const workItemId = String(meta.workItemId || '').trim();
  const workItemTitle = String(meta.workItemTitle || meta.siteName || '').trim();
  const readableAction = {
    work_item_updated: 'updated work item',
    task_created: 'created work item',
    project_updated: 'updated project',
    import_completed: 'completed telecom import',
  }[actionType] || actionType.replaceAll('_', ' ');
  const defaultDetails =
    actionType === 'work_item_updated'
      ? `${actorDisplayName} ${readableAction}${workItemTitle ? ` "${workItemTitle}"` : workItemId ? ` ${workItemId}` : ''}`
      : actionType === 'task_created'
      ? `${actorDisplayName} ${readableAction}${workItemTitle ? ` "${workItemTitle}"` : ''}`
      : actionType === 'import_completed'
      ? `${actorDisplayName} ${readableAction} (${Number(meta.created || 0)} created, ${Number(meta.failed || 0)} failed)`
      : `${actorDisplayName} ${readableAction} on ${project.name}`;
  const deepLink = String(
    input.link
      || (workItemId
        ? `/projects/${encodeURIComponent(projectId)}/work-items?workItemId=${encodeURIComponent(workItemId)}`
        : `/projects/${encodeURIComponent(projectId)}/work-items`),
  );
  const titleByAction = {
    work_item_updated: `Work item updated • ${project.name}`,
    task_created: `New work item • ${project.name}`,
    project_updated: `Project updated • ${project.name}`,
    import_completed: `Import completed • ${project.name}`,
  };

  const basePayload = {
    projectId,
    projectName: project.name,
    actionType,
    type: String(input.type || 'PROJECT_UPDATE'),
    sender: actorDisplayName,
    details: String(input.details || defaultDetails),
    link: deepLink,
    department: String(input.department || input.meta?.department || 'Engineering'),
    isActionable: Boolean(input.isActionable),
    approval: input.approval || null,
    title: String(input.title || titleByAction[actionType] || `Project update • ${project.name}`),
    message: String(input.message || defaultDetails),
    actorUserId,
    actorDisplayName,
    createdAt: new Date().toISOString(),
    meta,
  };

  const events = [];
  for (const member of recipients) {
    for (const channel of ['ui', 'email', 'push']) {
      events.push({
        txId,
        eventType: `project.team.${channel}`,
        payloadJson: {
          ...basePayload,
          channel,
          targetUserId: member.userId,
          targetEmail: member.email || null,
          targetName: member.name || null,
        },
      });
    }
  }

  if (events.length > 0) {
    await prisma.domainEvent.createMany({ data: events });
  }

  try {
    await prisma.auditLog.create({
      data: {
        txId,
        userId: actorUserId,
        module: 'projects',
        entity: 'project',
        entityId: projectId,
        actionType: `notify_team:${actionType}`,
        newValueJson: {
          memberCount: members.length,
          channels: ['ui', 'email', 'push'],
        },
        metaJson: {
          projectName: project.name,
        },
      },
    });
  } catch {
    // Non-blocking: activity/audit failure must never roll back the business action.
  }

  return {
    ok: true,
    projectId,
    membersNotified: recipients.length,
    eventsCreated: events.length,
    targets: recipients.map((member) => ({
      targetUserId: member.userId,
      targetName: member.name || null,
      targetEmail: member.email || null,
      payload: {
        ...basePayload,
        targetUserId: member.userId,
      },
    })),
  };
}

export async function listUserTeamNotifications(prisma, input = {}) {
  const userId = String(input.userId || '').trim();
  if (!userId) return { notifications: [] };
  const take = Math.max(1, Math.min(200, Number(input.take || 50)));

  const rows = await prisma.domainEvent.findMany({
    where: {
      eventType: 'project.team.ui',
    },
    orderBy: { createdAt: 'desc' },
    take: take * 5,
  });

  const notifications = rows
    .filter((row) => {
      const payload = row.payloadJson || {};
      return payload && typeof payload === 'object' && payload.targetUserId === userId;
    })
    .slice(0, take)
    .map((row) => {
      const payload = row.payloadJson || {};
      const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
      const rawType = String(payload.type || 'PROJECT_UPDATE').toUpperCase();
      const notificationTitleByType = {
        LEAVE_REQUEST: 'Leave request pending',
        SCM_APPROVAL: 'SCM approval required',
        FINANCE_APPROVAL: 'Finance approval required',
      };
      const actionType = String(payload.actionType || '').trim();
      const titleByAction = {
        work_item_updated: `Work item updated • ${payload.projectName || 'Project'}`,
        task_created: `New work item • ${payload.projectName || 'Project'}`,
        project_updated: `Project updated • ${payload.projectName || 'Project'}`,
        import_completed: `Import completed • ${payload.projectName || 'Project'}`,
      };
      const title = String(payload.title || titleByAction[actionType] || notificationTitleByType[rawType] || `Project update: ${payload.projectName || 'Project'}`);
      const workItemId = String(meta.workItemId || '').trim();
      const workItemTitle = String(meta.workItemTitle || '').trim();
      const fallbackDetailsByAction = {
        work_item_updated: `${payload.sender || 'System'} updated ${workItemTitle || workItemId || 'a work item'}`,
        task_created: `${payload.sender || 'System'} created ${workItemTitle || 'a work item'}`,
        import_completed: `${payload.sender || 'System'} completed telecom import`,
        project_updated: `${payload.sender || 'System'} updated project settings`,
      };
      const details = String(
        payload.details
        || payload.message
        || fallbackDetailsByAction[actionType]
        || payload.actionType
        || 'Project team update',
      );
      const targetRole = Array.isArray(payload.targetRole)
        ? payload.targetRole.map((v) => String(v || '').trim()).filter(Boolean)
        : (payload.targetRole ? [String(payload.targetRole).trim()] : []);
      const targetDepartmentId = Array.isArray(payload.targetDepartmentId)
        ? payload.targetDepartmentId.map((v) => String(v || '').trim()).filter(Boolean)
        : (payload.targetDepartmentId ? [String(payload.targetDepartmentId).trim()] : []);
      return {
        id: row.id,
        type: rawType,
        sender: payload.sender || payload.actorDisplayName || 'System',
        details,
        link: payload.link || `/projects/${encodeURIComponent(String(payload.projectId || ''))}/work-items`,
        department: payload.department || meta.department || 'Engineering',
        metadata: meta,
        isActionable: Boolean(payload.isActionable),
        approval: payload.approval || null,
        targetUserId: payload.targetUserId || null,
        targetRole,
        targetDepartmentId,
        projectId: payload.projectId,
        projectName: payload.projectName,
        actionType,
        title,
        message: payload.message || 'Project team update',
        createdAt: row.createdAt,
      };
    });

  return { notifications };
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function bulkImportTelecomWorkItems(prisma, input = {}) {
  const projectId = String(input.projectId || '').trim();
  const fileName = String(input.fileName || 'telecom-import.xlsx').trim();
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const actorUserId = String(input.actorUserId || '').trim() || null;
  const actorDisplayName = String(input.actorDisplayName || 'System').trim() || 'System';

  if (!projectId) throw new Error('projectId is required.');
  if (rows.length === 0) {
    return { batchId: null, created: 0, failed: 0, total: 0 };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!project) throw new Error('Project not found.');

  const txId = `project-import-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const importResult = await prisma.$transaction(async (tx) => {
    const batch = await tx.projectImportBatch.create({
      data: {
        parentProjectId: projectId,
        fileName,
        uploadedBy: actorDisplayName,
        totalRows: rows.length,
        successfulRows: 0,
        failedRows: 0,
        status: 'processing',
      },
      select: { id: true },
    });

    const existing = await tx.workItem.findMany({
      where: { projectId, isDeleted: false },
      select: { importedFieldsJson: true },
    });
    const knownSiteIds = new Set(
      existing
        .map((row) => String(row.importedFieldsJson?.site_identifier || '').trim())
        .filter(Boolean),
    );

    let failed = 0;
    const now = Date.now();
    const workItemRows = [];
    const stateRows = [];
    const activityRows = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rawRow = rows[index];
      const importedFields = rawRow?.imported_fields && typeof rawRow.imported_fields === 'object' ? rawRow.imported_fields : {};
      const siteIdentifier = String(rawRow?.site_identifier || importedFields?.site_identifier || '').trim();
      if (!siteIdentifier || knownSiteIds.has(siteIdentifier)) {
        failed += 1;
        continue;
      }
      knownSiteIds.add(siteIdentifier);
      const workItemId = `wi-${now}-${index}-${crypto.randomBytes(4).toString('hex')}`;

      const poUnitPrice = toNumberOrNull(rawRow?.po_unit_price);
      const planningAuditDate = toDateOrNull(importedFields?.planning_audit_date || importedFields?.planned_start_date);
      const forecastDate = toDateOrNull(importedFields?.forecast_date || importedFields?.planning_audit_date || importedFields?.planned_start_date);
      const actualAuditDate = toDateOrNull(importedFields?.actual_audit_date);

      workItemRows.push({
        id: workItemId,
        projectId,
        importBatchId: batch.id,
        title: String(rawRow?.title || importedFields?.site_name || siteIdentifier),
        type: 'site',
        status: 'needs_manual_completion',
        priority: 'medium',
        assignee: importedFields?.team ? String(importedFields.team) : null,
        plannedDate: planningAuditDate,
        qaStatus: 'pending',
        acceptanceStatus: 'pending',
        manualCompletionStatus: 'pending',
        financeSyncStatus: 'blocked',
        isFinanciallyEligible: false,
        financialEligibilityReason: 'Waiting for valid ticket number and PO unit price.',
        poUnitPrice: poUnitPrice,
        importedFieldsJson: importedFields,
        operationalManualFieldsJson: {},
        acceptanceManualFieldsJson: {},
      });

      stateRows.push({
        projectId,
        workItemId: workItemId,
        poUnitPrice: poUnitPrice,
        qaStatus: 'pending',
        acceptanceStatus: 'pending',
        importedFieldsJson: importedFields,
        operationalManualFieldsJson: {},
        acceptanceManualFieldsJson: {},
        planningAuditDate,
        planningAuditWeek: toNumberOrNull(importedFields?.planning_audit_week),
        forecastDate,
        forecastWeek: toNumberOrNull(importedFields?.forecast_week),
        actualAuditDate,
        isFinanciallyEligible: false,
        financialEligibilityReason: 'Waiting for valid ticket number and PO unit price.',
        financeSyncStatus: 'blocked',
        financeErrorMessage: 'Waiting for QA approval.',
        updatedByUserId: actorUserId,
        updatedByName: actorDisplayName,
      });

      activityRows.push({
        entityType: 'project_item',
        entityId: workItemId,
        projectId,
        workItemId: workItemId,
        actorUserId,
        actorDisplayName,
        actionType: 'import_created',
        fieldName: 'site_identifier',
        oldValueJson: null,
        newValueJson: siteIdentifier,
        message: `${actorDisplayName} imported work item ${siteIdentifier}`,
        eventSource: 'import',
      });
    }

    let created = 0;
    if (workItemRows.length > 0) {
      const insertedWorkItems = await tx.workItem.createMany({
        data: workItemRows,
        skipDuplicates: true,
      });
      created = Number(insertedWorkItems?.count || 0);
    }
    if (stateRows.length > 0) {
      await tx.projectItemState.createMany({
        data: stateRows,
        skipDuplicates: true,
      });
    }

    if (activityRows.length > 0) {
      await tx.projectItemActivity.createMany({ data: activityRows });
    }

    await tx.projectImportBatch.update({
      where: { id: batch.id },
      data: {
        successfulRows: created,
        failedRows: failed,
        status: failed > 0 ? 'failed' : 'completed',
        errorSummary: failed > 0 ? `${failed} rows skipped (missing/duplicate site_identifier).` : null,
      },
    });

    await tx.auditLog.create({
      data: {
        txId,
        userId: actorUserId,
        module: 'projects',
        entity: 'project_import_batch',
        entityId: batch.id,
        actionType: 'telecom_bulk_import',
        newValueJson: {
          projectId,
          fileName,
          totalRows: rows.length,
          created,
          failed,
        },
        metaJson: {
          actor: actorDisplayName,
          projectName: project.name,
        },
      },
    });

    return { batchId: batch.id, created, failed, total: rows.length };
  });

  // ── SSE: push real-time notification after import ──
  try {
    sseBroadcast('project_import_completed', {
      projectId,
      batchId: importResult.batchId,
      created: importResult.created,
      ts: Date.now(),
    });
  } catch { /* non-critical */ }

  try {
    await notifyTeam(prisma, {
      projectId,
      actionType: 'import_completed',
      type: 'PROJECT_IMPORT',
      title: `Import completed • ${project.name}`,
      details: `${actorDisplayName} imported ${importResult.created}/${rows.length} work items from ${fileName}.`,
      message: `${actorDisplayName} imported ${importResult.created} work items (${importResult.failed} failed).`,
      link: `/projects/work-items?projectId=${projectId}`,
      department: 'Engineering',
      isActionable: false,
      meta: {
        batchId: importResult.batchId,
        created: importResult.created,
        failed: importResult.failed,
        total: rows.length,
        fileName,
      },
      actorUserId,
      actorDisplayName,
    });
  } catch {
    // Non-blocking: notification failure must not fail the import transaction result.
  }

  return importResult;
}

export async function createProjectForUser(prisma, input = {}) {
  const name = String(input.name || '').trim();
  const clientName = String(input.clientName || input.client || '').trim();
  const managerId = String(input.managerId || '').trim();
  const creatorUserId = String(input.creatorUserId || '').trim() || null;
  const creatorDisplayName = String(input.creatorDisplayName || 'System');
  const projectMode = String(input.projectMode || 'standard').trim() || 'standard';
  const projectCategory = input.projectCategory ? String(input.projectCategory) : null;
  const purchaseOrder = input.purchase_order || input.purchaseOrder || input.poNumber || null;
  const isTelecomProject = Boolean(input.isTelecomProject || projectMode === 'telecom_multi_site');
  const bulkImportRequired = Boolean(input.bulkImportRequired || isTelecomProject);

  if (!name) throw new Error('Project name is required.');
  if (!clientName) throw new Error('Client is required.');
  if (!managerId) throw new Error('Manager is required.');

  const startDate = new Date(input.startDate || Date.now());
  const endDate = new Date(input.endDate || Date.now());
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Start date and end date are required.');
  }
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('End date must be after start date.');
  }

  const manager = await prisma.user.findFirst({
    where: { id: managerId, isDeleted: false, isActive: true },
    select: { id: true, departmentId: true, name: true, email: true },
  });
  if (!manager) throw new Error('Manager not found or inactive.');

  const ownerDepartmentId = await resolveFallbackDepartmentId(
    prisma,
    input.ownerDepartmentId || manager.departmentId || null,
    [managerId, creatorUserId],
  );

  const txId = `project-create-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        clientName,
        clientAccountId: input.clientId || input.clientAccountId || null,
        status: String(input.status || 'active'),
        projectMode,
        isTelecomProject,
        bulkImportRequired,
        purchaseOrder: purchaseOrder ? String(purchaseOrder) : null,
        projectCategory,
        managerId,
        ownerDepartmentId,
        startDate,
        endDate,
        description: input.description ? String(input.description) : null,
      },
    });

    const membershipDepartmentId = await resolveFallbackDepartmentId(
      tx,
      ownerDepartmentId,
      [managerId, creatorUserId],
    );
    if (!membershipDepartmentId) {
      throw new Error('Cannot create project membership without a valid department.');
    }

    await tx.projectMember.upsert({
      where: {
        projectId_userId_roleCode: {
          projectId: created.id,
          userId: managerId,
          roleCode: 'LEAD',
        },
      },
      update: {
        isDeleted: false,
        deletedAt: null,
        departmentId: membershipDepartmentId,
      },
      create: {
        projectId: created.id,
        userId: managerId,
        departmentId: membershipDepartmentId,
        roleCode: 'LEAD',
        isDeleted: false,
      },
    });

    await tx.auditLog.create({
      data: {
        txId,
        userId: creatorUserId,
        module: 'projects',
        entity: 'project',
        entityId: created.id,
        actionType: 'project_created',
        newValueJson: {
          name,
          clientName,
          managerId,
          projectMode,
          isTelecomProject,
          bulkImportRequired,
        },
        metaJson: {
          actor: creatorDisplayName,
        },
      },
    });

    return created;
  });

  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      clientAccount: { select: { id: true, name: true } },
      members: {
        where: { isDeleted: false },
        include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      },
      workItems: { where: { isDeleted: false } },
    },
  });

  return mapProject(full);
}

export async function repairProjectIntegrity(prisma, input = {}) {
  const actorUserId = String(input.actorUserId || '').trim() || null;
  const actorDisplayName = String(input.actorDisplayName || 'System');
  const txId = `project-repair-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const projects = await prisma.project.findMany({
    where: { isDeleted: false },
    select: { id: true, managerId: true, ownerDepartmentId: true },
  });
  const projectIds = projects.map((p) => p.id);
  const validSet = new Set(projectIds);

  const orphanActivityIds = (await prisma.projectItemActivity.findMany({
    where: projectIds.length ? { projectId: { notIn: projectIds } } : {},
    select: { id: true },
  })).map((row) => row.id);
  const orphanStateIds = (await prisma.projectItemState.findMany({
    where: projectIds.length ? { projectId: { notIn: projectIds } } : {},
    select: { id: true },
  })).map((row) => row.id);
  const orphanFileIds = (await prisma.projectItemFile.findMany({
    where: projectIds.length ? { projectId: { notIn: projectIds } } : {},
    select: { id: true },
  })).map((row) => row.id);

  const deletedActivities = orphanActivityIds.length
    ? await prisma.projectItemActivity.deleteMany({ where: { id: { in: orphanActivityIds } } })
    : { count: 0 };
  const deletedStates = orphanStateIds.length
    ? await prisma.projectItemState.deleteMany({ where: { id: { in: orphanStateIds } } })
    : { count: 0 };
  const deletedFiles = orphanFileIds.length
    ? await prisma.projectItemFile.deleteMany({ where: { id: { in: orphanFileIds } } })
    : { count: 0 };

  const projectRows = await prisma.project.findMany({
    where: { isDeleted: false },
    include: {
      members: { where: { isDeleted: false }, select: { id: true } },
      manager: { select: { id: true, departmentId: true } },
    },
  });

  let createdMembers = 0;
  let defaultedProjectDepartments = 0;
  for (const row of projectRows) {
    if (row.members.length > 0) continue;
    const departmentId = await resolveFallbackDepartmentId(
      prisma,
      row.ownerDepartmentId || row.manager?.departmentId || null,
      [row.managerId],
    );
    if (!departmentId) continue;
    if (!row.ownerDepartmentId) {
      await prisma.project.update({
        where: { id: row.id },
        data: { ownerDepartmentId: departmentId },
      });
      defaultedProjectDepartments += 1;
    }
    await prisma.projectMember.upsert({
      where: {
        projectId_userId_roleCode: {
          projectId: row.id,
          userId: row.managerId,
          roleCode: 'LEAD',
        },
      },
      update: { isDeleted: false, deletedAt: null, departmentId },
      create: { projectId: row.id, userId: row.managerId, roleCode: 'LEAD', departmentId, isDeleted: false },
    });
    createdMembers += 1;
  }

  await prisma.auditLog.create({
    data: {
      txId,
      userId: actorUserId,
      module: 'projects',
      entity: 'project_integrity',
      entityId: 'global',
      actionType: 'repair_integrity',
      newValueJson: {
        deletedOrphanActivities: deletedActivities.count,
        deletedOrphanStates: deletedStates.count,
        deletedOrphanFiles: deletedFiles.count,
        createdMissingLeadMembers: createdMembers,
        defaultedProjectDepartments,
      },
      metaJson: { actor: actorDisplayName, projectCount: validSet.size },
    },
  });

  return {
    ok: true,
    deletedOrphanActivities: deletedActivities.count,
    deletedOrphanStates: deletedStates.count,
    deletedOrphanFiles: deletedFiles.count,
    createdMissingLeadMembers: createdMembers,
    defaultedProjectDepartments,
    projectCount: validSet.size,
  };
}
