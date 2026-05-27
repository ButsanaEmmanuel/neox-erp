import React from 'react';
import { X, FileText, Clock3, CheckCircle2, XCircle, Link2 } from 'lucide-react';
import { FinanceEntryRecord } from '../../types/finance';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface Props {
  entry: FinanceEntryRecord | null;
  onClose: () => void;
}

// Right-side drawer for inspecting a finance entry. Shows the full audit
// chain: header (amount + type + status), evidence documents, approval
// history, source links back to the originating PM work item, and the
// activity log. Read-only — mutations still flow through the dedicated
// approve / settle endpoints, which the action buttons can wire up later.
const FinanceEntryDrawer: React.FC<Props> = ({ entry, onClose }) => {
  if (!entry) return null;

  const isReceivable = entry.entryType === 'receivable';
  const amountClass = isReceivable ? 'text-emerald-400' : 'text-rose-300';
  const amountSign = isReceivable ? '+' : '-';

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-[640px] max-w-[95vw] bg-app border-l border-border/60 shadow-2xl flex flex-col">
        <header className="p-6 border-b border-border/60 bg-card flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted">{entry.referenceCode}</p>
            <h2 className="text-2xl font-bold text-primary mt-1 truncate">{entry.title}</h2>
            <p className="text-xs text-secondary mt-1 truncate">
              {entry.companyName || entry.memo || entry.sourceModule}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-2xl font-bold tabular-nums ${amountClass}`}>
                {amountSign}{formatCurrency(Number(entry.amount || 0))}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted">{entry.currencyCode}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="grid grid-cols-2 gap-4 text-xs">
            <Field label="Type" value={entry.entryType} />
            <Field label="Direction" value={entry.direction} />
            <Field label="Lifecycle" value={entry.lifecycleStatus} />
            <Field label="Approval" value={entry.approvalStatus} />
            <Field label="Evidence" value={entry.evidenceStatus} />
            <Field label="Settlement" value={entry.settlementStatus} />
            <Field label="Expected at" value={entry.expectedAt ? formatDate(entry.expectedAt, 'short') : '—'} />
            <Field label="Approved at" value={entry.approvedAt ? formatDate(entry.approvedAt, 'short') : '—'} />
            <Field label="Settled at" value={entry.settledAt ? formatDate(entry.settledAt, 'short') : '—'} />
            <Field label="Updated" value={formatDate(entry.updatedAt, 'short')} />
          </section>

          {entry.validationMessage && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {entry.validationMessage}
            </div>
          )}

          <Section title={`Evidence (${entry.evidenceDocuments?.length || 0})`} icon={<FileText size={14} />}>
            {(entry.evidenceDocuments || []).length === 0 && <Empty label="No evidence submitted yet." />}
            {(entry.evidenceDocuments || []).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-primary truncate">{doc.originalFileName || doc.id}</p>
                  <p className="text-[11px] text-muted">
                    {doc.documentType || 'document'} · {doc.validationStatus} · {formatDate(doc.createdAt, 'short')}
                  </p>
                </div>
              </div>
            ))}
          </Section>

          <Section title={`Approvals (${entry.approvals?.length || 0})`} icon={<CheckCircle2 size={14} />}>
            {(entry.approvals || []).length === 0 && <Empty label="No approval recorded yet." />}
            {(entry.approvals || []).map((a) => {
              const verdict = (a.status || a.action || '').toLowerCase();
              const icon = verdict.includes('approve') ? <CheckCircle2 size={12} className="text-emerald-400" />
                : verdict.includes('reject') ? <XCircle size={12} className="text-rose-400" />
                : <Clock3 size={12} className="text-amber-400" />;
              return (
                <div key={a.id} className="rounded-lg border border-border/60 bg-surface px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    {icon}
                    <span className="text-primary font-semibold uppercase tracking-wide">{a.action} · {a.status}</span>
                    <span className="text-muted">·</span>
                    <span className="text-secondary">{a.actorDisplayName || a.actorUserId || 'System'}</span>
                  </div>
                  {a.notes && <p className="text-[11px] text-muted mt-1">{a.notes}</p>}
                  <p className="text-[10px] text-muted mt-1">{formatDate(a.createdAt, 'short')}</p>
                </div>
              );
            })}
          </Section>

          <Section title={`Source links (${entry.sourceLinks?.length || 0})`} icon={<Link2 size={14} />}>
            {(entry.sourceLinks || []).length === 0 && (
              <Empty label="No back-link to the originating module." />
            )}
            {(entry.sourceLinks || []).map((link) => (
              <div key={link.id} className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs text-secondary">
                <span className="uppercase tracking-wider text-muted">{link.sourceModule}</span> · {link.sourceEntity} · <span className="font-mono">{link.sourceEntityId}</span>
              </div>
            ))}
            {entry.projectId && (
              <p className="text-[11px] text-muted">
                Project: <span className="font-mono">{entry.projectId}</span>
                {entry.workItemId && <> · Work item: <span className="font-mono">{entry.workItemId}</span></>}
              </p>
            )}
          </Section>

          <Section title={`Activity (${entry.activities?.length || 0})`} icon={<Clock3 size={14} />}>
            {(entry.activities || []).length === 0 && <Empty label="No activity yet." />}
            {(entry.activities || []).map((a) => (
              <div key={a.id} className="rounded-lg border border-border/60 bg-surface px-3 py-2">
                <p className="text-xs text-primary">{a.message || a.actionType}</p>
                <p className="text-[10px] text-muted mt-1">
                  {a.actorDisplayName || a.eventSource} · {formatDate(a.createdAt, 'short')}
                </p>
              </div>
            ))}
          </Section>
        </div>
      </aside>
    </>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    <p className="text-sm text-primary mt-0.5">{value || '—'}</p>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-semibold text-primary flex items-center gap-2">{icon} {title}</h3>
    <div className="space-y-2">{children}</div>
  </section>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <p className="text-xs text-muted">{label}</p>
);

export default FinanceEntryDrawer;
