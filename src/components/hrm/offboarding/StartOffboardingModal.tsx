import React, { useState } from 'react';
import { X, LogOut, Calendar, AlertTriangle } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import type { ExitReason } from '../../../types/hrm';
import { useToast } from '../../ui/Toast';

interface StartOffboardingModalProps {
    employeeId: string;
    onClose: () => void;
}

const StartOffboardingModal: React.FC<StartOffboardingModalProps> = ({ employeeId, onClose }) => {
    const { employees, departments, offboardingTemplates, startOffboarding } = useHRMStore();
    const { addToast } = useToast();

    const employee = employees.find(e => e.id === employeeId);
    const department = departments.find(d => d.id === employee?.departmentId);

    const [form, setForm] = useState({
        exitDate: '',
        lastWorkingDay: '',
        reason: 'resignation' as ExitReason,
        templateId: department?.defaultOffboardingTemplateId || '',
        notes: '',
    });

    if (!employee) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.exitDate || !form.lastWorkingDay || !form.templateId) {
            addToast('Please fill in all required fields', 'error');
            return;
        }

        startOffboarding(
            employeeId,
            form.templateId,
            form.exitDate,
            form.lastWorkingDay,
            form.reason,
            form.notes
        );

        addToast(`Offboarding started for ${employee.name}`, 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-card border border-border/60 rounded-xl shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <h2 className="text-[16px] font-semibold text-primary">Offboard Employee</h2>
                            <p className="text-[12px] text-muted">{employee.name} · {employee.roleTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] text-muted mb-1.5">Last Working Day</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="date"
                                    required
                                    value={form.lastWorkingDay}
                                    onChange={e => setForm({ ...form, lastWorkingDay: e.target.value })}
                                    className="w-full bg-app border border-input rounded-lg pl-9 pr-3 py-2 text-[13px] text-primary focus:outline-none focus:border-red-500/50"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[12px] text-muted mb-1.5">Exit Date</label>
                            <input
                                type="date"
                                required
                                value={form.exitDate}
                                onChange={e => setForm({ ...form, exitDate: e.target.value })}
                                className="w-full bg-app border border-input rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-red-500/50"
                            />
                        </div>
                    </div>

                    {/* Reason & Template */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] text-muted mb-1.5">Exit Reason</label>
                            <select
                                value={form.reason}
                                onChange={e => setForm({ ...form, reason: e.target.value as ExitReason })}
                                className="w-full bg-app border border-input rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-red-500/50"
                            >
                                <option value="resignation">Resignation</option>
                                <option value="termination">Termination</option>
                                <option value="contract_end">Contract End</option>
                                <option value="retirement">Retirement</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[12px] text-muted mb-1.5">Offboarding Template</label>
                            <select
                                required
                                value={form.templateId}
                                onChange={e => setForm({ ...form, templateId: e.target.value })}
                                className="w-full bg-app border border-input rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-red-500/50"
                            >
                                <option value="">Select Template...</option>
                                {offboardingTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-[12px] text-muted mb-1.5">Exit Notes / Comments</label>
                        <textarea
                            rows={3}
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            className="w-full bg-app border border-input rounded-lg px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-red-500/50 resize-none"
                            placeholder="Reason details, handover notes, etc."
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                        <AlertTriangle size={16} className="text-red-400 flex-none" />
                        <p className="text-[11px] text-red-200/70">
                            Starting offboarding will change the employee status to <strong>Offboarding</strong> and create a task list.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-[13px] font-semibold rounded-lg shadow-lg shadow-red-900/20 transition-all"
                        >
                            Start Offboarding
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StartOffboardingModal;



