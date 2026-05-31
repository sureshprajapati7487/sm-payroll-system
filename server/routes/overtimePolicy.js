'use strict';
const express = require('express');
const router = express.Router();
const { OvertimePolicy } = require('../database');
const { addError } = require('../middlewares/errorHandler');

router.get('/', async (req, res) => {
    try {
        const where = req.companyId ? { companyId: req.companyId } : {};
        res.json(await OvertimePolicy.findAll({ where, order: [['effectiveFrom', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/overtime-policy'); res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.companyId) data.companyId = req.companyId;
        res.status(201).json(await OvertimePolicy.create(data));
    } catch (e) { addError(e, 'POST /api/overtime-policy'); res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const policy = await OvertimePolicy.findByPk(req.params.id);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });
        await policy.update(req.body);
        res.json(policy);
    } catch (e) { addError(e, 'PUT /api/overtime-policy/:id'); res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const policy = await OvertimePolicy.findByPk(req.params.id);
        if (!policy) return res.status(404).json({ error: 'Policy not found' });
        await policy.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/overtime-policy/:id'); res.status(500).json({ error: e.message }); }
});

module.exports = router;
