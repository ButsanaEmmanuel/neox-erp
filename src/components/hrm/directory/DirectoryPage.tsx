import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Plus, Search, MapPin, Mail, Phone, Filter, ChevronLeft, ChevronRight,
    Trash2, UserCheck, UserX, X, Edit2, Check as CheckIcon, Building2, Calendar,
    Briefcase, User, DollarSign, Activity, FileText, MoreHorizontal,
    Download, Users, TrendingUp, LogOut, Shield as ShieldIcon, Lock as LockIcon, Copy
} from 'lucide-react';
import StartOffboardingModal from '../offboarding/StartOffboardingModal';
import PageHeader from '../../ui/PageHeader';
import HRMImportModal from '../import/HRMImportModal';
import StatusChip from '../../ui/StatusChip';
import Modal from '../../ui/Modal';
import Drawer from '../../ui/Drawer';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { useAuth } from '../../../contexts/AuthContext';
import type { EmploymentProfile, AuthorityLevel, ContractType, ContractStatus, AccessStatus, CompensationFrequency, CompensationType } from '../../../types/hrm';

// --- Types ---
interface EmployeeRow {
    id: string;
    name: string;
    initials: string;
    avatarColor: string;
    roleTitle: string;
    department: string;
    departmentId: string;
    manager: string;
    managerId: string;
    status: string;
    location: string;
    email: string;
    phone: string;
    employmentType: string;
    employeeCode: string;
    startDate: string;
    profile: EmploymentProfile;
}

interface FormState {
    name: string;
    email: string;
    phone: string;
    roleTitle: string;
    departmentId: string;
    workLocation: string;
    employmentType: string;
    status: string;
    startDate: string;
    contractType: ContractType;
    contractStatus: ContractStatus;
    endDate: string;
    probationEndDate: string;
    confirmationDate: string;
    terminationReason: string;
    managerPersonId: string;
    baseSalary: string;
    salaryCurrency: string;
    paymentFrequency: CompensationFrequency;
    compensationType: CompensationType;
    compensationEffectiveDate: string;
    compensationNotes: string;
    hasSystemAccess: boolean;
    accessStatus: AccessStatus;
    systemRole: string;
    authorityLevel: AuthorityLevel;
}

const EMPTY_FORM: FormState = {
    name: '', email: '', phone: '', roleTitle: '',
    departmentId: '', workLocation: '', employmentType: 'employee',
    status: 'active', startDate: new Date().toISOString().split('T')[0],
    contractType: 'CDI',
    contractStatus: 'active',
    endDate: '',
    probationEndDate: '',
    confirmationDate: '',
    terminationReason: '',
    managerPersonId: '',
    baseSalary: '',
    salaryCurrency: 'USD',
    paymentFrequency: 'monthly',
    compensationType: 'base_salary',
    compensationEffectiveDate: new Date().toISOString().split('T')[0],
    compensationNotes: '',
    hasSystemAccess: false,
    accessStatus: 'pending_activation',
    systemRole: 'USER',
    authorityLevel: 'CONTRIBUTOR',
};

const PAGE_SIZE = 8;

// ─── Avatar helper ───────────────────────────────────────────────────
const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

