function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeCode(value, fallbackPrefix) {
  const text = cleanText(value);
  if (!text) return `${fallbackPrefix}_${Date.now()}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function queryRows(prisma, sql, params = []) {
  return prisma.$queryRawUnsafe(sql, ...params);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

async function upsertByCode(prisma, tableName, code, columns) {
  const now = new Date();
  const id = `${tableName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const keys = Object.keys(columns);
  const insertCols = ['"id"', '"code"', ...keys.map((key) => `"${key}"`), '"createdAt"', '"updatedAt"'].join(', ');
  const insertVals = [id, code, ...keys.map((key) => columns[key]), now, now].map(sqlLiteral).join(', ');
  const updates = keys.map((key) => `"${key}" = EXCLUDED."${key}"`).join(', ');

  await prisma.$executeRawUnsafe(
    `INSERT INTO "${tableName}" (${insertCols}) VALUES (${insertVals}) ON CONFLICT ("code") DO UPDATE SET ${updates}, "updatedAt" = EXCLUDED."updatedAt"`,
  );

  const rows = await queryRows(prisma, `SELECT * FROM "${tableName}" WHERE "code" = $1 LIMIT 1`, [code]);
  return rows[0] || null;
}

export async function getFinanceGovernanceSettings(prisma) {
  const [
    categories,
    evidenceRules,
    approvalThresholds,
    numberingSchemes,
    paymentMethods,
    ledgerMappings,
  ] = await Promise.all([
    queryRows(prisma, 'SELECT * FROM "FinanceCategorySetting" ORDER BY "direction" ASC, "code" ASC'),
    queryRows(prisma, 'SELECT * FROM "FinanceEvidenceRule" ORDER BY "transactionType" ASC, "code" ASC'),
    queryRows(prisma, 'SELECT * FROM "FinanceApprovalThreshold" ORDER BY "transactionType" ASC, "minAmount" ASC'),
    queryRows(prisma, 'SELECT * FROM "FinanceNumberingScheme" ORDER BY "targetType" ASC, "code" ASC'),
    queryRows(prisma, 'SELECT * FROM "FinancePaymentMethodSetting" ORDER BY "direction" ASC, "code" ASC'),
    queryRows(prisma, 'SELECT * FROM "FinanceLedgerMapping" ORDER BY "sourceModule" ASC, "sourceEntity" ASC'),
  ]);

  return {
    categories,
    evidenceRules,
    approvalThresholds,
    numberingSchemes,
    paymentMethods,
    ledgerMappings,
  };
}

export async function upsertFinanceCategorySetting(prisma, payload = {}) {
  const code = normalizeCode(payload.code || payload.name, 'cat');
  return upsertByCode(prisma, 'FinanceCategorySetting', code, {
    name: cleanText(payload.name) || code,
    direction: cleanText(payload.direction) || 'outflow',
    description: cleanText(payload.description),
    isActive: payload.isActive === false ? false : true,
  });
}

export async function upsertFinanceEvidenceRule(prisma, payload = {}) {
  const code = normalizeCode(payload.code || payload.transactionType, 'rule');
  const docs = Array.isArray(payload.requiredDocs) ? payload.requiredDocs.map((row) => String(row).trim()).filter(Boolean) : [];
  return upsertByCode(prisma, 'FinanceEvidenceRule', code, {
    transactionType: cleanText(payload.transactionType) || 'payable',
    requiredDocsJson: JSON.stringify(docs),
    minCount: Number.isInteger(payload.minCount) ? payload.minCount : Math.max(docs.length, 1),
    isActive: payload.isActive === false ? false : true,
  });
}

export async function upsertFinanceApprovalThreshold(prisma, payload = {}) {
  const code = normalizeCode(payload.code || `${payload.transactionType || 'finance'}_${payload.requiredRole || 'approver'}`, 'thr');
  const minAmount = toNumber(payload.minAmount) ?? 0;
  const maxAmount = toNumber(payload.maxAmount);
  return upsertByCode(prisma, 'FinanceApprovalThreshold', code, {
    transactionType: cleanText(payload.transactionType) || 'payable',
    minAmount,
    maxAmount,
    requiredRole: cleanText(payload.requiredRole) || 'FINANCE_APPROVER',
    isActive: payload.isActive === false ? false : true,
  });
}

export async function upsertFinanceNumberingScheme(prisma, payload = {}) {
  const code = normalizeCode(payload.code || payload.targetType, 'num');
  return upsertByCode(prisma, 'FinanceNumberingScheme', code, {
    targetType: cleanText(payload.targetType) || 'invoice',
    prefix: cleanText(payload.prefix) || 'FIN',
    yearIncluded: payload.yearIncluded === false ? false : true,
    nextNumber: Number.isInteger(payload.nextNumber) ? payload.nextNumber : 1,
    padding: Number.isInteger(payload.padding) ? payload.padding : 5,
    isActive: payload.isActive === false ? false : true,
  });
}

export async function upsertFinancePaymentMethodSetting(prisma, payload = {}) {
  const code = normalizeCode(payload.code || payload.label, 'pm');
  return upsertByCode(prisma, 'FinancePaymentMethodSetting', code, {
    label: cleanText(payload.label) || code,
    direction: cleanText(payload.direction) || 'both',
    requiresProof: payload.requiresProof === false ? false : true,
    isActive: payload.isActive === false ? false : true,
  });
}

export async function upsertFinanceLedgerMapping(prisma, payload = {}) {
  const code = normalizeCode(payload.code || `${payload.sourceModule || 'finance'}_${payload.sourceEntity || 'entry'}_${payload.direction || 'outflow'}`, 'map');
  return upsertByCode(prisma, 'FinanceLedgerMapping', code, {
    sourceModule: cleanText(payload.sourceModule) || 'finance',
    sourceEntity: cleanText(payload.sourceEntity) || 'finance_entry',
    direction: cleanText(payload.direction) || 'outflow',
    accountCode: cleanText(payload.accountCode) || 'acc_default',
    categoryCode: cleanText(payload.categoryCode) || 'cat_default',
    isActive: payload.isActive === false ? false : true,
  });
}

async function ensureRole(prisma, code, name) {
  return prisma.role.upsert({
    where: { code },
    update: { name, isActive: true, isDeleted: false },
    create: { code, name, isActive: true, isDeleted: false },
  });
}

async function ensurePermission(prisma, module, resource, action) {
  return prisma.permission.upsert({
    where: { module_resource_action: { module, resource, action } },
    update: { isActive: true },
    create: { module, resource, action, isActive: true },
  });
}

async function ensureRolePermission(prisma, roleId, permissionId) {
  const existing = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      permissionId,
      scopeType: null,
      scopeValue: null,
    },
  });
  if (existing) return existing;
  return prisma.rolePermission.create({
    data: {
      roleId,
      permissionId,
      scopeType: null,
      scopeValue: null,
    },
  });
}

