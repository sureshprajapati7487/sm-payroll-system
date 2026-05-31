'use strict';
const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');
const { SalarySlip, Employee, Company } = require('../database');
const { addError, getErrorHint } = require('../middlewares/errorHandler');

// POST /api/notifications/send-payslip
// Body: { employeeId, month, email? }
router.post('/send-payslip', async (req, res) => {
    const { employeeId, month, email: bodyEmail } = req.body || {};
    if (!employeeId || !month) {
        return res.status(400).json({ error: 'employeeId and month are required' });
    }
    try {
        // Find the salary slip
        const where = { employeeId, month };
        if (req.companyId) where.companyId = req.companyId;
        const slip = await SalarySlip.findOne({ where });
        if (!slip) return res.status(404).json({ error: 'No payslip found for this period' });

        // Resolve recipient email
        const emp = await Employee.findOne({ where: { id: employeeId } });
        const to = bodyEmail || emp?.email;
        if (!to) return res.status(400).json({ error: 'No email address for this employee' });

        // Resolve company name
        let companyName = 'Your Company';
        if (req.companyId) {
            const company = await Company.findOne({ where: { id: req.companyId } });
            if (company?.name) companyName = company.name;
        }

        // Build HTML email body
        const html = `
<h2>Payslip for ${month}</h2>
<p>Dear ${emp?.name || employeeId},</p>
<table style="border-collapse:collapse;width:100%">
  <tr><td style="padding:8px;border:1px solid #ccc">Gross Salary</td><td style="padding:8px;border:1px solid #ccc">₹${(slip.grossSalary || 0).toFixed(2)}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ccc">PF Deduction</td><td style="padding:8px;border:1px solid #ccc">₹${(slip.pfDeduction || 0).toFixed(2)}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ccc">TDS</td><td style="padding:8px;border:1px solid #ccc">₹${(slip.taxDeduction || 0).toFixed(2)}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ccc">Other Deductions</td><td style="padding:8px;border:1px solid #ccc">₹${(slip.otherDeduction || 0).toFixed(2)}</td></tr>
  <tr><td style="padding:8px;border:1px solid #ccc"><b>Net Pay</b></td><td style="padding:8px;border:1px solid #ccc"><b>₹${(slip.netSalary || 0).toFixed(2)}</b></td></tr>
</table>`;

        const subject = `Your Payslip for ${month} — ${companyName}`;
        const result = await sendEmail(to, subject, html);

        // Dev fallback: emailService returns { simulated: true } when SMTP not configured
        if (result?.simulated) {
            return res.json({ success: false, reason: 'Email not configured' });
        }

        res.json({ success: true, sentTo: to });
    } catch (e) {
        addError(e, 'POST /api/notifications/send-payslip');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

module.exports = router;
