import React, { useMemo } from 'react';
import PageHeader from '../../ui/PageHeader';
import ContractAlerts from './ContractAlerts';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { Users, UserPlus, FileText, TrendingUp } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';

const HRMDashboard: React.FC = () => {
    const { employees, leaveRequests, trainingRecords, timesheets } = useHRMStore();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    const isOmniAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';
    const isHrmPrivileged = isOmniAdmin || hasPermission('hrm', 'contracts', 'read');

    const stats = useMemo(() => {
        return {
            total: employees.length,
            active: employees.filter(e => e.status === 'active').length,
            onboarding: employees.filter(e => e.status === 'onboarding').length,
            contractors: employees.filter(e => e.employmentType === 'contractor').length,
        };
    }, [employees]);

    const myEmployee = useMemo(() => {
        if (!user) return null;
        const byUserId = employees.find((e: any) => e.userId && e.userId === user.id);
        if (byUserId) return byUserId;
        const email = String(user.email || '').toLowerCase();
        return email ? employees.find((e: any) => String(e.email || '').toLowerCase() === email) : null;
    }, [employees, user]);

    const myInfo = useMemo(() => {
        if (!myEmployee) {
            return {
                leavePending: 0,
                trainingPending: 0,
                timesheetsDraft: 0,
                contractType: '-',
                contractStatus: '-',
            };
        }
        const leavePending = leaveRequests.filter((row) => row.employeeId === myEmployee.id && row.status === 'pending').length;
        const trainingPending = trainingRecords.filter((row) => row.employeeId === myEmployee.id && row.status !== 'completed').length;
        const timesheetsDraft = timesheets.filter((row) => row.employeeId === myEmployee.id && row.status === 'draft').length;
        return {
            leavePending,
            trainingPending,
            timesheetsDraft,
            contractType: myEmployee.contractType || '-',
            contractStatus: myEmployee.contractStatus || '-',
        };
    }, [leaveRequests, myEmployee, timesheets, trainingRecords]);

    return (
        <div className="h-full flex flex-col overflow-y-auto bg-app">
            <PageHeader
                title={isHrmPrivileged ? 'HRM Dashboard' : 'My Info'}
                subtitle={isHrmPrivileged ? 'Overview and monitoring' : 'Your self-service HR snapshot'}
            />

            <div className="p-6 space-y-6">
                {isHrmPrivileged ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Headcount', value: stats.total, icon: Users, color: 'text-muted' },
                                { label: 'Active Employees', value: stats.active, icon: TrendingUp, color: 'text-brand' },
                                { label: 'In Onboarding', value: stats.onboarding, icon: UserPlus, color: 'text-blue-400' },
                                { label: 'Contractors', value: stats.contractors, icon: FileText, color: 'text-amber-400' },
                            ].map(stat => (
                                <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider">{stat.label}</p>
                                        <p className="text-2xl font-bold text-primary mt-1">{stat.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-lg bg-surface border border-border flex items-center justify-center ${stat.color}`}>
                                        <stat.icon size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <ContractAlerts />
                            </div>
                            <div className="lg:col-span-2 flex flex-col gap-6">
                                <div className="bg-card border border-border rounded-xl p-6 min-h-[300px] flex items-center justify-center">
                                    <span className="text-muted text-sm font-medium">Additional HRM Analytics (Coming soon)</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        {[
                            { label: 'Pending Leave Requests', value: myInfo.leavePending },
                            { label: 'Pending Trainings', value: myInfo.trainingPending },
                            { label: 'Draft Timesheets', value: myInfo.timesheetsDraft },
                            { label: 'Contract Type', value: myInfo.contractType },
                            { label: 'Contract Status', value: myInfo.contractStatus },
                        ].map((card) => (
                            <div key={card.label} className="bg-card border border-border rounded-xl p-4">
                                <p className="text-[11px] font-bold text-muted uppercase tracking-wider">{card.label}</p>
                                <p className="text-xl font-bold text-primary mt-2">{card.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HRMDashboard;
