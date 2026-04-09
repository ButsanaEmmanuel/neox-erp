export function validateTelecomRows(rows, existingSiteIds = []) {
  const existingSet = new Set(existingSiteIds.map((value) => String(value).trim()));
  const seenInFile = new Set();
  const validRows = [];
  const invalidRows = [];
  const warnings = [];

  for (const row of rows || []) {
    const site_identifier = String(row?.site_identifier || '').trim();
    const po_unit_price = Number(row?.po_unit_price);

    if (!site_identifier) {
      invalidRows.push({ row: row?.rowNumber || 0, message: 'Missing site_identifier.' });
      continue;
    }
    if (!Number.isFinite(po_unit_price)) {
      invalidRows.push({ row: row?.rowNumber || 0, site_identifier, message: 'Invalid po_unit_price.' });
      continue;
    }
    if (seenInFile.has(site_identifier)) {
      invalidRows.push({ row: row?.rowNumber || 0, site_identifier, message: 'Duplicate site_identifier in file.' });
      continue;
    }
    if (existingSet.has(site_identifier)) {
      invalidRows.push({ row: row?.rowNumber || 0, site_identifier, message: 'site_identifier already exists in project.' });
      continue;
    }

    seenInFile.add(site_identifier);
    validRows.push({
      ...row,
      site_identifier,
      po_unit_price,
    });
  }

  if (invalidRows.some((row) => row.message.includes('Duplicate site_identifier in file'))) {
    warnings.push('Duplicate identifiers were found and rejected.');
  }

  return {
    totalRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    warnings,
  };
}
