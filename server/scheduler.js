const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

let ScheduledReport, Employee, Attendance, SalarySlip, Production;

function init(models) {
    ScheduledReport = models.ScheduledReport;
    Employee = models.Employee;
    Attendance = models.Attendance;
    SalarySlip = models.SalarySlip;
    Production = models.Production;

    console.log('🔄 Report Scheduler initialized.');

    // Run every hour at minute 0 (or every minute for testing)
    // '* * * * *' = every minute. '0 * * * *' = every hour.
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log(`[${new Date().toISOString()}] 🕒 Checking Scheduled Reports...`);
            const now = new Date();

            // Find all enabled schedules where nextRun is due or past due
            const dueReports = await ScheduledReport.findAll({
                where: { enabled: true }
            });

            for (const report of dueReports) {
                const nextRun = report.nextRun ? new Date(report.nextRun) : null;

                // If it's time to run
                if (!nextRun || now >= nextRun) {
                    console.log(`🚀 Executing Scheduled Report: ${report.name} (${report.reportType})`);

                    // 1. Synthesize the CSV Data locally
                    const csvData = await generateReportData(report.reportType);

                    // 2. Save to local disk for record
                    const reportsDir = path.join(__dirname, '..', 'generated_reports');
                    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
                    const fileName = `${report.name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
                    fs.writeFileSync(path.join(reportsDir, fileName), csvData);

                    // 3. Emailing logic would go here (Requires SMTP config)
                    const recipients = (report.recipients && typeof report.recipients === 'string')
                        ? JSON.parse(report.recipients)
                        : (report.recipients || []);
                    console.log(`📧 Simulated sending ${fileName} to: ${recipients.join(', ')}`);

                    // 4. Update lastRun and calculate nextRun
                    report.lastRun = now.toISOString();
                    report.nextRun = calculateNextRun(report.frequency, report.dayOfWeek, report.dayOfMonth).toISOString();
                    await report.save();

                    console.log(`✅ Report ${report.name} completed. Next run scheduled for: ${report.nextRun}`);
                }
            }
        } catch (error) {
            console.error('❌ Error executing scheduled reports:', error);
        }
    });
}

function calculateNextRun(frequency, dayOfWeek, dayOfMonth) {
    const next = new Date();

    if (frequency === 'daily') {
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0); // Default to 8 AM
    }
    else if (frequency === 'weekly') {
        const currentDay = next.getDay();
        const targetDay = dayOfWeek || 1; // Default Monday
        const daysToAdd = targetDay >= currentDay ? targetDay - currentDay : 7 - (currentDay - targetDay);
        next.setDate(next.getDate() + (daysToAdd === 0 ? 7 : daysToAdd));
        next.setHours(8, 0, 0, 0);
    }
    else if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth || 1);
        next.setHours(8, 0, 0, 0);
    }

    return next;
}

async function generateReportData(reportType) {
    // Basic CSV generator based on type
    let csv = '';
    try {
        if (reportType === 'payslip') {
            const slips = await SalarySlip.findAll({ limit: 100 });
            csv = "EmployeeId,Month,BasicSalary,NetSalary\n";
            slips.forEach(s => csv += `${s.employeeId},${s.month},${s.basicSalary},${s.netSalary}\n`);
        }
        else if (reportType === 'attendance') {
            const att = await Attendance.findAll({ limit: 100 });
            csv = "Date,EmployeeId,Status,CheckIn,CheckOut\n";
            att.forEach(a => csv += `${a.date},${a.employeeId},${a.status},${a.checkInTime || '-'},${a.checkOutTime || '-'}\n`);
        }
        else {
            csv = "Column1,Column2\nNo data mapped for this type,0\n";
        }
    } catch (e) {
        csv = "Error,Message\nFailed to generate," + e.message;
    }
    return csv || "Empty,Report\n";
}

module.exports = { init };
