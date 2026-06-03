const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// scheduler.js: Responsible ONLY for updating ScheduledReport.nextRun timestamps.
// Actual report execution is handled exclusively by cronManager.js (00:00 daily cron).
// This separation prevents every report from running twice.

let ScheduledReport, ReportJob;

function init(models) {
    ScheduledReport = models.ScheduledReport;
    ReportJob = models.ReportJob;

    console.log('🔄 Report Scheduler (nextRun updater) initialized.');

    // Every 5 minutes: find schedules whose nextRun is in the past and advance nextRun forward.
    // Does NOT execute the report — that is cronManager.js's job.
    cron.schedule('*/5 * * * *', async () => {
        try {
            const now = new Date();
            const dueReports = await ScheduledReport.findAll({ where: { enabled: true } });

            for (const report of dueReports) {
                const nextRun = report.nextRun ? new Date(report.nextRun) : null;
                if (nextRun && now >= nextRun) {
                    // Advance nextRun to the next scheduled slot
                    const newNextRun = calculateNextRun(report.frequency, report.dayOfWeek, report.dayOfMonth);
                    report.nextRun = newNextRun.toISOString();
                    await report.save();
                    console.log(`📅 nextRun advanced for "${report.name}" → ${report.nextRun}`);
                }
            }
        } catch (error) {
            console.error('❌ Error updating scheduled report nextRun timestamps:', error);
        }
    });
}

function calculateNextRun(frequency, dayOfWeek, dayOfMonth) {
    const next = new Date();

    if (frequency === 'daily') {
        // Always schedule for tomorrow at 08:00 — never today even if current time < 08:00
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0);
    } else if (frequency === 'weekly') {
        const currentDay = next.getDay();
        const targetDay = dayOfWeek !== undefined ? dayOfWeek : 1;
        const daysToAdd = ((targetDay - currentDay + 7) % 7) || 7;
        next.setDate(next.getDate() + daysToAdd);
        next.setHours(8, 0, 0, 0);
    } else if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth || 1);
        next.setHours(8, 0, 0, 0);
    }

    return next;
}

// Safely write a generated report file to disk — marks job as FAILED on write error
async function writeReportFile(jobId, fileName, csvData) {
    const reportsDir = path.join(__dirname, '..', 'generated_reports');
    try {
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        fs.writeFileSync(path.join(reportsDir, fileName), csvData, { encoding: 'utf8' });
        return { success: true };
    } catch (writeErr) {
        console.error(`❌ Failed to write report file ${fileName}:`, writeErr.message);
        if (ReportJob) {
            await ReportJob.update(
                { status: 'FAILED', error: `File write failed: ${writeErr.message}` },
                { where: { id: jobId } }
            ).catch(() => {});
        }
        return { success: false, error: writeErr.message };
    }
}

module.exports = { init, calculateNextRun, writeReportFile };