async function ensureWorkflowStatus(prisma, payload) {
  const existing = await prisma.workflowStatus.findFirst({
    where: {
      module: payload.module,
      entity: payload.entity,
      code: payload.code,
    },
  });

  if (existing) {
    return prisma.workflowStatus.update({
      where: { id: existing.id },
      data: {
        label: payload.label,
        sequence: payload.sequence,
        isTerminal: payload.isTerminal === true,
        isActive: true,
      },
    });
  }

  return prisma.workflowStatus.create({
    data: {
      module: payload.module,
      entity: payload.entity,
      code: payload.code,
      label: payload.label,
      sequence: payload.sequence,
      isTerminal: payload.isTerminal === true,
      isActive: true,
    },
  });
}

async function ensureWorkflowTransition(prisma, payload) {
  const existing = await prisma.workflowTransition.findFirst({
    where: {
      module: payload.module,
      entity: payload.entity,
      fromStatusId: payload.fromStatusId,
      toStatusId: payload.toStatusId,
    },
  });

  if (existing) {
    return prisma.workflowTransition.update({
      where: { id: existing.id },
      data: {
        requiredPermissionId: payload.requiredPermissionId || null,
        isActive: true,
      },
    });
  }

  return prisma.workflowTransition.create({
    data: {
      module: payload.module,
      entity: payload.entity,
      fromStatusId: payload.fromStatusId,
      toStatusId: payload.toStatusId,
      requiredPermissionId: payload.requiredPermissionId || null,
      isActive: true,
    },
  });
}

