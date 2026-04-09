import React, { useState } from 'react';
import { Plus, Calendar, Check, X } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { LeaveType } from '../../../types/hrm';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
    annual: 'Annual Leave', sick: 'Sick Leave', personal: 'Personal', unpaid: 'Unpaid',
};

const LeavePage: React.FC = () => {
    const { leaveRequests, currentRole, addLeaveRequest, approveLeave, rejectLeave } = useHRMStore();
    const { addToast } = useToast();
    const [tab, setTab] = useState<'my' | 'approvals'>('my');
    const [addModalOpen, setAddModalOpen] = useState(false);

    // Form state
    const [leaveType, setLeaveType] = useState<LeaveType>('annual');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const myLeave = leaveRequests.filter(lr => lr.employeeId === 'emp-1');
    const pendingApprovals = leaveRequests.filter(lr => lr.status === 'pending');
    const showApprovals = can(currentRole, 'approve', 'team_leave');

    const handleSubmit = () => {
        if (!startDate || !endDate || !reason) return;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        addLeaveRequest({ employeeId: 'emp-1', employeeName: 'Jane Doe', type: leaveType, startDate, endDate, days, reason });
        addToast('Leave request submitted');
        setAddModalOpen(false);
        setStartDate(''); setEndDate(''); setReason('');
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader
                title="Leave"
                subtitle="Manage time-off requests"
                actions={
                    can(currentRole, 'create', 'leave') ? (
                        <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
                            <Plus size={15} /> Request Leave
                        </button>
                    ) : undefined
                }
            />

            {/* Tabs */}
            {showApprovals && (
                <div className="flex gap-0 px-8 border-b border-border/60">
                    <button onClick={() => setTab('my')} className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${tab === 'my' ? 'border-emerald-500 text-primary' : 'border-transparent text-muted hover:text-secondary'}`}>
                        My Leave
                    </button>
                    <button onClick={() => setTab('approvals')} className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === 'approvals' ? 'border-emerald-500 text-primary' : 'border-transparent text-muted hover:text-secondary'}`}>
                        Team Approvals
                        {pendingApprovals.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingApprovals.length}</span>}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-8">
                {tab === 'my' ? (
                    <div className="space-y-3">
                        {myLeave.length === 0 ? (
                            <div className="text-center text-muted py-20">No leave requests yet</div>
                        ) : (
                            myLeave.map(lr => (
                                <div key={lr.id} className="bg-card rounded-xl border border-border/60 p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                            <Calendar size={18} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-[14px] font-semibold text-primary">{LEAVE_TYPE_LABELS[lr.type]}</h4>
                                            <p className="text-[12px] text-muted">{lr.startDate} → {lr.endDate} · {lr.days} day{lr.days > 1 ? 's' : ''}</p>
                                            <p className="text-[11px] text-muted mt-0.5">{lr.reason}</p>
                                        </div>
                                    </div>
                                    <StatusChip status={lr.status} />
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingApprovals.length === 0 ? (
                            <div className="text-center text-muted py-20">No pending approvals</div>
                        ) : (
                            pendingApprovals.map(lr => (
                                <div key={lr.id} className="bg-card rounded-xl border border-border/60 p-5 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[14px] font-semibold text-primary">{lr.employeeName}</h4>
                                        <p className="text-[12px] text-muted">{LEAVE_TYPE_LABELS[lr.type]} · {lr.startDate} → {lr.endDate} · {lr.days} days</p>
                                        <p className="text-[11px] text-muted mt-0.5">{lr.reason}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { approveLeave(lr.id); addToast('Leave approved'); }} className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg transition-colors"><Check size={16} /></button>
                                        <button onClick={() => { rejectLeave(lr.id, 'Denied'); addToast('Leave rejected', 'error'); }} className="p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"><X size={16} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Request Leave Modal */}
            <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Request Leave" footer={
                <>
                    <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Submit Request</button>
                </>
            }>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Leave Type</label>
                        <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none">
                            <option value="annual">Annual Leave</option>
                            <option value="sick">Sick Leave</option>
                            <option value="personal">Personal</option>
                            <option value="unpaid">Unpaid</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] font-semibold text-muted mb-1.5">Start Date *</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-muted mb-1.5">End Date *</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none focus:border-emerald-500/50" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-muted mb-1.5">Reason *</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Brief reason..." className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50 resize-none" />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default LeavePage;



