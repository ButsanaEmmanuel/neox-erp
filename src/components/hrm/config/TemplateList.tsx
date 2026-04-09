import React, { useState } from 'react';
import { FileText, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { OnboardingTemplate, OffboardingTemplate } from '../../../types/hrm';
import TemplateEditor from './TemplateEditor';
import { useToast } from '../../ui/Toast';

interface TemplateListProps {
    type: 'onboarding' | 'offboarding';
    searchQuery: string;
}

const TemplateList: React.FC<TemplateListProps> = ({ type, searchQuery }) => {
    const {
        onboardingTemplates,
        offboardingTemplates,
        deleteOnboardingTemplate,
        deleteOffboardingTemplate,
        addOnboardingTemplate,
        addOffboardingTemplate
    } = useHRMStore();
    const { addToast } = useToast();

    const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | OffboardingTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const templates = type === 'onboarding' ? onboardingTemplates : offboardingTemplates;

    // @ts-ignore - union type complexity
    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this template?')) {
            if (type === 'onboarding') deleteOnboardingTemplate(id);
            else deleteOffboardingTemplate(id);
            addToast('Template deleted', 'success');
        }
    };

    const handleDuplicate = (template: OnboardingTemplate | OffboardingTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTmpl = {
            ...template,
            name: `${template.name} (Copy)`,
            departmentId: undefined
        };
        // @ts-ignore
        if (type === 'onboarding') addOnboardingTemplate(newTmpl);
        // @ts-ignore
        else addOffboardingTemplate(newTmpl);
        addToast('Template duplicated', 'success');
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Create New Card */}
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex flex-col items-center justify-center p-8 border border-dashed border-input rounded-xl hover:bg-surface hover:border-border transition-all group"
                >
                    <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Plus size={24} className="text-muted group-hover:text-primary" />
                    </div>
                    <span className="text-[14px] font-medium text-muted group-hover:text-primary">Create New Template</span>
                </button>

                {filtered.map(template => (
                    <div
                        key={template.id}
                        onClick={() => setEditingTemplate(template)}
                        className="bg-card border border-border rounded-xl p-5 hover:border-input transition-colors cursor-pointer group relative overflow-hidden"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <FileText size={20} className="text-blue-400" />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleDuplicate(template, e)}
                                    className="p-1.5 hover:bg-surface rounded-md text-muted hover:text-primary"
                                    title="Duplicate"
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(template.id, e)}
                                    className="p-1.5 hover:bg-red-500/20 rounded-md text-muted hover:text-red-400"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-[15px] font-semibold text-primary mb-1">{template.name}</h3>
                        <p className="text-[12px] text-muted mb-4">
                            {template.tasksBlueprint.length} steps · {template.departmentId ? 'Department specific' : 'Global default'}
                        </p>

                        <div className="space-y-1">
                            {template.tasksBlueprint.slice(0, 3).map((task, i) => (
                                <div key={i} className="flex items-center gap-2 text-[12px] text-muted">
                                    <Check size={12} className="text-muted" />
                                    <span className="truncate">{task.title}</span>
                                </div>
                            ))}
                            {template.tasksBlueprint.length > 3 && (
                                <div className="text-[11px] text-muted pl-5">
                                    + {template.tasksBlueprint.length - 3} more tasks
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {(editingTemplate || isCreating) && (
                <TemplateEditor
                    type={type}
                    template={editingTemplate}
                    onClose={() => {
                        setEditingTemplate(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </>
    );
};

export default TemplateList;





