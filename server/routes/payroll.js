// ── PAYROLL + LOANS + LEAVES + PRODUCTION ROUTES ──────────────────────────────
const express = require('express');
const router = express.Router();

let Production, Leave, Loan, SalarySlip, addError, getErrorHint;

function init(models) {
    Production = models.Production;
    Leave = models.Leave;
    Loan = models.Loan;
    SalarySlip = models.SalarySlip;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// ── Production ────────────────────────────────────────────────────────────────
router.get('/production', async (req, res) => {
    const { companyId, employeeId } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        res.json(await Production.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/production'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/production', async (req, res) => {
    try { res.json(await Production.create(req.body)); }
    catch (e) { addError(e, 'POST /api/production'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/production/:id', async (req, res) => {
    try { await Production.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/production/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/production/:id', async (req, res) => {
    try { await Production.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/production/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Leaves ────────────────────────────────────────────────────────────────────
router.get('/leaves', async (req, res) => {
    const { companyId, employeeId, status } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Leave.findAll({ where, order: [['appliedOn', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/leaves', async (req, res) => {
    try { res.json(await Leave.create(req.body)); }
    catch (e) { addError(e, 'POST /api/leaves'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/leaves/:id', async (req, res) => {
    try {
        await Leave.update(req.body, { where: { id: req.params.id } });
        const updated = await Leave.findOne({ where: { id: req.params.id } });
        res.json(updated);
    } catch (e) { addError(e, 'PUT /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/leaves/:id', async (req, res) => {
    try { await Leave.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/leaves/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Loans ─────────────────────────────────────────────────────────────────────
router.get('/loans', async (req, res) => {
    const { companyId, employeeId, status } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        res.json(await Loan.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/loans', async (req, res) => {
    try { res.json(await Loan.create(req.body)); }
    catch (e) { addError(e, 'POST /api/loans'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/loans/:id', async (req, res) => {
    try { await Loan.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/loans/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Payroll ───────────────────────────────────────────────────────────────────
router.get('/payroll', async (req, res) => {
    const { companyId, month, employeeId } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (month) where.month = month;
        if (employeeId) where.employeeId = employeeId;
        res.json(await SalarySlip.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/payroll', async (req, res) => {
    try { const slip = await SalarySlip.upsert(req.body); res.json(slip); }
    catch (e) { addError(e, 'POST /api/payroll'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.get('/payroll/:id', async (req, res) => {
    try {
        const slip = await SalarySlip.findOne({ where: { id: req.params.id } });
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        res.json(slip);
    } catch (e) { addError(e, 'GET /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.put('/payroll/:id', async (req, res) => {
    try { await SalarySlip.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/payroll/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

module.exports = { router, init };
