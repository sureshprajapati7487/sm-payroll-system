// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let Attendance, PunchLocation, addError, getErrorHint;

function init(models) {
    Attendance = models.Attendance;
    PunchLocation = models.PunchLocation;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// ── Haversine Distance Calculator ─────────────────────────────────────────────
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const dPhi = (lat2 - lat1) * rad;
    const dLambda = (lon2 - lon1) * rad;

    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in meters
}

router.get('/', async (req, res) => {
    const { employeeId, date } = req.query;
    try {
        const where = {};
        // req.companyId enforced by requireCompanyScope middleware (JWT-verified)
        if (req.companyId) where.companyId = req.companyId;
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
    try {
        // Cross-tenant ownership check
        if (req.companyId) {
            const existing = await Attendance.findOne({ where: { id: req.params.id } });
            if (existing && existing.companyId && existing.companyId !== req.companyId) {
                return res.status(403).json({ error: 'Forbidden — cannot modify another company\'s attendance record' });
            }
        }
        await Attendance.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (e) { addError(e, 'PUT /api/attendance/:id'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.delete('/:id', async (req, res) => {
    try {
        // Cross-tenant ownership check
        if (req.companyId) {
            const existing = await Attendance.findOne({ where: { id: req.params.id } });
            if (existing && existing.companyId && existing.companyId !== req.companyId) {
                return res.status(403).json({ error: 'Forbidden — cannot delete another company\'s attendance record' });
            }
        }
        await Attendance.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    }
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

// POST /verify-location (Server-side GPS matching)
router.post('/verify-location', async (req, res) => {
    try {
        const { companyId, lat, lng } = req.body;
        if (!companyId || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'companyId, lat, lng are required' });
        }

        const locations = await PunchLocation.findAll({ where: { companyId, enabled: true } });

        // If no punch locations configured, we cannot fail them — assume valid
        if (!locations || locations.length === 0) {
            return res.json({ valid: true, message: 'No location restrictions configured' });
        }

        let closestDist = Infinity;
        let validLocation = null;

        for (const loc of locations) {
            const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
            if (dist < closestDist) {
                closestDist = dist;
            }
            if (dist <= loc.radiusMeters) {
                validLocation = loc;
                break; // Met requirement for at least one zone
            }
        }

        if (validLocation) {
            return res.json({ valid: true, locationId: validLocation.id, distance: Math.round(closestDist) });
        } else {
            return res.status(403).json({
                valid: false,
                message: `You are ${Math.round(closestDist)}m away. Must be within allowed zone.`,
                distance: Math.round(closestDist)
            });
        }
    } catch (e) {
        addError(e, 'POST /api/attendance/verify-location');
        const h = getErrorHint(e);
        res.status(500).json({ error: e.message, why: h.why, fix: h.fix });
    }
});

module.exports = { router, init };
