// ── CLIENT + CLIENT VISIT ROUTES ──────────────────────────────────────────────
const express = require('express');
const router = express.Router();  // mounted at /api/clients in index.js
const visitsRouter = express.Router();  // mounted at /api/visits  in index.js
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

let Client, ClientVisit, sequelize, addError, getErrorHint;

// Helper: haversine distance in metres
function gpsDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return null;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Helper: build CSV with BOM
function buildCSV(headers, rows) {
    const escape = v => { const s = String(v ?? ''); return (s.includes(',') || s.includes('\n') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s; };
    const toRow = arr => arr.map(escape).join(',');
    return '\uFEFF' + [toRow(headers), ...rows.map(toRow)].join('\r\n');
}

function init(models) {
    Client = models.Client;
    ClientVisit = models.ClientVisit;
    sequelize = models.sequelize;
    addError = models.addError;
    getErrorHint = models.getErrorHint;
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT ROUTES — mounted at /api/clients
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/clients/export — download CSV
router.get('/export', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
        if (req.query.status && req.query.status !== 'ALL') where.status = req.query.status;
        const clients = await Client.findAll({ where, order: [['name', 'ASC']] });
        const headers = ['Code', 'Party Name', 'Shop Name', 'Owner Name', 'Mobile', 'Alt Mobile', 'Email', 'Category', 'Type', 'Status', 'Address', 'City', 'State', 'Pincode', 'Assigned To', 'Total Visits', 'Last Visit', 'Next Visit', 'Avg Visit (mins)', 'GPS Latitude', 'GPS Longitude', 'Credit Limit (Rs)', 'Outstanding (Rs)', 'Notes'];
        const rows = clients.map(c => [c.code, c.name, c.shopName, c.ownerName, c.phone, c.phone2, c.email, c.category, c.type, c.status, c.address, c.city, c.state, c.pincode, c.assignedToName, c.totalVisits || 0, c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('en-IN') : '', c.nextVisitDate || '', c.avgVisitMins || 0, c.latitude || '', c.longitude || '', c.creditLimit || 0, c.outstandingAmount || 0, c.notes || '']);
        const date = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="clients_${date}.csv"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(buildCSV(headers, rows));
    } catch (e) { addError(e, 'GET /api/clients/export'); res.status(500).json({ error: e.message }); }
});

// GET /api/clients/demo-export — sample CSV for import
router.get('/demo-export', (req, res) => {
    const headers = ['name', 'shopName', 'ownerName', 'phone', 'phone2', 'address', 'city', 'state', 'pincode', 'type', 'category', 'notes'];
    const demo = [
        ['Sharma Traders', 'Sharma General Store', 'Ramesh Sharma', '9876543210', '9876543211', 'Shop 12, Gandhi Nagar', 'Ahmedabad', 'Gujarat', '380009', 'RETAIL', 'Grocery', 'Regular customer'],
        ['Patel Wholesale', 'Patel Mart', 'Suresh Patel', '9988776655', '', 'Plot 5, GIDC', 'Surat', 'Gujarat', '395004', 'WHOLESALE', 'FMCG', 'Big order monthly'],
        ['Verma Medicals', 'Verma Pharmacy', 'Anil Verma', '9911223344', '9911223345', 'Near Bus Stand', 'Vadodara', 'Gujarat', '390001', 'RETAIL', 'Pharmacy', 'Cash buyer'],
        ['Singh Distributors', 'Singh & Co.', 'Harjeet Singh', '9877665544', '', 'Warehouse No 8, Phase 2', 'Rajkot', 'Gujarat', '360001', 'DISTRIBUTOR', 'Electronics', ''],
        ['Mehta Institutions', 'St. Mary School', 'Prakash Mehta', '9800011122', '', 'School Road, Sector 4', 'Gandhinagar', 'Gujarat', '382010', 'INSTITUTION', 'Education', 'Annual contract'],
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="demo_clients_import.csv"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buildCSV(headers, demo));
});

// GET /api/clients
router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
        if (req.query.status) where.status = req.query.status;
        res.json(await Client.findAll({ where, order: [['name', 'ASC']] }));
    } catch (e) { addError(e, 'GET /api/clients'); res.status(500).json({ error: e.message }); }
});

// POST /api/clients
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        if (!data.code) {
            const count = await Client.count({ where: { companyId: data.companyId } });
            data.code = `C-${String(count + 1).padStart(4, '0')}`;
        }
        const client = await Client.create({ id: data.id || uuidv4(), ...data });
        res.status(201).json(client);
    } catch (e) { addError(e, 'POST /api/clients'); res.status(500).json({ error: e.message }); }
});

// POST /api/clients/bulk
router.post('/bulk', async (req, res) => {
    try {
        const { clients, companyId } = req.body;
        if (!Array.isArray(clients) || !companyId) return res.status(400).json({ error: 'clients[] and companyId required' });
        const rows = clients.map((c, i) => ({ id: c.id || uuidv4(), companyId, code: c.code || `C-${String(i + 1).padStart(4, '0')}`, ...c }));
        const result = await Client.bulkCreate(rows, { ignoreDuplicates: true });
        res.json({ inserted: result.length, total: rows.length });
    } catch (e) { addError(e, 'POST /api/clients/bulk'); res.status(500).json({ error: e.message }); }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.update(req.body);
        res.json(client);
    } catch (e) { addError(e, 'PUT /api/clients/:id'); res.status(500).json({ error: e.message }); }
});

