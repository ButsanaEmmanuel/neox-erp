# Migrations archive — pre-DH6 baseline

These 20 migrations (2026-03-21 → 2026-05-23) were the active history before
DH6 was closed (Sprint Dettes Techniques, 2026-05-24).

They were collapsed into a single `00000000000000_baseline` migration (generated
via `prisma migrate diff --from-empty --to-url $DATABASE_URL --script`) so that
`prisma migrate dev` would stop failing on the shadow DB.

Root cause: `Project`, `WorkItem`, `ProjectMember` (and likely others) were
originally created via `prisma db push` without an initial migration. Every
subsequent migration assumed those tables existed, so the shadow DB (always
built from scratch) choked on the first `ALTER TABLE "Project"` statement.

Kept here for audit/history. **Do not move them back into `prisma/migrations/`**
— their SQL is now subsumed by the baseline, replaying them would either
no-op (idempotent ones) or fail (raw `CREATE TABLE` / `ADD COLUMN` ones).
