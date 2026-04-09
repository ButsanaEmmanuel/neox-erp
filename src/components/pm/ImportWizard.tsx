import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TelecomImportValidationResult } from '../../types/pm';
import { parseTelecomWorkbook } from '../../services/pm/telecomImport.service';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const ImportWizard: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, workItems, importTelecomRows } = useProjectStore();
  const { user } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<TelecomImportValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [execution, setExecution] = useState<{ created: number; failed: number } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('Preparing import...');
  const [importError, setImportError] = useState<string | null>(null);

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);

  if (!project || !id) {
    return <div className="p-8 text-muted">Project not found.</div>;
  }

  const telecomMode = project.isTelecomProject || project.projectMode === 'telecom_multi_site';

  const handleUpload = async (selected: File) => {
    setFile(selected);
    setIsValidating(true);
    try {
      const existingSiteIdentifiers = workItems
        .filter((item) => item.projectId === id)
        .map((item) => item.imported_fields?.site_identifier)
        .filter(Boolean) as string[];

      const result = await parseTelecomWorkbook(selected, existingSiteIdentifiers);
      setValidation(result);
      setStep(3);
    } finally {
      setIsValidating(false);
    }
  };

  const executeImport = async () => {
    if (!validation) return;
    setImportError(null);
    setImportProgress(3);
    setImportMessage('Preparing batch...');
    setStep(4);
    let timer: number | null = null;
    timer = window.setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 92) return prev;
        const delta = Math.max(1, Math.floor(Math.random() * 5));
        return Math.min(92, prev + delta);
      });
    }, 260);
    try {
      setImportMessage(`Importing ${validation.validRows.length} valid rows...`);
      const result = await importTelecomRows(
        id,
        file?.name || 'telecom-import.xlsx',
        validation.validRows,
        user?.name || user?.email || 'current-user',
        user?.id,
      );
      setExecution(result);
      setImportProgress(100);
      setImportMessage('Finalizing and refreshing project data...');
      setTimeout(() => setStep(5), 280);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setImportError(message);
      setImportMessage('Import failed');
    } finally {
      if (timer) window.clearInterval(timer);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-app overflow-auto">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="rounded-xl border border-border/60 bg-card/60 p-5 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Telecom Multi-Site Import Wizard</h1>
            <p className="text-sm text-muted mt-1">
              Parent project: <span className="text-primary">{project.name}</span>
              {project.purchase_order ? <span> · Purchase Order: <span className="text-primary">{project.purchase_order}</span></span> : null}
            </p>
          </div>
          <div className="text-xs px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {telecomMode ? 'Telecom Mode' : 'Standard Mode'}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-2 flex-1 rounded-full ${step >= s ? 'bg-emerald-500' : 'bg-surface'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-border/60 bg-card p-6"
          >
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-primary">Step 1 — Confirm Parent Project Context</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-app border border-border/60">
                    <p className="text-muted">Client</p>
                    <p className="text-primary">{project.clientName || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-app border border-border/60">
                    <p className="text-muted">Project Mode</p>
                    <p className="text-primary">{project.projectMode || 'standard'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-app border border-border/60">
                    <p className="text-muted">Purchase Order</p>
                    <p className="text-primary">{project.purchase_order || project.poNumber || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-app border border-border/60">
                    <p className="text-muted">Bulk Import Required</p>
                    <p className="text-primary">{project.bulkImportRequired ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">
                    Continue <ArrowRight size={14} className="inline ml-1" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-primary">Step 2 — Upload Excel File</h2>
                <label className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-input rounded-xl bg-surface cursor-pointer hover:bg-surface transition-colors">
                  <FileSpreadsheet className="text-emerald-400 mb-3" size={38} />
                  <p className="text-sm text-secondary">Upload telecom workbook (.xlsx)</p>
                  <p className="text-xs text-muted mt-1">System imports B:M and AE, manual completion for N:X, Z:AD, AF</p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                </label>
                {isValidating && (
                  <div className="text-sm text-muted flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Validating workbook...</div>
                )}
              </div>
            )}

            {step === 3 && validation && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-primary">Step 3 — Validate & Preview</h2>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-app border border-border/60"><p className="text-muted">Total</p><p className="text-primary text-base">{validation.totalRows}</p></div>
                  <div className="p-3 rounded-lg bg-app border border-emerald-500/20"><p className="text-muted">Valid</p><p className="text-emerald-400 text-base">{validation.validRows.length}</p></div>
                  <div className="p-3 rounded-lg bg-app border border-rose-500/20"><p className="text-muted">Invalid</p><p className="text-rose-400 text-base">{validation.invalidRows.length}</p></div>
                  <div className="p-3 rounded-lg bg-app border border-amber-500/20"><p className="text-muted">Warnings</p><p className="text-amber-400 text-base">{validation.warnings.length}</p></div>
                </div>

                {validation.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                    {validation.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                  </div>
                )}

                {validation.invalidRows.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 max-h-40 overflow-auto">
                    {validation.invalidRows.slice(0, 20).map((r) => (
                      <p key={`${r.row}-${r.message}`}>Row {r.row}: {r.message}</p>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-border/60 overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-app text-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Site Identifier</th>
                        <th className="px-3 py-2 text-left">Site Name</th>
                        <th className="px-3 py-2 text-left">Region</th>
                        <th className="px-3 py-2 text-left">Planning Date</th>
                        <th className="px-3 py-2 text-left">Forecast Date</th>
                        <th className="px-3 py-2 text-right">PO Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.validRows.slice(0, 100).map((row) => (
                        <tr key={`${row.rowNumber}-${row.site_identifier}`} className="border-t border-border/60 text-secondary">
                          <td className="px-3 py-2">{row.site_identifier}</td>
                          <td className="px-3 py-2">{row.imported_fields.site_name || row.title}</td>
                          <td className="px-3 py-2">{row.imported_fields.region || '-'}</td>
                          <td className="px-3 py-2">{row.imported_fields.planning_audit_date || '-'}</td>
                          <td className="px-3 py-2">{row.imported_fields.forecast_date || row.imported_fields.planning_audit_date || '-'}</td>
                          <td className="px-3 py-2 text-right">{row.po_unit_price.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-input text-secondary">Back</button>
                  <button
                    onClick={executeImport}
                    disabled={validation.validRows.length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    Execute Import
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="py-14 px-6 flex flex-col items-center text-secondary gap-4">
                <Loader2 className="animate-spin text-emerald-400" size={34} />
                <p className="text-sm">{importMessage}</p>
                <div className="w-full max-w-2xl">
                  <div className="h-3 w-full rounded-full bg-surface border border-border/60 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted flex items-center justify-between">
                    <span>{importProgress}%</span>
                    <span>{Math.min(validation?.validRows.length || 0, Math.round(((validation?.validRows.length || 0) * importProgress) / 100))}/{validation?.validRows.length || 0} rows processed</span>
                  </div>
                </div>
                {importError && (
                  <div className="w-full max-w-2xl rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {importError}
                  </div>
                )}
              </div>
            )}

            {step === 5 && execution && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={20} /> Import completed</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-app border border-emerald-500/20">
                    <p className="text-muted">Created</p>
                    <p className="text-emerald-400 text-lg font-semibold">{execution.created}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-app border border-amber-500/20">
                    <p className="text-muted">Skipped/Failed</p>
                    <p className="text-amber-400 text-lg font-semibold">{execution.failed}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                  Manual completion required: N:X, Z:AD, AF (ticket_number). Computed fields are read-only and synced to Finance automatically.
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => navigate(`/projects/${id}/work-items?view=needs_manual_completion`)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                  >
                    Open Completion Board
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {!telecomMode && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5" />
            This project is currently in standard mode. Telecom import can still be used, but project mode should be telecom_multi_site for full workflow semantics.
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportWizard;





