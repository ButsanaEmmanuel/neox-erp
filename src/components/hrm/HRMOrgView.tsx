import React, { useState } from 'react';
import { useHRM } from '../../contexts/HRMContext';
import { usePeople } from '../../contexts/PeopleContext';
import { Users, User, ChevronRight } from 'lucide-react';
import HRMImportModal from './import/HRMImportModal';

const HRMOrgView: React.FC = () => {
    const { departments, employmentProfiles } = useHRM();
    const { getPerson } = usePeople();
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Group employees by department for counts
    const getDeptValidation = (deptId: string) => {
        const count = employmentProfiles.filter(e => e.departmentId === deptId && e.status === 'active').length;
        const dept = departments.find(d => d.id === deptId);
        const manager = dept?.managerPersonId ? getPerson(dept.managerPersonId) : undefined;
        return { count, manager };
    };

    // Build hierarchy (simple 1 level deep for MVP)
    const rootDepts = departments.filter(d => !d.parentId);

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            <div className="flex-none px-6 py-5 border-b border-border bg-app flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Organization</h1>
                    <p className="text-sm text-muted mt-1">Department structure and reporting lines</p>
                </div>
                <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-border text-secondary rounded-lg text-sm font-medium transition-colors"
                >
                    <span>Import Departments</span>
                </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="grid gap-6 max-w-4xl mx-auto">
                    {rootDepts.map(dept => {
                        const { count, manager } = getDeptValidation(dept.id);
                        const childDepts = departments.filter(d => d.parentId === dept.id);

                        return (
                            <div key={dept.id} className="border border-border bg-card rounded-xl overflow-hidden shadow-sm">
                                {/* Department Header */}
                                <div className="p-4 bg-surface border-b border-border flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                                            <Users size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-primary">{dept.name}</h3>
                                            <p className="text-xs text-muted">{count} Active Members</p>
                                        </div>
                                    </div>
                                    {manager && (
                                        <div className="flex items-center gap-3 bg-app px-3 py-1.5 rounded-full border border-border">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-[10px] uppercase font-bold text-muted tracking-wider">Head</div>
                                                <div className="text-xs font-semibold text-primary">{manager.name}</div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-muted">
                                                {manager.initials}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Child Departments */}
                                {childDepts.length > 0 && (
                                    <div className="divide-y divide-border">
                                        {childDepts.map(child => {
                                            const childData = getDeptValidation(child.id);
                                            return (
                                                <div key={child.id} className="p-4 pl-12 flex items-center justify-between hover:bg-surface transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-1 w-1 rounded-full bg-muted"></div>
                                                        <h4 className="font-medium text-secondary">{child.name}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-sm text-muted">{childData.count} Members</div>
                                                        {childData.manager && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-muted">
                                                                    {childData.manager.initials}
                                                                </div>
                                                                <span className="text-xs text-secondary">{childData.manager.name}</span>
                                                            </div>
                                                        )}
                                                        <ChevronRight size={16} className="text-muted" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <HRMImportModal 
                isOpen={isImportOpen} 
                onClose={() => setIsImportOpen(false)} 
                type="department" 
            />
        </div>
    );
};

export default HRMOrgView;



