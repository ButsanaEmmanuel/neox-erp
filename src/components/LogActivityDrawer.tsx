import React, { useState } from 'react';
import { CreateActivityPayload, ActivityType } from '../types/activity';
import { useActivityStore } from '../store/useActivityStore';
import { useDeals } from '../contexts/DealsContext';
import { usePeople } from '../contexts/PeopleContext';
import { useCompanies } from '../contexts/CompaniesContext';
import { X, Phone, Mail, MessageSquare, Calendar, Link as LinkIcon, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LogActivityDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const LogActivityDrawer: React.FC<LogActivityDrawerProps> = ({ isOpen, onClose }) => {
    const { logActivity } = useActivityStore();
    const { deals } = useDeals();
    const { people } = usePeople();
    const { companies } = useCompanies();

    const [type, setType] = useState<ActivityType>('note');
    const [body, setBody] = useState('');
    const [relatedDealId, setRelatedDealId] = useState('');
    const [relatedPersonId, setRelatedPersonId] = useState('');
    const [relatedCompanyId, setRelatedCompanyId] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;

        logActivity({
            type,
            body,
            dealId: relatedDealId || undefined,
            personId: relatedPersonId || undefined,
            companyId: relatedCompanyId || undefined,
            timestamp: new Date().toISOString()
        });

        // Reset
        setBody('');
        setRelatedDealId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-app">
                    <h2 className="text-lg font-semibold text-primary">Log Activity</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-secondary hover:text-primary">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Activity Type Selector */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'note', label: 'Note', icon: MessageSquare },
                            { id: 'call', label: 'Call', icon: Phone },
                            { id: 'email', label: 'Email', icon: Mail },
                            { id: 'meeting', label: 'Meeting', icon: Calendar },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setType(t.id as ActivityType)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                                    type === t.id
                                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                                        : "bg-surface border-border/70 text-secondary hover:bg-[#2d3748]"
                                )}
                            >
                                <t.icon size={20} className="mb-1.5" />
                                <span className="text-xs font-medium">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Body */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted uppercase tracking-wider">Content *</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="What happened?"
                            className="w-full h-32 bg-surface border border-input rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                            autoFocus
                        />
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
                                onChange={(e) => setRelatedDealId(e.target.value)}
                                className="w-full bg-surface border border-input rounded-lg px-3 py-2 text-sm text-secondary focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Select Deal...</option>
                                {deals.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </form>

                <div className="h-20 border-t border-border flex items-center justify-end px-6 bg-app gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-surface transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!body.trim()}
                        className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={16} />
                        Log Activity
                    </button>
                </div>
            </div>
        </>
    );
};

export default LogActivityDrawer;

