'use strict';
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { FnFSettlement, Employee } = require('../database');
const { addError, getErrorHint } = require('../middlewares/errorHandler');

// ── Helpers ────────────────────────────────────────────────────────────────────
function computeFnF({ employee, separationDate, noticePeriodDays, pendingLeaveDays, otherDeductions = 0 }) {
    const basicSalary = employee.basicSalary || 0;
    const perDay = basicSalary / 26;

    // Years of service (floor)
    const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null;
    const sepDate = new Date(separationDate);
    const yearsOfService = joiningDate
        ? Math.floor((sepDate - joiningDate) / (1000 * 60 * 60 * 24 * 365.25))
        : 0;

    // Gratuity: (15 * basicSalary * years) / 26 — only if ≥ 5 years
    const gratuityAmount = yearsOfService >= 5 ? Math.round((15 * basicSalary * yearsOfService) / 26) : 0;

    // Notice period pay
    const noticePeriodPay = Math.round(perDay * (noticePeriodDays || 0));

    // Leave encashment
    const leaveEncashment = Math.round(perDay * (pendingLeaveDays || 0));

    const netAmount = noticePeriodPay + gratuityAmount + leaveEncashment - otherDeductions;

    return { gratuityAmount, noticePeriodPay, leaveEncashment, otherDeductions, netAmount, yearsOfService };
}

// POST /api/fnf/calculate — compute without saving
router.post('/calculate', async (req, res) => {
    try {
        const { employeeId, separationDate, noticePeriodDays, pendingLeaveDays, otherDeductions } = req.body;
        if (!employeeId || !separationDate) return res.status(400).json({ error: 'employeeId and separationDate are required' });
        const employee = await Employee.findByPk(employeeId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        const result = computeFnF({ employee, separationDate, noticePeriodDays, pendingLeaveDays, otherDeductions });
        res.json({ ...result, basicSalary: employee.basicSalary, employeeName: employee.name });
    } catch (e) { addError(e, 'POST /api/fnf/calculate'); res.status(500).json({ error: e.message }); }
});

// POST /api/fnf — save as DRAFT
router.post('/', async (req, res) => {
    try {
        const { employeeId, separationDate, reason, noticePeriodDays, pendingLeaveDays, otherDeductions } = req.body;
        if (!employeeId || !separationDate) return res.status(400).json({ error: 'employeeId and separationDate are required' });
        const employee = await Employee.findByPk(employeeId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        const computed = computeFnF({ employee, separationDate, noticePeriodDays, pendingLeaveDays, otherDeductions });
        const record = await FnFSettlement.create({
            companyId: req.companyId || employee.companyId,
            employeeId,
            separationDate,
            reason: reason || 'OTHER',
            noticePeriodDays: noticePeriodDays || 0,
            noticePeriodPay: computed.noticePeriodPay,
            gratuityAmount: computed.gratuityAmount,
            leaveEncashment: computed.leaveEncashment,
            otherDeductions: computed.otherDeductions,
            netAmount: computed.netAmount,
            status: 'DRAFT',
            generatedBy: req.user?.name || 'System',
        });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/fnf'); res.status(500).json({ error: e.message }); }
});

// PATCH /api/fnf/:id/approve
router.patch('/:id/approve', async (req, res) => {
    try {
        const record = await FnFSettlement.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Settlement not found' });
        await record.update({ status: 'APPROVED' });
        res.json(record);
    } catch (e) { addError(e, 'PATCH /api/fnf/:id/approve'); res.status(500).json({ error: e.message }); }
});

// GET /api/fnf?employeeId=x
router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        if (req.query.employeeId) where.employeeId = req.query.employeeId;
        const records = await FnFSettlement.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(records);
    } catch (e) { addError(e, 'GET /api/fnf'); res.status(500).json({ error: e.message }); }
});

module.exports = router;
