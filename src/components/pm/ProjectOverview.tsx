import React from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import {
  Briefcase,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  TrendingUp,
  ShieldCheck,
  PenSquare,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import ProfessionalEmptyState from '../ui/ProfessionalEmptyState';

const ProjectOverview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, activities } = useProjectStore();
  const project = projects.find((p) => p.id === id);
  const projectActivities = activities
    .filter((a) => a.projectId === id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  if (!project) return (
    <div className="h-full flex items-center justify-center p-8">
      <ProfessionalEmptyState
        icon={Briefcase}
        title="Project Not Found"
        description="The project you're looking for doesn't exist or you don't have access to it."
        action={{
          label: "Back to Projects",
          onClick: () => navigate('/projects')
        }}
      />
    </div>
  );

  const { totalWorkItems, completed, pendingQA, overdue, progress } = project.kpis;
  const telecomSummary = project.telecomSummary;
  const isTelecom = project.isTelecomProject || project.projectMode === 'telecom_multi_site';

  const stats = [
    { label: 'Total Items', value: totalWorkItems, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', view: 'all' },
    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', view: 'completed' },
    { label: 'Pending QA', value: pendingQA, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', view: 'pending-qa' },
    { label: 'Overdue', value: overdue, icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', view: 'overdue' },
  ];

  const telecomStats = [
    { label: 'Imported Rows', value: telecomSummary?.totalImportedRows || 0, icon: FileText, color: 'text-cyan-300', bg: 'bg-cyan-500/10', view: 'all' },
    { label: 'Manual Pending', value: telecomSummary?.incompleteItems || 0, icon: PenSquare, color: 'text-amber-400', bg: 'bg-amber-500/10', view: 'needs_manual_completion' },
    { label: 'QA Approved', value: telecomSummary?.qaApprovedItems || 0, icon: ShieldCheck, color: 'text-blue-300', bg: 'bg-blue-500/10', view: 'all' },
    { label: 'Acceptance Signed', value: telecomSummary?.acceptanceSignedItems || 0, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', view: 'all' },
    { label: 'Finance Pending', value: telecomSummary?.financePending || 0, icon: AlertCircle, color: 'text-orange-300', bg: 'bg-orange-500/10', view: 'finance_pending' },
    { label: 'Finance Synced', value: telecomSummary?.financeSynced || 0, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', view: 'finance_synced' },
    { label: 'Delayed Items', value: telecomSummary?.delayedItems || 0, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', view: 'all' },
    { label: 'On-Time Items', value: telecomSummary?.onTimeItems || 0, icon: Timer, color: 'text-sky-300', bg: 'bg-sky-500/10', view: 'all' },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-8 border-b border-border/60">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-primary tracking-tight">{project.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  project.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : project.status === 'at-risk'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-surface text-muted border-border/60'
                }`}
              >
                {project.status.toUpperCase().replace('-', ' ')}
              </span>
              {isTelecom && <span className="px-2 py-0.5 rounded-full text-[11px] border border-cyan-500/30 text-cyan-300 bg-cyan-500/10">Telecom Multi-Site</span>}
            </div>
            <p className="text-muted max-w-3xl">{project.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-sm">
          <div className="flex items-center gap-3 text-muted">
            <Briefcase size={16} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Client</p>
              <p className="text-primary">{project.clientName || project.client || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted">
            <User size={16} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Manager</p>
              <p className="text-primary">{project.managerName || project.manager || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted">
            <Calendar size={16} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Timeline</p>
              <p className="text-primary">{format(new Date(project.startDate), 'MMM d, yyyy')} - {format(new Date(project.endDate), 'MMM d, yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted">
            <FileText size={16} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Purchase Order</p>
              <p className="text-primary">{project.purchase_order || project.poNumber || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted">
            <TrendingUp size={16} />
            <div className="w-full max-w-[130px]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted text-right">Progress <span className="text-primary ml-2">{progress}%</span></p>
              <div className="h-1.5 bg-surface rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {isTelecom && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs uppercase text-muted font-semibold">Average Delay (days)</p>
              <p className="text-2xl font-bold text-primary mt-1">{telecomSummary?.averageDelayDays ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs uppercase text-muted font-semibold">Early Items</p>
              <p className="text-2xl font-bold text-primary mt-1">{telecomSummary?.earlyItems ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs uppercase text-muted font-semibold">Schedule Health</p>
              <p className="text-sm text-primary mt-2">{(telecomSummary?.delayedItems || 0) > 0 ? 'Attention required on delayed rollout sites.' : 'No delayed site detected yet.'}</p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${isTelecom ? 'md:grid-cols-4' : 'md:grid-cols-4'} gap-4`}>
          {(isTelecom ? telecomStats : stats).map((stat) => (
            <div
              key={stat.label}
              onClick={() => navigate(`/projects/${id}/work-items?view=${stat.view}`)}
              className="bg-card border border-border/60 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:border-blue-500/30 hover:bg-surface transition-all group active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-bold tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-primary tabular-nums">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-lg font-bold text-primary mb-4">Recent Activity</h3>
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden min-h-[100px] flex flex-col">
            {projectActivities.length > 0 ? (
              projectActivities.map((activity) => (
                <div key={activity.id} className="p-4 border-b border-border/60 last:border-0 flex gap-4 hover:bg-surface transition-colors animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-muted shrink-0 capitalize">
                    {activity.userName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-secondary truncate"><span className="font-semibold text-primary">{activity.userName}</span> {activity.action}</p>
                    <p className="text-xs text-muted mt-1">{formatDistanceToNow(new Date(activity.timestamp))} ago</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-muted flex flex-col items-center gap-3">
                <Clock size={32} className="opacity-20" />
                <p>No recent activity recorded for this project.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;




