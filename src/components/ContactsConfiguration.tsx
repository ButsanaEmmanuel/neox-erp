import React, { useState } from 'react';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Lock,
    Search,
    Download,
    Upload,
    Check,
    X,
    Type,
    Hash,
    Calendar,
    List,
    Link as LinkIcon,
    Phone
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ContactsConfigurationProps {
    isDark: boolean;
    onBack: () => void;
}

interface CustomField {
    id: string;
    name: string;
    type: 'Text' | 'Number' | 'Date' | 'Select' | 'URL' | 'Phone';
    required: boolean;
    isSystem: boolean;
}

const INITIAL_FIELDS: CustomField[] = [
    { id: '1', name: 'Name', type: 'Text', required: true, isSystem: true },
    { id: '2', name: 'Email', type: 'Text', required: true, isSystem: true },
    { id: '3', name: 'Phone', type: 'Phone', required: false, isSystem: false },
    { id: '4', name: 'Company', type: 'Text', required: true, isSystem: false },
    { id: '5', name: 'Stage', type: 'Select', required: true, isSystem: false },
    { id: '6', name: 'Owner', type: 'Select', required: true, isSystem: false },
    { id: '7', name: 'LinkedIn URL', type: 'URL', required: false, isSystem: false },
    { id: '8', name: 'Notes', type: 'Text', required: false, isSystem: false },
];

