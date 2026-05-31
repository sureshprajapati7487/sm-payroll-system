const cron = require('node-cron');
const { Worker } = require('worker_threads');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ScheduledReport, ReportJob, AuditLog, Company, Employee, Attendance } = require('./database');

function initCronManager() {
    console.log('⏰ Initializing Cron Manager for Scheduled Reports...');

    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('🔄 Running daily Scheduled Reports check...');
        try {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            const currentDayOfWeek = today.getDay(); // 0-6 (Sun-Sat)
            const currentDayOfMonth = today.getDate();

            const schedules = await ScheduledReport.findAll({ where: { enabled: true } });

            for (const schedule of schedules) {
                let shouldRun = false;

                // Basic frequency matching
                if (schedule.frequency === 'daily') shouldRun = true;
                if (schedule.frequency === 'weekly' && schedule.dayOfWeek === currentDayOfWeek) shouldRun = true;
                if (schedule.frequency === 'monthly' && schedule.dayOfMonth === currentDayOfMonth) shouldRun = true;

                if (shouldRun) {
                    console.log(`▶️ Executing scheduled report: ${schedule.name} (${schedule.id})`);

                    // Create Background Job
                    const jobId = `sched-job-${Date.now()}`;
                    await ReportJob.create({
                        id: jobId,
                        companyId: 'c1', // Assume system-wide or modify to grab from schedule
                        requestedBy: schedule.createdBy || 'SYSTEM',
                        reportType: schedule.reportType || 'custom',
                        format: 'csv',
                        payload: JSON.stringify({
                            columns: [{ label: "ID", field: "id" }, { label: "Name", field: "name" }] // Real impl requires saved template columns
                        })
                    });

                    const workerPath = path.join(__dirname, 'workers', 'reportWorker.js');
                    const worker = new Worker(workerPath, { workerData: { jobId } });

                    worker.on('exit', async (code) => {
                        if (code !== 0) {
                            await AuditLog.create({
                                id: `audit-${Date.now()}`,
                                companyId: 'c1',
                                action: 'SCHEDULED_REPORT_FAILED',
                                details: `Report ${schedule.name} failed with exit code ${code}`,
                                performedBy: 'SYSTEM'
                            });
                        } else {
                            await AuditLog.create({
                                id: `audit-${Date.now()}`,
                                companyId: 'c1',
                                action: 'SCHEDULED_REPORT_SUCCESS',
                                details: `Report ${schedule.name} generated successfully.`,
                                performedBy: 'SYSTEM'
                            });
                        }
                    });

                    // Update next run
                    schedule.lastRun = new Date();
                    await schedule.save();
                }
            }
        } catch (error) {
            console.error('❌ Error running scheduled reports cron:', error);
        }
    });

    // ── P1-05: Auto-Absent — runs daily at 23:59 ──────────────────────────────
    cron.schedule('59 23 * * *', async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`🕐 [Auto-Absent] Running for ${today}...`);
        try {
            const companies = await Company.findAll({ where: { isActive: true } });

            for (const company of companies) {
                const companyId = company.id;

                const activeEmployees = await Employee.findAll({
                    where: { companyId, status: 'ACTIVE' },
                    attributes: ['id'],
                });

                const existingRecords = await Attendance.findAll({
                    where: { companyId, date: today },
                    attributes: ['employeeId'],
                });

                const recordedIds = new Set(existingRecords.map(a => a.employeeId));
                const absentEmployees = activeEmployees.filter(e => !recordedIds.has(e.id));

                for (const emp of absentEmployees) {
                    await Attendance.create({
                        id: uuidv4(),
                        employeeId: emp.id,
                        companyId,
                        date: today,
                        status: 'ABSENT',
                    });
                }

                if (absentEmployees.length > 0) {
                    console.log(`🕐 Auto-absent marked for ${absentEmployees.length} employees on ${today} (company: ${companyId})`);
                }
            }
        } catch (error) {
            console.error('❌ Error in auto-absent cron:', error);
        }
    });
}

module.exports = { initCronManager };
