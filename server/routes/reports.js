const express = require('express');
const router = express.Router();
const { requireRole } = require('../rbac');

let CustomReportTemplate, ScheduledReport, Employee;

function init(models) {
    CustomReportTemplate = models.CustomReportTemplate;
    ScheduledReport = models.ScheduledReport;
    Employee = models.Employee;
}

// --- Custom Report Templates ---

// Get all templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await CustomReportTemplate.findAll();
        // Parse JSON strings back to objects
        const parsed = templates.map(t => {
            const data = t.toJSON();
            try { data.columns = JSON.parse(data.columns); } catch (e) { data.columns = []; }
            try { data.filters = JSON.parse(data.filters); } catch (e) { data.filters = []; }
            return data;
        });
        res.json(parsed);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Create new template
router.post('/templates', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { name, description, columns, filters } = req.body;
        const newTemplate = await CustomReportTemplate.create({
            id: `tpl-${Date.now()}`,
            name,
            description,
            columns: JSON.stringify(columns || []),
            filters: JSON.stringify(filters || [])
        });

        const data = newTemplate.toJSON();
        data.columns = columns || [];
        data.filters = filters || [];

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Delete template
router.delete('/templates/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        await CustomReportTemplate.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// --- Scheduled Reports ---

// Get all schedules
router.get('/schedules', async (req, res) => {
    try {
        const schedules = await ScheduledReport.findAll();
        const parsed = schedules.map(s => {
            const data = s.toJSON();
            try { data.recipients = JSON.parse(data.recipients); } catch (e) { data.recipients = []; }
            return data;
        });
        res.json(parsed);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// Create new schedule
router.post('/schedules', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { name, reportType, frequency, dayOfWeek, dayOfMonth, recipients, enabled, nextRun, createdBy } = req.body;

        const newSchedule = await ScheduledReport.create({
            id: `sched-${Date.now()}`,
            name,
            reportType,
            frequency,
            dayOfWeek,
            dayOfMonth,
            recipients: JSON.stringify(recipients || []),
            enabled: enabled !== undefined ? enabled : true,
            nextRun,
            createdBy
        });

        const data = newSchedule.toJSON();
        data.recipients = recipients || [];
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

// Toggle schedule status
router.patch('/schedules/:id/toggle', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const schedule = await ScheduledReport.findByPk(req.params.id);
        if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

        schedule.enabled = !schedule.enabled;
        await schedule.save();
        res.json({ enabled: schedule.enabled });
    } catch (error) {
        console.error('Error toggling schedule:', error);
        res.status(500).json({ error: 'Failed to toggle schedule' });
    }
});

// Delete schedule
router.delete('/schedules/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        await ScheduledReport.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

// --- Report Generation ---
const { Worker } = require('worker_threads');
const path = require('path');

let ReportJob; // Will be initialized from models

router.post('/generate', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { columns, format } = req.body;
        const companyId = req.user.companyId;

        if (!ReportJob) ReportJob = require('../database').ReportJob; // Lazy load if init not grabbed it

        if (format === 'preview') {
            // Synchronous quick preview
            const employees = await Employee.findAll({ where: { companyId }, limit: 5 });
            let csv = '';
            if (columns && columns.length > 0) {
                csv += columns.map(c => c.label).join(',') + '\n';
                for (let i = 0; i < employees.length; i++) {
                    const row = columns.map(c => `"${employees[i][c.field] || ''}"`);
                    csv += row.join(',') + '\n';
                }
            } else {
                csv = "Error\nNo columns selected\n";
            }
            const rows = csv.split('\n').filter(r => r.trim() !== '').map(row => row.split(',').map(v => v.replace(/(^"|"$)/g, '')));
            return res.json({ data: rows });
        }

        // Asynchronous Background Job
        const jobId = `job-${Date.now()}`;
        const job = await ReportJob.create({
            id: jobId,
            companyId,
            requestedBy: req.user.id,
            reportType: 'custom',
            format: format || 'csv',
            payload: JSON.stringify(req.body)
        });

        // Spawn Worker
        const workerPath = path.join(__dirname, '..', 'workers', 'reportWorker.js');
        const worker = new Worker(workerPath, { workerData: { jobId } });

        // Optional: listen to messages if needed, but worker writes to DB anyway
        worker.on('error', (err) => console.error('Worker thread error:', err));
        worker.on('exit', (code) => { if (code !== 0) console.error(`Worker stopped with exit code ${code}`) });

        res.status(202).json({
            message: 'Report generation started in background',
            jobId
        });

    } catch (error) {
        console.error('Error starting report job:', error);
        res.status(500).json({ error: 'Failed to start report job' });
    }
});

// Get Background Job Status
router.get('/jobs/:jobId', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        if (!ReportJob) ReportJob = require('../database').ReportJob;
        const job = await ReportJob.findByPk(req.params.jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});

router.get('/download', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
    try {
        const { type } = req.query;
        let csv = "EmployeeId,Name,Details\n";
        const employees = await Employee.findAll({ limit: 20 });
        employees.forEach(e => csv += `${e.id},${e.name},${type} data\n`);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${Date.now()}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Error downloading report:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
});

module.exports = { router, init };
