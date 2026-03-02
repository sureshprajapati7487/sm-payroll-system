import { LoanRecord, Employee } from '@/types';

export const generateApprovalMessage = (loan: LoanRecord, employee?: Employee) => {
    // 1. Base URL for Action Links (Simulating a deployed environment or local)
    // 1. Base URL: Use 127.0.0.1 instead of localhost so WhatsApp recognizes it as a Link [Clickable]
    let baseUrl = window.location.origin;
    if (baseUrl.includes('localhost')) {
        baseUrl = baseUrl.replace('localhost', '127.0.0.1');
    }

    // 2. Short Action Links (Clean URL)
    const approveLink = `${baseUrl}/go/approve/${loan.id}`;
    const rejectLink = `${baseUrl}/go/reject/${loan.id}`;

    // 4. Message Construction (Simplified for Clickability)
    const message = `
*SM Payroll Request*

👤 ${employee?.name || 'Unknown'}
💰 ₹${loan.amount.toLocaleString()}
📝 ${loan.reason}

*Approve:*
${approveLink}

*Reject:*
${rejectLink}
`.trim();

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
