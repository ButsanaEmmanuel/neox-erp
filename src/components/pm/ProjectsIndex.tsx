import React, { useState, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { Plus, Search, Filter, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCrmStore } from '../../store/crm/useCrmStore';
import { useHRMStore } from '../../store/hrm/useHRMStore';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import ComboboxSelect from '../ui/ComboboxSelect';
import ProjectsTableView from './ProjectsTableView';
import ProjectsListView from './ProjectsListView';
import ViewToggle, { ViewMode } from './ViewToggle';
import { detectTelecomByClient } from '../../services/pm/telecomImport.service';
import ProfessionalEmptyState from '../ui/ProfessionalEmptyState';
import { LayoutGrid } from 'lucide-react';

interface ProjectDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: string) => void;
}

const CreateProjectDrawer: React.FC<ProjectDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
    const navigate = useNavigate();
    const { createProjectWithWorkflow } = useProjectStore();
    const { searchClients, createClientInline, suggestClientDuplicates, fetchClients } = useCrmStore();
    const { employees } = useHRMStore();
    const { user } = useAuth();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        clientId: '',
        clientName: '',
        managerId: '',
        managerName: '',
        projectMode: 'standard',
        projectCategory: '',
        purchase_order: '',
        poNumber: '',
        startDate: '',
        endDate: '',
        costHT: '' // Keep as string for input handling
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showClientCreateModal, setShowClientCreateModal] = useState(false);
    const [clientCreateError, setClientCreateError] = useState('');
    const [clientDraft, setClientDraft] = useState({
        name: '',
        industry: '',
        contactPerson: '',
        email: '',
        phone: '',
        billingAddress: '',
        country: '',
        taxRegistrationNumber: '',
        notes: ''
    });

        useEffect(() => {
        void fetchClients('');
    }, [fetchClients]);

    // Financial Constants
    const VAT_RATE = 0.16;

    // Derived Financials
    const costHT = parseFloat(formData.costHT) || 0;
    const vatAmount = costHT * VAT_RATE;
    const costTTC = costHT + vatAmount;

    // Derived Data Sources
    const clientOptions = searchClients('').map(c => ({
        id: c.id,
        label: c.name || 'Unknown Client',
        subLabel: c.profileStatus === 'needs_completion'
            ? `${c.industry || 'No industry'} - profile_incomplete`
            : c.industry
    }));
    const duplicateCandidates = suggestClientDuplicates({
        name: clientDraft.name,
        email: clientDraft.email,
        taxRegistrationNumber: clientDraft.taxRegistrationNumber
    });
    const normalizedExactDuplicate = duplicateCandidates.find(
        (row) => row.name.toLowerCase() === clientDraft.name.trim().toLowerCase()
    );
    const canCreateInlineClient = ['ADMIN', 'SALES', 'CRM_MANAGER', 'PROJECT_MANAGER'].includes((user?.role || '').toUpperCase());

    // Filter for Managers (role includes 'manager', 'lead', 'director', 'head' or just heuristic)
    const managerOptions: Array<{ id: string; label: string; subLabel: string; avatarColor?: string }> = employees
        .filter(e => {
            const role = (e.roleTitle || '').toLowerCase();
            return role.includes('manager') || role.includes('lead') || role.includes('director') || role.includes('head');
        })
        .map(e => ({
            id: (e as any).userId || e.personId,
            label: e.name || 'Unknown Staff',
            subLabel: e.roleTitle || 'No Title',
            avatarColor: e.avatarColor
        }));
    if (managerOptions.length === 0 && user) {
        managerOptions.push({
            id: user.id,
            label: user.name || user.email,
            subLabel: user.role || 'System User',
        });
    }

    // Reset form on open
    React.useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '',
                clientId: '',
                clientName: '',
                managerId: '',
                managerName: '',
                projectMode: 'standard',
                projectCategory: '',
                purchase_order: '',
                poNumber: '',
                startDate: '',
                endDate: '',
                costHT: ''
            });
            setErrors({});
            setShowClientCreateModal(false);
            setClientCreateError('');
            setClientDraft({
                name: '',
                industry: '',
                contactPerson: '',
                email: '',
                phone: '',
                billingAddress: '',
                country: '',
                taxRegistrationNumber: '',
                notes: ''
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim() || formData.name.length < 2) newErrors.name = 'Project name is required';
        if (!formData.clientId) newErrors.clientId = 'Client is required';
        if (!formData.poNumber.trim()) newErrors.poNumber = 'PO Number is required';
        if (!formData.managerId) newErrors.managerId = 'Manager is required';

        if (!formData.startDate) newErrors.startDate = 'Start date is required';
        if (!formData.endDate) newErrors.endDate = 'End date is required';
        if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            newErrors.endDate = 'End date must be after start date';
        }

        if (parseFloat(formData.costHT) <= 0) newErrors.costHT = 'Cost must be greater than 0';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const workflow = await createProjectWithWorkflow({
            name: formData.name,

            // New Identity Fields
            clientId: formData.clientId,
            clientName: formData.clientName,
            client: formData.clientName, // Fallback

            managerId: formData.managerId,
            managerName: formData.managerName,
            manager: formData.managerName, // Fallback

            status: 'active',
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
            description: '',
            projectMode: formData.projectMode as 'standard' | 'telecom_multi_site',
            projectCategory: formData.projectCategory,
            isTelecomProject: formData.projectMode === 'telecom_multi_site',
            bulkImportRequired: formData.projectMode === 'telecom_multi_site',
            purchase_order: formData.purchase_order || formData.poNumber,

            // Financials
            poNumber: formData.poNumber,
            currency: 'USD',
            costHT: costHT,
            vatRate: VAT_RATE,
            vatAmount: vatAmount,
            costTTC: costTTC,
            creatorUserId: user?.id,
            creatorDisplayName: user?.name || user?.email,

            scope: { objectives: [], deliverables: [], outOfScope: [], assumptions: [] }
        });

        onClose();
        if (workflow.redirectToImport) {
            navigate(`/projects/${workflow.projectId}/imports?telecom=1`);
            return;
        }
        onNavigate('projects-overview');
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[field];
                return newErrs;
            });
        }
    };

    const handleClientChange = (id: string) => {
        const client = clientOptions.find(c => c.id === id);
        if (client) {
            const telecomDefault = detectTelecomByClient(client.label, formData.projectCategory);
            setFormData(prev => ({
                ...prev,
                clientId: id,
                clientName: client.label,
                projectMode: telecomDefault ? 'telecom_multi_site' : prev.projectMode
            }));
            if (errors.clientId) handleChange('clientId', id);
        }
    };

    const openInlineClientCreation = (query?: string) => {
        if (!canCreateInlineClient) {
            setClientCreateError('You do not have permission to create CRM clients inline.');
            return;
        }
        setClientCreateError('');
        setClientDraft((prev) => ({
            ...prev,
            name: prev.name || (query || '').trim()
        }));
        setShowClientCreateModal(true);
    };

    const submitInlineClientCreation = async (e: React.FormEvent) => {
        e.preventDefault();
        setClientCreateError('');
        if (!clientDraft.name.trim()) {
            setClientCreateError('Client name is required.');
            return;
        }
        if (normalizedExactDuplicate) {
            setClientCreateError(`Potential duplicate found: ${normalizedExactDuplicate.name}. Please select existing client or change name.`);
            return;
        }

        try {
            const created = await createClientInline({
                name: clientDraft.name,
                industry: clientDraft.industry,
                contactPerson: clientDraft.contactPerson,
                email: clientDraft.email,
                phone: clientDraft.phone,
                billingAddress: clientDraft.billingAddress,
                country: clientDraft.country,
                taxRegistrationNumber: clientDraft.taxRegistrationNumber,
                notes: clientDraft.notes,
                ownerId: user?.id,
            });

            handleClientChange(created.id);
            setShowClientCreateModal(false);
            setClientDraft({
                name: '',
                industry: '',
                contactPerson: '',
                email: '',
                phone: '',
                billingAddress: '',
                country: '',
                taxRegistrationNumber: '',
                notes: ''
            });
        } catch (error) {
            setClientCreateError(error instanceof Error ? error.message : 'Unable to create client right now.');
        }
    };

    const handleManagerChange = (id: string) => {
        const manager = managerOptions.find(m => m.id === id);
        if (manager) {
            setFormData(prev => ({ ...prev, managerId: id, managerName: manager.label }));
            if (errors.managerId) handleChange('managerId', id);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-[600px] bg-app border-l border-border/60 h-full shadow-2xl flex flex-col font-sans">

                {/* Header */}
                <div className="p-6 border-b border-border/60 flex items-center justify-between bg-card/70">
                    <div>
                        <h2 className="text-xl font-bold text-primary">New Project</h2>
                        <p className="text-xs text-muted mt-1">Define project identity and commercials.</p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
                        <span className="sr-only">Close</span>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-8">

                        {/* Section: Identity */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Identity</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-muted mb-1.5">Project Name <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => handleChange('name', e.target.value)}
                                        className={`w-full bg-app border ${errors.name ? 'border-red-500/50' : 'border-input'} rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors`}
                                        placeholder="e.g. Q3 Infrastructure Upgrade"
                                    />
                                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                                </div>

                                <div>
                                    <ComboboxSelect
                                        label="Client"
                                        required
                                        options={clientOptions}
                                        value={formData.clientId}
                                        onChange={handleClientChange}
                                        placeholder="Select Client..."
                                        error={errors.clientId}
                                        emptyMessage="No clients found in CRM."
                                        onCreate={openInlineClientCreation}
                                        createLabel="Client not found? Create it"
                                    />
                                    {canCreateInlineClient && (
                                        <button
                                            type="button"
                                            onClick={() => openInlineClientCreation(formData.clientName || '')}
                                            className="mt-2 text-[11px] text-blue-300 hover:text-blue-200"
                                        >
                                            + Add client to CRM
                                        </button>
                                    )}
                                    {!canCreateInlineClient && (
                                        <p className="text-[11px] text-amber-300 mt-1">
                                            You do not have permission to create CRM clients inline.
                                        </p>
                                    )}
                                    {clientCreateError && !showClientCreateModal && (
                                        <p className="text-[11px] text-rose-400 mt-1">{clientCreateError}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Project Mode <span className="text-red-400">*</span></label>
                                    <select
                                        value={formData.projectMode}
                                        onChange={e => handleChange('projectMode', e.target.value)}
                                        className="w-full bg-app border border-input rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors"
                                    >
                                        <option value="standard">Standard Project</option>
                                        <option value="telecom_multi_site">Telecom Multi-Site Project (Bulk Import)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Project Category</label>
                                    <input
                                        type="text"
                                        value={formData.projectCategory}
                                        onChange={e => {
                                            const value = e.target.value;
                                            const telecomDefault = detectTelecomByClient(formData.clientName, value);
                                            setFormData(prev => ({ ...prev, projectCategory: value, projectMode: telecomDefault ? 'telecom_multi_site' : prev.projectMode }));
                                        }}
                                        className="w-full bg-app border border-input rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors"
                                        placeholder="e.g. Telecom rollout"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">PO Number <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.poNumber}
                                        onChange={e => handleChange('poNumber', e.target.value)}
                                        className={`w-full bg-app border ${errors.poNumber ? 'border-red-500/50' : 'border-input'} rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors`}
                                        placeholder="PO-2024-XXX"
                                    />
                                    {errors.poNumber && <p className="text-xs text-red-400 mt-1">{errors.poNumber}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Purchase Order (Project-level)</label>
                                    <input
                                        type="text"
                                        value={formData.purchase_order}
                                        onChange={e => handleChange('purchase_order', e.target.value)}
                                        className="w-full bg-app border border-input rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors"
                                        placeholder="Captured once for telecom parent project"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <ComboboxSelect
                                        label="Project Manager"
                                        required
                                        options={managerOptions}
                                        value={formData.managerId}
                                        onChange={handleManagerChange}
                                        placeholder="Select Manager..."
                                        error={errors.managerId}
                                        emptyMessage="No matching staff found in HRM."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Section: Timeline */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Timeline</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Estimated Start Date <span className="text-red-400">*</span></label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={e => handleChange('startDate', e.target.value)}
                                        className={`w-full bg-app border ${errors.startDate ? 'border-red-500/50' : 'border-input'} rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors `}
                                    />
                                    {errors.startDate && <p className="text-xs text-red-400 mt-1">{errors.startDate}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Estimated End Date <span className="text-red-400">*</span></label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => handleChange('endDate', e.target.value)}
                                        className={`w-full bg-app border ${errors.endDate ? 'border-red-500/50' : 'border-input'} rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors `}
                                    />
                                    {errors.endDate && <p className="text-xs text-red-400 mt-1">{errors.endDate}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        {/* Section: Financials */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Commercials</h3>

                            <div>
                                <label className="block text-xs font-medium text-muted mb-1.5">Project Cost (HT) <span className="text-red-400">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.costHT}
                                        onChange={e => handleChange('costHT', e.target.value)}
                                        className={`w-full bg-app border ${errors.costHT ? 'border-red-500/50' : 'border-input'} rounded-lg pl-8 pr-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors font-mono`}
                                        placeholder="0.00"
                                    />
                                </div>
                                {errors.costHT && <p className="text-xs text-red-400 mt-1">{errors.costHT}</p>}
                            </div>

                            {/* Cost Summary Card */}
                            <div className="mt-4 bg-card/70 border border-border/60 rounded-lg p-4 grid grid-cols-3 gap-4">
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">HT</span>
                                    <span className="block text-sm font-mono text-primary">${costHT.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">VAT (16%)</span>
                                    <span className="block text-sm font-mono text-secondary">${vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase tracking-wider text-emerald-500/70 mb-1">TTC (Total)</span>
                                    <span className="block text-sm font-mono text-emerald-400 font-bold">${costTTC.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-border/60 bg-card/70 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted hover:text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        // disabled={!validate()} // Optional: disable button if invalid
                        >
                            Create Project
                        </button>
                    </div>
                </form>

                {showClientCreateModal && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
                        <div className="w-full max-w-2xl rounded-xl border border-input bg-card shadow-2xl">
                            <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-primary">Create CRM Client Inline</h4>
                                    <p className="text-[11px] text-muted">Only client name is required. Remaining profile can be completed later.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowClientCreateModal(false);
                                        setClientCreateError('');
                                    }}
                                    className="text-muted hover:text-primary"
                                >
                                    âœ•
                                </button>
                            </div>

                            <form onSubmit={submitInlineClientCreation} className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-muted mb-1">Client Name *</label>
                                        <input
                                            value={clientDraft.name}
                                            onChange={(e) => setClientDraft((prev) => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary"
                                            placeholder="e.g. Orange Telecom DRC"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Industry</label>
                                        <input value={clientDraft.industry} onChange={(e) => setClientDraft((prev) => ({ ...prev, industry: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Contact Person</label>
                                        <input value={clientDraft.contactPerson} onChange={(e) => setClientDraft((prev) => ({ ...prev, contactPerson: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Email</label>
                                        <input value={clientDraft.email} onChange={(e) => setClientDraft((prev) => ({ ...prev, email: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Phone</label>
                                        <input value={clientDraft.phone} onChange={(e) => setClientDraft((prev) => ({ ...prev, phone: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Country</label>
                                        <input value={clientDraft.country} onChange={(e) => setClientDraft((prev) => ({ ...prev, country: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Tax/Registration #</label>
                                        <input value={clientDraft.taxRegistrationNumber} onChange={(e) => setClientDraft((prev) => ({ ...prev, taxRegistrationNumber: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-muted mb-1">Billing Address</label>
                                        <input value={clientDraft.billingAddress} onChange={(e) => setClientDraft((prev) => ({ ...prev, billingAddress: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-muted mb-1">Notes</label>
                                        <textarea value={clientDraft.notes} onChange={(e) => setClientDraft((prev) => ({ ...prev, notes: e.target.value }))} className="w-full bg-app border border-input rounded-lg px-3 py-2 text-sm text-primary min-h-[70px]" />
                                    </div>
                                </div>

                                {duplicateCandidates.length > 0 && (
                                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                                        <div className="flex items-center gap-2 text-amber-300 text-xs mb-2">
                                            <AlertTriangle size={14} />
                                            Possible duplicates found in CRM
                                        </div>
                                        <div className="space-y-2 max-h-24 overflow-auto">
                                            {duplicateCandidates.slice(0, 5).map((candidate) => (
                                                <button
                                                    key={candidate.id}
                                                    type="button"
                                                    onClick={() => {
                                                        handleClientChange(candidate.id);
                                                        setShowClientCreateModal(false);
                                                        setClientCreateError('');
                                                    }}
                                                    className="w-full text-left text-xs px-2 py-1 rounded border border-border/70 text-primary hover:bg-surface"
                                                >
                                                    Use existing: {candidate.name} {candidate.industry ? `- ${candidate.industry}` : ''}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {clientCreateError && (
                                    <p className="text-xs text-rose-400">{clientCreateError}</p>
                                )}

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowClientCreateModal(false);
                                            setClientCreateError('');
                                        }}
                                        className="px-3 py-2 text-xs rounded-lg border border-input text-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        Add client to CRM and use
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------- Delete Confirmation Modal ------- */
interface DeleteConfirmModalProps {
  projectName: string;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ projectName, projectId, isOpen, onClose, onConfirm }) => {
  const [typedName, setTypedName] = useState('');
  const canDelete = typedName.trim() === projectName.trim();

  useEffect(() => { if (isOpen) setTypedName(''); }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-rose-500/30 bg-card shadow-2xl">
        <div className="px-6 py-5 border-b border-border/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
            <ShieldAlert size={20} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Delete Project Permanently</h3>
            <p className="text-[11px] text-muted">This action cannot be undone.</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <p className="text-xs text-rose-300">
              Deleting <strong className="text-rose-200">"{projectName}"</strong> will permanently remove the project, all its work items, documents, and imported data.
            </p>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Type <strong className="text-primary">{projectName}</strong> to confirm</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={projectName}
              className="w-full bg-app border border-input rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-rose-500/50 transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-primary rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => { if (canDelete) { onConfirm(projectId); onClose(); } }}
            disabled={!canDelete}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-500"
          >
            <Trash2 size={14} className="inline-block mr-1.5 -mt-0.5" />
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------- Main Projects Index Component ------- */
const ProjectsIndex: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isReadOnlyModule } = usePermissions();
    const { projects, workItems, deleteProject, setActiveProject, loadProjectsForUser, projectsLoading } = useProjectStore();
    const isProjectReadOnly = isReadOnlyModule('project');
    const isOmniAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
    
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
      if (!user?.id) return;
      void loadProjectsForUser(user.id);
    }, [user?.id, loadProjectsForUser]);

    // Global state refresh: reflects admin changes in near-real-time for team members
    useEffect(() => {
      if (!user?.id) return;

      const refresh = () => void loadProjectsForUser(user.id);
      const interval = setInterval(refresh, 15000);
      const onFocus = () => refresh();
      const onStorage = (event: StorageEvent) => {
        if (event.key === 'neox.global.projects.refreshAt') {
          refresh();
        }
      };

      window.addEventListener('focus', onFocus);
      window.addEventListener('storage', onStorage);
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('storage', onStorage);
      };
    }, [user?.id, loadProjectsForUser]);

    const engineeringStats = useMemo(() => {
      const doneStates = new Set(['done', 'complete', 'finance_synced']);
      const projectCount = projects.length;
      const totalItems = workItems.length;
      const completed = workItems.filter((wi) => doneStates.has(String(wi.status || '').toLowerCase())).length;
      const progression = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;

      const identityTokens = [user?.name, user?.email, user?.id]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);

      const assignedTasks = isOmniAdmin
        ? workItems.filter((wi) => String(wi.assignee || '').trim().length > 0).length
        : workItems.filter((wi) =>
            identityTokens.some((token) => String(wi.assignee || '').toLowerCase().includes(token))
          ).length;

      const activeMembers = new Set(
        projects.flatMap((project) => {
          const members = (project as unknown as { members?: Array<{ userId?: string }> }).members || [];
          return members.map((member) => String(member.userId || '')).filter(Boolean);
        })
      ).size;

      return {
        projectCount,
        progression,
        assignedTasks,
        activeMembers,
      };
    }, [projects, workItems, user?.id, user?.name, user?.email, isOmniAdmin]);

    // Navigation Handler
    const handleNavigate = (projectId: string) => {
        setActiveProject(projectId);
        navigate(`/projects/${projectId}/overview`);
    };

    // Filtering logic
    const filteredProjects = projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.managerName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sorting logic (Simplified for Index)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        
        let aValue: any = a[key as keyof typeof a];
        let bValue: any = b[key as keyof typeof b];

        // Handle nested progress if needed
        if (key === 'kpis.progress') {
            aValue = a.kpis.progress;
            bValue = b.kpis.progress;
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden font-sans">
            {/* Action Bar */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between bg-card/70 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-6 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search projects, clients or managers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-muted/60"
                        />
                    </div>
                    
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-muted hover:text-primary transition-all text-sm font-medium hover:bg-surface">
                        <Filter size={16} />
                        Filters
                    </button>
                    
                    <div className="h-6 w-px bg-border/60" />
                    
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                </div>

                <div className="flex items-center gap-3">
                    {!isProjectReadOnly && (
                      <button
                          onClick={() => setIsDrawerOpen(true)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 active:scale-95"
                      >
                          <Plus size={18} />
                          Create Project
                      </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto h-full">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="rounded-xl border border-border/60 bg-card p-4">
                            <p className="text-xs uppercase tracking-wider text-muted">Engineering Projects</p>
                            <p className="text-2xl font-bold text-primary mt-2">{engineeringStats.projectCount}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4">
                            <p className="text-xs uppercase tracking-wider text-muted">Progression</p>
                            <p className="text-2xl font-bold text-emerald-300 mt-2">{engineeringStats.progression}%</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4">
                            <p className="text-xs uppercase tracking-wider text-muted">Assigned Tasks</p>
                            <p className="text-2xl font-bold text-primary mt-2">{engineeringStats.assignedTasks}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4">
                            <p className="text-xs uppercase tracking-wider text-muted">Active Members</p>
                            <p className="text-2xl font-bold text-primary mt-2">{engineeringStats.activeMembers}</p>
                        </div>
                    </div>

                    {projectsLoading && (
                      <div className="mb-4 text-xs text-muted">Syncing projects from database...</div>
                    )}

                    {projects.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <ProfessionalEmptyState
                                icon={LayoutGrid}
                                title="No Projects Found"
                                description={isProjectReadOnly && !isOmniAdmin
                                  ? "You currently have read-only visibility. Join an engineering project team to access full project workflows."
                                  : "Start by creating your first project to manage workflows, tracking, and deliverables."}
                                action={isProjectReadOnly && !isOmniAdmin ? undefined : {
                                    label: "Create Project",
                                    icon: Plus,
                                    onClick: () => setIsDrawerOpen(true)
                                }}
                            />
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <ProfessionalEmptyState
                                icon={Search}
                                title="No matching results"
                                description={`We couldn't find any projects matching "${searchTerm}". Try a different term or clear filters.`}
                                action={{
                                    label: "Clear Search",
                                    onClick: () => setSearchTerm('')
                                }}
                            />
                        </div>
                    ) : viewMode === 'table' ? (
                        <ProjectsTableView 
                            projects={sortedProjects} 
                            sortConfig={sortConfig} 
                            onSort={handleSort}
                            onNavigate={handleNavigate}
                            onDelete={(id, name) => setDeleteTarget({ id, name })}
                        />
                    ) : (
                        <ProjectsListView 
                            projects={sortedProjects} 
                            onNavigate={handleNavigate}
                            onDelete={(id, name) => setDeleteTarget({ id, name })}
                        />
                    )}
                </div>
            </div>

            {!isProjectReadOnly && (
              <CreateProjectDrawer 
                  isOpen={isDrawerOpen} 
                  onClose={() => setIsDrawerOpen(false)}
                  onNavigate={handleNavigate}
              />
            )}

            <DeleteConfirmModal
              projectName={deleteTarget?.name || ''}
              projectId={deleteTarget?.id || ''}
              isOpen={!!deleteTarget}
              onClose={() => setDeleteTarget(null)}
              onConfirm={(id) => deleteProject(id)}
            />
        </div>
    );
};

export default ProjectsIndex;


