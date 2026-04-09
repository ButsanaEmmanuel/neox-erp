import React, { useEffect, useState, useMemo } from 'react';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { ArrowLeft, Printer, Send, CheckCircle, Clock, Truck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { POStatus, PO_STATUS_LABELS } from '../../../types/po';
import { GRNModal } from './GRNModal';
import { createScmVendorBill, fetchPoFinanceStatus, recordScmPayment } from '../../../services/scmFinanceIntegration.service';

const STATUS_COLORS: Record<POStatus, string> = {
    DRAFT: 'bg-slate-500',
    PENDING_APPROVAL: 'bg-orange-500',
    APPROVED: 'bg-blue-500',
    SENT: 'bg-indigo-500',
    ACKNOWLEDGED: 'bg-purple-500',
    PARTIALLY_RECEIVED: 'bg-yellow-500',
    RECEIVED: 'bg-emerald-500',
    CLOSED: 'bg-slate-700',
    REJECTED: 'bg-red-500',
    CANCELLED: 'bg-red-500',
};

interface PODetailPageProps {
    onNavigate?: (view: string) => void;
}

interface PoFinanceState {
    commitments: Array<{ id: string; lifecycleStatus: string; amount: number }>;
    payables: Array<{
        id: string;
        status: string;
        paymentStatus: string;
        outstandingAmount: number;
        financeEntry: { approvalStatus: string; evidenceStatus: string };
    }>;
    bills: Array<{ id: string; billNumber: string; status: string; totalAmount: number }>;
    payments: Array<{ id: string; paymentReference: string; status: string; amount: number }>;
}

export const PODetailPage: React.FC<PODetailPageProps> = ({ onNavigate }) => {
    const { purchaseOrders, fetchPOs, submitPO, approvePO, rejectPO, sendPO, acknowledgePO, closePO, selectedPoId } = usePoStore();
    const { suppliers, locations } = useScmStore();

    const po = useMemo(() => purchaseOrders.find(p => p.id === selectedPoId), [purchaseOrders, selectedPoId]);
    const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
    const [financeState, setFinanceState] = useState<PoFinanceState>({ commitments: [], payables: [], bills: [], payments: [] });
    const [financeError, setFinanceError] = useState<string | null>(null);
    const [financeLoading, setFinanceLoading] = useState(false);

    const [billNumber, setBillNumber] = useState('');
    const [billAmount, setBillAmount] = useState('');
    const [billDueDate, setBillDueDate] = useState('');
    const [selectedGrnNumber, setSelectedGrnNumber] = useState('');

    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentProof, setPaymentProof] = useState('');

    const supplier = useMemo(() => suppliers.find(s => s.id === po?.supplierId), [suppliers, po?.supplierId]);
    const location = useMemo(() => locations.find(l => l.id === po?.shipToLocationId), [locations, po?.shipToLocationId]);

    const loadFinance = async () => {
        if (!po) return;
        setFinanceLoading(true);
        setFinanceError(null);
        try {
            const data = await fetchPoFinanceStatus(po.id);
            setFinanceState({
                commitments: data.commitments || [],
                payables: data.payables || [],
                bills: data.bills || [],
                payments: data.payments || [],
            });
        } catch (error) {
            setFinanceError((error as Error).message || 'Failed to load finance state.');
        } finally {
            setFinanceLoading(false);
        }
    };

    useEffect(() => {
        fetchPOs();
    }, [fetchPOs]);

    useEffect(() => {
        if (po) {
            void loadFinance();
        }
    }, [po?.id]);

    if (!po) return <div className="p-8 text-secondary">Loading or PO not found...</div>;

    const firstPayable = financeState.payables[0];
    const isEvidenceComplete = firstPayable ? firstPayable.financeEntry.evidenceStatus !== 'required_missing' : false;
    const isApprovalComplete = firstPayable ? firstPayable.financeEntry.approvalStatus === 'approved' : false;
    const canRecordPayment = Boolean(firstPayable) && isEvidenceComplete && isApprovalComplete;
    const canRegisterBill = selectedGrnNumber.trim().length > 0;
    const paymentLockReason = !firstPayable
        ? 'No payable available yet for this PO.'
        : !isEvidenceComplete
            ? 'Blocked: missing required evidence (PO, supplier invoice, GRN/service acceptance).'
            : !isApprovalComplete
                ? 'Blocked: payable must be approved in Finance before payment.'
                : null;

    const handleAction = async (action: () => Promise<void>) => {
        if (confirm('Are you sure you want to proceed?')) {
            await action();
            await loadFinance();
        }
    };

    const handleRegisterBill = async () => {
        const amount = Number(billAmount || 0);
        if (!billNumber.trim()) {
            alert('Bill number is required.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Bill amount must be greater than 0.');
            return;
        }
        if (!selectedGrnNumber.trim()) {
            alert('GRN reference is required before vendor bill registration.');
            return;
        }

        try {
            await createScmVendorBill({
                poId: po.id,
                poNumber: po.poNumber,
                billNumber: billNumber.trim(),
                totalAmount: amount,
                dueDate: billDueDate || undefined,
                issueDate: new Date().toISOString(),
                grnNumber: selectedGrnNumber || undefined,
                vendorName: supplier?.name,
                currencyCode: po.currency,
            });
            setBillNumber('');
            setBillAmount('');
            await loadFinance();
        } catch (error) {
            alert((error as Error).message || 'Failed to register vendor bill.');
        }
    };

    const handleRecordPayment = async () => {
        if (!firstPayable) {
            alert('No payable found for this PO.');
            return;
        }
        const amount = Number(paymentAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Payment amount must be greater than 0.');
            return;
        }
        if (!paymentProof.trim()) {
            alert('Proof reference is required.');
            return;
        }
        try {
            await recordScmPayment({
                payableId: firstPayable.id,
                amount,
                proofReference: paymentProof.trim(),
                method: 'bank_transfer',
                sourceContext: {
                    poId: po.id,
                    billNumber: financeState.bills[0]?.billNumber,
                    grnNumber: selectedGrnNumber || undefined,
                },
            });
            setPaymentAmount('');
            setPaymentProof('');
            await loadFinance();
        } catch (error) {
            alert((error as Error).message || 'Failed to record payment.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-app text-secondary">
            <div className="flex-none p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => onNavigate?.('scm-purchase-orders')} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-primary font-mono">{po.poNumber}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold text-primary uppercase tracking-wide ${STATUS_COLORS[po.status]}`}>
                                {PO_STATUS_LABELS[po.status]}
                            </span>
                        </div>
                        <p className="text-sm text-muted mt-1">Created on {format(new Date(po.orderDate), 'PPP')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 text-secondary hover:text-primary transition-colors">
                        <Printer size={18} />
                    </button>

                    {po.status === 'DRAFT' && (
                        <button onClick={() => handleAction(() => submitPO(po.id))} className="bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg text-sm font-bold transition-colors">Submit for Approval</button>
                    )}

                    {po.status === 'PENDING_APPROVAL' && (
                        <>
                            <button onClick={() => handleAction(() => rejectPO(po.id, 'Rejected by user'))} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 h-9 rounded-lg text-sm font-bold transition-colors border border-red-500/20">Reject</button>
                            <button onClick={() => handleAction(() => approvePO(po.id))} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-9 rounded-lg text-sm font-bold transition-colors">Approve</button>
                        </>
                    )}

                    {po.status === 'APPROVED' && (
                        <button onClick={() => handleAction(() => sendPO(po.id))} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-primary px-4 h-9 rounded-lg text-sm font-bold transition-colors">
                            <Send size={16} /> Send to Supplier
                        </button>
                    )}

                    {po.status === 'SENT' && (
                        <button onClick={() => handleAction(() => acknowledgePO(po.id))} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 h-9 rounded-lg text-sm font-bold transition-colors">
                            <CheckCircle size={16} /> Acknowledge
                        </button>
                    )}

                    {(po.status === 'ACKNOWLEDGED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button onClick={() => setIsGRNModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-9 rounded-lg text-sm font-bold transition-colors">
                            <Truck size={16} /> Receive Goods (GRN)
                        </button>
                    )}

                    {(po.status === 'RECEIVED' || po.status === 'REJECTED') && (
                        <button onClick={() => handleAction(() => closePO(po.id))} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 h-9 rounded-lg text-sm font-bold transition-colors">
                            <XCircle size={16} /> Close PO
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-8">
                        <div className="grid grid-cols-2 gap-6 p-6 bg-surface border border-border rounded-xl">
                            <div>
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Supplier Details</h3>
                                <div className="space-y-1">
                                    <p className="text-primary font-medium">{supplier?.name || po.supplierId}</p>
                                    <p className="text-sm text-secondary">Payment Terms: {po.paymentTerms}</p>
                                    <p className="text-sm text-secondary">Currency: {po.currency}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Shipping Details</h3>
                                <div className="space-y-1">
                                    <p className="text-primary font-medium">{location?.name || po.shipToLocationId}</p>
                                    <p className="text-sm text-secondary">Exp. Delivery: {format(new Date(po.expectedDeliveryDate), 'PPP')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-app text-[11px] font-bold text-muted uppercase tracking-wider border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3">Item</th>
                                        <th className="px-6 py-3 text-right">Qty</th>
                                        <th className="px-6 py-3 text-right">Unit Price</th>
                                        <th className="px-6 py-3 text-right">Total</th>
                                        <th className="px-6 py-3 text-right">Received</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {po.lines.map(line => {
                                        const receivedFull = line.qtyReceived >= line.qtyOrdered;
                                        return (
                                            <tr key={line.id} className="hover:bg-surface">
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-primary font-medium">{line.description}</p>
                                                    <p className="text-xs text-muted font-mono">{line.itemCode}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-secondary">{line.qtyOrdered} {line.uom}</td>
                                                <td className="px-6 py-4 text-right text-sm text-secondary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(line.unitPrice)}</td>
                                                <td className="px-6 py-4 text-right text-sm text-secondary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(line.lineTotal)}</td>
                                                <td className="px-6 py-4 text-right"><span className={`px-2 py-1 rounded text-xs font-bold ${receivedFull ? 'bg-emerald-500/10 text-emerald-400' : (line.qtyReceived > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'text-muted')}`}>{line.qtyReceived} / {line.qtyOrdered}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-app border-t border-border">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-secondary">Grand Total</td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-primary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(po.grandTotal)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="p-6 bg-card border border-border rounded-xl space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-primary">Finance Integration</h3>
                                <button onClick={() => void loadFinance()} className="text-xs px-3 py-1 rounded border border-input text-secondary hover:text-primary">Refresh</button>
                            </div>
                            <p className="text-xs text-secondary">Three-way support path: PO + Supplier Invoice + GRN/Service Acceptance required before payable approval. Transfer proof required after payment.</p>

                            {financeError && <div className="text-xs text-rose-400">{financeError}</div>}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Stat label="Commitment" value={financeState.commitments[0]?.lifecycleStatus || '-'} />
                                <Stat label="Bill Status" value={financeState.bills[0]?.status || '-'} />
                                <Stat label="Payable Status" value={firstPayable?.status || '-'} />
                                <Stat label="Payment Status" value={firstPayable?.paymentStatus || '-'} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-border">
                                <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="Vendor invoice #" className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                                <input type="number" step="0.01" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="Amount" className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                                <input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                                <input value={selectedGrnNumber} onChange={(e) => setSelectedGrnNumber(e.target.value)} placeholder="GRN reference (required)" className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => void handleRegisterBill()} disabled={!canRegisterBill} className="h-9 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Register Vendor Bill</button>
                            </div>

                            {firstPayable && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-border">
                                        <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Payment amount" className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                                        <input value={paymentProof} onChange={(e) => setPaymentProof(e.target.value)} placeholder="Transfer proof reference" className="h-9 rounded bg-app border border-border/80 px-3 text-sm text-primary" />
                                        <button onClick={() => void handleRecordPayment()} disabled={!canRecordPayment} className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Record Payment</button>
                                    </div>
                                    <div className="text-xs text-secondary">Outstanding: {new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(Number(firstPayable.outstandingAmount || 0))} | Approval: {firstPayable.financeEntry.approvalStatus} | Evidence: {firstPayable.financeEntry.evidenceStatus}</div>
                                    {paymentLockReason && <div className="text-xs text-amber-400">{paymentLockReason}</div>}
                                </>
                            )}

                            {financeLoading && <div className="text-xs text-muted">Loading finance status...</div>}
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded-xl p-6 h-fit">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2"><Clock size={14} /> Audit Log</h3>
                        <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-0 before:w-[1px] before:bg-border">
                            {po.auditLog.map((log, i) => (
                                <div key={i} className="relative pl-6">
                                    <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-surface border-2 border-slate-600 flex items-center justify-center"><div className="w-[5px] h-[5px] rounded-full bg-slate-400" /></div>
                                    <p className="text-xs font-bold text-primary uppercase tracking-wide">{log.action.replace(/_/g, ' ')}</p>
                                    <p className="text-[10px] text-muted mt-1">{format(new Date(log.timestamp), 'MMM d, h:mm a')}</p>
                                    <p className="text-xs text-secondary mt-1">by <span className="font-medium text-secondary">{log.actor}</span></p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isGRNModalOpen && (
                <GRNModal
                    po={po}
                    isOpen={isGRNModalOpen}
                    onPosted={(grnNumber) => {
                        setSelectedGrnNumber(grnNumber);
                        void loadFinance();
                    }}
                    onClose={() => {
                        setIsGRNModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="p-3 rounded border border-border/80 bg-app">
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
        <div className="text-sm font-semibold text-primary mt-1">{value}</div>
    </div>
);



