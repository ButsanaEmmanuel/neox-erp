import React from 'react';
import { useContractAlerts } from '../../../hooks/useContractAlerts';
import { AlertTriangle, Clock, Calendar, ChevronRight } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';

const ContractAlerts: React.FC = () => {
    const { alerts, totalAlerts, criticalCount, warningCount, noticeCount } = useContractAlerts();
    const { departments } = useHRMStore();

    if (totalAlerts === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col">
                <h3 className="text-lg font-bold text-primary mb-2">Contract Expirations</h3>
                <div className="flex-1 flex flex-col items-center justify-center text-muted">
                    <Calendar size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">All contracts are up to date</p>
                    <p className="text-xs mt-1">No upcoming expirations in the next 30 days</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="text-[15px] font-bold text-primary">Contract Expirations</h3>
                </div>
                <div className="flex items-center gap-2">
                    {criticalCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold tracking-wider">
                            {criticalCount} CRITICAL
                        </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-muted text-[10px] font-bold tracking-wider">
                        {totalAlerts} TOTAL
                    </span>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto max-h-[300px]">
                {alerts.map((alert, index) => {
                    const deptName = alert.departmentId ? departments.find(d => d.id === alert.departmentId)?.name : 'Unassigned';
                    
                    return (
                        <div key={index} className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-surface transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
                                    alert.status === 'critical' ? 'bg-rose-500/10 text-rose-500' :
                                    alert.status === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-blue-500/10 text-blue-500'
                                }`}>
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-semibold text-primary">{alert.name}</h4>
                                    <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                                        <span>{alert.roleTitle}</span>
                                        <span className="opacity-50">•</span>
                                        <span>{deptName}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <div className={`text-[12px] font-bold ${
                                    alert.status === 'critical' ? 'text-rose-400' :
                                    alert.status === 'warning' ? 'text-amber-400' :
                                    'text-blue-400'
                                }`}>
                                    {alert.daysRemaining <= 0 ? 'Expired' : `${alert.daysRemaining} days`}
                                </div>
                                <div className="text-[10px] text-muted mt-0.5">
                                    {new Date(alert.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ContractAlerts;