const ContactsConfiguration: React.FC<ContactsConfigurationProps> = ({ isDark, onBack }) => {
    const [fields, setFields] = useState<CustomField[]>(INITIAL_FIELDS);
    const [hasChanges, setHasChanges] = useState(false);
    const [isAddingField, setIsAddingField] = useState(false);

    // New Field Form State
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState<CustomField['type']>('Text');
    const [newFieldRequired, setNewFieldRequired] = useState(false);

    // Permissions State
    const [globalSearch, setGlobalSearch] = useState(true);
    const [teamAddLimit, setTeamAddLimit] = useState(true);
    const [deleteApproval, setDeleteApproval] = useState(false);

    // Helpers
    const getIconForType = (type: CustomField['type']) => {
        switch (type) {
            case 'Text': return <Type size={12} />;
            case 'Number': return <Hash size={12} />;
            case 'Date': return <Calendar size={12} />;
            case 'Select': return <List size={12} />;
            case 'URL': return <LinkIcon size={12} />;
            case 'Phone': return <Phone size={12} />;
        }
    };

    const handleDeleteField = (id: string) => {
        setFields(prev => prev.filter(f => f.id !== id));
        setHasChanges(true);
    };

    const handleAddField = () => {
        if (!newFieldName.trim()) return;
        const newField: CustomField = {
            id: Math.random().toString(36).substr(2, 9),
            name: newFieldName,
            type: newFieldType,
            required: newFieldRequired,
            isSystem: false
        };
        setFields([...fields, newField]);
        setHasChanges(true);
        setIsAddingField(false);
        setNewFieldName('');
        setNewFieldType('Text');
        setNewFieldRequired(false);
    };

    const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
        setter(value);
        setHasChanges(true);
    };

    return (
        <div className={cn(
            "h-full flex flex-col relative",
            isDark ? "bg-[#0d1117]" : "bg-white"
        )}>
            {/* Scrollable Content */}
            <div
                className="flex-1 overflow-y-auto"
                style={{
                    padding: '32px 40px',
                    height: 'calc(100vh - 64px)',
                    scrollbarWidth: 'thin',
                }}
            >
                {/* Header */}
                <div className="flex flex-col mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <button onClick={onBack} className={cn("hover:text-emerald-500 transition-colors", isDark ? "text-slate-400" : "text-slate-500")}>
                            <ArrowLeft size={14} />
                        </button>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">CRM · Contacts · Configuration</span>
                    </div>
                    <h1 className={cn("text-[22px] font-semibold", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Contacts Configuration</h1>
                    <p className="text-[13px] text-slate-500 mt-1">Manage custom fields, visibility, and data imports.</p>
                </div>

                <div className={cn("h-[1px] w-full mb-8", isDark ? "bg-[#1e2d3d]" : "bg-slate-200")} />

                {/* SECTION 1: Custom Fields */}
                <div className="grid gap-8 mb-10" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className={cn("text-[14px] font-semibold", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Custom Fields</h3>
                        <p className="text-[12px] text-slate-500 mt-1">Define data fields for your contacts.</p>
                    </div>

                    <div className={cn(
                        "rounded-[10px] border overflow-hidden",
                        isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                    )}>
                        {/* Fields List */}
                        <div className="flex flex-col">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className={cn(
                                        "flex items-center justify-between px-5 py-3 border-b transition-colors",
                                        isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50",
                                        index === fields.length - 1 && !isAddingField ? "border-b-0" : ""
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className={cn("text-[13px] font-medium", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>{field.name}</span>
                                            {field.required && <span className="text-[10px] text-slate-500">Required</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Type Badge */}
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
                                        )}>
                                            {getIconForType(field.type)}
                                            {field.type}
                                        </div>

                                        {/* Actions */}
                                        <div className="w-8 flex justify-end">
                                            {field.isSystem ? (
                                                <Lock size={14} className="text-slate-600" />
                                            ) : (
                                                <button onClick={() => handleDeleteField(field.id)} className="text-slate-500 hover:text-rose-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add Field Form */}
                            {isAddingField && (
                                <div className={cn(
                                    "p-4 bg-emerald-500/5 flex items-center gap-3 border-t",
                                    isDark ? "border-[#1e2d3d]" : "border-slate-200"
                                )}>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Field Name"
                                        value={newFieldName}
                                        onChange={(e) => setNewFieldName(e.target.value)}
                                        className={cn(
                                            "flex-1 h-8 px-3 rounded text-[12px] border outline-none focus:border-emerald-500",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-white" : "bg-white border-slate-300"
                                        )}
                                    />
                                    <select
                                        value={newFieldType}
                                        onChange={(e) => setNewFieldType(e.target.value as CustomField['type'])}
                                        className={cn(
                                            "h-8 px-2 rounded text-[12px] border outline-none focus:border-emerald-500",
                                            isDark ? "bg-[#0d1117] border-[#1e2d3d] text-white" : "bg-white border-slate-300"
                                        )}
                                    >
                                        <option value="Text">Text</option>
                                        <option value="Number">Number</option>
                                        <option value="Date">Date</option>
                                        <option value="Select">Select</option>
                                        <option value="URL">URL</option>
                                        <option value="Phone">Phone</option>
                                    </select>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                            newFieldRequired ? "bg-emerald-500 border-emerald-500" : (isDark ? "border-slate-600 bg-transparent" : "border-slate-300 bg-white")
                                        )}>
                                            {newFieldRequired && <Check size={10} className="text-black" strokeWidth={3} />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} />
                                        <span className="text-[11px] font-medium text-slate-500">Required</span>
                                    </label>
                                    <button
                                        onClick={handleAddField}
                                        className="h-8 px-3 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold rounded uppercase tracking-wide"
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => setIsAddingField(false)}
                                        className="h-8 w-8 flex items-center justify-center hover:bg-black/10 rounded text-slate-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Add Button */}
                            {!isAddingField && (
                                <button
                                    onClick={() => setIsAddingField(true)}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 py-2.5 text-[12px] transition-colors border-t",
                                        isDark
                                            ? "border-[#1e2d3d] text-slate-500 hover:bg-white/[0.02] hover:text-slate-300"
                                            : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                    )}
                                >
                                    <Plus size={14} />
                                    Add Field
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Visibility & Permissions */}
                <div className="grid gap-8 mb-10" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className={cn("text-[14px] font-semibold", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Visibility & Permissions</h3>
                        <p className="text-[12px] text-slate-500 mt-1">Control who can see and edit contacts.</p>
                    </div>

                    <div className={cn(
                        "rounded-[10px] border overflow-hidden",
                        isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                    )}>
                        {[
                            { label: 'Show contacts in global search', sub: 'Include contacts in system-wide search results', val: globalSearch, set: setGlobalSearch },
                            { label: 'Allow team members to add contacts', sub: 'Permission to create new records', val: teamAddLimit, set: setTeamAddLimit },
                            { label: 'Require approval for deletion', sub: 'Admins must approve contact deletions', val: deleteApproval, set: setDeleteApproval },
                        ].map((item, idx) => (
                            <div key={idx} className={cn("flex justify-between items-center p-5 border-b last:border-0", isDark ? "border-white/[0.04]" : "border-slate-100")}>
                                <div>
                                    <p className={cn("text-[13px] font-medium", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>{item.label}</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">{item.sub}</p>
                                </div>
                                <button
                                    onClick={() => handleToggle(item.set, !item.val)}
                                    className={cn("w-9 h-5 rounded-full relative transition-colors duration-200", item.val ? "bg-emerald-500" : (isDark ? "bg-[#1e2d3d]" : "bg-slate-200"))}
                                >
                                    <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200", item.val ? "translate-x-4" : "translate-x-0")} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 3: Import / Export */}
                <div className="grid gap-8 mb-20" style={{ gridTemplateColumns: '240px 1fr' }}>
                    <div>
                        <h3 className={cn("text-[14px] font-semibold", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Import / Export</h3>
                        <p className="text-[12px] text-slate-500 mt-1">Manage bulk data operations.</p>
                    </div>

                    <div className={cn(
                        "rounded-[10px] border p-5",
                        isDark ? "bg-[#111827] border-[#1e2d3d]" : "bg-white border-slate-200"
                    )}>
                        <div className="flex items-center justify-between pb-5 border-b border-white/[0.06]">
                            <div>
                                <p className={cn("text-[13px] font-medium", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Import from CSV</p>
                                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">Accepts .csv with headers: name, email, phone, company</p>
                            </div>
                            <button className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-md border text-[12px] font-medium transition-colors",
                                isDark
                                    ? "border-[#1e2d3d] text-slate-300 hover:bg-white/[0.04]"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}>
                                <Upload size={14} />
                                Choose File
                            </button>
                        </div>
                        <div className="flex items-center justify-between pt-5">
                            <div>
                                <p className={cn("text-[13px] font-medium", isDark ? "text-[#f1f5f9]" : "text-slate-900")}>Export all contacts</p>
                                <p className="text-[12px] text-slate-500 mt-0.5">Download a full list of contacts in CSV format</p>
                            </div>
                            <button className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-md border text-[12px] font-medium transition-colors",
                                isDark
                                    ? "border-[#1e2d3d] text-slate-300 hover:bg-white/[0.04]"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}>
                                <Download size={14} />
                                Export as CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Save Footer */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 right-0 p-4 border-t flex justify-end gap-3 backdrop-blur-sm z-50",
                    isDark ? "bg-[#0d1117]/80 border-[#1e2d3d]" : "bg-white/80 border-slate-200"
                )}
            >
                <button
                    onClick={onBack}
                    className={cn(
                        "px-4 py-2 rounded-md text-[13px] font-medium border transition-colors",
                        isDark ? "border-[#1e2d3d] text-slate-400 hover:text-slate-200" : "border-slate-200 text-slate-600 hover:text-slate-800"
                    )}
                >
                    Cancel
                </button>
                <button
                    disabled={!hasChanges}
                    onClick={() => setHasChanges(false)}
                    className={cn(
                        "px-4 py-2 rounded-md text-[13px] font-bold text-[#0d1117] transition-all",
                        hasChanges ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/20" : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                    )}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default ContactsConfiguration;
