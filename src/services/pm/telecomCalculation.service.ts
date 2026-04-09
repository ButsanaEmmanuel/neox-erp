export interface TelecomCalcInput {
  po_unit_price?: number;
  ticket_number?: number;
  qaStatus?: 'pending' | 'approved' | 'rejected';
  acceptanceStatus?: 'pending' | 'signed' | 'rejected';
}

export interface TelecomCalcOutput {
  is_financially_eligible: boolean;
  financial_eligibility_reason?: string;
  po_unit_price_completed: number;
  contractor_payable_amount: number;
}

export function evaluateFinancialEligibility(input: TelecomCalcInput): Pick<TelecomCalcOutput, 'is_financially_eligible' | 'financial_eligibility_reason'> {
  const unit = Number(input.po_unit_price ?? 0);
  const ticket = Number(input.ticket_number ?? 0);
  const hasValidUnit = Number.isFinite(unit) && unit > 0;
  const hasValidTicket = Number.isFinite(ticket) && ticket > 0;

  if (!hasValidTicket || !hasValidUnit) {
    return { is_financially_eligible: false, financial_eligibility_reason: 'Waiting for valid ticket number and PO unit price.' };
  }
  if (input.qaStatus !== 'approved') {
    return { is_financially_eligible: false, financial_eligibility_reason: 'Waiting for QA approval.' };
  }
  if (input.acceptanceStatus !== 'signed') {
    return { is_financially_eligible: false, financial_eligibility_reason: 'Waiting for signed acceptance.' };
  }

  return { is_financially_eligible: true };
}

export function calculateTelecomAmounts(input: TelecomCalcInput): TelecomCalcOutput {
  const eligibility = evaluateFinancialEligibility(input);
  const unit = Number(input.po_unit_price ?? 0);
  const tickets = Number(input.ticket_number ?? 0);

  // Mirror backend source-of-truth:
  // - PO Unit Price Completed: full PO unit price once acceptance is signed.
  // - Contractor Payable Amount: unit * ticket only when financially eligible.
  const hasSignedAcceptance = input.acceptanceStatus === 'signed';
  const poUnitPriceCompleted = Number.isFinite(unit) && unit > 0 && hasSignedAcceptance
    ? unit
    : 0;

  const contractorPayableAmount = eligibility.is_financially_eligible &&
    Number.isFinite(unit) &&
    Number.isFinite(tickets) &&
    unit > 0 &&
    tickets > 0
    ? unit * tickets
    : 0;

  return {
    ...eligibility,
    po_unit_price_completed: poUnitPriceCompleted,
    contractor_payable_amount: contractorPayableAmount,
  };
}
