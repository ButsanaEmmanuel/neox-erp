import assert from 'node:assert/strict';
import { calculateTelecomAmounts } from '../services/projects/telecom-calculation.mjs';
import { validateTelecomRows } from '../services/projects/telecom-import-validation.mjs';

const blockedByQa = calculateTelecomAmounts({ po_unit_price: 120.5, ticket_number: 4, qa_status: 'pending', acceptance_signed: true });
assert.equal(blockedByQa.is_financially_eligible, false);
assert.equal(blockedByQa.po_unit_price_completed, 120.5);

const blockedByAcceptance = calculateTelecomAmounts({ po_unit_price: 120.5, ticket_number: 4, qa_status: 'approved', acceptance_signed: false });
assert.equal(blockedByAcceptance.is_financially_eligible, false);
assert.equal(blockedByAcceptance.po_unit_price_completed, 0);
assert.equal(blockedByAcceptance.contractor_payable_amount, 0);

const eligible = calculateTelecomAmounts({ po_unit_price: 120.5, ticket_number: 4, qa_status: 'approved', acceptance_signed: true });
assert.equal(eligible.is_financially_eligible, true);
assert.equal(eligible.po_unit_price_completed, 120.5);
assert.equal(eligible.contractor_payable_amount, 482);

const eligibleDecimalTicket = calculateTelecomAmounts({ po_unit_price: 510, ticket_number: 0.7, qa_status: 'approved', acceptance_signed: true });
assert.equal(eligibleDecimalTicket.is_financially_eligible, true);
assert.equal(eligibleDecimalTicket.po_unit_price_completed, 510);
assert.equal(eligibleDecimalTicket.contractor_payable_amount, 357);

const payload = [
  { rowNumber: 2, site_identifier: 'SITE-001', po_unit_price: 10 },
  { rowNumber: 3, site_identifier: 'SITE-001', po_unit_price: 11 },
  { rowNumber: 4, site_identifier: '', po_unit_price: 12 },
  { rowNumber: 5, site_identifier: 'SITE-002', po_unit_price: 'abc' },
  { rowNumber: 6, site_identifier: 'SITE-003', po_unit_price: 13 },
];

const result = validateTelecomRows(payload, ['SITE-003']);
assert.equal(result.validRows.length, 1);
assert.equal(result.invalidRows.length, 4);
assert.ok(result.warnings.length >= 1);

console.log('telecom assertions passed');