// PATCH /api/clients/:id/location
router.patch('/:id/location', async (req, res) => {
    try {
        const { latitude, longitude, setBy } = req.body;
        if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude required' });
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.update({ latitude, longitude, locationSetAt: new Date().toISOString(), locationSetBy: setBy });
        res.json({ success: true, client });
    } catch (e) { addError(e, 'PATCH /api/clients/:id/location'); res.status(500).json({ error: e.message }); }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return res.status(404).json({ error: 'Client not found' });
        await client.destroy();
        res.json({ success: true });
    } catch (e) { addError(e, 'DELETE /api/clients/:id'); res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// VISIT ROUTES — mounted at /api/visits  (frontend uses /api/visits/...)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/visits
visitsRouter.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.companyId) where.companyId = req.query.companyId;
        if (req.query.clientId) where.clientId = req.query.clientId;
        if (req.query.salesmanId) where.salesmanId = req.query.salesmanId;
        if (req.query.date) where.checkInAt = { [Op.like]: `${req.query.date}%` };
        res.json(await ClientVisit.findAll({ where, order: [['checkInAt', 'DESC']] }));
    } catch (e) { addError(e, 'GET /api/visits'); res.status(500).json({ error: e.message }); }
});

// POST /api/visits/checkin
visitsRouter.post('/checkin', async (req, res) => {
    try {
        const { companyId, clientId, salesmanId, salesmanName, checkInLat, checkInLng, purpose, notes } = req.body;
        if (!companyId || !clientId || !salesmanId) return res.status(400).json({ error: 'companyId, clientId, salesmanId required' });
        const open = await ClientVisit.findOne({ where: { salesmanId, checkOutAt: null } });
        if (open) return res.status(400).json({ error: 'Already checked in at another client. Please check-out first.', openVisit: open });
        const client = await Client.findByPk(clientId);
        const visitCount = await ClientVisit.count({ where: { clientId, salesmanId } });
        const distanceFromClient = client ? gpsDistance(checkInLat, checkInLng, client.latitude, client.longitude) : null;
        const visit = await ClientVisit.create({
            id: uuidv4(), companyId, clientId, salesmanId, salesmanName,
            checkInAt: new Date().toISOString(), checkInLat, checkInLng,
            distanceFromClient, purpose: purpose || 'SALES', notes, visitNumber: visitCount + 1,
        });
        if (client) await client.update({ lastVisitAt: new Date().toISOString() });
        res.status(201).json({ success: true, visit, distanceFromClient });
    } catch (e) { addError(e, 'POST /api/visits/checkin'); res.status(500).json({ error: e.message }); }
});

// POST /api/visits/:id/checkout
visitsRouter.post('/:id/checkout', async (req, res) => {
    try {
        const { checkOutLat, checkOutLng, outcome, orderAmount, collectionAmount, notes, nextVisitDate } = req.body;
        const visit = await ClientVisit.findByPk(req.params.id);
        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        if (visit.checkOutAt) return res.status(400).json({ error: 'Already checked out' });
        const checkOutAt = new Date().toISOString();
        const durationMins = (new Date(checkOutAt) - new Date(visit.checkInAt)) / 60000;
        await visit.update({ checkOutAt, checkOutLat, checkOutLng, durationMins: Math.round(durationMins), outcome, orderAmount: orderAmount || 0, collectionAmount: collectionAmount || 0, notes: notes || visit.notes, nextVisitDate });
        const client = await Client.findByPk(visit.clientId);
        if (client) {
            const allVisits = await ClientVisit.findAll({ where: { clientId: visit.clientId }, attributes: ['durationMins'] });
            const avg = allVisits.reduce((s, v) => s + (v.durationMins || 0), 0) / allVisits.length;
            await client.update({ totalVisits: allVisits.length, avgVisitMins: Math.round(avg), nextVisitDate: nextVisitDate || client.nextVisitDate });
        }
        res.json({ success: true, visit, durationMins: Math.round(durationMins) });
    } catch (e) { addError(e, 'POST /api/visits/:id/checkout'); res.status(500).json({ error: e.message }); }
});

// GET /api/visits/active/:salesmanId
visitsRouter.get('/active/:salesmanId', async (req, res) => {
    try {
        const visit = await ClientVisit.findOne({ where: { salesmanId: req.params.salesmanId, checkOutAt: null } });
        if (!visit) return res.json(null);
        const client = await Client.findByPk(visit.clientId);
        res.json({ visit, client });
    } catch (e) { addError(e, 'GET /api/visits/active/:salesmanId'); res.status(500).json({ error: e.message }); }
});

// GET /api/visits/stats/:salesmanId
visitsRouter.get('/stats/:salesmanId', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = await ClientVisit.count({ where: { salesmanId: req.params.salesmanId, checkInAt: { [Op.like]: `${today}%` } } });
        const totalVisits = await ClientVisit.count({ where: { salesmanId: req.params.salesmanId } });
        const totalClients = await Client.count({ where: { assignedTo: req.params.salesmanId } });
        const totalOrders = await ClientVisit.sum('orderAmount', { where: { salesmanId: req.params.salesmanId } });
        const totalCollection = await ClientVisit.sum('collectionAmount', { where: { salesmanId: req.params.salesmanId } });
        const avgDuration = await ClientVisit.findOne({ where: { salesmanId: req.params.salesmanId }, attributes: [[sequelize.fn('AVG', sequelize.col('durationMins')), 'avg']] });
        const overdueClients = await Client.count({ where: { assignedTo: req.params.salesmanId, nextVisitDate: { [Op.lt]: today }, status: 'ACTIVE' } });
        res.json({
            todayVisits, totalVisits, totalClients,
            totalOrders: totalOrders || 0, totalCollection: totalCollection || 0,
            avgDurationMins: Math.round(avgDuration?.dataValues?.avg || 0),
            overdueClients,
        });
    } catch (e) { addError(e, 'GET /api/visits/stats/:salesmanId'); res.status(500).json({ error: e.message }); }
});

module.exports = { router, visitsRouter, init };
