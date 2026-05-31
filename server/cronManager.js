const cron = require('node-cron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ScheduledReport, ReportJob, AuditLog, Company, Employee, Attendance } = require('./database');
const { sendEmail } = require('./services/emailService');

function initCronManager() {
    console.log('⏰ Initializing Cron Manager for Scheduled Reports...');

    // Run every day at midnight (00:00) — single authoritative report executor
    // scheduler.js only updates nextRun timestamps; this cron owns actual execution.
    cron.schedule('0 0 * * *', async () => {
        console.log('🔄 Running daily Scheduled Reports check...');
        try {
            const today = new Date();
            const currentDayOfWeek = today.getDay();
            const currentDayOfMonth = today.getDate();

            const schedules = await ScheduledReport.findAll({ where: { enabled: true } });
            const companies = await Company.findAll({ where: { isActive: true }, attributes: ['id'] });
            const companyIdSet = new Set(companies.map(c => c.id));

            for (const schedule of schedules) {
                let shouldRun = false;
                if (schedule.frequency === 'daily') shouldRun = true;
                if (schedule.frequency === 'weekly' && schedule.dayOfWeek === currentDayOfWeek) shouldRun = true;
                if (schedule.frequency === 'monthly' && schedule.dayOfMonth === currentDayOfMonth) shouldRun = true;

                if (!shouldRun) continue;

                // Resolve companyId — use schedule's companyId if set, else skip
                const scheduleCompanyId = schedule.companyId;
                if (!scheduleCompanyId || !companyIdSet.has(scheduleCompanyId)) {
                    console.warn(`⚠️  Scheduled report "${schedule.name}" has no valid companyId — skipping.`);
                    continue;
                }

                console.log(`▶️ Executing scheduled report: ${schedule.name} (${schedule.id}) for company ${scheduleCompanyId}`);
                const jobId = `sched-job-${Date.now()}-${schedule.id}`;

                try {
                    await ReportJob.create({
                        id: jobId,
                        companyId: scheduleCompanyId,
                        requestedBy: schedule.createdBy || 'SYSTEM',
                        reportType: schedule.reportType || 'custom',
                        format: 'csv',
                        payload: JSON.stringify({ scheduleId: schedule.id, columns: [] }),
                    });

                    const workerPath = path.join(__dirname, 'workers', 'reportWorker.js');
                    const worker = new Worker(workerPath, { workerData: { jobId } });

                    worker.on('exit', async (code) => {
                        const success = code === 0;
                        const auditEntry = {
                            id: `audit-${Date.now()}-${jobId}`,
                            companyId: scheduleCompanyId,
                            userId: 'SYSTEM',
                            userName: 'Cron Service',
                            userRole: 'SYSTEM',
                            action: success ? 'SCHEDULED_REPORT_SUCCESS' : 'SCHEDULED_REPORT_FAILED',
                            entityType: 'REPORT',
                            entityId: schedule.id,
                            entityName: schedule.name,
                            details: { jobId, exitCode: code },
                            status: success ? 'SUCCESS' : 'FAILED',
                            timestamp: new Date().toISOString(),
                        };
                        await AuditLog.create(auditEntry).catch(err => console.error('Failed to write audit log:', err));

                        // ── Send email to recipients after successful report generation ──
                        if (success) {
                            try {
                                const recipients = (() => {
                                    try { return typeof schedule.recipients === 'string' ? JSON.parse(schedule.recipients) : (schedule.recipients || []); }
                                    catch { return []; }
                                })();

                                if (recipients.length > 0) {
                                    // Read generated CSV file if it exists
                                    const reportsDir = path.join(__dirname, '..', 'generated_reports');
                                    const fileName = `${schedule.name.replace(/\s+/g, '_')}_${jobId}.csv`;
                                    const filePath = path.join(reportsDir, fileName);

                                    let attachmentData = null;
                                    if (fs.existsSync(filePath)) {
                                        attachmentData = fs.readFileSync(filePath, 'utf8');
                                    }

                                    const subject = `Scheduled Report: ${schedule.name} — ${new Date().toLocaleDateString('en-IN')}`;
                                    const html = `
<h2>Scheduled Report: ${schedule.name}</h2>
<p>Aapka scheduled report generate ho gaya hai.</p>
<ul>
  <li><b>Report Type:</b> ${schedule.reportType}</li>
  <li><b>Frequency:</b> ${schedule.frequency}</li>
  <li><b>Generated At:</b> ${new Date().toLocaleString('en-IN')}</li>
</ul>
${attachmentData
    ? `<p>CSV data neeche attached hai (${attachmentData.split('\n').length - 1} rows).</p><pre style="font-size:12px;background:#f5f5f5;padding:12px;border-radius:4px;max-height:400px;overflow:auto">${attachmentData.slice(0, 2000)}${attachmentData.length > 2000 ? '\n... (truncated)' : ''}</pre>`
    : '<p>Report file alag se download karein.</p>'
}
<p style="color:#888;font-size:12px">SM Payroll System — Automated Report</p>`;

                                    for (const recipient of recipients) {
                                        await sendEmail(recipient, subject, html).catch(err =>
                                            console.warn(`[CronManager] Email to ${recipient} failed:`, err.message)
                                        );
                                    }
                                    console.log(`📧 Report "${schedule.name}" email bheja: ${recipients.join(', ')}`);
                                }
                            } catch (emailErr) {
                                console.error('[CronManager] Report email error:', emailErr.message);
                            }
                        }
                    });

                    schedule.lastRun = new Date();
                    await schedule.save();
                } catch (schedErr) {
                    console.error(`❌ Failed to execute report "${schedule.name}":`, schedErr.message);
                    await AuditLog.create({
                        id: `audit-${Date.now()}-err`,
                        companyId: scheduleCompanyId,
                        userId: 'SYSTEM', userName: 'Cron Service', userRole: 'SYSTEM',
                        action: 'SCHEDULED_REPORT_FAILED',
                        entityType: 'REPORT', entityId: schedule.id, entityName: schedule.name,
                        details: { error: schedErr.message },
                        status: 'FAILED',
                        timestamp: new Date().toISOString(),
                    }).catch(() => {});
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
