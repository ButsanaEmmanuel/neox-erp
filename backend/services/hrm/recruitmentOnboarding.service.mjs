import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { generateTemporaryPassword, hashPassword } from '../security/password.service.mjs';
import {
  createChecklistFromTemplate as createOnboardingChecklistFromTemplate,
  resolveTemplateForDepartment as resolveOnboardingTemplate,
} from './onboarding.service.mjs';

const prisma = new PrismaClient();

// Atomic workflow inside one prisma.$transaction:
//   1) Move candidate status to hired/onboarding
//   2) Create user with temp password hash and force_password_change=true
//   3) Assign contributor role + recruitment department
//   4) Write audit logs
//   5) Queue welcome email event
//
// HRM-2.2 — Post-transaction (best-effort, never blocks the hire):
//   6) Resolve an onboarding template:
//        a. explicit input.onboardingTemplateId wins
//        b. otherwise the active template for the user's department
//        c. otherwise a global (departmentId IS NULL) active template
//        d. nothing found -> skip silently
//   7) Create the OnboardingChecklist from the resolved template.
//      Any failure is logged with console.warn and swallowed; the
//      employee remains created. The returned object carries
//      onboardingChecklistId on success, otherwise undefined.
export async function transitionCandidateToOnboarding(input, targetStatus = 'onboarding') {
  const normalizedUsername = input.professionalEmail.trim().toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  const temporaryPasswordHash = hashPassword(temporaryPassword);
  const txId = randomUUID();

  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.recruitmentCandidate.findUnique({
      where: { id: input.candidateId },
    });

    if (!candidate || candidate.isDeleted) {
      throw new Error('Candidate not found.');
    }

    if (!['offer', 'hired', 'onboarding'].includes(candidate.statusCode)) {
      throw new Error(`Cannot provision access from status "${candidate.statusCode}".`);
    }

    const contributorRole =
      (await tx.role.findFirst({
        where: { code: 'CONTRIBUTOR', isDeleted: false, isActive: true },
      })) ??
      (await tx.role.findFirst({
        where: { code: 'USER', isDeleted: false, isActive: true },
      }));

    if (!contributorRole) {
      throw new Error('No default onboarding role found (CONTRIBUTOR/USER).');
    }

    const createdUser = await tx.user.create({
      data: {
        name: candidate.fullName,
        email: normalizedUsername,
        username: normalizedUsername,
        passwordHash: temporaryPasswordHash,
        forcePasswordChange: true,
        departmentId: candidate.recruitmentDepartmentId,
      },
    });

    await tx.hrmEmploymentProfile.create({
      data: {
        userId: createdUser.id,
        employeeCode: `EMP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
        employmentType: 'employee',
        statusCode: 'onboarding',
        roleTitle: candidate.position || 'Contributeur',
        startDate: new Date(),
        authorityLevel: 'CONTRIBUTOR',
        creationSource: 'RECRUITMENT',
        isDeleted: false,
      },
    });

    await tx.userRole.create({
      data: {
        userId: createdUser.id,
        roleId: contributorRole.id,
      },
    });

    await tx.recruitmentCandidate.update({
      where: { id: candidate.id },
      data: {
        statusCode: targetStatus,
        hiredUserId: createdUser.id,
        hiredAt: candidate.hiredAt ?? new Date(),
      },
    });

    await tx.accessProvisioning.create({
      data: {
        candidateId: candidate.id,
        userId: createdUser.id,
        statusCode: 'provisioned',
      },
    });

    await tx.auditLog.createMany({
      data: [
        {
          txId,
          userId: input.actorUserId,
          module: 'hrm',
          entity: 'recruitment_candidate',
          entityId: candidate.id,
          actionType: 'STATUS_CHANGED_TO_ONBOARDING',
          oldValueJson: { statusCode: candidate.statusCode },
          newValueJson: { statusCode: targetStatus },
        },
        {
          txId,
          userId: input.actorUserId,
          module: 'hrm',
          entity: 'user',
          entityId: createdUser.id,
          actionType: 'ACCOUNT_PROVISIONED',
          oldValueJson: null,
          newValueJson: {
            username: createdUser.username,
            departmentId: createdUser.departmentId,
            forcePasswordChange: createdUser.forcePasswordChange,
          },
        },
      ],
    });

    await tx.domainEvent.create({
      data: {
        txId,
        eventType: 'hrm.onboarding.access_email.requested',
        payloadJson: {
          to: normalizedUsername,
          template: 'welcome-access',
          companyName: input.companyName,
          appUrl: input.appUrl,
          username: normalizedUsername,
          temporaryPassword,
          instruction:
            'Pour votre securite, il vous sera demande de modifier ce mot de passe lors de votre premiere connexion.',
        },
      },
    });

    return {
      candidateId: candidate.id,
      userId: createdUser.id,
      username: normalizedUsername,
      temporaryPassword,
      departmentId: candidate.recruitmentDepartmentId,
    };
  });

  // ────────────────────────────────────────────────────────────────
  // Post-transaction onboarding-checklist hook (HRM-2.2).
  // Best-effort: a failure here MUST NOT undo the hire.
  // ────────────────────────────────────────────────────────────────
  let onboardingChecklistId;
  try {
    let templateId = input.onboardingTemplateId ?? null;
    if (!templateId) {
      templateId = await resolveOnboardingTemplate(prisma, result.departmentId);
    }
    if (templateId) {
      const checklist = await createOnboardingChecklistFromTemplate(prisma, {
        userId: result.userId,
        templateId,
        startDate: input.startDate ?? new Date(),
      });
      onboardingChecklistId = checklist.id;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[transitionCandidateToOnboarding] onboarding checklist hook failed for user ${result.userId} (candidate ${result.candidateId}):`,
      err?.message ?? err,
    );
  }

  return { ...result, onboardingChecklistId };
}
