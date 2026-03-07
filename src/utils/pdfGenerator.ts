import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-ignore
import numWords from 'num-words';

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// Deleted WatermarkOptions

// Draw diagonal watermark
const applyWatermark = (doc: jsPDF, text: string) => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(40);
        // Save graphics state
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        // Math magic to center and rotate text 45 deg
        doc.text(text, pw / 2, ph / 2, {
            angle: 45,
            align: 'center',
            baseline: 'middle'
        });
        doc.restoreGraphicsState();
    }
};

export const generatePayslipPDF = async (
    employeeData: Record<string, any>,
    month: string,
    year: number
): Promise<Blob> => {
    return new Promise((resolve) => {
        const doc = new jsPDF();

        // --- Header ---
        doc.setFontSize(22);
        doc.setTextColor(0, 51, 102);
        doc.text("SM PAYROLL SYSTEM", 105, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        doc.text("Salary Slip / Payslip", 105, 30, { align: "center" });

        doc.setFontSize(11);
        doc.text(`For the Month of: ${month} ${year}`, 105, 38, { align: "center" });

        doc.setLineWidth(0.5);
        doc.line(14, 42, 196, 42);

        // --- Employee Details ---
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        const emp = employeeData;
        const startY = 50;

        doc.text(`Employee Name: ${emp.name || 'N/A'}`, 14, startY);
        doc.text(`Employee ID: ${emp.id || emp.code || 'N/A'}`, 120, startY);
        doc.text(`Designation: ${emp.designation || 'N/A'}`, 14, startY + 8);
        doc.text(`Department: ${emp.department || 'General'}`, 120, startY + 8);
        doc.text(`Total Days in Month: ${emp.totalDays || 30}`, 14, startY + 16);
        doc.text(`Days Present/Paid: ${emp.paidDays || emp.presentDays || 'N/A'}`, 120, startY + 16);

        // --- Earnings and Deductions Table ---
        const salaryInfo = emp.salaryStatus || emp; // Support different data shapes
        const grossSalary = salaryInfo.grossSalary || salaryInfo.baseSalary || 0;
        const deductions = salaryInfo.totalDeductions || salaryInfo.deductions || 0;
        const netSalary = salaryInfo.netSalary || salaryInfo.netPayable || 0;
        const tds = salaryInfo.tds || 0;
        const advanceLoan = salaryInfo.loanDeduction || salaryInfo.advanceDeduction || 0;

        autoTable(doc, {
            startY: startY + 25,
            head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
            body: [
                ['Basic Salary', formatCurrency(grossSalary), 'TDS / Taxes', formatCurrency(tds)],
                ['Allowances', formatCurrency(salaryInfo.allowances || 0), 'Advance / Loan', formatCurrency(advanceLoan)],
                ['Overtime', formatCurrency(salaryInfo.overtimePay || 0), 'Unpaid Leave Deductions', formatCurrency(salaryInfo.unpaidLeaveDeductions || salaryInfo.leaveDeductions || 0)],
                ['Incentives', formatCurrency(salaryInfo.incentives || 0), 'Other Deductions', formatCurrency(salaryInfo.otherDeductions || 0)],
            ],
            foot: [
                ['Total Earnings', formatCurrency(grossSalary + (salaryInfo.allowances || 0) + (salaryInfo.overtimePay || 0) + (salaryInfo.incentives || 0)), 'Total Deductions', formatCurrency(deductions)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { top: 10 }
        });

        // --- Net Payable ---
        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Net Salary Payable: ${formatCurrency(netSalary)}`, 14, finalY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Amount in words: ' + numWords(netSalary).toUpperCase() + ' RUPEES ONLY', 14, finalY + 8);

        // --- Signatures ---
        const sigY = finalY + 40;
        doc.setLineWidth(0.3);
        doc.line(14, sigY, 60, sigY);
        doc.text("Employee Signature", 14, sigY + 5);

        doc.line(140, sigY, 196, sigY);
        doc.text("Authorized Signatory\n(HR Manager)", 140, sigY + 5);

        // --- Footer ---
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("This is a computer generated document and does not require a physical signature.", 105, 280, { align: "center" });

        // Add Watermark
        applyWatermark(doc, "SM INDUSTRIES - CONFIDENTIAL");

        const pdfOutput = doc.output('blob');
        resolve(pdfOutput);
    });
};

export const generateForm16PDF = async (
    employeeData: Record<string, any>,
    financialYear: string
): Promise<Blob> => {
    return new Promise((resolve) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Form 16 - FY ${financialYear}`, 14, 20);
        doc.setFontSize(12);
        doc.text(`Employee: ${employeeData.name || 'N/A'}`, 14, 30);
        doc.text(`Income Tax Rules 1962`, 14, 40);

        applyWatermark(doc, `FORM 16 - ${financialYear}`);

        const pdfOutput = doc.output('blob');
        resolve(pdfOutput);
    });
};

// Download helper
export const downloadPDF = (pdfBlob: Blob, filename: string) => {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Email PDF helper
export const emailPDF = async (
    pdfBlob: Blob,
    recipients: string[],
    subject: string,
    _body: string
): Promise<boolean> => {
    console.log('Sending PDF to:', recipients);
    console.log('Subject:', subject);
    console.log('PDF Size:', pdfBlob.size, 'bytes');

    return new Promise((resolve) => {
        setTimeout(() => resolve(true), 500);
    });
};