export async function rolloutFinanceGovernance(prisma) {
  const roles = await Promise.all([
    ensureRole(prisma, 'FINANCE_VIEWER', 'Finance Viewer'),
    ensureRole(prisma, 'FINANCE_OPERATOR', 'Finance Operator'),
    ensureRole(prisma, 'FINANCE_APPROVER', 'Finance Approver'),
    ensureRole(prisma, 'CASHIER', 'Cashier'),
    ensureRole(prisma, 'FINANCE_MANAGER', 'Finance Manager'),
  ]);

  const permissions = await Promise.all([
    ensurePermission(prisma, 'finance', 'entries', 'read'),
    ensurePermission(prisma, 'finance', 'entries', 'create'),
    ensurePermission(prisma, 'finance', 'entries', 'update'),
    ensurePermission(prisma, 'finance', 'entries', 'submit_validation'),
    ensurePermission(prisma, 'finance', 'entries', 'approve'),
    ensurePermission(prisma, 'finance', 'entries', 'reject'),
    ensurePermission(prisma, 'finance', 'entries', 'settle'),
    ensurePermission(prisma, 'finance', 'evidence', 'upload'),
    ensurePermission(prisma, 'finance', 'reports', 'read'),
    ensurePermission(prisma, 'finance', 'settings', 'manage'),
    ensurePermission(prisma, 'finance', 'reconciliation', 'resolve'),
  ]);

  const roleByCode = new Map(roles.map((row) => [row.code, row]));
  const permissionByKey = new Map(permissions.map((row) => [`${row.resource}:${row.action}`, row]));

  const assignments = [
    ['FINANCE_VIEWER', ['entries:read', 'reports:read']],
    ['FINANCE_OPERATOR', ['entries:read', 'entries:create', 'entries:update', 'entries:submit_validation', 'evidence:upload', 'reports:read']],
    ['FINANCE_APPROVER', ['entries:read', 'entries:approve', 'entries:reject', 'reports:read']],
    ['CASHIER', ['entries:read', 'entries:settle', 'evidence:upload', 'reports:read']],
    ['FINANCE_MANAGER', ['entries:read', 'entries:create', 'entries:update', 'entries:submit_validation', 'entries:approve', 'entries:reject', 'entries:settle', 'evidence:upload', 'reports:read', 'settings:manage', 'reconciliation:resolve']],
  ];

  const rolePermissions = [];
  for (const [roleCode, keys] of assignments) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;
    for (const key of keys) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      const link = await ensureRolePermission(prisma, role.id, permission.id);
      rolePermissions.push(link);
    }
  }

  const statusList = await Promise.all([
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'draft', label: 'Draft', sequence: 1 }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'pending_evidence', label: 'Pending Evidence', sequence: 2 }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'pending_validation', label: 'Pending Validation', sequence: 3 }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'approved', label: 'Approved', sequence: 4 }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'rejected', label: 'Rejected', sequence: 5, isTerminal: true }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'settled', label: 'Settled', sequence: 6, isTerminal: true }),
    ensureWorkflowStatus(prisma, { module: 'finance', entity: 'finance_entry', code: 'cancelled', label: 'Cancelled', sequence: 7, isTerminal: true }),
  ]);

  const statusByCode = new Map(statusList.map((row) => [row.code, row]));
  const transitions = [
    ['draft', 'pending_evidence', 'entries:submit_validation'],
    ['pending_evidence', 'pending_validation', 'entries:submit_validation'],
    ['pending_validation', 'approved', 'entries:approve'],
    ['pending_validation', 'rejected', 'entries:reject'],
    ['approved', 'settled', 'entries:settle'],
    ['approved', 'cancelled', 'entries:reject'],
    ['rejected', 'draft', 'entries:update'],
  ];

  const workflowTransitions = [];
  for (const [fromCode, toCode, permissionKey] of transitions) {
    const fromStatus = statusByCode.get(fromCode);
    const toStatus = statusByCode.get(toCode);
    const permission = permissionByKey.get(permissionKey);
    if (!fromStatus || !toStatus) continue;
    const transition = await ensureWorkflowTransition(prisma, {
      module: 'finance',
      entity: 'finance_entry',
      fromStatusId: fromStatus.id,
      toStatusId: toStatus.id,
      requiredPermissionId: permission?.id || null,
    });
    workflowTransitions.push(transition);
  }

  return {
    rolesCreatedOrUpdated: roles.length,
    permissionsCreatedOrUpdated: permissions.length,
    rolePermissionsLinked: rolePermissions.length,
    workflowStatuses: statusList.length,
    workflowTransitions: workflowTransitions.length,
  };
}
