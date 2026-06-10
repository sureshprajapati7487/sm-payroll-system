// ── ATTENDANCE ROUTES ─────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireRole } = require('../rbac');

let Attendance, PunchLocation, SystemSetting, Shift, addError, getErrorHint;

function init(models) {
    Attendance = models.Attendance;
    PunchLocation = models.PunchLocation;
    SystemSetting = models.SystemSetting;
    Shift = models.Shift;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// Late minutes = how many minutes past shift start (accounting for grace), 0 if on time
function calcLateMinutes(checkInISO, startTime, graceMinutes) {
    try {
        const checkIn = new Date(checkInISO);
        const [h, m] = startTime.split(':').map(Number);
        const shiftStart = new Date(checkIn);
        shiftStart.setHours(h, m, 0, 0);
        const graceEnd = new Date(shiftStart.getTime() + (graceMinutes || 15) * 60000);
        if (checkIn > graceEnd) return Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000);
    } catch { /* ignore */ }
    return 0;
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
    const { employeeId, date, startDate, endDate } = req.query;
    try {
        const { Op } = require('sequelize');
        const where = {};
        // req.companyId enforced by requireCompanyScope middleware (JWT-verified)
        if (req.companyId) where.companyId = req.companyId;
        if (employeeId) where.employeeId = employeeId;
        if (date) {
            where.date = date;
        } else if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) dateFilter[Op.gte] = startDate;
            if (endDate) dateFilter[Op.lte] = endDate;
            where.date = dateFilter;
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;
        const { count, rows } = await Attendance.findAndCountAll({
            where,
            order: [['date', 'DESC']],
            limit,
            offset,
        });
        res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) });
    } catch (e) { addError(e, 'GET /api/attendance'); const h = getErrorHint(e); res.status(500).json({ error: e.message, why: h.why, fix: h.fix }); }
});

router.post('/', async (req, res) => {
    try {
        const body = { ...req.body };
        if (req.companyId) body.companyId = req.companyId;

        if (!body.employeeId || !body.date) {
            return res.status(400).json({ error: 'employeeId and date are required' });
        }

        // Regular employees can only create/update their own records
        const isPrivileged = req.user && ['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER'].includes(req.user.role);
        if (!isPrivileged && body.employeeId && body.employeeId !== req.user?.id) {
            return res.status(403).json({ error: 'Forbidden — you can only manage your own attendance records' });
        }
        // Generate server-side ID if client didn't provide one
        if (!body.id) body.id = `att-${Date.now()}-${uuidv4().substring(0, 8)}`;
        // Normalize: breaks must be a JSON string (SQLite stores as TEXT)
        if (body.breaks !== undefined && typeof body.breaks !== 'string') {
            body.breaks = JSON.stringify(body.breaks);
        }
        // Strip Sequelize auto-managed timestamps from upsert body
        delete body.createdAt;
        delete body.updatedAt;
        const [instance] = await Attendance.upsert(body);
        res.json(instance.toJSON());
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
        // Normalize body: stringify arrays/objects for TEXT columns, strip Sequelize timestamps
        const body = { ...req.body };
        if (body.breaks !== undefined && typeof body.breaks !== 'string') {
            body.breaks = JSON.stringify(body.breaks);
        }
        // Remove read-only fields that Sequelize manages
        delete body.createdAt;
        delete body.updatedAt;
        await Attendance.update(body, { where: { id: req.params.id } });
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

// POST /attendance/admin-punch — admin/manager only
router.post('/admin-punch', requireRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNT_ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const { employeeId, type, time, reason, adminName, shiftId } = req.body;
        if (!employeeId || !type || !time || !reason || !adminName) {
            return res.status(400).json({ error: 'employeeId, type, time, reason, adminName are required' });
        }
        const today = time.split('T')[0];
        const companyWhere = req.companyId ? { employeeId, date: today, companyId: req.companyId } : { employeeId, date: today };
        let record = await Attendance.findOne({ where: companyWhere });

        if (type === 'checkIn') {
            // Resolve shift for late calculation: use shiftId from request body, or existing record
            const resolvedShiftId = shiftId || record?.shiftId;
            let lateByMinutes = 0;
            let checkInStatus = 'PRESENT';
            if (resolvedShiftId) {
                try {
                    const shift = await Shift.findOne({ where: { id: resolvedShiftId } });
                    if (shift) {
                        lateByMinutes = calcLateMinutes(time, shift.startTime, shift.graceTimeMinutes);
                        checkInStatus = lateByMinutes > 0 ? 'LATE' : 'PRESENT';
                    }
                } catch { /* keep defaults */ }
            }
            const payload = {
                checkIn: time, lateByMinutes, status: checkInStatus,
                isManualPunch: true, manualPunchBy: adminName, manualPunchReason: reason, punchMode: 'admin',
            };
            if (record) {
                await Attendance.update(payload, { where: { id: record.id } });
                res.json({ success: true, id: record.id, ...payload });
            } else {
                const newRec = await Attendance.create({ id: `manual-${uuidv4()}`, employeeId, date: today, companyId: req.companyId || null, overtimeHours: 0, breaks: '[]', shiftId: resolvedShiftId || null, ...payload });
                res.json({ success: true, ...newRec.toJSON() });
            }
        } else if (type === 'checkOut' && record) {
            const checkIn = record.checkIn ? new Date(record.checkIn) : new Date(time);
            const diffH = (new Date(time).getTime() - checkIn.getTime()) / 3600000;
            let stdHours = 9;
            try {
                const cfg = await SystemSetting.findOne({ where: { companyId: req.companyId, key: 'PAYROLL_CONFIG' } });
                if (cfg?.value) stdHours = JSON.parse(cfg.value).standardWorkHours || 9;
            } catch { /* use default 9 */ }
            const overtimeHours = parseFloat((diffH > stdHours ? diffH - stdHours : 0).toFixed(2));
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

// POST /verify-location (Server-side GPS matching) — authentication enforced globally
// companyId comes from JWT (req.companyId) not from body — prevents cross-tenant location leaks
router.post('/verify-location', async (req, res) => {
    try {
        const { lat, lng } = req.body;
        // companyId always from JWT session — never trust client-supplied value
        const companyId = req.companyId;
        if (!companyId || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'lat and lng are required (companyId comes from session)' });
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
