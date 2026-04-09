import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldAlert, Landmark, X, ExternalLink } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { PayableRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';

interface PayablesResponse {
    payables: PayableRecord[];
}

interface PayableDetailResponse {
    payable: PayableRecord | null;
}

const REQUIRED_SCM_EVIDENCE: Array<{ type: string; label: string }> = [
    { type: 'po_document', label: 'Purchase Order' },
    { type: 'supplier_invoice', label: 'Supplier Invoice' },
    { type: 'grn_or_service_acceptance', label: 'GRN / Service Acceptance' },
    { type: 'payment_transfer_proof', label: 'Transfer Proof (after payment)' },
];

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const raw = String(reader.result || '');
            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
            resolve(base64 || '');
        };
        reader.onerror = () => reject(new Error('Unable to read selected file.'));
        reader.readAsDataURL(file);
    });
}

const PayablesPage: React.FC = () => {
    const { payables: contextPayables } = useFinance();
    const { user } = useAuth();

    const [payables, setPayables] = useState<PayableRecord[]>(contextPayables);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
    const [selectedPayable, setSelectedPayable] = useState<PayableRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [drawerError, setDrawerError] = useState<string | null>(null);
    const [actionNotes, setActionNotes] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [proofReference, setProofReference] = useState('');
    const [selectedEvidenceType, setSelectedEvidenceType] = useState(REQUIRED_SCM_EVIDENCE[0].type);
    const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<File | null>(null);
    const [evidenceNotes, setEvidenceNotes] = useState('');

    useEffect(() => {
        setPayables(contextPayables);
    }, [contextPayables]);

    const refreshPayables = async () => {
        const data = await apiRequest<PayablesResponse>('/api/v1/finance/payables?take=200');
        setPayables(data.payables || []);
    };

    const loadPayableDetail = async (payableId: string) => {
        setLoadingDetail(true);
        setDrawerError(null);
        try {
            const data = await apiRequest<PayableDetailResponse>(`/api/v1/finance/payables/${payableId}`);
            setSelectedPayable(data.payable || null);
            const outstanding = Number(data.payable?.outstandingAmount || 0);
            setPaymentAmount(outstanding > 0 ? String(outstanding) : '');
            setProofReference('');
            setActionNotes('');
            setSelectedEvidenceType(REQUIRED_SCM_EVIDENCE[0].type);
            setSelectedEvidenceFile(null);
            setEvidenceNotes('');
        } catch (error) {
            setDrawerError(error instanceof Error ? error.message : 'Unable to load payable detail.');
            setSelectedPayable(null);
        } finally {
            setLoadingDetail(false);
        }
    };

    const openPayable = async (payable: PayableRecord) => {
        setSelectedPayableId(payable.id);
        await loadPayableDetail(payable.id);
    };

    const closeDrawer = () => {
        setSelectedPayableId(null);
        setSelectedPayable(null);
        setDrawerError(null);
    };

    const executeAction = async (fn: () => Promise<void>) => {
        if (!selectedPayableId || !selectedPayable) return;
        setLoadingAction(true);
        setDrawerError(null);
        try {
            await fn();
            await refreshPayables();
            await loadPayableDetail(selectedPayableId);
        } catch (error) {
            setDrawerError(error instanceof Error ? error.message : 'Finance action failed.');
        } finally {
            setLoadingAction(false);
        }
    };

    const approveSelected = async () => {
        if (!selectedPayable) return;
        await executeAction(async () => {
            await apiRequest(`/api/v1/finance/entries/${selectedPayable.financeEntryId}/approve`, {
                method: 'PATCH',
                body: {
                    notes: actionNotes || null,
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
        });
    };

    const rejectSelected = async () => {
        if (!selectedPayable) return;
        await executeAction(async () => {
            await apiRequest(`/api/v1/finance/entries/${selectedPayable.financeEntryId}/reject`, {
                method: 'PATCH',
                body: {
                    notes: actionNotes || 'Rejected from payable control panel',
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
        });
    };

    const paySelected = async () => {
        if (!selectedPayable) return;
        const amount = Number(paymentAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            setDrawerError('Payment amount must be greater than zero.');
            return;
        }

        await executeAction(async () => {
            await apiRequest('/api/v1/finance/payments', {
                method: 'POST',
                body: {
                    payableId: selectedPayable.id,
                    amount,
                    method: paymentMethod,
                    notes: actionNotes || null,
                    proofReference: proofReference || null,
                    sourceContext: {
                        poId: selectedPayable.financeEntry?.sourceLinks?.find((s) => s.sourceEntity === 'purchase_order')?.sourceEntityId,
                        billNumber: selectedPayable.financeEntry?.sourceLinks?.find((s) => s.sourceEntity === 'vendor_bill')?.sourceEntityId,
                        grnNumber: selectedPayable.financeEntry?.sourceLinks?.find((s) => s.sourceEntity === 'goods_receipt')?.sourceEntityId,
                    },
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
        });
    };

    const uploadSelectedEvidence = async () => {
        if (!selectedPayable) return;
        if (!selectedEvidenceFile) {
            setDrawerError('Select a file before uploading evidence.');
            return;
        }

        await executeAction(async () => {
            const contentBase64 = await fileToBase64(selectedEvidenceFile);
            await apiRequest(`/api/v1/finance/entries/${selectedPayable.financeEntryId}/evidence`, {
                method: 'POST',
                body: {
                    originalFileName: selectedEvidenceFile.name,
                    mimeType: selectedEvidenceFile.type || 'application/octet-stream',
                    sizeBytes: selectedEvidenceFile.size,
                    documentType: selectedEvidenceType,
                    notes: evidenceNotes || null,
                    contentBase64,
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
            setSelectedEvidenceFile(null);
            setEvidenceNotes('');
        });
    };

    const rows = useMemo(() => {
        return payables.filter((item) => {
            const haystack = `${item.referenceCode} ${item.vendorName || ''} ${item.financeEntry?.title || ''}`.toLowerCase();
            return haystack.includes(searchQuery.toLowerCase());
        });
    }, [payables, searchQuery]);

    const totals = useMemo(() => ({
        total: rows.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
        outstanding: rows.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0),
        missingEvidence: rows.filter((item) => item.financeEntry?.evidenceStatus === 'required_missing').length,
    }), [rows]);

    const scmEvidenceChecklist = useMemo(() => {
        const docs = selectedPayable?.financeEntry?.evidenceDocuments || [];
        return REQUIRED_SCM_EVIDENCE.map((rule) => ({
            ...rule,
            present: docs.some((doc) => doc.documentType === rule.type),
        }));
    }, [selectedPayable]);

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Payables" value={formatCurrency(totals.total)} accent="rose" />
                    <StatCard label="Outstanding" value={formatCurrency(totals.outstanding)} accent="amber" />
                    <StatCard label="Missing Evidence" value={String(totals.missingEvidence)} accent="blue" />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h3 className="text-sm font-semibold text-primary">Payables Control</h3>
                            <p className="text-xs text-secondary mt-1">Outgoing obligations with evidence and approval visibility.</p>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search payables..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-64 placeholder:text-muted"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-surface/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Vendor</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Outstanding</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Approval</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Evidence</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due Date</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">SCM Source</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {rows.map((item) => (
                                    <tr key={item.id} className="hover:bg-surface transition-colors">
                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{item.referenceCode}</td>
                                        <td className="px-6 py-4 text-sm text-secondary">{item.vendorName || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-rose-300 tabular-nums">{formatCurrency(Number(item.totalAmount || 0))}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-primary tabular-nums">{formatCurrency(Number(item.outstandingAmount || 0))}</td>
                                        <td className="px-6 py-4">
                                            <StatusPill tone={item.financeEntry?.approvalStatus === 'approved' ? 'success' : 'warning'}>
                                                {item.financeEntry?.approvalStatus || item.status}
                                            </StatusPill>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusPill tone={item.financeEntry?.evidenceStatus === 'required_missing' ? 'danger' : 'info'}>
                                                {item.financeEntry?.evidenceStatus || 'unknown'}
                                            </StatusPill>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-secondary">{item.dueDate ? formatDate(item.dueDate, 'short') : '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">
                                            {item.financeEntry?.sourceLinks?.filter((l) => l.sourceModule === 'scm').slice(0, 2).map((l) => `${l.sourceEntity}:${l.sourceEntityId}`).join(' | ') || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={() => void openPayable(item)}
                                                className="px-3 py-1.5 text-xs border border-blue-500/40 rounded-lg text-blue-300 hover:bg-blue-500/10"
                                            >
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {rows.length === 0 && (
                        <div className="p-12 text-center text-muted text-sm">No payables found.</div>
                    )}
                </div>
            </div>

            {selectedPayableId && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex justify-end"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) closeDrawer();
                    }}
                >
                    <div
                        className="w-full max-w-2xl h-full bg-[#0f172a] border-l border-border/80 flex flex-col"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-secondary">Payable Detail</p>
                                <h3 className="text-lg font-semibold text-primary">{selectedPayable?.referenceCode || selectedPayableId}</h3>
                            </div>
                            <button type="button" onClick={closeDrawer} className="text-secondary hover:text-primary">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {loadingDetail && <p className="text-sm text-secondary">Loading details...</p>}
                            {drawerError && <p className="text-sm text-rose-400">{drawerError}</p>}

                            {!loadingDetail && selectedPayable && (
                                <>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <Field label="Vendor" value={selectedPayable.vendorName || '-'} />
                                        <Field label="Due Date" value={selectedPayable.dueDate ? formatDate(selectedPayable.dueDate, 'short') : '-'} />
                                        <Field label="Total" value={formatCurrency(Number(selectedPayable.totalAmount || 0))} />
                                        <Field label="Outstanding" value={formatCurrency(Number(selectedPayable.outstandingAmount || 0))} />
                                        <Field label="Approval" value={selectedPayable.financeEntry?.approvalStatus || '-'} />
                                        <Field label="Evidence" value={selectedPayable.financeEntry?.evidenceStatus || '-'} />
                                    </div>

                                    <section className="rounded-xl border border-border/80 bg-card p-4">
                                        <h4 className="text-sm font-semibold text-primary mb-3">SCM Source Links</h4>
                                        <div className="space-y-2">
                                            {(selectedPayable.financeEntry?.sourceLinks || []).filter((l) => l.sourceModule === 'scm').length === 0 && (
                                                <p className="text-xs text-muted">No SCM source links.</p>
                                            )}
                                            {(selectedPayable.financeEntry?.sourceLinks || []).filter((l) => l.sourceModule === 'scm').map((link) => (
                                                <div key={link.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/40">
                                                    <span className="text-primary">{link.sourceEntity}:{link.sourceEntityId}</span>
                                                    <span className="text-secondary">{link.sourceEvent}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="rounded-xl border border-border/80 bg-card p-4">
                                        <h4 className="text-sm font-semibold text-primary mb-3">Evidence Checklist</h4>
                                        <div className="space-y-2">
                                            {scmEvidenceChecklist.map((item) => (
                                                <div key={item.type} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/40">
                                                    <span className="text-primary">{item.label}</span>
                                                    <span className={item.present ? 'text-emerald-400' : 'text-amber-400'}>{item.present ? 'Present' : 'Missing'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 rounded-lg border border-border/70 bg-slate-900/40 p-3 space-y-3">
                                            <p className="text-xs font-semibold text-primary">Submit Evidence</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <select
                                                    value={selectedEvidenceType}
                                                    onChange={(e) => setSelectedEvidenceType(e.target.value)}
                                                    className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40"
                                                >
                                                    {REQUIRED_SCM_EVIDENCE.map((rule) => (
                                                        <option key={rule.type} value={rule.type}>
                                                            {rule.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="file"
                                                    onChange={(e) => setSelectedEvidenceFile(e.target.files?.[0] || null)}
                                                    className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-xs text-primary file:mr-2 file:rounded file:border-0 file:bg-blue-500/20 file:px-2 file:py-1 file:text-blue-200"
                                                />
                                            </div>
                                            <textarea
                                                value={evidenceNotes}
                                                onChange={(e) => setEvidenceNotes(e.target.value)}
                                                placeholder="Evidence notes (optional)"
                                                className="w-full min-h-[68px] bg-slate-900/70 border border-border/80 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40"
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[11px] text-muted truncate">
                                                    {selectedEvidenceFile ? `Selected: ${selectedEvidenceFile.name}` : 'No file selected'}
                                                </p>
                                                <button
                                                    type="button"
                                                    disabled={loadingAction || !selectedEvidenceFile}
                                                    onClick={() => void uploadSelectedEvidence()}
                                                    className="h-9 px-3 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-60 text-xs"
                                                >
                                                    Upload Evidence
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {(selectedPayable.financeEntry?.evidenceDocuments || []).slice(0, 8).map((doc) => (
                                                <a
                                                    key={doc.id}
                                                    href={`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/finance/evidence/${doc.id}/download`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/50 text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    <span>{doc.documentType} - {doc.originalFileName}</span>
                                                    <ExternalLink size={14} />
                                                </a>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-primary">Actions</h4>
                                        <textarea
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            placeholder="Notes for approval/rejection/payment"
                                            className="w-full min-h-[72px] bg-slate-900/70 border border-border/80 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <button
                                                type="button"
                                                disabled={loadingAction}
                                                onClick={() => void approveSelected()}
                                                className="h-10 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-60"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loadingAction}
                                                onClick={() => void rejectSelected()}
                                                className="h-10 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loadingAction}
                                                onClick={() => void refreshPayables().then(() => selectedPayableId ? loadPayableDetail(selectedPayableId) : undefined)}
                                                className="h-10 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-60"
                                            >
                                                Refresh
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                placeholder="Amount"
                                                className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40"
                                            />
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40"
                                            >
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="mobile_money">Mobile Money</option>
                                                <option value="cash">Cash</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={proofReference}
                                                onChange={(e) => setProofReference(e.target.value)}
                                                placeholder="Proof reference"
                                                className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={loadingAction}
                                            onClick={() => void paySelected()}
                                            className="h-10 px-4 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-60"
                                        >
                                            Record Payment
                                        </button>
                                    </section>

                                    <section className="rounded-xl border border-border/80 bg-card p-4">
                                        <h4 className="text-sm font-semibold text-primary mb-3">Recent Activity</h4>
                                        <div className="space-y-2">
                                            {(selectedPayable.financeEntry?.activities || []).length === 0 && (
                                                <p className="text-xs text-muted">No activity yet.</p>
                                            )}
                                            {(selectedPayable.financeEntry?.activities || []).slice(0, 12).map((activity) => (
                                                <div key={activity.id} className="rounded-lg border border-border bg-slate-900/40 px-3 py-2">
                                                    <div className="flex items-center justify-between text-[11px] text-muted">
                                                        <span>{activity.actorDisplayName || 'System'} - {activity.eventSource}</span>
                                                        <span>{new Date(activity.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-primary mt-1">{activity.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
        <p className="text-sm text-primary mt-1">{value}</p>
    </div>
);

const StatusPill = ({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'info'; children: React.ReactNode }) => {
    const styles = tone === 'success'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : tone === 'warning'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : tone === 'danger'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>{children}</span>;
};

const StatCard = ({ label, value, accent }: { label: string; value: string; accent: 'rose' | 'amber' | 'blue' }) => (
    <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${accent === 'rose' ? 'bg-rose-500/10 text-rose-400' : accent === 'amber' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {accent === 'blue' ? <ShieldAlert size={18} /> : <Landmark size={18} />}
            </div>
        </div>
        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
    </div>
);

export default PayablesPage;


