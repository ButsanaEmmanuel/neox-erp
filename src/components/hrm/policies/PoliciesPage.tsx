import React, { useState } from 'react';
import { FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import Drawer from '../../ui/Drawer';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import type { Policy } from '../../../types/hrm';

const PoliciesPage: React.FC = () => {
    const { policies, acknowledgePolicy, currentRole } = useHRMStore();
    const { addToast } = useToast();
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const acknowledged = policies.filter(p => p.acknowledged).length;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <PageHeader
                title="Policies & Acknowledgements"
                subtitle={`${acknowledged}/${policies.length} acknowledged`}
            />

            {/* Summary */}
            <div className="flex-none px-8 py-4 border-b border-border/60 flex gap-4">
                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[12px] font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle size={14} /> {acknowledged} Acknowledged
                </div>
                <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[12px] font-semibold text-amber-400 flex items-center gap-2">
                    <AlertCircle size={14} /> {policies.length - acknowledged} Pending
                </div>
            </div>

            {/* Policy List */}
            <div className="flex-1 overflow-y-auto p-8 space-y-3">
                {policies.map(policy => (
                    <div key={policy.id} className="bg-card rounded-xl border border-border/60 p-5 flex items-center justify-between hover:border-border transition-all cursor-pointer group"
                        onClick={() => { setSelectedPolicy(policy); setDrawerOpen(true); }}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-none ${policy.acknowledged ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                                <FileText size={18} className={policy.acknowledged ? 'text-emerald-400' : 'text-amber-400'} />
                            </div>
                            <div>
                                <h4 className="text-[14px] font-semibold text-primary group-hover:text-emerald-400 transition-colors">{policy.title}</h4>
                                <p className="text-[12px] text-muted">{policy.category} · v{policy.version} · Published {policy.publishedDate}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {policy.acknowledged ? (
                                <span className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Acknowledged {policy.acknowledgedDate ? new Date(policy.acknowledgedDate).toLocaleDateString() : ''}</span>
                            ) : (
                                <span className="text-[11px] text-amber-400">Pending</span>
                            )}
                            <Eye size={16} className="text-muted group-hover:text-muted transition-colors" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Policy Viewer Drawer */}
            <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={selectedPolicy?.title || 'Policy'} width="max-w-lg">
                {selectedPolicy && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 text-[12px] text-muted">
                            <span>Version {selectedPolicy.version}</span>
                            <span>·</span>
                            <span>{selectedPolicy.category}</span>
                            <span>·</span>
                            <span>Published {selectedPolicy.publishedDate}</span>
                        </div>

                        <div className="bg-app rounded-xl border border-border/60 p-5">
                            <p className="text-[13px] text-secondary leading-relaxed whitespace-pre-wrap">{selectedPolicy.content}</p>
                        </div>

                        {!selectedPolicy.acknowledged && can(currentRole, 'acknowledge', 'policies') && (
                            <button
                                onClick={() => { acknowledgePolicy(selectedPolicy.id); addToast('Policy acknowledged'); setDrawerOpen(false); }}
                                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={16} /> Acknowledge Policy
                            </button>
                        )}

                        {selectedPolicy.acknowledged && (
                            <div className="text-center py-3 text-[13px] text-emerald-400 font-medium flex items-center justify-center gap-2">
                                <CheckCircle size={16} /> You have acknowledged this policy
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default PoliciesPage;