// ─── Sub-components ──────────────────────────────────────────────────
const Avatar: React.FC<{ initials: string; color?: string; size?: 'sm' | 'md' | 'lg' }> = ({
    initials, color = 'from-emerald-500/30 to-teal-500/20', size = 'sm'
}) => {
    const sizeClass = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-[11px]';
    return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br ${color} border border-border flex items-center justify-center font-bold text-white flex-none`}>
            {initials}
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-start py-2.5 border-b border-border last:border-0">
        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</span>
        <span className="text-[13px] text-primary text-right max-w-[60%]">{value}</span>
    </div>
);

const FieldInput: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required }) => (
    <div>
        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors"
        />
    </div>
);

const FieldSelect: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-primary focus:outline-none focus:border-brand/50 cursor-pointer"
        >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);

// --- Main Component ---
const DirectoryPage: React.FC = () => {
    const {
        employees,
        departments,
        addEmployee,
        updateEmployee,
        bulkUpdateEmployees,
        deleteEmployee,
        loadEmployeeActivities,
        loadEmployeeDetail,
        regenerateEmployeeCredentials,
        markEmployeeCredentialsSent,
        employeeActivities,
    } = useHRMStore();
    const { addToast } = useToast();
    const { user } = useAuth();

    const normalizedRole = String(user?.role || '').trim().toUpperCase();
    const normalizedDepartment = String(user?.departmentName || '').trim().toUpperCase();
    const isOmniAdmin = normalizedRole === 'ADMIN';
    const isHrDepartment = normalizedDepartment === 'HR' || normalizedDepartment.includes('HUMAN');
    const isHrRole = normalizedRole === 'HR' || normalizedRole.startsWith('HR_');
    const canManageDirectory = isOmniAdmin || isHrDepartment || isHrRole;
    const canCreate = canManageDirectory;
    const canViewContractDetails = canManageDirectory;
    const canViewCompensation = canManageDirectory;
    const canManageSystemAccess = canManageDirectory;
    const canMutateDirectory = canManageDirectory;

    // ── Filter / search state ──
    const [rawSearch, setRawSearch] = useState('');
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // ── Selection state ──
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // ── Pagination ──
    const [page, setPage] = useState(1);

    // --- Drawer state ---
    const [drawerEmployeeId, setDrawerEmployeeId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState<'overview' | 'employment' | 'compensation' | 'access' | 'activity'>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<FormState>>({});
    const [copiedField, setCopiedField] = useState<'username' | 'password' | 'both' | null>(null);

    // --- Add/Edit Modal state ---
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    // --- Offboarding Modal state ---
    const [offboardTarget, setOffboardTarget] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // ── Derived Rows/Reactive Data ──
    const rows: EmployeeRow[] = useMemo(() => {
        return employees.map(emp => {
            const dept = departments.find(d => d.id === emp.departmentId);
            const mgr = emp.managerPersonId ? employees.find(e => e.personId === emp.managerPersonId) : undefined;
            const name = emp.name || emp.employeeCode;
            return {
                id: emp.id,
                name,
                initials: getInitials(name),
                avatarColor: emp.avatarColor || 'from-slate-500/30 to-gray-500/20',
                roleTitle: emp.roleTitle,
                department: dept?.name || '-',
                departmentId: emp.departmentId || '',
                manager: mgr?.name || '-',
                managerId: emp.managerPersonId || '',
                status: emp.status,
                location: emp.workLocation || '-',
                email: emp.email || '-',
                phone: emp.phone || '-',
                employmentType: emp.employmentType,
                employeeCode: emp.employeeCode,
                startDate: emp.startDate,
                profile: emp,
            };
        }).filter(r => {
            const q = search.toLowerCase();
            const matchSearch = !q || r.name.toLowerCase().includes(q) || r.roleTitle.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
            const matchDept = deptFilter === 'all' || r.departmentId === deptFilter;
            const matchStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchType = typeFilter === 'all' || r.employmentType === typeFilter;
            return matchSearch && matchDept && matchStatus && matchType;
        });
    }, [employees, departments, search, deptFilter, statusFilter, typeFilter]);

    const drawerEmployee = useMemo(() => {
        if (!drawerEmployeeId) return null;
        return rows.find(r => r.id === drawerEmployeeId) || null;
    }, [drawerEmployeeId, rows]);

    useEffect(() => {
        if (drawerTab === 'activity' && drawerEmployeeId) {
            loadEmployeeActivities(drawerEmployeeId).catch(() => {
                addToast('Unable to load employee activity.', 'error');
            });
        }
    }, [drawerTab, drawerEmployeeId, loadEmployeeActivities, addToast]);

    // Reset page when filters change
    useEffect(() => setPage(1), [search, deptFilter, statusFilter, typeFilter]);

    // Simple search debounce effect
    useEffect(() => {
        const timer = setTimeout(() => setSearch(rawSearch), 250);
        return () => clearTimeout(timer);
    }, [rawSearch]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ── Stats ──
    const stats = useMemo(() => ({
        total: employees.length,
        active: employees.filter(e => e.status === 'active').length,
        onboarding: employees.filter(e => e.status === 'onboarding').length,
        contractors: employees.filter(e => e.employmentType === 'contractor').length,
    }), [employees]);

    // ── Selection helpers ──
    const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (selected.size === pageRows.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(pageRows.map(r => r.id)));
        }
    }, [selected.size, pageRows]);

    const clearSelection = () => setSelected(new Set());

    // ── Drawer helpers ──
    const openDrawer = useCallback((row: EmployeeRow) => {
        setDrawerEmployeeId(row.id);
        setDrawerTab('overview');
        setIsEditing(false);
        setDrawerOpen(true);
        loadEmployeeDetail(row.id).catch(() => {
            addToast('Unable to load full employee details.', 'error');
        });
    }, [loadEmployeeDetail, addToast]);

    const closeDrawer = () => {
        setDrawerOpen(false);
        setIsEditing(false);
        setDrawerEmployeeId(null);
        setCopiedField(null);
    };

    const copyText = async (text: string, field: 'username' | 'password' | 'both') => {
        if (!text || text === '-') {
            addToast('Nothing to copy.', 'error');
            return;
        }
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setCopiedField(field);
            setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 1500);
            addToast('Copied to clipboard.', 'success');
        } catch {
            addToast('Failed to copy to clipboard.', 'error');
        }
    };

    const handleRegenerateCredentials = async () => {
        if (!canManageSystemAccess) {
            addToast('Access denied. HR/Admin only.', 'error');
            return;
        }
        if (!drawerEmployee) return;
        try {
            await regenerateEmployeeCredentials(drawerEmployee.id);
            await loadEmployeeDetail(drawerEmployee.id);
            addToast('Temporary credentials generated successfully.', 'success');
        } catch (error) {
            addToast((error as Error).message || 'Failed to generate credentials', 'error');
        }
    };

    const handleMarkCredentialsSent = async () => {
        if (!canManageSystemAccess) {
            addToast('Access denied. HR/Admin only.', 'error');
            return;
        }
        if (!drawerEmployee) return;
        try {
            await markEmployeeCredentialsSent(drawerEmployee.id);
            await loadEmployeeDetail(drawerEmployee.id);
            addToast('Credentials marked as sent for email dispatch.', 'success');
        } catch (error) {
            addToast((error as Error).message || 'Failed to mark credentials as sent', 'error');
        }
    };

    const startDrawerEdit = () => {
        if (!canMutateDirectory) {
            addToast('Read-only access. HR/Admin only can edit employees.', 'error');
            return;
        }
        if (!drawerEmployee) return;
        setEditForm({
            roleTitle: drawerEmployee.roleTitle,
            departmentId: drawerEmployee.departmentId,
            workLocation: drawerEmployee.location === '-' ? '' : drawerEmployee.location,
            status: drawerEmployee.status,
            managerPersonId: drawerEmployee.managerId,
            contractType: drawerEmployee.profile.contractType || 'CDI',
            contractStatus: drawerEmployee.profile.contractStatus || 'active',
            endDate: drawerEmployee.profile.endDate || '',
            probationEndDate: drawerEmployee.profile.probationEndDate || '',
            confirmationDate: drawerEmployee.profile.confirmationDate || '',
            terminationReason: drawerEmployee.profile.terminationReason || '',
            baseSalary: drawerEmployee.profile.compensation?.amount !== undefined ? String(drawerEmployee.profile.compensation.amount) : '',
            salaryCurrency: drawerEmployee.profile.compensation?.currency || 'USD',
            paymentFrequency: (drawerEmployee.profile.compensation?.frequency || 'monthly') as CompensationFrequency,
            compensationType: drawerEmployee.profile.compensationType || 'base_salary',
            compensationEffectiveDate: drawerEmployee.profile.compensationEffectiveDate || '',
            compensationNotes: drawerEmployee.profile.compensationNotes || '',
            hasSystemAccess: drawerEmployee.profile.hasSystemAccess || false,
            accessStatus: drawerEmployee.profile.accessStatus || (drawerEmployee.profile.hasSystemAccess ? 'active' : 'disabled'),
            systemRole: drawerEmployee.profile.systemRole || 'USER',
            authorityLevel: drawerEmployee.profile.authorityLevel || 'CONTRIBUTOR',
        });
        setIsEditing(true);
    };

    const saveDrawerEdit = async () => {
        if (!canMutateDirectory) {
            addToast('Read-only access. HR/Admin only can edit employees.', 'error');
            return;
        }
        if (!drawerEmployee) return;
        try {
            await updateEmployee(drawerEmployee.id, {
                roleTitle: editForm.roleTitle,
                departmentId: editForm.departmentId || undefined,
                workLocation: editForm.workLocation || undefined,
                status: editForm.status as EmploymentProfile['status'],
                managerPersonId: editForm.managerPersonId || undefined,
                contractType: editForm.contractType as ContractType,
                contractStatus: editForm.contractStatus as ContractStatus,
                endDate: editForm.contractType === 'CDD' ? (editForm.endDate || undefined) : undefined,
                probationEndDate: editForm.probationEndDate || undefined,
                confirmationDate: editForm.confirmationDate || undefined,
                terminationReason: editForm.terminationReason || undefined,
                compensation: editForm.baseSalary
                    ? {
                        amount: Number(editForm.baseSalary),
                        currency: editForm.salaryCurrency || 'USD',
                        frequency: (editForm.paymentFrequency || 'monthly') as CompensationFrequency,
                    }
                    : undefined,
                compensationType: editForm.compensationType as CompensationType,
                compensationEffectiveDate: editForm.compensationEffectiveDate || undefined,
                compensationNotes: editForm.compensationNotes || undefined,
                hasSystemAccess: editForm.hasSystemAccess,
                accessStatus: editForm.hasSystemAccess ? (editForm.accessStatus || 'active') : 'disabled',
                systemRole: editForm.systemRole,
                authorityLevel: (editForm.authorityLevel as AuthorityLevel) || drawerEmployee.profile.authorityLevel,
            });
            addToast(`${drawerEmployee.name} updated`, 'success');
            setIsEditing(false);
        } catch (error) {
            addToast((error as Error).message || 'Failed to update employee', 'error');
        }
    };

    // ── Modal helpers ──
    const openAddModal = () => {
        if (!canCreate) {
            addToast('Read-only access. HR/Admin only can add employees.', 'error');
            return;
        }
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setModalOpen(true);
    };

    const openEditModal = (row: EmployeeRow, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!canMutateDirectory) {
            addToast('Read-only access. HR/Admin only can edit employees.', 'error');
            return;
        }
        setEditTarget(row);
        setForm({
            name: row.name,
            email: row.email === '-' ? '' : row.email,
            phone: row.phone === '-' ? '' : row.phone,
            roleTitle: row.roleTitle,
            departmentId: row.departmentId,
            workLocation: row.location === '-' ? '' : row.location,
            employmentType: row.employmentType,
            status: row.status,
            startDate: row.startDate,
            contractType: row.profile.contractType || 'CDI',
            contractStatus: row.profile.contractStatus || 'active',
            endDate: row.profile.endDate || '',
            probationEndDate: row.profile.probationEndDate || '',
            confirmationDate: row.profile.confirmationDate || '',
            terminationReason: row.profile.terminationReason || '',
            managerPersonId: row.managerId,
            baseSalary: row.profile.compensation?.amount !== undefined ? String(row.profile.compensation.amount) : '',
            salaryCurrency: row.profile.compensation?.currency || 'USD',
            paymentFrequency: (row.profile.compensation?.frequency || 'monthly') as CompensationFrequency,
            compensationType: row.profile.compensationType || 'base_salary',
            compensationEffectiveDate: row.profile.compensationEffectiveDate || '',
            compensationNotes: row.profile.compensationNotes || '',
            hasSystemAccess: row.profile.hasSystemAccess || false,
            accessStatus: row.profile.accessStatus || (row.profile.hasSystemAccess ? 'active' : 'disabled'),
            systemRole: row.profile.systemRole || 'USER',
            authorityLevel: row.profile.authorityLevel || 'CONTRIBUTOR',
        });
        setFormErrors({});
        setModalOpen(true);
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof FormState, string>> = {};
        if (!form.name.trim()) errors.name = 'Name is required';
        if (!form.roleTitle.trim()) errors.roleTitle = 'Job title is required';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email';
        if (canViewContractDetails && form.contractType === 'CDD' && !form.endDate) errors.endDate = 'Contract end date is required for CDD';
        if (form.hasSystemAccess && !form.systemRole) errors.systemRole = 'System role is required';
        if (canViewCompensation && form.baseSalary && Number.isNaN(Number(form.baseSalary))) errors.baseSalary = 'Base salary must be numeric';
        if (canViewCompensation && form.baseSalary && !form.compensationEffectiveDate) errors.compensationEffectiveDate = 'Compensation effective date is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitForm = async () => {
        if (!canMutateDirectory) {
            addToast('Read-only access. HR/Admin only can modify employees.', 'error');
            return;
        }
        if (!validateForm()) return;
        try {
            if (editTarget) {
                await updateEmployee(editTarget.id, {
                    name: form.name,
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    roleTitle: form.roleTitle,
                    departmentId: form.departmentId || undefined,
                    workLocation: form.workLocation || undefined,
                    employmentType: form.employmentType as EmploymentProfile['employmentType'],
                    status: form.status as EmploymentProfile['status'],
                    startDate: form.startDate,
                    ...(canViewContractDetails
                      ? {
                        contractType: form.contractType,
                        contractStatus: form.contractStatus,
                        endDate: form.contractType === 'CDD' ? (form.endDate || undefined) : undefined,
                        probationEndDate: form.probationEndDate || undefined,
                        confirmationDate: form.confirmationDate || undefined,
                        terminationReason: form.terminationReason || undefined,
                      }
                      : {}),
                    managerPersonId: form.managerPersonId || undefined,
                    ...(canViewCompensation
                      ? {
                        compensation: form.baseSalary
                          ? {
                              amount: Number(form.baseSalary),
                              currency: form.salaryCurrency || 'USD',
                              frequency: form.paymentFrequency,
                            }
                          : undefined,
                        compensationType: form.compensationType,
                        compensationEffectiveDate: form.compensationEffectiveDate || undefined,
                        compensationNotes: form.compensationNotes || undefined,
                      }
                      : {}),
                    hasSystemAccess: form.hasSystemAccess,
                    accessStatus: form.hasSystemAccess ? form.accessStatus : 'disabled',
                    systemRole: form.systemRole,
                    authorityLevel: form.authorityLevel,
                });
                addToast(`${form.name} updated successfully`, 'success');
            } else {
                await addEmployee({
                    personId: `p-new-${Date.now()}`,
                    employeeCode: `EMP-${Date.now().toString().slice(-4)}`,
                    employmentType: form.employmentType as EmploymentProfile['employmentType'],
                    roleTitle: form.roleTitle,
                    departmentId: form.departmentId || undefined,
                    startDate: form.startDate,
                    ...(canViewContractDetails
                      ? {
                        endDate: form.contractType === 'CDD' ? (form.endDate || undefined) : undefined,
                        contractType: form.contractType,
                        contractStatus: form.contractStatus,
                        probationEndDate: form.probationEndDate || undefined,
                        confirmationDate: form.confirmationDate || undefined,
                        terminationReason: form.terminationReason || undefined,
                      }
                      : {}),
                    workLocation: form.workLocation || undefined,
                    status: form.status as EmploymentProfile['status'],
                    name: form.name,
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    managerPersonId: form.managerPersonId || undefined,
                    ...(canViewCompensation
                      ? {
                        compensation: form.baseSalary
                          ? {
                              amount: Number(form.baseSalary),
                              currency: form.salaryCurrency || 'USD',
                              frequency: form.paymentFrequency,
                            }
                          : undefined,
                        compensationType: form.compensationType,
                        compensationEffectiveDate: form.compensationEffectiveDate || undefined,
                        compensationNotes: form.compensationNotes || undefined,
                      }
                      : {}),
                    hasSystemAccess: form.hasSystemAccess,
                    accessStatus: form.hasSystemAccess ? form.accessStatus : 'disabled',
                    systemRole: form.systemRole,
                    authorityLevel: form.authorityLevel,
                });
                addToast(`${form.name} added to directory`, 'success');
            }
            setModalOpen(false);
        } catch (error) {
            addToast((error as Error).message || 'Failed to save employee', 'error');
        }
    };

    // ── Bulk actions ──
    const handleBulkActivate = async () => {
        await bulkUpdateEmployees(Array.from(selected), { status: 'active' });
        addToast(`${selected.size} employees set to Active`, 'success');
        clearSelection();
    };

    const handleBulkDeactivate = async () => {
        await bulkUpdateEmployees(Array.from(selected), { status: 'inactive' });
        addToast(`${selected.size} employees deactivated`, 'success');
        clearSelection();
    };

    const handleBulkDelete = async () => {
        for (const id of Array.from(selected)) {
            await deleteEmployee(id);
        }
        addToast(`${selected.size} employees removed`, 'success');
        clearSelection();
    };

    const DRAWER_TABS = [
        { id: 'overview' as const, label: 'Overview', icon: User },
        { id: 'employment' as const, label: 'Employment', icon: Briefcase },
        ...(canViewCompensation ? [{ id: 'compensation' as const, label: 'Compensation', icon: DollarSign }] : []),
        ...(canManageSystemAccess ? [{ id: 'access' as const, label: 'Access', icon: ShieldIcon }] : []),
        { id: 'activity' as const, label: 'Activity', icon: Activity },
    ];

    const managerOptions = [
        { value: '', label: 'No Manager' },
        ...employees
            .filter(e => e.id !== drawerEmployee?.id)
            .map(e => ({ value: e.personId, label: e.name || e.employeeCode })),
    ];

    const deptOptions = [
        { value: '', label: 'Unassigned' },
        ...departments.map(d => ({ value: d.id, label: d.name })),
    ];

    const drawerActivities = drawerEmployeeId ? (employeeActivities[drawerEmployeeId] || []) : [];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-app">
            {/* --- Header --- */}
            <PageHeader
                title="People Directory"
                subtitle={`${rows.length} of ${employees.length} people`}
                actions={
                    canCreate ? (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsImportOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-border text-secondary rounded-lg text-[13px] font-semibold transition-colors"
                            >
                                <Download size={15} /> Import Employees
                            </button>
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm shadow-emerald-900/30"
                            >
                                <Plus size={15} /> Add Employee
                            </button>
                        </div>
                    ) : undefined
                }
            />
            {!canMutateDirectory && (
                <div className="px-6 py-2 text-[12px] text-amber-300 border-b border-border bg-amber-500/5">
                    Read-only directory access (HR/Admin only can add, import, export, edit or delete employees).
                </div>
            )}

            {/* --- Stats bar --- */}
            <div className="flex-none px-6 py-3 flex items-center gap-4 border-b border-border">
                {[
                    { label: 'Total', value: stats.total, icon: Users, color: 'text-muted' },
                    { label: 'Active', value: stats.active, icon: TrendingUp, color: 'text-brand' },
                    { label: 'Onboarding', value: stats.onboarding, icon: UserCheck, color: 'text-blue-400' },
                    { label: 'Contractors', value: stats.contractors, icon: FileText, color: 'text-amber-400' },
                ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border">
                        <stat.icon size={13} className={stat.color} />
                        <span className="text-[13px] font-semibold text-primary">{stat.value}</span>
                        <span className="text-[11px] text-muted">{stat.label}</span>
                    </div>
                ))}
            </div>

            {/* --- Toolbar --- */}
            <div className="flex-none px-6 py-3 flex items-center gap-3 border-b border-border">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        value={rawSearch}
                        onChange={e => setRawSearch(e.target.value)}
                        placeholder="Search by name, role, email..."
                        className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                    />
                    {rawSearch && (
                        <button onClick={() => setRawSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
                            <X size={13} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={13} className="text-muted" />
                    <select
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                        className="px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="offboarding">Offboarding</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Types</option>
                        <option value="employee">Employee</option>
                        <option value="contractor">Contractor</option>
                        <option value="intern">Intern</option>
                    </select>
                </div>

                {canMutateDirectory && (
                    <button className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[12px] text-muted hover:text-primary border border-border rounded-lg hover:bg-surface transition-colors">
                        <Download size={13} /> Export
                    </button>
                )}
            </div>

            {/* ── Bulk actions bar ── */}
            {canMutateDirectory && selected.size > 0 && (
                <div className="flex-none px-6 py-2.5 flex items-center gap-3 bg-emerald-500/10 border-b border-emerald-500/20">
                    <span className="text-[13px] font-semibold text-emerald-400">{selected.size} selected</span>
                    <div className="h-4 w-px bg-border" />
                    <button onClick={handleBulkActivate} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                        <UserCheck size={13} /> Set Active
                    </button>
                    <button onClick={handleBulkDeactivate} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-surface rounded-lg transition-colors">
                        <UserX size={13} /> Deactivate
                    </button>
                    {canCreate && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                            <Trash2 size={13} /> Delete
                        </button>
                    )}
                    <button onClick={clearSelection} className="ml-auto text-muted hover:text-primary">
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* ── Table ── */}
            <div className="flex-1 overflow-auto">
                {/* Table header */}
                <div className="grid items-center px-6 py-3 border-b border-border sticky top-0 z-10 bg-app/95 backdrop-blur-md"
                    style={{ gridTemplateColumns: canMutateDirectory ? '36px 2.5fr 1.2fr 1fr 100px 1.2fr 80px' : '2.5fr 1.2fr 1fr 100px 1.2fr' }}>
                    {canMutateDirectory && (
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={selected.size === pageRows.length && pageRows.length > 0}
                                onChange={toggleAll}
                                className="h-3.5 w-3.5 rounded border-secondary bg-transparent text-brand focus:ring-brand/30 cursor-pointer"
                            />
                        </div>
                    )}
                    {['Employee', 'Department', 'Manager', 'Status', 'Location', ...(canMutateDirectory ? [''] : [])].map(h => (
                        <div key={h} className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{h}</div>
                    ))}
                </div>

                {/* Rows */}
                {pageRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted">
                        <Users size={40} className="mb-3 opacity-20" />
                        <p className="text-[14px] font-medium">No employees found</p>
                        <p className="text-[12px] mt-1 text-secondary">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    pageRows.map(row => (
                        <div
                            key={row.id}
                            onClick={() => openDrawer(row)}
                            className={`grid items-center px-6 border-b border-border transition-all cursor-pointer hover:bg-surface group ${selected.has(row.id) ? 'bg-brand/5' : ''}`}
                            style={{ gridTemplateColumns: canMutateDirectory ? '36px 2.5fr 1.2fr 1fr 100px 1.2fr 80px' : '2.5fr 1.2fr 1fr 100px 1.2fr', minHeight: '56px' }}
                        >
                            {/* Checkbox */}
                            {canMutateDirectory && (
                                <div className="flex items-center justify-center" onClick={e => toggleSelect(row.id, e)}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(row.id)}
                                        onChange={() => { }}
                                        className="h-3.5 w-3.5 rounded border-secondary bg-transparent text-brand focus:ring-brand/30 cursor-pointer"
                                    />
                                </div>
                            )}

                            {/* Employee */}
                            <div className="flex items-center gap-3 py-3">
                                <Avatar initials={row.initials} color={row.avatarColor} />
                                <div>
                                    <div className="text-[13px] font-medium text-primary group-hover:text-brand transition-colors">{row.name}</div>
                                    <div className="text-[11px] text-muted">{row.roleTitle}</div>
                                </div>
                            </div>

                            {/* Department */}
                            <div className="py-3">
                                <div className="flex items-center gap-1.5 text-[12px] text-secondary">
                                    <Building2 size={11} className="flex-none opacity-60" />
                                    <span className="truncate">{row.department}</span>
                                </div>
                            </div>

                            {/* Manager */}
                            <div className="py-3 text-[12px] text-muted truncate">{row.manager}</div>

                            {/* Status */}
                            <div className="py-3">
                                <StatusChip status={row.status} />
                            </div>

                            {/* Location */}
                            <div className="py-3">
                                <div className="flex items-center gap-1.5 text-[12px] text-muted">
                                    <MapPin size={11} className="flex-none opacity-60" />
                                    <span className="truncate">{row.location}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            {canMutateDirectory && (
                                <div className="py-3 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={e => { e.stopPropagation(); setOffboardTarget(row.id); }}
                                        className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Offboard Employee"
                                    >
                                        <LogOut size={13} />
                                    </button>
                                    <button
                                        onClick={e => openEditModal(row, e)}
                                        className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); }}
                                        className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-colors"
                                        title="More"
                                    >
                                        <MoreHorizontal size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex-none px-6 py-3 flex items-center justify-between border-t border-border">
                    <span className="text-[12px] text-muted">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`h-7 w-7 rounded-md text-[12px] font-medium transition-colors ${p === page ? 'bg-brand text-brand-fg' : 'text-muted hover:text-primary hover:bg-surface'}`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Offboarding Modal ── */}
            {canMutateDirectory && offboardTarget && (
                <StartOffboardingModal
                    employeeId={offboardTarget}
                    onClose={() => setOffboardTarget(null)}
                />
            )}

            {/* ── Employee Drawer ── */}
            <Drawer isOpen={drawerOpen} onClose={closeDrawer} title="" width="max-w-md">
                {drawerEmployee && (
                    <div className="flex flex-col h-full -mt-4">
                        {/* Cover + Avatar */}
                        <div className="relative h-28 bg-gradient-to-br from-surface to-card flex-none">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.15) 0%, transparent 70%)` }} />
                            <div className="absolute -bottom-8 left-6">
                                <Avatar initials={drawerEmployee.initials} color={drawerEmployee.avatarColor} size="lg" />
                            </div>
                            {/* Edit / Save button */}
                            <div className="absolute top-3 right-3 flex items-center gap-2">
                                {canMutateDirectory && isEditing ? (
                                    <>
                                        <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-[12px] text-muted bg-surface border border-input rounded-lg hover:bg-surface">
                                            Cancel
                                        </button>
                                        <button onClick={saveDrawerEdit} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5">
                                            <CheckIcon size={13} /> Save
                                        </button>
                                    </>
                                ) : canMutateDirectory ? (
                                    <button onClick={startDrawerEdit} className="p-2 text-muted hover:text-primary bg-surface border border-input rounded-lg hover:bg-surface transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Name + role */}
                        <div className="px-6 pt-10 pb-4 flex-none border-b border-border/60">
                            <h3 className="text-[18px] font-bold text-primary">{drawerEmployee.name}</h3>
                            <p className="text-[13px] text-muted mt-0.5">{drawerEmployee.roleTitle}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <StatusChip status={drawerEmployee.status} />
                                <span className="text-[11px] text-muted capitalize">{drawerEmployee.employmentType}</span>
                                <span className="text-[11px] text-muted">·</span>
                                <span className="text-[11px] text-muted">{drawerEmployee.employeeCode}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-0 px-6 border-b border-border/60 flex-none">
                            {DRAWER_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setDrawerTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${drawerTab === tab.id
                                        ? 'border-emerald-500 text-primary'
                                        : 'border-transparent text-muted hover:text-secondary'
                                        }`}
                                >
                                    <tab.icon size={12} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {drawerTab === 'overview' && (
                                <div className="space-y-1">
                                    <InfoRow label="Email" value={
                                        <a href={`mailto:${drawerEmployee.email}`} className="text-emerald-400 hover:underline">{drawerEmployee.email}</a>
                                    } />
                                    <InfoRow label="Phone" value={drawerEmployee.phone} />
                                    <InfoRow label="Location" value={
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <MapPin size={11} className="text-muted" />
                                            {drawerEmployee.location}
                                        </div>
                                    } />
                                    <InfoRow label="Department" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.departmentId || ''}
                                                onChange={e => setEditForm(f => ({ ...f, departmentId: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                {deptOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        ) : drawerEmployee.department
                                    } />
                                    <InfoRow label="Manager" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.managerPersonId || ''}
                                                onChange={e => setEditForm(f => ({ ...f, managerPersonId: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                {managerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        ) : drawerEmployee.manager
                                    } />
                                    <InfoRow label="Status" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.status || ''}
                                                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                {['active', 'onboarding', 'offboarding', 'inactive'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        ) : <StatusChip status={drawerEmployee.status} />
                                    } />
                                </div>
                            )}

                            {drawerTab === 'employment' && (
                                <div className="space-y-1">
                                    <InfoRow label="Employee Code" value={drawerEmployee.employeeCode} />
                                    <InfoRow label="Job Title" value={
                                        isEditing ? (
                                            <input
                                                value={editForm.roleTitle || ''}
                                                onChange={e => setEditForm(f => ({ ...f, roleTitle: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                            />
                                        ) : drawerEmployee.roleTitle
                                    } />
                                    <InfoRow label="Start Date" value={drawerEmployee.startDate} />
                                    {canViewContractDetails ? (
                                        <>
                                            <InfoRow label="Contract Type" value={
                                                isEditing ? (
                                                    <select
                                                        value={editForm.contractType || 'CDI'}
                                                        onChange={e => setEditForm(f => ({ ...f, contractType: e.target.value as ContractType, endDate: e.target.value === 'CDI' ? '' : f.endDate }))}
                                                        className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                                    >
                                                        <option value="CDI">CDI</option>
                                                        <option value="CDD">CDD</option>
                                                    </select>
                                                ) : (drawerEmployee.profile.contractType || 'CDI')
                                            } />
                                            <InfoRow label="Contract Status" value={
                                                isEditing ? (
                                                    <select
                                                        value={editForm.contractStatus || 'active'}
                                                        onChange={e => setEditForm(f => ({ ...f, contractStatus: e.target.value as ContractStatus }))}
                                                        className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                                    >
                                                        <option value="active">active</option>
                                                        <option value="probation">probation</option>
                                                        <option value="confirmed">confirmed</option>
                                                        <option value="ended">ended</option>
                                                        <option value="terminated">terminated</option>
                                                    </select>
                                                ) : (drawerEmployee.profile.contractStatus || 'active')
                                            } />
                                            <InfoRow label="End Date" value={
                                                isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editForm.endDate || ''}
                                                        disabled={(editForm.contractType || 'CDI') === 'CDI'}
                                                        onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                                                        className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40 disabled:opacity-50"
                                                    />
                                                ) : (drawerEmployee.profile.endDate || '-')
                                            } />
                                            <InfoRow label="Probation End" value={
                                                isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editForm.probationEndDate || ''}
                                                        onChange={e => setEditForm(f => ({ ...f, probationEndDate: e.target.value }))}
                                                        className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                                    />
                                                ) : (drawerEmployee.profile.probationEndDate || '-')
                                            } />
                                        </>
                                    ) : (
                                        <InfoRow label="Contract Details" value="Restricted (HR only)" />
                                    )}
                                    <InfoRow label="Work Location" value={
                                        isEditing ? (
                                            <input
                                                value={editForm.workLocation || ''}
                                                onChange={e => setEditForm(f => ({ ...f, workLocation: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                            />
                                        ) : drawerEmployee.location
                                    } />
                                </div>
                            )}

                            {drawerTab === 'compensation' && (
                                <div className="space-y-1">
                                    <InfoRow label="Base Salary" value={
                                        isEditing ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm.baseSalary || ''}
                                                onChange={e => setEditForm(f => ({ ...f, baseSalary: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                            />
                                        ) : (drawerEmployee.profile.compensation ? [drawerEmployee.profile.compensation.currency, drawerEmployee.profile.compensation.amount.toLocaleString()].join(' ') : '-')
                                    } />
                                    <InfoRow label="Currency" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.salaryCurrency || 'USD'}
                                                onChange={e => setEditForm(f => ({ ...f, salaryCurrency: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="CDF">CDF</option>
                                            </select>
                                        ) : (drawerEmployee.profile.compensation?.currency || '-')
                                    } />
                                    <InfoRow label="Payment Frequency" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.paymentFrequency || 'monthly'}
                                                onChange={e => setEditForm(f => ({ ...f, paymentFrequency: e.target.value as CompensationFrequency }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="monthly">monthly</option>
                                                <option value="annual">annual</option>
                                                <option value="hourly">hourly</option>
                                            </select>
                                        ) : (drawerEmployee.profile.compensation?.frequency || '-')
                                    } />
                                    <InfoRow label="Compensation Type" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.compensationType || 'base_salary'}
                                                onChange={e => setEditForm(f => ({ ...f, compensationType: e.target.value as CompensationType }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="base_salary">base_salary</option>
                                                <option value="allowance">allowance</option>
                                                <option value="contract_fee">contract_fee</option>
                                            </select>
                                        ) : (drawerEmployee.profile.compensationType || '-')
                                    } />
                                    <InfoRow label="Effective Date" value={
                                        isEditing ? (
                                            <input
                                                type="date"
                                                value={editForm.compensationEffectiveDate || ''}
                                                onChange={e => setEditForm(f => ({ ...f, compensationEffectiveDate: e.target.value }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                            />
                                        ) : (drawerEmployee.profile.compensationEffectiveDate || '-')
                                    } />
                                </div>
                            )}

                            {drawerTab === 'access' && (
                                <div className="space-y-1">
                                    <InfoRow label="Platform Access" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.hasSystemAccess ? 'enabled' : 'disabled'}
                                                onChange={e => setEditForm(f => ({ ...f, hasSystemAccess: e.target.value === 'enabled' }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="enabled">enabled</option>
                                                <option value="disabled">disabled</option>
                                            </select>
                                        ) : (drawerEmployee.profile.hasSystemAccess ? 'enabled' : 'disabled')
                                    } />
                                    <InfoRow label="Access Status" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.accessStatus || 'pending_activation'}
                                                onChange={e => setEditForm(f => ({ ...f, accessStatus: e.target.value as AccessStatus }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="pending_activation">pending_activation</option>
                                                <option value="invited">invited</option>
                                                <option value="active">active</option>
                                                <option value="disabled">disabled</option>
                                            </select>
                                        ) : (drawerEmployee.profile.accessStatus || '-')
                                    } />
                                    <InfoRow label="System Role" value={
                                        isEditing ? (
                                            <input
                                                value={editForm.systemRole || ''}
                                                onChange={e => setEditForm(f => ({ ...f, systemRole: e.target.value.toUpperCase() }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none w-40"
                                            />
                                        ) : (drawerEmployee.profile.systemRole || '-')
                                    } />
                                    <InfoRow label="Authority" value={
                                        isEditing ? (
                                            <select
                                                value={editForm.authorityLevel || drawerEmployee.profile.authorityLevel || 'CONTRIBUTOR'}
                                                onChange={e => setEditForm(f => ({ ...f, authorityLevel: e.target.value as AuthorityLevel }))}
                                                className="px-2 py-1 bg-surface border border-input rounded text-[12px] text-primary focus:outline-none"
                                            >
                                                <option value="OBSERVER">OBSERVER</option>
                                                <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                                                <option value="MANAGER">MANAGER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        ) : drawerEmployee.profile.authorityLevel
                                    } />
                                    <div className="mt-4 rounded-xl border border-border bg-surface/60 p-3">
                                        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Login Credentials</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                                            <div className="rounded-lg bg-app border border-border px-3 py-2">
                                                <div className="flex items-center justify-between gap-2 text-muted text-[11px]">
                                                    <span>Username</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(drawerEmployee.profile.latestCredential?.username || drawerEmployee.profile.email || '', 'username')}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-input hover:bg-surface text-primary transition-colors"
                                                    >
                                                        <Copy size={12} /> {copiedField === 'username' ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                                <div className="text-primary font-semibold break-all">{drawerEmployee.profile.latestCredential?.username || drawerEmployee.profile.email || '-'}</div>
                                            </div>
                                            <div className="rounded-lg bg-app border border-border px-3 py-2">
                                                <div className="flex items-center justify-between gap-2 text-muted text-[11px]">
                                                    <span>Temporary Password</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(drawerEmployee.profile.latestCredential?.temporaryPassword || '', 'password')}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-input hover:bg-surface text-primary transition-colors"
                                                    >
                                                        <Copy size={12} /> {copiedField === 'password' ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                                <div className="text-primary font-semibold break-all">{drawerEmployee.profile.latestCredential?.temporaryPassword || '-'}</div>
                                            </div>
                                            <div className="rounded-lg bg-app border border-border px-3 py-2">
                                                <div className="text-muted text-[11px]">Credential Status</div>
                                                <div className="text-primary font-semibold">{drawerEmployee.profile.latestCredential?.status || 'not_generated'}</div>
                                            </div>
                                            <div className="rounded-lg bg-app border border-border px-3 py-2">
                                                <div className="text-muted text-[11px]">Generated At</div>
                                                <div className="text-primary font-semibold">{drawerEmployee.profile.latestCredential?.generatedAt ? new Date(drawerEmployee.profile.latestCredential.generatedAt).toLocaleString() : '-'}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const username = drawerEmployee.profile.latestCredential?.username || drawerEmployee.profile.email || '';
                                                    const temporaryPassword = drawerEmployee.profile.latestCredential?.temporaryPassword || '';
                                                    const payload = `Username: ${username}\nTemporary Password: ${temporaryPassword}`;
                                                    void copyText(payload, 'both');
                                                }}
                                                className="px-3 py-2 rounded-lg text-[12px] font-semibold border border-input text-primary hover:bg-surface transition-colors"
                                            >
                                                <span className="inline-flex items-center gap-1"><Copy size={13} /> {copiedField === 'both' ? 'Copied Credentials' : 'Copy Credentials'}</span>
                                            </button>
                                            <button
                                                onClick={handleRegenerateCredentials}
                                                disabled={!drawerEmployee.profile.hasSystemAccess}
                                                className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Generate / Regenerate Credentials
                                            </button>
                                            <button
                                                onClick={handleMarkCredentialsSent}
                                                disabled={!drawerEmployee.profile.latestCredential}
                                                className="px-3 py-2 rounded-lg text-[12px] font-semibold border border-input text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Mark as Sent by Email
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {drawerTab === 'activity' && (
                                <div className="space-y-3">
                                    {drawerActivities.length === 0 ? (
                                        <div className="py-8 text-center text-[12px] text-muted">No persisted activity yet.</div>
                                    ) : drawerActivities.map((item) => (
                                        <div key={item.id} className="flex items-start gap-3 py-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500/50 mt-1.5 flex-none" />
                                            <div>
                                                <p className="text-[13px] text-primary">{item.message}</p>
                                                <p className="text-[11px] text-muted">
                                                    {item.actorDisplayName} - {new Date(item.timestamp).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Drawer footer actions */}
                        <div className="flex-none px-6 py-4 border-t border-border/60 flex items-center gap-2">
                            {canMutateDirectory && (
                                <button
                                    onClick={() => { closeDrawer(); openEditModal(drawerEmployee); }}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                >
                                    <Edit2 size={14} /> Edit Full Profile
                                </button>
                            )}
                            <button className="p-2 text-muted hover:text-primary border border-input rounded-lg hover:bg-surface transition-colors">
                                <Mail size={15} />
                            </button>
                            <button className="p-2 text-muted hover:text-primary border border-input rounded-lg hover:bg-surface transition-colors">
                                <Phone size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* â”€â”€ Add / Edit Employee Modal â”€â”€ */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editTarget ? `Edit - ${editTarget.name}` : 'Add Employee'}
                size="md"
                footer={
                    <>
                        <button
                            onClick={() => setModalOpen(false)}
                            className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmitForm}
                            className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                            {editTarget ? 'Save Changes' : 'Add Employee'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* Personal */}
                    <div className="pb-2 border-b border-border/60">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Personal Information</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <FieldInput
                                    label="Full Name"
                                    required
                                    value={form.name}
                                    onChange={v => setForm(f => ({ ...f, name: v }))}
                                    placeholder="e.g. Jane Doe"
                                />
                                {formErrors.name && <p className="text-[11px] text-rose-400 mt-1">{formErrors.name}</p>}
                            </div>
                            <div>
                                <FieldInput
                                    label="Email"
                                    type="email"
                                    value={form.email}
                                    onChange={v => setForm(f => ({ ...f, email: v }))}
                                    placeholder="jane@company.com"
                                />
                                {formErrors.email && <p className="text-[11px] text-rose-400 mt-1">{formErrors.email}</p>}
                            </div>
                            <FieldInput
                                label="Phone"
                                value={form.phone}
                                onChange={v => setForm(f => ({ ...f, phone: v }))}
                                placeholder="+1 555 0101"
                            />
                        </div>
                    </div>

                    {/* Employment */}
                    <div className="pb-2 border-b border-border/60">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Employment</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <FieldInput
                                    label="Job Title"
                                    required
                                    value={form.roleTitle}
                                    onChange={v => setForm(f => ({ ...f, roleTitle: v }))}
                                    placeholder="e.g. Senior Engineer"
                                />
                                {formErrors.roleTitle && <p className="text-[11px] text-rose-400 mt-1">{formErrors.roleTitle}</p>}
                            </div>
                            <FieldSelect
                                label="Department"
                                value={form.departmentId}
                                onChange={v => setForm(f => ({ ...f, departmentId: v }))}
                                options={deptOptions}
                            />
                            <FieldSelect
                                label="Type"
                                value={form.employmentType}
                                onChange={v => setForm(f => ({ ...f, employmentType: v }))}
                                options={[
                                    { value: 'employee', label: 'Employee' },
                                    { value: 'contractor', label: 'Contractor' },
                                    { value: 'intern', label: 'Intern' },
                                ]}
                            />
                            <FieldSelect
                                label="Status"
                                value={form.status}
                                onChange={v => setForm(f => ({ ...f, status: v }))}
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'onboarding', label: 'Onboarding' },
                                    { value: 'offboarding', label: 'Offboarding' },
                                    { value: 'inactive', label: 'Inactive' },
                                ]}
                            />
                            <FieldInput
                                label="Start Date"
                                type="date"
                                value={form.startDate}
                                onChange={v => setForm(f => ({ ...f, startDate: v }))}
                            />
                            <FieldSelect
                                label="Contract Type"
                                value={form.contractType}
                                onChange={v => setForm(f => ({ ...f, contractType: v as ContractType, endDate: v === 'CDI' ? '' : f.endDate }))}
                                options={[
                                    { value: 'CDI', label: 'CDI' },
                                    { value: 'CDD', label: 'CDD' },
                                ]}
                            />
                            <FieldSelect
                                label="Contract Status"
                                value={form.contractStatus}
                                onChange={v => setForm(f => ({ ...f, contractStatus: v as ContractStatus }))}
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'probation', label: 'Probation' },
                                    { value: 'confirmed', label: 'Confirmed' },
                                    { value: 'ended', label: 'Ended' },
                                    { value: 'terminated', label: 'Terminated' },
                                ]}
                            />
                            <FieldInput
                                label="Contract End Date"
                                type="date"
                                value={form.endDate}
                                onChange={v => setForm(f => ({ ...f, endDate: v }))}
                                placeholder="Required for CDD"
                            />
                            {formErrors.endDate && <p className="text-[11px] text-rose-400 mt-1">{formErrors.endDate}</p>}
                            <FieldInput
                                label="Probation End Date"
                                type="date"
                                value={form.probationEndDate}
                                onChange={v => setForm(f => ({ ...f, probationEndDate: v }))}
                            />
                            <FieldInput
                                label="Confirmation Date"
                                type="date"
                                value={form.confirmationDate}
                                onChange={v => setForm(f => ({ ...f, confirmationDate: v }))}
                            />
                        </div>
                    </div>

                    {/* Location & Manager */}
                    <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Location & Reporting</p>
                        <div className="grid grid-cols-2 gap-3">
                            <FieldInput
                                label="Work Location"
                                value={form.workLocation}
                                onChange={v => setForm(f => ({ ...f, workLocation: v }))}
                                placeholder="e.g. New York (HQ)"
                            />
                            <FieldSelect
                                label="Manager"
                                value={form.managerPersonId}
                                onChange={v => setForm(f => ({ ...f, managerPersonId: v }))}
                                options={[
                                    { value: '', label: 'No Manager' },
                                    ...employees
                                        .filter(e => !editTarget || e.id !== editTarget.id)
                                        .map(e => ({ value: e.personId, label: e.name || e.employeeCode })),
                                ]}
                            />
                            <FieldInput
                                label="Termination Reason"
                                value={form.terminationReason}
                                onChange={v => setForm(f => ({ ...f, terminationReason: v }))}
                                placeholder="Optional, if terminated/end of contract"
                            />
                        </div>
                    </div>

                    {/* Compensation */}
                    <div className="pb-2 border-b border-border/60">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Compensation</p>
                        <div className="grid grid-cols-2 gap-3">
                            <FieldInput
                                label="Base Salary"
                                type="number"
                                value={form.baseSalary}
                                onChange={v => setForm(f => ({ ...f, baseSalary: v }))}
                                placeholder="e.g. 1200"
                            />
                            <FieldSelect
                                label="Currency"
                                value={form.salaryCurrency}
                                onChange={v => setForm(f => ({ ...f, salaryCurrency: v }))}
                                options={[
                                    { value: 'USD', label: 'USD' },
                                    { value: 'EUR', label: 'EUR' },
                                    { value: 'CDF', label: 'CDF' },
                                ]}
                            />
                            {formErrors.baseSalary && <p className="text-[11px] text-rose-400 mt-1">{formErrors.baseSalary}</p>}
                            <FieldSelect
                                label="Payment Frequency"
                                value={form.paymentFrequency}
                                onChange={v => setForm(f => ({ ...f, paymentFrequency: v as CompensationFrequency }))}
                                options={[
                                    { value: 'monthly', label: 'Monthly' },
                                    { value: 'annual', label: 'Annual' },
                                    { value: 'hourly', label: 'Hourly' },
                                ]}
                            />
                            <FieldSelect
                                label="Compensation Type"
                                value={form.compensationType}
                                onChange={v => setForm(f => ({ ...f, compensationType: v as CompensationType }))}
                                options={[
                                    { value: 'base_salary', label: 'Base Salary' },
                                    { value: 'allowance', label: 'Allowance' },
                                    { value: 'contract_fee', label: 'Contract Fee' },
                                ]}
                            />
                            <FieldInput
                                label="Effective Date"
                                type="date"
                                value={form.compensationEffectiveDate}
                                onChange={v => setForm(f => ({ ...f, compensationEffectiveDate: v }))}
                            />
                            {formErrors.compensationEffectiveDate && <p className="text-[11px] text-rose-400 mt-1">{formErrors.compensationEffectiveDate}</p>}
                            <div className="col-span-2">
                                <FieldInput
                                    label="Compensation Notes"
                                    value={form.compensationNotes}
                                    onChange={v => setForm(f => ({ ...f, compensationNotes: v }))}
                                    placeholder="Internal HR/Finance notes"
                                />
                            </div>
                        </div>
                    </div>

                    {/* System Access */}
                    <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">System Access</p>
                        <div className="grid grid-cols-2 gap-3">
                            <FieldSelect
                                label="Platform Access"
                                value={form.hasSystemAccess ? 'enabled' : 'disabled'}
                                onChange={v => setForm(f => ({ ...f, hasSystemAccess: v === 'enabled' }))}
                                options={[
                                    { value: 'enabled', label: 'Enabled' },
                                    { value: 'disabled', label: 'Disabled' },
                                ]}
                            />
                            <FieldSelect
                                label="Access Status"
                                value={form.accessStatus}
                                onChange={v => setForm(f => ({ ...f, accessStatus: v as AccessStatus }))}
                                options={[
                                    { value: 'pending_activation', label: 'Pending Activation' },
                                    { value: 'invited', label: 'Invited' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'disabled', label: 'Disabled' },
                                ]}
                            />
                            <FieldInput
                                label="System Role"
                                value={form.systemRole}
                                onChange={v => setForm(f => ({ ...f, systemRole: v.toUpperCase() }))}
                                placeholder="e.g. ADMIN / HR_MANAGER"
                            />
                            {formErrors.systemRole && <p className="text-[11px] text-rose-400 mt-1">{formErrors.systemRole}</p>}
                        </div>
                    </div>
                </div>
            </Modal>
            {/* â”€â”€ HRM Import Modal â”€â”€ */}
            <HRMImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                type="employee"
            />
        </div>
    );
};

export default DirectoryPage;






