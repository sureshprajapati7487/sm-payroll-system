// Phase 17: Accounting Export Utilities

export class AccountingExporter {
    /**
     * Export to Tally XML format
     */
    static exportToTally(payrollData: any[]) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                ${payrollData.map(p => this.createTallyVoucher(p)).join('\n')}
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

        return xml;
    }

    private static createTallyVoucher(payroll: any) {
        return `
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <VOUCHER VCHTYPE="Payment" ACTION="Create">
                        <DATE>${payroll.month}</DATE>
                        <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
                        <VOUCHERNUMBER>${payroll.id}</VOUCHERNUMBER>
                        <PARTYLEDGERNAME>Salary Payable</PARTYLEDGERNAME>
                        <EFFECTIVEDATE>${payroll.month}</EFFECTIVEDATE>
                        <NARRATION>Salary for ${payroll.employeeName}</NARRATION>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Salary Expense</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                            <AMOUNT>-${payroll.grossSalary}</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                        <ALLLEDGERENTRIES.LIST>
                            <LEDGERNAME>Cash</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                            <AMOUNT>${payroll.netSalary}</AMOUNT>
                        </ALLLEDGERENTRIES.LIST>
                    </VOUCHER>
                </TALLYMESSAGE>`;
    }

    /**
     * Export to CSV for Zoho Books / QuickBooks
     */
    static exportToCSV(payrollData: any[]) {
        const headers = ['Date', 'Account', 'Debit', 'Credit', 'Description'];
        const rows = [headers.join(',')];

        payrollData.forEach(p => {
            // Salary Expense - Debit
            rows.push([
                p.month,
                'Salary Expense',
                p.grossSalary,
                '',
                `Salary - ${p.employeeName}`
            ].join(','));

            // PF Deduction - Credit
            rows.push([
                p.month,
                'PF Payable',
                '',
                p.deductions.pf,
                `PF - ${p.employeeName}`
            ].join(','));

            // Cash/Bank - Credit
            rows.push([
                p.month,
                'Cash',
                '',
                p.netSalary,
                `Payment - ${p.employeeName}`
            ].join(','));
        });

        return rows.join('\n');
    }

    /**
     * Generate Journal Entries
     */
    static generateJournalEntries(payroll: any) {
        return {
            date: payroll.month,
            voucherType: 'JV - Journal Voucher',
            entries: [
                {
                    account: 'Salary Expense',
                    debit: payroll.grossSalary,
                    credit: 0,
                    narration: `Salary for ${payroll.employeeName}`
                },
                {
                    account: 'PF Payable (Employee)',
                    debit: 0,
                    credit: payroll.deductions.employeePF,
                    narration: 'Employee PF contribution'
                },
                {
                    account: 'PF Payable (Employer)',
                    debit: payroll.deductions.employerPF,
                    credit: 0,
                    narration: 'Employer PF contribution'
                },
                {
                    account: 'TDS Payable',
                    debit: 0,
                    credit: payroll.deductions.tds,
                    narration: 'TDS deducted'
                },
                {
                    account: 'Cash/Bank',
                    debit: 0,
                    credit: payroll.netSalary,
                    narration: 'Net salary payment'
                }
            ]
        };
    }
}
