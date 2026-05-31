'use strict';
const express = require('express');
const router = express.Router();
const { Employee, SalarySlip, Leave, Loan, Attendance } = require('../database');
const { addError, formatError } = require('../middlewares/errorHandler');

// All ESS routes use req.user.id from JWT — employee sees only their own data

// ESS safe fields — personal profile only; no salary, bank details, or statutory config
const ESS_SAFE_ATTRIBUTES = [
    'id', 'companyId', 'code', 'name', 'email', 'phone', 'whatsappNumber',
    'department', 'designation', 'role', 'joiningDate', 'status', 'shift',
    'avatar', 'leaveBalance', 'groupId', 'reportsTo',
];

// GET /api/ess/me
router.get('/me', async (req, res) => {
    try {
        const emp = await Employee.findByPk(req.user.id, {
            attributes: ESS_SAFE_ATTRIBUTES,
        });
        if (!emp) return res.status(404).json({ error: 'Employee not found' });
        res.json(emp);
    } catch (e) { addError(e, 'GET /api/ess/me'); res.status(500).json(formatError(e)); }
});

// GET /api/ess/payslips
router.get('/payslips', async (req, res) => {
    try {
        const slips = await SalarySlip.findAll({
            where: { employeeId: req.user.id },
            order: [['month', 'DESC']],
            limit: 24,
        });
        res.json(slips);
    } catch (e) { addError(e, 'GET /api/ess/payslips'); res.status(500).json(formatError(e)); }
});

// GET /api/ess/leaves
router.get('/leaves', async (req, res) => {
    try {
        const leaves = await Leave.findAll({
            where: { employeeId: req.user.id },
            order: [['appliedOn', 'DESC']],
        });
        res.json(leaves);
    } catch (e) { addError(e, 'GET /api/ess/leaves'); res.status(500).json(formatError(e)); }
});

// POST /api/ess/leaves — apply for leave
router.post('/leaves', async (req, res) => {
    try {
        const data = {
            ...req.body,
            employeeId: req.user.id,
            companyId: req.user.companyId,
            status: 'PENDING',
            appliedOn: new Date().toISOString().split('T')[0],
        };
        const leave = await Leave.create(data);
        res.status(201).json(leave);
    } catch (e) { addError(e, 'POST /api/ess/leaves'); res.status(500).json(formatError(e)); }
});

// GET /api/ess/loans
router.get('/loans', async (req, res) => {
    try {
        const loans = await Loan.findAll({
            where: { employeeId: req.user.id },
            order: [['createdAt', 'DESC']],
        });
        res.json(loans);
    } catch (e) { addError(e, 'GET /api/ess/loans'); res.status(500).json(formatError(e)); }
});

// POST /api/ess/loans — request a loan (validates against employee's configured loan limit)
router.post('/loans', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'A positive loan amount is required' });
        }

        // Enforce loanLimit — fetch employee's limit from the DB
        const emp = await Employee.findByPk(req.user.id, { attributes: ['id', 'loanLimit', 'loanLimitType'] });
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const loanLimit = emp.loanLimit ?? null;
        if (loanLimit !== null && Number(amount) > loanLimit) {
            return res.status(422).json({
                error: `Requested amount ₹${Number(amount).toLocaleString('en-IN')} exceeds your loan limit of ₹${loanLimit.toLocaleString('en-IN')}`,
                loanLimit,
            });
        }

        const data = {
            ...req.body,
            amount: Number(amount),
            employeeId: req.user.id,
            companyId: req.user.companyId,
            status: 'REQUESTED',
        };
        const loan = await Loan.create(data);
        res.status(201).json(loan);
    } catch (e) { addError(e, 'POST /api/ess/loans'); res.status(500).json(formatError(e)); }
});

// GET /api/ess/attendance — last 30 days
router.get('/attendance', async (req, res) => {
    try {
        const records = await Attendance.findAll({
            where: { employeeId: req.user.id },
            order: [['date', 'DESC']],
            limit: 30,
        });
        res.json(records);
    } catch (e) { addError(e, 'GET /api/ess/attendance'); res.status(500).json(formatError(e)); }
});

module.exports = router;
