import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { OnboardingTemplate, OffboardingTemplate, OnboardingTaskBlueprint, OffboardingTaskBlueprint } from '../../../types/hrm';
import { useToast } from '../../ui/Toast';

interface TemplateEditorProps {
    type: 'onboarding' | 'offboarding';
    template: OnboardingTemplate | OffboardingTemplate | null;
    onClose: () => void;
}

type Blueprint = OnboardingTaskBlueprint | OffboardingTaskBlueprint;

const TemplateEditor: React.FC<TemplateEditorProps> = ({ type, template, onClose }) => {
    const {
        departments,
        addOnboardingTemplate,
        updateOnboardingTemplate,
        addOffboardingTemplate,
        updateOffboardingTemplate
    } = useHRMStore();
    const { addToast } = useToast();

    // Form State
    const [name, setName] = useState('');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [tasks, setTasks] = useState<Blueprint[]>([]);

    // Init form
    useEffect(() => {
        if (template) {
            setName(template.name);
            setDepartmentId(template.departmentId || '');
            setTasks([...template.tasksBlueprint]);
        } else {
            setName(`New ${type === 'onboarding' ? 'Onboarding' : 'Offboarding'} Template`);
            setTasks([]);
        }
    }, [template, type]);

    const handleSave = () => {
        if (!name.trim()) {
            addToast('Template name is required', 'error');
            return;
        }
        if (tasks.length === 0) {
            addToast('Add at least one task', 'error');
            return;
        }

        const payload = {
            name,
            departmentId: departmentId || undefined,
            tasksBlueprint: tasks,
        };

        if (type === 'onboarding') {
            if (template) updateOnboardingTemplate(template.id, payload as any);
            else addOnboardingTemplate(payload as any);
        } else {
            if (template) updateOffboardingTemplate(template.id, payload as any);
            else addOffboardingTemplate(payload as any);
        }

        addToast('Template saved successfully', 'success');
        onClose();
    };

    const addTask = () => {
        const base = {
            title: 'New Task',
            ownerRole: 'hr',
            required: true,
        };
        const newTask = type === 'onboarding'
            ? { ...base, defaultDueDays: 0 }
            : base;

        setTasks([...tasks, newTask as Blueprint]);
    };

    const updateTask = (index: number, updates: Partial<Blueprint>) => {
        const newTasks = [...tasks];
        newTasks[index] = { ...newTasks[index], ...updates } as Blueprint;
        setTasks(newTasks);
    };

    const removeTask = (index: number) => {
        setTasks(tasks.filter((_, i) => i !== index));
    };

    const moveTask = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= tasks.length) return;
        const newTasks = [...tasks];
        const temp = newTasks[index];
        newTasks[index] = newTasks[index + direction];
        newTasks[index + direction] = temp;
        setTasks(newTasks);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full animate-slide-in-right">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-[16px] font-semibold text-primary">
                        {template ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* General Settings */}
                    <div className="space-y-4">
                        <h3 className="text-[13px] font-semibold text-primary uppercase tracking-wider">General Info</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[12px] text-muted mb-1.5">Template Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-brand"
                                />
                            </div>
                            <div>
                                <label className="block text-[12px] text-muted mb-1.5">Department (Optional)</label>
                                <select
                                    value={departmentId}
                                    onChange={e => setDepartmentId(e.target.value)}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-brand"
                                >
                                    <option value="">Global / No specific department</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/60 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[13px] font-semibold text-primary uppercase tracking-wider">Workflow Steps</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={addTask} className="text-[12px] font-medium text-brand hover:text-brand/80 flex items-center gap-1">
                                    <Plus size={14} /> Add Step
                                </button>
                            </div>
                        </div>

                        {/* Quick Suggestions */}
                        <div className="mb-6 p-4 bg-surface/50 border border-dashed border-border rounded-xl">
                            <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Quick Suggestions</h4>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { title: 'Provision IT Gear (Laptop, Monitor)', role: 'it', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                                    { title: 'Setup ERP & System Access', role: 'it', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                                    { title: 'Assign Corporate Credit Card', role: 'finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                                    { title: 'Payroll & Tax Integration', role: 'hr', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                                    { title: 'Issue Office Access Badge', role: 'hr', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                                    { title: 'SCM Uniform & Safety Gear', role: 'scm', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                                    { title: 'Vehicle Fleet Assignment', role: 'scm', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                                    { title: 'Conduct Safety Training', role: 'manager', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                                ].map((suggestion, sIdx) => (
                                    <button
                                        key={sIdx}
                                        onClick={() => {
                                            const newTask = {
                                                title: suggestion.title,
                                                ownerRole: suggestion.role as any,
                                                required: true,
                                                defaultDueDays: type === 'onboarding' ? 0 : undefined
                                            };
                                            setTasks([...tasks, newTask as Blueprint]);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-medium border ${suggestion.color} hover:scale-105 transition-all whitespace-nowrap`}
                                    >
                                        + {suggestion.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {tasks.map((task, idx) => (
                                <div key={idx} className="bg-surface border border-border rounded-lg p-3 flex gap-3 items-start group">
                                    <div className="flex flex-col gap-1 mt-1 text-muted">
                                        <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="hover:text-primary disabled:opacity-30"><ArrowUp size={14} /></button>
                                        <button onClick={() => moveTask(idx, 1)} disabled={idx === tasks.length - 1} className="hover:text-primary disabled:opacity-30"><ArrowDown size={14} /></button>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={task.title}
                                                onChange={e => updateTask(idx, { title: e.target.value })}
                                                placeholder="Task title..."
                                                className="flex-1 bg-transparent border-b border-border pb-1 text-[13px] text-primary focus:border-brand focus:outline-none"
                                            />
                                            <button onClick={() => removeTask(idx)} className="text-muted hover:text-red-400">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <select
                                                value={task.ownerRole}
                                                onChange={e => updateTask(idx, { ownerRole: e.target.value as any })}
                                                className="bg-surface border border-input rounded text-[11px] text-secondary px-2 py-1 focus:outline-none"
                                            >
                                                <option value="hr">HR</option>
                                                <option value="it">IT</option>
                                                <option value="manager">Manager</option>
                                                <option value="employee">Employee</option>
                                            </select>

                                            <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={task.required}
                                                    onChange={e => updateTask(idx, { required: e.target.checked })}
                                                    className="rounded border-input bg-surface"
                                                />
                                                Required
                                            </label>

                                            {type === 'onboarding' && (
                                                <div className="flex items-center gap-2 text-[11px] text-muted">
                                                    <span>Due: day</span>
                                                    <input
                                                        type="number"
                                                        value={(task as OnboardingTaskBlueprint).defaultDueDays ?? 0}
                                                        onChange={e => updateTask(idx, { defaultDueDays: parseInt(e.target.value) || 0 })}
                                                        className="w-12 bg-surface border border-input rounded px-1 py-0.5 text-center text-primary"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && (
                                <div className="text-center py-8 text-[13px] text-muted italic">No tasks added yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-card flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-secondary hover:text-primary">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-brand hover:bg-brand/90 text-brand-fg text-[13px] font-semibold rounded-lg shadow-lg shadow-brand/20 transition-all">
                        <Save size={16} /> Save Template
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;



