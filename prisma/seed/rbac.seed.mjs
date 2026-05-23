// HRM-1.1 — Seed RBAC catalogue (permissions atomiques + rôles prédéfinis).
//
// Run standalone: node prisma/seed/rbac.seed.mjs
// Or import { seedRbac } from this file and call inside prisma/seed.ts.
//
// Idempotent: safe to re-run. Permissions are upserted by `key`; roles
// by `code`; role-permission links by (roleId, permissionId, scopeType,
// scopeValue) — global scope uses NULL for scopeType/scopeValue.
//
// UserRole adaptation (validated 2026-05-23): the model uses a temporal
// uniqueness pattern @@unique([userId, roleId, validFrom]), so we do
// NOT upsert on (userId, roleId). Instead we look for an existing active
// assignment (validTo IS NULL) and create only if absent — see
// assignRoleIfMissing() below.

import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

const prisma = new PrismaClient();

// ============================================================
// Catalogue complet des permissions atomiques.
// Format: <module>.<resource>.<action>
// ============================================================

export const PERMISSIONS = [
  // --- HRM ---
  { module: 'hrm', resource: 'directory',     action: 'read',    description: "Voir l'annuaire des employés" },
  { module: 'hrm', resource: 'directory',     action: 'write',   description: 'Créer et modifier des employés' },
  { module: 'hrm', resource: 'directory',     action: 'delete',  description: 'Archiver des employés' },
  { module: 'hrm', resource: 'employees',     action: 'read',    description: 'Voir les profils employés' },
  { module: 'hrm', resource: 'employees',     action: 'write',   description: 'Modifier les profils employés' },
  { module: 'hrm', resource: 'employees',     action: 'delete',  description: 'Supprimer des profils employés' },
  { module: 'hrm', resource: 'departments',   action: 'read',    description: 'Voir les départements' },
  { module: 'hrm', resource: 'departments',   action: 'write',   description: 'Créer et modifier des départements' },
  { module: 'hrm', resource: 'contractors',   action: 'read',    description: 'Voir les contractors' },
  { module: 'hrm', resource: 'contractors',   action: 'write',   description: 'Créer et modifier des contractors' },
  { module: 'hrm', resource: 'leave',         action: 'read',    description: 'Voir les demandes de congé' },
  { module: 'hrm', resource: 'leave',         action: 'write',   description: 'Soumettre une demande de congé' },
  { module: 'hrm', resource: 'leave',         action: 'execute', description: 'Approuver ou rejeter des congés' },
  { module: 'hrm', resource: 'leave',         action: 'admin',   description: 'Gérer les politiques et soldes de congé' },
  { module: 'hrm', resource: 'timesheets',    action: 'read',    description: 'Voir les feuilles de temps' },
  { module: 'hrm', resource: 'timesheets',    action: 'write',   description: 'Saisir des heures' },
  { module: 'hrm', resource: 'timesheets',    action: 'execute', description: 'Valider des feuilles de temps' },
  { module: 'hrm', resource: 'recruitment',   action: 'read',    description: 'Voir le pipeline de recrutement' },
  { module: 'hrm', resource: 'recruitment',   action: 'write',   description: 'Créer offres et candidats' },
  { module: 'hrm', resource: 'recruitment',   action: 'execute', description: 'Marquer embauché ou rejeté' },
  { module: 'hrm', resource: 'onboarding',    action: 'read',    description: "Voir les checklists d'onboarding" },
  { module: 'hrm', resource: 'onboarding',    action: 'write',   description: "Créer des templates d'onboarding" },
  { module: 'hrm', resource: 'onboarding',    action: 'execute', description: "Compléter des tâches d'onboarding" },
  { module: 'hrm', resource: 'offboarding',   action: 'read',    description: "Voir les checklists d'offboarding" },
  { module: 'hrm', resource: 'offboarding',   action: 'write',   description: "Créer des templates d'offboarding" },
  { module: 'hrm', resource: 'offboarding',   action: 'execute', description: "Compléter des tâches d'offboarding" },
  { module: 'hrm', resource: 'training',      action: 'read',    description: 'Voir les formations' },
  { module: 'hrm', resource: 'training',      action: 'write',   description: 'Créer des formations' },
  { module: 'hrm', resource: 'training',      action: 'execute', description: 'Inscrire des employés aux formations' },
  { module: 'hrm', resource: 'policies',      action: 'read',    description: 'Voir les politiques RH' },
  { module: 'hrm', resource: 'policies',      action: 'write',   description: 'Rédiger des politiques RH' },
  { module: 'hrm', resource: 'policies',      action: 'execute', description: 'Publier ou archiver des politiques' },
  { module: 'hrm', resource: 'cases',         action: 'read',    description: 'Voir les cas RH' },
  { module: 'hrm', resource: 'cases',         action: 'write',   description: 'Ouvrir des cas RH' },
  { module: 'hrm', resource: 'cases',         action: 'execute', description: 'Escalader ou clôturer des cas' },
  { module: 'hrm', resource: 'payroll',       action: 'read',    description: 'Voir la paie' },
  { module: 'hrm', resource: 'payroll',       action: 'write',   description: 'Modifier les éléments de paie' },
  { module: 'hrm', resource: 'payroll',       action: 'execute', description: 'Lancer ou approuver un batch payroll' },
  { module: 'hrm', resource: 'configuration', action: 'read',    description: 'Voir la configuration RH' },
  { module: 'hrm', resource: 'configuration', action: 'write',   description: 'Modifier la configuration RH' },

  // --- PM ---
  { module: 'pm', resource: 'projects',   action: 'read',    description: 'Voir les projets' },
  { module: 'pm', resource: 'projects',   action: 'write',   description: 'Créer et modifier des projets' },
  { module: 'pm', resource: 'projects',   action: 'delete',  description: 'Archiver des projets' },
  { module: 'pm', resource: 'projects',   action: 'execute', description: 'Clôturer des projets' },
  { module: 'pm', resource: 'workItems',  action: 'read',    description: 'Voir les work items' },
  { module: 'pm', resource: 'workItems',  action: 'write',   description: 'Créer et modifier des work items' },
  { module: 'pm', resource: 'workItems',  action: 'delete',  description: 'Supprimer des work items' },
  { module: 'pm', resource: 'workItems',  action: 'execute', description: 'Soumettre QA / approuver / signer' },
  { module: 'pm', resource: 'milestones', action: 'read',    description: 'Voir les jalons' },
  { module: 'pm', resource: 'milestones', action: 'write',   description: 'Créer et modifier des jalons' },
  { module: 'pm', resource: 'milestones', action: 'execute', description: 'Marquer un jalon complet' },
  { module: 'pm', resource: 'documents',  action: 'read',    description: 'Voir les documents projet' },
  { module: 'pm', resource: 'documents',  action: 'write',   description: 'Uploader des documents' },
  { module: 'pm', resource: 'documents',  action: 'delete',  description: 'Supprimer des documents' },
  { module: 'pm', resource: 'scope',      action: 'read',    description: 'Voir le scope projet' },
  { module: 'pm', resource: 'scope',      action: 'write',   description: 'Modifier le scope projet' },
  { module: 'pm', resource: 'import',     action: 'execute', description: 'Lancer un import bulk télécom' },
  { module: 'pm', resource: 'finance',    action: 'read',    description: 'Voir les entrées finance liées au projet' },
  { module: 'pm', resource: 'finance',    action: 'execute', description: 'Pousser une sync finance' },

  // --- Finance ---
  { module: 'finance', resource: 'ledger',   action: 'read',    description: 'Voir le grand livre' },
  { module: 'finance', resource: 'ledger',   action: 'write',   description: 'Modifier des entrées comptables' },
  { module: 'finance', resource: 'ledger',   action: 'execute', description: 'Valider et réconcilier des entrées' },
  { module: 'finance', resource: 'payroll',  action: 'read',    description: 'Voir les données de paie' },
  { module: 'finance', resource: 'payroll',  action: 'execute', description: 'Approuver des traitements de paie' },
  { module: 'finance', resource: 'expenses', action: 'read',    description: 'Voir les notes de frais' },
  { module: 'finance', resource: 'expenses', action: 'write',   description: 'Soumettre des notes de frais' },
  { module: 'finance', resource: 'expenses', action: 'execute', description: 'Approuver des notes de frais' },
  { module: 'finance', resource: 'advances', action: 'read',    description: 'Voir les avances' },
  { module: 'finance', resource: 'advances', action: 'write',   description: 'Demander des avances' },
  { module: 'finance', resource: 'advances', action: 'execute', description: 'Approuver des avances' },
  { module: 'finance', resource: 'reports',  action: 'read',    description: 'Voir les rapports financiers' },
  { module: 'finance', resource: 'reports',  action: 'execute', description: 'Générer et exporter des rapports' },

  // --- SCM ---
  { module: 'scm', resource: 'suppliers',      action: 'read',    description: 'Voir les fournisseurs' },
  { module: 'scm', resource: 'suppliers',      action: 'write',   description: 'Gérer les fournisseurs' },
  { module: 'scm', resource: 'suppliers',      action: 'delete',  description: 'Archiver des fournisseurs' },
  { module: 'scm', resource: 'purchaseOrders', action: 'read',    description: 'Voir les bons de commande' },
  { module: 'scm', resource: 'purchaseOrders', action: 'write',   description: 'Créer des bons de commande' },
  { module: 'scm', resource: 'purchaseOrders', action: 'execute', description: 'Approuver et émettre des bons de commande' },
  { module: 'scm', resource: 'inventory',      action: 'read',    description: 'Voir le stock' },
  { module: 'scm', resource: 'inventory',      action: 'write',   description: 'Modifier le stock' },
  { module: 'scm', resource: 'contracts',      action: 'read',    description: 'Voir les contrats fournisseurs' },
  { module: 'scm', resource: 'contracts',      action: 'write',   description: 'Rédiger des contrats fournisseurs' },
  { module: 'scm', resource: 'contracts',      action: 'execute', description: 'Signer ou résilier des contrats' },

  // --- HSE ---
  { module: 'hse', resource: 'incidents',   action: 'read',    description: 'Voir les incidents HSE' },
  { module: 'hse', resource: 'incidents',   action: 'write',   description: 'Déclarer des incidents HSE' },
  { module: 'hse', resource: 'incidents',   action: 'execute', description: 'Clôturer ou escalader des incidents' },
  { module: 'hse', resource: 'inspections', action: 'read',    description: 'Voir les inspections' },
  { module: 'hse', resource: 'inspections', action: 'write',   description: 'Planifier des inspections' },
  { module: 'hse', resource: 'inspections', action: 'execute', description: 'Valider des inspections' },
  { module: 'hse', resource: 'reports',     action: 'read',    description: 'Voir les rapports HSE' },
  { module: 'hse', resource: 'reports',     action: 'execute', description: 'Générer des rapports HSE' },

  // --- Système ---
  { module: 'system', resource: 'rbac',     action: 'read',    description: 'Voir les rôles et permissions' },
  { module: 'system', resource: 'rbac',     action: 'write',   description: 'Créer et modifier des rôles' },
  { module: 'system', resource: 'rbac',     action: 'execute', description: 'Assigner des rôles et overrides' },
  { module: 'system', resource: 'audit',    action: 'read',    description: "Voir les logs d'audit" },
  { module: 'system', resource: 'settings', action: 'read',    description: 'Voir la configuration système' },
  { module: 'system', resource: 'settings', action: 'write',   description: 'Modifier la configuration système' },
].map((p) => ({ ...p, key: `${p.module}.${p.resource}.${p.action}` }));

