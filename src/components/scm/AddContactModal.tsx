import React, { useState, useEffect } from 'react';
import { useScmStore } from '../../store/scm/useScmStore';
import { X, UserPlus, Loader2, Mail, Phone, User, Briefcase } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const AddContactModal: React.FC = () => {
    const {
        isAddContactModalOpen,
        setAddContactModalOpen,
        addSupplierContact,
        selectedSupplierId,
        loading
    } = useScmStore();

    const [form, setForm] = useState({
        name: '',
        role: '',
        email: '',
        phone: ''
    });

    useEffect(() => {
        if (isAddContactModalOpen) {
            setForm({ name: '', role: '', email: '', phone: '' });
        }
    }, [isAddContactModalOpen]);

    if (!isAddContactModalOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId || !form.name) return;

        await addSupplierContact(selectedSupplierId, {
            id: uuidv4(),
            ...form
        });
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[120] animate-in fade-in duration-200"
                onClick={() => setAddContactModalOpen(false)}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[130] pointer-events-none p-4">
                <div className="w-full max-w-[400px] bg-card border border-border rounded-xl shadow-2xl pointer-events-auto flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-5 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <UserPlus size={18} className="text-primary" />
                            Add Contact
                        </h2>
                        <button onClick={() => setAddContactModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full h-10 pl-9 pr-3 rounded-md bg-muted/50 border border-input text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. Jane Doe"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Role / Job Title</label>
                            <div className="relative">
                                <Briefcase size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={form.role}
                                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full h-10 pl-9 pr-3 rounded-md bg-muted/50 border border-input text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g. Sales Manager"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full h-10 pl-9 pr-3 rounded-md bg-muted/50 border border-input text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                                    placeholder="jane@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full h-10 pl-9 pr-3 rounded-md bg-muted/50 border border-input text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10 bg-blue-600 text-white hover:bg-blue-500 rounded-md text-sm font-bold transition-all shadow-sm shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            Create Contact
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

export default AddContactModal;


