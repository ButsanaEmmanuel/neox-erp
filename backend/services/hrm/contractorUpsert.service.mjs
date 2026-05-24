// HRM-1.4 — Upsert a contractor by email.
//
// Closes D15: the telecom bulk import flows through this helper so that
// any `team` value seen in a row materializes a User + HrmEmploymentProfile
// (employmentType='contractor') in the directory, idempotent by email.
//
// API contract (also exposed at POST /api/v1/hrm/employees/contractor):
//   Input  : { firstName, lastName, email, source?, externalRef? }
//   Output : { id, created }
//
// Accepts either the top-level PrismaClient or an interactive transaction
// client (tx). Useful so the bulk-import transaction can call it without
// opening a nested $transaction.

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function generateEmployeeCode() {
  // Mirrors backend/services/hrm/recruitmentOnboarding.service.mjs:80.
  return `EMP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function upsertContractor(client, input) {
  const firstName = nonEmpty(input?.firstName) ? input.firstName.trim() : '';
  const lastName = nonEmpty(input?.lastName) ? input.lastName.trim() : '';
  const email = nonEmpty(input?.email) ? input.email.trim().toLowerCase() : '';
  const source = nonEmpty(input?.source) ? input.source.trim() : 'manual_contractor';
  const externalRef = nonEmpty(input?.externalRef) ? input.externalRef.trim() : null;

  if (!email) {
    const err = new Error('Email is required to upsert a contractor');
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    err.field = 'email';
    throw err;
  }
  if (!firstName && !lastName) {
    const err = new Error('At least one of firstName / lastName is required');
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    err.field = 'firstName';
    throw err;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;

  // Idempotency: existing non-deleted user wins.
  const existing = await client.user.findFirst({
    where: { email, isDeleted: false },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create User + HrmEmploymentProfile. The User table has @@unique on
  // email so the race is bounded — concurrent creates would surface as
  // a P2002 we let bubble up.
  const created = await client.user.create({
    data: {
      name: displayName,
      email,
      username: email,
      hasSystemAccess: false,
      isActive: true,
      isDeleted: false,
    },
    select: { id: true },
  });

  await client.hrmEmploymentProfile.create({
    data: {
      userId: created.id,
      employeeCode: generateEmployeeCode(),
      employmentType: 'contractor',
      statusCode: 'active',
      roleTitle: 'Contractor',
      startDate: new Date(),
      authorityLevel: 'CONTRIBUTOR',
      creationSource: source.toUpperCase().includes('IMPORT') ? 'TELECOM_IMPORT' : 'MANUAL',
      isDeleted: false,
      reviewNotesJson: externalRef
        ? { externalRef, source }
        : { source },
    },
  });

  return { id: created.id, created: true };
}
