export function evaluateFinancialEligibility({ po_unit_price = 0, ticket_number = 0, qa_status = 'pending', acceptance_signed = false } = {}) {
  const unit = Number(po_unit_price || 0);
  const ticket = Number(ticket_number || 0);
  const hasUnit = Number.isFinite(unit) && unit > 0;
  const hasTicket = Number.isFinite(ticket) && ticket > 0;

  if (!hasUnit || !hasTicket) {
    return { is_financially_eligible: false, reason: 'Waiting for valid ticket number and PO unit price.' };
  }
  if (qa_status !== 'approved') {
    return { is_financially_eligible: false, reason: 'Waiting for QA approval.' };
  }
  if (!acceptance_signed) {
    return { is_financially_eligible: false, reason: 'Waiting for signed acceptance.' };
  }

  return { is_financially_eligible: true, reason: undefined };
}

export function calculateTelecomAmounts(input = {}) {
  const eligibility = evaluateFinancialEligibility(input);
  const unit = Number(input.po_unit_price || 0);
  const ticket = Number(input.ticket_number || 0);
  const hasValidUnit = Number.isFinite(unit) && unit > 0;
  const po_unit_price_completed = input.acceptance_signed && hasValidUnit ? unit : 0;

  if (!eligibility.is_financially_eligible) {
    return {
      ...eligibility,
      po_unit_price_completed,
      contractor_payable_amount: 0,
    };
  }

  const contractor_payable_amount = Number.isFinite(unit) && Number.isFinite(ticket) ? unit * ticket : 0;

  return {
    ...eligibility,
    po_unit_price_completed,
    contractor_payable_amount,
  };
}
