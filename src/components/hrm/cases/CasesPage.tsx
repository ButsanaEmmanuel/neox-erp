import React, { useState } from 'react';
import { Plus, AlertTriangle, MessageSquare } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import DataTable, { Column } from '../../ui/DataTable';
import StatusChip from '../../ui/StatusChip';
import Drawer from '../../ui/Drawer';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { HRCase, CasePriority } from '../../../types/hrm';

const CasesPage: React.FC = () => {
    const { cases, addCase, updateCaseStatus, addCaseNote, currentRole } = useHRMStore();
    const { addToast } = useToast();
    const [selectedCase, setSelectedCase] = useState<HRCase | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Add case form
    const [newSubject, setNewSubject] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPriority, setNewPriority] = useState<CasePriority>('medium');

    const filtered = cases.filter(c => statusFilter === 'all' || c.status === statusFilter);

    // Refresh selected case from store
    const currentCase = selectedCase ? cases.find(c => c.id === selectedCase.id) || selectedCase : null;

    const columns: Column<HRCase>[] = [
        {
            key: 'subject', header: 'Case', width: '2fr', sortable: true,
            render: (row) => (
                <div>
                    <div className="text-[13px] font-medium text-primary">{row.subject}</div>
                    <div className="text-[11px] text-muted truncate max-w-xs">{row.description}</div>
                </div>
            ),
        },
        { key: 'priority', header: 'Priority', width: '80px', render: (row) => <StatusChip status={row.priority} /> },
        { key: 'status', header: 'Status', width: '100px', render: (row) => <StatusChip status={row.status} /> },
        { key: 'assignee', header: 'Assignee', width: '1fr', render: (row) => <span className="text-[13px] text-secondary">{row.assignee}</span> },
        { key: 'date', header: 'Created', width: '100px', render: (row) => <span className="text-[12px] text-muted">{row.createdDate}</span> },
    ];

    const handleAddCase = () => {
        if (!newSubject || !newDesc) return;
        addCase({ subject: newSubject, description: newDesc, status: 'open', priority: newPriority, parties: [], assignee: 'Rachel Green', createdDate: new Date().toISOString().split('T')[0] });
        addToast('Case created');
        setAddModalOpen(false);
        setNewSubject(''); setNewDesc('');
    };

    const handleAddNote = () => {
        if (!currentCase || !newNote.trim()) return;
        addCaseNote(currentCase.id, { author: 'HR Officer', date: new Date().toISOString(), text: newNote });
        setNewNote('');
        addToast('Note added');
    };

    if (!can(currentRole, 'view', 'cases')) {
        return (
            <div className="h-full flex flex-col">
                <PageHeader title="Employee Cases" subtitle="Access restricted" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
                        <p className="text-[15px] text-primary font-semibold">Access Restricted</p>
                        <p className="text-[13px] text-muted mt-1">Only HR Officers can access employee cases.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader
                title="Employee Cases"
                subtitle="Employee relations and HR investigations"
                actions={
                    can(currentRole, 'create', 'cases') ? (
                        <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
                            <Plus size={15} /> New Case
                        </button>
                    ) : undefined
                }
            />

            {/* Filter Bar */}
            <div className="flex-none px-6 py-3 flex items-center gap-3 border-b border-border/60">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer">
                    <option value="all">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                </select>
            </div>

            <DataTable columns={columns} data={filtered} keyExtractor={r => r.id} onRowClick={(row) => { setSelectedCase(row); setDrawerOpen(true); }} emptyTitle="No cases" emptyDescription="No employee cases match your filters." />

            {/* Case Detail Drawer */}
            <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={currentCase?.subject || 'Case'} width="max-w-md">
                {currentCase && (
                    <div className="p-6 space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Priority</span><StatusChip status={currentCase.priority} /></div>
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Status</span><StatusChip status={currentCase.status} /></div>
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Assignee</span><span className="text-[13px] text-primary">{currentCase.assignee}</span></div>
                            <div className="flex justify-between"><span className="text-[12px] text-muted">Created</span><span className="text-[13px] text-primary">{currentCase.createdDate}</span></div>
                            {currentCase.parties.length > 0 && (
                                <div className="flex justify-between"><span className="text-[12px] text-muted">Parties</span><span className="text-[13px] text-primary">{currentCase.parties.join(', ')}</span></div>
                            )}
                        </div>

                        <div className="bg-surface rounded-xl border border-border/60 p-4">
                            <p className="text-[13px] text-secondary">{currentCase.description}</p>
                        </div>

                        {/* Status Actions */}
                        {currentCase.status !== 'resolved' && can(currentRole, 'edit', 'cases') && (
                            <div className="flex gap-2">
                                {currentCase.status === 'open' && (
                                    <button onClick={() => { updateCaseStatus(currentCase.id, 'investigating'); addToast('Case moved to investigating'); }} className="flex-1 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[12px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors">
                                        Start Investigation
                                    </button>
                                )}
                                <button onClick={() => { updateCaseStatus(currentCase.id, 'resolved'); addToast('Case resolved'); }} className="flex-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                    Resolve Case
                                </button>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <h4 className="text-[13px] font-semibold text-primary mb-3 flex items-center gap-2"><MessageSquare size={14} /> Notes</h4>
                            <div className="space-y-3 mb-4">
                                {currentCase.notes.map(note => (
                                    <div key={note.id} className="bg-surface rounded-lg p-3 border border-border/60">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-[11px] font-semibold text-secondary">{note.author}</span>
                                            <span className="text-[10px] text-muted">{new Date(note.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-[12px] text-secondary">{note.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-2 bg-surface border border-input rounded-lg text-[12px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                                <button onClick={handleAddNote} className="px-3 py-2 bg-surface border border-input rounded-lg text-[12px] text-secondary hover:bg-surface font-medium">Add</button>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Add Case Modal */}
            <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="New Case" footer={
                <>
                    <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
                    <button onClick={handleAddCase} className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Create Case</button>
                </>
            }>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[12px] font-semibold text-secondary mb-1.5">Subject *</label>
                        <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Case subject" className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-secondary mb-1.5">Description *</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} placeholder="Describe the case..." className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50 resize-none" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-secondary mb-1.5">Priority</label>
                        <select value={newPriority} onChange={e => setNewPriority(e.target.value as CasePriority)} className="w-full px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary focus:outline-none">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CasesPage;




