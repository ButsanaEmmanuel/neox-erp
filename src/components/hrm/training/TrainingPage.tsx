import React, { useState } from 'react';
import { BookOpen, Award, AlertTriangle } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import DataTable, { Column } from '../../ui/DataTable';
import StatusChip from '../../ui/StatusChip';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { TrainingRecord } from '../../../types/hrm';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
    Compliance: <AlertTriangle size={14} className="text-amber-400" />,
    Technical: <BookOpen size={14} className="text-blue-400" />,
    Leadership: <Award size={14} className="text-purple-400" />,
};

const TrainingPage: React.FC = () => {
    const { trainingRecords, updateTrainingStatus, currentRole } = useHRMStore();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filtered = trainingRecords.filter(tr => {
        const matchSearch = tr.title.toLowerCase().includes(search.toLowerCase()) || tr.employeeName.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || tr.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const columns: Column<TrainingRecord>[] = [
        {
            key: 'title', header: 'Training', width: '2fr', sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center flex-none">
                        {CATEGORY_ICON[row.category] || <BookOpen size={14} className="text-muted" />}
                    </div>
                    <div>
                        <div className="text-[13px] font-medium text-primary">{row.title}</div>
                        <div className="text-[11px] text-muted">{row.category}</div>
                    </div>
                </div>
            ),
        },
        { key: 'employee', header: 'Employee', width: '1fr', render: (row) => <span className="text-muted text-[13px]">{row.employeeName}</span> },
        { key: 'due', header: 'Due Date', width: '100px', render: (row) => <span className="text-muted text-[12px]">{row.dueDate}</span> },
        { key: 'status', header: 'Status', width: '100px', render: (row) => <StatusChip status={row.status} /> },
        {
            key: 'action', header: '', width: '80px', align: 'right',
            render: (row) => {
                if (row.status === 'completed') return <span className="text-[11px] text-emerald-500">✓ Done</span>;
                if (!can(currentRole, 'edit', 'training') && currentRole !== 'staff') return null;
                return (
                    <button
                        onClick={(e) => { e.stopPropagation(); updateTrainingStatus(row.id, row.status === 'assigned' ? 'in_progress' : 'completed'); }}
                        className="px-2.5 py-1 bg-surface border border-input rounded text-[11px] font-medium text-secondary hover:bg-surface transition-colors"
                    >
                        {row.status === 'assigned' ? 'Start' : 'Complete'}
                    </button>
                );
            },
        },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader title="Training & Certifications" subtitle={`${trainingRecords.length} training records`} />

            {/* Toolbar */}
            <div className="flex-none px-6 py-3 flex items-center gap-3 border-b border-border/60 bg-card">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search training..." className="flex-1 max-w-xs pl-3 pr-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer">
                    <option value="all">All</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                </select>
            </div>

            <DataTable columns={columns} data={filtered} keyExtractor={r => r.id} emptyTitle="No training records" />
        </div>
    );
};

export default TrainingPage;



