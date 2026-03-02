// Phase 20: Bulk Import System

export interface ImportResult {
    success: number;
    failed: number;
    errors: Array<{
        row: number;
        field: string;
        message: string;
    }>;
    preview: any[];
}

export class BulkImporter {
    /**
     * Parse CSV file
     */
    static parseCSV(csvText: string): string[][] {
        const lines = csvText.split('\n');
        return lines.map(line => line.split(',').map(cell => cell.trim()));
    }

    /**
     * Validate employee data
     */
    static validateEmployeeRow(row: string[], rowIndex: number): string[] {
        const errors: string[] = [];

        // Row format: code, name, email, phone, department, designation, salary, joiningDate
        if (row.length < 8) {
            errors.push(`Row ${rowIndex}: Missing required columns`);
            return errors;
        }

        const [code, name, email, phone, , , salary] = row;

        if (!code) errors.push(`Row ${rowIndex}: Employee code is required`);
        if (!name) errors.push(`Row ${rowIndex}: Name is required`);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push(`Row ${rowIndex}: Invalid email format`);
        }
        if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
            errors.push(`Row ${rowIndex}: Invalid phone number`);
        }
        if (!salary || isNaN(Number(salary))) {
            errors.push(`Row ${rowIndex}: Invalid salary`);
        }

        return errors;
    }

    /**
     * Import employees from CSV
     */
    static async importEmployees(csvText: string): Promise<ImportResult> {
        const rows = this.parseCSV(csvText);
        // const headers = rows[0];
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell)); // Filter empty rows

        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: [],
            preview: []
        };

        dataRows.forEach((row, index) => {
            const rowNumber = index + 2; // +2 for header and 0-index
            const errors = this.validateEmployeeRow(row, rowNumber);

            if (errors.length > 0) {
                result.failed++;
                errors.forEach(error => {
                    result.errors.push({
                        row: rowNumber,
                        field: 'general',
                        message: error
                    });
                });
            } else {
                result.success++;
                const [code, name, email, phone, department, designation, salary, joiningDate] = row;

                result.preview.push({
                    code,
                    name,
                    email,
                    phone,
                    department,
                    designation,
                    basicSalary: Number(salary),
                    joiningDate
                });
            }
        });

        return result;
    }

    /**
     * Generate sample CSV template
     */
    static generateEmployeeTemplate(): string {
        const headers = ['code', 'name', 'email', 'phone', 'department', 'designation', 'basicSalary', 'joiningDate'];
        const sampleRow = ['EMP-001', 'John Doe', 'john@example.com', '9876543210', 'Production', 'Operator', '30000', '2024-01-01'];

        return [headers.join(','), sampleRow.join(',')].join('\n');
    }
}
