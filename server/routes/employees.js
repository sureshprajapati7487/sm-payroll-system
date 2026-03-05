// ── EMPLOYEE ROUTES ───────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const BCRYPT_ROUNDS = 10;

// These are injected from index.js via router setup
let Employee, addError, getErrorHint;

function init(models) {
    Employee = models.Employee;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

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

router.get('/', async (req, res) => {
    const { companyId } = req.query;
    try {
        const where = companyId ? { companyId } : {};
        res.json(await Employee.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        const pwdErr = validatePasswordStrength(data.password);
        if (pwdErr) return res.status(400).json({ error: pwdErr, fix: 'Please use a stronger password (min 8 chars, 1 number, 1 letter)' });
        if (data.password && !data.password.startsWith('$2b$')) {
            data.password = await bcrypt.hash(data.password.trim(), BCRYPT_ROUNDS);
        }
        res.json(await Employee.create(data));
    }
    catch (e) { addError(e, 'POST /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.put('/:id', async (req, res) => {
    try {
        const data = { ...req.body };
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

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Employee.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'Employee not found', why: 'No employee with this ID exists.', fix: 'Refresh the employee list and try again.' });
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (e) { addError(e, 'DELETE /api/employees/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

module.exports = { router, init };
