// HRM-1.4 — Read service for the assignable-employees endpoint.
//
// Sources data from HrmEmploymentProfile joined with User. No new model.
// "Assignable" = profile.statusCode === 'active' AND profile is not
// soft-deleted AND the underlying User is active + not soft-deleted.
//
// Used by:
//   GET /api/v1/hrm/employees?assignable=true[&projectId=...&employmentType=...]
//
// projectId is accepted in the query but does NOT currently restrict
// the set — every active employee/contractor is a potential assignee.
// It is kept in the API surface for forward-compat (e.g. filter by
// project membership once that constraint is needed).

export async function listAssignableEmployees(prisma, { projectId, employmentType } = {}) {
  void projectId; // reserved for future scoping

  const where = {
    isDeleted: false,
    statusCode: 'active',
    user: {
      isDeleted: false,
      isActive: true,
    },
  };
  if (employmentType && typeof employmentType === 'string') {
    where.employmentType = employmentType;
  }

  const profiles = await prisma.hrmEmploymentProfile.findMany({
    where,
    orderBy: [{ employmentType: 'asc' }, { roleTitle: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
        },
      },
    },
  });

  return profiles.map((p) => ({
    id: p.user.id,
    name: p.user.name ?? '',
    email: p.user.email ?? '',
    jobTitle: p.roleTitle ?? '',
    employmentType: p.employmentType,
    departmentId: p.user.departmentId ?? null,
  }));
}
