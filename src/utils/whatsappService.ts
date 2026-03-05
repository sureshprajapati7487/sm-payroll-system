// ── WhatsApp Service ──────────────────────────────────────────────────────────
// Uses wa.me deep links — no API key required.
// Opens WhatsApp Web / App with a pre-composed message.

import { Employee } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitize phone to digits only, prepend 91 if needed */
const sanitizePhone = (phone?: string): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length > 10) return digits;
    return null;
};

/** Open WhatsApp with a message to given phone */
const openWhatsApp = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtMonth = (month: string) => {
    const [y, m] = month.split('-');
    return new Date(+y, +m - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface SlipData {
    netSalary: number;
    grossSalary: number;
    totalDeductions: number;
    presentDays: number;
    totalDays: number;
    loanDeduction: number;
    month: string;
}

interface LoanData {
    amount: number;
    emiAmount: number;
    tenureMonths: number;
    type: string;
    reason?: string;
}

// ── 1. Payslip WhatsApp ───────────────────────────────────────────────────────
export const sendPayslipWhatsApp = (
    employee: Employee,
    slip: SlipData,
    onError?: (msg: string) => void
): void => {
    const phone = sanitizePhone(employee.whatsappNumber || employee.phone);
    if (!phone) {
        (onError ?? console.warn)(`⚠️ ${employee.name} ka WhatsApp number nahi milaa. Employee Profile mein whatsappNumber set karein.`);
        return;
    }

    const message =
        `🏢 *SM Payroll System*\n` +
        `Namaste *${employee.name}* ji! 🙏\n\n` +
        `📄 *Salary Slip — ${fmtMonth(slip.month)}*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `👤 Emp Code: *${employee.code}*\n` +
        `🏬 Dept: ${employee.department || 'N/A'}\n\n` +
        `💼 Gross Salary: *${fmt(slip.grossSalary)}*\n` +
        (slip.loanDeduction > 0 ? `🏦 Loan EMI Deducted: ${fmt(slip.loanDeduction)}\n` : '') +
        `📉 Total Deductions: ${fmt(slip.totalDeductions)}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `✅ *Net Pay: ${fmt(slip.netSalary)}*\n\n` +
        `🗓 Days Worked: ${slip.presentDays}/${slip.totalDays}\n\n` +
        `Apna payslip app mein dekh sakte hain.\n` +
        `Dhanyawad! 🙏\n` +
        `_SM Payroll System_`;

    openWhatsApp(phone, message);
};

// ── 2. Loan Approved WhatsApp ─────────────────────────────────────────────────
export const sendLoanApprovalWhatsApp = (
    employee: Pick<Employee, 'name' | 'code' | 'phone' | 'whatsappNumber'>,
    loan: LoanData,
    onError?: (msg: string) => void
): void => {
    const phone = sanitizePhone(
        (employee as any).whatsappNumber || employee.phone
    );
    if (!phone) {
        (onError ?? console.warn)(`⚠️ ${employee.name} ka WhatsApp number nahi milaa.`);
        return;
    }

    const message =
        `✅ *Loan Approved!*\n\n` +
        `Namaste *${employee.name}* ji! 🙏\n\n` +
        `Aapka loan request approve ho gaya hai! 🎉\n\n` +
        `📋 *Loan Details:*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `💰 Amount: *${fmt(loan.amount)}*\n` +
        `📅 EMI: *${fmt(loan.emiAmount)}/month*\n` +
        `📆 Tenure: ${loan.tenureMonths} months\n` +
        `📝 Type: ${loan.type}\n` +
        (loan.reason ? `💬 Reason: ${loan.reason}\n` : '') +
        `━━━━━━━━━━━━━━━\n\n` +
        `Loan ka pehla EMI agle salary se katega.\n` +
        `Zyada jaankari ke liye HR se contact karein.\n\n` +
        `Dhanyawad! 🙏\n` +
        `_SM Payroll System_`;

    openWhatsApp(phone, message);
};

// ── 3. Loan Rejected WhatsApp ─────────────────────────────────────────────────
export const sendLoanRejectionWhatsApp = (
    employee: Pick<Employee, 'name' | 'code' | 'phone' | 'whatsappNumber'>,
    loan: LoanData,
    onError?: (msg: string) => void
): void => {
    const phone = sanitizePhone(
        (employee as any).whatsappNumber || employee.phone
    );
    if (!phone) {
        (onError ?? console.warn)(`⚠️ ${employee.name} ka WhatsApp number nahi milaa.`);
        return;
    }

    const message =
        `❌ *Loan Request Update*\n\n` +
        `Namaste *${employee.name}* ji,\n\n` +
        `Aapki loan request is baar approve nahi ho payi.\n\n` +
        `💰 Requested Amount: ${fmt(loan.amount)}\n` +
        (loan.reason ? `💬 Reason: ${loan.reason}\n` : '') +
        `\nZyada jaankari ya dobara apply karne ke liye\n` +
        `HR se contact karein. 🙏\n\n` +
        `_SM Payroll System_`;

    openWhatsApp(phone, message);
};

// ── 4. Bulk Payslip WhatsApp (with delay between each) ───────────────────────
export const sendBulkPayslipWhatsApp = (
    employeeSlips: { employee: Employee; slip: SlipData }[],
    onProgress?: (done: number, total: number) => void,
    onError?: (msg: string) => void,
    onConfirm?: (msg: string) => Promise<boolean>
): void => {
    if (employeeSlips.length === 0) return;

    const validSlips = employeeSlips.filter(({ employee }) =>
        sanitizePhone(employee.whatsappNumber || employee.phone)
    );

    if (validSlips.length === 0) {
        (onError ?? console.warn)('⚠️ Kisi bhi employee ka WhatsApp number registered nahi hai. Employee Profile mein whatsappNumber set karein.');
        return;
    }

    const missing = employeeSlips.length - validSlips.length;
    if (missing > 0) {
        const proceed = async () => {
            const shouldSend = onConfirm
                ? await onConfirm(`${missing} employee(on) ka WhatsApp number nahi hai. Baaki ${validSlips.length} ko bhejein?`)
                : window.confirm(`${missing} employee(on) ka WhatsApp number nahi hai.\nBaaki ${validSlips.length} ko bhejein?`);
            if (!shouldSend) return;
            validSlips.forEach(({ employee, slip }, i) => {
                setTimeout(() => {
                    sendPayslipWhatsApp(employee, slip, onError);
                    onProgress?.(i + 1, validSlips.length);
                }, i * 1500);
            });
        };
        proceed();
        return;
    }

    // Open one by one with 1.5s delay (browsers block rapid popups)
    validSlips.forEach(({ employee, slip }, i) => {
        setTimeout(() => {
            sendPayslipWhatsApp(employee, slip);
            onProgress?.(i + 1, validSlips.length);
        }, i * 1500);
    });
};

// ── 5. Attendance Alert WhatsApp ──────────────────────────────────────────────
export const sendAttendanceAlertWhatsApp = (
    employee: Pick<Employee, 'name' | 'phone' | 'whatsappNumber'>,
    date: string,
    status: string
): void => {
    const phone = sanitizePhone(
        (employee as any).whatsappNumber || employee.phone
    );
    if (!phone) return;

    const message =
        `🏢 *SM Payroll System — Attendance Alert*\n\n` +
        `Namaste *${employee.name}* ji,\n\n` +
        `Aapki aaj (${date}) attendance status:\n` +
        `📌 Status: *${status}*\n\n` +
        `Koi sawaal ho toh HR se contact karein.\n` +
        `_SM Payroll System_`;

    openWhatsApp(phone, message);
};
