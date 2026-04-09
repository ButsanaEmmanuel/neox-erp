import React, { useState, useMemo } from 'react';
import {
    Search,
    Filter,
    Upload,
    Plus,
    Mail,
    Phone,
    Building2,
    Calendar,
    X,
    ChevronDown,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getStageBadgeStyles, Stage } from '../constants/crm';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Types ---

interface Contact {
    id: string;
    name: string;
    avatarBg: string; // Hex color for avatar background
    company: string;
    companyInitials: string;
    email: string;
    phone: string;
    stage: Stage;
    lastActivity: string;
    createdDate: string; // For detail view
}

// --- Mock Data ---

const MOCK_CONTACTS: Contact[] = [
    { id: '1', name: 'Sarah Chen', avatarBg: '#3B82F6', company: 'Aether Corp', companyInitials: 'AC', email: 's.chen@aether.com', phone: '+1 415 234 5678', stage: 'Qualified', lastActivity: '2h ago', createdDate: 'Oct 24, 2023' },
    { id: '2', name: 'Marcus Webb', avatarBg: '#10B981', company: 'InfraCo', companyInitials: 'IC', email: 'm.webb@infraco.io', phone: '+44 20 7946 0321', stage: 'Proposal', lastActivity: '1d ago', createdDate: 'Nov 12, 2023' },
    { id: '3', name: 'Priya Nair', avatarBg: '#F59E0B', company: 'Omni Retail', companyInitials: 'OR', email: 'p.nair@omniretail.com', phone: '+91 98 2031 4456', stage: 'Discovery', lastActivity: '3d ago', createdDate: 'Dec 05, 2023' },
    { id: '4', name: 'Tom Eriksson', avatarBg: '#8B5CF6', company: 'Quantum GmbH', companyInitials: 'QG', email: 't.eriksson@quantumgmbh.de', phone: '+49 89 4521 8800', stage: 'Negotiation', lastActivity: '5h ago', createdDate: 'Jan 15, 2024' },
    { id: '5', name: 'Aisha Diallo', avatarBg: '#EC4899', company: 'CoreNet', companyInitials: 'CN', email: 'a.diallo@corenet.net', phone: '+33 1 4231 7890', stage: 'Closing', lastActivity: '30m ago', createdDate: 'Feb 01, 2024' },
    { id: '6', name: 'James Okafor', avatarBg: '#6366F1', company: 'SafeGuard IQ', companyInitials: 'SI', email: 'j.okafor@safeguard.io', phone: '+234 801 234 5678', stage: 'Proposal', lastActivity: '2d ago', createdDate: 'Feb 10, 2024' },
    { id: '7', name: 'Lin Huang', avatarBg: '#14B8A6', company: 'ManuFlex', companyInitials: 'MF', email: 'l.huang@manuflex.cn', phone: '+86 21 6543 2100', stage: 'Qualified', lastActivity: '4h ago', createdDate: 'Feb 18, 2024' },
    { id: '8', name: 'Camille Rousseau', avatarBg: '#F43F5E', company: 'Port Logic', companyInitials: 'PL', email: 'c.rousseau@portlogic.fr', phone: '+33 4 9123 5566', stage: 'Discovery', lastActivity: '1w ago', createdDate: 'Feb 20, 2024' },
];

export const CONTACT_STAGES: Stage[] = ['Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closing'];

interface ContactsProps {
    readonly isDark: boolean;
}

