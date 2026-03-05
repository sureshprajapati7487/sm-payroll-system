// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let Attendance, addError, getErrorHint;

function init(models) {
    Attendance = models.Attendance;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

router.get('/', async (req, res) => {
    const { companyId, employeeId, date } = req.query;
    try {
        const where = {};
        if (companyId) where.companyId = companyId;
        if (employeeId) where.employeeId = employeeId;
        if (date) where.date = date;
        res.json(await Attendance.findAll({ where }));
    } catch (e) { addError(e, 'GET /api/attendance'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/', async (req, res) => {
    try {
        const record = await Attendance.upsert(req.body);
        res.json(record);
    } catch (e) { addError(e, 'POST /api/attendance'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.put('/:id', async (req, res) => {
    try { await Attendance.update(req.body, { where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'PUT /api/attendance/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.delete('/:id', async (req, res) => {
    try { await Attendance.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (e) { addError(e, 'DELETE /api/attendance/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

// POST /attendance/:id/break
router.post('/:id/break', async (req, res) => {
    try {
        const { action } = req.body;
        if (!action || !['start', 'end'].includes(action)) {
            return res.status(400).json({ error: 'action must be "start" or "end"' });
        }
        const record = await Attendance.findOne({ where: { id: req.params.id } });
        if (!record) return res.status(404).json({ error: 'Attendance record not found' });

        let breaks = [];
        try { breaks = record.breaks ? (typeof record.breaks === 'string' ? JSON.parse(record.breaks) : record.breaks) : []; }
        catch { breaks = []; }

        const now = new Date().toISOString();
        if (action === 'start') {
            const active = breaks.find(b => !b.end);
            if (active) return res.status(409).json({ error: 'Break already in progress' });
            breaks.push({ start: now });
        } else {
            const activeIdx = breaks.findIndex(b => !b.end);
            if (activeIdx === -1) return res.status(409).json({ error: 'No active break to end' });
            breaks[activeIdx].end = now;
        }
        await Attendance.update({ breaks: JSON.stringify(breaks) }, { where: { id: req.params.id } });
        res.json({ success: true, breaks });
    } catch (e) {
        addError(e, 'POST /api/attendance/:id/break');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

// POST /attendance/admin-punch
router.post('/admin-punch', async (req, res) => {
    try {
        const { employeeId, type, time, reason, adminName, shiftId } = req.body;
        if (!employeeId || !type || !time || !reason || !adminName) {
            return res.status(400).json({ error: 'employeeId, type, time, reason, adminName are required' });
        }
        const today = time.split('T')[0];
        let record = await Attendance.findOne({ where: { employeeId, date: today } });

        if (type === 'checkIn') {
            const payload = { checkIn: time, isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason, punchMode: 'admin' };
            if (record) {
                await Attendance.update(payload, { where: { id: record.id } });
                res.json({ success: true, id: record.id, ...payload });
            } else {
                const newRec = await Attendance.create({ id: `manual-${uuidv4()}`, employeeId, date: today, status: 'PRESENT', shiftId: shiftId || null, lateByMinutes: 0, overtimeHours: 0, breaks: '[]', ...payload });
                res.json({ success: true, ...newRec.toJSON() });
            }
        } else if (type === 'checkOut' && record) {
            const checkIn = record.checkIn ? new Date(record.checkIn) : new Date(time);
            const diffH = (new Date(time).getTime() - checkIn.getTime()) / 3600000;
            const overtimeHours = parseFloat((diffH > 9 ? diffH - 9 : 0).toFixed(2));
            const payload = { checkOut: time, overtimeHours, isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason };
            await Attendance.update(payload, { where: { id: record.id } });
            res.json({ success: true, id: record.id, ...payload });
        } else if ((type === 'breakStart' || type === 'breakEnd') && record) {
            let breaks = [];
            try { breaks = record.breaks ? (typeof record.breaks === 'string' ? JSON.parse(record.breaks) : record.breaks) : []; }
            catch { breaks = []; }
            if (type === 'breakStart') { breaks.push({ start: time }); }
            else { const idx = breaks.findIndex(b => !b.end); if (idx !== -1) breaks[idx].end = time; }
            await Attendance.update({ breaks: JSON.stringify(breaks) }, { where: { id: record.id } });
            res.json({ success: true, breaks });
        } else {
            res.status(400).json({ error: `Cannot perform "${type}" — no matching record or invalid type` });
        }
    } catch (e) {
        addError(e, 'POST /api/attendance/admin-punch');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

module.exports = { router, init };
