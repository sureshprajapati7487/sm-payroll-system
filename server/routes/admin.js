// ── ADMIN ROUTES: Audit Logs + Backup + WhatsApp + Biometrics + Expenses + AdvanceSalary + Holidays ──
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireRole } = require('../rbac');

let Department, Shift, WorkGroup, SalaryType, AttendanceAction, PunchLocation, SystemSetting, SystemKey, Employee, Biometric, Expense, AdvanceSalary, Holiday, AuditLog, UserSession, IPRestriction, Attendance, Production, Loan, SalarySlip, StatutoryRule, addError, getErrorHint;
let _doBackup, _getBackupStatus, _setAutoBackupEnabled, _getBackupConfig, _updateBackupConfig;

const WA_CONFIG_FILE = path.join(__dirname, '..', 'whatsapp_config.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function loadWAConfig() {
    try { return JSON.parse(fs.readFileSync(WA_CONFIG_FILE, 'utf-8')); }
    catch { return { enabled: false, phoneNumberId: '', wabaToken: '', businessName: '' }; }
}
function saveWAConfig(cfg) { fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

function init(models) {
    Department = models.Department;
    Shift = models.Shift;
    WorkGroup = models.WorkGroup;
    SalaryType = models.SalaryType;
    AttendanceAction = models.AttendanceAction;
    PunchLocation = models.PunchLocation;
    SystemSetting = models.SystemSetting;
    SystemKey = models.SystemKey;
    Employee = models.Employee;
    Biometric = models.Biometric;
    Expense = models.Expense;
    AdvanceSalary = models.AdvanceSalary;
    Holiday = models.Holiday;
    AuditLog = models.AuditLog;
    UserSession = models.UserSession;
    IPRestriction = models.IPRestriction;
    Attendance = models.Attendance;
    Production = models.Production;
    Loan = models.Loan;
    SalarySlip = models.SalarySlip;
    StatutoryRule = models.StatutoryRule;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
    _doBackup = models.doBackup;
    _getBackupStatus = models.getBackupStatus;
    _getBackupConfig = models.getConfig;
    _updateBackupConfig = models.updateConfig;
}

// ── Departments ────────────────────────────────────────────────────────────────
router.get('/departments', async (req, res) => {
    try {
        const where = {};
        // Use req.companyId from JWT (enforced by requireCompanyScope middleware)
        if (req.companyId) where.companyId = req.companyId;
        res.json(await Department.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/departments'); res.status(500).json({ error: e.message }); }
});

router.post('/departments', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        if (!req.body.name || !req.body.companyId) return res.status(400).json({ error: 'name and companyId required' });
        const record = await Department.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/departments'); res.status(500).json({ error: e.message }); }
});

router.put('/departments/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const record = await Department.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Department not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/departments/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/departments/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const record = await Department.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Department not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/departments/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Shifts ────────────────────────────────────────────────────────────────
router.get('/shifts', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await Shift.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/shifts'); res.status(500).json({ error: e.message }); }
});

router.post('/shifts', async (req, res) => {
    try {
        if (!req.body.name || !req.body.companyId || !req.body.startTime || !req.body.endTime) return res.status(400).json({ error: 'Required fields missing' });
        const record = await Shift.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/shifts'); res.status(500).json({ error: e.message }); }
});

router.put('/shifts/:id', async (req, res) => {
    try {
        const record = await Shift.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Shift not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/shifts/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/shifts/:id', async (req, res) => {
    try {
        const record = await Shift.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Shift not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/shifts/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Work Groups ──────────────────────────────────────────────────────────────
router.get('/work-groups', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await WorkGroup.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/work-groups'); res.status(500).json({ error: e.message }); }
});

router.post('/work-groups', async (req, res) => {
    try {
        if (!req.body.name || !req.body.companyId) return res.status(400).json({ error: 'Required fields missing' });
        const record = await WorkGroup.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/work-groups'); res.status(500).json({ error: e.message }); }
});

router.put('/work-groups/:id', async (req, res) => {
    try {
        const record = await WorkGroup.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Work Group not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/work-groups/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/work-groups/:id', async (req, res) => {
    try {
        const record = await WorkGroup.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Work Group not found' });
        await record.destroy();
        // Unassign employees
        await Employee.update({ groupId: null }, { where: { groupId: req.params.id } });
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/work-groups/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.get('/work-groups/assignments/all', async (req, res) => {
    try {
        const where = { groupId: { [Op.not]: null } };
        if (req.companyId) where.companyId = req.companyId;
        const employees = await Employee.findAll({ where, attributes: ['id', 'groupId'] });
        const assignments = {};
        employees.forEach(emp => assignments[emp.id] = emp.groupId);
        res.json(assignments);
    } catch (e) { addError(e, 'GET /api/work-groups/assignments/all'); res.status(500).json({ error: e.message }); }
});

router.post('/work-groups/assign', async (req, res) => {
    try {
        const { employeeId, groupId } = req.body;
        if (!employeeId || !groupId) return res.status(400).json({ error: 'Required fields missing' });
        await Employee.update({ groupId }, { where: { id: employeeId } });
        res.json({ success: true });
    } catch (e) { addError(e, 'POST /api/work-groups/assign'); res.status(500).json({ error: e.message }); }
});

router.post('/work-groups/unassign', async (req, res) => {
    try {
        const { employeeId } = req.body;
        if (!employeeId) return res.status(400).json({ error: 'employeeId missing' });
        await Employee.update({ groupId: null }, { where: { id: employeeId } });
        res.json({ success: true });
    } catch (e) { addError(e, 'POST /api/work-groups/unassign'); res.status(500).json({ error: e.message }); }
});

// ── Salary Types ─────────────────────────────────────────────────────────────
router.get('/salary-types', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await SalaryType.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/salary-types'); res.status(500).json({ error: e.message }); }
});

router.post('/salary-types', async (req, res) => {
    try {
        if (!req.body.companyId || !req.body.key || !req.body.label) return res.status(400).json({ error: 'Required fields missing' });
        const record = await SalaryType.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/salary-types'); res.status(500).json({ error: e.message }); }
});

router.put('/salary-types/:id', async (req, res) => {
    try {
        const record = await SalaryType.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Salary Type not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/salary-types/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/salary-types/:id', async (req, res) => {
    try {
        const record = await SalaryType.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Salary Type not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/salary-types/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Attendance Actions ────────────────────────────────────────────────────────
router.get('/attendance-actions', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await AttendanceAction.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/attendance-actions'); res.status(500).json({ error: e.message }); }
});

router.post('/attendance-actions', async (req, res) => {
    try {
        if (!req.body.companyId || !req.body.key || !req.body.label) return res.status(400).json({ error: 'Required fields missing' });
        const record = await AttendanceAction.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/attendance-actions'); res.status(500).json({ error: e.message }); }
});

router.put('/attendance-actions/:id', async (req, res) => {
    try {
        const record = await AttendanceAction.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Attendance Action not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/attendance-actions/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/attendance-actions/:id', async (req, res) => {
    try {
        const record = await AttendanceAction.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Attendance Action not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/attendance-actions/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Punch Locations ────────────────────────────────────────────────────────────
router.get('/punch-locations', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await PunchLocation.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/punch-locations'); res.status(500).json({ error: e.message }); }
});

router.post('/punch-locations', async (req, res) => {
    try {
        if (!req.body.companyId || !req.body.name) return res.status(400).json({ error: 'Required fields missing' });
        const record = await PunchLocation.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/punch-locations'); res.status(500).json({ error: e.message }); }
});

router.put('/punch-locations/:id', async (req, res) => {
    try {
        const record = await PunchLocation.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Punch Location not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/punch-locations/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/punch-locations/:id', async (req, res) => {
    try {
        const record = await PunchLocation.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Punch Location not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/punch-locations/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── System Settings ────────────────────────────────────────────────────────────
router.get('/system-settings', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        if (req.query.key) where.key = req.query.key;
        res.json(await SystemSetting.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/system-settings'); res.status(500).json({ error: e.message }); }
});

router.post('/system-settings', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const { companyId, key, value } = req.body;
        if (!companyId || !key) return res.status(400).json({ error: 'Required fields missing' });

        let setting = await SystemSetting.findOne({ where: { companyId, key } });
        if (setting) {
            await setting.update({ value });
        } else {
            setting = await SystemSetting.create({ ...req.body, id: uuidv4() });
        }
        res.json(setting);
    } catch (e) { addError(e, 'POST /api/system-settings'); res.status(500).json({ error: e.message }); }
});

// ── System Keys (Super Admin / Account Admin only) ─────────────────────────────
router.get('/system-keys', requireRole(['SUPER_ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        const keys = await SystemKey.findAll({ where });
        // Mask secret values before returning
        const safe = keys.map(k => {
            const data = k.toJSON();
            if (data.isSecret) data.value = '••••••••';
            return data;
        });
        res.json(safe);
    } catch (e) { addError(e, 'GET /api/system-keys'); res.status(500).json({ error: e.message }); }
});

router.post('/system-keys', requireRole(['SUPER_ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const { companyId, key, label, value, category } = req.body;
        if (!companyId || !key || !label || !value || !category) return res.status(400).json({ error: 'Required fields missing' });

        const record = await SystemKey.create({ ...req.body, id: uuidv4() });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/system-keys'); res.status(500).json({ error: e.message }); }
});

router.put('/system-keys/:id', requireRole(['SUPER_ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const record = await SystemKey.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'System Key not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/system-keys/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/system-keys/:id', requireRole(['SUPER_ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const record = await SystemKey.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'System Key not found' });
        await record.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/system-keys/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Biometrics ─────────────────────────────────────────────────────────────────
router.get('/biometrics/all', async (req, res) => {
    try {
        const records = await Biometric.findAll({
            attributes: ['employeeId', 'faceDescriptor', 'registeredAt'],
            order: [['registeredAt', 'DESC']], // latest first — deduplication keeps first seen per emp
        });
        const result = {};
        for (const r of records) {
            // Only take first (latest) record per employeeId — handles duplicate rows from old bug
            if (r.faceDescriptor && r.faceDescriptor.length > 0 && !result[r.employeeId]) {
                result[r.employeeId] = r.faceDescriptor;
            }
        }
        res.json(result);
    } catch (e) { addError(e, 'GET /api/biometrics/all'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.get('/biometrics/:employeeId', async (req, res) => {
    try {
        // findByPk won't work — PK is auto-increment id, not employeeId
        const record = await Biometric.findOne({ where: { employeeId: req.params.employeeId } });
        if (!record) return res.status(404).json({ error: 'Not found' });
        res.json(record);
    } catch (e) { addError(e, 'GET /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/biometrics/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { faceDescriptor, thumbCredential } = req.body;
        const updates = {
            ...(faceDescriptor !== undefined ? { faceDescriptor } : {}),
            ...(thumbCredential !== undefined ? { thumbCredential } : {}),
            registeredAt: new Date().toISOString(),
        };
        // Find existing record by employeeId (not PK), update if found, create if not
        const existing = await Biometric.findOne({ where: { employeeId } });
        if (existing) {
            await existing.update(updates);
            res.json(existing.toJSON());
        } else {
            const created = await Biometric.create({ employeeId, ...updates });
            res.json(created.toJSON());
        }
    } catch (e) { addError(e, 'POST /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/biometrics/:employeeId/face', async (req, res) => {
    try {
        const r = await Biometric.findOne({ where: { employeeId: req.params.employeeId } });
        if (r) await r.update({ faceDescriptor: null });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/biometrics/:id/face'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/biometrics/:employeeId/thumb', async (req, res) => {
    try {
        const r = await Biometric.findOne({ where: { employeeId: req.params.employeeId } });
        if (r) await r.update({ thumbCredential: null });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/biometrics/:id/thumb'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/biometrics/:employeeId', async (req, res) => {
    try { await Biometric.destroy({ where: { employeeId: req.params.employeeId } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Expenses ───────────────────────────────────────────────────────────────────
router.get('/expenses', async (req, res) => {
    try {
        const { month } = req.query;
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        if (month) where.date = { [Op.like]: `${month}%` };
        res.json(await Expense.findAll({ where, order: [['date', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/expenses'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/expenses', async (req, res) => {
    try {
        const { companyId, date, category, amount, description, paidTo, addedBy, receiptUrl } = req.body;
        if (!date || !amount) return res.status(400).json({ error: 'date and amount are required' });
        const expense = await Expense.create({
            id: `exp-${uuidv4()}`,                          // server-generated — ignore client id
            companyId: req.companyId || companyId,         // JWT takes priority
            date, category: category || 'OTHER', amount, description, paidTo, addedBy, receiptUrl,
            status: 'PENDING',
            auditTrail: [{ id: uuidv4(), date: new Date().toISOString(), action: 'CREATED', performedBy: addedBy || 'system' }]
        });
        res.status(201).json(expense);
    } catch (e) { addError(e, 'POST /api/expenses'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
// Checker Workflow: Only high-level roles can change status
router.patch('/expenses/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const expense = await Expense.findByPk(req.params.id);
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        const { status, performedBy, remarks } = req.body;
        const trail = Array.isArray(expense.auditTrail) ? [...expense.auditTrail] : [];
        trail.push({ id: uuidv4(), date: new Date().toISOString(), action: status, performedBy: performedBy || req.user?.name || 'system', details: remarks });
        await expense.update({ status, auditTrail: trail });
        res.json(expense);
    } catch (e) { addError(e, `PATCH /api/expenses/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/expenses/:id', async (req, res) => {
    try {
        const e2 = await Expense.findByPk(req.params.id);
        if (!e2) return res.status(404).json({ error: 'Expense not found' });
        // Cross-company check
        if (req.companyId && e2.companyId && e2.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Forbidden — cross-company access denied' });
        }
        // Only the creator (by name) or privileged roles can delete
        const isPrivileged = req.user && ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN'].includes(req.user.role);
        const isCreator = e2.addedBy === req.user?.name && e2.status === 'PENDING';
        if (!isPrivileged && !isCreator) {
            return res.status(403).json({ error: 'Forbidden — only the creator (while pending) or ADMIN can delete expenses' });
        }
        await e2.destroy();
        res.json({ success: true });
    }
    catch (e) { addError(e, `DELETE /api/expenses/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Advance Salary ─────────────────────────────────────────────────────────────
router.get('/advance-salary', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        if (req.query.employeeId) where.employeeId = req.query.employeeId;
        if (req.query.status) where.status = req.query.status;
        res.json(await AdvanceSalary.findAll({ where, order: [['requestDate', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/advance-salary'); res.status(500).json({ error: e.message }); }
});
router.post('/advance-salary', async (req, res) => {
    try {
        const { id, employeeId, employeeName, companyId, amount, reason, installments } = req.body;
        if (!employeeId || !amount) return res.status(400).json({ error: 'employeeId and amount required' });
        const monthlyDeduction = Math.round(amount / (installments || 3));
        const record = await AdvanceSalary.create({ id: id || `adv-${Date.now()}`, companyId, employeeId, employeeName, amount, reason, installments: installments || 3, monthlyDeduction, remainingBalance: amount, requestDate: new Date().toISOString(), status: 'pending' });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/advance-salary'); res.status(500).json({ error: e.message }); }
});
router.patch('/advance-salary/:id/status', async (req, res) => {
    try {
        const record = await AdvanceSalary.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Request not found' });
        const { status, approvedBy } = req.body;
        if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' });
        await record.update({ status, approvedBy: approvedBy || 'Admin', approvedDate: new Date().toISOString(), remainingBalance: status === 'rejected' ? 0 : record.remainingBalance });
        res.json(record);
    } catch (e) { addError(e, `PATCH /api/advance-salary/${req.params.id}/status`); res.status(500).json({ error: e.message }); }
});
router.patch('/advance-salary/:id/deduct', async (req, res) => {
    try {
        const record = await AdvanceSalary.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Request not found' });
        const deduction = Math.min(record.monthlyDeduction, record.remainingBalance);
        const newBalance = Math.max(0, record.remainingBalance - deduction);
        await record.update({ remainingBalance: newBalance });
        res.json({ success: true, deducted: deduction, remainingBalance: newBalance });
    } catch (e) { addError(e, `PATCH /api/advance-salary/${req.params.id}/deduct`); res.status(500).json({ error: e.message }); }
});
router.delete('/advance-salary/:id', async (req, res) => {
    try { const record = await AdvanceSalary.findByPk(req.params.id); if (!record) return res.status(404).json({ error: 'Request not found' }); await record.destroy(); res.json({ success: true }); }
    catch (e) { addError(e, `DELETE /api/advance-salary/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Holidays ───────────────────────────────────────────────────────────────────
router.get('/holidays', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        if (req.query.year) where.date = { [Op.like]: `${req.query.year}%` };
        res.json(await Holiday.findAll({ where, order: [['date', 'ASC']] }));
    } catch (e) { addError(e, 'GET /api/holidays'); res.status(500).json({ error: e.message }); }
});
router.post('/holidays', async (req, res) => {
    try {
        const { id, name, date, type, description, companyId } = req.body;
        if (!name || !date) return res.status(400).json({ error: 'name and date required' });
        const record = await Holiday.create({ id: id || `hol-${Date.now()}`, name, date, type: type || 'FESTIVAL', description, companyId });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/holidays'); res.status(500).json({ error: e.message }); }
});
router.post('/holidays/bulk', async (req, res) => {
    try {
        const { holidays, companyId } = req.body;
        if (!Array.isArray(holidays)) return res.status(400).json({ error: 'holidays array required' });
        await Promise.all(holidays.map(h => Holiday.upsert({ id: h.id || `hol-${h.date}-${Date.now()}`, name: h.name, date: h.date, type: h.type || 'FESTIVAL', description: h.description, companyId })));
        res.status(201).json({ inserted: holidays.length });
    } catch (e) { addError(e, 'POST /api/holidays/bulk'); res.status(500).json({ error: e.message }); }
});
router.put('/holidays/:id', async (req, res) => {
    try { const record = await Holiday.findByPk(req.params.id); if (!record) return res.status(404).json({ error: 'Holiday not found' }); await record.update(req.body); res.json(record); }
    catch (e) { addError(e, `PUT /api/holidays/${req.params.id}`); res.status(500).json({ error: e.message }); }
});
router.delete('/holidays/:id', async (req, res) => {
    try { const record = await Holiday.findByPk(req.params.id); if (!record) return res.status(404).json({ error: 'Holiday not found' }); await record.destroy(); res.json({ success: true }); }
    catch (e) { addError(e, `DELETE /api/holidays/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

// ── Audit Logs ─────────────────────────────────────────────────────────────────
router.get('/audit-logs', requireRole(['ADMIN', 'SUPER_ADMIN', 'ACCOUNT_ADMIN']), async (req, res) => {
    try {
        const { action, userId, entityType, status, startDate, endDate, page = 1, limit = 100 } = req.query;
        const where = {};
        // companyId always comes from JWT — prevents cross-tenant log access
        if (req.companyId) where.companyId = req.companyId;
        if (action) where.action = action;
        if (userId) where.userId = userId;
        if (entityType) where.entityType = entityType;
        if (status) where.status = status;
        if (startDate || endDate) { where.timestamp = {}; if (startDate) where.timestamp[Op.gte] = startDate; if (endDate) where.timestamp[Op.lte] = endDate + 'T23:59:59.999Z'; }
        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['timestamp', 'DESC']], limit: Math.min(Number(limit), 500), offset });
        res.json({ total: count, page: Number(page), limit: Number(limit), logs: rows });
    } catch (e) { addError(e, 'GET /api/audit-logs'); res.status(500).json({ error: e.message }); }
});
router.post('/audit-logs', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER', 'EMPLOYEE']), async (req, res) => {
    try {
        const log = req.body;
        if (!log.userId || !log.userName || !log.action) return res.status(400).json({ error: 'userId, userName, action are required' });
        // Enforce: userId must match the requesting user (prevent impersonation in audit trail)
        if (req.user && log.userId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Cannot create audit log as a different user' });
        }
        const created = await AuditLog.create({ ...log, id: log.id || `audit-${uuidv4()}`, timestamp: log.timestamp || new Date().toISOString() });
        res.status(201).json(created);
    } catch (e) { addError(e, 'POST /api/audit-logs'); res.status(500).json({ error: e.message }); }
});
router.delete('/audit-logs/clear', async (req, res) => {
    try {
        const days = Number(req.query.days) || 90;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const cutoffISO = cutoff.toISOString();
        const deleted = await AuditLog.destroy({ where: { timestamp: { [Op.lt]: cutoffISO } } });
        res.json({ deleted, cutoff: cutoffISO });
    } catch (e) { addError(e, 'DELETE /api/audit-logs/clear'); res.status(500).json({ error: e.message }); }
});

// ── Security / Sessions ────────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
    try { res.json(await UserSession.findAll({ where: { isActive: true } })); }
    catch (e) { addError(e, 'GET /api/sessions'); res.status(500).json({ error: e.message }); }
});
router.delete('/sessions/:id', async (req, res) => {
    try {
        const session = await UserSession.findByPk(req.params.id);
        if (session) await session.update({ isActive: false });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/sessions/:id'); res.status(500).json({ error: e.message }); }
});

// ── Security / IP Restrictions ───────────────────────────────────────────────
router.get('/ip-restrictions', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await IPRestriction.findAll({ where }));
    }
    catch (e) { addError(e, 'GET /api/ip-restrictions'); res.status(500).json({ error: e.message }); }
});
router.post('/ip-restrictions', async (req, res) => {
    try {
        const companyId = req.companyId || req.body.companyId;
        if (!companyId) return res.status(400).json({ error: 'companyId required' });
        const r = await IPRestriction.create({ id: `ip-${Date.now()}`, ...req.body, companyId });
        res.status(201).json(r);
    } catch (e) { addError(e, 'POST /api/ip-restrictions'); res.status(500).json({ error: e.message }); }
});
router.delete('/ip-restrictions/:id', async (req, res) => {
    try {
        const where = { id: req.params.id };
        if (req.companyId) where.companyId = req.companyId;
        const r = await IPRestriction.findOne({ where });
        if (r) await r.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/ip-restrictions/:id'); res.status(500).json({ error: e.message }); }
});

// NOTE: The second GET /api/audit-logs definition was removed — Express only honours
// the first registered handler for a path. The complete implementation with RBAC,
// pagination, and filters is the one defined above.

// ── Factory / Data Clear (DANGEROUS — SUPER_ADMIN only) ───────────────────────
// Requires: SUPER_ADMIN role + a confirmation token in the request body.
// The token must be the SHA-256 hex of "CONFIRM_WIPE_<companyId>" to prevent
// accidental mass deletions from a mistyped request.
router.delete('/clear-data', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { companyId, confirmationToken } = req.body;
        if (!companyId) return res.status(400).json({ error: 'companyId is required' });

        // Verify double-submit confirmation token
        const crypto = require('crypto');
        const expected = crypto.createHash('sha256').update(`CONFIRM_WIPE_${companyId}`).digest('hex');
        if (confirmationToken !== expected) {
            return res.status(400).json({
                error: 'Invalid confirmationToken. Compute SHA-256 of "CONFIRM_WIPE_<companyId>" to confirm.',
                fix: `node -e "console.log(require('crypto').createHash('sha256').update('CONFIRM_WIPE_${companyId}').digest('hex'))"`,
            });
        }

        // Write audit entry BEFORE deletion so we have a record
        await AuditLog.create({
            id: `audit-wipe-${Date.now()}`,
            companyId,
            userId: req.user?.id || 'SYSTEM',
            userName: req.user?.name || 'SUPER_ADMIN',
            userRole: req.user?.role || 'SUPER_ADMIN',
            action: 'CLEAR_COMPANY_DATA',
            entityType: 'COMPANY',
            entityId: companyId,
            entityName: companyId,
            details: { initiatedBy: req.user?.id, timestamp: new Date().toISOString() },
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
        });

        // Find employees for this company
        const emps = await Employee.findAll({ attributes: ['id'], where: { companyId } });
        const empIds = emps.map(e => e.id);

        if (empIds.length > 0) {
            await Attendance.destroy({ where: { employeeId: { [Op.in]: empIds } } });
            await Production.destroy({ where: { employeeId: { [Op.in]: empIds } } });
            await SalarySlip.destroy({ where: { employeeId: { [Op.in]: empIds } } });
        }
        await Loan.destroy({ where: { companyId } });
        await Expense.destroy({ where: { companyId } });

        res.json({ success: true, message: 'Company data wiped successfully.' });
    } catch (e) { addError(e, 'DELETE /api/clear-data'); res.status(500).json({ error: e.message }); }
});

// ── Backup ────────────────────────────────────────────────────────────────────
router.get('/backup/status', (req, res) => {
    try { res.json(_getBackupStatus()); }
    catch (e) { addError(e, 'GET /api/backup/status'); res.status(500).json({ error: e.message }); }
});

router.get('/backup/download/:filename', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename.startsWith('database_backup_') || !filename.endsWith('.sqlite')) {
            return res.status(400).json({ error: 'Invalid backup filename' });
        }
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }
        res.download(filePath);
    } catch (e) {
        addError(e, `GET /api/backup/download/${req.params.filename}`);
        res.status(500).json({ error: e.message });
    }
});
router.post('/backup/now', (req, res) => {
    try { res.json(_doBackup('manual')); }
    catch (e) { addError(e, 'POST /api/backup/now'); res.status(500).json({ error: e.message }); }
});
router.delete('/backup/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename.startsWith('database_backup_') || !filename.endsWith('.sqlite')) return res.status(400).json({ error: 'Invalid backup filename' });
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true, deleted: filename });
    } catch (e) { addError(e, `DELETE /api/backup/${req.params.filename}`); res.status(500).json({ error: e.message }); }
});
// GET full config (schedules, email, whatsapp) — masks sensitive fields
router.get('/backup/config', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
    try {
        const cfg = _getBackupConfig ? _getBackupConfig() : {};
        const safe = JSON.parse(JSON.stringify(cfg));
        if (safe.email?.pass) safe.email.pass = '••••••••';
        if (safe.whatsapp?.wabaToken) safe.whatsapp.wabaToken = '••••••••';
        res.json(safe);
    } catch (e) { addError(e, 'GET /api/backup/config'); res.status(500).json({ error: e.message }); }
});

// PATCH config — accepts schedules, enabled, email, whatsapp sub-objects
router.patch('/backup/config', (req, res) => {
    try {
        const payload = req.body;
        // Prevent overwriting sensitive fields with masked placeholders
        if (payload.email?.pass === '••••••••') delete payload.email.pass;
        if (payload.whatsapp?.wabaToken === '••••••••') delete payload.whatsapp.wabaToken;
        const updated = _updateBackupConfig ? _updateBackupConfig(payload) : {};
        const safe = JSON.parse(JSON.stringify(updated));
        if (safe.email?.pass) safe.email.pass = '••••••••';
        if (safe.whatsapp?.wabaToken) safe.whatsapp.wabaToken = '••••••••';
        res.json({ success: true, config: safe });
    } catch (e) { addError(e, 'PATCH /api/backup/config'); res.status(500).json({ error: e.message }); }
});

// ── WhatsApp ───────────────────────────────────────────────────────────────────
// GET never returns the actual token — only a boolean indicating if it is set.
// PATCH always overwrites whatever value is provided (no mask-check bypass possible).
router.get('/whatsapp/config', (req, res) => {
    const cfg = loadWAConfig();
    res.json({
        enabled: cfg.enabled,
        phoneNumberId: cfg.phoneNumberId,
        businessName: cfg.businessName,
        tokenIsSet: Boolean(cfg.wabaToken), // never return the actual token
    });
});
router.patch('/whatsapp/config', (req, res) => {
    const existing = loadWAConfig();
    const { enabled, phoneNumberId, wabaToken, businessName } = req.body;
    const updated = {
        enabled: enabled ?? existing.enabled,
        phoneNumberId: phoneNumberId ?? existing.phoneNumberId,
        // Always overwrite token if a new value is provided; otherwise retain existing
        wabaToken: (wabaToken !== undefined && wabaToken !== null && wabaToken !== '') ? wabaToken : existing.wabaToken,
        businessName: businessName ?? existing.businessName,
    };
    saveWAConfig(updated);
    res.json({ success: true, message: 'WhatsApp config saved.', tokenIsSet: Boolean(updated.wabaToken) });
});
router.post('/whatsapp/send', async (req, res) => {
    const cfg = loadWAConfig();
    if (!cfg.enabled) return res.status(403).json({ error: 'WhatsApp notifications are disabled.' });
    if (!cfg.phoneNumberId || !cfg.wabaToken) return res.status(400).json({ error: 'WhatsApp not configured.' });
    const { to, type, text, template } = req.body;
    if (!to) return res.status(400).json({ error: '"to" phone number is required' });
    const body = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
    if (type === 'text') { body.type = 'text'; body.text = { preview_url: false, body: text }; }
    else if (type === 'template') { body.type = 'template'; body.template = template; }
    else return res.status(400).json({ error: 'type must be "text" or "template"' });
    try {
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`, { method: 'POST', headers: { 'Authorization': `Bearer ${cfg.wabaToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await metaRes.json();
        if (!metaRes.ok) { addError(new Error(data?.error?.message || 'Meta API error'), 'POST /api/whatsapp/send'); return res.status(metaRes.status).json({ error: data?.error?.message || 'Meta API error', details: data }); }
        res.json({ success: true, messageId: data?.messages?.[0]?.id });
    } catch (e) { addError(e, 'POST /api/whatsapp/send'); res.status(500).json({ error: e.message }); }
});
router.post('/whatsapp/test', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    const cfg = loadWAConfig();
    if (!cfg.enabled || !cfg.phoneNumberId || !cfg.wabaToken) return res.status(400).json({ error: 'WhatsApp not enabled/configured.' });
    try {
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneNumberId}/messages`, { method: 'POST', headers: { 'Authorization': `Bearer ${cfg.wabaToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { preview_url: false, body: '✅ SM PAYROLL — WhatsApp integration is working correctly! This is a test message.' } }) });
        const data = await metaRes.json();
        if (!metaRes.ok) return res.status(metaRes.status).json({ error: data?.error?.message, details: data });
        res.json({ success: true, message: `Test message sent to ${phone}`, messageId: data?.messages?.[0]?.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Statutory Rules ────────────────────────────────────────────────────────────
router.get('/statutory-rules', async (req, res) => {
    try {
        const rules = await StatutoryRule.findAll({
            where: { companyId: req.query.companyId },
            order: [['effectiveDate', 'DESC']]
        });
        res.json(rules);
    } catch (e) { addError(e, 'GET /api/statutory-rules'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/statutory-rules', async (req, res) => {
    try {
        const { id, companyId, effectiveDate, pfRate, pfCappedAmount, esicRate, esicThreshold, ptSlabs } = req.body;
        const newRule = await StatutoryRule.create({
            id: id || `sr_${Date.now()}`,
            companyId, effectiveDate,
            pfRate: pfRate ?? 12.0,
            pfCappedAmount: pfCappedAmount ?? 1800,
            esicRate: esicRate ?? 0.75,
            esicThreshold: esicThreshold ?? 21000,
            ptSlabs: ptSlabs || []
        });
        res.status(201).json(newRule);
    } catch (e) { addError(e, 'POST /api/statutory-rules'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.put('/statutory-rules/:id', async (req, res) => {
    try {
        const rule = await StatutoryRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.update(req.body);
        res.json(rule);
    } catch (e) { addError(e, `PUT /api/statutory-rules/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.delete('/statutory-rules/:id', async (req, res) => {
    try {
        const rule = await StatutoryRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, `DELETE /api/statutory-rules/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// ── Data Consistency Report — DB-level orphan + integrity checks ───────────────
// All raw queries use Sequelize replacements (parameterized) — no interpolation.
router.get('/consistency-report', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
    try {
        const companyId = req.companyId;
        const sq = Employee.sequelize;
        const issues = [];
        const qOpts = { type: sq.QueryTypes ? sq.QueryTypes.SELECT : 'SELECT' };

        // 1. Orphaned Attendance (parameterized)
        const orphanAttSql = companyId
            ? `SELECT COUNT(*) as cnt FROM "Attendances" a WHERE a."companyId" = :cid AND NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = a."employeeId")`
            : `SELECT COUNT(*) as cnt FROM "Attendances" a WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = a."employeeId")`;
        const [orphanAttRow] = await sq.query(orphanAttSql, { replacements: companyId ? { cid: companyId } : {}, ...qOpts }).catch(() => [{ cnt: 0 }]);
        const orphanAtt = Number((orphanAttRow && orphanAttRow.cnt) || 0);
        if (orphanAtt > 0) issues.push({ id: 'db_orphan_attendance', severity: 'medium', category: 'attendance', title: 'DB: Orphaned Attendance Records', description: `${orphanAtt} attendance record(s) in DB have no matching employee.`, affectedRecords: orphanAtt, autoFixable: true, fixEndpoint: '/api/admin/fix-orphan-attendance' });

        // 2. Orphaned Salary Slips (parameterized)
        const orphanSlipSql = companyId
            ? `SELECT COUNT(*) as cnt FROM "SalarySlips" s WHERE s."companyId" = :cid AND NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = s."employeeId")`
            : `SELECT COUNT(*) as cnt FROM "SalarySlips" s WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = s."employeeId")`;
        const [orphanSlipRow] = await sq.query(orphanSlipSql, { replacements: companyId ? { cid: companyId } : {}, ...qOpts }).catch(() => [{ cnt: 0 }]);
        const orphanSlips = Number((orphanSlipRow && orphanSlipRow.cnt) || 0);
        if (orphanSlips > 0) issues.push({ id: 'db_orphan_slips', severity: 'high', category: 'payroll', title: 'DB: Orphaned Salary Slips', description: `${orphanSlips} salary slip(s) in DB have no matching employee.`, affectedRecords: orphanSlips, autoFixable: true, fixEndpoint: '/api/admin/fix-orphan-slips' });

        // 3. Loans with balance < 0 (uses ORM — safe)
        const negBalanceLoans = await Loan.count({ where: companyId ? { companyId, balance: { [Op.lt]: 0 } } : { balance: { [Op.lt]: 0 } } }).catch(() => 0);
        if (negBalanceLoans > 0) issues.push({ id: 'db_neg_loan_balance', severity: 'critical', category: 'loan', title: 'DB: Loans with Negative Balance', description: `${negBalanceLoans} active loan(s) have a negative balance — payroll over-deducted.`, affectedRecords: negBalanceLoans, autoFixable: true, fixEndpoint: '/api/admin/fix-loan-balances' });

        // 4. Duplicate employee codes (parameterized)
        const dupCodeSql = companyId
            ? `SELECT "code", COUNT(*) as cnt FROM "Employees" WHERE "companyId" = :cid AND "status" != 'INACTIVE' GROUP BY "code" HAVING COUNT(*) > 1`
            : `SELECT "code", COUNT(*) as cnt FROM "Employees" WHERE "status" != 'INACTIVE' GROUP BY "code" HAVING COUNT(*) > 1`;
        const dupCodes = await sq.query(dupCodeSql, { replacements: companyId ? { cid: companyId } : {}, ...qOpts }).catch(() => []);
        const dupArr = Array.isArray(dupCodes) ? dupCodes : [];
        if (dupArr.length > 0) issues.push({ id: 'db_dup_codes', severity: 'critical', category: 'employee', title: 'DB: Duplicate Employee Codes', description: `${dupArr.length} employee code(s) assigned to multiple active employees.`, affectedRecords: dupArr.reduce((s, r) => s + Number(r.cnt), 0), autoFixable: false });

        // 5. Net salary > gross salary (parameterized)
        const badSlipSql = companyId
            ? `SELECT COUNT(*) as cnt FROM "SalarySlips" WHERE "companyId" = :cid AND "netSalary" > "grossSalary"`
            : `SELECT COUNT(*) as cnt FROM "SalarySlips" WHERE "netSalary" > "grossSalary"`;
        const [badSlipRow] = await sq.query(badSlipSql, { replacements: companyId ? { cid: companyId } : {}, ...qOpts }).catch(() => [{ cnt: 0 }]);
        const badSlipCount = Number((badSlipRow && badSlipRow.cnt) || 0);
        if (badSlipCount > 0) issues.push({ id: 'db_net_gt_gross', severity: 'critical', category: 'payroll', title: 'DB: Net Salary Exceeds Gross', description: `${badSlipCount} salary slip(s) have netSalary > grossSalary — calculation error.`, affectedRecords: badSlipCount, autoFixable: false });

        res.json({ issues, checkedAt: new Date().toISOString(), companyId: companyId || 'ALL' });
    } catch (e) {
        addError(e, 'GET /api/admin/consistency-report');
        res.status(500).json({ error: e.message });
    }
});

// ── Fix: Orphaned Attendance (parameterized) ───────────────────────────────────
router.delete('/fix-orphan-attendance', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const companyId = req.companyId;
        const sql = companyId
            ? `DELETE FROM "Attendances" WHERE "companyId" = :cid AND NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = "Attendances"."employeeId")`
            : `DELETE FROM "Attendances" WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = "Attendances"."employeeId")`;
        const [, meta] = await Attendance.sequelize.query(sql, { replacements: companyId ? { cid: companyId } : {} });
        res.json({ success: true, deleted: meta?.rowCount || meta?.changes || 0 });
    } catch (e) { addError(e, 'DELETE /api/admin/fix-orphan-attendance'); res.status(500).json({ error: e.message }); }
});

// ── Fix: Orphaned Salary Slips (parameterized) ─────────────────────────────────
router.delete('/fix-orphan-slips', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const companyId = req.companyId;
        const sql = companyId
            ? `DELETE FROM "SalarySlips" WHERE "companyId" = :cid AND NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = "SalarySlips"."employeeId")`
            : `DELETE FROM "SalarySlips" WHERE NOT EXISTS (SELECT 1 FROM "Employees" e WHERE e.id = "SalarySlips"."employeeId")`;
        const [, meta] = await SalarySlip.sequelize.query(sql, { replacements: companyId ? { cid: companyId } : {} });
        res.json({ success: true, deleted: meta?.rowCount || meta?.changes || 0 });
    } catch (e) { addError(e, 'DELETE /api/admin/fix-orphan-slips'); res.status(500).json({ error: e.message }); }
});

// ── Fix: Loan balance floor at 0 ─────────────────────────────────────────────
router.patch('/fix-loan-balances', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const companyId = req.companyId;
        const where = companyId ? { companyId, balance: { [Op.lt]: 0 } } : { balance: { [Op.lt]: 0 } };
        const [count] = await Loan.update({ balance: 0, status: 'CLOSED' }, { where });
        res.json({ success: true, fixed: count });
    } catch (e) { addError(e, 'PATCH /api/admin/fix-loan-balances'); res.status(500).json({ error: e.message }); }
});

// ── Employee Permanent Delete (Trash) ─────────────────────────────────────────
// Only deletes if status is INACTIVE (already soft-deleted). Requires SUPER_ADMIN.
router.delete('/employees/:id/permanent', requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        const where = { id: req.params.id, status: 'INACTIVE' };
        if (req.companyId) where.companyId = req.companyId;
        const emp = await Employee.findOne({ where });
        if (!emp) return res.status(404).json({ error: 'Employee not found or is not soft-deleted' });
        const reason = req.body?.reason;
        await emp.destroy();
        await AuditLog.create({
            id: `audit-${uuidv4()}`,
            companyId: req.companyId,
            userId: req.user?.id,
            userName: req.user?.name,
            userRole: req.user?.role,
            action: 'PERMANENT_DELETE_EMPLOYEE',
            entityType: 'EMPLOYEE',
            entityId: req.params.id,
            entityName: emp.name,
            details: reason ? { reason } : undefined,
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
        });
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/admin/employees/:id/permanent'); res.status(500).json({ error: e.message }); }
});

// ── Employee Restore (Trash → Active) ─────────────────────────────────────────
router.patch('/employees/:id/restore', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
    try {
        const where = { id: req.params.id, status: 'INACTIVE' };
        if (req.companyId) where.companyId = req.companyId;
        const emp = await Employee.findOne({ where });
        if (!emp) return res.status(404).json({ error: 'Employee not found or is already active' });
        await emp.update({ status: 'ACTIVE' });
        res.json({ success: true, employee: emp });
    } catch (e) { addError(e, 'PATCH /api/admin/employees/:id/restore'); res.status(500).json({ error: e.message }); }
});

module.exports = { router, init };
