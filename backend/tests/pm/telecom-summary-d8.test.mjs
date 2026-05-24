// D8 — computeTelecomSummary.incompleteItems: OR → AND
// Smoke test of the filter predicate (mirrors src/services/pm/telecomSummary.service.ts:28).
// Frontend TS not bundled here — replicate the predicate verbatim to lock semantics.

import assert from 'node:assert/strict';

const isIncomplete = (wi) =>
  wi.status === 'needs_manual_completion' && wi.manual_completion_status !== 'complete';

const countIncomplete = (rows) => rows.filter(isIncomplete).length;

// Fixture: 5 work items covering the meaningful combinations.
const items = [
  { id: 'a', status: 'needs_manual_completion', manual_completion_status: 'pending' },  // ✓ incomplete (both conditions)
  { id: 'b', status: 'needs_manual_completion', manual_completion_status: 'complete' }, // ✗ done manually
  { id: 'c', status: 'finance_synced',          manual_completion_status: 'pending' },  // ✗ NOT needs_manual (was false-positive under OR)
  { id: 'd', status: 'finance_synced',          manual_completion_status: 'complete' }, // ✗ fully done
  { id: 'e', status: 'finance_synced',          manual_completion_status: null      },  // ✗ NOT needs_manual (was false-positive under OR)
];

// Case 1 — full fixture: AND keeps only the one truly-incomplete row.
assert.equal(countIncomplete(items), 1, 'AND filter should count exactly 1 incomplete row');

// Case 2 — only one matching row: AND returns 1, demonstrates both predicates required.
assert.equal(
  countIncomplete([
    { status: 'needs_manual_completion', manual_completion_status: 'pending' },
  ]),
  1,
  'single needs_manual+pending row → incomplete'
);

// Case 3 — empty input: 0.
assert.equal(countIncomplete([]), 0, 'empty input → 0');

// Regression assertion — Helios One observed 100 vs 94: prove the 6-item gap closes
// when 6 finance_synced rows with non-"complete" manual_completion_status are present.
const heliosLike = [
  ...Array.from({ length: 94 }, () => ({ status: 'needs_manual_completion', manual_completion_status: 'pending' })),
  ...Array.from({ length: 6 },  () => ({ status: 'finance_synced',          manual_completion_status: 'pending' })),
];
assert.equal(countIncomplete(heliosLike), 94, 'Helios-like regression: AND yields 94, not 100');

console.log('✓ D8 telecom-summary AND filter — 4 assertions OK');
