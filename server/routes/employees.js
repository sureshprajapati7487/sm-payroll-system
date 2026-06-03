// ── EMPLOYEE ROUTES ───────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../rbac');
const { formatError } = require('../middlewares/errorHandler');
const BCRYPT_ROUNDS = 10;

// ── Multer — local disk storage under server/uploads/{employeeId}/ ─────────────
const docStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safe}`);
    },
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 } });

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
    const { search, status, department, shift } = req.query;
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

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const { count, rows } = await Employee.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        res.json({
            data: rows,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        });
    } catch (e) { addError(e, 'GET /api/employees'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const data = { ...req.body };

        // Always enforce companyId from JWT (prevents cross-tenant employee creation)
        if (req.companyId) data.companyId = req.companyId;

        // RBAC: Reject financial fields if user lacks salary management permission
        const canManageFinancials = req.user && ['SUPER_ADMIN', 'ACCOUNT_ADMIN'].includes(req.user.role);
        const FINANCIAL_FIELDS = ['basicSalary', 'salaryType', 'bankDetails', 'statutoryConfig'];
        const attemptedFinancialFields = FINANCIAL_FIELDS.filter(f => data[f] !== undefined);
        if (!canManageFinancials && attemptedFinancialFields.length > 0) {
            return res.status(403).json({
                error: 'You do not have permission to set salary or bank details.',
                fields: attemptedFinancialFields,
                fix: 'Only SUPER_ADMIN or ACCOUNT_ADMIN can manage financial data.',
            });
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

        // RBAC: Reject financial fields if user lacks salary management permission
        const canManageFinancials = req.user && ['SUPER_ADMIN', 'ACCOUNT_ADMIN'].includes(req.user.role);
        const FINANCIAL_FIELDS = ['basicSalary', 'salaryType', 'bankDetails', 'statutoryConfig'];
        const attemptedFinancialFields = FINANCIAL_FIELDS.filter(f => data[f] !== undefined);
        if (!canManageFinancials && attemptedFinancialFields.length > 0) {
            return res.status(403).json({
                error: 'You do not have permission to modify salary or bank details.',
                fields: attemptedFinancialFields,
                fix: 'Only SUPER_ADMIN or ACCOUNT_ADMIN can manage financial data.',
            });
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
// Employees can only change their OWN password. ADMIN+ can change anyone's in their company.
router.patch('/:id/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword aur newPassword dono required hain' });
        }
        const requestingUser = req.user;
        const isAdminRole = requestingUser && ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN'].includes(requestingUser.role);
        const isSelf = requestingUser && requestingUser.id === req.params.id;
        if (!isAdminRole && !isSelf) {
            return res.status(403).json({ error: 'Forbidden — aap sirf apna password change kar sakte hain' });
        }
        const emp = await Employee.findOne({ where: { id: req.params.id } });
        if (!emp) return res.status(404).json({ error: 'Employee not found' });
        // Cross-tenant check
        if (req.companyId && emp.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Forbidden — cannot modify another company\'s employee' });
        }

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

// ── P2-03: Document upload / list ─────────────────────────────────────────────
router.post('/:id/documents', uploadDoc.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const emp = await Employee.findByPk(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const existing = Array.isArray(emp.documents) ? emp.documents : [];
        const newDoc = {
            filename: req.file.originalname,
            storedAs: req.file.filename,
            uploadedAt: new Date().toISOString(),
            size: req.file.size,
            url: `/api/employees/${req.params.id}/documents/${req.file.filename}`,
        };
        emp.documents = [...existing, newDoc];
        emp.changed('documents', true);
        await emp.save();
        res.status(201).json(newDoc);
    } catch (e) { addError(e, 'POST /api/employees/:id/documents'); res.status(500).json(formatError(e)); }
});

router.get('/:id/documents', async (req, res) => {
    try {
        const emp = await Employee.findByPk(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Employee not found' });
        res.json(Array.isArray(emp.documents) ? emp.documents : []);
    } catch (e) { addError(e, 'GET /api/employees/:id/documents'); res.status(500).json(formatError(e)); }
});

router.get('/:id/documents/:filename', async (req, res) => {
    try {
        // Look up the stored filename from DB — never trust the URL param directly
        const emp = await Employee.findByPk(req.params.id);
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const docs = Array.isArray(emp.documents) ? emp.documents : [];
        // Match the requested filename against the storedAs field in DB records only
        const doc = docs.find(d => d.storedAs === req.params.filename);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Use path.basename as an extra guard — strips any remaining directory components
        const safeFilename = path.basename(doc.storedAs);
        const filePath = path.join(__dirname, '..', 'uploads', req.params.id, safeFilename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
        res.sendFile(filePath);
    } catch (e) { addError(e, 'GET /api/employees/:id/documents/:filename'); res.status(500).json(formatError(e)); }
});

module.exports = { router, init };
