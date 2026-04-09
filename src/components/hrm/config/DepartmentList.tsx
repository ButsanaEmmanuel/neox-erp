import React, { useState } from 'react';
import { Building2, Edit2, Check, X, ChevronRight, Trash2, GitMerge, Settings } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { Department } from '../../../types/hrm';
import { useToast } from '../../ui/Toast';

interface DepartmentListProps {
    searchQuery: string;
    onEdit: (dept: Department) => void;
}

const DepartmentList: React.FC<DepartmentListProps> = ({ searchQuery, onEdit }) => {
    const { departments, updateDepartment, deleteDepartment, onboardingTemplates, offboardingTemplates } = useHRMStore();
    const { addToast } = useToast();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Department>>({});

    const filteredDepts = departments.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleStartQuickEdit = (dept: Department) => {
        setEditingId(dept.id);
        setEditForm({
            defaultOnboardingTemplateId: dept.defaultOnboardingTemplateId || '',
            defaultOffboardingTemplateId: dept.defaultOffboardingTemplateId || '',
        });
    };

    const handleSaveQuickEdit = () => {
        if (!editingId) return;
        updateDepartment(editingId, editForm);
        addToast('Department settings updated', 'success');
        setEditingId(null);
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete the "${name}" department? This cannot be undone.`)) {
            deleteDepartment(id);
            addToast('Department deleted successfully', 'success');
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[2fr,1.5fr,1.5fr,120px] gap-4 px-4 py-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                <div>Department Details</div>
                <div>Default Onboarding</div>
                <div>Default Offboarding</div>
                <div className="text-right">Actions</div>
            </div>

            <div className="space-y-2">
                {filteredDepts.length === 0 ? (
                    <div className="p-12 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center">
                        <Building2 size={40} className="text-muted/20 mb-4" />
                        <h3 className="text-primary font-medium">No departments found</h3>
                        <p className="text-muted text-[13px]">Create your first department to get started.</p>
                    </div>
                ) : (
                    filteredDepts.map(dept => {
                        const isEditing = editingId === dept.id;
                        const onbTemplate = onboardingTemplates.find(t => t.id === dept.defaultOnboardingTemplateId);
                        const offTemplate = offboardingTemplates.find(t => t.id === dept.defaultOffboardingTemplateId);
                        const parentDept = departments.find(d => d.id === dept.parentId);

                        return (
                            <div key={dept.id} className={`grid grid-cols-[2fr,1.5fr,1.5fr,120px] gap-4 items-center p-4 rounded-xl border transition-all ${isEditing ? 'bg-surface border-brand/30' : 'bg-card border-border hover:border-border/50'}`}>

                                {/* Department Info */}
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center flex-none">
                                        <Building2 size={18} className="text-muted" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[14px] font-semibold text-primary">{dept.name}</span>
                                            {parentDept && (
                                                <div className="flex items-center gap-1 text-[10px] bg-surface border border-border px-1.5 py-0.5 rounded text-muted">
                                                    <GitMerge size={10} className="rotate-90" />
                                                    {parentDept.name}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[12px] text-muted line-clamp-1">{dept.description}</div>
                                    </div>
                                </div>

                                {/* Onboarding Template */}
                                <div>
                                    {isEditing ? (
                                        <select
                                            className="w-full bg-app border border-border rounded-md px-2 py-1.5 text-[13px] text-primary focus:border-brand focus:outline-none"
                                            value={editForm.defaultOnboardingTemplateId}
                                            onChange={e => setEditForm({ ...editForm, defaultOnboardingTemplateId: e.target.value })}
                                        >
                                            <option value="">(No default)</option>
                                            {onboardingTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-[13px] text-secondary">
                                            {onbTemplate ? onbTemplate.name : <span className="text-muted italic">None set</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Offboarding Template */}
                                <div>
                                    {isEditing ? (
                                        <select
                                            className="w-full bg-app border border-border rounded-md px-2 py-1.5 text-[13px] text-primary focus:border-brand focus:outline-none"
                                            value={editForm.defaultOffboardingTemplateId}
                                            onChange={e => setEditForm({ ...editForm, defaultOffboardingTemplateId: e.target.value })}
                                        >
                                            <option value="">(No default)</option>
                                            {offboardingTemplates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-[13px] text-secondary">
                                            {offTemplate ? offTemplate.name : <span className="text-muted italic">None set</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-1">
                                    {isEditing ? (
                                        <>
                                            <button onClick={handleSaveQuickEdit} title="Save Changes" className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                                                <Check size={14} />
                                            </button>
                                            <button onClick={() => setEditingId(null)} title="Cancel" className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-border transition-colors">
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => onEdit(dept)} title="Full Edit" className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-border hover:text-primary transition-all">
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => handleStartQuickEdit(dept)} title="Quick Template Edit" className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-border hover:text-brand transition-all">
                                                <Settings size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(dept.id, dept.name)} title="Delete Department" className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface text-muted hover:bg-red-500/10 hover:text-red-500 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DepartmentList;



