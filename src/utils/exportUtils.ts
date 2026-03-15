import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { LoanRecord as Loan } from '@/types';
import { useSecurityAlertsStore } from '@/store/securityAlertsStore';

export const exportToExcel = (data: any[], fileName: string, user?: any) => {
    const ws = XLSX.utils.json_to_sheet(data);

    if (user) {
        XLSX.utils.sheet_add_aoa(ws, [
            [],
            [`CONFIDENTIAL — ${user.role || 'System'} DATA`],
            [`Downloaded by ${user.name || 'Automated'} (${user.id || 'System'}) on ${new Date().toLocaleString()}`]
        ], { origin: -1 });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${fileName}.xlsx`);

    if (user) {
        useSecurityAlertsStore.getState().addAlert({
            type: 'data_export',
            severity: 'low',
            title: `Data Export: ${fileName}`,
            description: `${user.name || 'System'} exported ${data.length} records to Excel.`,
            userId: user.id || 'system',
            userName: user.name || 'System',
            metadata: { fileName, recordCount: data.length, format: 'excel' }
        });
    }
};

export const exportPayrollToPDF = (slips: any[], period: string, user?: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('SM PAYROLL SYSTEM', 14, 20);
    doc.setFontSize(14);
    doc.text(`Payroll Register - ${period}`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);

    // Table Data preparation
    // slips has augmented data (employeeId is replaced by Name for PDF usually, or we pass a different object)
    // But safely addressing properties
    const tableData = slips.map(slip => [
        slip.employeeId, // Assuming this might be name if mapped before calling
        slip.basicSalary?.toLocaleString() || '0',
        slip.allowances?.toLocaleString() || '0',
        slip.overtimeAmount?.toLocaleString() || '0',
        slip.productionAmount?.toLocaleString() || '0',
        slip.grossSalary?.toLocaleString() || '0',
        slip.pfDeduction?.toLocaleString() || '0',
        slip.taxDeduction?.toLocaleString() || '0',
        slip.totalDeductions?.toLocaleString() || '0',
        slip.netSalary?.toLocaleString() || '0',
        slip.status
    ]);

    (doc as any).autoTable({
        head: [['Employee', 'Basic', 'Allow', 'OT', 'Prod', 'Gross', 'PF', 'Tax', 'Deductions', 'Net Pay', 'Status']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 25 }, // Name
            // Adjust others if needed
        }
    });

    // Summary Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalPayout = slips.reduce((sum, s) => sum + (s.netSalary || 0), 0);

    doc.setFontSize(12);
    doc.text(`Total Payout: Rs. ${totalPayout.toLocaleString()}`, 14, finalY);

    if (user) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.text(`CONFIDENTIAL — ${user.role || 'System'} DATA | Downloaded by ${user.name} on ${new Date().toLocaleString()}`, 14, pageHeight - 10);
    }

    doc.save(`Payroll_Register_${period}.pdf`);

    if (user) {
        useSecurityAlertsStore.getState().addAlert({
            type: 'data_export',
            severity: 'low',
            title: `Payroll Exported: ${period}`,
            description: `${user.name || 'System'} exported payroll register for ${period} to PDF.`,
            userId: user.id || 'system',
            userName: user.name || 'System',
            metadata: { period, recordCount: slips.length, format: 'pdf' }
        });
    }
};


export const exportLoansToPDF = (loans: Loan[], employees: any[], user?: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('SM PAYROLL SYSTEM', 14, 20);
    doc.setFontSize(14);
    doc.text('Employee Loan Summary', 14, 30);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);

    const tableData = loans.map(loan => {
        const emp = employees.find(e => e.id === loan.employeeId);
        const approver = employees.find(e => e.id === loan.approverId);
        const paid = loan.amount - loan.balance;
        return [
            emp?.name || 'Unknown',
            loan.type,
            loan.amount.toLocaleString(),
            paid.toLocaleString(),
            loan.balance.toLocaleString(),
            loan.emiAmount?.toLocaleString() || '0',
            approver?.name || 'System',
            loan.status
        ];
    });

    (doc as any).autoTable({
        head: [['Employee', 'Type', 'Total', 'Paid', 'Balance', 'EMI', 'Approver', 'Status']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [44, 62, 80], fontSize: 9 }, // Dark header
        alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    const totalOutstanding = loans.reduce((sum, l) => sum + l.balance, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.text(`Total Outstanding Balance: Rs. ${totalOutstanding.toLocaleString()}`, 14, finalY);

    if (user) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.text(`CONFIDENTIAL — ${user.role || 'System'} DATA | Downloaded by ${user.name} on ${new Date().toLocaleString()}`, 14, pageHeight - 10);
    }

    doc.save(`Loan_Summary_${new Date().toISOString().split('T')[0]}.pdf`);

    if (user) {
        useSecurityAlertsStore.getState().addAlert({
            type: 'data_export',
            severity: 'low',
            title: `Loan Summary Exported`,
            description: `${user.name || 'System'} exported loan summary to PDF.`,
            userId: user.id || 'system',
            userName: user.name || 'System',
            metadata: { recordCount: loans.length, format: 'pdf' }
        });
    }
};

export const exportEmployeePayoutToExcel = (
    employee: any,
    month: string,
    salaryDetails: any,
    attendanceRecords: any[],
    activeLoans: any[],
    user?: any
) => {
    const wb = XLSX.utils.book_new();
    const sheetData: any[][] = [];

    // 1. Header Info
    sheetData.push(['SM PAYROLL SYSTEM']);
    sheetData.push([`Employee Payout - ${employee.name}`]);
    sheetData.push([`Month: ${month}`]);
    sheetData.push(['']);
    sheetData.push(['Employee Details']);
    sheetData.push(['Name', employee.name]);
    sheetData.push(['Basic Salary', employee.basicSalary]);
    sheetData.push(['Payment Type', employee.salaryType]);
    sheetData.push(['']);

    // 2. Summary & Calculation
    sheetData.push(['Summary & Calculation']);
    sheetData.push(['Total Present (Normal + Offs)', salaryDetails.presentDays]);
    sheetData.push(['OT Bonus Days', salaryDetails.otBonusDays || 0]);
    sheetData.push(['Hourly OT', `${salaryDetails.totalOTHours || 0} Hrs`]);
    sheetData.push(['Total Paid Days', salaryDetails.totalPaidDays]);
    sheetData.push(['']);
    sheetData.push(['Base Salary', salaryDetails.basicSalary]);
    sheetData.push(['Production', salaryDetails.productionAmount]);
    sheetData.push(['Hourly OT Amount', salaryDetails.overtimeAmount]);
    sheetData.push(['Loans/Deductions', salaryDetails.totalDeductions]);
    sheetData.push(['NET SALARY', salaryDetails.netSalary]);
    sheetData.push(['']);

    // 3. Loans
    sheetData.push(['Loan Deductions']);
    sheetData.push(['Date', 'Type', 'Amount', 'Reason']);
    activeLoans.forEach(l => {
        sheetData.push([
            l.issuedDate,
            l.type,
            l.amount,
            l.reason
        ]);
    });
    if (activeLoans.length === 0) sheetData.push(['No active loans']);
    sheetData.push(['']);

    // 4. Attendance
    sheetData.push(['Attendance Report']);
    sheetData.push(['Date', 'In', 'Out', 'Status', 'Late By', 'Remark']);
    attendanceRecords.forEach(r => {
        const dateStr = r.date;
        sheetData.push([
            dateStr,
            r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '--',
            r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '--',
            r.status,
            r.lateByMinutes ? `${r.lateByMinutes}m` : '--',
            r.otDescription || ''
        ]);
    });

    if (user) {
        sheetData.push(['']);
        sheetData.push([`CONFIDENTIAL — ${user.role || 'System'} DATA`]);
        sheetData.push([`Downloaded by ${user.name || 'Automated'} (${user.id || 'System'}) on ${new Date().toLocaleString()}`]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column Widths
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Payout_Slip');
    XLSX.writeFile(wb, `${employee.name}_Payout_${month}.xlsx`);

    if (user) {
        useSecurityAlertsStore.getState().addAlert({
            type: 'data_export',
            severity: 'low',
            title: `Employee Payout Exported`,
            description: `${user.name || 'System'} exported payout slip for ${employee.name} (${month}) to Excel.`,
            userId: user.id || 'system',
            userName: user.name || 'System',
            metadata: { employeeName: employee.name, month, format: 'excel' }
        });
    }
};