// ============================================================
// Rôles prédéfinis. `keys` = liste des Permission.key incluses.
// ============================================================

const ALL_KEYS    = PERMISSIONS.map((p) => p.key);
const HRM_KEYS    = PERMISSIONS.filter((p) => p.module === 'hrm').map((p) => p.key);
const PM_KEYS     = PERMISSIONS.filter((p) => p.module === 'pm').map((p) => p.key);
const FIN_KEYS    = PERMISSIONS.filter((p) => p.module === 'finance').map((p) => p.key);
const SCM_KEYS    = PERMISSIONS.filter((p) => p.module === 'scm').map((p) => p.key);
const READ_KEYS   = PERMISSIONS.filter((p) => p.action === 'read').map((p) => p.key);

export const ROLES = [
  {
    code: 'super_admin',
    label: 'Super Administrateur',
    description: 'Accès complet à toutes les fonctionnalités',
    isSystem: true,
    keys: ALL_KEYS,
  },
  {
    code: 'hr_admin',
    label: 'Administrateur RH',
    description: 'Accès complet au module HRM et à la gestion des accès',
    isSystem: true,
    keys: [
      ...HRM_KEYS,
      'system.rbac.read', 'system.rbac.write', 'system.rbac.execute',
      'system.audit.read',
    ],
  },
  {
    code: 'hr_officer',
    label: 'Chargé RH',
    description: 'Gestion opérationnelle RH sans accès paie ni configuration',
    isSystem: true,
    keys: [
      'hrm.directory.read', 'hrm.directory.write',
      'hrm.employees.read', 'hrm.employees.write',
      'hrm.departments.read',
      'hrm.contractors.read', 'hrm.contractors.write',
      'hrm.leave.read', 'hrm.leave.write', 'hrm.leave.execute', 'hrm.leave.admin',
      'hrm.timesheets.read', 'hrm.timesheets.execute',
      'hrm.recruitment.read', 'hrm.recruitment.write', 'hrm.recruitment.execute',
      'hrm.onboarding.read', 'hrm.onboarding.write', 'hrm.onboarding.execute',
      'hrm.offboarding.read', 'hrm.offboarding.write', 'hrm.offboarding.execute',
      'hrm.training.read', 'hrm.training.write', 'hrm.training.execute',
      'hrm.policies.read', 'hrm.policies.write', 'hrm.policies.execute',
      'hrm.cases.read', 'hrm.cases.write', 'hrm.cases.execute',
    ],
  },
  {
    code: 'employee_self_service',
    label: 'Employé (self-service)',
    description: 'Accès self-service employé standard',
    isSystem: true,
    keys: [
      'hrm.leave.read', 'hrm.leave.write',
      'hrm.timesheets.write',
      'hrm.policies.read',
      'hrm.training.read',
      'hrm.onboarding.execute',
      'hrm.offboarding.execute',
    ],
  },
  {
    code: 'project_manager',
    label: 'Chef de projet',
    description: 'Accès complet au module PM + lecture finance et annuaire',
    isSystem: true,
    keys: [
      ...PM_KEYS,
      'finance.ledger.read',
      'finance.expenses.read',
      'hrm.directory.read',
      'hrm.employees.read',
    ],
  },
  {
    code: 'project_member',
    label: 'Membre de projet',
    description: 'Accès opérationnel aux projets assignés',
    isSystem: true,
    keys: [
      'pm.projects.read',
      'pm.workItems.read', 'pm.workItems.write', 'pm.workItems.execute',
      'pm.milestones.read',
      'pm.documents.read', 'pm.documents.write',
      'pm.scope.read',
    ],
  },
  {
    code: 'finance_admin',
    label: 'Administrateur Finance',
    description: 'Accès complet au module Finance incluant la paie',
    isSystem: true,
    keys: [
      ...FIN_KEYS,
      'hrm.payroll.read', 'hrm.payroll.write', 'hrm.payroll.execute',
    ],
  },
  {
    code: 'finance_officer',
    label: 'Agent Finance',
    description: 'Gestion opérationnelle finance sans accès paie',
    isSystem: true,
    keys: [
      'finance.ledger.read',
      'finance.expenses.read', 'finance.expenses.write', 'finance.expenses.execute',
      'finance.advances.read', 'finance.advances.write', 'finance.advances.execute',
      'finance.reports.read',
    ],
  },
  {
    code: 'scm_manager',
    label: 'Responsable SCM',
    description: 'Accès complet au module SCM',
    isSystem: true,
    keys: SCM_KEYS,
  },
  {
    code: 'readonly',
    label: 'Lecture seule',
    description: 'Accès lecture sur tous les modules',
    isSystem: true,
    keys: READ_KEYS,
  },
];

