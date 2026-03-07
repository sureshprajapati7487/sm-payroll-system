const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { sequelize, Employee, ReportJob } = require('../database'); // Adjust path as needed

async function processJob(jobId) {
    try {
        const job = await ReportJob.findByPk(jobId);
        if (!job) throw new Error('Job not found');

        await job.update({ status: 'PROCESSING', progress: 10 });

        const payload = JSON.parse(job.payload || '{}');
        const columns = payload.columns || [];
        const format = job.format || 'csv';
        const companyId = job.companyId;

        if (format !== 'csv') {
            await job.update({ status: 'FAILED', error: 'Only CSV is supported currently in background worker.' });
            return;
        }

        if (!columns || columns.length === 0) {
            await job.update({ status: 'FAILED', error: 'No columns selected' });
            return;
        }

        await job.update({ progress: 20 });

        // Query database independently
        // In reality you would use payload.filters extensively
        const employees = await Employee.findAll({ where: { companyId } });

        await job.update({ progress: 50 });

        let csv = columns.map(c => c.label).join(',') + '\n';
        for (let i = 0; i < employees.length; i++) {
            const row = columns.map(c => `"${employees[i][c.field] || ''}"`);
            csv += row.join(',') + '\n';
        }

        await job.update({ progress: 80 });

        // Ensure downloads directory exists
        const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const fileName = `report_${jobId}.csv`;
        const filePath = path.join(downloadsDir, fileName);

        fs.writeFileSync(filePath, csv);

        await job.update({
            status: 'COMPLETED',
            progress: 100,
            downloadUrl: `/downloads/${fileName}`
        });

        if (parentPort) parentPort.postMessage({ jobId, status: 'COMPLETED' });

    } catch (error) {
        console.error(`Worker error for job ${jobId}:`, error);
        await ReportJob.update(
            { status: 'FAILED', error: error.message },
            { where: { id: jobId } }
        );
        if (parentPort) parentPort.postMessage({ jobId, status: 'FAILED', error: error.message });
    }
}

if (workerData && workerData.jobId) {
    processJob(workerData.jobId).then(() => {
        process.exit(0);
    });
}
