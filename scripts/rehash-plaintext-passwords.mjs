// One-shot security fix for D10 (NEOX_PM_PLAN.md).
// Run with: node scripts/rehash-plaintext-passwords.mjs
//
// Re-hashes any User.passwordHash stored in plain-text format (no ':' separator)
// to scrypt format identical to backend/auth-server.mjs:hashPassword.
// Idempotent: subsequent runs report 0 candidates.

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

function hashPassword(plainTextPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainTextPassword, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      isDeleted: false,
      AND: [
        { passwordHash: { not: null } },
        { passwordHash: { not: '' } },
        { NOT: { passwordHash: { contains: ':' } } },
      ],
    },
    select: { id: true, email: true, passwordHash: true },
  });

  console.log(`[D10] Found ${candidates.length} user(s) with plain-text passwordHash`);
  if (candidates.length === 0) {
    console.log('[D10] Nothing to do. Script is idempotent.');
    return;
  }

  console.log('[D10] Candidates (verify before continuing — Ctrl+C within 5s to abort):');
  for (const c of candidates) {
    console.log(`  - ${c.id} | ${c.email || '(no email)'} | hash length: ${c.passwordHash.length}`);
  }
  await new Promise((r) => setTimeout(r, 5000));

  let updated = 0;
  for (const user of candidates) {
    const plainText = user.passwordHash;
    const newHash = hashPassword(plainText);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
    console.log(`[D10] Re-hashed user ${user.id} (${user.email || '(no email)'})`);
    updated += 1;
  }
  console.log(`[D10] Done. ${updated} user(s) re-hashed.`);
}

main()
  .catch((err) => {
    console.error('[D10] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
