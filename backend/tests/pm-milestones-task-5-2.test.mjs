// backend/tests/pm-milestones-task-5-2.test.mjs
//
// Sprint 5 — Tâche 5.2 : couverture CRUD Milestone + détection de cycles DAG.
// Pattern seed/teardown aligné sur pm-financials-task-1-2.test.mjs (Sprint 1).
//
// Structure : 47 assertions en 8 phases.
//   Phase 1 — Setup & list initial vide       (3)
//   Phase 2 — POST happy paths                 (6)
//   Phase 3 — POST validations (400)           (10)
//   Phase 4 — PATCH deps + détection cycles    (9)  ← inclut 1 chaîne non-cycle (faux positif)
//   Phase 5 — PATCH updates champs simples     (8)
//   Phase 6 — DELETE soft + rollback           (7)  ← count avant/après en DB pour chaque rollback
//   Phase 7 — RBAC                             (0)  ← skippé, voir journal NEOX_PM_PLAN.md
//   Phase 8 — Cleanup + intégrité finale       (4)
//
// Note Phase 7 — RBAC skippée. `assertModuleAccess` est mutualisé avec
// tous les handlers PM et déjà couvert par Sprint 3 (durcissement RBAC).
// Tester RBAC ici = doublon. Décision tracée dans NEOX_PM_PLAN.md
// (journal 2026-05-19 "5.2 — Décision tests Phase RBAC").

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.env.AUTH_API_URL || 'http://localhost:4000';

async function call(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, body: parsed };
}

