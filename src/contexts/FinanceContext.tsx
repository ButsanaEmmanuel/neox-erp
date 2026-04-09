import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
    Account,
    Transaction,
    Invoice,
    Payment,
    Budget,
    Category,
    FinanceSummary,
    FinanceEntryRecord,
    ReceivableRecord,
    PayableRecord,
    CustomerInvoiceRecord,
    VendorBillRecord,
    PaymentDisbursementRecord,
    ReceiptCollectionRecord,
} from '../types/finance';
import { apiRequest } from '../lib/apiClient';

interface FinanceContextType {
    accounts: Account[];
    transactions: Transaction[];
    invoices: Invoice[];
    payments: Payment[];
    budgets: Budget[];
    categories: Category[];
    summary: FinanceSummary;
    financeEntries: FinanceEntryRecord[];
    receivables: ReceivableRecord[];
    payables: PayableRecord[];
    customerInvoices: CustomerInvoiceRecord[];
    vendorBills: VendorBillRecord[];
    paymentDisbursements: PaymentDisbursementRecord[];
    receiptCollections: ReceiptCollectionRecord[];
    createTransaction: (data: Partial<Transaction>) => void;
    createInvoice: (data: Partial<Invoice>) => void;
    recordPayment: (data: Partial<Payment>) => void;
}

interface FinanceSnapshotResponse {
    source: 'database';
    generatedAt: string;
    accounts: Account[];
    transactions: Transaction[];
    invoices: Invoice[];
    payments: Payment[];
    budgets: Budget[];
    categories: Category[];
    summary: FinanceSummary;
}

interface FinanceEntriesResponse {
    entries: FinanceEntryRecord[];
}

interface ReceivablesResponse {
    receivables: ReceivableRecord[];
}

interface PayablesResponse {
    payables: PayableRecord[];
}

interface CustomerInvoicesResponse {
    invoices: CustomerInvoiceRecord[];
}

interface VendorBillsResponse {
    bills: VendorBillRecord[];
}

interface PaymentsResponse {
    payments: PaymentDisbursementRecord[];
}

interface ReceiptsResponse {
    receipts: ReceiptCollectionRecord[];
}

const DEFAULT_SUMMARY: FinanceSummary = {
    totalBalance: 0,
    monthlyBurnRate: 0,
    unpaidAccountsReceivable: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    currency: 'USD',
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [summary, setSummary] = useState<FinanceSummary>(DEFAULT_SUMMARY);
    const [financeEntries, setFinanceEntries] = useState<FinanceEntryRecord[]>([]);
    const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
    const [payables, setPayables] = useState<PayableRecord[]>([]);
    const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoiceRecord[]>([]);
    const [vendorBills, setVendorBills] = useState<VendorBillRecord[]>([]);
    const [paymentDisbursements, setPaymentDisbursements] = useState<PaymentDisbursementRecord[]>([]);
    const [receiptCollections, setReceiptCollections] = useState<ReceiptCollectionRecord[]>([]);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const [snapshot, entriesData, receivablesData, payablesData, customerInvoicesData, vendorBillsData, paymentsData, receiptsData] = await Promise.all([
                    apiRequest<FinanceSnapshotResponse>('/api/v1/finance/snapshot'),
                    apiRequest<FinanceEntriesResponse>('/api/v1/finance/entries?take=200'),
                    apiRequest<ReceivablesResponse>('/api/v1/finance/receivables?take=200'),
                    apiRequest<PayablesResponse>('/api/v1/finance/payables?take=200'),
                    apiRequest<CustomerInvoicesResponse>('/api/v1/finance/invoices?take=200'),
                    apiRequest<VendorBillsResponse>('/api/v1/finance/bills?take=200'),
                    apiRequest<PaymentsResponse>('/api/v1/finance/payments?take=200'),
                    apiRequest<ReceiptsResponse>('/api/v1/finance/receipts?take=200'),
                ]);
                if (!mounted) return;
                setAccounts(snapshot.accounts || []);
                setTransactions(snapshot.transactions || []);
                setInvoices(snapshot.invoices || []);
                setPayments(snapshot.payments || []);
                setBudgets(snapshot.budgets || []);
                setCategories(snapshot.categories || []);
                setSummary(snapshot.summary || DEFAULT_SUMMARY);
                setFinanceEntries(entriesData.entries || []);
                setReceivables(receivablesData.receivables || []);
                setPayables(payablesData.payables || []);
                setCustomerInvoices(customerInvoicesData.invoices || []);
                setVendorBills(vendorBillsData.bills || []);
                setPaymentDisbursements(paymentsData.payments || []);
                setReceiptCollections(receiptsData.receipts || []);
            } catch {
                if (!mounted) return;
                setAccounts([]);
                setTransactions([]);
                setInvoices([]);
                setPayments([]);
                setBudgets([]);
                setCategories([]);
                setSummary(DEFAULT_SUMMARY);
                setFinanceEntries([]);
                setReceivables([]);
                setPayables([]);
                setCustomerInvoices([]);
                setVendorBills([]);
                setPaymentDisbursements([]);
                setReceiptCollections([]);
            }
        };

        void load();
        const intervalId = window.setInterval(() => {
            void load();
        }, 15000);

        return () => {
            mounted = false;
            window.clearInterval(intervalId);
        };
    }, []);

    const readonlyAction = useMemo(() => {
        return () => {
            console.warn('Finance write operations are backend-only.');
        };
    }, []);

    return (
        <FinanceContext.Provider value={{
            accounts,
            transactions,
            invoices,
            payments,
            budgets,
            categories,
            summary,
            financeEntries,
            receivables,
            payables,
            customerInvoices,
            vendorBills,
            paymentDisbursements,
            receiptCollections,
            createTransaction: readonlyAction,
            createInvoice: readonlyAction,
            recordPayment: readonlyAction,
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (!context) throw new Error('useFinance must be used within a FinanceProvider');
    return context;
};
