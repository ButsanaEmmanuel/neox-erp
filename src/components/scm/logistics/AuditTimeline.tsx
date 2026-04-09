import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { AuditEvent } from '../../../types/logistics';

interface AuditTimelineProps {
    auditLog: AuditEvent[];
    className?: string;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ auditLog, className }) => {
    // Sort descending by timestamp
    const sortedLog = [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className={`bg-card border border-border rounded-xl shadow-sm flex flex-col h-fit max-h-[600px] ${className || ''}`}>
            <div className="p-4 border-b border-border bg-surface/50 rounded-t-xl sticky top-0 z-10">
                <h3 className="text-sm font-bold text-foreground">Timeline & Activity</h3>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
                <div className="space-y-6 lg:space-y-4">
                    {sortedLog.length === 0 ? (
                        <p className="text-sm text-muted text-center py-4">No activity recorded yet.</p>
                    ) : (
                        sortedLog.map((log, index) => (
                            <div key={log.id} className="relative flex gap-4 group">
                                {index !== sortedLog.length - 1 && (
                                    <div className="absolute left-[11px] top-6 bottom-[-24px] lg:bottom-[-16px] w-px bg-border group-hover:bg-blue-500/30 transition-colors" />
                                )}
                                <div className="w-[22px] h-[22px] rounded-full bg-surface border-2 border-border flex-none mt-0.5 relative z-10 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted group-hover:bg-blue-500 transition-colors" />
                                </div>
                                <div className="flex-1 pb-2">
                                    <p className="text-[13px] text-foreground font-medium leading-relaxed">{log.message}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        <span className="text-[11px] text-muted flex items-center gap-1">
                                            <Clock size={10} /> {format(new Date(log.timestamp), 'MMM d, HH:mm')}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className="text-[11px] text-muted font-medium capitalize">{log.actor}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};


