// F2.6 — Slim wrapper. All logic lives in src/components/finance/payroll/.
// Kept here so sidebar routing (activeView === 'finance-hrm-payroll' in
// NeoxDashboard.tsx) keeps working without a routing churn.

import React from 'react';
import PayrollDashboard from './finance/payroll/PayrollDashboard';

const FinancePayrollPage: React.FC = () => <PayrollDashboard />;

export default FinancePayrollPage;
