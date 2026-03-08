// ── ADMIN ROUTES: Audit Logs + Backup + WhatsApp + Biometrics + Expenses + AdvanceSalary + Holidays ──
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
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

router.post('/departments', async (req, res) => {
    try {
        if (!req.body.name || !req.body.companyId) return res.status(400).json({ error: 'name and companyId required' });
        const record = await Department.create(req.body);
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/departments'); res.status(500).json({ error: e.message }); }
});

router.put('/departments/:id', async (req, res) => {
    try {
        const record = await Department.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Department not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/departments/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/departments/:id', async (req, res) => {
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

router.post('/system-settings', async (req, res) => {
    try {
        const { companyId, key, value } = req.body;
        if (!companyId || !key) return res.status(400).json({ error: 'Required fields missing' });

        let setting = await SystemSetting.findOne({ where: { companyId, key } });
        if (setting) {
            await setting.update({ value });
        } else {
            setting = await SystemSetting.create({ ...req.body, id: Math.random().toString(36).substr(2, 9) });
        }
        res.json(setting);
    } catch (e) { addError(e, 'POST /api/system-settings'); res.status(500).json({ error: e.message }); }
});

// ── System Keys (Super Admin) ──────────────────────────────────────────────────
router.get('/system-keys', async (req, res) => {
    try {
        const where = {};
        if (req.companyId) where.companyId = req.companyId;
        res.json(await SystemKey.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/system-keys'); res.status(500).json({ error: e.message }); }
});

router.post('/system-keys', async (req, res) => {
    try {
        const { companyId, key, label, value, category } = req.body;
        if (!companyId || !key || !label || !value || !category) return res.status(400).json({ error: 'Required fields missing' });

        const record = await SystemKey.create({ ...req.body, id: Math.random().toString(36).substr(2, 9) });
        res.status(201).json(record);
    } catch (e) { addError(e, 'POST /api/system-keys'); res.status(500).json({ error: e.message }); }
});

router.put('/system-keys/:id', async (req, res) => {
    try {
        const record = await SystemKey.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'System Key not found' });
        await record.update(req.body);
        res.json(record);
    } catch (e) { addError(e, `PUT /api/system-keys/${req.params.id}`); res.status(500).json({ error: e.message }); }
});

router.delete('/system-keys/:id', async (req, res) => {
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
        const records = await Biometric.findAll({ attributes: ['employeeId', 'faceDescriptor'] });
        const result = {};
        for (const r of records) {
            if (r.faceDescriptor && r.faceDescriptor.length > 0) result[r.employeeId] = r.faceDescriptor;
        }
        res.json(result);
    } catch (e) { addError(e, 'GET /api/biometrics/all'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.get('/biometrics/:employeeId', async (req, res) => {
    try {
        const record = await Biometric.findByPk(req.params.employeeId);
        if (!record) return res.status(404).json({ error: 'Not found' });
        res.json(record);
    } catch (e) { addError(e, 'GET /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.post('/biometrics/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { faceDescriptor, thumbCredential } = req.body;
        const [record] = await Biometric.upsert({ employeeId, ...(faceDescriptor !== undefined ? { faceDescriptor } : {}), ...(thumbCredential !== undefined ? { thumbCredential } : {}), registeredAt: new Date().toISOString() });
        res.json(record);
    } catch (e) { addError(e, 'POST /api/biometrics/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/biometrics/:employeeId/face', async (req, res) => {
    try { const r = await Biometric.findByPk(req.params.employeeId); if (r) await r.update({ faceDescriptor: null }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/biometrics/:id/face'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/biometrics/:employeeId/thumb', async (req, res) => {
    try { const r = await Biometric.findByPk(req.params.employeeId); if (r) await r.update({ thumbCredential: null }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/biometrics/:id/thumb'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
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
        const { id, companyId, date, category, amount, description, paidTo, addedBy, receiptUrl } = req.body;
        if (!date || !amount) return res.status(400).json({ error: 'date and amount are required' });
        // Maker Workflow: Hardcode status to PENDING regardless of client payload
        const expense = await Expense.create({
            id: id || `exp_${Date.now()}`,
            companyId, date, category: category || 'OTHER', amount, description, paidTo, addedBy, receiptUrl,
            status: 'PENDING',
            auditTrail: [{ id: Date.now().toString(), date: new Date().toISOString(), action: 'CREATED', performedBy: addedBy || 'system' }]
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
        trail.push({ id: Date.now().toString(), date: new Date().toISOString(), action: status, performedBy: performedBy || req.user?.name || 'system', details: remarks });
        await expense.update({ status, auditTrail: trail });
        res.json(expense);
    } catch (e) { addError(e, `PATCH /api/expenses/${req.params.id}`); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});
router.delete('/expenses/:id', async (req, res) => {
    try { const e2 = await Expense.findByPk(req.params.id); if (!e2) return res.status(404).json({ error: 'Expense not found' }); await e2.destroy(); res.json({ success: true }); }
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
router.get('/audit-logs', async (req, res) => {
    try {
        const { companyId, action, userId, entityType, status, startDate, endDate, page = 1, limit = 100 } = req.query;
        const where = {};
        if (companyId) where.companyId = companyId;
        if (action) where.action = action;
        if (userId) where.userId = userId;
        if (entityType) where.entityType = entityType;
        if (status) where.status = status;
        if (startDate || endDate) { where.timestamp = {}; if (startDate) where.timestamp[Op.gte] = startDate; if (endDate) where.timestamp[Op.lte] = endDate + 'T23:59:59.999Z'; }
        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['timestamp', 'DESC']], limit: Number(limit), offset });
        res.json({ total: count, page: Number(page), limit: Number(limit), logs: rows });
    } catch (e) { addError(e, 'GET /api/audit-logs'); res.status(500).json({ error: e.message }); }
});
router.post('/audit-logs', async (req, res) => {
    try {
        const log = req.body;
        if (!log.userId || !log.userName || !log.action) return res.status(400).json({ error: 'userId, userName, action are required' });
        const created = await AuditLog.create({ ...log, id: log.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, timestamp: log.timestamp || new Date().toISOString() });
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
    try { res.json(await IPRestriction.findAll()); }
    catch (e) { addError(e, 'GET /api/ip-restrictions'); res.status(500).json({ error: e.message }); }
});
router.post('/ip-restrictions', async (req, res) => {
    try {
        const r = await IPRestriction.create({ id: `ip-${Date.now()}`, ...req.body });
        res.status(201).json(r);
    } catch (e) { addError(e, 'POST /api/ip-restrictions'); res.status(500).json({ error: e.message }); }
});
router.delete('/ip-restrictions/:id', async (req, res) => {
    try {
        const r = await IPRestriction.findByPk(req.params.id);
        if (r) await r.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/ip-restrictions/:id'); res.status(500).json({ error: e.message }); }
});

// ── Audit Logs ───────────────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
    try {
        const userRole = req.user?.role;
        if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Forbidden — Admin access required for Audit Logs.' });
        }
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const logs = await AuditLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: limit
        });
        res.json(logs);
    } catch (e) {
        addError(e, 'GET /api/audit-logs');
        res.status(500).json({ error: e.message });
    }
});

// ── Factory / Data Clear (DANGEROUS) ─────────────────────────────────────────
router.delete('/clear-data', async (req, res) => {
    try {
        const { companyId } = req.body;
        if (!companyId) return res.status(400).json({ error: 'companyId is required for wipe' });

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

router.get('/backup/download/:filename', (req, res) => {
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
router.get('/backup/config', (req, res) => {
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
router.get('/whatsapp/config', (req, res) => {
    const cfg = loadWAConfig();
    res.json({ ...cfg, wabaToken: cfg.wabaToken ? '••••••••' : '' });
});
router.patch('/whatsapp/config', (req, res) => {
    const existing = loadWAConfig();
    const { enabled, phoneNumberId, wabaToken, businessName } = req.body;
    const updated = { enabled: enabled ?? existing.enabled, phoneNumberId: phoneNumberId ?? existing.phoneNumberId, wabaToken: wabaToken && wabaToken !== '••••••••' ? wabaToken : existing.wabaToken, businessName: businessName ?? existing.businessName };
    saveWAConfig(updated);
    res.json({ success: true, message: 'WhatsApp config saved.' });
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

module.exports = { router, init };
