import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.accessProvisioning.deleteMany({});
  await prisma.recruitmentCandidate.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.domainEvent.deleteMany({});
  await prisma.workItem.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.timesheetEntry.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.workflowTransition.deleteMany({});
  await prisma.workflowStatus.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});
}

async function main() {
  console.log('--- Cleaning database ---');
  await cleanDatabase();

  console.log('--- Seeding departments ---');
  const departments = await Promise.all([
    prisma.department.create({ data: { code: 'dept-hr', name: 'Human Resources' } }),
    prisma.department.create({ data: { code: 'dept-sales', name: 'Sales' } }),
    prisma.department.create({ data: { code: 'dept-ops', name: 'Operations / SCM' } }),
    prisma.department.create({ data: { code: 'dept-eng', name: 'Project Delivery' } }),
    prisma.department.create({ data: { code: 'dept-finance', name: 'Finance' } }),
  ]);

  const departmentByCode = new Map(departments.map((d) => [d.code, d]));

  console.log('--- Seeding IAM roles ---');
  const roles = await Promise.all([
    prisma.role.create({ data: { code: 'ADMIN', name: 'Administrator' } }),
    prisma.role.create({ data: { code: 'CONTRIBUTOR', name: 'Contributor / Self-Service' } }),
    prisma.role.create({ data: { code: 'HR_MANAGER', name: 'HR Manager' } }),
    prisma.role.create({ data: { code: 'SCM_MANAGER', name: 'SCM Manager' } }),
    prisma.role.create({ data: { code: 'PROJECT_MANAGER', name: 'Project Manager' } }),
    prisma.role.create({ data: { code: 'SALES', name: 'Sales User' } }),
    prisma.role.create({ data: { code: 'FINANCE', name: 'Finance User' } }),
    prisma.role.create({ data: { code: 'QA', name: 'Quality Assurance' } }),
    prisma.role.create({ data: { code: 'USER', name: 'Standard User' } }),
  ]);
  const roleByCode = new Map(roles.map((r) => [r.code, r]));

  console.log('--- Seeding IAM permissions ---');
  const permissionDefs = [
    { module: 'hrm', resource: 'timesheet', action: 'view' },
    { module: 'hrm', resource: 'timesheet', action: 'write' },
    { module: 'hrm', resource: 'timesheet', action: 'approve' },
    { module: 'scm', resource: 'purchase_request', action: 'view' },
    { module: 'scm', resource: 'purchase_request', action: 'write' },
    { module: 'scm', resource: 'purchase_request', action: 'approve' },
    { module: 'project', resource: 'project', action: 'view' },
    { module: 'project', resource: 'project', action: 'write' },
    { module: 'project', resource: 'project', action: 'approve' },
    { module: 'crm', resource: 'opportunity', action: 'view' },
    { module: 'crm', resource: 'opportunity', action: 'write' },
    { module: 'finance', resource: 'invoice', action: 'view' },
    { module: 'finance', resource: 'invoice', action: 'write' },
    { module: 'finance', resource: 'invoice', action: 'approve' },
  ];

  const permissions = await Promise.all(
    permissionDefs.map((p) => prisma.permission.create({ data: p })),
  );
  const permissionByKey = new Map(
    permissions.map((p) => [`${p.module}:${p.resource}:${p.action}`, p]),
  );

  console.log('--- Linking roles to permissions ---');
  const allPermissions = permissions.map((p) => p.id);
  const byAction = (actions: string[]) =>
    permissions.filter((p) => actions.includes(p.action)).map((p) => p.id);

  const rolePermissionMap: Record<string, string[]> = {
    ADMIN: allPermissions,
    HR_MANAGER: permissions
      .filter((p) => p.module === 'hrm' || (p.module === 'project' && p.action === 'view'))
      .map((p) => p.id),
    SCM_MANAGER: permissions
      .filter((p) => p.module === 'scm' || (p.module === 'project' && p.action === 'view'))
      .map((p) => p.id),
    PROJECT_MANAGER: permissions
      .filter((p) => p.module === 'project' || (p.module === 'crm' && p.action === 'view'))
      .map((p) => p.id),
    SALES: permissions.filter((p) => p.module === 'crm').map((p) => p.id),
    FINANCE: permissions.filter((p) => p.module === 'finance').map((p) => p.id),
    QA: byAction(['view']),
    CONTRIBUTOR: permissions
      .filter((p) => (p.module === 'hrm' && ['view', 'write'].includes(p.action)) || p.action === 'view')
      .map((p) => p.id),
    USER: byAction(['view']),
  };

  for (const [roleCode, permissionIds] of Object.entries(rolePermissionMap)) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  console.log('--- Seeding users and role assignments ---');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Sarah Admin',
        email: 'admin@neox.erp',
        username: 'admin@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-finance')?.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'John Sales',
        email: 'sales@neox.erp',
        username: 'sales@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-sales')?.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Mike PM',
        email: 'pm@neox.erp',
        username: 'pm@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-eng')?.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Diva SCM',
        email: 'scm@neox.erp',
        username: 'scm@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-ops')?.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Jane QA',
        email: 'qa@neox.erp',
        username: 'qa@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-eng')?.id,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Emmanuel Butsana',
        email: 'ebutsana@neox.erp',
        username: 'ebutsana@neox.erp',
        passwordHash: 'seeded-hash-not-for-production',
        departmentId: departmentByCode.get('dept-eng')?.id,
      },
    }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email ?? '', u]));

  const userRoleAssignments = [
    { email: 'admin@neox.erp', roleCode: 'ADMIN' },
    { email: 'ebutsana@neox.erp', roleCode: 'ADMIN' },
    { email: 'sales@neox.erp', roleCode: 'SALES' },
    { email: 'pm@neox.erp', roleCode: 'PROJECT_MANAGER' },
    { email: 'scm@neox.erp', roleCode: 'SCM_MANAGER' },
    { email: 'qa@neox.erp', roleCode: 'QA' },
  ];

  await prisma.userRole.createMany({
    data: userRoleAssignments
      .map((a) => ({
        userId: userByEmail.get(a.email)?.id,
        roleId: roleByCode.get(a.roleCode)?.id,
      }))
      .filter((a): a is { userId: string; roleId: string } => Boolean(a.userId && a.roleId)),
  });

  console.log('--- Seeding workflow statuses and transitions ---');
  const workflowStatuses = await Promise.all([
    prisma.workflowStatus.create({
      data: { module: 'hrm', entity: 'timesheet_entry', code: 'submitted', label: 'Submitted', sequence: 1 },
    }),
    prisma.workflowStatus.create({
      data: { module: 'hrm', entity: 'timesheet_entry', code: 'approved', label: 'Approved', sequence: 2, isTerminal: true },
    }),
    prisma.workflowStatus.create({
      data: { module: 'scm', entity: 'purchase_request', code: 'draft', label: 'Draft', sequence: 1 },
    }),
    prisma.workflowStatus.create({
      data: { module: 'scm', entity: 'purchase_request', code: 'submitted', label: 'Submitted', sequence: 2 },
    }),
    prisma.workflowStatus.create({
      data: { module: 'scm', entity: 'purchase_request', code: 'approved', label: 'Approved', sequence: 3, isTerminal: true },
    }),
    prisma.workflowStatus.create({
      data: { module: 'hrm', entity: 'recruitment_candidate', code: 'offer', label: 'Offer', sequence: 1 },
    }),
    prisma.workflowStatus.create({
      data: { module: 'hrm', entity: 'recruitment_candidate', code: 'hired', label: 'Hired', sequence: 2 },
    }),
    prisma.workflowStatus.create({
      data: { module: 'hrm', entity: 'recruitment_candidate', code: 'onboarding', label: 'Onboarding', sequence: 3 },
    }),
  ]);

  const statusByKey = new Map(workflowStatuses.map((s) => [`${s.module}:${s.entity}:${s.code}`, s]));

  const approveTimesheetPermission = permissionByKey.get('hrm:timesheet:approve');
  const approvePurchaseRequestPermission = permissionByKey.get('scm:purchase_request:approve');

  await prisma.workflowTransition.createMany({
    data: [
      {
        module: 'hrm',
        entity: 'timesheet_entry',
        fromStatusId: statusByKey.get('hrm:timesheet_entry:submitted')!.id,
        toStatusId: statusByKey.get('hrm:timesheet_entry:approved')!.id,
        requiredPermissionId: approveTimesheetPermission?.id,
      },
      {
        module: 'scm',
        entity: 'purchase_request',
        fromStatusId: statusByKey.get('scm:purchase_request:draft')!.id,
        toStatusId: statusByKey.get('scm:purchase_request:submitted')!.id,
      },
      {
        module: 'scm',
        entity: 'purchase_request',
        fromStatusId: statusByKey.get('scm:purchase_request:submitted')!.id,
        toStatusId: statusByKey.get('scm:purchase_request:approved')!.id,
        requiredPermissionId: approvePurchaseRequestPermission?.id,
      },
      {
        module: 'hrm',
        entity: 'recruitment_candidate',
        fromStatusId: statusByKey.get('hrm:recruitment_candidate:offer')!.id,
        toStatusId: statusByKey.get('hrm:recruitment_candidate:hired')!.id,
      },
      {
        module: 'hrm',
        entity: 'recruitment_candidate',
        fromStatusId: statusByKey.get('hrm:recruitment_candidate:hired')!.id,
        toStatusId: statusByKey.get('hrm:recruitment_candidate:onboarding')!.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('--- Seeding project visibility through project_members ---');
  const projectManager = userByEmail.get('pm@neox.erp');
  if (!projectManager) {
    throw new Error('Project manager user not found.');
  }

  const project = await prisma.project.create({
    data: {
      name: 'Project Hyperion',
      clientName: 'Acme Corp',
      status: 'active',
      managerId: projectManager.id,
      ownerDepartmentId: departmentByCode.get('dept-eng')?.id,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-12-31'),
      description: 'Cross-functional deployment project with strict RBAC and audit.',
      workItems: {
        create: [
          {
            title: 'Site Survey - Frankfurt Hub',
            type: 'task',
            status: 'done',
            priority: 'medium',
            assignee: 'John Doe',
            qaStatus: 'approved',
            acceptanceStatus: 'signed',
          },
          {
            title: 'Router Config - Paris Node',
            type: 'task',
            status: 'pending-acceptance',
            priority: 'high',
            assignee: 'Mike Jones',
            qaStatus: 'approved',
          },
        ],
      },
    },
  });

  const projectMembers = [
    userByEmail.get('pm@neox.erp'),
    userByEmail.get('qa@neox.erp'),
    userByEmail.get('sales@neox.erp'),
  ].filter((u): u is NonNullable<typeof u> => Boolean(u));

  await prisma.projectMember.createMany({
    data: projectMembers.map((member) => ({
      projectId: project.id,
      userId: member.id,
      departmentId: member.departmentId!,
      roleCode: member.email === 'pm@neox.erp' ? 'owner' : 'contributor',
    })),
    skipDuplicates: true,
  });

  console.log('--- Seeding HRM timesheet entries ---');
  const hrmUser = userByEmail.get('pm@neox.erp');
  if (!hrmUser?.departmentId) {
    throw new Error('Timesheet seed failed because user/department is missing.');
  }
  await prisma.timesheetEntry.create({
    data: {
      userId: hrmUser.id,
      departmentId: hrmUser.departmentId,
      workDate: new Date('2026-03-16'),
      hours: new Prisma.Decimal('8.00'),
      description: 'Planning and integration workshop.',
      statusCode: 'submitted',
    },
  });

  console.log('--- Seeding SCM purchase request + audit trace ---');
  const scmUser = userByEmail.get('scm@neox.erp');
  if (!scmUser?.departmentId) {
    throw new Error('Purchase request seed failed because user/department is missing.');
  }

  const txId = randomUUID();
  const request = await prisma.purchaseRequest.create({
    data: {
      requestNumber: 'PR-2026-0001',
      requesterUserId: scmUser.id,
      requesterDepartmentId: scmUser.departmentId,
      statusCode: 'submitted',
      justification: 'Network switches replenishment for Q2 deployment.',
      totalAmount: new Prisma.Decimal('12500.00'),
    },
  });

  await prisma.auditLog.create({
    data: {
      txId,
      userId: scmUser.id,
      module: 'scm',
      entity: 'purchase_request',
      entityId: request.id,
      actionType: 'CREATE',
      oldValueJson: Prisma.JsonNull,
      newValueJson: {
        requestNumber: request.requestNumber,
        statusCode: request.statusCode,
        requesterUserId: request.requesterUserId,
      },
      metaJson: {
        source: 'seed',
        note: 'In production, this entry must be written in the same database transaction as purchase_request.',
      },
    },
  });

  await prisma.domainEvent.create({
    data: {
      txId,
      eventType: 'scm.purchase_request.created',
      payloadJson: {
        purchaseRequestId: request.id,
        requestNumber: request.requestNumber,
      },
    },
  });

  console.log('--- Seeding HRM recruitment candidate and access provisioning trail ---');
  const hrDepartment = departmentByCode.get('dept-hr');
  const contributorRole = roleByCode.get('CONTRIBUTOR');
  if (!hrDepartment || !contributorRole) {
    throw new Error('HR department or contributor role not found for recruitment seed.');
  }

  const candidate = await prisma.recruitmentCandidate.create({
    data: {
      fullName: 'Liam Foster',
      personalEmail: 'liam.foster@gmail.com',
      phone: '+1 555 199 0001',
      position: 'HR Operations Analyst',
      statusCode: 'hired',
      recruitmentDepartmentId: hrDepartment.id,
    },
  });

  const onboardingUser = await prisma.user.create({
    data: {
      name: candidate.fullName,
      email: 'liam.foster@neox.erp',
      username: 'liam.foster@neox.erp',
      passwordHash: 'temporary-seeded-hash-not-for-production',
      forcePasswordChange: true,
      departmentId: hrDepartment.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: onboardingUser.id,
      roleId: contributorRole.id,
    },
  });

  await prisma.recruitmentCandidate.update({
    where: { id: candidate.id },
    data: {
      hiredUserId: onboardingUser.id,
      statusCode: 'onboarding',
      hiredAt: new Date(),
    },
  });

  await prisma.accessProvisioning.create({
    data: {
      candidateId: candidate.id,
      userId: onboardingUser.id,
      statusCode: 'provisioned',
      temporaryPasswordSentAt: new Date(),
    },
  });

  const recruitmentTxId = randomUUID();
  await prisma.auditLog.createMany({
    data: [
      {
        txId: recruitmentTxId,
        userId: onboardingUser.id,
        module: 'hrm',
        entity: 'recruitment_candidate',
        entityId: candidate.id,
        actionType: 'CREATE_ACCOUNT_FROM_RECRUITMENT',
        newValueJson: {
          username: onboardingUser.username,
          forcePasswordChange: onboardingUser.forcePasswordChange,
        },
      },
      {
        txId: recruitmentTxId,
        userId: onboardingUser.id,
        module: 'hrm',
        entity: 'access_provisioning',
        entityId: candidate.id,
        actionType: 'WELCOME_EMAIL_QUEUED',
        newValueJson: {
          email: onboardingUser.email,
          template: 'welcome_access',
        },
      },
    ],
  });

  await prisma.domainEvent.create({
    data: {
      txId: recruitmentTxId,
      eventType: 'hrm.onboarding.access_email.requested',
      payloadJson: {
        candidateId: candidate.id,
        userId: onboardingUser.id,
        email: onboardingUser.email,
      },
    },
  });

  console.log('--- Seeding complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
