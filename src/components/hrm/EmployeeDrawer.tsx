import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, MapPin, Mail, Phone, MoreHorizontal, Edit2, Check, Shield, Lock } from 'lucide-react';
import { useHRM } from '../../contexts/HRMContext';
import { usePeople } from '../../contexts/PeopleContext';
import { EmploymentProfile } from '../../types/hrm';
import { Person } from '../../types/person';

interface EmployeeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    employmentId: string | null;
}

const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({ isOpen, onClose, employmentId }) => {
    const { getEmploymentProfile, updateEmploymentProfile, departments, employmentProfiles } = useHRM();
    const { getPerson } = usePeople();

    const [profile, setProfile] = useState<EmploymentProfile | null>(null);
    const [person, setPerson] = useState<Person | null>(null);
    const [manager, setManager] = useState<Person | null>(null);
    const [departmentName, setDepartmentName] = useState('');

    const [isEditing, setIsEditing] = useState(false);

    // Edit State
    const [editRole, setEditRole] = useState('');
    const [editDeptId, setEditDeptId] = useState('');
    const [editManagerId, setEditManagerId] = useState('');
    const [editStatus, setEditStatus] = useState<string>('');
    
    // Access State
    const [hasSystemAccess, setHasSystemAccess] = useState(false);
    const [systemRole, setSystemRole] = useState<string>('USER');

    useEffect(() => {
        if (isOpen && employmentId) {
            const empProfile = getEmploymentProfile(employmentId);
            if (empProfile) {
                setProfile(empProfile);
                setPerson(getPerson(empProfile.personId) || null);
                setManager(empProfile.managerPersonId ? getPerson(empProfile.managerPersonId) || null : null);
                const dept = departments.find(d => d.id === empProfile.departmentId);
                setDepartmentName(dept?.name || 'Unassigned');

                // Initialize edit state
                setEditRole(empProfile.roleTitle);
                setEditDeptId(empProfile.departmentId || '');
                setEditManagerId(empProfile.managerPersonId || '');
                setEditStatus(empProfile.status);

                // Initialize access state
                setHasSystemAccess(empProfile.hasSystemAccess || false);
                setSystemRole(empProfile.systemRole || 'USER');
            }
        } else {
            setProfile(null);
            setPerson(null);
            setIsEditing(false);
        }
    }, [isOpen, employmentId, getEmploymentProfile, getPerson, departments]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!profile) return;

        updateEmploymentProfile(profile.id, {
            roleTitle: editRole,
            departmentId: editDeptId || undefined,
            managerPersonId: editManagerId || undefined,
            status: editStatus as any, // simplified casting
            hasSystemAccess,
            systemRole
        });

        // Refresh local state (simplified, ideally context updates trigger re-render)
        const newProfile = { 
            ...profile, 
            roleTitle: editRole, 
            departmentId: editDeptId, 
            managerPersonId: editManagerId, 
            status: editStatus as any,
            hasSystemAccess,
            systemRole
        };
        setProfile(newProfile);
        setPerson(getPerson(newProfile.personId) || null);
        setManager(newProfile.managerPersonId ? getPerson(newProfile.managerPersonId) || null : null);
        const dept = departments.find(d => d.id === newProfile.departmentId);
        setDepartmentName(dept?.name || 'Unassigned');

        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px]">
            <div className={`w-full max-w-md bg-card  h-full shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>

                {/* Header */}
                <div className="flex-none h-16 px-6 border-b border-input flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-muted">
                            <X size={20} />
                        </button>
                        <h2 className="text-lg font-semibold text-primary">Employee Profile</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                                <Edit2 size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                            >
                                <Check size={16} />
                                Save
                            </button>
                        )}
                        <button className="p-2 text-muted hover:text-muted">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {profile && person ? (
                    <div className="flex-1 overflow-y-auto">
                        {/* Cover / Avatar Header */}
                        <div className="relative h-32 bg-gradient-to-r from-slate-100 to-slate-200">
                            <div className="absolute -bottom-10 left-6">
                                <div className="h-20 w-20 rounded-full border-4 border-white bg-card  flex items-center justify-center text-2xl font-bold text-secondary shadow-sm">
                                    {person.initials}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 px-6 pb-6">
                            <h1 className="text-2xl font-bold text-primary mb-1">{person.name}</h1>
                            <div className="flex items-center gap-2 text-muted text-sm mb-6">
                                <span>{profile.roleTitle}</span>
                                <span>•</span>
                                <span>{departmentName}</span>
                            </div>

                            <div className="space-y-6">
                                {/* Employment Details */}
                                <div className="bg-surface  rounded-xl p-4 border border-border/50">
                                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                        <Briefcase size={16} className="text-emerald-600" />
                                        Employment
                                    </h3>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Role Title</span>
                                            {isEditing ? (
                                                <input
                                                    className="col-span-2 bg-card border border-input rounded px-2 py-1 outline-none text-primary"
                                                    value={editRole}
                                                    onChange={e => setEditRole(e.target.value)}
                                                />
                                            ) : (
                                                <span className="col-span-2 text-primary">{profile.roleTitle}</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Department</span>
                                            {isEditing ? (
                                                <select
                                                    className="col-span-2 bg-card border border-input rounded px-2 py-1 outline-none text-primary"
                                                    value={editDeptId}
                                                    onChange={e => setEditDeptId(e.target.value)}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {departments.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="col-span-2 text-primary">{departmentName}</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Type</span>
                                            <span className="col-span-2 text-primary capitalize">{profile.employmentType}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Status</span>
                                            {isEditing ? (
                                                <select
                                                    className="col-span-2 bg-card border border-input rounded px-2 py-1 outline-none text-primary"
                                                    value={editStatus}
                                                    onChange={e => setEditStatus(e.target.value)}
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="onboarding">Onboarding</option>
                                                    <option value="offboarding">Offboarding</option>
                                                    <option value="inactive">Inactive</option>
                                                </select>
                                            ) : (
                                                <span
                                                    className={`col-span-2 inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                        profile.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-surface text-secondary'
                                                    }`}
                                                >
                                                    {profile.status}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Joined</span>
                                            <span className="col-span-2 text-primary">{profile.startDate}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted">Manager</span>
                                            {isEditing ? (
                                                <select
                                                    className="col-span-2 bg-card border border-input rounded px-2 py-1 outline-none text-primary"
                                                    value={editManagerId}
                                                    onChange={e => setEditManagerId(e.target.value)}
                                                >
                                                    <option value="">No Manager</option>
                                                    {/* Need better way to list possible managers, maybe all active employees? Listing all profiles for now mock */}
                                                    {employmentProfiles.filter(ep => ep.id !== profile.id).map(ep => (
                                                        <option key={ep.personId} value={ep.personId}>{
                                                            // This is tricky as we need person name, avoiding complex context lookup loop for now
                                                            ep.employeeCode
                                                        }</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="col-span-2 text-primary">{manager ? manager.name : '-'}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="bg-surface  rounded-xl p-4 border border-border/50">
                                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                        <User size={16} className="text-blue-500" />
                                        Personal & Contact
                                    </h3>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted flex items-center gap-2"><Mail size={12} /> Email</span>
                                            <span className="col-span-2 text-primary truncate">{person.email}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted flex items-center gap-2"><Phone size={12} /> Phone</span>
                                            <span className="col-span-2 text-primary">{person.phone || '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <span className="text-muted flex items-center gap-2"><MapPin size={12} /> Location</span>
                                            <span className="col-span-2 text-primary">{profile.workLocation || 'Remote'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* System Access & RBAC */}
                                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                                        <Shield size={16} className="text-amber-600" />
                                        System Access & RBAC
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-primary">Grant System Access</span>
                                                <span className="text-xs text-muted">Allow this staff to log in to the ERP</span>
                                            </div>
                                            <button 
                                                onClick={() => setHasSystemAccess(!hasSystemAccess)}
                                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${hasSystemAccess ? 'bg-emerald-600' : 'bg-border'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-card transition-transform ${hasSystemAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {hasSystemAccess && (
                                            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    <span className="text-muted flex items-center gap-2"><Lock size={12} /> System Role</span>
                                                    <select 
                                                        value={systemRole}
                                                        onChange={(e) => setSystemRole(e.target.value)}
                                                        className="col-span-2 bg-card border border-input rounded px-2 py-1 outline-none text-primary"
                                                    >
                                                        <option value="ADMIN">Admin</option>
                                                        <option value="SALES">Sales / Commercial</option>
                                                        <option value="PROJECT_MANAGER">Project Manager</option>
                                                        <option value="SCM_MANAGER">Supply Chain Manager</option>
                                                        <option value="HR_MANAGER">HR Manager</option>
                                                        <option value="FINANCE">Finance / Accountant</option>
                                                        <option value="QA">Quality Assurance</option>
                                                        <option value="USER">Standard User</option>
                                                    </select>
                                                </div>
                                                <div className="p-2 bg-blue-50/50 rounded text-[11px] text-blue-600 italic">
                                                    Note: An email invitation will be sent to {person.email} to set their security credentials.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-6 text-muted">
                        <p>No employee selected</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeDrawer;





