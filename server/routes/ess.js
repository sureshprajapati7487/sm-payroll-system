'use strict';
const express = require('express');
const router = express.Router();
const { Employee, SalarySlip, Leave, Loan, Attendance } = require('../database');
const { addError, formatError } = require('../middlewares/errorHandler');

// All ESS routes use req.user.id from JWT — employee sees only their own data

// GET /api/ess/me
router.get('/me', async (req, res) => {
    try {
        const emp = await Employee.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
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

// POST /api/ess/loans — request a loan
router.post('/loans', async (req, res) => {
    try {
        const data = {
            ...req.body,
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
