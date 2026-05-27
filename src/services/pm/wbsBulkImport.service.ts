// Frontend xlsx → WBS rows parser. Mirrors backend validateWbsRows().
// Workbook layout (header at row 1, case-insensitive):
//
//   Title | ParentRef | WeightPercent | PlannedDate | ForecastDate
//   | ActualStartDate | Type | Priority | Assignee | Description
//
// ParentRef blank → parent (depth 1). ParentRef === another row's Title
// → sub-task. Weights are %, must sum to 100 at each level.
import * as XLSX from 'xlsx';
import { apiRequest } from '../../lib/apiClient';

export interface WbsRow {
  title: string;
  parentRef: string | null;
  weightPercent: number;
  plannedDate?: string;
  forecastDate?: string;
  actualStartDate?: string;
  type: string;
  priority: string;
  assignee?: string;
  description?: string;
  _rowNumber: number;
}

export interface WbsParseResult {
  totalRows: number;
  validRows: WbsRow[];
  errors: Array<{ row: number; message: string }>;
}

const HEADER_ALIASES: Record<string, keyof Omit<WbsRow, '_rowNumber'>> = {
  title: 'title',
  parentref: 'parentRef',
  parent: 'parentRef',
  weight: 'weightPercent',
  weightpercent: 'weightPercent',
  weight_percent: 'weightPercent',
  weightpct: 'weightPercent',
  planneddate: 'plannedDate',
  planned_date: 'plannedDate',
  forecastdate: 'forecastDate',
  forecast_date: 'forecastDate',
  actualstartdate: 'actualStartDate',
  actual_start_date: 'actualStartDate',
  startdate: 'actualStartDate',
  type: 'type',
  priority: 'priority',
  assignee: 'assignee',
  description: 'description',
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function excelSerialToIso(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0 && n < 100000) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(n) * 86400000);
    if (d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) {
      return d.toISOString().slice(0, 10);
    }
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try DD/MM/YYYY or MM/DD/YYYY: only accept if unambiguous.
  const slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    const month = Number(a) <= 12 ? Number(a) : Number(b);
    const day = Number(a) <= 12 ? Number(b) : Number(a);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return undefined;
}

export async function parseWbsWorkbook(file: File): Promise<WbsParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { totalRows: 0, validRows: [], errors: [{ row: 0, message: 'Workbook is empty.' }] };
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  if (json.length === 0) {
    return { totalRows: 0, validRows: [], errors: [{ row: 0, message: 'No data rows found below the header.' }] };
  }

  // Map header columns to canonical keys.
  const sample = json[0];
  const keyMap = new Map<string, keyof Omit<WbsRow, '_rowNumber'>>();
  for (const rawKey of Object.keys(sample)) {
    const norm = normalizeHeader(rawKey);
    const canonical = HEADER_ALIASES[norm];
    if (canonical) keyMap.set(rawKey, canonical);
  }
  if (!Array.from(keyMap.values()).includes('title')) {
    return { totalRows: json.length, validRows: [], errors: [{ row: 1, message: 'Header must include a "Title" column.' }] };
  }

  const validRows: WbsRow[] = [];
  const errors: WbsParseResult['errors'] = [];

  json.forEach((raw, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const mapped: Partial<WbsRow> = { _rowNumber: rowNumber };
    for (const [rawKey, canonical] of keyMap.entries()) {
      mapped[canonical] = raw[rawKey] as never;
    }

    const title = String(mapped.title ?? '').trim();
    if (!title) {
      errors.push({ row: rowNumber, message: 'Missing Title.' });
      return;
    }
    const weight = Number(mapped.weightPercent);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      errors.push({ row: rowNumber, message: `Invalid WeightPercent '${mapped.weightPercent}'. Must be 0–100.` });
      return;
    }
    validRows.push({
      title,
      parentRef: (String(mapped.parentRef ?? '').trim() || null),
      weightPercent: Math.round(weight * 100) / 100,
      plannedDate: excelSerialToIso(mapped.plannedDate),
      forecastDate: excelSerialToIso(mapped.forecastDate),
      actualStartDate: excelSerialToIso(mapped.actualStartDate),
      type: String(mapped.type ?? 'task').trim() || 'task',
      priority: String(mapped.priority ?? 'medium').trim() || 'medium',
      assignee: mapped.assignee ? String(mapped.assignee).trim() : undefined,
      description: mapped.description ? String(mapped.description) : undefined,
      _rowNumber: rowNumber,
    });
  });

  return { totalRows: json.length, validRows, errors };
}

export async function submitWbsBulkImport(params: {
  projectId: string;
  fileName: string;
  rows: WbsRow[];
  actorUserId?: string;
  actorDisplayName?: string;
}) {
  const qs = params.actorUserId ? `?userId=${encodeURIComponent(params.actorUserId)}` : '';
  return apiRequest<{ batchId: string; parentsCreated: number; childrenCreated: number }>(
    `/api/v1/projects/${params.projectId}/work-items/bulk-wbs${qs}`,
    {
      method: 'POST',
      body: {
        fileName: params.fileName,
        rows: params.rows,
        actorUserId: params.actorUserId,
        actorDisplayName: params.actorDisplayName,
      },
    },
  );
}

// Generates a one-sheet starter template the user can download from the UI.
export function buildWbsTemplate(): Blob {
  const headers = [
    'Title', 'ParentRef', 'WeightPercent', 'PlannedDate', 'ForecastDate',
    'ActualStartDate', 'Type', 'Priority', 'Assignee', 'Description',
  ];
  const example = [
    ['Phase 1 — Discovery', '', 60, '2026-06-01', '2026-06-01', '2026-06-02', 'milestone', 'high', '', 'Kickoff + research'],
    ['Stakeholder interviews', 'Phase 1 — Discovery', 50, '2026-06-01', '', '2026-06-02', 'task', 'high', '', ''],
    ['Sitemap draft', 'Phase 1 — Discovery', 50, '2026-06-05', '', '', 'task', 'medium', '', ''],
    ['Phase 2 — Build', '', 40, '2026-07-01', '2026-07-01', '', 'milestone', 'high', '', 'Implementation'],
    ['Frontend skeleton', 'Phase 2 — Build', 100, '2026-07-01', '', '', 'task', 'high', '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'WBS');
  const blobOut = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([blobOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
