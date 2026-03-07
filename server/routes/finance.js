const express = require('express');
const router = express.Router();
const { AdvanceSalary } = require('../database');
const { requireRole } = require('../rbac');

const getErrorHint = (err) => {
    if (!err) return { why: 'Unknown error occurred', fix: 'Check server logs for details' };
    const msg = typeof err === 'string' ? err : (err.message || String(err));
    if (msg.includes('SQLITE_BUSY')) return { why: 'Database is currently locked', fix: 'Try again in a few seconds' };
    if (msg.includes('UNIQUE constraint failed')) return { why: 'A record with this identifier already exists', fix: 'Use a different identifier' };
    return { why: 'An unexpected database error occurred', fix: 'Contact support if this persists' };
};

// GET /api/finance/advances?companyId=XYZ
router.get('/advances', async (req, res) => {
    try {
        const companyId = req.query.companyId;
        const where = companyId ? { companyId } : {};
        const advances = await AdvanceSalary.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(advances);
    } catch (e) {
        const hint = getErrorHint(e);
        res.status(500).json({ error: e.message, why: hint.why, fix: hint.fix });
    }
});

// POST /api/finance/advances
router.post('/advances', async (req, res) => {
    try {
        // Validate
        const { id, companyId, employeeId, employeeName, amount, reason, requestDate, installments } = req.body;
        if (!employeeId || !amount) {
            return res.status(400).json({ error: 'employeeId and amount are required' });
        }

        const advance = await AdvanceSalary.create({
            id: id || Math.random().toString(36).substr(2, 9),
            companyId,
            employeeId,
            employeeName,
            amount,
            reason,
            requestDate: requestDate || new Date().toISOString(),
            status: 'pending',
            installments: installments || 3,
            monthlyDeduction: 0,
            remainingBalance: amount
        });

        res.status(201).json(advance);
    } catch (e) {
        const hint = getErrorHint(e);
        res.status(500).json({ error: e.message, why: hint.why, fix: hint.fix });
    }
});

// PATCH /api/finance/advances/:id/approve
router.patch('/advances/:id/approve', requireRole(['SUPER_ADMIN', 'ADMIN', 'HR']), async (req, res) => {
    try {
        const { approvedBy } = req.body;
        const advance = await AdvanceSalary.findOne({ where: { id: req.params.id } });
        if (!advance) return res.status(404).json({ error: 'Advance request not found' });

        if (advance.status !== 'pending') {
            return res.status(400).json({ error: `Cannot approve advance with status ${advance.status}` });
        }

        const deduction = Math.round(advance.amount / (advance.installments || 1));

        await advance.update({
            status: 'approved',
            approvedBy: approvedBy || 'Admin',
            approvedDate: new Date().toISOString(),
            monthlyDeduction: deduction,
            remainingBalance: advance.amount // Balance starts full upon approval
        });

        res.json(advance);
    } catch (e) {
        const hint = getErrorHint(e);
        res.status(500).json({ error: e.message, why: hint.why, fix: hint.fix });
    }
});

// PATCH /api/finance/advances/:id/reject
router.patch('/advances/:id/reject', requireRole(['SUPER_ADMIN', 'ADMIN', 'HR']), async (req, res) => {
    try {
        const advance = await AdvanceSalary.findOne({ where: { id: req.params.id } });
        if (!advance) return res.status(404).json({ error: 'Advance request not found' });

        if (advance.status !== 'pending') {
            return res.status(400).json({ error: `Cannot reject advance with status ${advance.status}` });
        }

        await advance.update({
            status: 'rejected'
        });

        res.json(advance);
    } catch (e) {
        const hint = getErrorHint(e);
        res.status(500).json({ error: e.message, why: hint.why, fix: hint.fix });
    }
});

// DELETE /api/finance/advances/:id
router.delete('/advances/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const advance = await AdvanceSalary.findOne({ where: { id: req.params.id } });
        if (!advance) return res.status(404).json({ error: 'Advance request not found' });

        await advance.destroy();
        res.json({ success: true });
    } catch (e) {
        const hint = getErrorHint(e);
        res.status(500).json({ error: e.message, why: hint.why, fix: hint.fix });
    }
});


module.exports = router;
