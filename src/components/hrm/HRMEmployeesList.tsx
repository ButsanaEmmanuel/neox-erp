import React, { useState, useMemo } from 'react';
import {
    Search,
    Filter,
    MoreHorizontal,
    Plus,
    User,
    Building2,
    MapPin
} from 'lucide-react';
import { useHRM } from '../../contexts/HRMContext';
import { usePeople } from '../../contexts/PeopleContext';
import { EmploymentProfile } from '../../types/hrm';
import AddEmployeeFlow from './AddEmployeeFlow';
import HRMImportModal from './import/HRMImportModal';

const HRMEmployeesList: React.FC = () => {
    const { employmentProfiles, departments } = useHRM();
    const { getPerson } = usePeople();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const handleRowClick = (id: string) => {
        // Navigate or open drawer
        console.log('Clicked employee', id);
    };

    // Combine Person and Employment Data
    const employees = useMemo(() => {
        return employmentProfiles
            .filter(profile => profile.employmentType === 'employee')
            .map(profile => {
                const personInfo = getPerson(profile.personId);
                const personFallback = {
                    name: personInfo?.name || profile.name || 'Unknown',
                    email: personInfo?.email || profile.email || 'No email',
                    initials: (personInfo?.name || profile.name || 'U').substring(0, 2).toUpperCase()
                };
                const department = departments.find(d => d.id === profile.departmentId);
                const managerProfile = profile.managerPersonId ? getPerson(profile.managerPersonId) : undefined;

                return {
                    ...profile,
                    person: personFallback,
                    departmentName: department?.name || 'Unassigned',
                    managerName: managerProfile?.name || profile.managerPersonId || '-',
                };
            })
            .filter(emp => {
                const matchesSearch =
                    emp.person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    emp.roleTitle.toLowerCase().includes(searchTerm.toLowerCase());

                const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
                const matchesDept = deptFilter === 'all' || emp.departmentId === deptFilter;

                return matchesSearch && matchesStatus && matchesDept;
            });
    }, [employmentProfiles, departments, getPerson, searchTerm, statusFilter, deptFilter]);

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            <AddEmployeeFlow isOpen={isAddEmployeeOpen} onClose={() => setIsAddEmployeeOpen(false)} />

            {/* Header */}
            <div className="flex-none px-6 py-5 border-b border-border flex items-center justify-between bg-app">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Employees</h1>
                    <p className="text-sm text-muted mt-1">Manage your full-time workforce</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-border text-secondary rounded-lg text-sm font-medium transition-colors"
                    >
                        <span>Import Employees</span>
                    </button>
                    <button
                        onClick={() => setIsAddEmployeeOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-emerald-900/20"
                    >
                        <Plus size={16} />
                        <span>Add Employee</span>
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex-none px-6 py-3 border-b border-border bg-app flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by name or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface border-none rounded-lg text-sm text-primary focus:ring-2 focus:ring-brand/50 outline-none placeholder:text-muted"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                        <Filter size={14} className="text-muted" />
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-transparent border-none text-sm text-secondary outline-none cursor-pointer"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                        <Filter size={14} className="text-muted" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent border-none text-sm text-secondary outline-none cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="onboarding">Onboarding</option>
                            <option value="offboarding">Offboarding</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead className="bg-surface sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Person</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Role & Dept</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Manager</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Location</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-app divide-y divide-border">
                        {employees.map((emp) => (
                            <tr
                                key={emp.id}
                                onClick={() => handleRowClick(emp.id)}
                                className="hover:bg-surface transition-colors group cursor-pointer"
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-9 w-9 rounded-full bg-surface flex items-center justify-center text-xs font-medium text-muted">
                                            {emp.person?.initials}
                                        </div>
                                        <div className="ml-3">
                                            <div className="text-sm font-medium text-primary">
                                                {emp.person?.name}
                                            </div>
                                            <div className="text-xs text-muted">
                                                {emp.person?.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-primary">{emp.roleTitle}</div>
                                    <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                                        <Building2 size={10} />
                                        {emp.departmentName}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-secondary">
                                        <User size={12} className="mr-1.5 opacity-70" />
                                        {emp.managerName}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                        ${emp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                                            emp.status === 'onboarding' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-surface text-muted'}`}>
                                        {emp.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-muted">
                                        <MapPin size={12} className="mr-1.5 opacity-70" />
                                        {emp.workLocation || 'Remote'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button className="text-muted hover:text-primary p-1 rounded-full hover:bg-surface transition-colors">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {employees.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted">
                        <User size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">No employees found matching filters</p>
                    </div>
                )}
            </div>

            <HRMImportModal 
                isOpen={isImportOpen} 
                onClose={() => setIsImportOpen(false)} 
                type="employee" 
            />
        </div>
    );
};

export default HRMEmployeesList;



