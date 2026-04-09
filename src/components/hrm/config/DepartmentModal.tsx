import React, { useState, useEffect } from 'react';
import { X, Save, Building2 } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { Department } from '../../../types/hrm';
import { useToast } from '../../ui/Toast';

interface DepartmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: Department | null;
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({ isOpen, onClose, department }) => {
    const { addDepartment, updateDepartment, onboardingTemplates, offboardingTemplates, departments } = useHRMStore();
    const { addToast } = useToast();

    const [form, setForm] = useState<Partial<Department>>({
        name: '',
        description: '',
        parentId: '',
        defaultOnboardingTemplateId: '',
        defaultOffboardingTemplateId: '',
    });

    useEffect(() => {
        if (department) {
            setForm({
                name: department.name,
                description: department.description || '',
                parentId: department.parentId || '',
                defaultOnboardingTemplateId: department.defaultOnboardingTemplateId || '',
                defaultOffboardingTemplateId: department.defaultOffboardingTemplateId || '',
            });
        } else {
            setForm({
                name: '',
                description: '',
                parentId: '',
                defaultOnboardingTemplateId: '',
                defaultOffboardingTemplateId: '',
            });
        }
    }, [department, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!form.name?.trim()) {
            addToast('Department name is required', 'error');
            return;
        }

        if (department) {
            updateDepartment(department.id, form);
            addToast('Department updated successfully', 'success');
        } else {
            addDepartment(form as Department);
            addToast('Department created successfully', 'success');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center">
                            <Building2 size={16} className="text-brand" />
                        </div>
                        <h2 className="text-[16px] font-semibold text-primary">
                            {department ? 'Edit Department' : 'New Department'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-[12px] text-muted mb-1.5 font-medium">Department Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Quality Assurance"
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all shadow-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-[12px] text-muted mb-1.5 font-medium">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Briefly describe the department's purpose..."
                            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all min-h-[80px] shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[12px] text-muted mb-1.5 font-medium">Parent Department</label>
                            <select
                                value={form.parentId}
                                onChange={e => setForm({ ...form, parentId: e.target.value })}
                                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-brand transition-all shadow-sm"
                            >
                                <option value="">Root (No Parent)</option>
                                {departments.filter(d => d.id !== department?.id).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="h-px bg-border/60 mb-4" />
                        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-4 px-1">Automation Defaults</h3>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[12px] text-muted mb-1.5 font-medium">Default Onboarding</label>
                                <select
                                    value={form.defaultOnboardingTemplateId}
                                    onChange={e => setForm({ ...form, defaultOnboardingTemplateId: e.target.value })}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-brand transition-all shadow-sm"
                                >
                                    <option value="">Manual Selection</option>
                                    {onboardingTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] text-muted mb-1.5 font-medium">Default Offboarding</label>
                                <select
                                    value={form.defaultOffboardingTemplateId}
                                    onChange={e => setForm({ ...form, defaultOffboardingTemplateId: e.target.value })}
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-brand transition-all shadow-sm"
                                >
                                    <option value="">Manual Selection</option>
                                    {offboardingTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-card flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-[14px] font-medium text-secondary hover:text-primary transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-brand hover:bg-brand/90 text-brand-fg text-[14px] font-semibold rounded-xl shadow-lg shadow-brand/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Save size={16} /> {department ? 'Update' : 'Create'} Department
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepartmentModal;
