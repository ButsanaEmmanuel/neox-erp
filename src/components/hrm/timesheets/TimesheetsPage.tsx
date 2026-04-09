import React, { useState, useEffect } from 'react';
import { format, startOfWeek } from 'date-fns';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { can } from '../../../lib/rbac';
import { useToast } from '../../ui/Toast';
import WeekHeader from './WeekHeader';
import WeekEditor from './WeekEditor';
import WeekSummary from './WeekSummary';
import { ArrowLeft, Clock } from 'lucide-react';
import { TimesheetWeek } from '../../../types/hrm';

const TimesheetsPage: React.FC = () => {
    const {
        timesheets,
        currentRole,
        getOrCreateTimesheet,
        updateTimesheetActivity,
        deleteTimesheetActivity,
        submitTimesheet,
        approveTimesheet,
        rejectTimesheet
    } = useHRMStore();

    const { addToast } = useToast();
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    );
    const [activeTab, setActiveTab] = useState<'my' | 'approvals'>('my');
    const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);

    // Current User Mock ID (in a real app, this comes from auth)
    const CURRENT_USER_ID = 'emp-1';

    // 1. My Timesheets Logic
    // -------------------------------------------------------------------------
    // Ensure timesheet exists for current week
    useEffect(() => {
        if (activeTab === 'my') {
            getOrCreateTimesheet(CURRENT_USER_ID, currentWeekStart);
        }
    }, [currentWeekStart, activeTab, getOrCreateTimesheet]);

    // Derived state for current user's timesheet
    const myCurrentTimesheet = timesheets.find(
        ts => ts.employeeId === CURRENT_USER_ID && ts.weekStart === currentWeekStart
    );

    const handleUpdateActivity = (activity: any) => {
        if (myCurrentTimesheet) {
            updateTimesheetActivity(myCurrentTimesheet.id, activity);
        }
    };

    const handleDeleteActivity = (activityId: string) => {
        if (myCurrentTimesheet) {
            deleteTimesheetActivity(myCurrentTimesheet.id, activityId);
        }
    };

    const handleAddActivity = () => {
        if (myCurrentTimesheet) {
            const newActivity = {
                id: `act-${Date.now()}`,
                projectId: '', // Empty initially, user selects
                description: '',
                hours: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
            };
            updateTimesheetActivity(myCurrentTimesheet.id, newActivity);
        }
    };

    const handleSubmit = () => {
        if (myCurrentTimesheet) {
            submitTimesheet(myCurrentTimesheet.id, myCurrentTimesheet.total);
            addToast('Timesheet submitted successfully');
        }
    };

    // 2. Approvals Logic
    // -------------------------------------------------------------------------
    const pendingApprovals = timesheets.filter(ts => ts.status === 'submitted');
    const selectedTimesheet = timesheets.find(ts => ts.id === selectedTimesheetId);

    const canApprove = can(currentRole, 'approve', 'timesheets'); // 'timesheets' resource for general approval

    const handleApprove = (id: string) => {
        approveTimesheet(id);
        addToast('Timesheet approved');
        if (selectedTimesheetId === id) setSelectedTimesheetId(null);
    };

    const handleReject = (id: string) => {
        rejectTimesheet(id, 'Needs revision'); // Simplified for now, could add prompt
        addToast('Timesheet rejected', 'error');
        if (selectedTimesheetId === id) setSelectedTimesheetId(null);
    };

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    // Render: Detail View for Manager (Reviewing a specific timesheet)
    if (activeTab === 'approvals' && selectedTimesheet) {
        return (
            <div className="h-full flex flex-col bg-app overflow-hidden">
                {/* Back Navigation */}
                <div className="flex-none px-8 py-4 border-b border-border/60 flex items-center gap-4 bg-app">
                    <button
                        onClick={() => setSelectedTimesheetId(null)}
                        className="p-2 hover:bg-card/[0.06] rounded-lg text-muted hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-[16px] font-bold text-primary">Reviewing {selectedTimesheet.employeeName}</h2>
                        <p className="text-[12px] text-muted">Week of {selectedTimesheet.weekStart}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-5xl mx-auto space-y-6">
                        <WeekHeader
                            weekStart={selectedTimesheet.weekStart}
                            onWeekChange={() => { }} // Read-only here
                            status={selectedTimesheet.status}
                            totalHours={selectedTimesheet.total}
                            employeeName={selectedTimesheet.employeeName}
                            isMyTimesheet={false}
                            onApprove={() => handleApprove(selectedTimesheet.id)}
                            onReject={() => handleReject(selectedTimesheet.id)}
                        />
                        <WeekSummary week={selectedTimesheet} />
                    </div>
                </div>
            </div>
        );
    }

    // Render: Main View (My Timesheets OR Approval List)
    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            {/* Top Navigation */}
            <div className="flex-none px-8 py-6 border-b border-border/60 flex items-center justify-between bg-app">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-[24px] font-bold text-primary tracking-tight">Timesheets</h1>
                        <p className="text-[13px] text-muted mt-1">Track work, manage approvals</p>
                    </div>
                    {/* Role-based Toggle */}
                    {canApprove && (
                        <div className="flex bg-card/[0.04] p-1 rounded-lg border border-border/60 ml-4">
                            <button
                                onClick={() => setActiveTab('my')}
                                className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all ${activeTab === 'my' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                            >
                                My Timesheet
                            </button>
                            <button
                                onClick={() => setActiveTab('approvals')}
                                className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                            >
                                Approvals
                                {pendingApprovals.length > 0 && (
                                    <span className="bg-card/20 text-primary text-[10px] px-1.5 rounded-full">{pendingApprovals.length}</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'my' && myCurrentTimesheet && (
                    <div className="flex flex-col h-full">
                        <WeekHeader
                            weekStart={currentWeekStart}
                            onWeekChange={setCurrentWeekStart}
                            status={myCurrentTimesheet.status}
                            totalHours={myCurrentTimesheet.total}
                            isMyTimesheet={true}
                            onSubmit={handleSubmit}
                        />
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-6xl mx-auto">
                                {myCurrentTimesheet.status === 'draft' || myCurrentTimesheet.status === 'rejected' ? (
                                    <WeekEditor
                                        week={myCurrentTimesheet as TimesheetWeek}
                                        onUpdateActivity={handleUpdateActivity}
                                        onDeleteActivity={handleDeleteActivity}
                                        onAddActivity={handleAddActivity}
                                    />
                                ) : (
                                    <WeekSummary week={myCurrentTimesheet as TimesheetWeek} />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'approvals' && (
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {pendingApprovals.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
                                    <Clock className="mx-auto text-muted mb-4" size={32} />
                                    <h3 className="text-muted font-medium">All caught up!</h3>
                                    <p className="text-muted text-sm mt-1">No timesheets pending approval.</p>
                                </div>
                            ) : (
                                pendingApprovals.map(ts => (
                                    <div
                                        key={ts.id}
                                        onClick={() => setSelectedTimesheetId(ts.id)}
                                        className="group bg-card hover:bg-card border border-border/60 hover:border-emerald-500/30 rounded-xl p-5 cursor-pointer transition-all shadow-sm"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                                                    {ts.employeeName ? ts.employeeName.charAt(0) : 'U'}
                                                </div>
                                                <div>
                                                    <h4 className="text-[14px] font-bold text-primary group-hover:text-emerald-400 transition-colors">{ts.employeeName || 'Unknown Employee'}</h4>
                                                    <p className="text-[12px] text-muted">Week of {ts.weekStart}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase text-muted font-bold tracking-wider">Total</p>
                                                    <p className="text-[16px] font-bold text-primary tabular-nums">{ts.total}h</p>
                                                </div>
                                                <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-[12px] font-medium rounded-lg border border-emerald-500/20">
                                                    Review
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimesheetsPage;