const Contacts: React.FC<ContactsProps> = ({ isDark }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Contact; direction: 'asc' | 'desc' } | null>(null);

    // --- Derived State ---

    const filteredContacts = useMemo(() => {
        let data = [...contacts];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(c =>
                c.name.toLowerCase().includes(lowerTerm) ||
                c.company.toLowerCase().includes(lowerTerm) ||
                c.email.toLowerCase().includes(lowerTerm)
            );
        }

        if (sortConfig) {
            data.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [contacts, searchTerm, sortConfig]);

    const selectedContact = useMemo(() =>
        contacts.find(c => c.id === selectedContactId),
        [contacts, selectedContactId]
    );

    // --- Handlers ---

    const handleSort = (key: keyof Contact) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleCreateContact = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        const newContact: Contact = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('company') as string,
            companyInitials: (formData.get('company') as string || 'XX').substring(0, 2).toUpperCase(),
            stage: formData.get('stage') as Stage,
            avatarBg: '#10B981', // Default green for now
            lastActivity: 'Just now',
            createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        };

        setContacts([newContact, ...contacts]);
        setIsNewContactModalOpen(false);
    };

    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden",
            isDark ? "bg-[#0d1117]" : "bg-slate-50"
        )}>
            {/* --- Header --- */}
            <div className="h-12 px-6 flex items-center justify-between flex-none border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">CRM · Contacts</span>
                    <h1 className={cn("text-[18px] font-semibold", isDark ? "text-slate-100" : "text-slate-900")}>Contacts</h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={cn(
                                "w-[220px] h-8 pl-9 pr-3 rounded-md text-[12px] border transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
                                isDark
                                    ? "bg-[#111827] border-[#1e2d3d] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50"
                                    : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-400"
                            )}
                        />
                    </div>

                    {/* Actions */}
                    <button className={cn(
                        "h-8 px-3 rounded-md flex items-center gap-2 text-[12px] font-medium border transition-colors",
                        isDark ? "border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}>
                        <Filter size={14} />
                        Filter
                    </button>
                    <button className={cn(
                        "h-8 px-3 rounded-md flex items-center gap-2 text-[12px] font-medium border transition-colors",
                        isDark ? "border-[#1e2d3d] text-slate-400 hover:text-slate-200 hover:bg-[#1e2d3d]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}>
                        <Upload size={14} />
                        Import
                    </button>
                    <button
                        onClick={() => setIsNewContactModalOpen(true)}
                        className="h-8 pl-2 pr-3.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[12px] font-semibold rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        New Contact
                    </button>
                </div>
            </div>

            {/* --- Table Container (Card) --- */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0 relative">
                <div className={cn(
                    "flex-1 border rounded-[10px] overflow-hidden flex flex-col relative",
                    isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                )}>

                    {/* Scrollable Area - Body & Header together for alignment */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col style={{ width: '28%' }} /> {/* Name */}
                                <col style={{ width: '18%' }} /> {/* Company */}
                                <col style={{ width: '22%' }} /> {/* Email */}
                                <col style={{ width: '14%' }} /> {/* Phone */}
                                <col style={{ width: '10%' }} /> {/* Stage */}
                                <col style={{ width: 'auto' }} /> {/* Activity */}
                            </colgroup>

                            {/* Sticky Header */}
                            <thead className={cn(
                                "sticky top-0 z-10 text-left border-b",
                                isDark ? "bg-[#0d1117] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                            )}>
                                <tr>
                                    {[
                                        { label: 'Name', key: 'name' },
                                        { label: 'Company', key: 'company' },
                                        { label: 'Email', key: 'email' },
                                        { label: 'Phone', key: 'phone' },
                                        { label: 'Stage', key: 'stage' },
                                        { label: 'Last Activity', key: 'lastActivity' }
                                    ].map((col) => (
                                        <th
                                            key={col.label}
                                            onClick={() => handleSort(col.key as keyof Contact)}
                                            className={cn(
                                                "h-10 px-5 text-[10px] font-bold uppercase tracking-[0.07em] cursor-pointer select-none transition-colors",
                                                isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {col.label}
                                                {sortConfig?.key === col.key && (
                                                    sortConfig.direction === 'asc'
                                                        ? <ArrowUp size={10} className="text-emerald-500" />
                                                        : <ArrowDown size={10} className="text-emerald-500" />
                                                )}
                                                {sortConfig?.key !== col.key && (
                                                    <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-30" />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Table Body */}
                            <tbody>
                                {filteredContacts.map((contact) => (
                                    <tr
                                        key={contact.id}
                                        onClick={() => setSelectedContactId(contact.id)}
                                        className={cn(
                                            "h-[56px] border-b transition-all cursor-pointer group relative",
                                            isDark
                                                ? "border-white/[0.03] hover:bg-white/[0.02]"
                                                : "border-slate-100 hover:bg-slate-50",
                                            selectedContactId === contact.id && (isDark ? "bg-emerald-500/[0.05]" : "bg-emerald-50")
                                        )}
                                    >
                                        {/* Name */}
                                        <td className={cn(
                                            "px-5 py-0 transition-all border-l-2 border-transparent",
                                            // Conditional Left Border on Hover/Active
                                            (selectedContactId === contact.id) ? "border-emerald-500" : "group-hover:border-emerald-500"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                                                        style={{ backgroundColor: contact.avatarBg }}
                                                    >
                                                        {contact.name.split(' ').map(n => n[0]).join('')}
                                                    </div>
                                                    {/* Hover Checkbox */}
                                                    <div className={cn(
                                                        "absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                                                        isDark ? "bg-[#111827] border border-slate-600" : "bg-white border border-slate-300"
                                                    )}>
                                                        <div className="w-3.5 h-3.5 rounded-[3px] border border-slate-500" />
                                                    </div>
                                                </div>
                                                <span className={cn("text-[13px] font-medium truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                                                    {contact.name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Company */}
                                        <td className="px-5 py-0">
                                            <div className="flex items-center gap-2">
                                                <div className="px-1.5 h-5 rounded-[4px] bg-[#1a2332] flex items-center justify-center text-[9px] font-bold text-blue-400">
                                                    {contact.companyInitials}
                                                </div>
                                                <span className="text-[13px] text-slate-500 truncate">{contact.company}</span>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td className="px-5 py-0">
                                            <span className="text-[13px] text-slate-500 font-mono truncate block max-w-full">
                                                {contact.email}
                                            </span>
                                        </td>

                                        {/* Phone */}
                                        <td className="px-5 py-0">
                                            <span className="text-[13px] text-slate-500 tabular-nums whitespace-nowrap">
                                                {contact.phone}
                                            </span>
                                        </td>

                                        {/* Stage */}
                                        <td className="px-5 py-0">
                                            <span
                                                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                                                style={getStageBadgeStyles(contact.stage)}
                                            >
                                                {contact.stage}
                                            </span>
                                        </td>

                                        {/* Activity */}
                                        <td className="px-5 py-0">
                                            <span className="text-[12px] text-slate-500 tabular-nums">
                                                {contact.lastActivity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- Slide-Over --- */}
            <AnimatePresence>
                {selectedContact && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={cn(
                            "absolute top-0 right-0 h-full w-[360px] border-l z-20 shadow-2xl flex flex-col",
                            isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                        )}
                    >
                        {/* Slide-over Header */}
                        <div className="p-6 border-b border-white/[0.06] flex-none">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold text-white shadow-md"
                                    style={{ backgroundColor: selectedContact.avatarBg }}
                                >
                                    {selectedContact.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <button
                                    onClick={() => setSelectedContactId(null)}
                                    className="p-1 rounded-md hover:bg-white/5 text-slate-500 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <h2 className={cn("text-[16px] font-semibold mb-0.5", isDark ? "text-white" : "text-slate-900")}>
                                {selectedContact.name}
                            </h2>
                            <p className="text-[12px] text-slate-500">{selectedContact.company}</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex px-6 border-b border-white/[0.06] gap-6">
                            {['Overview', 'Activity', 'Deals'].map((tab, i) => (
                                <button
                                    key={tab}
                                    className={cn(
                                        "py-3 text-[12px] font-medium border-b-2 transition-colors",
                                        i === 0
                                            ? "border-emerald-500 text-emerald-500"
                                            : "border-transparent text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-0">
                            {/* Overview Rows */}
                            <div className="flex flex-col">
                                {[
                                    { label: 'Email', value: selectedContact.email, icon: Mail },
                                    { label: 'Phone', value: selectedContact.phone, icon: Phone },
                                    { label: 'Company', value: selectedContact.company, icon: Building2 },
                                    { label: 'Created', value: selectedContact.createdDate, icon: Calendar },
                                ].map((row) => (
                                    <div key={row.label} className={cn(
                                        "px-6 py-3 border-b border-white/[0.03] flex items-center justify-between group",
                                        isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                                    )}>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <row.icon size={13} />
                                            <span className="text-[12px] font-medium">{row.label}</span>
                                        </div>
                                        <span className={cn(
                                            "text-[12px] font-mono select-all",
                                            isDark ? "text-slate-300" : "text-slate-700"
                                        )}>{row.value}</span>
                                    </div>
                                ))}

                                {/* Stage Row Special */}
                                <div className={cn(
                                    "px-6 py-3 border-b border-white/[0.03] flex items-center justify-between",
                                    isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                                )}>
                                    <span className="text-[12px] font-medium text-slate-500">Stage</span>
                                    <span
                                        className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border scale-90 origin-right"
                                        style={getStageBadgeStyles(selectedContact.stage)}
                                    >
                                        {selectedContact.stage}
                                    </span>
                                </div>
                            </div>

                            {/* Associated Deals */}
                            <div className="p-6">
                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Associated Deals</h3>
                                <div className={cn(
                                    "p-3 rounded-md border flex items-center justify-between",
                                    isDark ? "bg-[#0d1117] border-[#1e2d3d]" : "bg-slate-50 border-slate-200"
                                )}>
                                    <div>
                                        <p className={cn("text-[12px] font-semibold mb-0.5", isDark ? "text-slate-200" : "text-slate-800")}>
                                            {selectedContact.company} Expansion
                                        </p>
                                        <p className="text-[10px] text-slate-500">Close date: Mar 30, 2024</p>
                                    </div>
                                    <span className="text-[12px] font-mono font-medium text-emerald-500">$180k</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-white/[0.06] flex gap-3 bg-inherit z-10">
                            <button className={cn(
                                "flex-1 h-9 rounded-md border text-[12px] font-semibold shadow-sm transition-all",
                                isDark ? "border-[#1e2d3d] text-slate-300 hover:bg-[#1e2d3d]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}>
                                Send Email
                            </button>
                            <button className="flex-1 h-9 rounded-md bg-emerald-500 text-black text-[12px] font-semibold hover:bg-emerald-400 shadow-sm transition-all">
                                Move Stage
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- New Contact Modal --- */}
            <AnimatePresence>
                {isNewContactModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                            onClick={() => setIsNewContactModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className={cn(
                                "w-full max-w-[480px] rounded-xl border shadow-2xl relative z-10 overflow-hidden",
                                isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                            )}
                        >
                            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                                <h2 className={cn("text-[16px] font-semibold", isDark ? "text-white" : "text-slate-900")}>
                                    New Contact
                                </h2>
                                <button
                                    onClick={() => setIsNewContactModalOpen(false)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateContact} className="p-7">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                                        <input required name="name" type="text" className={cn(
                                            "w-full h-10 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100 placeholder:text-slate-700" : "bg-white border-slate-300"
                                        )} placeholder="e.g. Jane Doe" />
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Company</label>
                                        <input required name="company" type="text" className={cn(
                                            "w-full h-10 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100 placeholder:text-slate-700" : "bg-white border-slate-300"
                                        )} placeholder="Acme Inc." />
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone</label>
                                        <input name="phone" type="tel" className={cn(
                                            "w-full h-10 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100 placeholder:text-slate-700" : "bg-white border-slate-300"
                                        )} placeholder="+1 ..." />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                                        <input required name="email" type="email" className={cn(
                                            "w-full h-10 px-3 rounded-md border text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100 placeholder:text-slate-700" : "bg-white border-slate-300"
                                        )} placeholder="jane@example.com" />
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Stage</label>
                                        <div className="relative">
                                            <select name="stage" className={cn(
                                                "w-full h-10 px-3 rounded-md border text-[13px] appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                                isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100" : "bg-white border-slate-300"
                                            )}>
                                                {CONTACT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Owner</label>
                                        <div className="relative">
                                            <select name="owner" className={cn(
                                                "w-full h-10 px-3 rounded-md border text-[13px] appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all",
                                                isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-100" : "bg-white border-slate-300"
                                            )}>
                                                <option>Diva Kalala</option>
                                                <option>Sarah Johnson</option>
                                                <option>Alex Lee</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewContactModalOpen(false)}
                                        className={cn(
                                            "h-9 px-4 rounded-md text-[13px] font-medium border transition-colors",
                                            isDark ? "border-[#1e2d3d] text-slate-400 hover:text-slate-200" : "border-slate-300 text-slate-600"
                                        )}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="h-9 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-[13px] font-semibold shadow-lg shadow-emerald-500/20 transition-all"
                                    >
                                        Create Contact
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Contacts;
