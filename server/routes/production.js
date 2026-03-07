const express = require('express');
const router = express.Router();
const { Production, ProductionItem, Employee } = require('../database');
const { Op } = require('sequelize');
const { verifyToken } = require('../middleware/auth');

// All production routes require authentication
router.use(verifyToken);

// Helper for error logging (using same pattern as other routes)
const addError = (error, context) => {
    console.error(`[Production API Error] ${context}:`, error);
};

// ── 1. Production Analytics ──────────────────────────────────────────────────

router.get('/analytics', async (req, res) => {
    try {
        const { companyId, startDate, endDate, employeeId } = req.query;
        if (!companyId || !startDate || !endDate) {
            return res.status(400).json({ error: 'companyId, startDate, and endDate are required' });
        }

        const whereClause = {
            companyId,
            date: { [Op.between]: [startDate, endDate] }
        };
        if (employeeId) whereClause.employeeId = employeeId;

        // Fetch all matching entries and active employees for this company
        const [entries, employees] = await Promise.all([
            Production.findAll({ where: whereClause, raw: true }),
            Employee.findAll({ where: { companyId }, attributes: ['id', 'name', 'department'], raw: true })
        ]);

        const employeeMap = new Map();
        employees.forEach(emp => employeeMap.set(emp.id, emp));

        // 1. Employee Summary
        const empSummaryMap = new Map();
        // 2. Item Summary
        const itemSummaryMap = new Map();
        // 3. Chart Data
        const chartDataMap = new Map();

        entries.forEach(e => {
            const emp = employeeMap.get(e.employeeId) || { name: 'Unknown', department: '-' };

            // --- Employee Summary ---
            if (!empSummaryMap.has(e.employeeId)) {
                empSummaryMap.set(e.employeeId, {
                    empId: e.employeeId, name: emp.name, dept: emp.department,
                    approved: 0, pending: 0, rejected: 0, totalQty: 0, entries: 0
                });
            }
            const erow = empSummaryMap.get(e.employeeId);
            erow.totalQty += e.qty;
            erow.entries += 1;
            if (e.status === 'APPROVED') erow.approved += e.totalAmount;
            else if (e.status === 'PENDING') erow.pending += e.totalAmount;
            else erow.rejected += e.totalAmount;

            // --- Item Summary ---
            if (!itemSummaryMap.has(e.item)) {
                itemSummaryMap.set(e.item, {
                    item: e.item, totalQty: 0, approved: 0, pending: 0, rejected: 0, entries: 0,
                    topEmp: '', topEmpQty: 0, empQtyObj: {}
                });
            }
            const irow = itemSummaryMap.get(e.item);
            irow.totalQty += e.qty;
            irow.entries += 1;
            if (e.status === 'APPROVED') irow.approved += e.totalAmount;
            else if (e.status === 'PENDING') irow.pending += e.totalAmount;
            else irow.rejected += e.totalAmount;

            // Track item qty per employee
            const prevQty = irow.empQtyObj[e.employeeId] || 0;
            const nextQty = prevQty + e.qty;
            irow.empQtyObj[e.employeeId] = nextQty;
            if (nextQty > irow.topEmpQty) {
                irow.topEmpQty = nextQty;
                irow.topEmp = emp.name;
            }

            // --- Chart Data ---
            if (!chartDataMap.has(e.date)) {
                chartDataMap.set(e.date, { date: e.date, qty: 0, amount: 0, approved: 0, pending: 0 });
            }
            const crow = chartDataMap.get(e.date);
            crow.qty += e.qty;
            crow.amount += e.totalAmount;
            if (e.status === 'APPROVED') crow.approved += e.totalAmount;
            else if (e.status === 'PENDING') crow.pending += e.totalAmount;
        });

        res.json({
            employeeSummary: Array.from(empSummaryMap.values()).sort((a, b) => (b.approved + b.pending) - (a.approved + a.pending)),
            itemSummary: Array.from(itemSummaryMap.values()).sort((a, b) => (b.approved + b.pending) - (a.approved + a.pending)),
            chartData: Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
        });

    } catch (e) {
        addError(e, 'GET /api/production/analytics');
        res.status(500).json({ error: e.message });
    }
});

// ── 2. Production Entries ──────────────────────────────────────────────────

