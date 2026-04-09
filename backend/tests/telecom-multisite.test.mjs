import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTelecomAmounts } from '../services/projects/telecom-calculation.mjs';
import { validateTelecomRows } from '../services/projects/telecom-import-validation.mjs';

test('telecom calculation keeps PO Unit Price Completed as full PO amount when acceptance is signed', () => {
  const result = calculateTelecomAmounts({ po_unit_price: 120.5, ticket_number: 4, qa_status: 'approved', acceptance_signed: true });
  assert.equal(result.po_unit_price_completed, 120.5);
  assert.equal(result.contractor_payable_amount, 482);
});

test('telecom calculation supports decimal ticket number', () => {
  const result = calculateTelecomAmounts({ po_unit_price: 510, ticket_number: 0.7, qa_status: 'approved', acceptance_signed: true });
  assert.equal(result.po_unit_price_completed, 510);
  assert.equal(result.contractor_payable_amount, 357);
});

test('telecom import validation rejects duplicates and missing required fields', () => {
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
});
