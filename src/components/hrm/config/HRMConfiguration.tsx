import React, { useState } from 'react';
import { Building2, FileText, Settings, GitBranch, Search, Filter, Plus, Download } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import HRMImportModal from '../import/HRMImportModal';
import DepartmentList from './DepartmentList';
import TemplateList from './TemplateList';
import AutomationRules from './AutomationRules';
import DepartmentModal from './DepartmentModal';
import type { Department } from '../../../types/hrm';

type ConfigTab = 'departments' | 'onboarding' | 'offboarding' | 'automation';

const HRMConfiguration: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ConfigTab>('departments');
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);

    const tabs: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
        { id: 'departments', label: 'Departments', icon: <Building2 size={14} /> },
        { id: 'onboarding', label: 'Onboarding Templates', icon: <FileText size={14} /> },
        { id: 'offboarding', label: 'Offboarding Templates', icon: <LogOutIcon size={14} /> },
        { id: 'automation', label: 'Automation Rules', icon: <GitBranch size={14} /> },
    ];

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            <PageHeader
                title="HRM Configuration"
                subtitle="Manage departments, templates, and automation rules"
                actions={
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-primary focus:outline-none focus:border-ring transition-colors w-48"
                            />
                        </div>
                        {activeTab === 'departments' && (
                            <>
                                <button
                                    onClick={() => {
                                        setSelectedDept(null);
                                        setIsModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 text-brand-fg rounded-lg text-[13px] font-semibold transition-all shadow-lg shadow-brand/20"
                                >
                                    <Plus size={15} /> New Department
                                </button>
                                <button
                                    onClick={() => setIsImportOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-border text-secondary rounded-lg text-[13px] font-semibold transition-colors"
                                >
                                    <Download size={15} /> Import Departments
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Tabs */}
            <div className="px-6 border-b border-border flex items-center gap-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 text-[13px] font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id
                            ? 'text-primary border-brand'
                            : 'text-muted border-transparent hover:text-primary'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'departments' && (
                    <DepartmentList
                        searchQuery={searchQuery}
                        onEdit={(dept) => {
                            setSelectedDept(dept);
                            setIsModalOpen(true);
                        }}
                    />
                )}
                {activeTab === 'onboarding' && <TemplateList type="onboarding" searchQuery={searchQuery} />}
                {activeTab === 'offboarding' && <TemplateList type="offboarding" searchQuery={searchQuery} />}
                {activeTab === 'automation' && <AutomationRules />}
            </div>

            <HRMImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                type="department"
            />

            <DepartmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                department={selectedDept}
            />
        </div>
    );
};

// Helper icon
const LogOutIcon = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
);

export default HRMConfiguration;



