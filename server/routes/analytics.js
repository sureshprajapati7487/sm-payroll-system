const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

let Employee, Attendance, Production, Loan, SalarySlip, Leave, addError;

function init(models) {
    Employee = models.Employee;
    Attendance = models.Attendance;
    Production = models.Production;
    Loan = models.Loan;
    SalarySlip = models.SalarySlip;
    Leave = models.Leave;
    addError = models.addError;
}

// Simple in-memory cache for Dashboard KPIs (60s TTL)
const dashboardCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

router.get('/dashboard', async (req, res) => {
    try {
        const { companyId, month } = req.query;
        if (!companyId || !month) return res.status(400).json({ error: 'companyId and month queries are required' });

        const cacheKey = `${companyId}_${month}`;
        const cached = dashboardCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        const today = new Date().toISOString().split('T')[0];

        // 1. Employee Stats
        const companyEmployees = await Employee.findAll({
            where: { companyId },
            attributes: ['id', 'status', 'department']
        });

        const totalEmployees = companyEmployees.length;
        const activeEmployees = companyEmployees.filter(e => e.status === 'ACTIVE').length;
        const empIds = companyEmployees.map(e => e.id);

        if (empIds.length === 0) {
            return res.json({
                totalStaff: 0, activeStaff: 0,
                attendancePercentage: 0, presentedCount: 0, absentToday: 0,
                monthProduction: 0, momChange: null,
                totalOutstandingLoans: 0, activeLoansCount: 0,
                pendingLeaves: 0, pendingProduction: 0, pendingLoans: 0,
                netPayrollThisMonth: 0, slipsGenerated: 0,
                attendanceTrendData: [], productionData: [], payrollDistribution: []
            });
        }

        // 2. Attendance (Today)
        const todayRecords = await Attendance.findAll({
            where: { date: today, employeeId: { [Op.in]: empIds } },
            attributes: ['status']
        });
        const presentedCount = todayRecords.filter(r => ['PRESENT', 'LATE', 'HALF_DAY'].includes(r.status)).length;
        const absentToday = activeEmployees - presentedCount;
        const attendancePercentage = activeEmployees > 0 ? Math.round((presentedCount / activeEmployees) * 100) : 0;

        // 3. Production (MoM)
        const currentMonthEntries = await Production.findAll({
            where: { date: { [Op.like]: `${month}%` }, employeeId: { [Op.in]: empIds } },
            attributes: ['totalAmount', 'status', 'employeeId', 'qty']
        });
        const monthProduction = currentMonthEntries.reduce((sum, p) => sum + p.totalAmount, 0);

        const prevMonthDate = new Date(`${month}-01`);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonth = prevMonthDate.toISOString().slice(0, 7);
        const prevMonthEntries = await Production.findAll({
            where: { date: { [Op.like]: `${prevMonth}%` }, employeeId: { [Op.in]: empIds } },
            attributes: ['totalAmount']
        });
        const prevMonthProduction = prevMonthEntries.reduce((sum, p) => sum + p.totalAmount, 0);
        const momChange = prevMonthProduction > 0
            ? parseFloat((((monthProduction - prevMonthProduction) / prevMonthProduction) * 100).toFixed(1))
            : null;

        // 4. Loans
        const activeLoans = await Loan.findAll({
            where: { companyId, status: 'ACTIVE' },
            attributes: ['balance']
        });
        const totalOutstandingLoans = activeLoans.reduce((sum, l) => sum + l.balance, 0);

        // 5. Approvals payload
        const pendingLeaves = await Leave.count({ where: { status: 'PENDING', companyId } });
        const pendingProduction = currentMonthEntries.filter(p => p.status === 'PENDING').length;
        const pendingLoans = await Loan.count({ where: { status: 'REQUESTED', companyId } });

        // 6. Payroll
        const monthSlips = await SalarySlip.findAll({
            where: { month, companyId },
            attributes: ['netSalary', 'basicSalary', 'productionAmount', 'overtimeAmount']
        });
        const netPayrollThisMonth = monthSlips.reduce((sum, s) => sum + s.netSalary, 0);
        const slipsGenerated = monthSlips.length;

        // 7. Attendance Trend (Last 7 Days)
        const attendanceTrendData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const present = await Attendance.count({
                where: { date: dateStr, employeeId: { [Op.in]: empIds }, status: { [Op.in]: ['PRESENT', 'LATE'] } }
            });
            attendanceTrendData.push({
                name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                present,
                total: activeEmployees
            });
        }

        // 8. Production by Department
        const deptProduction = {};
        companyEmployees.forEach(emp => {
            if (emp.department) deptProduction[emp.department] = 0;
        });
        currentMonthEntries.forEach(entry => {
            const emp = companyEmployees.find(e => e.id === entry.employeeId);
            if (emp && emp.department) {
                deptProduction[emp.department] += entry.qty;
            }
        });
        const productionData = Object.keys(deptProduction).map(dept => ({
            name: dept,
            units: deptProduction[dept]
        })).filter(d => d.units > 0);

        // 9. Payroll Distribution
        const basicTotal = monthSlips.reduce((sum, s) => sum + s.basicSalary, 0);
        const prodTotal = monthSlips.reduce((sum, s) => sum + s.productionAmount, 0);
        const otTotal = monthSlips.reduce((sum, s) => sum + s.overtimeAmount, 0);
        const hasPayrollData = basicTotal + prodTotal + otTotal > 0;
        const payrollDistribution = hasPayrollData ? [
            { name: 'Basic Salary', value: basicTotal },
            { name: 'Production', value: prodTotal },
            { name: 'Overtime', value: otTotal },
        ] : [];

        const responseData = {
            totalStaff: totalEmployees,
            activeStaff: activeEmployees,
            attendancePercentage,
            presentedCount,
            absentToday,
            monthProduction,
            momChange,
            totalOutstandingLoans,
            activeLoansCount: activeLoans.length,
            pendingLeaves,
            pendingProduction,
            pendingLoans,
            netPayrollThisMonth,
            slipsGenerated,
            attendanceTrendData,
            productionData,
            payrollDistribution
        };

        // Save to cache
        dashboardCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

        res.json(responseData);

    } catch (e) {
        addError(e, 'GET /api/analytics/dashboard');
        res.status(500).json({ error: e.message });
    }
});

module.exports = { router, init };
