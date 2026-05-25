// Startup guard: scan route source code for every `assertPermission(ctx, <key>)`
// call, compare with the Permission rows in DB, and warn for any key that is
// referenced by a route but missing from the catalogue.
//
// Prevents the recurrence of the CRM 403 incident (hotfix/crm-403-permission):
// permission keys were added to the route layer (assertPermission calls) but
// never linked into the Permission table because rbac.seed.mjs was not re-run.
// With this guard, any deploy that ships a route requiring an unseed-ed key
// surfaces the gap immediately at boot instead of as a 403 in production.
//
// Non-fatal by design — never throws, never blocks startup. Logs a warning
// the operator can act on (re-run `node prisma/seed/rbac.seed.mjs`).

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Match `assertPermission(<ctx>, '<key>')` where <ctx> may itself be an
// inline object like `{ userId, res }` (commas inside). We accept either a
// `{...}` block or an identifier as the first arg, then capture the quoted
// permission key.
const ASSERT_KEY_REGEX = /assertPermission\s*\(\s*(?:\{[^}]*\}|[^,)]+)\s*,\s*['"]([a-zA-Z0-9_.:-]+)['"]/g;

async function walkMjsFiles(rootDir, skipDirs) {
  const out = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        await visit(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        out.push(full);
      }
    }
  }
  await visit(rootDir);
  return out;
}

export async function extractRequiredPermissionKeys(backendDir) {
  const skipDirs = new Set(['tests', 'node_modules']);
  const files = await walkMjsFiles(backendDir, skipDirs);
  const keys = new Map();
  for (const file of files) {
    let source;
    try {
      source = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of source.matchAll(ASSERT_KEY_REGEX)) {
      const key = match[1];
      if (!keys.has(key)) keys.set(key, relative(backendDir, file));
    }
  }
  return keys;
}

export async function warnOnMissingPermissions(prisma, opts = {}) {
  const backendDir = opts.backendDir ?? dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const logger = opts.logger ?? console;

  let required;
  try {
    required = await extractRequiredPermissionKeys(backendDir);
  } catch (err) {
    logger.warn(`[rbacGuard] scan failed (${err.message}) — skipping check`);
    return { scanned: 0, missing: [] };
  }

  if (required.size === 0) {
    return { scanned: 0, missing: [] };
  }

  let existing;
  try {
    existing = await prisma.permission.findMany({
      where: { key: { in: [...required.keys()] } },
      select: { key: true, isActive: true },
    });
  } catch (err) {
    logger.warn(`[rbacGuard] DB query failed (${err.message}) — skipping check`);
    return { scanned: required.size, missing: [] };
  }

  const presentActive = new Set(existing.filter((p) => p.isActive).map((p) => p.key));
  const missing = [...required.entries()]
    .filter(([key]) => !presentActive.has(key))
    .map(([key, file]) => ({ key, file }));

  if (missing.length > 0) {
    logger.warn(
      `[rbacGuard] ⚠ ${missing.length}/${required.size} permission key(s) referenced by routes are MISSING or inactive in DB:`,
    );
    for (const { key, file } of missing) {
      logger.warn(`  - ${key}  (used in ${file})`);
    }
    logger.warn('[rbacGuard] → run `node prisma/seed/rbac.seed.mjs` to sync the catalogue.');
  }

  return { scanned: required.size, missing };
}
