import * as XLSX from 'xlsx';
import { TelecomImportRow, TelecomImportValidationResult } from '../../types/pm';

const REQUIRED_DOMAIN_FIELDS = ['site_identifier', 'po_unit_price'] as const;

function readCell(sheet: XLSX.WorkSheet, rowNumber: number, col: string): string {
  const address = `${col}${rowNumber}`;
  const cell = sheet[address];
  if (!cell || cell.v === null || cell.v === undefined) return '';
  return String(cell.v).trim();
}

function toNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(value: string): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0 && asNumber < 100000) {
    const epoch = Date.UTC(1899, 11, 30);
    const millis = epoch + Math.round(asNumber) * 86400000;
    const excelDate = new Date(millis);
    const year = excelDate.getUTCFullYear();
    if (year >= 2000 && year <= 2100) {
      return excelDate.toISOString().slice(0, 10);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return raw;
}

export async function parseTelecomWorkbook(file: File, existingSiteIdentifiers: string[] = []): Promise<TelecomImportValidationResult> {
  const raw = await file.arrayBuffer();
  const workbook = XLSX.read(raw, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet || !sheet['!ref']) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [{ row: 0, message: 'Workbook is empty or unreadable.' }],
      warnings: [],
    };
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const validRows: TelecomImportRow[] = [];
  const invalidRows: TelecomImportValidationResult['invalidRows'] = [];
  const warnings: string[] = [];

  // Business mapping aligned with workbook:
  // B=Legacy Site ID, C=Site ID, D=Site Name, E..M=project/audit fields, AE=PO Unit Price
  for (let r = range.s.r + 2; r <= range.e.r + 1; r++) {
    const legacy_site_id = readCell(sheet, r, 'B');
    const site_identifier = readCell(sheet, r, 'C');
    const site_name = readCell(sheet, r, 'D');
    const project_name = readCell(sheet, r, 'E');
    const type_of_work = readCell(sheet, r, 'F');
    const subcontractor = readCell(sheet, r, 'G');
    const team = readCell(sheet, r, 'H');
    const planning_audit_date = normalizeDate(readCell(sheet, r, 'I'));
    const planning_audit_week = toNumber(readCell(sheet, r, 'J'));
    const forecast_date = normalizeDate(readCell(sheet, r, 'K'));
    const forecast_week = toNumber(readCell(sheet, r, 'L'));
    const actual_audit_date = normalizeDate(readCell(sheet, r, 'M'));
    const po_unit_price_raw = readCell(sheet, r, 'AE');
    const po_unit_price = toNumber(po_unit_price_raw);

    const isCompletelyEmpty = [legacy_site_id, site_identifier, site_name, project_name, type_of_work, subcontractor, team, po_unit_price_raw].every((v) => !v);
    if (isCompletelyEmpty) continue;

    const rowErrors: string[] = [];
    if (!site_identifier) rowErrors.push('Missing site_identifier (column B).');
    if (po_unit_price === null) rowErrors.push('Invalid po_unit_price (column AE) - must be numeric.');

    if (rowErrors.length > 0) {
      invalidRows.push({
        row: r,
        site_identifier: site_identifier || undefined,
        message: rowErrors.join(' '),
      });
      continue;
    }

    const normalizedPoUnitPrice = po_unit_price as number;

    validRows.push({
      rowNumber: r,
      site_identifier,
      title: site_name || site_identifier,
      po_unit_price: normalizedPoUnitPrice,
      imported_fields: {
        legacy_site_id,
        site_identifier,
        site_name,
        project_name,
        type_of_work,
        subcontractor,
        team,
        planning_audit_date,
        planning_audit_week: planning_audit_week ?? undefined,
        forecast_date,
        forecast_week: forecast_week ?? undefined,
        actual_audit_date,
        // Keep compatibility for existing downstream logic.
        planned_start_date: planning_audit_date,
        planned_end_date: actual_audit_date,
      },
    });
  }

  const duplicateInFile = new Set<string>();
  const seen = new Set<string>();
  const existingSet = new Set(existingSiteIdentifiers.filter(Boolean).map((v) => v.trim()));
  for (const row of validRows) {
    if (seen.has(row.site_identifier)) {
      duplicateInFile.add(row.site_identifier);
    }
    seen.add(row.site_identifier);
    if (existingSet.has(row.site_identifier)) {
      invalidRows.push({
        row: row.rowNumber,
        site_identifier: row.site_identifier,
        message: 'Duplicate site_identifier already exists under this parent project.',
      });
    }
  }

  if (duplicateInFile.size > 0) {
    warnings.push(`Duplicate site identifiers detected in file: ${Array.from(duplicateInFile).join(', ')}`);
  }

  const filteredValidRows = validRows.filter((row) => !existingSet.has(row.site_identifier));

  for (const field of REQUIRED_DOMAIN_FIELDS) {
    if (!filteredValidRows.some((r) => r[field])) {
      warnings.push(`No valid values found for required field: ${field}`);
    }
  }

  return {
    totalRows: filteredValidRows.length + invalidRows.length,
    validRows: filteredValidRows,
    invalidRows,
    warnings,
  };
}

export function detectTelecomByClient(clientName: string, projectCategory?: string): boolean {
  const probe = `${clientName || ''} ${projectCategory || ''}`.toLowerCase();
  return ['telecom', 'telco', 'rollout', 'multi-site', 'fiber', 'tower'].some((k) => probe.includes(k));
}