// GET all production entries (company scoped)
router.get('/', async (req, res) => {
    try {
        const { companyId } = req.query;
        const whereClause = {};
        if (companyId) whereClause.companyId = companyId;

        const entries = await Production.findAll({
            where: whereClause,
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json(entries);
    } catch (e) {
        addError(e, 'GET /api/production');
        res.status(500).json({ error: e.message });
    }
});

// POST add new production entry
router.post('/', async (req, res) => {
    try {
        const { id, companyId, employeeId, date, item, qty, rate, totalAmount, status, remarks } = req.body;

        if (!employeeId || !date || !item) {
            return res.status(400).json({ error: 'employeeId, date, and item are required' });
        }

        const newEntry = await Production.create({
            id: id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            companyId,
            employeeId,
            date,
            item,
            qty: qty || 0,
            rate: rate || 0,
            totalAmount: totalAmount || (qty * rate) || 0,
            status: status || 'PENDING',
            remarks
        });

        res.status(201).json(newEntry);
    } catch (e) {
        addError(e, 'POST /api/production');
        res.status(500).json({ error: e.message });
    }
});

// POST bulk upload production entries with partial success
router.post('/bulk', async (req, res) => {
    try {
        const { entries } = req.body;
        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'Expected an array of entries' });
        }

        const successful = [];
        const errors = [];

        for (const [index, entry] of entries.entries()) {
            try {
                if (!entry.employeeId || !entry.date || !entry.item) {
                    throw new Error('employeeId, date, and item are required');
                }

                const newEntry = await Production.create({
                    id: entry.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${index}`,
                    companyId: entry.companyId,
                    employeeId: entry.employeeId,
                    date: entry.date,
                    item: entry.item,
                    qty: entry.qty || 0,
                    rate: entry.rate || 0,
                    totalAmount: entry.totalAmount || (entry.qty * entry.rate) || 0,
                    status: entry.status || 'PENDING',
                    remarks: entry.remarks
                });
                successful.push(newEntry);
            } catch (err) {
                errors.push({ entry, error: err.message });
                addError(err, `POST /api/production/bulk - Partial Entry Failed`);
            }
        }

        res.status(207).json({
            successCount: successful.length,
            failedCount: errors.length,
            successful,
            errors
        });
    } catch (e) {
        addError(e, 'POST /api/production/bulk');
        res.status(500).json({ error: e.message });
    }
});

// PUT update production entry
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Production.findByPk(id);

        if (!entry) {
            return res.status(404).json({ error: 'Production entry not found' });
        }

        // Only update provided fields
        const updates = req.body;
        if (updates.qty !== undefined && updates.rate !== undefined && updates.totalAmount === undefined) {
            updates.totalAmount = updates.qty * updates.rate;
        }

        await entry.update(updates);
        res.json(entry);
    } catch (e) {
        addError(e, `PUT /api/production/${req.params.id}`);
        res.status(500).json({ error: e.message });
    }
});

// DELETE production entry
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Production.findByPk(id);

        if (!entry) {
            return res.status(404).json({ error: 'Production entry not found' });
        }

        await entry.destroy();
        res.json({ success: true, message: 'Production entry deleted' });
    } catch (e) {
        addError(e, `DELETE /api/production/${req.params.id}`);
        res.status(500).json({ error: e.message });
    }
});

// ── 2. Production Items / Rates ────────────────────────────────────────────

// GET all production items/rates (company scoped)
router.get('/items/all', async (req, res) => {
    try {
        const { companyId } = req.query;
        const whereClause = {};
        if (companyId) whereClause.companyId = companyId;

        const items = await ProductionItem.findAll({
            where: whereClause,
            order: [['name', 'ASC']]
        });
        res.json(items);
    } catch (e) {
        addError(e, 'GET /api/production/items/all');
        res.status(500).json({ error: e.message });
    }
});

// POST add new production item
router.post('/items/add', async (req, res) => {
    try {
        const { id, companyId, name, rate, category } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const newItem = await ProductionItem.create({
            id: id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            companyId,
            name,
            rate: rate || 0,
            category
        });

        res.status(201).json(newItem);
    } catch (e) {
        addError(e, 'POST /api/production/items/add');
        res.status(500).json({ error: e.message });
    }
});

// PUT update production item
router.put('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ProductionItem.findByPk(id);

        if (!item) {
            return res.status(404).json({ error: 'Production item not found' });
        }

        await item.update(req.body);
        res.json(item);
    } catch (e) {
        addError(e, `PUT /api/production/items/${req.params.id}`);
        res.status(500).json({ error: e.message });
    }
});

// DELETE production item
router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ProductionItem.findByPk(id);

        if (!item) {
            return res.status(404).json({ error: 'Production item not found' });
        }

        await item.destroy();
        res.json({ success: true, message: 'Production item deleted' });
    } catch (e) {
        addError(e, `DELETE /api/production/items/${req.params.id}`);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
