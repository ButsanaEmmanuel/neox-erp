import React, { useState, useEffect } from 'react';
import { CreateTaskPayload, Task, TaskPriority } from '../types/task';
import { useTaskStore } from '../store/useTaskStore';
import { useDeals } from '../contexts/DealsContext';
import { usePeople } from '../contexts/PeopleContext';
import { useCompanies } from '../contexts/CompaniesContext';
import { X, Calendar, Flag, Link as LinkIcon, Save, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CreateTaskDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    editTask?: Task | null;
}

const CreateTaskDrawer: React.FC<CreateTaskDrawerProps> = ({ isOpen, onClose, editTask }) => {
    const { addTask, updateTask, deleteTask } = useTaskStore();
    const { deals } = useDeals();
    const { people } = usePeople();
    const { companies } = useCompanies();

    const [title, setTitle] = useState('');
    const [dueAt, setDueAt] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [relatedDealId, setRelatedDealId] = useState('');
    const [relatedPersonId, setRelatedPersonId] = useState('');
    const [relatedCompanyId, setRelatedCompanyId] = useState('');

    // Reset or Populate form
    useEffect(() => {
        if (isOpen) {
            if (editTask) {
                setTitle(editTask.title);
                // Convert ISO to YYYY-MM-DD for input[type=date]
                setDueAt(editTask.dueAt ? new Date(editTask.dueAt).toISOString().split('T')[0] : '');
                setPriority(editTask.priority);
                setRelatedDealId(editTask.dealId || '');
                setRelatedPersonId(editTask.personId || '');
                setRelatedCompanyId(editTask.companyId || '');
            } else {
                setTitle('');
                setDueAt(new Date().toISOString().split('T')[0]); // Default today
                setPriority('medium');
                setRelatedDealId('');
                setRelatedPersonId('');
                setRelatedCompanyId('');
            }
        }
    }, [isOpen, editTask]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!title.trim()) return;

        const payload: CreateTaskPayload = {
            title,
            dueAt: dueAt ? new Date(dueAt).toISOString() : new Date().toISOString(),
            priority,
            ownerId: 'user-1', // Mock user
            dealId: relatedDealId || undefined,
            personId: relatedPersonId || undefined,
            companyId: relatedCompanyId || undefined
        };

        if (editTask) {
            updateTask({ ...payload, id: editTask.id });
        } else {
            addTask(payload);
        }

        onClose();
    };

    const handleDelete = () => {
        if (editTask && confirm('Are you sure you want to delete this task?')) {
            deleteTask(editTask.id);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-app">
                    <h2 className="text-lg font-semibold text-primary">
                        {editTask ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-secondary hover:text-primary">
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Task Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Contract Review"
                            className="w-full bg-surface border border-input rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-emerald-500 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Due Date & Priority Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted uppercase tracking-wider">Due Date</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                                <input
                                    type="date"
                                    value={dueAt}
                                    onChange={(e) => setDueAt(e.target.value)}
                                    className="w-full bg-surface border border-input rounded-lg pl-10 pr-4 py-2 text-primary focus:outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted uppercase tracking-wider">Priority</label>
                            <div className="relative">
                                <Flag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                    className="w-full bg-surface border border-input rounded-lg pl-10 pr-4 py-2 text-primary focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                                >
                                    <option value="low">Low Priority</option>
                                    <option value="medium">Medium Priority</option>
                                    <option value="high">High Priority</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Related Objects Section */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="text-sm font-medium text-secondary flex items-center gap-2">
                            <LinkIcon size={16} className="text-emerald-500" />
                            Related To
                        </h3>

                        {/* Deal Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted">Deal</label>
                            <select
                                value={relatedDealId}
                                onChange={(e) => {
                                    const did = e.target.value;
                                    setRelatedDealId(did);
                                    // Auto-link company/person if found
                                    const deal = deals.find(d => d.id === did);
                                    if (deal) {
                                        if (deal.companyId && !relatedCompanyId) setRelatedCompanyId(deal.companyId);
                                        if (deal.primaryContactId && !relatedPersonId) setRelatedPersonId(deal.primaryContactId);
                                    }
                                }}
                                className="w-full bg-surface border border-input rounded-lg px-3 py-2 text-sm text-secondary focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Select Deal...</option>
                                {deals.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Person Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted">Person</label>
                            <select
                                value={relatedPersonId}
                                onChange={(e) => setRelatedPersonId(e.target.value)}
                                className="w-full bg-surface border border-input rounded-lg px-3 py-2 text-sm text-secondary focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Select Person...</option>
                                {people.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Company Picker */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted">Company</label>
                            <select
                                value={relatedCompanyId}
                                onChange={(e) => setRelatedCompanyId(e.target.value)}
                                className="w-full bg-surface border border-input rounded-lg px-3 py-2 text-sm text-secondary focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Select Company...</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="h-20 border-t border-border flex items-center justify-between px-6 bg-app">
                    {editTask ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    ) : <div />} {/* Spacer */}

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-surface transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!title.trim()}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Save size={16} />
                            {editTask ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CreateTaskDrawer;