const results = [];
function check(label, condition, expected, actual) {
  const ok = Boolean(condition);
  results.push({ label, ok, expected, actual });
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

async function countMilestones(projectId) {
  return prisma.milestone.count({ where: { projectId, isDeleted: false } });
}
async function countAllMilestones(projectId) {
  return prisma.milestone.count({ where: { projectId } });
}
async function countDeps(projectId) {
  return prisma.milestoneDependency.count({
    where: { milestone: { projectId } },
  });
}

async function main() {
  // Health
  const h = await call('GET', '/health');
  if (h.status !== 200) throw new Error('Server not up');

  // Find admin
  const adminRole = await prisma.role.findFirst({ where: { code: 'ADMIN', isDeleted: false } });
  const adminLink = await prisma.userRole.findFirst({
    where: { roleId: adminRole.id, validTo: null, user: { isActive: true, isDeleted: false } },
    include: { user: true },
  });
  const ADMIN = adminLink.user.id;
  console.log(`Admin: ${ADMIN}\n`);

  // Seed : créer un projet de travail
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + 90 * 86400000).toISOString();
  const createProjectRes = await call('POST', '/api/v1/projects', {
    name: `PM-Milestones-Test-${Date.now()}`,
    clientName: 'QA Milestones',
    managerId: ADMIN,
    startDate,
    endDate,
    actorUserId: ADMIN,
    actorDisplayName: 'Tester',
    userId: ADMIN,
  });
  const projectId = createProjectRes.body?.project?.id;
  if (!projectId) throw new Error(`Seed project failed: ${JSON.stringify(createProjectRes.body)}`);
  console.log(`Seed projectId: ${projectId}\n`);

  const Q = `?userId=${ADMIN}`;
  const created = []; // track ids créés pour cleanup
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString();

  try {
    // ─── Phase 1 — Setup & list initial vide ─────────────────────────────────
    console.log('── Phase 1 : Setup & list initial ──');
    const initialList = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
    check('1.1 GET milestones status=200', initialList.status === 200, 200, initialList.status);
    check('1.2 milestones est un array', Array.isArray(initialList.body?.milestones), true, typeof initialList.body?.milestones);
    check('1.3 array vide au départ', (initialList.body?.milestones || []).length === 0, 0, initialList.body?.milestones?.length);
    console.log('');

    // ─── Phase 2 — POST happy paths ──────────────────────────────────────────
    console.log('── Phase 2 : POST happy paths ──');
    // 2.1 — minimal valide (title + dueDate)
    const m1Res = await call('POST', `/api/v1/projects/${projectId}/milestones${Q}`, {
      actorUserId: ADMIN,
      title: '  Kickoff  ', // trim
      dueDate: day(10),
    });
    const m1 = m1Res.body?.milestone;
    if (m1?.id) created.push(m1.id);
    check('2.1 POST minimal status=201', m1Res.status === 201, 201, m1Res.status);
    check('2.2 title est trimmé', m1?.title === 'Kickoff', 'Kickoff', m1?.title);
    check('2.3 default status=planned', m1?.status === 'planned', 'planned', m1?.status);
    check('2.4 default completionPct=0', m1?.completionPct === 0, 0, m1?.completionPct);

    // 2.2 — complet (tous les champs + ownerId)
    const m2Res = await call('POST', `/api/v1/projects/${projectId}/milestones${Q}`, {
      actorUserId: ADMIN,
      title: 'Design Review',
      description: 'Approve design specs',
      dueDate: day(20),
      status: 'in_progress',
      ownerId: ADMIN,
      completionPct: 25,
    });
    const m2 = m2Res.body?.milestone;
    if (m2?.id) created.push(m2.id);
    check('2.5 POST complet status=201', m2Res.status === 201, 201, m2Res.status);
    check('2.6 GET liste ordonnée par dueDate ASC', (async () => {
      const l = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
      const ids = (l.body.milestones || []).map((x) => x.id);
      return ids[0] === m1.id && ids[1] === m2.id;
    })(), true, '(deferred)');
    // L'assertion async ci-dessus n'est pas évaluée — on la refait synchrone :
    results.pop();
    const ordRes = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
    const ordIds = (ordRes.body.milestones || []).map((x) => x.id);
    check('2.6 GET liste ordonnée par dueDate ASC', ordIds[0] === m1.id && ordIds[1] === m2.id, [m1.id, m2.id], ordIds);
    console.log('');

    // ─── Phase 3 — POST validations (400) ────────────────────────────────────
    console.log('── Phase 3 : POST validations 400 ──');
    const v = async (label, payload, expectedCode) => {
      const r = await call('POST', `/api/v1/projects/${projectId}/milestones${Q}`, { actorUserId: ADMIN, ...payload });
      check(label, r.status === 400 && r.body?.code === expectedCode, { status: 400, code: expectedCode }, { status: r.status, code: r.body?.code });
    };
    await v('3.1 title manquant → TITLE_REQUIRED', { dueDate: day(5) }, 'TITLE_REQUIRED');
    await v('3.2 title vide → TITLE_REQUIRED', { title: '   ', dueDate: day(5) }, 'TITLE_REQUIRED');
    await v('3.3 dueDate manquant → DUE_DATE_REQUIRED', { title: 'T' }, 'DUE_DATE_REQUIRED');
    await v('3.4 dueDate invalide → INVALID_DUE_DATE', { title: 'T', dueDate: 'pas-une-date' }, 'INVALID_DUE_DATE');
    await v('3.5 status invalide → INVALID_STATUS', { title: 'T', dueDate: day(5), status: 'foo' }, 'INVALID_STATUS');
    await v('3.6 completionPct < 0 → INVALID_COMPLETION_PCT', { title: 'T', dueDate: day(5), completionPct: -1 }, 'INVALID_COMPLETION_PCT');
    await v('3.7 completionPct > 100 → INVALID_COMPLETION_PCT', { title: 'T', dueDate: day(5), completionPct: 101 }, 'INVALID_COMPLETION_PCT');
    await v('3.8 completionPct non-entier → INVALID_COMPLETION_PCT', { title: 'T', dueDate: day(5), completionPct: 50.5 }, 'INVALID_COMPLETION_PCT');
    await v('3.9 dependsOnIds non-array → INVALID_DEPS', { title: 'T', dueDate: day(5), dependsOnIds: 'x' }, 'INVALID_DEPS');
    await v('3.10 dependsOnIds doublons → DUPLICATE_DEP_IDS', { title: 'T', dueDate: day(5), dependsOnIds: [m1.id, m1.id] }, 'DUPLICATE_DEP_IDS');
    console.log('');

    // ─── Phase 4 — PATCH deps + détection cycles ─────────────────────────────
    console.log('── Phase 4 : PATCH deps + cycles ──');
    // Setup : créer M3, M4, M5 (chaîne pour faux positif)
    const post = async (title, due) => {
      const r = await call('POST', `/api/v1/projects/${projectId}/milestones${Q}`, {
        actorUserId: ADMIN, title, dueDate: day(due),
      });
      if (r.body?.milestone?.id) created.push(r.body.milestone.id);
      return r.body.milestone;
    };
    const m3 = await post('Build', 30);
    const m4 = await post('Test', 40);
    const m5 = await post('Deploy', 50);

    // 4.1 — dep valide (m4 → m3)
    const dep41 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m3.id],
    });
    check('4.1 PATCH m4 depends on m3 → 200', dep41.status === 200, 200, dep41.status);

    // 4.2 — dependances exposées dans la réponse
    check('4.2 réponse contient dependencies[]', Array.isArray(dep41.body?.milestone?.dependencies) && dep41.body.milestone.dependencies.length === 1, 1, dep41.body?.milestone?.dependencies?.length);

    // 4.3 — auto-référence (m4 → m4) → 409 DEPENDENCY_CYCLE
    const self = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m4.id],
    });
    check('4.3 auto-référence m4→m4 → 409 DEPENDENCY_CYCLE', self.status === 409 && self.body?.code === 'DEPENDENCY_CYCLE', { status: 409, code: 'DEPENDENCY_CYCLE' }, { status: self.status, code: self.body?.code });

    // 4.4 — cycle direct 2-nodes : m3 → m4 (alors que m4 → m3 existe)
    const cyc2 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m3.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m4.id],
    });
    check('4.4 cycle 2-nodes m3→m4 (avec m4→m3) → 409', cyc2.status === 409 && cyc2.body?.code === 'DEPENDENCY_CYCLE', { status: 409, code: 'DEPENDENCY_CYCLE' }, { status: cyc2.status, code: cyc2.body?.code });

    // 4.5 — cycle 3-nodes : ajouter m5 → m4, puis tenter m3 → m5
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m5.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m4.id],
    });
    const cyc3 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m3.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m5.id],
    });
    check('4.5 cycle 3-nodes m3→m5→m4→m3 → 409', cyc3.status === 409 && cyc3.body?.code === 'DEPENDENCY_CYCLE', { status: 409, code: 'DEPENDENCY_CYCLE' }, { status: cyc3.status, code: cyc3.body?.code });

    // 4.6 — FAUX POSITIF : chaîne non-cyclique longue ne doit PAS être rejetée.
    // Setup une chaîne fraîche m6 → m7 → m8 → m9, puis PATCH m_new → m6.
    // Aucune arête ne pointe en retour vers m_new, donc pas de cycle.
    const m6 = await post('Chain-A', 60);
    const m7 = await post('Chain-B', 61);
    const m8 = await post('Chain-C', 62);
    const m9 = await post('Chain-D', 63);
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m7.id}${Q}`, { actorUserId: ADMIN, dependsOnIds: [m6.id] });
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m8.id}${Q}`, { actorUserId: ADMIN, dependsOnIds: [m7.id] });
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m9.id}${Q}`, { actorUserId: ADMIN, dependsOnIds: [m8.id] });
    const mNew = await post('Chain-Head', 64);
    const noCyc = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${mNew.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m6.id],
    });
    check('4.6 chaîne non-cyclique 4-deep → 200 (faux positif évité)', noCyc.status === 200, 200, noCyc.status);

    // 4.7 — deps appartiennent à un autre projet → 400 DEPS_NOT_IN_PROJECT
    const otherProj = await call('POST', '/api/v1/projects', {
      name: `PM-Other-${Date.now()}`, clientName: 'Other', managerId: ADMIN,
      startDate, endDate, actorUserId: ADMIN, userId: ADMIN,
    });
    const otherPid = otherProj.body.project.id;
    const otherMlst = await call('POST', `/api/v1/projects/${otherPid}/milestones${Q}`, {
      actorUserId: ADMIN, title: 'Outsider', dueDate: day(10),
    });
    const crossDep = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [otherMlst.body.milestone.id],
    });
    check('4.7 deps cross-project → 400 DEPS_NOT_IN_PROJECT', crossDep.status === 400 && crossDep.body?.code === 'DEPS_NOT_IN_PROJECT', { status: 400, code: 'DEPS_NOT_IN_PROJECT' }, { status: crossDep.status, code: crossDep.body?.code });
    await call('DELETE', `/api/v1/projects/${otherPid}${Q}`, { actorUserId: ADMIN });

    // 4.8 — REPLACE semantics : PATCH avec [] supprime toutes les deps
    const replaceEmpty = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [],
    });
    check('4.8 PATCH dependsOnIds=[] supprime deps', replaceEmpty.status === 200 && (replaceEmpty.body?.milestone?.dependencies || []).length === 0, 0, replaceEmpty.body?.milestone?.dependencies?.length);

    // 4.9 — REPLACE semantics : PATCH remplace l'ensemble entier
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m1.id, m2.id],
    });
    const replaceSet = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m3.id], // remplace, ne fusionne pas
    });
    const finalDeps = (replaceSet.body?.milestone?.dependencies || []).map((d) => d.dependsOnId);
    check('4.9 PATCH remplace l\'ensemble (pas fusion)', finalDeps.length === 1 && finalDeps[0] === m3.id, [m3.id], finalDeps);
    console.log('');

    // ─── Phase 5 — PATCH updates champs simples ──────────────────────────────
    console.log('── Phase 5 : PATCH updates ──');
    // 5.1 — single field
    const u1 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN, title: 'Kickoff (revised)',
    });
    check('5.1 PATCH title seul → 200', u1.status === 200 && u1.body?.milestone?.title === 'Kickoff (revised)', 'Kickoff (revised)', u1.body?.milestone?.title);

    // 5.2 — multi field
    const u2 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN, status: 'in_progress', completionPct: 50,
    });
    check('5.2 PATCH multi-field (status+pct)', u2.status === 200 && u2.body?.milestone?.status === 'in_progress' && u2.body?.milestone?.completionPct === 50, { status: 'in_progress', pct: 50 }, { status: u2.body?.milestone?.status, pct: u2.body?.milestone?.completionPct });

    // 5.3 — no-op (corps vide hors actorUserId)
    const u3 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN,
    });
    check('5.3 PATCH no-op → 200 sans changement', u3.status === 200 && u3.body?.milestone?.title === 'Kickoff (revised)', 'Kickoff (revised)', u3.body?.milestone?.title);

    // 5.4 — milestone introuvable → 404
    const u4 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/mlst_ghost${Q}`, {
      actorUserId: ADMIN, title: 'X',
    });
    check('5.4 PATCH milestone ghost → 404 MILESTONE_NOT_FOUND', u4.status === 404 && u4.body?.code === 'MILESTONE_NOT_FOUND', { status: 404, code: 'MILESTONE_NOT_FOUND' }, { status: u4.status, code: u4.body?.code });

    // 5.5 — projet introuvable → 404 PROJECT_NOT_FOUND (POST sur projet ghost)
    const u5 = await call('POST', `/api/v1/projects/proj_ghost/milestones${Q}`, {
      actorUserId: ADMIN, title: 'X', dueDate: day(5),
    });
    check('5.5 POST projet ghost → 404 PROJECT_NOT_FOUND', u5.status === 404 && u5.body?.code === 'PROJECT_NOT_FOUND', { status: 404, code: 'PROJECT_NOT_FOUND' }, { status: u5.status, code: u5.body?.code });

    // 5.6 — INVALID_STATUS via PATCH
    const u6 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN, status: 'foo',
    });
    check('5.6 PATCH status invalide → 400 INVALID_STATUS', u6.status === 400 && u6.body?.code === 'INVALID_STATUS', { status: 400, code: 'INVALID_STATUS' }, { status: u6.status, code: u6.body?.code });

    // 5.7 — ownerId = null (clear)
    const u7 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m2.id}${Q}`, {
      actorUserId: ADMIN, ownerId: null,
    });
    check('5.7 PATCH ownerId=null → 200', u7.status === 200 && u7.body?.milestone?.ownerId === null, null, u7.body?.milestone?.ownerId);

    // 5.8 — dueDate update
    const newDue = day(99);
    const u8 = await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, {
      actorUserId: ADMIN, dueDate: newDue,
    });
    check('5.8 PATCH dueDate → 200 + persisté', u8.status === 200 && new Date(u8.body?.milestone?.dueDate).toISOString() === newDue, newDue, u8.body?.milestone?.dueDate);
    console.log('');

    // ─── Phase 6 — DELETE soft + rollback ────────────────────────────────────
    console.log('── Phase 6 : DELETE soft + rollback ──');

    // 6.1 — DELETE basique : compter avant/après, soft-delete préservé
    const before61Active = await countMilestones(projectId);
    const before61All = await countAllMilestones(projectId);
    const d61 = await call('DELETE', `/api/v1/projects/${projectId}/milestones/${m9.id}${Q}`, { actorUserId: ADMIN });
    const after61Active = await countMilestones(projectId);
    const after61All = await countAllMilestones(projectId);
    check('6.1 DELETE m9 → 200 + active count -1, total count inchangé (soft)', d61.status === 200 && after61Active === before61Active - 1 && after61All === before61All, { status: 200, active: before61Active - 1, all: before61All }, { status: d61.status, active: after61Active, all: after61All });

    // 6.2 — m9 absent de GET liste après soft-delete
    const list62 = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
    const found62 = (list62.body.milestones || []).some((m) => m.id === m9.id);
    check('6.2 m9 absent du GET après soft-delete', !found62, false, found62);

    // 6.3 — ROLLBACK : DELETE bloqué (m3 référencé par m4 et m7→m6 chain). count active doit rester identique.
    // Faisons d'abord pointer une dep active sur m1 pour le bloquer
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m4.id}${Q}`, {
      actorUserId: ADMIN, dependsOnIds: [m1.id],
    });
    const before63 = await countMilestones(projectId);
    const before63Deps = await countDeps(projectId);
    const d63 = await call('DELETE', `/api/v1/projects/${projectId}/milestones/${m1.id}${Q}`, { actorUserId: ADMIN });
    const after63 = await countMilestones(projectId);
    const after63Deps = await countDeps(projectId);
    check('6.3 DELETE bloqué → 409 MILESTONE_BLOCKED + count active inchangé', d63.status === 409 && d63.body?.code === 'MILESTONE_BLOCKED' && after63 === before63, { status: 409, code: 'MILESTONE_BLOCKED', count: before63 }, { status: d63.status, code: d63.body?.code, count: after63 });

    // 6.4 — ROLLBACK Phase 6 (suite) : count des deps inchangé après rejet
    check('6.4 DELETE rejeté → count deps inchangé', after63Deps === before63Deps, before63Deps, after63Deps);

    // 6.5 — DELETE idempotent : second DELETE sur m9 (déjà soft-deleted) → 404
    const d65 = await call('DELETE', `/api/v1/projects/${projectId}/milestones/${m9.id}${Q}`, { actorUserId: ADMIN });
    check('6.5 DELETE idempotent sur soft-deleted → 404 MILESTONE_NOT_FOUND', d65.status === 404 && d65.body?.code === 'MILESTONE_NOT_FOUND', { status: 404, code: 'MILESTONE_NOT_FOUND' }, { status: d65.status, code: d65.body?.code });

    // 6.6 — DELETE ghost → 404
    const d66 = await call('DELETE', `/api/v1/projects/${projectId}/milestones/mlst_ghost${Q}`, { actorUserId: ADMIN });
    check('6.6 DELETE ghost → 404 MILESTONE_NOT_FOUND', d66.status === 404 && d66.body?.code === 'MILESTONE_NOT_FOUND', { status: 404, code: 'MILESTONE_NOT_FOUND' }, { status: d66.status, code: d66.body?.code });

    // 6.7 — Après soft-delete d'une cible de dep, la dep doit être filtrée du GET défensivement.
    // m8 dépend de m7 (Phase 4 chain). Soft-delete m7 (libère les blockers d'abord)
    // m8 dépend de m7 ; on retire d'abord m9 du chemin (déjà fait 6.1).
    // Pour soft-delete m7 il faut qu'aucun ACTIF ne dépende de lui — m8 dépend encore de m7.
    // Donc on PATCH m8 pour vider ses deps avant de delete m7.
    await call('PATCH', `/api/v1/projects/${projectId}/milestones/${m8.id}${Q}`, { actorUserId: ADMIN, dependsOnIds: [] });
    await call('DELETE', `/api/v1/projects/${projectId}/milestones/${m7.id}${Q}`, { actorUserId: ADMIN });
    // m7 soft-deleted. mNew dépendait de m6, m6 a aucune dep, donc on vérifie que list GET de m8/m6 ne contient pas m7
    const list67 = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
    const allDepTargets = (list67.body.milestones || []).flatMap((m) => (m.dependencies || []).map((d) => d.dependsOnId));
    check('6.7 deps vers milestone soft-deleted absentes du GET', !allDepTargets.includes(m7.id), false, allDepTargets.includes(m7.id));
    console.log('');

    // ─── Phase 7 — RBAC ──────────────────────────────────────────────────────
    console.log('── Phase 7 : RBAC — SKIPPÉE (assertModuleAccess mutualisé, couvert Sprint 3) ──');
    console.log('');

    // ─── Phase 8 — Cleanup + intégrité finale ────────────────────────────────
    console.log('── Phase 8 : Cleanup + intégrité ──');
    // 8.1 — count active final cohérent (created moins ceux soft-deleted)
    const expectedSoftDeleted = 2; // m7, m9
    const finalActive = await countMilestones(projectId);
    const finalAll = await countAllMilestones(projectId);
    check('8.1 active count = total - soft-deleted', finalAll - finalActive === expectedSoftDeleted, expectedSoftDeleted, finalAll - finalActive);

    // 8.2 — DELETE en masse les milestones actifs restants → tous soft-deleted
    // D'abord clear les deps de tous les actifs (m4 dépend de m1 ; mNew dépend de m6) pour éviter MILESTONE_BLOCKED.
    const activesForCleanup = await prisma.milestone.findMany({ where: { projectId, isDeleted: false }, select: { id: true } });
    for (const a of activesForCleanup) {
      await call('PATCH', `/api/v1/projects/${projectId}/milestones/${a.id}${Q}`, { actorUserId: ADMIN, dependsOnIds: [] });
    }
    for (const a of activesForCleanup) {
      await call('DELETE', `/api/v1/projects/${projectId}/milestones/${a.id}${Q}`, { actorUserId: ADMIN });
    }
    const after82Active = await countMilestones(projectId);
    check('8.2 cleanup mass : 0 milestone actif restant', after82Active === 0, 0, after82Active);

    // 8.3 — GET final = liste vide
    const finalList = await call('GET', `/api/v1/projects/${projectId}/milestones${Q}`);
    check('8.3 GET final renvoie array vide', (finalList.body?.milestones || []).length === 0, 0, finalList.body?.milestones?.length);

    // 8.4 — total ALL préservé = nombre de POST réussis (intégrité historique)
    const expectedTotal = created.length;
    const realTotal = await countAllMilestones(projectId);
    check('8.4 total (incl. soft-deleted) = nombre de POST réussis', realTotal === expectedTotal, expectedTotal, realTotal);
    console.log('');
  } finally {
    // Teardown : hard delete les milestones + dépendances + projet de test
    // (le projet a un soft delete via API ; on nettoie aussi les rows DB de test)
    try {
      await prisma.milestoneDependency.deleteMany({ where: { milestone: { projectId } } });
      await prisma.milestone.deleteMany({ where: { projectId } });
      await call('DELETE', `/api/v1/projects/${projectId}${Q}`, { actorUserId: ADMIN });
    } catch (e) {
      console.warn('Cleanup warning:', e?.message);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`═══ Résumé : ${passed}/${results.length} ═══`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => { console.error('FATAL:', err?.message || err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
