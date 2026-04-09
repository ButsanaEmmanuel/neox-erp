import React, { useState } from 'react';
import { X, Search, User, Briefcase, Calendar, MapPin, Building2, Check } from 'lucide-react';
import { usePeople } from '../../contexts/PeopleContext';
import { useHRM } from '../../contexts/HRMContext';
import { Person } from '../../types/person';
import { EmploymentType, EmploymentStatus } from '../../types/hrm';

interface AddEmployeeFlowProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'select-person' | 'employment-details';

const AddEmployeeFlow: React.FC<AddEmployeeFlowProps> = ({ isOpen, onClose }) => {
    const { people, createPerson } = usePeople();
    const { createEmploymentProfile, departments, employmentProfiles } = useHRM();

    const [step, setStep] = useState<Step>('select-person');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

    // New Person Form State
    const [isCreatingNewPerson, setIsCreatingNewPerson] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [newPersonEmail, setNewPersonEmail] = useState('');

    // Employment Form State
    const [roleTitle, setRoleTitle] = useState('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [managerId, setManagerId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [workLocation, setWorkLocation] = useState('');
    const [employmentType, setEmploymentType] = useState<EmploymentType>('employee');

    if (!isOpen) return null;

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.includes(searchTerm.toLowerCase())
    );

    const handlePersonSelect = (person: Person) => {
        // Check if already has employment
        const existingProfile = employmentProfiles.find(ep => ep.personId === person.id);
        if (existingProfile) {
            alert('This person already has an employment profile.');
            return;
        }
        setSelectedPerson(person);
        setStep('employment-details');
    };

    const handleCreatePerson = () => {
        if (!newPersonName || !newPersonEmail) return;
        const newPerson = createPerson({
            name: newPersonName,
            email: newPersonEmail,
            stage: 'Qualified' // Default stage
        });
        setSelectedPerson(newPerson);
        setStep('employment-details');
    };

    const handleSubmit = () => {
        if (!selectedPerson || !employeeCode || !roleTitle || !startDate) {
            alert('Please fill in all required fields');
            return;
        }

        createEmploymentProfile({
            personId: selectedPerson.id,
            employeeCode,
            employmentType,
            roleTitle,
            departmentId: departmentId || undefined,
            managerPersonId: managerId || undefined,
            startDate,
            workLocation: workLocation || undefined,
            status: 'active'
        });

        onClose();
        // Reset state
        setStep('select-person');
        setSelectedPerson(null);
        setIsCreatingNewPerson(false);
        setNewPersonName('');
        setNewPersonEmail('');
        setRoleTitle('');
        setEmployeeCode('');
        setDepartmentId('');
        setManagerId('');
        setWorkLocation('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card  w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-input flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-primary">Add Employment Profile</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${step === 'select-person' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface text-muted'}`}>1. Select Person</span>
                            <span className="text-secondary">/</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${step === 'employment-details' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface text-muted'}`}>2. Employment Details</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-muted">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'select-person' && (
                        <div className="space-y-4">
                            {!isCreatingNewPerson ? (
                                <>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Search existing people..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div className="max-h-60 overflow-y-auto border border-input rounded-lg divide-y divide-border/50">
                                        {filteredPeople.map(person => (
                                            <button
                                                key={person.id}
                                                onClick={() => handlePersonSelect(person)}
                                                className="w-full flex items-center px-4 py-3 hover:bg-surface transition-colors text-left"
                                            >
                                                <div className="h-8 w-8 rounded-full bg-border flex items-center justify-center text-xs font-bold text-muted mr-3">
                                                    {person.initials}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-primary">{person.name}</div>
                                                    <div className="text-xs text-muted">{person.email}</div>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredPeople.length === 0 && (
                                            <div className="p-4 text-center text-sm text-muted">No people found.</div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-center pt-2">
                                        <button
                                            onClick={() => setIsCreatingNewPerson(true)}
                                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                        >
                                            + Create new person
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="p-4 bg-emerald-50 rounded-lg text-sm text-emerald-800 mb-4">
                                        Creating a new person record in the global directory.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={newPersonName}
                                            onChange={e => setNewPersonName(e.target.value)}
                                            className="w-full px-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={newPersonEmail}
                                            onChange={e => setNewPersonEmail(e.target.value)}
                                            className="w-full px-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setIsCreatingNewPerson(false)}
                                            className="flex-1 px-4 py-2 bg-surface hover:bg-border text-secondary rounded-lg text-sm font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreatePerson}
                                            disabled={!newPersonName || !newPersonEmail}
                                            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create & Continue
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'employment-details' && selectedPerson && (
                        <div className="space-y-6">
                            <div className="flex items-center p-3 bg-surface rounded-lg border border-border/50">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm mr-3">
                                    {selectedPerson.initials}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-primary">{selectedPerson.name}</div>
                                    <div className="text-xs text-muted">{selectedPerson.email}</div>
                                </div>
                                <button
                                    onClick={() => setStep('select-person')}
                                    className="ml-auto text-xs text-emerald-600 hover:underline"
                                >
                                    Change
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-muted mb-1">Role Title <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input
                                            type="text"
                                            value={roleTitle}
                                            onChange={e => setRoleTitle(e.target.value)}
                                            placeholder="e.g. Senior Product Designer"
                                            className="w-full pl-9 pr-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Employee ID <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={employeeCode}
                                        onChange={e => setEmployeeCode(e.target.value)}
                                        placeholder="e.g. EMP-103"
                                        className="w-full px-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Start Date <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Department</label>
                                    <div className="relative">
                                        <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <select
                                            value={departmentId}
                                            onChange={e => setDepartmentId(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Reporting Manager</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <select
                                            value={managerId}
                                            onChange={e => setManagerId(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                                        >
                                            <option value="">Select Manager</option>
                                            {people.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Work Location</label>
                                    <div className="relative">
                                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input
                                            type="text"
                                            value={workLocation}
                                            onChange={e => setWorkLocation(e.target.value)}
                                            placeholder="e.g. New York HQ"
                                            className="w-full pl-9 pr-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-muted mb-1">Employment Type</label>
                                    <select
                                        value={employmentType}
                                        onChange={e => setEmploymentType(e.target.value as EmploymentType)}
                                        className="w-full px-3 py-2 bg-surface border border-input rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="employee">Full-time Employee</option>
                                        <option value="contractor">Contractor</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-input bg-surface  flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-card border border-input rounded-lg text-sm font-medium hover:bg-surface text-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    {step === 'employment-details' && (
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                        >
                            <Check size={16} />
                            Complete Hiring
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddEmployeeFlow;



