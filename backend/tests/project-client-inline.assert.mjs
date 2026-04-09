import assert from 'node:assert/strict';
import { createClientInline, suggestClientDuplicates } from '../services/crm/clientInline.service.mjs';

const seed = [
  { id: 'cli-1', name: 'Acme Corp', email: 'ops@acme.com' },
  { id: 'cli-2', name: 'Orange Telecom DRC', taxRegistrationNumber: 'TAX-77' },
];

const dupes = suggestClientDuplicates(seed, { name: 'Orange Telecom DRC' });
assert.equal(dupes.length, 1);

const created = createClientInline(seed, { name: 'NeoTel Field Ops' }, 'user-1');
assert.equal(created.created.name, 'NeoTel Field Ops');
assert.equal(created.created.profileStatus, 'needs_completion');
assert.equal(created.clients[0].name, 'NeoTel Field Ops');

let duplicateError = '';
try {
  createClientInline(seed, { name: 'Acme Corp' }, 'user-2');
} catch (error) {
  duplicateError = error.message;
}
assert.ok(duplicateError.includes('already exists'));

console.log('inline client assertions passed');
