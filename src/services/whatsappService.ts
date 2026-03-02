// whatsappService.ts — WhatsApp Cloud API integration via server proxy
// Uses Meta's WhatsApp Business Cloud API (v19.0)
// Credentials are stored/proxied server-side; never in browser localStorage

import { API_URL } from '@/lib/apiConfig';

export type WATplName =
    | 'payslip_generated'
    | 'loan_approval_request'
    | 'loan_approved'
    | 'loan_rejected'
    | 'leave_approved'
    | 'leave_rejected'
    | 'punch_reminder'
    | 'custom';

export interface WAMessage {
    to: string;          // E.164 format, e.g. "919876543210"
    type: 'text' | 'template';
    text?: string;       // for type='text'
    template?: {
        name: WATplName | string;
        language: string;           // e.g. "en_US"
        components?: WAComponent[];
    };
}

export interface WAComponent {
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: 'text'; text: string }>;
}

export interface WASendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ── Normalise phone number to E.164 format (assumes India +91) ────────────────
function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
}

// ── Send via server proxy (keeps WABA token secure) ───────────────────────────
export async function sendWhatsApp(msg: WAMessage): Promise<WASendResult> {
    try {
        const res = await fetch(`${API_URL}/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...msg, to: normalisePhone(msg.to) }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Server error' };
        return { success: true, messageId: data.messageId };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ── Pre-built notification senders ────────────────────────────────────────────

export async function waNotifyPayslipReady(phone: string, empName: string, month: string, netPay: number) {
    return sendWhatsApp({
        to: phone,
        type: 'text',
        text: `📄 *SM PAYROLL* — Payslip Ready!\n\nHello *${empName}*,\nYour salary slip for *${month}* has been generated.\n💰 Net Pay: *₹${netPay.toLocaleString('en-IN')}*\n\nLogin to SM Payroll to view/download your payslip.`,
    });
}

export async function waNotifyLoanRequest(adminPhone: string, empName: string, amount: number, reason: string) {
    return sendWhatsApp({
        to: adminPhone,
        type: 'text',
        text: `🔔 *SM PAYROLL* — Loan Request\n\n*${empName}* has applied for a loan.\n💵 Amount: *₹${amount.toLocaleString('en-IN')}*\n📝 Reason: ${reason}\n\nPlease login to approve or reject.`,
    });
}

export async function waNotifyLoanDecision(phone: string, empName: string, approved: boolean, amount: number, remarks?: string) {
    const icon = approved ? '✅' : '❌';
    const word = approved ? 'APPROVED' : 'REJECTED';
    return sendWhatsApp({
        to: phone,
        type: 'text',
        text: `${icon} *SM PAYROLL* — Loan ${word}\n\nHello *${empName}*,\nYour loan request of *₹${amount.toLocaleString('en-IN')}* has been *${word}*.\n${remarks ? `📝 Remarks: ${remarks}` : ''}\n\nFor queries, contact HR.`,
    });
}

export async function waNotifyLeaveDecision(phone: string, empName: string, approved: boolean, leaveType: string, dates: string, remarks?: string) {
    const icon = approved ? '✅' : '❌';
    const word = approved ? 'APPROVED' : 'REJECTED';
    return sendWhatsApp({
        to: phone,
        type: 'text',
        text: `${icon} *SM PAYROLL* — Leave ${word}\n\nHello *${empName}*,\nYour *${leaveType}* leave for *${dates}* has been *${word}*.\n${remarks ? `📝 Remarks: ${remarks}` : ''}\n\nHave a great day!`,
    });
}

export async function waNotifyPunchReminder(phone: string, empName: string) {
    return sendWhatsApp({
        to: phone,
        type: 'text',
        text: `⏰ *SM PAYROLL* — Punch Reminder\n\nHello *${empName}*,\nYou have not punched in today. Please mark your attendance.\n\nThis is an automated reminder.`,
    });
}

export async function waSendCustom(phone: string, message: string) {
    return sendWhatsApp({ to: phone, type: 'text', text: message });
}
