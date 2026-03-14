// ── EMPLOYEE ROUTES ───────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { requireRole } = require('../rbac');
const BCRYPT_ROUNDS = 10;

// These are injected from index.js via router setup
let Employee, Biometric, addError, getErrorHint;

function init(models) {
    Employee = models.Employee;
    Biometric = models.Biometric;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// ── Face Distance Calculator ──────────────────────────────────────────────────
function euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}
const MATCH_THRESHOLD = 0.52;

// ── Password strength check (server-side backup to frontend) ────────────────────
function validatePasswordStrength(password) {
    if (!password) return null; // optional field — no password is OK
    if (password.startsWith('$2b$') || password.startsWith('$2a$')) return null; // already hashed
    const p = password.trim();
    if (p.length < 8) return 'Password min 8 characters hona chahiye';
    if (!/[0-9]/.test(p)) return 'Password mein at least 1 number hona chahiye';
    if (!/[a-zA-Z]/.test(p)) return 'Password mein at least 1 letter hona chahiye';
    if (/\s/.test(p)) return 'Password mein spaces nahi hone chahiye';
    return null; // valid
}
const { Op } = require('sequelize');

router.get('/', async (req, res) => {
    const { page, limit, search, status, department, shift } = req.query;
    try {
        // req.companyId is set by requireCompanyScope middleware from JWT — tamper-proof
        const where = req.companyId ? { companyId: req.companyId } : {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { code: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        // Filters
        if (status && status !== 'All') {
            where.status = status;
        }
        // Note: No longer hiding INACTIVE by default — show all employees,
        // let the frontend filter panel control what's visible.
        if (department && department !== 'All') where.department = department;
        if (shift && shift !== 'All') where.shift = shift;

        // Check if pagination is requested
        if (page && limit) {
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 50;
            const offset = (pageNum - 1) * limitNum;

            const { count, rows } = await Employee.findAndCountAll({
                where,
                limit: limitNum,
                offset,
                order: [['createdAt', 'DESC']]
            });

            return res.json({
                data: rows,
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(count / limitNum)
            });
        }

        // Fallback to all
        res.json(await Employee.findAll({ where, order: [['createdAt', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const data = { ...req.body };

        // RBAC: Strip financial info if user lacks VIEW_SALARY permission equivalent
        const canManageFinancials = req.user && ['SUPER_ADMIN', 'ACCOUNT_ADMIN'].includes(req.user.role);
        if (!canManageFinancials) {
            delete data.basicSalary;
            delete data.salaryType;
            delete data.bankDetails;
            delete data.statutoryConfig;
        }

        const pwdErr = validatePasswordStrength(data.password);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Please use a stronger password (min 8 chars, 1 number, 1 letter)' });
        if (data.password && !data.password.startsWith('$2b$')) {
            data.password = await bcrypt.hash(data.password.trim(), BCRYPT_ROUNDS);
        }
        res.json(await Employee.create(data));
    }
    catch (e) { addError(e, 'POST /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER']), async (req, res) => {
    try {
        // Cross-tenant ownership check
        if (req.companyId) {
            const existing = await Employee.findOne({ where: { id: req.params.id } });
            if (!existing) return res.status(404).json({ error: 'Employee not found' });
            if (existing.companyId !== req.companyId) {
                return res.status(403).json({ error: 'Forbidden — cannot modify another company\'s employee' });
            }
        }

        const data = { ...req.body };

        // RBAC: Strip financial info if user lacks VIEW_SALARY permission equivalent
        const canManageFinancials = req.user && ['SUPER_ADMIN', 'ACCOUNT_ADMIN'].includes(req.user.role);
        if (!canManageFinancials) {
            delete data.basicSalary;
            delete data.salaryType;
            delete data.bankDetails;
            delete data.statutoryConfig;
        }

        const pwdErr = validatePasswordStrength(data.password);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Please use a stronger password (min 8 chars, 1 number, 1 letter)' });
        if (data.password && !data.password.startsWith('$2b$')) {
            data.password = await bcrypt.hash(data.password.trim(), BCRYPT_ROUNDS);
        }
        await Employee.update(data, { where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (e) { addError(e, 'PUT /api/employees/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// PATCH /employees/:id/change-password
router.patch('/:id/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword aur newPassword dono required hain' });
        }
        const emp = await Employee.findOne({ where: { id: req.params.id } });
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const stored = emp.password || '';
        let currentValid = false;
        if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
            currentValid = await bcrypt.compare(currentPassword.trim(), stored);
        } else {
            currentValid = stored.trim() === currentPassword.trim();
        }
        if (!currentValid) return res.status(401).json({ error: 'Current password galat hai', fix: 'Apna current password sahi se enter karein' });

        const pwdErr = validatePasswordStrength(newPassword);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Stronger password use karein (min 8 chars, 1 number, 1 letter)' });
        if (currentPassword.trim() === newPassword.trim()) {
            return res.status(400).json({ error: 'New password old password se alag hona chahiye' });
        }
        const hashed = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
        await Employee.update({ password: hashed }, { where: { id: req.params.id } });
        res.json({ success: true, message: 'Password successfully updated!' });
    } catch (e) {
        addError(e, 'PATCH /api/employees/:id/change-password');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        // Cross-tenant ownership check before soft-delete
        if (req.companyId) {
            const existing = await Employee.findOne({ where: { id: req.params.id } });
            if (!existing) return res.status(404).json({ error: 'Employee not found', why: 'No employee with this ID exists.', fix: 'Refresh the employee list and try again.' });
            if (existing.companyId !== req.companyId) {
                return res.status(403).json({ error: 'Forbidden — cannot delete another company\'s employee' });
            }
        }
        // Soft delete: update status to INACTIVE instead of destroy()
        await Employee.update({ status: 'INACTIVE' }, { where: { id: req.params.id } });
        res.json({ success: true, message: 'Employee deactivated successfully (Soft Deleted)' });
    } catch (e) { addError(e, 'DELETE /api/employees/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// POST /verify-face (Server-side Face Matching)
router.post('/verify-face', async (req, res) => {
    try {
        const { descriptor } = req.body;
        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ error: 'Valid face descriptor array is required' });
        }

        const biometrics = await Biometric.findAll();
        let bestMatch = null;
        let minDistance = Infinity;

        for (const record of biometrics) {
            if (record.faceDescriptor) {
                const dist = euclideanDistance(descriptor, record.faceDescriptor);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatch = record.employeeId;
                }
            }
        }

        if (bestMatch && minDistance <= MATCH_THRESHOLD) {
            return res.json({ matched: true, employeeId: bestMatch, distance: minDistance });
        } else {
            return res.json({ matched: false, distance: minDistance });
        }
    } catch (e) {
        addError(e, 'POST /api/employees/verify-face');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

module.exports = { router, init };
