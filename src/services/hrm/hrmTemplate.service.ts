import * as XLSX from 'xlsx';

export function downloadEmployeeTemplate() {
    const headers = [
        ['FirstName', 'LastName', 'Email', 'Phone', 'JobTitle', 'ContractType', 'HireDate', 'ContractEndDate', 'DepartmentName', 'ManagerEmail', 'Location', 'CompAmount', 'CompCurrency', 'CompFrequency']
    ];
    
    const sampleData = [
        ['John', 'Doe', 'john.doe@example.com', '+123456789', 'Software Engineer', 'employee', '2024-01-15', '', 'Engineering', 'manager@example.com', 'New York', '85000', 'USD', 'annual'],
        ['Jane', 'Smith', 'jane.smith@example.com', '+987654321', 'Product Manager', 'employee', '2023-11-01', '', 'Product', 'director@example.com', 'London', '95000', 'USD', 'annual'],
        ['Alice', 'Brown', 'alice.contractor@example.com', '+1122334455', 'UX Designer', 'contractor', '2024-03-01', '2024-08-31', 'Design', 'jane.smith@example.com', 'Remote', '65', 'USD', 'hourly']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Add some column widths for better readability
    worksheet['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, 
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 25 }, 
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
    ];

    XLSX.writeFile(workbook, 'employee_import_template.xlsx');
}

export function downloadDepartmentTemplate() {
    const headers = [
        ['Name', 'Description', 'ParentDepartment', 'ManagerEmail']
    ];

    const sampleData = [
        ['Engineering', 'Product development and infrastructure', '', 'cto@example.com'],
        ['Frontend', 'UI/UX and Web development', 'Engineering', 'fe-lead@example.com'],
        ['Sales', 'Direct sales and partnership management', '', 'sales-head@example.com']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments');

    worksheet['!cols'] = [
        { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 25 }
    ];

    XLSX.writeFile(workbook, 'department_import_template.xlsx');
}
