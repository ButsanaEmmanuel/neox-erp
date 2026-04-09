/**
 * CandidateHiredModal
 * Premium hire-flow modal with template picker, hiring manager,
 * optional offer compensation, and "View Onboarding" CTA.
 */
import React, { useState, useMemo } from 'react';
import {
    CheckCircle2, ChevronDown, ChevronUp, DollarSign,
    Calendar, Building2, AlertCircle, ArrowRight, Info,
    ClipboardList, UserCheck, Eye,
} from 'lucide-react';
import Modal from '../../ui/Modal';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { Candidate, HirePayload, OfferCompensation, CompensationCurrency, CompensationPeriod } from '../../../types/hrm';

// ─── FormField ────────────────────────────────────────────────────
interface FormFieldProps {
    label: string;
    required?: boolean;
    helper?: string;
    error?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, required, helper, error, icon, children }) => {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-muted select-none">
                {icon && <span className="text-muted">{icon}</span>}
                {label}
                {required && <span className="text-red-400 text-[10px]">*</span>}
            </label>
            {children}
            {helper && !error && (
                <p className="text-[11px] text-muted leading-relaxed">{helper}</p>
            )}
            {error && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} /> {error}
                </p>
            )}
        </div>
    );
};

// ─── InlineCallout ────────────────────────────────────────────────
interface InlineCalloutProps {
    variant: 'info' | 'warning' | 'success';
    children: React.ReactNode;
}

const CALLOUT_STYLES = {
    info: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
    warning: 'bg-amber-500/5 border-amber-500/20 text-amber-400',
    success: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
};

const InlineCallout: React.FC<InlineCalloutProps> = ({ variant, children }) => (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${CALLOUT_STYLES[variant]}`}>
        <Info size={13} className="flex-none mt-0.5" />
        <p className="text-[11px] text-muted leading-relaxed">{children}</p>
    </div>
);

// ─── OfferCompensationSection ─────────────────────────────────────
interface OfferCompensationSectionProps {
    value: OfferCompensation;
    onChange: (v: OfferCompensation) => void;
}

const CURRENCIES: CompensationCurrency[] = ['USD', 'EUR', 'CDF'];
const PERIODS: { value: CompensationPeriod; label: string }[] = [
    { value: 'annual', label: 'per year' },
    { value: 'monthly', label: 'per month' },
    { value: 'daily', label: 'per day' },
    { value: 'hourly', label: 'per hour' },
];

const CURRENCY_SYMBOLS: Record<CompensationCurrency, string> = {
    USD: '$', EUR: '€', CDF: 'FC',
};

const OfferCompensationSection: React.FC<OfferCompensationSectionProps> = ({ value, onChange }) => (
    <div className="space-y-4">
        {/* Amount + Currency row */}
        <div className="flex gap-2">
            {/* Currency selector */}
            <div className="w-24 flex-none">
                <FormField label="Currency">
                    <select
                        value={value.currency}
                        onChange={e => onChange({ ...value, currency: e.target.value as CompensationCurrency })}
                        className="w-full px-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 cursor-pointer appearance-none"
                    >
                        {CURRENCIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </FormField>
            </div>

            {/* Amount */}
            <div className="flex-1">
                <FormField label="Amount" icon={<DollarSign size={11} />}>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted select-none pointer-events-none">
                            {CURRENCY_SYMBOLS[value.currency]}
                        </span>
                        <input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="0"
                            value={value.amount ?? ''}
                            onChange={e => onChange({ ...value, amount: e.target.value ? Number(e.target.value) : null })}
                            className="w-full pl-7 pr-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-secondary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                </FormField>
            </div>
        </div>

        {/* Period */}
        <FormField label="Pay Period" helper="How often the compensation is paid out.">
            <div className="grid grid-cols-4 gap-1.5">
                {PERIODS.map(p => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => onChange({ ...value, period: p.value })}
                        className={`px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all
                            ${value.period === p.value
                                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                                : 'bg-surface border-input text-muted hover:text-secondary hover:bg-card/8'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </FormField>

        {/* Preview */}
        {value.amount && value.amount > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface border border-border/60 rounded-xl">
                <span className="text-[11px] text-muted">Offer snapshot</span>
                <span className="text-[13px] font-semibold text-primary tabular-nums">
                    {CURRENCY_SYMBOLS[value.currency]}{value.amount.toLocaleString()} {value.currency}
                    <span className="text-[11px] font-normal text-muted ml-1">
                        / {PERIODS.find(p => p.value === value.period)?.label.replace('per ', '')}
                    </span>
                </span>
            </div>
        )}

        <InlineCallout variant="info">
            This is an <strong className="text-primary">offer snapshot</strong> for reference only — it is not connected to payroll.
            You can configure payroll after onboarding is complete.
        </InlineCallout>
    </div>
);

