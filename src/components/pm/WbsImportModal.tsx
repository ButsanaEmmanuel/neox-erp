// WBS bulk-import modal: drop an .xlsx, preview rows + weight roll-ups,
// confirm to POST /api/v1/projects/:id/work-items/bulk-wbs. The preview
// table is the user's last line of defense before mutating the project,
// so we render every row with its assigned parent and a per-parent weight
// total in red when it's not 100.
import React, { useMemo, useState } from 'react';
import { X, Upload, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  parseWbsWorkbook,
  submitWbsBulkImport,
  buildWbsTemplate,
  WbsRow,
} from '../../services/pm/wbsBulkImport.service';

interface WbsImportModalProps {
  projectId: string;
  actorUserId?: string;
  actorDisplayName?: string;
  onClose: () => void;
  onCompleted?: () => void;
}

interface PreviewLevel {
  parents: WbsRow[];
  childrenByParent: Map<string, WbsRow[]>;
  parentSum: number;
}

const WbsImportModal: React.FC<WbsImportModalProps> = ({
  projectId, actorUserId, actorDisplayName, onClose, onCompleted,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<WbsRow[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview: PreviewLevel = useMemo(() => {
    const parents = rows.filter((r) => !r.parentRef);
    const childrenByParent = new Map<string, WbsRow[]>();
    for (const r of rows) {
      if (!r.parentRef) continue;
      if (!childrenByParent.has(r.parentRef)) childrenByParent.set(r.parentRef, []);
      childrenByParent.get(r.parentRef)!.push(r);
    }
    const parentSum = parents.reduce((acc, p) => acc + p.weightPercent, 0);
    return { parents, childrenByParent, parentSum };
  }, [rows]);

  const handleFile = async (file: File) => {
    setServerError(null);
    setSuccess(null);
    setFileName(file.name);
    const result = await parseWbsWorkbook(file);
    setRows(result.validRows);
    setErrors(result.errors);
  };

  const downloadTemplate = () => {
    const blob = buildWbsTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wbs-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (rows.length === 0 || errors.length > 0) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await submitWbsBulkImport({
        projectId,
        fileName: fileName || 'wbs-import.xlsx',
        rows,
        actorUserId,
        actorDisplayName,
      });
      setSuccess(`Imported ${result.parentsCreated} parents + ${result.childrenCreated} sub-tasks.`);
      onCompleted?.();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Bulk import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = rows.length > 0 && errors.length === 0 && !submitting;
  const parentsSumOk = Math.abs(preview.parentSum - 100) < 0.05;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-app border border-border/60 rounded-xl shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-primary">Bulk import — Work Breakdown</h3>
            <p className="text-xs text-muted">Parent tasks + sub-tasks with weight %, planned/actual start dates.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-border/60">
          <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs cursor-pointer">
            <Upload size={14} /> Choose .xlsx
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-input text-secondary hover:text-primary hover:bg-surface"
          >
            <Download size={14} /> Download template
          </button>
          {fileName && <span className="text-xs text-muted truncate">Loaded: {fileName}</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-medium mb-2">
                <AlertTriangle size={14} /> {errors.length} row(s) rejected
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-[11px] text-rose-200">Row {e.row}: {e.message}</li>
                ))}
                {errors.length > 20 && <li className="text-[11px] text-muted">…and {errors.length - 20} more.</li>}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className={`text-xs px-3 py-2 rounded-lg border ${parentsSumOk ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
                Parent weights total: {preview.parentSum.toFixed(2)} % {parentsSumOk ? '✓' : '(must equal 100)'}
              </div>
              <div className="space-y-3">
                {preview.parents.map((parent) => {
                  const kids = preview.childrenByParent.get(parent.title) || [];
                  const kidSum = kids.reduce((acc, k) => acc + k.weightPercent, 0);
                  const kidsOk = kids.length === 0 || Math.abs(kidSum - 100) < 0.05;
                  return (
                    <div key={parent.title} className="rounded-lg border border-border/60 bg-surface">
                      <div className="px-3 py-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary truncate">{parent.title}</p>
                          <p className="text-[11px] text-muted">
                            {parent.type} · {parent.priority}
                            {parent.plannedDate ? ` · planned ${parent.plannedDate}` : ''}
                            {parent.actualStartDate ? ` · started ${parent.actualStartDate}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-blue-300">{parent.weightPercent.toFixed(2)}%</span>
                      </div>
                      {kids.length > 0 && (
                        <div className="border-t border-border/60 px-3 py-2 space-y-1">
                          {kids.map((k) => (
                            <div key={k.title} className="flex items-center justify-between text-xs">
                              <span className="text-secondary truncate">↳ {k.title}</span>
                              <span className="text-muted font-mono">{k.weightPercent.toFixed(2)}%</span>
                            </div>
                          ))}
                          <p className={`text-[11px] mt-1 ${kidsOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                            Sub-task total: {kidSum.toFixed(2)} % {kidsOk ? '✓' : '(must equal 100)'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rows.length === 0 && errors.length === 0 && (
            <div className="text-center py-10 text-muted">
              <Upload size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Drop an .xlsx file or download the template to get started.</p>
            </div>
          )}

          {serverError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{serverError}</div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} /> {success}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-input text-secondary hover:text-primary">Cancel</button>
          <button
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Importing…' : `Import ${rows.length} row(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WbsImportModal;
