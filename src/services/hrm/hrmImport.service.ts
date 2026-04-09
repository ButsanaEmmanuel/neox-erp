import * as XLSX from 'xlsx';
import { 
    EmploymentType, 
    EmployeeImportRow, 
    DepartmentImportRow, 
    HRMImportValidationResult 
} from '../../types/hrm';

function readCell(sheet: XLSX.WorkSheet, rowNumber: number, col: string): string {
    const address = `${col}${rowNumber}`;
    const cell = sheet[address];
    if (!cell || cell.v === null || cell.v === undefined) return '';
    return String(cell.v).trim();
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

function toNumber(value: string): number | null {
    if (!value) return null;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
}

export async function parseEmployeeWorkbook(file: File, existingEmails: string[] = []): Promise<HRMImportValidationResult<EmployeeImportRow>> {
    const raw = await file.arrayBuffer();
    const workbook = XLSX.read(raw, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet || !sheet['!ref']) {
        return { totalRows: 0, validRows: [], invalidRows: [{ row: 0, message: 'Workbook is empty or unreadable.' }], warnings: [] };
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const validRows: EmployeeImportRow[] = [];
    const invalidRows: HRMImportValidationResult<EmployeeImportRow>['invalidRows'] = [];
    const warnings: string[] = [];

    // Columns: A=FirstName, B=LastName, C=Email, D=Phone, E=JobTitle, F=ContractType, G=HireDate, H=ContractEndDate, I=DepartmentName, J=ManagerEmail, K=Location, L=CompAmount, M=CompCurrency, N=CompFrequency, O=ManagerName(optional)
    for (let r = range.s.r + 2; r <= range.e.r + 1; r++) {
        const firstName = readCell(sheet, r, 'A');
        const lastName = readCell(sheet, r, 'B');
        const email = readCell(sheet, r, 'C').toLowerCase();
        const phone = readCell(sheet, r, 'D');
        const roleTitle = readCell(sheet, r, 'E');
        const contractType = readCell(sheet, r, 'F').toLowerCase();
        const hireDate = normalizeDate(readCell(sheet, r, 'G'));
        const contractEndDate = normalizeDate(readCell(sheet, r, 'H'));
        const departmentName = readCell(sheet, r, 'I');
        const managerEmail = readCell(sheet, r, 'J').toLowerCase();
        const managerName = readCell(sheet, r, 'O');
        const workLocation = readCell(sheet, r, 'K');
        const compAmount = toNumber(readCell(sheet, r, 'L'));
        const compCurrency = readCell(sheet, r, 'M') || 'USD';
        const compFrequency = readCell(sheet, r, 'N').toLowerCase() || 'annual';

        const isCompletelyEmpty = [firstName, lastName, email, roleTitle].every((v) => !v);
        if (isCompletelyEmpty) continue;

        const rowErrors: string[] = [];
        if (!firstName) rowErrors.push('Missing First Name.');
        if (!lastName) rowErrors.push('Missing Last Name.');
        if (!email) rowErrors.push('Missing Email.');
        else if (!/^\S+@\S+\.\S+$/.test(email)) rowErrors.push('Invalid Email format.');
        if (!roleTitle) rowErrors.push('Missing Job Title.');
        if (!hireDate) rowErrors.push('Missing or invalid Hire Date.');
        
        let validContractType: EmploymentType = 'employee';
        if (contractType && ['contractor', 'consultant', 'freelance'].includes(contractType)) {
            validContractType = 'contractor';
        }

        let compensation;
        if (compAmount !== null) {
            compensation = {
                amount: compAmount,
                currency: compCurrency,
                frequency: ['hourly', 'monthly', 'annual'].includes(compFrequency) ? compFrequency as 'annual' | 'monthly' | 'hourly' : 'annual'
            };
        }

        if (rowErrors.length > 0) {
            invalidRows.push({ row: r, identifier: email, message: rowErrors.join(' ') });
            continue;
        }

        validRows.push({
            rowNumber: r,
            email,
            managerEmail: managerEmail || undefined,
            managerName: managerName || undefined,
            departmentName: departmentName || undefined,
            contractEndDate: contractEndDate || undefined,
            payload: {
                name: `${firstName} ${lastName}`.trim(),
                email,
                phone: phone || undefined,
                employmentType: validContractType,
                roleTitle,
                startDate: hireDate as string,
                workLocation: workLocation || undefined,
                status: 'active',
                compensation
            }
        });
    }

    const duplicateInFile = new Set<string>();
    const seen = new Set<string>();
    const existingSet = new Set(existingEmails.filter(Boolean).map((v) => v.toLowerCase().trim()));
    
    for (const row of validRows) {
        if (seen.has(row.email)) duplicateInFile.add(row.email);
        seen.add(row.email);
        
        if (existingSet.has(row.email)) {
            invalidRows.push({ row: row.rowNumber, identifier: row.email, message: 'Employee with this email already exists.' });
        }
    }

    if (duplicateInFile.size > 0) warnings.push(`Duplicate emails detected in file: ${Array.from(duplicateInFile).join(', ')}`);

    const filteredValidRows = validRows.filter((row) => !existingSet.has(row.email));

    return { totalRows: filteredValidRows.length + invalidRows.length, validRows: filteredValidRows, invalidRows, warnings };
}

export async function parseDepartmentWorkbook(file: File, existingNames: string[] = []): Promise<HRMImportValidationResult<DepartmentImportRow>> {
    const raw = await file.arrayBuffer();
    const workbook = XLSX.read(raw, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet || !sheet['!ref']) {
        return { totalRows: 0, validRows: [], invalidRows: [{ row: 0, message: 'Workbook is empty or unreadable.' }], warnings: [] };
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const validRows: DepartmentImportRow[] = [];
    const invalidRows: HRMImportValidationResult<DepartmentImportRow>['invalidRows'] = [];
    const warnings: string[] = [];

    // Columns: A=Name, B=Description, C=ParentDepartment, D=ManagerEmail
    for (let r = range.s.r + 2; r <= range.e.r + 1; r++) {
        const name = readCell(sheet, r, 'A');
        const description = readCell(sheet, r, 'B');
        const parentName = readCell(sheet, r, 'C');
        const managerEmail = readCell(sheet, r, 'D').toLowerCase();

        if (!name && !description) continue;

        if (!name) {
            invalidRows.push({ row: r, message: 'Missing Department Name.' });
            continue;
        }

        validRows.push({
            rowNumber: r,
            name,
            description: description || undefined,
            parentName: parentName || undefined,
            managerEmail: managerEmail || undefined
        });
    }

    const duplicateInFile = new Set<string>();
    const seen = new Set<string>();
    const existingSet = new Set(existingNames.map(n => n.toLowerCase().trim()));
    
    for (const row of validRows) {
        const key = row.name.toLowerCase().trim();
        if (seen.has(key)) duplicateInFile.add(row.name);
        seen.add(key);
        
        if (existingSet.has(key)) {
            invalidRows.push({ row: row.rowNumber, identifier: row.name, message: 'Department with this name already exists.' });
        }
    }

    if (duplicateInFile.size > 0) warnings.push(`Duplicate department names in file: ${Array.from(duplicateInFile).join(', ')}`);

    const filteredValidRows = validRows.filter((row) => !existingSet.has(row.name.toLowerCase().trim()));

    return { totalRows: filteredValidRows.length + invalidRows.length, validRows: filteredValidRows, invalidRows, warnings };
}