// ─── CandidateHiredModal ──────────────────────────────────────────
export interface CandidateHiredModalProps {
    candidate: Candidate | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: HirePayload) => void;
    onDoLater: () => void;
    departments: { id: string; name: string }[];
    /** Called when user clicks "Set up Payroll" CTA after hiring */
    onOpenPayrollSetup?: (employeeId?: string) => void;
    /** Called to navigate to onboarding view after hiring */
    onNavigateToOnboarding?: () => void;
}

const DEFAULT_COMP: OfferCompensation = { currency: 'USD', amount: null, period: 'monthly' };

const CandidateHiredModal: React.FC<CandidateHiredModalProps> = ({
    candidate, isOpen, onClose, onConfirm, onDoLater, departments, onOpenPayrollSetup, onNavigateToOnboarding,
}) => {
    const { onboardingTemplates, employees } = useHRMStore();

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [deptId, setDeptId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [hiringManagerId, setHiringManagerId] = useState('');
    const [startDateError, setStartDateError] = useState('');

    // Compensation section
    const [compExpanded, setCompExpanded] = useState(false);
    const [comp, setComp] = useState<OfferCompensation>(DEFAULT_COMP);

    // Post-hire state
    const [hired, setHired] = useState(false);
    const [hiredPayload, setHiredPayload] = useState<HirePayload | null>(null);

    // Managers for the hiring manager dropdown (active employees who could be managers)
    const managerOptions = useMemo(
        () => employees.filter(e => e.status === 'active' && e.roleTitle.match(/lead|manager|director|head|vp|chief/i)),
        [employees],
    );

    // Auto-select template when department changes
    const handleDeptChange = (newDeptId: string) => {
        setDeptId(newDeptId);
        // Find a department-matched template
        const matched = onboardingTemplates.find(t => t.departmentId === newDeptId);
        if (matched) setTemplateId(matched.id);
    };

    const handleReset = () => {
        setStartDate(new Date().toISOString().split('T')[0]);
        setDeptId('');
        setTemplateId('');
        setHiringManagerId('');
        setStartDateError('');
        setCompExpanded(false);
        setComp(DEFAULT_COMP);
        setHired(false);
        setHiredPayload(null);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const handleConfirm = () => {
        if (!startDate) {
            setStartDateError('Start date is required');
            return;
        }
        setStartDateError('');

        const payload: HirePayload = {
            candidateId: candidate!.id,
            startDate,
            departmentId: deptId || undefined,
            templateId: templateId || undefined,
            hiringManagerId: hiringManagerId || undefined,
            offerComp: compExpanded && comp.amount ? comp : undefined,
            payrollSetupLater: true,
        };

        setHiredPayload(payload);
        setHired(true);
        onConfirm(payload);
    };

    const handleDoLater = () => {
        handleReset();
        onDoLater();
    };

    const handleViewOnboarding = () => {
        handleClose();
        onNavigateToOnboarding?.();
    };

    if (!candidate) return null;

    const initials = candidate.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // ── Post-hire success state ──
    if (hired && hiredPayload) {
        const selectedTemplate = onboardingTemplates.find(t => t.id === (hiredPayload.templateId || templateId));
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Onboarding Started" size="sm"
                footer={
                    <div className="flex gap-2 w-full">
                        <button onClick={handleClose}
                            className="flex-1 px-4 py-2.5 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface transition-colors">
                            Done
                        </button>
                        {onNavigateToOnboarding && (
                            <button
                                onClick={handleViewOnboarding}
                                className="flex-1 px-4 py-2.5 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
                            >
                                <Eye size={14} /> View Onboarding <ArrowRight size={14} />
                            </button>
                        )}
                        {!onNavigateToOnboarding && onOpenPayrollSetup && (
                            <button
                                onClick={() => { handleClose(); onOpenPayrollSetup(); }}
                                className="flex-1 px-4 py-2.5 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                Set up Payroll <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                }
            >
                <div className="space-y-5 text-center py-2">
                    <div className="flex justify-center">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-[16px] font-bold text-primary mb-1">{candidate.name} is now onboarding</h3>
                        <p className="text-[13px] text-muted">
                            Employee profile created · Starting {new Date(hiredPayload.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-left">
                        <div className="px-3 py-2.5 bg-surface border border-border/60 rounded-xl">
                            <p className="text-[10px] text-muted mb-0.5">Department</p>
                            <p className="text-[12px] font-semibold text-primary">
                                {departments.find(d => d.id === hiredPayload.departmentId)?.name ?? '—'}
                            </p>
                        </div>
                        <div className="px-3 py-2.5 bg-surface border border-border/60 rounded-xl">
                            <p className="text-[10px] text-muted mb-0.5">Template</p>
                            <p className="text-[12px] font-semibold text-primary">
                                {selectedTemplate?.name ?? 'General'}
                            </p>
                        </div>
                        <div className="px-3 py-2.5 bg-surface border border-border/60 rounded-xl">
                            <p className="text-[10px] text-muted mb-0.5">Hiring Manager</p>
                            <p className="text-[12px] font-semibold text-primary">
                                {employees.find(e => e.id === hiredPayload.hiringManagerId)?.name ?? '—'}
                            </p>
                        </div>
                        <div className="px-3 py-2.5 bg-surface border border-border/60 rounded-xl">
                            <p className="text-[10px] text-muted mb-0.5">Offer Comp</p>
                            <p className="text-[12px] font-semibold text-primary">
                                {hiredPayload.offerComp?.amount
                                    ? `${CURRENCY_SYMBOLS[hiredPayload.offerComp.currency]}${hiredPayload.offerComp.amount.toLocaleString()} / ${hiredPayload.offerComp.period}`
                                    : 'Not set'}
                            </p>
                        </div>
                    </div>
                    <InlineCallout variant="success">
                        <strong className="text-primary">Onboarding plan created</strong> with {selectedTemplate?.tasksBlueprint.length ?? 0} tasks.
                        The employee will move to Active status once all required tasks are completed.
                    </InlineCallout>
                </div>
            </Modal>
        );
    }

    // ── Main hire form ──
    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Candidate Hired"
            size="md"
            footer={
                <div className="flex gap-2 w-full">
                    <button onClick={handleDoLater}
                        className="flex-1 px-4 py-2.5 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface transition-colors">
                        Do Later
                    </button>
                    <button onClick={handleConfirm}
                        className="flex-1 px-4 py-2.5 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/30">
                        <CheckCircle2 size={15} /> Start Onboarding
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* ── Candidate summary ── */}
                <div className="flex items-center gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-[14px] font-bold text-emerald-300 flex-none">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-primary truncate">{candidate.name}</p>
                        <p className="text-[12px] text-muted truncate">{candidate.position}</p>
                        <p className="text-[11px] text-muted mt-0.5 truncate">{candidate.email}</p>
                    </div>
                    <span className="flex-none px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                        Hired
                    </span>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-border/60" />

                {/* ── Core fields ── */}
                <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-widest">Employment Details</p>

                    <FormField label="Start Date" required error={startDateError} icon={<Calendar size={11} />}
                        helper="The employee's first working day.">
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setStartDateError(''); }}
                            className="w-full px-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                        />
                    </FormField>

                    <FormField label="Department" icon={<Building2 size={11} />}
                        helper="Assign to a department now, or update later from the Directory.">
                        <select
                            value={deptId}
                            onChange={e => handleDeptChange(e.target.value)}
                            className="w-full px-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 cursor-pointer"
                        >
                            <option value="">No department selected</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </FormField>

                    <FormField label="Onboarding Template" required icon={<ClipboardList size={11} />}
                        helper="Select the task template for onboarding. Auto-matched to department when available.">
                        <select
                            value={templateId}
                            onChange={e => setTemplateId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 cursor-pointer"
                        >
                            <option value="">Select template…</option>
                            {onboardingTemplates.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.tasksBlueprint.length} tasks)
                                </option>
                            ))}
                        </select>
                    </FormField>

                    <FormField label="Hiring Manager" icon={<UserCheck size={11} />}
                        helper="Assign a manager responsible for the new hire's onboarding.">
                        <select
                            value={hiringManagerId}
                            onChange={e => setHiringManagerId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 cursor-pointer"
                        >
                            <option value="">No manager selected</option>
                            {managerOptions.map(e => (
                                <option key={e.id} value={e.id}>{e.name} — {e.roleTitle}</option>
                            ))}
                        </select>
                    </FormField>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-border/60" />

                {/* ── Offer Compensation (collapsible) ── */}
                <div>
                    <button
                        type="button"
                        onClick={() => setCompExpanded(v => !v)}
                        className="w-full flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2">
                            <DollarSign size={13} className="text-muted group-hover:text-muted transition-colors" />
                            <span className="text-[12px] font-semibold text-muted group-hover:text-secondary transition-colors">
                                Offer Compensation
                            </span>
                            <span className="text-[10px] text-secondary bg-surface px-2 py-0.5 rounded-full">optional</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {compExpanded && comp.amount && comp.amount > 0 && (
                                <span className="text-[11px] text-emerald-400 font-semibold tabular-nums">
                                    {CURRENCY_SYMBOLS[comp.currency]}{comp.amount.toLocaleString()}
                                </span>
                            )}
                            {compExpanded
                                ? <ChevronUp size={14} className="text-muted" />
                                : <ChevronDown size={14} className="text-muted" />
                            }
                        </div>
                    </button>

                    {compExpanded && (
                        <div className="mt-4 pl-5 border-l border-border/60 space-y-4">
                            <OfferCompensationSection value={comp} onChange={setComp} />
                        </div>
                    )}

                    {!compExpanded && (
                        <p className="mt-1.5 text-[11px] text-secondary pl-5">
                            Capture the negotiated salary as an offer snapshot. Payroll setup is done separately.
                        </p>
                    )}
                </div>

                {/* ── Payroll callout ── */}
                <InlineCallout variant="info">
                    <strong className="text-primary">Payroll setup is separate.</strong> After starting onboarding, you can configure payroll from the Payroll module. The offer compensation above is for reference only.
                </InlineCallout>
            </div>
        </Modal>
    );
};

export default CandidateHiredModal;