// ============================================================
// Helpers
// ============================================================

async function upsertPermissions(tx) {
  let created = 0;
  let updated = 0;
  for (const p of PERMISSIONS) {
    const existing = await tx.permission.findUnique({ where: { key: p.key } });
    if (existing) {
      await tx.permission.update({
        where: { key: p.key },
        data: {
          module: p.module,
          resource: p.resource,
          action: p.action,
          description: p.description,
          isActive: true,
        },
      });
      updated += 1;
    } else {
      await tx.permission.create({
        data: {
          key: p.key,
          module: p.module,
          resource: p.resource,
          action: p.action,
          description: p.description,
          isActive: true,
        },
      });
      created += 1;
    }
  }
  return { created, updated, total: PERMISSIONS.length };
}

async function upsertRole(tx, role) {
  const existing = await tx.role.findUnique({ where: { code: role.code } });
  if (existing) {
    return tx.role.update({
      where: { code: role.code },
      data: {
        name: role.code,           // keep machine-name in `name` for legacy callers
        label: role.label,
        description: role.description,
        isSystem: role.isSystem,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
    });
  }
  return tx.role.create({
    data: {
      code: role.code,
      name: role.code,
      label: role.label,
      description: role.description,
      isSystem: role.isSystem,
      isActive: true,
      isDeleted: false,
    },
  });
}

// RolePermission has @@unique([roleId, permissionId, scopeType, scopeValue]).
// For global scope (no scopeType/scopeValue), Prisma cannot upsert by the
// composite unique because nulls do not match in PostgreSQL unique indexes.
// Use findFirst + create instead — idempotent.
async function linkRolePermissionsForRole(tx, roleId, keys) {
  const perms = await tx.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const byKey = new Map(perms.map((p) => [p.key, p.id]));
  let linked = 0;
  for (const key of keys) {
    const permissionId = byKey.get(key);
    if (!permissionId) {
      console.warn(`    ⚠ permission missing in catalogue: ${key}`);
      continue;
    }
    const existing = await tx.rolePermission.findFirst({
      where: {
        roleId,
        permissionId,
        scopeType: null,
        scopeValue: null,
      },
    });
    if (!existing) {
      await tx.rolePermission.create({
        data: { roleId, permissionId },
      });
      linked += 1;
    }
  }
  return { linked, total: keys.length };
}

// UserRole has @@unique([userId, roleId, validFrom]) — temporal pattern.
// We do NOT upsert: instead check for any currently active assignment
// (validTo IS NULL) and create only if absent.
async function assignRoleIfMissing(tx, { userId, roleId, assignedBy }) {
  const existing = await tx.userRole.findFirst({
    where: { userId, roleId, validTo: null },
  });
  if (existing) return false;
  await tx.userRole.create({
    data: {
      userId,
      roleId,
      assignedBy: assignedBy ?? null,
      validFrom: new Date(),
      validTo: null,
    },
  });
  return true;
}

// ============================================================
// Main seed
// ============================================================

export async function seedRbac() {
  console.log('🔐 Seeding RBAC permissions and roles...');

  const permResult = await prisma.$transaction(async (tx) => upsertPermissions(tx));
  console.log(
    `  ✅ Permissions: ${permResult.created} created, ${permResult.updated} updated (total ${permResult.total})`,
  );

  for (const role of ROLES) {
    const result = await prisma.$transaction(async (tx) => {
      const saved = await upsertRole(tx, role);
      const links = await linkRolePermissionsForRole(tx, saved.id, role.keys);
      return { saved, links };
    });
    console.log(
      `  ✅ Role ${role.code.padEnd(24)} → ${result.links.linked} new links (${role.keys.length} total permissions)`,
    );
  }

  // Assign super_admin to first non-deleted user if no currently active
  // super_admin assignment exists for them.
  const superAdmin = await prisma.role.findUnique({ where: { code: 'super_admin' } });
  const firstUser = await prisma.user.findFirst({
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' },
  });

  if (superAdmin && firstUser) {
    const created = await assignRoleIfMissing(prisma, {
      userId: firstUser.id,
      roleId: superAdmin.id,
      assignedBy: firstUser.id,
    });
    if (created) {
      console.log(`  ✅ super_admin assigned to first user: ${firstUser.email ?? firstUser.id}`);
    } else {
      console.log(`  ℹ️  First user already has an active super_admin assignment`);
    }
  } else if (!firstUser) {
    console.log('  ℹ️  No user found — skipping super_admin auto-assignment');
  }

  console.log('🎉 RBAC seed complete');
}

// ============================================================
// CLI entry point — works on Windows paths containing spaces by
// going through pathToFileURL (which yields the same encoding as
// import.meta.url, e.g. file:///D:/Mon%20mari/...).
// ============================================================

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedRbac()
    .catch((e) => {
      console.error('❌ RBAC seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
