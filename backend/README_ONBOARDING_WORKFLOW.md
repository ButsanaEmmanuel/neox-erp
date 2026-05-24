# Workflow Onboarding & Acces Automatises

## Endpoints attendus

1. `POST /api/v1/hrm/recruitment/:candidateId/provision-access`
- Input: `{ professionalEmail: string }`
- Effet: transition recrutement -> onboarding + creation user + assignation role + audit + event email (transaction unique).

2. `POST /api/v1/auth/login`
- Output inclut `user.forcePasswordChange`.
- Si `true`, le front redirige vers `/change-password`.

3. `POST /api/v1/auth/change-password`
- Input: `{ currentPassword: string, newPassword: string }`
- Effet: update hash + `forcePasswordChange=false` + audit.

## Services backend ajoutes

- `backend/services/hrm/recruitmentOnboarding.service.mjs`
- `backend/services/auth/firstLogin.service.mjs`
- `backend/services/notifications/welcomeEmail.service.mjs`
- `backend/services/security/password.service.mjs`

## BDD

- Nouveaux modeles Prisma:
  - `RecruitmentCandidate`
  - `AccessProvisioning`
- Champs securite users:
  - `username`
  - `passwordHash`
  - `forcePasswordChange`
  - `passwordChangedAt`
- Trigger SQL:
  - `prisma/sql/recruitment_onboarding_trigger.sql`
