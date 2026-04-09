import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { parseDepartmentWorkbook, parseEmployeeWorkbook } from '../../../services/hrm/hrmImport.service';
import { Department, EmploymentProfile, HRMImportValidationResult } from '../../../types/hrm';
import { downloadDepartmentTemplate, downloadEmployeeTemplate } from '../../../services/hrm/hrmTemplate.service';

interface HRMImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'employee' | 'department';
}

const HRMImportModal: React.FC<HRMImportModalProps> = ({ isOpen, onClose, type }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState<HRMImportValidationResult<any> | null>(null);

    const bulkAddEmployees = useHRMStore((s) => s.bulkAddEmployees);
    const bulkAddDepartments = useHRMStore((s) => s.bulkAddDepartments);
    const existingEmployees = useHRMStore((s) => s.employees);
    const existingDepartments = useHRMStore((s) => s.departments);

    if (!isOpen) return null;

    const normalizeName = (value?: string) => (value || '').trim().toLowerCase();
    const inferNameFromEmail = (email?: string) => {
        if (!email) return '';
        const local = email.split('@')[0] || '';
        return local
            .replace(/[._-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const reset = () => {
        setStep(1);
        setImportError(null);
        setValidationResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const closeModal = () => {
        reset();
        onClose();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        setImportError(null);
        try {
            if (type === 'employee') {
                const existingEmails = existingEmployees.map((emp) => emp.email || '').filter(Boolean);
                const result = await parseEmployeeWorkbook(file, existingEmails);
                setValidationResult(result);
            } else {
                const existingNames = existingDepartments.map((dept) => dept.name).filter(Boolean);
                const result = await parseDepartmentWorkbook(file, existingNames);
                setValidationResult(result);
            }
            setStep(2);
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to parse workbook. Please verify the template and try again.');
        } finally {
            setIsParsing(false);
        }
    };

    const executeImport = async () => {
        if (!validationResult || validationResult.validRows.length === 0) {
            setImportError('No valid rows found to import. Please fix validation errors and retry.');
            return;
        }

        setIsImporting(true);
        setImportError(null);

        try {
            if (type === 'employee') {
                const profilesToAdd: EmploymentProfile[] = [];
                const emailToPersonId = new Map<string, string>();
                const nameToPersonId = new Map<string, string>();
                const managerBatchCache = new Map<string, { personId: string; employeeId: string }>();
                const deptNameToId = new Map(existingDepartments.map((dept) => [dept.name.toLowerCase().trim(), dept.id] as const));
                const importWarnings: string[] = [];

                existingEmployees.forEach((emp) => {
                    if (emp.email) emailToPersonId.set(emp.email.toLowerCase(), emp.personId);
                    if (emp.name) nameToPersonId.set(normalizeName(emp.name), emp.personId);
                });

                validationResult.validRows.forEach((row: any, rowIndex: number) => {
                    const now = new Date().toISOString();
                    const employeeEmail = String(row.payload.email || '').toLowerCase().trim();
                    const employeeName = String(row.payload.name || '').trim();
                    const departmentId = row.departmentName ? deptNameToId.get(String(row.departmentName).toLowerCase().trim()) : undefined;

                    const personId = emailToPersonId.get(employeeEmail) || `p-${Date.now()}-${rowIndex}-${Math.random().toString(36).substring(2, 7)}`;
                    if (employeeEmail && !emailToPersonId.has(employeeEmail)) emailToPersonId.set(employeeEmail, personId);
                    if (employeeName) nameToPersonId.set(normalizeName(employeeName), personId);

                    let managerPersonId: string | undefined;
                    const managerEmail = String(row.managerEmail || '').toLowerCase().trim();
                    const managerNameFromRow = String(row.managerName || '').trim();
                    const inferredManagerName = managerNameFromRow || inferNameFromEmail(managerEmail);
                    const managerNameKey = normalizeName(inferredManagerName);

                    if (managerEmail || managerNameKey) {
                        if (managerEmail && emailToPersonId.has(managerEmail)) {
                            managerPersonId = emailToPersonId.get(managerEmail);
                        } else if (managerNameKey && nameToPersonId.has(managerNameKey)) {
                            managerPersonId = nameToPersonId.get(managerNameKey);
                            importWarnings.push(`Row ${row.rowNumber}: manager matched by full name fallback (${inferredManagerName}).`);
                        } else {
                            const managerKey = managerEmail || `name:${managerNameKey}`;
                            const cached = managerBatchCache.get(managerKey);
                            if (cached) {
                                managerPersonId = cached.personId;
                            } else if (!inferredManagerName) {
                                importWarnings.push(`Row ${row.rowNumber}: manager is incomplete. Assignment skipped for admin review.`);
                            } else {
                                const managerPerson = `p-mgr-${Date.now()}-${rowIndex}-${Math.random().toString(36).substring(2, 7)}`;
                                const managerEmployeeId = `emp-mgr-${Date.now()}-${rowIndex}-${Math.random().toString(36).substring(2, 7)}`;
                                const managerReviewNeeded = !managerNameFromRow || inferredManagerName.length < 3;
                                const managerProfile: EmploymentProfile = {
                                    id: managerEmployeeId,
                                    personId: managerPerson,
                                    employeeCode: `MGR-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`,
                                    employmentType: 'employee',
                                    status: 'active',
                                    creationSource: 'IMPORT',
                                    departmentId,
                                    roleTitle: 'Manager',
                                    managerPersonId: undefined,
                                    startDate: row.payload.startDate || new Date().toISOString().slice(0, 10),
                                    createdAt: now,
                                    updatedAt: now,
                                    name: inferredManagerName,
                                    email: managerEmail || undefined,
                                    authorityLevel: 'MANAGER',
                                    avatarColor: 'from-amber-500/30 to-rose-500/20',
                                    requiresAdminReview: managerReviewNeeded,
                                    reviewNotes: managerReviewNeeded ? ['Manager identity imported with partial information.'] : undefined
                                };

                                profilesToAdd.push(managerProfile);
                                managerBatchCache.set(managerKey, { personId: managerPerson, employeeId: managerEmployeeId });
                                managerPersonId = managerPerson;
                                if (managerEmail) emailToPersonId.set(managerEmail, managerPerson);
                                if (managerNameKey) nameToPersonId.set(managerNameKey, managerPerson);
                            }
                        }
                    }

                    const profile: EmploymentProfile = {
                        id: `emp-${Date.now()}-${rowIndex}-${Math.random().toString(36).substring(2, 9)}`,
                        personId,
                        employeeCode: `EMP-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`,
                        employmentType: row.payload.employmentType as any,
                        status: 'active',
                        creationSource: 'IMPORT',
                        departmentId,
                        roleTitle: row.payload.roleTitle,
                        managerPersonId,
                        startDate: row.payload.startDate,
                        endDate: row.contractEndDate,
                        workLocation: row.payload.workLocation,
                        compensation: row.payload.compensation,
                        createdAt: now,
                        updatedAt: now,
                        name: employeeName,
                        email: employeeEmail,
                        phone: row.payload.phone,
                        authorityLevel: 'CONTRIBUTOR'
                    };

                    profilesToAdd.push(profile);
                });

                await bulkAddEmployees(profilesToAdd);

                if (importWarnings.length > 0) {
                    setValidationResult((prev) => (prev ? { ...prev, warnings: [...prev.warnings, ...importWarnings] } : prev));
                }
            } else {
                const newDepartments: Department[] = validationResult.validRows.map((row: any, i: number) => ({
                    id: `dept-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
                    name: row.name,
                    description: row.description
                }));
                await bulkAddDepartments(newDepartments);
            }

            setStep(3);
        } catch (error) {
            const message = (error as Error)?.message || 'Import failed. Please check API/DB logs and retry.';
            setImportError(message);
        } finally {
            setIsImporting(false);
        }
    };

    const title = type === 'employee' ? 'Import Employees' : 'Import Departments';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-app border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-primary">{title}</h2>
                    <button onClick={closeModal} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-app transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-6">
                            <label className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-input rounded-xl bg-surface cursor-pointer hover:bg-surface/80 transition-colors">
                                {isParsing ? <Loader2 className="text-brand animate-spin mb-3" size={38} /> : <FileSpreadsheet className="text-brand mb-3" size={38} />}
                                <p className="text-sm font-medium text-primary">{isParsing ? 'Parsing workbook...' : 'Upload Excel Workbook (.xlsx)'}</p>
                                <p className="text-xs text-muted mt-2">Ensure columns follow the standard mapping.</p>
                                <input type="file" className="hidden" accept=".xlsx" ref={fileInputRef} onChange={handleFileSelect} disabled={isParsing} />
                            </label>

                            <div className="flex items-center justify-between p-4 bg-brand/5 border border-brand/10 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                        <FileSpreadsheet size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-primary">Need a template?</p>
                                        <p className="text-[11px] text-muted">Use the standardized layout for import.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => (type === 'employee' ? downloadEmployeeTemplate() : downloadDepartmentTemplate())}
                                    className="px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-[12px] font-bold transition-colors flex items-center gap-2"
                                >
                                    <Download size={14} /> Download template
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && validationResult && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4 text-center text-sm">
                                <div className="p-3 bg-surface border border-border rounded-xl">
                                    <p className="text-muted text-xs mb-1">Total</p>
                                    <p className="font-semibold text-primary">{validationResult.totalRows}</p>
                                </div>
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <p className="text-emerald-500 text-xs mb-1">Valid</p>
                                    <p className="font-semibold text-emerald-400">{validationResult.validRows.length}</p>
                                </div>
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                    <p className="text-rose-500 text-xs mb-1">Invalid</p>
                                    <p className="font-semibold text-rose-400">{validationResult.invalidRows.length}</p>
                                </div>
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <p className="text-amber-500 text-xs mb-1">Warnings</p>
                                    <p className="font-semibold text-amber-400">{validationResult.warnings.length}</p>
                                </div>
                            </div>

                            {validationResult.invalidRows.length > 0 && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                                    <h3 className="text-rose-400 font-medium text-sm flex items-center mb-3">
                                        <AlertTriangle size={16} className="mr-2" /> Errors
                                    </h3>
                                    <ul className="space-y-2 max-h-32 overflow-y-auto text-xs text-rose-400/80">
                                        {validationResult.invalidRows.map((err, i) => (
                                            <li key={i}>Row {err.row}: {err.message}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {validationResult.warnings.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                    <h3 className="text-amber-400 font-medium text-sm flex items-center mb-3">
                                        <AlertTriangle size={16} className="mr-2" /> Warnings
                                    </h3>
                                    <ul className="space-y-1 text-xs text-amber-400/80">
                                        {validationResult.warnings.map((warn, i) => (
                                            <li key={i}>- {warn}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {importError && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                                    <h3 className="text-rose-400 font-medium text-sm flex items-center mb-2">
                                        <AlertTriangle size={16} className="mr-2" /> Import failed
                                    </h3>
                                    <p className="text-xs text-rose-300">{importError}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button onClick={reset} className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors">
                                    Upload different file
                                </button>
                                <button
                                    onClick={executeImport}
                                    disabled={validationResult.validRows.length === 0 || isImporting}
                                    className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
                                >
                                    {isImporting ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            Importing...
                                        </span>
                                    ) : (
                                        `Import ${validationResult.validRows.length} valid records`
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="py-12 flex flex-col items-center">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-bold text-primary mb-2">Import successful</h3>
                            <p className="text-secondary text-sm text-center mb-8">
                                Imported {validationResult?.validRows.length} {type === 'employee' ? 'employees' : 'departments'}.
                            </p>
                            <button onClick={closeModal} className="px-6 py-2 bg-surface border border-border hover:bg-border text-primary rounded-lg text-sm transition-colors">
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HRMImportModal;
