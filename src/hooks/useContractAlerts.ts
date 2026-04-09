import { useMemo } from 'react';
import { useHRMStore } from '../store/hrm/useHRMStore';

export type ContractStatus = 'critical' | 'warning' | 'notice' | 'active';

export interface ContractAlert {
    employeeId: string;
    personId: string;
    name: string;
    roleTitle: string;
    departmentId?: string;
    endDate: string;
    daysRemaining: number;
    status: ContractStatus;
}

export function useContractAlerts() {
    const { employees } = useHRMStore();

    const alerts = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentAlerts: ContractAlert[] = [];

        employees.forEach(emp => {
            if (emp.status !== 'active' && emp.status !== 'onboarding') return;
            if (!emp.endDate) return;

            const endDate = new Date(emp.endDate);
            const diffTime = endDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let status: ContractStatus = 'active';
            if (daysRemaining <= 7) {
                status = 'critical';
            } else if (daysRemaining <= 15) {
                status = 'warning';
            } else if (daysRemaining <= 30) {
                status = 'notice';
            }

            if (status !== 'active') {
                currentAlerts.push({
                    employeeId: emp.id,
                    personId: emp.personId,
                    name: emp.name || emp.employeeCode,
                    roleTitle: emp.roleTitle,
                    departmentId: emp.departmentId,
                    endDate: emp.endDate,
                    daysRemaining,
                    status
                });
            }
        });

        return currentAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [employees]);

    const criticalCount = alerts.filter(a => a.status === 'critical').length;
    const warningCount = alerts.filter(a => a.status === 'warning').length;
    const noticeCount = alerts.filter(a => a.status === 'notice').length;

    return {
        alerts,
        criticalCount,
        warningCount,
        noticeCount,
        totalAlerts: alerts.length
    };
}
